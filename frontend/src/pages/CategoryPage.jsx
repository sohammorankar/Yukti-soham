import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, RefreshCw, Tags } from "lucide-react";
import { api } from "@/lib/api";
import { getCategoryAsset } from "@/lib/assets";
import { useMeta } from "@/lib/useMeta";
import { StoreSavingsCard } from "@/components/site/StoreSavingsCard";

export default function CategoryPage() {
  const { slug } = useParams();
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ status: "loading", category: null, stores: [] });
  const category = state.category;
  const description = category
    ? `Explore active stores with savings options for ${category.name}.`
    : "Explore category savings with YuktiCart.";
  const image = useMemo(() => category && (category.image_url || getCategoryAsset(category.name)), [category]);
  useMeta(category ? `${category.name} savings | YuktiCart` : "Category savings | YuktiCart", description);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setState({ status: "loading", category: null, stores: [] });
    api.get(`/public/homepage/categories/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(({ data }) => {
        if (active) setState({ status: "ready", category: data.category, stores: data.stores || [] });
      })
      .catch((error) => {
        if (!active) return;
        setState({ status: error.response?.status === 404 ? "not-found" : "error", category: null, stores: [] });
      });
    return () => { active = false; controller.abort(); };
  }, [slug, retry]);

  if (state.status === "loading") {
    return <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-16 sm:px-6" data-testid="category-page-loading"><p role="status" className="text-sm text-ink-muted">Loading category…</p></main>;
  }
  if (state.status === "not-found") {
    return <CategoryState title="Category not found" message="This category is not available." />;
  }
  if (state.status === "error") {
    return <CategoryState title="Category unavailable" message="We could not load this category right now." onRetry={() => setRetry((value) => value + 1)} />;
  }

  return (
    <main data-testid="category-page">
      <section className="relative isolate min-h-[22rem] overflow-hidden border-b border-border">
        {image && <img src={image} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-35" />}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--page-bg)_0%,color-mix(in_srgb,var(--page-bg)_88%,transparent)_58%,color-mix(in_srgb,var(--page-bg)_45%,transparent)_100%)]" />
        {!image && <div className="grid-texture absolute inset-0 -z-20 opacity-50" />}
        <div className="mx-auto flex min-h-[22rem] max-w-7xl flex-col justify-center px-4 py-12 sm:px-6">
          <Link to="/" className="focus-ring inline-flex w-fit items-center gap-1.5 text-sm text-gold hover:underline" data-testid="category-back-home">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <p className="mt-8 text-xs font-700 uppercase tracking-widest text-gold">Save by Category</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-600 leading-tight text-ink sm:text-5xl lg:text-6xl" data-testid="category-page-title">
            Save more on {category.name}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-muted sm:text-base" data-testid="category-page-description">{description}</p>
          <a href="#category-stores" className="btn-gold focus-ring mt-7 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-700" data-testid="category-explore-savings">
            Explore savings <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section id="category-stores" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20" data-testid="category-stores-section">
        <div className="max-w-2xl">
          <p className="text-xs font-700 uppercase tracking-widest text-gold">Relevant stores</p>
          <h2 className="mt-2 font-display text-3xl font-600 text-ink">Explore {category.name}</h2>
        </div>
        {state.stores.length ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="category-store-grid">
            {state.stores.map((store) => <StoreSavingsCard key={store.id} store={store} />)}
          </div>
        ) : (
          <div className="surface mt-8 rounded-lg p-6" data-testid="category-no-stores">
            <p className="text-sm text-ink-muted">No active store-specific savings options are currently listed for this category.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function CategoryState({ title, message, onRetry }) {
  return (
    <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-16 sm:px-6" data-testid="category-page-state">
      <div className="surface rounded-lg p-7">
        <Tags className="h-6 w-6 text-gold" aria-hidden="true" />
        <h1 className="mt-4 font-display text-3xl font-600 text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {onRetry && <button type="button" onClick={onRetry} className="btn-gold focus-ring inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-700" data-testid="category-retry"><RefreshCw className="h-4 w-4" /> Retry</button>}
          <Link to="/" className="focus-ring rounded-full border border-border px-5 py-2 text-sm text-ink-muted hover:text-gold" data-testid="category-return-home">Return home</Link>
        </div>
      </div>
    </main>
  );
}