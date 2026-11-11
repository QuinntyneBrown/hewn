import {
  AUDIT_ACTIONS,
  actionLabel,
  actionWarns,
  auditTime,
  loadFailure,
  noResultsText,
  parseAction,
} from './audit-text';

describe('audit log text (L2-044)', () => {
  it('names each action as the mock does, in its order', () => {
    expect(AUDIT_ACTIONS.map((a) => a.label)).toEqual([
      'Sign in',
      'Direction submitted',
      'Pause',
      'Resume',
      'Cancel',
      'Merge',
      'Token created',
      'Token revoked',
      'Stop all workers',
      'Start workers',
    ]);
    expect(actionLabel('StopAll')).toBe('Stop all workers');
    expect(actionLabel('TokenRevoked')).toBe('Token revoked');
  });

  it('marks the actions that stop or take something away', () => {
    expect(AUDIT_ACTIONS.filter((a) => actionWarns(a.value)).map((a) => a.value)).toEqual([
      'Cancel',
      'TokenRevoked',
      'StopAll',
    ]);
  });

  it('reads the action filter from the address, ignoring anything unknown', () => {
    expect(parseAction('Pause')).toBe('Pause');
    expect(parseAction('pause')).toBeNull();
    expect(parseAction('Delete')).toBeNull();
    expect(parseAction(null)).toBeNull();
  });

  it('gives the time to the second', () => {
    expect(auditTime('2026-11-09T14:31:07.412+00:00', 'UTC')).toBe('9 Nov 2026, 14:31:07');
  });

  it('says why no entry matches the filters', () => {
    expect(noResultsText('Ledgerline', 'StopAll')).toBe(
      'Nobody stopped all workers from Ledgerline. Stop all is recorded against All projects.',
    );
    expect(noResultsText('Ledgerline', 'StartWorkers')).toBe(
      'Nobody started workers from Ledgerline. Start workers is recorded against All projects.',
    );
    expect(noResultsText('Ledgerline', 'TokenCreated')).toBe(
      'Token created isn’t recorded against a project; choose All projects to see it.',
    );
    expect(noResultsText('Ledgerline', 'Pause')).toBe(
      'Nothing was recorded as Pause on Ledgerline.',
    );
    expect(noResultsText('Ledgerline', null)).toBe('Nothing was recorded on Ledgerline.');
    expect(noResultsText(null, 'Merge')).toBe('Nothing was recorded as Merge.');
  });

  it('says the log failed to load and that nothing was lost', () => {
    expect(loadFailure(500)).toBe(
      'The audit store returned 500. Entries are still being written; nothing has been lost.',
    );
    expect(loadFailure(0)).toBe(
      'The audit store returned no response. Entries are still being written; nothing has been lost.',
    );
  });
});
