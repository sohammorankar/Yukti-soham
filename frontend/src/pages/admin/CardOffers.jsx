import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Combobox } from "@/components/Combobox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMeta } from "@/lib/useMeta";

const blankStackability = { affiliate: false, gift_card: false, coupon: false, other_card: false };
const emptyForm = {
  card_id: "", store_id: "", offer_name: "", offer_type: "instant_discount",
  discount_type: "percentage", discount_value: "", minimum_order_value: "",
  maximum_discount_amount: "", maximum_eligible_amount: "", payment_method: "both",
  customer_type: "both", category_id: "", eligibility_notes: "", valid_from: "",
  valid_until: "", active: true, stackability: blankStackability, priority: 0, notes: "",
  card_offer_url: "", promotion_headline: "", promotion_description: "", promotion_cta_label: "",
};

const labelize = (value) => (value || "").replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
const money = (value) => value ? `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—";
const discount = (offer) => offer.discount_type === "percentage" ? `${offer.discount_value}%` : money(offer.discount_value);

export default function CardOffers() {
  useMeta("Card Offers · YuktiCart Console", "");
  const [offers, setOffers] = useState([]);
  const [cards, setCards] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [offerResponse, cardResponse, storeResponse, categoryResponse] = await Promise.all([
      api.get("/admin/card-offers"),
      api.get("/admin/card-catalogue"),
      api.get("/admin/stores"),
      api.get("/admin/categories"),
    ]);
    setOffers(offerResponse.data);
    setCards(cardResponse.data);
    setStores(storeResponse.data);
    setCategories(categoryResponse.data);
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(formatApiErrorDetail(error.response?.data?.detail)));
  }, [load]);

  const cardOptions = useMemo(() => cards.map((card) => ({
    value: card.id, label: `${card.bank_name} · ${card.card_name}`,
  })), [cards]);
  const storeOptions = useMemo(() => stores.map((store) => ({ value: store.id, label: store.name })), [stores]);
  const categoryOptions = useMemo(() => [
    { value: "", label: "All categories" },
    ...categories.filter((category) => category.name !== "All").map((category) => ({ value: category.id, label: category.name })),
  ], [categories]);

  const openNew = () => {
    setForm({ ...emptyForm, stackability: { ...blankStackability } });
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (offer) => {
    setForm({
      ...emptyForm,
      ...offer,
      category_id: offer.category_id || "",
      minimum_order_value: offer.minimum_order_value || "",
      maximum_discount_amount: offer.maximum_discount_amount || "",
      maximum_eligible_amount: offer.maximum_eligible_amount || "",
      eligibility_notes: offer.eligibility_notes || "",
      valid_from: offer.valid_from || "",
      valid_until: offer.valid_until || "",
      notes: offer.notes || "",
      card_offer_url: offer.card_offer_url || "",
      promotion_headline: offer.promotion_headline || "",
      promotion_description: offer.promotion_description || "",
      promotion_cta_label: offer.promotion_cta_label || "",
      stackability: { ...blankStackability, ...(offer.stackability || {}) },
    });
    setEditId(offer.id);
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...form };
      ["category_id", "minimum_order_value", "maximum_discount_amount", "maximum_eligible_amount",
        "eligibility_notes", "valid_from", "valid_until", "notes", "card_offer_url",
        "promotion_headline", "promotion_description", "promotion_cta_label"].forEach((field) => {
        if (payload[field] === "") payload[field] = null;
      });
      if (editId) await api.put(`/admin/card-offers/${editId}`, payload);
      else await api.post("/admin/card-offers", payload);
      toast.success(editId ? "Card offer updated" : "Card offer created");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (offer) => {
    try {
      await api.post(`/admin/card-offers/${offer.id}/activate`, { active: !offer.active });
      await load();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  };

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const setStack = (field, value) => setForm((current) => ({
    ...current, stackability: { ...current.stackability, [field]: value },
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-600 text-ink">Card Offers</h1>
          <p className="text-sm text-ink-muted">Manage independent card benefits without changing the current savings engine.</p>
        </div>
        <button type="button" onClick={openNew} data-testid="card-offer-add"
          className="btn-gold inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-700">
          <Plus className="h-4 w-4" /> New offer
        </button>
      </div>

      <div className="surface overflow-x-auto rounded-xl">
        <table className="w-full min-w-[940px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-ink-muted">
            <tr>
              <th className="p-3">Card</th><th className="p-3">Store</th><th className="p-3">Offer</th>
              <th className="p-3">Discount / Limits</th><th className="p-3">Validity</th>
              <th className="p-3">Priority</th><th className="p-3">Status</th><th className="p-3 text-right">Edit</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id} className="border-t border-border align-top" data-testid={`card-offer-row-${offer.id}`}>
                <td className="p-3"><p className="font-600 text-ink">{offer.card_name}</p><p className="text-xs text-ink-muted">{offer.bank_name}</p></td>
                <td className="p-3"><p className="text-ink">{offer.store_name}</p><p className="text-xs text-ink-muted">{offer.category_name}</p></td>
                <td className="p-3"><p className="font-600 text-ink">{offer.offer_name}</p><p className="text-xs text-ink-muted">{labelize(offer.offer_type)} · {labelize(offer.payment_method)}</p></td>
                <td className="p-3"><p className="font-600 text-savings">{discount(offer)}</p><p className="text-xs text-ink-muted">Min {money(offer.minimum_order_value)} · Max discount {money(offer.maximum_discount_amount)}</p></td>
                <td className="whitespace-nowrap p-3 text-xs text-ink-muted"><p>{offer.valid_from || "No start"}</p><p>to {offer.valid_until || "No end"}</p></td>
                <td className="p-3 text-ink-muted">{offer.priority}</td>
                <td className="p-3"><Switch checked={offer.active} onCheckedChange={() => toggle(offer)} data-testid={`card-offer-toggle-${offer.id}`} /></td>
                <td className="p-3 text-right"><button type="button" onClick={() => openEdit(offer)} aria-label={`Edit ${offer.offer_name}`}
                  className="text-ink-muted hover:text-gold"><Pencil className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {!offers.length && <tr><td colSpan={8} className="p-8 text-center text-ink-muted">No card offers yet. Create the first verified offer when ready.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{editId ? "Edit card offer" : "New card offer"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Card" full><Combobox options={cardOptions} value={form.card_id} onChange={(value) => set("card_id", value)} placeholder="Choose catalogue card" testid="card-offer-card" /></F>
            <F label="Store" full><Combobox options={storeOptions} value={form.store_id} onChange={(value) => set("store_id", value)} placeholder="Choose store" testid="card-offer-store" /></F>
            <F label="Offer name" full><input value={form.offer_name} onChange={(event) => set("offer_name", event.target.value)} className="offer-input" data-testid="card-offer-name" /></F>
            <F label="Offer type"><select value={form.offer_type} onChange={(event) => set("offer_type", event.target.value)} className="offer-input"><option value="instant_discount">Instant discount</option><option value="cashback">Cashback</option><option value="reward">Reward</option><option value="other">Other</option></select></F>
            <F label="Payment method"><select value={form.payment_method} onChange={(event) => set("payment_method", event.target.value)} className="offer-input"><option value="both">Credit or debit</option><option value="credit">Credit</option><option value="debit">Debit</option></select></F>
            <F label="Discount type"><select value={form.discount_type} onChange={(event) => set("discount_type", event.target.value)} className="offer-input"><option value="percentage">Percentage</option><option value="flat">Flat amount</option></select></F>
            <F label="Discount value"><input type="number" min="0" step="0.01" value={form.discount_value} onChange={(event) => set("discount_value", event.target.value)} className="offer-input" data-testid="card-offer-value" /></F>
            <F label="Minimum order value"><input type="number" min="0" step="0.01" value={form.minimum_order_value} onChange={(event) => set("minimum_order_value", event.target.value)} className="offer-input" /></F>
            <F label="Maximum discount"><input type="number" min="0" step="0.01" value={form.maximum_discount_amount} onChange={(event) => set("maximum_discount_amount", event.target.value)} className="offer-input" /></F>
            <F label="Maximum eligible amount"><input type="number" min="0" step="0.01" value={form.maximum_eligible_amount} onChange={(event) => set("maximum_eligible_amount", event.target.value)} className="offer-input" /></F>
            <F label="Priority"><input type="number" min="0" value={form.priority} onChange={(event) => set("priority", Number(event.target.value))} className="offer-input" /></F>
            <F label="Customer type"><select value={form.customer_type} onChange={(event) => set("customer_type", event.target.value)} className="offer-input"><option value="both">All customers</option><option value="existing">Existing customers</option><option value="new">New customers</option></select></F>
            <F label="Category" full><Combobox options={categoryOptions} value={form.category_id} onChange={(value) => set("category_id", value)} placeholder="All categories" testid="card-offer-category" /></F>
            <F label="Valid from"><input type="date" value={form.valid_from} onChange={(event) => set("valid_from", event.target.value)} className="offer-input" /></F>
            <F label="Valid until"><input type="date" value={form.valid_until} onChange={(event) => set("valid_until", event.target.value)} className="offer-input" /></F>
            <F label="Eligibility notes" full><textarea value={form.eligibility_notes} onChange={(event) => set("eligibility_notes", event.target.value)} rows={2} className="offer-area" /></F>

            <fieldset className="rounded-xl border border-border p-4 sm:col-span-2">
              <legend className="px-1 text-xs font-600 uppercase tracking-wide text-ink-muted">Can stack with</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["affiliate", "Affiliate"], ["gift_card", "Gift card"], ["coupon", "Coupon"], ["other_card", "Other card"]].map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={form.stackability[field]} onChange={(event) => setStack(field, event.target.checked)} className="accent-[var(--gold)]" /> {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <F label="Card offer URL" full><input type="url" value={form.card_offer_url} onChange={(event) => set("card_offer_url", event.target.value)} className="offer-input" placeholder="https://…" /></F>
            <F label="Promotion headline" full><input value={form.promotion_headline} onChange={(event) => set("promotion_headline", event.target.value)} className="offer-input" /></F>
            <F label="Promotion description" full><textarea value={form.promotion_description} onChange={(event) => set("promotion_description", event.target.value)} rows={2} className="offer-area" /></F>
            <F label="Promotion CTA label"><input value={form.promotion_cta_label} onChange={(event) => set("promotion_cta_label", event.target.value)} className="offer-input" /></F>
            <F label="Active"><div className="flex h-11 items-center"><Switch checked={form.active} onCheckedChange={(value) => set("active", value)} /></div></F>
            <F label="Internal notes" full><textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} rows={3} className="offer-area" /></F>
          </div>
          <DialogFooter>
            <button type="button" onClick={save} disabled={busy || !form.card_id || !form.store_id || !form.offer_name || form.discount_value === ""}
              data-testid="card-offer-save" className="btn-gold rounded-full px-5 py-2 text-sm font-700 disabled:opacity-60">
              {busy ? "Saving…" : "Save offer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <style>{`.offer-input{height:2.75rem;width:100%;border:1px solid hsl(var(--border));background:hsl(var(--input));border-radius:.5rem;padding:0 .75rem;font-size:.875rem;color:hsl(var(--foreground))}.offer-area{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--input));border-radius:.5rem;padding:.65rem .75rem;font-size:.875rem;color:hsl(var(--foreground))}`}</style>
    </div>
  );
}

function F({ label, full = false, children }) {
  return <div className={full ? "sm:col-span-2" : ""}><label className="mb-1 block text-xs font-600 uppercase tracking-wide text-ink-muted">{label}</label>{children}</div>;
}
