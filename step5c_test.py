#!/usr/bin/env python3
"""
STEP 5C Backend Test Suite
Tests the NEW PUT /api/auth/me profile update endpoint + regression checks.
"""

import requests
import json
import random
import string
from typing import Optional

# Backend URL from frontend/.env
BASE_URL = "https://yukticart-audit.preview.emergentagent.com/api"

def random_email():
    """Generate a random email for test shoppers."""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"qa+{rand}@example.com"

def register_shopper(full_name: str, gender: str, mobile: str, password: str) -> dict:
    """Register a new shopper and return {email, password, token, user}."""
    email = random_email()
    payload = {
        "full_name": full_name,
        "gender": gender,
        "mobile": mobile,
        "email": email,
        "password": password
    }
    resp = requests.post(f"{BASE_URL}/auth/register", json=payload)
    if resp.status_code != 200:
        raise Exception(f"Failed to register shopper: {resp.status_code} {resp.text}")
    data = resp.json()
    return {
        "email": email,
        "password": password,
        "token": data.get("access_token"),
        "user": data.get("user")
    }

def headers_with_token(token: Optional[str]) -> dict:
    """Return Authorization header if token provided."""
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}

def print_test(num: int, desc: str):
    """Print test header."""
    print(f"\n{'='*80}")
    print(f"TEST {num}: {desc}")
    print('='*80)

def print_pass(msg: str):
    """Print pass message."""
    print(f"✅ PASS: {msg}")

def print_fail(msg: str):
    """Print fail message."""
    print(f"❌ FAIL: {msg}")

def print_info(msg: str):
    """Print info message."""
    print(f"ℹ️  INFO: {msg}")

# =============================================================================
# TEST SCENARIOS
# =============================================================================

def test_1_register_fresh_shopper():
    """Test 1: Register a fresh shopper and capture access_token."""
    print_test(1, "Register fresh shopper via POST /api/auth/register")
    
    try:
        shopper = register_shopper(
            full_name="QA User",
            gender="female",
            mobile="9123456780",
            password="Shop1234"
        )
        print_pass(f"Registered shopper: {shopper['email']}")
        print_info(f"Access token: {shopper['token'][:20]}...")
        print_info(f"User data: {json.dumps(shopper['user'], indent=2)}")
        return shopper
    except Exception as e:
        print_fail(f"Registration failed: {e}")
        return None

def test_2_get_auth_me(shopper: dict):
    """Test 2: GET /api/auth/me → 200; has email/full_name/roles; NO password_hash."""
    print_test(2, "GET /api/auth/me → verify response structure")
    
    headers = headers_with_token(shopper['token'])
    resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    
    if resp.status_code != 200:
        print_fail(f"GET /api/auth/me → {resp.status_code} (expected 200)")
        return False
    
    print_pass(f"GET /api/auth/me → 200")
    
    data = resp.json()
    print_info(f"Response: {json.dumps(data, indent=2)}")
    
    # Check required fields
    if "email" not in data:
        print_fail("Response missing 'email' field")
        return False
    print_pass("Response has 'email' field")
    
    if "full_name" not in data:
        print_fail("Response missing 'full_name' field")
        return False
    print_pass("Response has 'full_name' field")
    
    if "roles" not in data:
        print_fail("Response missing 'roles' field")
        return False
    print_pass("Response has 'roles' field")
    
    # Check NO password_hash
    if "password_hash" in data:
        print_fail("Response contains 'password_hash' (SECURITY ISSUE)")
        return False
    print_pass("Response does NOT contain 'password_hash' (secure)")
    
    return True

def test_3_update_profile_full(shopper: dict):
    """Test 3: PUT /api/auth/me {full_name, gender, mobile} → 200; verify updates."""
    print_test(3, "PUT /api/auth/me with full_name, gender, mobile")
    
    headers = headers_with_token(shopper['token'])
    payload = {
        "full_name": "QA Updated",
        "gender": "male",
        "mobile": "9876543210"
    }
    
    resp = requests.put(f"{BASE_URL}/auth/me", json=payload, headers=headers)
    
    if resp.status_code != 200:
        print_fail(f"PUT /api/auth/me → {resp.status_code} (expected 200)")
        print_info(f"Response: {resp.text}")
        return False
    
    print_pass(f"PUT /api/auth/me → 200")
    
    data = resp.json()
    print_info(f"Response: {json.dumps(data, indent=2)}")
    
    # Verify updates
    if data.get("full_name") != "QA Updated":
        print_fail(f"full_name not updated: {data.get('full_name')} (expected 'QA Updated')")
        return False
    print_pass("full_name updated to 'QA Updated'")
    
    if data.get("name") != "QA Updated":
        print_fail(f"name not mirrored: {data.get('name')} (expected 'QA Updated')")
        return False
    print_pass("name mirrored to 'QA Updated'")
    
    if data.get("gender") != "male":
        print_fail(f"gender not updated: {data.get('gender')} (expected 'male')")
        return False
    print_pass("gender updated to 'male'")
    
    if data.get("mobile") != "9876543210":
        print_fail(f"mobile not updated: {data.get('mobile')} (expected '9876543210')")
        return False
    print_pass("mobile updated to '9876543210'")
    
    # Verify roles unchanged (empty for shopper)
    if data.get("roles") != []:
        print_fail(f"roles changed: {data.get('roles')} (expected [])")
        return False
    print_pass("roles unchanged (empty)")
    
    # Verify NO password_hash
    if "password_hash" in data:
        print_fail("Response contains 'password_hash' (SECURITY ISSUE)")
        return False
    print_pass("Response does NOT contain 'password_hash'")
    
    return True

def test_4_update_avatar_valid(shopper: dict):
    """Test 4: PUT /api/auth/me {avatar_url: https URL} → 200; avatar_url saved."""
    print_test(4, "PUT /api/auth/me with valid avatar_url (https)")
    
    headers = headers_with_token(shopper['token'])
    payload = {
        "avatar_url": "https://example.com/a.png"
    }
    
    resp = requests.put(f"{BASE_URL}/auth/me", json=payload, headers=headers)
    
    if resp.status_code != 200:
        print_fail(f"PUT /api/auth/me → {resp.status_code} (expected 200)")
        print_info(f"Response: {resp.text}")
        return False
    
    print_pass(f"PUT /api/auth/me → 200")
    
    data = resp.json()
    if data.get("avatar_url") != "https://example.com/a.png":
        print_fail(f"avatar_url not saved: {data.get('avatar_url')}")
        return False
    print_pass("avatar_url saved correctly")
    
    return True

def test_5_invalid_avatar_url(shopper: dict):
    """Test 5: Invalid avatar_url 'notaurl' → 422."""
    print_test(5, "PUT /api/auth/me with invalid avatar_url → 422")
    
    headers = headers_with_token(shopper['token'])
    payload = {
        "avatar_url": "notaurl"
    }
    
    resp = requests.put(f"{BASE_URL}/auth/me", json=payload, headers=headers)
    
    if resp.status_code != 422:
        print_fail(f"PUT /api/auth/me → {resp.status_code} (expected 422)")
        print_info(f"Response: {resp.text}")
        return False
    
    print_pass(f"PUT /api/auth/me with invalid avatar_url → 422")
    print_info(f"Error: {resp.json()}")
    
    return True

def test_6_invalid_mobile(shopper: dict):
    """Test 6: Invalid mobile '12345' → 422."""
    print_test(6, "PUT /api/auth/me with invalid mobile → 422")
    
    headers = headers_with_token(shopper['token'])
    payload = {
        "mobile": "12345"
    }
    
    resp = requests.put(f"{BASE_URL}/auth/me", json=payload, headers=headers)
    
    if resp.status_code != 422:
        print_fail(f"PUT /api/auth/me → {resp.status_code} (expected 422)")
        print_info(f"Response: {resp.text}")
        return False
    
    print_pass(f"PUT /api/auth/me with invalid mobile → 422")
    print_info(f"Error: {resp.json()}")
    
    return True

def test_7_invalid_gender(shopper: dict):
    """Test 7: Invalid gender 'xyz' → 422."""
    print_test(7, "PUT /api/auth/me with invalid gender → 422")
    
    headers = headers_with_token(shopper['token'])
    payload = {
        "gender": "xyz"
    }
    
    resp = requests.put(f"{BASE_URL}/auth/me", json=payload, headers=headers)
    
    if resp.status_code != 422:
        print_fail(f"PUT /api/auth/me → {resp.status_code} (expected 422)")
        print_info(f"Response: {resp.text}")
        return False
    
    print_pass(f"PUT /api/auth/me with invalid gender → 422")
    print_info(f"Error: {resp.json()}")
    
    return True

def test_8_extra_field_forbidden(shopper: dict):
    """Test 8: Unknown/extra field {is_admin:true} → 422; verify roles still empty."""
    print_test(8, "PUT /api/auth/me with extra field (is_admin) → 422")
    
    headers = headers_with_token(shopper['token'])
    payload = {
        "is_admin": True
    }
    
    resp = requests.put(f"{BASE_URL}/auth/me", json=payload, headers=headers)
    
    if resp.status_code != 422:
        print_fail(f"PUT /api/auth/me → {resp.status_code} (expected 422)")
        print_info(f"Response: {resp.text}")
        return False
    
    print_pass(f"PUT /api/auth/me with extra field → 422 (extra='forbid' working)")
    print_info(f"Error: {resp.json()}")
    
    # Verify roles still empty (no privilege escalation)
    resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    if resp.status_code != 200:
        print_fail(f"GET /api/auth/me → {resp.status_code}")
        return False
    
    data = resp.json()
    if data.get("roles") != []:
        print_fail(f"Roles changed after extra field attempt: {data.get('roles')} (SECURITY ISSUE)")
        return False
    print_pass("Roles still empty (no privilege escalation)")
    
    return True

def test_9_unauthenticated_update():
    """Test 9: Unauthenticated PUT /api/auth/me → 401."""
    print_test(9, "Unauthenticated PUT /api/auth/me → 401")
    
    payload = {
        "full_name": "Hacker"
    }
    
    resp = requests.put(f"{BASE_URL}/auth/me", json=payload)
    
    if resp.status_code != 401:
        print_fail(f"PUT /api/auth/me without token → {resp.status_code} (expected 401)")
        return False
    
    print_pass(f"PUT /api/auth/me without token → 401")
    
    return True

def test_10_partial_update(shopper: dict):
    """Test 10: Partial update {gender:'other'} keeps other fields intact."""
    print_test(10, "Partial update (gender only) keeps other fields intact")
    
    headers = headers_with_token(shopper['token'])
    
    # First get current state
    resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    if resp.status_code != 200:
        print_fail(f"GET /api/auth/me → {resp.status_code}")
        return False
    
    before = resp.json()
    print_info(f"Before update: full_name={before.get('full_name')}, mobile={before.get('mobile')}, gender={before.get('gender')}")
    
    # Partial update (only gender)
    payload = {
        "gender": "other"
    }
    
    resp = requests.put(f"{BASE_URL}/auth/me", json=payload, headers=headers)
    
    if resp.status_code != 200:
        print_fail(f"PUT /api/auth/me → {resp.status_code} (expected 200)")
        print_info(f"Response: {resp.text}")
        return False
    
    print_pass(f"PUT /api/auth/me → 200")
    
    after = resp.json()
    print_info(f"After update: full_name={after.get('full_name')}, mobile={after.get('mobile')}, gender={after.get('gender')}")
    
    # Verify gender updated
    if after.get("gender") != "other":
        print_fail(f"gender not updated: {after.get('gender')} (expected 'other')")
        return False
    print_pass("gender updated to 'other'")
    
    # Verify other fields intact
    if after.get("full_name") != before.get("full_name"):
        print_fail(f"full_name changed: {after.get('full_name')} (expected {before.get('full_name')})")
        return False
    print_pass(f"full_name intact: {after.get('full_name')}")
    
    if after.get("mobile") != before.get("mobile"):
        print_fail(f"mobile changed: {after.get('mobile')} (expected {before.get('mobile')})")
        return False
    print_pass(f"mobile intact: {after.get('mobile')}")
    
    return True

def test_11_regression_firstcry_calculation(shopper: dict):
    """Test 11: REGRESSION - Firstcry calculation → extra_saved=88, final_bill=1251."""
    print_test(11, "REGRESSION: Firstcry calculation (existing shopper)")
    
    headers = headers_with_token(shopper['token'])
    payload = {
        "store_name": "Firstcry",
        "category": "All",
        "customer_type": "existing",
        "mrp": 1599,
        "price": 1338
    }
    
    resp = requests.post(f"{BASE_URL}/calculate", json=payload, headers=headers)
    
    if resp.status_code != 200:
        print_fail(f"POST /api/calculate → {resp.status_code} (expected 200)")
        print_info(f"Response: {resp.text}")
        return False
    
    print_pass(f"POST /api/calculate → 200")
    
    data = resp.json()
    print_info(f"Calculation result: {json.dumps(data.get('summary'), indent=2)}")
    
    summary = data.get("summary", {})
    extra_saved = summary.get("extra_saved", {}).get("rupees")
    final_bill = summary.get("final_bill", {}).get("rupees")
    
    if extra_saved != 88:
        print_fail(f"extra_saved.rupees = {extra_saved} (expected 88)")
        return False
    print_pass(f"extra_saved.rupees = 88 ✓")
    
    if final_bill != 1251:
        print_fail(f"final_bill.rupees = {final_bill} (expected 1251)")
        return False
    print_pass(f"final_bill.rupees = 1251 ✓")
    
    return True

def test_12_regression_public_endpoints():
    """Test 12: REGRESSION - card-catalogue, public stores, public categories."""
    print_test(12, "REGRESSION: Public endpoints (card-catalogue, stores, categories)")
    
    # Test card-catalogue search
    resp = requests.get(f"{BASE_URL}/card-catalogue?q=SBI")
    if resp.status_code != 200:
        print_fail(f"GET /api/card-catalogue?q=SBI → {resp.status_code} (expected 200)")
        return False
    
    data = resp.json()
    if len(data) == 0:
        print_fail("GET /api/card-catalogue?q=SBI returned empty list")
        return False
    
    print_pass(f"GET /api/card-catalogue?q=SBI → {len(data)} cards found")
    print_info(f"First card: {data[0].get('card_name')} ({data[0].get('bank_name')})")
    
    # Test public stores
    resp = requests.get(f"{BASE_URL}/public/stores")
    if resp.status_code != 200:
        print_fail(f"GET /api/public/stores → {resp.status_code} (expected 200)")
        return False
    
    data = resp.json()
    if len(data) == 0:
        print_fail("GET /api/public/stores returned empty list")
        return False
    
    print_pass(f"GET /api/public/stores → {len(data)} stores found")
    
    # Test public categories
    resp = requests.get(f"{BASE_URL}/public/categories")
    if resp.status_code != 200:
        print_fail(f"GET /api/public/categories → {resp.status_code} (expected 200)")
        return False
    
    data = resp.json()
    if len(data) == 0:
        print_fail("GET /api/public/categories returned empty list")
        return False
    
    print_pass(f"GET /api/public/categories → {len(data)} categories found")
    
    return True

# =============================================================================
# MAIN TEST RUNNER
# =============================================================================

def main():
    print("\n" + "="*80)
    print("STEP 5C BACKEND TEST SUITE")
    print("Testing PUT /api/auth/me profile update endpoint + regression")
    print("="*80)
    
    results = []
    
    # Test 1: Register fresh shopper
    shopper = test_1_register_fresh_shopper()
    if not shopper:
        print("\n❌ CRITICAL: Cannot proceed without a registered shopper")
        return
    results.append(("Register fresh shopper", True))
    
    # Test 2: GET /api/auth/me
    result = test_2_get_auth_me(shopper)
    results.append(("GET /api/auth/me structure", result))
    
    # Test 3: Full profile update
    result = test_3_update_profile_full(shopper)
    results.append(("PUT /api/auth/me (full update)", result))
    
    # Test 4: Valid avatar URL
    result = test_4_update_avatar_valid(shopper)
    results.append(("PUT /api/auth/me (valid avatar_url)", result))
    
    # Test 5: Invalid avatar URL
    result = test_5_invalid_avatar_url(shopper)
    results.append(("Invalid avatar_url → 422", result))
    
    # Test 6: Invalid mobile
    result = test_6_invalid_mobile(shopper)
    results.append(("Invalid mobile → 422", result))
    
    # Test 7: Invalid gender
    result = test_7_invalid_gender(shopper)
    results.append(("Invalid gender → 422", result))
    
    # Test 8: Extra field forbidden
    result = test_8_extra_field_forbidden(shopper)
    results.append(("Extra field forbidden + no privilege escalation", result))
    
    # Test 9: Unauthenticated update
    result = test_9_unauthenticated_update()
    results.append(("Unauthenticated PUT → 401", result))
    
    # Test 10: Partial update
    result = test_10_partial_update(shopper)
    results.append(("Partial update (gender only)", result))
    
    # Test 11: Regression - Firstcry calculation
    result = test_11_regression_firstcry_calculation(shopper)
    results.append(("REGRESSION: Firstcry calculation", result))
    
    # Test 12: Regression - Public endpoints
    result = test_12_regression_public_endpoints()
    results.append(("REGRESSION: Public endpoints", result))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! STEP 5C is production-ready.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review failures above.")

if __name__ == "__main__":
    main()
