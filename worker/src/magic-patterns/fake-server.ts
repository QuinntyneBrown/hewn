import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

/**
 * A stand-in Magic Patterns MCP server for tests and the e2e stack. It speaks MCP over streamable HTTP and serves
 * the editor tools the worker uses, with the same names and arguments as magicpatterns.com. Designs are ready
 * immediately and each holds one responsive HTML file per state.
 */
export interface FakeMagicPatterns {
  url: string;
  designs(): { editorId: string; name: string; prompt: string }[];
  close(): Promise<void>;
}

export interface FakeMagicPatternsOptions {
  token: string;
  port?: number;
  /** CSS of the active custom design system, or null for none. */
  designSystem?: string | null;
}

export const STATES = ['default', 'loading', 'empty', 'error'] as const;

const DESIGN_SYSTEM = `:root {
  --color-surface: #ffffff;
  --color-text: #1f2937;
  --color-primary: #2563eb;
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: #111827;
    --color-text: #f9fafb;
    --color-primary: #60a5fa;
  }
}
`;

export async function startFakeMagicPatterns(options: FakeMagicPatternsOptions): Promise<FakeMagicPatterns> {
  const designs = new Map<string, { name: string; prompt: string }>();
  const designSystem = options.designSystem === undefined ? DESIGN_SYSTEM : options.designSystem;

  const mcp = () => {
    const server = new McpServer({ name: 'fake-magic-patterns', version: '1.0.0' });
    const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] });

    server.registerTool(
      'create_design',
      { inputSchema: { name: z.string().optional(), prompt: z.string().optional() } },
      ({ name, prompt }) => {
        const editorId = randomUUID().replace(/-/g, '').slice(0, 20);
        designs.set(editorId, { name: name ?? 'Untitled', prompt: prompt ?? '' });
        return json({ editorId, url: `https://www.magicpatterns.com/c/${editorId}` });
      },
    );
    server.registerTool('get_design_status', { inputSchema: { editorId: z.string() } }, ({ editorId }) => {
      if (!designs.has(editorId)) return { ...json({ error: 'Design not found' }), isError: true };
      return json({
        isGenerating: false,
        activeArtifactId: `art_${editorId}`,
        availableFiles: STATES.map((s) => `${s}.html`),
      });
    });
    server.registerTool(
      'read_artifact_files',
      { inputSchema: { artifactId: z.string(), fileNames: z.array(z.string()) } },
      ({ artifactId, fileNames }) => {
        const design = designs.get(artifactId.replace(/^art_/, ''));
        if (!design) return { ...json({ error: 'Artifact not found' }), isError: true };
        return json({
          files: fileNames.map((fileName) => ({
            fileName,
            content: page(design.name, fileName.replace(/\.html$/, '')),
          })),
        });
      },
    );
    server.registerTool('list_design_systems', {}, () =>
      json({
        designSystems: [
          { id: 'ds-base', name: 'Base', isReserved: true, isActive: designSystem === null },
          ...(designSystem === null ? [] : [{ id: 'ds-project', name: 'Project', isReserved: false, isActive: true }]),
        ],
      }),
    );
    server.registerTool('get_design_system', { inputSchema: { designSystemId: z.string() } }, () =>
      json({ artifactId: 'art_ds', files: ['index.css'], hasUnpublishedChanges: false }),
    );
    server.registerTool(
      'read_design_system_files',
      { inputSchema: { designSystemId: z.string(), fileNames: z.array(z.string()) } },
      ({ fileNames }) => json({ files: fileNames.map((fileName) => ({ fileName, content: designSystem ?? '' })) }),
    );
    return server;
  };

  const http: Server = createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${options.token}`) {
      res.writeHead(401, { 'content-type': 'application/json' }).end('{"error":"invalid_token"}');
      return;
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = mcp();
    res.on('close', () => void transport.close().then(() => server.close()));
    await server.connect(transport);
    await transport.handleRequest(req, res, await body(req));
  });

  await new Promise<void>((resolve) => http.listen(options.port ?? 0, '127.0.0.1', resolve));
  const { port } = http.address() as AddressInfo;
  let closed = false;
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    designs: () => [...designs].map(([editorId, d]) => ({ editorId, ...d })),
    close: () =>
      closed
        ? Promise.resolve()
        : new Promise((resolve) => {
            closed = true;
            http.closeAllConnections();
            http.close(() => resolve());
          }),
  };
}

async function body(req: IncomingMessage): Promise<unknown> {
  if (req.method !== 'POST') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return chunks.length === 0 ? undefined : JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function page(name: string, state: string): string {
  const content: Record<string, string> = {
    default: `<ul class="list"><li>First item</li><li>Second item</li></ul><button class="primary">Continue</button>`,
    loading: `<p class="muted" role="status">Loading…</p>`,
    empty: `<p class="muted">Nothing here yet.</p><button class="primary">Add the first one</button>`,
    error: `<p role="alert">Something went wrong. Try again.</p><button class="primary">Try again</button>`,
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(name)} · ${state}</title>
<style>
${DESIGN_SYSTEM}
body { margin: 0; font-family: system-ui, sans-serif; background: var(--color-surface); color: var(--color-text); }
main { max-width: 960px; margin: 0 auto; padding: 16px; }
.primary { background: var(--color-primary); color: var(--color-surface); border: 0; border-radius: 8px; padding: 8px 16px; }
.muted { opacity: 0.7; }
</style>
</head>
<body>
<main data-state="${state}">
<h1>${escape(name)}</h1>
${content[state] ?? content.default}
</main>
</body>
</html>
`;
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
