import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, LogIn, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/lib/useMeta";

const CARD_TYPES = ["Credit", "Debit"];
const CARD_NETWORKS = ["Visa", "Mastercard", "RuPay", "American Express", "Other"];
const EMPTY_FORM = { bank_name: "", card_type: "", card_network: "" };

const inputCls =
  "focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground";

export default function MyCards() {
  useMeta("My Cards & Offers · YuktiCart", "Save your card preferences for future personalized offers.");
  const { user, ready, isAuthed } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/cards");
      setCards(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && isAuthed) load();
  }, [ready, isAuthed, load]);

  const validate = () => {
    const errs = {};
    if (!form.bank_name.trim()) errs.bank_name = "Bank name is required";
    if (!form.card_type) errs.card_type = "Select a card type";
    if (!form.card_network) errs.card_network = "Select a card network";
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  const openAdd = () => { setForm(EMPTY_FORM); setEditingId(null); setErrors({}); setFormOpen(true); };
  const openEdit = (c) => {
    setForm({ bank_name: c.bank_name, card_type: c.card_type, card_network: c.card_network });
    setEditingId(c.id); setErrors({}); setFormOpen(true);
  };
  const closeForm = () => { setFormOpen(false); setEditingId(null); setForm(EMPTY_FORM); setErrors({}); };

  const save = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/cards/${editingId}`, form);
        toast.success("Card updated");
      } else {
        await api.post("/cards", form);
        toast.success("Card saved");
      }
      closeForm();
      await load();
    } catch (err) {
      const msg = formatApiErrorDetail(err.response?.data?.detail);
      if (err.response?.status === 409) setErrors({ bank_name: msg });
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    try {
      await api.delete(`/cards/${c.id}`);
      toast.success("Card removed");
      setCards((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  if (!ready) {
    return <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6" data-testid="my-cards-loading">
      <p className="text-sm text-ink-muted">Loading…</p>
    </div>;
  }

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6" data-testid="my-cards-login-prompt">
        <span className="text-xs font-600 uppercase tracking-widest text-gold">Account</span>
        <h1 className="mt-2 font-display text-4xl font-600 text-ink sm:text-5xl">My Cards &amp; Offers</h1>
        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center">
          <LogIn className="mx-auto h-8 w-8 text-gold" />
          <p className="mt-3 text-sm text-ink-muted">
            Please log in to save your card preferences for future personalized offers.
          </p>
          <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Link to="/login" data-testid="my-cards-login-link"
              className="btn-gold focus-ring inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-sm font-700">
              <LogIn className="h-4 w-4" /> Log in
            </Link>
            <Link to="/signup" data-testid="my-cards-signup-link"
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border px-6 py-2.5 text-sm text-ink-muted hover:text-gold">
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6" data-testid="my-cards-page">
      <span className="text-xs font-600 uppercase tracking-widest text-gold">Account</span>
      <h1 className="mt-2 font-display text-4xl font-600 text-ink sm:text-5xl">My Cards &amp; Offers</h1>
      <p className="mt-4 text-base leading-relaxed text-ink-muted">
        Save your card preferences for future personalized offers.
      </p>
      <p className="mt-3 inline-flex items-start gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-ink-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
        We never ask for or store card numbers, CVV, expiry dates or PINs — only bank, card type and network.
      </p>

      <div className="mt-8 space-y-3">
        {loading ? (
          <p className="text-sm text-ink-muted">Loading your cards…</p>
        ) : cards.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-ink-muted"
            data-testid="my-cards-empty">
            No cards saved yet. Add your first card preference below.
          </p>
        ) : (
          cards.map((c) => (
            <div key={c.id} data-testid="card-item"
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <CreditCard className="h-5 w-5 shrink-0 text-gold" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-600 text-ink" data-testid="card-bank">{c.bank_name}</p>
                  <p className="text-xs text-ink-muted">{c.card_type} • {c.card_network}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => openEdit(c)} data-testid="edit-card-btn" aria-label={`Edit ${c.bank_name}`}
                  className="focus-ring inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-ink-muted hover:text-gold">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => remove(c)} data-testid="delete-card-btn" aria-label={`Delete ${c.bank_name}`}
                  className="focus-ring inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-ink-muted hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!formOpen && (
        <button onClick={openAdd} data-testid="add-card-open-btn"
          className="btn-gold focus-ring mt-6 inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-sm font-700">
          <Plus className="h-4 w-4" /> Add a card
        </button>
      )}

      {formOpen && (
        <form onSubmit={save} data-testid="add-card-form" noValidate
          className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-600 text-ink">{editingId ? "Edit card" : "Add a card"}</h2>
            <button type="button" onClick={closeForm} aria-label="Close form" data-testid="close-form-btn"
              className="focus-ring grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:text-gold">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label htmlFor="bank_name" className="mb-1 block text-xs font-600 text-ink">Bank Name *</label>
            <input id="bank_name" value={form.bank_name} maxLength={80}
              onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
              placeholder="e.g. HDFC Bank" data-testid="bank-input" className={inputCls} />
            {errors.bank_name && <p className="mt-1 text-xs text-destructive" data-testid="bank-error">{errors.bank_name}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="card_type" className="mb-1 block text-xs font-600 text-ink">Card Type *</label>
              <select id="card_type" value={form.card_type}
                onChange={(e) => setForm((f) => ({ ...f, card_type: e.target.value }))}
                data-testid="card-type-select" className={inputCls}>
                <option value="">Select type</option>
                {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.card_type && <p className="mt-1 text-xs text-destructive" data-testid="type-error">{errors.card_type}</p>}
            </div>
            <div>
              <label htmlFor="card_network" className="mb-1 block text-xs font-600 text-ink">Card Network *</label>
              <select id="card_network" value={form.card_network}
                onChange={(e) => setForm((f) => ({ ...f, card_network: e.target.value }))}
                data-testid="card-network-select" className={inputCls}>
                <option value="">Select network</option>
                {CARD_NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              {errors.card_network && <p className="mt-1 text-xs text-destructive" data-testid="network-error">{errors.card_network}</p>}
            </div>
          </div>

          <button type="submit" disabled={saving} data-testid="save-card-btn"
            className="btn-gold focus-ring w-full rounded-full py-3 text-sm font-700 disabled:opacity-60">
            {saving ? "Saving…" : editingId ? "Save changes" : "Save card"}
          </button>
        </form>
      )}
    </div>
  );
}
