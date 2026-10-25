import React from "react";
import { moneyExact } from "@/lib/format";

export const CashbackEstimate = ({ result }) => {
  const estimate = result.cashback_estimate;
  if (!estimate) return null;
  const best = result.affiliate?.best;
  return (
    <div className="mt-5 border-y border-border py-4" data-testid="transaction-estimate">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-muted">Entered selling price</dt>
          <dd className="mt-1 text-xl font-700 text-ink" data-testid="result-selling-price">{moneyExact(result.inputs.price)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Estimated affiliate cashback · this transaction</dt>
          <dd className="mt-1 text-xl font-700 text-ink" data-testid="result-cashback-estimate">
            {estimate.amount != null ? moneyExact(estimate.amount) : "Not confirmed"}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-ink-muted" data-testid="cashback-estimate-reason">{estimate.reason}</p>
      {estimate.amount && Number(estimate.amount.exact) > 0 && (
        <p className="mt-2 text-xs text-ink-muted" data-testid="cashback-estimate-basis">
          {best?.platform_name} · eligible spend {moneyExact(estimate.applied_to)}.
          {estimate.included_in_stack ? " Included in this savings estimate." : " Alternative route only — not added to the selected stack."}
        </p>
      )}
      <p className="mt-2 text-xs text-ink-muted" data-testid="cashback-estimate-disclaimer">
        Advertised “up to” rates are offer maximums, not guaranteed payouts. Cashback depends on eligible items, tracking, exclusions, returns and final partner approval.
      </p>
    </div>
  );
};
