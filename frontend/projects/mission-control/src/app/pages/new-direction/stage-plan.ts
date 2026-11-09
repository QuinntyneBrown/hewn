/** What each stage writes, shown in the "What runs next" rail. */
export const STAGE_PLAN: { name: string; output: string }[] = [
  { name: 'Bootstrap', output: '.hewn/skills.lock' },
  { name: 'Idea', output: 'docs/brief.md' },
  { name: 'Designs', output: 'docs/mocks/' },
  { name: 'Design system', output: 'docs/design-system/' },
  { name: 'Stack', output: 'docs/adr/0001-stack.md' },
  { name: 'Requirements', output: 'docs/specs/' },
  { name: 'Scaffold', output: 'Solution + CI' },
  { name: 'Detailed designs', output: 'docs/detailed-designs/' },
  { name: 'User journeys', output: 'docs/journeys.md' },
  { name: 'Estimates', output: 'docs/estimates/' },
  { name: 'Increments', output: 'Test → Code → Video → PR' },
];

/** Stages a feature direction never runs (L2-005 AC1); Designs and Design system may be skipped too. */
export const FEATURE_SKIPPED: ReadonlySet<string> = new Set(['Bootstrap', 'Stack', 'Scaffold']);

/** The rail for a feature direction: skipped stages are struck through and write nothing. */
export const FEATURE_PLAN: { name: string; output: string; skipped: boolean }[] = STAGE_PLAN.map(
  (s) =>
    FEATURE_SKIPPED.has(s.name)
      ? { name: s.name, output: 'skipped', skipped: true }
      : { ...s, skipped: false },
);

/** How a product reads in the Product list: its repository, or that a feature would queue behind it. */
export function productLabel(p: {
  name: string;
  repository: string | null;
  status: string;
  firstDirectionComplete: boolean;
}): string {
  if (!p.firstDirectionComplete) {
    return `${p.name} · queues behind the ${p.status === 'Paused' ? 'paused' : 'running'} direction`;
  }
  return p.repository ? `${p.name} · ${p.repository}` : p.name;
}

/** Lowercases, replaces runs of non-alphanumerics with one hyphen and trims hyphens (RepoNameFormatter). */
export function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
