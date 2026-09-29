import React, { useCallback, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useMeta } from "@/lib/useMeta";

const CARD_TYPES = ["Credit", "Debit"];
const CARD_NETWORKS = ["Visa", "Mastercard", "RuPay", "American Express", "Other"];
const emptyForm = { bank_name: "", card_name: "", card_type: "Credit", card_network: "Visa" };

export default function CardCatalogue() {
  useMeta("Card Catalogue · Console", "");
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get("/admin/card-catalogue");
    setCards(data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(emptyForm); setEditId(null); setOpen(true); };
  const openEdit = (c) => {
    setForm({ bank_name: c.bank_name, card_name: c.card_name, card_type: c.card_type, card_network: c.card_network });
    setEditId(c.id); setOpen(true);
  };
  const save = async () => {
    try {
      if (editId) await api.put(`/admin/card-catalogue/${editId}`, form);
      else await api.post("/admin/card-catalogue", form);
      toast.success("Catalogue card saved"); setOpen(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const toggle = async (c) => {
    await api.post(`/admin/card-catalogue/${c.id}/activate`, { active: !c.active });
    load();
  };

  const q = search.trim().toLowerCase();
  const visible = q
    ? cards.filter((c) => c.card_name.toLowerCase().includes(q) || c.bank_name.toLowerCase().includes(q))
    : cards;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-600 text-ink">Card Catalogue</h1>
          <p className="text-sm text-ink-muted">Curated card products shoppers can pick from. Identity only — no offers or card numbers.</p>
        </div>
        <button onClick={openNew} data-testid="catalogue-add" className="btn-gold inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-700"><Plus className="h-4 w-4" /> New card</button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter catalogue…"
          data-testid="catalogue-filter"
          className="h-11 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm text-foreground" />
      </div>

      <div className="surface overflow-x-auto rounded-xl">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-ink-muted">
            <tr><th className="p-3">Card</th><th className="p-3">Bank</th><th className="p-3">Type</th><th className="p-3">Network</th><th className="p-3">Active</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id} className="border-t border-border" data-testid={`catalogue-row-${c.id}`}>
                <td className="p-3 text-ink">{c.card_name}</td>
                <td className="p-3 text-ink-muted">{c.bank_name}</td>
                <td className="p-3 text-ink-muted">{c.card_type}</td>
                <td className="p-3 text-ink-muted">{c.card_network}</td>
                <td className="p-3"><Switch checked={c.active} onCheckedChange={() => toggle(c)} data-testid={`catalogue-toggle-${c.id}`} /></td>
                <td className="p-3">
                  <div className="flex justify-end">
                    <button onClick={() => openEdit(c)} data-testid={`catalogue-edit-${c.id}`} className="text-ink-muted hover:text-gold"><Pencil className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!visible.length && <tr><td colSpan={6} className="p-6 text-center text-ink-muted">No catalogue cards match.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit catalogue card" : "New catalogue card"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="mb-1 block text-xs font-600 uppercase tracking-wide text-ink-muted">Bank name *</label>
              <input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} data-testid="catalogue-bank" className="in" placeholder="e.g. SBI" /></div>
            <div><label className="mb-1 block text-xs font-600 uppercase tracking-wide text-ink-muted">Card product name *</label>
              <input value={form.card_name} onChange={(e) => setForm({ ...form, card_name: e.target.value })} data-testid="catalogue-name" className="in" placeholder="e.g. SBI Cashback Credit Card" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-xs font-600 uppercase tracking-wide text-ink-muted">Type *</label>
                <select value={form.card_type} onChange={(e) => setForm({ ...form, card_type: e.target.value })} data-testid="catalogue-type" className="in">
                  {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-600 uppercase tracking-wide text-ink-muted">Network *</label>
                <select value={form.card_network} onChange={(e) => setForm({ ...form, card_network: e.target.value })} data-testid="catalogue-network" className="in">
                  {CARD_NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
            </div>
            <p className="text-xs text-ink-muted">Use network “Other” when the exact network varies or is uncertain. Never store card numbers, CVV, expiry or PINs.</p>
          </div>
          <DialogFooter><button onClick={save} data-testid="catalogue-save" className="btn-gold rounded-full px-5 py-2 text-sm font-700">Save card</button></DialogFooter>
        </DialogContent>
      </Dialog>
      <style>{`.in{height:2.75rem;width:100%;border:1px solid hsl(var(--border));background:hsl(var(--input));border-radius:.5rem;padding:0 .75rem;font-size:.875rem;color:hsl(var(--foreground))}`}</style>
    </div>
  );
}
