import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PROJECTS_API, SkillsCommit, UpdateSkillsResult } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { updateSkillsFailure } from './update-skills';

export interface UpdateSkillsData {
  projectId: string;
  projectName: string;
  lockedSha: string;
  commits: SkillsCommit[];
}

/**
 * Update skills (L2-008 AC2): lists Greenlit's commits since the lock and opens the pull request that updates the
 * skill files and `.hewn/skills.lock`. Not now closes and changes nothing; a failure says why and offers Try again.
 */
@Component({
  selector: 'hw-update-skills-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dialog', '(click)': 'onBackdrop($event)' },
  template: `
    <div class="dialog__panel dialog__panel--lg">
      <h2 class="dialog__title" id="skills-title">Update {{ data.projectName }}’s skills?</h2>
      <p class="dialog__text" id="skills-desc">
        Hewn opens a pull request that updates the skill files and .hewn/skills.lock, and merges it
        automatically when checks pass. The running increment finishes on the current skills.
      </p>
      @if (failure(); as message) {
        <div class="callout callout--danger" role="alert">
          <svg hw-icon name="warning" class="icon--lg"></svg>
          <div>
            <p class="callout__title">Skills weren’t updated</p>
            <p class="callout__body">{{ message }}</p>
          </div>
        </div>
      }
      <div class="dialog__body">
        <p class="field__label">
          Greenlit · {{ data.commits.length }}
          {{ data.commits.length === 1 ? 'commit' : 'commits' }} since
          {{ data.lockedSha.slice(0, 7) }}
        </p>
        <ul class="mini-list mt-2" aria-label="Greenlit commits">
          @for (c of data.commits; track c.sha) {
            <li>
              <span class="mono text-subtle">{{ c.sha.slice(0, 7) }}</span
              ><span class="truncate">{{ c.message }}</span>
            </li>
          }
        </ul>
      </div>
      <div class="dialog__footer">
        <button class="btn btn--ghost" type="button" (click)="ref.close()">Not now</button>
        @if (updating()) {
          <button class="btn btn--primary" type="button" aria-busy="true" disabled>
            <svg hw-icon name="spinner"></svg>Updating skills…
          </button>
        } @else {
          <button class="btn btn--primary" type="button" (click)="update()">
            @if (failure()) {
              <svg hw-icon name="refresh"></svg>Try again
            } @else {
              <svg hw-icon name="refresh"></svg>Update skills
            }
          </button>
        }
      </div>
    </div>
  `,
})
export class UpdateSkillsDialog {
  protected readonly data = inject<UpdateSkillsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<UpdateSkillsResult>>(DialogRef);
  private readonly api = inject(PROJECTS_API);

  protected readonly updating = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.updating()) this.ref.close();
  }

  protected update(): void {
    if (this.updating()) return;
    this.updating.set(true);
    this.api.updateSkills(this.data.projectId).subscribe({
      next: (result) => {
        this.updating.set(false);
        this.ref.close(result);
      },
      error: (error: unknown) => {
        this.updating.set(false);
        const response = error instanceof HttpErrorResponse ? error : null;
        const title = (response?.error as { title?: unknown } | null)?.title;
        this.failure.set(
          updateSkillsFailure(
            response?.status ?? 0,
            typeof title === 'string' ? title : null,
            this.data.projectName,
          ),
        );
      },
    });
  }
}
