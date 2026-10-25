import React from "react";
import { useNavigate } from "react-router-dom";
import { ScanSearch, Layers, ShoppingBag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const STEPS = [
  {
    icon: ScanSearch,
    title: "Find your product",
    desc: "Upload a cart image, paste a supported product URL, or choose a brand.",
  },
  {
    icon: Layers,
    title: "Compare savings",
    desc: "Explore eligible cashback, gift-card discounts and card offers.",
  },
  {
    icon: ShoppingBag,
    title: "Shop through the offer",
    desc: "Follow the displayed instructions and continue to the relevant merchant.",
  },
];

// Shared "How YuktiCart works" guide. Used both as the dismissible first-visit
// welcome popup and as the persistent, reopenable explainer from the
// navigation — same content either way. Purely presentational: it never
// claims guaranteed cashback or that every offer can be combined, and it does
// not touch auth, theme or calculation state.
export function WelcomeGuide({ open, onOpenChange }) {
  const navigate = useNavigate();

  const handleStartSaving = () => {
    onOpenChange(false);
    navigate("/#engine");
    requestAnimationFrame(() => document.getElementById("engine")?.scrollIntoView({ behavior: "smooth" }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="welcome-guide-modal"
        className="glass max-h-[85vh] max-w-md gap-0 overflow-y-auto rounded-2xl border-border p-6 sm:p-7"
      >
        <DialogHeader className="text-center">
          <DialogTitle className="font-display text-2xl font-600 text-ink" data-testid="welcome-guide-title">
            Welcome to <span className="gold-text">YuktiCart</span>
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-ink-muted" data-testid="welcome-guide-subtitle">
            Find smarter ways to save before you shop.
          </DialogDescription>
        </DialogHeader>

        <ol className="mt-6 space-y-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                data-testid={`welcome-guide-step-${idx + 1}`}
                className="flex items-start gap-3 text-left"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl btn-gold">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-600 text-ink">
                    Step {idx + 1} — {step.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{step.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          onClick={handleStartSaving}
          data-testid="welcome-guide-cta"
          className="btn-gold focus-ring mt-7 w-full rounded-full px-6 py-3 text-sm font-700"
        >
          Let&apos;s find savings
        </button>
        <p className="mt-3 text-center text-xs text-ink-muted" data-testid="welcome-guide-disclaimer">
          Cashback, gift-card and card offers are indicative and may not always be combinable.
        </p>
      </DialogContent>
    </Dialog>
  );
}
