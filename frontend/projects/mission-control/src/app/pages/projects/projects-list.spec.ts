import type { ProjectSummary } from '@hewn/api';
import { describe, expect, it } from 'vitest';
import {
  countByStatus,
  lastActivityText,
  parseStatusFilter,
  upsertRow,
  withStatus,
} from './projects-list';

const row = (
  id: string,
  status: ProjectSummary['status'],
  lastActivityAt: string,
): ProjectSummary => ({
  id,
  name: id,
  idea: 'An idea',
  repository: null,
  status,
  stage: { number: 0, name: 'Bootstrap' },
  note: null,
  percentComplete: 0,
  spendUsd: 0,
  lastActivityAt,
  firstDirectionComplete: false,
});

describe('upsertRow (L2-002 AC4)', () => {
  const rows = [
    row('a', 'Running', '2026-11-09T10:00:02Z'),
    row('b', 'Idle', '2026-11-09T10:00:01Z'),
  ];

  it('replaces a changed row in place and keeps newest activity first', () => {
    const changed = { ...row('b', 'Running', '2026-11-09T10:00:05Z'), percentComplete: 9 };
    expect(upsertRow(rows, changed).map((r) => [r.id, r.status, r.percentComplete])).toEqual([
      ['b', 'Running', 9],
      ['a', 'Running', 0],
    ]);
  });

  it('adds a project it has not seen', () => {
    expect(upsertRow(rows, row('c', 'Running', '2026-11-09T10:00:00Z')).map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('the status filter (L2-002 AC2)', () => {
  const rows = [row('a', 'Running', 'x'), row('b', 'Blocked', 'x'), row('c', 'Running', 'x')];

  it('reads only a known status from the query string', () => {
    expect(parseStatusFilter('Blocked')).toBe('Blocked');
    expect(parseStatusFilter('blocked')).toBe('Blocked');
    expect(parseStatusFilter('Archived')).toBeNull();
    expect(parseStatusFilter(null)).toBeNull();
  });

  it('counts each status and narrows the rows to one', () => {
    expect(countByStatus(rows)).toMatchObject({ Running: 2, Blocked: 1, Idle: 0 });
    expect(withStatus(rows, 'Running').map((r) => r.id)).toEqual(['a', 'c']);
    expect(withStatus(rows, null)).toHaveLength(3);
  });
});

describe('lastActivityText (L2-002 AC1)', () => {
  const now = new Date('2026-11-09T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('says how long ago, as the mock does', () => {
    expect(lastActivityText(ago(400), now)).toBe('Just now');
    expect(lastActivityText(ago(4_000), now)).toBe('4s ago');
    expect(lastActivityText(ago(18 * 60_000), now)).toBe('18m ago');
    expect(lastActivityText(ago(2 * 3_600_000), now)).toBe('2h ago');
    expect(lastActivityText(ago(30 * 3_600_000), now)).toBe('Yesterday');
    expect(lastActivityText(ago(3 * 86_400_000), now)).toBe('3 days ago');
  });
});
