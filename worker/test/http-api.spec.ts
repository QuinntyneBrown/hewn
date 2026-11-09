// Acceptance Test
// Traces to: L2-026
// Description: The worker speaks the HTTP protocol with its bearer token and maps 204 and 409 to no work and a lost lease

import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { LeaseLostError } from '../src/api.ts';
import { HttpHewnApi } from '../src/http-api.ts';

let server: Server | undefined;
const seen: { url?: string; auth?: string; body: unknown }[] = [];

async function serve(status: number, body?: unknown): Promise<string> {
  server = createServer(async (req: IncomingMessage, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    seen.push({ url: req.url, auth: req.headers.authorization, body: raw ? JSON.parse(raw) : undefined });
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  seen.length = 0;
  await new Promise((resolve) => server?.close(resolve));
});

const run = { runId: 'r1', epoch: 3 } as never;

describe('HttpHewnApi', () => {
  it('sends the worker token as a bearer token', async () => {
    const api = new HttpHewnApi(await serve(200, { workerId: 'wkr_1' }), 'tok-123');

    expect(await api.register({ name: 'n', location: 'Cloud', host: 'h', version: 'v' })).toBe('wkr_1');
    expect(seen[0]).toMatchObject({ url: '/api/worker/register', auth: 'Bearer tok-123' });
  });

  it('treats 204 from lease as no work', async () => {
    const api = new HttpHewnApi(await serve(204), 'tok');

    expect(await api.lease('wkr_1')).toBeNull();
  });

  it('raises LeaseLostError on 409 and sends the epoch with every run call', async () => {
    const api = new HttpHewnApi(await serve(409, { code: 'lease_lost' }), 'tok');

    await expect(api.heartbeat('wkr_1', run)).rejects.toBeInstanceOf(LeaseLostError);
    expect(seen[0]).toMatchObject({ url: '/api/worker/runs/r1/heartbeat', body: { workerId: 'wkr_1', epoch: 3 } });
  });

  it('never includes the token in an error message', async () => {
    const api = new HttpHewnApi(await serve(500), 'tok-secret-value');

    await expect(api.lease('wkr_1')).rejects.toThrow(/500/);
    await api.lease('wkr_1').catch((e: Error) => expect(e.message).not.toContain('tok-secret-value'));
  });
});
