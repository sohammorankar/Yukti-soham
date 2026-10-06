import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useMeta } from "@/lib/useMeta";

const EMPTY = {
  title: "", subtitle: "", desktop_image: "", mobile_image: "", store_id: "",
  destination_url: "", cta_text: "Shop store", display_rank: 0,
  active: false, featured: false, start_date: "", end_date: "",
};
const inputClass = "h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-ink";

export default function HomepagePromotions() {
  useMeta("Homepage promotions · Console", "");
  const [rows, setRows] = useState([]);
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [promotions, storeList] = await Promise.all([
        api.get("/admin/homepage/promotions"), api.get("/admin/stores"),
      ]);
      setRows(promotions.data);
      setStores(storeList.data);
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const reset = () => { setEditing(null); setForm(EMPTY); };
  const edit = (row) => {
    setEditing(row.id);
    setForm({ title: row.title, subtitle: row.subtitle || "", desktop_image: row.desktop_image || "",
      mobile_image: row.mobile_image || "", store_id: row.store_id,
      destination_url: row.destination_url || "", cta_text: row.cta_text || "Shop store",
      display_rank: row.display_rank, active: !!row.active, featured: !!row.featured,
      start_date: row.start_date || "", end_date: row.end_date || "" });
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = { ...form, title: form.title.trim(), subtitle: form.subtitle.trim() || null,
      desktop_image: form.desktop_image.trim() || null, mobile_image: form.mobile_image.trim() || null,
      destination_url: form.destination_url.trim() || null, cta_text: form.cta_text.trim(),
      display_rank: Number(form.display_rank), start_date: form.start_date || null,
      end_date: form.end_date || null };
    try {
      if (editing) await api.put(`/admin/homepage/promotions/${editing}`, payload);
      else await api.post("/admin/homepage/promotions", payload);
      toast.success("Homepage promotion saved");
      reset();
      await load();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };
  const deactivate = async (id) => {
    try {
      await api.delete(`/admin/homepage/promotions/${id}`);
      toast.success("Promotion deactivated");
      await load();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  };
  const availableStores = stores.filter((store) => store.active && !store.archived_at && store.slug);

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="homepage-promotions-admin">
      <div>
        <h1 className="font-display text-3xl font-600 text-ink">Homepage promotions</h1>
        <p className="mt-1 text-sm text-ink-muted">Prepare store-targeted carousel content. No promotions are published automatically.</p>
      </div>
      <form onSubmit={save} className="surface space-y-4 rounded-xl p-5">
        <h2 className="font-display text-lg font-600 text-ink">{editing ? "Edit promotion" : "Add promotion"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title"><input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputClass} data-testid="homepage-promotion-title" /></Field>
          <Field label="Target store"><select required value={form.store_id} onChange={(event) => setForm({ ...form, store_id: event.target.value })} className={inputClass} data-testid="homepage-promotion-store"><option value="">Select active store</option>{availableStores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>
          <Field label="Subtitle"><input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} className={inputClass} /></Field>
          <Field label="CTA text"><input required maxLength={60} value={form.cta_text} onChange={(event) => setForm({ ...form, cta_text: event.target.value })} className={inputClass} /></Field>
          <Field label="Desktop image (HTTPS or /assets/)"><input value={form.desktop_image} onChange={(event) => setForm({ ...form, desktop_image: event.target.value })} className={inputClass} /></Field>
          <Field label="Mobile image (HTTPS or /assets/)"><input value={form.mobile_image} onChange={(event) => setForm({ ...form, mobile_image: event.target.value })} className={inputClass} /></Field>
          <Field label="Destination URL (optional HTTPS)"><input value={form.destination_url} onChange={(event) => setForm({ ...form, destination_url: event.target.value })} placeholder="https://..." className={inputClass} /></Field>
          <Field label="Display rank"><input type="number" min="0" required value={form.display_rank} onChange={(event) => setForm({ ...form, display_rank: event.target.value })} className={inputClass} /></Field>
          <Field label="Start date (optional)"><input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} className={inputClass} /></Field>
          <Field label="End date (optional)"><input type="date" min={form.start_date || undefined} value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} className={inputClass} /></Field>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-ink">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Featured</label>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} data-testid="homepage-promotion-save" className="btn-gold rounded-full px-5 py-2 text-sm font-700 disabled:opacity-50">{saving ? "Saving..." : "Save promotion"}</button>
          {editing && <button type="button" onClick={reset} className="rounded-full border border-border px-5 py-2 text-sm text-ink-muted">Cancel</button>}
        </div>
      </form>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-ink-muted">No promotions yet. Create one when content is ready.</p>}
        {rows.map((row) => (
          <div key={row.id} className="surface flex flex-wrap items-center gap-3 rounded-xl p-4 text-sm" data-testid={`homepage-promotion-${row.id}`}>
            <span className="w-8 text-ink-muted">{row.display_rank}</span>
            <span className="font-600 text-ink">{row.title}</span>
            <span className="text-ink-muted">{stores.find((store) => store.id === row.store_id)?.name || "Unavailable store"}</span>
            <span className="text-xs text-ink-muted">{row.active ? "Active" : "Inactive"}{row.featured ? " · Featured" : ""}</span>
            <div className="ml-auto flex gap-3">
              <button type="button" onClick={() => edit(row)} className="text-gold">Edit</button>
              {row.active && <button type="button" onClick={() => deactivate(row.id)} className="text-ink-muted hover:text-destructive">Deactivate</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block space-y-1.5"><span className="text-xs font-600 text-ink-muted">{label}</span>{children}</label>;
}
