#!/usr/bin/env python3
"""
Backend regression + bug-fix verification for Nevermore DTF Next.js app.
Tests the fix for the reported bug: GET /api/uploads/:filename returning 500.
"""

import requests
import json
import io
import struct
from pathlib import Path

# Backend URL - using localhost:3000 as per system instructions
BASE_URL = "http://localhost:3000/api"

def print_test(name):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_pass(msg):
    print(f"✅ PASS: {msg}")

def print_fail(msg):
    print(f"❌ FAIL: {msg}")

def print_info(msg):
    print(f"ℹ️  INFO: {msg}")

def create_test_png():
    """Create a minimal valid PNG file for testing uploads."""
    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk (1x1 pixel, RGBA)
    width = 1
    height = 1
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = 0x7b6e2484  # Pre-calculated CRC for this specific IHDR
    ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # IDAT chunk (minimal compressed data)
    idat_data = b'\x08\x1d\x01\x05\x00\xfa\xff\x00\x00\x00\x00\xff\x00\x06\x00\x05\xff\x5a'
    idat_crc = 0x3d8a5b5d  # Pre-calculated CRC
    idat = struct.pack('>I', len(idat_data)) + b'IDAT' + idat_data + struct.pack('>I', idat_crc)
    
    # IEND chunk
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', 0xae426082)
    
    return signature + ihdr + idat + iend

def verify_png_signature(data):
    """Verify PNG magic bytes and return colorType if valid."""
    if len(data) < 33:
        return False, None
    
    # Check PNG signature
    expected_sig = b'\x89PNG\r\n\x1a\n'
    if data[:8] != expected_sig:
        return False, None
    
    # Read IHDR chunk to get colorType (byte 25 in file)
    # PNG structure: 8-byte sig + 4-byte length + 4-byte "IHDR" + 13-byte IHDR data
    # colorType is at offset 9 within IHDR data, which is byte 25 in the file
    color_type = data[25] if len(data) > 25 else None
    
    return True, color_type

def test_1a_existing_composite():
    """Test 1a: GET /api/uploads/4d25c9f2-fefb-4abd-a4d9-181c71884d07.png must return 200 with valid PNG."""
    print_test("1a: GET existing composite PNG (the reported bug)")
    
    try:
        url = f"{BASE_URL}/uploads/4d25c9f2-fefb-4abd-a4d9-181c71884d07.png"
        print_info(f"GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print_info(f"Status: {response.status_code}")
        print_info(f"Content-Type: {response.headers.get('Content-Type')}")
        print_info(f"Content-Length: {len(response.content)} bytes")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response body (first 200 chars): {response.text[:200]}")
            return False
        
        if response.headers.get('Content-Type') != 'image/png':
            print_fail(f"Expected Content-Type: image/png, got {response.headers.get('Content-Type')}")
            return False
        
        is_png, color_type = verify_png_signature(response.content)
        if not is_png:
            print_fail("Response body does not have valid PNG signature")
            print_info(f"First 16 bytes (hex): {response.content[:16].hex()}")
            return False
        
        print_pass(f"Valid PNG signature detected")
        
        if color_type == 6:
            print_pass(f"ColorType = 6 (RGBA with transparency) ✓")
        else:
            print_info(f"ColorType = {color_type} (expected 6 for RGBA transparency)")
        
        print_pass("GET /api/uploads/:filename returns 200 with valid PNG (bug is FIXED)")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_1b_upload_roundtrip():
    """Test 1b: POST /api/uploads then GET the returned artworkUrl."""
    print_test("1b: POST /api/uploads roundtrip")
    
    try:
        # Create a test PNG
        png_data = create_test_png()
        print_info(f"Created test PNG: {len(png_data)} bytes")
        
        # Upload it
        url = f"{BASE_URL}/uploads"
        files = {'file': ('test.png', io.BytesIO(png_data), 'image/png')}
        print_info(f"POST {url}")
        
        response = requests.post(url, files=files, timeout=10)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return False
        
        data = response.json()
        print_info(f"Response: {json.dumps(data, indent=2)}")
        
        if 'artworkUrl' not in data:
            print_fail("Response missing 'artworkUrl' field")
            return False
        
        artwork_url = data['artworkUrl']
        print_pass(f"Upload successful, artworkUrl: {artwork_url}")
        
        # Now GET the uploaded file
        full_url = f"http://localhost:3000{artwork_url}"
        print_info(f"GET {full_url}")
        
        get_response = requests.get(full_url, timeout=10)
        
        if get_response.status_code != 200:
            print_fail(f"GET artworkUrl failed: {get_response.status_code}")
            return False
        
        if get_response.headers.get('Content-Type') != 'image/png':
            print_fail(f"Wrong Content-Type: {get_response.headers.get('Content-Type')}")
            return False
        
        is_png, _ = verify_png_signature(get_response.content)
        if not is_png:
            print_fail("Downloaded file is not a valid PNG")
            return False
        
        print_pass("Upload roundtrip successful: POST → GET → valid PNG")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_1c_nonexistent_file():
    """Test 1c: GET non-existent file must return 404 (not 500)."""
    print_test("1c: GET non-existent file → 404")
    
    try:
        url = f"{BASE_URL}/uploads/does-not-exist-9999.png"
        print_info(f"GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 500:
            print_fail("Got 500 Internal Server Error (should be 404)")
            print_info(f"Response: {response.text[:200]}")
            return False
        
        if response.status_code != 404:
            print_fail(f"Expected 404, got {response.status_code}")
            return False
        
        # Should return JSON error
        try:
            data = response.json()
            if 'error' in data:
                print_pass(f"404 with JSON error: {data['error']}")
            else:
                print_pass("404 returned")
        except Exception:
            print_pass("404 returned")
        
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_1d_path_traversal():
    """Test 1d: Path traversal attempts must return 400 (not 500, not file contents)."""
    print_test("1d: Path traversal protection → 400")
    
    test_cases = [
        "../etc/passwd",
        "hello.txt",
        "abc/def.png",
        "..%2F..%2Fetc%2Fpasswd"
    ]
    
    all_passed = True
    
    for filename in test_cases:
        try:
            url = f"{BASE_URL}/uploads/{filename}"
            print_info(f"GET {url}")
            
            response = requests.get(url, timeout=10)
            
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 500:
                print_fail(f"Got 500 for {filename} (should be 400)")
                all_passed = False
                continue
            
            if response.status_code == 200:
                print_fail(f"Got 200 for {filename} (path traversal not blocked!)")
                all_passed = False
                continue
            
            if response.status_code == 400:
                print_pass(f"400 for {filename} ✓")
            elif response.status_code == 404:
                print_pass(f"404 for {filename} (acceptable)")
            else:
                print_info(f"Got {response.status_code} for {filename}")
            
        except Exception as e:
            print_fail(f"Exception for {filename}: {str(e)}")
            all_passed = False
    
    return all_passed

def test_2_email_test():
    """Test 2: POST /api/email/test must return success with valid transparent PNG."""
    print_test("2: POST /api/email/test")
    
    try:
        url = f"{BASE_URL}/email/test"
        print_info(f"POST {url}")
        
        response = requests.post(url, json={}, timeout=15)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return False
        
        data = response.json()
        print_info(f"Response keys: {list(data.keys())}")
        
        # Check response structure
        if 'ok' not in data or not data['ok']:
            print_fail(f"Response 'ok' is not true: {data.get('ok')}")
            return False
        
        if 'results' not in data:
            print_fail("Response missing 'results' field")
            return False
        
        results = data['results']
        if 'shop' not in results or 'buyer' not in results:
            print_fail("Results missing 'shop' or 'buyer' fields")
            return False
        
        print_pass(f"Shop email: ok={results['shop'].get('ok')}, id={results['shop'].get('id')}")
        print_pass(f"Buyer email: ok={results['buyer'].get('ok')}, id={results['buyer'].get('id')}")
        
        if 'sampleCompositeUrl' not in data:
            print_fail("Response missing 'sampleCompositeUrl' field")
            return False
        
        composite_url = data['sampleCompositeUrl']
        print_info(f"sampleCompositeUrl: {composite_url}")
        
        # Fetch the composite PNG
        full_url = f"http://localhost:3000{composite_url}"
        print_info(f"GET {full_url}")
        
        png_response = requests.get(full_url, timeout=10)
        
        if png_response.status_code != 200:
            print_fail(f"GET composite failed: {png_response.status_code}")
            return False
        
        is_png, color_type = verify_png_signature(png_response.content)
        if not is_png:
            print_fail("Composite is not a valid PNG")
            return False
        
        print_pass("Composite is a valid PNG")
        
        if color_type == 6:
            print_pass("Composite has colorType=6 (RGBA transparent) ✓")
        else:
            print_fail(f"Composite colorType={color_type}, expected 6 for RGBA transparency")
            return False
        
        print_pass("POST /api/email/test successful with transparent PNG")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_3_pricing():
    """Test 3: GET /api/pricing regression."""
    print_test("3: GET /api/pricing")
    
    try:
        url = f"{BASE_URL}/pricing"
        print_info(f"GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        required_keys = ['sheets', 'addons', 'customPerSqIn']
        for key in required_keys:
            if key not in data:
                print_fail(f"Response missing '{key}' field")
                return False
        
        sheets = data['sheets']
        print_info(f"Sheets count: {len(sheets)}")
        
        # Check for specific sheets mentioned in test plan
        sheet_ids = [s['id'] for s in sheets]
        expected_sheets = ['14x12', '14x24', '14x36', '14x120']
        
        for sheet_id in expected_sheets:
            if sheet_id not in sheet_ids:
                print_fail(f"Missing sheet: {sheet_id}")
                return False
        
        print_pass(f"All expected sheets present: {expected_sheets}")
        print_pass("GET /api/pricing successful")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_4_pricing_quote():
    """Test 4: POST /api/pricing/quote regression."""
    print_test("4: POST /api/pricing/quote")
    
    try:
        # Valid quote
        url = f"{BASE_URL}/pricing/quote"
        payload = {"sheetId": "14x24", "addons": []}
        print_info(f"POST {url} with {payload}")
        
        response = requests.post(url, json=payload, timeout=10)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print_info(f"Response: {data}")
        
        if 'unitPrice' not in data:
            print_fail("Response missing 'unitPrice' field")
            return False
        
        if data['unitPrice'] != 13:
            print_fail(f"Expected unitPrice=13 for 14x24, got {data['unitPrice']}")
            return False
        
        print_pass("Valid quote: 14x24 → $13 ✓")
        
        # Invalid quote
        payload = {"sheetId": "nonexistent"}
        print_info(f"POST {url} with {payload}")
        
        response = requests.post(url, json=payload, timeout=10)
        
        if response.status_code != 400:
            print_fail(f"Expected 400 for invalid sheet, got {response.status_code}")
            return False
        
        data = response.json()
        if 'error' not in data:
            print_fail("400 response missing 'error' field")
            return False
        
        print_pass(f"Invalid quote rejected with 400: {data['error']}")
        print_pass("POST /api/pricing/quote successful")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_5_cart_validate():
    """Test 5: POST /api/cart/validate regression (including tampered price)."""
    print_test("5: POST /api/cart/validate")
    
    try:
        # Valid cart with tampered unitPrice
        url = f"{BASE_URL}/cart/validate"
        payload = {
            "items": [
                {
                    "sheetId": "14x36",
                    "quantity": 2,
                    "unitPrice": 9999  # Tampered! Server should recompute to 18
                }
            ]
        }
        print_info(f"POST {url} with tampered unitPrice=9999")
        
        response = requests.post(url, json=payload, timeout=10)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return False
        
        data = response.json()
        print_info(f"Response keys: {list(data.keys())}")
        
        if 'ok' not in data or not data['ok']:
            print_fail(f"Response 'ok' is not true")
            return False
        
        if 'items' not in data or len(data['items']) == 0:
            print_fail("Response missing 'items' or items is empty")
            return False
        
        item = data['items'][0]
        if item['unitPrice'] != 18:
            print_fail(f"Server did not recompute unitPrice! Got {item['unitPrice']}, expected 18")
            return False
        
        print_pass(f"Server recomputed unitPrice: 9999 → 18 ✓")
        
        if 'subtotal' not in data:
            print_fail("Response missing 'subtotal'")
            return False
        
        expected_subtotal = 18 * 2  # 36
        if data['subtotal'] != expected_subtotal:
            print_fail(f"Subtotal mismatch: got {data['subtotal']}, expected {expected_subtotal}")
            return False
        
        print_pass(f"Subtotal correct: {data['subtotal']}")
        
        # Invalid cart
        payload = {"items": [{"sheetId": "bad"}]}
        print_info(f"POST {url} with invalid sheetId")
        
        response = requests.post(url, json=payload, timeout=10)
        
        if response.status_code != 400:
            print_fail(f"Expected 400 for invalid cart, got {response.status_code}")
            return False
        
        print_pass("Invalid cart rejected with 400")
        print_pass("POST /api/cart/validate successful")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_6_paypal_create_order():
    """Test 6: POST /api/paypal/create-order with HI tax."""
    print_test("6: POST /api/paypal/create-order (real PayPal sandbox)")
    
    try:
        url = f"{BASE_URL}/paypal/create-order"
        payload = {
            "items": [
                {
                    "sheetId": "14x36",
                    "quantity": 1,
                    "addons": []
                }
            ],
            "shipping": {
                "fullName": "Test Buyer",
                "email": "buyer@example.com",
                "phone": "808-555-0100",
                "line1": "123 Test St",
                "line2": "",
                "city": "Honolulu",
                "state": "HI",
                "postalCode": "96815",
                "country": "US"
            }
        }
        print_info(f"POST {url}")
        print_info(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=20)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 502:
            print_info("Got 502 - PayPal sandbox may be unreachable")
            try:
                error_data = response.json()
                print_info(f"Error: {error_data.get('error')}")
            except Exception:
                print_info(f"Response: {response.text[:200]}")
            print_info("⚠️  SKIPPED: External PayPal dependency unreachable (not a failure)")
            return "SKIPPED"
        
        if response.status_code != 201:
            print_fail(f"Expected 201, got {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return False
        
        data = response.json()
        print_info(f"Response keys: {list(data.keys())}")
        
        required_keys = ['orderID', 'internalOrderId', 'totals']
        for key in required_keys:
            if key not in data:
                print_fail(f"Response missing '{key}' field")
                return False
        
        print_pass(f"PayPal orderID: {data['orderID']}")
        print_pass(f"Internal orderID: {data['internalOrderId']}")
        
        totals = data['totals']
        print_info(f"Totals: {json.dumps(totals, indent=2)}")
        
        # Verify HI tax calculation
        if totals.get('taxState') != 'HI':
            print_fail(f"Expected taxState='HI', got {totals.get('taxState')}")
            return False
        
        if totals.get('taxRate') != 0.04712:
            print_fail(f"Expected taxRate=0.04712, got {totals.get('taxRate')}")
            return False
        
        print_pass(f"HI tax applied: rate={totals['taxRate']}, tax=${totals['tax']}")
        
        # Store for next test
        global LAST_ORDER_ID
        LAST_ORDER_ID = data['internalOrderId']
        
        print_pass("POST /api/paypal/create-order successful")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_7_orders_get():
    """Test 7: GET /api/orders/:id retrieves the order."""
    print_test("7: GET /api/orders/:id")
    
    if not hasattr(test_7_orders_get, 'order_id'):
        if 'LAST_ORDER_ID' not in globals():
            print_info("⚠️  SKIPPED: No order ID from previous test")
            return "SKIPPED"
        test_7_orders_get.order_id = LAST_ORDER_ID
    
    try:
        order_id = test_7_orders_get.order_id
        url = f"{BASE_URL}/orders/{order_id}"
        print_info(f"GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return False
        
        data = response.json()
        print_info(f"Response keys: {list(data.keys())}")
        
        required_keys = ['id', 'status', 'items', 'shipping']
        for key in required_keys:
            if key not in data:
                print_fail(f"Response missing '{key}' field")
                return False
        
        if data['id'] != order_id:
            print_fail(f"Order ID mismatch: {data['id']} != {order_id}")
            return False
        
        print_pass(f"Order retrieved: status={data['status']}, items={len(data['items'])}")
        
        if data['status'] != 'PENDING':
            print_info(f"Order status is {data['status']} (expected PENDING)")
        
        print_pass("GET /api/orders/:id successful")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("NEVERMORE DTF BACKEND REGRESSION + BUG-FIX VERIFICATION")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print("="*80)
    
    results = {}
    
    # Critical tests (priority order from review_request)
    results['1a_existing_composite'] = test_1a_existing_composite()
    results['1b_upload_roundtrip'] = test_1b_upload_roundtrip()
    results['1c_nonexistent_file'] = test_1c_nonexistent_file()
    results['1d_path_traversal'] = test_1d_path_traversal()
    results['2_email_test'] = test_2_email_test()
    
    # Regression tests
    results['3_pricing'] = test_3_pricing()
    results['4_pricing_quote'] = test_4_pricing_quote()
    results['5_cart_validate'] = test_5_cart_validate()
    results['6_paypal_create_order'] = test_6_paypal_create_order()
    results['7_orders_get'] = test_7_orders_get()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v == "SKIPPED")
    total = len(results)
    
    for test_name, result in results.items():
        if result is True:
            print(f"✅ {test_name}")
        elif result is False:
            print(f"❌ {test_name}")
        else:
            print(f"⚠️  {test_name} (SKIPPED)")
    
    print("="*80)
    print(f"PASSED: {passed}/{total}")
    print(f"FAILED: {failed}/{total}")
    print(f"SKIPPED: {skipped}/{total}")
    print("="*80)
    
    if failed > 0:
        print("\n❌ SOME TESTS FAILED - SEE DETAILS ABOVE")
        return 1
    else:
        print("\n✅ ALL TESTS PASSED (or skipped due to external dependencies)")
        return 0

if __name__ == '__main__':
    exit(main())
