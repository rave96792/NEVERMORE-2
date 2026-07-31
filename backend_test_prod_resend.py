#!/usr/bin/env python3
"""
Production Resend Email Fix Verification
Tests the Resend email fix on PRODUCTION (https://www.nevermoredtf.com)
"""

import requests
import json

# PRODUCTION configuration
BASE_URL = "https://www.nevermoredtf.com"
ADMIN_TOKEN = "nevermore-admin-2026-XvT9pWq3Rz1KcJ7bH2Fs4Ye8Da5Nh6Uk"  # Production token from test_credentials.md
ORDER_ID = "c034211c-a3dc-4902-82db-a318bc24cddb"  # Real customer order (Justin Madeira)

def print_test_header(test_num, description):
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)

def print_result(passed, message):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")

# TEST 1: Send PROCESSING email to real customer (external recipient)
print_test_header(1, "Send PROCESSING email to real customer (external recipient)")
try:
    url = f"{BASE_URL}/api/orders/{ORDER_ID}/status"
    headers = {"x-admin-token": ADMIN_TOKEN, "Content-Type": "application/json"}
    payload = {"status": "PROCESSING"}
    
    print(f"POST {url}")
    print(f"Headers: x-admin-token: [REDACTED]")
    print(f"Body: {json.dumps(payload)}")
    
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check if email was sent successfully
        if data.get("ok") and data.get("email", {}).get("ok"):
            email_id = data.get("email", {}).get("id")
            print_result(True, f"Email sent successfully to external recipient. Email ID: {email_id}")
        elif data.get("ok") and not data.get("email", {}).get("ok"):
            error = data.get("email", {}).get("error", "Unknown error")
            print_result(False, f"Status updated but email failed: {error}")
        else:
            print_result(False, f"Unexpected response structure: {data}")
    else:
        print(f"Response: {response.text}")
        print_result(False, f"Expected 200, got {response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# TEST 2: /api/email/test regression
print_test_header(2, "/api/email/test regression check")
try:
    url = f"{BASE_URL}/api/email/test"
    
    print(f"POST {url}")
    response = requests.post(url, timeout=30)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        shop_ok = data.get("results", {}).get("shop", {}).get("ok")
        buyer_ok = data.get("results", {}).get("buyer", {}).get("ok")
        
        if shop_ok and buyer_ok:
            shop_id = data.get("results", {}).get("shop", {}).get("id")
            buyer_id = data.get("results", {}).get("buyer", {}).get("id")
            print_result(True, f"Both emails sent. Shop ID: {shop_id}, Buyer ID: {buyer_id}")
        else:
            print_result(False, f"Email test failed. shop.ok={shop_ok}, buyer.ok={buyer_ok}")
    else:
        print(f"Response: {response.text}")
        print_result(False, f"Expected 200, got {response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# TEST 3: /api/health clean (no temporary diagnostic fields)
print_test_header(3, "/api/health clean - no temporary MAIL_FROM_runtime field")
try:
    url = f"{BASE_URL}/api/health"
    
    print(f"GET {url}")
    response = requests.get(url, timeout=30)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check that temporary diagnostic fields are NOT present
        has_mail_from_runtime = "MAIL_FROM_runtime" in data.get("checks", {}).get("env", {})
        has_mail_shop_to_runtime = "MAIL_SHOP_TO_runtime" in data.get("checks", {}).get("env", {})
        
        if not has_mail_from_runtime and not has_mail_shop_to_runtime:
            print_result(True, "Health endpoint clean - no temporary diagnostic fields")
        else:
            fields = []
            if has_mail_from_runtime:
                fields.append("MAIL_FROM_runtime")
            if has_mail_shop_to_runtime:
                fields.append("MAIL_SHOP_TO_runtime")
            print_result(False, f"Temporary diagnostic fields still present: {', '.join(fields)}")
    else:
        print(f"Response: {response.text}")
        print_result(False, f"Expected 200, got {response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# TEST 4: Send SHIPPED email with tracking
print_test_header(4, "Send SHIPPED email with tracking info")
try:
    url = f"{BASE_URL}/api/orders/{ORDER_ID}/status"
    headers = {"x-admin-token": ADMIN_TOKEN, "Content-Type": "application/json"}
    payload = {
        "status": "SHIPPED",
        "trackingNumber": "1Z999AA10123456784",
        "carrier": "USPS"
    }
    
    print(f"POST {url}")
    print(f"Headers: x-admin-token: [REDACTED]")
    print(f"Body: {json.dumps(payload)}")
    
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check if email was sent successfully
        if data.get("ok") and data.get("email", {}).get("ok"):
            email_id = data.get("email", {}).get("id")
            print_result(True, f"SHIPPED email sent successfully. Email ID: {email_id}")
            
            # Now verify the order was updated with tracking info
            print("\nVerifying order was updated with tracking info...")
            get_url = f"{BASE_URL}/api/orders/{ORDER_ID}"
            get_response = requests.get(get_url, timeout=30)
            
            if get_response.status_code == 200:
                order_data = get_response.json()
                tracking_number = order_data.get("trackingNumber")
                carrier = order_data.get("carrier")
                status = order_data.get("status")
                
                print(f"Order status: {status}")
                print(f"Tracking number: {tracking_number}")
                print(f"Carrier: {carrier}")
                
                if tracking_number == "1Z999AA10123456784" and carrier == "USPS" and status == "SHIPPED":
                    print_result(True, "Order updated correctly with tracking info")
                else:
                    print_result(False, f"Order not updated correctly. Expected trackingNumber=1Z999AA10123456784, carrier=USPS, status=SHIPPED")
            else:
                print_result(False, f"Failed to retrieve order. Status: {get_response.status_code}")
                
        elif data.get("ok") and not data.get("email", {}).get("ok"):
            error = data.get("email", {}).get("error", "Unknown error")
            print_result(False, f"Status updated but email failed: {error}")
        else:
            print_result(False, f"Unexpected response structure: {data}")
    else:
        print(f"Response: {response.text}")
        print_result(False, f"Expected 200, got {response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Reset back to PROCESSING
print_test_header("CLEANUP", "Reset order back to PROCESSING")
try:
    url = f"{BASE_URL}/api/orders/{ORDER_ID}/status"
    headers = {"x-admin-token": ADMIN_TOKEN, "Content-Type": "application/json"}
    payload = {"status": "PROCESSING"}
    
    print(f"POST {url}")
    print(f"Body: {json.dumps(payload)}")
    
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if data.get("ok"):
            print_result(True, "Order reset to PROCESSING successfully")
        else:
            print_result(False, f"Failed to reset order: {data}")
    else:
        print(f"Response: {response.text}")
        print_result(False, f"Expected 200, got {response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

print("\n" + "="*80)
print("PRODUCTION RESEND EMAIL FIX VERIFICATION COMPLETE")
print("="*80)
