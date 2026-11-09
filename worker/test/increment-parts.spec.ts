// Acceptance Test
// Traces to: L2-021, L2-022, L2-023, L2-024, L2-025
// Description: The parts of an increment: the test-commit guard, the gate's counts and failing tests, the pull request title and body, the video check, and the progress update after a merge

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkTestCommit, isTestFile } from '../src/increments/test-files.ts';
import { CommandTestGate, parseCounts } from '../src/increments/test-gate.ts';
import { pullRequestBody, pullRequestTitle } from '../src/increments/pull-request-template.ts';
import { validateVideo } from '../src/increments/video.ts';
import { markComplete } from '../src/increments/progress.ts';
import { planBacklog } from '../src/estimates/backlog-planner.ts';

let dir: string;
const write = (path: string, content: string) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hewn-increment-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('the test commit guard', () => {
  it('recognises test files across the stack', () => {
    expect(
      ['e2e/tests/sign-in.spec.ts', 'frontend/src/app/x.spec.ts', 'backend/tests/Api.Tests/SignInTests.cs'].every(
        isTestFile,
      ),
    ).toBe(true);
    expect(['frontend/src/app/x.ts', 'backend/src/Api/SignIn.cs', 'README.md'].some(isTestFile)).toBe(false);
  });

  it('accepts only test files whose header traces to the increment', () => {
    write('e2e/tests/a.spec.ts', '// Acceptance Test\n// Traces to: L2-001\n// Description: x\n');
    write('e2e/tests/b.spec.ts', "import { test } from '@playwright/test';\n");
    write('e2e/tests/c.spec.ts', '// Traces to: L2-009\n');
    write('frontend/src/app/x.ts', 'export const x = 1;\n');

    expect(checkTestCommit(dir, ['e2e/tests/a.spec.ts'], ['L2-001'])).toEqual([]);
    expect(
      checkTestCommit(
        dir,
        ['e2e/tests/a.spec.ts', 'e2e/tests/b.spec.ts', 'e2e/tests/c.spec.ts', 'frontend/src/app/x.ts'],
        ['L2-001'],
      ),
    ).toEqual([
      'e2e/tests/b.spec.ts has no "Traces to: L2-xxx" header',
      'e2e/tests/c.spec.ts traces to L2-009, which is not in this increment',
      'frontend/src/app/x.ts is not a test file',
    ]);
    expect(checkTestCommit(dir, [], ['L2-001'])).toEqual(['The test commit has no acceptance tests']);
  });
});

describe('the test gate', () => {
  it('reads pass and fail counts from dotnet, vitest and playwright output', () => {
    expect(parseCounts('Passed!  - Failed:     0, Passed:    12, Skipped:     0, Total:    12')).toEqual({
      passed: 12,
      failed: 0,
    });
    expect(parseCounts(' Test Files  2 passed (2)\n      Tests  1 failed | 7 passed (8)')).toEqual({
      passed: 7,
      failed: 1,
    });
    expect(parseCounts('  2 failed\n  5 passed (3.1s)')).toEqual({ passed: 5, failed: 2 });
  });

  it('runs every suite, and is green only when each passes', async () => {
    const gate = new CommandTestGate([
      { suite: 'backend', command: 'node', args: ['-e', "console.log('Passed!  - Failed: 0, Passed: 3')"] },
      {
        suite: 'e2e',
        command: 'node',
        args: ['-e', "console.log('  ✘ signs in');console.log('  1 failed');process.exit(1)"],
        acceptance: true,
      },
    ]);

    const result = await gate.full(dir, ['e2e/tests/a.spec.ts']);

    expect(result.passed).toBe(false);
    expect(result.suites.map((s) => [s.suite, s.passed, s.counts])).toEqual([
      ['backend', true, { passed: 3, failed: 0 }],
      ['e2e', false, { passed: 0, failed: 1 }],
    ]);
    expect(result.failing).toEqual(['e2e: ✘ signs in']);
  });

  it('runs only the new acceptance tests for the red run', async () => {
    const gate = new CommandTestGate([
      { suite: 'backend', command: 'node', args: ['-e', 'process.exit(1)'] },
      {
        suite: 'e2e',
        command: 'node',
        args: ['-e', "console.log(process.argv.slice(1).join(' ') + ' 2 failed')"],
        acceptance: true,
      },
    ]);

    const red = await gate.acceptance(dir, ['e2e/tests/a.spec.ts', 'e2e/tests/b.spec.ts']);

    expect(red.counts).toEqual({ passed: 0, failed: 2 });
    expect(red.output).toContain('e2e/tests/a.spec.ts e2e/tests/b.spec.ts');
  });
});

describe('the pull request', () => {
  const increment = {
    number: 2,
    title: 'Book a firing (part 1 of 2)',
    journey: 2,
    l2Ids: ['L2-002', 'L2-003'],
    estimateDays: 2.5,
    dependsOn: [1],
    status: 'InProgress',
    iterations: 0,
  };

  it('is titled after the journey with its L2 IDs', () => {
    expect(pullRequestTitle('Book a firing', increment)).toBe('Book a firing (journey 2, L2-002, L2-003)');
  });

  it('has the six sections, the test commands with counts, the notes and the attribution line last', () => {
    const body = pullRequestBody({
      increment,
      journeyTitle: 'Book a firing',
      designs: ['kiln/calendar'],
      changed: ['backend/src/Kiln.Api/Calendar.cs', 'frontend/src/app/calendar.ts', 'e2e/tests/calendar.spec.ts'],
      gate: {
        passed: true,
        failing: [],
        suites: [
          { suite: 'backend', commandLine: 'dotnet test', passed: true, counts: { passed: 14, failed: 0 }, output: '' },
          {
            suite: 'e2e',
            commandLine: 'npx playwright test',
            passed: true,
            counts: { passed: 6, failed: 0 },
            output: '',
          },
        ],
      },
      red: { passed: 3, failed: 0 },
      iterations: 2,
      maxIterations: 10,
      rebases: 0,
      video: { failed: 'ffmpeg is not installed' },
      runId: '0412abcd-0000-0000-0000-000000000000',
      directionId: 'd7d7d7d7-0000-0000-0000-000000000000',
    });

    expect([...body.matchAll(/^## (.+)$/gm)].map((m) => m[1])).toEqual([
      'What',
      'Design and decisions',
      'API',
      'Tests',
      'Deferred',
      'Notes',
    ]);
    expect(body).toContain('| `dotnet test` | 14 | 0 |');
    expect(body).toContain('| `npx playwright test` | 6 | 0 |');
    expect(body).toContain('[kiln/calendar](docs/detailed-designs/kiln/calendar/README.md)');
    expect(body).toContain('- `backend/src/Kiln.Api/Calendar.cs`');
    expect(body).toContain('Tests passed before implementation: all 3 new acceptance tests passed on the test commit.');
    expect(body).toContain('Video failed: ffmpeg is not installed');
    expect(body.trimEnd().split('\n').at(-1)).toBe('Built by Hewn · direction d7d7d7d7 · run-0412abcd');
  });

  it('links the video and records red when tests failed first', () => {
    const body = pullRequestBody({
      increment,
      journeyTitle: 'Book a firing',
      designs: [],
      changed: [],
      gate: { passed: true, failing: [], suites: [] },
      red: { passed: 0, failed: 3 },
      iterations: 1,
      maxIterations: 10,
      rebases: 1,
      video: { path: 'docs/videos/book-a-firing-part-1-of-2/book-a-firing-part-1-of-2.mp4' },
      runId: 'r',
      directionId: 'd',
    });

    expect(body).toContain('[Video](docs/videos/book-a-firing-part-1-of-2/book-a-firing-part-1-of-2.mp4)');
    expect(body).toContain('Red recorded: 3 new acceptance tests failed on the test commit.');
    expect(body).toContain('Rebased onto the default branch 1 time.');
    expect(body).toContain('No backend changes.');
  });
});

describe('the video check', () => {
  const probe = (info: { width: number; height: number; duration: number }) => async () => info;

  it('needs the script, captions and a 1080p MP4 of 3 minutes or less', async () => {
    expect(await validateVideo(dir, 'sign-in', probe({ width: 1920, height: 1080, duration: 60 }))).toEqual([
      'docs/videos/sign-in/sign-in.mp4 does not exist',
      'docs/videos/sign-in/script.md does not exist',
      'docs/videos/sign-in/sign-in.vtt does not exist',
    ]);
    for (const f of ['sign-in.mp4', 'script.md', 'sign-in.vtt']) write(`docs/videos/sign-in/${f}`, 'x');
    expect(await validateVideo(dir, 'sign-in', probe({ width: 1920, height: 1080, duration: 60 }))).toEqual([]);
    expect(await validateVideo(dir, 'sign-in', probe({ width: 1280, height: 720, duration: 200 }))).toEqual([
      'The video is 1280x720, not 1920x1080',
      'The video runs 3:20, over 3 minutes',
    ]);
  });
});

describe('the progress update', () => {
  it('marks the merged designs complete and recomputes percent complete', () => {
    write('docs/specs/L2.md', '## L2-001: A\n\n## L2-002: B\n');
    write('docs/detailed-designs/kiln/sign-in/README.md', '# Sign in\n\n- L2-001\n');
    write('docs/detailed-designs/kiln/book/README.md', '# Book\n\n- L2-002\n');
    write(
      'docs/estimates/kiln.md',
      '| Design | Estimate (days) | Complete |\n|---|---:|---:|\n| [sign-in](../detailed-designs/kiln/sign-in/README.md) | 1 | 0% |\n| [book](../detailed-designs/kiln/book/README.md) | 3 | 0% |\n',
    );
    write('docs/journeys.md', '## 1. Go\n\n**Covers:** L2-001, L2-002\n');
    planBacklog(dir, 3);

    const changed = markComplete(dir, ['kiln/sign-in'], 3);

    expect(changed.sort()).toEqual(['docs/estimates/README.md', 'docs/estimates/kiln.md']);
    expect(readFileSync(join(dir, 'docs/estimates/kiln.md'), 'utf8')).toContain(
      '| [sign-in](../detailed-designs/kiln/sign-in/README.md) | 1 | 100% |',
    );
    expect(readFileSync(join(dir, 'docs/estimates/README.md'), 'utf8')).toContain('**Percent complete:** 25%');
  });
});
