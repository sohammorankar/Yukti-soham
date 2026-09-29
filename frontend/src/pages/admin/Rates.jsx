import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Archive, Copy, Pencil } from "lucide-react";
import { Combobox } from "@/components/Combobox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useMeta } from "@/lib/useMeta";
import { rateLabel } from "@/lib/format";

const emptyForm = {
  platform_id: "", store_id: "", category_id: "", customer_type: "both",
  value_type: "percent", value: "", minimum_order_value: "", maximum_eligible_amount: "",
  valid_from: "", valid_until: "", priority: 0, notes: "", status: "published", active: true,
  card_eligibility: "no_card_requirement", card_bank: "", card_type: "", card_network: "",
};

const CARD_MODES = [
  ["no_card_requirement", "No card requirement"],
  ["any_card", "Any saved card"],
  ["specific_card", "Specific card"],
  ["bank", "Specific bank"],
  ["network", "Card network"],
];
const CARD_NETWORKS = ["Visa", "Mastercard", "RuPay", "American Express", "Other"];

export default function Rates() {
  useMeta("Rate Editor · Console", "");
  const [platforms, setPlatforms] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rates, setRates] = useState([]);
  const [filters, setFilters] = useState({ store_id: "", platform_id: "", customer_type: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const loadRefs = async () => {
    const [p, s, c] = await Promise.all([api.get("/admin/platforms"), api.get("/admin/stores"), api.get("/admin/categories")]);
    setPlatforms(p.data); setStores(s.data); setCategories(c.data);
  };
  const loadRates = async () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const { data } = await api.get("/admin/rates", { params });
    setRates(data);
  };
  useEffect(() => { loadRefs(); }, []);
  useEffect(() => { loadRates(); /* eslint-disable-next-line */ }, [filters]);

  const platOptions = useMemo(() => [{ value: "", label: "All platforms" }, ...platforms.map((p) => ({ value: p.id, label: `${p.name} (${p.kind === "affiliate" ? "Aff" : "GC"})` }))], [platforms]);
  const storeOptions = useMemo(() => [{ value: "", label: "All stores" }, ...stores.map((s) => ({ value: s.id, label: s.name }))], [stores]);
  const catOptions = useMemo(() => categories.map((c) => ({ value: c.id, label: c.name })), [categories]);

  const openNew = () => { setForm({ ...emptyForm, category_id: categories.find((c) => c.name === "All")?.id || "" }); setEditId(null); setOpen(true); };
  const openEdit = (r) => {
    const crit = r.card_criteria || {};
    setForm({ ...emptyForm, ...r, minimum_order_value: r.minimum_order_value || "", maximum_eligible_amount: r.maximum_eligible_amount || "", valid_from: r.valid_from || "", valid_until: r.valid_until || "", notes: r.notes || "",
      card_eligibility: r.card_eligibility || "no_card_requirement",
      card_bank: crit.bank_name || "", card_type: crit.card_type || "", card_network: crit.card_network || "" });
    setEditId(r.id); setOpen(true);
  };
  const save = async () => {
    try {
      const payload = { ...form };
      // Build the backend card_criteria object from the flat admin fields.
      if (payload.card_eligibility === "no_card_requirement" || payload.card_eligibility === "any_card") {
        payload.card_criteria = null;
      } else {
        payload.card_criteria = {};
        if (payload.card_bank.trim()) payload.card_criteria.bank_name = payload.card_bank.trim();
        if (payload.card_eligibility === "specific_card") {
          if (payload.card_type) payload.card_criteria.card_type = payload.card_type;
          if (payload.card_network) payload.card_criteria.card_network = payload.card_network;
          if (payload.card_bank.trim()) payload.card_criteria.label = payload.card_bank.trim();
        } else if (payload.card_eligibility === "network") {
          payload.card_criteria = payload.card_network ? { card_network: payload.card_network } : {};
        }
      }
      delete payload.card_bank; delete payload.card_type; delete payload.card_network;
      if (editId) await api.put(`/admin/rates/${editId}`, payload);
      else await api.post("/admin/rates", payload);
      toast.success("Rate saved"); setOpen(false); loadRates();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const toggle = async (r) => { await api.post(`/admin/rates/${r.id}/activate`, { active: !r.active }); loadRates(); };
  const archive = async (r) => { await api.delete(`/admin/rates/${r.id}`); toast.success("Archived"); loadRates(); };
  const duplicate = async (r) => { await api.post(`/admin/rates/${r.id}/duplicate`); toast.success("Duplicated as draft"); loadRates(); };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-600 text-ink">Rate Editor</h1>
          <p className="text-sm text-ink-muted">Create and manage individual rate cards.</p>
        </div>
        <button onClick={openNew} data-testid="rate-add" className="btn-gold inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-700"><Plus className="h-4 w-4" /> New rate</button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Combobox options={platOptions} value={filters.platform_id} onChange={(v) => setFilters({ ...filters, platform_id: v })} placeholder="Filter platform" testid="filter-platform" />
        <Combobox options={storeOptions} value={filters.store_id} onChange={(v) => setFilters({ ...filters, store_id: v })} placeholder="Filter store" testid="filter-store" />
        <select value={filters.customer_type} onChange={(e) => setFilters({ ...filters, customer_type: e.target.value })}
          className="h-11 rounded-md border border-border bg-input px-3 text-sm text-foreground">
          <option value="">All customer types</option><option value="existing">Existing</option><option value="new">New</option><option value="both">Both</option>
        </select>
      </div>

      <div className="surface overflow-x-auto rounded-xl">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-ink-muted">
            <tr>
              <th className="p-3">Platform</th><th className="p-3">Store</th><th className="p-3">Category</th>
              <th className="p-3">Cust.</th><th className="p-3">Rate</th><th className="p-3">MOV</th><th className="p-3">Cap</th>
              <th className="p-3">Status</th><th className="p-3">Active</th><th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className="border-t border-border" data-testid={`rate-row-${r.id}`}>
                <td className="p-3 text-ink">{r.platform_name}</td>
                <td className="p-3 text-ink-muted">{r.store_name}</td>
                <td className="p-3 text-ink-muted">{r.category_name}</td>
                <td className="p-3 text-ink-muted">{r.customer_type}</td>
                <td className="p-3 savings-text font-600">{rateLabel(r.value_type, r.value)}
                  {r.card_eligibility && r.card_eligibility !== "no_card_requirement" && (
                    <span className="ml-1 rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-gold" data-testid={`rate-card-badge-${r.id}`}>card</span>
                  )}</td>
                <td className="p-3 text-ink-muted">{r.minimum_order_value ? `₹${r.minimum_order_value}` : "—"}</td>
                <td className="p-3 text-ink-muted">{r.maximum_eligible_amount ? `₹${r.maximum_eligible_amount}` : "—"}</td>
                <td className="p-3"><span className={`text-xs ${r.status === "published" ? "text-savings" : "text-amber-400"}`}>{r.status}</span></td>
                <td className="p-3"><Switch checked={r.active} onCheckedChange={() => toggle(r)} data-testid={`rate-toggle-${r.id}`} /></td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(r)} className="text-ink-muted hover:text-gold"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => duplicate(r)} className="text-ink-muted hover:text-gold"><Copy className="h-4 w-4" /></button>
                    <button onClick={() => archive(r)} data-testid={`rate-archive-${r.id}`} className="text-ink-muted hover:text-destructive"><Archive className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!rates.length && <tr><td colSpan={10} className="p-6 text-center text-ink-muted">No rates for these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit rate" : "New rate"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {!editId && <>
              <F label="Platform" full><Combobox options={platforms.map((p) => ({ value: p.id, label: `${p.name} (${p.kind === "affiliate" ? "Affiliate" : "Gift card"})` }))} value={form.platform_id} onChange={(v) => setForm({ ...form, platform_id: v })} placeholder="Choose platform" testid="rate-platform" /></F>
              <F label="Store" full><Combobox options={stores.map((s) => ({ value: s.id, label: s.name }))} value={form.store_id} onChange={(v) => setForm({ ...form, store_id: v })} placeholder="Choose store" testid="rate-store" /></F>
              <F label="Category" full><Combobox options={catOptions} value={form.category_id} onChange={(v) => setForm({ ...form, category_id: v })} placeholder="Choose category (default All)" testid="rate-category" /></F>
            </>}
            <F label="Customer type"><select value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value })} data-testid="rate-customer-type" className="in"><option value="both">Both</option><option value="existing">Existing</option><option value="new">New</option></select></F>
            <F label="Value type"><select value={form.value_type} onChange={(e) => setForm({ ...form, value_type: e.target.value })} data-testid="rate-value-type" className="in"><option value="percent">Percent %</option><option value="flat_amount">Flat ₹</option></select></F>
            <F label="Value"><input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} data-testid="rate-value" className="in" /></F>
            <F label="Priority"><input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="in" /></F>
            <F label="Min order value (₹)"><input type="number" value={form.minimum_order_value} onChange={(e) => setForm({ ...form, minimum_order_value: e.target.value })} className="in" /></F>
            <F label="Cap / max eligible (₹)"><input type="number" value={form.maximum_eligible_amount} onChange={(e) => setForm({ ...form, maximum_eligible_amount: e.target.value })} className="in" /></F>
            <F label="Valid from"><input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className="in" /></F>
            <F label="Valid until"><input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="in" /></F>
            <F label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="in"><option value="published">Published</option><option value="draft">Draft</option></select></F>
            <F label="Card eligibility" full>
              <select value={form.card_eligibility} onChange={(e) => setForm({ ...form, card_eligibility: e.target.value })} data-testid="rate-card-eligibility" className="in">
                {CARD_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </F>
            {(form.card_eligibility === "specific_card" || form.card_eligibility === "bank") && (
              <F label="Bank name" full><input value={form.card_bank} onChange={(e) => setForm({ ...form, card_bank: e.target.value })} data-testid="rate-card-bank" placeholder="e.g. SBI" className="in" /></F>
            )}
            {form.card_eligibility === "specific_card" && (
              <F label="Card type"><select value={form.card_type} onChange={(e) => setForm({ ...form, card_type: e.target.value })} data-testid="rate-card-type" className="in"><option value="">Any type</option><option value="Credit">Credit</option><option value="Debit">Debit</option></select></F>
            )}
            {(form.card_eligibility === "specific_card" || form.card_eligibility === "network") && (
              <F label="Card network"><select value={form.card_network} onChange={(e) => setForm({ ...form, card_network: e.target.value })} data-testid="rate-card-network" className="in"><option value="">Any network</option>{CARD_NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}</select></F>
            )}
            <F label="Notes" full><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="in" /></F>
          </div>
          <DialogFooter><button onClick={save} data-testid="rate-save" className="btn-gold rounded-full px-5 py-2 text-sm font-700">Save rate</button></DialogFooter>
        </DialogContent>
      </Dialog>
      <style>{`.in{height:2.75rem;width:100%;border:1px solid hsl(var(--border));background:hsl(var(--input));border-radius:.5rem;padding:0 .75rem;font-size:.875rem;color:hsl(var(--foreground))}`}</style>
    </div>
  );
}

function F({ label, full, children }) {
  return (<div className={full ? "col-span-2" : ""}><label className="mb-1 block text-xs font-600 uppercase tracking-wide text-ink-muted">{label}</label>{children}</div>);
}
