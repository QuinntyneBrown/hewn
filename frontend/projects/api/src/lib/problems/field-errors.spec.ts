import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { toFieldErrors } from './field-errors';

describe('toFieldErrors', () => {
  it('maps a validation problem to inline messages and summary lines', () => {
    const problem = toFieldErrors(
      new HttpErrorResponse({
        status: 400,
        error: {
          code: 'repository_not_writable',
          errors: { repositoryUrl: ['Hewn’s GitHub App can’t write to a/b.'] },
          summary: { repositoryUrl: 'Hewn can’t write to this repository' },
        },
      }),
    );

    expect(problem?.code).toBe('repository_not_writable');
    expect(problem?.for('repositoryUrl')).toEqual({
      field: 'repositoryUrl',
      message: 'Hewn’s GitHub App can’t write to a/b.',
      summary: 'Hewn can’t write to this repository',
    });
  });

  it('ignores errors that are not field problems', () => {
    expect(toFieldErrors(new HttpErrorResponse({ status: 500 }))).toBeNull();
    expect(toFieldErrors(new Error('boom'))).toBeNull();
  });
});
