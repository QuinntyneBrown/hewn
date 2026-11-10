import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { IconComponent } from '@hewn/components';
import { gitHubSignIn, PIPELINE, signInState } from './sign-in-view';

/**
 * Sign in with GitHub (L2-038 AC2). "Continue with GitHub" leaves for the API, which sends the browser to GitHub and
 * back; the page then shows why it was opened: refused (not on the allow list), GitHub failed, the session expired,
 * or the user signed out.
 */
@Component({
  selector: 'hw-sign-in-page',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sign-in.page.html',
})
export class SignInPage {
  readonly error = input<string>();
  readonly login = input<string>();
  readonly reason = input<string>();
  readonly returnUrl = input<string>();

  protected readonly state = computed(() =>
    signInState({ error: this.error(), login: this.login(), reason: this.reason() }),
  );
  protected readonly href = computed(() => gitHubSignIn(this.returnUrl()));
  protected readonly waiting = signal(false);
  protected readonly pipeline = PIPELINE;

  protected leave(): void {
    // The browser is on its way to GitHub; the button says so until the page unloads.
    this.waiting.set(true);
  }
}
