"""
STEP 5A Backend Testing: Card-aware payment calculation
Tests all 13 scenarios for the card-eligibility feature.
"""
import requests
import json

# Backend URL from environment
BACKEND_URL = "https://affiliate-stage.preview.emergentagent.com/api"

# Test credentials
OWNER_EMAIL = "owner@yukticart.com"
OWNER_PASSWORD = "1BdZY0gVuvrjx9Ti45aW"

CARD_A_EMAIL = "cardA@test.com"
CARD_A_PASSWORD = "Passw0rd123"

CARD_B_EMAIL = "cardB@test.com"
CARD_B_PASSWORD = "Passw0rd123"


def login(email, password):
    """Login and return access token."""
    resp = requests.post(f"{BACKEND_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    if resp.status_code == 200:
        return resp.json()["access_token"]
    else:
        raise Exception(f"Login failed for {email}: {resp.status_code} {resp.text}")


def get_cards(token):
    """Get saved cards for authenticated user."""
    resp = requests.get(f"{BACKEND_URL}/cards", headers={
        "Authorization": f"Bearer {token}"
    })
    return resp.json() if resp.status_code == 200 else []


def calculate(body, token=None):
    """Call /api/calculate with optional auth."""
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.post(f"{BACKEND_URL}/calculate", json=body, headers=headers)
    return resp.status_code, resp.json() if resp.status_code == 200 else resp.text


def detect(url):
    """Call /api/detect."""
    resp = requests.post(f"{BACKEND_URL}/detect", json={"url": url})
    return resp.status_code, resp.json() if resp.status_code == 200 else resp.text


def redirect(slug):
    """Call /api/redirect/{slug}."""
    resp = requests.get(f"{BACKEND_URL}/redirect/{slug}")
    return resp.status_code, resp.json() if resp.status_code == 200 else resp.text


def trending():
    """Call /api/trending."""
    resp = requests.get(f"{BACKEND_URL}/trending")
    return resp.status_code, resp.json() if resp.status_code == 200 else resp.text


def create_rate(body, token):
    """Create a rate (admin only)."""
    resp = requests.post(f"{BACKEND_URL}/admin/rates", json=body, headers={
        "Authorization": f"Bearer {token}"
    })
    return resp.status_code, resp.json() if resp.status_code in (200, 201) else resp.text


def archive_rate(rate_id, token):
    """Archive a rate (admin only)."""
    resp = requests.delete(f"{BACKEND_URL}/admin/rates/{rate_id}", headers={
        "Authorization": f"Bearer {token}"
    })
    return resp.status_code, resp.json() if resp.status_code == 200 else resp.text


def get_stores(token):
    """Get all stores."""
    resp = requests.get(f"{BACKEND_URL}/admin/stores", headers={
        "Authorization": f"Bearer {token}"
    })
    return resp.json() if resp.status_code == 200 else []


def get_categories(token):
    """Get all categories."""
    resp = requests.get(f"{BACKEND_URL}/admin/categories", headers={
        "Authorization": f"Bearer {token}"
    })
    return resp.json() if resp.status_code == 200 else []


def get_platforms(token):
    """Get all platforms."""
    resp = requests.get(f"{BACKEND_URL}/admin/platforms", headers={
        "Authorization": f"Bearer {token}"
    })
    return resp.json() if resp.status_code == 200 else []


def add_card(body, token):
    """Add a card profile."""
    resp = requests.post(f"{BACKEND_URL}/cards", json=body, headers={
        "Authorization": f"Bearer {token}"
    })
    return resp.status_code, resp.json() if resp.status_code == 201 else resp.text


print("=" * 80)
print("STEP 5A BACKEND TESTING: Card-aware payment calculation")
print("=" * 80)

# Login as test users
print("\n[SETUP] Logging in test users...")
try:
    token_owner = login(OWNER_EMAIL, OWNER_PASSWORD)
    print(f"✓ Owner logged in")
except Exception as e:
    print(f"✗ Owner login failed: {e}")
    exit(1)

try:
    token_cardA = login(CARD_A_EMAIL, CARD_A_PASSWORD)
    print(f"✓ cardA@test.com logged in")
except Exception as e:
    print(f"✗ cardA login failed: {e}")
    exit(1)

try:
    token_cardB = login(CARD_B_EMAIL, CARD_B_PASSWORD)
    print(f"✓ cardB@test.com logged in")
except Exception as e:
    print(f"✗ cardB login failed: {e}")
    exit(1)

# Get cardA's saved cards
print("\n[SETUP] Fetching cardA's saved cards...")
cards_a = get_cards(token_cardA)
print(f"✓ cardA has {len(cards_a)} saved cards")
for card in cards_a:
    print(f"  - {card['bank_name']} / {card['card_type']} / {card['card_network']} (id: {card['id']})")

# Find specific cards
sbi_card = next((c for c in cards_a if "SBI" in c["bank_name"].upper() and c["card_type"] == "Credit" and c["card_network"] == "Visa"), None)
hdfc_card = next((c for c in cards_a if "HDFC" in c["bank_name"].upper() and c["card_type"] == "Credit" and c["card_network"] == "Mastercard"), None)
icici_card = next((c for c in cards_a if "ICICI" in c["bank_name"].upper() and c["card_type"] == "Debit" and c["card_network"] == "RuPay"), None)

if not sbi_card:
    print("✗ SBI Credit Visa card not found for cardA")
if not hdfc_card:
    print("✗ HDFC Bank Credit Mastercard card not found for cardA")
if not icici_card:
    print("✗ ICICI Bank Debit RuPay card not found for cardA")

# Get cardB's saved cards (should be empty)
cards_b = get_cards(token_cardB)
print(f"✓ cardB has {len(cards_b)} saved cards (expected: 0)")

print("\n" + "=" * 80)
print("RUNNING TEST SCENARIOS")
print("=" * 80)

# Test counters
passed = 0
failed = 0
test_results = []

# ============================================================================
# SCENARIO 1: BACKWARD COMPAT (most important)
# ============================================================================
print("\n[SCENARIO 1] BACKWARD COMPATIBILITY - No card calculations")
print("-" * 80)

# Test 1a: Firstcry existing customer, no card
print("\n1a. Firstcry All existing mrp=1599 price=1338, NO card")
status, result = calculate({
    "store_name": "Firstcry",
    "category": "All",
    "customer_type": "existing",
    "mrp": 1599,
    "price": 1338
})
if status == 200:
    extra = result["summary"]["extra_saved"]["rupees"]
    final = result["summary"]["final_bill"]["rupees"]
    if extra == 87.50 and final == 1250.50:
        print(f"✓ PASS: extra_saved={extra}, final_bill={final}")
        passed += 1
        test_results.append(("1a", "PASS", f"extra={extra}, final={final}"))
    else:
        print(f"✗ FAIL: Expected extra=87.50, final=1250.50, got extra={extra}, final={final}")
        failed += 1
        test_results.append(("1a", "FAIL", f"Expected 87.50/1250.50, got {extra}/{final}"))
else:
    print(f"✗ FAIL: Status {status}")
    failed += 1
    test_results.append(("1a", "FAIL", f"Status {status}"))

# Test 1b: Same as guest (no token)
print("\n1b. Same calculation as guest (no token)")
status, result = calculate({
    "store_name": "Firstcry",
    "category": "All",
    "customer_type": "existing",
    "mrp": 1599,
    "price": 1338
})
if status == 200:
    extra = result["summary"]["extra_saved"]["rupees"]
    final = result["summary"]["final_bill"]["rupees"]
    if extra == 87.50 and final == 1250.50:
        print(f"✓ PASS: Guest calculation identical: extra={extra}, final={final}")
        passed += 1
        test_results.append(("1b", "PASS", f"Guest: extra={extra}, final={final}"))
    else:
        print(f"✗ FAIL: Guest calculation differs: extra={extra}, final={final}")
        failed += 1
        test_results.append(("1b", "FAIL", f"Guest differs: {extra}/{final}"))
else:
    print(f"✗ FAIL: Status {status}")
    failed += 1
    test_results.append(("1b", "FAIL", f"Status {status}"))

# Test 1c: Amazon Electronics existing, no card
print("\n1c. Amazon Electronics existing mrp=10000 price=9000, NO card")
status, result = calculate({
    "store_name": "Amazon",
    "category": "Electronics",
    "customer_type": "existing",
    "mrp": 10000,
    "price": 9000
})
if status == 200:
    extra = result["summary"]["extra_saved"]["rupees"]
    final = result["summary"]["final_bill"]["rupees"]
    if extra == 515.00 and final == 8485.00:
        print(f"✓ PASS: extra_saved={extra}, final_bill={final}")
        passed += 1
        test_results.append(("1c", "PASS", f"extra={extra}, final={final}"))
    else:
        print(f"✗ FAIL: Expected extra=515.00, final=8485.00, got extra={extra}, final={final}")
        failed += 1
        test_results.append(("1c", "FAIL", f"Expected 515.00/8485.00, got {extra}/{final}"))
else:
    print(f"✗ FAIL: Status {status}")
    failed += 1
    test_results.append(("1c", "FAIL", f"Status {status}"))

# ============================================================================
# SCENARIO 2: Amazon/Luxury NO card
# ============================================================================
print("\n[SCENARIO 2] Amazon/Luxury mrp=5000 price=4500, NO card")
print("-" * 80)

status, result = calculate({
    "store_name": "Amazon",
    "category": "Luxury",
    "customer_type": "existing",
    "mrp": 5000,
    "price": 4500
})
if status == 200:
    extra = result["summary"]["extra_saved"]["rupees"]
    final = result["summary"]["final_bill"]["rupees"]
    if extra == 180.00 and final == 4320.00:
        print(f"✓ PASS: extra_saved={extra}, final_bill={final} (gift card only)")
        passed += 1
        test_results.append(("2", "PASS", f"extra={extra}, final={final}"))
    else:
        print(f"✗ FAIL: Expected extra=180.00, final=4320.00, got extra={extra}, final={final}")
        failed += 1
        test_results.append(("2", "FAIL", f"Expected 180.00/4320.00, got {extra}/{final}"))
else:
    print(f"✗ FAIL: Status {status}")
    failed += 1
    test_results.append(("2", "FAIL", f"Status {status}"))

# Test with logged-in token but no card_id
print("\n2b. Same with logged-in token but no card_id")
status, result = calculate({
    "store_name": "Amazon",
    "category": "Luxury",
    "customer_type": "existing",
    "mrp": 5000,
    "price": 4500
}, token=token_cardA)
if status == 200:
    extra = result["summary"]["extra_saved"]["rupees"]
    final = result["summary"]["final_bill"]["rupees"]
    if extra == 180.00 and final == 4320.00:
        print(f"✓ PASS: Identical with logged-in user: extra={extra}, final={final}")
        passed += 1
        test_results.append(("2b", "PASS", f"extra={extra}, final={final}"))
    else:
        print(f"✗ FAIL: Differs from guest: extra={extra}, final={final}")
        failed += 1
        test_results.append(("2b", "FAIL", f"Differs: {extra}/{final}"))
else:
    print(f"✗ FAIL: Status {status}")
    failed += 1
    test_results.append(("2b", "FAIL", f"Status {status}"))

# ============================================================================
# SCENARIO 3: Card selected but NO card rules at that store
# ============================================================================
print("\n[SCENARIO 3] Firstcry with cardA's SBI card (no card rules at Firstcry)")
print("-" * 80)

if sbi_card:
    status, result = calculate({
        "store_name": "Firstcry",
        "category": "All",
        "customer_type": "existing",
        "mrp": 1599,
        "price": 1338,
        "card_id": sbi_card["id"]
    }, token=token_cardA)
    if status == 200:
        extra = result["summary"]["extra_saved"]["rupees"]
        final = result["summary"]["final_bill"]["rupees"]
        card_echo = result["inputs"].get("card")
        if extra == 87.50 and final == 1250.50:
            if card_echo and "SBI" in card_echo.get("bank_name", "").upper():
                print(f"✓ PASS: extra={extra}, final={final}, card echoed: {card_echo['bank_name']}")
                passed += 1
                test_results.append(("3", "PASS", f"extra={extra}, final={final}, card={card_echo['bank_name']}"))
            else:
                print(f"✗ FAIL: Card not echoed correctly: {card_echo}")
                failed += 1
                test_results.append(("3", "FAIL", f"Card not echoed: {card_echo}"))
        else:
            print(f"✗ FAIL: Expected extra=87.50, final=1250.50, got extra={extra}, final={final}")
            failed += 1
            test_results.append(("3", "FAIL", f"Expected 87.50/1250.50, got {extra}/{final}"))
    else:
        print(f"✗ FAIL: Status {status}")
        failed += 1
        test_results.append(("3", "FAIL", f"Status {status}"))
else:
    print("✗ SKIP: SBI card not found")
    test_results.append(("3", "SKIP", "SBI card not found"))

# ============================================================================
# SCENARIO 4: specific_card match (SBI Credit Visa)
# ============================================================================
print("\n[SCENARIO 4] Amazon/Luxury + SBI Credit Visa card (specific_card 10%)")
print("-" * 80)

if sbi_card:
    status, result = calculate({
        "store_name": "Amazon",
        "category": "Luxury",
        "customer_type": "existing",
        "mrp": 5000,
        "price": 4500,
        "card_id": sbi_card["id"]
    }, token=token_cardA)
    if status == 200:
        extra = result["summary"]["extra_saved"]["rupees"]
        final = result["summary"]["final_bill"]["rupees"]
        aff_best = result.get("affiliate", {}).get("best")
        card_rule_applied = aff_best.get("card_rule_applied") if aff_best else False
        
        if extra == 630.00 and final == 3870.00:
            if aff_best and aff_best["platform_name"] == "CashKaro" and card_rule_applied:
                print(f"✓ PASS: extra={extra}, final={final}, affiliate=CashKaro, card_rule_applied=true")
                passed += 1
                test_results.append(("4", "PASS", f"extra={extra}, final={final}, CashKaro 10%"))
            else:
                print(f"✗ FAIL: Affiliate winner not CashKaro or card_rule_applied not true")
                print(f"  aff_best: {aff_best}")
                failed += 1
                test_results.append(("4", "FAIL", f"Affiliate: {aff_best}"))
        else:
            print(f"✗ FAIL: Expected extra=630.00, final=3870.00, got extra={extra}, final={final}")
            failed += 1
            test_results.append(("4", "FAIL", f"Expected 630.00/3870.00, got {extra}/{final}"))
    else:
        print(f"✗ FAIL: Status {status}")
        failed += 1
        test_results.append(("4", "FAIL", f"Status {status}"))
else:
    print("✗ SKIP: SBI card not found")
    test_results.append(("4", "SKIP", "SBI card not found"))

# ============================================================================
# SCENARIO 5: specific_card non-match + bank match (HDFC)
# ============================================================================
print("\n[SCENARIO 5] Amazon/Luxury + HDFC Mastercard (bank match 7%)")
print("-" * 80)

if hdfc_card:
    status, result = calculate({
        "store_name": "Amazon",
        "category": "Luxury",
        "customer_type": "existing",
        "mrp": 5000,
        "price": 4500,
        "card_id": hdfc_card["id"]
    }, token=token_cardA)
    if status == 200:
        extra = result["summary"]["extra_saved"]["rupees"]
        final = result["summary"]["final_bill"]["rupees"]
        aff_best = result.get("affiliate", {}).get("best")
        
        if extra == 495.00 and final == 4005.00:
            if aff_best and aff_best["platform_name"] == "Zingoy":
                print(f"✓ PASS: extra={extra}, final={final}, affiliate=Zingoy (bank rule 7%)")
                passed += 1
                test_results.append(("5", "PASS", f"extra={extra}, final={final}, Zingoy 7%"))
            else:
                print(f"✗ FAIL: Affiliate winner not Zingoy")
                print(f"  aff_best: {aff_best}")
                failed += 1
                test_results.append(("5", "FAIL", f"Affiliate: {aff_best}"))
        else:
            print(f"✗ FAIL: Expected extra=495.00, final=4005.00, got extra={extra}, final={final}")
            failed += 1
            test_results.append(("5", "FAIL", f"Expected 495.00/4005.00, got {extra}/{final}"))
    else:
        print(f"✗ FAIL: Status {status}")
        failed += 1
        test_results.append(("5", "FAIL", f"Status {status}"))
else:
    print("✗ SKIP: HDFC card not found")
    test_results.append(("5", "SKIP", "HDFC card not found"))

# ============================================================================
# SCENARIO 6: any_card + cap (ICICI RuPay)
# ============================================================================
print("\n[SCENARIO 6] Amazon/Luxury + ICICI RuPay (any_card 20% capped at ₹100)")
print("-" * 80)

if icici_card:
    status, result = calculate({
        "store_name": "Amazon",
        "category": "Luxury",
        "customer_type": "existing",
        "mrp": 5000,
        "price": 4500,
        "card_id": icici_card["id"]
    }, token=token_cardA)
    if status == 200:
        extra = result["summary"]["extra_saved"]["rupees"]
        final = result["summary"]["final_bill"]["rupees"]
        aff_best = result.get("affiliate", {}).get("best")
        
        # Expected: CouponDunia 20% but capped at ₹100 eligible amount = ₹20 saving
        # Total extra = affiliate ₹20 + gift card ₹180 = ₹200
        if extra == 200.00 and final == 4300.00:
            if aff_best and aff_best["platform_name"] == "CouponDunia":
                print(f"✓ PASS: extra={extra}, final={final}, affiliate=CouponDunia (any_card 20% capped)")
                passed += 1
                test_results.append(("6", "PASS", f"extra={extra}, final={final}, CouponDunia capped"))
            else:
                print(f"✗ FAIL: Affiliate winner not CouponDunia")
                print(f"  aff_best: {aff_best}")
                failed += 1
                test_results.append(("6", "FAIL", f"Affiliate: {aff_best}"))
        else:
            print(f"✗ FAIL: Expected extra=200.00, final=4300.00, got extra={extra}, final={final}")
            failed += 1
            test_results.append(("6", "FAIL", f"Expected 200.00/4300.00, got {extra}/{final}"))
    else:
        print(f"✗ FAIL: Status {status}")
        failed += 1
        test_results.append(("6", "FAIL", f"Status {status}"))
else:
    print("✗ SKIP: ICICI card not found")
    test_results.append(("6", "SKIP", "ICICI card not found"))

# ============================================================================
# SCENARIO 7: network rule (Visa)
# ============================================================================
print("\n[SCENARIO 7] Network rule - SBI Visa qualifies for CouponDunia 5% network rule")
print("-" * 80)

if sbi_card:
    status, result = calculate({
        "store_name": "Amazon",
        "category": "Luxury",
        "customer_type": "existing",
        "mrp": 5000,
        "price": 4500,
        "card_id": sbi_card["id"]
    }, token=token_cardA)
    if status == 200:
        aff_options = result.get("affiliate", {}).get("options", [])
        coupondunia_network = next((o for o in aff_options if o["platform_name"] == "CouponDunia" and o.get("card_eligibility") == "network"), None)
        
        if coupondunia_network:
            if coupondunia_network["eligible"]:
                print(f"✓ PASS: CouponDunia 5% network rule is eligible for SBI Visa")
                passed += 1
                test_results.append(("7a", "PASS", "CouponDunia network rule eligible for Visa"))
            else:
                print(f"✗ FAIL: CouponDunia network rule not eligible for SBI Visa")
                print(f"  Reasons: {coupondunia_network.get('reasons')}")
                failed += 1
                test_results.append(("7a", "FAIL", f"Not eligible: {coupondunia_network.get('reasons')}"))
        else:
            print(f"✗ FAIL: CouponDunia network rule not found in options")
            failed += 1
            test_results.append(("7a", "FAIL", "CouponDunia network rule not found"))
    else:
        print(f"✗ FAIL: Status {status}")
        failed += 1
        test_results.append(("7a", "FAIL", f"Status {status}"))
else:
    print("✗ SKIP: SBI card not found")
    test_results.append(("7a", "SKIP", "SBI card not found"))

# Test with HDFC Mastercard (should be ineligible for Visa network rule)
print("\n7b. HDFC Mastercard should be ineligible for Visa network rule")
if hdfc_card:
    status, result = calculate({
        "store_name": "Amazon",
        "category": "Luxury",
        "customer_type": "existing",
        "mrp": 5000,
        "price": 4500,
        "card_id": hdfc_card["id"]
    }, token=token_cardA)
    if status == 200:
        aff_options = result.get("affiliate", {}).get("options", [])
        coupondunia_network = next((o for o in aff_options if o["platform_name"] == "CouponDunia" and o.get("card_eligibility") == "network"), None)
        
        if coupondunia_network:
            if not coupondunia_network["eligible"]:
                reasons = coupondunia_network.get("reasons", [])
                if any("network" in r.lower() or "visa" in r.lower() for r in reasons):
                    print(f"✓ PASS: CouponDunia network rule ineligible for Mastercard (reasons: {reasons})")
                    passed += 1
                    test_results.append(("7b", "PASS", f"Ineligible for Mastercard: {reasons}"))
                else:
                    print(f"✗ FAIL: Ineligible but wrong reason: {reasons}")
                    failed += 1
                    test_results.append(("7b", "FAIL", f"Wrong reason: {reasons}"))
            else:
                print(f"✗ FAIL: CouponDunia network rule should be ineligible for Mastercard")
                failed += 1
                test_results.append(("7b", "FAIL", "Should be ineligible for Mastercard"))
        else:
            print(f"✗ FAIL: CouponDunia network rule not found in options")
            failed += 1
            test_results.append(("7b", "FAIL", "Network rule not found"))
    else:
        print(f"✗ FAIL: Status {status}")
        failed += 1
        test_results.append(("7b", "FAIL", f"Status {status}"))
else:
    print("✗ SKIP: HDFC card not found")
    test_results.append(("7b", "SKIP", "HDFC card not found"))

# ============================================================================
# SCENARIO 8: MOV × card (12% rule with MOV ₹5000)
# ============================================================================
print("\n[SCENARIO 8] Amazon/Luxury mrp=7000 price=6000 + SBI card (12% MOV rule)")
print("-" * 80)

if sbi_card:
    status, result = calculate({
        "store_name": "Amazon",
        "category": "Luxury",
        "customer_type": "existing",
        "mrp": 7000,
        "price": 6000,
        "card_id": sbi_card["id"]
    }, token=token_cardA)
    if status == 200:
        extra = result["summary"]["extra_saved"]["rupees"]
        final = result["summary"]["final_bill"]["rupees"]
        aff_best = result.get("affiliate", {}).get("best")
        
        # Expected: 12% MOV rule wins (720 affiliate + 200 gift card = 920 extra, 5080 final)
        if extra == 920.00 and final == 5080.00:
            if aff_best and aff_best["platform_name"] == "CashKaro":
                aff_saving = aff_best["saving"]["rupees"]
                if aff_saving == 720.00:
                    print(f"✓ PASS: extra={extra}, final={final}, affiliate=CashKaro 12% (720)")
                    passed += 1
                    test_results.append(("8", "PASS", f"extra={extra}, final={final}, CashKaro 12%"))
                else:
                    print(f"✗ FAIL: Affiliate saving should be 720, got {aff_saving}")
                    failed += 1
                    test_results.append(("8", "FAIL", f"Affiliate saving {aff_saving} != 720"))
            else:
                print(f"✗ FAIL: Affiliate winner not CashKaro")
                print(f"  aff_best: {aff_best}")
                failed += 1
                test_results.append(("8", "FAIL", f"Affiliate: {aff_best}"))
        else:
            print(f"✗ FAIL: Expected extra=920.00, final=5080.00, got extra={extra}, final={final}")
            failed += 1
            test_results.append(("8", "FAIL", f"Expected 920.00/5080.00, got {extra}/{final}"))
    else:
        print(f"✗ FAIL: Status {status}")
        failed += 1
        test_results.append(("8", "FAIL", f"Status {status}"))
else:
    print("✗ SKIP: SBI card not found")
    test_results.append(("8", "SKIP", "SBI card not found"))

# ============================================================================
# SCENARIO 9: Ownership checks
# ============================================================================
print("\n[SCENARIO 9] Ownership checks")
print("-" * 80)

# 9a: cardB tries to use cardA's SBI card
print("\n9a. cardB tries to use cardA's SBI card (should be 404)")
if sbi_card:
    status, result = calculate({
        "store_name": "Amazon",
        "category": "Luxury",
        "customer_type": "existing",
        "mrp": 5000,
        "price": 4500,
        "card_id": sbi_card["id"]
    }, token=token_cardB)
    if status == 404:
        print(f"✓ PASS: 404 Card not found (cross-user access blocked)")
        passed += 1
        test_results.append(("9a", "PASS", "404 cross-user blocked"))
    else:
        print(f"✗ FAIL: Expected 404, got {status}")
        failed += 1
        test_results.append(("9a", "FAIL", f"Expected 404, got {status}"))
else:
    print("✗ SKIP: SBI card not found")
    test_results.append(("9a", "SKIP", "SBI card not found"))

# 9b: Guest tries to use any card_id
print("\n9b. Guest (no token) tries to use card_id (should be 401)")
if sbi_card:
    status, result = calculate({
        "store_name": "Amazon",
        "category": "Luxury",
        "customer_type": "existing",
        "mrp": 5000,
        "price": 4500,
        "card_id": sbi_card["id"]
    })
    if status == 401:
        print(f"✓ PASS: 401 Not authenticated (guest with card_id blocked)")
        passed += 1
        test_results.append(("9b", "PASS", "401 guest blocked"))
    else:
        print(f"✗ FAIL: Expected 401, got {status}")
        failed += 1
        test_results.append(("9b", "FAIL", f"Expected 401, got {status}"))
else:
    print("✗ SKIP: SBI card not found")
    test_results.append(("9b", "SKIP", "SBI card not found"))

# 9c: cardB adds their own card and uses it
print("\n9c. cardB adds their own card and uses it (should work)")
status_add, card_b_new = add_card({
    "bank_name": "Axis Bank",
    "card_type": "Credit",
    "card_network": "Visa"
}, token=token_cardB)

if status_add == 201:
    print(f"✓ cardB added new card: {card_b_new['bank_name']}")
    status, result = calculate({
        "store_name": "Amazon",
        "category": "Luxury",
        "customer_type": "existing",
        "mrp": 5000,
        "price": 4500,
        "card_id": card_b_new["id"]
    }, token=token_cardB)
    if status == 200:
        print(f"✓ PASS: cardB can use their own card")
        passed += 1
        test_results.append(("9c", "PASS", "cardB can use own card"))
    else:
        print(f"✗ FAIL: Status {status}")
        failed += 1
        test_results.append(("9c", "FAIL", f"Status {status}"))
else:
    print(f"✗ FAIL: Could not add card for cardB: {status_add}")
    failed += 1
    test_results.append(("9c", "FAIL", f"Add card failed: {status_add}"))

# ============================================================================
# SCENARIO 10: Stacking intact
# ============================================================================
print("\n[SCENARIO 10] Stacking intact with SBI card on Amazon/Luxury")
print("-" * 80)

if sbi_card:
    status, result = calculate({
        "store_name": "Amazon",
        "category": "Luxury",
        "customer_type": "existing",
        "mrp": 5000,
        "price": 4500,
        "card_id": sbi_card["id"]
    }, token=token_cardA)
    if status == 200:
        double_stack = result["stacking"]["double_stack"]
        aff_saving = result.get("affiliate", {}).get("best", {}).get("saving", {}).get("rupees", 0)
        gc_saving = result.get("gift_card", {}).get("best", {}).get("saving", {}).get("rupees", 0)
        
        # Expected: affiliate 450 (10% of 4500) + gift card 180 = 630
        if double_stack and aff_saving == 450.00 and gc_saving == 180.00:
            print(f"✓ PASS: double_stack=true, affiliate={aff_saving}, gift_card={gc_saving}")
            passed += 1
            test_results.append(("10", "PASS", f"double_stack, aff={aff_saving}, gc={gc_saving}"))
        else:
            print(f"✗ FAIL: double_stack={double_stack}, aff={aff_saving}, gc={gc_saving}")
            print(f"  Expected: double_stack=true, aff=450, gc=180")
            failed += 1
            test_results.append(("10", "FAIL", f"double_stack={double_stack}, aff={aff_saving}, gc={gc_saving}"))
    else:
        print(f"✗ FAIL: Status {status}")
        failed += 1
        test_results.append(("10", "FAIL", f"Status {status}"))
else:
    print("✗ SKIP: SBI card not found")
    test_results.append(("10", "SKIP", "SBI card not found"))

# ============================================================================
# SCENARIO 11: Security checks
# ============================================================================
print("\n[SCENARIO 11] Security checks")
print("-" * 80)

# 11a: POST /api/cards with extra fields (card_number, cvv, etc.)
print("\n11a. POST /api/cards with card_number/cvv/expiry/pin (should be 422)")
status_sec, result_sec = add_card({
    "bank_name": "Test Bank",
    "card_type": "Credit",
    "card_network": "Visa",
    "card_number": "1234567890123456",
    "cvv": "123",
    "expiry": "12/25",
    "pin": "1234"
}, token=token_cardA)

if status_sec == 422:
    print(f"✓ PASS: 422 Extra fields rejected")
    passed += 1
    test_results.append(("11a", "PASS", "422 extra fields rejected"))
else:
    print(f"✗ FAIL: Expected 422, got {status_sec}")
    failed += 1
    test_results.append(("11a", "FAIL", f"Expected 422, got {status_sec}"))

# 11b: Admin POST /api/admin/rates with card_criteria containing cvv
print("\n11b. Admin creates rate with card_criteria containing cvv (should be 400)")
stores = get_stores(token_owner)
categories = get_categories(token_owner)
platforms = get_platforms(token_owner)

nykaa_store = next((s for s in stores if s["name"] == "Nykaa"), None)
beauty_cat = next((c for c in categories if c["name"] == "Beauty"), None)
cashkaro_plat = next((p for p in platforms if p["name"] == "CashKaro"), None)

if nykaa_store and beauty_cat and cashkaro_plat:
    status_sec, result_sec = create_rate({
        "platform_id": cashkaro_plat["id"],
        "store_id": nykaa_store["id"],
        "category_id": beauty_cat["id"],
        "customer_type": "existing",
        "value_type": "percent",
        "value": 5,
        "card_eligibility": "specific_card",
        "card_criteria": {
            "bank_name": "Test Bank",
            "cvv": "123"
        }
    }, token=token_owner)
    
    if status_sec == 400:
        print(f"✓ PASS: 400 card_criteria with cvv rejected")
        passed += 1
        test_results.append(("11b", "PASS", "400 cvv in criteria rejected"))
    else:
        print(f"✗ FAIL: Expected 400, got {status_sec}")
        failed += 1
        test_results.append(("11b", "FAIL", f"Expected 400, got {status_sec}"))
else:
    print("✗ SKIP: Required entities not found")
    test_results.append(("11b", "SKIP", "Entities not found"))

# 11c: Invalid card_eligibility mode
print("\n11c. Admin creates rate with invalid card_eligibility (should be 400)")
if nykaa_store and beauty_cat and cashkaro_plat:
    status_sec, result_sec = create_rate({
        "platform_id": cashkaro_plat["id"],
        "store_id": nykaa_store["id"],
        "category_id": beauty_cat["id"],
        "customer_type": "existing",
        "value_type": "percent",
        "value": 5,
        "card_eligibility": "invalid_mode"
    }, token=token_owner)
    
    if status_sec == 400:
        print(f"✓ PASS: 400 invalid card_eligibility rejected")
        passed += 1
        test_results.append(("11c", "PASS", "400 invalid mode rejected"))
    else:
        print(f"✗ FAIL: Expected 400, got {status_sec}")
        failed += 1
        test_results.append(("11c", "FAIL", f"Expected 400, got {status_sec}"))
else:
    print("✗ SKIP: Required entities not found")
    test_results.append(("11c", "SKIP", "Entities not found"))

# 11d: bank mode without bank_name
print("\n11d. Admin creates rate with card_eligibility=bank but no bank_name (should be 400)")
if nykaa_store and beauty_cat and cashkaro_plat:
    status_sec, result_sec = create_rate({
        "platform_id": cashkaro_plat["id"],
        "store_id": nykaa_store["id"],
        "category_id": beauty_cat["id"],
        "customer_type": "existing",
        "value_type": "percent",
        "value": 5,
        "card_eligibility": "bank",
        "card_criteria": {}
    }, token=token_owner)
    
    if status_sec == 400:
        print(f"✓ PASS: 400 bank mode without bank_name rejected")
        passed += 1
        test_results.append(("11d", "PASS", "400 bank without bank_name rejected"))
    else:
        print(f"✗ FAIL: Expected 400, got {status_sec}")
        failed += 1
        test_results.append(("11d", "FAIL", f"Expected 400, got {status_sec}"))
else:
    print("✗ SKIP: Required entities not found")
    test_results.append(("11d", "SKIP", "Entities not found"))

# 11e: GET /api/cards should not contain user_id or _id
print("\n11e. GET /api/cards should not expose user_id or _id")
cards_check = get_cards(token_cardA)
if cards_check:
    has_user_id = any("user_id" in c for c in cards_check)
    has_mongo_id = any("_id" in c for c in cards_check)
    if not has_user_id and not has_mongo_id:
        print(f"✓ PASS: No user_id or _id in response")
        passed += 1
        test_results.append(("11e", "PASS", "No user_id/_id exposed"))
    else:
        print(f"✗ FAIL: Response contains user_id={has_user_id} or _id={has_mongo_id}")
        failed += 1
        test_results.append(("11e", "FAIL", f"user_id={has_user_id}, _id={has_mongo_id}"))
else:
    print("✗ SKIP: No cards to check")
    test_results.append(("11e", "SKIP", "No cards"))

# ============================================================================
# SCENARIO 12: Regression tests
# ============================================================================
print("\n[SCENARIO 12] Regression tests")
print("-" * 80)

# 12a: POST /api/detect
print("\n12a. POST /api/detect with Amazon URL")
status, result = detect("https://www.amazon.in/dp/B0ABC123")
if status == 200:
    store_name = result.get("store", {}).get("store_name", "")
    if store_name == "Amazon":
        print(f"✓ PASS: Detected store: {store_name}")
        passed += 1
        test_results.append(("12a", "PASS", f"Detected: {store_name}"))
    else:
        print(f"✗ FAIL: Expected Amazon, got {store_name}")
        failed += 1
        test_results.append(("12a", "FAIL", f"Got {store_name}"))
else:
    print(f"✗ FAIL: Status {status}")
    failed += 1
    test_results.append(("12a", "FAIL", f"Status {status}"))

# 12b: GET /api/redirect/cashkaro
print("\n12b. GET /api/redirect/cashkaro")
status, result = redirect("cashkaro")
if status == 200:
    url = result.get("url", "")
    if url == "https://cashkaro.com":
        print(f"✓ PASS: Redirect URL: {url}")
        passed += 1
        test_results.append(("12b", "PASS", f"URL: {url}"))
    else:
        print(f"✗ FAIL: Expected https://cashkaro.com, got {url}")
        failed += 1
        test_results.append(("12b", "FAIL", f"Got {url}"))
else:
    print(f"✗ FAIL: Status {status}")
    failed += 1
    test_results.append(("12b", "FAIL", f"Status {status}"))

# 12c: GET /api/trending
print("\n12c. GET /api/trending")
status, result = trending()
if status == 200:
    deals = result if isinstance(result, list) else []
    if len(deals) == 8:
        top_deal = deals[0]
        if top_deal["store"] == "Amazon" and top_deal["category"] == "Electronics":
            extra = top_deal["extra_saved"]["rupees"]
            if extra == 900.00:
                print(f"✓ PASS: 8 deals, top deal Amazon Electronics extra_saved={extra}")
                passed += 1
                test_results.append(("12c", "PASS", f"8 deals, top={extra}"))
            else:
                print(f"✗ FAIL: Top deal extra_saved should be 900, got {extra}")
                failed += 1
                test_results.append(("12c", "FAIL", f"Top extra={extra}"))
        else:
            print(f"✗ FAIL: Top deal not Amazon Electronics: {top_deal}")
            failed += 1
            test_results.append(("12c", "FAIL", f"Top: {top_deal}"))
    else:
        print(f"✗ FAIL: Expected 8 deals, got {len(deals)}")
        failed += 1
        test_results.append(("12c", "FAIL", f"{len(deals)} deals"))
else:
    print(f"✗ FAIL: Status {status}")
    failed += 1
    test_results.append(("12c", "FAIL", f"Status {status}"))

# ============================================================================
# SCENARIO 13: Admin round-trip
# ============================================================================
print("\n[SCENARIO 13] Admin round-trip - create and archive rate")
print("-" * 80)

if nykaa_store and beauty_cat:
    # Find RuPay platform or use any platform
    platform = next((p for p in platforms if p["kind"] == "affiliate"), cashkaro_plat)
    
    print(f"\n13a. Create rate: {platform['name']} / Nykaa / Beauty / network=RuPay / 4%")
    status_create, rate_created = create_rate({
        "platform_id": platform["id"],
        "store_id": nykaa_store["id"],
        "category_id": beauty_cat["id"],
        "customer_type": "existing",
        "value_type": "percent",
        "value": 4,
        "card_eligibility": "network",
        "card_criteria": {
            "card_network": "RuPay"
        }
    }, token=token_owner)
    
    if status_create in (200, 201):
        rate_id = rate_created.get("id")
        print(f"✓ PASS: Rate created with id={rate_id}")
        passed += 1
        test_results.append(("13a", "PASS", f"Rate created: {rate_id}"))
        
        # Archive it
        print(f"\n13b. Archive rate {rate_id}")
        status_archive, result_archive = archive_rate(rate_id, token_owner)
        if status_archive == 200 and result_archive.get("archived"):
            print(f"✓ PASS: Rate archived")
            passed += 1
            test_results.append(("13b", "PASS", "Rate archived"))
        else:
            print(f"✗ FAIL: Archive failed: {status_archive} {result_archive}")
            failed += 1
            test_results.append(("13b", "FAIL", f"Archive failed: {status_archive}"))
    else:
        print(f"✗ FAIL: Create rate failed: {status_create}")
        failed += 1
        test_results.append(("13a", "FAIL", f"Create failed: {status_create}"))
        test_results.append(("13b", "SKIP", "Create failed"))
else:
    print("✗ SKIP: Required entities not found")
    test_results.append(("13a", "SKIP", "Entities not found"))
    test_results.append(("13b", "SKIP", "Entities not found"))

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)

print(f"\nTotal tests: {passed + failed}")
print(f"✓ Passed: {passed}")
print(f"✗ Failed: {failed}")

if failed > 0:
    print("\n" + "=" * 80)
    print("FAILED TESTS:")
    print("=" * 80)
    for test_id, status, detail in test_results:
        if status == "FAIL":
            print(f"  [{test_id}] {detail}")

print("\n" + "=" * 80)
print("ALL TEST RESULTS:")
print("=" * 80)
for test_id, status, detail in test_results:
    symbol = "✓" if status == "PASS" else ("✗" if status == "FAIL" else "⊘")
    print(f"  {symbol} [{test_id}] {status}: {detail}")

print("\n" + "=" * 80)
if failed == 0:
    print("✓ ALL TESTS PASSED")
else:
    print(f"✗ {failed} TEST(S) FAILED")
print("=" * 80)
