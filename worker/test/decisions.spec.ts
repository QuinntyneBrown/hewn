// Acceptance Test
// Traces to: L2-054, L2-028
// Description: Agents answer their own questions, record each as a complete decision (with an ADR when it changes architecture), and are never given a way to ask a human

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommitFile, LeasedRun, ReportedDecision } from '../src/api.ts';
import { appendDecision, AUTONOMY, validateDecisions } from '../src/agents/decision-log.ts';
import type { StageAgent, StageAgentTask } from '../src/agents/stage-agent.ts';
import { ScriptedStageAgent } from '../src/agents/scripted-agent.ts';
import { DocumentStageExecutor } from '../src/executors/document-executor.ts';
import type { RunContext } from '../src/executors/stage-executor.ts';
import { noPullRequests } from './support/no-pull-requests.ts';

let root: string;
let repo: string;
const write = (base: string, path: string, content: string) => {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), content);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hewn-decisions-'));
  repo = join(root, 'ledgerline-abc1234');
  write(repo, 'docs/adr/0001-stack.md', '# 1. Stack\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const decision = {
  date: '2026-11-09',
  stage: 7,
  stageName: 'Detailed designs',
  question: 'How do the frontend and API talk?',
  answer: 'REST over JSON.',
  rationale: 'The scaffold already serves a REST API.',
};

describe('the decision log', () => {
  it('records an architecture decision as the next numbered ADR and links it', () => {
    appendDecision(repo, {
      ...decision,
      architecture: { context: 'Two apps need one contract.', consequences: 'Endpoints are versioned by path.' },
    });

    const log = readFileSync(join(repo, 'docs/decisions.md'), 'utf8');
    expect(log).toContain(
      '## 2026-11-09 · Stage 7 Detailed designs\n\n**Question:** How do the frontend and API talk?\n\n**Answer:** REST over JSON.\n\n**Rationale:** The scaffold already serves a REST API.\n\n**ADR:** [0002-rest-over-json](adr/0002-rest-over-json.md)\n',
    );
    const adr = readFileSync(join(repo, 'docs/adr/0002-rest-over-json.md'), 'utf8');
    expect(adr).toContain('# 2. REST over JSON');
    expect(adr).toContain('## Context\n\nTwo apps need one contract.');
    expect(adr).toContain('## Decision\n\nREST over JSON. The scaffold already serves a REST API.');
    expect(adr).toContain('## Consequences\n\nEndpoints are versioned by path.');
  });

  it('finds entries missing a field or linking an ADR that does not exist', () => {
    appendDecision(repo, decision);
    const log = `${readFileSync(join(repo, 'docs/decisions.md'), 'utf8')}\n## 2026-11-09 · Stage 2 Designs\n\n**Question:** Which screens?\n\n**Rationale:** The brief.\n\n## Someday\n\n**Question:** a\n\n**Answer:** b\n\n**Rationale:** c\n\n**ADR:** [0009-x](adr/0009-x.md)\n`;
    writeFileSync(join(repo, 'docs/decisions.md'), log);

    expect(validateDecisions(repo)).toEqual([
      'Decision 2 ("Which screens?") has no **Answer:**',
      'Decision 3 ("a") has no "{date} · Stage {n} {name}" heading',
      'Decision 3 ("a") links docs/adr/0009-x.md, which does not exist',
    ]);
  });
});

function context() {
  const commits: Map<string, string>[] = [];
  const reported: ReportedDecision[] = [];
  const ctx: RunContext = {
    ...noPullRequests,
    workspace: mkdtempSync(join(root, 'workspace-')),
    log: async () => undefined,
    listSkillFolders: async () => ({}),
    downloadRepository: async () => execFileSync('tar', ['-czf', '-', '-C', root, 'ledgerline-abc1234']),
    commit: async (_s, _m, files: CommitFile[]) => (
      commits.push(new Map(files.map((f) => [f.path, f.content.toString('utf8')]))),
      'c0ffee'
    ),
    recordDecisions: async (decisions) => void reported.push(...decisions),
  };
  return { ctx, commits, reported };
}

const run = (stage: number, stageName: string): LeasedRun => ({
  runId: `run-${stage}`,
  epoch: 1,
  projectId: 'p',
  directionId: 'd',
  stage,
  stageName,
  checkpointStep: 0,
  checkpointSha: null,
  project: {
    id: 'p',
    name: 'Ledgerline',
    idea: 'Reconcile bank statements.',
    stackPreference: null,
    repository: 'hewn-builds/ledgerline',
  },
  skillsSource: 'unused',
  descopeThresholdDays: 3,
  maxIterations: 10,
});

async function execute(agent: StageAgent, leased: LeasedRun, ctx: RunContext) {
  for (const step of new DocumentStageExecutor(agent).plan(leased, ctx))
    await step.execute(new AbortController().signal);
}

describe('agent stages', () => {
  it('are told to decide for themselves and are never given a tool to ask', async () => {
    const tasks: StageAgentTask[] = [];
    const { ctx } = context();

    await execute({ run: async (task) => (tasks.push(task), new ScriptedStageAgent().run(task)) }, run(1, 'Idea'), ctx);

    expect(tasks[0]!.instructions).toContain(AUTONOMY.split('\n')[0]!);
    expect(tasks[0]!.allowedTools).not.toContain('AskUserQuestion');
  });

  it('commit the ADR an architecture decision writes, with the decision log, and report it', async () => {
    const { ctx, commits, reported } = context();
    const agent: StageAgent = {
      run: async (task) => {
        write(
          task.directory,
          'docs/brief.md',
          '# Brief\n\n## Problem\nX\n\n## Users\nY\n\n## Core features\n- A\n\n## Out of scope\n- B\n\n## Assumptions\n- C\n',
        );
        appendDecision(task.directory, {
          ...decision,
          stage: 1,
          stageName: 'Idea',
          architecture: { context: 'c', consequences: 'd' },
        });
      },
    };

    await execute(agent, run(1, 'Idea'), ctx);

    expect([...commits[0]!.keys()].sort()).toEqual([
      'docs/adr/0002-rest-over-json.md',
      'docs/brief.md',
      'docs/decisions.md',
    ]);
    expect(reported).toEqual([
      {
        question: decision.question,
        answer: decision.answer,
        rationale: decision.rationale,
        adr: 'docs/adr/0002-rest-over-json.md',
      },
    ]);
  });

  it('fail before committing when a decision is incomplete', async () => {
    const { ctx, commits } = context();
    const agent: StageAgent = {
      run: async (task) => {
        write(
          task.directory,
          'docs/brief.md',
          '# Brief\n\n## Problem\nX\n\n## Users\nY\n\n## Core features\n- A\n\n## Out of scope\n- B\n\n## Assumptions\n- C\n',
        );
        write(
          task.directory,
          'docs/decisions.md',
          '# Decisions\n\n## 2026-11-09 · Stage 1 Idea\n\n**Question:** Who?\n',
        );
      },
    };

    await expect(execute(agent, run(1, 'Idea'), ctx)).rejects.toThrow(
      'Idea output is invalid: Decision 1 ("Who?") has no **Answer:**; Decision 1 ("Who?") has no **Rationale:**',
    );
    expect(commits).toEqual([]);
  });
});
