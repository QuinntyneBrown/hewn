import type { RequirementTrace } from '@hewn/api';

/** Matches the ID (whole or by its number) or words of the title, ignoring case. */
export function findRequirements(
  requirements: RequirementTrace[],
  query: string,
): RequirementTrace[] {
  const q = query.trim().toLowerCase();
  if (!q) return requirements;
  return requirements.filter(
    (r) => r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q),
  );
}

/** "No requirement matches “L2-099”. Ledgerline has L2-001 to L2-035." */
export function noMatchText(
  query: string,
  project: string,
  requirements: RequirementTrace[],
): string {
  const first = requirements[0]?.id;
  const last = requirements.at(-1)?.id;
  const range = !first ? 'no requirements' : first === last ? first : `${first} to ${last}`;
  return `No requirement matches “${query.trim()}”. ${project} has ${range}.`;
}

export function l1Line(requirement: RequirementTrace): string {
  const l1 = requirement.l1;
  if (!l1) return 'Traces to no L1';
  return l1.title ? `Traces to ${l1.id} ${l1.title}` : `Traces to ${l1.id}`;
}

export type TraceGroup = 'designs' | 'journeys' | 'tests' | 'pullRequests';

/** What an empty column says, as the Traceability mocks word it. */
export function emptyText(group: TraceGroup, requirement: RequirementTrace): string {
  switch (group) {
    case 'designs':
      return 'No design covers it';
    case 'journeys':
      return 'In no journey';
    case 'tests':
      return requirement.deferred !== null ? 'Not needed while deferred' : 'None yet';
    default:
      return 'None yet';
  }
}
