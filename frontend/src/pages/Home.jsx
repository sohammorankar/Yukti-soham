import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Store, Tags, ShieldCheck, Users, ArrowRight, Flame, Zap } from "lucide-react";
import { SavingsEngine } from "@/components/site/SavingsEngine";
import { ResultsView } from "@/components/site/ResultsView";
import { TrendingDeals, SectionHead } from "@/components/site/TrendingDeals";
import { MandirContext } from "@/components/site/SiteLayout";
import { api } from "@/lib/api";

export default function Home() {
  const [result, setResult] = useState(null);
  const [initial, setInitial] = useState(null);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const openMandir = useContext(MandirContext);

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

      {/* Shop by brand */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="brands-section">
        <SectionHead icon={Store} eyebrow="Active stores" title="Shop by Brand"
          sub="Stores are populated live from the database and managed in the Rate Console." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {stores.map((s) => (
            <Link key={s.id} to={`/brands?store=${encodeURIComponent(s.name)}`}
              data-testid={`brand-${s.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className="surface flex h-20 items-center justify-center rounded-xl px-3 text-center text-sm font-600 text-ink transition-all hover:border-gold/40 hover:text-gold">
              {s.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Shop by category */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="categories-section">
        <SectionHead icon={Tags} eyebrow="Active categories" title="Shop by Category" />
        <div className="flex flex-wrap gap-2.5">
          {categories.map((c) => (
            <Link key={c.id} to={`/categories?c=${encodeURIComponent(c.name)}`}
              className="surface rounded-full px-4 py-2 text-sm text-ink transition-colors hover:border-gold/40 hover:text-gold">
              {c.name}
            </Link>
          ))}
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
