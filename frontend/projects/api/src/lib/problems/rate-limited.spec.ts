import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { RateLimitedProblem, toRateLimited } from './rate-limited';

describe('toRateLimited', () => {
  it('maps a 429 to the limit and when the Owner can submit again (L2-043 AC4)', () => {
    const problem = toRateLimited(
      new HttpErrorResponse({
        status: 429,
        error: { code: 'rate_limited', limit: 10, retryAfterSeconds: 42 },
      }),
    );

    expect(problem).toBeInstanceOf(RateLimitedProblem);
    expect(problem).toMatchObject({ limit: 10, retryAfterSeconds: 42 });
  });

  it('leaves anything else alone', () => {
    expect(toRateLimited(new HttpErrorResponse({ status: 400, error: {} }))).toBeNull();
    expect(toRateLimited(new Error('network'))).toBeNull();
  });
});
