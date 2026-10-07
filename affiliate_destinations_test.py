#!/usr/bin/env python3
"""
Comprehensive backend test for Affiliate Destinations feature.
Tests all 17 scenarios from the review request.
"""
import requests
import json
import random

# Base URL from frontend/.env
BASE_URL = "https://cart-phase-audit.preview.emergentagent.com/api"

# Admin credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "owner@yukticart.com"
ADMIN_PASSWORD = "YuktiOwner!2025"

def print_test(num, desc):
    print(f"\n{'='*80}")
    print(f"TEST {num}: {desc}")
    print('='*80)

def print_result(passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {details}")
    return passed

# Global session for cookies
session = requests.Session()

# Store test data
test_data = {
    "amazon_store_id": None,
    "cashkaro_platform_id": None,
    "mapping_id": None,
    "shopper_token": None,
    "gift_card_platform_id": None,
    "bogus_store_id": "bogus-store-123",
    "bogus_platform_id": "bogus-platform-456"
}

def admin_login():
    """Login as admin and store session cookies"""
    print_test(0, "Admin Login")
    resp = session.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code == 200:
        print_result(True, f"Admin logged in successfully")
        return True
    else:
        print_result(False, f"Admin login failed: {resp.status_code} {resp.text}")
        return False

def test_1_get_store_and_platform_ids():
    """Get Amazon store id and CashKaro platform id"""
    print_test(1, "Get Amazon store id and CashKaro platform id")
    
    # Get stores
    resp = session.get(f"{BASE_URL}/admin/stores")
    if resp.status_code != 200:
        return print_result(False, f"Failed to get stores: {resp.status_code}")
    
    stores = resp.json()
    amazon = next((s for s in stores if s.get("name", "").lower() == "amazon"), None)
    if not amazon:
        return print_result(False, "Amazon store not found")
    
    test_data["amazon_store_id"] = amazon["id"]
    print(f"  Amazon store_id: {test_data['amazon_store_id']}")
    
    # Get platforms
    resp = session.get(f"{BASE_URL}/admin/platforms")
    if resp.status_code != 200:
        return print_result(False, f"Failed to get platforms: {resp.status_code}")
    
    platforms = resp.json()
    cashkaro = next((p for p in platforms if p.get("name", "").lower() == "cashkaro" and p.get("kind") == "affiliate"), None)
    if not cashkaro:
        return print_result(False, "CashKaro affiliate platform not found")
    
    test_data["cashkaro_platform_id"] = cashkaro["id"]
    print(f"  CashKaro platform_id: {test_data['cashkaro_platform_id']}")
    
    # Also get a gift card platform for test 11
    gift_card = next((p for p in platforms if p.get("kind") == "gift_card"), None)
    if gift_card:
        test_data["gift_card_platform_id"] = gift_card["id"]
        print(f"  Gift card platform_id: {test_data['gift_card_platform_id']} ({gift_card.get('name')})")
    
    return print_result(True, "Successfully retrieved store and platform IDs")

def test_2_create_mapping():
    """POST create Amazon×CashKaro mapping"""
    print_test(2, "POST create Amazon×CashKaro mapping")
    
    resp = session.post(f"{BASE_URL}/admin/affiliate-destinations", json={
        "store_id": test_data["amazon_store_id"],
        "platform_id": test_data["cashkaro_platform_id"],
        "destination_url": "https://cashkaro.com/stores/amazon?ref=yukti",
        "active": True
    })
    
    if resp.status_code != 200:
        return print_result(False, f"Failed to create mapping: {resp.status_code} {resp.text}")
    
    data = resp.json()
    test_data["mapping_id"] = data.get("id")
    
    # Verify response
    checks = [
        (data.get("store_id") == test_data["amazon_store_id"], "store_id matches"),
        (data.get("platform_id") == test_data["cashkaro_platform_id"], "platform_id matches"),
        (data.get("destination_url") == "https://cashkaro.com/stores/amazon?ref=yukti", "destination_url matches"),
        (data.get("active") == True, "active is true"),
        ("id" in data, "has id"),
        ("created_at" in data, "has created_at"),
        ("updated_at" in data, "has updated_at")
    ]
    
    all_passed = all(check[0] for check in checks)
    for passed, desc in checks:
        print(f"  {'✓' if passed else '✗'} {desc}")
    
    return print_result(all_passed, f"Mapping created with id: {test_data['mapping_id']}")

def test_3_list_mappings():
    """GET list shows mapping with store_name and partner_name"""
    print_test(3, "GET list shows enriched mapping")
    
    resp = session.get(f"{BASE_URL}/admin/affiliate-destinations")
    if resp.status_code != 200:
        return print_result(False, f"Failed to list mappings: {resp.status_code}")
    
    mappings = resp.json()
    our_mapping = next((m for m in mappings if m.get("id") == test_data["mapping_id"]), None)
    
    if not our_mapping:
        return print_result(False, "Created mapping not found in list")
    
    checks = [
        (our_mapping.get("store_name", "").lower() == "amazon", f"store_name is 'Amazon' (got: {our_mapping.get('store_name')})"),
        (our_mapping.get("partner_name", "").lower() == "cashkaro", f"partner_name is 'CashKaro' (got: {our_mapping.get('partner_name')})"),
        (our_mapping.get("destination_url") == "https://cashkaro.com/stores/amazon?ref=yukti", "destination_url correct"),
        (our_mapping.get("active") == True, "active is true")
    ]
    
    all_passed = all(check[0] for check in checks)
    for passed, desc in checks:
        print(f"  {'✓' if passed else '✗'} {desc}")
    
    return print_result(all_passed, "Mapping enriched correctly with store_name and partner_name")

def test_4_redirect_with_store():
    """GET /api/redirect/cashkaro?store=Amazon returns mapping url with mapping:true"""
    print_test(4, "GET /api/redirect/cashkaro?store=Amazon returns mapping url")
    
    resp = session.get(f"{BASE_URL}/redirect/cashkaro?store=Amazon")
    if resp.status_code != 200:
        return print_result(False, f"Redirect failed: {resp.status_code} {resp.text}")
    
    data = resp.json()
    checks = [
        (data.get("url") == "https://cashkaro.com/stores/amazon?ref=yukti", f"url matches mapping (got: {data.get('url')})"),
        (data.get("mapping") == True, f"mapping is true (got: {data.get('mapping')})"),
        (data.get("partner", "").lower() == "cashkaro", f"partner is CashKaro (got: {data.get('partner')})"),
        (data.get("store", "").lower() == "amazon", f"store is Amazon (got: {data.get('store')})")
    ]
    
    all_passed = all(check[0] for check in checks)
    for passed, desc in checks:
        print(f"  {'✓' if passed else '✗'} {desc}")
    
    return print_result(all_passed, "Redirect returns mapping destination_url with mapping:true")

def test_5_update_destination_url():
    """PUT edit destination_url to new value"""
    print_test(5, "PUT edit destination_url")
    
    new_url = "https://cashkaro.com/amazon-deals"
    resp = session.put(f"{BASE_URL}/admin/affiliate-destinations/{test_data['mapping_id']}", json={
        "destination_url": new_url
    })
    
    if resp.status_code != 200:
        return print_result(False, f"Failed to update: {resp.status_code} {resp.text}")
    
    data = resp.json()
    if data.get("destination_url") != new_url:
        return print_result(False, f"destination_url not updated (got: {data.get('destination_url')})")
    
    # Verify redirect now returns new url
    resp = session.get(f"{BASE_URL}/redirect/cashkaro?store=Amazon")
    if resp.status_code != 200:
        return print_result(False, f"Redirect failed after update: {resp.status_code}")
    
    redirect_data = resp.json()
    checks = [
        (redirect_data.get("url") == new_url, f"redirect url updated (got: {redirect_data.get('url')})"),
        (redirect_data.get("mapping") == True, "mapping still true")
    ]
    
    all_passed = all(check[0] for check in checks)
    for passed, desc in checks:
        print(f"  {'✓' if passed else '✗'} {desc}")
    
    return print_result(all_passed, "destination_url updated and redirect reflects new url")

def test_6_deactivate_mapping():
    """PUT {active:false} and verify fallback to generic url"""
    print_test(6, "PUT {active:false} and verify fallback")
    
    resp = session.put(f"{BASE_URL}/admin/affiliate-destinations/{test_data['mapping_id']}", json={
        "active": False
    })
    
    if resp.status_code != 200:
        return print_result(False, f"Failed to deactivate: {resp.status_code} {resp.text}")
    
    # Verify redirect now falls back to generic CashKaro url
    resp = session.get(f"{BASE_URL}/redirect/cashkaro?store=Amazon")
    if resp.status_code != 200:
        return print_result(False, f"Redirect failed: {resp.status_code}")
    
    data = resp.json()
    # Accept URL with or without trailing slash (both are valid)
    url = data.get("url", "")
    is_cashkaro_generic = url in ["https://cashkaro.com/", "https://cashkaro.com"]
    checks = [
        (data.get("mapping") == False, f"mapping is false (got: {data.get('mapping')})"),
        (is_cashkaro_generic, f"url is generic CashKaro website_url (got: {url})")
    ]
    
    all_passed = all(check[0] for check in checks)
    for passed, desc in checks:
        print(f"  {'✓' if passed else '✗'} {desc}")
    
    return print_result(all_passed, "Deactivated mapping falls back to generic website_url with mapping:false")

def test_7_redirect_without_store():
    """GET /api/redirect/cashkaro (no store) returns generic url, mapping:false"""
    print_test(7, "GET /api/redirect/cashkaro (no store) - unchanged legacy behavior")
    
    resp = session.get(f"{BASE_URL}/redirect/cashkaro")
    if resp.status_code != 200:
        return print_result(False, f"Redirect failed: {resp.status_code}")
    
    data = resp.json()
    # Accept URL with or without trailing slash (both are valid)
    url = data.get("url", "")
    is_cashkaro_generic = url in ["https://cashkaro.com/", "https://cashkaro.com"]
    checks = [
        (is_cashkaro_generic, f"url is generic (got: {url})"),
        (data.get("mapping") == False, f"mapping is false (got: {data.get('mapping')})")
    ]
    
    all_passed = all(check[0] for check in checks)
    for passed, desc in checks:
        print(f"  {'✓' if passed else '✗'} {desc}")
    
    return print_result(all_passed, "Legacy behavior unchanged: no store param returns generic url")

def test_8_redirect_unmapped_store():
    """GET /api/redirect/cashkaro?store=Flipkart (no mapping) returns generic fallback"""
    print_test(8, "GET /api/redirect/cashkaro?store=Flipkart (no mapping)")
    
    resp = session.get(f"{BASE_URL}/redirect/cashkaro?store=Flipkart")
    if resp.status_code != 200:
        return print_result(False, f"Redirect failed: {resp.status_code}")
    
    data = resp.json()
    # Accept URL with or without trailing slash (both are valid)
    url = data.get("url", "")
    is_cashkaro_generic = url in ["https://cashkaro.com/", "https://cashkaro.com"]
    checks = [
        (is_cashkaro_generic, f"url is generic fallback (got: {url})"),
        (data.get("mapping") == False, f"mapping is false (got: {data.get('mapping')})")
    ]
    
    all_passed = all(check[0] for check in checks)
    for passed, desc in checks:
        print(f"  {'✓' if passed else '✗'} {desc}")
    
    return print_result(all_passed, "Unmapped store falls back to generic url with mapping:false")

def test_9_duplicate_mapping():
    """POST duplicate Amazon×CashKaro returns 409"""
    print_test(9, "POST duplicate Amazon×CashKaro returns 409")
    
    resp = session.post(f"{BASE_URL}/admin/affiliate-destinations", json={
        "store_id": test_data["amazon_store_id"],
        "platform_id": test_data["cashkaro_platform_id"],
        "destination_url": "https://cashkaro.com/duplicate",
        "active": True
    })
    
    if resp.status_code == 409:
        return print_result(True, f"Correctly returned 409: {resp.text}")
    else:
        return print_result(False, f"Expected 409, got {resp.status_code}: {resp.text}")

def test_10_unsafe_urls():
    """POST unsafe destination_urls return 400"""
    print_test(10, "POST unsafe destination_urls return 400")
    
    unsafe_urls = [
        "javascript:alert(1)",
        "data:text/html,x",
        "notaurl",
        "file:///etc/passwd"
    ]
    
    results = []
    for unsafe_url in unsafe_urls:
        resp = session.post(f"{BASE_URL}/admin/affiliate-destinations", json={
            "store_id": test_data["amazon_store_id"],
            "platform_id": test_data["cashkaro_platform_id"],
            "destination_url": unsafe_url,
            "active": True
        })
        
        passed = resp.status_code == 400
        results.append(passed)
        print(f"  {'✓' if passed else '✗'} '{unsafe_url}' → {resp.status_code} (expected 400)")
    
    all_passed = all(results)
    return print_result(all_passed, "All unsafe URLs correctly rejected with 400")

def test_11_gift_card_platform():
    """POST with gift_card platform id returns 400"""
    print_test(11, "POST with gift_card platform returns 400")
    
    if not test_data["gift_card_platform_id"]:
        return print_result(False, "No gift card platform found to test")
    
    resp = session.post(f"{BASE_URL}/admin/affiliate-destinations", json={
        "store_id": test_data["amazon_store_id"],
        "platform_id": test_data["gift_card_platform_id"],
        "destination_url": "https://example.com/test",
        "active": True
    })
    
    if resp.status_code == 400:
        return print_result(True, f"Correctly returned 400: {resp.text}")
    else:
        return print_result(False, f"Expected 400, got {resp.status_code}: {resp.text}")

def test_12_bogus_ids():
    """POST with bogus store_id or platform_id returns 404"""
    print_test(12, "POST with bogus store_id or platform_id returns 404")
    
    # Test bogus store_id
    resp1 = session.post(f"{BASE_URL}/admin/affiliate-destinations", json={
        "store_id": test_data["bogus_store_id"],
        "platform_id": test_data["cashkaro_platform_id"],
        "destination_url": "https://example.com/test",
        "active": True
    })
    
    passed1 = resp1.status_code == 404
    print(f"  {'✓' if passed1 else '✗'} Bogus store_id → {resp1.status_code} (expected 404)")
    
    # Test bogus platform_id
    resp2 = session.post(f"{BASE_URL}/admin/affiliate-destinations", json={
        "store_id": test_data["amazon_store_id"],
        "platform_id": test_data["bogus_platform_id"],
        "destination_url": "https://example.com/test",
        "active": True
    })
    
    passed2 = resp2.status_code == 404
    print(f"  {'✓' if passed2 else '✗'} Bogus platform_id → {resp2.status_code} (expected 404)")
    
    all_passed = passed1 and passed2
    return print_result(all_passed, "Bogus IDs correctly return 404")

def test_13_shopper_blocked():
    """Register fresh shopper and verify POST/PUT/DELETE blocked (401/403)"""
    print_test(13, "Fresh shopper POST/PUT/DELETE blocked (401/403)")
    
    # Create new session for shopper
    shopper_session = requests.Session()
    
    # Register fresh shopper
    rand = random.randint(10000, 99999)
    shopper_email = f"shopper{rand}@example.com"
    
    resp = shopper_session.post(f"{BASE_URL}/auth/register", json={
        "email": shopper_email,
        "password": "Shopper123",
        "full_name": "Test Shopper",
        "gender": "male",
        "mobile": "9123456789"
    })
    
    if resp.status_code != 200:
        return print_result(False, f"Failed to register shopper: {resp.status_code}")
    
    print(f"  Registered shopper: {shopper_email}")
    
    # Try POST
    resp1 = shopper_session.post(f"{BASE_URL}/admin/affiliate-destinations", json={
        "store_id": test_data["amazon_store_id"],
        "platform_id": test_data["cashkaro_platform_id"],
        "destination_url": "https://example.com/test",
        "active": True
    })
    
    passed1 = resp1.status_code in [401, 403]
    print(f"  {'✓' if passed1 else '✗'} POST → {resp1.status_code} (expected 401/403)")
    
    # Try PUT
    resp2 = shopper_session.put(f"{BASE_URL}/admin/affiliate-destinations/{test_data['mapping_id']}", json={
        "destination_url": "https://example.com/hack"
    })
    
    passed2 = resp2.status_code in [401, 403]
    print(f"  {'✓' if passed2 else '✗'} PUT → {resp2.status_code} (expected 401/403)")
    
    # Try DELETE
    resp3 = shopper_session.delete(f"{BASE_URL}/admin/affiliate-destinations/{test_data['mapping_id']}")
    
    passed3 = resp3.status_code in [401, 403]
    print(f"  {'✓' if passed3 else '✗'} DELETE → {resp3.status_code} (expected 401/403)")
    
    all_passed = passed1 and passed2 and passed3
    return print_result(all_passed, "Shopper correctly blocked from all write operations")

def test_14_unauthenticated_blocked():
    """Unauthenticated POST returns 401/403"""
    print_test(14, "Unauthenticated POST returns 401/403")
    
    # Create new session without auth
    anon_session = requests.Session()
    
    resp = anon_session.post(f"{BASE_URL}/admin/affiliate-destinations", json={
        "store_id": test_data["amazon_store_id"],
        "platform_id": test_data["cashkaro_platform_id"],
        "destination_url": "https://example.com/test",
        "active": True
    })
    
    if resp.status_code in [401, 403]:
        return print_result(True, f"Correctly returned {resp.status_code}")
    else:
        return print_result(False, f"Expected 401/403, got {resp.status_code}")

def test_15_delete_and_verify_fallback():
    """DELETE mapping and verify redirect falls back to generic"""
    print_test(15, "DELETE mapping and verify fallback")
    
    resp = session.delete(f"{BASE_URL}/admin/affiliate-destinations/{test_data['mapping_id']}")
    
    if resp.status_code != 200:
        return print_result(False, f"Failed to delete: {resp.status_code} {resp.text}")
    
    data = resp.json()
    if not data.get("deleted"):
        return print_result(False, f"Delete response missing 'deleted' flag")
    
    print(f"  ✓ Mapping deleted")
    
    # Verify redirect now falls back to generic
    resp = session.get(f"{BASE_URL}/redirect/cashkaro?store=Amazon")
    if resp.status_code != 200:
        return print_result(False, f"Redirect failed: {resp.status_code}")
    
    redirect_data = resp.json()
    # Accept URL with or without trailing slash (both are valid)
    url = redirect_data.get("url", "")
    is_cashkaro_generic = url in ["https://cashkaro.com/", "https://cashkaro.com"]
    checks = [
        (is_cashkaro_generic, f"url is generic fallback (got: {url})"),
        (redirect_data.get("mapping") == False, f"mapping is false (got: {redirect_data.get('mapping')})")
    ]
    
    all_passed = all(check[0] for check in checks)
    for passed, desc in checks:
        print(f"  {'✓' if passed else '✗'} {desc}")
    
    return print_result(all_passed, "After delete, redirect falls back to generic url with mapping:false")

def test_16_regression_firstcry_calc():
    """REGRESSION: Firstcry calculation returns 88/1251"""
    print_test(16, "REGRESSION: Firstcry calculation unchanged")
    
    resp = session.post(f"{BASE_URL}/calculate", json={
        "store_name": "Firstcry",
        "category": "All",
        "customer_type": "existing",
        "mrp": 1599,
        "price": 1338
    })
    
    if resp.status_code != 200:
        return print_result(False, f"Calculate failed: {resp.status_code}")
    
    data = resp.json()
    extra_saved = data.get("summary", {}).get("extra_saved", {}).get("rupees")
    final_bill = data.get("summary", {}).get("final_bill", {}).get("rupees")
    
    checks = [
        (extra_saved == 88, f"extra_saved.rupees == 88 (got: {extra_saved})"),
        (final_bill == 1251, f"final_bill.rupees == 1251 (got: {final_bill})")
    ]
    
    all_passed = all(check[0] for check in checks)
    for passed, desc in checks:
        print(f"  {'✓' if passed else '✗'} {desc}")
    
    return print_result(all_passed, "Firstcry calculation unchanged (88/1251)")

def test_17_regression_public_endpoints():
    """REGRESSION: card-catalogue, public stores/categories return data"""
    print_test(17, "REGRESSION: public endpoints working")
    
    # Test card-catalogue
    resp1 = session.get(f"{BASE_URL}/card-catalogue?q=SBI")
    passed1 = resp1.status_code == 200 and len(resp1.json()) > 0
    print(f"  {'✓' if passed1 else '✗'} GET /api/card-catalogue?q=SBI → {resp1.status_code}, {len(resp1.json()) if passed1 else 0} cards")
    
    # Test public stores
    resp2 = session.get(f"{BASE_URL}/public/stores")
    passed2 = resp2.status_code == 200 and len(resp2.json()) > 0
    print(f"  {'✓' if passed2 else '✗'} GET /api/public/stores → {resp2.status_code}, {len(resp2.json()) if passed2 else 0} stores")
    
    # Test public categories
    resp3 = session.get(f"{BASE_URL}/public/categories")
    passed3 = resp3.status_code == 200 and len(resp3.json()) > 0
    print(f"  {'✓' if passed3 else '✗'} GET /api/public/categories → {resp3.status_code}, {len(resp3.json()) if passed3 else 0} categories")
    
    all_passed = passed1 and passed2 and passed3
    return print_result(all_passed, "All public endpoints working")

def main():
    print("\n" + "="*80)
    print("AFFILIATE DESTINATIONS BACKEND TEST SUITE")
    print("="*80)
    
    # Login first
    if not admin_login():
        print("\n❌ FATAL: Admin login failed. Cannot proceed with tests.")
        return
    
    # Run all tests
    results = []
    results.append(("Test 1: Get IDs", test_1_get_store_and_platform_ids()))
    results.append(("Test 2: Create mapping", test_2_create_mapping()))
    results.append(("Test 3: List mappings", test_3_list_mappings()))
    results.append(("Test 4: Redirect with store", test_4_redirect_with_store()))
    results.append(("Test 5: Update destination_url", test_5_update_destination_url()))
    results.append(("Test 6: Deactivate mapping", test_6_deactivate_mapping()))
    results.append(("Test 7: Redirect without store", test_7_redirect_without_store()))
    results.append(("Test 8: Redirect unmapped store", test_8_redirect_unmapped_store()))
    results.append(("Test 9: Duplicate mapping", test_9_duplicate_mapping()))
    results.append(("Test 10: Unsafe URLs", test_10_unsafe_urls()))
    results.append(("Test 11: Gift card platform", test_11_gift_card_platform()))
    results.append(("Test 12: Bogus IDs", test_12_bogus_ids()))
    results.append(("Test 13: Shopper blocked", test_13_shopper_blocked()))
    results.append(("Test 14: Unauthenticated blocked", test_14_unauthenticated_blocked()))
    results.append(("Test 15: Delete and verify", test_15_delete_and_verify_fallback()))
    results.append(("Test 16: REGRESSION Firstcry", test_16_regression_firstcry_calc()))
    results.append(("Test 17: REGRESSION public endpoints", test_17_regression_public_endpoints()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed")
    print(f"{'='*80}\n")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Feature is production-ready.")
    else:
        print(f"⚠️  {total - passed} test(s) failed. Review failures above.")

if __name__ == "__main__":
    main()
