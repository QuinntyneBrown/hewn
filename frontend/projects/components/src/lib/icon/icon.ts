import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IconName, ICONS } from './icons';

/**
 * Decorative icon on the `svg` element itself (`<svg hw-icon name="plus" class="icon--sm">`), so design-system
 * child selectors such as `.callout > .icon` apply. Status text always travels next to it, never colour alone.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'svg[hw-icon]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'icon',
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    '[innerHTML]': 'body()',
  },
  template: '',
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();

  // The bodies are compile-time constants from ICONS, never user input.
  protected readonly body = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()]),
  );
}
