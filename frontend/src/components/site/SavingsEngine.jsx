import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Link2, Store, Tags, Calculator, Info, BadgeCheck, HelpCircle, Frown, Smile, Loader2, CreditCard, ArrowUpRight, X } from "lucide-react";
import { Combobox } from "@/components/Combobox";
import { ProductImageInput } from "@/components/site/ProductImageInput";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, formatApiErrorDetail } from "@/lib/api";
import { money, rateLabel } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";

// Lightweight check so we only call /api/detect when the URL is "complete enough".
// Requires a domain-like token (something.tld) — avoids firing on partial typing.
function looksLikeUrl(val) {
  const v = (val || "").trim();
  if (v.length < 4) return false;
  return /(^https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/|$|\?|#)/i.test(v);
}

export function SavingsEngine({ onResult, initial, initialStores }) {
  const { isAuthed } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stores, setStores] = useState(() => initialStores || []);
  const [categories, setCategories] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [categoryGroup, setCategoryGroup] = useState("");
  const [categoriesForStore, setCategoriesForStore] = useState("");
  const [url, setUrl] = useState("");
  const [storeId, setStoreId] = useState("");
  const [category, setCategory] = useState("");
  const [customerType, setCustomerType] = useState("existing"); // default Existing
  const [mrp, setMrp] = useState("");
  const [price, setPrice] = useState("");
  const [detection, setDetection] = useState(null);
  const [amazonFlipkart, setAmazonFlipkart] = useState(false);
  const [detectedCategory, setDetectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState("");
  const [detectedStoreName, setDetectedStoreName] = useState(null);
  const [storeDetails, setStoreDetails] = useState(null);
  const lastDetectedUrlRef = useRef("");
  const detectionRequest = useRef(0);
  const inputsKey = JSON.stringify([storeId, category, customerType, mrp, price, url]);
  const currentInputs = useRef(inputsKey);
  currentInputs.current = inputsKey;

  useEffect(() => {
    setLastResult(null);
    onResult(null);
  }, [inputsKey, onResult]);
  useEffect(() => () => { detectionRequest.current += 1; currentInputs.current = null; }, []);

  useEffect(() => {
    if (initialStores) { setStores(initialStores); return; }
    api.get("/public/stores")
      .then(({ data }) => setStores(data))
      .catch(() => toast.error("Could not load stores"));
  }, [initialStores]);

  useEffect(() => {
    if (initial) {
      setStoreId(initial.store_id || ""); setCategory(initial.category || "");
      setCustomerType(initial.customer_type || "existing");
      setMrp(String(initial.mrp || "")); setPrice(String(initial.price || ""));
      if (initial.url) setUrl(initial.url);
    }
  }, [initial]);

  // Store pages can deep-link into the Savings Engine with ?store=<slug>.
  // Resolve that slug against the already-loaded public store list, then consume
  // the query parameter so the URL stays clean. Category and customer type are
  // intentionally left to the existing detection/rule-driven flow.
  useEffect(() => {
    const requestedStoreSlug = (searchParams.get("store") || "").trim().toLowerCase();
    if (!requestedStoreSlug || !stores.length) return;

    const matchedStore = stores.find(
      (store) => (store.slug || "").trim().toLowerCase() === requestedStoreSlug
    );
    if (!matchedStore) return;

    if (storeId !== matchedStore.id) {
      setStoreId(matchedStore.id);
      setDetectedStoreName(null);
      setDetection(null);
      setDetectedCategory(null);
      setCategory("");
      setCategoryGroup("");
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("store");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, stores, storeId, setSearchParams]);

  const storeOptions = useMemo(() => stores.map((s) => ({ value: s.id, label: s.name })), [stores]);
  const visibleGroups = useMemo(() => categoriesForStore === storeId ? categoryGroups : [],
    [categoryGroups, categoriesForStore, storeId]);
  const catOptions = useMemo(() => visibleGroups.map((group) => ({
    value: group.name, label: group.name,
  })), [visibleGroups]);
  const selectedCategoryGroup = useMemo(() => visibleGroups.find((group) =>
    group.categories.some((item) => item.name.toLowerCase() === (category || "").toLowerCase()))
    || visibleGroups.find((group) => group.name === categoryGroup),
  [visibleGroups, category, categoryGroup]);
  const exactCategoryOptions = useMemo(() => (selectedCategoryGroup?.categories || [])
    .map((item) => ({ value: item.name, label: item.name })), [selectedCategoryGroup]);
  const selectedStore = stores.find((s) => s.id === storeId);
  const storeSlug = selectedStore?.slug;

  // These flags come from the same active, published, non-archived affiliate
  // rules as the selected store's public category choices.
  const showCategory = !!selectedStore?.has_category_rules;
  const showCustomerType = !!selectedStore?.has_customer_type_rules;

  useEffect(() => {
    setCategories([]);
    setCategoryGroups([]);
    setCategoryGroup("");
    setCategoriesForStore("");
    setStoreDetails(null);
    if (!storeSlug) return;
    let cancelled = false;
    api.get(`/public/stores/${encodeURIComponent(storeSlug)}`)
      .then(({ data }) => {
        if (cancelled) return;
        setStoreDetails(data);
        const available = (Array.isArray(data.categories) ? data.categories : [])
          .filter((c) => (c?.name || "").trim().toLowerCase() !== "all");
        const groups = (Array.isArray(data.category_groups) ? data.category_groups : [])
          .filter((group) => Array.isArray(group?.categories) && group.categories.length)
          .map((group) => ({
            ...group,
            categories: group.categories.filter((item) =>
              (item?.name || "").trim().toLowerCase() !== "all"),
          }))
          .filter((group) => group.categories.length);
        const displayGroups = groups.length ? groups
          : available.map((item) => ({ name: item.name, categories: [item] }));
        setCategories(available);
        setCategoryGroups(displayGroups);
        setCategoriesForStore(storeId);
        setCategory((current) => {
          const match = available.find((c) => c.name.toLowerCase() === (current || "").trim().toLowerCase());
          return match?.name || "";
        });
      })
      .catch(() => {
        if (!cancelled) { setCategory(""); toast.error("Could not load store categories"); }
      });
    return () => { cancelled = true; };
    }, [storeId, storeSlug, showCategory]);

  // When the store changes (manually or via URL detection), drop any stale value
  // for a dimension that no longer applies so it is never sent into the calc.
  useEffect(() => {
    if (!selectedStore) return;
    if (!selectedStore.has_category_rules) setCategory("");
    if (!selectedStore.has_customer_type_rules) setCustomerType("existing");
  }, [storeId, stores]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAmazonFlipkart = amazonFlipkart ||
    ["amazon", "flipkart"].includes((selectedStore?.name || "").toLowerCase());

  const runDetect = useCallback(async (raw) => {
    const target = (raw || "").trim();
    if (!target) return;
    if (!looksLikeUrl(target)) {
      setDetectError("That doesn't look like a valid link. You can choose a store instead.");
      return;
    }
    if (target === lastDetectedUrlRef.current) return; // avoid duplicate calls for the same URL
    lastDetectedUrlRef.current = target;
    trackEvent("product_url_submitted");
    const requestId = ++detectionRequest.current;
    setDetecting(true);
    setDetectError("");
    try {
      const { data } = await api.post("/detect", { url: target });
      if (requestId !== detectionRequest.current) return;
      setAmazonFlipkart(!!data.amazon_flipkart_notice);
      if (data.store?.store_id) {
        setStoreId(data.store.store_id);
        setDetectedStoreName(data.store.store_name || null);
      } else {
        setDetectedStoreName(null);
      }
      if (data.category?.category) {
        setDetection(data.category);
        setCategory(data.category.category);
        setDetectedCategory(data.category.category);
      } else {
        setDetection(null);
        setCategory(""); setDetectedCategory(null);
      }
      if (!data.store?.store_id && !data.category?.category) {
        setDetectError("This link isn't recognized. Choose its store instead; category is optional.");
      }
    } catch {
      if (requestId !== detectionRequest.current) return;
      lastDetectedUrlRef.current = ""; // allow a retry on a transient failure
      setDetectError("Couldn't detect this link. Try again or choose a store instead.");
    } finally {
      if (requestId === detectionRequest.current) setDetecting(false);
    }
  }, []);

  // Auto-detect after a short debounce once the URL looks complete (no Detect button needed).
  useEffect(() => {
    const v = (url || "").trim();
    if (!v || !looksLikeUrl(v) || v === lastDetectedUrlRef.current) return;
    const t = setTimeout(() => runDetect(v), 700);
    return () => clearTimeout(t);
  }, [url, runDetect]);

  const onStoreChange = (val) => {
    if (val !== storeId) {
      detectionRequest.current += 1;
      lastDetectedUrlRef.current = "";
      setUrl(""); setDetecting(false); setDetectError(""); setAmazonFlipkart(false);
      setCategories([]);
      setCategoryGroups([]);
      setCategoryGroup("");
      setCategory("");
      setDetection(null);
      setDetectedCategory(null);
    }
    setStoreId(val);
    setDetectedStoreName(null); // manual override clears the "detected" hint
  };

  const onCategoryChange = (val) => {
    setCategory(val);
    if (detectedCategory && val !== detectedCategory) {
      api.post("/category-correction", {
        detected_category: detectedCategory, corrected_category: val,
        store_name: selectedStore?.name, confidence_band: detection?.band,
      }).catch(() => {});
    }
  };

  const onCategoryGroupChange = (val) => {
    const group = visibleGroups.find((item) => item.name === val);
    if (!group) return;
    setCategoryGroup(group.name);
    const exactMatch = group.categories.find((item) =>
      item.name.toLowerCase() === (category || "").toLowerCase());
    if (exactMatch) return;
    setDetection(null);
    if (group.categories.length === 1) onCategoryChange(group.categories[0].name);
    else setCategory("");
  };

  const calculate = async () => {
    if (!selectedStore) { toast.error("Please choose a store"); return; }
    if (!price || !Number.isFinite(Number(price)) || Number(price) <= 0) { toast.error("Enter a selling price greater than zero"); return; }
    if (mrp && (!Number.isFinite(Number(mrp)) || Number(mrp) < 0)) { toast.error("Enter a valid MRP"); return; }
    if (mrp && Number(price) > Number(mrp)) { toast.error("Selling price cannot exceed MRP"); return; }
    if (showCategory && category && !categories.some((item) => item.name === category)) {
      toast.error("Choose an available category or leave it blank"); return;
    }
    const submittedInputs = currentInputs.current;
    setLoading(true);
    try {
      const { data } = await api.post("/calculate", {
        store_id: storeId, store_name: selectedStore?.name,
        price: Number(price),
        ...(showCategory && category ? { category } : {}),
        ...(showCustomerType ? { customer_type: customerType } : {}),
        ...(mrp ? { mrp: Number(mrp) } : {}),
        ...(url.trim() && looksLikeUrl(url) ? { product_url: url.trim() } : {}),
      });
      if (submittedInputs !== currentInputs.current) return;
      setLastResult(data);
      trackEvent("calculation_completed", {
        store: selectedStore?.name,
        gift_card_applied: Boolean(data.gift_card?.applied),
        cashback_applied: Boolean(data.affiliate?.applied),
      });
      onResult(data);
      setTimeout(() => document.getElementById("results-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail || "Calculation failed")); }
    finally { setLoading(false); }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-w-0" data-testid="savings-engine">
        <div className="grid grid-cols-1 gap-6 border-b border-border pb-6 md:grid-cols-3" data-testid="engine-input-methods">
          <ProductImageInput stores={stores} onApply={({ storeId: nextStore, price: nextPrice }) => {
            onStoreChange(nextStore); setPrice(nextPrice); setMrp("");
            setUrl(""); setCategory(""); setCategoryGroup(""); setDetection(null); setDetectedCategory(null);
            setDetectedStoreName(null); setDetectError(""); setAmazonFlipkart(false); setDetecting(false);
            detectionRequest.current += 1; lastDetectedUrlRef.current = "";
          }} />
          <div className="min-w-0" data-testid="url-input-method">
        <h2 className="mb-2 flex items-center gap-2 text-base font-600 text-ink"><Link2 className="h-4 w-4 text-gold" /> Product / cart URL</h2>
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={url}
            onChange={(e) => {
              detectionRequest.current += 1; lastDetectedUrlRef.current = "";
              setUrl(e.target.value); setDetectError(""); setDetecting(false);
              setDetectedStoreName(null); setStoreId(""); setCategory(""); setCategoryGroup("");
              setDetection(null); setDetectedCategory(null); setAmazonFlipkart(false);
            }}
            onBlur={() => runDetect(url)}
            placeholder="Paste a supported store link"
            aria-label="Product or cart URL"
            data-testid="input-url"
            className="focus-ring h-11 w-full rounded-md border border-border bg-input pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground"
          />
          {detecting && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gold" data-testid="detect-loading" />
          )}
        </div>
        <p className="mt-2 text-xs text-ink-muted" data-testid="url-input-note">Private carts may need a screenshot or manually entered total.</p>
        {detecting && (
          <p className="mt-1.5 text-[11px] text-ink-muted" data-testid="detect-status">Detecting store &amp; category…</p>
        )}
        {detectError && !detecting && (
          <p className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-400" data-testid="detect-error">
            <Info className="mt-0.5 h-3 w-3 shrink-0" /> {detectError}
          </p>
        )}
        {detectedStoreName && !detectError && !detecting && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-savings" data-testid="detect-store">
            <BadgeCheck className="h-3 w-3" /> Detected store: {detectedStoreName}
          </p>
        )}
          </div>
          <div className="min-w-0" data-testid="store-input-method">
            <h2 className="mb-2 flex items-center gap-2 text-base font-600 text-ink"><Store className="h-4 w-4 text-gold" /> Brand / store</h2>
            <Combobox options={storeOptions} value={storeId} onChange={onStoreChange}
              placeholder="Choose store" testid="select-store" ariaLabel="Select store" />
            {selectedStore?.slug && <Link to={`/stores/${encodeURIComponent(selectedStore.slug)}`} target="_blank" rel="noopener noreferrer"
              data-testid="explore-store-offers" className="focus-ring mt-2 inline-flex items-center gap-1 text-xs text-gold hover:underline">
              Explore {selectedStore.name} offers <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>}
            {storeDetails?.id === storeId && storeDetails.advertised_cashback?.length > 0 && (
              <div className="mt-3 text-xs text-ink-muted" data-testid="advertised-cashback">
                <p className="font-600 text-gold">Advertised cashback: {storeDetails.advertised_cashback.map((rate) => `up to ${rateLabel(rate.value_type, rate.value)}`).join(" / ")}</p>
                <p className="mt-1">Offer maximums, not your transaction estimate. Eligibility, minimum spend and caps apply.</p>
              </div>
            )}
          </div>
        </div>

          {/* Category — shown only when the store's affiliate payout depends on category */}
          {showCategory && (
            <div className="mt-5 max-w-xl" data-testid="category-field">
              <label className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-ink-muted">
                <Tags className="h-3.5 w-3.5" /> Category · optional
                {detection && (
                  detection.band === "high" ? (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-savings/15 px-2 py-0.5 text-[10px] normal-case text-savings" data-testid="cat-detected">
                      <BadgeCheck className="h-3 w-3" /> Suggested · please verify
                    </span>
                  ) : (
                    <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] normal-case text-amber-400" data-testid="cat-verify">
                      Best match — please verify
                    </span>
                  )
                )}
              </label>
              <Combobox options={catOptions} value={selectedCategoryGroup?.name || categoryGroup}
                onChange={onCategoryGroupChange}
                placeholder="No category selected" testid="select-category" ariaLabel="Select category (optional)" />
              {(category || categoryGroup) && <button type="button" data-testid="clear-category" aria-label="Clear optional category"
                onClick={() => { setCategory(""); setCategoryGroup(""); setDetection(null); setDetectedCategory(null); }}
                className="focus-ring mt-2 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold"><X className="h-3 w-3" /> Clear category</button>}
              {selectedCategoryGroup?.categories.length > 1 && (
                <div className="mt-2" data-testid="exact-category-field">
                  <label className="mb-1 block text-[11px] font-600 text-ink-muted">Exact category</label>
                  <Combobox options={exactCategoryOptions} value={category} onChange={onCategoryChange}
                    placeholder="Choose exact category" testid="select-category-exact"
                    ariaLabel="Select exact product category" />
                </div>
              )}
              {detection?.explanation && (
                <p className="mt-1 text-[11px] text-ink-muted" data-testid="category-detection-explanation">{detection.explanation}</p>
              )}
              {!category && <p className="mt-2 text-xs text-ink-muted" data-testid="optional-category-note">Category-dependent cashback stays unconfirmed until a category is selected.</p>}
            </div>
          )}

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-ink-muted" data-testid="automatic-card-check">
          <CreditCard className="h-4 w-4 shrink-0 text-gold" />
          <span>YuktiCart automatically checks your saved cards.</span>
          {isAuthed && (
            <Link to="/account/cards" className="ml-auto shrink-0 text-gold hover:underline" data-testid="manage-cards-link">
              Manage My Cards
            </Link>
          )}
        </div>

        {/* Amazon / Flipkart notice */}
        {isAmazonFlipkart && (
          <div className="mt-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300" data-testid="amazon-flipkart-notice">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Amazon and Flipkart frequently change product classifications and affiliate commission
              rates. YuktiCart selects the best category match available, but cannot guarantee the
              retailer&apos;s final classification or cashback. Please verify the category and rate before purchase.
            </span>
          </div>
        )}

        {/* Customer type (shown only when the store's affiliate payout depends on it) + MRP + price */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {showCustomerType && (
            <div data-testid="customer-type-field">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="text-xs font-600 uppercase tracking-wide text-ink-muted">Customer type</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" data-testid="customer-type-info" aria-label="About customer type"
                      className="focus-ring grid h-4 w-4 place-items-center rounded-full text-ink-muted hover:text-gold">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Choose New User only if this is your first eligible transaction with this store or
                    platform. Otherwise, keep Existing User selected.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="inline-flex w-full rounded-md border border-border p-1" role="tablist" data-testid="customer-type-toggle">
                {[["existing", "Existing User"], ["new", "New User"]].map(([val, label]) => (
                  <button
                    key={val} role="tab" aria-selected={customerType === val}
                    onClick={() => setCustomerType(val)}
                    data-testid={`customer-type-${val}`}
                    className={`flex-1 rounded px-3 py-2 text-sm transition-colors ${
                      customerType === val ? "btn-gold font-600" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={`grid grid-cols-2 gap-4 ${showCustomerType ? "" : "sm:col-span-2"}`}>
            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">
                MRP (₹) <span className="font-400 normal-case tracking-normal">· optional</span>
              </label>
              <input type="number" inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)}
                data-testid="input-mrp" placeholder="Optional"
                className="focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Selling price (₹)</label>
              <input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)}
                data-testid="input-price" placeholder="1338"
                className="focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground" />
            </div>
          </div>
        </div>

        <MoneyMeter mrp={mrp} price={price} store={selectedStore?.name} category={category}
          customerType={customerType} lastResult={lastResult} />

        <button
          onClick={calculate} disabled={loading || detecting} data-testid="btn-calculate"
          className="btn-gold focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-base font-700 transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          <Calculator className="h-5 w-5" /> {loading ? "Calculating…" : "Find Best Savings Stack"}
        </button>
      </div>
    </TooltipProvider>
  );
}

function MoneyMeter({ mrp, price, store, category, customerType, lastResult }) {
  void category; void customerType;
  const hasInputs = price && Number(price) > 0 && (!mrp || Number(price) <= Number(mrp));
  const mrpMatches = lastResult && ((!mrp && lastResult.inputs.mrp == null) ||
    (mrp && lastResult.inputs.mrp && Number(lastResult.inputs.mrp.exact) === Number(mrp)));
  const matches = lastResult &&
    lastResult.inputs.store === store &&
    Number(lastResult.inputs.price.exact) === Number(price) &&
    mrpMatches;
  const happy = matches && lastResult.summary.extra_saved.rupees > 0;

  let state = "idle";
  if (happy) state = "happy";
  else if (hasInputs) state = "worried";

  const cfg = {
    idle: { border: "border-border", bg: "", face: null, title: "Selling price required · MRP and category optional", sub: "" },
    worried: {
      border: "border-destructive/40", bg: "bg-destructive/5", face: "sad",
      title: "STOP! You might be leaving money on the table.",
      sub: "Calculate your stack to route the lowest possible bill.",
    },
    happy: {
      border: "border-savings/50", bg: "bg-savings/5", face: "happy",
      title: happy ? `Potential extra savings: ${money(lastResult.summary.extra_saved)}` : "",
      sub: "Estimate only — partner terms and approval apply.",
    },
  }[state];

  return (
    <div data-testid="money-meter" data-state={state}
      className={`mt-5 flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${cfg.border} ${cfg.bg}`}>
      <div className="relative h-9 w-9 shrink-0">
        <Frown className={`absolute inset-0 h-9 w-9 text-destructive transition-all duration-500 ${cfg.face === "sad" ? "opacity-100 scale-100" : "opacity-0 scale-75"}`} />
        <Smile className={`absolute inset-0 h-9 w-9 text-savings transition-all duration-500 ${cfg.face === "happy" ? "opacity-100 scale-100" : "opacity-0 scale-75"}`} />
        {!cfg.face && <span className="absolute inset-0 grid place-items-center text-ink-muted">₹</span>}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-600 ${state === "worried" ? "text-destructive" : state === "happy" ? "text-savings" : "text-ink-muted"}`}>
          {cfg.title}
        </p>
        {cfg.sub && <p className="text-xs text-ink-muted">{cfg.sub}</p>}
      </div>
    </div>
  );
}
