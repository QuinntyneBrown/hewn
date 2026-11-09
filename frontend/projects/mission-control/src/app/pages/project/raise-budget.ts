import { dollars } from './pipeline-view';

/** The new budget the raise controls start with: $100 more than the budget that was reached. */
export function suggestedBudget(budgetUsd: number): string {
  return (budgetUsd + 100).toFixed(2);
}

/** Dollars as typed ("$1,250.50", " 350 "), or null when it isn't a number. */
export function parseBudget(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (cleaned === '' || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** The inline error for a new budget, or null when it may be sent (L2-053 AC3: it must exceed the spend so far). */
export function raiseBudgetError(text: string, spendUsd: number): string | null {
  const budget = parseBudget(text);
  if (budget === null) return 'Enter a new budget in dollars, such as 350.00.';
  if (budget <= spendUsd)
    return `New budget must be more than the ${dollars(spendUsd)} already spent.`;
  return null;
}

/** The failed callout's body when the API refused the raise; the budget is unchanged in every case. */
export function raiseFailure(status: number, code: string | null): string {
  if (status === 409 && code === 'budget_changed') {
    return 'The API returned 409: another session changed this budget a moment ago. Reload it and try again.';
  }
  if (status === 409) {
    return 'The API returned 409: the direction is no longer paused at its budget. Reload it to see where it is.';
  }
  return `The API returned ${status || 'no response'}. The budget is unchanged; try again.`;
}
