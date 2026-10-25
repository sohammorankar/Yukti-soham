import React, { useEffect, useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { createImageReader, imageSuggestions } from "@/lib/productImage";
import { Combobox } from "@/components/Combobox";

export const ProductImageInput = ({ stores, onApply }) => {
  const input = useRef(null);
  const reader = useRef(null);
  const generation = useRef(0);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState(null);
  const [storeId, setStoreId] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => {
    generation.current += 1;
    reader.current?.terminate();
  }, []);

  const clear = () => {
    generation.current += 1;
    reader.current?.terminate(); reader.current = null;
    setPreview(""); setReview(null); setError(""); setBusy(false); setStatus("");
    setStoreId(""); setPrice("");
  };

  const select = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    clear();
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Choose a PNG, JPEG or WebP image up to 10 MB."); return;
    }
    const run = generation.current;
    setPreview(URL.createObjectURL(file)); setBusy(true); setStatus("Reading image…");
    let worker;
    try {
      // Decode first to reject invalid files and impractically large images.
      const bitmap = await createImageBitmap(file);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 24000000) throw new Error("Image is too large. Choose a crop under 24 megapixels.");
      worker = await createImageReader((message) => {
        if (run === generation.current && message.status === "recognizing text") {
          setStatus(`Reading image… ${Math.round(message.progress * 100)}%`);
        }
      });
      if (run !== generation.current) return;
      reader.current = worker;
      const { data } = await worker.recognize(file);
      if (run !== generation.current) return;
      const suggestions = imageSuggestions(data.text || "", stores);
      setStoreId(suggestions.storeId);
      setReview({ ...suggestions, text: data.text || "" });
      setStatus("Review the store and selling price before applying.");
    } catch (err) {
      if (run === generation.current) {
        setError(err.message?.startsWith("Image is too large") ? err.message : "Could not read this image. Try a clearer screenshot or enter the details manually.");
        setStatus("");
      }
    } finally {
      if (worker) await worker.terminate();
      if (reader.current === worker) reader.current = null;
      if (run === generation.current) setBusy(false);
    }
  };

  return (
    <div className="min-w-0" data-testid="image-input-method">
      <h2 className="mb-2 flex items-center gap-2 text-base font-600 text-ink"><Upload className="h-4 w-4 text-gold" /> Product / cart image</h2>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={select}
        aria-label="Upload a product or cart image" className="sr-only" data-testid="input-product-image" />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} data-testid="choose-product-image"
        className="focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-gold/50 px-3 py-2 text-sm text-gold transition-colors hover:bg-gold/10 disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? "Reading…" : preview ? "Replace image" : "Choose image"}
      </button>
      <p className="mt-2 text-xs text-ink-muted" data-testid="image-privacy-note">PNG, JPEG, WebP · up to 10 MB · stays on your device</p>
      {preview && <div className="relative mt-3">
        <img src={preview} alt="Selected product or cart" className="aspect-[3/2] w-full rounded-md bg-muted object-contain" data-testid="product-image-preview" />
        <button type="button" onClick={clear} aria-label="Remove image" title="Remove image" data-testid="remove-product-image"
          className="focus-ring absolute right-1 top-1 rounded-full border border-border bg-background p-1.5 text-ink"><X className="h-4 w-4" /></button>
      </div>}
      {status && <p role="status" className="mt-2 text-xs text-ink-muted" data-testid="product-image-status">{status}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-destructive" data-testid="product-image-error">{error}</p>}
      {review && <div className="mt-3 space-y-3" data-testid="image-review">
        <Combobox options={stores.map((s) => ({ value: s.id, label: s.name }))} value={storeId} onChange={setStoreId}
          placeholder="Confirm store" testid="image-review-store" ariaLabel="Store from image" />
        <div>
          <label htmlFor="image-review-price" className="text-xs text-ink-muted">Selling price / cart total (₹)</label>
          <input id="image-review-price" data-testid="image-review-price" type="number" inputMode="decimal" min="0.01" step="0.01"
            value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Confirm amount" list="image-price-suggestions"
            className="focus-ring mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground" />
          <datalist id="image-price-suggestions">{review.prices.map((value) => <option key={value} value={value} />)}</datalist>
        </div>
        <details><summary className="focus-ring cursor-pointer text-xs text-gold" data-testid="image-text-toggle">Recognized text</summary>
          <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-xs text-ink-muted" data-testid="image-recognized-text">{review.text || "No readable text found. Enter the details above."}</p>
        </details>
        <button type="button" data-testid="apply-image-details" disabled={!storeId || !Number.isFinite(Number(price)) || Number(price) <= 0}
          onClick={() => { onApply({ storeId, price }); setReview(null); setStatus("Confirmed details applied."); }}
          className="btn-gold focus-ring w-full rounded-md px-3 py-2 text-sm font-600 disabled:opacity-50">Apply confirmed details</button>
      </div>}
    </div>
  );
};
