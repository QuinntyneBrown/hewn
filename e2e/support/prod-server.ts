import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import { connect } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const frontend = resolve(fileURLToPath(import.meta.url), '../../../frontend');
export const distDir = join(frontend, 'dist/mission-control/browser');
const api = { host: 'localhost', port: 5300 };
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

/** Builds Mission Control for production (`ng build`), as it ships. */
export function buildMissionControl(): void {
  execFileSync('npm', ['run', 'build'], { cwd: frontend, stdio: 'ignore' });
}

/**
 * Serves the production build on `port`, compressed as a production server would, with the e2e API behind
 * /api and /hubs (WebSockets included), so Lighthouse measures what users download.
 */
export async function serveMissionControl(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/hubs/')) {
      const upstream = request({ ...api, path: req.url, method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      upstream.on('error', () => res.writeHead(502).end());
      req.pipe(upstream);
      return;
    }
    const path = normalize(join(distDir, decodeURIComponent(url.pathname)));
    const file = path.startsWith(distDir) && existsSync(path) && extname(path) ? path : join(distDir, 'index.html');
    const body = readFileSync(file);
    const gzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      ...(gzip ? { 'content-encoding': 'gzip' } : {}),
    });
    res.end(gzip ? gzipSync(body) : body);
  });
  server.on('upgrade', (req, socket, head) => {
    const upstream = connect(api.port, api.host, () => {
      upstream.write(
        `${req.method} ${req.url} HTTP/1.1\r\n` +
          Object.entries(req.headers)
            .map(([k, v]) => `${k}: ${String(v)}\r\n`)
            .join('') +
          '\r\n',
      );
      upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
  });
  await new Promise<void>((done) => server.listen(port, done));
  return server;
}

/**
 * The initial JavaScript: every script index.html loads or preloads, and every chunk those import statically,
 * gzipped. Lazy routes (dynamic `import()`) are not initial.
 */
export function initialJavaScript(): { files: string[]; gzipBytes: number } {
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const pending = [...html.matchAll(/<(?:script[^>]*src|link rel="modulepreload"[^>]*href)="([^"]+\.js)"/g)].map(
    (m) => m[1]!,
  );
  const files = new Set<string>();
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    const code = readFileSync(join(distDir, file), 'utf8');
    for (const m of code.matchAll(/(?:\bfrom|\bimport)\s*["']\.\/([^"']+\.js)["']/g)) pending.push(m[1]!);
  }
  const gzipBytes = [...files].reduce((sum, f) => sum + gzipSync(readFileSync(join(distDir, f))).length, 0);
  return { files: [...files], gzipBytes };
}
