import {
  HewnApiError,
  LeaseLostError,
  type CommitOptions,
  type Increment,
  type IncrementUpdate,
  type BacklogReport,
  type ScopeReport,
  type ModelCallReport,
  type ModelCallVerdict,
  type CheckpointVerdict,
  type RunControl,
  type ReportedDecision,
  type CommitFile,
  type HewnApi,
  type LeasedRun,
  type LogLevel,
  type RunOutcome,
  type WorkerRegistration,
  type CheckRun,
  type PullRequest,
} from './api.ts';

/** The worker protocol over HTTP. The token is sent only in the Authorization header and never logged. */
export class HttpHewnApi implements HewnApi {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  async register(registration: WorkerRegistration): Promise<string> {
    const body = (await this.post('/api/worker/register', registration)) as { workerId: string };
    return body.workerId;
  }

  async lease(workerId: string): Promise<LeasedRun | null> {
    return (await this.post('/api/worker/lease', { workerId })) as LeasedRun | null;
  }

  async heartbeat(workerId: string, run: LeasedRun): Promise<void> {
    await this.post(`/api/worker/runs/${run.runId}/heartbeat`, { workerId, epoch: run.epoch });
  }

  async control(
    workerId: string,
    run: LeasedRun,
    waitSeconds: number,
    signal: AbortSignal,
  ): Promise<RunControl | null> {
    const query = new URLSearchParams({ workerId, epoch: String(run.epoch), waitSeconds: String(waitSeconds) });
    const answer = (await this.send('GET', `/api/worker/runs/${run.runId}/control?${query}`, undefined, signal)) as {
      control?: RunControl;
    } | null;
    return answer?.control ?? null;
  }

  async checkpoint(workerId: string, run: LeasedRun, step: number, sha?: string): Promise<CheckpointVerdict> {
    const answer = (await this.post(`/api/worker/runs/${run.runId}/checkpoints`, {
      workerId,
      epoch: run.epoch,
      step,
      sha: sha ?? null,
    })) as { verdict?: CheckpointVerdict } | undefined;
    return answer?.verdict ?? 'Continue';
  }

  async result(workerId: string, run: LeasedRun, outcome: RunOutcome): Promise<void> {
    await this.post(`/api/worker/runs/${run.runId}/result`, { workerId, epoch: run.epoch, ...outcome });
  }

  async listSkillFolders(workerId: string, run: LeasedRun): Promise<Record<string, string[]>> {
    const query = new URLSearchParams({ workerId, epoch: String(run.epoch) });
    return (await this.send('GET', `/api/worker/runs/${run.runId}/repository/skill-folders?${query}`)) as Record<
      string,
      string[]
    >;
  }

  async downloadRepository(workerId: string, run: LeasedRun): Promise<Buffer> {
    const query = new URLSearchParams({ workerId, epoch: String(run.epoch) });
    const response = await this.fetch('GET', `/api/worker/runs/${run.runId}/repository/archive?${query}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async commit(
    workerId: string,
    run: LeasedRun,
    idempotencyKey: string,
    message: string,
    files: CommitFile[],
    branch?: string,
    options?: CommitOptions,
  ): Promise<string> {
    const body = (await this.post(`/api/worker/runs/${run.runId}/github/mutations`, {
      workerId,
      epoch: run.epoch,
      kind: 'commit',
      idempotencyKey,
      message,
      files: files.map((f) => ({ path: f.path, contentBase64: f.content.toString('base64') })),
      ...(branch === undefined ? {} : { branch }),
      ...(options?.rebase ? { rebase: true } : {}),
    })) as { sha: string };
    return body.sha;
  }

  async openPullRequest(
    workerId: string,
    run: LeasedRun,
    idempotencyKey: string,
    request: { head: string; title: string; body: string },
  ): Promise<PullRequest> {
    return (await this.mutate(workerId, run, 'open_pull_request', idempotencyKey, request)) as PullRequest;
  }

  async pullRequestChecks(workerId: string, run: LeasedRun, number: number): Promise<CheckRun[]> {
    const query = new URLSearchParams({ workerId, epoch: String(run.epoch) });
    const body = (await this.send('GET', `/api/worker/runs/${run.runId}/pull-requests/${number}/checks?${query}`)) as {
      checks: CheckRun[];
    };
    return body.checks;
  }

  async nextIncrement(workerId: string, run: LeasedRun): Promise<Increment | null> {
    const query = new URLSearchParams({ workerId, epoch: String(run.epoch) });
    return (await this.send('GET', `/api/worker/runs/${run.runId}/increments/next?${query}`)) as Increment | null;
  }

  async updateIncrement(workerId: string, run: LeasedRun, number: number, update: IncrementUpdate): Promise<void> {
    await this.send('PUT', `/api/worker/runs/${run.runId}/increments/${number}`, {
      workerId,
      epoch: run.epoch,
      ...update,
    });
  }

  async reportBacklog(workerId: string, run: LeasedRun, report: BacklogReport): Promise<void> {
    await this.send('PUT', `/api/worker/runs/${run.runId}/backlog`, { workerId, epoch: run.epoch, ...report });
  }

  async reportScope(workerId: string, run: LeasedRun, report: ScopeReport): Promise<void> {
    await this.send('PUT', `/api/worker/runs/${run.runId}/scope`, { workerId, epoch: run.epoch, ...report });
  }

  async mergePullRequest(workerId: string, run: LeasedRun, idempotencyKey: string, number: number): Promise<string> {
    return ((await this.mutate(workerId, run, 'merge_pull_request', idempotencyKey, { number })) as { sha: string })
      .sha;
  }

  async protectDefaultBranch(
    workerId: string,
    run: LeasedRun,
    idempotencyKey: string,
    checks: string[],
  ): Promise<void> {
    await this.mutate(workerId, run, 'protect_branch', idempotencyKey, { checks });
  }

  private mutate(
    workerId: string,
    run: LeasedRun,
    kind: string,
    idempotencyKey: string,
    fields: object,
  ): Promise<unknown> {
    return this.post(`/api/worker/runs/${run.runId}/github/mutations`, {
      workerId,
      epoch: run.epoch,
      kind,
      idempotencyKey,
      ...fields,
    });
  }

  async startStep(workerId: string, run: LeasedRun, step: number, name: string): Promise<void> {
    await this.send('PUT', `/api/worker/runs/${run.runId}/step`, { workerId, epoch: run.epoch, step, name });
  }

  async recordDecisions(workerId: string, run: LeasedRun, decisions: ReportedDecision[]): Promise<void> {
    await this.post(`/api/worker/runs/${run.runId}/decisions`, { workerId, epoch: run.epoch, decisions });
  }

  async recordModelCall(workerId: string, run: LeasedRun, call: ModelCallReport): Promise<ModelCallVerdict> {
    return (await this.post(`/api/worker/runs/${run.runId}/model-calls`, {
      workerId,
      epoch: run.epoch,
      ...call,
    })) as ModelCallVerdict;
  }

  async log(workerId: string, run: LeasedRun, lines: { level: LogLevel; text: string }[]): Promise<void> {
    await this.post(`/api/worker/runs/${run.runId}/logs`, { workerId, epoch: run.epoch, lines });
  }

  private post(path: string, body: unknown): Promise<unknown> {
    return this.send('POST', path, body);
  }

  private async send(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const response = await this.fetch(method, path, body, signal);
    if (response.status === 204) return null;
    return response.json();
  }

  private async fetch(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      signal,
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 409) throw new LeaseLostError();
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as { code?: string; title?: string } | null;
      throw new HewnApiError(
        `Hewn API ${path.split('?')[0]} answered ${response.status}${problem?.code ? ` (${problem.code})` : ''}`,
        response.status,
        problem?.code ?? null,
      );
    }
    return response;
  }
}
