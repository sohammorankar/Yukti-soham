import React from "react";
import { Link } from "react-router-dom";

// Brand mark: shared, replaceable SVG asset at /public/assets/brand/logo-mark.svg
// (source: frontend/public/assets/brand/logo-mark.svg). Swap that one file in
// GitHub to update the icon mark everywhere it appears (nav, mobile nav, footer).
// The "YuktiCart.com" wordmark below stays as live, theme-reactive text/colour.
export function Logo({ to = "/", showTagline = true, size = "md" }) {
  const markPx = size === "sm" ? 36 : 40;
  const text = size === "sm" ? "text-lg" : "text-xl";
  const inner = (
    <div className="flex items-center gap-2">
      <img src="/assets/brand/logo-mark.svg" alt="YuktiCart" width={markPx} height={markPx} className="shrink-0" />
      <div className="leading-none">
        <span className={`font-display ${text} font-600 tracking-tight`}>
          <span className="text-ink">Yukti</span>
          <span style={{ color: "#f59e0b" }}>Cart</span>
          <span className="text-ink-muted">.com</span>
        </span>
        {showTagline && (
          <div className="mt-0.5 text-[9px] font-600 uppercase tracking-[0.18em] text-ink-muted">
            Tactical Savings Engine
          </div>
        )}
      </div>
    </div>
  );
  return to ? <Link to={to} className="focus-ring rounded-md">{inner}</Link> : inner;
}
