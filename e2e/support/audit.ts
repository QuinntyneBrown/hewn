import type { Page } from '@playwright/test';
import { xsrfToken } from './queue';

/** Sends an edit to the audit log with each method an API might use, and returns each status. */
export async function tryToEditAuditEntries(page: Page): Promise<Record<string, number>> {
  const headers = { 'X-XSRF-TOKEN': await xsrfToken(page) };
  const data = { actor: 'someone-else', action: 'Merge' };
  const answers: Record<string, number> = {};
  for (const method of ['PUT', 'PATCH', 'DELETE', 'POST'] as const) {
    for (const url of ['/api/audit', '/api/audit/1']) {
      answers[`${method} ${url}`] = (await page.request.fetch(url, { method, data, headers })).status();
    }
  }
  return answers;
}
