import { DirectionStatus, LogLine, ProjectStatus, StageStatus } from '@hewn/api';
import { StatusName } from '@hewn/components';

/** Stage duration as the mocks show it: `0:41`, `48:30`, `3:12:48`; a running stage counts up to `now`. */
export function formatDuration(
  startedAt: string | null,
  endedAt: string | null,
  now: number,
): string {
  if (!startedAt) {
    return '—';
  }

  const total = Math.max(
    0,
    Math.floor(((endedAt ? Date.parse(endedAt) : now) - Date.parse(startedAt)) / 1000),
  );
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/**
 * The status pill beside the project name. It follows the current direction, as the mocks do (a queued
 * direction reads Running, a finished one Complete), except that a Blocked project always reads Blocked.
 */
export function headerStatus(
  project: ProjectStatus,
  direction: DirectionStatus | null,
): StatusName {
  if (project === 'Blocked' || direction === null) {
    return project;
  }

  return direction === 'Queued' ? 'Running' : direction;
}

/** A direction's short title: its first clause, as the header and the queue callout show it. */
export function directionTitle(idea: string): string {
  const first = (idea.split(/(?<=\.)\s/)[0] ?? idea).split(',')[0] ?? idea;
  return first.replace(/\.$/, '').trim();
}

/** "14:12": when a queued direction was submitted, in the viewer's time zone. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** The explanation in the "Feature direction complete" callout (L2-005 AC1, AC2). */
export function featureOutcome(
  projectName: string,
  hasUiChange: boolean | null | undefined,
  uiDecision: string | null | undefined,
): string {
  const designs =
    hasUiChange === false
      ? ` Designs and design system were skipped too: ${(uiDecision ?? 'the agent recorded no user interface change').replace(/\.?$/, '.')}`
      : '';
  return `Bootstrap, stack and scaffold were skipped.${designs} ${projectName} is Idle until the next direction.`;
}

/**
 * The stage the detail panel shows: the one in `?stage=` when the direction has it, else the running stage,
 * else the first pending one, else the last.
 */
export function selectedStage(
  stages: readonly { number: number; status: StageStatus }[],
  requested: string | undefined,
): number {
  const asked = requested === undefined ? NaN : Number(requested);
  if (stages.some((s) => s.number === asked)) return asked;
  return (
    stages.find((s) => s.status === 'Running' || s.status === 'Paused' || s.status === 'Cancelled')
      ?.number ??
    stages.find((s) => s.status === 'Pending')?.number ??
    stages.at(-1)?.number ??
    0
  );
}

/** At most this many log lines are in the DOM at once (L2-033 AC3). */
export const MAX_RENDERED_LINES = 500;
/** Lines kept rendered above and below the view, so scrolling never shows a gap. */
const OVERSCAN = 100;

/** Which lines of a log to render: all of a short log; a window of at most 500 around the view of a long one. */
export function logWindow(
  total: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  following = false,
): { start: number; end: number } {
  if (total <= MAX_RENDERED_LINES) return { start: 0, end: total };
  const inView = Math.ceil(viewportHeight / rowHeight);
  const size = Math.min(MAX_RENDERED_LINES, inView + 2 * OVERSCAN);
  if (following) return { start: total - size, end: total };
  const first = Math.floor(scrollTop / rowHeight) - OVERSCAN;
  const start = Math.max(0, Math.min(first, total - size));
  return { start, end: start + size };
}

/** What the detail panel says instead of a log for a stage with nothing to show yet. */
export function stageNotice(
  stage: { number: number; name: string; status: StageStatus },
  firstStage: number,
): { title: string; text: string } | null {
  if (stage.status === 'Skipped') {
    return {
      title: 'Skipped',
      text: `This direction doesn’t run stage ${stage.number}, ${stage.name}.`,
    };
  }
  if (stage.status !== 'Pending') return null;
  if (stage.number === firstStage) {
    return {
      title: 'Waiting for a worker',
      text: `The direction is queued. Stage ${stage.number} starts as soon as a worker leases it, usually within 2 seconds. Nothing to do here.`,
    };
  }
  return {
    title: 'Not started',
    text: `Stage ${stage.number} starts when stage ${stage.number - 1} succeeds. Nothing to do here.`,
  };
}

/** What each stage runs and writes, for the detail panel's meta (Skill, Output). */
export const STAGE_META: readonly { skill: string; output: string }[] = [
  { skill: 'Copy from Greenlit', output: '.hewn/skills.lock' },
  { skill: 'grilling', output: 'docs/brief.md' },
  { skill: 'Magic Patterns MCP', output: 'docs/mocks/' },
  { skill: 'extracting-design-systems', output: 'docs/design-system/' },
  { skill: '—', output: 'docs/adr/0001-stack.md' },
  { skill: 'engineering-requirements', output: 'docs/specs/' },
  { skill: 'Stack template', output: 'Solution + CI' },
  { skill: 'writing-software-design-documents', output: 'docs/detailed-designs/' },
  { skill: '—', output: 'docs/journeys.md' },
  { skill: 'estimating-designs', output: 'docs/estimates/' },
  { skill: 'implementing-incrementally', output: 'Test → Code → Video → PR' },
];

/** "14:02:11": a log line's time in the viewer's time zone. */
export function logTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Adds log lines to those already shown, each once and in line order. Live lines can arrive before the page that
 * precedes them, so out-of-order input is merged rather than appended.
 */
export function mergeLines(existing: LogLine[], incoming: readonly LogLine[]): LogLine[] {
  const last = existing.at(-1)?.line ?? 0;
  if (incoming.every((l) => l.line > last)) {
    return incoming.length === 0 ? existing : [...existing, ...incoming];
  }
  const byLine = new Map(existing.map((l) => [l.line, l]));
  const before = byLine.size;
  for (const l of incoming) if (!byLine.has(l.line)) byLine.set(l.line, l);
  if (byLine.size === before) return existing;
  return [...byLine.values()].sort((a, b) => a.line - b.line);
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Dollars as the mocks write them: $1,234.50. */
export function dollars(amount: number): string {
  return usd.format(amount);
}

/** The header's spend meter (L2-052 AC2): spend of budget, the share spent, and warning once at 80% (L2-053). */
export function spendView(
  spendUsd: number,
  budgetUsd: number,
  warned: boolean,
  pauseReason: string | null,
): { spent: string; budget: string; percent: number; warn: boolean; text: string } {
  const percent = budgetUsd > 0 ? Math.min(100, Math.round((spendUsd / budgetUsd) * 100)) : 0;
  return {
    spent: dollars(spendUsd),
    budget: dollars(budgetUsd),
    percent,
    warn: warned || pauseReason !== null,
    text: `${dollars(spendUsd)} of ${dollars(budgetUsd)} budget`,
  };
}

/** The live toast when a direction's spend reaches 80% of its budget (L2-053 AC2). */
export function budgetWarningToast(
  projectName: string,
  spendUsd: number,
  budgetUsd: number,
): { tone: 'warn'; title: string; text: string } {
  return {
    tone: 'warn',
    title: `${projectName} at 80% of budget`,
    text: `${dollars(spendUsd)} of ${dollars(budgetUsd)}. It pauses at ${dollars(budgetUsd)}.`,
  };
}
