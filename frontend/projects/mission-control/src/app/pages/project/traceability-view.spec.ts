import type { RequirementTrace } from '@hewn/api';
import { emptyText, findRequirements, l1Line, noMatchText } from './traceability-view';

const req = (
  id: string,
  title: string,
  extra: Partial<RequirementTrace> = {},
): RequirementTrace => ({
  id,
  title,
  l1: null,
  deferred: null,
  noAcceptanceTest: true,
  designs: [],
  journeys: [],
  tests: [],
  pullRequests: [],
  ...extra,
});

describe('traceability view', () => {
  const all = [
    req('L2-001', 'Sign in with GitHub'),
    req('L2-018', 'Match card lines to transactions'),
    req('L2-035', 'Traceability view'),
  ];

  it('finds requirements by ID or by words in the title, ignoring case', () => {
    expect(findRequirements(all, '').map((r) => r.id)).toEqual(['L2-001', 'L2-018', 'L2-035']);
    expect(findRequirements(all, 'l2-018').map((r) => r.id)).toEqual(['L2-018']);
    expect(findRequirements(all, '18').map((r) => r.id)).toEqual(['L2-018']);
    expect(findRequirements(all, 'card').map((r) => r.id)).toEqual(['L2-018']);
    expect(findRequirements(all, 'L2-099')).toEqual([]);
  });

  it('says what nothing matched, and the range the project has', () => {
    expect(noMatchText('L2-099', 'Ledgerline', all)).toBe(
      'No requirement matches “L2-099”. Ledgerline has L2-001 to L2-035.',
    );
    expect(noMatchText('x', 'Ledgerline', [all[0]!])).toBe(
      'No requirement matches “x”. Ledgerline has L2-001.',
    );
  });

  it('names the parent L1, or says there is none', () => {
    expect(
      l1Line(req('L2-018', 'Match', { l1: { id: 'L1-006', title: 'Statement reconciliation' } })),
    ).toBe('Traces to L1-006 Statement reconciliation');
    expect(l1Line(req('L2-018', 'Match', { l1: { id: 'L1-006', title: '' } }))).toBe(
      'Traces to L1-006',
    );
    expect(l1Line(req('L2-018', 'Match'))).toBe('Traces to no L1');
  });

  it('says why a group is empty, with deferred tests not needed', () => {
    const open = req('L2-020', 'Close a period');
    const deferred = req('L2-031', 'Second currency', {
      deferred: 'Estimated 7 days',
      noAcceptanceTest: false,
    });
    expect(emptyText('designs', open)).toBe('No design covers it');
    expect(emptyText('journeys', open)).toBe('In no journey');
    expect(emptyText('tests', open)).toBe('None yet');
    expect(emptyText('tests', deferred)).toBe('Not needed while deferred');
    expect(emptyText('pullRequests', deferred)).toBe('None yet');
  });
});
