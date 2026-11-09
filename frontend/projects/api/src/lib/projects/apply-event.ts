import { ProjectEvent } from '../live/project-event';
import { Direction, DirectionStatus, Project, ProjectStatus, Stage, StageStatus } from './models';

/** Applies `change` to one stage of one direction. */
function updateStage(
  project: Project,
  directionId: unknown,
  stage: unknown,
  change: (s: Stage) => Stage,
): Direction[] {
  return project.directions.map((d) =>
    d.id !== directionId
      ? d
      : { ...d, stages: d.stages.map((s) => (s.number !== stage ? s : change(s))) },
  );
}

/** Folds one live event into a project snapshot. Events at or below lastSequence are already applied. */
export function applyEvent(project: Project, event: ProjectEvent): Project {
  if (event.sequence <= project.lastSequence) {
    return project;
  }

  const p = event.payload;
  const next: Project = { ...project, lastSequence: event.sequence };
  switch (event.type) {
    case 'StageChanged':
      // A new status starts or ends a run, so the live step and line no longer apply.
      next.directions = updateStage(project, p['directionId'], p['stage'], (s) => ({
        ...s,
        status: p['status'] as StageStatus,
        startedAt: (p['startedAt'] as string | null) ?? null,
        endedAt: (p['endedAt'] as string | null) ?? null,
        step: null,
        latestLine: null,
      }));
      break;
    case 'StepStarted':
      next.directions = updateStage(project, p['directionId'], p['stage'], (s) => ({
        ...s,
        step: p['name'] as string,
        runId: p['runId'] as string,
      }));
      break;
    case 'LogLines': {
      const lines = (p['lines'] as { text: string }[] | undefined) ?? [];
      const last = lines.at(-1);
      if (last) {
        next.directions = updateStage(project, p['directionId'], p['stage'], (s) => ({
          ...s,
          latestLine: last.text,
          runId: p['runId'] as string,
        }));
      }
      break;
    }
    case 'DirectionChanged':
      next.directions = project.directions.map((d) =>
        d.id !== p['directionId']
          ? d
          : {
              ...d,
              status: p['status'] as DirectionStatus,
              completedAt: (p['completedAt'] as string | null) ?? null,
              pauseReason: (p['pauseReason'] as string | null) ?? null,
            },
      );
      break;
    case 'DirectionQueued': {
      // A direction submitted after the snapshot carries itself, so the page can show it at once.
      const direction = p['direction'] as Direction | undefined;
      if (direction && !project.directions.some((d) => d.id === direction.id)) {
        next.directions = [...project.directions, direction];
      }
      break;
    }
    case 'DirectionScoped':
      next.directions = project.directions.map((d) =>
        d.id !== p['directionId']
          ? d
          : {
              ...d,
              hasUiChange: p['hasUiChange'] as boolean,
              uiDecision: (p['uiDecision'] as string | null) ?? null,
            },
      );
      break;
    case 'SpendUpdated':
      next.spendUsd = p['projectSpendUsd'] as number;
      next.directions = project.directions.map((d) =>
        d.id !== p['directionId']
          ? d
          : {
              ...d,
              spendUsd: p['directionSpendUsd'] as number,
              budgetUsd: p['budgetUsd'] as number,
            },
      );
      break;
    case 'BudgetWarning':
      next.directions = project.directions.map((d) =>
        d.id !== p['directionId']
          ? d
          : { ...d, budgetWarned: true, spendUsd: p['spendUsd'] as number },
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
