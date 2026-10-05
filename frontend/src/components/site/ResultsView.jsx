import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, AlertTriangle, TrendingUp, Receipt, Layers, Info,
  ChevronDown, ArrowUpRight, Store as StoreIcon, Star, Gift, Percent, CreditCard,
} from "lucide-react";
import { money, moneyExact } from "@/lib/format";
import { EmotionalPanel } from "@/components/site/EmotionalPanel";
import { ReceiptStamp } from "@/components/site/ReceiptStamp";

const STATUS_STYLE = {
  great_stack: { color: "text-savings", icon: CheckCircle2 },
  one_route: { color: "text-gold", icon: CheckCircle2 },
  no_saving: { color: "text-ink-muted", icon: XCircle },
  verify: { color: "text-amber-400", icon: AlertTriangle },
};


export function ResultsView({ result }) {
  if (!result) return null;
  const s = result.summary;
  const st = STATUS_STYLE[s.status] || STATUS_STYLE.no_saving;
  const StatusIcon = st.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="grid gap-5 lg:grid-cols-[1.6fr_1fr]"
      data-testid="results-view"
    >
      <div className="space-y-5">
        {/* 1 — Savings summary */}
        <div className="surface relative overflow-hidden rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${st.color}`} />
            <span className={`text-sm font-600 ${st.color}`} data-testid="result-status">{s.status_label}</span>
            {result.fallback && (
              <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-400">
                Estimated — live rates unavailable
              </span>
            )}
          </div>

          {/* Selected payment card context (only when the shopper chose one) */}
          {result.inputs?.card && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted" data-testid="result-card-used">
              <CreditCard className="h-3.5 w-3.5 text-gold" />
              Using {result.inputs.card.card_name || result.inputs.card.bank_name} · {result.inputs.card.card_type} · {result.inputs.card.card_network}
              {(result.affiliate?.best?.card_rule_applied || result.gift_card?.best?.card_rule_applied) && (
                <span className="rounded-full bg-savings/15 px-2 py-0.5 text-[10px] font-600 text-savings" data-testid="card-offer-applied">
                  Card offer applied
                </span>
              )}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="font-display text-5xl font-700 savings-text" data-testid="result-extra-saved">
              {money(s.extra_saved)}
            </span>
            <span className="pb-1 text-lg text-ink-muted">you save</span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat icon={Receipt} label="Effective price" value={money(s.final_bill)} testid="result-final-bill" exact={moneyExact(s.final_bill)} />
            {s.mrp_provided && (
              <Stat icon={TrendingUp} label="Total off MRP" value={money(s.total_saving)} testid="result-total-saving" exact={moneyExact(s.total_saving)} />
            )}
            <Stat icon={Layers} label="Savings boost" value={`${s.boost_percent}%`} testid="result-boost" />
          </div>

          {!s.mrp_provided && (
            <p className="mt-3 text-xs text-ink-muted" data-testid="mrp-missing-note">
              MRP was not provided — MRP-based savings were not calculated.
            </p>
          )}

          {savingsConclusion(result) && (
            <p className="mt-5 rounded-lg border border-savings/30 bg-savings/5 p-3 text-sm text-ink" data-testid="savings-conclusion">
              {savingsConclusion(result)}
            </p>
          )}
        </div>

        {/* 2 — Savings Receipt (first meaningful detail after the transition) */}
        {s.extra_saved.rupees > 0 && <ReceiptStamp result={result} />}

        {/* 3 — Recommended saving route + partner CTA */}
        {s.extra_saved.rupees > 0 && (
          <div className="space-y-4" data-testid="recommended-route">
            <div className="surface rounded-2xl p-5">
              <h4 className="font-display text-xl font-700 text-ink" data-testid="route-headline">
                Ready to save {money(s.extra_saved)}?
              </h4>
              <p className="mt-1 text-sm text-ink-muted">
                Yukti recommends this saving route. These are independent third-party partners —
                Yukti doesn&apos;t sell products or issue gift cards, it just finds you the best route.
              </p>
              {result.checkout_steps?.length > 0 && (
                <ol className="mt-4 space-y-3" data-testid="checkout-steps">
                  {result.checkout_steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-ink-muted">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full btn-gold text-xs font-700">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <PartnerSection result={result} side="gift_card" />
            <PartnerSection result={result} side="affiliate" />
          </div>
        )}

        {/* Warnings */}
        {result.warnings?.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" data-testid="result-warnings">
            {result.warnings.map((w, i) => (
              <p key={i} className="flex gap-2 text-sm text-amber-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> {w}
              </p>
            ))}
          </div>
        )}
      </div>

      <EmotionalPanel status={s.status} />
    </motion.div>
  );
}

function PartnerSection({ result, side }) {
  const [open, setOpen] = useState(false);
  const isAff = side === "affiliate";
  const route = result[side];
  const preferred = route?.best;
  const options = route?.options || [];
  const eligible = options.filter((o) => o.eligible && Number(o.saving.exact) > 0);

  if (!preferred) return null;

  // Yukti's suggested partner IS the route the engine selected (route.best). We do
  // NOT re-rank on the frontend — we only surface the engine's choice.
  const preferredUrl = isAff
    ? (result.preferred_affiliate_url || preferred.platform_url)
    : preferred.platform_url;

  const label = isAff ? "Cashback partner" : "Gift card partner";
  const SectionIcon = isAff ? Percent : Gift;
  const verb = isAff ? "Continue with" : "Buy gift card via";
  const sectionTestId = isAff ? "affiliate-partners" : "giftcard-partners";
  const ctaTestId = isAff ? "cta-continue-affiliate" : "cta-continue-giftcard";
  const toggleTestId = isAff ? "toggle-partners" : "toggle-giftcard-partners";
  const listTestId = isAff ? "partners-list" : "giftcard-partners-list";
  const rowPrefix = isAff ? "partner" : "giftcard-partner";
  const fmtRate = (o) => (o.value_type === "percent" ? `${o.value}%` : `₹${o.value}`);

  // Route the CTA through YuktiCart's own bridge (/go/:partner). The bridge asks
  // the backend for the trusted destination — the client never holds/builds the
  // external URL. We only pass the partner slug + non-sensitive context.
  const slug = (preferred.platform_name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const storeName = result.inputs?.store;
  const bridgeTo = `/go/${slug}?kind=${side}${storeName ? `&store=${encodeURIComponent(storeName)}` : ""}`;

  return (
    <div className="surface rounded-xl p-5" data-testid={sectionTestId}>
      <div className="mb-3 flex items-center gap-2">
        <SectionIcon className="h-4 w-4 text-gold" />
        <h5 className="font-display text-base font-600 text-ink">{label}</h5>
      </div>

      {/* Yukti-suggested partner header + the ONLY actionable redirect CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/50 bg-gold/5 p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-600 text-ink">
            <Star className="h-4 w-4 shrink-0 fill-gold text-gold" />
            Yukti recommends: <span className="gold-text">{preferred.platform_name}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {fmtRate(preferred)} · saves {money(preferred.saving)}
          </p>
        </div>
        {preferredUrl ? (
          <Link to={bridgeTo} data-testid={ctaTestId}
            className="btn-gold focus-ring inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-700">
            {verb} {preferred.platform_name} <ArrowUpRight className="h-4 w-4" />
          </Link>
        ) : (
          <span data-testid={`${ctaTestId}-unavailable`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs text-ink-muted">
            <Info className="h-3.5 w-3.5" /> Redirect link not configured — follow checkout steps
          </span>
        )}
      </div>

      {/* Affiliate side keeps the existing "Open store" convenience link */}
      {isAff && result.store_url && (
        <div className="mt-2">
          <a href={result.store_url} target="_blank" rel="noopener noreferrer" data-testid="cta-open-store"
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-ink-muted hover:text-gold">
            <StoreIcon className="h-3.5 w-3.5" /> Open store
          </a>
        </div>
      )}

      {/* Other applicable partners — informational only (no redirect CTA) */}
      {options.length > 1 && (
        <>
          <button onClick={() => setOpen((v) => !v)} data-testid={toggleTestId}
            className="focus-ring mt-3 inline-flex items-center gap-1.5 text-sm text-gold hover:underline">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            {open ? "Hide" : "Show"} all {isAff ? "cashback" : "gift card"} partners ({eligible.length} eligible)
          </button>

          {open && (
            <div className="mt-3 space-y-2" data-testid={listTestId}>
              {options.map((o) => (
                <div key={o.rate_id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${
                    o.is_best ? "border-gold/50 bg-gold/5" : "border-border"} ${!o.eligible ? "opacity-50" : ""}`}
                  data-testid={`${rowPrefix}-${o.platform_name.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-600 text-ink">{o.platform_name}</span>
                    {o.is_best ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-gold">
                        <Star className="h-2.5 w-2.5 fill-gold" /> Yukti recommends
                      </span>
                    ) : o.eligible ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-ink-muted">Also available</span>
                    ) : (
                      <span className="text-[10px] text-ink-muted">{o.reasons?.[0] || "Not eligible"}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-ink-muted">{fmtRate(o)}</span>
                    <span className="savings-text font-600">{money(o.saving)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function savingsConclusion(result) {
  const s = result.summary;
  if (!(s.extra_saved?.rupees > 0)) return null;
  const aff = result.affiliate?.best?.platform_name;
  const gc = result.gift_card?.best?.platform_name;
  const stk = result.stacking || {};
  let route;
  if (stk.double_stack && aff && gc) route = `by stacking ${aff} cashback with a ${gc} gift card`;
  else if (stk.applied_route === "affiliate" && aff) route = `via ${aff} cashback`;
  else if (stk.applied_route === "gift_card" && gc) route = `via a ${gc} discounted gift card`;
  else route = "with this route";
  return `You can save ${money(s.extra_saved)} extra with this Yukti-approved stack ${route}, bringing your effective bill to ${money(s.final_bill)}.`;
}

function Stat({ icon: Icon, label, value, exact, testid }) {
  return (
    <div className="surface-2 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-muted"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 font-display text-xl font-700 text-ink" data-testid={testid} title={exact}>{value}</div>
    </div>
  );
}
