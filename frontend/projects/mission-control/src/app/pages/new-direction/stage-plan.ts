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

/** Lowercases, replaces runs of non-alphanumerics with one hyphen and trims hyphens (RepoNameFormatter). */
export function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
