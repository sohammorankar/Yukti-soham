import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { CheckCircle2, Circle, ArrowRight, Boxes, Store, Tags, Grid3x3, Table2, Eye } from "lucide-react";
import { useMeta } from "@/lib/useMeta";

const STEPS = [
  { key: "platforms", label: "Review platforms", to: "/admin/platforms", icon: Boxes },
  { key: "stores", label: "Review stores & domain aliases", to: "/admin/stores", icon: Store },
  { key: "keywords", label: "Review category names & keyword rules", to: "/admin/categories", icon: Tags },
  { key: "stores2", label: "Set stacking & split-payment policies", to: "/admin/stores", icon: Store },
  { key: "rates", label: "Import or create rates", to: "/admin/matrix", icon: Table2 },
];

export default function Dashboard() {
  useMeta("Console Dashboard · YuktiCart", "Administrator onboarding and overview.");
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/admin/onboarding").then(({ data }) => setStats(data)).catch(() => {}); }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-600 text-ink">Welcome to the Rate Console</h1>
      <p className="mt-2 text-sm text-ink-muted">Update daily-changing rates without touching code. Follow the checklist to get set up.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {stats && [
          ["Platforms", stats.platforms, "/admin/platforms"],
          ["Stores", stats.stores, "/admin/stores"],
          ["Domains", stats.domains, "/admin/stores"],
          ["Categories", stats.categories, "/admin/categories"],
          ["Keyword rules", stats.keywords, "/admin/categories"],
          ["Published rates", stats.rates, "/admin/rates"],
        ].map(([label, n, to]) => (
          <Link key={label} to={to} className="surface rounded-xl p-4 hover:border-gold/40">
            <div className="font-display text-3xl font-700 text-ink">{n}</div>
            <div className="text-xs text-ink-muted">{label}</div>
          </Link>
        ))}
      </div>

      <div className="surface mt-6 rounded-xl p-5">
        <h2 className="font-display text-lg font-600 text-ink">First-time setup checklist</h2>
        <ol className="mt-4 space-y-2">
          {STEPS.map((s) => {
            const done = stats && stats[s.key === "stores2" ? "stores" : s.key] > 0;
            return (
              <li key={s.label}>
                <Link to={s.to} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50">
                  {done ? <CheckCircle2 className="h-5 w-5 text-savings" /> : <Circle className="h-5 w-5 text-ink-muted" />}
                  <s.icon className="h-4 w-4 text-gold" />
                  <span className="flex-1 text-sm text-ink">{s.label}</span>
                  <ArrowRight className="h-4 w-4 text-ink-muted" />
                </Link>
              </li>
            );
          })}
          <li>
            <Link to="/" className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50">
              <Eye className="ml-0.5 h-5 w-5 text-ink-muted" />
              <Grid3x3 className="h-4 w-4 text-gold" />
              <span className="flex-1 text-sm text-ink">Preview the public calculation with a test order</span>
              <ArrowRight className="h-4 w-4 text-ink-muted" />
            </Link>
          </li>
        </ol>
      </div>
    </div>
  );
}
