import React, { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Archive, RotateCcw, Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { useMeta } from "@/lib/useMeta";

const empty = { name: "", kind: "affiliate", website_url: "" };

export default function Platforms() {
  useMeta("Platforms · Console", "");
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/admin/platforms").then(({ data }) => setRows(data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    try {
      if (editId) await api.put(`/admin/platforms/${editId}`, form);
      else await api.post("/admin/platforms", form);
      toast.success("Saved"); setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const archive = async (id) => { await api.delete(`/admin/platforms/${id}`); toast.success("Archived"); load(); };
  const restore = async (id) => { await api.post(`/admin/platforms/${id}/restore`); toast.success("Restored"); load(); };
  const edit = (r) => { setForm({ name: r.name, kind: r.kind, website_url: r.website_url || "" }); setEditId(r.id); setOpen(true); };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-600 text-ink">Platforms</h1>
          <p className="text-sm text-ink-muted">Affiliate and gift-card platforms available to rates.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditId(null); } }}>
          <DialogTrigger asChild>
            <button className="btn-gold focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-700" data-testid="platform-add">
              <Plus className="h-4 w-4" /> Add platform
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} platform</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="platform-name" className="in" /></Field>
              <Field label="Kind">
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} data-testid="platform-kind" className="in">
                  <option value="affiliate">Affiliate</option>
                  <option value="gift_card">Gift card</option>
                </select>
              </Field>
              <Field label="Website (optional)"><input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} className="in" /></Field>
            </div>
            <DialogFooter>
              <button onClick={save} data-testid="platform-save" className="btn-gold rounded-full px-5 py-2 text-sm font-700">Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-ink-muted">
            <tr><th className="p-3">Name</th><th className="p-3">Kind</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border" data-testid={`platform-row-${r.id}`}>
                <td className="p-3 text-ink">{r.name}</td>
                <td className="p-3 text-ink-muted">{r.kind === "affiliate" ? "Affiliate" : "Gift card"}</td>
                <td className="p-3">{r.archived_at ? <span className="text-ink-muted">Archived</span> : <span className="text-savings">Active</span>}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => edit(r)} className="text-ink-muted hover:text-gold"><Pencil className="h-4 w-4" /></button>
                    {r.archived_at
                      ? <button onClick={() => restore(r.id)} data-testid={`platform-restore-${r.id}`} className="text-ink-muted hover:text-savings"><RotateCcw className="h-4 w-4" /></button>
                      : <button onClick={() => archive(r.id)} data-testid={`platform-archive-${r.id}`} className="text-ink-muted hover:text-destructive"><Archive className="h-4 w-4" /></button>}
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
