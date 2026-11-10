const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Last sign-in: Today, 08:02", "Yesterday, 17:40", "8 Nov, 16:44" or "Never", as the Settings mock shows it. */
export function lastSignInText(at: string | null, now: Date = new Date()): string {
  if (!at) return 'Last sign-in: Never';
  const when = new Date(at);
  const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(when)) / 86_400_000);
  const date =
    days === 0
      ? 'Today'
      : days === 1
        ? 'Yesterday'
        : `${when.getDate()} ${MONTHS[when.getMonth()]}`;
  return `Last sign-in: ${date}, ${time}`;
}

/** The avatar's letters: the login's first two, as the mock's QU, AM, DE. */
export function loginInitials(login: string): string {
  return login
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();
}

/** The add dialog's failure when GitHub couldn't confirm the login (the add-user mock's failed state). */
export function notAdded(login: string, reason: string): { title: string; body: string } {
  return { title: `@${login} wasn’t added`, body: `${reason}. Try again in a minute.` };
}
