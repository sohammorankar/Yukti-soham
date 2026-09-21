// Indian rupee formatting helpers. Values from API come as {exact, rupees}.
export function inr(rupees) {
  const n = Number(rupees || 0);
  return "₹" + n.toLocaleString("en-IN");
}

// money bundle {exact, rupees} -> display "₹1,251"
export function money(bundle) {
  if (bundle == null) return "₹0";
  if (typeof bundle === "object") return inr(bundle.rupees);
  return inr(bundle);
}

// exact paise display e.g. "₹1,250.50"
export function moneyExact(bundle) {
  if (!bundle) return "₹0.00";
  const exact = typeof bundle === "object" ? bundle.exact : bundle;
  const n = Number(exact);
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function rateLabel(valueType, value) {
  if (value == null) return "—";
  return valueType === "percent" ? `${value}%` : `₹${value}`;
}
