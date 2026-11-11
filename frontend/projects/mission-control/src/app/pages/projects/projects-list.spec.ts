import type { ProjectSummary } from '@hewn/api';
import { describe, expect, it } from 'vitest';
import {
  archiveRefusal,
  confirmNameError,
  deleteFailure,
  canArchive,
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
  archived: false,
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
    expect(parseStatusFilter('Queued')).toBeNull();
    expect(parseStatusFilter(null)).toBeNull();
  });

  it('counts each status and narrows the rows to one', () => {
    expect(countByStatus(rows)).toMatchObject({ Running: 2, Blocked: 1, Idle: 0 });
    expect(withStatus(rows, 'Running').map((r) => r.id)).toEqual(['a', 'c']);
    expect(withStatus(rows, null)).toHaveLength(3);
  });
});

describe('the Archived filter (L2-003 AC1)', () => {
  const rows = [
    row('a', 'Running', 'x'),
    { ...row('b', 'Idle', 'x'), archived: true },
    row('c', 'Idle', 'x'),
    { ...row('d', 'Cancelled', 'x'), archived: true },
  ];

  it('is read from the query string', () => {
    expect(parseStatusFilter('archived')).toBe('Archived');
  });

  it('keeps archived projects out of All, each status and the counts, and lists only them under Archived', () => {
    expect(withStatus(rows, null).map((r) => r.id)).toEqual(['a', 'c']);
    expect(withStatus(rows, 'Idle').map((r) => r.id)).toEqual(['c']);
    expect(withStatus(rows, 'Archived').map((r) => r.id)).toEqual(['b', 'd']);
    expect(countByStatus(rows)).toMatchObject({ Running: 1, Idle: 1, Cancelled: 0 });
  });
});

describe('archiving (L2-003 AC1, AC2)', () => {
  it('is offered only for a project with no active direction', () => {
    expect(canArchive(row('a', 'Idle', 'x'))).toBe(true);
    expect(canArchive(row('a', 'Complete', 'x'))).toBe(true);
    expect(canArchive(row('a', 'Cancelled', 'x'))).toBe(true);
    expect(canArchive(row('a', 'Running', 'x'))).toBe(false);
    expect(canArchive(row('a', 'Paused', 'x'))).toBe(false);
    expect(canArchive(row('a', 'Blocked', 'x'))).toBe(false);
    expect(canArchive({ ...row('a', 'Idle', 'x'), archived: true })).toBe(false);
  });

  it('says why it was refused', () => {
    expect(archiveRefusal(409, 'Cancel the running direction first')).toBe(
      'Cancel the running direction first.',
    );
    expect(archiveRefusal(403, null)).toBe('Only an Owner can archive or restore a project.');
    expect(archiveRefusal(0, null)).toBe('The Hewn API returned no response. Try again.');
  });
});

describe('deleting a project (L2-003 AC2, AC3)', () => {
  it('asks for the name exactly, once something different was typed', () => {
    expect(confirmNameError('', 'Harbor CRM')).toBeNull();
    expect(confirmNameError('Harbor CRM', 'Harbor CRM')).toBeNull();
    for (const typed of ['Harbor', 'harbor crm', 'Harbor CRM ']) {
      expect(confirmNameError(typed, 'Harbor CRM')).toBe('Type Harbor CRM exactly to delete it.');
    }
  });

  it('says why it wasn’t deleted, as the failed mock does', () => {
    expect(deleteFailure(503, null)).toBe('The API returned 503. Nothing was removed; try again.');
    expect(deleteFailure(0, null)).toBe(
      'The API returned no response. Nothing was removed; try again.',
    );
    expect(deleteFailure(409, 'Cancel the running direction first')).toBe(
      'Cancel the running direction first. Nothing was removed.',
    );
    expect(deleteFailure(403, null)).toBe(
      'Only an Owner can delete a project. Nothing was removed.',
    );
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

  it('gives the date after a week, as the archived mock does', () => {
    expect(lastActivityText(ago(6 * 86_400_000), now)).toBe('6 days ago');
    expect(lastActivityText('2026-10-12T09:00:00Z', now)).toBe('12 Oct');
  });
});
