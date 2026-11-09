// Acceptance Test
// Traces to: L2-045
// Description: With at least 50 projects and 20 connected workers, the read APIs Mission Control loads answer with a p95 of 300 ms or less under concurrent load

import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { xsrfToken } from '../../support/queue';
import { cancelDirections } from '../../support/rate-limit';
import { E2E_WORKER_TOKEN } from '../../support/workers';

const api = 'http://localhost:5300';
const idea = 'A web app for small accounting teams to reconcile statements.';
const requests = 1_000;
const concurrency = 20;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!;
}

test('the read APIs answer within 300 ms at the 95th percentile', async ({ page }) => {
  test.setTimeout(300_000);
  const created: string[] = [];

  // At least 50 projects, submitted by two Owners so the submission limit is not reached.
  for (const login of ['quinntynebrown', 'grace'] as const) {
    await signIn(page, login);
    const headers = { 'X-XSRF-TOKEN': await xsrfToken(page) };
    let count = ((await (await page.request.get('/api/projects')).json()) as unknown[]).length;
    for (let i = 0; count < 50 && i < 25; i++, count++) {
      const response = await page.request.post('/api/projects', {
        data: { name: uniqueName('Load'), idea, stackPreference: null, repositoryUrl: null, budgetUsd: 50 },
        headers,
      });
      expect(response.status()).toBe(201);
      created.push(((await response.json()) as { projectId: string }).projectId);
    }
    // Cancelled straight away, so no later suite runs them; they still count as projects.
    await cancelDirections(page, created.splice(0));
  }

  // 20 connected workers.
  for (let i = 0; i < 20; i++) {
    const registered = await page.request.post(`${api}/api/worker/register`, {
      data: {
        name: `load-worker-${i + 1}`,
        location: i % 2 ? 'Cloud' : 'Local',
        host: 'load-test',
        version: '0.0.0-load',
      },
      headers: { Authorization: `Bearer ${E2E_WORKER_TOKEN}` },
    });
    expect(registered.ok()).toBe(true);
  }

  await signIn(page, 'ada');
  const projects = (await (await page.request.get(`${api}/api/projects`)).json()) as { id: string }[];
  expect(projects.length).toBeGreaterThanOrEqual(50);
  const endpoints = [
    () => '/api/projects',
    () => `/api/projects/${projects[Math.floor(Math.random() * projects.length)]!.id}`,
    () => `/api/projects/${projects[Math.floor(Math.random() * projects.length)]!.id}/events?after=0`,
    () => '/api/workers',
    () => '/api/me',
  ];
  const samples = new Map<string, number[]>();
  let next = 0;
  const started = Date.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < requests) {
        const which = next++ % endpoints.length;
        const path = endpoints[which]!();
        const at = performance.now();
        const response = await page.request.get(`${api}${path}`);
        const ms = performance.now() - at;
        expect(response.status(), path).toBe(200);
        const key = path.replace(/[0-9a-f-]{36}/, '{id}');
        samples.set(key, [...(samples.get(key) ?? []), ms]);
      }
    }),
  );
  const all = [...samples.values()].flat();
  const report = {
    projects: projects.length,
    workers: ((await (await page.request.get(`${api}/api/workers`)).json()) as { workers: unknown[] }).workers.length,
    requests: all.length,
    concurrency,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    p95Ms: Math.round(p95(all)),
    byEndpoint: Object.fromEntries(
      [...samples].map(([k, v]) => [k, { requests: v.length, p95Ms: Math.round(p95(v)) }]),
    ),
  };
  mkdirSync('perf-results', { recursive: true });
  writeFileSync('perf-results/read-api-load.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));

  expect(report.workers).toBeGreaterThanOrEqual(20);
  expect(report.p95Ms, 'p95 across the read APIs (ms)').toBeLessThanOrEqual(300);
  for (const [endpoint, { p95Ms }] of Object.entries(report.byEndpoint)) {
    expect(p95Ms, `p95 of ${endpoint} (ms)`).toBeLessThanOrEqual(300);
  }
});
