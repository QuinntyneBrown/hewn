import { HttpErrorResponse } from '@angular/common/http';

/** One broken field rule: the inline message and the shorter line for the error summary. */
export interface FieldError {
  field: string;
  message: string;
  summary: string;
}

/** A 400 ProblemDetails with field errors, mapped for forms. */
export class FieldErrorsProblem extends Error {
  constructor(
    readonly errors: FieldError[],
    readonly code: string | null,
  ) {
    super('One or more fields are invalid.');
  }

  for(field: string): FieldError | undefined {
    return this.errors.find((e) => e.field === field);
  }
}

interface ValidationProblemBody {
  code?: string;
  errors?: Record<string, string[]>;
  summary?: Record<string, string>;
}

/** Turns an HTTP 400 ProblemDetails into FieldErrorsProblem; returns null for anything else. */
export function toFieldErrors(error: unknown): FieldErrorsProblem | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) {
    return null;
  }
  const body = (error.error ?? {}) as ValidationProblemBody;
  if (!body.errors) {
    return null;
  }
  const errors = Object.entries(body.errors).map(([field, messages]) => ({
    field,
    message: messages[0] ?? '',
    summary: body.summary?.[field] ?? messages[0] ?? '',
  }));
  return new FieldErrorsProblem(errors, body.code ?? null);
}
