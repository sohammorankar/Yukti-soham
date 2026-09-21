import React, { useEffect, useState } from "react";
import { TrendingUp, Layers, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export function TrendingDeals({ onPick }) {
  const [deals, setDeals] = useState([]);
  useEffect(() => {
    api.get("/trending").then(({ data }) => setDeals(data)).catch(() => {});
  }, []);

  if (!deals.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="trending-deals">
      <SectionHead icon={TrendingUp} eyebrow="Live engine" title="Trending Deals"
        sub="Every card is computed by the same savings engine — not a static banner." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {deals.map((d, i) => (
          <button
            key={i} onClick={() => onPick?.(d)} data-testid={`deal-${i}`}
            className="surface group rounded-xl p-4 text-left transition-all hover:border-gold/40 hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-600 text-ink">{d.store}</span>
              {d.double_stack && (
                <span className="inline-flex items-center gap-1 rounded-full bg-savings/15 px-2 py-0.5 text-[10px] text-savings">
                  <Layers className="h-3 w-3" /> Stacked
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">{d.category} · {d.customer_type}</p>
            <div className="mt-3 font-display text-2xl font-700 savings-text">{money(d.extra_saved)}</div>
            <p className="text-xs text-ink-muted">extra saved</p>
            <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
              <span>Bill {money(d.final_bill)}</span>
              <span className="inline-flex items-center gap-1 text-gold opacity-0 transition-opacity group-hover:opacity-100">
                Try this <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function SectionHead({ icon: Icon, eyebrow, title, sub }) {
  return (
    <div className="mb-6">
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 text-xs font-600 uppercase tracking-widest text-gold">
          {Icon && <Icon className="h-3.5 w-3.5" />} {eyebrow}
        </span>
      )}
      <h2 className="mt-2 font-display text-3xl font-600 text-ink sm:text-4xl">{title}</h2>
      {sub && <p className="mt-2 max-w-2xl text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}
