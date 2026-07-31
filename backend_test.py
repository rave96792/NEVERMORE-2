#!/usr/bin/env python3
"""
Production Backend Testing - Sharp Re-render + Resend Bug + Regression
Testing against https://www.nevermoredtf.com
"""

import requests
import struct
import sys

# Production base URL
BASE_URL = "https://www.nevermoredtf.com"

# Admin token for production (from review request)
ADMIN_TOKEN = "nevermore-admin-2026-XvT9pWq3Rz1KcJ7bH2Fs4Ye8Da5Nh6Uk"

# Real customer order ID from review request
CUSTOMER_ORDER_ID = "c034211c-a3dc-4902-82db-a318bc24cddb"

def print_test_header(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def print_test_result(test_name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} | {test_name}")
    if details:
        print(f"       {details}")

def parse_png_ihdr(png_bytes):
    """Parse PNG IHDR chunk to extract width, height, color type"""
    try:
        # PNG signature: 89 50 4E 47 0D 0A 1A 0A (8 bytes)
        if png_bytes[:8] != b'\x89PNG\r\n\x1a\n':
            return None, None, None
        
        # IHDR chunk starts at byte 8
        # Chunk structure: 4 bytes length, 4 bytes type, data, 4 bytes CRC
        # IHDR is always first chunk after signature
        ihdr_length = struct.unpack('>I', png_bytes[8:12])[0]
        ihdr_type = png_bytes[12:16]
        
        if ihdr_type != b'IHDR':
            return None, None, None
        
        # IHDR data: width(4), height(4), bit_depth(1), color_type(1), ...
        ihdr_data = png_bytes[16:16+ihdr_length]
        width = struct.unpack('>I', ihdr_data[0:4])[0]
        height = struct.unpack('>I', ihdr_data[4:8])[0]
        color_type = ihdr_data[9]
        
        return width, height, color_type
    except Exception as e:
        print(f"       Error parsing PNG: {e}")
        return None, None, None

# ============================================================================
# FIX #1: Sharp re-render of real customer order
# ============================================================================

def test_fix1_sharp_rerender():
    print_test_header("FIX #1: Sharp Re-render of Customer Order c034211c-...")
    
    all_passed = True
    
    # Test 1.1: GET order and verify all fields
    print("\n[Test 1.1] GET order and verify sharp render fields")
    try:
        url = f"{BASE_URL}/api/orders/{CUSTOMER_ORDER_ID}"
        response = requests.get(url, timeout=30)
        
        if response.status_code != 200:
            print_test_result("GET order returns 200", False, f"Got {response.status_code}")
            all_passed = False
            return all_passed
        
        print_test_result("GET order returns 200", True)
        
        order = response.json()
        
        # Verify status
        status_ok = order.get('status') == 'PROCESSING'
        print_test_result("status: 'PROCESSING'", status_ok, f"Got: {order.get('status')}")
        all_passed = all_passed and status_ok
        
        # Verify renderStatus
        render_status_ok = order.get('renderStatus') == 'succeeded'
        print_test_result("renderStatus: 'succeeded'", render_status_ok, f"Got: {order.get('renderStatus')}")
        all_passed = all_passed and render_status_ok
        
        # Verify renderAttempts
        render_attempts_ok = order.get('renderAttempts') == 1
        print_test_result("renderAttempts: 1", render_attempts_ok, f"Got: {order.get('renderAttempts')}")
        all_passed = all_passed and render_attempts_ok
        
        # Verify renderCompletedAt present
        render_completed_ok = order.get('renderCompletedAt') is not None
        print_test_result("renderCompletedAt present", render_completed_ok)
        all_passed = all_passed and render_completed_ok
        
        # Verify items[0] fields
        items = order.get('items', [])
        if not items:
            print_test_result("items array not empty", False, "No items found")
            all_passed = False
            return all_passed
        
        item = items[0]
        
        # printFileSource
        print_file_source_ok = item.get('printFileSource') == 'sharp-authoritative'
        print_test_result("items[0].printFileSource: 'sharp-authoritative'", print_file_source_ok, f"Got: {item.get('printFileSource')}")
        all_passed = all_passed and print_file_source_ok
        
        # compositeUrl
        composite_url = item.get('compositeUrl', '')
        composite_url_ok = composite_url.startswith('https://ja6cfnccvrkyo8kt.public.blob.vercel-storage.com/uploads/')
        print_test_result("items[0].compositeUrl starts with Vercel Blob URL", composite_url_ok, f"Got: {composite_url[:60]}...")
        all_passed = all_passed and composite_url_ok
        
        # compositeSize
        composite_size = item.get('compositeSize', 0)
        composite_size_ok = composite_size > 1_000_000
        print_test_result("items[0].compositeSize > 1MB", composite_size_ok, f"Got: {composite_size:,} bytes")
        all_passed = all_passed and composite_size_ok
        
        # layout present
        layout_ok = item.get('layout') is not None
        print_test_result("items[0].layout present (original layout data)", layout_ok)
        all_passed = all_passed and layout_ok
        
        # Test 1.2: GET the compositeUrl and verify PNG properties
        print("\n[Test 1.2] GET compositeUrl and verify PNG properties")
        
        try:
            png_response = requests.get(composite_url, timeout=30)
            
            if png_response.status_code != 200:
                print_test_result("GET compositeUrl returns 200", False, f"Got {png_response.status_code}")
                all_passed = False
            else:
                print_test_result("GET compositeUrl returns 200", True)
                
                # Content-Type
                content_type = png_response.headers.get('Content-Type', '')
                content_type_ok = content_type == 'image/png'
                print_test_result("Content-Type: image/png", content_type_ok, f"Got: {content_type}")
                all_passed = all_passed and content_type_ok
                
                # PNG magic bytes
                png_bytes = png_response.content
                magic_ok = png_bytes[:4] == b'\x89PNG'
                print_test_result("PNG magic bytes (0x89 0x50 0x4E 0x47)", magic_ok)
                all_passed = all_passed and magic_ok
                
                # Parse IHDR
                width, height, color_type = parse_png_ihdr(png_bytes)
                
                # Width = 4200 (14" × 300 DPI)
                width_ok = width == 4200
                print_test_result("Width in IHDR = 4200 (14\" × 300 DPI)", width_ok, f"Got: {width}")
                all_passed = all_passed and width_ok
                
                # Height = 3600 (12" × 300 DPI)
                height_ok = height == 3600
                print_test_result("Height in IHDR = 3600 (12\" × 300 DPI)", height_ok, f"Got: {height}")
                all_passed = all_passed and height_ok
                
                # Color type = 6 (RGBA transparent)
                color_type_ok = color_type == 6
                print_test_result("Color type = 6 (RGBA transparent)", color_type_ok, f"Got: {color_type}")
                all_passed = all_passed and color_type_ok
        
        except Exception as e:
            print_test_result("GET compositeUrl", False, f"Exception: {e}")
            all_passed = False
        
        # Test 1.3: Idempotency check - POST rerender without force
        print("\n[Test 1.3] Idempotency check - POST rerender without force")
        
        try:
            rerender_url = f"{BASE_URL}/api/orders/{CUSTOMER_ORDER_ID}/rerender"
            headers = {'x-admin-token': ADMIN_TOKEN, 'Content-Type': 'application/json'}
            rerender_response = requests.post(rerender_url, json={}, headers=headers, timeout=30)
            
            if rerender_response.status_code != 200:
                print_test_result("POST rerender returns 200", False, f"Got {rerender_response.status_code}")
                all_passed = False
            else:
                print_test_result("POST rerender returns 200", True)
                
                rerender_data = rerender_response.json()
                
                # alreadySucceeded: true
                already_succeeded_ok = rerender_data.get('alreadySucceeded') == True
                print_test_result("alreadySucceeded: true", already_succeeded_ok, f"Got: {rerender_data.get('alreadySucceeded')}")
                all_passed = all_passed and already_succeeded_ok
                
                # renderedCount: 0
                rendered_count_ok = rerender_data.get('renderedCount') == 0
                print_test_result("renderedCount: 0", rendered_count_ok, f"Got: {rerender_data.get('renderedCount')}")
                all_passed = all_passed and rendered_count_ok
        
        except Exception as e:
            print_test_result("POST rerender idempotency", False, f"Exception: {e}")
            all_passed = False
    
    except Exception as e:
        print_test_result("FIX #1 overall", False, f"Exception: {e}")
        all_passed = False
    
    return all_passed

# ============================================================================
# FIX #2: Confirm Resend domain-verification bug
# ============================================================================

def test_fix2_resend_bug():
    print_test_header("FIX #2: Confirm Resend Domain-Verification Bug")
    
    all_passed = True
    
    # Test 2.1: POST status endpoint and verify email failure
    print("\n[Test 2.1] POST /api/orders/.../status with PROCESSING - verify email.ok=false")
    
    try:
        status_url = f"{BASE_URL}/api/orders/{CUSTOMER_ORDER_ID}/status"
        headers = {'x-admin-token': ADMIN_TOKEN, 'Content-Type': 'application/json'}
        body = {'status': 'PROCESSING'}
        
        response = requests.post(status_url, json=body, headers=headers, timeout=30)
        
        if response.status_code != 200:
            print_test_result("POST status returns 200", False, f"Got {response.status_code}")
            all_passed = False
        else:
            print_test_result("POST status returns 200", True)
            
            data = response.json()
            
            # ok: true (status transition worked)
            ok_ok = data.get('ok') == True
            print_test_result("ok: true (status transition worked)", ok_ok, f"Got: {data.get('ok')}")
            all_passed = all_passed and ok_ok
            
            # status: PROCESSING
            status_ok = data.get('status') == 'PROCESSING'
            print_test_result("status: 'PROCESSING'", status_ok, f"Got: {data.get('status')}")
            all_passed = all_passed and status_ok
            
            # email.ok: false
            email = data.get('email', {})
            email_ok_false = email.get('ok') == False
            print_test_result("email.ok: false (Resend domain bug)", email_ok_false, f"Got: {email.get('ok')}")
            all_passed = all_passed and email_ok_false
            
            # email.error contains "You can only send testing emails" or "verify a domain"
            email_error = email.get('error', '')
            error_contains_expected = ('You can only send testing emails' in email_error or 
                                      'verify a domain' in email_error.lower())
            print_test_result("email.error contains expected Resend validation message", error_contains_expected, 
                            f"Got: {email_error[:100]}...")
            all_passed = all_passed and error_contains_expected
    
    except Exception as e:
        print_test_result("POST status email test", False, f"Exception: {e}")
        all_passed = False
    
    # Test 2.2: POST /api/email/test and check results
    print("\n[Test 2.2] POST /api/email/test - verify shop vs buyer email behavior")
    
    try:
        test_url = f"{BASE_URL}/api/email/test"
        response = requests.post(test_url, timeout=30)
        
        if response.status_code != 200:
            print_test_result("POST /api/email/test returns 200", False, f"Got {response.status_code}")
            all_passed = False
        else:
            print_test_result("POST /api/email/test returns 200", True)
            
            data = response.json()
            results = data.get('results', {})
            
            # Shop email (nevermoreprintingcompany@yahoo.com) should succeed
            shop = results.get('shop', {})
            shop_ok = shop.get('ok')
            print_test_result("results.shop.ok (verified recipient)", shop_ok, 
                            f"Got: {shop_ok}, id: {shop.get('id', 'N/A')}")
            
            # Buyer email behavior (may fail if not verified)
            buyer = results.get('buyer', {})
            buyer_ok = buyer.get('ok')
            buyer_error = buyer.get('error', '')
            print_test_result("results.buyer.ok", buyer_ok, 
                            f"Got: {buyer_ok}, error: {buyer_error[:80] if buyer_error else 'N/A'}")
            
            # Note: This is informational - the bug is that external recipients fail
            if shop_ok and not buyer_ok:
                print("       ℹ️  CONFIRMED: Shop email succeeds, buyer email fails - this is the Resend domain bug")
    
    except Exception as e:
        print_test_result("POST /api/email/test", False, f"Exception: {e}")
        all_passed = False
    
    return all_passed

# ============================================================================
# FIX #3: Regression tests - previously-verified endpoints
# ============================================================================

def test_fix3_regression():
    print_test_header("FIX #3: Regression Tests - Previously-Verified Endpoints")
    
    all_passed = True
    
    # Test 3.1: GET /api/health
    print("\n[Test 3.1] GET /api/health")
    
    try:
        url = f"{BASE_URL}/api/health"
        response = requests.get(url, timeout=30)
        
        if response.status_code != 200:
            print_test_result("GET /api/health returns 200", False, f"Got {response.status_code}")
            all_passed = False
        else:
            print_test_result("GET /api/health returns 200", True)
            
            data = response.json()
            checks = data.get('checks', {})
            
            # mongo.ok: true
            mongo = checks.get('mongo', {})
            mongo_ok = mongo.get('ok') == True
            print_test_result("checks.mongo.ok: true", mongo_ok, f"Got: {mongo.get('ok')}")
            all_passed = all_passed and mongo_ok
            
            # paypal.ok: true
            paypal = checks.get('paypal', {})
            paypal_ok = paypal.get('ok') == True
            print_test_result("checks.paypal.ok: true", paypal_ok, f"Got: {paypal.get('ok')}")
            all_passed = all_passed and paypal_ok
            
            # paypal.base: api-m.paypal.com
            paypal_base = paypal.get('base', '')
            paypal_base_ok = 'api-m.paypal.com' in paypal_base
            print_test_result("checks.paypal.base: api-m.paypal.com (LIVE)", paypal_base_ok, f"Got: {paypal_base}")
            all_passed = all_passed and paypal_base_ok
            
            # PAYPAL_ENV: 'live'
            env = checks.get('env', {})
            paypal_env = env.get('PAYPAL_ENV', '')
            paypal_env_ok = paypal_env == 'live'
            print_test_result("PAYPAL_ENV: 'live'", paypal_env_ok, f"Got: {paypal_env}")
            all_passed = all_passed and paypal_env_ok
    
    except Exception as e:
        print_test_result("GET /api/health", False, f"Exception: {e}")
        all_passed = False
    
    # Test 3.2: POST /api/paypal/create-order (HI pickup)
    print("\n[Test 3.2] POST /api/paypal/create-order (HI pickup)")
    
    try:
        url = f"{BASE_URL}/api/paypal/create-order"
        body = {
            'items': [{'sheetId': '14x12', 'quantity': 1, 'unitPrice': 10}],
            'shipping': {
                'fullName': 'Test Buyer Production',
                'email': 'testbuyer@example.com',
                'line1': '123 Ala Moana Blvd',
                'city': 'Honolulu',
                'state': 'HI',
                'postalCode': '96813',
                'country': 'US'
            },
            'deliveryMethod': 'pickup'
        }
        
        response = requests.post(url, json=body, timeout=30)
        
        if response.status_code != 201:
            print_test_result("POST create-order returns 201", False, f"Got {response.status_code}: {response.text[:200]}")
            all_passed = False
        else:
            print_test_result("POST create-order returns 201", True)
            
            data = response.json()
            
            # orderNumber present and increasing
            order_number = data.get('orderNumber')
            order_number_ok = order_number is not None and order_number >= 108
            print_test_result("orderNumber present and >= 108", order_number_ok, f"Got: {order_number}")
            all_passed = all_passed and order_number_ok
            
            # orderID present (PayPal LIVE order)
            order_id = data.get('orderID')
            order_id_ok = order_id is not None and len(order_id) > 0
            print_test_result("orderID present (PayPal LIVE)", order_id_ok, f"Got: {order_id}")
            all_passed = all_passed and order_id_ok
            
            # totals present
            totals = data.get('totals', {})
            totals_ok = totals.get('total') is not None
            print_test_result("totals present", totals_ok, f"total: ${totals.get('total')}")
            all_passed = all_passed and totals_ok
    
    except Exception as e:
        print_test_result("POST create-order", False, f"Exception: {e}")
        all_passed = False
    
    # Test 3.3: POST /api/cart/validate with tampered unitPrice
    print("\n[Test 3.3] POST /api/cart/validate with tampered unitPrice")
    
    try:
        url = f"{BASE_URL}/api/cart/validate"
        body = {
            'items': [
                {'sheetId': '14x36', 'quantity': 2, 'unitPrice': 9999}  # Tampered price
            ]
        }
        
        response = requests.post(url, json=body, timeout=30)
        
        if response.status_code != 200:
            print_test_result("POST cart/validate returns 200", False, f"Got {response.status_code}")
            all_passed = False
        else:
            print_test_result("POST cart/validate returns 200", True)
            
            data = response.json()
            items = data.get('items', [])
            
            if items:
                corrected_price = items[0].get('unitPrice')
                # 14x36 should be $18
                price_corrected = corrected_price == 18
                print_test_result("unitPrice corrected from 9999 to 18", price_corrected, f"Got: {corrected_price}")
                all_passed = all_passed and price_corrected
                
                subtotal = data.get('subtotal')
                subtotal_ok = subtotal == 36  # 2 × $18
                print_test_result("subtotal: 36 (2 × $18)", subtotal_ok, f"Got: {subtotal}")
                all_passed = all_passed and subtotal_ok
            else:
                print_test_result("items array not empty", False)
                all_passed = False
    
    except Exception as e:
        print_test_result("POST cart/validate", False, f"Exception: {e}")
        all_passed = False
    
    return all_passed

# ============================================================================
# Main test runner
# ============================================================================

def main():
    print("\n" + "="*80)
    print("  PRODUCTION BACKEND VERIFICATION")
    print("  Base URL: https://www.nevermoredtf.com")
    print("  Testing: Sharp Re-render + Resend Bug + Regression")
    print("="*80)
    
    results = {}
    
    # Run all test suites
    results['FIX #1: Sharp Re-render'] = test_fix1_sharp_rerender()
    results['FIX #2: Resend Bug'] = test_fix2_resend_bug()
    results['FIX #3: Regression'] = test_fix3_regression()
    
    # Summary
    print_test_header("SUMMARY")
    
    all_passed = True
    for suite_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} | {suite_name}")
        all_passed = all_passed and passed
    
    print("\n" + "="*80)
    if all_passed:
        print("  ✅ ALL TESTS PASSED")
    else:
        print("  ❌ SOME TESTS FAILED")
    print("="*80 + "\n")
    
    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())
