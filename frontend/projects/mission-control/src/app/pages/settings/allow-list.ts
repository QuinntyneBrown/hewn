import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ALLOW_LIST_API, AllowListEntry } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { SessionStore } from '../../core/session-store';
import { Toasts } from '../../core/toasts';
import { lastSignInText, loginInitials } from './access-view';

/**
 * Who can sign in (L2-038 AC5): every allow-listed login with its role and last sign-in. An Owner adds a login in a
 * dialog and removes any login but their own; a Viewer sees the list read-only.
 */
@Component({
  selector: 'hw-allow-list',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="settings-section" aria-labelledby="s-access">
      <div class="settings-section__intro">
        <h2 id="s-access" style="font: var(--text-h3)">Who can sign in</h2>
        <p>GitHub logins on the allow list. Owners give direction and stop work; Viewers watch.</p>
      </div>
      <div class="settings-section__body">
        @if (failed()) {
          <div class="callout callout--danger" role="alert">
            <svg hw-icon name="errorCircle" class="icon--lg"></svg>
            <div>
              <p class="callout__title">The allow list didn’t load</p>
              <p class="callout__body">Reload the page to try again.</p>
            </div>
          </div>
        } @else {
          <div class="rows rows--users">
            <div class="rows__head" aria-hidden="true">
              <span>Login</span><span>Role</span><span>Last sign-in</span
              ><span class="visually-hidden">Actions</span>
            </div>
            <ul aria-label="Who can sign in">
              @for (entry of entries(); track entry.login) {
                <li class="row">
                  <span class="cluster"
                    ><span class="avatar" aria-hidden="true">{{ initials(entry.login) }}</span
                    ><span class="mono">{{ entry.login }}</span></span
                  >
                  <span class="text-sm">{{ entry.role }}</span>
                  <span class="text-xs text-subtle lg-only">{{
                    lastSignIn(entry.lastSignInAt)
                  }}</span>
                  <span class="row__actions">
                    @if (session.isOwner() && entry.login !== session.me()?.login) {
                      @if (removing() === entry.login) {
                        <button
                          class="btn btn--ghost btn--sm"
                          type="button"
                          aria-busy="true"
                          disabled
                        >
                          Removing…
                        </button>
                      } @else {
                        <button
                          class="btn btn--ghost btn--sm"
                          type="button"
                          [attr.aria-label]="'Remove ' + entry.login"
                          (click)="remove(entry)"
                        >
                          Remove
                        </button>
                      }
                    }
                  </span>
                </li>
              }
            </ul>
          </div>
        }
        <div class="mt-4">
          @if (session.isOwner()) {
            <button class="btn btn--sm" type="button" (click)="openAdd()">
              <svg hw-icon name="plus" class="icon--sm"></svg>Add a GitHub login
            </button>
          }
        </div>
      </div>
    </section>
  `,
})
export class AllowListComponent {
  private readonly api = inject(ALLOW_LIST_API);
  private readonly dialog = inject(Dialog);
  private readonly toasts = inject(Toasts);
  protected readonly session = inject(SessionStore);

  protected readonly entries = signal<AllowListEntry[]>([]);
  protected readonly failed = signal(false);
  protected readonly removing = signal<string | null>(null);
  protected readonly initials = loginInitials;
  protected readonly lastSignIn = (at: string | null) => lastSignInText(at);

  constructor() {
    this.load();
  }

  private load(): void {
    this.api.list().subscribe({
      next: (entries) => {
        this.failed.set(false);
        this.entries.set(entries);
      },
      error: () => this.failed.set(true),
    });
  }

  protected openAdd(): void {
    // Loaded on demand, so the dialog stays out of the Settings chunk.
    void import('./add-user.dialog').then((m) => {
      const ref = this.dialog.open<AllowListEntry>(m.AddUserDialog, {
        ariaLabelledBy: 'add-user-title',
        ariaDescribedBy: 'add-user-desc',
        backdropClass: 'backdrop',
        autoFocus: '#login',
      });
      ref.closed.subscribe((added) => {
        if (!added) return;
        this.toasts.show({
          tone: 'ok',
          title: `@${added.login} added as ${added.role}`,
          text: 'They can sign in now.',
        });
        this.load();
      });
    });
  }

  protected remove(entry: AllowListEntry): void {
    if (this.removing()) return;
    this.removing.set(entry.login);
    this.api.remove(entry.login).subscribe({
      next: () => {
        this.removing.set(null);
        this.entries.update((all) => all.filter((e) => e.login !== entry.login));
        this.toasts.show({
          tone: 'ok',
          title: `@${entry.login} removed`,
          text: 'They were signed out and can’t sign in again.',
        });
      },
      error: () => {
        this.removing.set(null);
        this.toasts.show({
          tone: 'warn',
          title: `@${entry.login} wasn’t removed`,
          text: 'Nothing changed; try again.',
        });
      },
    });
  }
}
