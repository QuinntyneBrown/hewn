import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Placeholder until GitHub sign-in lands (journey 20). */
@Component({
  selector: 'hw-sign-in-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main id="main" class="pad" style="padding-block: var(--space-16)">
    <div class="stack" style="align-items: flex-start">
      <h1>Sign in to Hewn</h1>
      <p class="text-sm text-muted max-measure">
        Your session has ended or you haven’t signed in yet. Sign in with an allow-listed GitHub
        account to continue.
      </p>
    </div>
  </main>`,
})
export class SignInPage {}
