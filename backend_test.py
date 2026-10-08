#!/usr/bin/env python3
"""
STEP 4B Phase 1 Backend Test Suite
Tests the new "My Cards & Offers" card profile CRUD endpoints.
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
    return f"test_{rand}@example.com"

def register_shopper(full_name: str, mobile: str) -> dict:
    """Register a new shopper and return {email, password, token}."""
    email = random_email()
    password = "Test1234"
    payload = {
        "full_name": full_name,
        "gender": "female",
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
        "token": data.get("access_token")
    }

def login_shopper(email: str, password: str) -> str:
    """Login and return access_token."""
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        raise Exception(f"Failed to login: {resp.status_code} {resp.text}")
    return resp.json().get("access_token")

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

def test_1_guest_access():
    """Test 1: Guest (no token) should get 401 on GET/POST /api/cards."""
    print_test(1, "Guest access (no token) → 401")
    
    # GET /api/cards without token
    resp = requests.get(f"{BASE_URL}/cards")
    if resp.status_code == 401:
        print_pass(f"GET /api/cards without token → 401")
    else:
        print_fail(f"GET /api/cards without token → {resp.status_code} (expected 401)")
    
    # POST /api/cards without token
    payload = {"bank_name": "HDFC Bank", "card_type": "Credit", "card_network": "Visa"}
    resp = requests.post(f"{BASE_URL}/cards", json=payload)
    if resp.status_code == 401:
        print_pass(f"POST /api/cards without token → 401")
    else:
        print_fail(f"POST /api/cards without token → {resp.status_code} (expected 401)")

def test_2_create_first_card(shopper_a: dict):
    """Test 2: Register Shopper A; POST HDFC Bank / Credit / Visa → 201, verify response fields."""
    print_test(2, "Create first card and verify response fields")
    
    payload = {"bank_name": "HDFC Bank", "card_type": "Credit", "card_network": "Visa"}
    resp = requests.post(f"{BASE_URL}/cards", json=payload, headers=headers_with_token(shopper_a["token"]))
    
    if resp.status_code != 201:
        print_fail(f"POST /api/cards → {resp.status_code} (expected 201). Response: {resp.text}")
        return None
    
    print_pass(f"POST /api/cards → 201")
    
    data = resp.json()
    print_info(f"Response: {json.dumps(data, indent=2)}")
    
    # Verify response contains ONLY: id, bank_name, card_type, card_network, created_at
    required_fields = {"id", "bank_name", "card_type", "card_network", "created_at"}
    forbidden_fields = {"user_id", "_id", "updated_at", "card_number", "cvv", "expiry", "pin"}
    
    actual_fields = set(data.keys())
    
    if required_fields.issubset(actual_fields):
        print_pass(f"Response contains all required fields: {required_fields}")
    else:
        missing = required_fields - actual_fields
        print_fail(f"Response missing required fields: {missing}")
    
    forbidden_present = actual_fields & forbidden_fields
    if not forbidden_present:
        print_pass(f"Response contains NO forbidden fields (user_id, _id, sensitive fields)")
    else:
        print_fail(f"Response contains forbidden fields: {forbidden_present}")
    
    # Verify values
    if data.get("bank_name") == "HDFC Bank":
        print_pass(f"bank_name = 'HDFC Bank'")
    else:
        print_fail(f"bank_name = '{data.get('bank_name')}' (expected 'HDFC Bank')")
    
    if data.get("card_type") == "Credit":
        print_pass(f"card_type = 'Credit'")
    else:
        print_fail(f"card_type = '{data.get('card_type')}' (expected 'Credit')")
    
    if data.get("card_network") == "Visa":
        print_pass(f"card_network = 'Visa'")
    else:
        print_fail(f"card_network = '{data.get('card_network')}' (expected 'Visa')")
    
    return data.get("id")

def test_3_multiple_cards_and_list(shopper_a: dict):
    """Test 3: POST ICICI/Credit/Mastercard, POST SBI/Debit/RuPay, GET /api/cards → exactly 3 cards."""
    print_test(3, "Create multiple cards and verify list")
    
    # POST ICICI Bank / Credit / Mastercard
    payload1 = {"bank_name": "ICICI Bank", "card_type": "Credit", "card_network": "Mastercard"}
    resp1 = requests.post(f"{BASE_URL}/cards", json=payload1, headers=headers_with_token(shopper_a["token"]))
    if resp1.status_code == 201:
        print_pass(f"POST ICICI Bank / Credit / Mastercard → 201")
    else:
        print_fail(f"POST ICICI Bank / Credit / Mastercard → {resp1.status_code} (expected 201)")
    
    # POST SBI / Debit / RuPay
    payload2 = {"bank_name": "SBI", "card_type": "Debit", "card_network": "RuPay"}
    resp2 = requests.post(f"{BASE_URL}/cards", json=payload2, headers=headers_with_token(shopper_a["token"]))
    if resp2.status_code == 201:
        print_pass(f"POST SBI / Debit / RuPay → 201")
    else:
        print_fail(f"POST SBI / Debit / RuPay → {resp2.status_code} (expected 201)")
    
    # GET /api/cards
    resp = requests.get(f"{BASE_URL}/cards", headers=headers_with_token(shopper_a["token"]))
    if resp.status_code != 200:
        print_fail(f"GET /api/cards → {resp.status_code} (expected 200)")
        return []
    
    cards = resp.json()
    print_info(f"GET /api/cards returned {len(cards)} cards")
    
    if len(cards) == 3:
        print_pass(f"GET /api/cards → exactly 3 cards")
    else:
        print_fail(f"GET /api/cards → {len(cards)} cards (expected 3)")
    
    # Verify card details
    banks = [c.get("bank_name") for c in cards]
    expected_banks = ["HDFC Bank", "ICICI Bank", "SBI"]
    if set(banks) == set(expected_banks):
        print_pass(f"Cards contain expected banks: {expected_banks}")
    else:
        print_fail(f"Cards contain banks: {banks} (expected {expected_banks})")
    
    return cards

def test_4_duplicate_prevention(shopper_a: dict):
    """Test 4: Duplicate prevention (case/space insensitive)."""
    print_test(4, "Duplicate prevention (case/space insensitive)")
    
    # POST "hdfc  bank" (different case/spacing) / Credit / Visa → should be 409
    payload1 = {"bank_name": "hdfc  bank", "card_type": "Credit", "card_network": "Visa"}
    resp1 = requests.post(f"{BASE_URL}/cards", json=payload1, headers=headers_with_token(shopper_a["token"]))
    if resp1.status_code == 409:
        print_pass(f"POST 'hdfc  bank' / Credit / Visa → 409 (duplicate detected)")
    else:
        print_fail(f"POST 'hdfc  bank' / Credit / Visa → {resp1.status_code} (expected 409)")
    
    # POST HDFC Bank / DEBIT / Visa → should be 201 (different type = not duplicate)
    payload2 = {"bank_name": "HDFC Bank", "card_type": "Debit", "card_network": "Visa"}
    resp2 = requests.post(f"{BASE_URL}/cards", json=payload2, headers=headers_with_token(shopper_a["token"]))
    if resp2.status_code == 201:
        print_pass(f"POST HDFC Bank / Debit / Visa → 201 (different type allowed)")
    else:
        print_fail(f"POST HDFC Bank / Debit / Visa → {resp2.status_code} (expected 201)")

def test_5_validation(shopper_a: dict):
    """Test 5: Required-field & enum validation."""
    print_test(5, "Required-field & enum validation")
    
    # Missing bank_name → 422
    payload1 = {"card_type": "Credit", "card_network": "Visa"}
    resp1 = requests.post(f"{BASE_URL}/cards", json=payload1, headers=headers_with_token(shopper_a["token"]))
    if resp1.status_code == 422:
        print_pass(f"Missing bank_name → 422")
    else:
        print_fail(f"Missing bank_name → {resp1.status_code} (expected 422)")
    
    # card_type "Prepaid" → 422
    payload2 = {"bank_name": "Test Bank", "card_type": "Prepaid", "card_network": "Visa"}
    resp2 = requests.post(f"{BASE_URL}/cards", json=payload2, headers=headers_with_token(shopper_a["token"]))
    if resp2.status_code == 422:
        print_pass(f"card_type 'Prepaid' → 422")
    else:
        print_fail(f"card_type 'Prepaid' → {resp2.status_code} (expected 422)")
    
    # card_network "Diners" → 422
    payload3 = {"bank_name": "Test Bank", "card_type": "Credit", "card_network": "Diners"}
    resp3 = requests.post(f"{BASE_URL}/cards", json=payload3, headers=headers_with_token(shopper_a["token"]))
    if resp3.status_code == 422:
        print_pass(f"card_network 'Diners' → 422")
    else:
        print_fail(f"card_network 'Diners' → {resp3.status_code} (expected 422)")
    
    # bank_name of 100 chars → 422
    payload4 = {"bank_name": "A" * 100, "card_type": "Credit", "card_network": "Visa"}
    resp4 = requests.post(f"{BASE_URL}/cards", json=payload4, headers=headers_with_token(shopper_a["token"]))
    if resp4.status_code == 422:
        print_pass(f"bank_name of 100 chars → 422")
    else:
        print_fail(f"bank_name of 100 chars → {resp4.status_code} (expected 422)")

def test_6_security_extra_fields(shopper_a: dict):
    """Test 6: SECURITY - extra sensitive fields must be rejected."""
    print_test(6, "SECURITY: Extra sensitive fields rejected")
    
    # POST with extra sensitive fields → must be 422
    payload = {
        "bank_name": "Axis Bank",
        "card_type": "Credit",
        "card_network": "Visa",
        "card_number": "4111111111111111",
        "cvv": "123",
        "expiry": "12/28",
        "pin": "1234"
    }
    resp = requests.post(f"{BASE_URL}/cards", json=payload, headers=headers_with_token(shopper_a["token"]))
    if resp.status_code == 422:
        print_pass(f"POST with extra sensitive fields → 422 (rejected)")
    else:
        print_fail(f"POST with extra sensitive fields → {resp.status_code} (expected 422)")
    
    print_info("Note: MongoDB verification (mongosh) should be done manually to confirm NO documents contain card_number/cvv/expiry/pin fields")

def test_7_cross_user_isolation(shopper_a: dict):
    """Test 7: Cross-user isolation."""
    print_test(7, "Cross-user isolation")
    
    # Register Shopper B
    print_info("Registering Shopper B...")
    shopper_b = register_shopper("Shopper B", "9876543210")
    print_pass(f"Shopper B registered: {shopper_b['email']}")
    
    # GET /api/cards as B → should be empty
    resp = requests.get(f"{BASE_URL}/cards", headers=headers_with_token(shopper_b["token"]))
    if resp.status_code == 200:
        cards_b = resp.json()
        if len(cards_b) == 0:
            print_pass(f"GET /api/cards as Shopper B → [] (empty)")
        else:
            print_fail(f"GET /api/cards as Shopper B → {len(cards_b)} cards (expected 0)")
    else:
        print_fail(f"GET /api/cards as Shopper B → {resp.status_code} (expected 200)")
    
    # Get one of A's card IDs
    resp_a = requests.get(f"{BASE_URL}/cards", headers=headers_with_token(shopper_a["token"]))
    cards_a = resp_a.json()
    if len(cards_a) > 0:
        card_id_a = cards_a[0]["id"]
        print_info(f"Using Shopper A's card ID: {card_id_a}")
        
        # B attempts PUT on A's card → should be 404
        payload = {"bank_name": "Hacked Bank", "card_type": "Credit", "card_network": "Visa"}
        resp_put = requests.put(f"{BASE_URL}/cards/{card_id_a}", json=payload, headers=headers_with_token(shopper_b["token"]))
        if resp_put.status_code == 404:
            print_pass(f"Shopper B PUT on A's card → 404 (not found)")
        else:
            print_fail(f"Shopper B PUT on A's card → {resp_put.status_code} (expected 404)")
        
        # B attempts DELETE on A's card → should be 404
        resp_del = requests.delete(f"{BASE_URL}/cards/{card_id_a}", headers=headers_with_token(shopper_b["token"]))
        if resp_del.status_code == 404:
            print_pass(f"Shopper B DELETE on A's card → 404 (not found)")
        else:
            print_fail(f"Shopper B DELETE on A's card → {resp_del.status_code} (expected 404)")
        
        # Verify A's cards are unaffected
        resp_a_after = requests.get(f"{BASE_URL}/cards", headers=headers_with_token(shopper_a["token"]))
        cards_a_after = resp_a_after.json()
        if len(cards_a_after) == len(cards_a):
            print_pass(f"Shopper A's cards remain unaffected ({len(cards_a)} cards)")
        else:
            print_fail(f"Shopper A's cards changed: {len(cards_a)} → {len(cards_a_after)}")
    else:
        print_fail("Shopper A has no cards to test cross-user isolation")
    
    return shopper_b

def test_8_edit_card(shopper_a: dict, cards: list):
    """Test 8: Edit card functionality."""
    print_test(8, "Edit card functionality")
    
    if len(cards) == 0:
        print_fail("No cards available to test edit")
        return
    
    # Find HDFC card
    hdfc_card = next((c for c in cards if c.get("bank_name") == "HDFC Bank" and c.get("card_type") == "Credit"), None)
    if not hdfc_card:
        print_fail("HDFC Bank / Credit / Visa card not found")
        return
    
    card_id = hdfc_card["id"]
    print_info(f"Editing card ID: {card_id}")
    
    # Update to HDFC Bank / Debit / RuPay
    payload = {"bank_name": "HDFC Bank", "card_type": "Debit", "card_network": "RuPay"}
    resp = requests.put(f"{BASE_URL}/cards/{card_id}", json=payload, headers=headers_with_token(shopper_a["token"]))
    
    if resp.status_code == 200:
        print_pass(f"PUT /api/cards/{card_id} → 200")
        data = resp.json()
        if data.get("card_type") == "Debit" and data.get("card_network") == "RuPay":
            print_pass(f"Card updated to Debit / RuPay")
        else:
            print_fail(f"Card not updated correctly: {data}")
    else:
        print_fail(f"PUT /api/cards/{card_id} → {resp.status_code} (expected 200)")
    
    # Verify GET reflects change
    resp_get = requests.get(f"{BASE_URL}/cards", headers=headers_with_token(shopper_a["token"]))
    cards_after = resp_get.json()
    updated_card = next((c for c in cards_after if c.get("id") == card_id), None)
    if updated_card:
        if updated_card.get("card_type") == "Debit" and updated_card.get("card_network") == "RuPay":
            print_pass(f"GET /api/cards reflects updated values")
        else:
            print_fail(f"GET /api/cards does not reflect updated values: {updated_card}")
    else:
        print_fail(f"Updated card not found in GET /api/cards")
    
    # Test duplicate on edit: try to set ICICI card to SBI/Debit/RuPay (should be 409)
    icici_card = next((c for c in cards_after if c.get("bank_name") == "ICICI Bank"), None)
    if icici_card:
        payload_dup = {"bank_name": "SBI", "card_type": "Debit", "card_network": "RuPay"}
        resp_dup = requests.put(f"{BASE_URL}/cards/{icici_card['id']}", json=payload_dup, headers=headers_with_token(shopper_a["token"]))
        if resp_dup.status_code == 409:
            print_pass(f"Edit that would duplicate existing card → 409")
        else:
            print_fail(f"Edit that would duplicate existing card → {resp_dup.status_code} (expected 409)")

def test_9_delete_card(shopper_a: dict):
    """Test 9: Delete card functionality."""
    print_test(9, "Delete card functionality")
    
    # Get current cards
    resp = requests.get(f"{BASE_URL}/cards", headers=headers_with_token(shopper_a["token"]))
    cards_before = resp.json()
    count_before = len(cards_before)
    print_info(f"Cards before delete: {count_before}")
    
    if count_before == 0:
        print_fail("No cards available to test delete")
        return
    
    # Delete first card
    card_id = cards_before[0]["id"]
    print_info(f"Deleting card ID: {card_id}")
    
    resp_del = requests.delete(f"{BASE_URL}/cards/{card_id}", headers=headers_with_token(shopper_a["token"]))
    if resp_del.status_code == 200:
        data = resp_del.json()
        if data.get("ok") == True:
            print_pass(f"DELETE /api/cards/{card_id} → {{ok: true}}")
        else:
            print_fail(f"DELETE /api/cards/{card_id} → {data} (expected {{ok: true}})")
    else:
        print_fail(f"DELETE /api/cards/{card_id} → {resp_del.status_code} (expected 200)")
    
    # Verify count decreased
    resp_after = requests.get(f"{BASE_URL}/cards", headers=headers_with_token(shopper_a["token"]))
    cards_after = resp_after.json()
    count_after = len(cards_after)
    
    if count_after == count_before - 1:
        print_pass(f"Card count decreased: {count_before} → {count_after}")
    else:
        print_fail(f"Card count: {count_before} → {count_after} (expected {count_before - 1})")
    
    # Delete same card again → should be 404
    resp_del2 = requests.delete(f"{BASE_URL}/cards/{card_id}", headers=headers_with_token(shopper_a["token"]))
    if resp_del2.status_code == 404:
        print_pass(f"DELETE same card again → 404")
    else:
        print_fail(f"DELETE same card again → {resp_del2.status_code} (expected 404)")

def test_10_persistence(shopper_a: dict):
    """Test 10: Logout/login persistence."""
    print_test(10, "Logout/login persistence")
    
    # Get cards before logout
    resp_before = requests.get(f"{BASE_URL}/cards", headers=headers_with_token(shopper_a["token"]))
    cards_before = resp_before.json()
    count_before = len(cards_before)
    print_info(f"Cards before logout: {count_before}")
    
    # Login again
    print_info(f"Logging in again as {shopper_a['email']}...")
    new_token = login_shopper(shopper_a["email"], shopper_a["password"])
    print_pass(f"Login successful, new token obtained")
    
    # Get cards after login
    resp_after = requests.get(f"{BASE_URL}/cards", headers=headers_with_token(new_token))
    if resp_after.status_code == 200:
        cards_after = resp_after.json()
        count_after = len(cards_after)
        
        if count_after == count_before:
            print_pass(f"Cards persisted after logout/login: {count_after} cards")
        else:
            print_fail(f"Card count changed: {count_before} → {count_after}")
        
        # Verify card IDs match
        ids_before = sorted([c["id"] for c in cards_before])
        ids_after = sorted([c["id"] for c in cards_after])
        if ids_before == ids_after:
            print_pass(f"Same cards returned after login")
        else:
            print_fail(f"Different cards returned after login")
    else:
        print_fail(f"GET /api/cards after login → {resp_after.status_code} (expected 200)")

def test_11_calculation_isolation(shopper_a: dict):
    """Test 11: CALCULATION ISOLATION - cards should NOT affect calculation."""
    print_test(11, "CALCULATION ISOLATION (CRITICAL)")
    
    calc_payload = {
        "store_name": "Amazon",
        "category": "Electronics",
        "customer_type": "existing",
        "mrp": 10000,
        "price": 9000
    }
    
    # Calculate as guest (no token)
    print_info("Calculating as guest (no token)...")
    resp_guest = requests.post(f"{BASE_URL}/calculate", json=calc_payload)
    if resp_guest.status_code != 200:
        print_fail(f"Guest calculation failed: {resp_guest.status_code} {resp_guest.text}")
        return
    
    guest_result = resp_guest.json()
    guest_summary = guest_result.get("summary", {})
    
    # Extract values - summary fields are objects with 'exact' and 'rupees' keys
    guest_extra = guest_summary.get('extra_saved', {}).get('exact') if isinstance(guest_summary.get('extra_saved'), dict) else guest_summary.get('extra_saved')
    guest_final = guest_summary.get('final_bill', {}).get('exact') if isinstance(guest_summary.get('final_bill'), dict) else guest_summary.get('final_bill')
    guest_total = guest_summary.get('total_saving', {}).get('exact') if isinstance(guest_summary.get('total_saving'), dict) else guest_summary.get('total_saving')
    guest_version = guest_result.get('rate_version', 'v1')  # Check root level
    
    print_info(f"Guest result: extra_saved={guest_extra}, final_bill={guest_final}, total_saving={guest_total}, rate_version={guest_version}")
    
    # Calculate as Shopper A (with cards)
    print_info("Calculating as Shopper A (with cards)...")
    resp_shopper = requests.post(f"{BASE_URL}/calculate", json=calc_payload, headers=headers_with_token(shopper_a["token"]))
    if resp_shopper.status_code != 200:
        print_fail(f"Shopper calculation failed: {resp_shopper.status_code} {resp_shopper.text}")
        return
    
    shopper_result = resp_shopper.json()
    shopper_summary = shopper_result.get("summary", {})
    
    # Extract values
    shopper_extra = shopper_summary.get('extra_saved', {}).get('exact') if isinstance(shopper_summary.get('extra_saved'), dict) else shopper_summary.get('extra_saved')
    shopper_final = shopper_summary.get('final_bill', {}).get('exact') if isinstance(shopper_summary.get('final_bill'), dict) else shopper_summary.get('final_bill')
    shopper_total = shopper_summary.get('total_saving', {}).get('exact') if isinstance(shopper_summary.get('total_saving'), dict) else shopper_summary.get('total_saving')
    shopper_version = shopper_result.get('rate_version', 'v1')  # Check root level
    
    print_info(f"Shopper result: extra_saved={shopper_extra}, final_bill={shopper_final}, total_saving={shopper_total}, rate_version={shopper_version}")
    
    # Compare results - they MUST be identical
    expected_extra = "515.00"
    expected_final = "8485.00"
    expected_total = "1515.00"
    expected_version = "v1"
    
    all_match = True
    
    if guest_extra == expected_extra:
        print_pass(f"Guest extra_saved = {expected_extra}")
    else:
        print_fail(f"Guest extra_saved = {guest_extra} (expected {expected_extra})")
        all_match = False
    
    if guest_final == expected_final:
        print_pass(f"Guest final_bill = {expected_final}")
    else:
        print_fail(f"Guest final_bill = {guest_final} (expected {expected_final})")
        all_match = False
    
    if guest_total == expected_total:
        print_pass(f"Guest total_saving = {expected_total}")
    else:
        print_fail(f"Guest total_saving = {guest_total} (expected {expected_total})")
        all_match = False
    
    if guest_version == expected_version:
        print_pass(f"Guest rate_version = {expected_version}")
    else:
        print_fail(f"Guest rate_version = {guest_version} (expected {expected_version})")
        all_match = False
    
    if shopper_extra == expected_extra:
        print_pass(f"Shopper extra_saved = {expected_extra}")
    else:
        print_fail(f"Shopper extra_saved = {shopper_extra} (expected {expected_extra})")
        all_match = False
    
    if shopper_final == expected_final:
        print_pass(f"Shopper final_bill = {expected_final}")
    else:
        print_fail(f"Shopper final_bill = {shopper_final} (expected {expected_final})")
        all_match = False
    
    if shopper_total == expected_total:
        print_pass(f"Shopper total_saving = {expected_total}")
    else:
        print_fail(f"Shopper total_saving = {shopper_total} (expected {expected_total})")
        all_match = False
    
    if shopper_version == expected_version:
        print_pass(f"Shopper rate_version = {expected_version}")
    else:
        print_fail(f"Shopper rate_version = {shopper_version} (expected {expected_version})")
        all_match = False
    
    if all_match:
        print_pass("✅ CRITICAL: Guest and Shopper calculations are IDENTICAL - cards do NOT affect calculation")
    else:
        print_fail("❌ CRITICAL: Guest and Shopper calculations DIFFER - cards may be affecting calculation")

def test_12_regression_sanity():
    """Test 12: Regression sanity checks."""
    print_test(12, "Regression sanity checks")
    
    # POST /api/detect
    detect_payload = {"url": "https://www.amazon.in/dp/B0ABC123"}
    resp_detect = requests.post(f"{BASE_URL}/detect", json=detect_payload)
    if resp_detect.status_code == 200:
        data = resp_detect.json()
        # Check if store is a dict with store_name or a string
        store = data.get("store")
        store_name = store.get("store_name") if isinstance(store, dict) else store
        if store_name == "Amazon":
            print_pass(f"POST /api/detect → Amazon detected")
        else:
            print_fail(f"POST /api/detect → store_name={store_name} (expected Amazon)")
    else:
        print_fail(f"POST /api/detect → {resp_detect.status_code} (expected 200)")
    
    # GET /api/redirect/cashkaro
    resp_redirect = requests.get(f"{BASE_URL}/redirect/cashkaro")
    if resp_redirect.status_code == 200:
        data = resp_redirect.json()
        if data.get("url") == "https://cashkaro.com":
            print_pass(f"GET /api/redirect/cashkaro → https://cashkaro.com")
        else:
            print_fail(f"GET /api/redirect/cashkaro → url={data.get('url')} (expected https://cashkaro.com)")
    else:
        print_fail(f"GET /api/redirect/cashkaro → {resp_redirect.status_code} (expected 200)")
    
    # GET /api/
    resp_health = requests.get(f"{BASE_URL}/")
    if resp_health.status_code == 200:
        data = resp_health.json()
        if data.get("status") == "ok":
            print_pass(f"GET /api/ → status ok")
        else:
            print_fail(f"GET /api/ → status={data.get('status')} (expected ok)")
    else:
        print_fail(f"GET /api/ → {resp_health.status_code} (expected 200)")

# =============================================================================
# MAIN TEST RUNNER
# =============================================================================

def main():
    print("\n" + "="*80)
    print("STEP 4B Phase 1 Backend Test Suite")
    print("Testing: My Cards & Offers - Card Profile CRUD")
    print("="*80)
    
    try:
        # Test 1: Guest access
        test_1_guest_access()
        
        # Register Shopper A
        print_info("\nRegistering Shopper A...")
        shopper_a = register_shopper("Shopper A", "9123456789")
        print_pass(f"Shopper A registered: {shopper_a['email']}")
        
        # Test 2: Create first card
        card_id_1 = test_2_create_first_card(shopper_a)
        
        # Test 3: Multiple cards and list
        cards = test_3_multiple_cards_and_list(shopper_a)
        
        # Test 4: Duplicate prevention
        test_4_duplicate_prevention(shopper_a)
        
        # Test 5: Validation
        test_5_validation(shopper_a)
        
        # Test 6: Security - extra fields
        test_6_security_extra_fields(shopper_a)
        
        # Test 7: Cross-user isolation
        shopper_b = test_7_cross_user_isolation(shopper_a)
        
        # Test 8: Edit card
        test_8_edit_card(shopper_a, cards)
        
        # Test 9: Delete card
        test_9_delete_card(shopper_a)
        
        # Test 10: Persistence
        test_10_persistence(shopper_a)
        
        # Test 11: Calculation isolation (CRITICAL)
        test_11_calculation_isolation(shopper_a)
        
        # Test 12: Regression sanity
        test_12_regression_sanity()
        
        print("\n" + "="*80)
        print("TEST SUITE COMPLETE")
        print("="*80)
        print("\nNote: Manual MongoDB verification recommended for Test 6 (security)")
        print("Run: mongosh and check db.card_profiles.findOne() for sensitive fields")
        
    except Exception as e:
        print(f"\n❌ TEST SUITE FAILED WITH EXCEPTION: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
