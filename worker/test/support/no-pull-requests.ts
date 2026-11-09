import type { RunContext } from '../../src/executors/stage-executor.ts';

const unexpected = (name: string) => async (): Promise<never> => {
  throw new Error(`${name} is only for the scaffold stage`);
};

/** The pull request half of a RunContext, for stages that must never call it. */
export const noPullRequests: Pick<
  RunContext,
  | 'openPullRequest'
  | 'pullRequestChecks'
  | 'mergePullRequest'
  | 'protectDefaultBranch'
  | 'reportBacklog'
  | 'nextIncrement'
  | 'updateIncrement'
> = {
  nextIncrement: unexpected('nextIncrement'),
  updateIncrement: unexpected('updateIncrement'),
  reportBacklog: unexpected('reportBacklog'),
  openPullRequest: unexpected('openPullRequest'),
  pullRequestChecks: unexpected('pullRequestChecks'),
  mergePullRequest: unexpected('mergePullRequest'),
  protectDefaultBranch: unexpected('protectDefaultBranch'),
};
