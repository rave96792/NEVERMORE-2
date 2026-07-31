#!/usr/bin/env python3
"""
Backend test for rush production upcharge feature on PRODUCTION
Tests against https://www.nevermoredtf.com
"""

import requests
import json
from typing import Dict, Any

BASE_URL = "https://www.nevermoredtf.com"
ADMIN_TOKEN = "nevermore-admin-2026-XvT9pWq3Rz1KcJ7bH2Fs4Ye8Da5Nh6Uk"

def test_create_order_rush_hi_ship():
    """Test Case A: Rush + HI ship"""
    print("\n=== TEST CASE A: Rush + HI ship ===")
    
    payload = {
        "items": [{"sheetId": "14x12", "quantity": 1}],
        "shipping": {
            "fullName": "Test Buyer",
            "email": "nevermoreprintingcompany@yahoo.com",
            "line1": "1 Ala Moana",
            "city": "Honolulu",
            "state": "HI",
            "postalCode": "96813",
            "country": "US"
        },
        "deliveryMethod": "ship",
        "rush": True
    }
    
    response = requests.post(f"{BASE_URL}/api/paypal/create-order", json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code != 201:
        print(f"❌ FAILED: Expected 201, got {response.status_code}")
        print(f"Response: {response.text}")
        return None
    
    data = response.json()
    totals = data.get("totals", {})
    
    print(f"Totals: {json.dumps(totals, indent=2)}")
    
    # Expected: subtotal=10, shipping=5, rushFee=30, tax=2.12, total=47.12, rush=true, taxState="HI"
    expected = {
        "subtotal": 10,
        "shipping": 5,
        "rushFee": 30,
        "tax": 2.12,
        "total": 47.12,
        "rush": True,
        "taxState": "HI"
    }
    
    passed = True
    for key, expected_val in expected.items():
        actual_val = totals.get(key)
        if actual_val != expected_val:
            print(f"❌ {key}: expected {expected_val}, got {actual_val}")
            passed = False
        else:
            print(f"✓ {key}: {actual_val}")
    
    if passed:
        print("✅ TEST CASE A PASSED")
        # Verify persisted order
        internal_order_id = data.get("internalOrderId")
        if internal_order_id:
            verify_persisted_order(internal_order_id, expected_rush=True, expected_rush_fee=30, expected_total=47.12)
        return data
    else:
        print("❌ TEST CASE A FAILED")
        return None


def test_create_order_rush_pickup():
    """Test Case B: Rush + pickup"""
    print("\n=== TEST CASE B: Rush + pickup ===")
    
    payload = {
        "items": [{"sheetId": "14x12", "quantity": 1}],
        "shipping": {
            "fullName": "Test Buyer",
            "email": "nevermoreprintingcompany@yahoo.com",
            "phone": "808-555-0100"
        },
        "deliveryMethod": "pickup",
        "rush": True
    }
    
    response = requests.post(f"{BASE_URL}/api/paypal/create-order", json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code != 201:
        print(f"❌ FAILED: Expected 201, got {response.status_code}")
        print(f"Response: {response.text}")
        return None
    
    data = response.json()
    totals = data.get("totals", {})
    
    print(f"Totals: {json.dumps(totals, indent=2)}")
    
    # Expected: subtotal=10, shipping=0, rushFee=30, tax=1.88, total=41.88, rush=true
    expected = {
        "subtotal": 10,
        "shipping": 0,
        "rushFee": 30,
        "tax": 1.88,
        "total": 41.88,
        "rush": True
    }
    
    passed = True
    for key, expected_val in expected.items():
        actual_val = totals.get(key)
        if actual_val != expected_val:
            print(f"❌ {key}: expected {expected_val}, got {actual_val}")
            passed = False
        else:
            print(f"✓ {key}: {actual_val}")
    
    if passed:
        print("✅ TEST CASE B PASSED")
        # Verify persisted order
        internal_order_id = data.get("internalOrderId")
        if internal_order_id:
            verify_persisted_order(internal_order_id, expected_rush=True, expected_rush_fee=30, expected_total=41.88)
        return data
    else:
        print("❌ TEST CASE B FAILED")
        return None


def test_create_order_non_rush_pickup():
    """Test Case C: Non-rush pickup (regression)"""
    print("\n=== TEST CASE C: Non-rush pickup (regression) ===")
    
    payload = {
        "items": [{"sheetId": "14x12", "quantity": 1}],
        "shipping": {
            "fullName": "Test Buyer",
            "email": "nevermoreprintingcompany@yahoo.com",
            "phone": "808-555-0100"
        },
        "deliveryMethod": "pickup",
        "rush": False
    }
    
    response = requests.post(f"{BASE_URL}/api/paypal/create-order", json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code != 201:
        print(f"❌ FAILED: Expected 201, got {response.status_code}")
        print(f"Response: {response.text}")
        return None
    
    data = response.json()
    totals = data.get("totals", {})
    
    print(f"Totals: {json.dumps(totals, indent=2)}")
    
    # Expected: rushFee=0, rush=false, total=10.47
    expected = {
        "subtotal": 10,
        "shipping": 0,
        "rushFee": 0,
        "tax": 0.47,
        "total": 10.47,
        "rush": False
    }
    
    passed = True
    for key, expected_val in expected.items():
        actual_val = totals.get(key)
        if actual_val != expected_val:
            print(f"❌ {key}: expected {expected_val}, got {actual_val}")
            passed = False
        else:
            print(f"✓ {key}: {actual_val}")
    
    if passed:
        print("✅ TEST CASE C PASSED")
        # Verify persisted order
        internal_order_id = data.get("internalOrderId")
        if internal_order_id:
            verify_persisted_order(internal_order_id, expected_rush=False, expected_rush_fee=0, expected_total=10.47)
        return data
    else:
        print("❌ TEST CASE C FAILED")
        return None


def test_create_order_ca_ship_rush():
    """Test Case D: CA ship + rush (out-of-state)"""
    print("\n=== TEST CASE D: CA ship + rush (out-of-state) ===")
    
    payload = {
        "items": [{"sheetId": "14x24", "quantity": 2}],
        "shipping": {
            "fullName": "Test Buyer",
            "email": "nevermoreprintingcompany@yahoo.com",
            "line1": "123 Main St",
            "city": "Los Angeles",
            "state": "CA",
            "postalCode": "90001",
            "country": "US"
        },
        "deliveryMethod": "ship",
        "rush": True
    }
    
    response = requests.post(f"{BASE_URL}/api/paypal/create-order", json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code != 201:
        print(f"❌ FAILED: Expected 201, got {response.status_code}")
        print(f"Response: {response.text}")
        return None
    
    data = response.json()
    totals = data.get("totals", {})
    
    print(f"Totals: {json.dumps(totals, indent=2)}")
    
    # Expected: subtotal=28, shipping=12, rushFee=30, tax=0, total=70.00, rush=true, taxState="CA"
    expected = {
        "subtotal": 28,
        "shipping": 12,
        "rushFee": 30,
        "tax": 0,
        "total": 70.00,
        "rush": True,
        "taxState": "CA"
    }
    
    passed = True
    for key, expected_val in expected.items():
        actual_val = totals.get(key)
        if actual_val != expected_val:
            print(f"❌ {key}: expected {expected_val}, got {actual_val}")
            passed = False
        else:
            print(f"✓ {key}: {actual_val}")
    
    if passed:
        print("✅ TEST CASE D PASSED")
        # Verify persisted order
        internal_order_id = data.get("internalOrderId")
        if internal_order_id:
            verify_persisted_order(internal_order_id, expected_rush=True, expected_rush_fee=30, expected_total=70.00)
        return data
    else:
        print("❌ TEST CASE D FAILED")
        return None


def test_create_order_backwards_compat():
    """Test Case E: Backwards compat (no rush field)"""
    print("\n=== TEST CASE E: Backwards compat (no rush field) ===")
    
    payload = {
        "items": [{"sheetId": "14x12", "quantity": 1}],
        "shipping": {
            "fullName": "Test Buyer",
            "email": "nevermoreprintingcompany@yahoo.com",
            "line1": "1 Ala Moana",
            "city": "Honolulu",
            "state": "HI",
            "postalCode": "96813",
            "country": "US"
        },
        "deliveryMethod": "ship"
        # NO rush field
    }
    
    response = requests.post(f"{BASE_URL}/api/paypal/create-order", json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code != 201:
        print(f"❌ FAILED: Expected 201, got {response.status_code}")
        print(f"Response: {response.text}")
        return None
    
    data = response.json()
    totals = data.get("totals", {})
    
    print(f"Totals: {json.dumps(totals, indent=2)}")
    
    # Expected: rushFee=0 or undefined, rush=false or undefined, tax calc treats rush as $0
    # Total should be 10 + 5 + (10+5)*0.04712 = 15.71
    rush_fee = totals.get("rushFee", 0)
    rush = totals.get("rush", False)
    
    if rush_fee not in [0, None]:
        print(f"❌ rushFee: expected 0 or undefined, got {rush_fee}")
        print("❌ TEST CASE E FAILED")
        return None
    
    if rush not in [False, None]:
        print(f"❌ rush: expected false or undefined, got {rush}")
        print("❌ TEST CASE E FAILED")
        return None
    
    # Tax should be calculated without rush fee
    expected_tax = round((10 + 5) * 0.04712, 2)
    actual_tax = totals.get("tax")
    
    if actual_tax != expected_tax:
        print(f"❌ tax: expected {expected_tax}, got {actual_tax}")
        print("❌ TEST CASE E FAILED")
        return None
    
    print(f"✓ rushFee: {rush_fee} (0 or undefined)")
    print(f"✓ rush: {rush} (false or undefined)")
    print(f"✓ tax: {actual_tax} (calculated without rush)")
    print("✅ TEST CASE E PASSED")
    
    # Verify persisted order
    internal_order_id = data.get("internalOrderId")
    if internal_order_id:
        verify_persisted_order(internal_order_id, expected_rush=False, expected_rush_fee=0, expected_total=totals.get("total"))
    
    return data


def verify_persisted_order(order_id: str, expected_rush: bool, expected_rush_fee: float, expected_total: float):
    """Verify the persisted order document"""
    print(f"\n  → Verifying persisted order {order_id}")
    
    response = requests.get(f"{BASE_URL}/api/orders/{order_id}")
    
    if response.status_code != 200:
        print(f"  ❌ Failed to fetch order: {response.status_code}")
        return
    
    order = response.json()
    
    # Check rush field
    actual_rush = order.get("rush", False)
    if actual_rush != expected_rush:
        print(f"  ❌ rush: expected {expected_rush}, got {actual_rush}")
    else:
        print(f"  ✓ rush: {actual_rush}")
    
    # Check rushFee field
    actual_rush_fee = order.get("rushFee", 0)
    if actual_rush_fee != expected_rush_fee:
        print(f"  ❌ rushFee: expected {expected_rush_fee}, got {actual_rush_fee}")
    else:
        print(f"  ✓ rushFee: {actual_rush_fee}")
    
    # Check total
    actual_total = order.get("total")
    if actual_total != expected_total:
        print(f"  ❌ total: expected {expected_total}, got {actual_total}")
    else:
        print(f"  ✓ total: {actual_total}")


def test_cart_validate_rush():
    """Feature 2: POST /api/cart/validate accepts rush"""
    print("\n=== FEATURE 2: POST /api/cart/validate with rush ===")
    
    payload = {
        "items": [{"sheetId": "14x12", "quantity": 1, "unitPrice": 9999}],
        "shipping": {"state": "HI", "country": "US"},
        "deliveryMethod": "pickup",
        "rush": True
    }
    
    response = requests.post(f"{BASE_URL}/api/cart/validate", json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    # Expected: total=41.88 (proves it recomputes and includes rush)
    expected_total = 41.88
    actual_total = data.get("total")
    
    if actual_total != expected_total:
        print(f"❌ total: expected {expected_total}, got {actual_total}")
        print("❌ FEATURE 2 FAILED")
        return False
    
    print(f"✓ total: {actual_total} (includes rush fee)")
    print("✅ FEATURE 2 PASSED")
    return True


def test_regression_health():
    """Regression: GET /api/health"""
    print("\n=== REGRESSION: GET /api/health ===")
    
    response = requests.get(f"{BASE_URL}/api/health")
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    # Check mongo.ok=true
    mongo_ok = data.get("checks", {}).get("mongo", {}).get("ok")
    if mongo_ok != True:
        print(f"❌ mongo.ok: expected true, got {mongo_ok}")
        return False
    print(f"✓ mongo.ok: {mongo_ok}")
    
    # Check paypal.ok=true
    paypal_ok = data.get("checks", {}).get("paypal", {}).get("ok")
    if paypal_ok != True:
        print(f"❌ paypal.ok: expected true, got {paypal_ok}")
        return False
    print(f"✓ paypal.ok: {paypal_ok}")
    
    # Check paypal.base=api-m.paypal.com
    paypal_base = data.get("checks", {}).get("paypal", {}).get("base")
    if "api-m.paypal.com" not in paypal_base:
        print(f"❌ paypal.base: expected api-m.paypal.com, got {paypal_base}")
        return False
    print(f"✓ paypal.base: {paypal_base}")
    
    # Check PAYPAL_ENV='live'
    paypal_env = data.get("checks", {}).get("env", {}).get("PAYPAL_ENV")
    if paypal_env != "live":
        print(f"❌ PAYPAL_ENV: expected 'live', got {paypal_env}")
        return False
    print(f"✓ PAYPAL_ENV: {paypal_env}")
    
    print("✅ REGRESSION: /api/health PASSED")
    return True


def test_regression_cart_validate_tampered():
    """Regression: POST /api/cart/validate with tampered unitPrice"""
    print("\n=== REGRESSION: POST /api/cart/validate with tampered price ===")
    
    payload = {
        "items": [{"sheetId": "14x36", "quantity": 2, "unitPrice": 9999}],
        "shipping": {"state": "HI", "country": "US"},
        "deliveryMethod": "pickup"
    }
    
    response = requests.post(f"{BASE_URL}/api/cart/validate", json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    # Check that unitPrice was recomputed to 18
    items = data.get("items", [])
    if not items:
        print("❌ No items in response")
        return False
    
    actual_unit_price = items[0].get("unitPrice")
    if actual_unit_price != 18:
        print(f"❌ unitPrice: expected 18, got {actual_unit_price}")
        return False
    
    print(f"✓ unitPrice recomputed: {actual_unit_price}")
    print("✅ REGRESSION: cart/validate tampered price PASSED")
    return True


def test_regression_admin_status():
    """Regression: POST /api/orders/[id]/status with admin token"""
    print("\n=== REGRESSION: POST /api/orders/[id]/status ===")
    
    # Use order 121 or 122 as mentioned in the review request
    # First, let's try to find a recent order
    # We'll use one of the orders we just created
    
    # Create a test order first
    payload = {
        "items": [{"sheetId": "14x12", "quantity": 1}],
        "shipping": {
            "fullName": "Test",
            "email": "nevermoreprintingcompany@yahoo.com",
            "phone": "808-555-0100"
        },
        "deliveryMethod": "pickup",
        "rush": False
    }
    
    create_response = requests.post(f"{BASE_URL}/api/paypal/create-order", json=payload)
    if create_response.status_code != 201:
        print(f"❌ Failed to create test order: {create_response.status_code}")
        return False
    
    order_id = create_response.json().get("internalOrderId")
    print(f"Created test order: {order_id}")
    
    # Now update status
    headers = {"x-admin-token": ADMIN_TOKEN}
    status_payload = {"status": "PROCESSING"}
    
    response = requests.post(
        f"{BASE_URL}/api/orders/{order_id}/status",
        json=status_payload,
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    
    # Check ok=true
    if data.get("ok") != True:
        print(f"❌ ok: expected true, got {data.get('ok')}")
        return False
    print(f"✓ ok: {data.get('ok')}")
    
    # Check email.ok=true
    email_ok = data.get("email", {}).get("ok")
    if email_ok != True:
        print(f"❌ email.ok: expected true, got {email_ok}")
        return False
    print(f"✓ email.ok: {email_ok}")
    
    print("✅ REGRESSION: admin status update PASSED")
    return True


def main():
    print("=" * 80)
    print("RUSH PRODUCTION UPCHARGE FEATURE VERIFICATION")
    print("Testing against: https://www.nevermoredtf.com")
    print("=" * 80)
    
    results = {
        "Feature 1 - Test Case A (Rush + HI ship)": False,
        "Feature 1 - Test Case B (Rush + pickup)": False,
        "Feature 1 - Test Case C (Non-rush pickup)": False,
        "Feature 1 - Test Case D (CA ship + rush)": False,
        "Feature 1 - Test Case E (Backwards compat)": False,
        "Feature 2 - cart/validate with rush": False,
        "Regression - /api/health": False,
        "Regression - cart/validate tampered": False,
        "Regression - admin status": False
    }
    
    # Feature 1: Rush production upcharge
    if test_create_order_rush_hi_ship():
        results["Feature 1 - Test Case A (Rush + HI ship)"] = True
    
    if test_create_order_rush_pickup():
        results["Feature 1 - Test Case B (Rush + pickup)"] = True
    
    if test_create_order_non_rush_pickup():
        results["Feature 1 - Test Case C (Non-rush pickup)"] = True
    
    if test_create_order_ca_ship_rush():
        results["Feature 1 - Test Case D (CA ship + rush)"] = True
    
    if test_create_order_backwards_compat():
        results["Feature 1 - Test Case E (Backwards compat)"] = True
    
    # Feature 2: cart/validate with rush
    if test_cart_validate_rush():
        results["Feature 2 - cart/validate with rush"] = True
    
    # Regression tests
    if test_regression_health():
        results["Regression - /api/health"] = True
    
    if test_regression_cart_validate_tampered():
        results["Regression - cart/validate tampered"] = True
    
    if test_regression_admin_status():
        results["Regression - admin status"] = True
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("\n" + "=" * 80)
    print(f"TOTAL: {passed} passed, {failed} failed out of {passed + failed} tests")
    print("=" * 80)
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
