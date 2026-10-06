import React, { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Store } from "lucide-react";
import { api } from "@/lib/api";
import { getBrandAsset } from "@/lib/assets";
import { useMeta } from "@/lib/useMeta";

export default function StoreDirectory() {
  useMeta("All stores | YuktiCart", "Browse stores supported by YuktiCart.");
  const [params] = useSearchParams();
  const oldTarget = params.get("store");
  const legacySlug = oldTarget && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(oldTarget) ? oldTarget : null;
  const [state, setState] = useState({ status: "loading", stores: [] });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (legacySlug) return;
    let active = true;
    const controller = new AbortController();
    setState({ status: "loading", stores: [] });
    api.get("/public/stores", { signal: controller.signal })
      .then(({ data }) => {
        if (!active) return;
        setState(Array.isArray(data)
          ? { status: "ready", stores: data }
          : { status: "error", stores: [] });
      })
      .catch(() => { if (active) setState({ status: "error", stores: [] }); });
    return () => { active = false; controller.abort(); };
  }, [legacySlug, retry]);

  if (legacySlug) return <Navigate to={`/stores/${encodeURIComponent(legacySlug)}`} replace />;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14" data-testid="store-directory">
      <p className="text-xs font-600 uppercase tracking-widest text-gold">Discover stores</p>
      <h1 className="mt-2 font-display text-3xl font-600 text-ink sm:text-4xl">Save by Store</h1>
      <p className="mt-3 max-w-2xl text-sm text-ink-muted">Explore every active store and find a savings route for your purchase.</p>

      {state.status === "loading" && <p role="status" className="mt-8 text-sm text-ink-muted">Loading stores...</p>}
      {state.status === "error" && (
        <div className="surface mt-8 rounded-xl p-6 text-sm text-ink-muted" role="alert">
          Stores are unavailable right now. Please try again.
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="ml-3 font-600 text-gold hover:underline">Retry</button>
        </div>
      )}
      {state.status === "ready" && state.stores.length === 0 && (
        <p className="surface mt-8 rounded-xl p-6 text-sm text-ink-muted">No stores are available yet.</p>
      )}
      {state.status === "ready" && state.stores.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="store-directory-grid">
          {state.stores.map((store) => {
            const image = store.logo_url || store.image_url || getBrandAsset(store.name);
            const Card = store.slug ? Link : "div";
            return (
              <Card key={store.id} {...(store.slug ? { to: `/stores/${encodeURIComponent(store.slug)}` } : {})}
                className="surface group flex min-h-32 items-center gap-4 rounded-xl p-4 text-ink transition-colors hover:border-gold/40"
                data-testid="store-directory-card">
                <div className="grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-2">
                  {image ? <img src={image} alt={`${store.name} logo`} className="h-full w-full object-contain" loading="lazy" />
                    : <Store className="h-7 w-7 text-slate-600" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-600 group-hover:text-gold">{store.name}</h2>
                  {store.description && <p className="mt-1 line-clamp-2 text-xs font-normal text-ink-muted">{store.description}</p>}
                  {!store.slug && <p className="mt-1 text-xs text-ink-muted">Store page unavailable</p>}
                </div>
                {store.slug && <ArrowRight className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
