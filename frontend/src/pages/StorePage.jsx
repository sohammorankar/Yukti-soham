import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ExternalLink, Info, Loader2, Sparkles, Tags } from "lucide-react";
import { api } from "@/lib/api";
import { useMeta } from "@/lib/useMeta";
import { getBrandAsset } from "@/lib/assets";

const FALLBACK_FAQ = [
  {
    question: "How does YuktiCart help me save?",
    answer: "YuktiCart evaluates the eligible savings routes available for the selected store and product details, then sends you to the existing Savings Engine to compare the final options.",
  },
  {
    question: "Does YuktiCart sell products from this store?",
    answer: "No. YuktiCart is an independent savings-optimization platform. The retailer, affiliate partners, payment providers and gift-card providers remain independent businesses.",
  },
  {
    question: "Are the savings guaranteed?",
    answer: "No. Eligibility, rates, exclusions and partner terms can change. Always verify the final terms before completing a purchase.",
  },
  {
    question: "Can I use a product URL?",
    answer: "Yes. Use Find Best Savings Stack to open the existing YuktiCart Savings Engine, which already supports product URL detection and the existing calculation flow.",
  },
];

function AssetFallback({ label }) {
  return <div className="grid h-full w-full place-items-center rounded-lg border border-gold/20 bg-black/20 text-3xl font-display font-700 text-gold">{label?.trim()?.[0]?.toUpperCase() || "Y"}</div>;
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="mb-6 text-center">
      <span className="inline-flex items-center gap-1.5 text-xs font-700 uppercase tracking-[0.16em] text-gold"><Sparkles className="h-3.5 w-3.5" /> {eyebrow}</span>
      <h2 className="mt-2 font-display text-3xl font-600 text-ink sm:text-4xl">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>}
    </div>
  );
}

function StoreHero({ store, slug }) {
  const image = store.logo_url || getBrandAsset(store.name);
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="grid-texture pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_.8fr] lg:items-center lg:py-16">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-700 uppercase tracking-[0.16em] text-gold"><span className="h-1.5 w-1.5 rounded-full bg-gold" /> {store.name} · Store Guide</div>
          <h1 className="max-w-3xl font-display text-4xl font-600 leading-tight text-ink sm:text-5xl lg:text-6xl">Find the smarter way to save on {store.name}.</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">{store.description || `Before you buy, let YuktiCart evaluate the savings options available for your ${store.name} product and help you choose an eligible route.`}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={`/?store=${encodeURIComponent(slug)}#engine`} className="btn-gold focus-ring inline-flex min-h-12 items-center gap-2 rounded-full px-5 py-3 text-sm font-700">Find Best Savings Stack <ArrowRight className="h-4 w-4" /></Link>
            <a href={`/go/${encodeURIComponent(store.name)}?store=${encodeURIComponent(store.name)}`} className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full border border-border px-5 py-3 text-sm text-ink-muted hover:border-gold/50 hover:text-gold">Continue to {store.name} <ExternalLink className="h-4 w-4" /></a>
          </div>
        </div>
        <div className="surface relative overflow-hidden rounded-2xl p-6 shadow-2xl sm:p-10">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative flex flex-col items-center text-center">
            <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-savings/30 bg-savings/10 px-3 py-1 text-xs font-600 text-savings"><CheckCircle2 className="h-3.5 w-3.5" /> Independent retailer · routes evaluated</span>
            <div className="h-24 w-48 overflow-hidden rounded-xl bg-white/95 p-3">{image ? <img src={image} alt={`${store.name} logo`} className="h-full w-full object-contain" /> : <AssetFallback label={store.name} />}</div>
            <p className="mt-5 text-sm leading-relaxed text-ink-muted">Compare available savings routes, payment discounts and eligible options before you shop.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StoreCategories({ store }) {
  const categories = (store.categories || []).filter((category) => typeof category === "string" ? category.trim().toLowerCase() !== "all" : (category.name || "").trim().toLowerCase() !== "all");
  if (!store.has_category_rules) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <SectionHeading eyebrow="Store category intelligence" title="Supported categories & rules" description="Categories are shown only when the selected store has applicable published affiliate rules." />
      {categories.length ? <div className="flex flex-wrap justify-center gap-3">{categories.map((item) => { const name = typeof item === "string" ? item : item.name; return <span key={name} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface/70 px-4 py-2.5 text-sm text-ink"><Tags className="h-4 w-4 text-gold" />{name}</span>; })}</div> : <div className="surface mx-auto max-w-2xl rounded-xl p-5 text-center text-sm text-ink-muted">This store has category-dependent rules, but category names are not currently exposed by the public store response.</div>}
    </section>
  );
}

function StoreSavingsRules({ store }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <SectionHeading eyebrow="Transparent evaluation" title={`How ${store.name} savings are evaluated`} description="YuktiCart uses the existing Savings Engine and published backend rules. Rates and eligibility can vary by product and partner." />
      <div className="surface mx-auto max-w-4xl rounded-2xl p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {["Store-specific eligibility", "Published affiliate rules", "Final checkout verification"].map((title, index) => <div key={title} className="rounded-xl border border-border/70 bg-black/10 p-4"><div className="mb-3 grid h-8 w-8 place-items-center rounded-lg bg-gold/10 text-sm font-700 text-gold">0{index + 1}</div><h3 className="font-display text-lg font-600 text-ink">{title}</h3><p className="mt-1 text-sm leading-relaxed text-ink-muted">{index === 0 ? "The selected store and product context determine which options can compete." : index === 1 ? "Only current public rule data is used; no prototype rates or partner claims are displayed." : "External terms can change, so verify the route and terms before purchase."}</p></div>)}
        </div>
      </div>
    </section>
  );
}

function StoreDeals({ slug, name }) {
  const [deals, setDeals] = useState([]);
  const [state, setState] = useState("loading");
  useEffect(() => { let active = true; api.get("/trending").then(({ data }) => { if (!active) return; const normalized = name.toLowerCase(); setDeals((Array.isArray(data) ? data : []).filter((deal) => String(deal.store || "").toLowerCase() === normalized || String(deal.store_slug || "").toLowerCase() === slug).slice(0, 4)); setState("ready"); }).catch(() => active && setState("error")); return () => { active = false; }; }, [name, slug]);
  return <section className="mx-auto max-w-7xl px-4 sm:px-6"><SectionHeading eyebrow="Current opportunities" title={`${name} deals`} description="This section uses existing YuktiCart trending data when a matching store result is available." />{state === "loading" ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div> : deals.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{deals.map((deal, index) => <div key={deal.id || index} className="surface rounded-xl p-5"><p className="text-xs text-ink-muted">{deal.category || "Store opportunity"}</p><h3 className="mt-2 line-clamp-2 font-display text-lg font-600 text-ink">{deal.title || deal.product_name || "Savings opportunity"}</h3><p className="mt-4 text-2xl font-700 text-savings">{deal.extra_saved?.formatted || `₹${deal.extra_saved?.rupees ?? 0}`}</p><p className="text-xs text-ink-muted">extra saved by the existing engine</p></div>)}</div> : <div className="surface mx-auto max-w-2xl rounded-xl p-5 text-center text-sm text-ink-muted">No current {name} deal results are available. YuktiCart will not fabricate products, prices or savings.</div>}</section>;
}

function StoreFAQ({ store }) {
  const [open, setOpen] = useState(0);
  const items = useMemo(() => FALLBACK_FAQ.map((item) => ({ ...item, question: item.question.replace("this store", store.name) })), [store.name]);
  return <section className="mx-auto max-w-3xl px-4 sm:px-6"><SectionHeading eyebrow="Questions answered" title="Frequently asked questions" /> <div className="space-y-3">{items.map((item, index) => <div key={item.question} className="surface overflow-hidden rounded-xl"><button type="button" className="focus-ring flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-600 text-ink" aria-expanded={open === index} onClick={() => setOpen(open === index ? -1 : index)}>{item.question}<ChevronDown className={`h-4 w-4 shrink-0 text-gold transition-transform ${open === index ? "rotate-180" : ""}`} /></button>{open === index && <p className="border-t border-border/60 px-5 pb-5 pt-3 text-sm leading-relaxed text-ink-muted">{item.answer}</p>}</div>)}</div></section>;
}

export default function StorePage() {
  const { slug = "" } = useParams();
  const [store, setStore] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  useEffect(() => { let active = true; setState("loading"); api.get(`/public/stores/${encodeURIComponent(slug)}`).then(({ data }) => { if (!active) return; setStore(data); setState("ready"); }).catch((e) => { if (!active) return; setError(e?.response?.status === 404 ? "We couldn't find an active public store with that address." : "The store guide could not be loaded right now."); setState(e?.response?.status === 404 ? "not-found" : "error"); }); return () => { active = false; }; }, [slug]);
  useMeta(store ? `${store.name} Deals, Cashback & Best Savings | YuktiCart` : "Store savings guide · YuktiCart", store ? `Find the best available savings route for ${store.name} with YuktiCart. Compare eligible options before you shop.` : "Explore store-specific savings routes with YuktiCart.");
  useEffect(() => { if (!store) return; const canonical = `https://yukticart.com/stores/${encodeURIComponent(store.slug || slug)}`; const set = (name, content, attr = "name") => { let node = document.querySelector(`meta[${attr}=\"${name}\"]`); if (!node) { node = document.createElement("meta"); node.setAttribute(attr, name); document.head.appendChild(node); } node.setAttribute("content", content); }; set("og:url", canonical, "property"); set("twitter:description", store.description || `Store-specific savings guide for ${store.name}.`); let link = document.querySelector('link[rel="canonical"]'); if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); } link.href = canonical; const id = "yukticart-store-jsonld"; document.getElementById(id)?.remove(); const script = document.createElement("script"); script.id = id; script.type = "application/ld+json"; script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://yukticart.com/" }, { "@type": "ListItem", position: 2, name: "Stores", item: "https://yukticart.com/brands" }, { "@type": "ListItem", position: 3, name: store.name, item: canonical }] }, { "@type": "FAQPage", mainEntity: FALLBACK_FAQ.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) }] }); document.head.appendChild(script); return () => document.getElementById(id)?.remove(); }, [store, slug]);
  if (state === "loading") return <div className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-4"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gold" /><p className="mt-3 text-sm text-ink-muted">Loading store guide…</p></div></div>;
  if (!store) return <div className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-4"><div className="surface w-full rounded-2xl p-7 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-amber-400" /><h1 className="mt-4 font-display text-2xl text-ink">Store guide unavailable</h1><p className="mt-2 text-sm text-ink-muted">{error}</p><Link to="/brands" className="btn-gold focus-ring mt-5 inline-flex rounded-full px-5 py-2.5 text-sm font-700">Browse stores</Link></div></div>;
  return <div className="relative overflow-hidden pb-20"><div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(13,30,36,.55),transparent_65%)]" /><div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6"><nav aria-label="Breadcrumb" className="text-xs text-ink-muted"><Link to="/" className="hover:text-gold">Home</Link><span className="mx-2">›</span><Link to="/brands" className="hover:text-gold">Stores</Link><span className="mx-2">›</span><span className="text-ink">{store.name}</span></nav></div><StoreHero store={store} slug={slug} /><main className="mx-auto mt-12 max-w-7xl space-y-16"><div className="mx-4 flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-4 text-sm text-ink-muted sm:mx-6"><Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><span><strong className="text-ink">Independent platform note:</strong> {store.name} and all third-party partners remain independent businesses. YuktiCart evaluates available routes and does not guarantee savings or cashback.</span></div><section className="mx-auto max-w-7xl px-4 sm:px-6"><SectionHeading eyebrow="Savings process" title="One product. Multiple possible savings routes." /><div className="grid gap-4 md:grid-cols-3">{[["01", "Check the product", "Open the existing Savings Engine with a product URL or store details."], ["02", "Evaluate savings", "The backend evaluates the active rules and optional MRP input without inventing missing values."], ["03", "Choose your route", "Review the result and continue through YuktiCart's existing trusted redirect flow."]].map(([number, title, text]) => <div key={number} className="surface rounded-xl p-5"><span className="rounded bg-gold/10 px-2 py-1 text-xs font-700 text-gold">STEP {number}</span><h3 className="mt-4 font-display text-xl text-ink">{title}</h3><p className="mt-2 text-sm leading-relaxed text-ink-muted">{text}</p></div>)}</div></section><StoreCategories store={store} />{store.has_customer_type_rules && <section className="mx-auto max-w-3xl px-4 text-center sm:px-6"><div className="rounded-xl border border-savings/30 bg-savings/10 p-5"><h2 className="font-display text-2xl text-ink">Customer type can affect eligibility</h2><p className="mt-2 text-sm text-ink-muted">This store has published affiliate rules that distinguish between new and existing customers. The Savings Engine will show the input when it is relevant.</p></div></section>}<StoreSavingsRules store={store} /><StoreDeals slug={slug} name={store.name} /><section className="mx-auto grid max-w-4xl gap-4 px-4 sm:grid-cols-2 sm:px-6"><div className="surface rounded-xl p-5"><h2 className="font-display text-2xl text-ink">Why YuktiCart?</h2><p className="mt-2 text-sm leading-relaxed text-ink-muted">YuktiCart is an independent savings-evaluation platform that helps compare eligible routes before checkout. It does not own retailers, cashback businesses, gift-card providers or payment networks.</p></div><div className="surface rounded-xl p-5"><h2 className="font-display text-2xl text-ink">No unsupported claims</h2><p className="mt-2 text-sm leading-relaxed text-ink-muted">When public rule or deal data is unavailable, the page says so. We do not fabricate products, rates, partners, discounts, MRP or availability.</p></div></section><StoreFAQ store={store} /><section className="mx-4 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-surface p-8 text-center sm:mx-6 sm:p-12"><h2 className="font-display text-3xl text-ink sm:text-4xl">Ready to find your best route?</h2><p className="mx-auto mt-3 max-w-xl text-sm text-ink-muted">Use the existing YuktiCart Savings Engine for {store.name}; no second calculator or URL detector is created here.</p><Link to={`/?store=${encodeURIComponent(slug)}#engine`} className="btn-gold focus-ring mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-700">Find Best Savings Stack <ArrowRight className="h-4 w-4" /></Link></section></main></div>;
}
