import type { BacklogIncrement, IncrementStatus } from '@hewn/api';
import type { StatusName } from '@hewn/components';

/** How an increment's status reads in the Backlog (L2-020 AC2): never colour alone, always with its label. */
export function incrementLook(status: IncrementStatus): { status: StatusName; label: string } {
  switch (status) {
    case 'InProgress':
      return { status: 'Running', label: 'In progress' };
    case 'Merged':
      return { status: 'Succeeded', label: 'Merged' };
    default:
      return { status, label: status };
  }
}

/** "1.5 d", "2 d": ideal days as the mock shows them. */
export function estimate(days: number): string {
  return `${days} d`;
}

export type PullRequestCell =
  | { kind: 'link'; text: string; href: string; merged: boolean }
  | { kind: 'soon' }
  | { kind: 'none' };

/** The PR column: a link once the pull request exists, "soon" while the increment is being built. */
export function pullRequest(increment: BacklogIncrement): PullRequestCell {
  if (increment.pullRequestNumber !== null && increment.pullRequestUrl !== null) {
    return {
      kind: 'link',
      text: `#${increment.pullRequestNumber}`,
      href: increment.pullRequestUrl,
      merged: increment.status === 'Merged',
    };
  }
  return increment.status === 'InProgress' ? { kind: 'soon' } : { kind: 'none' };
}

/**
 * The callout over a blocked increment: how many iterations it used, what still fails, and which increment Hewn
 * works on instead, the first one left that doesn't depend on it, directly or through another (L2-022 AC2).
 */
export function blockedNotice(
  blocked: BacklogIncrement,
  increments: readonly BacklogIncrement[],
): { title: string; body: string } {
  const unreachable = new Set([blocked.number]);
  for (const i of [...increments].sort((a, b) => a.number - b.number)) {
    if (i.dependsOn.some((d) => unreachable.has(d))) unreachable.add(i.number);
  }
  const next = increments.find(
    (i) => (i.status === 'InProgress' || i.status === 'Queued') && !unreachable.has(i.number),
  );
  const count = blocked.failingTests.length;
  const failing = `${count} acceptance ${count === 1 ? 'test still fails' : 'tests still fail'} (${blocked.failingTests.join(', ')}).`;
  return {
    title: `Increment ${blocked.number} is blocked after ${blocked.iterations} iterations`,
    body: next
      ? `${failing} Hewn moved on to increment ${next.number}, which doesn’t depend on it.`
      : `${failing} Every increment left depends on it.`,
  };
}
