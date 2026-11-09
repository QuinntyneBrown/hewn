import { HttpErrorResponse } from '@angular/common/http';

/** The API refused a request over a limit (429): how many are allowed, and when to try again. */
export class RateLimitedProblem extends Error {
  constructor(
    readonly limit: number,
    readonly retryAfterSeconds: number,
  ) {
    super('Too many requests.');
  }
}

/** Turns an HTTP 429 ProblemDetails into RateLimitedProblem; returns null for anything else. */
export function toRateLimited(error: unknown): RateLimitedProblem | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 429) {
    return null;
  }
  const body = (error.error ?? {}) as { limit?: number; retryAfterSeconds?: number };
  return new RateLimitedProblem(body.limit ?? 0, body.retryAfterSeconds ?? 60);
}
