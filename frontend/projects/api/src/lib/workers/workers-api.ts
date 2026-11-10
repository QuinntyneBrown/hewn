import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { toFieldErrors } from '../problems/field-errors';

/** Whether workers may lease new runs (L2-029 AC4); off after Stop all workers until Start workers. */
export interface Leasing {
  stopped: boolean;
  changedBy: string | null;
  changedAt: string | null;
}

export interface Worker {
  id: string;
  name: string;
  host: string;
  location: 'Local' | 'Cloud';
  version: string;
  status: 'Busy' | 'Idle' | 'Offline';
  online: boolean;
  lastSeenAt: string;
  registeredAt: string;
  workingOn: { projectId: string; projectName: string; stage: number; stageName: string } | null;
  /** True while a run this worker halted waits at its checkpoint for Start workers. */
  holding: boolean;
}

export interface Workers {
  leasing: Leasing;
  workers: Worker[];
}

/** Stop all workers' answer: `unconfirmed` names each worker that didn't hear the halt within 10 seconds. */
export interface StopWorkersResult {
  stopped: boolean;
  halted: number;
  unconfirmed: string[];
}

/** The expiries an Owner may choose for a worker token (L2-041 AC3). */
export type WorkerTokenExpiry = 30 | 90 | 365;

export interface NewWorkerToken {
  name: string;
  location: 'Local' | 'Cloud';
  expiresInDays: WorkerTokenExpiry;
}

/** A token just created. `token` is returned this once; Hewn keeps only its hash (L2-041 AC1). */
export interface CreatedWorkerToken {
  id: string;
  name: string;
  location: 'Local' | 'Cloud';
  expiresAt: string;
  token: string;
}

/** The workers and the leasing switch. Anyone signed in reads them; Stop, Start, tokens and Revoke are 403 for a Viewer. */
export interface WorkersApi {
  list(): Observable<Workers>;
  stop(): Observable<StopWorkersResult>;
  start(): Observable<Leasing>;
  /** Errors with FieldErrorsProblem for a name outside 3–40 lowercase letters, digits or hyphens. */
  createToken(token: NewWorkerToken): Observable<CreatedWorkerToken>;
  /** Its token stops working; it is disconnected within 10 seconds and its lease released (L2-041 AC2). */
  revoke(workerId: string): Observable<void>;
}

export const WORKERS_API = new InjectionToken<WorkersApi>('WorkersApi');

@Injectable()
export class HttpWorkersApi implements WorkersApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Workers> {
    return this.http.get<Workers>('/api/workers');
  }

  stop(): Observable<StopWorkersResult> {
    return this.http.post<StopWorkersResult>('/api/workers/stop', {});
  }

  start(): Observable<Leasing> {
    return this.http.post<Leasing>('/api/workers/start', {});
  }

  createToken(token: NewWorkerToken): Observable<CreatedWorkerToken> {
    return this.http
      .post<CreatedWorkerToken>('/api/worker-tokens', token)
      .pipe(catchError((error: unknown) => throwError(() => toFieldErrors(error) ?? error)));
  }

  revoke(workerId: string): Observable<void> {
    return this.http.post<void>(`/api/workers/${encodeURIComponent(workerId)}/revoke`, {});
  }
}
