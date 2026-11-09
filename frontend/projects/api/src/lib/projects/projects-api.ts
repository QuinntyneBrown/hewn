import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { toFieldErrors } from '../problems/field-errors';
import { Project, SubmitProductDirectionRequest, SubmitProductDirectionResult } from './models';

/** Projects and directions. Pages depend on PROJECTS_API, never on the implementation. */
export interface ProjectsApi {
  /** Errors with FieldErrorsProblem when a field rule is broken. */
  submitProductDirection(
    request: SubmitProductDirectionRequest,
  ): Observable<SubmitProductDirectionResult>;
  getProject(id: string): Observable<Project>;
}

export const PROJECTS_API = new InjectionToken<ProjectsApi>('ProjectsApi');

@Injectable()
export class HttpProjectsApi implements ProjectsApi {
  private readonly http = inject(HttpClient);

  submitProductDirection(
    request: SubmitProductDirectionRequest,
  ): Observable<SubmitProductDirectionResult> {
    return this.http
      .post<SubmitProductDirectionResult>('/api/projects', request)
      .pipe(catchError((error: unknown) => throwError(() => toFieldErrors(error) ?? error)));
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`/api/projects/${encodeURIComponent(id)}`);
  }
}
