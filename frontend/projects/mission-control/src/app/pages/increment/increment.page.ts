import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IncrementDetail, PROJECT_EVENTS, PROJECTS_API, ProjectEvent } from '@hewn/api';
import { IconComponent, StatusComponent, StatusIconComponent } from '@hewn/components';
import {
  catchError,
  combineLatest,
  filter,
  map,
  merge,
  Observable,
  of,
  scan,
  startWith,
  switchMap,
} from 'rxjs';
import { incrementLook } from '../project/backlog-view';
import { checkLine, incrementTimeline, pullRequestMeta } from './increment-view';

type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; projectName: string; increment: IncrementDetail }
  | { state: 'missing' }
  | { state: 'error'; message: string };

/** Events after which this increment may look different: its progress, its checks, or its direction. */
const CHANGES = new Set(['IncrementChanged', 'CheckChanged', 'DirectionChanged', 'BacklogPlanned']);

const clock = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * An increment followed to merge (journey 13): the test commit and red, each iteration, Blocked with its failing
 * tests, the pull request with its live required checks and body, and the squash-merge. It reads the increment
 * again after each of its events, so checks turn green and the merge shows without a reload (L2-024 AC3, L2-031).
 */
@Component({
  selector: 'hw-increment-page',
  imports: [IconComponent, RouterLink, StatusComponent, StatusIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './increment.page.html',
})
export class IncrementPage {
  private readonly api = inject(PROJECTS_API);
  private readonly events = inject(PROJECT_EVENTS);

  readonly projectId = input.required<string>();
  /** The increment number, from the route. */
  readonly number = input.required<string>();
  /** Bumped by Try again. */
  private readonly attempt = signal(0);

  private readonly loaded$: Observable<Loaded> = combineLatest([
    toObservable(this.projectId),
    toObservable(this.number),
    toObservable(this.attempt),
  ]).pipe(
    switchMap(([id, raw]) => {
      const n = Number(raw);
      return this.api.getProject(id).pipe(
        switchMap((project) => {
          const mine = (e: ProjectEvent) =>
            CHANGES.has(e.type) && (e.payload['number'] === undefined || e.payload['number'] === n);
          // The first read, then one more after each of this increment's events.
          const reads$ = merge(
            of(null),
            this.events.follow(id, project.lastSequence).pipe(filter(mine)),
          ).pipe(
            scan((count) => count + 1, 0),
            switchMap(() => this.api.getIncrement(id, n)),
          );
          return reads$.pipe(
            map((increment): Loaded => ({ state: 'ready', projectName: project.name, increment })),
          );
        }),
        catchError((error: unknown) => of<Loaded>(failure(error))),
        startWith<Loaded>({ state: 'loading' }),
      );
    }),
  );

  protected readonly loaded = toSignal(this.loaded$, {
    initialValue: { state: 'loading' } as Loaded,
  });

  protected readonly increment = computed(() => {
    const loaded = this.loaded();
    return loaded.state === 'ready' ? loaded.increment : null;
  });

  protected readonly projectName = computed(() => {
    const loaded = this.loaded();
    return loaded.state === 'ready' ? loaded.projectName : '';
  });

  protected readonly look = computed(() => {
    const increment = this.increment();
    return increment ? incrementLook(increment.status) : null;
  });

  protected readonly timeline = computed(() => {
    const increment = this.increment();
    return increment
      ? incrementTimeline(increment, (iso) => (iso ? clock.format(new Date(iso)) : ''))
      : [];
  });

  protected readonly checks = computed(() =>
    (this.increment()?.checks ?? []).map((check) => ({ name: check.name, ...checkLine(check) })),
  );

  protected readonly meta = computed(() => {
    const pr = this.increment()?.pullRequest;
    return pr ? pullRequestMeta(pr) : '';
  });

  protected readonly errorMessage = computed(() => {
    const loaded = this.loaded();
    return loaded.state === 'error' ? loaded.message : '';
  });

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}

function failure(error: unknown): Loaded {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 404) return { state: 'missing' };
    const problem = error.error as { title?: string; code?: string } | null;
    if (problem?.code === 'github_failed' && problem.title) {
      return {
        state: 'error',
        message: `The pull request couldn’t be fetched from GitHub: ${problem.title}. Hewn keeps polling its checks every 60 s.`,
      };
    }
    if (error.status)
      return {
        state: 'error',
        message: `The Hewn API returned ${error.status} ${error.statusText}.`,
      };
  }
  return { state: 'error', message: 'The Hewn API did not answer.' };
}
