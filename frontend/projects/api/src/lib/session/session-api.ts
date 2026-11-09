import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type Role = 'Owner' | 'Viewer';

export interface Me {
  login: string;
  role: Role;
}

export interface PublicConfig {
  githubOwner: string | null;
  defaultBudgetUsd: number;
}

/** The signed-in user and public settings. */
export interface SessionApi {
  /** Also refreshes the XSRF-TOKEN cookie used on writes. Errors with 401 when signed out. */
  me(): Observable<Me>;
  config(): Observable<PublicConfig>;
}

export const SESSION_API = new InjectionToken<SessionApi>('SessionApi');

@Injectable()
export class HttpSessionApi implements SessionApi {
  private readonly http = inject(HttpClient);

  me(): Observable<Me> {
    return this.http.get<Me>('/api/me');
  }

  config(): Observable<PublicConfig> {
    return this.http.get<PublicConfig>('/api/config');
  }
}
