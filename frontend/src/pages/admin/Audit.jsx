import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMeta } from "@/lib/useMeta";

export default function Audit() {
  useMeta("Audit Log · Console", "");
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/admin/audit").then(({ data }) => setRows(data)).catch(() => {}); }, []);
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-600 text-ink">Audit Log</h1>
      <p className="text-sm text-ink-muted">Immutable trail of every management action.</p>
      <div className="surface mt-5 overflow-x-auto rounded-xl">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-ink-muted">
            <tr><th className="p-3">Time</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Target</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 text-ink-muted">{new Date(r.timestamp).toLocaleString("en-IN")}</td>
                <td className="p-3 text-ink">{r.actor}</td>
                <td className="p-3"><span className="rounded bg-muted px-1.5 py-0.5 text-xs text-gold">{r.action}</span></td>
                <td className="p-3 text-ink-muted">{r.entity_type}</td>
                <td className="p-3 font-mono text-xs text-ink-muted">{r.entity_id?.slice(0, 8)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="p-6 text-center text-ink-muted">No audit entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
