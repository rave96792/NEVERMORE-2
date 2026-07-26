#!/usr/bin/env python3
"""
Backend verification for PayPal checkout bug fix on PRODUCTION deployment.
Tests against https://www.nevermoredtf.com

Fix summary:
- MongoDB Atlas is currently unreachable (TLS handshake failure)
- Code fix: /api/paypal/create-order now returns HTTP 503 with helpful error
  instead of generic 500 when Mongo insert fails
- New GET /api/health diagnostic endpoint added
"""

import requests
import json
import io
import struct
from pathlib import Path

# PRODUCTION URL
BASE_URL = "https://www.nevermoredtf.com/api"

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
    """Verify PNG magic bytes."""
    if len(data) < 8:
        return False
    
    expected_sig = b'\x89PNG\r\n\x1a\n'
    return data[:8] == expected_sig

def test_1_health_endpoint():
    """Test 1: GET /api/health returns valid JSON with mongo/paypal/env checks."""
    print_test("1: GET /api/health diagnostic endpoint")
    
    try:
        url = f"{BASE_URL}/health"
        print_info(f"GET {url}")
        
        response = requests.get(url, timeout=15)
        
        print_info(f"Status: {response.status_code}")
        
        # Accept either 200 (all green) or 503 (Mongo down)
        if response.status_code not in [200, 503]:
            print_fail(f"Expected 200 or 503, got {response.status_code}")
            print_info(f"Response: {response.text[:500]}")
            return False
        
        try:
            data = response.json()
        except Exception as e:
            print_fail(f"Response is not valid JSON: {e}")
            print_info(f"Response: {response.text[:500]}")
            return False
        
        print_info(f"Response: {json.dumps(data, indent=2)}")
        
        # Check required top-level keys
        if 'ok' not in data:
            print_fail("Response missing 'ok' field")
            return False
        
        if 'checks' not in data:
            print_fail("Response missing 'checks' field")
            return False
        
        checks = data['checks']
        
        # Check mongo section
        if 'mongo' not in checks:
            print_fail("checks missing 'mongo' section")
            return False
        
        mongo = checks['mongo']
        if 'ok' not in mongo:
            print_fail("checks.mongo missing 'ok' field")
            return False
        
        if mongo['ok']:
            print_pass("MongoDB is reachable (ok=true)")
        else:
            print_info(f"MongoDB is DOWN (ok=false): {mongo.get('error', 'no error message')}")
            print_pass("MongoDB status correctly reported as down")
        
        # Check paypal section
        if 'paypal' not in checks:
            print_fail("checks missing 'paypal' section")
            return False
        
        paypal = checks['paypal']
        if 'ok' not in paypal:
            print_fail("checks.paypal missing 'ok' field")
            return False
        
        if not paypal['ok']:
            print_fail(f"PayPal check failed: {paypal.get('error', 'no error')}")
            return False
        
        if 'base' not in paypal:
            print_fail("checks.paypal missing 'base' field")
            return False
        
        if paypal['base'] != 'https://api-m.sandbox.paypal.com':
            print_fail(f"Expected PayPal base 'https://api-m.sandbox.paypal.com', got '{paypal['base']}'")
            return False
        
        print_pass(f"PayPal sandbox configured correctly: {paypal['base']}")
        
        # Check env section
        if 'env' not in checks:
            print_fail("checks missing 'env' section")
            return False
        
        env = checks['env']
        
        # Check required env booleans
        required_env_bools = [
            'MONGO_URL', 'DB_NAME', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET',
            'RESEND_API_KEY', 'BLOB_READ_WRITE_TOKEN'
        ]
        
        for key in required_env_bools:
            if key not in env:
                print_fail(f"checks.env missing '{key}'")
                return False
            if env[key] is not True:
                print_fail(f"checks.env.{key} should be true, got {env[key]}")
                return False
        
        print_pass("All required env variables present (booleans=true)")
        
        # Check NEXT_PUBLIC_BASE_URL
        if 'NEXT_PUBLIC_BASE_URL' not in env:
            print_fail("checks.env missing 'NEXT_PUBLIC_BASE_URL'")
            return False
        
        if env['NEXT_PUBLIC_BASE_URL'] != 'https://nevermoredtf.com':
            print_fail(f"Expected NEXT_PUBLIC_BASE_URL='https://nevermoredtf.com', got '{env['NEXT_PUBLIC_BASE_URL']}'")
            return False
        
        print_pass(f"NEXT_PUBLIC_BASE_URL correct: {env['NEXT_PUBLIC_BASE_URL']}")
        
        # Check PAYPAL_ENV
        if 'PAYPAL_ENV' not in env:
            print_fail("checks.env missing 'PAYPAL_ENV'")
            return False
        
        if env['PAYPAL_ENV'] != 'sandbox':
            print_fail(f"Expected PAYPAL_ENV='sandbox', got '{env['PAYPAL_ENV']}'")
            return False
        
        print_pass(f"PAYPAL_ENV correct: {env['PAYPAL_ENV']}")
        
        # Overall status check
        if response.status_code == 503:
            if data['ok'] is not False:
                print_fail("Status 503 but ok=true (should be false)")
                return False
            print_pass("Overall status correctly reports 503 (service degraded)")
        else:
            if data['ok'] is not True:
                print_fail("Status 200 but ok=false")
                return False
            print_pass("Overall status correctly reports 200 (all systems operational)")
        
        print_pass("GET /api/health endpoint working correctly")
        
        # Store mongo status for later tests
        global MONGO_IS_UP
        MONGO_IS_UP = mongo['ok']
        
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_2a_create_order_valid():
    """Test 2a: POST /api/paypal/create-order with valid payload (THE FIX)."""
    print_test("2a: POST /api/paypal/create-order with valid payload (THE FIX)")
    
    try:
        url = f"{BASE_URL}/paypal/create-order"
        payload = {
            "items": [
                {
                    "sheetId": "14x36",
                    "quantity": 1,
                    "unitPrice": 18
                }
            ],
            "shipping": {
                "fullName": "Test Buyer",
                "email": "buyer@example.com",
                "line1": "123 Ala Moana Blvd",
                "city": "Honolulu",
                "state": "HI",
                "postalCode": "96813",
                "country": "US"
            }
        }
        
        print_info(f"POST {url}")
        print_info(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=20)
        
        print_info(f"Status: {response.status_code}")
        
        try:
            data = response.json()
            print_info(f"Response: {json.dumps(data, indent=2)}")
        except Exception:
            print_info(f"Response (not JSON): {response.text[:500]}")
            data = None
        
        # Check if we got a generic 500 (FAIL)
        if response.status_code == 500:
            if data and data.get('error') == 'Internal server error':
                print_fail("Got generic HTTP 500 with 'Internal server error' - THE BUG IS NOT FIXED!")
                return False
            else:
                print_fail(f"Got HTTP 500: {data}")
                return False
        
        # Two acceptable outcomes:
        # (a) If Mongo is down: HTTP 503 with detail:'db_unavailable'
        # (b) If Mongo is up: HTTP 201 with orderID, internalOrderId, totals
        
        if response.status_code == 503:
            # Path (a) - Mongo is down, graceful degradation
            if not data:
                print_fail("503 response but no JSON body")
                return False
            
            if 'error' not in data:
                print_fail("503 response missing 'error' field")
                return False
            
            if 'detail' not in data:
                print_fail("503 response missing 'detail' field")
                return False
            
            if data['detail'] != 'db_unavailable':
                print_fail(f"Expected detail='db_unavailable', got '{data['detail']}'")
                return False
            
            print_pass("✅ THE FIX WORKS: Got HTTP 503 with detail='db_unavailable' (graceful degradation)")
            print_pass(f"Error message: {data['error']}")
            print_info("This is the expected behavior when MongoDB Atlas is unreachable")
            return True
        
        elif response.status_code == 201:
            # Path (b) - Mongo is up, order created successfully
            if not data:
                print_fail("201 response but no JSON body")
                return False
            
            required_keys = ['orderID', 'internalOrderId', 'totals']
            for key in required_keys:
                if key not in data:
                    print_fail(f"201 response missing '{key}' field")
                    return False
            
            print_pass(f"Order created successfully: orderID={data['orderID']}")
            print_pass(f"Internal order ID: {data['internalOrderId']}")
            
            totals = data['totals']
            required_total_keys = ['subtotal', 'shipping', 'tax', 'total', 'taxRate', 'taxState']
            for key in required_total_keys:
                if key not in totals:
                    print_fail(f"totals missing '{key}' field")
                    return False
            
            # Verify HI tax
            if totals['taxState'] != 'HI':
                print_fail(f"Expected taxState='HI', got '{totals['taxState']}'")
                return False
            
            if totals['taxRate'] != 0.04712:
                print_fail(f"Expected taxRate=0.04712, got {totals['taxRate']}")
                return False
            
            print_pass(f"HI tax correctly applied: rate={totals['taxRate']}, tax=${totals['tax']}")
            print_pass(f"Totals: subtotal=${totals['subtotal']}, shipping=${totals['shipping']}, total=${totals['total']}")
            print_pass("✅ THE FIX WORKS: MongoDB is up, order created successfully with correct tax")
            
            # Store for potential later use
            global LAST_ORDER_ID
            LAST_ORDER_ID = data['internalOrderId']
            
            return True
        
        else:
            print_fail(f"Unexpected status code: {response.status_code}")
            print_fail("Expected either 503 (Mongo down) or 201 (Mongo up)")
            return False
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_2b_create_order_invalid_empty_items():
    """Test 2b: POST /api/paypal/create-order with empty items → 400."""
    print_test("2b: POST /api/paypal/create-order with empty items → 400")
    
    try:
        url = f"{BASE_URL}/paypal/create-order"
        payload = {
            "items": [],
            "shipping": {
                "fullName": "Test Buyer",
                "email": "buyer@example.com",
                "line1": "123 Main St",
                "city": "Honolulu",
                "state": "HI",
                "postalCode": "96813",
                "country": "US"
            }
        }
        
        print_info(f"POST {url} with empty items[]")
        
        response = requests.post(url, json=payload, timeout=15)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 500:
            print_fail("Got 500 for invalid payload (should be 400)")
            try:
                data = response.json()
                print_info(f"Response: {data}")
            except Exception:
                print_info(f"Response: {response.text[:200]}")
            return False
        
        if response.status_code == 503:
            print_fail("Got 503 for invalid payload (should be 400, not db error)")
            return False
        
        if response.status_code != 400:
            print_fail(f"Expected 400, got {response.status_code}")
            return False
        
        try:
            data = response.json()
            if 'error' in data:
                print_pass(f"400 with error: {data['error']}")
            else:
                print_pass("400 returned")
        except Exception:
            print_pass("400 returned")
        
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_2c_create_order_invalid_email():
    """Test 2c: POST /api/paypal/create-order with invalid email → 400."""
    print_test("2c: POST /api/paypal/create-order with invalid email → 400")
    
    try:
        url = f"{BASE_URL}/paypal/create-order"
        payload = {
            "items": [
                {
                    "sheetId": "14x36",
                    "quantity": 1,
                    "unitPrice": 18
                }
            ],
            "shipping": {
                "fullName": "X",
                "email": "bad",  # Invalid email
                "line1": "1",
                "city": "H",
                "state": "XX",  # Invalid state
                "postalCode": "1",
                "country": "US"
            }
        }
        
        print_info(f"POST {url} with invalid email + short fields")
        
        response = requests.post(url, json=payload, timeout=15)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 500:
            print_fail("Got 500 for invalid payload (should be 400)")
            return False
        
        if response.status_code == 503:
            print_fail("Got 503 for invalid payload (should be 400)")
            return False
        
        if response.status_code != 400:
            print_fail(f"Expected 400, got {response.status_code}")
            return False
        
        try:
            data = response.json()
            if 'error' in data:
                print_pass(f"400 with error: {data['error']}")
            else:
                print_pass("400 returned")
        except Exception:
            print_pass("400 returned")
        
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_2d_create_order_invalid_sheet():
    """Test 2d: POST /api/paypal/create-order with invalid sheetId → 400."""
    print_test("2d: POST /api/paypal/create-order with invalid sheetId → 400")
    
    try:
        url = f"{BASE_URL}/paypal/create-order"
        payload = {
            "items": [
                {
                    "sheetId": "invalid",  # Invalid sheet
                    "quantity": 1,
                    "unitPrice": 18
                }
            ],
            "shipping": {
                "fullName": "Real Name",
                "email": "a@b.com",
                "line1": "1 Main",
                "city": "Honolulu",
                "state": "HI",
                "postalCode": "96813",
                "country": "US"
            }
        }
        
        print_info(f"POST {url} with invalid sheetId")
        
        response = requests.post(url, json=payload, timeout=15)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 500:
            print_fail("Got 500 for invalid payload (should be 400)")
            return False
        
        if response.status_code == 503:
            print_fail("Got 503 for invalid payload (should be 400)")
            return False
        
        if response.status_code != 400:
            print_fail(f"Expected 400, got {response.status_code}")
            return False
        
        try:
            data = response.json()
            if 'error' in data:
                print_pass(f"400 with error: {data['error']}")
            else:
                print_pass("400 returned")
        except Exception:
            print_pass("400 returned")
        
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_3_pricing():
    """Test 3: GET /api/pricing regression."""
    print_test("3: GET /api/pricing (regression)")
    
    try:
        url = f"{BASE_URL}/pricing"
        print_info(f"GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return False
        
        data = response.json()
        
        if 'sheets' not in data:
            print_fail("Response missing 'sheets' field")
            return False
        
        sheets = data['sheets']
        sheet_ids = [s['id'] for s in sheets]
        
        # Check for 14x12 through 14x120
        expected_sheets = ['14x12', '14x36', '14x120']
        for sheet_id in expected_sheets:
            if sheet_id not in sheet_ids:
                print_fail(f"Missing sheet: {sheet_id}")
                return False
        
        # Check prices
        sheet_14x12 = next((s for s in sheets if s['id'] == '14x12'), None)
        if not sheet_14x12 or sheet_14x12.get('price') != 10:
            print_fail("14x12 price should be $10")
            return False
        
        sheet_14x120 = next((s for s in sheets if s['id'] == '14x120'), None)
        if not sheet_14x120 or sheet_14x120.get('price') != 40:
            print_fail("14x120 price should be $40")
            return False
        
        print_pass(f"Sheets array contains {len(sheets)} sheets including 14x12 ($10) through 14x120 ($40)")
        print_pass("GET /api/pricing regression passed")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_4_pricing_quote():
    """Test 4: POST /api/pricing/quote regression."""
    print_test("4: POST /api/pricing/quote (regression)")
    
    try:
        url = f"{BASE_URL}/pricing/quote"
        payload = {"sheetId": "14x60", "addons": []}
        
        print_info(f"POST {url} with {payload}")
        
        response = requests.post(url, json=payload, timeout=10)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return False
        
        data = response.json()
        
        if 'unitPrice' not in data:
            print_fail("Response missing 'unitPrice' field")
            return False
        
        if data['unitPrice'] != 26:
            print_fail(f"Expected unitPrice=26 for 14x60, got {data['unitPrice']}")
            return False
        
        print_pass(f"14x60 quote: unitPrice=${data['unitPrice']}")
        print_pass("POST /api/pricing/quote regression passed")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_5_cart_validate():
    """Test 5: POST /api/cart/validate regression (tampered price)."""
    print_test("5: POST /api/cart/validate (regression)")
    
    try:
        url = f"{BASE_URL}/cart/validate"
        payload = {
            "items": [
                {
                    "sheetId": "14x36",
                    "quantity": 2,
                    "unitPrice": 9999  # Tampered!
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
        
        if 'items' not in data or len(data['items']) == 0:
            print_fail("Response missing 'items' or items is empty")
            return False
        
        item = data['items'][0]
        if item['unitPrice'] != 18:
            print_fail(f"Server did not recompute unitPrice! Got {item['unitPrice']}, expected 18")
            return False
        
        print_pass("Server recomputed unitPrice: 9999 → 18 ✓")
        
        if data.get('subtotal') != 36:
            print_fail(f"Expected subtotal=36, got {data.get('subtotal')}")
            return False
        
        print_pass(f"Subtotal correct: ${data['subtotal']}")
        print_pass("POST /api/cart/validate regression passed")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_6_uploads_post():
    """Test 6: POST /api/uploads regression."""
    print_test("6: POST /api/uploads (regression)")
    
    try:
        url = f"{BASE_URL}/uploads"
        png_data = create_test_png()
        
        files = {'file': ('test.png', io.BytesIO(png_data), 'image/png')}
        print_info(f"POST {url} with {len(png_data)}-byte PNG")
        
        response = requests.post(url, files=files, timeout=15)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return False
        
        data = response.json()
        
        if 'artworkUrl' not in data:
            print_fail("Response missing 'artworkUrl' field")
            return False
        
        artwork_url = data['artworkUrl']
        print_pass(f"Upload successful: {artwork_url}")
        
        # Verify it starts with https:// (Vercel Blob storage)
        if not artwork_url.startswith('https://'):
            print_fail(f"artworkUrl should start with 'https://' (Vercel Blob), got: {artwork_url}")
            return False
        
        print_pass("artworkUrl starts with https:// (Vercel Blob storage)")
        
        # Try to GET it
        print_info(f"GET {artwork_url}")
        get_response = requests.get(artwork_url, timeout=10)
        
        if get_response.status_code != 200:
            print_fail(f"GET artworkUrl failed: {get_response.status_code}")
            return False
        
        if get_response.headers.get('Content-Type') != 'image/png':
            print_fail(f"Wrong Content-Type: {get_response.headers.get('Content-Type')}")
            return False
        
        if not verify_png_signature(get_response.content):
            print_fail("Downloaded file is not a valid PNG")
            return False
        
        print_pass("GET artworkUrl successful: valid PNG")
        print_pass("POST /api/uploads regression passed")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_7_contact_valid():
    """Test 7: POST /api/contact with valid payload → 200."""
    print_test("7: POST /api/contact with valid payload (regression)")
    
    try:
        url = f"{BASE_URL}/contact"
        payload = {
            "name": "QA Bot",
            "email": "qa@example.com",
            "subject": "Bot smoke",
            "message": "Testing prod contact form after paypal fix."
        }
        
        print_info(f"POST {url}")
        
        response = requests.post(url, json=payload, timeout=15)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return False
        
        data = response.json()
        
        if 'ok' not in data or not data['ok']:
            print_fail(f"Response 'ok' is not true: {data}")
            return False
        
        print_pass("Contact form submission successful")
        print_info("Note: May succeed even if Mongo insert fails (contact route swallows DB errors by design)")
        print_pass("POST /api/contact (valid) regression passed")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def test_8_contact_invalid():
    """Test 8: POST /api/contact with invalid payload → 400."""
    print_test("8: POST /api/contact with invalid payload (regression)")
    
    try:
        url = f"{BASE_URL}/contact"
        payload = {
            "name": "",
            "email": "nope"  # Invalid email
        }
        
        print_info(f"POST {url} with invalid payload")
        
        response = requests.post(url, json=payload, timeout=10)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print_fail(f"Expected 400, got {response.status_code}")
            return False
        
        try:
            data = response.json()
            if 'error' in data:
                print_pass(f"400 with error: {data['error']}")
            else:
                print_pass("400 returned")
        except Exception:
            print_pass("400 returned")
        
        print_pass("POST /api/contact (invalid) regression passed")
        return True
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("PAYPAL CHECKOUT BUG FIX VERIFICATION - PRODUCTION")
    print("="*80)
    print(f"Production URL: {BASE_URL}")
    print("="*80)
    
    results = {}
    
    # Test 1: Health endpoint
    print_info("\n🔍 TESTING NEW HEALTH ENDPOINT...")
    results['1_health'] = test_1_health_endpoint()
    
    # Test 2: PayPal create-order (THE FIX)
    print_info("\n🔍 TESTING PAYPAL CREATE-ORDER FIX...")
    results['2a_create_order_valid'] = test_2a_create_order_valid()
    results['2b_create_order_empty_items'] = test_2b_create_order_invalid_empty_items()
    results['2c_create_order_invalid_email'] = test_2c_create_order_invalid_email()
    results['2d_create_order_invalid_sheet'] = test_2d_create_order_invalid_sheet()
    
    # Test 3-8: Regression sweep
    print_info("\n🔍 RUNNING REGRESSION SWEEP...")
    results['3_pricing'] = test_3_pricing()
    results['4_pricing_quote'] = test_4_pricing_quote()
    results['5_cart_validate'] = test_5_cart_validate()
    results['6_uploads'] = test_6_uploads_post()
    results['7_contact_valid'] = test_7_contact_valid()
    results['8_contact_invalid'] = test_8_contact_invalid()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    total = len(results)
    
    for test_name, result in results.items():
        if result is True:
            print(f"✅ {test_name}")
        else:
            print(f"❌ {test_name}")
    
    print("="*80)
    print(f"PASSED: {passed}/{total}")
    print(f"FAILED: {failed}/{total}")
    print("="*80)
    
    # MongoDB status report
    if 'MONGO_IS_UP' in globals():
        if MONGO_IS_UP:
            print("\n✅ MongoDB Atlas is REACHABLE - tested path (b): order creation successful")
        else:
            print("\n⚠️  MongoDB Atlas is UNREACHABLE - tested path (a): graceful 503 degradation")
            print("    User must fix Atlas cluster (TLS handshake failure)")
    
    print("\n" + "="*80)
    
    if failed > 0:
        print("\n❌ SOME TESTS FAILED - SEE DETAILS ABOVE")
        return 1
    else:
        print("\n✅ ALL TESTS PASSED")
        print("\nTHE PAYPAL CHECKOUT BUG FIX IS VERIFIED:")
        print("  - No generic 500 errors")
        print("  - Graceful 503 degradation when Mongo is down")
        print("  - All regression tests passed")
        return 0

if __name__ == '__main__':
    exit(main())
