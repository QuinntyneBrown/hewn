import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { toFieldErrors } from '../problems/field-errors';
import { Role } from '../session/session-api';

/** A GitHub login on the allow list (L2-038 AC5). */
export interface AllowListEntry {
  login: string;
  role: Role;
  /** ISO time of the last sign-in; null when it has never signed in. */
  lastSignInAt: string | null;
}

/** GitHub couldn't say whether the login exists (502 github_failed); nothing was added. */
export class GitHubUnavailableProblem extends Error {}

/** Who can sign in. Anyone signed in reads it; an Owner adds and removes logins. */
export interface AllowListApi {
  list(): Observable<AllowListEntry[]>;
  /**
   * Errors with FieldErrorsProblem when the login is already listed, malformed or unknown to GitHub, with
   * GitHubUnavailableProblem when GitHub can't confirm it, and 403 for a Viewer.
   */
  add(entry: { login: string; role: Role }): Observable<AllowListEntry>;
  /** Their sessions end at once. Errors with 409 cannot_remove_yourself for the caller's own login. */
  remove(login: string): Observable<void>;
}

export const ALLOW_LIST_API = new InjectionToken<AllowListApi>('AllowListApi');

@Injectable()
export class HttpAllowListApi implements AllowListApi {
  private readonly http = inject(HttpClient);

  list(): Observable<AllowListEntry[]> {
    return this.http.get<AllowListEntry[]>('/api/allow-list');
  }

  add(entry: { login: string; role: Role }): Observable<AllowListEntry> {
    return this.http.post<AllowListEntry>('/api/allow-list', entry).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 502) {
          const title = (error.error as { title?: string } | null)?.title;
          return throwError(
            () => new GitHubUnavailableProblem(title ?? 'GitHub couldn’t confirm the login exists'),
          );
        }
        return throwError(() => toFieldErrors(error) ?? error);
      }),
    );
  }

  remove(login: string): Observable<void> {
    return this.http.delete<void>(`/api/allow-list/${encodeURIComponent(login)}`);
  }
}
