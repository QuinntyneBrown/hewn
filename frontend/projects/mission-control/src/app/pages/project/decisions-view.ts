const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The stages an agent can decide in, for the stage filter: Idea to Increments. */
export const DECISION_STAGES: readonly { number: number; name: string }[] = [
  { number: 1, name: 'Idea' },
  { number: 2, name: 'Designs' },
  { number: 3, name: 'Design system' },
  { number: 4, name: 'Stack' },
  { number: 5, name: 'Requirements' },
  { number: 6, name: 'Scaffold' },
  { number: 7, name: 'Detailed designs' },
  { number: 8, name: 'User journeys' },
  { number: 9, name: 'Estimates' },
  { number: 10, name: 'Increments' },
];

/** The `?stage=` value as a stage the filter offers; anything else means all stages. */
export function stageFilter(value: string | undefined): number | undefined {
  const n = Number(value);
  return value && DECISION_STAGES.some((s) => s.number === n) ? n : undefined;
}

/** "9 Nov, 14:21", as the Decisions mock shows when a decision was recorded. */
export function recordedText(at: string): string {
  const when = new Date(at);
  const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  return `${when.getDate()} ${MONTHS[when.getMonth()]}, ${time}`;
}

/** The commit link's accessible name, so a reader hears what opens, not a bare SHA. */
export function commitLabel(commit: string): string {
  return `Open commit ${commit.slice(0, 7)} on GitHub`;
}
