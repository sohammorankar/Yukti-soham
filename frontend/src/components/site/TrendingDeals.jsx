import React, { useEffect, useMemo, useState } from "react";
import { TrendingUp, Layers, ArrowRight, Clock3 } from "lucide-react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { Link } from "react-router-dom";

const DEAL_ASSETS = {
  boat: "/assets/deals/boat-rockerz-113.webp",
};

const normalizeKey = (value = "") =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

const getDealImage = (deal) => {
  const haystack = normalizeKey(
    `${deal?.title || ""} ${deal?.product_name || ""} ${deal?.name || ""} ${deal?.store || ""}`
  );

  if (haystack.includes("boat") || haystack.includes("rockerz113")) {
    return DEAL_ASSETS.boat;
  }

  return deal?.image_url || deal?.image || null;
};

const getSecondsUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((midnight - now) / 1000));
};

const formatCountdown = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export function TrendingDeals({ onPick }) {
  const [deals, setDeals] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(getSecondsUntilMidnight());

  const loadDeals = () => {
    api.get("/trending").then(({ data }) => setDeals(data)).catch(() => {});
  };

  useEffect(() => {
    loadDeals();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const remaining = getSecondsUntilMidnight();
      setSecondsLeft(remaining);

      // Refresh the backend-managed deal list when the new day starts.
      if (remaining === 86399) loadDeals();
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const visibleDeals = useMemo(() => deals.slice(0, 8), [deals]);

  if (!deals.length) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="trending-deals">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHead
          icon={TrendingUp}
          eyebrow="Yukti Specials"
          title="Trending Deals"
          sub="Every card is computed by the same savings engine — not a static banner."
        />
        <div className="mb-6 inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/20 bg-black/20 px-3 py-1.5 text-xs text-ink-muted">
          <Clock3 className="h-3.5 w-3.5 text-gold" />
          Refreshes in <span className="font-700 text-gold">{formatCountdown(secondsLeft)}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visibleDeals.map((d, i) => {
          const image = getDealImage(d);

          return (
            <button
              key={d.id || i}
              onClick={() => onPick?.(d)}
              data-testid={`deal-${i}`}
              className="surface group overflow-hidden rounded-xl text-left transition-all hover:-translate-y-0.5 hover:border-gold/40"
            >
              {image && (
                <div className="flex h-36 items-center justify-center overflow-hidden border-b border-gold/10 bg-black/20 p-3">
                  <img
                    src={image}
                    alt={d.title || d.product_name || d.name || d.store || "Deal"}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}

              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-600 text-ink">{d.store}</span>
                  {d.double_stack && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-savings/15 px-2 py-0.5 text-[10px] text-savings">
                      <Layers className="h-3 w-3" /> Stacked
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-xs text-ink-muted">
                  {d.category} · {d.customer_type}
                </p>

                {(d.title || d.product_name || d.name) && (
                  <p className="mt-2 line-clamp-2 text-sm font-600 text-ink">
                    {d.title || d.product_name || d.name}
                  </p>
                )}

                <div className="mt-3 font-display text-2xl font-700 savings-text">
                  {money(d.extra_saved)}
                </div>
                <p className="text-xs text-ink-muted">extra saved</p>

                <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
                  <span>Bill {money(d.final_bill)}</span>
                  <span className="inline-flex items-center gap-1 text-gold opacity-0 transition-opacity group-hover:opacity-100">
                    Try this <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {deals.length > 8 && (
        <div className="mt-6 text-center">
          <Link
            to="/deals"
            className="inline-flex items-center gap-2 rounded-lg border border-gold/30 px-4 py-2 text-sm font-600 text-gold transition-colors hover:border-gold/60 hover:bg-gold/5"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
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
