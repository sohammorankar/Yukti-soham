import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useMeta } from "@/lib/useMeta";
import { trackEvent } from "@/lib/analytics";

// YuktiMagic bridge: a YuktiCart-controlled hop between the results page and the
// trusted external partner. The external URL is ALWAYS resolved by the backend
// (GET /api/redirect/:slug) — never constructed on the client — so there is no
// open-redirect surface. A short (~1.4s) branded transition plays, then we hand
// the user off to the resolved destination exactly once.
export default function Bridge() {
  useMeta("YuktiMagic · Preparing your savings route", "Securely routing you to your YuktiCart-suggested partner.");
  const { partner } = useParams();
  const [params] = useSearchParams();
  const store = params.get("store");

  const [partnerName, setPartnerName] = useState(partner || "your partner");
  const [error, setError] = useState("");
  const doneRef = useRef(false); // guards against duplicate navigation

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    (async () => {
      try {
        // Pass non-sensitive store context so the backend can resolve a
        // Store × Affiliate Partner deep-link mapping when one is configured.
        // The external URL is still resolved entirely by the backend.
        const path = store
          ? `/redirect/${encodeURIComponent(partner)}?store=${encodeURIComponent(store)}`
          : `/redirect/${encodeURIComponent(partner)}`;
        const { data } = await api.get(path);
        if (cancelled) return;
        setPartnerName(data.partner || partner);
        // Keep the transition visible ~1.4s minimum, but never wait longer than needed.
        const wait = Math.max(0, 1400 - (Date.now() - startedAt));
        setTimeout(() => {
          if (cancelled || doneRef.current) return;
          doneRef.current = true;
          // Fires exactly once (guarded by doneRef) at the point the user is
          // actually sent to the external partner — never claims a purchase or
          // cashback outcome, only that the redirect happened. A short flat
          // delay gives the browser time to actually dispatch the event's
          // network request before we navigate away in the same tick.
          trackEvent("outbound_redirect_clicked", {
            partner: data.partner || partner, store: store || undefined,
          });
          // replace() so the back button returns to results, not to this bridge.
          setTimeout(() => window.location.replace(data.url), 150);
        }, wait);
      } catch (e) {
        if (cancelled) return;
        setError(
          e?.response?.status === 404
            ? "We couldn't find a trusted destination for this partner right now."
            : "Something went wrong preparing your savings route."
        );
      }
    })();

    return () => { cancelled = true; };
  }, [partner, store]);

  return (
    <div className="grid min-h-screen place-items-center overflow-hidden px-4">
      <div className="w-full max-w-md text-center">
        {!error ? (
          <>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative mx-auto grid h-24 w-24 place-items-center"
              data-testid="yuktimagic-transition"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-dashed border-gold/40"
              />
              <motion.span
                animate={{ scale: [1, 1.12, 1], opacity: [0.9, 1, 0.9] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                className="grid h-16 w-16 place-items-center rounded-full btn-gold"
              >
                <Sparkles className="h-8 w-8" />
              </motion.span>
            </motion.div>

            <motion.h1
              initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-6 font-display text-2xl font-700 text-ink">
              YuktiMagic is working <span aria-hidden>✨</span>
            </motion.h1>
            <p className="mt-2 text-sm text-ink-muted" data-testid="yuktimagic-status">Preparing your savings route…</p>

            <p className="mt-4 text-sm text-ink" data-testid="bridge-context">
              Taking you to <span className="gold-text font-600">{partnerName}</span>
              {store ? <> for your <span className="font-600">{store}</span> savings route.</> : "."}
            </p>

            <p className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" /> Secure YuktiCart-verified redirect
            </p>
          </>
        ) : (
          <div className="surface rounded-2xl p-7" data-testid="bridge-error">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
            <h1 className="mt-4 font-display text-xl font-600 text-ink">Route unavailable</h1>
            <p className="mt-2 text-sm text-ink-muted">{error}</p>
            <Link to="/" data-testid="bridge-back"
              className="focus-ring mt-5 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-ink-muted hover:text-gold">
              <ArrowLeft className="h-4 w-4" /> Back to YuktiCart
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
