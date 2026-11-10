import { IncrementCheck, IncrementDetail, IncrementPullRequest } from '@hewn/api';
import { StatusName } from '@hewn/components';

/** One step of the increment's timeline; `status` is also read out, so it is never shown by colour alone. */
export interface TimelineStep {
  title: string;
  status: StatusName | 'Merged';
  time: string;
  detail: string;
}

const GATE = 'Backend, frontend, increment tests and full e2e pass in the worker';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The increment's way to merge, as the mock's timeline shows it: the test commit, red (or green first), the
 * iterations, the video, the pull request and the squash-merge (L2-021 AC3, L2-022, L2-024, L2-025). `time`
 * formats a stored time for display.
 */
export function incrementTimeline(
  d: IncrementDetail,
  time: (iso: string | null) => string,
): TimelineStep[] {
  const blocked = d.status === 'Blocked';
  const merged = d.status === 'Merged';
  const l2s = d.l2Ids.join(', ');
  const committed = d.testsCommittedAt !== null;
  const steps: TimelineStep[] = [];

  steps.push(
    committed
      ? {
          title: d.testsPassedEarly ? 'Acceptance tests committed' : 'Failing tests committed',
          status: 'Succeeded',
          time: time(d.testsCommittedAt),
          detail: `${plural(d.testCount ?? 0, 'acceptance test')} · traces to ${l2s}`,
        }
      : {
          title: 'Writing acceptance tests',
          status: blocked ? 'Blocked' : d.status === 'InProgress' ? 'Running' : 'Pending',
          time: d.status === 'InProgress' ? 'now' : '',
          detail: `Only test files, each traced to ${l2s}`,
        },
  );

  steps.push(
    !committed
      ? {
          title: 'Red',
          status: 'Pending',
          time: '',
          detail: 'The new tests must fail before any implementation',
        }
      : d.testsPassedEarly
        ? {
            title: 'Tests passed before implementation',
            status: 'Skipped',
            time: time(d.testsCommittedAt),
            detail: `${d.redPassing} of ${d.testCount} passed on the test commit; flagged in the PR Notes`,
          }
        : {
            title: 'Red recorded',
            status: 'Failed',
            time: time(d.testsCommittedAt),
            detail: `${d.redFailing} failing, ${d.redPassing} passing`,
          },
  );

  if (blocked) {
    const failing = `${d.failingTests.length} of ${d.testCount ?? d.failingTests.length} failing: ${d.failingTests.join(', ')}.`;
    steps.push({
      title: `Blocked after ${plural(d.iterations, 'iteration')}`,
      status: 'Blocked',
      time: time(d.finishedAt),
      detail: `${failing} ${d.movedOnTo !== null ? `Moved on to increment ${d.movedOnTo}.` : 'Every increment left depends on it.'}`,
    });
  } else if (d.greenAfter !== null) {
    steps.push({
      title: `Green after ${plural(d.greenAfter, 'iteration')}`,
      status: 'Succeeded',
      time: time(d.greenAt),
      detail: GATE,
    });
  } else if (d.iterations > 0 && d.status === 'InProgress') {
    steps.push({
      title: `Implementing · iteration ${d.iterations} of ${d.maxIterations}`,
      status: 'Running',
      time: 'now',
      detail: GATE,
    });
  } else {
    steps.push({
      title: 'Implement until green',
      status: 'Pending',
      time: '',
      detail: `Up to ${d.maxIterations} implement-and-test iterations`,
    });
  }

  steps.push(
    d.video === 'Recorded'
      ? {
          title: 'Video',
          status: 'Succeeded',
          time: time(d.videoAt),
          detail: d.videoNote ?? 'Recorded',
        }
      : d.video === 'Failed'
        ? {
            title: 'Video failed',
            status: 'Failed',
            time: time(d.videoAt),
            detail: `${d.videoNote ?? 'No reason given'} · noted in the PR, never blocks it`,
          }
        : {
            title: 'Video',
            status: 'Pending',
            time: '',
            detail: blocked ? 'Waits for green' : 'Records when every test is green',
          },
  );

  if (d.pullRequest || d.pullRequestOpenedAt) {
    const number = d.pullRequest?.number;
    const failed = d.checks.find(
      (c) => c.status === 'completed' && !PASSING.has(c.conclusion ?? ''),
    );
    steps.push({
      title: number ? `Pull request #${number}` : 'Pull request',
      status: merged ? 'Succeeded' : failed ? 'Failed' : 'Running',
      time: time(d.pullRequestOpenedAt),
      detail: merged
        ? 'All required checks passed'
        : failed
          ? `${failed.name} ${failed.conclusion === 'failure' ? 'failed' : failed.conclusion} · counted as a failed iteration`
          : 'Waiting on required checks',
    });
  } else {
    steps.push({
      title: 'Pull request',
      status: 'Pending',
      time: '',
      detail: blocked ? 'Not opened' : 'Opens after the video step',
    });
  }

  steps.push(
    merged
      ? {
          title: 'Squash-merge',
          status: 'Merged',
          time: time(d.finishedAt),
          detail: 'Branch deleted',
        }
      : {
          title: 'Squash-merge',
          status: 'Pending',
          time: '',
          detail: blocked ? 'Not reached' : 'Automatic when checks pass',
        },
  );
  return steps;
}

const PASSING = new Set(['success', 'neutral', 'skipped']);

/** "1m 48s", "52s", "2m". */
export function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest}s`;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

/** A required check's status and the short line beside its name (L2-024 AC3). */
export function checkLine(check: IncrementCheck): { status: StatusName; detail: string } {
  if (check.status === 'queued') return { status: 'Pending', detail: 'queued' };
  if (check.status !== 'completed') return { status: 'Running', detail: 'running' };
  const took = check.durationSeconds !== null ? ` · ${duration(check.durationSeconds)}` : '';
  switch (check.conclusion) {
    case 'success':
      return { status: 'Succeeded', detail: `passed${took}` };
    case 'skipped':
    case 'neutral':
      return { status: 'Skipped', detail: check.conclusion };
    default:
      return {
        status: 'Failed',
        detail: `${check.conclusion ?? 'failed'}${took}`.replace(/^failure/, 'failed'),
      };
  }
}

/** "#28 · open · +612 −48 · 14 files", as GitHub summarises a pull request. */
export function pullRequestMeta(pr: IncrementPullRequest): string {
  const state = pr.state === 'merged' ? 'squash-merged' : 'open';
  return `#${pr.number} · ${state} · +${pr.additions} −${pr.deletions} · ${plural(pr.changedFiles, 'file')}`;
}

/** "1:22", "0:03": a player position in minutes and seconds. */
export function playerTime(seconds: number): string {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** "1 minute 22 of 2 minutes 14", the seek slider's spoken position. */
export function playerValueText(current: number, total: number): string {
  const spoken = (seconds: number) => {
    const whole = Math.floor(Number.isFinite(seconds) ? Math.max(seconds, 0) : 0);
    const minutes = Math.floor(whole / 60);
    const rest = whole % 60;
    return minutes === 0
      ? `${rest} seconds`
      : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}${rest ? ` ${rest}` : ''}`;
  };
  return `${spoken(current)} of ${spoken(total)}`;
}

/**
 * What the video area says when there is nothing to play (L2-023): why it failed, that a Blocked increment records
 * none, or that it records once every test is green. Null when the video was recorded.
 */
export function videoPlaceholder(
  d: IncrementDetail,
): { tone: 'failed' | 'waiting'; title?: string; text: string } | null {
  if (d.video === 'Recorded') return null;
  if (d.video === 'Failed') {
    return {
      tone: 'failed',
      title: `Video failed: ${d.videoNote ?? 'no reason given'}`,
      text: 'The capture failed, was retried once and failed again. The pull request went ahead with this noted under Notes.',
    };
  }
  if (d.status === 'Blocked') {
    return {
      tone: 'waiting',
      text: `Blocked after ${d.iterations} iterations; no video is recorded until every test is green.`,
    };
  }
  if (d.greenAfter !== null)
    return { tone: 'waiting', text: 'Every test is green; the walkthrough is being recorded.' };
  return {
    tone: 'waiting',
    text:
      d.iterations > 0
        ? `The walkthrough records once every test is green. Implementing, iteration ${d.iterations} of ${d.maxIterations}.`
        : 'The walkthrough records once every test is green.',
  };
}
