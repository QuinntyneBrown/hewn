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
  | 'reportScope'
  | 'nextIncrement'
  | 'updateIncrement'
  | 'recordDecisions'
> = {
  // Decisions are reported by every document stage; tests that check them pass their own.
  recordDecisions: async () => {},
  nextIncrement: unexpected('nextIncrement'),
  updateIncrement: unexpected('updateIncrement'),
  reportBacklog: unexpected('reportBacklog'),
  reportScope: unexpected('reportScope'),
  openPullRequest: unexpected('openPullRequest'),
  pullRequestChecks: unexpected('pullRequestChecks'),
  mergePullRequest: unexpected('mergePullRequest'),
  protectDefaultBranch: unexpected('protectDefaultBranch'),
};
