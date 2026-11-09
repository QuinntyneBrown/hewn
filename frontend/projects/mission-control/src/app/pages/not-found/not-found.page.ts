import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'hw-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="pad" style="padding-block: var(--space-16)">
    <div class="stack" style="align-items: flex-start">
      <h1>Page not found</h1>
      <p class="text-sm text-muted max-measure">
        This page doesn’t exist, or you don’t have access to it.
      </p>
      <a class="btn" routerLink="/projects/new">Back to Hewn</a>
    </div>
  </div>`,
})
export class NotFoundPage {}
