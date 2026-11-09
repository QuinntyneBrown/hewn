import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  applyEvent,
  Direction,
  Project,
  PROJECT_EVENTS,
  ProjectEvent,
  PROJECTS_API,
} from '@hewn/api';
import { IconComponent, StatusComponent, StatusIconComponent } from '@hewn/components';
import {
  catchError,
  filter,
  map,
  Observable,
  of,
  scan,
  shareReplay,
  startWith,
  switchMap,
  throttleTime,
  asyncScheduler,
  timer,
} from 'rxjs';
import {
  clockTime,
  directionTitle,
  featureOutcome,
  formatDuration,
  headerStatus,
} from './pipeline-view';

type Loaded = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; project: Project };

/** The project page: header and pipeline, kept current by the live event stream. */
@Component({
  selector: 'hw-project-page',
  imports: [RouterLink, IconComponent, StatusComponent, StatusIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project.page.html',
})
export class ProjectPage {
  private readonly api = inject(PROJECTS_API);
  private readonly events = inject(PROJECT_EVENTS);

  readonly projectId = input.required<string>();

  /** The snapshot from GET, then every later event folded in. */
  private readonly live$: Observable<{ loaded: Loaded; event: ProjectEvent | null }> = toObservable(
    this.projectId,
  ).pipe(
    switchMap((id) =>
      this.api.getProject(id).pipe(
        switchMap((snapshot) =>
          this.events.follow(id, snapshot.lastSequence).pipe(
            scan(
              (acc, event) => ({
                project: applyEvent(acc.project, event),
                event: event as ProjectEvent | null,
              }),
              { project: snapshot, event: null as ProjectEvent | null },
            ),
            startWith({ project: snapshot, event: null }),
            map(({ project, event }) => ({ loaded: { state: 'ready', project } as Loaded, event })),
          ),
        ),
        catchError(() => of({ loaded: { state: 'missing' } as Loaded, event: null })),
        startWith({ loaded: { state: 'loading' } as Loaded, event: null }),
      ),
    ),
    // One GET and one hub follow, shared by the page state and the announcer.
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private readonly live = toSignal(this.live$, {
    initialValue: { loaded: { state: 'loading' } as Loaded, event: null },
  });

  protected readonly loaded = computed(() => this.live().loaded);

  protected readonly project = computed(() => {
    const loaded = this.loaded();
    return loaded.state === 'ready' ? loaded.project : null;
  });

  /** The direction being worked on, or the latest one. */
  protected readonly direction = computed<Direction | null>(() => {
    const directions = this.project()?.directions ?? [];
    return (
      directions.find((d) => d.status === 'Running' || d.status === 'Paused') ??
      directions.find((d) => d.status === 'Queued') ??
      directions.at(-1) ??
      null
    );
  });

  /** Directions waiting behind the one shown, first in, first out (L2-004 AC4, L2-005 AC4). */
  protected readonly queued = computed(() => {
    const shown = this.direction();
    return (this.project()?.directions ?? []).filter(
      (d) => d.status === 'Queued' && d.id !== shown?.id,
    );
  });

  protected readonly title = directionTitle;
  protected readonly clockTime = clockTime;
  protected readonly featureOutcome = featureOutcome;

  protected readonly status = computed(() => {
    const project = this.project();
    return project ? headerStatus(project.status, this.direction()?.status ?? null) : 'Idle';
  });

  /** Ticks once a second so a running stage's duration counts up. */
  private readonly now = toSignal(timer(0, 1000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });

  /** Stage changes for the polite live region, at most one announcement a second (the latest wins). */
  protected readonly announcement = toSignal(
    this.live$.pipe(
      map(({ event }) => event),
      filter((event): event is ProjectEvent => event?.type === 'StageChanged'),
      throttleTime(1000, asyncScheduler, { leading: true, trailing: true }),
      map(
        (event) =>
          `Stage ${event.payload['stage']}, ${event.payload['name']}, ${event.payload['status']}`,
      ),
    ),
    { initialValue: '' },
  );

  protected duration(startedAt: string | null, endedAt: string | null): string {
    return formatDuration(startedAt, endedAt, endedAt ? 0 : this.now());
  }
}
