import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/** The Magic Patterns operations the design stages need (L2-010, L2-012). */
export interface MagicPatterns {
  /** Connects and checks the credential; throws MagicPatternsUnavailable. */
  ping(): Promise<void>;
  createDesign(request: { name: string; prompt: string }): Promise<{ editorId: string; url: string }>;
  waitUntilReady(editorId: string, signal?: AbortSignal): Promise<void>;
  /** Files of the design's active artifact, by file name. */
  readFiles(editorId: string, fileNames: string[]): Promise<Record<string, string>>;
  /** CSS custom properties of the active custom design system, or null when the project has none. */
  designSystemTokens(): Promise<Record<string, string> | null>;
  close(): Promise<void>;
}

export class MagicPatternsUnavailable extends Error {
  constructor(reason: string) {
    super(`Magic Patterns unavailable: ${reason}`);
  }
}

/** Talks to the Magic Patterns MCP server over streamable HTTP with a bearer credential. */
export class McpMagicPatterns implements MagicPatterns {
  private readonly url: string;
  private readonly token: string;
  private readonly pollMs: number;
  private client: Client | null = null;

  constructor(url: string, token: string, options: { pollMs?: number } = {}) {
    this.url = url;
    this.token = token;
    this.pollMs = options.pollMs ?? 60_000;
  }

  async ping(): Promise<void> {
    await this.connect();
  }

  async createDesign(request: { name: string; prompt: string }): Promise<{ editorId: string; url: string }> {
    const result = (await this.call('create_design', request)) as { editorId: string; url?: string };
    return { editorId: result.editorId, url: result.url ?? `https://www.magicpatterns.com/c/${result.editorId}` };
  }

  async waitUntilReady(editorId: string, signal?: AbortSignal): Promise<void> {
    // Generation takes minutes; Magic Patterns asks callers to poll no more than once a minute.
    while (((await this.call('get_design_status', { editorId })) as { isGenerating: boolean }).isGenerating) {
      if (signal?.aborted) throw new Error('Stopped while Magic Patterns was generating');
      await new Promise((resolve) => setTimeout(resolve, this.pollMs));
    }
  }

  async readFiles(editorId: string, fileNames: string[]): Promise<Record<string, string>> {
    const status = (await this.call('get_design_status', { editorId })) as { activeArtifactId: string };
    const result = (await this.call('read_artifact_files', { artifactId: status.activeArtifactId, fileNames })) as {
      files: { fileName: string; content: string }[];
    };
    return Object.fromEntries(result.files.map((f) => [f.fileName, f.content]));
  }

  async designSystemTokens(): Promise<Record<string, string> | null> {
    const { designSystems } = (await this.call('list_design_systems', {})) as {
      designSystems: { id: string; isReserved: boolean; isActive: boolean }[];
    };
    const active = designSystems.find((d) => d.isActive && !d.isReserved);
    if (!active) return null;
    const { files } = (await this.call('read_design_system_files', {
      designSystemId: active.id,
      fileNames: ['index.css'],
    })) as { files: { content: string }[] };
    const css = files.map((f) => f.content).join('\n');
    // Light values: the first declaration of each property, before any dark-scheme block.
    const light = css.split(/@media\s*\(prefers-color-scheme:\s*dark\)/)[0] ?? css;
    return Object.fromEntries([...light.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
  }

  async close(): Promise<void> {
    await this.client?.close().catch(() => undefined);
    this.client = null;
  }

  private async connect(): Promise<Client> {
    if (this.client) return this.client;
    const client = new Client({ name: 'hewn-worker', version: '0.1.0' });
    const transport = new StreamableHTTPClientTransport(new URL(this.url), {
      requestInit: { headers: { authorization: `Bearer ${this.token}` } },
    });
    try {
      await client.connect(transport);
    } catch (error) {
      await client.close().catch(() => undefined);
      // Never pass the server's message on: it can echo the request, credential included.
      throw new MagicPatternsUnavailable(
        /\b401\b|\b403\b|unauthori[sz]ed|invalid_token/i.test(String(error)) ? 'credential rejected' : 'unreachable',
      );
    }
    this.client = client;
    return client;
  }

  private async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const client = await this.connect();
    const result = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content: { type: string; text?: string }[];
    };
    const text = result.content.find((c) => c.type === 'text')?.text ?? '{}';
    if (result.isError) throw new Error(`Magic Patterns ${name} failed`);
    return JSON.parse(text);
  }
}
