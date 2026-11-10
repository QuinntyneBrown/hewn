import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ALLOW_LIST_API,
  AllowListEntry,
  FieldErrorsProblem,
  GitHubUnavailableProblem,
  Role,
} from '@hewn/api';
import { describedBy, IconComponent } from '@hewn/components';
import { notAdded } from './access-view';

/**
 * Add a GitHub login (L2-038 AC5): the login and a role, Viewer by default. A listed, malformed or unknown login is
 * an inline error; when GitHub can't confirm the login, nothing is added and the dialog says so. They can sign in as
 * soon as they're added.
 */
@Component({
  selector: 'hw-add-user-dialog',
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dialog', '(click)': 'onBackdrop($event)' },
  template: `
    <form class="dialog__panel" novalidate [formGroup]="form" (ngSubmit)="add()">
      <h2 class="dialog__title" id="add-user-title">Add a GitHub login</h2>
      <p class="dialog__text" id="add-user-desc">They can sign in as soon as they’re added.</p>
      @if (failure(); as f) {
        <div class="callout callout--danger" role="alert">
          <svg hw-icon name="warning" class="icon--lg"></svg>
          <div>
            <p class="callout__title">{{ f.title }}</p>
            <p class="callout__body">{{ f.body }}</p>
          </div>
        </div>
      }
      <div class="dialog__body stack" style="gap: var(--space-5)">
        <div class="field">
          <label class="field__label" for="login">GitHub login</label>
          <div class="field__control">
            <div class="prefix">
              <span class="prefix__sym" aria-hidden="true">&#64;</span
              ><input
                class="input"
                id="login"
                autocomplete="off"
                formControlName="login"
                [readOnly]="adding()"
                [attr.aria-invalid]="error() ? 'true' : null"
                [attr.aria-describedby]="describedBy('login', error())"
              />
            </div>
          </div>
          @if (error(); as message) {
            <span class="field__error" id="login-err"
              ><svg hw-icon name="errorCircle" class="icon--sm"></svg>{{ message }}</span
            >
          } @else {
            <span class="field__hint" id="login-hint">They sign in with this GitHub account.</span>
          }
        </div>
        <fieldset class="field" style="border: 0; padding: 0; margin: 0">
          <legend class="field__label">Role</legend>
          <div class="stack mt-2">
            <label class="choice"
              ><input type="radio" formControlName="role" value="Viewer" /><span
                ><svg hw-icon name="users" class="icon--sm"></svg></span
              ><span>Viewer<small>Watches every project</small></span></label
            >
            <label class="choice"
              ><input type="radio" formControlName="role" value="Owner" /><span
                ><svg hw-icon name="key" class="icon--sm"></svg></span
              ><span>Owner<small>Gives direction, stops work, manages access</small></span></label
            >
          </div>
        </fieldset>
      </div>
      <div class="dialog__footer">
        <button class="btn btn--ghost" type="button" (click)="ref.close()">Cancel</button>
        @if (adding()) {
          <button class="btn btn--primary" type="button" aria-busy="true" disabled>
            <svg hw-icon name="spinner"></svg>Adding…
          </button>
        } @else {
          <button class="btn btn--primary" type="submit">
            <svg hw-icon name="plus"></svg>Add to allow list
          </button>
        }
      </div>
    </form>
  `,
})
export class AddUserDialog {
  protected readonly ref = inject<DialogRef<AllowListEntry>>(DialogRef);
  private readonly api = inject(ALLOW_LIST_API);

  protected readonly form = inject(NonNullableFormBuilder).group({
    login: '',
    role: 'Viewer' as Role,
  });
  protected readonly adding = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly failure = signal<{ title: string; body: string } | null>(null);
  protected readonly describedBy = describedBy;

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.adding()) this.ref.close();
  }

  protected add(): void {
    if (this.adding()) return;
    const { login, role } = this.form.getRawValue();
    this.adding.set(true);
    this.form.controls.role.disable();
    this.error.set(null);
    this.failure.set(null);
    this.api.add({ login, role }).subscribe({
      next: (entry) => this.ref.close(entry),
      error: (error: unknown) => {
        this.adding.set(false);
        this.form.controls.role.enable();
        if (error instanceof FieldErrorsProblem) {
          this.error.set(error.for('login')?.message ?? error.errors[0]?.message ?? null);
        } else if (error instanceof GitHubUnavailableProblem) {
          this.failure.set(notAdded(login.trim().replace(/^@/, '').toLowerCase(), error.message));
        } else {
          this.failure.set({
            title: `@${login.trim().replace(/^@/, '')} wasn’t added`,
            body: 'Hewn couldn’t reach the server. Nothing changed; try again.',
          });
        }
      },
    });
  }
}
