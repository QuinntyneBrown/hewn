import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Designs, PROJECTS_API } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { catchError, combineLatest, map, Observable, of, startWith, switchMap } from 'rxjs';
import {
  caption,
  frameLabel,
  PreviewTheme,
  previewHost,
  previewSrc,
  selection,
} from './designs-view';
import { PreviewControlsComponent } from './preview-controls.component';
import { SandboxedPreviewComponent } from './sandboxed-preview.component';

type Loaded =
  { state: 'loading' } | { state: 'ready'; designs: Designs } | { state: 'error'; message: string };

/**
 * A project's Designs tab (L2-011): every screen and state stage 2 exported, each with a thumbnail and an Open in
 * Magic Patterns link (AC1), and the chosen state in a sandboxed preview on the separate origin (AC2) at XS to XL
 * and Light or Dark (AC3).
 */
@Component({
  selector: 'hw-designs',
  imports: [IconComponent, RouterLink, PreviewControlsComponent, SandboxedPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './designs.component.html',
  styles: `
    .state-thumb {
      position: relative;
      overflow: hidden;
    }
    .state-thumb iframe {
      position: absolute;
      inset: 0 auto auto 0;
      width: 1200px;
      height: 900px;
      border: 0;
      transform: scale(calc(40 / 1200));
      transform-origin: 0 0;
      pointer-events: none;
      background: transparent;
    }
  `,
})
export class DesignsComponent {
  private readonly api = inject(PROJECTS_API);
  private readonly sanitizer = inject(DomSanitizer);

  readonly projectId = input.required<string>();
  readonly projectName = input.required<string>();
  /** Bumped by Try again. */
  private readonly attempt = signal(0);

  protected readonly width = signal<number>(992);
  protected readonly theme = signal<PreviewTheme>('light');
  /** The chosen state's path; null shows the first. */
  private readonly chosen = signal<string | null>(null);

  private readonly loaded$: Observable<Loaded> = combineLatest([
    toObservable(this.projectId),
    toObservable(this.attempt),
  ]).pipe(
    switchMap(([id]) =>
      this.api.getDesigns(id).pipe(
        map((designs): Loaded => ({ state: 'ready', designs })),
        catchError((error: unknown) => of<Loaded>({ state: 'error', message: errorText(error) })),
        startWith<Loaded>({ state: 'loading' }),
      ),
    ),
  );

  protected readonly loaded = toSignal(this.loaded$, {
    initialValue: { state: 'loading' } as Loaded,
  });

  protected readonly designs = computed(() => {
    const loaded = this.loaded();
    return loaded.state === 'ready' ? loaded.designs : null;
  });

  protected readonly caption = computed(() => (this.designs() ? caption(this.designs()!) : ''));

  protected readonly selected = computed(() => {
    const designs = this.designs();
    return designs ? selection(designs, this.chosen()) : null;
  });

  protected readonly label = computed(() => {
    const s = this.selected();
    return s ? frameLabel(s.screen.title, s.state.label, this.width(), this.theme()) : '';
  });

  protected readonly host = computed(() => {
    const s = this.selected();
    return s ? previewHost(s.state.previewUrl) : '';
  });

  /** Thumbnails show each state small, light, from the same sandboxed origin as the preview. */
  private readonly thumbnails = new Map<string, SafeResourceUrl>();
  protected thumbnail(previewUrl: string): SafeResourceUrl {
    let url = this.thumbnails.get(previewUrl);
    if (!url) {
      url = this.sanitizer.bypassSecurityTrustResourceUrl(previewSrc(previewUrl, 'light'));
      this.thumbnails.set(previewUrl, url);
    }
    return url;
  }

  protected choose(path: string, event: Event): void {
    event.preventDefault();
    this.chosen.set(path);
    document.getElementById('preview')?.scrollIntoView?.({ block: 'nearest' });
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}

/** The manifest's problem names the commit it couldn't read; anything else says what the API did. */
function errorText(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const title = (error.error as { code?: string; title?: string } | null)?.title;
    if (error.status === 502 && title)
      return `${title}. The exported mocks are still in the repository.`;
    if (error.status) return `The Hewn API returned ${error.status} ${error.statusText}.`;
  }
  return 'The Hewn API did not answer.';
}
