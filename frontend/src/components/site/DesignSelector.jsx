import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

// Design-selection stage: preview all three directions before applying.
export function DesignSelector() {
  const { theme, setTheme, confirmChoice, THEMES } = useTheme();
  const [preview, setPreview] = useState(theme);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
         data-testid="design-selector">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-5xl rounded-2xl p-6 sm:p-8"
      >
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1 text-xs text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Choose your visual direction
          </span>
          <h2 className="mt-4 font-display text-3xl font-600 text-ink sm:text-4xl">
            Pick a look for <span className="gold-text">YuktiCart</span>
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-muted">
            Preview each direction live, then apply it across the whole product. You can change it
            anytime from the palette icon in the navigation.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {Object.values(THEMES).map((t) => {
            const active = preview === t.id;
            return (
              <button
                key={t.id}
                data-testid={`design-option-${t.id}`}
                onClick={() => { setPreview(t.id); setTheme(t.id); }}
                className={`focus-ring relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
                  active ? "border-gold ring-2 ring-gold/40" : "border-border hover:border-gold/40"
                }`}
              >
                <div className="flex gap-1.5">
                  {t.swatch.map((c) => (
                    <span key={c} className="h-8 w-8 rounded-md border border-white/10" style={{ background: c }} />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <h3 className="font-display text-lg font-600 text-ink">{t.name}</h3>
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold">{t.tag}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t.desc}</p>
                {active && (
                  <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full btn-gold">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-ink-muted">
            Currently previewing: <span className="text-gold">{THEMES[preview].name}</span>
          </p>
          <button
            onClick={() => confirmChoice(preview)}
            data-testid="design-apply"
            className="btn-gold focus-ring w-full rounded-full px-6 py-3 text-sm font-700 sm:w-auto"
          >
            Apply “{THEMES[preview].name}” &amp; enter YuktiCart
          </button>
        </div>
      </motion.div>
    </div>
  );
}
