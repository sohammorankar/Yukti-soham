import React from "react";
import { useMeta } from "@/lib/useMeta";

export function PageShell({ title, kicker, description, children }) {
  useMeta(`${title} · YuktiCart`, description);
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6" data-testid={`page-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
      {kicker && <span className="text-xs font-600 uppercase tracking-widest text-gold">{kicker}</span>}
      <h1 className="mt-2 font-display text-4xl font-600 text-ink sm:text-5xl">{title}</h1>
      {description && <p className="mt-4 text-base leading-relaxed text-ink-muted">{description}</p>}
      <div className="prose-yc mt-8 space-y-6">{children}</div>
    </div>
  );
}

export function Block({ h, children }) {
  return (
    <section>
      {h && <h2 className="font-display text-xl font-600 text-ink">{h}</h2>}
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}
