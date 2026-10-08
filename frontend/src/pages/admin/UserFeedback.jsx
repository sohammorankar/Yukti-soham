import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useMeta } from "@/lib/useMeta";

const formatMoney = (value) => {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `₹${number.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : `₹${value}`;
};

export default function UserFeedback() {
  useMeta("User Feedback · YuktiCart Console", "");
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/feedback", { params: { kind: "result_feedback" } })
      .then(({ data }) => setRows(data))
      .catch((requestError) => setError(formatApiErrorDetail(requestError.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl font-600 text-ink">User Feedback</h1>
      <p className="text-sm text-ink-muted">Review authenticated feedback on individual YuktiCart savings results.</p>

      {error && <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <div className="surface mt-5 overflow-x-auto rounded-xl">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-ink-muted">
            <tr>
              <th className="p-3">Time</th>
              <th className="p-3">User</th>
              <th className="p-3">Sentiment</th>
              <th className="p-3">Rating</th>
              <th className="p-3">Store / Saving</th>
              <th className="p-3">Notes</th>
              <th className="p-3"><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOpen = expanded === row.id;
              const context = row.context || {};
              return (
                <React.Fragment key={row.id}>
                  <tr className="border-t border-border align-top">
                    <td className="whitespace-nowrap p-3 text-xs text-ink-muted">{new Date(row.timestamp).toLocaleString("en-IN")}</td>
                    <td className="p-3">
                      <p className="font-600 text-ink">{row.name || "Unnamed user"}</p>
                      <p className="text-xs text-ink-muted">{row.email}</p>
                    </td>
                    <td className="p-3"><span className="whitespace-nowrap">{row.sentiment === "positive" ? "👍 Positive" : "👎 Negative"}</span></td>
                    <td className="whitespace-nowrap p-3 text-gold">{"★".repeat(row.rating || 0)}<span className="text-ink-muted">{"☆".repeat(5 - (row.rating || 0))}</span></td>
                    <td className="p-3">
                      <p className="text-ink">{context.store_name || "—"}</p>
                      <p className="text-xs text-savings">Saved {formatMoney(context.total_saving)}</p>
                    </td>
                    <td className="max-w-xs p-3 text-ink-muted"><p className="line-clamp-2">{row.notes || "—"}</p></td>
                    <td className="p-3">
                      <button type="button" onClick={() => setExpanded(isOpen ? null : row.id)}
                        aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} feedback details`}
                        className="focus-ring rounded-full border border-border p-1.5 text-ink-muted hover:text-gold">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-border bg-surface-2/40">
                      <td colSpan={7} className="p-4">
                        <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          <Detail label="Category" value={context.category} />
                          <Detail label="Order value" value={formatMoney(context.order_value)} />
                          <Detail label="Effective price" value={formatMoney(context.effective_price)} />
                          <Detail label="Total saving" value={formatMoney(context.total_saving)} />
                          <Detail label="Gift-card saving" value={formatMoney(context.gift_card_saving)} />
                          <Detail label="Cashback saving" value={formatMoney(context.cashback_saving)} />
                          <Detail label="Rate version" value={context.rate_version} />
                          <Detail label="Feedback ID" value={row.id} mono />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {!loading && !rows.length && !error && (
              <tr><td colSpan={7} className="p-8 text-center text-ink-muted">No result feedback submitted yet.</td></tr>
            )}
            {loading && <tr><td colSpan={7} className="p-8 text-center text-ink-muted">Loading feedback…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Detail({ label, value, mono = false }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 break-words text-ink ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}
