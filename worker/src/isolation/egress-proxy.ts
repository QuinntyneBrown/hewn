import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { connect, type Socket } from 'node:net';

/**
 * The hosts a run may reach (L2-042 AC2): the model API, the Magic Patterns MCP server and the package registries of
 * the stacks Hewn scaffolds (npm for Angular, NuGet for .NET). GitHub is not on it: a run reads and writes its
 * repository only through the Hewn API, which holds the GitHub credentials (agent-isolation design, ADR 0025).
 */
export function egressAllowList(options: { magicPatternsUrl?: string } = {}): string[] {
  const hosts = ['api.anthropic.com', 'registry.npmjs.org', 'api.nuget.org', 'www.nuget.org'];
  if (options.magicPatternsUrl) hosts.push(new URL(options.magicPatternsUrl).hostname);
  return hosts;
}

/**
 * A run's only route out (L2-042 AC2): an HTTP proxy on the worker that tunnels (CONNECT) or forwards
 * requests to allowed hosts and answers 403 to the rest, reporting each blocked host. One per run, so a blocked
 * request is logged against the run that made it.
 */
export class EgressProxy {
  private server: Server | null = null;
  private readonly sockets = new Set<Socket>();

  private readonly allowed: readonly string[];
  private readonly onBlocked: (host: string) => void;
  private readonly bind: string;

  constructor(allowed: readonly string[], onBlocked: (host: string) => void, bind = '127.0.0.1') {
    this.allowed = allowed.map((host) => host.toLowerCase());
    this.onBlocked = onBlocked;
    this.bind = bind;
  }

  allows(host: string): boolean {
    return this.allowed.includes(host.toLowerCase());
  }

  /** Starts on a free port and returns the proxy's URL. */
  async start(): Promise<string> {
    const server = createServer((req, res) => this.forward(req, res));
    server.on('connect', (req: IncomingMessage, client: Socket, head: Buffer) => this.tunnel(req, client, head));
    server.on('connection', (socket: Socket) => {
      this.sockets.add(socket);
      socket.on('close', () => this.sockets.delete(socket));
    });
    await new Promise<void>((done) => server.listen(0, this.bind, done));
    this.server = server;
    const host = this.bind === '0.0.0.0' ? '127.0.0.1' : this.bind;
    return `http://${host}:${(server.address() as { port: number }).port}`;
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((done) => (this.server ? this.server.close(() => done()) : done()));
    this.server = null;
  }

  /** Plain HTTP, asked for with an absolute URL. */
  private forward(req: IncomingMessage, res: ServerResponse): void {
    let target: URL;
    try {
      target = new URL(req.url ?? '');
    } catch {
      res.writeHead(400).end();
      return;
    }

    if (!this.allows(target.hostname)) {
      this.onBlocked(target.hostname);
      res.writeHead(403, { 'content-type': 'text/plain' }).end(`Hewn blocks requests to ${target.hostname}.\n`);
      return;
    }

    const upstream = httpRequest(
      {
        host: target.hostname,
        port: target.port || 80,
        path: `${target.pathname}${target.search}`,
        method: req.method,
        headers: req.headers,
      },
      (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
      },
    );
    upstream.on('error', () => res.writeHead(502).end());
    req.pipe(upstream);
  }

  /** HTTPS and anything else: CONNECT host:port, then bytes both ways. */
  private tunnel(req: IncomingMessage, client: Socket, head: Buffer): void {
    const [host = '', port = '443'] = (req.url ?? '').split(':');
    if (!this.allows(host)) {
      this.onBlocked(host);
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }

    const upstream = connect(Number(port), host, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length > 0) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on('error', () => client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'));
    client.on('error', () => upstream.destroy());
  }
}

/**
 * A request through a run's egress proxy, as a tool that honours HTTPS_PROXY makes it: CONNECT for https, an
 * absolute URL for http. Resolves with the proxy's status (403 when blocked).
 */
export function requestThroughProxy(proxyUrl: string, url: string, signal?: AbortSignal): Promise<number> {
  const proxy = new URL(proxyUrl);
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const options = { host: proxy.hostname, port: proxy.port, signal };
    if (target.protocol === 'https:') {
      const req = httpRequest({ ...options, method: 'CONNECT', path: `${target.hostname}:${target.port || 443}` });
      req.on('connect', (res, socket) => {
        socket.destroy();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
      return;
    }

    const req = httpRequest({ ...options, method: 'GET', path: url, headers: { host: target.host } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });
}
