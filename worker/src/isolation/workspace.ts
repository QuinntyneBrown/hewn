import { chmodSync, existsSync, lstatSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Files a run's tools keep credentials in; reported by name if any survive (L2-040 AC3). */
const CREDENTIAL_FILES = new Set([
  '.git-credentials',
  '.npmrc',
  '.netrc',
  '.pypirc',
  'hosts.yml',
  'config.json',
  '.env',
]);

function makeWritable(path: string): void {
  try {
    const stat = lstatSync(path);
    if (!stat.isDirectory()) return;
    chmodSync(path, 0o700);
    for (const entry of readdirSync(path)) makeWritable(join(path, entry));
  } catch {
    // Not ours to change (a container's root-owned file): the second attempt reports what is left.
  }
}

function leftovers(path: string, found: string[] = []): string[] {
  try {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) leftovers(full, found);
      else if (CREDENTIAL_FILES.has(entry.name)) found.push(full);
    }
  } catch {
    // Unreadable: nothing more to list.
  }
  return found;
}

/**
 * Deletes a run's workspace when the run ends, and with it every credential the run wrote there (L2-040 AC3). A run
 * can leave folders read-only, so a failed first attempt makes the run's folders writable and tries again. Returns
 * the credential files still there, if any, so the caller can report them; it never throws.
 */
export function removeWorkspace(workspace: string): { removed: boolean; credentialsLeft: string[] } {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      rmSync(workspace, { recursive: true, force: true, maxRetries: 2 });
      return { removed: true, credentialsLeft: [] };
    } catch {
      makeWritable(workspace);
    }
  }
  return { removed: !existsSync(workspace), credentialsLeft: leftovers(workspace) };
}
