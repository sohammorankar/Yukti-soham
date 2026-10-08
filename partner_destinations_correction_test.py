#!/usr/bin/env python3
"""
Partner Destinations Correction Test Suite
Tests that affiliate_destinations now supports BOTH affiliate AND gift_card partners.
"""

import requests
import json
import random

BASE_URL = "https://yukticart-audit.preview.emergentagent.com/api"
ADMIN_EMAIL = "owner@yukticart.com"
ADMIN_PASSWORD = "YuktiOwner!2025"

def login_admin():
    """Login as admin owner and return access token."""
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    return data.get("access_token")

def register_shopper():
    """Register a fresh shopper (no roles) and return access token."""
    rand = random.randint(10000, 99999)
    email = f"qa+{rand}@example.com"
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": "Shop1234",
        "full_name": "QA Shopper",
        "gender": "female",
        "mobile": "9123456780"
    })
    assert resp.status_code == 200, f"Shopper registration failed: {resp.status_code} {resp.text}"
    data = resp.json()
    return data.get("access_token"), email

def test_step_1_get_store_and_platform_ids(token):
    """Step 1: GET stores and platforms to capture Amazon, Firstcry, CashKaro (affiliate), Woohoo (gift_card) ids."""
    print("\n=== STEP 1: Get Store & Platform IDs ===")
    
    # Get stores
    resp = requests.get(f"{BASE_URL}/admin/stores", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, f"GET stores failed: {resp.status_code} {resp.text}"
    stores = resp.json()
    
    amazon = next((s for s in stores if s.get("name") == "Amazon"), None)
    firstcry = next((s for s in stores if s.get("name") == "Firstcry"), None)
    
    assert amazon, "Amazon store not found"
    assert firstcry, "Firstcry store not found"
    
    print(f"✓ Amazon store_id: {amazon['id']}")
    print(f"✓ Firstcry store_id: {firstcry['id']}")
    
    # Get platforms
    resp = requests.get(f"{BASE_URL}/admin/platforms", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, f"GET platforms failed: {resp.status_code} {resp.text}"
    platforms = resp.json()
    
    cashkaro = next((p for p in platforms if p.get("name") == "CashKaro"), None)
    woohoo = next((p for p in platforms if p.get("name") == "Woohoo"), None)
    
    assert cashkaro, "CashKaro platform not found"
    assert woohoo, "Woohoo platform not found"
    assert cashkaro.get("kind") == "affiliate", f"CashKaro kind should be 'affiliate', got {cashkaro.get('kind')}"
    assert woohoo.get("kind") == "gift_card", f"Woohoo kind should be 'gift_card', got {woohoo.get('kind')}"
    
    print(f"✓ CashKaro platform_id: {cashkaro['id']}, kind: {cashkaro['kind']}")
    print(f"✓ Woohoo platform_id: {woohoo['id']}, kind: {woohoo['kind']}")
    
    return {
        "amazon_id": amazon["id"],
        "firstcry_id": firstcry["id"],
        "cashkaro_id": cashkaro["id"],
        "woohoo_id": woohoo["id"]
    }

def test_step_2_create_amazon_woohoo_mapping(token, ids):
    """Step 2: POST Amazon×Woohoo (gift_card) → 200 (gift_card ACCEPTED — core fix)."""
    print("\n=== STEP 2: Create Amazon×Woohoo (gift_card) Mapping ===")
    
    resp = requests.post(f"{BASE_URL}/admin/affiliate-destinations", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={
                            "store_id": ids["amazon_id"],
                            "platform_id": ids["woohoo_id"],
                            "destination_url": "https://woohoo.in/amazon?ref=yukti",
                            "active": True
                        })
    
    assert resp.status_code == 200, f"POST Amazon×Woohoo failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    assert data.get("store_id") == ids["amazon_id"], "store_id mismatch"
    assert data.get("platform_id") == ids["woohoo_id"], "platform_id mismatch"
    assert data.get("destination_url") == "https://woohoo.in/amazon?ref=yukti", "destination_url mismatch"
    assert data.get("active") == True, "active should be True"
    assert "id" in data, "Response should contain id"
    
    print(f"✓ Amazon×Woohoo mapping created successfully (gift_card ACCEPTED)")
    print(f"  Mapping ID: {data['id']}")
    
    return data["id"]

def test_step_3_list_shows_partner_kind(token, ids):
    """Step 3: GET list shows Amazon×Woohoo with partner_kind=='gift_card', partner_name 'Woohoo'."""
    print("\n=== STEP 3: List Mappings - Verify partner_kind ===")
    
    resp = requests.get(f"{BASE_URL}/admin/affiliate-destinations", 
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, f"GET list failed: {resp.status_code} {resp.text}"
    mappings = resp.json()
    
    amazon_woohoo = next((m for m in mappings 
                         if m.get("store_id") == ids["amazon_id"] 
                         and m.get("platform_id") == ids["woohoo_id"]), None)
    
    assert amazon_woohoo, "Amazon×Woohoo mapping not found in list"
    assert amazon_woohoo.get("partner_kind") == "gift_card", f"partner_kind should be 'gift_card', got {amazon_woohoo.get('partner_kind')}"
    assert amazon_woohoo.get("partner_name") == "Woohoo", f"partner_name should be 'Woohoo', got {amazon_woohoo.get('partner_name')}"
    assert amazon_woohoo.get("store_name") == "Amazon", f"store_name should be 'Amazon', got {amazon_woohoo.get('store_name')}"
    
    print(f"✓ Amazon×Woohoo mapping present in list")
    print(f"  partner_kind: {amazon_woohoo['partner_kind']}")
    print(f"  partner_name: {amazon_woohoo['partner_name']}")
    print(f"  store_name: {amazon_woohoo['store_name']}")

def test_step_4_redirect_with_store(token):
    """Step 4: GET /api/redirect/woohoo?store=Amazon → url == mapping url, mapping == true."""
    print("\n=== STEP 4: Redirect with Store Context ===")
    
    resp = requests.get(f"{BASE_URL}/redirect/woohoo?store=Amazon")
    assert resp.status_code == 200, f"GET redirect failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    assert data.get("url") == "https://woohoo.in/amazon?ref=yukti", f"url should be mapping url, got {data.get('url')}"
    assert data.get("mapping") == True, f"mapping should be True, got {data.get('mapping')}"
    assert data.get("partner") == "Woohoo", f"partner should be 'Woohoo', got {data.get('partner')}"
    assert data.get("store") == "Amazon", f"store should be 'Amazon', got {data.get('store')}"
    
    print(f"✓ Redirect with store context working")
    print(f"  url: {data['url']}")
    print(f"  mapping: {data['mapping']}")

def test_step_5_deactivate_mapping(token, mapping_id):
    """Step 5: PUT {active:false} → GET redirect falls back to generic Woohoo url, mapping == false."""
    print("\n=== STEP 5: Deactivate Mapping & Verify Fallback ===")
    
    # Deactivate
    resp = requests.put(f"{BASE_URL}/admin/affiliate-destinations/{mapping_id}",
                       headers={"Authorization": f"Bearer {token}"},
                       json={"active": False})
    assert resp.status_code == 200, f"PUT deactivate failed: {resp.status_code} {resp.text}"
    
    print(f"✓ Mapping deactivated")
    
    # Verify fallback
    resp = requests.get(f"{BASE_URL}/redirect/woohoo?store=Amazon")
    assert resp.status_code == 200, f"GET redirect failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    # Should fall back to generic Woohoo website_url
    assert data.get("mapping") == False, f"mapping should be False after deactivation, got {data.get('mapping')}"
    assert data.get("url") != "https://woohoo.in/amazon?ref=yukti", "Should NOT return mapping url when inactive"
    assert "woohoo.in" in data.get("url", "").lower(), f"Should return generic Woohoo url, got {data.get('url')}"
    
    print(f"✓ Fallback to generic Woohoo url working")
    print(f"  url: {data['url']}")
    print(f"  mapping: {data['mapping']}")
    
    # Reactivate for subsequent tests
    resp = requests.put(f"{BASE_URL}/admin/affiliate-destinations/{mapping_id}",
                       headers={"Authorization": f"Bearer {token}"},
                       json={"active": True})
    assert resp.status_code == 200, f"PUT reactivate failed: {resp.status_code} {resp.text}"
    print(f"✓ Mapping reactivated for subsequent tests")

def test_step_6_create_amazon_cashkaro_mapping(token, ids):
    """Step 6: POST Amazon×CashKaro (affiliate) → 200 (affiliate still works); GET redirect → mapping url, mapping == true."""
    print("\n=== STEP 6: Create Amazon×CashKaro (affiliate) Mapping ===")
    
    # Check if mapping already exists and delete it first
    resp = requests.get(f"{BASE_URL}/admin/affiliate-destinations", 
                       headers={"Authorization": f"Bearer {token}"})
    if resp.status_code == 200:
        mappings = resp.json()
        existing = next((m for m in mappings 
                        if m.get("store_id") == ids["amazon_id"] 
                        and m.get("platform_id") == ids["cashkaro_id"]), None)
        if existing:
            requests.delete(f"{BASE_URL}/admin/affiliate-destinations/{existing['id']}",
                          headers={"Authorization": f"Bearer {token}"})
            print(f"  Cleaned up existing Amazon×CashKaro mapping")
    
    resp = requests.post(f"{BASE_URL}/admin/affiliate-destinations", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={
                            "store_id": ids["amazon_id"],
                            "platform_id": ids["cashkaro_id"],
                            "destination_url": "https://cashkaro.com/amazon?ref=yukti",
                            "active": True
                        })
    
    assert resp.status_code == 200, f"POST Amazon×CashKaro failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    print(f"✓ Amazon×CashKaro mapping created successfully (affiliate still works)")
    print(f"  Mapping ID: {data['id']}")
    
    # Verify redirect
    resp = requests.get(f"{BASE_URL}/redirect/cashkaro?store=Amazon")
    assert resp.status_code == 200, f"GET redirect failed: {resp.status_code} {resp.text}"
    redirect_data = resp.json()
    
    assert redirect_data.get("url") == "https://cashkaro.com/amazon?ref=yukti", f"url should be mapping url, got {redirect_data.get('url')}"
    assert redirect_data.get("mapping") == True, f"mapping should be True, got {redirect_data.get('mapping')}"
    
    print(f"✓ Redirect working for affiliate mapping")
    print(f"  url: {redirect_data['url']}")
    print(f"  mapping: {redirect_data['mapping']}")
    
    return data["id"]

def test_step_7_create_firstcry_mappings(token, ids):
    """Step 7: POST Firstcry×CashKaro and Firstcry×Woohoo → both 200."""
    print("\n=== STEP 7: Create Firstcry Mappings ===")
    
    # Clean up existing mappings first
    resp = requests.get(f"{BASE_URL}/admin/affiliate-destinations", 
                       headers={"Authorization": f"Bearer {token}"})
    if resp.status_code == 200:
        mappings = resp.json()
        for combo in [(ids["firstcry_id"], ids["cashkaro_id"]), (ids["firstcry_id"], ids["woohoo_id"])]:
            existing = next((m for m in mappings 
                            if m.get("store_id") == combo[0] 
                            and m.get("platform_id") == combo[1]), None)
            if existing:
                requests.delete(f"{BASE_URL}/admin/affiliate-destinations/{existing['id']}",
                              headers={"Authorization": f"Bearer {token}"})
    
    # Firstcry×CashKaro
    resp = requests.post(f"{BASE_URL}/admin/affiliate-destinations", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={
                            "store_id": ids["firstcry_id"],
                            "platform_id": ids["cashkaro_id"],
                            "destination_url": "https://cashkaro.com/firstcry?ref=yukti",
                            "active": True
                        })
    assert resp.status_code == 200, f"POST Firstcry×CashKaro failed: {resp.status_code} {resp.text}"
    print(f"✓ Firstcry×CashKaro mapping created (ID: {resp.json()['id']})")
    
    # Firstcry×Woohoo
    resp = requests.post(f"{BASE_URL}/admin/affiliate-destinations", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={
                            "store_id": ids["firstcry_id"],
                            "platform_id": ids["woohoo_id"],
                            "destination_url": "https://woohoo.in/firstcry?ref=yukti",
                            "active": True
                        })
    assert resp.status_code == 200, f"POST Firstcry×Woohoo failed: {resp.status_code} {resp.text}"
    print(f"✓ Firstcry×Woohoo mapping created (ID: {resp.json()['id']})")
    
    return [resp.json()["id"]]

def test_step_8_duplicate_mapping(token, ids):
    """Step 8: POST duplicate Amazon×Woohoo → 409."""
    print("\n=== STEP 8: Duplicate Mapping Prevention ===")
    
    resp = requests.post(f"{BASE_URL}/admin/affiliate-destinations", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={
                            "store_id": ids["amazon_id"],
                            "platform_id": ids["woohoo_id"],
                            "destination_url": "https://woohoo.in/amazon-duplicate?ref=yukti",
                            "active": True
                        })
    
    assert resp.status_code == 409, f"Duplicate should return 409, got {resp.status_code}"
    print(f"✓ Duplicate mapping correctly rejected with 409")

def test_step_9_unsafe_urls(token, ids):
    """Step 9: POST unsafe destination_url values → 400 each."""
    print("\n=== STEP 9: Unsafe URL Validation ===")
    
    unsafe_urls = [
        "javascript:alert(1)",
        "data:text/html,x",
        "file:///etc/passwd",
        "notaurl"
    ]
    
    for unsafe_url in unsafe_urls:
        resp = requests.post(f"{BASE_URL}/admin/affiliate-destinations", 
                            headers={"Authorization": f"Bearer {token}"},
                            json={
                                "store_id": ids["amazon_id"],
                                "platform_id": ids["cashkaro_id"],
                                "destination_url": unsafe_url,
                                "active": True
                            })
        
        assert resp.status_code == 400, f"Unsafe URL '{unsafe_url}' should return 400, got {resp.status_code}"
        print(f"✓ Unsafe URL '{unsafe_url}' correctly rejected with 400")

def test_step_10_invalid_kind_platform(token, ids):
    """Step 10: POST with a platform whose kind is neither affiliate nor gift_card → 400 (or skip if none exists)."""
    print("\n=== STEP 10: Invalid Platform Kind Validation ===")
    
    # Get all platforms
    resp = requests.get(f"{BASE_URL}/admin/platforms", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, f"GET platforms failed: {resp.status_code} {resp.text}"
    platforms = resp.json()
    
    # Find a platform with kind not in {affiliate, gift_card}
    invalid_platform = next((p for p in platforms 
                            if p.get("kind") not in ("affiliate", "gift_card")), None)
    
    if invalid_platform:
        resp = requests.post(f"{BASE_URL}/admin/affiliate-destinations", 
                            headers={"Authorization": f"Bearer {token}"},
                            json={
                                "store_id": ids["amazon_id"],
                                "platform_id": invalid_platform["id"],
                                "destination_url": "https://example.com/test",
                                "active": True
                            })
        
        assert resp.status_code == 400, f"Invalid kind platform should return 400, got {resp.status_code}"
        print(f"✓ Platform with kind '{invalid_platform.get('kind')}' correctly rejected with 400")
    else:
        print(f"⊘ No platform with invalid kind found (all platforms are affiliate or gift_card) - SKIPPED")

def test_step_11_authorization_checks(token):
    """Step 11: Register fresh shopper (no roles); shopper POST/PUT/DELETE → 401/403. Unauthenticated POST → 401/403."""
    print("\n=== STEP 11: Authorization Checks ===")
    
    # Register fresh shopper
    shopper_token, shopper_email = register_shopper()
    print(f"✓ Fresh shopper registered: {shopper_email}")
    
    # Shopper POST
    resp = requests.post(f"{BASE_URL}/admin/affiliate-destinations", 
                        headers={"Authorization": f"Bearer {shopper_token}"},
                        json={
                            "store_id": "test",
                            "platform_id": "test",
                            "destination_url": "https://example.com",
                            "active": True
                        })
    assert resp.status_code in (401, 403), f"Shopper POST should return 401/403, got {resp.status_code}"
    print(f"✓ Shopper POST correctly blocked with {resp.status_code}")
    
    # Shopper PUT
    resp = requests.put(f"{BASE_URL}/admin/affiliate-destinations/test-id",
                       headers={"Authorization": f"Bearer {shopper_token}"},
                       json={"active": False})
    assert resp.status_code in (401, 403), f"Shopper PUT should return 401/403, got {resp.status_code}"
    print(f"✓ Shopper PUT correctly blocked with {resp.status_code}")
    
    # Shopper DELETE
    resp = requests.delete(f"{BASE_URL}/admin/affiliate-destinations/test-id",
                          headers={"Authorization": f"Bearer {shopper_token}"})
    assert resp.status_code in (401, 403), f"Shopper DELETE should return 401/403, got {resp.status_code}"
    print(f"✓ Shopper DELETE correctly blocked with {resp.status_code}")
    
    # Unauthenticated POST
    resp = requests.post(f"{BASE_URL}/admin/affiliate-destinations", 
                        json={
                            "store_id": "test",
                            "platform_id": "test",
                            "destination_url": "https://example.com",
                            "active": True
                        })
    assert resp.status_code in (401, 403), f"Unauthenticated POST should return 401/403, got {resp.status_code}"
    print(f"✓ Unauthenticated POST correctly blocked with {resp.status_code}")

def test_step_12_legacy_redirect_behavior(token):
    """Step 12: GET /api/redirect/woohoo (no store) → generic Woohoo url, mapping == false (legacy intact); 
    GET /api/redirect/cashkaro (no store) → generic, mapping == false."""
    print("\n=== STEP 12: Legacy Redirect Behavior (no store param) ===")
    
    # Woohoo without store
    resp = requests.get(f"{BASE_URL}/redirect/woohoo")
    assert resp.status_code == 200, f"GET redirect woohoo failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    assert data.get("mapping") == False, f"mapping should be False without store param, got {data.get('mapping')}"
    assert "woohoo.in" in data.get("url", "").lower(), f"Should return generic Woohoo url, got {data.get('url')}"
    print(f"✓ Woohoo redirect without store returns generic url (mapping=False)")
    print(f"  url: {data['url']}")
    
    # CashKaro without store
    resp = requests.get(f"{BASE_URL}/redirect/cashkaro")
    assert resp.status_code == 200, f"GET redirect cashkaro failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    assert data.get("mapping") == False, f"mapping should be False without store param, got {data.get('mapping')}"
    assert "cashkaro.com" in data.get("url", "").lower(), f"Should return generic CashKaro url, got {data.get('url')}"
    print(f"✓ CashKaro redirect without store returns generic url (mapping=False)")
    print(f"  url: {data['url']}")

def test_step_13_regression_calculation(token):
    """Step 13 (REGRESSION): POST /api/calculate Firstcry → extra_saved.rupees == 88, final_bill.rupees == 1251."""
    print("\n=== STEP 13: REGRESSION - Firstcry Calculation ===")
    
    resp = requests.post(f"{BASE_URL}/calculate", json={
        "store_name": "Firstcry",
        "category": "All",
        "customer_type": "existing",
        "mrp": 1599,
        "price": 1338
    })
    
    assert resp.status_code == 200, f"POST calculate failed: {resp.status_code} {resp.text}"
    data = resp.json()
    
    extra_saved = data.get("summary", {}).get("extra_saved", {}).get("rupees")
    final_bill = data.get("summary", {}).get("final_bill", {}).get("rupees")
    
    assert extra_saved == 88, f"extra_saved.rupees should be 88, got {extra_saved}"
    assert final_bill == 1251, f"final_bill.rupees should be 1251, got {final_bill}"
    
    print(f"✓ Firstcry calculation UNCHANGED")
    print(f"  extra_saved: ₹{extra_saved}")
    print(f"  final_bill: ₹{final_bill}")

def cleanup_test_mappings(token, ids):
    """Clean up test mappings created during testing."""
    print("\n=== CLEANUP: Removing Test Mappings ===")
    
    # Get all mappings
    resp = requests.get(f"{BASE_URL}/admin/affiliate-destinations", 
                       headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        print(f"⚠ Could not fetch mappings for cleanup: {resp.status_code}")
        return
    
    mappings = resp.json()
    
    # Delete test mappings (Amazon×Woohoo, Amazon×CashKaro, Firstcry×CashKaro, Firstcry×Woohoo)
    test_combos = [
        (ids["amazon_id"], ids["woohoo_id"]),
        (ids["amazon_id"], ids["cashkaro_id"]),
        (ids["firstcry_id"], ids["cashkaro_id"]),
        (ids["firstcry_id"], ids["woohoo_id"])
    ]
    
    deleted_count = 0
    for store_id, platform_id in test_combos:
        mapping = next((m for m in mappings 
                       if m.get("store_id") == store_id 
                       and m.get("platform_id") == platform_id), None)
        if mapping:
            resp = requests.delete(f"{BASE_URL}/admin/affiliate-destinations/{mapping['id']}",
                                  headers={"Authorization": f"Bearer {token}"})
            if resp.status_code == 200:
                deleted_count += 1
                print(f"✓ Deleted mapping: {mapping.get('store_name')}×{mapping.get('partner_name')}")
    
    print(f"✓ Cleanup complete: {deleted_count} test mappings removed")

def main():
    print("=" * 80)
    print("PARTNER DESTINATIONS CORRECTION TEST SUITE")
    print("Testing: affiliate_destinations now supports BOTH affiliate AND gift_card")
    print("=" * 80)
    
    try:
        # Login
        token = login_admin()
        print("✓ Admin login successful")
        
        # Step 1: Get IDs
        ids = test_step_1_get_store_and_platform_ids(token)
        
        # Cleanup any existing test mappings first
        print("\n=== PRE-TEST CLEANUP ===")
        cleanup_test_mappings(token, ids)
        
        # Step 2: Create Amazon×Woohoo (gift_card) - CORE FIX
        mapping_id = test_step_2_create_amazon_woohoo_mapping(token, ids)
        
        # Step 3: List shows partner_kind
        test_step_3_list_shows_partner_kind(token, ids)
        
        # Step 4: Redirect with store context
        test_step_4_redirect_with_store(token)
        
        # Step 5: Deactivate and verify fallback
        test_step_5_deactivate_mapping(token, mapping_id)
        
        # Step 6: Create Amazon×CashKaro (affiliate still works)
        cashkaro_mapping_id = test_step_6_create_amazon_cashkaro_mapping(token, ids)
        
        # Step 7: Create Firstcry mappings
        test_step_7_create_firstcry_mappings(token, ids)
        
        # Step 8: Duplicate prevention
        test_step_8_duplicate_mapping(token, ids)
        
        # Step 9: Unsafe URL validation
        test_step_9_unsafe_urls(token, ids)
        
        # Step 10: Invalid kind platform
        test_step_10_invalid_kind_platform(token, ids)
        
        # Step 11: Authorization checks
        test_step_11_authorization_checks(token)
        
        # Step 12: Legacy redirect behavior
        test_step_12_legacy_redirect_behavior(token)
        
        # Step 13: Regression - Firstcry calculation
        test_step_13_regression_calculation(token)
        
        # Cleanup
        cleanup_test_mappings(token, ids)
        
        print("\n" + "=" * 80)
        print("✅ ALL TESTS PASSED - PARTNER DESTINATIONS CORRECTION VERIFIED")
        print("=" * 80)
        print("\nKEY FINDINGS:")
        print("✓ Gift card partners (kind='gift_card') are now ACCEPTED in affiliate_destinations")
        print("✓ Affiliate partners (kind='affiliate') still work correctly")
        print("✓ List response includes partner_kind field")
        print("✓ Redirect resolution works for both affiliate and gift_card mappings")
        print("✓ Validation, authorization, and security checks all working")
        print("✓ Legacy behavior (no store param) unchanged")
        print("✓ Regression test passed (Firstcry calculation unchanged)")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
