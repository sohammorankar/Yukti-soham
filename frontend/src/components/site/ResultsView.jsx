import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, AlertTriangle, TrendingUp, Receipt, Layers, Info,
  ChevronDown, ExternalLink, ArrowUpRight, Store as StoreIcon,
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

function RouteCard({ route, label }) {
  if (!route) return null;
  const best = route.best;
  const applied = route.applied;
  const skipped = route.skipped;
  return (
    <div
      data-testid={`route-${route.kind}`}
      className={`surface rounded-xl p-4 transition-opacity ${skipped ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between">
        <h5 className="font-display text-sm font-600 text-ink">{label}</h5>
        {route.has_winner ? (
          skipped ? (
            <span data-testid={`route-${route.kind}-skipped`} className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-600 uppercase text-destructive">
              Not combinable — skipped
            </span>
          ) : (
            <span className="rounded-full bg-savings/15 px-2 py-0.5 text-[10px] font-600 uppercase text-savings">
              {applied ? "Applied" : "Best"}
            </span>
          )
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-ink-muted">No eligible rule</span>
        )}
      </div>

      {best ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className={`font-display text-2xl font-700 ${skipped ? "text-ink-muted line-through" : "savings-text"}`}>
              {money(best.saving)}
            </span>
            <span className="text-sm text-ink-muted">
              {best.platform_name} · {best.value_type === "percent" ? `${best.value}%` : `₹${best.value}`}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-muted">
            <div><dt className="opacity-70">Applies to</dt><dd className="text-ink">{money(best.applied_to)}</dd></div>
            <div><dt className="opacity-70">Basis</dt><dd className="text-ink">{best.category_name} · {best.customer_type}</dd></div>
            {best.minimum_order_value && <div><dt className="opacity-70">Min order</dt><dd className="text-ink">₹{best.minimum_order_value}</dd></div>}
            {best.maximum_eligible_amount && <div><dt className="opacity-70">Cap</dt><dd className="text-ink">₹{best.maximum_eligible_amount}</dd></div>}
          </dl>
          {best.notes && <p className="mt-2 text-xs italic text-ink-muted">{best.notes}</p>}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No eligible {label.toLowerCase()} for these inputs yet.</p>
      )}
    </div>
  );
}

export function ResultsView({ result }) {
  if (!result) return null;
  const s = result.summary;
  const st = STATUS_STYLE[s.status] || STATUS_STYLE.no_saving;
  const StatusIcon = st.icon;
  const stk = result.stacking;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="grid gap-5 lg:grid-cols-[1.6fr_1fr]"
      data-testid="results-view"
    >
      <div className="space-y-5">
        {/* Main summary */}
        <div className="surface relative overflow-hidden rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${st.color}`} />
            <span className={`text-sm font-600 ${st.color}`} data-testid="result-status">{s.status_label}</span>
            {result.fallback && (
              <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-400">
                Fallback estimate — no live rates
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="font-display text-5xl font-700 savings-text" data-testid="result-extra-saved">
              {money(s.extra_saved)}
            </span>
            <span className="pb-1 text-lg text-ink-muted">extra saved</span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat icon={Receipt} label="Final effective bill" value={money(s.final_bill)} testid="result-final-bill" exact={moneyExact(s.final_bill)} />
            <Stat icon={TrendingUp} label="Total saved vs MRP" value={money(s.total_saving)} testid="result-total-saving" exact={moneyExact(s.total_saving)} />
            <Stat icon={Layers} label="Savings boost" value={`${s.total_saving_percent}%`} testid="result-boost" />
          </div>
        </div>

        {/* Route comparison */}
        <div className="grid gap-4 sm:grid-cols-2">
          <RouteCard route={result.affiliate} label="Affiliate cashback" />
          <RouteCard route={result.gift_card} label="Gift card discount" />
        </div>

        {/* Affiliate partner comparison + CTA */}
        <AffiliatePartners result={result} />

        {/* Yukti Approved receipt */}
        {s.extra_saved.rupees > 0 && <ReceiptStamp result={result} />}

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

        {/* Checkout sequence */}
        {result.checkout_steps?.length > 0 && (
          <div className="surface rounded-xl p-5" data-testid="checkout-steps">
            <h5 className="font-display text-base font-600 text-ink">Best checkout sequence</h5>
            <ol className="mt-3 space-y-3">
              {result.checkout_steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-ink-muted">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full btn-gold text-xs font-700">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-ink-muted">
              Cashback is never guaranteed. Verify retailer terms, tracking exclusions, category
              classification, payment eligibility and final commission before purchasing.
            </p>
          </div>
        )}

        {/* Stacking info */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted" data-testid="stacking-info">
          <span className="rounded-full border border-border px-2.5 py-1">Stacking: {stk.policy}</span>
          <span className="rounded-full border border-border px-2.5 py-1">Split payment: {stk.split_payment_supported}</span>
          {stk.partial_gift_card && (
            <span className="rounded-full border border-border px-2.5 py-1">
              Gift card {money(stk.gift_card_spend)} + other {money(stk.other_payment_spend)}
            </span>
          )}
          <span className="rounded-full border border-border px-2.5 py-1">Rate snapshot: {result.rate_version}</span>
        </div>
      </div>

      <EmotionalPanel status={s.status} />
    </motion.div>
  );
}

function AffiliatePartners({ result }) {
  const [open, setOpen] = useState(false);
  const aff = result.affiliate;
  const preferred = aff?.best;
  const options = aff?.options || [];
  const eligible = options.filter((o) => o.eligible && Number(o.saving.exact) > 0);
  const preferredUrl = result.preferred_affiliate_url || preferred?.platform_url;

  if (!preferred) return null;

  return (
    <div className="surface rounded-xl p-5" data-testid="affiliate-partners">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h5 className="font-display text-base font-600 text-ink">
            Yukti-preferred partner: <span className="gold-text">{preferred.platform_name}</span>
          </h5>
          <p className="text-xs text-ink-muted">
            Highest eligible cashback ({preferred.value_type === "percent" ? `${preferred.value}%` : `₹${preferred.value}`} · saves {money(preferred.saving)})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {preferredUrl && (
            <a href={preferredUrl} target="_blank" rel="noopener noreferrer" data-testid="cta-continue-affiliate"
              className="btn-gold focus-ring inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-700">
              Continue via {preferred.platform_name} <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
          {result.store_url && (
            <a href={result.store_url} target="_blank" rel="noopener noreferrer" data-testid="cta-open-store"
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs text-ink-muted hover:text-gold">
              <StoreIcon className="h-3.5 w-3.5" /> Open store
            </a>
          )}
        </div>
      </div>

      <button onClick={() => setOpen((v) => !v)} data-testid="toggle-partners"
        className="focus-ring mt-3 inline-flex items-center gap-1.5 text-sm text-gold hover:underline">
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide" : "Compare"} all affiliate partners ({eligible.length})
      </button>

      {open && (
        <div className="mt-3 space-y-2" data-testid="partners-list">
          {options.map((o) => (
            <div key={o.rate_id}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                o.is_best ? "border-gold/50 bg-gold/5" : "border-border"} ${!o.eligible ? "opacity-50" : ""}`}
              data-testid={`partner-${o.platform_name.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-600 text-ink">{o.platform_name}</span>
                {o.is_best && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-gold">Preferred</span>}
                {!o.eligible && <span className="text-[10px] text-ink-muted">{o.reasons?.[0] || "Not eligible"}</span>}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-ink-muted">{o.value_type === "percent" ? `${o.value}%` : `₹${o.value}`}</span>
                <span className="savings-text font-600">{money(o.saving)}</span>
                {o.platform_url && (
                  <a href={o.platform_url} target="_blank" rel="noopener noreferrer"
                    className="text-ink-muted hover:text-gold" aria-label={`Open ${o.platform_name}`}>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, exact, testid }) {
  return (
    <div className="surface-2 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-muted"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 font-display text-xl font-700 text-ink" data-testid={testid} title={exact}>{value}</div>
    </div>
  );
}
