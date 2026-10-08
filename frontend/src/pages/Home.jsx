import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Store, Tags, Users, ArrowRight, Flame, Zap } from "lucide-react";
import { SavingsEngine } from "@/components/site/SavingsEngine";
import { ResultsView } from "@/components/site/ResultsView";
import { YuktiMagic } from "@/components/site/YuktiMagic";
import { SectionHead } from "@/components/site/TrendingDeals";
import { HomepagePromotions } from "@/components/site/HomepagePromotions";
import { StoreSavingsCard } from "@/components/site/StoreSavingsCard";
import { MandirContext } from "@/components/site/SiteLayout";
import { useHomeBootstrap } from "@/components/site/HomeStartupGate";
import { api } from "@/lib/api";

const AssetFallback = ({ label, className = "" }) => (
  <div className={`grid place-items-center rounded-lg border border-gold/20 bg-black/20 text-lg font-display font-700 text-gold ${className}`}>
    {label?.trim()?.[0]?.toUpperCase() || "Y"}
  </div>
);

export default function Home() {
  const bootstrap = useHomeBootstrap();
  const [result, setResult] = useState(null);
  const [magic, setMagic] = useState(false);
  const [engineResetKey, setEngineResetKey] = useState(0);
  const handleResult = (data) => { setResult(data); setMagic(true); };
  const [initial, setInitial] = useState(null);
  const [stores, setStores] = useState(() => bootstrap?.stores || []);
  const [homepageStores, setHomepageStores] = useState(() => bootstrap?.homepageStores || []);
  const [categories, setCategories] = useState(() => bootstrap?.categories || []);
  const [promotions, setPromotions] = useState(() => bootstrap?.promotions || []);
  const openMandir = useContext(MandirContext);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const handleBackHome = () => {
    setResult(null);
    setMagic(false);
    setInitial(null);
    setEngineResetKey((key) => key + 1);
    navigate("/", { replace: true });
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
  };

  // A product link pasted in the navbar search arrives as ?u=... — prefill the
  // Savings Engine with it (this triggers the existing auto-detect flow only).
  useEffect(() => {
    const u = searchParams.get("u");
    if (u) {
      setInitial({ url: u });
      setTimeout(() => document.getElementById("engine")?.scrollIntoView({ behavior: "smooth" }), 120);
    }
  }, [searchParams]);

  // Store pages reuse the existing #engine anchor, without adding prefill params.
  useEffect(() => {
    if (location.hash !== "#engine") return;
    const frame = requestAnimationFrame(() => document.getElementById("engine")?.scrollIntoView({ behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [location.hash]);

  useEffect(() => {
    document.title = "YuktiCart — Stack cashback, gift cards & discounts for the lowest bill";
    if (bootstrap) return;
    // On later SPA visits the startup gate does not run; these remain independent
    // parallel reads so one optional section failing does not hide the others.
    api.get("/public/stores").then(({ data }) => setStores(data)).catch(() => {});
    api.get("/public/stores?homepage=true&limit=5").then(({ data }) => setHomepageStores(data)).catch(() => {});
    api.get("/public/homepage/categories").then(({ data }) => setCategories(data)).catch(() => {});
    api.get("/public/homepage/promotions").then(({ data }) => setPromotions(data)).catch(() => {});
  }, [bootstrap]);

  return (
    <div className="space-y-24 pb-12">
      {magic && <YuktiMagic onDone={() => setMagic(false)} />}
      {/* Hero + engine */}
      <section className="relative overflow-hidden border-b border-border pb-14 sm:pb-16">
        <div className="grid-texture pointer-events-none absolute inset-0 opacity-30" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/35 to-transparent" />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 pt-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pt-20">
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
              YuktiCart evaluates available cashback, gift cards, coupons and payment opportunities
              to surface your strongest savings route without complicating checkout.
            </motion.p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#engine" data-testid="hero-start-saving" className="btn-gold focus-ring inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-700">
                Start saving <ArrowRight className="h-4 w-4" />
              </a>
              <button onClick={openMandir}
                data-testid="hero-aabhar-mandir"
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
            <SavingsEngine key={engineResetKey} onResult={handleResult} initial={initial} initialStores={stores} />
          </div>
        </div>
      </section>

      {/* Results */}
      <div id="results-anchor" className="scroll-mt-20">
        {result && (
          <section className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHead icon={Zap} eyebrow="Your result" title="Your best stack" />
            <ResultsView result={result} onBackHome={handleBackHome} />
          </section>
        )}
      </div>

      <HomepagePromotions promotions={promotions} stores={stores} />

      {/* Save by category — editorial discovery data, never affiliate payout categories. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="categories-section">
        <SectionHead icon={Tags} eyebrow="Discovery" title="Save by Category"
          sub="Explore stores through YuktiCart's existing savings categories." />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => (
            <Link key={category.id} to={category.slug ? `/category/${encodeURIComponent(category.slug)}` : `/categories?c=${encodeURIComponent(category.name)}`}
              data-testid={`homepage-category-${category.slug || category.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className="surface group overflow-hidden rounded-lg text-ink transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-gold/40">
              <div className="aspect-[4/3] overflow-hidden border-b border-border bg-black/20">
                {category.image_url ? (
                  <img src={category.image_url} alt={`${category.name} category`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                ) : (
                  <AssetFallback label={category.name} className="h-full w-full rounded-none border-0" />
                )}
              </div>
              <div className="px-3 py-2.5 text-center text-sm font-600 group-hover:text-gold">{category.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Save by store — backend curates rank, visibility and top-five limit. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="brands-section">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHead icon={Store} eyebrow="Featured stores" title="Save by Store"
            sub="Save at your favourite stores." />
          <Link to="/stores" className="mt-1 inline-flex items-center gap-1 text-sm font-600 text-gold hover:underline" data-testid="stores-view-all">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" data-testid="save-by-store-grid">
          {homepageStores.slice(0, 5).map((store) => (
            <StoreSavingsCard key={store.id} store={store} />
          ))}
        </div>
      </section>

      {/* Influencer Offers remain a simple Coming Soon section until a later phase. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="influencer-section">
        <SectionHead icon={Users} eyebrow="Community" title="Influencer Offers — Coming Soon" />
        <div className="surface rounded-lg border-dashed p-6 text-sm text-ink-muted">
          Creator-led savings are on their way.
        </div>
      </section>
    </div>
  );
}
