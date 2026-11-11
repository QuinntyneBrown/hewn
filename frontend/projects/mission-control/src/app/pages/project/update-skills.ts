import { SkillsUpdate } from '@hewn/api';
import { ToastMessage } from '../../core/toasts';

/** L2-008 AC1: the header link, for an Owner only, while Greenlit is ahead and no update waits for its checks. */
export function skillsUpdateLink(update: SkillsUpdate | null, isOwner: boolean): string | null {
  if (!update || !isOwner || update.available === 0 || update.pullRequest) return null;
  return `Skills update available (${update.available} ${update.available === 1 ? 'commit' : 'commits'})`;
}

/** The failed dialog's text: what went wrong, and that the project keeps the skills it has. */
export function updateSkillsFailure(
  status: number,
  title: string | null,
  projectName: string,
): string {
  const reason =
    title ??
    (status === 403
      ? 'Only an Owner can update skills'
      : `The API returned ${status || 'no response'}`);
  return `${reason}. ${projectName} keeps running on the skills it has.`;
}

/** Shown once the pull request is open; it merges by itself when checks pass (L2-008 AC2). */
export function updatedToast(projectName: string, number: number): ToastMessage {
  return {
    tone: 'info',
    title: 'Skills update opened',
    text: `Pull request #${number} updates ${projectName}’s skills. It merges automatically when checks pass.`,
  };
}
