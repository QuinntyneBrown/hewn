import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { toFieldErrors } from '../problems/field-errors';
import {
  LogLine,
  Project,
  StageDetail,
  ProjectSummary,
  RaiseAndResumeRequest,
  RaiseAndResumeResult,
  DirectionControlResult,
  SubmitFeatureDirectionRequest,
  SubmitProductDirectionRequest,
  SubmitProductDirectionResult,
} from './models';

/** Projects and directions. Pages depend on PROJECTS_API, never on the implementation. */
export interface ProjectsApi {
  /** Errors with FieldErrorsProblem when a field rule is broken. */
  submitProductDirection(
    request: SubmitProductDirectionRequest,
  ): Observable<SubmitProductDirectionResult>;
  getProject(id: string): Observable<Project>;
  listProjects(): Observable<ProjectSummary[]>;
  /** Adds a feature direction (L2-005). Errors with FieldErrorsProblem when a field rule is broken. */
  submitFeatureDirection(
    projectId: string,
    request: SubmitFeatureDirectionRequest,
  ): Observable<SubmitProductDirectionResult>;
  /** A stage's runs, artifacts and decisions (L2-030 AC3). */
  getStageDetail(projectId: string, directionId: string, stage: number): Observable<StageDetail>;
  /** A run's log lines after `after`, oldest first, at most `limit` (the API caps it at 5,000). */
  getRunLog(projectId: string, runId: string, after: number, limit?: number): Observable<LogLine[]>;
  /**
   * Raises a budget-reached direction's budget and resumes it, in one action (L2-053 AC3). Errors with
   * FieldErrorsProblem when the budget is not above the spend, and with the HTTP error (409 with a `code`) otherwise.
   */
  raiseAndResume(
    projectId: string,
    directionId: string,
    request: RaiseAndResumeRequest,
  ): Observable<RaiseAndResumeResult>;
  /** L2-029 AC1: the step in progress finishes, then the direction is Paused. */
  pause(projectId: string, directionId: string): Observable<DirectionControlResult>;
  /** L2-029 AC2: the direction continues from its next step. */
  resume(projectId: string, directionId: string): Observable<DirectionControlResult>;
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

  listProjects(): Observable<ProjectSummary[]> {
    return this.http.get<ProjectSummary[]>('/api/projects');
  }

  submitFeatureDirection(
    projectId: string,
    request: SubmitFeatureDirectionRequest,
  ): Observable<SubmitProductDirectionResult> {
    return this.http
      .post<SubmitProductDirectionResult>(
        `/api/projects/${encodeURIComponent(projectId)}/directions`,
        request,
      )
      .pipe(catchError((error: unknown) => throwError(() => toFieldErrors(error) ?? error)));
  }

  getStageDetail(projectId: string, directionId: string, stage: number): Observable<StageDetail> {
    return this.http.get<StageDetail>(
      `/api/projects/${encodeURIComponent(projectId)}/directions/${encodeURIComponent(directionId)}/stages/${stage}`,
    );
  }

  getRunLog(projectId: string, runId: string, after: number, limit = 5000): Observable<LogLine[]> {
    return this.http.get<LogLine[]>(
      `/api/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}/logs`,
      { params: { after, limit } },
    );
  }

  raiseAndResume(
    projectId: string,
    directionId: string,
    request: RaiseAndResumeRequest,
  ): Observable<RaiseAndResumeResult> {
    return this.http
      .post<RaiseAndResumeResult>(
        `/api/projects/${encodeURIComponent(projectId)}/directions/${encodeURIComponent(directionId)}/raise-and-resume`,
        request,
      )
      .pipe(catchError((error: unknown) => throwError(() => toFieldErrors(error) ?? error)));
  }

  pause(projectId: string, directionId: string): Observable<DirectionControlResult> {
    return this.control(projectId, directionId, 'pause');
  }

  resume(projectId: string, directionId: string): Observable<DirectionControlResult> {
    return this.control(projectId, directionId, 'resume');
  }

  private control(
    projectId: string,
    directionId: string,
    action: 'pause' | 'resume',
  ): Observable<DirectionControlResult> {
    return this.http.post<DirectionControlResult>(
      `/api/projects/${encodeURIComponent(projectId)}/directions/${encodeURIComponent(directionId)}/${action}`,
      {},
    );
  }
}
