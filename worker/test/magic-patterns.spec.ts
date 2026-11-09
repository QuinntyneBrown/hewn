// Acceptance Test
// Traces to: L2-010, L2-012
// Description: The worker drives Magic Patterns over MCP to create designs and read their files, and reports an unreachable or refused server as "Magic Patterns unavailable"

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McpMagicPatterns, MagicPatternsUnavailable } from '../src/magic-patterns/magic-patterns.ts';
import { startFakeMagicPatterns, type FakeMagicPatterns } from '../src/magic-patterns/fake-server.ts';

let fake: FakeMagicPatterns;

beforeEach(async () => (fake = await startFakeMagicPatterns({ token: 'mp-secret' })));
afterEach(async () => fake.close());

describe('McpMagicPatterns', () => {
  it('creates a design, waits for it and reads each state file', async () => {
    const client = new McpMagicPatterns(fake.url, 'mp-secret', { pollMs: 1 });

    const design = await client.createDesign({
      name: 'Sign in',
      prompt: 'A sign-in screen with default, loading, empty and error states.',
    });
    await client.waitUntilReady(design.editorId);
    const files = await client.readFiles(design.editorId, ['default.html', 'error.html']);

    expect(design.url).toBe(`https://www.magicpatterns.com/c/${design.editorId}`);
    expect(files['default.html']).toContain('<title>Sign in');
    expect(files['error.html']).toContain('data-state="error"');
    expect(fake.designs()).toEqual([
      { editorId: design.editorId, name: 'Sign in', prompt: expect.stringContaining('sign-in') },
    ]);
    await client.close();
  });

  it('reads the active design system tokens, or null when there is none', async () => {
    const client = new McpMagicPatterns(fake.url, 'mp-secret', { pollMs: 1 });

    expect(await client.designSystemTokens()).toMatchObject({ '--color-primary': '#2563eb' });
    await client.close();

    await fake.close();
    fake = await startFakeMagicPatterns({ token: 'mp-secret', designSystem: null });
    const none = new McpMagicPatterns(fake.url, 'mp-secret', { pollMs: 1 });
    expect(await none.designSystemTokens()).toBeNull();
    await none.close();
  });

  it('reports a refused credential without echoing it', async () => {
    const client = new McpMagicPatterns(fake.url, 'wrong-token', { pollMs: 1 });

    const error = await client.ping().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MagicPatternsUnavailable);
    expect((error as Error).message).toBe('Magic Patterns unavailable: credential rejected');
    await client.close();
  });

  it('reports an unreachable server', async () => {
    await fake.close();
    const client = new McpMagicPatterns(fake.url, 'mp-secret', { pollMs: 1 });

    await expect(client.ping()).rejects.toThrow('Magic Patterns unavailable: unreachable');
    await client.close();
  });
});
