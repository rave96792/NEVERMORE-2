#!/usr/bin/env python3
"""
Backend test for Resend email fix verification on PRODUCTION
Tests the fix for "You can only send testing emails to your own email address" error
"""

import requests
import json
import sys

# Production base URL
BASE_URL = "https://www.nevermoredtf.com"

# Admin token from /app/.env
ADMIN_TOKEN = "nvm_7D5LacmJbKHsr7u7rhERWyyYTWyw4cOV"

# Real customer order ID (Justin Madeira)
ORDER_ID = "c034211c-a3dc-4902-82db-a318bc24cddb"

def print_test_header(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print('='*80)

def print_result(passed, message):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")
    return passed

def test_1_send_processing_email():
    """TEST 1: Send confirmation email to real customer (Justin Madeira)"""
    print_test_header("TEST 1 - Send PROCESSING email to real customer")
    
    url = f"{BASE_URL}/api/orders/{ORDER_ID}/status"
    headers = {"x-admin-token": ADMIN_TOKEN, "Content-Type": "application/json"}
    body = {"status": "PROCESSING"}
    
    try:
        print(f"POST {url}")
        print(f"Body: {json.dumps(body)}")
        
        response = requests.post(url, headers=headers, json=body, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Response: {response.text}")
            return print_result(False, f"Expected HTTP 200, got {response.status_code}")
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Assert ok: true
        if not data.get("ok"):
            return print_result(False, f"Expected ok:true, got {data.get('ok')}")
        
        # Assert status: "PROCESSING"
        if data.get("status") != "PROCESSING":
            return print_result(False, f"Expected status:'PROCESSING', got {data.get('status')}")
        
        # Assert email.ok: TRUE (was false before the fix)
        email = data.get("email", {})
        if not email.get("ok"):
            error_msg = email.get("error", "No error message")
            return print_result(False, f"Expected email.ok:true, got false. Error: {error_msg}")
        
        # Assert email.id is present (Resend message id)
        if not email.get("id"):
            return print_result(False, f"Expected email.id to be present, got {email.get('id')}")
        
        # Assert email.error is null/undefined
        if email.get("error"):
            return print_result(False, f"Expected email.error to be null, got {email.get('error')}")
        
        print_result(True, f"Email sent successfully to real customer. Resend ID: {email.get('id')}")
        return True
        
    except Exception as e:
        print(f"Exception: {str(e)}")
        return print_result(False, f"Request failed: {str(e)}")

def test_2_email_test_endpoint():
    """TEST 2: /api/email/test still works (self-send regression check)"""
    print_test_header("TEST 2 - /api/email/test regression check")
    
    url = f"{BASE_URL}/api/email/test"
    
    try:
        print(f"POST {url}")
        
        response = requests.post(url, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Response: {response.text}")
            return print_result(False, f"Expected HTTP 200, got {response.status_code}")
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Assert results.shop.ok: true
        shop = data.get("results", {}).get("shop", {})
        if not shop.get("ok"):
            return print_result(False, f"Expected results.shop.ok:true, got {shop.get('ok')}")
        
        # Assert results.shop.id is present
        if not shop.get("id"):
            return print_result(False, f"Expected results.shop.id to be present, got {shop.get('id')}")
        
        # Assert results.buyer.ok: true
        buyer = data.get("results", {}).get("buyer", {})
        if not buyer.get("ok"):
            return print_result(False, f"Expected results.buyer.ok:true, got {buyer.get('ok')}")
        
        # Assert results.buyer.id is present
        if not buyer.get("id"):
            return print_result(False, f"Expected results.buyer.id to be present, got {buyer.get('id')}")
        
        print_result(True, f"Both shop and buyer test emails sent successfully")
        return True
        
    except Exception as e:
        print(f"Exception: {str(e)}")
        return print_result(False, f"Request failed: {str(e)}")

def test_3_health_endpoint():
    """TEST 3: /api/health regression (should be back to normal shape)"""
    print_test_header("TEST 3 - /api/health regression check")
    
    url = f"{BASE_URL}/api/health"
    
    try:
        print(f"GET {url}")
        
        response = requests.get(url, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Response: {response.text}")
            return print_result(False, f"Expected HTTP 200, got {response.status_code}")
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        checks = data.get("checks", {})
        
        # Assert checks.mongo.ok: true
        mongo = checks.get("mongo", {})
        if not mongo.get("ok"):
            return print_result(False, f"Expected checks.mongo.ok:true, got {mongo.get('ok')}")
        
        # Assert checks.paypal.ok: true
        paypal = checks.get("paypal", {})
        if not paypal.get("ok"):
            return print_result(False, f"Expected checks.paypal.ok:true, got {paypal.get('ok')}")
        
        # Assert checks.paypal.base: "https://api-m.paypal.com"
        if paypal.get("base") != "https://api-m.paypal.com":
            return print_result(False, f"Expected checks.paypal.base:'https://api-m.paypal.com', got {paypal.get('base')}")
        
        # Assert checks.env.PAYPAL_ENV: "live"
        env = checks.get("env", {})
        if env.get("PAYPAL_ENV") != "live":
            return print_result(False, f"Expected checks.env.PAYPAL_ENV:'live', got {env.get('PAYPAL_ENV')}")
        
        # Assert checks.env.RESEND_API_KEY: true
        if not env.get("RESEND_API_KEY"):
            return print_result(False, f"Expected checks.env.RESEND_API_KEY:true, got {env.get('RESEND_API_KEY')}")
        
        # Assert checks.env.ADMIN_TOKEN_set: true
        if not env.get("ADMIN_TOKEN_set"):
            return print_result(False, f"Expected checks.env.ADMIN_TOKEN_set:true, got {env.get('ADMIN_TOKEN_set')}")
        
        # Assert checks.env.MONGO_info.host: "nevermoredtf.vseirgo.mongodb.net"
        mongo_info = env.get("MONGO_info", {})
        if mongo_info.get("host") != "nevermoredtf.vseirgo.mongodb.net":
            return print_result(False, f"Expected checks.env.MONGO_info.host:'nevermoredtf.vseirgo.mongodb.net', got {mongo_info.get('host')}")
        
        # Check that temporary MAIL_FROM_runtime and MAIL_SHOP_TO_runtime fields are REMOVED
        if "MAIL_FROM_runtime" in env:
            return print_result(False, f"Expected MAIL_FROM_runtime to be removed, but it's still present: {env.get('MAIL_FROM_runtime')}")
        
        if "MAIL_SHOP_TO_runtime" in env:
            return print_result(False, f"Expected MAIL_SHOP_TO_runtime to be removed, but it's still present: {env.get('MAIL_SHOP_TO_runtime')}")
        
        print_result(True, "Health endpoint returns correct shape, no diagnostic pollution")
        return True
        
    except Exception as e:
        print(f"Exception: {str(e)}")
        return print_result(False, f"Request failed: {str(e)}")

def test_4_shipped_email_and_reset():
    """TEST 4: Change order to SHIPPED, verify email, then reset to PROCESSING"""
    print_test_header("TEST 4 - Send SHIPPED email and verify tracking info")
    
    url = f"{BASE_URL}/api/orders/{ORDER_ID}/status"
    headers = {"x-admin-token": ADMIN_TOKEN, "Content-Type": "application/json"}
    body = {
        "status": "SHIPPED",
        "trackingNumber": "1Z999AA10123456784",
        "carrier": "USPS"
    }
    
    try:
        # Step 1: Change to SHIPPED
        print(f"\nStep 1: Change order to SHIPPED")
        print(f"POST {url}")
        print(f"Body: {json.dumps(body)}")
        
        response = requests.post(url, headers=headers, json=body, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Response: {response.text}")
            return print_result(False, f"Expected HTTP 200, got {response.status_code}")
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Assert ok: true
        if not data.get("ok"):
            return print_result(False, f"Expected ok:true, got {data.get('ok')}")
        
        # Assert status: "SHIPPED"
        if data.get("status") != "SHIPPED":
            return print_result(False, f"Expected status:'SHIPPED', got {data.get('status')}")
        
        # Assert email.ok: true (external recipient reached)
        email = data.get("email", {})
        if not email.get("ok"):
            error_msg = email.get("error", "No error message")
            return print_result(False, f"Expected email.ok:true, got false. Error: {error_msg}")
        
        # Assert email.id is present
        if not email.get("id"):
            return print_result(False, f"Expected email.id to be present, got {email.get('id')}")
        
        print_result(True, f"SHIPPED email sent successfully. Resend ID: {email.get('id')}")
        
        # Step 2: GET the order and verify tracking info
        print(f"\nStep 2: Verify tracking info stored in order")
        get_url = f"{BASE_URL}/api/orders/{ORDER_ID}"
        print(f"GET {get_url}")
        
        get_response = requests.get(get_url, timeout=30)
        print(f"Status: {get_response.status_code}")
        
        if get_response.status_code != 200:
            print(f"Response: {get_response.text}")
            return print_result(False, f"Expected HTTP 200, got {get_response.status_code}")
        
        order_data = get_response.json()
        print(f"Order status: {order_data.get('status')}")
        print(f"Tracking number: {order_data.get('trackingNumber')}")
        print(f"Carrier: {order_data.get('carrier')}")
        
        # Assert trackingNumber is stored
        if order_data.get("trackingNumber") != "1Z999AA10123456784":
            return print_result(False, f"Expected trackingNumber:'1Z999AA10123456784', got {order_data.get('trackingNumber')}")
        
        # Assert carrier is stored
        if order_data.get("carrier") != "USPS":
            return print_result(False, f"Expected carrier:'USPS', got {order_data.get('carrier')}")
        
        print_result(True, "Tracking info stored correctly")
        
        # Step 3: Reset back to PROCESSING
        print(f"\nStep 3: Reset order back to PROCESSING")
        reset_body = {"status": "PROCESSING"}
        print(f"POST {url}")
        print(f"Body: {json.dumps(reset_body)}")
        
        reset_response = requests.post(url, headers=headers, json=reset_body, timeout=30)
        print(f"Status: {reset_response.status_code}")
        
        if reset_response.status_code != 200:
            print(f"Response: {reset_response.text}")
            return print_result(False, f"Expected HTTP 200, got {reset_response.status_code}")
        
        reset_data = reset_response.json()
        print(f"Response: {json.dumps(reset_data, indent=2)}")
        
        # Assert ok: true
        if not reset_data.get("ok"):
            return print_result(False, f"Expected ok:true, got {reset_data.get('ok')}")
        
        # Assert status: "PROCESSING"
        if reset_data.get("status") != "PROCESSING":
            return print_result(False, f"Expected status:'PROCESSING', got {reset_data.get('status')}")
        
        print_result(True, "Order reset to PROCESSING successfully")
        return True
        
    except Exception as e:
        print(f"Exception: {str(e)}")
        return print_result(False, f"Request failed: {str(e)}")

def main():
    print("\n" + "="*80)
    print("RESEND EMAIL FIX VERIFICATION - PRODUCTION")
    print("Testing against: https://www.nevermoredtf.com")
    print("Order ID: c034211c-a3dc-4902-82db-a318bc24cddb (Justin Madeira)")
    print("="*80)
    
    results = []
    
    # Run all tests
    results.append(("TEST 1: Send PROCESSING email to real customer", test_1_send_processing_email()))
    results.append(("TEST 2: /api/email/test regression check", test_2_email_test_endpoint()))
    results.append(("TEST 3: /api/health regression check", test_3_health_endpoint()))
    results.append(("TEST 4: Send SHIPPED email and reset", test_4_shipped_email_and_reset()))
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Resend email fix verified on production!")
        return 0
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
