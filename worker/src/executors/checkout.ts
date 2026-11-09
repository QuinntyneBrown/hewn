import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RunContext } from './stage-executor.ts';

const run = promisify(execFile);

/** Replaces `directory` with the product repository's default branch, downloaded through the API. */
export async function checkOut(context: RunContext, directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const archive = join(context.workspace, 'repository.tar.gz');
  await writeFile(archive, await context.downloadRepository());
  await run('tar', ['-xzf', archive, '-C', directory, '--strip-components=1']);
  await rm(archive, { force: true });
}
