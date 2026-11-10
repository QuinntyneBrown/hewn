import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CreatedWorkerToken, FieldErrorsProblem, WORKERS_API, WorkerTokenExpiry } from '@hewn/api';
import { describedBy, IconComponent } from '@hewn/components';
import { notCreated, startCommand } from './workers-text';

/**
 * New worker token (L2-041 AC1, AC3): a name, where the worker runs and when the token expires. On success the token
 * is shown this once, with Copy and the command that starts a worker with it; Hewn keeps only its hash.
 */
@Component({
  selector: 'hw-worker-token-dialog',
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dialog', '(click)': 'onBackdrop($event)' },
  template: `
    @if (created(); as c) {
      <div class="dialog__panel dialog__panel--lg">
        <h2 class="dialog__title" id="worker-token-title">New worker token</h2>
        <p class="dialog__text" id="worker-token-desc">
          Paste the command on the machine that will run the worker.
        </p>
        <div class="callout callout--ok" role="status">
          <svg hw-icon name="checkCircle" class="icon--lg"></svg>
          <div>
            <p class="callout__title">Token created for {{ c.name }}</p>
            <p class="callout__body">
              Copy it now. Hewn stores only a hash and can’t show it again.
            </p>
          </div>
        </div>
        <div class="dialog__body">
          <p class="field__label">Token</p>
          <div class="codebox mt-2">
            <code class="mono">{{ c.token }}</code
            ><button
              class="btn btn--ghost btn--icon btn--sm"
              type="button"
              [attr.aria-label]="copied() ? 'Token copied' : 'Copy token'"
              (click)="copy(c.token)"
            >
              <svg hw-icon [name]="copied() ? 'checkCircle' : 'copy'" class="icon--sm"></svg>
            </button>
          </div>
          <p class="field__label mt-4">Start the worker</p>
          <pre class="pre mt-2">{{ command() }}</pre>
          <p class="text-caption mt-2">Outbound HTTPS only; the worker needs no inbound ports.</p>
          <p class="visually-hidden" aria-live="polite">{{ copied() ? 'Token copied' : '' }}</p>
        </div>
        <div class="dialog__footer">
          <button class="btn btn--primary" type="button" (click)="ref.close(c)">Done</button>
        </div>
      </div>
    } @else {
      <form class="dialog__panel" novalidate [formGroup]="form" (ngSubmit)="create()">
        <h2 class="dialog__title" id="worker-token-title">New worker token</h2>
        <p class="dialog__text" id="worker-token-desc">
          A token lets one worker register and lease runs. Revoke it any time from Workers.
        </p>
        @if (failure(); as f) {
          <div class="callout callout--danger" role="alert">
            <svg hw-icon name="warning" class="icon--lg"></svg>
            <div>
              <p class="callout__title">The token wasn’t created</p>
              <p class="callout__body">{{ f }}</p>
            </div>
          </div>
        }
        <div class="dialog__body stack" style="gap: var(--space-5)">
          <div class="field">
            <label class="field__label" for="worker-name">Worker name</label>
            <div class="field__control">
              <input
                class="input mono"
                id="worker-name"
                autocomplete="off"
                formControlName="name"
                [readOnly]="creating()"
                [attr.aria-invalid]="error() ? 'true' : null"
                [attr.aria-describedby]="describedBy('worker-name', error())"
              />
            </div>
            @if (error(); as message) {
              <span class="field__error" id="worker-name-err"
                ><svg hw-icon name="errorCircle" class="icon--sm"></svg>{{ message }}</span
              >
            } @else {
              <span class="field__hint" id="worker-name-hint"
                >Shown on the Workers page and in the audit log.</span
              >
            }
          </div>
          <fieldset class="field" style="border: 0; padding: 0; margin: 0">
            <legend class="field__label">Location</legend>
            <div class="cluster mt-2">
              <label class="choice"
                ><input type="radio" formControlName="location" value="Local" /><span
                  ><svg hw-icon name="laptop" class="icon--sm"></svg></span
                ><span>Local<small>Your machine</small></span></label
              >
              <label class="choice"
                ><input type="radio" formControlName="location" value="Cloud" /><span
                  ><svg hw-icon name="cloud" class="icon--sm"></svg></span
                ><span>Cloud<small>A VM or container host</small></span></label
              >
            </div>
          </fieldset>
          <div class="field">
            <label class="field__label" for="expiry">Expires</label>
            <div class="field__control">
              <select class="select" id="expiry" formControlName="expiresInDays">
                <option [ngValue]="90">In 90 days</option>
                <option [ngValue]="30">In 30 days</option>
                <option [ngValue]="365">In 1 year</option>
              </select>
            </div>
          </div>
        </div>
        <div class="dialog__footer">
          <button class="btn btn--ghost" type="button" (click)="ref.close()">Cancel</button>
          @if (creating()) {
            <button class="btn btn--primary" type="button" aria-busy="true" disabled>
              <svg hw-icon name="spinner"></svg>Creating token…
            </button>
          } @else {
            <button class="btn btn--primary" type="submit">
              <svg hw-icon name="key"></svg>Create token
            </button>
          }
        </div>
      </form>
    }
  `,
})
export class WorkerTokenDialog {
  protected readonly ref = inject<DialogRef<CreatedWorkerToken>>(DialogRef);
  private readonly api = inject(WORKERS_API);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: '',
    location: 'Cloud' as 'Local' | 'Cloud',
    expiresInDays: 90 as WorkerTokenExpiry,
  });
  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected readonly created = signal<CreatedWorkerToken | null>(null);
  protected readonly copied = signal(false);
  protected readonly describedBy = describedBy;

  /** The worker image started with this token; the API's own address, as the browser reaches it. */
  protected readonly command = computed(() =>
    startCommand(location.origin, this.created()?.token ?? ''),
  );

  constructor() {
    // Opened with disableClose so Escape can't lose a token shown once; before that, Escape closes as usual.
    this.ref.keydownEvents.subscribe((event) => {
      if (event.key === 'Escape' && !this.creating() && !this.created()) this.ref.close();
    });
  }

  protected onBackdrop(event: MouseEvent): void {
    // Once the token shows, only Done closes it, so it isn't lost by a stray click.
    if (event.target === event.currentTarget && !this.creating() && !this.created())
      this.ref.close();
  }

  protected create(): void {
    if (this.creating()) return;
    const { name, location: where, expiresInDays } = this.form.getRawValue();
    this.creating.set(true);
    this.form.controls.location.disable();
    this.form.controls.expiresInDays.disable();
    this.error.set(null);
    this.failure.set(null);
    this.api.createToken({ name: name.trim(), location: where, expiresInDays }).subscribe({
      next: (created) => this.created.set(created),
      error: (error: unknown) => {
        this.creating.set(false);
        this.form.controls.location.enable();
        this.form.controls.expiresInDays.enable();
        if (error instanceof FieldErrorsProblem) {
          this.error.set(error.for('name')?.message ?? error.errors[0]?.message ?? null);
        } else {
          this.failure.set(notCreated(error));
        }
      },
    });
  }

  protected copy(token: string): void {
    void navigator.clipboard.writeText(token).then(() => this.copied.set(true));
  }
}
