import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** What the audit log records (L2-044 AC1). */
export type AuditAction =
  | 'SignIn'
  | 'DirectionSubmitted'
  | 'Pause'
  | 'Resume'
  | 'Cancel'
  | 'Merge'
  | 'TokenCreated'
  | 'TokenRevoked'
  | 'StopAll'
  | 'StartWorkers';

/** One entry: who, what, when, to what, and from which IP (null for a merge Hewn made). */
export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: AuditAction;
  projectId: string | null;
  target: string | null;
  ipAddress: string | null;
}

export interface AuditProject {
  id: string;
  name: string;
}

/** A page of entries, newest first; `projects` names every project in the log; `next` reads the page after. */
export interface AuditLog {
  entries: AuditEntry[];
  projects: AuditProject[];
  next: string | null;
}

export interface AuditFilter {
  project?: string | null;
  action?: AuditAction | null;
  before?: string | null;
}

/** The audit log, for Owners (403 for a Viewer). Read-only: nothing writes or edits an entry through the API. */
export interface AuditApi {
  list(filter: AuditFilter): Observable<AuditLog>;
}

export const AUDIT_API = new InjectionToken<AuditApi>('AuditApi');

@Injectable()
export class HttpAuditApi implements AuditApi {
  private readonly http = inject(HttpClient);

  list(filter: AuditFilter): Observable<AuditLog> {
    let params = new HttpParams();
    if (filter.project) params = params.set('project', filter.project);
    if (filter.action) params = params.set('action', filter.action);
    if (filter.before) params = params.set('before', filter.before);
    return this.http.get<AuditLog>('/api/audit', { params });
  }
}
