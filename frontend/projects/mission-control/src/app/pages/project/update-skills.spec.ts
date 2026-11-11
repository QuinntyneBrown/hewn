import { describe, expect, it } from 'vitest';
import { skillsUpdateLink, updateSkillsFailure, updatedToast } from './update-skills';

const update = (available: number, pullRequest: { number: number; url: string } | null = null) => ({
  available,
  lockedSha: '91c0b4e7a2d5c3b1f0e9d8c7b6a5f4e3d2c1b0a9',
  headSha: '3e1a9f0c4b5a6d7e8f90a1b2c3d4e5f6a7b8c9d0',
  commits: [],
  pullRequest,
});

describe('skillsUpdateLink (L2-008 AC1)', () => {
  it('names the count for an Owner, as the mock does', () => {
    expect(skillsUpdateLink(update(4), true)).toBe('Skills update available (4 commits)');
    expect(skillsUpdateLink(update(1), true)).toBe('Skills update available (1 commit)');
  });

  it('shows nothing to a Viewer, with nothing ahead, or while an update waits for its checks', () => {
    expect(skillsUpdateLink(update(4), false)).toBeNull();
    expect(skillsUpdateLink(update(0), true)).toBeNull();
    expect(skillsUpdateLink(update(4, { number: 7, url: 'u' }), true)).toBeNull();
    expect(skillsUpdateLink(null, true)).toBeNull();
  });
});

describe('updateSkillsFailure', () => {
  it('says what failed and that the project keeps its skills, as the failed mock does', () => {
    expect(
      updateSkillsFailure(502, 'Greenlit couldn’t be fetched (git exited with 128)', 'Ledgerline'),
    ).toBe(
      'Greenlit couldn’t be fetched (git exited with 128). Ledgerline keeps running on the skills it has.',
    );
  });

  it('falls back to the status when the API gave no reason', () => {
    expect(updateSkillsFailure(0, null, 'Ledgerline')).toBe(
      'The API returned no response. Ledgerline keeps running on the skills it has.',
    );
    expect(updateSkillsFailure(403, null, 'Ledgerline')).toBe(
      'Only an Owner can update skills. Ledgerline keeps running on the skills it has.',
    );
  });
});

describe('updatedToast', () => {
  it('names the pull request and that it merges when checks pass', () => {
    expect(updatedToast('Ledgerline', 12)).toEqual({
      tone: 'info',
      title: 'Skills update opened',
      text: 'Pull request #12 updates Ledgerline’s skills. It merges automatically when checks pass.',
    });
  });
});
