import { committedText, openLabel, shortSha } from './artifacts-view';

describe('artifacts view', () => {
  const now = new Date(2026, 10, 8, 17, 0, 0);
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

  it('shows the version as the short SHA', () => {
    expect(shortSha('7be0d13c0ffee5a1fe37c0ffee5a1fe37c0ffee5')).toBe('7be0d13');
  });

  it('says how long ago a commit was within the hour, then its day and time', () => {
    expect(committedText(ago(0.2), now)).toBe('Just now');
    expect(committedText(ago(14), now)).toBe('14 min ago');
    expect(committedText(ago(76), now)).toBe('8 Nov, 15:44');
    expect(committedText(new Date(2026, 10, 7, 17, 51).toISOString(), now)).toBe('7 Nov, 17:51');
  });

  it('names the artifact and the commit in the link that opens it on GitHub', () => {
    expect(openLabel('docs/brief.md', 'e8812fa9')).toBe('Open docs/brief.md on GitHub at e8812fa');
  });
});
