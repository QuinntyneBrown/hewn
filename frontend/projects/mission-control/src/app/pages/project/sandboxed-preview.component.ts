import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { PreviewTheme, previewSrc } from './designs-view';

/**
 * Project HTML in an iframe on the separate preview origin, sandboxed with scripts allowed and no
 * `allow-same-origin`, so the page runs in an opaque origin and can't read Mission Control's cookies or storage
 * (L2-011 AC2, ADR 0018). The iframe is laid out at the chosen width and scaled to fit the frame, so the page sees
 * exactly 375, 576, 768, 992 or 1200 px (AC3). Also used, small, as a state's thumbnail.
 */
@Component({
  selector: 'hw-sandboxed-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
    .preview__frame {
      position: relative;
    }
    iframe {
      position: absolute;
      inset: 0 auto auto 0;
      border: 0;
      transform-origin: 0 0;
      background: transparent;
    }
  `,
  template: `
    <div
      #frame
      class="preview__frame"
      [class.preview__frame--dark]="theme() === 'dark'"
      [class.preview__frame--narrow]="width() === 375"
      [style.--w]="width() / 16 + 'rem'"
    >
      <iframe
        sandbox="allow-scripts"
        referrerpolicy="no-referrer"
        data-testid="preview-frame"
        [title]="label()"
        [src]="src()"
        [style.width.px]="width()"
        [style.height.px]="frameHeight() / scale()"
        [style.transform]="'scale(' + scale() + ')'"
      ></iframe>
    </div>
  `,
})
export class SandboxedPreviewComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /** A signed URL on the preview origin, from GET /api/projects/{id}/designs. */
  readonly url = input.required<string>();
  readonly width = input.required<number>();
  readonly theme = input<PreviewTheme>('light');
  readonly label = input.required<string>();

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly box = signal({ width: 0, height: 0 });

  // Angular blocks resource URLs it can't vouch for; this one comes from the API and only ever points at the preview
  // origin, whose response carries its own CSP sandbox as well.
  protected readonly src = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(previewSrc(this.url(), this.theme())),
  );
  protected readonly scale = computed(() =>
    this.box().width ? Math.min(1, this.box().width / this.width()) : 1,
  );
  protected readonly frameHeight = computed(() => this.box().height || (this.width() * 3) / 4);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const element = this.frame().nativeElement;
      const observer = new ResizeObserver(() =>
        this.box.set({ width: element.clientWidth, height: element.clientHeight }),
      );
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
