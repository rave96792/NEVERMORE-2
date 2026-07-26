#!/usr/bin/env python3
"""
Nevermore DTF Backend Regression + New Composite Endpoint Test
Tests all refactored endpoints for behavior preservation + new /api/composite
"""
import requests
import json
import os
import struct
from io import BytesIO

BASE_URL = "http://localhost:3000"
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")

# Test counters
passed = 0
failed = 0
results = []

def log_result(test_name, success, details=""):
    global passed, failed, results
    if success:
        passed += 1
        status = "✅ PASS"
    else:
        failed += 1
        status = "❌ FAIL"
    results.append(f"{status} | {test_name} | {details}")
    print(f"{status} | {test_name}")
    if details and not success:
        print(f"    Details: {details}")

def verify_png_signature(data):
    """Verify PNG magic bytes: 0x89 0x50 0x4E 0x47"""
    if len(data) < 8:
        return False
    return data[0:8] == b'\x89PNG\r\n\x1a\n'

def get_png_ihdr_info(data):
    """Extract width, height, color type from PNG IHDR chunk"""
    if not verify_png_signature(data):
        return None
    # IHDR starts at byte 8 (after signature)
    # Format: 4 bytes length, 4 bytes "IHDR", 4 bytes width, 4 bytes height, 1 byte bit depth, 1 byte color type
    if len(data) < 29:
        return None
    width = struct.unpack('>I', data[16:20])[0]
    height = struct.unpack('>I', data[20:24])[0]
    color_type = data[25]
    return {'width': width, 'height': height, 'color_type': color_type}

print("=" * 80)
print("NEVERMORE DTF BACKEND REGRESSION + COMPOSITE TEST")
print("=" * 80)
print(f"Base URL: {BASE_URL}")
print(f"Admin Token: {'✓ SET' if ADMIN_TOKEN else '✗ MISSING'}")
print()

# ============================================================================
# PART A: REGRESSION TESTS - All existing endpoints must work identically
# ============================================================================
print("PART A: REGRESSION TESTS")
print("-" * 80)

# Test 1: GET /api/ → root endpoint
try:
    r = requests.get(f"{BASE_URL}/api/")
    if r.status_code == 200 and r.json().get("message") == "Nevermore DTF API":
        log_result("A1: GET /api/", True, "200 with correct message")
    else:
        log_result("A1: GET /api/", False, f"Status {r.status_code}, body: {r.text[:100]}")
except Exception as e:
    log_result("A1: GET /api/", False, str(e))

# Test 2: GET /api/health → health check
try:
    r = requests.get(f"{BASE_URL}/api/health")
    if r.status_code in [200, 503]:
        data = r.json()
        checks = data.get("checks", {})
        mongo_ok = checks.get("mongo", {}).get("ok")
        paypal_ok = checks.get("paypal", {}).get("ok")
        env = checks.get("env", {})
        
        # Verify required env vars are reported
        required_env = ["MONGO_URL", "DB_NAME", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "RESEND_API_KEY"]
        env_ok = all(env.get(k) == True for k in required_env)
        
        if mongo_ok is not None and paypal_ok is not None and env_ok:
            log_result("A2: GET /api/health", True, f"Status {r.status_code}, mongo.ok={mongo_ok}, paypal.ok={paypal_ok}")
        else:
            log_result("A2: GET /api/health", False, f"Missing checks: {data}")
    else:
        log_result("A2: GET /api/health", False, f"Unexpected status {r.status_code}")
except Exception as e:
    log_result("A2: GET /api/health", False, str(e))

# Test 3: GET /api/pricing → 9 sheets from 14x12 to 14x120
try:
    r = requests.get(f"{BASE_URL}/api/pricing")
    if r.status_code == 200:
        data = r.json()
        sheets = data.get("sheets", [])
        if len(sheets) == 9:
            # Verify first and last sheet
            first = next((s for s in sheets if s.get("id") == "14x12"), None)
            last = next((s for s in sheets if s.get("id") == "14x120"), None)
            if first and first.get("price") == 10 and last and last.get("price") == 40:
                log_result("A3: GET /api/pricing", True, f"9 sheets, 14x12=$10, 14x120=$40")
            else:
                log_result("A3: GET /api/pricing", False, f"Sheet prices incorrect: first={first}, last={last}")
        else:
            log_result("A3: GET /api/pricing", False, f"Expected 9 sheets, got {len(sheets)}")
    else:
        log_result("A3: GET /api/pricing", False, f"Status {r.status_code}")
except Exception as e:
    log_result("A3: GET /api/pricing", False, str(e))

# Test 4: POST /api/pricing/quote → valid and invalid
try:
    # Valid quote
    r = requests.post(f"{BASE_URL}/api/pricing/quote", json={"sheetId": "14x60"})
    if r.status_code == 200 and r.json().get("unitPrice") == 26:
        log_result("A4a: POST /api/pricing/quote (valid)", True, "14x60 → $26")
    else:
        log_result("A4a: POST /api/pricing/quote (valid)", False, f"Status {r.status_code}, body: {r.json()}")
    
    # Invalid sheet ID
    r = requests.post(f"{BASE_URL}/api/pricing/quote", json={"sheetId": "99x99"})
    if r.status_code == 400:
        log_result("A4b: POST /api/pricing/quote (invalid)", True, "Invalid sheet → 400")
    else:
        log_result("A4b: POST /api/pricing/quote (invalid)", False, f"Expected 400, got {r.status_code}")
except Exception as e:
    log_result("A4: POST /api/pricing/quote", False, str(e))

# Test 5: POST /api/cart/validate → tampered price recomputation
try:
    # Tampered unitPrice should be recomputed
    r = requests.post(f"{BASE_URL}/api/cart/validate", json={
        "items": [{"sheetId": "14x36", "quantity": 2, "unitPrice": 9999}]
    })
    if r.status_code == 200:
        data = r.json()
        items = data.get("items", [])
        if items and items[0].get("unitPrice") == 18 and data.get("subtotal") == 36:
            log_result("A5a: POST /api/cart/validate (tamper)", True, "9999 → 18, subtotal=36")
        else:
            log_result("A5a: POST /api/cart/validate (tamper)", False, f"Price not recomputed: {data}")
    else:
        log_result("A5a: POST /api/cart/validate (tamper)", False, f"Status {r.status_code}")
    
    # Empty items should return 400
    r = requests.post(f"{BASE_URL}/api/cart/validate", json={"items": []})
    if r.status_code == 400:
        log_result("A5b: POST /api/cart/validate (empty)", True, "Empty items → 400")
    else:
        log_result("A5b: POST /api/cart/validate (empty)", False, f"Expected 400, got {r.status_code}")
except Exception as e:
    log_result("A5: POST /api/cart/validate", False, str(e))

# Test 6: POST /api/paypal/create-order → HI and CA shipping
order_ids = []
try:
    # HI shipping: $5, tax 4.712%
    r = requests.post(f"{BASE_URL}/api/paypal/create-order", json={
        "items": [{"sheetId": "14x36", "quantity": 1, "unitPrice": 18}],
        "shipping": {
            "fullName": "Test Buyer HI",
            "email": "buyer.hi@example.com",
            "line1": "123 Ala Moana Blvd",
            "city": "Honolulu",
            "state": "HI",
            "postalCode": "96813",
            "country": "US"
        }
    })
    if r.status_code == 201:
        data = r.json()
        totals = data.get("totals", {})
        order_ids.append(data.get("internalOrderId"))
        if (totals.get("shipping") == 5 and 
            totals.get("taxState") == "HI" and 
            abs(totals.get("taxRate", 0) - 0.04712) < 0.0001 and
            data.get("orderNumber") is not None):
            log_result("A6a: POST /api/paypal/create-order (HI)", True, 
                      f"201, shipping=$5, taxState=HI, orderNumber={data.get('orderNumber')}")
        else:
            log_result("A6a: POST /api/paypal/create-order (HI)", False, f"Totals incorrect: {totals}")
    else:
        log_result("A6a: POST /api/paypal/create-order (HI)", False, f"Status {r.status_code}, body: {r.text[:200]}")
except Exception as e:
    log_result("A6a: POST /api/paypal/create-order (HI)", False, str(e))

try:
    # CA shipping: $12, tax $0
    r = requests.post(f"{BASE_URL}/api/paypal/create-order", json={
        "items": [{"sheetId": "14x24", "quantity": 2, "unitPrice": 13}],
        "shipping": {
            "fullName": "Test Buyer CA",
            "email": "buyer.ca@example.com",
            "line1": "456 Market St",
            "city": "San Francisco",
            "state": "CA",
            "postalCode": "94102",
            "country": "US"
        }
    })
    if r.status_code == 201:
        data = r.json()
        totals = data.get("totals", {})
        order_ids.append(data.get("internalOrderId"))
        if totals.get("shipping") == 12 and totals.get("tax") == 0:
            log_result("A6b: POST /api/paypal/create-order (CA)", True, 
                      f"201, shipping=$12, tax=$0, orderNumber={data.get('orderNumber')}")
        else:
            log_result("A6b: POST /api/paypal/create-order (CA)", False, f"Totals incorrect: {totals}")
    else:
        log_result("A6b: POST /api/paypal/create-order (CA)", False, f"Status {r.status_code}")
except Exception as e:
    log_result("A6b: POST /api/paypal/create-order (CA)", False, str(e))

# Test invalid payloads
try:
    # Bad email
    r = requests.post(f"{BASE_URL}/api/paypal/create-order", json={
        "items": [{"sheetId": "14x24", "quantity": 1}],
        "shipping": {"fullName": "Test", "email": "bad-email", "line1": "123", "city": "City", "state": "CA", "postalCode": "12345", "country": "US"}
    })
    if r.status_code == 400:
        log_result("A6c: POST /api/paypal/create-order (bad email)", True, "400")
    else:
        log_result("A6c: POST /api/paypal/create-order (bad email)", False, f"Expected 400, got {r.status_code}")
    
    # Empty items
    r = requests.post(f"{BASE_URL}/api/paypal/create-order", json={
        "items": [],
        "shipping": {"fullName": "Test", "email": "test@example.com", "line1": "123", "city": "City", "state": "CA", "postalCode": "12345", "country": "US"}
    })
    if r.status_code == 400:
        log_result("A6d: POST /api/paypal/create-order (empty items)", True, "400")
    else:
        log_result("A6d: POST /api/paypal/create-order (empty items)", False, f"Expected 400, got {r.status_code}")
    
    # Unknown sheetId
    r = requests.post(f"{BASE_URL}/api/paypal/create-order", json={
        "items": [{"sheetId": "99x99", "quantity": 1}],
        "shipping": {"fullName": "Test", "email": "test@example.com", "line1": "123", "city": "City", "state": "CA", "postalCode": "12345", "country": "US"}
    })
    if r.status_code == 400:
        log_result("A6e: POST /api/paypal/create-order (unknown sheet)", True, "400")
    else:
        log_result("A6e: POST /api/paypal/create-order (unknown sheet)", False, f"Expected 400, got {r.status_code}")
except Exception as e:
    log_result("A6: POST /api/paypal/create-order (invalid)", False, str(e))

# Test 7: GET /api/orders/:id → retrieve order
if order_ids:
    try:
        order_id = order_ids[0]
        r = requests.get(f"{BASE_URL}/api/orders/{order_id}")
        if r.status_code == 200:
            data = r.json()
            if data.get("status") == "PENDING" and data.get("id") == order_id:
                log_result("A7a: GET /api/orders/:id (valid)", True, f"200, status=PENDING")
            else:
                log_result("A7a: GET /api/orders/:id (valid)", False, f"Data incorrect: {data}")
        else:
            log_result("A7a: GET /api/orders/:id (valid)", False, f"Status {r.status_code}")
    except Exception as e:
        log_result("A7a: GET /api/orders/:id (valid)", False, str(e))
    
    # Bogus ID
    try:
        r = requests.get(f"{BASE_URL}/api/orders/bogus-id-12345")
        if r.status_code == 404:
            log_result("A7b: GET /api/orders/:id (bogus)", True, "404")
        else:
            log_result("A7b: GET /api/orders/:id (bogus)", False, f"Expected 404, got {r.status_code}")
    except Exception as e:
        log_result("A7b: GET /api/orders/:id (bogus)", False, str(e))

# Test 8: POST /api/orders/:id/status → admin auth + status transitions
if order_ids and ADMIN_TOKEN:
    order_id = order_ids[0]
    
    # No token → 401
    try:
        r = requests.post(f"{BASE_URL}/api/orders/{order_id}/status", json={"status": "PROCESSING"})
        if r.status_code == 401:
            log_result("A8a: POST /api/orders/:id/status (no token)", True, "401")
        else:
            log_result("A8a: POST /api/orders/:id/status (no token)", False, f"Expected 401, got {r.status_code}")
    except Exception as e:
        log_result("A8a: POST /api/orders/:id/status (no token)", False, str(e))
    
    # Wrong token → 401
    try:
        r = requests.post(f"{BASE_URL}/api/orders/{order_id}/status", 
                         json={"status": "PROCESSING", "adminToken": "wrong-token"})
        if r.status_code == 401:
            log_result("A8b: POST /api/orders/:id/status (wrong token)", True, "401")
        else:
            log_result("A8b: POST /api/orders/:id/status (wrong token)", False, f"Expected 401, got {r.status_code}")
    except Exception as e:
        log_result("A8b: POST /api/orders/:id/status (wrong token)", False, str(e))
    
    # Invalid status → 400
    try:
        r = requests.post(f"{BASE_URL}/api/orders/{order_id}/status", 
                         json={"status": "CANCELLED", "adminToken": ADMIN_TOKEN})
        if r.status_code == 400:
            log_result("A8c: POST /api/orders/:id/status (invalid status)", True, "400")
        else:
            log_result("A8c: POST /api/orders/:id/status (invalid status)", False, f"Expected 400, got {r.status_code}")
    except Exception as e:
        log_result("A8c: POST /api/orders/:id/status (invalid status)", False, str(e))
    
    # Valid PROCESSING → 200
    try:
        r = requests.post(f"{BASE_URL}/api/orders/{order_id}/status", 
                         json={"status": "PROCESSING", "adminToken": ADMIN_TOKEN})
        if r.status_code == 200:
            data = r.json()
            if data.get("ok") and data.get("status") == "PROCESSING":
                # Email may fail with validation error for example.com - that's expected
                log_result("A8d: POST /api/orders/:id/status (PROCESSING)", True, 
                          f"200, status=PROCESSING, email.ok={data.get('email', {}).get('ok')}")
            else:
                log_result("A8d: POST /api/orders/:id/status (PROCESSING)", False, f"Response incorrect: {data}")
        else:
            log_result("A8d: POST /api/orders/:id/status (PROCESSING)", False, f"Status {r.status_code}")
    except Exception as e:
        log_result("A8d: POST /api/orders/:id/status (PROCESSING)", False, str(e))
    
    # Valid SHIPPED with tracking → 200
    try:
        r = requests.post(f"{BASE_URL}/api/orders/{order_id}/status", 
                         json={"status": "SHIPPED", "trackingNumber": "1Z999AA10123456784", 
                              "carrier": "UPS", "adminToken": ADMIN_TOKEN})
        if r.status_code == 200:
            data = r.json()
            if data.get("ok") and data.get("status") == "SHIPPED":
                # Verify order was updated
                r2 = requests.get(f"{BASE_URL}/api/orders/{order_id}")
                if r2.status_code == 200:
                    order_data = r2.json()
                    if (order_data.get("status") == "SHIPPED" and 
                        order_data.get("trackingNumber") == "1Z999AA10123456784" and
                        order_data.get("carrier") == "UPS"):
                        log_result("A8e: POST /api/orders/:id/status (SHIPPED)", True, 
                                  "200, order updated with tracking")
                    else:
                        log_result("A8e: POST /api/orders/:id/status (SHIPPED)", False, 
                                  f"Order not updated correctly: {order_data}")
                else:
                    log_result("A8e: POST /api/orders/:id/status (SHIPPED)", False, 
                              f"Could not verify order update: {r2.status_code}")
            else:
                log_result("A8e: POST /api/orders/:id/status (SHIPPED)", False, f"Response incorrect: {data}")
        else:
            log_result("A8e: POST /api/orders/:id/status (SHIPPED)", False, f"Status {r.status_code}")
    except Exception as e:
        log_result("A8e: POST /api/orders/:id/status (SHIPPED)", False, str(e))
    
    # Non-existent order → 404
    try:
        r = requests.post(f"{BASE_URL}/api/orders/bogus-id-12345/status", 
                         json={"status": "PROCESSING", "adminToken": ADMIN_TOKEN})
        if r.status_code == 404:
            log_result("A8f: POST /api/orders/:id/status (not found)", True, "404")
        else:
            log_result("A8f: POST /api/orders/:id/status (not found)", False, f"Expected 404, got {r.status_code}")
    except Exception as e:
        log_result("A8f: POST /api/orders/:id/status (not found)", False, str(e))

# Test 9: POST /api/uploads → upload PNG
uploaded_artwork_url = None
try:
    # Create a minimal PNG (1x1 transparent)
    png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    
    files = {'file': ('test.png', BytesIO(png_data), 'image/png')}
    r = requests.post(f"{BASE_URL}/api/uploads", files=files)
    if r.status_code == 200:
        data = r.json()
        uploaded_artwork_url = data.get("artworkUrl")
        if uploaded_artwork_url and data.get("contentType") == "image/png":
            log_result("A9a: POST /api/uploads (PNG)", True, f"200, artworkUrl={uploaded_artwork_url[:50]}...")
        else:
            log_result("A9a: POST /api/uploads (PNG)", False, f"Response incorrect: {data}")
    else:
        log_result("A9a: POST /api/uploads (PNG)", False, f"Status {r.status_code}, body: {r.text[:200]}")
except Exception as e:
    log_result("A9a: POST /api/uploads (PNG)", False, str(e))

# Test invalid uploads
try:
    # JPEG → 415
    jpeg_data = b'\xff\xd8\xff\xe0\x00\x10JFIF'
    files = {'file': ('test.jpg', BytesIO(jpeg_data), 'image/jpeg')}
    r = requests.post(f"{BASE_URL}/api/uploads", files=files)
    if r.status_code == 415:
        log_result("A9b: POST /api/uploads (JPEG)", True, "415")
    else:
        log_result("A9b: POST /api/uploads (JPEG)", False, f"Expected 415, got {r.status_code}")
    
    # Empty file → 413/400
    files = {'file': ('empty.png', BytesIO(b''), 'image/png')}
    r = requests.post(f"{BASE_URL}/api/uploads", files=files)
    if r.status_code in [413, 400]:
        log_result("A9c: POST /api/uploads (empty)", True, f"{r.status_code}")
    else:
        log_result("A9c: POST /api/uploads (empty)", False, f"Expected 413/400, got {r.status_code}")
    
    # Missing file field → 400
    r = requests.post(f"{BASE_URL}/api/uploads", data={})
    if r.status_code == 400:
        log_result("A9d: POST /api/uploads (no file)", True, "400")
    else:
        log_result("A9d: POST /api/uploads (no file)", False, f"Expected 400, got {r.status_code}")
except Exception as e:
    log_result("A9: POST /api/uploads (invalid)", False, str(e))

# Test 10: GET /api/uploads/:filename → retrieve uploaded file
if uploaded_artwork_url:
    try:
        r = requests.get(f"{BASE_URL}{uploaded_artwork_url}")
        if r.status_code == 200:
            if r.headers.get("Content-Type") == "image/png" and verify_png_signature(r.content):
                log_result("A10: GET /api/uploads/:filename", True, 
                          f"200, Content-Type: image/png, valid PNG signature")
            else:
                log_result("A10: GET /api/uploads/:filename", False, 
                          f"Content-Type: {r.headers.get('Content-Type')}, PNG valid: {verify_png_signature(r.content)}")
        else:
            log_result("A10: GET /api/uploads/:filename", False, f"Status {r.status_code}")
    except Exception as e:
        log_result("A10: GET /api/uploads/:filename", False, str(e))

# Test 11: POST /api/contact → valid and invalid
try:
    # Valid contact
    r = requests.post(f"{BASE_URL}/api/contact", json={
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "555-1234",
        "subject": "Test inquiry",
        "message": "This is a test message with more than 10 characters."
    })
    if r.status_code == 200 and r.json().get("ok"):
        log_result("A11a: POST /api/contact (valid)", True, "200 {ok:true}")
    else:
        log_result("A11a: POST /api/contact (valid)", False, f"Status {r.status_code}, body: {r.json()}")
    
    # Bad email → 400
    r = requests.post(f"{BASE_URL}/api/contact", json={
        "name": "John Doe",
        "email": "bad-email",
        "message": "Test message"
    })
    if r.status_code == 400:
        log_result("A11b: POST /api/contact (bad email)", True, "400")
    else:
        log_result("A11b: POST /api/contact (bad email)", False, f"Expected 400, got {r.status_code}")
    
    # Short name → 400
    r = requests.post(f"{BASE_URL}/api/contact", json={
        "name": "J",
        "email": "john@example.com",
        "message": "Test message"
    })
    if r.status_code == 400:
        log_result("A11c: POST /api/contact (short name)", True, "400")
    else:
        log_result("A11c: POST /api/contact (short name)", False, f"Expected 400, got {r.status_code}")
    
    # Short message → 400
    r = requests.post(f"{BASE_URL}/api/contact", json={
        "name": "John Doe",
        "email": "john@example.com",
        "message": "Short"
    })
    if r.status_code == 400:
        log_result("A11d: POST /api/contact (short message)", True, "400")
    else:
        log_result("A11d: POST /api/contact (short message)", False, f"Expected 400, got {r.status_code}")
except Exception as e:
    log_result("A11: POST /api/contact", False, str(e))

# Test 12: POST /api/email/test → send test emails
sample_composite_url = None
try:
    r = requests.post(f"{BASE_URL}/api/email/test")
    if r.status_code == 200:
        data = r.json()
        results_data = data.get("results", {})
        shop = results_data.get("shop", {})
        buyer = results_data.get("buyer", {})
        sample_composite_url = data.get("sampleCompositeUrl")
        
        # Shop email should succeed, buyer may fail with example.com validation
        if shop.get("ok") and sample_composite_url:
            log_result("A12a: POST /api/email/test", True, 
                      f"200, shop.ok={shop.get('ok')}, buyer.ok={buyer.get('ok')}, sampleCompositeUrl present")
        else:
            log_result("A12a: POST /api/email/test", False, f"Response incorrect: {data}")
    else:
        log_result("A12a: POST /api/email/test", False, f"Status {r.status_code}")
except Exception as e:
    log_result("A12a: POST /api/email/test", False, str(e))

# Verify sample composite URL
if sample_composite_url:
    try:
        r = requests.get(f"{BASE_URL}{sample_composite_url}")
        if r.status_code == 200:
            if r.headers.get("Content-Type") == "image/png" and verify_png_signature(r.content):
                ihdr = get_png_ihdr_info(r.content)
                if ihdr and ihdr['color_type'] == 6:  # RGBA
                    log_result("A12b: GET sampleCompositeUrl", True, 
                              f"200, image/png, colorType=6 (RGBA)")
                else:
                    log_result("A12b: GET sampleCompositeUrl", False, 
                              f"colorType={ihdr['color_type'] if ihdr else 'unknown'}, expected 6")
            else:
                log_result("A12b: GET sampleCompositeUrl", False, 
                          f"Content-Type: {r.headers.get('Content-Type')}, PNG valid: {verify_png_signature(r.content)}")
        else:
            log_result("A12b: GET sampleCompositeUrl", False, f"Status {r.status_code}")
    except Exception as e:
        log_result("A12b: GET sampleCompositeUrl", False, str(e))

# ============================================================================
# PART B: NEW ENDPOINT - POST /api/composite
# ============================================================================
print()
print("PART B: NEW ENDPOINT - POST /api/composite")
print("-" * 80)

composite_artwork_url = None

# Test 1: Upload a PNG first for use in composite
test_artwork_url = None
try:
    png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    files = {'file': ('test-composite.png', BytesIO(png_data), 'image/png')}
    r = requests.post(f"{BASE_URL}/api/uploads", files=files)
    if r.status_code == 200:
        test_artwork_url = r.json().get("artworkUrl")
        log_result("B1: Upload test artwork", True, f"artworkUrl={test_artwork_url[:50]}...")
    else:
        log_result("B1: Upload test artwork", False, f"Status {r.status_code}")
except Exception as e:
    log_result("B1: Upload test artwork", False, str(e))

# Test 2: POST /api/composite with valid layout
if test_artwork_url:
    try:
        r = requests.post(f"{BASE_URL}/api/composite", json={
            "layout": {
                "version": 1,
                "sheetSizeId": "14x24",
                "items": [{
                    "artworkUrl": test_artwork_url,
                    "xIn": 1,
                    "yIn": 1,
                    "widthIn": 4,
                    "heightIn": 4,
                    "rotationDeg": 0,
                    "zIndex": 0
                }]
            }
        })
        if r.status_code == 200:
            data = r.json()
            composite_artwork_url = data.get("artworkUrl")
            if composite_artwork_url and data.get("contentType") == "image/png":
                log_result("B2: POST /api/composite (valid)", True, 
                          f"200, artworkUrl={composite_artwork_url[:50]}...")
            else:
                log_result("B2: POST /api/composite (valid)", False, f"Response incorrect: {data}")
        else:
            log_result("B2: POST /api/composite (valid)", False, 
                      f"Status {r.status_code}, body: {r.text[:200]}")
    except Exception as e:
        log_result("B2: POST /api/composite (valid)", False, str(e))

# Test 3: Verify composite PNG dimensions and color type
if composite_artwork_url:
    try:
        r = requests.get(f"{BASE_URL}{composite_artwork_url}")
        if r.status_code == 200:
            if verify_png_signature(r.content):
                ihdr = get_png_ihdr_info(r.content)
                if ihdr:
                    # 14x24 sheet at 300 DPI: 4200x7200 pixels
                    expected_width = 14 * 300  # 4200
                    expected_height = 24 * 300  # 7200
                    if (ihdr['width'] == expected_width and 
                        ihdr['height'] == expected_height and 
                        ihdr['color_type'] == 6):  # RGBA
                        log_result("B3: GET composite PNG", True, 
                                  f"200, {ihdr['width']}x{ihdr['height']}, colorType=6 (RGBA)")
                    else:
                        log_result("B3: GET composite PNG", False, 
                                  f"Dimensions: {ihdr['width']}x{ihdr['height']} (expected {expected_width}x{expected_height}), colorType={ihdr['color_type']} (expected 6)")
                else:
                    log_result("B3: GET composite PNG", False, "Could not parse IHDR")
            else:
                log_result("B3: GET composite PNG", False, "Invalid PNG signature")
        else:
            log_result("B3: GET composite PNG", False, f"Status {r.status_code}")
    except Exception as e:
        log_result("B3: GET composite PNG", False, str(e))

# Test 4: Invalid payloads
try:
    # No layout → 400
    r = requests.post(f"{BASE_URL}/api/composite", json={})
    if r.status_code == 400:
        log_result("B4a: POST /api/composite (no layout)", True, "400")
    else:
        log_result("B4a: POST /api/composite (no layout)", False, f"Expected 400, got {r.status_code}")
    
    # Unknown sheetSizeId → 500 (server render error)
    r = requests.post(f"{BASE_URL}/api/composite", json={
        "layout": {
            "sheetSizeId": "99x99",
            "items": []
        }
    })
    if r.status_code == 500:
        log_result("B4b: POST /api/composite (unknown sheet)", True, "500 (expected)")
    else:
        log_result("B4b: POST /api/composite (unknown sheet)", False, 
                  f"Expected 500, got {r.status_code}")
except Exception as e:
    log_result("B4: POST /api/composite (invalid)", False, str(e))

# ============================================================================
# SUMMARY
# ============================================================================
print()
print("=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total: {passed + failed} | Passed: {passed} | Failed: {failed}")
print()

if failed > 0:
    print("FAILED TESTS:")
    for r in results:
        if "❌" in r:
            print(f"  {r}")
    print()

print("DETAILED RESULTS:")
for r in results:
    print(f"  {r}")

print()
print("=" * 80)
if failed == 0:
    print("✅ ALL TESTS PASSED - NO REGRESSIONS DETECTED")
else:
    print(f"❌ {failed} TEST(S) FAILED - REVIEW REQUIRED")
print("=" * 80)
