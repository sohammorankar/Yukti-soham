import React from "react";
import { motion } from "framer-motion";
import { MASCOTS } from "@/lib/assets";

const MAP = {
  great_stack: { img: MASCOTS.joyful, alt: "Joyful shopping-bag mascot celebrating", title: "That's a smart stack.", copy: "Both routes lined up — this is about as good as it gets." },
  one_route: { img: MASCOTS.calm, alt: "Calm, encouraging shopping-bag mascot", title: "A little optimization still helps.", copy: "One strong route is working for you here." },
  no_saving: { img: MASCOTS.sad, alt: "Disappointed but supportive shopping-bag mascot", title: "No extra route today.", copy: "Try another category or check again later — rates change daily." },
  verify: { img: MASCOTS.think, alt: "Thoughtful, cautious shopping-bag mascot", title: "Almost there — please verify.", copy: "This combination looks promising but needs a quick check at checkout." },
};

export function EmotionalPanel({ status, compact = false }) {
  const s = MAP[status] || MAP.no_saving;
  return (
    <motion.aside
      key={status}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={compact
        ? "flex items-center gap-3 rounded-2xl border border-gold/25 bg-gold/5 p-3 text-left sm:p-4"
        : "surface flex flex-col items-center rounded-xl p-6 text-center"}
      data-testid="emotional-panel"
      aria-live="polite"
    >
      <div className={`relative shrink-0 ${compact ? "h-16 w-16" : "h-36 w-36"}`}>
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 60px var(--glow)" }} />
        <img src={s.img} alt={s.alt} className="relative h-full w-full rounded-full object-cover" loading="lazy" />
      </div>
      <div className="min-w-0">
        {compact && <p className="text-[10px] font-700 uppercase tracking-[0.16em] text-gold">Smart Stack</p>}
        <h4 className={`${compact ? "mt-0.5 text-base" : "mt-4 text-xl"} font-display font-600 text-ink`}>{s.title}</h4>
        <p className={`${compact ? "mt-0.5 text-xs leading-relaxed" : "mt-1.5 text-sm"} text-ink-muted`}>{s.copy}</p>
      </div>
    </motion.aside>
  );
}
