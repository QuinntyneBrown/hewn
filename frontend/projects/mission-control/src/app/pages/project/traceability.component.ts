import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PROJECTS_API, RequirementTrace, Traceability } from '@hewn/api';
import { IconComponent, IconName } from '@hewn/components';
import { catchError, combineLatest, map, Observable, of, startWith, switchMap } from 'rxjs';
import { emptyText, findRequirements, l1Line, noMatchText, TraceGroup } from './traceability-view';

type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; traceability: Traceability }
  | { state: 'error'; message: string };

/**
 * A project's Traceability tab (L2-035): a searchable list of its L2s and, for the chosen one (`?l2=`), its L1, the
 * designs and journeys that name it, its acceptance tests and its pull requests. "No acceptance test" marks an L2
 * no test names unless it is Deferred. It reads the trace again whenever `changes` moves.
 */
@Component({
  selector: 'hw-traceability',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './traceability.component.html',
})
export class TraceabilityComponent {
  private readonly api = inject(PROJECTS_API);

  readonly projectId = input.required<string>();
  readonly projectName = input('The project');
  /** The L2 to open, from the `l2` query parameter. */
  readonly selected = input<string | undefined>(undefined);
  /** Moves on each event that can change the trace. */
  readonly changes = input(0);
  private readonly attempt = signal(0);

  protected readonly query = signal('');

  private readonly loaded$: Observable<Loaded> = combineLatest([
    toObservable(this.projectId),
    toObservable(this.changes),
    toObservable(this.attempt),
  ]).pipe(
    switchMap(([id], index) =>
      this.api.getTraceability(id).pipe(
        map((traceability): Loaded => ({ state: 'ready', traceability })),
        catchError((error: unknown) => of<Loaded>({ state: 'error', message: errorText(error) })),
        index === 0 ? startWith<Loaded>({ state: 'loading' }) : (source) => source,
      ),
    ),
  );

  protected readonly loaded = toSignal(this.loaded$, {
    initialValue: { state: 'loading' } as Loaded,
  });

  protected readonly requirements = computed(() => {
    const loaded = this.loaded();
    return loaded.state === 'ready' ? loaded.traceability.requirements : [];
  });

  protected readonly found = computed(() => findRequirements(this.requirements(), this.query()));

  /** The L2 the URL names, else the first in the list. */
  protected readonly current = computed<RequirementTrace | null>(() => {
    const all = this.requirements();
    return all.find((r) => r.id === this.selected()) ?? all[0] ?? null;
  });

  protected readonly noMatch = computed(() =>
    noMatchText(this.query(), this.projectName(), this.requirements()),
  );

  protected readonly groups: { key: TraceGroup; label: string; icon: IconName }[] = [
    { key: 'designs', label: 'Designs', icon: 'layout' },
    { key: 'journeys', label: 'Journeys', icon: 'route' },
    { key: 'tests', label: 'Acceptance tests', icon: 'fileCode' },
    { key: 'pullRequests', label: 'Pull requests', icon: 'gitPullRequest' },
  ];

  protected readonly l1Line = l1Line;
  protected readonly emptyText = emptyText;

  protected count(r: RequirementTrace, group: TraceGroup): number {
    return r[group].length;
  }

  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}

function errorText(error: unknown): string {
  const title =
    error instanceof HttpErrorResponse ? (error.error as { title?: unknown } | null)?.title : null;
  if (typeof title === 'string' && title) {
    const next = title.includes('couldn’t be parsed')
      ? 'The repository is unchanged.'
      : 'Try again in a moment.';
    return `${title.replace(/\.$/, '')}. ${next}`;
  }
  if (error instanceof HttpErrorResponse && error.status) {
    return `The Hewn API returned ${error.status} ${error.statusText}. Try again in a moment.`;
  }
  return 'The Hewn API did not answer. Try again in a moment.';
}
