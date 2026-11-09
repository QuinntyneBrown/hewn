// Acceptance Test
// Traces to: L2-019, L2-022
// Description: The scripted agent, the e2e stand-in for Claude, lists an idea's nice-to-haves in the brief so stage 9 defers them, and can leave one increment unbuilt so it blocks

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LeasedRun } from '../src/api.ts';
import { ScriptedStageAgent } from '../src/agents/scripted-agent.ts';
import type { IncrementTask } from '../src/agents/stage-agent.ts';
import { scriptedImplementation } from '../src/increments/scripted-gate.ts';

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'hewn-scripted-'));
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function run(stage: number, idea: string): LeasedRun {
  return {
    runId: `run-${stage}`,
    epoch: 1,
    projectId: 'p',
    directionId: 'd',
    stage,
    stageName: 'Stage',
    checkpointStep: 0,
    checkpointSha: null,
    project: { id: 'p', name: 'Kiln', idea, stackPreference: null, repository: 'hewn-builds/kiln' },
    skillsSource: 'unused',
    descopeThresholdDays: 3,
    maxIterations: 10,
  };
}

const task = (stage: number, idea: string, increment?: IncrementTask) => ({
  run: run(stage, idea),
  directory,
  skill: null,
  instructions: '',
  allowedTools: [],
  ...(increment ? { increment } : {}),
});

const increment = (number: number, title: string): IncrementTask => ({
  number,
  title,
  slug: title.toLowerCase().replace(/\s+/g, '-'),
  l2Ids: [`L2-00${number}`],
  designs: [],
  phase: 'implement',
});

describe('ScriptedStageAgent', () => {
  it("lists the idea's nice-to-haves in the brief, keeping them as core features", async () => {
    await new ScriptedStageAgent().run(
      task(1, 'Studio time booking for shared ceramics kilns. Nice to have: review history.'),
    );

    const brief = readFileSync(join(directory, 'docs/brief.md'), 'utf8');
    expect(brief).toMatch(/## Nice to have\n- Review history\n/);
    expect(brief).toMatch(
      /## Core features\n- Sign in\n- Main workflow — studio time booking for shared ceramics kilns\n- Review history\n/,
    );
  });

  it('writes no nice-to-have section when the idea names none', async () => {
    await new ScriptedStageAgent().run(task(1, 'Studio time booking for shared ceramics kilns.'));

    expect(readFileSync(join(directory, 'docs/brief.md'), 'utf8')).not.toContain('Nice to have');
  });

  it('leaves the increment it is told to block unbuilt, and builds the others', async () => {
    const agent = new ScriptedStageAgent(undefined, { blockIncrement: 'Review history' });
    const idea = 'Studio time booking.';

    await agent.run(task(10, idea, increment(2, 'Review history')));
    await agent.run(task(10, idea, increment(1, 'Sign in')));

    expect(existsSync(join(directory, scriptedImplementation('e2e/tests/review-history.spec.ts')))).toBe(false);
    expect(existsSync(join(directory, scriptedImplementation('e2e/tests/sign-in.spec.ts')))).toBe(true);
  });

  it('takes its time on each increment session when told to, so a run can be watched', async () => {
    const agent = new ScriptedStageAgent(undefined, { incrementDelayMs: 300 });
    const started = Date.now();

    await agent.run(task(10, 'Studio time booking.', increment(1, 'Sign in')));

    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
  });
});
