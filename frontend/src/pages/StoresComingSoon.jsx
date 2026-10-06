import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMeta } from "@/lib/useMeta";

// Phase 4A route target only. The actual directory and store pages are Phase 4B.
export default function StoresComingSoon() {
  useMeta("Stores · YuktiCart", "");
  const [params] = useSearchParams();
  const selected = params.get("store");
  const slug = selected && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(selected) ? selected : null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center" data-testid="stores-coming-soon">
      <h1 className="font-display text-3xl font-600 text-ink">Store directory coming soon</h1>
      <p className="mt-3 text-sm text-ink-muted">Explore the featured stores on our homepage for now. The full directory is on its way.</p>
      {slug && <p className="mt-3 text-sm text-ink-muted">Selected store: {slug}</p>}
      <Link to="/" className="btn-gold mt-6 inline-flex rounded-full px-5 py-2 text-sm font-700">Back to homepage</Link>
    </section>
  );
}
