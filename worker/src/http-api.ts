import {
  LeaseLostError,
  type CommitFile,
  type HewnApi,
  type LeasedRun,
  type LogLevel,
  type RunOutcome,
  type WorkerRegistration,
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

  async checkpoint(workerId: string, run: LeasedRun, step: number, sha?: string): Promise<void> {
    await this.post(`/api/worker/runs/${run.runId}/checkpoints`, {
      workerId,
      epoch: run.epoch,
      step,
      sha: sha ?? null,
    });
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

  async commit(
    workerId: string,
    run: LeasedRun,
    idempotencyKey: string,
    message: string,
    files: CommitFile[],
  ): Promise<string> {
    const body = (await this.post(`/api/worker/runs/${run.runId}/github/mutations`, {
      workerId,
      epoch: run.epoch,
      kind: 'commit',
      idempotencyKey,
      message,
      files: files.map((f) => ({ path: f.path, contentBase64: f.content.toString('base64') })),
    })) as { sha: string };
    return body.sha;
  }

  async log(workerId: string, run: LeasedRun, lines: { level: LogLevel; text: string }[]): Promise<void> {
    await this.post(`/api/worker/runs/${run.runId}/logs`, { workerId, epoch: run.epoch, lines });
  }

  private post(path: string, body: unknown): Promise<unknown> {
    return this.send('POST', path, body);
  }

  private async send(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 409) throw new LeaseLostError();
    if (!response.ok) throw new Error(`Hewn API ${path.split('?')[0]} answered ${response.status}`);
    if (response.status === 204) return null;
    return response.json();
  }
}
