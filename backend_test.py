#!/usr/bin/env python3
"""
Backend API test suite for Nevermore DTF
Tests the two NEW endpoints + quick regression
"""
import requests
import json
import os
import sys

BASE_URL = "http://localhost:3000/api"
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "nvm_7D5LacmJbKHsr7u7rhERWyyYTWyw4cOV")

# Test results tracking
results = []

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    results.append({"name": name, "passed": passed, "details": details})
    print(f"{status} | {name}")
    if details:
        print(f"    {details}")

def test_task1_sequential_order_number_and_shipping():
    """
    TASK 1: Sequential orderNumber + region-based shipping
    - Test POST /api/paypal/create-order
    - HI: $5 shipping, 4.712% tax
    - CA: $12 shipping, $0 tax
    - orderNumber must be >= 100 and STRICTLY INCREASING
    """
    print("\n" + "="*80)
    print("TASK 1: Sequential orderNumber + region-based shipping")
    print("="*80)
    
    order_numbers = []
    hi_internal_order_id = None
    
    # Payload A: Hawaii (should get $5 shipping and 4.712% tax)
    payload_hi = {
        "items": [{"sheetId": "14x36", "quantity": 1}],
        "shipping": {
            "fullName": "HI Buyer",
            "email": "buyer+hi@example.com",
            "line1": "123 Ala Moana Blvd",
            "city": "Honolulu",
            "state": "HI",
            "postalCode": "96813",
            "country": "US"
        }
    }
    
    # Payload B: California (should get $12 shipping and $0 tax)
    payload_ca = {
        "items": [{"sheetId": "14x24", "quantity": 2}],
        "shipping": {
            "fullName": "CA Buyer",
            "email": "buyer+ca@example.com",
            "line1": "1 Market St",
            "city": "Los Angeles",
            "state": "CA",
            "postalCode": "90001",
            "country": "US"
        }
    }
    
    # Call each payload 2× (total 4 calls)
    test_cases = [
        ("HI-1", payload_hi, 5, 0.04712, "HI"),
        ("CA-1", payload_ca, 12, 0, "CA"),
        ("HI-2", payload_hi, 5, 0.04712, "HI"),
        ("CA-2", payload_ca, 12, 0, "CA"),
    ]
    
    for label, payload, expected_shipping, expected_tax_rate, expected_tax_state in test_cases:
        try:
            resp = requests.post(f"{BASE_URL}/paypal/create-order", json=payload, timeout=10)
            
            # Check HTTP 201
            if resp.status_code != 201:
                log_test(f"Task1.{label}: HTTP 201", False, f"Got {resp.status_code}: {resp.text[:200]}")
                continue
            
            data = resp.json()
            
            # Check response structure
            required_fields = ["orderID", "internalOrderId", "orderNumber", "totals"]
            missing = [f for f in required_fields if f not in data]
            if missing:
                log_test(f"Task1.{label}: Response structure", False, f"Missing fields: {missing}")
                continue
            
            log_test(f"Task1.{label}: HTTP 201 + structure", True, f"orderNumber={data['orderNumber']}")
            
            # Check orderNumber >= 100
            order_num = data["orderNumber"]
            if not isinstance(order_num, int) or order_num < 100:
                log_test(f"Task1.{label}: orderNumber >= 100", False, f"Got {order_num}")
            else:
                log_test(f"Task1.{label}: orderNumber >= 100", True, f"{order_num}")
            
            order_numbers.append(order_num)
            
            # Check shipping amount
            totals = data["totals"]
            if totals.get("shipping") == expected_shipping:
                log_test(f"Task1.{label}: shipping=${expected_shipping}", True)
            else:
                log_test(f"Task1.{label}: shipping=${expected_shipping}", False, 
                        f"Got ${totals.get('shipping')}")
            
            # Check tax
            if expected_tax_rate > 0:
                # HI: should have tax
                actual_tax_rate = totals.get("taxRate", 0)
                if abs(actual_tax_rate - expected_tax_rate) < 0.0001:
                    log_test(f"Task1.{label}: taxRate≈{expected_tax_rate}", True)
                else:
                    log_test(f"Task1.{label}: taxRate≈{expected_tax_rate}", False, 
                            f"Got {actual_tax_rate}")
                
                if totals.get("taxState") == expected_tax_state:
                    log_test(f"Task1.{label}: taxState={expected_tax_state}", True)
                else:
                    log_test(f"Task1.{label}: taxState={expected_tax_state}", False, 
                            f"Got {totals.get('taxState')}")
                
                if totals.get("tax", 0) > 0:
                    log_test(f"Task1.{label}: tax > 0", True, f"tax=${totals.get('tax')}")
                else:
                    log_test(f"Task1.{label}: tax > 0", False, f"Got ${totals.get('tax')}")
            else:
                # CA: should have $0 tax
                if totals.get("tax") == 0:
                    log_test(f"Task1.{label}: tax=$0", True)
                else:
                    log_test(f"Task1.{label}: tax=$0", False, f"Got ${totals.get('tax')}")
                
                if totals.get("taxState") == expected_tax_state:
                    log_test(f"Task1.{label}: taxState={expected_tax_state}", True)
                else:
                    log_test(f"Task1.{label}: taxState={expected_tax_state}", False, 
                            f"Got {totals.get('taxState')}")
            
            # Save last HI internalOrderId for Task 2
            if label.startswith("HI"):
                hi_internal_order_id = data["internalOrderId"]
        
        except Exception as e:
            log_test(f"Task1.{label}: Request", False, f"Exception: {str(e)}")
    
    # Check STRICTLY INCREASING orderNumber
    if len(order_numbers) == 4:
        is_increasing = all(order_numbers[i] < order_numbers[i+1] for i in range(3))
        if is_increasing:
            log_test("Task1: orderNumber STRICTLY INCREASING", True, 
                    f"Sequence: {order_numbers}")
        else:
            log_test("Task1: orderNumber STRICTLY INCREASING", False, 
                    f"Sequence: {order_numbers}")
    
    # Test invalid payloads (should return 400, NOT 500 or 503)
    print("\n--- Invalid payload tests ---")
    
    invalid_cases = [
        ("empty items", {"items": [], "shipping": payload_hi["shipping"]}),
        ("bad email", {"items": [{"sheetId": "14x36", "quantity": 1}], 
                      "shipping": {**payload_hi["shipping"], "email": "not-an-email"}}),
        ("unknown sheetId", {"items": [{"sheetId": "99x99", "quantity": 1}], 
                            "shipping": payload_hi["shipping"]}),
    ]
    
    for label, payload in invalid_cases:
        try:
            resp = requests.post(f"{BASE_URL}/paypal/create-order", json=payload, timeout=10)
            if resp.status_code == 400:
                log_test(f"Task1.Invalid: {label} → 400", True)
            else:
                log_test(f"Task1.Invalid: {label} → 400", False, 
                        f"Got {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            log_test(f"Task1.Invalid: {label}", False, f"Exception: {str(e)}")
    
    return hi_internal_order_id


def test_task2_admin_order_status(order_id):
    """
    TASK 2: Admin order status transitions + status emails
    - POST /api/orders/:id/status
    - Test auth, invalid status, valid transitions
    """
    print("\n" + "="*80)
    print("TASK 2: Admin order status transitions + status emails")
    print("="*80)
    
    if not order_id:
        log_test("Task2: SKIPPED", False, "No order_id from Task 1")
        return
    
    print(f"Using order ID: {order_id}")
    
    # (a) No token → 401
    try:
        resp = requests.post(f"{BASE_URL}/orders/{order_id}/status", 
                           json={"status": "PROCESSING"}, timeout=10)
        if resp.status_code == 401:
            log_test("Task2.a: No token → 401", True)
        else:
            log_test("Task2.a: No token → 401", False, 
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("Task2.a: No token → 401", False, f"Exception: {str(e)}")
    
    # (b) Wrong token → 401
    try:
        resp = requests.post(f"{BASE_URL}/orders/{order_id}/status",
                           headers={"x-admin-token": "wrong-token"},
                           json={"status": "PROCESSING"}, timeout=10)
        if resp.status_code == 401:
            log_test("Task2.b: Wrong token → 401", True)
        else:
            log_test("Task2.b: Wrong token → 401", False, 
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("Task2.b: Wrong token → 401", False, f"Exception: {str(e)}")
    
    # (c) Invalid status CANCELLED → 400
    try:
        resp = requests.post(f"{BASE_URL}/orders/{order_id}/status",
                           headers={"x-admin-token": ADMIN_TOKEN},
                           json={"status": "CANCELLED"}, timeout=10)
        if resp.status_code == 400:
            log_test("Task2.c: CANCELLED → 400", True)
        else:
            log_test("Task2.c: CANCELLED → 400", False, 
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("Task2.c: CANCELLED → 400", False, f"Exception: {str(e)}")
    
    # (d) PROCESSING → 200
    try:
        resp = requests.post(f"{BASE_URL}/orders/{order_id}/status",
                           headers={"x-admin-token": ADMIN_TOKEN},
                           json={"status": "PROCESSING"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("status") == "PROCESSING" and "email" in data:
                log_test("Task2.d: PROCESSING → 200", True, 
                        f"email.ok={data['email'].get('ok')} (may be false for example.com)")
            else:
                log_test("Task2.d: PROCESSING → 200", False, 
                        f"Response structure issue: {json.dumps(data)[:200]}")
        else:
            log_test("Task2.d: PROCESSING → 200", False, 
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("Task2.d: PROCESSING → 200", False, f"Exception: {str(e)}")
    
    # (e) SHIPPED with tracking → 200
    try:
        resp = requests.post(f"{BASE_URL}/orders/{order_id}/status",
                           headers={"x-admin-token": ADMIN_TOKEN},
                           json={
                               "status": "SHIPPED",
                               "trackingNumber": "1Z999AA10123456784",
                               "carrier": "UPS"
                           }, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            log_test("Task2.e: SHIPPED → 200", True)
            
            # Verify order doc updated
            try:
                get_resp = requests.get(f"{BASE_URL}/orders/{order_id}", timeout=10)
                if get_resp.status_code == 200:
                    order_doc = get_resp.json()
                    if (order_doc.get("status") == "SHIPPED" and 
                        order_doc.get("trackingNumber") == "1Z999AA10123456784" and
                        order_doc.get("carrier") == "UPS"):
                        log_test("Task2.e: Order doc updated", True)
                    else:
                        log_test("Task2.e: Order doc updated", False, 
                                f"status={order_doc.get('status')}, tracking={order_doc.get('trackingNumber')}")
                else:
                    log_test("Task2.e: GET order", False, f"Got {get_resp.status_code}")
            except Exception as e:
                log_test("Task2.e: GET order", False, f"Exception: {str(e)}")
        else:
            log_test("Task2.e: SHIPPED → 200", False, 
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("Task2.e: SHIPPED → 200", False, f"Exception: {str(e)}")
    
    # (f) Non-existent order → 404
    try:
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = requests.post(f"{BASE_URL}/orders/{fake_id}/status",
                           headers={"x-admin-token": ADMIN_TOKEN},
                           json={"status": "PROCESSING"}, timeout=10)
        if resp.status_code == 404:
            log_test("Task2.f: Non-existent order → 404", True)
        else:
            log_test("Task2.f: Non-existent order → 404", False, 
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("Task2.f: Non-existent order → 404", False, f"Exception: {str(e)}")


def test_task3_regression():
    """
    TASK 3: Quick regression (must still work)
    - GET /api/pricing → 200 with 9 sheets
    - POST /api/pricing/quote → 200
    - POST /api/cart/validate → 200
    - GET /api/health → 200
    """
    print("\n" + "="*80)
    print("TASK 3: Quick regression")
    print("="*80)
    
    # GET /api/pricing
    try:
        resp = requests.get(f"{BASE_URL}/pricing", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            sheets = data.get("sheets", [])
            if len(sheets) == 9:
                log_test("Task3: GET /api/pricing → 9 sheets", True)
            else:
                log_test("Task3: GET /api/pricing → 9 sheets", False, 
                        f"Got {len(sheets)} sheets")
        else:
            log_test("Task3: GET /api/pricing", False, 
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("Task3: GET /api/pricing", False, f"Exception: {str(e)}")
    
    # POST /api/pricing/quote
    try:
        resp = requests.post(f"{BASE_URL}/pricing/quote", 
                           json={"sheetId": "14x60"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("unitPrice") == 26:
                log_test("Task3: POST /api/pricing/quote → unitPrice=26", True)
            else:
                log_test("Task3: POST /api/pricing/quote → unitPrice=26", False, 
                        f"Got unitPrice={data.get('unitPrice')}")
        else:
            log_test("Task3: POST /api/pricing/quote", False, 
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("Task3: POST /api/pricing/quote", False, f"Exception: {str(e)}")
    
    # POST /api/cart/validate with tampered unitPrice
    try:
        resp = requests.post(f"{BASE_URL}/cart/validate",
                           json={
                               "items": [{
                                   "sheetId": "14x36",
                                   "quantity": 1,
                                   "unitPrice": 9999  # tampered
                               }]
                           }, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("items", [])
            if items and items[0].get("unitPrice") == 18:
                log_test("Task3: POST /api/cart/validate → unitPrice recomputed", True, 
                        "9999 → 18")
            else:
                log_test("Task3: POST /api/cart/validate → unitPrice recomputed", False, 
                        f"Got unitPrice={items[0].get('unitPrice') if items else 'N/A'}")
        else:
            log_test("Task3: POST /api/cart/validate", False, 
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("Task3: POST /api/cart/validate", False, f"Exception: {str(e)}")
    
    # GET /api/health
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        if resp.status_code in [200, 503]:  # Either is acceptable
            data = resp.json()
            checks = data.get("checks", {})
            mongo_ok = checks.get("mongo", {}).get("ok", False)
            paypal_ok = checks.get("paypal", {}).get("ok", False)
            
            if mongo_ok and paypal_ok:
                log_test("Task3: GET /api/health → mongo.ok=true, paypal.ok=true", True)
            else:
                log_test("Task3: GET /api/health → mongo.ok=true, paypal.ok=true", False, 
                        f"mongo.ok={mongo_ok}, paypal.ok={paypal_ok}")
        else:
            log_test("Task3: GET /api/health", False, 
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("Task3: GET /api/health", False, f"Exception: {str(e)}")


def print_summary():
    """Print test summary table"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in results if r["passed"])
    failed = sum(1 for r in results if not r["passed"])
    total = len(results)
    
    print(f"\nTotal: {total} | Passed: {passed} | Failed: {failed}")
    print("\nPASS/FAIL TABLE:")
    print("-" * 80)
    
    for r in results:
        status = "✅ PASS" if r["passed"] else "❌ FAIL"
        print(f"{status} | {r['name']}")
        if r["details"] and not r["passed"]:
            print(f"         {r['details']}")
    
    print("-" * 80)
    
    return passed, failed


if __name__ == "__main__":
    print("="*80)
    print("NEVERMORE DTF BACKEND TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin token: {'SET' if ADMIN_TOKEN else 'NOT SET'}")
    print()
    
    # Run tests
    hi_order_id = test_task1_sequential_order_number_and_shipping()
    test_task2_admin_order_status(hi_order_id)
    test_task3_regression()
    
    # Print summary
    passed, failed = print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)
