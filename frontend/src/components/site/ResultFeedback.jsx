import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";

const exactValue = (value) => {
  if (value == null) return null;
  if (typeof value === "object") return value.exact ?? null;
  return String(value);
};

export function ResultFeedback({ result }) {
  const { isAuthed } = useAuth();
  const [open, setOpen] = useState(false);
  const [sentiment, setSentiment] = useState(null);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const chooseSentiment = (value) => {
    if (submitted) return;
    setSentiment(value);
    setError("");
    setAuthRequired(false);
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!isAuthed) {
      setAuthRequired(true);
      return;
    }
    if (!rating) {
      setError("Please choose a star rating.");
      return;
    }

    const giftCardSaving = result.gift_card?.applied ? exactValue(result.gift_card?.best?.saving) : null;
    const cashbackSaving = result.affiliate?.applied ? exactValue(result.affiliate?.best?.saving) : null;
    const context = {
      store_name: result.inputs?.store || null,
      category: result.inputs?.category || null,
      order_value: exactValue(result.inputs?.price),
      total_saving: exactValue(result.summary?.extra_saved),
      effective_price: exactValue(result.summary?.final_bill),
      gift_card_saving: giftCardSaving,
      cashback_saving: cashbackSaving,
      rate_version: result.rate_version || null,
    };

    setBusy(true);
    try {
      await api.post("/feedback/result", { sentiment, rating, notes, context });
      setSubmitted(true);
      setOpen(false);
    } catch (requestError) {
      if (requestError.response?.status === 401) setAuthRequired(true);
      else setError(formatApiErrorDetail(requestError.response?.data?.detail) || "Could not submit feedback.");
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="surface rounded-2xl px-5 py-4 text-center" data-testid="feedback-confirmation">
        <p className="text-sm font-600 text-savings">Thanks — your feedback helps improve YuktiCart.</p>
      </div>
    );
  }

  return (
    <>
      <div className="surface rounded-2xl px-5 py-4 text-center" data-testid="feedback-entry">
        <p className="text-sm font-600 text-ink">Was this savings stack helpful?</p>
        <div className="mt-3 flex justify-center gap-3">
          <button type="button" onClick={() => chooseSentiment("positive")} aria-label="This savings stack was helpful"
            aria-pressed={sentiment === "positive"} data-testid="feedback-positive"
            className={`focus-ring grid h-10 w-12 place-items-center rounded-full border text-lg transition-colors ${sentiment === "positive" ? "border-gold bg-gold/15" : "border-border hover:border-gold/50"}`}>👍</button>
          <button type="button" onClick={() => chooseSentiment("negative")} aria-label="This savings stack was not helpful"
            aria-pressed={sentiment === "negative"} data-testid="feedback-negative"
            className={`focus-ring grid h-10 w-12 place-items-center rounded-full border text-lg transition-colors ${sentiment === "negative" ? "border-gold bg-gold/15" : "border-border hover:border-gold/50"}`}>👎</button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-8" role="presentation" onMouseDown={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="result-feedback-title" data-testid="feedback-modal"
            onMouseDown={(event) => event.stopPropagation()}
            className="surface w-full max-w-md rounded-2xl border border-gold/20 p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-700 uppercase tracking-[0.16em] text-gold">Result feedback</p>
                <h3 id="result-feedback-title" className="mt-1 font-display text-xl font-700 text-ink">
                  {sentiment === "positive" ? "👍 Helpful" : "👎 Not helpful"}
                </h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close feedback"
                className="focus-ring rounded-full border border-border p-2 text-ink-muted hover:text-gold">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-5">
              <fieldset>
                <legend className="text-sm font-600 text-ink">Rating</legend>
                <div className="mt-2 flex gap-1" data-testid="feedback-rating">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button key={value} type="button" onClick={() => { setRating(value); setError(""); }}
                      aria-label={`${value} star${value > 1 ? "s" : ""}`} aria-pressed={rating === value}
                      className="focus-ring rounded-md p-1 text-gold">
                      <Star className={`h-7 w-7 ${value <= rating ? "fill-current" : "opacity-40"}`} />
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="result-feedback-notes" className="text-sm font-600 text-ink">Tell us about your experience</label>
                <textarea id="result-feedback-notes" value={notes} onChange={(event) => setNotes(event.target.value)}
                  maxLength={1500} rows={4} data-testid="feedback-notes"
                  className="focus-ring mt-2 w-full resize-y rounded-xl border border-border bg-input p-3 text-sm text-foreground"
                  placeholder="What worked well, or what could be clearer?" />
                <p className="mt-1 text-right text-[10px] text-ink-muted">{notes.length}/1500</p>
              </div>

              {authRequired && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 text-sm text-ink" data-testid="feedback-auth-required">
                  <p>Please log in or sign up to submit your feedback.</p>
                  <div className="mt-2 flex gap-3">
                    <Link to="/login" className="font-700 text-gold hover:underline">Log in</Link>
                    <Link to="/signup" className="font-700 text-gold hover:underline">Sign up</Link>
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-destructive" data-testid="feedback-error">{error}</p>}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setOpen(false)}
                  className="focus-ring rounded-full border border-border px-4 py-2 text-sm text-ink-muted hover:text-gold">Cancel</button>
                <button type="submit" disabled={busy} data-testid="feedback-submit"
                  className="btn-gold focus-ring rounded-full px-5 py-2 text-sm font-700 disabled:opacity-60">
                  {busy ? "Submitting…" : "Submit Feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
