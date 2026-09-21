import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/site/PageShell";
import { TrendingDeals } from "@/components/site/TrendingDeals";
import { api } from "@/lib/api";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";

const STACK_ICON = { allowed: CheckCircle2, not_allowed: XCircle, unsure: HelpCircle };
const STACK_COLOR = { allowed: "text-savings", not_allowed: "text-destructive", unsure: "text-amber-400" };

export function Brands() {
  const [stores, setStores] = useState([]);
  useEffect(() => { api.get("/public/stores").then(({ data }) => setStores(data)).catch(() => {}); }, []);
  return (
    <PageShell title="Brands" kicker="Active stores"
      description="Every store we support, with its stacking and split-payment policy. Managed live in the Rate Console.">
      <div className="grid gap-3 sm:grid-cols-2">
        {stores.map((s) => {
          const Icon = STACK_ICON[s.stacking] || HelpCircle;
          return (
            <div key={s.id} className="surface rounded-xl p-4" data-testid={`brand-card-${s.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-600 text-ink">{s.name}</span>
                <span className={`inline-flex items-center gap-1 text-xs ${STACK_COLOR[s.stacking]}`}>
                  <Icon className="h-4 w-4" /> Stacking: {s.stacking}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">Split payment: {s.split_payment_supported}</p>
              {s.stacking_note && <p className="mt-2 text-sm text-ink-muted">{s.stacking_note}</p>}
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
      <div className="flex flex-wrap gap-2.5">
        {cats.map((c) => (
          <span key={c.id} className="surface rounded-full px-4 py-2 text-sm text-ink">{c.name}</span>
        ))}
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
