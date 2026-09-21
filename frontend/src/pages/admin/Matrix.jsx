import React, { useEffect, useMemo, useState } from "react";
import { api, API, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Combobox } from "@/components/Combobox";
import { Download, ClipboardPaste, Upload, RotateCcw, CheckCircle2 } from "lucide-react";
import { useMeta } from "@/lib/useMeta";

const STATUS_COLOR = {
  new: "text-savings", changed: "text-amber-400", unchanged: "text-ink-muted",
  invalid: "text-destructive", unmatched: "text-destructive", duplicate: "text-amber-400",
};

export default function Matrix() {
  useMeta("Rate Matrix · Console", "");
  const [platforms, setPlatforms] = useState([]);
  const [stores, setStores] = useState([]);
  const [sel, setSel] = useState({ store_id: "", platform_id: "", customer_type: "existing" });
  const [matrix, setMatrix] = useState([]);
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(null);
  const [imports, setImports] = useState([]);

  useEffect(() => {
    api.get("/admin/platforms").then(({ data }) => setPlatforms(data));
    api.get("/admin/stores").then(({ data }) => setStores(data));
    loadImports();
  }, []);
  const loadImports = () => api.get("/admin/rates/imports").then(({ data }) => setImports(data));

  const ready = sel.store_id && sel.platform_id;
  const loadMatrix = async () => {
    if (!ready) return;
    const { data } = await api.get("/admin/rates/matrix", { params: sel });
    setMatrix(data.matrix);
  };
  useEffect(() => { loadMatrix(); /* eslint-disable-next-line */ }, [sel]);

  const platOptions = useMemo(() => platforms.map((p) => ({ value: p.id, label: `${p.name} (${p.kind === "affiliate" ? "Aff" : "GC"})` })), [platforms]);
  const storeOptions = useMemo(() => stores.map((s) => ({ value: s.id, label: s.name })), [stores]);

  const doPreview = async () => {
    if (!ready) { toast.error("Choose store and platform"); return; }
    if (!raw.trim()) { toast.error("Paste some rows first"); return; }
    try {
      const { data } = await api.post("/admin/rates/import/preview", { ...sel, raw });
      setPreview(data);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const doPublish = async () => {
    try {
      const { data } = await api.post("/admin/rates/import/publish", { ...sel, rows: preview.rows });
      toast.success(`Published ${data.inserted} rows (batch ${data.batch_id.slice(0, 8)})`);
      setPreview(null); setRaw(""); loadMatrix(); loadImports();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const rollback = async (batch_id) => {
    try { await api.post("/admin/rates/import/rollback", { batch_id }); toast.success("Rolled back"); loadMatrix(); loadImports(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const exportCsv = () => {
    const token = localStorage.getItem("yc_token");
    const url = `${API}/admin/rates/export.csv?store_id=${sel.store_id}&platform_id=${sel.platform_id}&customer_type=${sel.customer_type}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob()).then((b) => {
        const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "yukticart_rates.csv"; a.click();
      });
  };

  const publishable = preview?.rows.filter((r) => ["new", "changed"].includes(r.status)).length || 0;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-600 text-ink">Rate Matrix &amp; Bulk Paste</h1>
      <p className="text-sm text-ink-muted">Optimized for daily Amazon/Flipkart updates. Paste a spreadsheet table, preview, then publish atomically.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Combobox options={storeOptions} value={sel.store_id} onChange={(v) => setSel({ ...sel, store_id: v })} placeholder="Store" testid="matrix-store" />
        <Combobox options={platOptions} value={sel.platform_id} onChange={(v) => setSel({ ...sel, platform_id: v })} placeholder="Platform" testid="matrix-platform" />
        <select value={sel.customer_type} onChange={(e) => setSel({ ...sel, customer_type: e.target.value })}
          data-testid="matrix-customer-type" className="h-11 rounded-md border border-border bg-input px-3 text-sm text-foreground">
          <option value="existing">Existing</option><option value="new">New</option><option value="both">Both</option>
        </select>
      </div>

      {ready && (
        <>
          {/* Current matrix */}
          <div className="mt-5 flex items-center justify-between">
            <h2 className="font-display text-lg font-600 text-ink">Current rates</h2>
            <button onClick={exportCsv} data-testid="matrix-export" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-ink-muted hover:text-gold"><Download className="h-3.5 w-3.5" /> Export CSV</button>
          </div>
          <div className="surface mt-2 max-h-72 overflow-auto rounded-xl">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 text-left text-xs uppercase text-ink-muted">
                <tr><th className="p-2.5">Category</th><th className="p-2.5">Rate</th><th className="p-2.5">MOV</th><th className="p-2.5">Cap</th><th className="p-2.5">Active</th></tr>
              </thead>
              <tbody>
                {matrix.map((m) => (
                  <tr key={m.category_id} className="border-t border-border">
                    <td className="p-2.5 text-ink">{m.category}</td>
                    <td className="p-2.5 savings-text">{m.value != null ? (m.value_type === "percent" ? `${m.value}%` : `₹${m.value}`) : "—"}</td>
                    <td className="p-2.5 text-ink-muted">{m.mov ? `₹${m.mov}` : "—"}</td>
                    <td className="p-2.5 text-ink-muted">{m.cap ? `₹${m.cap}` : "—"}</td>
                    <td className="p-2.5 text-ink-muted">{m.value != null ? (m.active ? "Yes" : "No") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bulk paste */}
          <div className="surface mt-5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm font-600 text-ink"><ClipboardPaste className="h-4 w-4 text-gold" /> Bulk paste</div>
            <p className="mt-1 text-xs text-ink-muted">Paste from a spreadsheet. Supports <code>Category&lt;TAB&gt;Rate</code> or rich columns: Category | New | Existing | Type | MOV | Cap | Valid From | Valid Until | Notes. Values like <code>3.5%</code> or <code>₹40</code>.</p>
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} data-testid="matrix-paste"
              placeholder={"Category\tExisting Rate\nElectronics\t3.5%\nFurniture/Home\t5%\nBooks\t₹40"}
              className="mt-3 w-full rounded-md border border-border bg-input p-3 font-mono text-sm text-foreground" />
            <div className="mt-3 flex gap-2">
              <button onClick={doPreview} data-testid="matrix-preview-btn" className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10"><Upload className="h-4 w-4" /> Preview import</button>
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="surface mt-4 rounded-xl p-4" data-testid="import-preview">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {Object.entries(preview.counts).map(([k, v]) => (
                  <span key={k} className={`rounded-full border border-border px-2.5 py-1 ${STATUS_COLOR[k] || "text-ink-muted"}`}>{k}: {v}</span>
                ))}
              </div>
              <div className="mt-3 max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-ink-muted"><tr><th className="p-2">Input</th><th className="p-2">Matched</th><th className="p-2">Value</th><th className="p-2">Status</th><th className="p-2">Note</th></tr></thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr key={i} className="border-t border-border" data-testid={`preview-row-${i}`}>
                        <td className="p-2 text-ink">{r.input_category}</td>
                        <td className="p-2 text-ink-muted">{r.matched_category || r.suggestion || "—"}</td>
                        <td className="p-2 savings-text">{r.value != null ? (r.value_type === "percent" ? `${r.value}%` : `₹${r.value}`) : "—"}</td>
                        <td className={`p-2 font-600 ${STATUS_COLOR[r.status]}`} data-testid={`preview-status-${i}`}>{r.status}</td>
                        <td className="p-2 text-xs text-ink-muted">{r.reason || r.previous_value || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button onClick={doPublish} disabled={!publishable} data-testid="matrix-publish-btn" className="btn-gold inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-700 disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" /> Publish {publishable} rows atomically
                </button>
                <button onClick={() => setPreview(null)} className="text-sm text-ink-muted hover:text-ink">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Import history */}
      <div className="mt-6">
        <h2 className="font-display text-lg font-600 text-ink">Import history</h2>
        <div className="surface mt-2 overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase text-ink-muted"><tr><th className="p-3">When</th><th className="p-3">Rows</th><th className="p-3">By</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead>
            <tbody>
              {imports.map((im) => (
                <tr key={im.id} className="border-t border-border" data-testid={`import-row-${im.id}`}>
                  <td className="p-3 text-ink-muted">{new Date(im.created_at).toLocaleString("en-IN")}</td>
                  <td className="p-3 text-ink">{im.row_count}</td>
                  <td className="p-3 text-ink-muted">{im.actor}</td>
                  <td className="p-3"><span className={im.status === "rolled_back" ? "text-ink-muted" : "text-savings"}>{im.status}</span></td>
                  <td className="p-3 text-right">
                    {im.status !== "rolled_back" && (
                      <button onClick={() => rollback(im.id)} data-testid={`rollback-${im.id}`} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-destructive"><RotateCcw className="h-3.5 w-3.5" /> Rollback</button>
                    )}
                  </td>
                </tr>
              ))}
              {!imports.length && <tr><td colSpan={5} className="p-4 text-center text-ink-muted">No imports yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
