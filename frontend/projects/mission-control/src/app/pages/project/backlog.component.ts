import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Backlog, PROJECTS_API } from '@hewn/api';
import { IconComponent, StatusComponent } from '@hewn/components';
import { catchError, combineLatest, map, Observable, of, startWith, switchMap } from 'rxjs';
import { blockedNotice, estimate, incrementLook, pullRequest } from './backlog-view';

type Loaded =
  { state: 'loading' } | { state: 'ready'; backlog: Backlog } | { state: 'error'; message: string };

/**
 * A project's Backlog tab: the current direction's increments in order with status, estimate and pull request
 * (L2-020 AC2), the deferred designs apart with their reasons (L2-019 AC4), and the merged and estimated totals.
 * It reads the backlog again whenever `changes` moves, so a merge shows without a reload (L2-025 AC4).
 */
@Component({
  selector: 'hw-backlog',
  imports: [IconComponent, RouterLink, StatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './backlog.component.html',
})
export class BacklogComponent {
  private readonly api = inject(PROJECTS_API);

  readonly projectId = input.required<string>();
  /** Counts the project events that can change the backlog; each one reads it again. */
  readonly changes = input(0);
  /** Bumped by Try again. */
  private readonly attempt = signal(0);

  private readonly loaded$: Observable<Loaded> = combineLatest([
    toObservable(this.projectId),
    toObservable(this.changes),
    toObservable(this.attempt),
  ]).pipe(
    switchMap(([id], i) =>
      this.api.getBacklog(id).pipe(
        map((backlog): Loaded => ({ state: 'ready', backlog })),
        catchError((error: unknown) =>
          of<Loaded>({
            state: 'error',
            message:
              error instanceof HttpErrorResponse && error.status
                ? `The Hewn API returned ${error.status} ${error.statusText}.`
                : 'The Hewn API did not answer.',
          }),
        ),
        // Only the first load shows the skeleton; later reads keep the rows on screen until they arrive.
        i === 0 ? startWith<Loaded>({ state: 'loading' }) : (source: Observable<Loaded>) => source,
      ),
    ),
  );

  protected readonly loaded = toSignal(this.loaded$, {
    initialValue: { state: 'loading' } as Loaded,
  });

  protected readonly backlog = computed(() => {
    const loaded = this.loaded();
    return loaded.state === 'ready' ? loaded.backlog : null;
  });

  protected readonly rows = computed(() =>
    (this.backlog()?.increments ?? []).map((i) => ({
      ...i,
      look: incrementLook(i.status),
      estimate: estimate(i.estimateDays),
      pr: pullRequest(i),
      l2: i.l2Ids.join(', '),
    })),
  );

  protected readonly deferred = computed(() =>
    (this.backlog()?.deferred ?? []).map((d) => ({
      ...d,
      estimate: estimate(d.estimateDays),
      l2: d.l2Ids.join(', '),
    })),
  );

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }

  protected readonly blocked = computed(() => {
    const increments = this.backlog()?.increments ?? [];
    return increments
      .filter((i) => i.status === 'Blocked')
      .map((i) => ({ number: i.number, ...blockedNotice(i, increments) }));
  });
}
