import React, { useContext, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Store, Tags, ShieldCheck, Users, ArrowRight, Flame, Zap } from "lucide-react";
import { SavingsEngine } from "@/components/site/SavingsEngine";
import { ResultsView } from "@/components/site/ResultsView";
import { TrendingDeals, SectionHead } from "@/components/site/TrendingDeals";
import { MandirContext } from "@/components/site/SiteLayout";
import { api } from "@/lib/api";

const BRAND_ASSETS = {
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

  timesprime: "/assets/brands/timesprime.png",
  emergent: "/assets/brands/emergent.png",
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
const getCategoryAsset = (name) => {
  const normalized = name.toLowerCase().replace(/\s+/g, " ").trim();
  return CATEGORY_ASSETS[normalized];
};

const AssetFallback = ({ label, className = "" }) => (
  <div className={`grid place-items-center rounded-lg border border-gold/20 bg-black/20 text-lg font-display font-700 text-gold ${className}`}>
    {label?.trim()?.[0]?.toUpperCase() || "Y"}
  </div>
);

export default function Home() {
  const [result, setResult] = useState(null);
  const [initial, setInitial] = useState(null);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const openMandir = useContext(MandirContext);
  const [searchParams] = useSearchParams();

  // A product link pasted in the navbar search arrives as ?u=... — prefill the
  // Savings Engine with it (this triggers the existing auto-detect flow only).
  useEffect(() => {
    const u = searchParams.get("u");
    if (u) {
      setInitial({ url: u });
      setTimeout(() => document.getElementById("engine")?.scrollIntoView({ behavior: "smooth" }), 120);
    }
  }, [searchParams]);

  useEffect(() => {
    document.title = "YuktiCart — Stack cashback, gift cards & discounts for the lowest bill";
    api.get("/public/stores").then(({ data }) => setStores(data)).catch(() => {});
    api.get("/public/categories").then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  const pickDeal = (d) => {
    const store = stores.find((s) => s.name === d.store);
    setInitial({ store_id: store?.id, category: d.category, customer_type: d.customer_type, mrp: d.mrp, price: d.price });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-20 pb-10">
      {/* Hero + engine */}
      <section className="relative overflow-hidden">
        <div className="grid-texture pointer-events-none absolute inset-0 opacity-40" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:pt-16">
          <div className="flex flex-col justify-center">
            <motion.span
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1 text-xs text-gold">
              <Sparkles className="h-3.5 w-3.5" /> Tactical savings engine for India
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="mt-5 font-display text-4xl font-600 leading-[1.05] text-ink sm:text-5xl lg:text-6xl">
              Find the <span className="gold-text">lowest possible bill</span> before you checkout.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="mt-5 max-w-lg text-base leading-relaxed text-ink-muted">
              YuktiCart computes the mathematically best payment route — affiliate cashback,
              discounted gift cards, store discounts and valid split-payment stacking — for your exact order.
            </motion.p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#engine" className="btn-gold focus-ring inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-700">
                Start saving <ArrowRight className="h-4 w-4" />
              </a>
              <button onClick={openMandir}
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-ink-muted hover:text-gold">
                <Flame className="h-4 w-4 text-gold" /> Aabhar Mandir
              </button>
            </div>
            <div className="mt-8 flex gap-6 text-sm text-ink-muted">
              <div><div className="font-display text-2xl font-700 text-ink">{stores.length}+</div>stores</div>
              <div><div className="font-display text-2xl font-700 text-ink">{categories.length}+</div>categories</div>
              <div><div className="font-display text-2xl font-700 text-ink">2</div>routes stacked</div>
            </div>
          </div>

          <div id="engine" className="scroll-mt-20">
            <SavingsEngine onResult={setResult} initial={initial} />
          </div>
        </div>
      </section>

      {/* Results */}
      <div id="results-anchor" className="scroll-mt-20">
        {result && (
          <section className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHead icon={Zap} eyebrow="Your result" title="Your best stack" />
            <ResultsView result={result} />
          </section>
        )}
      </div>

      <TrendingDeals onPick={pickDeal} />

      {/* Save by brand */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="brands-section">
        <SectionHead icon={Store} eyebrow="Active stores" title="Shop by Brand"
          sub="Stores are populated live from the database and managed in the Rate Console." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {stores.map((s) => {
            const image = getBrandAsset(s.name);
            return (
              <Link key={s.id} to={`/brands?store=${encodeURIComponent(s.name)}`}
                data-testid={`brand-${s.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className="surface flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-sm font-600 text-ink transition-all hover:border-gold/40 hover:text-gold">
                <div className="h-12 w-28 overflow-hidden rounded-lg bg-white/95 p-1.5">
                  {image ? (
                    <img
                      src={image}
                      alt={`${s.name} logo`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <AssetFallback label={s.name} className="h-full w-full" />
                  )}
                </div>
                <span>{s.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Save by category */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="categories-section">
        <SectionHead icon={Tags} eyebrow="Active categories" title="Shop by Category" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => {
            const image = getCategoryAsset(c.name);
            return (
              <Link key={c.id} to={`/categories?c=${encodeURIComponent(c.name)}`}
                className="surface group overflow-hidden rounded-xl text-ink transition-all hover:border-gold/40">
                <div className="h-24 overflow-hidden bg-black/20">
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
                <div className="px-3 py-2.5 text-center text-sm font-600 group-hover:text-gold">{c.name}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Influencer offers */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="influencer-section">
        <SectionHead icon={Users} eyebrow="Community" title="Influencer Offers"
          sub="Curated creator picks — each still runs through the same transparent engine." />
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { n: "@BachatQueen", d: "Beauty hauls that actually stack", t: "Nykaa · Beauty" },
            { n: "@DealDaddy", d: "Big-ticket electronics routing", t: "Amazon · Electronics" },
            { n: "@SmartMomIndia", d: "Baby essentials on a budget", t: "Firstcry · Baby" },
          ].map((x) => (
            <div key={x.n} className="surface rounded-xl p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full btn-gold font-700">{x.n[1]}</span>
                <div><div className="font-600 text-ink">{x.n}</div><div className="text-xs text-ink-muted">{x.t}</div></div>
              </div>
              <p className="mt-3 text-sm text-ink-muted">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust / how it works strip */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="trust-strip">
        <div className="surface rounded-2xl p-6 sm:p-8">
          <SectionHead icon={ShieldCheck} eyebrow="Why trust us" title="How It Works" />
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              ["1. Paste or pick", "Add a product link or choose store, category and price."],
              ["2. We compute", "Every eligible affiliate & gift-card rule competes on exact rupees."],
              ["3. You save", "Follow the exact checkout sequence for the lowest final bill."],
            ].map(([t, d]) => (
              <div key={t}>
                <h4 className="font-display text-lg font-600 text-gold">{t}</h4>
                <p className="mt-1 text-sm text-ink-muted">{d}</p>
              </div>
            ))}
          </div>
          <Link to="/how-it-works" className="mt-6 inline-flex items-center gap-1.5 text-sm text-gold hover:underline">
            Read the full method <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
