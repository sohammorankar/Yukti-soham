import React, { useState } from "react";
import { Stamp, BadgeCheck, ScanLine, Check } from "lucide-react";
import { money } from "@/lib/format";

const VARIANTS = [
  { id: "stamp", label: "Stamp", icon: Stamp },
  { id: "seal", label: "Seal", icon: BadgeCheck },
  { id: "scan", label: "Scan", icon: ScanLine },
];

// A paper receipt that gets a "YUKTI APPROVED" mark. 3 switchable animation styles.
export function ReceiptStamp({ result }) {
  const s = result.summary;
  const [variant, setVariant] = useState(() => localStorage.getItem("yc_stamp") || "stamp");
  const [nonce, setNonce] = useState(0); // replay key

  const pick = (id) => { setVariant(id); localStorage.setItem("yc_stamp", id); setNonce((n) => n + 1); };

  return (
    <div className="surface relative overflow-hidden rounded-2xl p-5" data-testid="receipt-stamp">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-600 uppercase tracking-widest text-gold">Yukti Approved savings</span>
        <div className="flex gap-1" role="group" aria-label="Animation style">
          {VARIANTS.map((v) => (
            <button key={v.id} onClick={() => pick(v.id)} data-testid={`stamp-variant-${v.id}`}
              title={v.label}
              className={`focus-ring grid h-7 w-7 place-items-center rounded-md border text-xs ${
                variant === v.id ? "btn-gold border-transparent" : "border-border text-ink-muted hover:text-gold"}`}>
              <v.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* The receipt */}
      <div key={`${variant}-${nonce}`} className="receipt-rise relative mx-auto max-w-sm">
        <div className="relative overflow-hidden rounded-md bg-[#faf7ef] px-5 py-6 text-[#1a1712] shadow-lg"
          style={{ fontFamily: "'Manrope',sans-serif" }}>
          {/* perforated top */}
          <div className="mb-3 border-b border-dashed border-[#c9c0ac] pb-3 text-center">
            <div className="font-display text-sm font-700 tracking-wide">YUKTICART · SAVINGS RECEIPT</div>
            <div className="text-[10px] text-[#7a7263]">Optimized checkout stack</div>
          </div>
          <Row k="Retail price" v={money(result.inputs.price)} />
          <Row k="Affiliate cashback" v={result.affiliate?.applied && result.affiliate?.best ? `− ${money(result.affiliate.best.saving)}` : "—"} />
          <Row k="Gift-card discount" v={result.gift_card?.applied && result.gift_card?.best ? `− ${money(result.gift_card.best.saving)}` : "—"} />
          <div className="my-2 border-t border-dashed border-[#c9c0ac]" />
          <Row k="Extra saved" v={money(s.extra_saved)} strong />
          <Row k="Final effective bill" v={money(s.final_bill)} strong />
          <div className="mt-3 border-t border-dashed border-[#c9c0ac] pt-2 text-center text-[10px] text-[#7a7263]">
            Verify retailer terms before purchase · rate snapshot {result.rate_version}
          </div>

          {/* Variant overlays */}
          {variant === "stamp" && (
            <>
              <div className="stamp-drop pointer-events-none absolute left-1/2 top-1/2 -rotate-12" aria-hidden>
                <div className="rounded-md border-[3px] border-[#c0392b] px-4 py-2 text-center text-[#c0392b]" style={{ background: "rgba(192,57,43,0.06)" }}>
                  <div className="font-display text-lg font-700 leading-none">YUKTI</div>
                  <div className="font-display text-lg font-700 leading-none">APPROVED</div>
                  <div className="mt-0.5 text-[8px] tracking-widest">SMART STACK ✓</div>
                </div>
              </div>
              <span className="ink-splat pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle,rgba(192,57,43,.25),transparent 70%)" }} aria-hidden />
            </>
          )}
          {variant === "seal" && (
            <div className="seal-press shine-sweep pointer-events-none absolute left-1/2 top-1/2 grid h-24 w-24 place-items-center overflow-hidden rounded-full text-center" aria-hidden
              style={{ background: "radial-gradient(circle at 35% 30%, #f0d98a, #b8860b)", boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>
              <div className="text-[#3a2b06]">
                <BadgeCheck className="mx-auto h-6 w-6" />
                <div className="font-display text-[10px] font-700 leading-tight">YUKTI<br/>APPROVED</div>
              </div>
            </div>
          )}
          {variant === "scan" && (
            <>
              <span className="scan-line pointer-events-none absolute left-0 h-0.5 w-full" style={{ background: "linear-gradient(90deg,transparent,#22c55e,transparent)" }} aria-hidden />
              <div className="check-pop pointer-events-none absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center" aria-hidden>
                <span className="grid h-16 w-16 place-items-center rounded-full" style={{ background: "#16a34a" }}>
                  <Check className="h-9 w-9 text-white" strokeWidth={3} />
                </span>
              </div>
            </>
          )}
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
