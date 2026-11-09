import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Direction, PROJECTS_API } from '@hewn/api';
import { IconComponent, StatusComponent, StatusIconComponent } from '@hewn/components';

/** The project page: header and pipeline. Live updates arrive in a later slice. */
@Component({
  selector: 'hw-project-page',
  imports: [RouterLink, IconComponent, StatusComponent, StatusIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project.page.html',
})
export class ProjectPage {
  private readonly api = inject(PROJECTS_API);

  readonly projectId = input.required<string>();

  protected readonly project = rxResource({
    params: () => this.projectId(),
    stream: ({ params }) => this.api.getProject(params),
  });

  /** The direction being worked on, or the latest one. */
  protected readonly direction = computed<Direction | null>(() => {
    const directions = this.project.value()?.directions ?? [];
    return (
      directions.find((d) => d.status === 'Running' || d.status === 'Paused') ??
      directions.find((d) => d.status === 'Queued') ??
      directions.at(-1) ??
      null
    );
  });

  protected duration(startedAt: string | null, endedAt: string | null): string {
    if (!startedAt) {
      return '—';
    }
    const ms = (endedAt ? Date.parse(endedAt) : Date.now()) - Date.parse(startedAt);
    const minutes = Math.floor(ms / 60_000);
    return minutes < 1 ? `${Math.max(0, Math.round(ms / 1000))}s` : `${minutes}m`;
  }
}
