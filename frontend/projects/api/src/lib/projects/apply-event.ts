import { ProjectEvent } from '../live/project-event';
import { DirectionStatus, Project, ProjectStatus, StageStatus } from './models';

/** Folds one live event into a project snapshot. Events at or below lastSequence are already applied. */
export function applyEvent(project: Project, event: ProjectEvent): Project {
  if (event.sequence <= project.lastSequence) {
    return project;
  }

  const p = event.payload;
  const next: Project = { ...project, lastSequence: event.sequence };
  switch (event.type) {
    case 'StageChanged':
      next.directions = project.directions.map((d) =>
        d.id !== p['directionId']
          ? d
          : {
              ...d,
              stages: d.stages.map((s) =>
                s.number !== p['stage']
                  ? s
                  : {
                      ...s,
                      status: p['status'] as StageStatus,
                      startedAt: (p['startedAt'] as string | null) ?? null,
                      endedAt: (p['endedAt'] as string | null) ?? null,
                    },
              ),
            },
      );
      break;
    case 'DirectionChanged':
      next.directions = project.directions.map((d) =>
        d.id !== p['directionId']
          ? d
          : {
              ...d,
              status: p['status'] as DirectionStatus,
              completedAt: (p['completedAt'] as string | null) ?? null,
            },
      );
      break;
    case 'ProjectChanged':
      next.status = p['status'] as ProjectStatus;
      if (typeof p['repository'] === 'string') {
        next.repository = p['repository'];
      }
      break;
  }

  return next;
}
