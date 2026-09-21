"""Seed data for YuktiCart (idempotent). Clearly separated from production data.

Run automatically on startup only when a collection is empty. Deterministic
UUID-like ids are derived from names so references stay stable across reseeds.
"""
import uuid
from datetime import datetime, timezone

NS = uuid.UUID("11111111-2222-3333-4444-555555555555")


def sid(kind, name):
    return str(uuid.uuid5(NS, f"{kind}:{name.lower()}"))


def now_iso():
    return datetime.now(timezone.utc).isoformat()


PLATFORMS = [
    ("CashKaro", "affiliate", "https://cashkaro.com"),
    ("Zingoy", "affiliate", "https://zingoy.com"),
    ("FreeKaaMaal", "affiliate", "https://freekaamaal.com"),
    ("CouponDunia", "affiliate", "https://coupondunia.in"),
    ("Woohoo", "gift_card", "https://woohoo.in"),
    ("Dealzy", "gift_card", None),
    ("magicpin", "gift_card", "https://magicpin.in"),
]

STORES = [
    # name, stacking, stacking_note, split_payment_supported
    ("Amazon", "unsure", "Amazon changes categories often; confirm stacking at checkout.", "unsure"),
    ("Flipkart", "unsure", "Flipkart rates shift frequently; verify before purchase.", "unsure"),
    ("Myntra", "allowed", "Gift cards stack well with affiliate cashback on Myntra.", "yes"),
    ("Ajio", "allowed", None, "yes"),
    ("Nykaa", "allowed", "Beauty cashback stacks with Nykaa gift cards.", "yes"),
    ("Firstcry", "allowed", "Split payment supported: gift card + UPI/card.", "yes"),
    ("Tata Cliq", "not_allowed", "Tata Cliq usually disallows stacking; split-tender exception may apply.", "unsure"),
    ("Shopsy", "unsure", None, "unsure"),
    ("Ghar Soap", "allowed", None, "yes"),
    ("Ghoor", "unsure", None, "unsure"),
    ("Dot & Key", "allowed", None, "yes"),
    ("Foxtale", "allowed", None, "yes"),
    ("Lifelong", "allowed", None, "yes"),
]

DOMAINS = {
    "Amazon": ["amazon.in", "amazon.com", "amzn.to"],
    "Flipkart": ["flipkart.com", "fkrt.it", "dl.flipkart.com"],
    "Myntra": ["myntra.com"],
    "Ajio": ["ajio.com"],
    "Nykaa": ["nykaa.com", "nykaafashion.com"],
    "Firstcry": ["firstcry.com"],
    "Tata Cliq": ["tatacliq.com", "luxury.tatacliq.com"],
    "Shopsy": ["shopsy.in"],
    "Ghar Soap": ["gharsoap.com"],
    "Ghoor": ["ghoor.com", "ghoor.in"],
    "Dot & Key": ["dotandkey.com"],
    "Foxtale": ["foxtale.in"],
    "Lifelong": ["lifelongindiaonline.com", "lifelong.in"],
}

CATEGORIES = [
    "All", "Beauty", "Luxury", "Apparel", "Furniture/Home", "Kitchen & Dining",
    "Pet Products", "Sports", "Baby", "Health", "Books", "Electronics",
    "Appliances", "Grocery", "Toys",
]

# category -> list of (phrase, match_type, weight, is_exclusion)
KEYWORDS = {
    "Furniture/Home": [
        ("bean bag", "exact_phrase", 5, False), ("sofa", "contains", 3, False),
        ("recliner", "contains", 3, False), ("mattress", "contains", 3, False),
        ("chair", "contains", 2, False), ("table", "contains", 2, False),
        ("furnishing", "contains", 2, False), ("decor", "contains", 2, False),
        ("furniture", "contains", 3, False), ("bookshelf", "contains", 2, False),
    ],
    "Electronics": [
        ("mobile", "contains", 2, False), ("smartphone", "contains", 3, False),
        ("laptop", "contains", 3, False), ("television", "contains", 3, False),
        ("earbud", "contains", 2, False), ("earbuds", "contains", 2, False),
        ("headphone", "contains", 2, False), ("camera", "contains", 2, False),
        ("charger", "contains", 2, False), ("smartwatch", "contains", 3, False),
    ],
    "Apparel": [
        ("t shirt", "exact_phrase", 4, False), ("shirt", "contains", 2, False),
        ("jeans", "contains", 3, False), ("kurta", "contains", 3, False),
        ("dress", "contains", 2, False), ("footwear", "contains", 2, False),
        ("sneaker", "contains", 3, False), ("handbag", "contains", 3, False),
    ],
    "Beauty": [
        ("serum", "contains", 3, False), ("lipstick", "contains", 3, False),
        ("skincare", "contains", 3, False), ("makeup", "contains", 3, False),
        ("shampoo", "contains", 2, False), ("cosmetic", "contains", 2, False),
        ("moisturizer", "contains", 2, False), ("sunscreen", "contains", 2, False),
    ],
    "Kitchen & Dining": [
        ("cookware", "contains", 3, False), ("mixer grinder", "exact_phrase", 4, False),
        ("mixer", "contains", 2, False), ("water bottle", "exact_phrase", 3, False),
        ("dinner set", "exact_phrase", 4, False), ("cutlery", "contains", 3, False),
        ("frying pan", "exact_phrase", 3, False),
    ],
    "Baby": [
        ("diaper", "contains", 4, False), ("stroller", "contains", 4, False),
        ("baby food", "exact_phrase", 4, False), ("nursing", "contains", 3, False),
        ("baby", "contains", 2, False), ("infant", "contains", 3, False),
    ],
    "Pet Products": [
        ("dog food", "exact_phrase", 4, False), ("cat litter", "exact_phrase", 4, False),
        ("pet grooming", "exact_phrase", 3, False), ("leash", "contains", 3, False),
        ("pet", "contains", 2, False),
    ],
    "Sports": [
        ("cricket", "contains", 3, False), ("football", "contains", 3, False),
        ("yoga mat", "exact_phrase", 4, False), ("racquet", "contains", 3, False),
        ("dumbbell", "contains", 3, False), ("gym", "contains", 2, False),
    ],
    "Books": [
        ("paperback", "contains", 3, False), ("hardcover", "contains", 3, False),
        ("textbook", "contains", 3, False), ("novel", "contains", 3, False),
        ("book", "contains", 2, False),
    ],
    "Health": [
        ("supplement", "contains", 3, False), ("protein", "contains", 3, False),
        ("wellness", "contains", 2, False), ("medical device", "exact_phrase", 4, False),
        ("vitamin", "contains", 3, False),
    ],
    "Appliances": [
        ("refrigerator", "contains", 4, False), ("washing machine", "exact_phrase", 4, False),
        ("microwave", "contains", 3, False), ("air conditioner", "exact_phrase", 4, False),
        ("dishwasher", "contains", 3, False),
    ],
    "Toys": [
        ("toy", "contains", 3, False), ("lego", "contains", 3, False),
        ("puzzle", "contains", 2, False), ("action figure", "exact_phrase", 3, False),
    ],
    "Grocery": [
        ("grocery", "contains", 3, False), ("atta", "contains", 2, False),
        ("staples", "contains", 2, False),
    ],
}

# Rate cards: (platform, store, category, customer_type, value_type, value,
#              mov, cap, priority, notes)
RATES = [
    # --- Firstcry worked example fixture ---
    ("CashKaro", "Firstcry", "All", "existing", "flat_amount", "35", "500", None, 10, "Flat cashback for existing users"),
    ("CashKaro", "Firstcry", "All", "new", "flat_amount", "60", "500", None, 10, "Higher flat for first order"),
    ("Woohoo", "Firstcry", "All", "both", "percent", "7", None, "750", 5, "Gift card discount capped at ₹750"),
    # --- Amazon ---
    ("CashKaro", "Amazon", "Electronics", "existing", "percent", "3.5", None, None, 5, None),
    ("CashKaro", "Amazon", "Furniture/Home", "existing", "percent", "5", None, None, 5, None),
    ("CashKaro", "Amazon", "Beauty", "existing", "percent", "6", None, None, 5, None),
    ("CashKaro", "Amazon", "Books", "existing", "flat_amount", "40", "300", None, 5, None),
    ("Woohoo", "Amazon", "All", "both", "percent", "4", None, "5000", 3, None),
    # --- Flipkart ---
    ("Zingoy", "Flipkart", "Apparel", "existing", "percent", "4.5", None, None, 5, None),
    ("Zingoy", "Flipkart", "Electronics", "existing", "percent", "2.5", None, None, 5, None),
    ("magicpin", "Flipkart", "All", "both", "percent", "6", None, "2000", 3, None),
    # --- Myntra ---
    ("CashKaro", "Myntra", "Apparel", "existing", "percent", "6", "999", None, 5, None),
    ("CashKaro", "Myntra", "Apparel", "new", "percent", "9", "999", None, 6, None),
    ("Woohoo", "Myntra", "All", "both", "percent", "8", None, "3000", 3, None),
    # --- Nykaa ---
    ("CouponDunia", "Nykaa", "Beauty", "existing", "percent", "7", None, None, 5, None),
    ("Woohoo", "Nykaa", "All", "both", "percent", "5", None, "2000", 3, None),
    # --- Ajio ---
    ("FreeKaaMaal", "Ajio", "Apparel", "existing", "percent", "5", None, None, 5, None),
    ("Dealzy", "Ajio", "All", "both", "percent", "6", None, "2500", 3, None),
    # --- Others ---
    ("CashKaro", "Dot & Key", "Beauty", "existing", "percent", "10", None, None, 5, None),
    ("CashKaro", "Foxtale", "Beauty", "existing", "percent", "9", None, None, 5, None),
    ("CashKaro", "Lifelong", "Appliances", "existing", "percent", "8", "499", None, 5, None),
    ("Woohoo", "Tata Cliq", "Luxury", "both", "percent", "6", None, "4000", 3, None),
]


async def seed_all(db):
    created = {}
    # Platforms
    if await db.platforms.count_documents({}) == 0:
        docs = []
        for name, kind, url in PLATFORMS:
            docs.append({
                "id": sid("platform", name), "name": name, "kind": kind,
                "website_url": url, "active": True, "archived_at": None,
                "created_at": now_iso(), "updated_at": now_iso(),
            })
        await db.platforms.insert_many(docs)
        created["platforms"] = len(docs)

    # Stores + domains
    if await db.stores.count_documents({}) == 0:
        sdocs, ddocs = [], []
        for name, stacking, note, split in STORES:
            store_id = sid("store", name)
            sdocs.append({
                "id": store_id, "name": name, "active": True, "stacking": stacking,
                "stacking_note": note, "split_payment_supported": split,
                "archived_at": None, "created_at": now_iso(), "updated_at": now_iso(),
            })
            for i, dom in enumerate(DOMAINS.get(name, [])):
                ddocs.append({
                    "id": sid("domain", dom), "store_id": store_id,
                    "domain_or_alias": dom, "priority": 10 - i, "active": True,
                    "created_at": now_iso(),
                })
        await db.stores.insert_many(sdocs)
        if ddocs:
            await db.store_domains.insert_many(ddocs)
        created["stores"] = len(sdocs)
        created["domains"] = len(ddocs)

    # Categories
    if await db.categories.count_documents({}) == 0:
        docs = []
        for i, name in enumerate(CATEGORIES):
            docs.append({
                "id": sid("category", name), "name": name, "parent_id": None,
                "sort_order": i, "active": True, "archived_at": None,
                "created_at": now_iso(), "updated_at": now_iso(),
            })
        await db.categories.insert_many(docs)
        created["categories"] = len(docs)

    # Category keywords
    if await db.category_keywords.count_documents({}) == 0:
        docs = []
        for cat, phrases in KEYWORDS.items():
            cat_id = sid("category", cat)
            for phrase, mt, weight, excl in phrases:
                docs.append({
                    "id": sid("kw", f"{cat}:{phrase}"), "category_id": cat_id,
                    "category_name": cat, "store_id": None, "phrase": phrase,
                    "match_type": mt, "weight": weight, "is_exclusion": excl,
                    "active": True, "created_at": now_iso(), "updated_at": now_iso(),
                })
        await db.category_keywords.insert_many(docs)
        created["keywords"] = len(docs)

    # Rate cards
    if await db.rate_cards.count_documents({}) == 0:
        docs = []
        for (plat, store, cat, ctype, vtype, value, mov, cap, prio, notes) in RATES:
            docs.append({
                "id": str(uuid.uuid4()),
                "platform_id": sid("platform", plat), "platform_name": plat,
                "platform_kind": next(k for n, k, _ in PLATFORMS if n == plat),
                "store_id": sid("store", store), "store_name": store,
                "category_id": sid("category", cat), "category_name": cat,
                "customer_type": ctype, "value_type": vtype, "value": value,
                "minimum_order_value": mov, "maximum_eligible_amount": cap,
                "valid_from": None, "valid_until": None, "priority": prio,
                "notes": notes, "active": True, "status": "published",
                "import_batch_id": None, "archived_at": None,
                "created_by": "seed", "updated_by": "seed",
                "created_at": now_iso(), "updated_at": now_iso(),
            })
        await db.rate_cards.insert_many(docs)
        created["rates"] = len(docs)

    return created
