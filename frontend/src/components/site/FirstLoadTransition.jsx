import React, { useState } from "react";
import { Eye, ScanLine, Layers, PartyPopper } from "lucide-react";

const VERSION = "v1";
const STEPS = [
  { icon: Eye, label: "Spot it" },
  { icon: ScanLine, label: "Check it" },
  { icon: Layers, label: "Stack it" },
  { icon: PartyPopper, label: "Save" },
];

// CSS-animation driven so it can never get stuck on flaky JS timers.
export function FirstLoadTransition() {
  const seen = typeof window !== "undefined" && localStorage.getItem("yc_intro") === VERSION;
  const [show, setShow] = useState(!seen);

  const finish = () => {
    try { localStorage.setItem("yc_intro", VERSION); } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-[var(--page-bg)]"
      data-testid="first-load-transition"
    >
      {/* invisible element whose CSS animation end dismisses the intro */}
      <span className="intro-timer pointer-events-none absolute h-px w-px opacity-0" onAnimationEnd={finish} aria-hidden />
      <div className="w-full max-w-md px-6 text-center">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            return (
              <React.Fragment key={s.label}>
                <div className="intro-step flex flex-col items-center gap-2" style={{ animationDelay: `${idx * 0.32}s` }}>
                  <span className="grid h-12 w-12 place-items-center rounded-xl btn-gold">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs text-gold">{s.label}</span>
                </div>
                {idx < STEPS.length - 1 && <span className="h-px w-4 bg-border sm:w-6" />}
              </React.Fragment>
            );
          })}
        </div>
        <p className="mt-8 font-display text-lg text-ink">Finding your best savings route…</p>
        <button
          onClick={finish}
          data-testid="intro-skip"
          className="focus-ring mt-6 rounded-full border border-border px-4 py-1.5 text-xs text-ink-muted hover:text-gold"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
