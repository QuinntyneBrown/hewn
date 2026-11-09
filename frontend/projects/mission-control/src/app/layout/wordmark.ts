import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'hw-wordmark',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<a
    [class]="small() ? 'wordmark wordmark--sm' : 'wordmark'"
    routerLink="/"
    aria-label="Hewn, go to dashboard"
    ><svg viewBox="0 0 32 32" aria-hidden="true">
      <rect class="mark__body" x="0" y="0" width="10" height="32" />
      <rect class="mark__body" x="10" y="13" width="12" height="6" />
      <polygon class="mark__body" points="22,10 32,0 32,32 22,32" />
      <polygon class="mark__chip" points="22,0 29,0 22,7" /></svg
    ><span class="wordmark__text" aria-hidden="true">hewn</span></a
  >`,
})
export class WordmarkComponent {
  readonly small = input(false);
}
