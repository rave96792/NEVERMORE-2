#!/usr/bin/env python3
"""
Production recovery verification for Nevermore DTF
Tests against LIVE production: https://www.nevermoredtf.com
"""

import requests
import json
import sys
from io import BytesIO

# PRODUCTION BASE URL
BASE_URL = "https://www.nevermoredtf.com"
ADMIN_TOKEN = "nevermore-admin-2026-XvT9pWq3Rz1KcJ7bH2Fs4Ye8Da5Nh6Uk"

def print_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} | {name}")
    if details:
        print(f"    {details}")

def test_health():
    """TEST A — Sanity / Health"""
    print("\n=== TEST A: Health Endpoint ===")
    try:
        resp = requests.get(f"{BASE_URL}/api/health", timeout=30)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Assert status 200
        test_passed = resp.status_code == 200
        print_test("Health returns 200", test_passed)
        
        # Assert ok: true
        test_passed = data.get("ok") == True
        print_test("ok: true", test_passed, f"Got: {data.get('ok')}")
        
        # Assert mongo.ok: true
        mongo_ok = data.get("checks", {}).get("mongo", {}).get("ok")
        print_test("checks.mongo.ok: true", mongo_ok == True, f"Got: {mongo_ok}")
        
        # Assert paypal.ok: true
        paypal_ok = data.get("checks", {}).get("paypal", {}).get("ok")
        print_test("checks.paypal.ok: true", paypal_ok == True, f"Got: {paypal_ok}")
        
        # Assert paypal.base: "https://api-m.paypal.com" (LIVE)
        paypal_base = data.get("checks", {}).get("paypal", {}).get("base")
        test_passed = paypal_base == "https://api-m.paypal.com"
        print_test("checks.paypal.base: 'https://api-m.paypal.com' (LIVE)", test_passed, f"Got: {paypal_base}")
        
        # Assert PAYPAL_ENV: "live"
        paypal_env = data.get("checks", {}).get("env", {}).get("PAYPAL_ENV")
        test_passed = paypal_env == "live"
        print_test("checks.env.PAYPAL_ENV: 'live'", test_passed, f"Got: {paypal_env}")
        
        # Assert PAYPAL_CLIENT_ID: true
        client_id = data.get("checks", {}).get("env", {}).get("PAYPAL_CLIENT_ID")
        print_test("checks.env.PAYPAL_CLIENT_ID: true", client_id == True, f"Got: {client_id}")
        
        # Assert RESEND_API_KEY: true
        resend = data.get("checks", {}).get("env", {}).get("RESEND_API_KEY")
        print_test("checks.env.RESEND_API_KEY: true", resend == True, f"Got: {resend}")
        
        # Assert ADMIN_TOKEN_set: true
        admin_token = data.get("checks", {}).get("env", {}).get("ADMIN_TOKEN_set")
        print_test("checks.env.ADMIN_TOKEN_set: true", admin_token == True, f"Got: {admin_token}")
        
        # Assert mongo user
        mongo_user = data.get("checks", {}).get("env", {}).get("MONGO_info", {}).get("user")
        test_passed = mongo_user == "nevermoreprintingcompany_db_user"
        print_test("checks.env.MONGO_info.user: 'nevermoreprintingcompany_db_user'", test_passed, f"Got: {mongo_user}")
        
        # Assert mongo host
        mongo_host = data.get("checks", {}).get("env", {}).get("MONGO_info", {}).get("host")
        test_passed = mongo_host == "nevermoredtf.vseirgo.mongodb.net"
        print_test("checks.env.MONGO_info.host: 'nevermoredtf.vseirgo.mongodb.net'", test_passed, f"Got: {mongo_host}")
        
        # Assert mongo passwordLen: 24 (NOT 16)
        password_len = data.get("checks", {}).get("env", {}).get("MONGO_info", {}).get("passwordLen")
        test_passed = password_len == 24
        print_test("checks.env.MONGO_info.passwordLen: 24 (NOT 16)", test_passed, f"Got: {password_len}")
        
        return True
    except Exception as e:
        print(f"❌ FAIL | Health endpoint error: {e}")
        return False

def test_pricing():
    """TEST B — Core commerce endpoints"""
    print("\n=== TEST B: Core Commerce Endpoints ===")
    try:
        # 1. GET /api/pricing
        resp = requests.get(f"{BASE_URL}/api/pricing", timeout=30)
        print(f"GET /api/pricing - Status: {resp.status_code}")
        data = resp.json()
        sheets = data.get("sheets", [])
        test_passed = resp.status_code == 200 and len(sheets) == 9
        print_test("GET /api/pricing returns 200 with 9 sheets", test_passed, f"Got {len(sheets)} sheets")
        
        # Verify 14x12 ($10) and 14x120 ($40)
        sheet_14x12 = next((s for s in sheets if s.get("id") == "14x12"), None)
        sheet_14x120 = next((s for s in sheets if s.get("id") == "14x120"), None)
        test_passed = sheet_14x12 and sheet_14x12.get("price") == 10
        print_test("14x12 sheet costs $10", test_passed, f"Got: ${sheet_14x12.get('price') if sheet_14x12 else 'N/A'}")
        test_passed = sheet_14x120 and sheet_14x120.get("price") == 40
        print_test("14x120 sheet costs $40", test_passed, f"Got: ${sheet_14x120.get('price') if sheet_14x120 else 'N/A'}")
        
        # 2. POST /api/pricing/quote
        resp = requests.post(f"{BASE_URL}/api/pricing/quote", 
                            json={"sheetId": "14x60"}, 
                            timeout=30)
        print(f"POST /api/pricing/quote - Status: {resp.status_code}")
        data = resp.json()
        unit_price = data.get("unitPrice")
        test_passed = resp.status_code == 200 and unit_price == 26
        print_test("POST /api/pricing/quote {sheetId:'14x60'} returns unitPrice:26", test_passed, f"Got: {unit_price}")
        
        # 3. POST /api/cart/validate with tampered unitPrice
        resp = requests.post(f"{BASE_URL}/api/cart/validate",
                            json={
                                "items": [{
                                    "sheetId": "14x36",
                                    "quantity": 2,
                                    "unitPrice": 9999
                                }]
                            },
                            timeout=30)
        print(f"POST /api/cart/validate - Status: {resp.status_code}")
        data = resp.json()
        recomputed_price = data.get("items", [{}])[0].get("unitPrice")
        test_passed = resp.status_code == 200 and recomputed_price == 18
        print_test("POST /api/cart/validate recomputes tampered unitPrice 9999→18", test_passed, f"Got: {recomputed_price}")
        
        return True
    except Exception as e:
        print(f"❌ FAIL | Pricing endpoints error: {e}")
        return False

def test_create_order():
    """TEST C — Create-order live PayPal"""
    print("\n=== TEST C: Create-Order Live PayPal ===")
    
    # 1. HI pickup
    print("\n--- C1: HI Pickup ---")
    try:
        resp = requests.post(f"{BASE_URL}/api/paypal/create-order",
                            json={
                                "items": [{"sheetId": "14x12", "quantity": 1}],
                                "shipping": {
                                    "fullName": "Recovery Test",
                                    "email": "nevermoreprintingcompany@yahoo.com",
                                    "phone": "808-555-0100"
                                },
                                "deliveryMethod": "pickup"
                            },
                            timeout=30)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        test_passed = resp.status_code == 201
        print_test("HI pickup returns 201", test_passed)
        
        order_id = data.get("orderID")
        test_passed = order_id and len(order_id) > 10
        print_test("orderID present (PayPal order)", test_passed, f"Got: {order_id}")
        
        internal_order_id = data.get("internalOrderId")
        test_passed = internal_order_id and len(internal_order_id) == 36  # UUID format
        print_test("internalOrderId present (UUID)", test_passed, f"Got: {internal_order_id}")
        
        order_number = data.get("orderNumber")
        test_passed = order_number and order_number >= 108
        print_test("orderNumber >= 108", test_passed, f"Got: {order_number}")
        
        totals = data.get("totals", {})
        test_passed = (totals.get("subtotal") == 10 and 
                      totals.get("shipping") == 0 and
                      abs(totals.get("tax", 0) - 0.47) < 0.01 and
                      abs(totals.get("total", 0) - 10.47) < 0.01 and
                      abs(totals.get("taxRate", 0) - 0.04712) < 0.0001 and
                      totals.get("taxState") == "HI" and
                      totals.get("deliveryMethod") == "pickup")
        print_test("Totals correct for HI pickup", test_passed, 
                  f"subtotal:{totals.get('subtotal')}, shipping:{totals.get('shipping')}, tax:{totals.get('tax')}, total:{totals.get('total')}, taxRate:{totals.get('taxRate')}, taxState:{totals.get('taxState')}, deliveryMethod:{totals.get('deliveryMethod')}")
        
        # Store for admin tests
        global test_internal_order_id
        test_internal_order_id = internal_order_id
        
    except Exception as e:
        print(f"❌ FAIL | HI pickup error: {e}")
    
    # 2. HI ship
    print("\n--- C2: HI Ship ---")
    try:
        resp = requests.post(f"{BASE_URL}/api/paypal/create-order",
                            json={
                                "items": [{"sheetId": "14x24", "quantity": 1}],
                                "shipping": {
                                    "fullName": "Recovery Test",
                                    "email": "nevermoreprintingcompany@yahoo.com",
                                    "line1": "1 Ala Moana",
                                    "city": "Honolulu",
                                    "state": "HI",
                                    "postalCode": "96813",
                                    "country": "US"
                                },
                                "deliveryMethod": "ship"
                            },
                            timeout=30)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        test_passed = resp.status_code == 201
        print_test("HI ship returns 201", test_passed)
        
        totals = data.get("totals", {})
        test_passed = totals.get("shipping") == 5 and totals.get("deliveryMethod") == "ship"
        print_test("HI ship has shipping:$5", test_passed, f"shipping:{totals.get('shipping')}, deliveryMethod:{totals.get('deliveryMethod')}")
        
        test_passed = totals.get("taxState") == "HI" and totals.get("tax", 0) > 0
        print_test("HI ship has HI tax applied", test_passed, f"taxState:{totals.get('taxState')}, tax:{totals.get('tax')}")
        
    except Exception as e:
        print(f"❌ FAIL | HI ship error: {e}")
    
    # 3. CA ship
    print("\n--- C3: CA Ship ---")
    try:
        resp = requests.post(f"{BASE_URL}/api/paypal/create-order",
                            json={
                                "items": [{"sheetId": "14x24", "quantity": 2}],
                                "shipping": {
                                    "fullName": "Recovery Test",
                                    "email": "nevermoreprintingcompany@yahoo.com",
                                    "line1": "1 Market St",
                                    "city": "Los Angeles",
                                    "state": "CA",
                                    "postalCode": "90001",
                                    "country": "US"
                                },
                                "deliveryMethod": "ship"
                            },
                            timeout=30)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        test_passed = resp.status_code == 201
        print_test("CA ship returns 201", test_passed)
        
        totals = data.get("totals", {})
        test_passed = totals.get("shipping") == 12
        print_test("CA ship has shipping:$12", test_passed, f"Got: {totals.get('shipping')}")
        
        test_passed = totals.get("tax") == 0 and totals.get("taxState") == "CA"
        print_test("CA ship has tax:$0, taxState:CA", test_passed, f"tax:{totals.get('tax')}, taxState:{totals.get('taxState')}")
        
    except Exception as e:
        print(f"❌ FAIL | CA ship error: {e}")
    
    # 4. Sanity checks - bad payloads
    print("\n--- C4: Invalid Payloads ---")
    try:
        # Bad email
        resp = requests.post(f"{BASE_URL}/api/paypal/create-order",
                            json={
                                "items": [{"sheetId": "14x12", "quantity": 1}],
                                "shipping": {
                                    "fullName": "Test",
                                    "email": "not-an-email",
                                    "phone": "808-555-0100"
                                },
                                "deliveryMethod": "pickup"
                            },
                            timeout=30)
        test_passed = resp.status_code == 400
        print_test("Bad email returns 400", test_passed, f"Got: {resp.status_code}")
        
        # Empty items
        resp = requests.post(f"{BASE_URL}/api/paypal/create-order",
                            json={
                                "items": [],
                                "shipping": {
                                    "fullName": "Test",
                                    "email": "test@example.com",
                                    "phone": "808-555-0100"
                                },
                                "deliveryMethod": "pickup"
                            },
                            timeout=30)
        test_passed = resp.status_code == 400
        print_test("Empty items returns 400", test_passed, f"Got: {resp.status_code}")
        
        # Missing line1 on ship
        resp = requests.post(f"{BASE_URL}/api/paypal/create-order",
                            json={
                                "items": [{"sheetId": "14x12", "quantity": 1}],
                                "shipping": {
                                    "fullName": "Test",
                                    "email": "test@example.com",
                                    "city": "Honolulu",
                                    "state": "HI",
                                    "postalCode": "96813",
                                    "country": "US"
                                },
                                "deliveryMethod": "ship"
                            },
                            timeout=30)
        test_passed = resp.status_code == 400
        print_test("Missing line1 on ship returns 400", test_passed, f"Got: {resp.status_code}")
        
    except Exception as e:
        print(f"❌ FAIL | Invalid payload tests error: {e}")

def test_admin_endpoints():
    """TEST D — Admin endpoints"""
    print("\n=== TEST D: Admin Endpoints ===")
    
    if 'test_internal_order_id' not in globals():
        print("⚠️  SKIP | No internal order ID from create-order test")
        return
    
    order_id = test_internal_order_id
    
    # 1. POST /api/orders/[id]/rerender with NO token
    print("\n--- D1: Rerender without token ---")
    try:
        resp = requests.post(f"{BASE_URL}/api/orders/{order_id}/rerender",
                            json={"force": True},
                            timeout=30)
        print(f"Status: {resp.status_code}")
        test_passed = resp.status_code == 401
        print_test("Rerender without token returns 401", test_passed, f"Got: {resp.status_code}")
    except Exception as e:
        print(f"❌ FAIL | Rerender no token error: {e}")
    
    # 2. POST /api/orders/[id]/rerender with correct token
    print("\n--- D2: Rerender with correct token ---")
    try:
        resp = requests.post(f"{BASE_URL}/api/orders/{order_id}/rerender",
                            json={"force": True},
                            headers={"x-admin-token": ADMIN_TOKEN},
                            timeout=60)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        test_passed = resp.status_code == 200
        print_test("Rerender with token returns 200", test_passed)
        
        test_passed = data.get("ok") == True
        print_test("ok: true", test_passed, f"Got: {data.get('ok')}")
        
        test_passed = data.get("status") == "succeeded"
        print_test("status: 'succeeded'", test_passed, f"Got: {data.get('status')}")
        
        test_passed = data.get("renderedCount") == 0
        print_test("renderedCount: 0 (no layout in order)", test_passed, f"Got: {data.get('renderedCount')}")
        
        test_passed = data.get("totalItems") == 1
        print_test("totalItems: 1", test_passed, f"Got: {data.get('totalItems')}")
        
        test_passed = data.get("attempt") == 1
        print_test("attempt: 1", test_passed, f"Got: {data.get('attempt')}")
        
    except Exception as e:
        print(f"❌ FAIL | Rerender with token error: {e}")
    
    # 3. POST /api/orders/[id]/status with correct token
    print("\n--- D3: Status update with token ---")
    try:
        resp = requests.post(f"{BASE_URL}/api/orders/{order_id}/status",
                            json={"status": "PROCESSING"},
                            headers={"x-admin-token": ADMIN_TOKEN},
                            timeout=30)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        test_passed = resp.status_code == 200
        print_test("Status update returns 200", test_passed)
        
        test_passed = data.get("ok") == True
        print_test("ok: true", test_passed, f"Got: {data.get('ok')}")
        
        test_passed = data.get("status") == "PROCESSING"
        print_test("status: 'PROCESSING'", test_passed, f"Got: {data.get('status')}")
        
        # Email may fail with Resend validation - that's fine
        email_result = data.get("email", {})
        print(f"    Email result: {email_result}")
        
    except Exception as e:
        print(f"❌ FAIL | Status update error: {e}")
    
    # 4. GET /api/orders/[id] to verify updates
    print("\n--- D4: Get order to verify updates ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/orders/{order_id}", timeout=30)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        test_passed = resp.status_code == 200
        print_test("GET order returns 200", test_passed)
        
        test_passed = data.get("status") == "PROCESSING"
        print_test("Order status is PROCESSING", test_passed, f"Got: {data.get('status')}")
        
        test_passed = data.get("renderStatus") == "succeeded"
        print_test("Order renderStatus is succeeded", test_passed, f"Got: {data.get('renderStatus')}")
        
    except Exception as e:
        print(f"❌ FAIL | Get order error: {e}")

def test_uploads_composite():
    """TEST E — Uploads + composite"""
    print("\n=== TEST E: Uploads + Composite ===")
    
    # 1. POST /api/uploads with a small PNG
    print("\n--- E1: Upload PNG ---")
    try:
        # Create a minimal PNG (1x1 transparent)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,  # RGBA
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,  # IEND chunk
            0x42, 0x60, 0x82
        ])
        
        files = {'file': ('test.png', BytesIO(png_data), 'image/png')}
        resp = requests.post(f"{BASE_URL}/api/uploads", files=files, timeout=30)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        test_passed = resp.status_code == 200
        print_test("Upload returns 200", test_passed)
        
        artwork_url = data.get("artworkUrl")
        test_passed = artwork_url and len(artwork_url) > 0
        print_test("artworkUrl present", test_passed, f"Got: {artwork_url}")
        
        # GET the uploaded file
        if artwork_url:
            # Handle both absolute and relative URLs
            if artwork_url.startswith('http'):
                get_url = artwork_url
            else:
                get_url = f"{BASE_URL}{artwork_url}"
            
            resp = requests.get(get_url, timeout=30)
            test_passed = resp.status_code == 200 and resp.headers.get('content-type') == 'image/png'
            print_test("GET uploaded file returns 200 image/png", test_passed, 
                      f"Status: {resp.status_code}, Content-Type: {resp.headers.get('content-type')}")
            
            # Store for composite test
            global test_artwork_url
            test_artwork_url = artwork_url
        
    except Exception as e:
        print(f"❌ FAIL | Upload error: {e}")
    
    # 2. POST /api/composite with valid layout
    print("\n--- E2: Composite render ---")
    try:
        if 'test_artwork_url' not in globals():
            print("⚠️  SKIP | No artwork URL from upload test")
            return
        
        resp = requests.post(f"{BASE_URL}/api/composite",
                            json={
                                "layout": {
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
                            },
                            timeout=60)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        test_passed = resp.status_code == 200
        print_test("Composite returns 200", test_passed)
        
        composite_url = data.get("artworkUrl")
        test_passed = composite_url and len(composite_url) > 0
        print_test("Composite artworkUrl present", test_passed, f"Got: {composite_url}")
        
        # GET the composite
        if composite_url:
            if composite_url.startswith('http'):
                get_url = composite_url
            else:
                get_url = f"{BASE_URL}{composite_url}"
            
            resp = requests.get(get_url, timeout=30)
            test_passed = resp.status_code == 200 and resp.headers.get('content-type') == 'image/png'
            print_test("GET composite returns 200 image/png", test_passed,
                      f"Status: {resp.status_code}, Content-Type: {resp.headers.get('content-type')}")
            
            # Check dimensions (should be 4200×7200 for 14×24 @ 300 DPI)
            if resp.status_code == 200:
                content = resp.content
                # PNG IHDR is at bytes 16-24 (width) and 20-24 (height)
                if len(content) > 24:
                    width = int.from_bytes(content[16:20], 'big')
                    height = int.from_bytes(content[20:24], 'big')
                    test_passed = width == 4200 and height == 7200
                    print_test("Composite dimensions 4200×7200 (14×24 @ 300 DPI)", test_passed,
                              f"Got: {width}×{height}")
        
    except Exception as e:
        print(f"❌ FAIL | Composite error: {e}")

def test_contact():
    """TEST F — /api/contact"""
    print("\n=== TEST F: Contact Endpoint ===")
    try:
        resp = requests.post(f"{BASE_URL}/api/contact",
                            json={
                                "name": "Recovery Test",
                                "email": "nevermoreprintingcompany@yahoo.com",
                                "subject": "Recovery smoke test",
                                "message": "Testing after Vercel env-var fix — please ignore"
                            },
                            timeout=30)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        test_passed = resp.status_code == 200
        print_test("Contact returns 200", test_passed)
        
        test_passed = data.get("ok") == True
        print_test("ok: true", test_passed, f"Got: {data.get('ok')}")
        
    except Exception as e:
        print(f"❌ FAIL | Contact error: {e}")

def main():
    print("=" * 80)
    print("PRODUCTION RECOVERY VERIFICATION")
    print(f"Base URL: {BASE_URL}")
    print("=" * 80)
    
    test_health()
    test_pricing()
    test_create_order()
    test_admin_endpoints()
    test_uploads_composite()
    test_contact()
    
    print("\n" + "=" * 80)
    print("PRODUCTION RECOVERY VERIFICATION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()
