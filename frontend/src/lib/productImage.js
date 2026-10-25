// Local OCR only. Images/text are never uploaded or persisted.
export async function createImageReader(logger) {
  const { createWorker } = await import("tesseract.js");
  return createWorker("eng", 1, {
    workerPath: "/tesseract/worker/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
    gzip: true,
    cacheMethod: "none",
    logger,
  });
}

export function imageSuggestions(text, stores) {
  const normalized = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const matches = stores.filter((store) => normalized.includes(
    ` ${store.name.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `));
  // Currency-labelled prices or explicitly labelled totals only; never choose
  // the highest/lowest number and mistake an MRP/discount for a selling price.
  const prices = new Set();
  const amount = /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
  for (const match of text.matchAll(amount)) {
    const value = Number(match[1].replace(/,/g, ""));
    if (value > 0 && Number.isFinite(value)) prices.add(String(value));
  }
  const total = /(?:grand total|total amount|amount payable|selling price|sale price)\s*[:=]?\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
  for (const match of text.matchAll(total)) {
    const value = Number(match[1].replace(/,/g, ""));
    if (value > 0 && Number.isFinite(value)) prices.add(String(value));
  }
  return { storeId: matches.length === 1 ? matches[0].id : "", prices: [...prices].slice(0, 12) };
}
