import { describe, expect, it } from 'vitest';
import { parseBudget, raiseBudgetError, raiseFailure, suggestedBudget } from './raise-budget';

describe('suggestedBudget', () => {
  it('suggests $100 more than the budget that was reached, as the mock does', () => {
    expect(suggestedBudget(250)).toBe('350.00');
    expect(suggestedBudget(10)).toBe('110.00');
  });
});

describe('parseBudget', () => {
  it('reads dollars as people type them', () => {
    expect(parseBudget('$1,250.50')).toBe(1250.5);
    expect(parseBudget(' 350 ')).toBe(350);
    expect(parseBudget('')).toBeNull();
    expect(parseBudget('lots')).toBeNull();
  });
});

describe('raiseBudgetError', () => {
  it('refuses a budget at or below the spend so far, inline, with the mock’s words', () => {
    expect(raiseBudgetError('250', 250)).toBe(
      'New budget must be more than the $250.00 already spent.',
    );
    expect(raiseBudgetError('200.00', 250)).toBe(
      'New budget must be more than the $250.00 already spent.',
    );
    expect(raiseBudgetError('', 250)).toBe('Enter a new budget in dollars, such as 350.00.');
    expect(raiseBudgetError('250.01', 250)).toBeNull();
  });
});

describe('raiseFailure', () => {
  it('explains a budget another session changed, as the failed mock does', () => {
    expect(raiseFailure(409, 'budget_changed')).toBe(
      'The API returned 409: another session changed this budget a moment ago. Reload it and try again.',
    );
  });

  it('says what happened for anything else, and that nothing changed', () => {
    expect(raiseFailure(409, 'not_budget_paused')).toBe(
      'The API returned 409: the direction is no longer paused at its budget. Reload it to see where it is.',
    );
    expect(raiseFailure(0, null)).toBe(
      'The API returned no response. The budget is unchanged; try again.',
    );
    expect(raiseFailure(500, null)).toBe(
      'The API returned 500. The budget is unchanged; try again.',
    );
  });
});
