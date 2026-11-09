import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A test file in any of the stacks Hewn scaffolds: `*.spec.ts`, `*.test.ts`, `*Tests.cs`, or anything under `e2e/`. */
export function isTestFile(path: string): boolean {
  return (
    /\.(spec|test)\.[cm]?[jt]sx?$/.test(path) ||
    /Tests?\.cs$/.test(path) ||
    (/^e2e\//.test(path) && /\.[cm]?[jt]s$/.test(path) && /(^|\/)tests?\//.test(path))
  );
}

/**
 * L2-021 AC2: the first commit holds only acceptance tests, each starting with a `Traces to: L2-xxx` header comment
 * (within its first five lines) naming only L2s in the increment.
 */
export function checkTestCommit(directory: string, paths: string[], l2Ids: string[]): string[] {
  if (paths.length === 0) return ['The test commit has no acceptance tests'];
  const allowed = new Set(l2Ids);
  return [...paths].sort().flatMap((path) => {
    if (!isTestFile(path)) return [`${path} is not a test file`];
    const head = readFileSync(join(directory, path), 'utf8').split('\n').slice(0, 5).join('\n');
    const traces = /^\s*(?:\/\/|#|\/\*+|\*)\s*Traces to:\s*(.+)$/m.exec(head)?.[1]?.match(/L2-\d+/g);
    if (!traces) return [`${path} has no "Traces to: L2-xxx" header`];
    const foreign = traces.filter((id) => !allowed.has(id));
    return foreign.length
      ? [`${path} traces to ${foreign.join(', ')}, which ${foreign.length === 1 ? 'is' : 'are'} not in this increment`]
      : [];
  });
}
