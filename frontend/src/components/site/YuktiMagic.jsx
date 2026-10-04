import React, { useEffect } from "react";

// One-time "Yukti is calculating your best savings route" transition.
// Combines the receipt stamp (concept 1) + scan sweep (concept 3) into a single
// non-repeatable reveal. There are intentionally NO replay controls — it plays
// once per calculation and then hands off to the Savings Receipt.
export function YuktiMagic({ onDone, duration = 2200 }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), duration);
    return () => clearTimeout(t);
  }, [onDone, duration]);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/80 px-4 backdrop-blur-sm"
      data-testid="yukti-magic"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-sm text-center">
        <div className="receipt-rise relative mx-auto max-w-xs overflow-hidden rounded-md bg-[#faf7ef] px-5 py-6 text-[#1a1712] shadow-2xl"
          style={{ fontFamily: "'Manrope',sans-serif" }}>
          <div className="mb-3 border-b border-dashed border-[#c9c0ac] pb-2 text-center">
            <div className="font-display text-sm font-700 tracking-wide">YUKTICART · SAVINGS RECEIPT</div>
            <div className="text-[10px] text-[#7a7263]">Optimizing your savings route</div>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <span className="h-2 w-20 rounded bg-[#e6ded0]" />
              <span className="h-2 w-12 rounded bg-[#e6ded0]" />
            </div>
          ))}

          {/* concept 3 — scan sweep */}
          <span className="scan-line pointer-events-none absolute left-0 h-0.5 w-full"
            style={{ background: "linear-gradient(90deg,transparent,#22c55e,transparent)" }} aria-hidden />

          {/* concept 1 — stamp drop */}
          <div className="stamp-drop pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12" aria-hidden>
            <div className="rounded-md border-[3px] border-[#c0392b] px-4 py-2 text-center text-[#c0392b]"
              style={{ background: "rgba(192,57,43,0.06)" }}>
              <div className="font-display text-base font-700 leading-none">YUKTI</div>
              <div className="font-display text-base font-700 leading-none">APPROVED</div>
            </div>
          </div>
          <span className="ink-splat pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(192,57,43,.25),transparent 70%)" }} aria-hidden />
        </div>

        <p className="mt-6 font-display text-xl font-600 text-ink" data-testid="yukti-magic-msg">
          Yukti is calculating your best savings route…
        </p>
        <p className="mt-1.5 text-sm text-ink-muted">
          Comparing every eligible saving to find your lowest bill.
        </p>
      </div>
    </div>
  );
}
