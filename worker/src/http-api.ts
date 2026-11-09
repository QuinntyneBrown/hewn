import { LeaseLostError, type HewnApi, type LeasedRun, type RunOutcome, type WorkerRegistration } from './api.ts';

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

  private async post(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.status === 409) throw new LeaseLostError();
    if (!response.ok) throw new Error(`Hewn API ${path} answered ${response.status}`);
    if (response.status === 204) return null;
    return response.json();
  }
}
