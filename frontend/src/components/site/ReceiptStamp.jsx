import React from "react";
import { BadgeCheck } from "lucide-react";
import { money } from "@/lib/format";

// Savings Receipt — the first meaningful result after the YuktiMagic transition.
// Shows a consumer-friendly breakdown from the real calculation. A single
// "YUKTI APPROVED" stamp plays once on mount; there are NO replay controls.
export function ReceiptStamp({ result }) {
  const s = result.summary;
  const aff = result.affiliate?.applied && result.affiliate?.best;
  const gc = result.gift_card?.applied && result.gift_card?.best;

  return (
    <div className="surface relative overflow-hidden rounded-2xl p-5" data-testid="receipt-stamp">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-600 uppercase tracking-widest text-gold">
        <BadgeCheck className="h-4 w-4" /> Yukti Approved savings
      </div>

      <div className="receipt-rise relative mx-auto max-w-sm">
        <div className="relative overflow-hidden rounded-md bg-[#faf7ef] px-5 py-6 text-[#1a1712] shadow-lg"
          style={{ fontFamily: "'Manrope',sans-serif" }}>
          <div className="mb-3 border-b border-dashed border-[#c9c0ac] pb-3 text-center">
            <div className="font-display text-sm font-700 tracking-wide">YUKTICART · SAVINGS RECEIPT</div>
            <div className="text-[10px] text-[#7a7263]">Your optimized checkout</div>
          </div>
          <Row k="Original price" v={money(result.inputs.price)} />
          {gc && <Row k="Gift card saving" v={`− ${money(result.gift_card.best.saving)}`} />}
          {aff && <Row k="Cashback benefit" v={`− ${money(result.affiliate.best.saving)}`} />}
          <div className="my-2 border-t border-dashed border-[#c9c0ac]" />
          <Row k="You save" v={money(s.extra_saved)} strong />
          <Row k="Effective price" v={money(s.final_bill)} strong />
          {!s.mrp_provided && (
            <div className="mt-1 text-center text-[10px] text-[#7a7263]" data-testid="receipt-mrp-note">
              MRP not provided · MRP-based savings not calculated
            </div>
          )}
          <div className="mt-3 border-t border-dashed border-[#c9c0ac] pt-2 text-center text-[10px] text-[#7a7263]">
            Estimated savings · verify retailer terms before purchase
          </div>

          {/* One-time YUKTI APPROVED stamp (concept 1) — corner placement keeps all rows readable */}
          <div className="stamp-drop pointer-events-none absolute right-2 top-2 -rotate-12 opacity-95" aria-hidden>
            <div className="rounded-md border-[2.5px] border-[#c0392b] px-2.5 py-1 text-center text-[#c0392b]"
              style={{ background: "rgba(192,57,43,0.05)" }}>
              <div className="font-display text-xs font-700 leading-none">YUKTI</div>
              <div className="font-display text-xs font-700 leading-none">APPROVED</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, strong }) {
  return (
    <div className={`flex items-center justify-between py-0.5 text-sm ${strong ? "font-700" : ""}`}>
      <span className={strong ? "text-[#1a1712]" : "text-[#5b5443]"}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
