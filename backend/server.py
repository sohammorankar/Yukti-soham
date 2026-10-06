from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import re
import csv
import io
import uuid
import asyncio
import logging
import secrets
from datetime import datetime, timezone, timedelta, date

import jwt
import bcrypt
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator
from typing import List, Optional, Literal

from money import D, q, round_rupee, money_out
from engine import (calculate_stack, detect_store, detect_category,
                    rate_is_eligible, category_matches, CARD_ELIGIBILITY_MODES)
from seed import seed_all, sid, now_iso, STORE_URLS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("yukticart")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
RATE_VERSION = os.environ.get("RATE_VERSION", "v1")

app = FastAPI(title="YuktiCart API")
api = APIRouter(prefix="/api")

MANAGE_ROLES = {"owner", "admin", "rate_editor"}
WRITE_ROLES = {"owner", "admin", "rate_editor"}


# --------------------------------------------------------------------------
# Helpers: auth
# --------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=8)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=8 * 3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


async def roles_for(user_id: str) -> List[str]:
    docs = await db.user_roles.find({"user_id": user_id}, {"_id": 0, "role": 1}).to_list(50)
    return [d["role"] for d in docs]


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["roles"] = await roles_for(user["id"])
    return user


def require_role(allowed: set):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if not (set(user.get("roles", [])) & allowed):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


require_manage = require_role(MANAGE_ROLES)
require_write = require_role(WRITE_ROLES)
require_owner = require_role({"owner"})


async def require_any_role(user: dict = Depends(get_current_user)) -> dict:
    """Admin reads require a non-empty role set (per the documented security model).
    Blocks roleless shopper accounts from reading admin reference lists."""
    if not user.get("roles"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user


async def get_optional_user(request: Request):
    """Like get_current_user but returns None for anonymous callers instead of 401.
    Used by endpoints that work for guests but can be personalized when authed."""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


async def audit(user: dict, action: str, entity_type: str, entity_id: str,
                before=None, after=None, request: Request = None):
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "actor": user.get("email") if user else "system",
        "actor_id": user.get("id") if user else None,
        "action": action, "entity_type": entity_type, "entity_id": entity_id,
        "before": before, "after": after,
        "request_id": (request.headers.get("x-request-id") if request else None) or str(uuid.uuid4()),
        "timestamp": now_iso(),
    })


def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def _norm_slug(v: str) -> str:
    """Normalize a partner/store name to a comparable slug (alnum, lowercase)."""
    return re.sub(r"[^a-z0-9]", "", (v or "").lower())


def _slugify(v: str) -> str:
    """URL-safe, lowercase, hyphenated store slug from a name. Stable once stored."""
    s = re.sub(r"[^a-z0-9]+", "-", (v or "").lower()).strip("-")
    return s or "store"


async def _unique_store_slug(base: str, exclude_id: str = None) -> str:
    """Return a unique store slug derived from base, suffixing -2, -3, … on collision."""
    base = _slugify(base)
    slug = base
    n = 2
    while True:
        query = {"slug": slug}
        if exclude_id:
            query["id"] = {"$ne": exclude_id}
        if not await db.stores.find_one(query, {"_id": 0, "id": 1}):
            return slug
        slug = f"{base}-{n}"
        n += 1


_UNSAFE_URL_SCHEMES = ("javascript:", "data:", "file:", "vbscript:", "about:", "blob:", "ftp:")


def _is_safe_http_url(url: str) -> bool:
    """Only trust absolute http(s) URLs. Rejects unsafe schemes (javascript:,
    data:, file:, etc.) and anything without a proper http(s) host — this is the
    single guard that keeps the redirect resolver free of open-redirect / XSS
    injection surfaces."""
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    low = u.lower()
    if any(low.startswith(s) for s in _UNSAFE_URL_SCHEMES):
        return False
    # Must be an absolute http(s) URL with a host segment.
    return bool(re.match(r"^https?://[^\s/@]+", u, re.I))


# --------------------------------------------------------------------------
# Pydantic input models
# --------------------------------------------------------------------------

class LoginBody(BaseModel):
    email: EmailStr
    password: str


class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    mobile: str
    full_name: Optional[str] = None
    gender: Optional[str] = None

    @field_validator("password")
    @classmethod
    def strong_password(cls, v):
        if len(v or "") < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must include at least one letter and one number")
        return v

    @field_validator("mobile")
    @classmethod
    def indian_mobile(cls, v):
        digits = re.sub(r"\D", "", v or "")
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if not re.fullmatch(r"[6-9]\d{9}", digits):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return digits

    @field_validator("gender")
    @classmethod
    def valid_gender(cls, v):
        if v in (None, ""):
            return None
        if v not in ("male", "female", "other", "prefer_not"):
            raise ValueError("Invalid gender selection")
        return v


class ProfileUpdateBody(BaseModel):
    """Shopper self-service profile update. Reuses the existing users collection
    and auth architecture. Only non-sensitive profile fields are accepted — no
    card, financial or credential data is ever handled here."""
    model_config = {"extra": "forbid"}

    full_name: Optional[str] = Field(default=None, max_length=80)
    gender: Optional[str] = None
    mobile: Optional[str] = None
    avatar_url: Optional[str] = Field(default=None, max_length=1_000_000)

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, v):
        if v is None:
            return None
        v = re.sub(r"\s+", " ", v).strip()
        return v or None

    @field_validator("gender")
    @classmethod
    def valid_gender(cls, v):
        if v in (None, ""):
            return None
        if v not in ("male", "female", "other", "prefer_not"):
            raise ValueError("Invalid gender selection")
        return v

    @field_validator("mobile")
    @classmethod
    def indian_mobile(cls, v):
        if v in (None, ""):
            return None
        digits = re.sub(r"\D", "", v or "")
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if not re.fullmatch(r"[6-9]\d{9}", digits):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return digits

    @field_validator("avatar_url")
    @classmethod
    def clean_avatar(cls, v):
        if v in (None, ""):
            return None
        v = v.strip()
        if not re.match(r"^https?://", v, re.I) and not v.startswith("data:image/"):
            raise ValueError("Avatar must be a valid image URL")
        return v


CARD_TYPES = ("Credit", "Debit")
CARD_NETWORKS = ("Visa", "Mastercard", "RuPay", "American Express", "Other")


class CardBody(BaseModel):
    """Shopper card-profile input. Preferred flow: catalog_id referencing the
    backend-managed card catalogue (attributes are derived server-side so they
    cannot be spoofed). Legacy manual triple (bank_name/card_type/card_network)
    is still accepted so existing profiles and flows keep working.
    ONLY offer-relevant attributes are accepted — card numbers, CVV, expiry,
    PINs, OTPs and any other credential fields are explicitly forbidden."""
    model_config = {"extra": "forbid"}

    catalog_id: Optional[str] = None
    bank_name: Optional[str] = Field(default=None, max_length=80)
    card_type: Optional[Literal["Credit", "Debit"]] = None
    card_network: Optional[Literal["Visa", "Mastercard", "RuPay", "American Express", "Other"]] = None

    @field_validator("bank_name")
    @classmethod
    def clean_bank(cls, v):
        if v is None:
            return None
        v = re.sub(r"\s+", " ", v).strip()
        if not v:
            raise ValueError("Bank name is required")
        return v


class CalcBody(BaseModel):
    store_id: Optional[str] = None
    store_name: Optional[str] = None
    category: Optional[str] = None
    customer_type: Literal["new", "existing", "both"] = "existing"
    mrp: Optional[float] = None
    price: float
    # Optional: one of the authenticated shopper's own saved card profiles.
    card_id: Optional[str] = None

    @field_validator("mrp", "price")
    @classmethod
    def non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("must be non-negative")
        return v

    @model_validator(mode="after")
    def mrp_not_below_price(self):
        # MRP is optional; only reject when it is provided AND lower than price.
        if self.mrp is not None and self.price > self.mrp:
            raise ValueError("Selling price cannot exceed MRP")
        return self


class DetectBody(BaseModel):
    url: str


class CorrectionBody(BaseModel):
    detected_category: Optional[str] = None
    corrected_category: str
    store_name: Optional[str] = None
    confidence_band: Optional[str] = None


class FeedbackBody(BaseModel):
    kind: Literal["contact", "report_rate", "suggest_store"]
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    message: str
    context: Optional[str] = None


class GratitudeBody(BaseModel):
    idempotency_key: str


# --------------------------------------------------------------------------
# Startup: indexes + seed + owner bootstrap
# --------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.user_roles.create_index([("user_id", 1), ("role", 1)], unique=True)
    await db.login_attempts.create_index("identifier")
    await db.card_profiles.create_index("id", unique=True)
    await db.card_profiles.create_index("user_id")
    await db.card_catalogue.create_index("id", unique=True)
    # Store × Affiliate Partner destination mappings (Step: Affiliate Destinations)
    await db.affiliate_destinations.create_index("id", unique=True)
    await db.affiliate_destinations.create_index(
        [("store_id", 1), ("platform_id", 1)], unique=True)
    for coll in ["platforms", "stores", "categories", "rate_cards"]:
        await db[coll].create_index("id", unique=True)
    await db.store_domains.create_index("domain_or_alias", unique=True)
    # Milestone 2: store architecture indexes (slug/rank/curation)
    await db.stores.create_index("slug", unique=True, sparse=True)
    await db.stores.create_index("display_rank")
    await db.stores.create_index([("active", 1), ("homepage_visible", 1)])

    created = await seed_all(db)
    if created:
        logger.info(f"Seeded: {created}")

    # Backfill store_url for stores created before this field existed
    for name, url in STORE_URLS.items():
        await db.stores.update_one(
            {"name": name, "store_url": {"$in": [None, ""]}},
            {"$set": {"store_url": url}})

    # Milestone 2: backfill store architecture fields (idempotent, non-destructive).
    # Deterministic initial display_rank follows the existing public order (name ASC)
    # so current ordering is preserved; business curation happens later via admin.
    existing_slugs = {
        s["slug"] for s in await db.stores.find(
            {"slug": {"$nin": [None, ""]}}, {"_id": 0, "slug": 1}).to_list(1000)
    }
    rank = 0
    for s in await db.stores.find({}, {"_id": 0}).sort("name", 1).to_list(1000):
        rank += 1
        updates = {}
        if not s.get("slug"):
            base = _slugify(s.get("name"))
            slug = base
            n = 2
            while slug in existing_slugs:
                slug = f"{base}-{n}"
                n += 1
            existing_slugs.add(slug)
            updates["slug"] = slug
        if s.get("display_rank") is None:
            updates["display_rank"] = rank
        for field, default in (("logo_url", None), ("image_url", None),
                               ("description", None), ("featured", False)):
            if field not in s:
                updates[field] = default
        if "homepage_visible" not in s:
            updates["homepage_visible"] = bool(s.get("active", True))
        if updates:
            await db.stores.update_one({"id": s["id"]}, {"$set": updates})

    # Owner bootstrap via allowlist (open admin registration disabled)
    allowlist = [e.strip().lower() for e in os.environ.get("ADMIN_ALLOWLIST", "").split(",") if e.strip()]
    admin_email = os.environ.get("ADMIN_EMAIL", "owner@yukticart.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "changeme")
    if admin_email and admin_email in allowlist:
        existing = await db.users.find_one({"email": admin_email})
        if existing is None:
            uid = str(uuid.uuid4())
            await db.users.insert_one({
                "id": uid, "email": admin_email, "password_hash": hash_password(admin_password),
                "name": "Owner", "email_verified": True, "created_at": now_iso(),
            })
            await db.user_roles.insert_one({"id": str(uuid.uuid4()), "user_id": uid, "role": "owner"})
            logger.info(f"Bootstrapped owner: {admin_email}")
        elif not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one({"email": admin_email},
                                      {"$set": {"password_hash": hash_password(admin_password)}})

    # Gratitude counter document
    if await db.gratitude.find_one({"id": "global"}) is None:
        await db.gratitude.insert_one({"id": "global", "count": 0})


@app.on_event("shutdown")
async def shutdown():
    client.close()


# --------------------------------------------------------------------------
# Auth endpoints
# --------------------------------------------------------------------------

@api.post("/auth/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "?"
    ident = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("locked_until"):
        if datetime.fromisoformat(attempt["locked_until"]) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        count = (attempt or {}).get("count", 0) + 1
        update = {"identifier": ident, "count": count}
        if count >= 5:
            update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": ident})
    roles = await roles_for(user["id"])
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"id": user["id"], "email": email, "name": user.get("name"), "roles": roles,
            "access_token": access}


@api.post("/auth/register")
async def register(body: RegisterBody, request: Request, response: Response):
    """Shopper self-registration. Creates a ROLELESS user (no admin access) and
    logs them in. Admin accounts are never created here — they come only from the
    ADMIN_ALLOWLIST bootstrap, so this endpoint cannot escalate to admin."""
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": email, "password_hash": hash_password(body.password),
        "full_name": body.full_name, "name": body.full_name,
        "gender": body.gender, "mobile": body.mobile,
        "email_verified": False, "created_at": now_iso(),
    }
    try:
        await db.users.insert_one(doc)
    except Exception:
        # unique email index guards against a race between the check and insert
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": body.full_name, "full_name": body.full_name,
            "gender": body.gender, "mobile": body.mobile, "roles": [], "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.put("/auth/me")
async def update_me(body: ProfileUpdateBody, user: dict = Depends(get_current_user)):
    """Self-service profile update (full name, gender, mobile, avatar). Reuses the
    existing users collection; never touches roles, cards, rates or any financial
    data. Returns the refreshed user profile (password hash always excluded)."""
    updates = {}
    if body.full_name is not None:
        updates["full_name"] = body.full_name
        updates["name"] = body.full_name
    if body.gender is not None:
        updates["gender"] = body.gender
    if body.mobile is not None:
        updates["mobile"] = body.mobile
    if body.avatar_url is not None:
        updates["avatar_url"] = body.avatar_url
    if updates:
        updates["updated_at"] = now_iso()
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    fresh["roles"] = await roles_for(user["id"])
    return fresh


@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=8 * 3600, path="/")
    return {"ok": True}


# --------------------------------------------------------------------------
# Shopper card profiles ("My Cards & Offers" — Phase 1)
# Preferences ONLY: bank name, card type, card network. No card numbers, CVV,
# expiry, PINs or any credentials are accepted or stored. Every document is
# owned by exactly one shopper (user_id) and all queries are owner-scoped, so
# no shopper can read, modify or delete another shopper's cards. These
# profiles are NOT read by /api/calculate and have no effect on savings math.
# --------------------------------------------------------------------------

CARD_PROJECTION = {"_id": 0, "id": 1, "bank_name": 1, "card_type": 1, "card_network": 1,
                   "card_name": 1, "card_catalog_id": 1, "created_at": 1}


def _norm_bank(v: str) -> str:
    return re.sub(r"\s+", " ", (v or "")).strip().lower()


async def _resolve_card_attrs(body: CardBody) -> dict:
    """Resolve a CardBody to normalized card attributes.

    catalog_id flow: attributes are derived from the backend-managed catalogue
    (server-side, cannot be spoofed) and the profile retains its catalogue
    identity via card_catalog_id. Manual flow: the legacy bank/type/network
    triple (all three required).
    """
    if body.catalog_id:
        cat = await db.card_catalogue.find_one({"id": body.catalog_id, "active": True}, {"_id": 0})
        if not cat:
            raise HTTPException(status_code=404, detail="Card not found in catalogue")
        return {"bank_name": cat["bank_name"], "card_type": cat["card_type"],
                "card_network": cat["card_network"], "card_name": cat["card_name"],
                "card_catalog_id": cat["id"]}
    if not (body.bank_name and body.card_type and body.card_network):
        raise HTTPException(status_code=422,
                            detail="Bank name, card type and network are required")
    return {"bank_name": body.bank_name, "card_type": body.card_type,
            "card_network": body.card_network, "card_name": None, "card_catalog_id": None}


async def _find_duplicate_card(user_id: str, attrs: dict, exclude_id: str = None):
    """Duplicate guard: same catalogue card, or same normalized bank + type +
    network triple, for the same owner."""
    query = {"user_id": user_id}
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    candidates = await db.card_profiles.find(query, {"_id": 0}).to_list(200)
    for c in candidates:
        if attrs.get("card_catalog_id") and c.get("card_catalog_id") == attrs["card_catalog_id"]:
            return c
        if (not attrs.get("card_catalog_id") and not c.get("card_catalog_id")
                and _norm_bank(c.get("bank_name")) == _norm_bank(attrs["bank_name"])
                and c.get("card_type") == attrs["card_type"]
                and c.get("card_network") == attrs["card_network"]):
            return c
    return None


@api.get("/cards")
async def list_cards(user: dict = Depends(get_current_user)):
    """List the authenticated shopper's own card profiles (owner-scoped)."""
    return await db.card_profiles.find(
        {"user_id": user["id"]}, CARD_PROJECTION).sort("created_at", 1).to_list(200)


@api.post("/cards", status_code=201)
async def create_card(body: CardBody, user: dict = Depends(get_current_user)):
    """Save a card profile for the authenticated shopper (catalogue or manual)."""
    attrs = await _resolve_card_attrs(body)
    if await _find_duplicate_card(user["id"], attrs):
        raise HTTPException(status_code=409, detail="This card profile is already saved")
    now = now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        **attrs,
        "created_at": now,
        "updated_at": now,
    }
    await db.card_profiles.insert_one(doc)
    return {k: doc.get(k) for k in ("id", "bank_name", "card_type", "card_network", "card_name", "card_catalog_id", "created_at")}


@api.put("/cards/{card_id}")
async def update_card(card_id: str, body: CardBody, user: dict = Depends(get_current_user)):
    """Update a card profile — only if it belongs to the authenticated shopper."""
    owned = await db.card_profiles.find_one({"id": card_id, "user_id": user["id"]})
    if not owned:
        raise HTTPException(status_code=404, detail="Card not found")
    attrs = await _resolve_card_attrs(body)
    if await _find_duplicate_card(user["id"], attrs, exclude_id=card_id):
        raise HTTPException(status_code=409, detail="This card profile is already saved")
    await db.card_profiles.update_one(
        {"id": card_id, "user_id": user["id"]},
        {"$set": {**attrs, "updated_at": now_iso()}})
    doc = await db.card_profiles.find_one({"id": card_id, "user_id": user["id"]}, CARD_PROJECTION)
    return doc


@api.delete("/cards/{card_id}")
async def delete_card(card_id: str, user: dict = Depends(get_current_user)):
    """Delete a card profile — only if it belongs to the authenticated shopper."""
    res = await db.card_profiles.delete_one({"id": card_id, "user_id": user["id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"ok": True}


# --------------------------------------------------------------------------
# Card catalogue (public search + admin management). Identity catalogue only:
# bank_name, card_name, card_type, card_network. NO offers, rates, numbers,
# CVV, expiry or PINs.
# --------------------------------------------------------------------------

CATALOGUE_PROJECTION = {"_id": 0, "id": 1, "bank_name": 1, "card_name": 1,
                        "card_type": 1, "card_network": 1, "active": 1}


@api.get("/card-catalogue")
async def search_card_catalogue(search: str = Query("", alias="q")):
    """Public, case-insensitive substring search over active catalogue cards
    (matches card name and bank name)."""
    query = {"active": True}
    term = (search or "").strip()
    if term:
        rx = re.compile(re.escape(term), re.I)
        query["$or"] = [{"card_name": rx}, {"bank_name": rx}]
    return await db.card_catalogue.find(query, CATALOGUE_PROJECTION) \
        .sort([("bank_name", 1), ("card_name", 1)]).to_list(24)


def _validate_catalogue_card(body: dict):
    forbidden = {"card_number", "cvv", "expiry", "expiry_date", "pin", "otp",
                 "account_number"} & {k.lower() for k in body}
    if forbidden:
        raise HTTPException(400, "Card catalogue must not contain sensitive card data")
    for f in ("bank_name", "card_name"):
        if not str(body.get(f) or "").strip():
            raise HTTPException(400, f"{f} is required")
        if len(str(body[f]).strip()) > 100:
            raise HTTPException(400, f"{f} is too long")
    if body.get("card_type") not in CARD_TYPE_VALUES:
        raise HTTPException(400, "card_type must be Credit or Debit")
    if body.get("card_network") not in CARD_NETWORK_VALUES:
        raise HTTPException(400, f"card_network must be one of {', '.join(CARD_NETWORK_VALUES)}")


@api.get("/admin/card-catalogue")
async def admin_list_catalogue(user=Depends(require_any_role)):
    return await db.card_catalogue.find({}, CATALOGUE_PROJECTION) \
        .sort([("bank_name", 1), ("card_name", 1)]).to_list(1000)


@api.post("/admin/card-catalogue", status_code=201)
async def admin_create_catalogue_card(body: dict, request: Request, user=Depends(require_write)):
    _validate_catalogue_card(body)
    name_key = f'{body["bank_name"].strip()}:{body["card_name"].strip()}'.lower()
    if await db.card_catalogue.find_one(
            {"bank_name": re.compile(f"^{re.escape(body['bank_name'].strip())}$", re.I),
             "card_name": re.compile(f"^{re.escape(body['card_name'].strip())}$", re.I)}):
        raise HTTPException(409, "This catalogue card already exists")
    doc = {
        "id": sid("card", name_key),
        "bank_name": re.sub(r"\s+", " ", body["bank_name"]).strip(),
        "card_name": re.sub(r"\s+", " ", body["card_name"]).strip(),
        "card_type": body["card_type"], "card_network": body["card_network"],
        "active": True, "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.card_catalogue.insert_one(doc)
    await audit(user, "create", "card_catalogue", doc["id"], None, clean(dict(doc)), request)
    return clean(dict(doc))


@api.put("/admin/card-catalogue/{cid}")
async def admin_update_catalogue_card(cid: str, body: dict, request: Request, user=Depends(require_write)):
    before = await db.card_catalogue.find_one({"id": cid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    merged = {**before, **{k: v for k, v in body.items()
                           if k in ("bank_name", "card_name", "card_type", "card_network", "active")}}
    _validate_catalogue_card(merged)
    upd = {"bank_name": re.sub(r"\s+", " ", merged["bank_name"]).strip(),
           "card_name": re.sub(r"\s+", " ", merged["card_name"]).strip(),
           "card_type": merged["card_type"], "card_network": merged["card_network"],
           "active": bool(merged.get("active", True)), "updated_at": now_iso()}
    await db.card_catalogue.update_one({"id": cid}, {"$set": upd})
    after = await db.card_catalogue.find_one({"id": cid}, {"_id": 0})
    await audit(user, "update", "card_catalogue", cid, before, after, request)
    return after


@api.post("/admin/card-catalogue/{cid}/activate")
async def admin_activate_catalogue_card(cid: str, body: dict, request: Request, user=Depends(require_write)):
    before = await db.card_catalogue.find_one({"id": cid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    active = bool(body.get("active", True))
    await db.card_catalogue.update_one({"id": cid}, {"$set": {"active": active, "updated_at": now_iso()}})
    await audit(user, "activate" if active else "deactivate", "card_catalogue", cid, None, {"active": active}, request)
    return {"ok": True}


# --------------------------------------------------------------------------
# Public read endpoints
# --------------------------------------------------------------------------

def public_filter():
    return {"active": True, "archived_at": None}


STORE_PUBLIC_DETAIL_FIELDS = {"_id": 0, "id": 1, "name": 1, "slug": 1, "store_url": 1,
                              "logo_url": 1, "image_url": 1, "description": 1,
                              "display_rank": 1, "featured": 1}


async def _store_affiliate_summary(store_id: Optional[str] = None):
    """Public category choices and rule flags from one shared affiliate-rate filter.

    Only active, published, non-archived affiliate rules count. "All" stays
    available to the calculation engine as a wildcard, but is never a shopper
    category. Gift-card rules do not contribute to either flag or category list.
    """
    query = {"active": True, "status": "published", "archived_at": None,
             "platform_kind": "affiliate"}
    if store_id is not None:
        query["store_id"] = store_id
    category_flags, customer_type_flags, categories = {}, {}, {}
    cur = db.rate_cards.find(
        query, {"_id": 0, "store_id": 1, "category_name": 1, "customer_type": 1})
    async for rule in cur:
        sid_ = rule.get("store_id")
        if not sid_:
            continue
        name = (rule.get("category_name") or "").strip()
        if name and name.casefold() != "all":
            category_flags[sid_] = True
            categories.setdefault(sid_, {}).setdefault(name.casefold(), {"name": name})
        if (rule.get("customer_type") or "both").strip().lower() != "both":
            customer_type_flags[sid_] = True
    return category_flags, customer_type_flags, categories


@api.get("/public/stores")
async def public_stores(homepage: bool = False, limit: int = 0):
    """All active public stores (default), ordered by admin display_rank then name.
    Backward compatible: GET /api/public/stores still returns the full active list.
    Optional homepage=true restricts to curated (homepage_visible) stores and limit
    caps the count for homepage widgets."""
    filt = public_filter()
    if homepage:
        filt["homepage_visible"] = True
    stores = await db.stores.find(filt, {"_id": 0}).sort(
        [("display_rank", 1), ("name", 1)]).to_list(500)
    if limit and limit > 0:
        stores = stores[:limit]
    cat_flags, ctype_flags, _ = await _store_affiliate_summary()
    for s in stores:
        s["has_category_rules"] = bool(cat_flags.get(s["id"]))
        s["has_customer_type_rules"] = bool(ctype_flags.get(s["id"]))
    return stores


@api.get("/public/stores/{slug}")
async def public_store_detail(slug: str):
    """Public store metadata and its eligible affiliate category choices."""
    store = await db.stores.find_one(
        {"slug": (slug or "").lower(), "active": True, "archived_at": None},
        STORE_PUBLIC_DETAIL_FIELDS)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    cat_flags, ctype_flags, categories = await _store_affiliate_summary(store["id"])
    store["has_category_rules"] = bool(cat_flags.get(store["id"]))
    store["has_customer_type_rules"] = bool(ctype_flags.get(store["id"]))
    store["categories"] = sorted(categories.get(store["id"], {}).values(),
                                 key=lambda category: category["name"].casefold())
    return store


@api.get("/public/categories")
async def public_categories():
    cats = await db.categories.find(public_filter(), {"_id": 0}).sort("sort_order", 1).to_list(500)
    return cats


@api.get("/public/platforms")
async def public_platforms():
    plats = await db.platforms.find(public_filter(), {"_id": 0}).sort("name", 1).to_list(500)
    return plats


async def _load_rates_for(store_id):
    """Active, published, non-archived rates for a store, split by kind."""
    cur = db.rate_cards.find({
        "store_id": store_id, "active": True, "status": "published", "archived_at": None,
    }, {"_id": 0})
    rows = await cur.to_list(2000)
    aff = [r for r in rows if r["platform_kind"] == "affiliate"]
    gc = [r for r in rows if r["platform_kind"] == "gift_card"]
    return aff, gc


async def _resolve_store(store_id=None, store_name=None):
    if store_id:
        s = await db.stores.find_one({"id": store_id}, {"_id": 0})
        if s:
            return s
    if store_name:
        s = await db.stores.find_one({"name": re.compile(f"^{re.escape(store_name)}$", re.I)}, {"_id": 0})
        if s:
            return s
    return None


@api.post("/calculate")
async def calculate(body: CalcBody, request: Request):
    store = await _resolve_store(body.store_id, body.store_name)
    if not store:
        # Fallback estimate flagged clearly
        store = {"name": body.store_name or "Unknown", "stacking": "unsure",
                 "split_payment_supported": "unsure", "stacking_note": None}
        aff, gc = [], []
        fallback = True
    else:
        aff, gc = await _load_rates_for(store["id"])
        fallback = False

    # Optional payment card: must be one of the caller's OWN saved profiles.
    # Guests and no-card requests calculate exactly as before (card=None).
    card = None
    if body.card_id:
        caller = await get_optional_user(request)
        if not caller:
            raise HTTPException(status_code=401, detail="Log in to use a saved card")
        owned = await db.card_profiles.find_one(
            {"id": body.card_id, "user_id": caller["id"]},
            {"_id": 0, "bank_name": 1, "card_type": 1, "card_network": 1, "card_name": 1})
        if not owned:
            raise HTTPException(status_code=404, detail="Card not found")
        card = owned

    result = calculate_stack(store, body.category, body.customer_type, body.mrp,
                             body.price, aff, gc, rate_version=RATE_VERSION, card=card)
    result["fallback"] = fallback

    # Enrich routes with the partner's website (editable in the console) so the UI
    # can offer a direct "Continue via <partner>" link. CTA points to the affiliate partner.
    plats = await db.platforms.find({}, {"_id": 0, "name": 1, "website_url": 1}).to_list(500)
    plat_url = {p["name"]: p.get("website_url") for p in plats}
    for side in (result.get("affiliate"), result.get("gift_card")):
        if not side:
            continue
        for opt in side.get("options", []):
            opt["platform_url"] = plat_url.get(opt.get("platform_name"))
        if side.get("best"):
            side["best"]["platform_url"] = plat_url.get(side["best"].get("platform_name"))
    result["store_url"] = store.get("store_url")
    result["preferred_affiliate_url"] = (
        result["affiliate"]["best"].get("platform_url")
        if result.get("affiliate") and result["affiliate"].get("best") else None
    )
    return result


@api.get("/trending")
async def trending():
    """Compute live deals using the same engine across a set of curated fixtures."""
    fixtures = [
        ("Firstcry", "All", "existing", 1599, 1338),
        ("Myntra", "Apparel", "existing", 3999, 2499),
        ("Nykaa", "Beauty", "existing", 1200, 899),
        ("Amazon", "Electronics", "existing", 24999, 19999),
        ("Amazon", "Furniture/Home", "existing", 8999, 5499),
        ("Dot & Key", "Beauty", "existing", 795, 595),
        ("Ajio", "Apparel", "new", 2499, 1499),
        ("Flipkart", "Apparel", "existing", 1999, 1299),
    ]
    deals = []
    for name, cat, ctype, mrp, price in fixtures:
        store = await _resolve_store(store_name=name)
        if not store:
            continue
        aff, gc = await _load_rates_for(store["id"])
        res = calculate_stack(store, cat, ctype, mrp, price, aff, gc, rate_version=RATE_VERSION)
        deals.append({
            "store": name, "category": cat, "customer_type": ctype,
            "mrp": mrp, "price": price,
            "extra_saved": res["summary"]["extra_saved"],
            "final_bill": res["summary"]["final_bill"],
            "total_saving": res["summary"]["total_saving"],
            "status": res["summary"]["status"],
            "double_stack": res["stacking"]["double_stack"],
        })
    deals.sort(key=lambda d: -d["extra_saved"]["rupees"])
    return deals


@api.get("/redirect/{slug}")
async def partner_redirect(slug: str, store: Optional[str] = None):
    """Resolve a trusted external destination for a KNOWN partner (no open redirect).

    The frontend never supplies the external URL — it only passes a partner slug
    (normalized platform name) plus optional non-sensitive `store` context. The
    destination is fully backend-controlled:

      1. If an ACTIVE Store × Affiliate Partner mapping exists for this
         combination, its configured deep-link destination_url is used.
      2. Otherwise we fall back to the partner's generic platform website_url
         (existing behavior — fully backward compatible).

    Only http(s) destinations that pass the safe-URL check are ever returned.
    """
    target = _norm_slug(slug)
    if not target:
        raise HTTPException(status_code=404, detail="Unknown partner")
    plats = await db.platforms.find(
        {"archived_at": None},
        {"_id": 0, "id": 1, "name": 1, "website_url": 1, "kind": 1}).to_list(500)
    match = next((p for p in plats if _norm_slug(p.get("name")) == target), None)
    if not match:
        raise HTTPException(status_code=404, detail="Unknown partner")

    # (1) Store × Affiliate Partner mapping takes precedence when active + valid.
    if store:
        st = await _resolve_store(store_name=store)
        if st:
            mapping = await db.affiliate_destinations.find_one(
                {"store_id": st["id"], "platform_id": match["id"], "active": True},
                {"_id": 0})
            if mapping and _is_safe_http_url(mapping.get("destination_url")):
                return {"partner": match["name"], "kind": match.get("kind"),
                        "url": mapping["destination_url"].strip(),
                        "store": st["name"], "mapping": True}

    # (2) Generic partner destination fallback (unchanged behavior).
    url = (match.get("website_url") or "").strip()
    if not _is_safe_http_url(url):
        raise HTTPException(status_code=404, detail="No trusted destination configured for this partner")
    return {"partner": match["name"], "kind": match.get("kind"), "url": url, "mapping": False}


@api.post("/detect")
async def detect(body: DetectBody):
    domains = await db.store_domains.find({"active": True}, {"_id": 0}).to_list(2000)
    stores = {s["id"]: s["name"] for s in await db.stores.find(public_filter(), {"_id": 0}).to_list(500)}
    for d in domains:
        d["store_name"] = stores.get(d["store_id"])
    store = detect_store(body.url, domains)
    keywords = await db.category_keywords.find({"active": True}, {"_id": 0}).to_list(5000)
    cat = detect_category(body.url, keywords, store_id=store["store_id"] if store else None)
    amazon_flipkart = bool(store and store.get("store_name", "").lower() in ("amazon", "flipkart"))
    return {"store": store, "category": cat, "amazon_flipkart_notice": amazon_flipkart}


@api.post("/category-correction")
async def category_correction(body: CorrectionBody):
    await db.category_corrections.insert_one({
        "id": str(uuid.uuid4()),
        "detected_category": body.detected_category,
        "corrected_category": body.corrected_category,
        "store_name": body.store_name,
        "confidence_band": body.confidence_band,
        "timestamp": now_iso(),
    })
    return {"ok": True}


@api.post("/feedback")
async def feedback(body: FeedbackBody):
    await db.feedback.insert_one({
        "id": str(uuid.uuid4()), "kind": body.kind, "name": body.name,
        "email": body.email, "message": body.message, "context": body.context,
        "timestamp": now_iso(), "status": "new",
    })
    return {"ok": True}


# --------------------------------------------------------------------------
# Gratitude (Aabhar Mandir) — atomic global counter with idempotency
# --------------------------------------------------------------------------

@api.get("/gratitude")
async def gratitude_get():
    doc = await db.gratitude.find_one({"id": "global"}, {"_id": 0})
    return {"count": (doc or {}).get("count", 0), "global": True}


@api.post("/gratitude/ring")
async def gratitude_ring(body: GratitudeBody):
    existing = await db.gratitude_actions.find_one({"idempotency_key": body.idempotency_key})
    if existing:
        doc = await db.gratitude.find_one({"id": "global"}, {"_id": 0})
        return {"count": doc["count"], "already": True}
    await db.gratitude_actions.insert_one({
        "id": str(uuid.uuid4()), "idempotency_key": body.idempotency_key,
        "reversed": False, "timestamp": now_iso(),
    })
    doc = await db.gratitude.find_one_and_update(
        {"id": "global"}, {"$inc": {"count": 1}}, return_document=True)
    return {"count": doc["count"], "already": False}


@api.post("/gratitude/undo")
async def gratitude_undo(body: GratitudeBody):
    action = await db.gratitude_actions.find_one({"idempotency_key": body.idempotency_key})
    if not action or action.get("reversed"):
        doc = await db.gratitude.find_one({"id": "global"}, {"_id": 0})
        return {"count": doc["count"], "reversed": False}
    await db.gratitude_actions.update_one(
        {"idempotency_key": body.idempotency_key}, {"$set": {"reversed": True}})
    doc = await db.gratitude.find_one_and_update(
        {"id": "global", "count": {"$gt": 0}}, {"$inc": {"count": -1}}, return_document=True)
    if doc is None:
        doc = await db.gratitude.find_one({"id": "global"})
    return {"count": doc["count"], "reversed": True}


# --------------------------------------------------------------------------
# Admin: generic reference CRUD (platforms, stores, categories, domains, keywords)
# --------------------------------------------------------------------------

def _entity_ref_query(coll_field, entity_id):
    return {coll_field: entity_id, "archived_at": None}


async def _is_referenced(entity_type, entity_id):
    field = {"platform": "platform_id", "store": "store_id", "category": "category_id"}[entity_type]
    return await db.rate_cards.count_documents(_entity_ref_query(field, entity_id)) > 0


# ---- Platforms ----
@api.get("/admin/platforms")
async def admin_platforms(user=Depends(require_any_role)):
    return await db.platforms.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/admin/platforms")
async def create_platform(body: dict, request: Request, user=Depends(require_write)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name required")
    if await db.platforms.find_one({"name": re.compile(f"^{re.escape(name)}$", re.I)}):
        raise HTTPException(409, "Platform name already exists")
    doc = {"id": str(uuid.uuid4()), "name": name, "kind": body.get("kind", "affiliate"),
           "website_url": body.get("website_url"), "active": True, "archived_at": None,
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.platforms.insert_one(dict(doc))
    await audit(user, "create", "platform", doc["id"], None, doc, request)
    return clean(doc)


@api.put("/admin/platforms/{pid}")
async def update_platform(pid: str, body: dict, request: Request, user=Depends(require_write)):
    before = await db.platforms.find_one({"id": pid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    upd = {k: body[k] for k in ("name", "kind", "website_url", "active") if k in body}
    upd["updated_at"] = now_iso()
    await db.platforms.update_one({"id": pid}, {"$set": upd})
    after = await db.platforms.find_one({"id": pid}, {"_id": 0})
    await audit(user, "update", "platform", pid, before, after, request)
    return after


@api.delete("/admin/platforms/{pid}")
async def archive_platform(pid: str, request: Request, user=Depends(require_write)):
    before = await db.platforms.find_one({"id": pid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    if await _is_referenced("platform", pid):
        await db.platforms.update_one({"id": pid}, {"$set": {"active": False, "archived_at": now_iso()}})
        await audit(user, "archive", "platform", pid, before, None, request)
        return {"archived": True, "reason": "referenced_by_rates"}
    await db.platforms.update_one({"id": pid}, {"$set": {"active": False, "archived_at": now_iso()}})
    await audit(user, "archive", "platform", pid, before, None, request)
    return {"archived": True}


@api.post("/admin/platforms/{pid}/restore")
async def restore_platform(pid: str, request: Request, user=Depends(require_write)):
    await db.platforms.update_one({"id": pid}, {"$set": {"active": True, "archived_at": None}})
    await audit(user, "restore", "platform", pid, None, None, request)
    return {"restored": True}


# ---- Partner Destinations (Store × Partner deep-link mapping: affiliate + gift_card) ----
async def _enrich_destination(d, stores_by_id, plats_by_id):
    d = dict(d)
    st = stores_by_id.get(d.get("store_id")) or {}
    pl = plats_by_id.get(d.get("platform_id")) or {}
    d["store_name"] = st.get("name")
    d["partner_name"] = pl.get("name")
    d["partner_kind"] = pl.get("kind")
    return d


@api.get("/admin/affiliate-destinations")
async def admin_affiliate_destinations(user=Depends(require_any_role)):
    """List all Store × Affiliate Partner destination mappings (admin-only)."""
    rows = await db.affiliate_destinations.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    stores = {s["id"]: s for s in await db.stores.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)}
    plats = {p["id"]: p for p in await db.platforms.find({}, {"_id": 0, "id": 1, "name": 1, "kind": 1}).to_list(1000)}
    return [await _enrich_destination(r, stores, plats) for r in rows]


@api.post("/admin/affiliate-destinations")
async def create_affiliate_destination(body: dict, request: Request, user=Depends(require_write)):
    """Create a trusted Store × Affiliate Partner destination mapping. Validates
    that the store & affiliate partner exist and the destination is a safe
    http(s) URL. Enforces one mapping per Store × Partner combination."""
    store_id = (body.get("store_id") or "").strip()
    platform_id = (body.get("platform_id") or "").strip()
    dest = (body.get("destination_url") or "").strip()
    if not store_id or not platform_id:
        raise HTTPException(400, "store_id and platform_id are required")
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(404, "Store not found")
    plat = await db.platforms.find_one({"id": platform_id}, {"_id": 0})
    if not plat:
        raise HTTPException(404, "Partner not found")
    if plat.get("kind") not in ("affiliate", "gift_card"):
        raise HTTPException(400, "Selected partner must be an affiliate or gift-card partner")
    if not _is_safe_http_url(dest):
        raise HTTPException(400, "destination_url must be a valid http(s) URL (unsafe schemes are rejected)")
    if await db.affiliate_destinations.find_one({"store_id": store_id, "platform_id": platform_id}):
        raise HTTPException(409, "A mapping for this Store × Partner already exists")
    doc = {"id": str(uuid.uuid4()), "store_id": store_id, "platform_id": platform_id,
           "destination_url": dest, "active": bool(body.get("active", True)),
           "created_at": now_iso(), "updated_at": now_iso()}
    try:
        await db.affiliate_destinations.insert_one(dict(doc))
    except DuplicateKeyError:
        raise HTTPException(409, "A mapping for this Store × Affiliate Partner already exists")
    await audit(user, "create", "affiliate_destination", doc["id"], None, doc, request)
    return clean(doc)


@api.put("/admin/affiliate-destinations/{mid}")
async def update_affiliate_destination(mid: str, body: dict, request: Request, user=Depends(require_write)):
    """Update a mapping's destination_url and/or active flag. The Store × Partner
    combination itself is immutable (delete + recreate to re-target)."""
    before = await db.affiliate_destinations.find_one({"id": mid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    upd = {}
    if "destination_url" in body:
        dest = (body.get("destination_url") or "").strip()
        if not _is_safe_http_url(dest):
            raise HTTPException(400, "destination_url must be a valid http(s) URL (unsafe schemes are rejected)")
        upd["destination_url"] = dest
    if "active" in body:
        upd["active"] = bool(body["active"])
    if not upd:
        raise HTTPException(400, "Nothing to update")
    upd["updated_at"] = now_iso()
    await db.affiliate_destinations.update_one({"id": mid}, {"$set": upd})
    after = await db.affiliate_destinations.find_one({"id": mid}, {"_id": 0})
    await audit(user, "update", "affiliate_destination", mid, before, after, request)
    return after


@api.delete("/admin/affiliate-destinations/{mid}")
async def delete_affiliate_destination(mid: str, request: Request, user=Depends(require_write)):
    """Remove a Store × Affiliate Partner mapping. Safe hard-delete: this is a
    standalone config row not referenced by rates/calculations, and removal
    simply reverts the combination to the generic partner fallback."""
    before = await db.affiliate_destinations.find_one({"id": mid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    await db.affiliate_destinations.delete_one({"id": mid})
    await audit(user, "delete", "affiliate_destination", mid, before, None, request)
    return {"deleted": True}


# ---- Stores + settings ----
@api.get("/admin/stores")
async def admin_stores(user=Depends(require_any_role)):
    return await db.stores.find({}, {"_id": 0}).sort([("display_rank", 1), ("name", 1)]).to_list(500)


@api.post("/admin/stores")
async def create_store(body: dict, request: Request, user=Depends(require_write)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name required")
    if await db.stores.find_one({"name": re.compile(f"^{re.escape(name)}$", re.I)}):
        raise HTTPException(409, "Store name already exists")
    slug = await _unique_store_slug(body.get("slug") or name)
    if body.get("display_rank") not in (None, ""):
        display_rank = int(body["display_rank"])
    else:
        last = await db.stores.find_one({}, {"_id": 0, "display_rank": 1},
                                        sort=[("display_rank", -1)])
        display_rank = int((last or {}).get("display_rank") or 0) + 1
    doc = {"id": str(uuid.uuid4()), "name": name, "active": True,
           "slug": slug,
           "stacking": body.get("stacking", "unsure"),
           "stacking_note": body.get("stacking_note"),
           "store_url": body.get("store_url"),
           "split_payment_supported": body.get("split_payment_supported", "unsure"),
           "display_rank": display_rank,
           "logo_url": body.get("logo_url"),
           "image_url": body.get("image_url"),
           "description": body.get("description"),
           "homepage_visible": bool(body.get("homepage_visible", True)),
           "featured": bool(body.get("featured", False)),
           "archived_at": None, "created_at": now_iso(), "updated_at": now_iso()}
    await db.stores.insert_one(dict(doc))
    await audit(user, "create", "store", doc["id"], None, doc, request)
    return clean(doc)


@api.put("/admin/stores/{sid_}")
async def update_store(sid_: str, body: dict, request: Request, user=Depends(require_write)):
    before = await db.stores.find_one({"id": sid_}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    upd = {k: body[k] for k in ("name", "active", "stacking", "stacking_note",
                                "store_url", "split_payment_supported",
                                "display_rank", "logo_url", "image_url",
                                "description", "homepage_visible", "featured") if k in body}
    if body.get("slug"):
        upd["slug"] = await _unique_store_slug(body["slug"], exclude_id=sid_)
    if "display_rank" in upd:
        if upd["display_rank"] in (None, ""):
            del upd["display_rank"]
        else:
            upd["display_rank"] = int(upd["display_rank"])
    for b in ("homepage_visible", "featured"):
        if b in upd:
            upd[b] = bool(upd[b])
    upd["updated_at"] = now_iso()
    await db.stores.update_one({"id": sid_}, {"$set": upd})
    after = await db.stores.find_one({"id": sid_}, {"_id": 0})
    action = "update_settings" if set(upd) & {"stacking", "split_payment_supported", "stacking_note"} else "update"
    await audit(user, action, "store", sid_, before, after, request)
    return after


@api.delete("/admin/stores/{sid_}")
async def archive_store(sid_: str, request: Request, user=Depends(require_write)):
    before = await db.stores.find_one({"id": sid_}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    await db.stores.update_one({"id": sid_}, {"$set": {"active": False, "archived_at": now_iso()}})
    await audit(user, "archive", "store", sid_, before, None, request)
    return {"archived": True, "referenced": await _is_referenced("store", sid_)}


@api.post("/admin/stores/{sid_}/restore")
async def restore_store(sid_: str, request: Request, user=Depends(require_write)):
    await db.stores.update_one({"id": sid_}, {"$set": {"active": True, "archived_at": None}})
    await audit(user, "restore", "store", sid_, None, None, request)
    return {"restored": True}


# ---- Store domains ----
@api.get("/admin/stores/{sid_}/domains")
async def list_domains(sid_: str, user=Depends(require_any_role)):
    return await db.store_domains.find({"store_id": sid_}, {"_id": 0}).to_list(200)


@api.post("/admin/stores/{sid_}/domains")
async def add_domain(sid_: str, body: dict, request: Request, user=Depends(require_write)):
    dom = (body.get("domain_or_alias") or "").strip().lower()
    if not dom:
        raise HTTPException(400, "Domain required")
    if await db.store_domains.find_one({"domain_or_alias": dom}):
        raise HTTPException(409, "Domain already mapped")
    doc = {"id": str(uuid.uuid4()), "store_id": sid_, "domain_or_alias": dom,
           "priority": int(body.get("priority", 5)), "active": True, "created_at": now_iso()}
    await db.store_domains.insert_one(dict(doc))
    await audit(user, "create", "store_domain", doc["id"], None, doc, request)
    return clean(doc)


@api.delete("/admin/domains/{did}")
async def delete_domain(did: str, request: Request, user=Depends(require_write)):
    before = await db.store_domains.find_one({"id": did}, {"_id": 0})
    await db.store_domains.delete_one({"id": did})
    await audit(user, "delete", "store_domain", did, before, None, request)
    return {"deleted": True}


# ---- Categories ----
@api.get("/admin/categories")
async def admin_categories(user=Depends(require_any_role)):
    return await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)


@api.post("/admin/categories")
async def create_category(body: dict, request: Request, user=Depends(require_write)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name required")
    if await db.categories.find_one({"name": re.compile(f"^{re.escape(name)}$", re.I)}):
        raise HTTPException(409, "Category already exists")
    count = await db.categories.count_documents({})
    doc = {"id": str(uuid.uuid4()), "name": name, "parent_id": body.get("parent_id"),
           "sort_order": int(body.get("sort_order", count)), "active": True,
           "archived_at": None, "created_at": now_iso(), "updated_at": now_iso()}
    await db.categories.insert_one(dict(doc))
    await audit(user, "create", "category", doc["id"], None, doc, request)
    return clean(doc)


@api.put("/admin/categories/{cid}")
async def update_category(cid: str, body: dict, request: Request, user=Depends(require_write)):
    before = await db.categories.find_one({"id": cid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    upd = {k: body[k] for k in ("name", "parent_id", "sort_order", "active") if k in body}
    upd["updated_at"] = now_iso()
    await db.categories.update_one({"id": cid}, {"$set": upd})
    after = await db.categories.find_one({"id": cid}, {"_id": 0})
    await audit(user, "update", "category", cid, before, after, request)
    return after


@api.delete("/admin/categories/{cid}")
async def archive_category(cid: str, request: Request, user=Depends(require_write)):
    before = await db.categories.find_one({"id": cid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    await db.categories.update_one({"id": cid}, {"$set": {"active": False, "archived_at": now_iso()}})
    await audit(user, "archive", "category", cid, before, None, request)
    return {"archived": True, "referenced": await _is_referenced("category", cid)}


@api.post("/admin/categories/{cid}/restore")
async def restore_category(cid: str, request: Request, user=Depends(require_write)):
    await db.categories.update_one({"id": cid}, {"$set": {"active": True, "archived_at": None}})
    await audit(user, "restore", "category", cid, None, None, request)
    return {"restored": True}


# ---- Category keywords ----
@api.get("/admin/keywords")
async def admin_keywords(user=Depends(require_any_role)):
    return await db.category_keywords.find({}, {"_id": 0}).to_list(5000)


@api.post("/admin/keywords")
async def create_keyword(body: dict, request: Request, user=Depends(require_write)):
    cat = await db.categories.find_one({"id": body.get("category_id")}, {"_id": 0})
    if not cat:
        raise HTTPException(400, "Invalid category")
    doc = {"id": str(uuid.uuid4()), "category_id": cat["id"], "category_name": cat["name"],
           "store_id": body.get("store_id"), "phrase": (body.get("phrase") or "").strip().lower(),
           "match_type": body.get("match_type", "contains"), "weight": float(body.get("weight", 1)),
           "is_exclusion": bool(body.get("is_exclusion", False)), "active": True,
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.category_keywords.insert_one(dict(doc))
    await audit(user, "create", "category_keyword", doc["id"], None, doc, request)
    return clean(doc)


@api.put("/admin/keywords/{kid}")
async def update_keyword(kid: str, body: dict, request: Request, user=Depends(require_write)):
    before = await db.category_keywords.find_one({"id": kid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    upd = {k: body[k] for k in ("phrase", "match_type", "weight", "is_exclusion", "store_id", "active") if k in body}
    upd["updated_at"] = now_iso()
    await db.category_keywords.update_one({"id": kid}, {"$set": upd})
    after = await db.category_keywords.find_one({"id": kid}, {"_id": 0})
    await audit(user, "update", "category_keyword", kid, before, after, request)
    return after


@api.delete("/admin/keywords/{kid}")
async def delete_keyword(kid: str, request: Request, user=Depends(require_write)):
    before = await db.category_keywords.find_one({"id": kid}, {"_id": 0})
    await db.category_keywords.delete_one({"id": kid})
    await audit(user, "delete", "category_keyword", kid, before, None, request)
    return {"deleted": True}


# --------------------------------------------------------------------------
# Admin: rate cards CRUD + matrix + import
# --------------------------------------------------------------------------

async def _enrich_rate(body):
    plat = await db.platforms.find_one({"id": body.get("platform_id")}, {"_id": 0})
    store = await db.stores.find_one({"id": body.get("store_id")}, {"_id": 0})
    cat = await db.categories.find_one({"id": body.get("category_id")}, {"_id": 0})
    if not (plat and store and cat):
        raise HTTPException(400, "Invalid platform/store/category")
    return plat, store, cat


CARD_NETWORK_VALUES = ("Visa", "Mastercard", "RuPay", "American Express", "Other")
CARD_TYPE_VALUES = ("Credit", "Debit")


def _validate_card_rule(body):
    """Validate optional card-eligibility config on a rate (admin-managed)."""
    mode = body.get("card_eligibility") or "no_card_requirement"
    if mode not in CARD_ELIGIBILITY_MODES:
        raise HTTPException(400, f"card_eligibility must be one of {', '.join(CARD_ELIGIBILITY_MODES)}")
    crit = body.get("card_criteria") or {}
    if not isinstance(crit, dict):
        raise HTTPException(400, "card_criteria must be an object")
    if crit.get("card_network") and crit["card_network"] not in CARD_NETWORK_VALUES:
        raise HTTPException(400, "card_criteria.card_network is invalid")
    if crit.get("card_type") and crit["card_type"] not in CARD_TYPE_VALUES:
        raise HTTPException(400, "card_criteria.card_type is invalid")
    if mode == "bank" and not (crit.get("bank_name") or "").strip():
        raise HTTPException(400, "card_criteria.bank_name is required for bank eligibility")
    if mode == "network" and not crit.get("card_network"):
        raise HTTPException(400, "card_criteria.card_network is required for network eligibility")
    if mode == "specific_card" and not any(
            crit.get(k) for k in ("bank_name", "card_type", "card_network")):
        raise HTTPException(400, "specific_card requires at least one card_criteria attribute")
    # Never allow credential-like keys to sneak into criteria
    forbidden = {"card_number", "cvv", "expiry", "expiry_date", "pin", "otp"} & {k.lower() for k in crit}
    if forbidden:
        raise HTTPException(400, "card_criteria must not contain sensitive card data")


def _validate_rate_body(body):
    if D(body.get("value")) < 0:
        raise HTTPException(400, "Value must be non-negative")
    for f in ("minimum_order_value", "maximum_eligible_amount"):
        if body.get(f) not in (None, "") and D(body.get(f)) < 0:
            raise HTTPException(400, f"{f} must be non-negative")
    vf, vu = body.get("valid_from"), body.get("valid_until")
    if vf and vu and str(vf) > str(vu):
        raise HTTPException(400, "valid_from must be before valid_until")
    _validate_card_rule(body)


@api.get("/admin/rates")
async def admin_rates(user=Depends(require_any_role), store_id: str = None,
                      platform_id: str = None, customer_type: str = None,
                      status: str = None, include_archived: bool = False):
    q_ = {}
    if store_id:
        q_["store_id"] = store_id
    if platform_id:
        q_["platform_id"] = platform_id
    if customer_type:
        q_["customer_type"] = customer_type
    if status:
        q_["status"] = status
    if not include_archived:
        q_["archived_at"] = None
    return await db.rate_cards.find(q_, {"_id": 0}).sort("updated_at", -1).to_list(3000)


@api.post("/admin/rates")
async def create_rate(body: dict, request: Request, user=Depends(require_write)):
    _validate_rate_body(body)
    plat, store, cat = await _enrich_rate(body)
    doc = {
        "id": str(uuid.uuid4()),
        "platform_id": plat["id"], "platform_name": plat["name"], "platform_kind": plat["kind"],
        "store_id": store["id"], "store_name": store["name"],
        "category_id": cat["id"], "category_name": cat["name"],
        "customer_type": body.get("customer_type", "both"),
        "value_type": body.get("value_type", "percent"), "value": str(body.get("value")),
        "minimum_order_value": (str(body["minimum_order_value"]) if body.get("minimum_order_value") not in (None, "") else None),
        "maximum_eligible_amount": (str(body["maximum_eligible_amount"]) if body.get("maximum_eligible_amount") not in (None, "") else None),
        "valid_from": body.get("valid_from"), "valid_until": body.get("valid_until"),
        "card_eligibility": body.get("card_eligibility") or "no_card_requirement",
        "card_criteria": body.get("card_criteria") or None,
        "priority": int(body.get("priority", 0)), "notes": body.get("notes"),
        "active": bool(body.get("active", True)),
        "status": body.get("status", "published"),
        "import_batch_id": None, "archived_at": None,
        "created_by": user["email"], "updated_by": user["email"],
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.rate_cards.insert_one(dict(doc))
    await audit(user, "create", "rate_card", doc["id"], None, doc, request)
    return clean(doc)


@api.put("/admin/rates/{rid}")
async def update_rate(rid: str, body: dict, request: Request, user=Depends(require_write)):
    before = await db.rate_cards.find_one({"id": rid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    _validate_rate_body({**before, **body})
    upd = {}
    for f in ("customer_type", "value_type", "value", "minimum_order_value",
              "maximum_eligible_amount", "valid_from", "valid_until", "priority",
              "notes", "active", "status", "card_eligibility", "card_criteria"):
        if f in body:
            v = body[f]
            if f in ("value", "minimum_order_value", "maximum_eligible_amount") and v not in (None, ""):
                v = str(v)
            upd[f] = v
    upd["updated_by"] = user["email"]
    upd["updated_at"] = now_iso()
    await db.rate_cards.update_one({"id": rid}, {"$set": upd})
    after = await db.rate_cards.find_one({"id": rid}, {"_id": 0})
    await audit(user, "update", "rate_card", rid, before, after, request)
    return after


@api.post("/admin/rates/{rid}/duplicate")
async def duplicate_rate(rid: str, request: Request, user=Depends(require_write)):
    src = await db.rate_cards.find_one({"id": rid}, {"_id": 0})
    if not src:
        raise HTTPException(404, "Not found")
    doc = dict(src)
    doc["id"] = str(uuid.uuid4())
    doc["status"] = "draft"
    doc["created_at"] = doc["updated_at"] = now_iso()
    await db.rate_cards.insert_one(dict(doc))
    await audit(user, "duplicate", "rate_card", doc["id"], None, doc, request)
    return clean(doc)


@api.delete("/admin/rates/{rid}")
async def archive_rate(rid: str, request: Request, user=Depends(require_write)):
    before = await db.rate_cards.find_one({"id": rid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Not found")
    await db.rate_cards.update_one({"id": rid}, {"$set": {"active": False, "archived_at": now_iso()}})
    await audit(user, "archive", "rate_card", rid, before, None, request)
    return {"archived": True}


@api.post("/admin/rates/{rid}/activate")
async def activate_rate(rid: str, body: dict, request: Request, user=Depends(require_write)):
    active = bool(body.get("active", True))
    await db.rate_cards.update_one({"id": rid}, {"$set": {"active": active, "updated_at": now_iso()}})
    await audit(user, "activate" if active else "deactivate", "rate_card", rid, None, {"active": active}, request)
    return {"ok": True}


# ---- Bulk paste / CSV import ----

def parse_rate_token(token, default_type="percent"):
    token = (token or "").strip()
    if not token:
        return None, None
    if "%" in token:
        return "percent", token.replace("%", "").strip()
    if "₹" in token.lower() or token.lower().startswith("rs") or token.lower().startswith("inr"):
        return "flat_amount", re.sub(r"[^0-9.]", "", token)
    num = re.sub(r"[^0-9.]", "", token)
    return default_type, num


def parse_paste(raw: str):
    """Parse tab/comma/pipe delimited spreadsheet paste. Return list of dict rows."""
    rows = []
    lines = [l for l in raw.replace("\r", "").split("\n") if l.strip()]
    if not lines:
        return rows
    def split_line(l):
        if "\t" in l:
            return [c.strip() for c in l.split("\t")]
        if "|" in l:
            return [c.strip() for c in l.split("|")]
        return [c.strip() for c in l.split(",")]
    header = split_line(lines[0])
    hl = [h.lower() for h in header]
    has_header = any(k in " ".join(hl) for k in ("category", "rate", "new", "existing", "type", "mov", "cap"))
    start = 1 if has_header else 0
    # column index map
    idx = {}
    if has_header:
        for i, h in enumerate(hl):
            if "categor" in h:
                idx["category"] = i
            elif "new" in h:
                idx["new"] = i
            elif "existing" in h or ("rate" in h and "new" not in h):
                idx["existing"] = i
            elif h == "type":
                idx["type"] = i
            elif "mov" in h or "minimum" in h:
                idx["mov"] = i
            elif "cap" in h or "max" in h:
                idx["cap"] = i
            elif "from" in h:
                idx["valid_from"] = i
            elif "until" in h or "to" == h:
                idx["valid_until"] = i
            elif "note" in h:
                idx["notes"] = i
    for line in lines[start:]:
        cols = split_line(line)
        if not cols or not cols[0]:
            continue
        if has_header:
            def get(k):
                i = idx.get(k)
                return cols[i] if (i is not None and i < len(cols)) else None
            rows.append({
                "category": get("category") or cols[0],
                "new": get("new"), "existing": get("existing"),
                "type": get("type"), "mov": get("mov"), "cap": get("cap"),
                "valid_from": get("valid_from"), "valid_until": get("valid_until"),
                "notes": get("notes"),
            })
        else:
            rows.append({"category": cols[0],
                         "existing": cols[1] if len(cols) > 1 else None,
                         "new": cols[2] if len(cols) > 2 else None})
    return rows


@api.post("/admin/rates/import/preview")
async def import_preview(body: dict, user=Depends(require_write)):
    store = await db.stores.find_one({"id": body.get("store_id")}, {"_id": 0})
    plat = await db.platforms.find_one({"id": body.get("platform_id")}, {"_id": 0})
    if not (store and plat):
        raise HTTPException(400, "Store and platform required")
    customer_type = body.get("customer_type", "existing")
    cats = await db.categories.find({"archived_at": None}, {"_id": 0}).to_list(500)
    cat_by_name = {c["name"].lower(): c for c in cats}
    raw = body.get("raw") or ""
    parsed = parse_paste(raw) if isinstance(raw, str) else raw
    existing_rates = await db.rate_cards.find({
        "store_id": store["id"], "platform_id": plat["id"], "customer_type": customer_type,
        "status": "published", "archived_at": None,
    }, {"_id": 0}).to_list(2000)
    existing_by_cat = {r["category_name"].lower(): r for r in existing_rates}

    preview = []
    for row in parsed:
        cat_name = (row.get("category") or "").strip()
        token = row.get(customer_type) or row.get("existing") or row.get("new")
        vtype, value = parse_rate_token(token or "", body.get("value_type", "percent"))
        item = {"input_category": cat_name, "value_type": vtype, "value": value,
                "mov": row.get("mov"), "cap": row.get("cap"),
                "valid_from": row.get("valid_from"), "valid_until": row.get("valid_until"),
                "notes": row.get("notes")}
        matched = cat_by_name.get(cat_name.lower())
        if not cat_name:
            item["status"] = "invalid"; item["reason"] = "Missing category"
        elif value in (None, "") or D(value) < 0:
            item["status"] = "invalid"; item["reason"] = "Invalid rate value"
            item["matched_category"] = matched["name"] if matched else None
        elif not matched:
            # suggest close match
            suggestion = next((c["name"] for c in cats if cat_name.lower() in c["name"].lower()
                               or c["name"].lower() in cat_name.lower()), None)
            item["status"] = "unmatched"; item["suggestion"] = suggestion
        else:
            item["matched_category"] = matched["name"]
            item["category_id"] = matched["id"]
            prev = existing_by_cat.get(matched["name"].lower())
            if prev is None:
                item["status"] = "new"
            elif prev["value"] == str(value) and prev["value_type"] == vtype:
                item["status"] = "unchanged"; item["previous_value"] = prev["value"]
            else:
                item["status"] = "changed"; item["previous_value"] = f"{prev['value']} ({prev['value_type']})"
        preview.append(item)

    counts = {}
    for p in preview:
        counts[p["status"]] = counts.get(p["status"], 0) + 1
    return {"store": store["name"], "platform": plat["name"],
            "customer_type": customer_type, "rows": preview, "counts": counts}


@api.post("/admin/rates/import/publish")
async def import_publish(body: dict, request: Request, user=Depends(require_write)):
    store = await db.stores.find_one({"id": body.get("store_id")}, {"_id": 0})
    plat = await db.platforms.find_one({"id": body.get("platform_id")}, {"_id": 0})
    if not (store and plat):
        raise HTTPException(400, "Store and platform required")
    customer_type = body.get("customer_type", "existing")
    rows = body.get("rows") or []  # accepted rows from preview (new/changed)
    accepted = [r for r in rows if r.get("status") in ("new", "changed") and r.get("category_id")]
    if not accepted:
        raise HTTPException(400, "No valid rows to publish")

    batch_id = str(uuid.uuid4())
    superseded_ids = []
    inserted_ids = []
    for r in accepted:
        # archive existing published rate for same dimensions
        existing = await db.rate_cards.find_one({
            "store_id": store["id"], "platform_id": plat["id"],
            "category_id": r["category_id"], "customer_type": customer_type,
            "status": "published", "archived_at": None,
        })
        if existing:
            await db.rate_cards.update_one({"id": existing["id"]},
                {"$set": {"archived_at": now_iso(), "active": False, "superseded_by_batch": batch_id}})
            superseded_ids.append(existing["id"])
        doc = {
            "id": str(uuid.uuid4()),
            "platform_id": plat["id"], "platform_name": plat["name"], "platform_kind": plat["kind"],
            "store_id": store["id"], "store_name": store["name"],
            "category_id": r["category_id"], "category_name": r.get("matched_category"),
            "customer_type": customer_type,
            "value_type": r.get("value_type", "percent"), "value": str(r.get("value")),
            "minimum_order_value": (str(r["mov"]) if r.get("mov") not in (None, "") else None),
            "maximum_eligible_amount": (str(r["cap"]) if r.get("cap") not in (None, "") else None),
            "valid_from": r.get("valid_from"), "valid_until": r.get("valid_until"),
            "priority": 0, "notes": r.get("notes"), "active": True, "status": "published",
            "import_batch_id": batch_id, "archived_at": None,
            "created_by": user["email"], "updated_by": user["email"],
            "created_at": now_iso(), "updated_at": now_iso(),
        }
        await db.rate_cards.insert_one(dict(doc))
        inserted_ids.append(doc["id"])

    imp = {"id": batch_id, "store_id": store["id"], "platform_id": plat["id"],
           "customer_type": customer_type, "status": "published",
           "actor": user["email"], "row_count": len(accepted),
           "inserted_ids": inserted_ids, "superseded_ids": superseded_ids,
           "rejected": [r for r in rows if r.get("status") in ("invalid", "unmatched")],
           "created_at": now_iso()}
    await db.rate_imports.insert_one(dict(imp))
    await audit(user, "import_publish", "rate_import", batch_id, None,
                {"count": len(accepted), "store": store["name"], "platform": plat["name"]}, request)
    return {"batch_id": batch_id, "inserted": len(inserted_ids), "superseded": len(superseded_ids)}


@api.post("/admin/rates/import/rollback")
async def import_rollback(body: dict, request: Request, user=Depends(require_write)):
    batch_id = body.get("batch_id")
    imp = await db.rate_imports.find_one({"id": batch_id}, {"_id": 0})
    if not imp:
        raise HTTPException(404, "Import batch not found")
    if imp.get("status") == "rolled_back":
        raise HTTPException(400, "Already rolled back")
    await db.rate_cards.delete_many({"id": {"$in": imp.get("inserted_ids", [])}})
    for sid_ in imp.get("superseded_ids", []):
        await db.rate_cards.update_one({"id": sid_},
            {"$set": {"archived_at": None, "active": True}, "$unset": {"superseded_by_batch": ""}})
    await db.rate_imports.update_one({"id": batch_id}, {"$set": {"status": "rolled_back", "rolled_back_at": now_iso()}})
    await audit(user, "import_rollback", "rate_import", batch_id, imp, None, request)
    return {"rolled_back": True}


@api.get("/admin/rates/imports")
async def list_imports(user=Depends(require_any_role)):
    return await db.rate_imports.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---- Matrix + CSV ----
@api.get("/admin/rates/matrix")
async def rate_matrix(store_id: str, platform_id: str, customer_type: str = "existing",
                      user=Depends(require_any_role)):
    cats = await db.categories.find({"archived_at": None}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    rates = await db.rate_cards.find({
        "store_id": store_id, "platform_id": platform_id, "customer_type": customer_type,
        "archived_at": None,
    }, {"_id": 0}).to_list(2000)
    by_cat = {r["category_name"]: r for r in rates}
    matrix = []
    for c in cats:
        r = by_cat.get(c["name"])
        matrix.append({
            "category_id": c["id"], "category": c["name"],
            "rate_id": r["id"] if r else None,
            "value": r["value"] if r else None,
            "value_type": r["value_type"] if r else "percent",
            "mov": r.get("minimum_order_value") if r else None,
            "cap": r.get("maximum_eligible_amount") if r else None,
            "valid_from": r.get("valid_from") if r else None,
            "valid_until": r.get("valid_until") if r else None,
            "active": r.get("active") if r else False,
            "notes": r.get("notes") if r else None,
        })
    return {"matrix": matrix}


@api.get("/admin/rates/export.csv")
async def export_csv(store_id: str, platform_id: str, customer_type: str = "existing",
                     user=Depends(require_any_role)):
    data = await rate_matrix(store_id, platform_id, customer_type, user)
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["Category", "Rate", "Type", "MOV", "Cap", "Valid From", "Valid Until", "Notes"])
    for row in data["matrix"]:
        val = ""
        if row["value"] is not None:
            val = f"{row['value']}%" if row["value_type"] == "percent" else f"₹{row['value']}"
        w.writerow([row["category"], val, row["value_type"], row["mov"] or "",
                    row["cap"] or "", row["valid_from"] or "", row["valid_until"] or "", row["notes"] or ""])
    return Response(content=out.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=yukticart_rates.csv"})


# --------------------------------------------------------------------------
# Admin: audit log, corrections, roles
# --------------------------------------------------------------------------

@api.get("/admin/audit")
async def get_audit(user=Depends(require_manage), limit: int = 200):
    return await db.audit_log.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)


@api.get("/admin/corrections")
async def get_corrections(user=Depends(require_manage)):
    pipeline = [
        {"$group": {
            "_id": {"detected": "$detected_category", "corrected": "$corrected_category", "store": "$store_name"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"count": -1}}, {"$limit": 100},
    ]
    rows = await db.category_corrections.aggregate(pipeline).to_list(100)
    return [{"detected": r["_id"]["detected"], "corrected": r["_id"]["corrected"],
             "store": r["_id"]["store"], "count": r["count"]} for r in rows]


@api.get("/admin/feedback")
async def get_feedback(user=Depends(require_manage)):
    return await db.feedback.find({}, {"_id": 0}).sort("timestamp", -1).to_list(300)


@api.get("/admin/onboarding")
async def onboarding_status(user=Depends(require_manage)):
    return {
        "platforms": await db.platforms.count_documents({"archived_at": None}),
        "stores": await db.stores.count_documents({"archived_at": None}),
        "domains": await db.store_domains.count_documents({"active": True}),
        "categories": await db.categories.count_documents({"archived_at": None}),
        "keywords": await db.category_keywords.count_documents({"active": True}),
        "rates": await db.rate_cards.count_documents({"status": "published", "archived_at": None}),
    }


@api.get("/health")
async def health():
    """Fast, uncached readiness probe; a live process alone is not sufficient."""
    headers = {"Cache-Control": "no-store"}
    try:
        await asyncio.wait_for(db.command("ping"), timeout=2.0)
    except Exception as exc:
        logger.warning("MongoDB readiness ping failed (%s)", type(exc).__name__)
        return JSONResponse(status_code=503, content={"ready": False, "database": False},
                            headers=headers)
    return JSONResponse(content={"ready": True, "database": True}, headers=headers)


@api.get("/")
async def root():
    return {"service": "YuktiCart", "status": "ok", "rate_version": RATE_VERSION}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
