// Generated brand assets (cohesive gold-theme illustrations)
export const MASCOTS = {
  joyful: "https://static.prod-images.emergentagent.com/jobs/005ee276-57ed-4eb5-b127-226544b04936/images/a7407bb8b2ca21e034bc657c1e0618d22ae88900d3eda82233fef6721e5041ba.jpeg",
  calm: "https://static.prod-images.emergentagent.com/jobs/005ee276-57ed-4eb5-b127-226544b04936/images/338d89d816464ae892f04e65507a76063df08bbf18dd91961b7e0da6dd20175b.jpeg",
  sad: "https://static.prod-images.emergentagent.com/jobs/005ee276-57ed-4eb5-b127-226544b04936/images/c443fd4eb8300e4a42dbc47cf96c0e491969eac5fde1a23abd0eefb35f6fad07.jpeg",
  think: "https://static.prod-images.emergentagent.com/jobs/005ee276-57ed-4eb5-b127-226544b04936/images/6e2f1bdd5bb2a7e87eb4bab270e97333283abdaddd255207140065283693d0dd.jpeg",
  diya: "https://static.prod-images.emergentagent.com/jobs/005ee276-57ed-4eb5-b127-226544b04936/images/b65ba2ce489a83d8d9c56f99f5cf528c5d490fb706463d38d55537c611770519.jpeg",
};

// --------------------------------------------------------------------------
// Shared static asset maps (brand logos, category images, deal images).
// Centralized here so pages/components import a single source of truth
// instead of maintaining duplicate hardcoded mappings. Paths are unchanged
// from their previous inline definitions in Home.jsx / discovery.jsx /
// TrendingDeals.jsx.
// --------------------------------------------------------------------------

// Brand/store logos, keyed by normalized name (see normalizeAssetKey).
export const BRAND_ASSETS = {
  amazon: "/assets/brands/amazon.png",
  flipkart: "/assets/brands/flipkart.svg",
  firstcry: "/assets/brands/firstcry.png",
  tatacliq: "/assets/brands/tata-cliq.svg",
  myntra: "/assets/brands/myntra.png",
  nykaa: "/assets/brands/nykaa.svg",
  ajio: "/assets/brands/ajio.jpg",
  foxtale: "/assets/brands/foxtale.jpg",

  blinkit: "/assets/brands/blinkit.png",
  dotkey: "/assets/brands/dot-key.svg",
  hyugalife: "/assets/brands/hyugalife.jpg",
  koparoclean: "/assets/brands/koparo-clean.jpg",
  shopsy: "/assets/brands/shopsy.png",
  shyaway: "/assets/brands/shyaway.jpg",
  swiggyinstamart: "/assets/brands/swiggy-instamart.png",
  zomato: "/assets/brands/zomato.svg",

  timesprime: "/assets/brands/timesprime.jpg",
  emergent: "/assets/brands/emergent.png",
};

// Category images, keyed by lowercased, single-spaced category name.
export const CATEGORY_ASSETS = {
  beauty: "/assets/categories/beauty-grooming.webp",
  "kitchen & dining": "/assets/categories/kitchen-dining.webp",
  electronics: "/assets/categories/electronics.webp",
  fashion: "/assets/categories/fashion.webp",
  "mobiles & smartphones": "/assets/categories/mobiles-smartphones.webp",
  "pharmacy & healthcare": "/assets/categories/pharmacy-healthcare.webp",
};

// Deal images, keyed by a short token matched against deal text.
export const DEAL_ASSETS = {
  amazon: "/assets/deals/boat-rockerz-113.webp",
};

export const normalizeAssetKey = (value = "") =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

export const getBrandAsset = (name) => BRAND_ASSETS[normalizeAssetKey(name)];

export const getCategoryAsset = (name) => {
  const normalized = (name || "").toLowerCase().replace(/\s+/g, " ").trim();
  return CATEGORY_ASSETS[normalized];
};

export const getDealImage = (deal) => {
  const haystack = normalizeAssetKey(
    `${deal?.title || ""} ${deal?.product_name || ""} ${deal?.name || ""} ${deal?.store || ""}`
  );

  if (haystack.includes("boat") || haystack.includes("rockerz113")) {
    return DEAL_ASSETS.boat;
  }

  return deal?.image_url || deal?.image || null;
};
