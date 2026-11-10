import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { IconComponent } from '@hewn/components';
import { PreviewTheme, WIDTHS } from './designs-view';

/**
 * The preview's Width (XS to XL) and Theme (Light, Dark) radio groups, shared by Designs and the design system
 * (L2-011 AC3, L2-012 AC4). Arrow keys move the choice within a group, as a native radio group does.
 */
@Component({
  selector: 'hw-preview-controls',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <div class="segmented" role="radiogroup" aria-label="Width">
      @for (w of widths; track w.px) {
        <button
          class="segmented__opt"
          type="button"
          role="radio"
          [attr.aria-checked]="width() === w.px"
          [attr.tabindex]="width() === w.px ? 0 : -1"
          [title]="w.px + ' px'"
          (click)="width.set(w.px)"
          (keydown)="step($event, widthValues, width(), setWidth)"
        >
          {{ w.size }}
        </button>
      }
    </div>
    <div class="segmented" role="radiogroup" aria-label="Theme">
      @for (t of themes; track t.id) {
        <button
          class="segmented__opt"
          type="button"
          role="radio"
          [attr.aria-checked]="theme() === t.id"
          [attr.tabindex]="theme() === t.id ? 0 : -1"
          [attr.aria-label]="t.label"
          (click)="theme.set(t.id)"
          (keydown)="step($event, themeValues, theme(), setTheme)"
        >
          <svg hw-icon [name]="t.icon" class="icon--sm"></svg>
        </button>
      }
    </div>
  `,
})
export class PreviewControlsComponent {
  readonly width = model.required<number>();
  readonly theme = model.required<PreviewTheme>();

  protected readonly widths = WIDTHS;
  protected readonly themes: { id: PreviewTheme; label: string; icon: 'sun' | 'moon' }[] = [
    { id: 'light', label: 'Light', icon: 'sun' },
    { id: 'dark', label: 'Dark', icon: 'moon' },
  ];
  protected readonly widthValues = WIDTHS.map((w) => w.px as number);
  protected readonly themeValues: PreviewTheme[] = ['light', 'dark'];
  protected setWidth = (px: number) => this.width.set(px);
  protected setTheme = (theme: PreviewTheme) => this.theme.set(theme);

  protected step<T>(
    event: KeyboardEvent,
    options: readonly T[],
    current: T,
    set: (value: T) => void,
  ): void {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const index = (options.indexOf(current) + delta + options.length) % options.length;
    set(options[index]);
    // The radios are in the options' order, so the next one can take focus before the view updates.
    const group = (event.currentTarget as HTMLElement).closest('[role="radiogroup"]');
    group?.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
  }
}
