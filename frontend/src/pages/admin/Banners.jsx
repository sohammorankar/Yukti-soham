import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useMeta } from "@/lib/useMeta";

const EMPTY = {
  image_url: "", alt_text: "", title: "", destination_url: "",
  display_rank: 0, active: false, start_date: "", end_date: "",
};
const inputClass = "h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-ink";

export default function Banners() {
  useMeta("Homepage banners · Console", "");
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/banners");
      setRows(data);
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const reset = () => { setEditing(null); setForm(EMPTY); };
  const edit = (row) => {
    setEditing(row.id);
    setForm({ image_url: row.image_url || "", alt_text: row.alt_text || "", title: row.title || "",
      destination_url: row.destination_url || "", display_rank: row.display_rank,
      active: !!row.active, start_date: row.start_date || "", end_date: row.end_date || "" });
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = { ...form, image_url: form.image_url.trim(), alt_text: form.alt_text.trim(),
      title: form.title.trim() || null, destination_url: form.destination_url.trim() || null,
      display_rank: Number(form.display_rank), start_date: form.start_date || null,
      end_date: form.end_date || null };
    try {
      if (editing) await api.put(`/admin/banners/${editing}`, payload);
      else await api.post("/admin/banners", payload);
      toast.success("Banner saved");
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
      await api.delete(`/admin/banners/${id}`);
      toast.success("Banner deactivated");
      await load();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  };
  const move = async (index, direction) => {
    const target = rows[index + direction];
    const current = rows[index];
    if (!target) return;
    try {
      await Promise.all([
        api.put(`/admin/banners/${current.id}`, { display_rank: target.display_rank }),
        api.put(`/admin/banners/${target.id}`, { display_rank: current.display_rank }),
      ]);
      await load();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="homepage-banners-admin">
      <div>
        <h1 className="font-display text-3xl font-600 text-ink">Homepage banners</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage the promotional carousel shown above the savings engine. Only active, in-window banners are shown publicly.
        </p>
      </div>
      <form onSubmit={save} className="surface space-y-4 rounded-xl p-5">
        <h2 className="font-display text-lg font-600 text-ink">{editing ? "Edit banner" : "Add banner"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Image URL (HTTPS or /assets/)">
            <input required value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })}
              placeholder="https://..." className={inputClass} data-testid="banner-image-url" />
          </Field>
          <Field label="Alt text (required for accessibility)">
            <input required maxLength={200} value={form.alt_text} onChange={(event) => setForm({ ...form, alt_text: event.target.value })}
              className={inputClass} data-testid="banner-alt-text" />
          </Field>
          <Field label="Title (optional)">
            <input maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}
              className={inputClass} data-testid="banner-title" />
          </Field>
          <Field label="Destination URL (optional HTTPS)">
            <input value={form.destination_url} onChange={(event) => setForm({ ...form, destination_url: event.target.value })}
              placeholder="https://..." className={inputClass} data-testid="banner-destination-url" />
          </Field>
          <Field label="Display rank">
            <input type="number" min="0" required value={form.display_rank}
              onChange={(event) => setForm({ ...form, display_rank: event.target.value })}
              className={inputClass} data-testid="banner-display-rank" />
          </Field>
          <Field label="Start date (optional)">
            <input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })}
              className={inputClass} data-testid="banner-start-date" />
          </Field>
          <Field label="End date (optional)">
            <input type="date" min={form.start_date || undefined} value={form.end_date}
              onChange={(event) => setForm({ ...form, end_date: event.target.value })}
              className={inputClass} data-testid="banner-end-date" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-ink">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} data-testid="banner-active-checkbox" /> Active
          </label>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} data-testid="banner-save" className="btn-gold rounded-full px-5 py-2 text-sm font-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save banner"}
          </button>
          {editing && <button type="button" onClick={reset} className="rounded-full border border-border px-5 py-2 text-sm text-ink-muted">Cancel</button>}
        </div>
      </form>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-ink-muted">No banners yet. Create one when content is ready.</p>}
        {rows.map((row, index) => (
          <div key={row.id} className="surface flex flex-wrap items-center gap-3 rounded-xl p-4 text-sm" data-testid={`homepage-banner-${row.id}`}>
            <span className="w-8 text-ink-muted">{row.display_rank}</span>
            <img src={row.image_url} alt="" className="h-10 w-16 rounded-md border border-border object-cover" />
            <span className="font-600 text-ink">{row.title || "(no title)"}</span>
            <span className="text-xs text-ink-muted">{row.active ? "Active" : "Inactive"}</span>
            <div className="ml-auto flex items-center gap-3">
              <button type="button" disabled={index === 0} onClick={() => move(index, -1)}
                data-testid={`homepage-banner-${row.id}-move-up`} className="text-ink-muted hover:text-gold disabled:opacity-30">Up</button>
              <button type="button" disabled={index === rows.length - 1} onClick={() => move(index, 1)}
                data-testid={`homepage-banner-${row.id}-move-down`} className="text-ink-muted hover:text-gold disabled:opacity-30">Down</button>
              <button type="button" onClick={() => edit(row)} data-testid={`homepage-banner-${row.id}-edit`} className="text-gold">Edit</button>
              {row.active && (
                <button type="button" onClick={() => deactivate(row.id)} data-testid={`homepage-banner-${row.id}-deactivate`} className="text-ink-muted hover:text-destructive">
                  Deactivate
                </button>
              )}
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
