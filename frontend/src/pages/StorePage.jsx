import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Store } from "lucide-react";
import { api } from "@/lib/api";
import { getBrandAsset } from "@/lib/assets";
import { useMeta } from "@/lib/useMeta";

export default function StorePage() {
  const { slug } = useParams();
  const [load, setLoad] = useState({ slug: null, status: "loading", store: null });
  const [retry, setRetry] = useState(0);
  const current = load.slug === slug ? load : { status: "loading", store: null };
  const store = current.status === "ready" ? current.store : null;
  useMeta(store ? `Save at ${store.name} | YuktiCart` : "Store savings | YuktiCart",
    store?.description || "Explore store savings with YuktiCart.");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoad({ slug, status: "loading", store: null });
    api.get(`/public/stores/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(({ data }) => {
        if (active) setLoad({ slug, status: "ready", store: data });
      })
      .catch((error) => {
        if (!active) return;
        setLoad({ slug, status: error.response?.status === 404 ? "not-found" : "error", store: null });
      });
    return () => { active = false; controller.abort(); };
  }, [slug, retry]);

  const categories = Array.isArray(store?.categories)
    ? store.categories.filter((category) => typeof category?.name === "string"
      && category.name.trim() && category.name.trim().toLowerCase() !== "all")
    : [];
  const image = store && (store.logo_url || store.image_url || getBrandAsset(store.name));

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14" data-testid="store-page">
      <Link to="/stores" className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline">
        <ArrowLeft className="h-4 w-4" /> All stores
      </Link>
      {current.status === "loading" && <p role="status" className="mt-8 text-sm text-ink-muted">Loading store...</p>}
      {current.status === "not-found" && (
        <div className="surface mt-8 rounded-xl p-6">
          <h1 className="font-display text-2xl font-600 text-ink">Store not found</h1>
          <p className="mt-2 text-sm text-ink-muted">This store page is not available. Browse the active stores instead.</p>
        </div>
      )}
      {current.status === "error" && (
        <div className="surface mt-8 rounded-xl p-6 text-sm text-ink-muted" role="alert">
          Store details are unavailable right now. Please try again.
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="ml-3 font-600 text-gold hover:underline">Retry</button>
        </div>
      )}
      {store && (
        <>
          <div className="surface mt-8 flex flex-col gap-5 rounded-xl p-5 sm:flex-row sm:items-center sm:p-7">
            <div className="grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-3">
              {image ? <img src={image} alt={`${store.name} logo`} className="h-full w-full object-contain" />
                : <Store className="h-10 w-10 text-slate-600" aria-hidden="true" />}
            </div>
            <div>
              {store.featured && <span className="text-xs font-600 uppercase tracking-wide text-gold">Featured store</span>}
              <h1 className="font-display text-3xl font-600 text-ink sm:text-4xl">{store.name}</h1>
              {store.description && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{store.description}</p>}
              <p className="mt-3 text-xs text-ink-muted">Savings options depend on your purchase and current store rules.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="surface rounded-xl p-5" data-testid="store-categories">
              <h2 className="font-display text-xl font-600 text-ink">Store savings categories</h2>
              {categories.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {categories.map((category) => <span key={category.name} className="rounded-full border border-gold/30 px-3 py-1.5 text-sm text-ink">{category.name}</span>)}
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-muted">No category-specific affiliate options are currently listed for this store.</p>
              )}
            </div>
            <div className="surface rounded-xl p-5">
              <h2 className="font-display text-xl font-600 text-ink">Start saving</h2>
              {store.has_customer_type_rules && (
                <p className="mt-3 text-sm text-ink-muted" data-testid="store-customer-type">
                  Savings may vary by customer type. Choose your type in the Savings Engine.
                </p>
              )}
              <p className="mt-3 text-sm text-ink-muted">Select {store.name} in the Savings Engine to calculate your best route.</p>
              <Link to="/#engine" data-testid="store-savings-cta"
                className="btn-gold mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-700">
                Open Savings Engine <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
