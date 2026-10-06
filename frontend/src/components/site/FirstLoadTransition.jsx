import React from "react";
import { Eye, ScanLine, Layers, PartyPopper, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const STEPS = [
  { icon: Eye, label: "Spot it" },
  { icon: ScanLine, label: "Check it" },
  { icon: Layers, label: "Stack it" },
  { icon: PartyPopper, label: "Save" },
];

// Visual-only startup screen. The gate dismisses it on real API/data readiness.
export function FirstLoadTransition({ status, timedOut, onRetry }) {
  return (
    <motion.div
      className="fixed inset-0 z-[70] grid place-items-center bg-[var(--page-bg)]"
      data-testid="first-load-transition"
      role={timedOut ? "alert" : "status"}
      aria-live="polite"
      initial={false}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
    >
      <div className="w-full max-w-md px-6 text-center">
        <p className="mb-8 font-display text-2xl font-700 tracking-tight text-ink">
          Yukti<span className="gold-text">Cart</span>
        </p>
        <div className="flex items-center justify-center gap-2 sm:gap-4" aria-hidden="true">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.label}>
                <div className="intro-step flex flex-col items-center gap-2" style={{ animationDelay: `${idx * 0.32}s` }}>
                  <span className="grid h-12 w-12 place-items-center rounded-xl btn-gold">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs text-gold">{step.label}</span>
                </div>
                {idx < STEPS.length - 1 && <span className="h-px w-4 bg-border sm:w-6" />}
              </React.Fragment>
            );
          })}
        </div>
        <p className="mt-8 font-display text-lg text-ink" data-testid="startup-status">
          {timedOut ? "YuktiCart is taking longer than usual to wake up." : status}
        </p>
        {timedOut ? (
          <>
            <p className="mt-2 text-sm text-ink-muted">Your savings are safe. We could not connect just yet; please try again.</p>
            <button
              type="button"
              onClick={onRetry}
              data-testid="startup-retry"
              className="focus-ring mt-6 rounded-full btn-gold px-6 py-2 text-sm font-700"
            >
              Retry connection
            </button>
          </>
        ) : (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin text-gold" aria-hidden="true" />
            <span>Please wait a moment</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
