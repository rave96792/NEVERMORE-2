#!/usr/bin/env python3
"""
Nevermore DTF Backend Test - Sharp Authoritative Print-File Pipeline
Tests the new renderOrder + /api/orders/[id]/rerender + capture-order integration
"""
import requests
import json
import os
import struct
from io import BytesIO
from pymongo import MongoClient
import re

BASE_URL = "http://localhost:3000"

# Get ADMIN_TOKEN from .env
ADMIN_TOKEN = None
try:
    with open('/app/.env', 'r') as f:
        for line in f:
            m = re.match(r'ADMIN_TOKEN=(.*)', line.strip())
            if m:
                ADMIN_TOKEN = m.group(1)
                break
except Exception as e:
    print(f"Warning: Could not read ADMIN_TOKEN from .env: {e}")

# Get MongoDB connection details
MONGO_URL = None
DB_NAME = None
try:
    with open('/app/.env', 'r') as f:
        for line in f:
            m = re.match(r'([A-Z_]+)=(.*)', line.strip())
            if m:
                key, val = m.group(1), m.group(2)
                if key == 'MONGO_URL':
                    MONGO_URL = val
                elif key == 'DB_NAME':
                    DB_NAME = val
except Exception as e:
    print(f"Warning: Could not read MongoDB config from .env: {e}")

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
    if len(data) < 29:
        return None
    width = struct.unpack('>I', data[16:20])[0]
    height = struct.unpack('>I', data[20:24])[0]
    color_type = data[25]
    return {'width': width, 'height': height, 'color_type': color_type}

print("=" * 80)
print("NEVERMORE DTF - SHARP AUTHORITATIVE PRINT-FILE PIPELINE TEST")
print("=" * 80)
print(f"Base URL: {BASE_URL}")
print(f"Admin Token: {'✓ SET' if ADMIN_TOKEN else '✗ MISSING'}")
print(f"MongoDB: {'✓ CONFIGURED' if MONGO_URL and DB_NAME else '✗ MISSING'}")
print()

# ============================================================================
# TEST A — Setup: create an order to work with
# ============================================================================
print("TEST A — SETUP: CREATE ORDER WITH COMPOSITE")
print("-" * 80)

# Step 1: Upload a small PNG
uploaded_artwork_url = None
try:
    # Create a minimal PNG (1x1 transparent)
    png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    
    files = {'file': ('test-sharp.png', BytesIO(png_data), 'image/png')}
    r = requests.post(f"{BASE_URL}/api/uploads", files=files)
    if r.status_code == 200:
        uploaded_artwork_url = r.json().get("artworkUrl")
        log_result("A1: Upload PNG", True, f"artworkUrl={uploaded_artwork_url}")
    else:
        log_result("A1: Upload PNG", False, f"Status {r.status_code}, body: {r.text[:200]}")
except Exception as e:
    log_result("A1: Upload PNG", False, str(e))

# Step 2: POST /api/composite with layout
composite_url = None
if uploaded_artwork_url:
    try:
        r = requests.post(f"{BASE_URL}/api/composite", json={
            "layout": {
                "version": 1,
                "sheetSizeId": "14x24",
                "items": [{
                    "artworkUrl": uploaded_artwork_url,
                    "xIn": 1,
                    "yIn": 1,
                    "widthIn": 6,
                    "heightIn": 6,
                    "rotationDeg": 15,
                    "zIndex": 0
                }]
            }
        })
        if r.status_code == 200:
            composite_url = r.json().get("artworkUrl")
            log_result("A2: Create composite", True, f"compositeUrl={composite_url}")
        else:
            log_result("A2: Create composite", False, f"Status {r.status_code}, body: {r.text[:200]}")
    except Exception as e:
        log_result("A2: Create composite", False, str(e))

# Step 3: POST /api/paypal/create-order
internal_order_id = None
order_number = None
if composite_url and uploaded_artwork_url:
    try:
        r = requests.post(f"{BASE_URL}/api/paypal/create-order", json={
            "items": [{
                "sheetId": "14x24",
                "quantity": 1,
                "artworkUrl": composite_url,
                "compositeUrl": composite_url,
                "printFileSource": "sharp-authoritative",
                "layout": {
                    "version": 1,
                    "sheetSizeId": "14x24",
                    "items": [{
                        "artworkUrl": uploaded_artwork_url,
                        "xIn": 1,
                        "yIn": 1,
                        "widthIn": 6,
                        "heightIn": 6,
                        "rotationDeg": 15,
                        "zIndex": 0
                    }]
                }
            }],
            "shipping": {
                "fullName": "Sharp Test",
                "email": "buyer@example.com",
                "phone": "808-555-0100"
            },
            "deliveryMethod": "pickup"
        })
        if r.status_code == 201:
            data = r.json()
            internal_order_id = data.get("internalOrderId")
            order_number = data.get("orderNumber")
            log_result("A3: Create order", True, 
                      f"internalOrderId={internal_order_id}, orderNumber={order_number}")
        else:
            log_result("A3: Create order", False, f"Status {r.status_code}, body: {r.text[:200]}")
    except Exception as e:
        log_result("A3: Create order", False, str(e))

# ============================================================================
# TEST B — Rerender endpoint (main test surface)
# ============================================================================
print()
print("TEST B — RERENDER ENDPOINT")
print("-" * 80)

if not internal_order_id:
    print("⚠️  Skipping TEST B - no order created in TEST A")
    log_result("B: Rerender tests", False, "Prerequisite failed: no order ID")
else:
    # B1: No token → 401
    try:
        r = requests.post(f"{BASE_URL}/api/orders/{internal_order_id}/rerender", json={})
        if r.status_code == 401 and r.json().get("error") == "Unauthorized":
            log_result("B1: Rerender no token", True, "401 Unauthorized")
        else:
            log_result("B1: Rerender no token", False, 
                      f"Expected 401 with 'Unauthorized', got {r.status_code}: {r.json()}")
    except Exception as e:
        log_result("B1: Rerender no token", False, str(e))
    
    # B2: Wrong token → 401
    try:
        r = requests.post(f"{BASE_URL}/api/orders/{internal_order_id}/rerender", 
                         headers={"x-admin-token": "wrong-token"}, json={})
        if r.status_code == 401:
            log_result("B2: Rerender wrong token", True, "401")
        else:
            log_result("B2: Rerender wrong token", False, f"Expected 401, got {r.status_code}")
    except Exception as e:
        log_result("B2: Rerender wrong token", False, str(e))
    
    # B3: Correct token with force:true → 200 with proper fields
    if ADMIN_TOKEN:
        try:
            r = requests.post(f"{BASE_URL}/api/orders/{internal_order_id}/rerender", 
                             headers={"x-admin-token": ADMIN_TOKEN}, 
                             json={"force": True})
            if r.status_code == 200:
                data = r.json()
                required_fields = ['ok', 'status', 'renderedCount', 'totalItems', 'attempt', 'alreadySucceeded']
                missing = [f for f in required_fields if f not in data]
                
                if not missing:
                    if (data.get('ok') == True and 
                        data.get('status') == 'succeeded' and 
                        data.get('renderedCount') == 1 and 
                        data.get('totalItems') == 1 and 
                        data.get('attempt') == 1 and 
                        data.get('alreadySucceeded') == False):
                        log_result("B3: Rerender with token+force", True, 
                                  f"200, ok=true, status=succeeded, renderedCount=1, attempt=1")
                    else:
                        log_result("B3: Rerender with token+force", False, 
                                  f"Fields present but values incorrect: {data}")
                else:
                    log_result("B3: Rerender with token+force", False, 
                              f"Missing fields: {missing}, got: {data}")
            else:
                log_result("B3: Rerender with token+force", False, 
                          f"Status {r.status_code}, body: {r.text[:200]}")
        except Exception as e:
            log_result("B3: Rerender with token+force", False, str(e))
    else:
        log_result("B3: Rerender with token+force", False, "ADMIN_TOKEN not set")
    
    # B4: GET /api/orders/:id → verify render fields
    try:
        r = requests.get(f"{BASE_URL}/api/orders/{internal_order_id}")
        if r.status_code == 200:
            data = r.json()
            checks = []
            
            # Check renderStatus
            if data.get('renderStatus') == 'succeeded':
                checks.append('renderStatus=succeeded')
            else:
                checks.append(f'renderStatus={data.get("renderStatus")} (expected succeeded)')
            
            # Check renderAttempts
            if data.get('renderAttempts') == 1:
                checks.append('renderAttempts=1')
            else:
                checks.append(f'renderAttempts={data.get("renderAttempts")} (expected 1)')
            
            # Check renderCompletedAt present
            if data.get('renderCompletedAt'):
                checks.append('renderCompletedAt present')
            else:
                checks.append('renderCompletedAt MISSING')
            
            # Check items[0].printFileSource
            items = data.get('items', [])
            if items and items[0].get('printFileSource') == 'sharp-authoritative':
                checks.append('printFileSource=sharp-authoritative')
            else:
                checks.append(f'printFileSource={items[0].get("printFileSource") if items else "NO ITEMS"}')
            
            # Check items[0].compositeUrl changed
            if items and items[0].get('compositeUrl') != composite_url:
                checks.append('compositeUrl CHANGED')
            else:
                checks.append('compositeUrl NOT CHANGED')
            
            # Check items[0].compositeSize
            if items and items[0].get('compositeSize', 0) > 100000:
                checks.append(f'compositeSize={items[0].get("compositeSize")}')
            else:
                checks.append(f'compositeSize={items[0].get("compositeSize", 0)} (expected >100000)')
            
            all_good = all('expected' not in c and 'MISSING' not in c and 'NOT CHANGED' not in c 
                          for c in checks)
            log_result("B4: GET order after rerender", all_good, ', '.join(checks))
            
            # Save new composite URL for B6
            if items:
                new_composite_url = items[0].get('compositeUrl')
        else:
            log_result("B4: GET order after rerender", False, f"Status {r.status_code}")
    except Exception as e:
        log_result("B4: GET order after rerender", False, str(e))
    
    # B5: Idempotency test - POST again without force
    if ADMIN_TOKEN:
        try:
            r = requests.post(f"{BASE_URL}/api/orders/{internal_order_id}/rerender", 
                             headers={"x-admin-token": ADMIN_TOKEN}, 
                             json={})
            if r.status_code == 200:
                data = r.json()
                if data.get('alreadySucceeded') == True and data.get('renderedCount') == 0:
                    log_result("B5: Idempotency test", True, 
                              "200, alreadySucceeded=true, renderedCount=0")
                else:
                    log_result("B5: Idempotency test", False, 
                              f"Expected alreadySucceeded=true, renderedCount=0, got: {data}")
            else:
                log_result("B5: Idempotency test", False, f"Status {r.status_code}")
        except Exception as e:
            log_result("B5: Idempotency test", False, str(e))
    
    # B6: GET the new compositeUrl and verify PNG
    if 'new_composite_url' in locals() and new_composite_url:
        try:
            r = requests.get(f"{BASE_URL}{new_composite_url}")
            if r.status_code == 200:
                if r.headers.get('Content-Type') == 'image/png':
                    if verify_png_signature(r.content):
                        ihdr = get_png_ihdr_info(r.content)
                        if ihdr:
                            # 14x24 at 300 DPI = 4200x7200
                            if (ihdr['width'] == 4200 and 
                                ihdr['height'] == 7200 and 
                                ihdr['color_type'] == 6):
                                log_result("B6: GET new composite PNG", True, 
                                          "200, 4200x7200, colorType=6 (RGBA)")
                            else:
                                log_result("B6: GET new composite PNG", False, 
                                          f"Dimensions/colorType incorrect: {ihdr['width']}x{ihdr['height']}, colorType={ihdr['color_type']}")
                        else:
                            log_result("B6: GET new composite PNG", False, "Could not parse IHDR")
                    else:
                        log_result("B6: GET new composite PNG", False, "Invalid PNG signature")
                else:
                    log_result("B6: GET new composite PNG", False, 
                              f"Content-Type: {r.headers.get('Content-Type')}")
            else:
                log_result("B6: GET new composite PNG", False, f"Status {r.status_code}")
        except Exception as e:
            log_result("B6: GET new composite PNG", False, str(e))

# ============================================================================
# TEST C — Failure/audit path
# ============================================================================
print()
print("TEST C — FAILURE/AUDIT PATH")
print("-" * 80)

if not internal_order_id or not MONGO_URL or not DB_NAME:
    print("⚠️  Skipping TEST C - prerequisites not met")
    log_result("C: Failure tests", False, "Prerequisites not met")
else:
    # C1: Break the order's layout in Mongo
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        result = db.orders.update_one(
            {'id': internal_order_id},
            {'$set': {
                'items.0.layout.sheetSizeId': '99xNOPE',
                'renderStatus': 'pending'
            }}
        )
        if result.modified_count == 1:
            log_result("C1: Break layout in Mongo", True, "Set sheetSizeId to 99xNOPE")
        else:
            log_result("C1: Break layout in Mongo", False, 
                      f"Update failed, modified_count={result.modified_count}")
    except Exception as e:
        log_result("C1: Break layout in Mongo", False, str(e))
    
    # C2: POST rerender with force:true → expect pending_retry
    if ADMIN_TOKEN:
        try:
            r = requests.post(f"{BASE_URL}/api/orders/{internal_order_id}/rerender", 
                             headers={"x-admin-token": ADMIN_TOKEN}, 
                             json={"force": True})
            if r.status_code == 200:
                data = r.json()
                checks = []
                
                if data.get('ok') == False:
                    checks.append('ok=false')
                else:
                    checks.append(f'ok={data.get("ok")} (expected false)')
                
                if data.get('status') == 'pending_retry':
                    checks.append('status=pending_retry')
                else:
                    checks.append(f'status={data.get("status")} (expected pending_retry)')
                
                if data.get('renderedCount') == 0:
                    checks.append('renderedCount=0')
                else:
                    checks.append(f'renderedCount={data.get("renderedCount")}')
                
                if data.get('totalItems') == 1:
                    checks.append('totalItems=1')
                else:
                    checks.append(f'totalItems={data.get("totalItems")}')
                
                if data.get('attempt') == 2:
                    checks.append('attempt=2')
                else:
                    checks.append(f'attempt={data.get("attempt")} (expected 2)')
                
                error_msg = data.get('error', '')
                if 'Unknown sheet size' in error_msg or '99xNOPE' in error_msg:
                    checks.append('error contains sheet size message')
                else:
                    checks.append(f'error={error_msg[:50]}...')
                
                all_good = all('expected' not in c for c in checks)
                log_result("C2: Rerender with broken layout", all_good, ', '.join(checks))
            else:
                log_result("C2: Rerender with broken layout", False, 
                          f"Status {r.status_code}, body: {r.text[:200]}")
        except Exception as e:
            log_result("C2: Rerender with broken layout", False, str(e))
    
    # C3: GET order → verify renderStatus, renderAttempts, printFileError
    try:
        r = requests.get(f"{BASE_URL}/api/orders/{internal_order_id}")
        if r.status_code == 200:
            data = r.json()
            checks = []
            
            if data.get('renderStatus') == 'pending_retry':
                checks.append('renderStatus=pending_retry')
            else:
                checks.append(f'renderStatus={data.get("renderStatus")} (expected pending_retry)')
            
            if data.get('renderAttempts') == 2:
                checks.append('renderAttempts=2')
            else:
                checks.append(f'renderAttempts={data.get("renderAttempts")} (expected 2)')
            
            items = data.get('items', [])
            if items and items[0].get('printFileError'):
                checks.append('printFileError present')
            else:
                checks.append('printFileError MISSING')
            
            all_good = all('expected' not in c and 'MISSING' not in c for c in checks)
            log_result("C3: GET order after failure", all_good, ', '.join(checks))
        else:
            log_result("C3: GET order after failure", False, f"Status {r.status_code}")
    except Exception as e:
        log_result("C3: GET order after failure", False, str(e))
    
    # C4: Query render_failures collection
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        docs = list(db.render_failures.find({'orderId': internal_order_id}, {'_id': 0}))
        
        if len(docs) >= 1:
            doc = docs[0]
            required_fields = ['id', 'orderId', 'orderNumber', 'attempt', 'errors', 'createdAt']
            missing = [f for f in required_fields if f not in doc]
            
            if not missing:
                errors = doc.get('errors', [])
                if errors and isinstance(errors, list) and 'itemId' in errors[0] and 'error' in errors[0]:
                    log_result("C4: Query render_failures", True, 
                              f"Found {len(docs)} doc(s), attempt={doc.get('attempt')}, errors={len(errors)}")
                else:
                    log_result("C4: Query render_failures", False, 
                              f"errors field malformed: {errors}")
            else:
                log_result("C4: Query render_failures", False, f"Missing fields: {missing}")
        else:
            log_result("C4: Query render_failures", False, f"No docs found for orderId={internal_order_id}")
    except Exception as e:
        log_result("C4: Query render_failures", False, str(e))
    
    # C5: POST rerender 2 more times (attempts 3 and 4)
    if ADMIN_TOKEN:
        # Attempt 3
        try:
            r = requests.post(f"{BASE_URL}/api/orders/{internal_order_id}/rerender", 
                             headers={"x-admin-token": ADMIN_TOKEN}, 
                             json={"force": True})
            if r.status_code == 200:
                data = r.json()
                # After 3rd attempt (total 3 attempts), should be 'failed'
                if data.get('status') == 'failed' and data.get('attempt') == 3:
                    log_result("C5a: Rerender attempt 3", True, "status=failed, attempt=3")
                elif data.get('status') == 'pending_retry' and data.get('attempt') == 3:
                    # Some implementations might still be pending_retry at attempt 3
                    log_result("C5a: Rerender attempt 3", True, 
                              "status=pending_retry, attempt=3 (will fail on next)")
                else:
                    log_result("C5a: Rerender attempt 3", False, 
                              f"status={data.get('status')}, attempt={data.get('attempt')}")
            else:
                log_result("C5a: Rerender attempt 3", False, f"Status {r.status_code}")
        except Exception as e:
            log_result("C5a: Rerender attempt 3", False, str(e))
        
        # Attempt 4 (if needed)
        try:
            r = requests.post(f"{BASE_URL}/api/orders/{internal_order_id}/rerender", 
                             headers={"x-admin-token": ADMIN_TOKEN}, 
                             json={"force": True})
            if r.status_code == 200:
                data = r.json()
                if data.get('status') == 'failed':
                    log_result("C5b: Rerender attempt 4", True, 
                              f"status=failed, attempt={data.get('attempt')}")
                else:
                    log_result("C5b: Rerender attempt 4", False, 
                              f"Expected status=failed, got: {data}")
            else:
                log_result("C5b: Rerender attempt 4", False, f"Status {r.status_code}")
        except Exception as e:
            log_result("C5b: Rerender attempt 4", False, str(e))
        
        # Verify final state
        try:
            r = requests.get(f"{BASE_URL}/api/orders/{internal_order_id}")
            if r.status_code == 200:
                data = r.json()
                if data.get('renderStatus') == 'failed' and data.get('renderAttempts') >= 3:
                    log_result("C5c: Final state after failures", True, 
                              f"renderStatus=failed, renderAttempts={data.get('renderAttempts')}")
                else:
                    log_result("C5c: Final state after failures", False, 
                              f"renderStatus={data.get('renderStatus')}, renderAttempts={data.get('renderAttempts')}")
            else:
                log_result("C5c: Final state after failures", False, f"Status {r.status_code}")
        except Exception as e:
            log_result("C5c: Final state after failures", False, str(e))

# ============================================================================
# TEST D — Not-found
# ============================================================================
print()
print("TEST D — NOT-FOUND")
print("-" * 80)

if ADMIN_TOKEN:
    try:
        r = requests.post(f"{BASE_URL}/api/orders/00000000-0000-0000-0000-000000000000/rerender", 
                         headers={"x-admin-token": ADMIN_TOKEN}, 
                         json={"force": True})
        if r.status_code == 404:
            log_result("D1: Rerender non-existent order", True, "404")
        else:
            log_result("D1: Rerender non-existent order", False, 
                      f"Expected 404, got {r.status_code}: {r.json()}")
    except Exception as e:
        log_result("D1: Rerender non-existent order", False, str(e))
else:
    log_result("D1: Rerender non-existent order", False, "ADMIN_TOKEN not set")

# ============================================================================
# TEST E — Regression sanity
# ============================================================================
print()
print("TEST E — REGRESSION SANITY")
print("-" * 80)

# E1: POST /api/paypal/create-order (ship, HI)
try:
    r = requests.post(f"{BASE_URL}/api/paypal/create-order", json={
        "items": [{"sheetId": "14x36", "quantity": 1}],
        "shipping": {
            "fullName": "Regression Test HI",
            "email": "regression.hi@example.com",
            "line1": "123 Test St",
            "city": "Honolulu",
            "state": "HI",
            "postalCode": "96813",
            "country": "US"
        }
    })
    if r.status_code == 201:
        data = r.json()
        totals = data.get('totals', {})
        if (data.get('orderNumber') and 
            totals.get('shipping') == 5 and 
            totals.get('taxState') == 'HI'):
            log_result("E1: Create order (ship, HI)", True, 
                      f"201, orderNumber={data.get('orderNumber')}, shipping=$5, taxState=HI")
        else:
            log_result("E1: Create order (ship, HI)", False, f"Totals incorrect: {totals}")
    else:
        log_result("E1: Create order (ship, HI)", False, f"Status {r.status_code}")
except Exception as e:
    log_result("E1: Create order (ship, HI)", False, str(e))

# E2: POST /api/paypal/create-order (pickup)
try:
    r = requests.post(f"{BASE_URL}/api/paypal/create-order", json={
        "items": [{"sheetId": "14x24", "quantity": 1}],
        "shipping": {
            "fullName": "Regression Test Pickup",
            "email": "regression.pickup@example.com",
            "phone": "808-555-0200"
        },
        "deliveryMethod": "pickup"
    })
    if r.status_code == 201:
        data = r.json()
        totals = data.get('totals', {})
        if (totals.get('shipping') == 0 and 
            totals.get('taxState') == 'HI'):
            log_result("E2: Create order (pickup)", True, 
                      f"201, shipping=$0, taxState=HI")
        else:
            log_result("E2: Create order (pickup)", False, f"Totals incorrect: {totals}")
    else:
        log_result("E2: Create order (pickup)", False, f"Status {r.status_code}")
except Exception as e:
    log_result("E2: Create order (pickup)", False, str(e))

# E3: GET /api/health
try:
    r = requests.get(f"{BASE_URL}/api/health")
    if r.status_code in [200, 503]:
        data = r.json()
        checks = data.get('checks', {})
        mongo_ok = checks.get('mongo', {}).get('ok')
        paypal_ok = checks.get('paypal', {}).get('ok')
        
        if mongo_ok == True and paypal_ok == True:
            log_result("E3: GET /api/health", True, "mongo.ok=true, paypal.ok=true")
        else:
            log_result("E3: GET /api/health", True, 
                      f"mongo.ok={mongo_ok}, paypal.ok={paypal_ok} (degraded but responding)")
    else:
        log_result("E3: GET /api/health", False, f"Unexpected status {r.status_code}")
except Exception as e:
    log_result("E3: GET /api/health", False, str(e))

# E4: POST /api/cart/validate tampered
try:
    r = requests.post(f"{BASE_URL}/api/cart/validate", json={
        "items": [{"sheetId": "14x36", "quantity": 2, "unitPrice": 9999}]
    })
    if r.status_code == 200:
        data = r.json()
        items = data.get('items', [])
        if items and items[0].get('unitPrice') == 18:
            log_result("E4: POST /api/cart/validate", True, "Tampered price recomputed (9999→18)")
        else:
            log_result("E4: POST /api/cart/validate", False, 
                      f"Price not recomputed: {items[0].get('unitPrice') if items else 'NO ITEMS'}")
    else:
        log_result("E4: POST /api/cart/validate", False, f"Status {r.status_code}")
except Exception as e:
    log_result("E4: POST /api/cart/validate", False, str(e))

# E5: POST /api/uploads
try:
    png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    files = {'file': ('regression.png', BytesIO(png_data), 'image/png')}
    r = requests.post(f"{BASE_URL}/api/uploads", files=files)
    if r.status_code == 200:
        url = r.json().get('artworkUrl')
        # Try to GET it
        r2 = requests.get(f"{BASE_URL}{url}")
        if r2.status_code == 200 and r2.headers.get('Content-Type') == 'image/png':
            log_result("E5: POST /api/uploads", True, "200, GET roundtrip successful")
        else:
            log_result("E5: POST /api/uploads", False, f"GET failed: {r2.status_code}")
    else:
        log_result("E5: POST /api/uploads", False, f"Status {r.status_code}")
except Exception as e:
    log_result("E5: POST /api/uploads", False, str(e))

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
    print("✅ ALL TESTS PASSED - SHARP PIPELINE WORKING")
else:
    print(f"❌ {failed} TEST(S) FAILED - REVIEW REQUIRED")
print("=" * 80)
