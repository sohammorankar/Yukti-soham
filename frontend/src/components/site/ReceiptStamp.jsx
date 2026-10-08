import React from "react";
import { BadgeCheck } from "lucide-react";
import { money } from "@/lib/format";

// Savings Receipt — the first meaningful result after the YuktiMagic transition.
// Shows a consumer-friendly breakdown from the real calculation with a CSS-only
// YuktiCart approval stamp. There are no replay controls or generated assets.
export function ReceiptStamp({ result }) {
  const s = result.summary;
  const aff = result.affiliate?.applied && result.affiliate?.best;
  const gc = result.gift_card?.applied && result.gift_card?.best;
  const cardOffer = result.card_offer?.applied && result.card_offer?.applied_offer;
  const cardSaving = cardOffer?.saving;
  const winningCardName = result.card_optimization?.selected_card_name || result.inputs?.card?.card_name || result.card_offer?.card_name;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-[radial-gradient(circle_at_85%_10%,var(--glow),transparent_36%),var(--surface)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-6" data-testid="receipt-stamp">
      <div className="mb-4 flex items-center gap-1.5 text-xs font-700 uppercase tracking-[0.16em] text-gold">
        <BadgeCheck className="h-4 w-4" /> YuktiCart Savings Receipt
      </div>

      <div className="receipt-rise relative mx-auto max-w-lg">
        <div className="relative overflow-hidden rounded-lg border border-[#ded6c5] bg-[#faf7ef] px-5 py-6 text-[#1a1712] shadow-xl sm:px-6"
          style={{ fontFamily: "'Manrope',sans-serif" }}>
          <div className="mb-3 border-b border-dashed border-[#c9c0ac] pb-3 text-center">
            <div className="font-display text-sm font-700 tracking-wide">YUKTICART · SAVINGS RECEIPT</div>
            <div className="text-[10px] text-[#7a7263]">Your optimized checkout</div>
            {cardOffer && winningCardName && (
              <div className="mt-2 rounded-md border border-[#c9c0ac] bg-[#f3eddf] px-3 py-2" data-testid="receipt-winning-card">
                <div className="text-[9px] font-700 uppercase tracking-[0.14em] text-[#8b6b16]">Best Card Offer</div>
                <div className="mt-0.5 text-xs font-700 text-[#1a1712]">{winningCardName}</div>
                {cardOffer.offer_name && <div className="text-[10px] text-[#7a7263]">{cardOffer.offer_name}</div>}
              </div>
            )}
          </div>
          <Row k="Original price" v={money(result.inputs.price)} testid="receipt-original-price" />
          {cardOffer && cardSaving && <Row k="Card Offer Saving" v={`− ${money(cardSaving)}`} testid="receipt-card-saving" />}
          {gc && <Row k="Gift Card Saving" v={`− ${money(result.gift_card.best.saving)}`} testid="receipt-giftcard-saving" />}
          {aff && <Row k="Cashback Benefit" v={`− ${money(result.affiliate.best.saving)}`} testid="receipt-cashback-saving" />}
          <div className="my-2 border-t border-dashed border-[#c9c0ac]" />
          <Row k="You save" v={money(s.extra_saved)} strong testid="receipt-total-saving" />
          <Row k="Effective price" v={money(s.final_bill)} strong testid="receipt-effective-price" />
          {!s.mrp_provided && (
            <div className="mt-1 text-center text-[10px] text-[#7a7263]" data-testid="receipt-mrp-note">
              MRP not provided · MRP-based savings not calculated
            </div>
          )}
          <div className="mt-3 border-t border-dashed border-[#c9c0ac] pt-2 text-center text-[10px] text-[#7a7263]">
            Estimated savings · verify retailer terms before purchase
          </div>

          {/* CSS-only approval stamp; kept in document flow so receipt values remain clear. */}
          <div className="mt-4 flex justify-end pr-1" aria-hidden>
            <div className="-rotate-6 rounded-md border-[2.5px] border-double border-[#b52f25] px-3 py-1.5 text-center text-[#b52f25] opacity-90"
              style={{ background: "rgba(181,47,37,0.035)", boxShadow: "inset 0 0 0 1px rgba(181,47,37,0.18)" }}>
              <div className="font-display text-[11px] font-700 leading-none tracking-wide">YUKTICART APPROVED</div>
              <div className="mt-1 text-[8px] font-800 leading-none tracking-[0.2em]">SAVINGS STACK</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, strong, testid }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-0.5 text-sm ${strong ? "font-700" : ""}`} data-testid={testid}>
      <span className={strong ? "text-[#1a1712]" : "text-[#5b5443]"}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
