import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useMeta } from "@/lib/useMeta";

const EMPTY = { name: "", slug: "", display_rank: 0, image_url: "", active: true, homepage_visible: true };
const inputClass = "h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-ink";

export default function HomepageCategories() {
  useMeta("Homepage categories · Console", "");
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/homepage/categories");
      setRows(data);
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const reset = () => { setEditing(null); setForm(EMPTY); };
  const edit = (row) => {
    setEditing(row.id);
    setForm({ name: row.name, slug: row.slug, display_rank: row.display_rank,
      image_url: row.image_url || "", active: !!row.active,
      homepage_visible: !!row.homepage_visible });
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = { ...form, name: form.name.trim(), slug: form.slug.trim() || null,
      image_url: form.image_url.trim() || null, display_rank: Number(form.display_rank) };
    try {
      if (editing) await api.put(`/admin/homepage/categories/${editing}`, payload);
      else await api.post("/admin/homepage/categories", payload);
      toast.success("Homepage category saved");
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
      await api.delete(`/admin/homepage/categories/${id}`);
      toast.success("Category deactivated");
      await load();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="homepage-categories-admin">
      <div>
        <h1 className="font-display text-3xl font-600 text-ink">Homepage discovery categories</h1>
        <p className="mt-1 text-sm text-ink-muted">Editorial categories only. Store payout categories are managed separately by affiliate rules.</p>
      </div>
      <form onSubmit={save} className="surface space-y-4 rounded-xl p-5">
        <h2 className="font-display text-lg font-600 text-ink">{editing ? "Edit category" : "Add category"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} data-testid="homepage-category-name" /></Field>
          <Field label="Slug (blank generates from name)"><input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} className={inputClass} /></Field>
          <Field label="Display rank"><input type="number" min="0" required value={form.display_rank} onChange={(event) => setForm({ ...form, display_rank: event.target.value })} className={inputClass} data-testid="homepage-category-rank" /></Field>
          <Field label="Image URL or existing /assets/ path"><input value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} placeholder="/assets/categories/fashion.webp" className={inputClass} /></Field>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-ink">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.homepage_visible} onChange={(event) => setForm({ ...form, homepage_visible: event.target.checked })} /> Visible on homepage</label>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} data-testid="homepage-category-save" className="btn-gold rounded-full px-5 py-2 text-sm font-700 disabled:opacity-50">{saving ? "Saving..." : "Save category"}</button>
          {editing && <button type="button" onClick={reset} className="rounded-full border border-border px-5 py-2 text-sm text-ink-muted">Cancel</button>}
        </div>
      </form>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="surface flex flex-wrap items-center gap-3 rounded-xl p-4 text-sm" data-testid={`homepage-category-${row.slug}`}>
            <span className="w-8 text-ink-muted">{row.display_rank}</span>
            <span className="font-600 text-ink">{row.name}</span>
            <span className="text-ink-muted">/{row.slug}</span>
            <span className="text-xs text-ink-muted">{row.active ? (row.homepage_visible ? "Visible" : "Hidden") : "Inactive"}</span>
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
