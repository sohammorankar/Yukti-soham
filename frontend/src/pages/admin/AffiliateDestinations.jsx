import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Power, PowerOff, Link2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { useMeta } from "@/lib/useMeta";

const empty = { store_id: "", platform_id: "", destination_url: "", active: true };

export default function AffiliateDestinations() {
  useMeta("Partner Destinations · Console", "");
  const [rows, setRows] = useState([]);
  const [stores, setStores] = useState([]);
  const [partners, setPartners] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/admin/affiliate-destinations").then(({ data }) => setRows(data));

  useEffect(() => {
    load();
    api.get("/admin/stores").then(({ data }) => setStores(data.filter((s) => !s.archived_at)));
    api.get("/admin/platforms").then(({ data }) =>
      setPartners(data.filter((p) => ["affiliate", "gift_card"].includes(p.kind) && !p.archived_at)));
  }, []);

  const kindLabel = (k) => (k === "gift_card" ? "Gift Card" : k === "affiliate" ? "Affiliate" : k || "—");
  // Sort partners by type then name so both affiliate and gift-card options are easy to find.
  const sortedPartners = useMemo(
    () => [...partners].sort((a, b) => (a.kind || "").localeCompare(b.kind || "") || (a.name || "").localeCompare(b.name || "")),
    [partners]);

  const save = async () => {
    if (!editId && (!form.store_id || !form.platform_id)) { toast.error("Choose store and affiliate partner"); return; }
    if (!form.destination_url.trim()) { toast.error("Destination URL required"); return; }
    try {
      if (editId) {
        await api.put(`/admin/affiliate-destinations/${editId}`, {
          destination_url: form.destination_url, active: form.active,
        });
      } else {
        await api.post("/admin/affiliate-destinations", form);
      }
      toast.success("Saved"); setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const toggle = async (r) => {
    try {
      await api.put(`/admin/affiliate-destinations/${r.id}`, { active: !r.active });
      toast.success(r.active ? "Deactivated" : "Activated"); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this mapping? The combination will revert to the generic partner link.")) return;
    try { await api.delete(`/admin/affiliate-destinations/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const edit = (r) => {
    setForm({ store_id: r.store_id, platform_id: r.platform_id, destination_url: r.destination_url, active: r.active });
    setEditId(r.id); setOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl" data-testid="admin-affiliate-destinations">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-600 text-ink">
            <Link2 className="h-6 w-6 text-gold" /> Partner Destinations
          </h1>
          <p className="text-sm text-ink-muted">
            Trusted deep-link destinations for a specific Store × Partner combination (affiliate or gift-card).
            When active, the YuktiMagic bridge routes to this URL; otherwise it falls back to the partner's generic link.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditId(null); } }}>
          <DialogTrigger asChild>
            <button className="btn-gold focus-ring inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-700" data-testid="dest-add">
              <Plus className="h-4 w-4" /> Add mapping
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} destination mapping</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label="Store">
                <select value={form.store_id} disabled={!!editId}
                  onChange={(e) => setForm({ ...form, store_id: e.target.value })}
                  data-testid="dest-store" className="in disabled:opacity-60">
                  <option value="">Select store…</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Partner">
                <select value={form.platform_id} disabled={!!editId}
                  onChange={(e) => setForm({ ...form, platform_id: e.target.value })}
                  data-testid="dest-partner" className="in disabled:opacity-60">
                  <option value="">Select partner…</option>
                  {sortedPartners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {kindLabel(p.kind)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Destination URL (https)">
                <input value={form.destination_url}
                  onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
                  placeholder="https://…" data-testid="dest-url" className="in" />
              </Field>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  data-testid="dest-active" className="h-4 w-4 accent-[var(--gold,#d4af37)]" />
                Active
              </label>
              {editId && (
                <p className="text-xs text-ink-muted">Store &amp; partner can't be changed — delete and recreate to re-target.</p>
              )}
            </div>
            <DialogFooter>
              <button onClick={save} data-testid="dest-save" className="btn-gold rounded-full px-5 py-2 text-sm font-700">Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-ink-muted">
            <tr>
              <th className="p-3">Store</th><th className="p-3">Partner Type</th><th className="p-3">Partner</th>
              <th className="p-3">Destination</th><th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-ink-muted">No mappings yet. Add one to override a Store × Partner link.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border" data-testid={`dest-row-${r.id}`}>
                <td className="p-3 text-ink">{r.store_name || r.store_id}</td>
                <td className="p-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${r.partner_kind === "gift_card" ? "border-gold/40 text-gold" : "border-border text-ink-muted"}`}
                    data-testid={`dest-kind-${r.id}`}>{kindLabel(r.partner_kind)}</span>
                </td>
                <td className="p-3 text-ink-muted">{r.partner_name || r.platform_id}</td>
                <td className="max-w-[240px] truncate p-3 text-ink-muted" title={r.destination_url}>{r.destination_url}</td>
                <td className="p-3">
                  {r.active
                    ? <span className="text-savings" data-testid={`dest-status-${r.id}`}>Active</span>
                    : <span className="text-ink-muted" data-testid={`dest-status-${r.id}`}>Inactive</span>}
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => toggle(r)} data-testid={`dest-toggle-${r.id}`}
                      className={`hover:text-gold ${r.active ? "text-savings" : "text-ink-muted"}`}
                      title={r.active ? "Deactivate" : "Activate"}>
                      {r.active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => edit(r)} data-testid={`dest-edit-${r.id}`} className="text-ink-muted hover:text-gold"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(r.id)} data-testid={`dest-delete-${r.id}`} className="text-ink-muted hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`.in{height:2.75rem;width:100%;border:1px solid hsl(var(--border));background:hsl(var(--input));border-radius:.5rem;padding:0 .75rem;font-size:.875rem;color:hsl(var(--foreground))}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (<div><label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">{label}</label>{children}</div>);
}
