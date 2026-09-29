import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Link2, Store, Tags, Calculator, Info, BadgeCheck, HelpCircle, Frown, Smile, Loader2, CreditCard } from "lucide-react";
import { Combobox } from "@/components/Combobox";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

// Lightweight check so we only call /api/detect when the URL is "complete enough".
// Requires a domain-like token (something.tld) — avoids firing on partial typing.
function looksLikeUrl(val) {
  const v = (val || "").trim();
  if (v.length < 4) return false;
  return /(^https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/|$|\?|#)/i.test(v);
}

export function SavingsEngine({ onResult, initial }) {
  const { isAuthed } = useAuth();
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [cardId, setCardId] = useState(""); // "" = no card selected (optional)
  const [url, setUrl] = useState("");
  const [storeId, setStoreId] = useState("");
  const [category, setCategory] = useState("All");
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
  const lastDetectedUrlRef = useRef("");

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([api.get("/public/stores"), api.get("/public/categories")]);
        setStores(s.data); setCategories(c.data);
      } catch { toast.error("Could not load stores/categories"); }
    })();
  }, []);

  // Logged-in shoppers may optionally calculate with one of their saved cards.
  // Guests never see this and calculate exactly as before.
  useEffect(() => {
    if (!isAuthed) { setMyCards([]); setCardId(""); return; }
    api.get("/cards").then(({ data }) => setMyCards(data)).catch(() => {});
  }, [isAuthed]);

  useEffect(() => {
    if (initial) {
      setStoreId(initial.store_id || ""); setCategory(initial.category || "All");
      setCustomerType(initial.customer_type || "existing");
      setMrp(String(initial.mrp || "")); setPrice(String(initial.price || ""));
      if (initial.url) setUrl(initial.url);
    }
  }, [initial]);

  const storeOptions = useMemo(() => stores.map((s) => ({ value: s.id, label: s.name })), [stores]);
  const catOptions = useMemo(() => categories.map((c) => ({ value: c.name, label: c.name })), [categories]);
  const selectedStore = stores.find((s) => s.id === storeId);

  const isAmazonFlipkart = amazonFlipkart ||
    ["amazon", "flipkart"].includes((selectedStore?.name || "").toLowerCase());

  const runDetect = async (raw) => {
    const target = ((raw ?? url) || "").trim();
    if (!target) return;
    if (!looksLikeUrl(target)) {
      setDetectError("That doesn't look like a valid product link. You can still choose the store and category manually below.");
      return;
    }
    if (target === lastDetectedUrlRef.current) return; // avoid duplicate calls for the same URL
    lastDetectedUrlRef.current = target;
    setDetecting(true);
    setDetectError("");
    try {
      const { data } = await api.post("/detect", { url: target });
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
      }
      if (!data.store?.store_id && !data.category?.category) {
        setDetectError("We couldn't recognize this link automatically. Please choose the store and category manually below.");
      }
    } catch {
      lastDetectedUrlRef.current = ""; // allow a retry on a transient failure
      setDetectError("We couldn't detect this link right now. Please choose the store and category manually below.");
    } finally {
      setDetecting(false);
    }
  };

  // Auto-detect after a short debounce once the URL looks complete (no Detect button needed).
  useEffect(() => {
    const v = (url || "").trim();
    if (!v || !looksLikeUrl(v) || v === lastDetectedUrlRef.current) return;
    const t = setTimeout(() => runDetect(v), 700);
    return () => clearTimeout(t);
  }, [url]);

  const onStoreChange = (val) => {
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

  const calculate = async () => {
    if (!selectedStore) { toast.error("Please choose a store"); return; }
    if (!mrp || !price) { toast.error("Enter MRP and selling price"); return; }
    if (Number(price) > Number(mrp)) { toast.error("Selling price cannot exceed MRP"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/calculate", {
        store_id: storeId, store_name: selectedStore?.name, category,
        customer_type: customerType, mrp: Number(mrp), price: Number(price),
        ...(cardId ? { card_id: cardId } : {}),
      });
      setLastResult(data);
      onResult(data);
      setTimeout(() => document.getElementById("results-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch { toast.error("Calculation failed"); }
    finally { setLoading(false); }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="surface rounded-2xl p-5 sm:p-7" data-testid="savings-engine">
        {/* URL — auto-detects store & category (debounced + on blur); no button needed */}
        <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Product URL</label>
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (detectError) setDetectError(""); }}
            onBlur={() => runDetect()}
            placeholder="Paste an Amazon, Flipkart, Myntra… product link"
            data-testid="input-url"
            className="focus-ring h-11 w-full rounded-md border border-border bg-input pl-9 pr-10 text-sm text-foreground"
          />
          {detecting && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gold" data-testid="detect-loading" />
          )}
        </div>
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

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {/* Store */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-ink-muted">
              <Store className="h-3.5 w-3.5" /> Store
            </label>
            <Combobox options={storeOptions} value={storeId} onChange={onStoreChange}
              placeholder="Choose store" testid="select-store" ariaLabel="Select store" />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-ink-muted">
              <Tags className="h-3.5 w-3.5" /> Category
              {detection && (
                detection.band === "high" ? (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-savings/15 px-2 py-0.5 text-[10px] normal-case text-savings" data-testid="cat-detected">
                    <BadgeCheck className="h-3 w-3" /> Detected · {Math.round(detection.confidence * 100)}%
                  </span>
                ) : (
                  <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] normal-case text-amber-400" data-testid="cat-verify">
                    Best match — please verify
                  </span>
                )
              )}
            </label>
            <Combobox options={catOptions} value={category} onChange={onCategoryChange}
              placeholder="Choose category" testid="select-category" ariaLabel="Select category" />
            {detection?.explanation && (
              <p className="mt-1 text-[11px] text-ink-muted">{detection.explanation}</p>
            )}
          </div>
        </div>

        {/* Optional payment card — logged-in shoppers only; never required */}
        {isAuthed && (
          <div className="mt-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-ink-muted">
              <CreditCard className="h-3.5 w-3.5" /> Payment Card
              <span className="font-400 normal-case tracking-normal">(optional)</span>
            </label>
            {myCards.length > 0 ? (
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                data-testid="select-card"
                aria-label="Select payment card (optional)"
                className="focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground"
              >
                <option value="">No card selected</option>
                {myCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.card_name ? `${c.card_name} • ${c.card_network}` : `${c.bank_name} • ${c.card_type} • ${c.card_network}`}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-ink-muted" data-testid="no-saved-card">
                No saved card —{" "}
                <Link to="/account/cards" className="text-gold hover:underline" data-testid="add-card-link">
                  add one in My Cards
                </Link>{" "}
                to check card-specific eligibility.
              </p>
            )}
          </div>
        )}

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

        {/* Customer type + MRP + price */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">MRP (₹)</label>
              <input type="number" inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)}
                data-testid="input-mrp" placeholder="1599"
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
          onClick={calculate} disabled={loading} data-testid="btn-calculate"
          className="btn-gold focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-base font-700 transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          <Calculator className="h-5 w-5" /> {loading ? "Calculating…" : "Calculate My Stack"}
        </button>
      </div>
    </TooltipProvider>
  );
}

function MoneyMeter({ mrp, price, store, category, customerType, lastResult }) {
  const hasInputs = mrp && price && Number(mrp) > 0 && Number(price) > 0 && Number(price) <= Number(mrp);
  const matches = lastResult &&
    lastResult.inputs.store === store &&
    lastResult.inputs.category === category &&
    lastResult.inputs.customer_type === customerType &&
    Number(lastResult.inputs.price.exact) === Number(price) &&
    Number(lastResult.inputs.mrp.exact) === Number(mrp);
  const happy = matches && lastResult.summary.extra_saved.rupees > 0;

  let state = "idle";
  if (happy) state = "happy";
  else if (hasInputs) state = "worried";

  const cfg = {
    idle: { border: "border-border", bg: "", face: null, title: "Enter MRP & price to reveal your optimized savings.", sub: "" },
    worried: {
      border: "border-destructive/40", bg: "bg-destructive/5", face: "sad",
      title: "STOP! You might be leaving money on the table.",
      sub: "Calculate your stack to route the lowest possible bill.",
    },
    happy: {
      border: "border-savings/50", bg: "bg-savings/5", face: "happy",
      title: happy ? `You saved ${money(lastResult.summary.extra_saved)} extra with YuktiCart!` : "",
      sub: "Smart stack — follow the checkout sequence below.",
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
