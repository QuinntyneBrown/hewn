/** A generated file, as the scaffold commits it. */
export interface ScaffoldFile {
  path: string;
  content: string;
}

/** One stack's scaffold: the files, and the CI jobs that become required checks. */
export interface StackTemplate {
  id: string;
  /** True when the stack decision's text selects this template. */
  matches(decision: string): boolean;
  /** CI job names, which are the check names GitHub reports and branch protection requires. */
  checks: readonly string[];
  generate(projectName: string): ScaffoldFile[];
}

export function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** "Kiln booking 2" becomes "KilnBooking2"; a leading digit gets an "App" prefix so it is a valid C# name. */
export function pascal(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return /^[0-9]/.test(joined) ? `App${joined}` : joined || 'App';
}
