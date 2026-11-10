/** The version as Mission Control shows it: the commit's first seven characters. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Just now", "14 min ago" within the hour, then "8 Nov, 16:44", as the Artifacts mock shows commit times. */
export function committedText(at: string, now: Date = new Date()): string {
  const when = new Date(at);
  const minutes = Math.floor((now.getTime() - when.getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  return `${when.getDate()} ${MONTHS[when.getMonth()]}, ${time}`;
}

export function openLabel(path: string, sha: string): string {
  return `Open ${path} on GitHub at ${shortSha(sha)}`;
}
