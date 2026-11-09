import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { planBacklog } from '../estimates/backlog-planner.ts';

const ESTIMATES = 'docs/estimates';

/**
 * L2-025 AC4: after a merge, the increment's designs are 100% complete in `docs/estimates/{subsystem}.md`, and the
 * estimates README (percent complete) is regenerated. Returns the paths whose content changed.
 */
export function markComplete(directory: string, designs: string[], thresholdDays: number): string[] {
  const root = join(directory, ESTIMATES);
  if (!existsSync(root)) return [];
  const before = snapshot(root);
  const done = new Set(designs);

  for (const file of readdirSync(root).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    const path = join(root, file);
    const text = readFileSync(path, 'utf8');
    const updated = text
      .split('\n')
      .map((line) => {
        const design = /detailed-designs\/([\w.-]+\/[\w.-]+)/.exec(line)?.[1];
        return design && done.has(design) ? line.replace(/\|\s*\d+(?:\.\d+)?%\s*\|\s*$/, '| 100% |') : line;
      })
      .join('\n');
    if (updated !== text) writeFileSync(path, updated);
  }

  planBacklog(directory, thresholdDays);
  const after = snapshot(root);
  return [...after.keys()].filter((f) => after.get(f) !== before.get(f)).map((f) => `${ESTIMATES}/${f}`);
}

function snapshot(root: string): Map<string, string> {
  return new Map(readdirSync(root).map((f) => [f, readFileSync(join(root, f), 'utf8')]));
}
