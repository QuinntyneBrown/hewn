import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Artifacts, PROJECTS_API } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { catchError, combineLatest, map, Observable, of, startWith, switchMap } from 'rxjs';
import { committedText, openLabel, shortSha } from './artifacts-view';

type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; artifacts: Artifacts }
  | { state: 'error'; message: string };

/**
 * A project's Artifacts tab (L2-034): each stage's artifacts, newest stage first, with path, version (short SHA), time
 * and a link to GitHub at that commit. It reads them again whenever `changes` moves, so a stage that succeeds shows
 * its files without a reload.
 */
@Component({
  selector: 'hw-artifacts',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './artifacts.component.html',
})
export class ArtifactsComponent {
  private readonly api = inject(PROJECTS_API);

  readonly projectId = input.required<string>();
  /** The repository the project page knows, for the description while the artifacts load. */
  readonly repository = input<string | null>(null);
  /** Moves on each event that can add artifacts. */
  readonly changes = input(0);
  /** Bumped by Try again. */
  private readonly attempt = signal(0);

  private readonly loaded$: Observable<Loaded> = combineLatest([
    toObservable(this.projectId),
    toObservable(this.changes),
    toObservable(this.attempt),
  ]).pipe(
    switchMap(([id], index) =>
      this.api.getArtifacts(id).pipe(
        map((artifacts): Loaded => ({ state: 'ready', artifacts })),
        catchError((error: unknown) => of<Loaded>({ state: 'error', message: errorText(error) })),
        // A refresh keeps the list on screen; only the first read shows the skeleton.
        index === 0 ? startWith<Loaded>({ state: 'loading' }) : (source) => source,
      ),
    ),
  );

  protected readonly loaded = toSignal(this.loaded$, {
    initialValue: { state: 'loading' } as Loaded,
  });

  protected readonly artifacts = computed(() => {
    const loaded = this.loaded();
    return loaded.state === 'ready' ? loaded.artifacts : null;
  });

  protected readonly repo = computed(() => this.artifacts()?.repository ?? this.repository());

  protected readonly shortSha = shortSha;
  protected readonly openLabel = openLabel;
  protected when(at: string): string {
    return committedText(at);
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}

function errorText(error: unknown): string {
  const title =
    error instanceof HttpErrorResponse ? (error.error as { title?: unknown } | null)?.title : null;
  if (typeof title === 'string' && title) {
    return `${title.replace(/\.$/, '')}. Try again in a moment.`;
  }
  if (error instanceof HttpErrorResponse && error.status) {
    return `The Hewn API returned ${error.status} ${error.statusText}. Try again in a moment.`;
  }
  return 'The Hewn API did not answer. Try again in a moment.';
}
