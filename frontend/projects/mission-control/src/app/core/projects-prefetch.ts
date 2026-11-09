import { Injectable, inject } from '@angular/core';
import { PROJECTS_API, ProjectSummary } from '@hewn/api';
import { Observable, shareReplay } from 'rxjs';

/**
 * Starts the projects list request with the session load when the app opens on Projects, instead of a round trip
 * later once the page is routed (L2-045 AC1). The page's first load takes it; every later load asks again.
 */
@Injectable({ providedIn: 'root' })
export class ProjectsPrefetch {
  private readonly api = inject(PROJECTS_API);
  private pending: Observable<ProjectSummary[]> | null = null;

  start(): void {
    this.pending = this.api.listProjects().pipe(shareReplay(1));
    // Started now; a failure surfaces when the page takes it.
    this.pending.subscribe({ error: () => undefined });
  }

  list(): Observable<ProjectSummary[]> {
    const pending = this.pending ?? this.api.listProjects();
    this.pending = null;
    return pending;
  }
}
