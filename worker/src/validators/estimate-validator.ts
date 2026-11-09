import { designFolders, readEstimateRows } from '../estimates/backlog-planner.ts';
import type { Problems } from './document-validators.ts';

/** Stage 9 (L2-018 AC1): every active detailed design has an estimate in ideal days. */
export function validateEstimates(workspace: string): Problems {
  const rows = readEstimateRows(workspace);
  return designFolders(workspace)
    .filter((design) => !rows.has(design))
    .map((design) => `No estimate for docs/detailed-designs/${design}`);
}
