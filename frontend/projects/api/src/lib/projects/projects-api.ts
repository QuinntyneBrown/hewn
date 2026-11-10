import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { toFieldErrors } from '../problems/field-errors';
import { toRateLimited } from '../problems/rate-limited';
import {
  Artifacts,
  Backlog,
  Designs,
  DesignSystem,
  IncrementDetail,
  LogLine,
  Project,
  StageDetail,
  ProjectSummary,
  RaiseAndResumeRequest,
  RaiseAndResumeResult,
  CancelDirectionResult,
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
  /** The current direction's backlog: increments in order, deferred designs apart, and the totals (L2-020 AC2). */
  getBacklog(projectId: string): Observable<Backlog>;
  /** One increment of the current direction followed to merge; GitHub failures are 502 `github_failed`. */
  getIncrement(projectId: string, number: number): Observable<IncrementDetail>;
  /** Every exported screen and state with signed preview URLs; an unreadable manifest is 502 `github_failed`. */
  getDesigns(projectId: string): Observable<Designs>;
  /** The design system's token and component pages with signed preview URLs; unreadable tokens are 502 `github_failed`. */
  getDesignSystem(projectId: string): Observable<DesignSystem>;
  /** Each stage's artifacts with path, version (commit SHA), time and a GitHub link at that SHA (L2-034 AC2). */
  getArtifacts(projectId: string): Observable<Artifacts>;
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
  /** L2-029 AC3: answers once the worker stopped its run or 10 seconds passed. */
  cancel(projectId: string, directionId: string): Observable<CancelDirectionResult>;
  /** L2-006 AC3: a Blocked direction's failed stage runs again from its start with its retry counter reset. */
  retryStage(projectId: string, directionId: string): Observable<DirectionControlResult>;
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
      .pipe(
        catchError((error: unknown) =>
          throwError(() => toFieldErrors(error) ?? toRateLimited(error) ?? error),
        ),
      );
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`/api/projects/${encodeURIComponent(id)}`);
  }

  listProjects(): Observable<ProjectSummary[]> {
    return this.http.get<ProjectSummary[]>('/api/projects');
  }

  getBacklog(projectId: string): Observable<Backlog> {
    return this.http.get<Backlog>(`/api/projects/${encodeURIComponent(projectId)}/backlog`);
  }

  getIncrement(projectId: string, number: number): Observable<IncrementDetail> {
    return this.http.get<IncrementDetail>(
      `/api/projects/${encodeURIComponent(projectId)}/increments/${number}`,
    );
  }

  getDesigns(projectId: string): Observable<Designs> {
    return this.http.get<Designs>(`/api/projects/${encodeURIComponent(projectId)}/designs`);
  }

  getArtifacts(projectId: string): Observable<Artifacts> {
    return this.http.get<Artifacts>(`/api/projects/${encodeURIComponent(projectId)}/artifacts`);
  }

  getDesignSystem(projectId: string): Observable<DesignSystem> {
    return this.http.get<DesignSystem>(
      `/api/projects/${encodeURIComponent(projectId)}/design-system`,
    );
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
      .pipe(
        catchError((error: unknown) =>
          throwError(() => toFieldErrors(error) ?? toRateLimited(error) ?? error),
        ),
      );
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

  cancel(projectId: string, directionId: string): Observable<CancelDirectionResult> {
    return this.http.post<CancelDirectionResult>(
      `/api/projects/${encodeURIComponent(projectId)}/directions/${encodeURIComponent(directionId)}/cancel`,
      {},
    );
  }

  retryStage(projectId: string, directionId: string): Observable<DirectionControlResult> {
    return this.control(projectId, directionId, 'retry-stage');
  }

  private control(
    projectId: string,
    directionId: string,
    action: 'pause' | 'resume' | 'retry-stage',
  ): Observable<DirectionControlResult> {
    return this.http.post<DirectionControlResult>(
      `/api/projects/${encodeURIComponent(projectId)}/directions/${encodeURIComponent(directionId)}/${action}`,
      {},
    );
  }
}
