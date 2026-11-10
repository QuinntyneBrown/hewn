// Acceptance Test
// Traces to: L2-042
// Description: A run's commands get their own workspace and none of the worker's credentials (AC1); their network requests go through the run's egress proxy, which allows only GitHub, the model API, Magic Patterns and the stack's registries and blocks and logs the rest (AC2); a tool not on the stage's allow list is denied and logged as a security event (AC3)

import { request as httpRequest, createServer, type Server } from 'node:http';
import { connect } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { EgressProxy, egressAllowList, requestThroughProxy } from '../src/isolation/egress-proxy.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';
import { ToolDeniedError, ToolGate } from '../src/isolation/tool-gate.ts';
import { commandEnvironment, containerCommand } from '../src/isolation/run-sandbox.ts';

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

/** An HTTP request through the proxy for an absolute URL; resolves with the status. */
function viaProxy(proxy: string, url: string): Promise<number> {
  const { hostname, port } = new URL(proxy);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: hostname, port, path: url, method: 'GET', headers: { host: new URL(url).host } },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** A CONNECT through the proxy, as HTTPS clients do; resolves with the proxy's status line. */
function connectVia(proxy: string, target: string): Promise<string> {
  const { hostname, port } = new URL(proxy);
  return new Promise((resolve, reject) => {
    const socket = connect(Number(port), hostname, () =>
      socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`),
    );
    socket.once('data', (chunk) => {
      resolve(chunk.toString('latin1').split('\r\n')[0]!);
      socket.destroy();
    });
    socket.on('error', reject);
  });
}

async function upstream(): Promise<{ url: string }> {
  const server: Server = createServer((_req, res) => res.end('ok'));
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  closers.push(() => new Promise((done) => server.close(() => done())));
  const address = server.address() as { port: number };
  return { url: `http://127.0.0.1:${address.port}/` };
}

describe('Egress', () => {
  it('allows only GitHub, the model API, Magic Patterns and the stack registries', () => {
    const hosts = egressAllowList({ magicPatternsUrl: 'https://mcp.magicpatterns.com/mcp' });

    expect(hosts).toEqual(
      expect.arrayContaining([
        'github.com',
        'api.github.com',
        'api.anthropic.com',
        'mcp.magicpatterns.com',
        'registry.npmjs.org',
        'api.nuget.org',
      ]),
    );
    expect(hosts).not.toContain('example.com');
  });

  it('forwards requests to allowed hosts and blocks and logs the rest', async () => {
    const { url } = await upstream();
    const blocked: string[] = [];
    const proxy = new EgressProxy(['127.0.0.1'], (host) => blocked.push(host));
    const proxyUrl = await proxy.start();
    closers.push(() => proxy.stop());

    expect(await viaProxy(proxyUrl, url)).toBe(200);
    expect(await viaProxy(proxyUrl, 'http://exfiltrate.example/steal')).toBe(403);
    expect(await connectVia(proxyUrl, 'evil.example:443')).toBe('HTTP/1.1 403 Forbidden');

    expect(blocked).toEqual(['exfiltrate.example', 'evil.example']);
  });
});

describe('ToolGate', () => {
  it("denies a tool not on the stage's allow list and logs it as a security event", () => {
    const events: string[] = [];
    const gate = new ToolGate(['Read', 'Write'], (tool) => events.push(tool));

    gate.require('Write');
    expect(() => gate.require('Bash')).toThrow(ToolDeniedError);
    expect(gate.allows('Bash')).toBe(false);

    expect(events).toEqual(['Bash']);
  });
});

describe('Run commands', () => {
  it("never carry the worker's credentials, and reach the network only through the run's proxy", () => {
    const env = commandEnvironment('/tmp/hewn-run-1', 'http://127.0.0.1:41234', {
      PATH: '/usr/bin',
      HEWN_WORKER_TOKEN: 'secret-token',
      HEWN_MAGIC_PATTERNS_TOKEN: 'mp-secret',
      GITHUB_TOKEN: 'ghp_secret',
      AWS_SECRET_ACCESS_KEY: 'aws',
    });

    expect(Object.values(env).join(' ')).not.toMatch(/secret|ghp_|aws/);
    expect(env).toMatchObject({
      PATH: '/usr/bin',
      HOME: '/tmp/hewn-run-1',
      CI: '1',
      HTTPS_PROXY: 'http://127.0.0.1:41234',
      HTTP_PROXY: 'http://127.0.0.1:41234',
    });
  });

  it('run in their own container with only the workspace mounted, when the worker is set to', () => {
    const { command, args } = containerCommand(
      { image: 'node:24-bookworm-slim', runId: 'run-1', workspace: '/tmp/hewn-run-1', proxyPort: 41234 },
      { command: 'npm', args: ['test'], cwd: 'frontend' },
    );

    expect(command).toBe('docker');
    expect(args).toEqual([
      'run',
      '--rm',
      '--name',
      'hewn-run-1-npm',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--user',
      '1000:1000',
      '--add-host',
      'host.docker.internal:host-gateway',
      '-v',
      '/tmp/hewn-run-1:/workspace',
      '-w',
      '/workspace/frontend',
      '-e',
      'HOME=/workspace',
      '-e',
      'CI=1',
      '-e',
      'HTTPS_PROXY=http://host.docker.internal:41234',
      '-e',
      'HTTP_PROXY=http://host.docker.internal:41234',
      'node:24-bookworm-slim',
      'npm',
      'test',
    ]);
  });
});

describe('A run', () => {
  it('gets its own egress proxy and tool gates, and its log shows each blocked request and denied tool', async () => {
    const api = new FakeHewnApi();
    api.enqueueStage(0, 0, 0);
    const stop = new AbortController();
    closers.push(async () => stop.abort());
    const seen: { proxy?: string; env?: Record<string, string> } = {};

    void new WorkLoop({
      api,
      registration: { name: 'hewn-local-01', location: 'Local', host: 'test-host', version: '0.1.0' },
      log: () => {},
      isolation: { allowedHosts: ['127.0.0.1'], sandbox: 'process', image: 'node:24-bookworm-slim' },
      executor: {
        plan: (_run, context) => [
          {
            name: 'misled agent',
            execute: async () => {
              const isolation = context.isolation!;
              seen.proxy = isolation.egressProxyUrl;
              seen.env = isolation.sandbox.prepare(context.workspace, { command: 'npm', args: ['test'] }).env;
              expect(() => isolation.toolGate(['Read', 'Write']).require('Bash')).toThrow(ToolDeniedError);
              expect(await requestThroughProxy(isolation.egressProxyUrl, 'https://exfiltrate.example/')).toBe(403);
            },
          },
        ],
      },
    }).run(stop.signal);

    const deadline = Date.now() + 5_000;
    while (api.count('result') === 0 && Date.now() < deadline) await new Promise((done) => setTimeout(done, 20));

    expect(api.count('result')).toBe(1);
    expect(seen.env?.HTTPS_PROXY).toBe(seen.proxy);
    expect(api.logs).toEqual([
      {
        runId: 'run-1',
        level: 'error',
        text: "Security event: tool Bash denied; it is not on this stage's allow list (L2-042)",
      },
      { runId: 'run-1', level: 'warn', text: 'Egress blocked: exfiltrate.example is not an allowed host (L2-042)' },
    ]);
  });
});
