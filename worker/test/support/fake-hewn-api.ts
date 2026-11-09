import {
  LeaseLostError,
  type CommitFile,
  type HewnApi,
  type LeasedRun,
  type RunOutcome,
  type WorkerRegistration,
} from '../../src/api.ts';

export interface Call {
  method: 'register' | 'lease' | 'heartbeat' | 'checkpoint' | 'result';
  at: number;
  runId?: string;
  step?: number;
  outcome?: RunOutcome;
}

/** In-memory Hewn API: queues one run per stage and offers the next stage only after the previous succeeds. */
export class FakeHewnApi implements HewnApi {
  readonly calls: Call[] = [];
  readonly registrations: WorkerRegistration[] = [];
  /** Answer the next heartbeats with these: 'lost' (409) or 'down' (network error). */
  readonly heartbeatFaults: ('lost' | 'down')[] = [];
  readonly logs: { runId: string; level: string; text: string }[] = [];
  readonly commits: { runId: string; idempotencyKey: string; message: string; paths: string[] }[] = [];
  private readonly queue: LeasedRun[] = [];
  private nextId = 1;

  enqueueStage(stage: number, checkpointStep = 0, lastStage = 10): LeasedRun {
    const run: LeasedRun = {
      runId: `run-${this.nextId++}`,
      epoch: 1,
      projectId: 'project-1',
      directionId: 'direction-1',
      stage,
      stageName: `Stage ${stage}`,
      checkpointStep,
      checkpointSha: null,
      project: {
        id: 'project-1',
        name: 'Ledgerline',
        idea: 'Reconcile statements.',
        stackPreference: null,
        repository: null,
      },
      skillsSource: 'https://github.com/QuinntyneBrown/greenlit.git',
    };
    this.lastStage = lastStage;
    this.queue.push(run);
    return run;
  }

  private lastStage = 10;

  count(method: Call['method']): number {
    return this.calls.filter((c) => c.method === method).length;
  }

  async register(registration: WorkerRegistration): Promise<string> {
    this.record({ method: 'register' });
    this.registrations.push(registration);
    return 'wkr_fake';
  }

  async lease(): Promise<LeasedRun | null> {
    this.record({ method: 'lease' });
    return this.queue.shift() ?? null;
  }

  async heartbeat(_workerId: string, run: LeasedRun): Promise<void> {
    this.record({ method: 'heartbeat', runId: run.runId });
    const fault = this.heartbeatFaults.shift();
    if (fault === 'lost') throw new LeaseLostError();
    if (fault === 'down') throw new Error('connect ECONNREFUSED');
  }

  async checkpoint(_workerId: string, run: LeasedRun, step: number): Promise<void> {
    this.record({ method: 'checkpoint', runId: run.runId, step });
  }

  async result(_workerId: string, run: LeasedRun, outcome: RunOutcome): Promise<void> {
    this.record({ method: 'result', runId: run.runId, outcome });
    if (outcome.outcome === 'Succeeded' && run.stage < this.lastStage) {
      this.enqueueStage(run.stage + 1, 0, this.lastStage);
    }
  }

  async downloadRepository(): Promise<Buffer> {
    return Buffer.alloc(0);
  }

  async openPullRequest(): Promise<{ number: number; url: string }> {
    return { number: 1, url: 'https://github.com/o/r/pull/1' };
  }

  async pullRequestChecks(): Promise<{ name: string; status: string; conclusion: string | null }[]> {
    return [];
  }

  async mergePullRequest(): Promise<string> {
    return 'm3rge';
  }

  async protectDefaultBranch(): Promise<void> {}

  async listSkillFolders(): Promise<Record<string, string[]>> {
    return { '.claude/skills': [], '.agents/skills': [] };
  }

  async commit(
    _workerId: string,
    run: LeasedRun,
    idempotencyKey: string,
    message: string,
    files: CommitFile[],
  ): Promise<string> {
    this.commits.push({ runId: run.runId, idempotencyKey, message, paths: files.map((f) => f.path) });
    return 'c0ffee';
  }

  async log(_workerId: string, run: LeasedRun, lines: { level: string; text: string }[]): Promise<void> {
    this.logs.push(...lines.map((l) => ({ runId: run.runId, ...l })));
  }

  private record(call: Omit<Call, 'at'>): void {
    this.calls.push({ ...call, at: Date.now() });
  }
}
