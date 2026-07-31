#!/usr/bin/env python3
"""
Backend test script for Nevermore DTF production verification
Tests LIVE ORDER #120 (4fd170b3-3005-49e7-8071-3086ccd439c8)
"""

import requests
import struct
import sys

# Production configuration
BASE_URL = "https://www.nevermoredtf.com"
ADMIN_TOKEN = "nevermore-admin-2026-XvT9pWq3Rz1KcJ7bH2Fs4Ye8Da5Nh6Uk"
ORDER_ID = "4fd170b3-3005-49e7-8071-3086ccd439c8"

# Test results tracking
tests_passed = 0
tests_failed = 0

def log_test(test_name, passed, details=""):
    global tests_passed, tests_failed
    if passed:
        tests_passed += 1
        print(f"✅ {test_name}")
        if details:
            print(f"   {details}")
    else:
        tests_failed += 1
        print(f"❌ {test_name}")
        if details:
            print(f"   {details}")

def parse_png_ihdr(png_bytes):
    """Parse PNG IHDR chunk to extract width, height, color type"""
    try:
        # PNG signature: 89 50 4E 47 0D 0A 1A 0A (8 bytes)
        if png_bytes[:8] != b'\x89PNG\r\n\x1a\n':
            return None, None, None
        
        # IHDR chunk starts at byte 8
        # Chunk structure: 4 bytes length, 4 bytes type, data, 4 bytes CRC
        # IHDR is always first chunk after signature
        chunk_length = struct.unpack('>I', png_bytes[8:12])[0]
        chunk_type = png_bytes[12:16]
        
        if chunk_type != b'IHDR':
            return None, None, None
        
        # IHDR data: width(4), height(4), bit_depth(1), color_type(1), ...
        ihdr_data = png_bytes[16:16+chunk_length]
        width = struct.unpack('>I', ihdr_data[0:4])[0]
        height = struct.unpack('>I', ihdr_data[4:8])[0]
        color_type = ihdr_data[9]
        
        return width, height, color_type
    except Exception as e:
        print(f"   Error parsing PNG: {e}")
        return None, None, None

print("=" * 80)
print("PRODUCTION LIVE ORDER VERIFICATION - Order #120")
print(f"Base URL: {BASE_URL}")
print(f"Order ID: {ORDER_ID}")
print("=" * 80)
print()

# TEST 1: GET order details
print("TEST 1: GET /api/orders/{ORDER_ID}")
print("-" * 80)
try:
    response = requests.get(f"{BASE_URL}/api/orders/{ORDER_ID}", timeout=30)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        order = response.json()
        
        # Verify all required fields
        # Note: status may be PROCESSING if already changed in previous test run
        status_ok = order.get("status") in ["PAID", "PROCESSING"]
        checks = [
            ("status", status_ok, f"Expected 'PAID' or 'PROCESSING', got '{order.get('status')}'"),
            ("paypalStatus", order.get("paypalStatus") == "COMPLETED", f"Expected 'COMPLETED', got '{order.get('paypalStatus')}'"),
            ("captureId", order.get("captureId") == "70S58063SB327341X", f"Expected '70S58063SB327341X', got '{order.get('captureId')}'"),
            ("renderStatus", order.get("renderStatus") == "succeeded", f"Expected 'succeeded', got '{order.get('renderStatus')}'"),
            ("renderAttempts", order.get("renderAttempts") == 1, f"Expected 1, got {order.get('renderAttempts')}"),
            ("renderCompletedAt", order.get("renderCompletedAt") is not None, f"renderCompletedAt is missing"),
            ("deliveryMethod", order.get("deliveryMethod") == "pickup", f"Expected 'pickup', got '{order.get('deliveryMethod')}'"),
            ("subtotal", order.get("subtotal") == 10, f"Expected 10, got {order.get('subtotal')}"),
            ("shipping_amount", order.get("shipping_amount") == 0, f"Expected 0, got {order.get('shipping_amount')}"),
            ("tax", order.get("tax") == 0.47, f"Expected 0.47, got {order.get('tax')}"),
            ("total", order.get("total") == 10.47, f"Expected 10.47, got {order.get('total')}"),
            ("taxState", order.get("taxState") == "HI", f"Expected 'HI', got '{order.get('taxState')}'"),
        ]
        
        for check_name, passed, msg in checks:
            log_test(f"Order field: {check_name}", passed, msg if not passed else "")
        
        # Check items array
        items = order.get("items", [])
        if len(items) > 0:
            item = items[0]
            
            log_test("items[0].printFileSource", 
                    item.get("printFileSource") == "sharp-authoritative",
                    f"Expected 'sharp-authoritative', got '{item.get('printFileSource')}'")
            
            composite_size = item.get("compositeSize", 0)
            log_test("items[0].compositeSize > 1MB", 
                    composite_size > 1_000_000,
                    f"Size: {composite_size:,} bytes")
            
            composite_url = item.get("compositeUrl", "")
            log_test("items[0].compositeUrl is Vercel Blob URL", 
                    "public.blob.vercel-storage.com" in composite_url and composite_url.startswith("https://"),
                    f"URL: {composite_url[:80]}...")
            
            # Store for TEST 2
            global COMPOSITE_URL
            COMPOSITE_URL = composite_url
        else:
            log_test("items array", False, "No items found in order")
    else:
        log_test("GET order", False, f"Expected 200, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
except Exception as e:
    log_test("GET order", False, f"Exception: {e}")

print()

# TEST 2: GET compositeUrl and verify PNG
print("TEST 2: GET compositeUrl and verify PNG dimensions")
print("-" * 80)
try:
    if 'COMPOSITE_URL' in globals():
        response = requests.get(COMPOSITE_URL, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            log_test("GET compositeUrl", True, f"Content-Type: {response.headers.get('Content-Type')}")
            
            # Verify PNG magic bytes
            png_bytes = response.content
            magic_bytes = png_bytes[:4]
            log_test("PNG magic bytes", 
                    magic_bytes == b'\x89PNG',
                    f"Bytes: {' '.join(f'{b:02x}' for b in magic_bytes)}")
            
            # Parse IHDR
            width, height, color_type = parse_png_ihdr(png_bytes)
            
            log_test("PNG width (IHDR)", 
                    width == 4200,
                    f"Expected 4200 (14\" × 300 DPI), got {width}")
            
            log_test("PNG height (IHDR)", 
                    height == 3600,
                    f"Expected 3600 (12\" × 300 DPI), got {height}")
            
            log_test("PNG color type (RGBA transparent)", 
                    color_type == 6,
                    f"Expected 6 (RGBA), got {color_type}")
        else:
            log_test("GET compositeUrl", False, f"Expected 200, got {response.status_code}")
    else:
        log_test("GET compositeUrl", False, "compositeUrl not available from TEST 1")
        
except Exception as e:
    log_test("GET compositeUrl", False, f"Exception: {e}")

print()

# TEST 3: POST rerender with no force (idempotency)
print("TEST 3: POST /api/orders/{ORDER_ID}/rerender (idempotency check)")
print("-" * 80)
try:
    headers = {"x-admin-token": ADMIN_TOKEN, "Content-Type": "application/json"}
    response = requests.post(
        f"{BASE_URL}/api/orders/{ORDER_ID}/rerender",
        json={},
        headers=headers,
        timeout=30
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Response: {result}")
        
        log_test("Rerender idempotency: alreadySucceeded", 
                result.get("alreadySucceeded") == True,
                f"Expected true, got {result.get('alreadySucceeded')}")
        
        log_test("Rerender idempotency: renderedCount", 
                result.get("renderedCount") == 0,
                f"Expected 0, got {result.get('renderedCount')}")
    else:
        log_test("POST rerender", False, f"Expected 200, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
except Exception as e:
    log_test("POST rerender", False, f"Exception: {e}")

print()

# TEST 4: POST status change to PROCESSING
print("TEST 4: POST /api/orders/{ORDER_ID}/status (change to PROCESSING)")
print("-" * 80)
try:
    headers = {"x-admin-token": ADMIN_TOKEN, "Content-Type": "application/json"}
    response = requests.post(
        f"{BASE_URL}/api/orders/{ORDER_ID}/status",
        json={"status": "PROCESSING"},
        headers=headers,
        timeout=30
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Response: {result}")
        
        log_test("Status change: ok", 
                result.get("ok") == True,
                f"Expected true, got {result.get('ok')}")
        
        email_result = result.get("email", {})
        log_test("Status change: email.ok", 
                email_result.get("ok") == True,
                f"Expected true (external send to rave96792@yahoo.com), got {email_result.get('ok')}")
        
        # Verify status was actually changed
        verify_response = requests.get(f"{BASE_URL}/api/orders/{ORDER_ID}", timeout=30)
        if verify_response.status_code == 200:
            order = verify_response.json()
            log_test("Status persisted in DB", 
                    order.get("status") == "PROCESSING",
                    f"Expected 'PROCESSING', got '{order.get('status')}'")
        else:
            log_test("Status persisted in DB", False, "Could not verify order status")
    else:
        log_test("POST status", False, f"Expected 200, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
except Exception as e:
    log_test("POST status", False, f"Exception: {e}")

print()

# TEST 5: Sanity health check
print("TEST 5: GET /api/health (sanity check)")
print("-" * 80)
try:
    response = requests.get(f"{BASE_URL}/api/health", timeout=30)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        health = response.json()
        
        log_test("Health: mongo.ok", 
                health.get("checks", {}).get("mongo", {}).get("ok") == True,
                f"mongo.ok = {health.get('checks', {}).get('mongo', {}).get('ok')}")
        
        log_test("Health: paypal.ok", 
                health.get("checks", {}).get("paypal", {}).get("ok") == True,
                f"paypal.ok = {health.get('checks', {}).get('paypal', {}).get('ok')}")
        
        paypal_base = health.get("checks", {}).get("paypal", {}).get("base", "")
        log_test("Health: paypal.base (LIVE)", 
                paypal_base == "https://api-m.paypal.com",
                f"Expected 'https://api-m.paypal.com', got '{paypal_base}'")
        
        paypal_env = health.get("checks", {}).get("env", {}).get("PAYPAL_ENV", "")
        log_test("Health: PAYPAL_ENV", 
                paypal_env == "live",
                f"Expected 'live', got '{paypal_env}'")
        
        resend_key = health.get("checks", {}).get("env", {}).get("RESEND_API_KEY", False)
        log_test("Health: RESEND_API_KEY", 
                resend_key == True,
                f"RESEND_API_KEY present = {resend_key}")
    else:
        log_test("GET health", False, f"Expected 200, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
except Exception as e:
    log_test("GET health", False, f"Exception: {e}")

print()
print("=" * 80)
print(f"RESULTS: {tests_passed} passed, {tests_failed} failed")
print("=" * 80)

sys.exit(0 if tests_failed == 0 else 1)
