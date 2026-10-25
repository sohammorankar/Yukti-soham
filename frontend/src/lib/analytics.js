// Google Analytics 4 — loads only when REACT_APP_GA_MEASUREMENT_ID is configured.
// Tracks exactly the 5 YuktiCart business events (see call sites) and nothing else.
// Never send passwords, tokens, full invoices, uploaded images, gift-card codes,
// customer messages or other sensitive data — only non-sensitive labels like
// store/category/partner names and event type.
// ad_storage / ad_user_data / ad_personalization stay denied — YuktiCart runs no
// ads — matching the Cookie Policy's existing promise not to use ad trackers.
const MEASUREMENT_ID = process.env.REACT_APP_GA_MEASUREMENT_ID;
let initialized = false;

function hasValidId() {
  return Boolean(MEASUREMENT_ID && /^G-[A-Z0-9]+$/i.test(MEASUREMENT_ID));
}

export function initAnalytics() {
  if (!hasValidId() || initialized) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });
  window.gtag("config", MEASUREMENT_ID, { anonymize_ip: true });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
  initialized = true;
}

// Fire-and-forget; silently no-ops until GA4 is configured/loaded, so call
// sites never need to guard on whether analytics is enabled.
export function trackEvent(name, params = {}) {
  if (!initialized || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}
