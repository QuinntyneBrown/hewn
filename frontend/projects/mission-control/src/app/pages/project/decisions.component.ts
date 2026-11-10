import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Decisions, PROJECTS_API } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { catchError, combineLatest, map, Observable, of, startWith, switchMap } from 'rxjs';
import { commitLabel, DECISION_STAGES, recordedText, stageFilter } from './decisions-view';

type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; decisions: Decisions }
  | { state: 'error'; message: string };

/**
 * A project's Decisions tab (L2-054 AC3): the questions agents answered for themselves, newest first, each with its
 * stage, answer, rationale and the commit that recorded it. The stage filter (`?stage=`) narrows the list. It reads
 * the decisions again whenever `changes` moves.
 */
@Component({
  selector: 'hw-decisions',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decisions.component.html',
})
export class DecisionsComponent {
  private readonly api = inject(PROJECTS_API);
  private readonly router = inject(Router);

  readonly projectId = input.required<string>();
  readonly repository = input<string | null>(null);
  /** The `stage` query parameter. */
  readonly stage = input<string | undefined>(undefined);
  /** Moves on each DecisionRecorded event. */
  readonly changes = input(0);
  private readonly attempt = signal(0);

  protected readonly stages = DECISION_STAGES;
  protected readonly filter = computed(() => stageFilter(this.stage()));
  protected readonly filterName = computed(
    () => DECISION_STAGES.find((s) => s.number === this.filter())?.name ?? '',
  );

  private readonly loaded$: Observable<Loaded> = combineLatest([
    toObservable(this.projectId),
    toObservable(this.filter),
    toObservable(this.changes),
    toObservable(this.attempt),
  ]).pipe(
    switchMap(([id, stage], index) =>
      this.api.getDecisions(id, stage).pipe(
        map((decisions): Loaded => ({ state: 'ready', decisions })),
        catchError((error: unknown) =>
          of<Loaded>({ state: 'error', message: errorText(error, this.repository()) }),
        ),
        index === 0 ? startWith<Loaded>({ state: 'loading' }) : (source) => source,
      ),
    ),
  );

  protected readonly loaded = toSignal(this.loaded$, {
    initialValue: { state: 'loading' } as Loaded,
  });

  protected readonly recordedText = recordedText;
  protected readonly commitLabel = commitLabel;

  protected choose(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    void this.router.navigate(['/projects', this.projectId(), 'decisions'], {
      queryParams: value ? { stage: value } : {},
    });
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}

function errorText(error: unknown, repository: string | null): string {
  const title =
    error instanceof HttpErrorResponse ? (error.error as { title?: unknown } | null)?.title : null;
  const next = 'Decisions are still being recorded in the repository.';
  if (typeof title === 'string' && title) return `${title.replace(/\.$/, '')}. ${next}`;
  if (error instanceof HttpErrorResponse && error.status) {
    return `The Hewn API returned ${error.status} ${error.statusText}. ${next}`;
  }
  return `docs/decisions.md couldn’t be read${repository ? ` from ${repository}` : ''}. ${next}`;
}
