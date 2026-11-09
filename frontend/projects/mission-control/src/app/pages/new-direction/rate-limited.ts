/** The New direction page's rate-limited callout (L2-043 AC4), as the rate-limited mock reads. */
export function rateLimitedText(limit: number, retryAfterSeconds: number): string {
  const wait = `${retryAfterSeconds} ${retryAfterSeconds === 1 ? 'second' : 'seconds'}`;
  return `You’ve submitted ${limit} in the last minute. You can submit again in ${wait}; nothing you typed is lost.`;
}
