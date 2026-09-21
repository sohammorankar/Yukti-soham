import React, { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Archive, RotateCcw, Settings2, Globe, X, ChevronDown } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { useMeta } from "@/lib/useMeta";

const empty = { name: "", stacking: "unsure", split_payment_supported: "unsure", stacking_note: "" };

export default function Stores() {
  useMeta("Stores · Console", "");
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = () => api.get("/admin/stores").then(({ data }) => setRows(data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    try {
      if (editId) await api.put(`/admin/stores/${editId}`, form);
      else await api.post("/admin/stores", form);
      toast.success("Saved"); setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const archive = async (id) => { await api.delete(`/admin/stores/${id}`); toast.success("Archived"); load(); };
  const restore = async (id) => { await api.post(`/admin/stores/${id}/restore`); toast.success("Restored"); load(); };
  const edit = (r) => { setForm({ name: r.name, stacking: r.stacking, split_payment_supported: r.split_payment_supported, stacking_note: r.stacking_note || "" }); setEditId(r.id); setOpen(true); };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-600 text-ink">Stores &amp; Domains</h1>
          <p className="text-sm text-ink-muted">Manage stores, stacking / split-payment policy, and domain aliases for URL detection.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditId(null); } }}>
          <DialogTrigger asChild>
            <button className="btn-gold focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-700" data-testid="store-add">
              <Plus className="h-4 w-4" /> Add store
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit store & settings" : "Add store"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="store-name" className="in" /></Field>
              <Field label="Stacking policy" help="allowed = combine both routes · not_allowed = better single route · unsure = warn">
                <select value={form.stacking} onChange={(e) => setForm({ ...form, stacking: e.target.value })} data-testid="store-stacking" className="in">
                  <option value="allowed">allowed</option><option value="not_allowed">not_allowed</option><option value="unsure">unsure</option>
                </select>
              </Field>
              <Field label="Split payment supported" help="Whether a capped gift card + other payment is accepted">
                <select value={form.split_payment_supported} onChange={(e) => setForm({ ...form, split_payment_supported: e.target.value })} data-testid="store-split" className="in">
                  <option value="yes">yes</option><option value="no">no</option><option value="unsure">unsure</option>
                </select>
              </Field>
              <Field label="Shopper-facing note (optional)">
                <textarea value={form.stacking_note} onChange={(e) => setForm({ ...form, stacking_note: e.target.value })} rows={2} className="in" style={{ height: "auto", padding: ".5rem .75rem" }} />
              </Field>
            </div>
            <DialogFooter>
              <button onClick={save} data-testid="store-save" className="btn-gold rounded-full px-5 py-2 text-sm font-700">Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="surface rounded-xl" data-testid={`store-row-${r.id}`}>
            <div className="flex items-center gap-3 p-3">
              <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-ink-muted">
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded === r.id ? "rotate-180" : ""}`} />
              </button>
              <span className="font-600 text-ink">{r.name}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-ink-muted">stack: {r.stacking}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-ink-muted">split: {r.split_payment_supported}</span>
              {r.archived_at && <span className="text-xs text-ink-muted">Archived</span>}
              <div className="ml-auto flex gap-2">
                <button onClick={() => edit(r)} className="text-ink-muted hover:text-gold"><Settings2 className="h-4 w-4" /></button>
                {r.archived_at
                  ? <button onClick={() => restore(r.id)} className="text-ink-muted hover:text-savings"><RotateCcw className="h-4 w-4" /></button>
                  : <button onClick={() => archive(r.id)} data-testid={`store-archive-${r.id}`} className="text-ink-muted hover:text-destructive"><Archive className="h-4 w-4" /></button>}
              </div>
            </div>
            {expanded === r.id && <DomainPanel store={r} />}
          </div>
        ))}
      </div>
      <style>{`.in{height:2.75rem;width:100%;border:1px solid hsl(var(--border));background:hsl(var(--input));border-radius:.5rem;padding:0 .75rem;font-size:.875rem;color:hsl(var(--foreground))}`}</style>
    </div>
  );
}

function DomainPanel({ store }) {
  const [domains, setDomains] = useState([]);
  const [val, setVal] = useState("");
  const load = () => api.get(`/admin/stores/${store.id}/domains`).then(({ data }) => setDomains(data));
  useEffect(() => { load(); }, [store.id]);
  const add = async () => {
    if (!val.trim()) return;
    try { await api.post(`/admin/stores/${store.id}/domains`, { domain_or_alias: val }); setVal(""); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const del = async (id) => { await api.delete(`/admin/domains/${id}`); load(); };
  return (
    <div className="border-t border-border p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs uppercase text-ink-muted"><Globe className="h-3.5 w-3.5" /> Domain aliases</div>
      <div className="flex flex-wrap gap-2">
        {domains.map((d) => (
          <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink">
            {d.domain_or_alias}
            <button onClick={() => del(d.id)} className="text-ink-muted hover:text-destructive"><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. amazon.in"
          data-testid={`domain-input-${store.id}`}
          className="h-9 flex-1 rounded-md border border-border bg-input px-3 text-sm text-foreground" />
        <button onClick={add} data-testid={`domain-add-${store.id}`} className="rounded-md border border-gold/40 px-3 text-sm text-gold hover:bg-gold/10">Add</button>
      </div>
    </div>
  );
}

function Field({ label, help, children }) {
  return (<div><label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">{label}</label>{children}{help && <p className="mt-1 text-[11px] text-ink-muted">{help}</p>}</div>);
}
