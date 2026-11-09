import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

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

/** The workers and the leasing switch. Anyone signed in reads them; Stop and Start are 403 for a Viewer. */
export interface WorkersApi {
  list(): Observable<Workers>;
  stop(): Observable<StopWorkersResult>;
  start(): Observable<Leasing>;
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
}
