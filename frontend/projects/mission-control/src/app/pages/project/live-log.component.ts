import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  Injector,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { LogLine } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { logTime, logWindow, MAX_RENDERED_LINES } from './pipeline-view';

/** A virtualized line is one row tall; this is the fallback until a rendered line is measured. */
const DEFAULT_ROW_PX = 20;

/**
 * A run's log (L2-033). It follows the newest line; scrolled up, it stays put and offers "{n} new lines — Jump to
 * latest". Above 500 lines it renders only a window around the view, so no more than 500 line elements are in the
 * DOM, and each line keeps to one row so the window's position is exact.
 */
@Component({
  selector: 'hw-live-log',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .log__box--virtual .log__text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  template: `
    <div class="log">
      <div
        #box
        class="log__box"
        [class.log__box--virtual]="virtual()"
        role="log"
        aria-label="Run log"
        tabindex="0"
        (scroll)="onScroll()"
      >
        @if (virtual()) {
          <div aria-hidden="true" [style.height.px]="window().start * rowPx()"></div>
        }
        @for (line of visible(); track line.line) {
          <div class="log__line">
            <span class="log__t">{{ time(line.at) }}</span
            ><span class="log__lvl" [class]="'log__lvl log__lvl--' + line.level">{{
              line.level
            }}</span
            ><span class="log__text">{{ line.text }}</span>
          </div>
        }
        @if (virtual()) {
          <div
            aria-hidden="true"
            [style.height.px]="(lines().length - window().end) * rowPx()"
          ></div>
        }
        @if (live()) {
          <span class="log__cursor" aria-hidden="true"></span>
        }
      </div>
      @if (unseen() > 0) {
        <button class="log__jump" type="button" (click)="jumpToLatest()">
          <svg hw-icon name="arrowDown" class="icon--xs"></svg> {{ unseen() }} new
          {{ unseen() === 1 ? 'line' : 'lines' }} — Jump to latest
        </button>
      }
    </div>
  `,
})
export class LiveLogComponent {
  readonly lines = input.required<LogLine[]>();
  /** The run is still going: show the cursor. */
  readonly live = input(false);

  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  private readonly injector = inject(Injector);

  /** Following the newest line; false once the user scrolls up. */
  private readonly following = signal(true);
  /** Lines that arrived while the user was scrolled up. */
  protected readonly unseen = signal(0);
  private readonly scrollTop = signal(0);
  private readonly viewportPx = signal(460);
  protected readonly rowPx = signal(DEFAULT_ROW_PX);
  private seen = 0;

  protected readonly virtual = computed(() => this.lines().length > MAX_RENDERED_LINES);
  protected readonly window = computed(() =>
    logWindow(
      this.lines().length,
      this.scrollTop(),
      this.viewportPx(),
      this.rowPx(),
      this.following(),
    ),
  );
  protected readonly visible = computed(() => {
    const { start, end } = this.window();
    return this.lines().slice(start, end);
  });

  protected readonly time = logTime;

  constructor() {
    effect(() => {
      const count = this.lines().length;
      untracked(() => {
        if (count < this.seen) {
          // A different run's log: start again, following.
          this.following.set(true);
          this.unseen.set(0);
        }
        const added = Math.max(0, count - this.seen);
        this.seen = count;
        if (this.following()) {
          afterNextRender(() => this.scrollToEnd(), { injector: this.injector });
        } else if (added > 0) {
          this.unseen.update((n) => n + added);
        }
      });
    });
  }

  protected onScroll(): void {
    const box = this.box().nativeElement;
    this.scrollTop.set(box.scrollTop);
    this.viewportPx.set(box.clientHeight);
    this.measureRow(box);
    const atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
    this.following.set(atEnd);
    if (atEnd) this.unseen.set(0);
  }

  protected jumpToLatest(): void {
    this.following.set(true);
    this.unseen.set(0);
    this.scrollToEnd();
    this.box().nativeElement.focus();
  }

  private scrollToEnd(): void {
    const box = this.box().nativeElement;
    this.measureRow(box);
    box.scrollTop = box.scrollHeight;
    this.scrollTop.set(box.scrollTop);
    this.viewportPx.set(box.clientHeight);
  }

  /** Virtualized lines keep to one row, so one rendered line gives every line's height. */
  private measureRow(box: HTMLElement): void {
    const line = box.querySelector<HTMLElement>('.log__line');
    if (this.virtual() && line && line.offsetHeight > 0) this.rowPx.set(line.offsetHeight);
  }
}
