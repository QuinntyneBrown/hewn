import type { Increment } from '../api.ts';
import type { Counts, GateResult } from './test-gate.ts';

export interface PullRequestFacts {
  increment: Increment;
  journeyTitle: string;
  designs: string[];
  changed: string[];
  gate: GateResult;
  red: Counts;
  iterations: number;
  maxIterations: number;
  rebases: number;
  /** The recorded video's path, and its GitHub address at the commit that recorded it when known. */
  video: { path: string; url?: string } | { failed: string };
  runId: string;
  directionId: string;
}

/** L2-024 AC1: "{journey title} (journey {n}, L2-xxx[, L2-yyy])". */
export function pullRequestTitle(journeyTitle: string, increment: Increment): string {
  return `${journeyTitle} (journey ${increment.journey}, ${increment.l2Ids.join(', ')})`;
}

/** L2-024 AC2: What, Design and decisions, API, Tests, Deferred and Notes, then the Hewn attribution line. */
export function pullRequestBody(facts: PullRequestFacts): string {
  const { increment, gate, red } = facts;
  const api = facts.changed.filter((p) => p.startsWith('backend/') && !/Tests?\.cs$/.test(p) && !p.includes('/tests/'));
  const newTests = red.passed + red.failed;
  const notes = [
    red.failed === 0
      ? `Tests passed before implementation: all ${newTests} new acceptance tests passed on the test commit.`
      : `Red recorded: ${red.failed} new acceptance tests failed on the test commit.`,
    'video' in facts && 'failed' in facts.video ? `Video failed: ${facts.video.failed}` : null,
    `Green after ${facts.iterations} of ${facts.maxIterations} implement-and-test iterations.`,
    facts.rebases > 0
      ? `Rebased onto the default branch ${facts.rebases} time${facts.rebases === 1 ? '' : 's'}.`
      : null,
  ].filter((n): n is string => n !== null);

  return `## What

${increment.title}: ${increment.l2Ids.join(', ')} of journey ${increment.journey}, ${facts.journeyTitle}.${
    'path' in facts.video
      ? `\n\n[Video](${facts.video.url ?? facts.video.path}) of the journey in the running app.`
      : ''
  }

## Design and decisions

${facts.designs.length ? facts.designs.map((d) => `- [${d}](docs/detailed-designs/${d}/README.md)`).join('\n') : '- No detailed design is linked to this increment.'}
- Decisions the agent made are recorded in [docs/decisions.md](docs/decisions.md).

## API

${api.length ? api.map((p) => `- \`${p}\``).join('\n') : 'No backend changes.'}

## Tests

| Command | Passed | Failed |
|---|---:|---:|
${gate.suites.map((s) => `| \`${s.commandLine}\` | ${s.counts.passed} | ${s.counts.failed} |`).join('\n')}

${newTests} new acceptance tests trace to ${increment.l2Ids.join(', ')}.

## Deferred

Nothing in this increment is deferred.

## Notes

${notes.map((n) => `- ${n}`).join('\n')}

Built by Hewn · direction ${facts.directionId.slice(0, 8)} · run-${facts.runId.slice(0, 8)}
`;
}
