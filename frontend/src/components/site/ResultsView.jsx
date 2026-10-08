import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, AlertTriangle, TrendingUp, Receipt, Layers, Info,
  ChevronDown, ArrowUpRight, ArrowLeft, Store as StoreIcon, Star, Gift, Percent, CreditCard,
} from "lucide-react";
import { money, moneyExact } from "@/lib/format";
import { EmotionalPanel } from "@/components/site/EmotionalPanel";
import { ReceiptStamp } from "@/components/site/ReceiptStamp";
import { ResultFeedback } from "@/components/site/ResultFeedback";

const STATUS_STYLE = {
  great_stack: { color: "text-savings", icon: CheckCircle2 },
  one_route: { color: "text-gold", icon: CheckCircle2 },
  no_saving: { color: "text-ink-muted", icon: XCircle },
  verify: { color: "text-amber-400", icon: AlertTriangle },
};


export function ResultsView({ result, onBackHome }) {
  if (!result) return null;
  const s = result.summary;
  const st = STATUS_STYLE[s.status] || STATUS_STYLE.no_saving;
  const StatusIcon = st.icon;
  const cardOptimization = result.card_optimization || {};
  const savedCardsChecked = cardOptimization.saved_cards_checked || 0;
  const winningCardName = cardOptimization.selected_card_name || result.inputs?.card?.card_name || result.card_offer?.card_name;
  const winningCardIssuer = cardOptimization.selected_card_issuer || result.inputs?.card?.bank_name;
  const appliedCardOffer = result.card_offer?.applied ? result.card_offer?.applied_offer : null;
  const missingCardOpportunity = result.missing_card_opportunity?.available
    ? result.missing_card_opportunity
    : null;
  const cardEligibilityApplied = Boolean(
    (result.affiliate?.applied && result.affiliate?.best?.card_rule_applied)
    || (result.gift_card?.applied && result.gift_card?.best?.card_rule_applied)
  );
  const winningCardUsed = Boolean(winningCardName && (
    appliedCardOffer || cardEligibilityApplied || cardOptimization.mode === "automatic"
  ));
  const winningRouteParts = [
    ...(winningCardUsed ? [winningCardName] : []),
    ...(result.gift_card?.applied ? ["Gift Card"] : []),
    ...(result.affiliate?.applied ? ["Cashback"] : []),
  ];
  const executionSteps = buildExecutionSteps(result, winningCardUsed, winningCardName);
  const feedbackKey = [
    result.inputs?.store,
    result.inputs?.category,
    result.inputs?.price?.exact,
    s.extra_saved?.exact,
    s.final_bill?.exact,
    result.gift_card?.best?.rate_id,
    result.affiliate?.best?.rate_id,
    cardOptimization.selected_card_id,
    appliedCardOffer?.offer_id,
  ].filter(Boolean).join("|");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      data-testid="results-view"
    >
      {/* 1 — Understand the saving */}
      <section className="surface relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        <div className="flex flex-wrap items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${st.color}`} />
          <span className={`text-sm font-600 ${st.color}`} data-testid="result-status">{s.status_label}</span>
          {result.fallback && (
            <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-400">
              Estimated — live rates unavailable
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.48fr)] lg:items-center">
          <div className="min-w-0">
            {(savedCardsChecked > 0 || winningCardUsed) && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted" data-testid="saved-card-summary">
                <CreditCard className="h-3.5 w-3.5 text-gold" />
                {savedCardsChecked > 0 && (
                  <span>{savedCardsChecked} saved card{savedCardsChecked === 1 ? "" : "s"} checked</span>
                )}
                {winningCardUsed && (
                  <span data-testid="result-winning-card">
                    <span className="mx-1 text-border">·</span> Best savings found using <strong className="text-ink">{winningCardName}</strong>
                    {winningCardIssuer && <span> · {winningCardIssuer}</span>}
                  </span>
                )}
                {appliedCardOffer && (
                  <span className="rounded-full bg-savings/15 px-2 py-0.5 text-[10px] font-600 text-savings" data-testid="card-offer-applied">
                    Card offer saves {money(appliedCardOffer.saving)}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="font-display text-5xl font-700 savings-text sm:text-6xl" data-testid="result-extra-saved">
                {money(s.extra_saved)}
              </span>
              <span className="pb-1 text-sm font-700 uppercase tracking-[0.16em] text-ink-muted">you save</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-muted" data-testid="savings-conclusion">
                {savingsConclusion(result)}
              </p>
            )}
          </div>

          <EmotionalPanel status={s.status} compact />
        </div>
      </section>

      {/* 2–4 — Understand and execute the saving */}
      {s.extra_saved.rupees > 0 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-start">
          <section className="surface rounded-2xl p-5 sm:p-6" data-testid="recommended-route">
            <p className="text-xs font-700 uppercase tracking-[0.16em] text-gold">Savings journey</p>
            <h3 className="mt-2 font-display text-2xl font-700 text-ink" data-testid="route-headline">
              How to use your savings
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Follow this order to preserve the validated savings route and partner tracking.
            </p>
            {executionSteps.length > 0 && (
              <ol className="mt-6 space-y-4" data-testid="checkout-steps">
                {executionSteps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                    <span className="btn-gold grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-700">{i + 1}</span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="space-y-3">
            <ReceiptStamp result={result} />
            <ResultFeedback key={feedbackKey} result={result} />
          </div>
        </div>
      )}

      {/* 5 — Existing calculated routes only; future route types can join this section. */}
      {s.extra_saved.rupees > 0 && (
        <section className="space-y-4" data-testid="savings-routes">
          <div>
            <p className="text-xs font-700 uppercase tracking-[0.16em] text-gold">Your plan</p>
            <h3 className="mt-1 font-display text-2xl font-700 text-ink">Your Savings Routes</h3>
            <p className="mt-1 text-sm text-ink-muted">Use the routes selected by the YuktiCart calculation.</p>
            {winningRouteParts.length > 0 && (
              <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-savings/30 bg-savings/5 px-3 py-1.5 text-xs text-savings" data-testid="winning-route-summary">
                <CheckCircle2 className="h-3.5 w-3.5" /> <strong>Best Route</strong>
                <span className="text-ink">{winningRouteParts.join(" + ")}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap">
            {appliedCardOffer && <CardOfferRoute cardName={winningCardName} issuer={winningCardIssuer} offer={appliedCardOffer} />}
            <PartnerSection result={result} side="gift_card" />
            <PartnerSection result={result} side="affiliate" />
          </div>
        </section>
      )}

      {missingCardOpportunity && (
        <aside className="surface rounded-2xl border border-gold/25 p-4 sm:p-5" data-testid="missing-card-opportunity">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-700 uppercase tracking-[0.16em] text-gold">
                {missingCardOpportunity.promotion_headline || "Potential Extra Savings"}
              </p>
              <h3 className="mt-1 font-display text-lg font-700 text-ink">
                You could save up to {money(missingCardOpportunity.potential_extra_savings)} more with {missingCardOpportunity.card_name}.
              </h3>
              {missingCardOpportunity.promotion_description && (
                <p className="mt-1 text-sm text-ink-muted">{missingCardOpportunity.promotion_description}</p>
              )}
              <p className="mt-2 text-xs text-ink-muted">
                This is a potential future opportunity for a card not currently saved in My Cards. Your actual result above is unchanged.
              </p>
            </div>
            {missingCardOpportunity.card_offer_url && (
              <a href={missingCardOpportunity.card_offer_url} target="_blank" rel="noopener noreferrer"
                data-testid="missing-card-cta"
                className="btn-gold focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-700">
                {missingCardOpportunity.cta_label || "View Card Offer"} <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </aside>
      )}

      {result.warnings?.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" data-testid="result-warnings">
          {result.warnings.map((w, i) => (
            <p key={i} className="flex gap-2 text-sm text-amber-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      {onBackHome && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onBackHome}
            data-testid="result-back-home"
            className="focus-ring inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-600 text-ink-muted transition-colors hover:border-gold/40 hover:text-gold"
          >
            <ArrowLeft className="h-4 w-4" /> Back to YuktiCart Home
          </button>
        </div>
      )}
    </motion.div>
  );
}

function CardOfferRoute({ cardName, issuer, offer }) {
  return (
    <div className="surface flex-1 rounded-2xl p-5 lg:min-w-[280px]" data-testid="card-offer-route">
      <div className="mb-3 flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-gold" />
        <div>
          <p className="text-[10px] font-700 uppercase tracking-[0.14em] text-ink-muted">Savings route</p>
          <h5 className="mt-0.5 font-display text-lg font-600 text-ink">Card Offer</h5>
        </div>
      </div>
      <div className="rounded-lg border border-gold/50 bg-gold/5 p-3">
        <p className="flex items-center gap-1.5 text-sm font-600 text-ink">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-savings" /> Best Card Offer
        </p>
        <p className="mt-1 font-600 text-ink">{cardName || "Saved card"}</p>
        {issuer && <p className="text-xs text-ink-muted">{issuer}</p>}
        {offer.offer_name && <p className="mt-1 text-xs text-ink-muted">{offer.offer_name}</p>}
        <p className="mt-2 savings-text font-700" data-testid="card-route-saving">Saves {money(offer.saving)}</p>
      </div>
    </div>
  );
}

function PartnerSection({ result, side }) {
  const [open, setOpen] = useState(false);
  const isAff = side === "affiliate";
  const route = result[side];
  const preferred = route?.best;
  const options = route?.options || [];
  const eligible = options.filter((o) => o.eligible && Number(o.saving.exact) > 0);

  if (!preferred || !route?.applied) return null;

  // YuktiCart's suggested partner IS the route the engine selected (route.best). We do
  // NOT re-rank on the frontend — we only surface the engine's choice.
  const preferredUrl = isAff
    ? (result.preferred_affiliate_url || preferred.platform_url)
    : preferred.platform_url;

  const label = isAff ? "Cashback" : "Gift Card";
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
    <div className="surface flex-1 rounded-2xl p-5 lg:min-w-[280px]" data-testid={sectionTestId}>
      <div className="mb-3 flex items-center gap-2">
        <SectionIcon className="h-4 w-4 text-gold" />
        <div>
          <p className="text-[10px] font-700 uppercase tracking-[0.14em] text-ink-muted">Savings route</p>
          <h5 className="mt-0.5 font-display text-lg font-600 text-ink">{label}</h5>
        </div>
      </div>

      {/* YuktiCart-suggested partner header + the ONLY actionable redirect CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/50 bg-gold/5 p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-600 text-ink">
            <Star className="h-4 w-4 shrink-0 fill-gold text-gold" />
            YuktiCart recommends: <span className="gold-text">{preferred.platform_name}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {fmtRate(preferred)} · saves {money(preferred.saving)}
          </p>
        </div>
        {preferredUrl ? (
          <Link to={bridgeTo} target="_blank" rel="noopener noreferrer" data-testid={ctaTestId}
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
                        <Star className="h-2.5 w-2.5 fill-gold" /> YuktiCart recommends
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

function buildExecutionSteps(result, cardUsed, cardName) {
  const hasGiftCard = Boolean(result.gift_card?.applied && result.gift_card?.best);
  const hasCashback = Boolean(result.affiliate?.applied && result.affiliate?.best);
  const giftCardPartner = result.gift_card?.best?.platform_name;
  const cashbackPartner = result.affiliate?.best?.platform_name;
  const cardLabel = cardName || "saved card";

  if (cardUsed && hasGiftCard && hasCashback) {
    return [
      `Buy the eligible gift card from ${giftCardPartner}.`,
      `Keep your eligible ${cardLabel} ready where the validated card offer applies.`,
      `Start the merchant purchase through ${cashbackPartner} so the journey is tracked.`,
      "Complete checkout using the validated payment method shown in your savings route.",
    ];
  }
  if (hasGiftCard && hasCashback) {
    return [
      `Buy the eligible gift card from ${giftCardPartner}.`,
      `Start your purchase through ${cashbackPartner} so the cashback journey is tracked.`,
      "Complete the merchant checkout and pay using the gift card.",
    ];
  }
  if (cardUsed && hasCashback) {
    return [
      `Use your eligible ${cardLabel}.`,
      `Start your purchase through ${cashbackPartner} so the cashback journey is tracked.`,
      `Complete the merchant checkout using ${cardLabel}.`,
    ];
  }
  if (cardUsed && hasGiftCard) {
    return [
      `Buy the eligible gift card from ${giftCardPartner}.`,
      `Keep your eligible ${cardLabel} ready where the validated card offer applies.`,
      "Complete checkout using the validated payment method shown in your savings route.",
    ];
  }
  if (cardUsed) {
    return [
      `Use your eligible ${cardLabel}.`,
      `Complete the merchant checkout using ${cardLabel}.`,
    ];
  }
  if (hasGiftCard) {
    return [
      `Buy the eligible gift card from ${giftCardPartner}.`,
      "Complete the merchant checkout using the gift card.",
    ];
  }
  if (hasCashback) {
    return [
      `Start your purchase through ${cashbackPartner} so the journey is tracked.`,
      "Complete the merchant purchase through the tracked journey.",
    ];
  }
  return [];
}

function savingsConclusion(result) {
  const s = result.summary;
  if (!(s.extra_saved?.rupees > 0)) return null;
  const parts = [];
  const cardName = result.card_optimization?.selected_card_name || result.inputs?.card?.card_name;
  if (result.card_offer?.applied && cardName) parts.push(`${cardName} card offer`);
  if (result.gift_card?.applied && result.gift_card?.best?.platform_name) {
    parts.push(`${result.gift_card.best.platform_name} gift card`);
  }
  if (result.affiliate?.applied && result.affiliate?.best?.platform_name) {
    parts.push(`${result.affiliate.best.platform_name} cashback`);
  }
  const route = parts.length ? `using ${parts.join(" + ")}` : "with this route";
  return `You can save ${money(s.extra_saved)} extra with this YuktiCart-approved stack ${route}, bringing your effective bill to ${money(s.final_bill)}.`;
}

function Stat({ icon: Icon, label, value, exact, testid }) {
  return (
    <div className="surface-2 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-muted"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 font-display text-xl font-700 text-ink" data-testid={testid} title={exact}>{value}</div>
    </div>
  );
}
