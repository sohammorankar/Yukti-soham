import React from "react";
import { motion } from "framer-motion";
import { MASCOTS } from "@/lib/assets";

const MAP = {
  great_stack: { img: MASCOTS.joyful, alt: "Joyful shopping-bag mascot celebrating", title: "That's a smart stack.", copy: "Both routes lined up — this is about as good as it gets." },
  one_route: { img: MASCOTS.calm, alt: "Calm, encouraging shopping-bag mascot", title: "A little optimization still helps.", copy: "One strong route is working for you here." },
  no_saving: { img: MASCOTS.sad, alt: "Disappointed but supportive shopping-bag mascot", title: "No extra route today.", copy: "Try another category or check again later — rates change daily." },
  verify: { img: MASCOTS.think, alt: "Thoughtful, cautious shopping-bag mascot", title: "Almost there — please verify.", copy: "This combination looks promising but needs a quick check at checkout." },
};

export function EmotionalPanel({ status }) {
  const s = MAP[status] || MAP.no_saving;
  return (
    <motion.aside
      key={status}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="surface flex flex-col items-center rounded-xl p-6 text-center"
      data-testid="emotional-panel"
      aria-live="polite"
    >
      <div className="relative h-36 w-36">
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 60px var(--glow)" }} />
        <img src={s.img} alt={s.alt} className="relative h-full w-full rounded-full object-cover" loading="lazy" />
      </div>
      <h4 className="mt-4 font-display text-xl font-600 text-ink">{s.title}</h4>
      <p className="mt-1.5 text-sm text-ink-muted">{s.copy}</p>
    </motion.aside>
  );
}
