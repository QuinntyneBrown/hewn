import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DesignSystem, PROJECTS_API } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { catchError, combineLatest, map, Observable, of, startWith, switchMap } from 'rxjs';
import { pageDetail, pageLabel, pageSelection, systemCaption } from './design-system-view';
import { PreviewTheme, previewHost } from './designs-view';
import { PreviewControlsComponent } from './preview-controls.component';
import { SandboxedPreviewComponent } from './sandboxed-preview.component';

type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; system: DesignSystem }
  | { state: 'error'; message: string };

/**
 * A project's Design system tab (L2-012 AC4): the token and component pages stage 3 wrote to docs/design-system/,
 * browsed in the same sandboxed, separate-origin preview as Designs (L2-011 AC2) at XS to XL, Light or Dark.
 */
@Component({
  selector: 'hw-design-system',
  imports: [IconComponent, RouterLink, PreviewControlsComponent, SandboxedPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './design-system.component.html',
})
export class DesignSystemComponent {
  private readonly api = inject(PROJECTS_API);

  readonly projectId = input.required<string>();
  /** Bumped by Try again. */
  private readonly attempt = signal(0);

  protected readonly width = signal<number>(992);
  protected readonly theme = signal<PreviewTheme>('light');
  /** The chosen page's path; null shows the first. */
  private readonly chosen = signal<string | null>(null);

  private readonly loaded$: Observable<Loaded> = combineLatest([
    toObservable(this.projectId),
    toObservable(this.attempt),
  ]).pipe(
    switchMap(([id]) =>
      this.api.getDesignSystem(id).pipe(
        map((system): Loaded => ({ state: 'ready', system })),
        catchError((error: unknown) => of<Loaded>({ state: 'error', message: errorText(error) })),
        startWith<Loaded>({ state: 'loading' }),
      ),
    ),
  );

  protected readonly loaded = toSignal(this.loaded$, {
    initialValue: { state: 'loading' } as Loaded,
  });

  protected readonly system = computed(() => {
    const loaded = this.loaded();
    return loaded.state === 'ready' ? loaded.system : null;
  });

  protected readonly groups = computed(() => {
    const system = this.system();
    if (!system) return [];
    return [
      { name: 'Foundations', pages: system.foundations },
      { name: 'Components', pages: system.components },
    ].filter((g) => g.pages.length > 0);
  });

  protected readonly caption = computed(() => (this.system() ? systemCaption(this.system()!) : ''));

  protected readonly selected = computed(() => {
    const system = this.system();
    return system ? pageSelection(system, this.chosen()) : null;
  });

  protected readonly detail = computed(() => {
    const page = this.selected();
    return page ? pageDetail(page) : '';
  });

  protected readonly label = computed(() => {
    const page = this.selected();
    return page ? pageLabel(page.title, this.width(), this.theme()) : '';
  });

  protected readonly host = computed(() => {
    const page = this.selected();
    return page ? previewHost(page.previewUrl) : '';
  });

  protected choose(path: string, event: Event): void {
    event.preventDefault();
    this.chosen.set(path);
    document.getElementById('preview')?.scrollIntoView?.({ block: 'nearest' });
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}

/** The problem names the commit the design system couldn't be read at; anything else says what the API did. */
function errorText(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const title = (error.error as { code?: string; title?: string } | null)?.title;
    if (error.status === 502 && title) return `${title}. The files are still in the repository.`;
    if (error.status) return `The Hewn API returned ${error.status} ${error.statusText}.`;
  }
  return 'The Hewn API did not answer.';
}
