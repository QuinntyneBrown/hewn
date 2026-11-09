import type { BacklogIncrement } from '@hewn/api';
import { describe, expect, it } from 'vitest';
import { blockedNotice, estimate, incrementLook, pullRequest } from './backlog-view';

const increment = (number: number, fields: Partial<BacklogIncrement> = {}): BacklogIncrement => ({
  number,
  title: `Increment ${number}`,
  journey: number,
  l2Ids: [],
  estimateDays: 2,
  dependsOn: [],
  status: 'Queued',
  iterations: 0,
  failingTests: [],
  pullRequestNumber: null,
  pullRequestUrl: null,
  ...fields,
});

describe('incrementLook', () => {
  it('shows each increment status with its own label (L2-020 AC2)', () => {
    expect(incrementLook('Queued')).toEqual({ status: 'Queued', label: 'Queued' });
    expect(incrementLook('InProgress')).toEqual({ status: 'Running', label: 'In progress' });
    expect(incrementLook('Blocked')).toEqual({ status: 'Blocked', label: 'Blocked' });
    expect(incrementLook('Merged')).toEqual({ status: 'Succeeded', label: 'Merged' });
  });
});

describe('estimate', () => {
  it('reads ideal days as the mock does', () => {
    expect(estimate(1.5)).toBe('1.5 d');
    expect(estimate(2)).toBe('2 d');
  });
});

describe('pullRequest', () => {
  it('links the pull request once one exists, "soon" while in progress, and nothing before', () => {
    expect(
      pullRequest(
        increment(1, {
          status: 'Merged',
          pullRequestNumber: 14,
          pullRequestUrl: 'https://x/pull/14',
        }),
      ),
    ).toEqual({
      kind: 'link',
      text: '#14',
      href: 'https://x/pull/14',
      merged: true,
    });
    expect(
      pullRequest(
        increment(2, {
          status: 'InProgress',
          pullRequestNumber: 17,
          pullRequestUrl: 'https://x/pull/17',
        }),
      ),
    ).toEqual({
      kind: 'link',
      text: '#17',
      href: 'https://x/pull/17',
      merged: false,
    });
    expect(pullRequest(increment(3, { status: 'InProgress' }))).toEqual({ kind: 'soon' });
    expect(pullRequest(increment(4))).toEqual({ kind: 'none' });
  });
});

describe('blockedNotice', () => {
  it('says how many iterations it used, what still fails, and what Hewn moved on to', () => {
    const blocked = increment(7, {
      status: 'Blocked',
      iterations: 10,
      failingTests: ['matches-across-midnight'],
    });
    const notice = blockedNotice(blocked, [
      blocked,
      increment(8, { status: 'InProgress' }),
      increment(9),
    ]);

    expect(notice).toEqual({
      title: 'Increment 7 is blocked after 10 iterations',
      body: '1 acceptance test still fails (matches-across-midnight). Hewn moved on to increment 8, which doesn’t depend on it.',
    });
  });

  it('skips increments that depend on the blocked one, directly or not, and counts several failing tests', () => {
    const blocked = increment(2, { status: 'Blocked', iterations: 10, failingTests: ['a', 'b'] });
    const notice = blockedNotice(blocked, [
      increment(1, { status: 'Merged' }),
      blocked,
      increment(3, { dependsOn: [2] }),
      increment(4, { dependsOn: [3] }),
      increment(5),
    ]);

    expect(notice.body).toBe(
      '2 acceptance tests still fail (a, b). Hewn moved on to increment 5, which doesn’t depend on it.',
    );
  });

  it('says nothing more can start when every other increment depends on it or is done', () => {
    const blocked = increment(2, { status: 'Blocked', iterations: 10, failingTests: ['a'] });

    expect(
      blockedNotice(blocked, [
        increment(1, { status: 'Merged' }),
        blocked,
        increment(3, { dependsOn: [2] }),
      ]).body,
    ).toBe('1 acceptance test still fails (a). Every increment left depends on it.');
  });
});
