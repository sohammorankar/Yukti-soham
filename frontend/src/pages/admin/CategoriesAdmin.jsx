import React, { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Archive, RotateCcw, X } from "lucide-react";
import { useMeta } from "@/lib/useMeta";

export default function CategoriesAdmin() {
  useMeta("Categories & Keywords · Console", "");
  const [cats, setCats] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [newCat, setNewCat] = useState("");
  const [selected, setSelected] = useState(null);
  const [kw, setKw] = useState({ phrase: "", match_type: "contains", weight: 2, is_exclusion: false });

  const load = async () => {
    const [c, k] = await Promise.all([api.get("/admin/categories"), api.get("/admin/keywords")]);
    setCats(c.data); setKeywords(k.data);
    if (!selected && c.data.length) setSelected(c.data[0].id);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const addCat = async () => {
    if (!newCat.trim()) return;
    try { await api.post("/admin/categories", { name: newCat }); setNewCat(""); toast.success("Category added"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const archiveCat = async (id) => { await api.delete(`/admin/categories/${id}`); load(); };
  const restoreCat = async (id) => { await api.post(`/admin/categories/${id}/restore`); load(); };

  const addKw = async () => {
    if (!kw.phrase.trim() || !selected) return;
    try {
      await api.post("/admin/keywords", { ...kw, category_id: selected });
      setKw({ phrase: "", match_type: "contains", weight: 2, is_exclusion: false });
      toast.success("Keyword added"); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const delKw = async (id) => { await api.delete(`/admin/keywords/${id}`); load(); };

  const catKeywords = keywords.filter((k) => k.category_id === selected);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-600 text-ink">Categories &amp; Keywords</h1>
      <p className="text-sm text-ink-muted">Edit categories and the weighted keyword/synonym/exclusion rules that power URL detection — no code deploy needed.</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="surface rounded-xl p-4">
          <div className="flex gap-2">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name"
              data-testid="category-name" className="h-10 flex-1 rounded-md border border-border bg-input px-3 text-sm text-foreground" />
            <button onClick={addCat} data-testid="category-add" className="btn-gold rounded-md px-3 text-sm font-700"><Plus className="h-4 w-4" /></button>
          </div>
          <ul className="mt-3 space-y-1">
            {cats.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSelected(c.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${selected === c.id ? "btn-gold font-600" : "text-ink-muted hover:text-gold"}`}>
                  <span className="flex-1">{c.name}</span>
                  {c.archived_at
                    ? <span onClick={(e) => { e.stopPropagation(); restoreCat(c.id); }} className="text-xs"><RotateCcw className="h-3.5 w-3.5" /></span>
                    : c.name !== "All" && <span onClick={(e) => { e.stopPropagation(); archiveCat(c.id); }} className="opacity-60 hover:opacity-100"><Archive className="h-3.5 w-3.5" /></span>}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface rounded-xl p-4">
          <h3 className="font-display text-lg font-600 text-ink">Keyword rules</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input value={kw.phrase} onChange={(e) => setKw({ ...kw, phrase: e.target.value })} placeholder="phrase e.g. bean bag"
              data-testid="keyword-phrase" className="col-span-2 h-10 rounded-md border border-border bg-input px-3 text-sm text-foreground" />
            <select value={kw.match_type} onChange={(e) => setKw({ ...kw, match_type: e.target.value })} className="h-10 rounded-md border border-border bg-input px-2 text-sm text-foreground">
              <option value="contains">contains</option><option value="exact_phrase">exact_phrase</option><option value="regex_safe_pattern">regex</option>
            </select>
            <input type="number" value={kw.weight} onChange={(e) => setKw({ ...kw, weight: Number(e.target.value) })} placeholder="weight"
              className="h-10 rounded-md border border-border bg-input px-3 text-sm text-foreground" />
            <label className="col-span-2 flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" checked={kw.is_exclusion} onChange={(e) => setKw({ ...kw, is_exclusion: e.target.checked })} /> Exclusion (negative)
            </label>
            <button onClick={addKw} data-testid="keyword-add" className="btn-gold col-span-2 rounded-md px-3 py-2 text-sm font-700">Add keyword</button>
          </div>
          <ul className="mt-4 space-y-1.5">
            {catKeywords.map((k) => (
              <li key={k.id} className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
                <span className="font-mono text-ink">{k.phrase}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-ink-muted">{k.match_type}</span>
                <span className="text-xs text-ink-muted">w{k.weight}</span>
                {k.is_exclusion && <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">exclude</span>}
                <button onClick={() => delKw(k.id)} className="ml-auto text-ink-muted hover:text-destructive"><X className="h-4 w-4" /></button>
              </li>
            ))}
            {!catKeywords.length && <li className="text-sm text-ink-muted">No keywords yet for this category.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
