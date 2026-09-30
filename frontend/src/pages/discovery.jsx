import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/site/PageShell";
import { TrendingDeals } from "@/components/site/TrendingDeals";
import { api } from "@/lib/api";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";

const STACK_ICON = { allowed: CheckCircle2, not_allowed: XCircle, unsure: HelpCircle };
const STACK_COLOR = { allowed: "text-savings", not_allowed: "text-destructive", unsure: "text-amber-400" };

const BRAND_ASSETS = {
  amazon: "/assets/brands/amazon.png",
  flipkart: "/assets/brands/flipkart.svg",
  firstcry: "/assets/brands/firstcry.png",
  tatacliq: "/assets/brands/tata-cliq.svg",
  myntra: "/assets/brands/myntra.png",
  nykaa: "/assets/brands/nykaa.svg",
};

const CATEGORY_ASSETS = {
  beauty: "/assets/categories/beauty-grooming.webp",
  "kitchen & dining": "/assets/categories/kitchen-dining.webp",
  electronics: "/assets/categories/electronics.webp",
  fashion: "/assets/categories/fashion.webp",
  "mobiles & smartphones": "/assets/categories/mobiles-smartphones.webp",
  "pharmacy & healthcare": "/assets/categories/pharmacy-healthcare.webp",
};

const normalizeAssetKey = (value = "") =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

const getBrandAsset = (name) => BRAND_ASSETS[normalizeAssetKey(name)];
const getCategoryAsset = (name) => CATEGORY_ASSETS[name.toLowerCase().replace(/\s+/g, " ").trim()];

const AssetFallback = ({ label, className = "" }) => (
  <div className={`grid place-items-center rounded-lg border border-gold/20 bg-black/20 text-lg font-display font-700 text-gold ${className}`}>
    {label?.trim()?.[0]?.toUpperCase() || "Y"}
  </div>
);

export function Brands() {
  const [stores, setStores] = useState([]);
  useEffect(() => { api.get("/public/stores").then(({ data }) => setStores(data)).catch(() => {}); }, []);

  return (
    <PageShell title="Brands" kicker="Active stores"
      description="Every store we support, with its stacking and split-payment policy. Managed live in the Rate Console.">
      <div className="grid gap-3 sm:grid-cols-2">
        {stores.map((s) => {
          const Icon = STACK_ICON[s.stacking] || HelpCircle;
          const image = getBrandAsset(s.name);
          return (
            <div key={s.id} className="surface rounded-xl p-4" data-testid={`brand-card-${s.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
              <div className="flex items-center gap-4">
                <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-white/95 p-1.5">
                  {image ? (
                    <img src={image} alt={`${s.name} logo`} className="h-full w-full object-contain" loading="lazy" />
                  ) : (
                    <AssetFallback label={s.name} className="h-full w-full" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-lg font-600 text-ink">{s.name}</span>
                    <span className={`inline-flex items-center gap-1 text-xs ${STACK_COLOR[s.stacking]}`}>
                      <Icon className="h-4 w-4" /> Stacking: {s.stacking}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">Split payment: {s.split_payment_supported}</p>
                  {s.stacking_note && <p className="mt-2 text-sm text-ink-muted">{s.stacking_note}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}

export function Categories() {
  const [cats, setCats] = useState([]);
  useEffect(() => { api.get("/public/categories").then(({ data }) => setCats(data)).catch(() => {}); }, []);

  return (
    <PageShell title="Categories" kicker="Active categories"
      description="Product categories we classify. Category rules are editable in the console to improve detection.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cats.map((c) => {
          const image = getCategoryAsset(c.name);
          return (
            <div key={c.id} className="surface group overflow-hidden rounded-xl">
              <div className="h-28 overflow-hidden bg-black/20">
                {image ? (
                  <img
                    src={image}
                    alt={`${c.name} category`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <AssetFallback label={c.name} className="h-full w-full rounded-none border-0" />
                )}
              </div>
              <div className="px-3 py-3 text-center text-sm font-600 text-ink">{c.name}</div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}

export function Deals() {
  const navigate = useNavigate();
  return (
    <div className="py-14">
      <div className="mx-auto mb-2 max-w-7xl px-4 sm:px-6">
        <span className="text-xs font-600 uppercase tracking-widest text-gold">Live engine</span>
        <h1 className="mt-2 font-display text-4xl font-600 text-ink sm:text-5xl">Trending Deals</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">Tap any deal to load it into the Savings Engine.</p>
      </div>
      <div className="mt-6">
        <TrendingDeals onPick={() => navigate("/")} />
      </div>
    </div>
  );
}
