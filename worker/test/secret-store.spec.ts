// Acceptance Test
// Traces to: L2-040
// Description: A local worker reads its credentials from the OS key store the operator supplied them to with
// `hewn secret set` (macOS keychain, Linux Secret Service), over environment variables (AC1)

import { describe, expect, it } from 'vitest';
import { loadCredentials, type KeyStoreCommand } from '../src/secret-store.ts';

/** `hewn secret set` writes `hewn1:{unix ms}:{base64}` under service `hewn`, account = the credential's name. */
const item = (value: string) => `hewn1:1794376884302:${Buffer.from(value).toString('base64')}`;

function keyStore(items: Record<string, string>) {
  const calls: { file: string; args: readonly string[] }[] = [];
  const run: KeyStoreCommand = (file, args) => {
    calls.push({ file, args });
    const service = file === 'security' ? args[args.indexOf('-s') + 1] : args[args.indexOf('service') + 1];
    const account = file === 'security' ? args[args.indexOf('-a') + 1] : args[args.indexOf('account') + 1];
    const found = items[`${service}/${account}`];
    return found === undefined
      ? { status: file === 'security' ? 44 : 1, stdout: '' }
      : { status: 0, stdout: `${found}\n` };
  };
  return { run, calls };
}

describe('worker credentials from the OS key store', () => {
  it.each(['darwin', 'linux'] as const)(
    'fills the worker token, model key and Magic Patterns token on %s',
    (platform) => {
      const { run, calls } = keyStore({
        'hewn/worker-token': item('worker-token-from-keychain'),
        'hewn/model-api-key': item('sk-ant-api03-from-keychain-0123456789'),
      });
      const env: Record<string, string | undefined> = {
        HEWN_WORKER_TOKEN: 'from-env',
        HEWN_MAGIC_PATTERNS_TOKEN: 'mp-env',
      };

      const loaded = loadCredentials(env, { store: 'os', platform, run });

      expect(loaded).toEqual(['worker-token', 'model-api-key']);
      expect(env).toEqual({
        HEWN_WORKER_TOKEN: 'worker-token-from-keychain',
        ANTHROPIC_API_KEY: 'sk-ant-api03-from-keychain-0123456789',
        HEWN_MAGIC_PATTERNS_TOKEN: 'mp-env',
      });
      expect(calls.map((c) => c.file)).toEqual(Array(3).fill(platform === 'darwin' ? 'security' : 'secret-tool'));
    },
  );

  it('reads nothing without HEWN_SECRET_STORE=os, and ignores items Hewn did not write', () => {
    const { run, calls } = keyStore({ 'hewn/worker-token': 'typed-by-hand' });
    const env: Record<string, string | undefined> = {};

    expect(loadCredentials(env, { store: undefined, platform: 'darwin', run })).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(loadCredentials(env, { store: 'os', platform: 'darwin', run })).toEqual([]);
    expect(env).toEqual({});
  });

  it('refuses a store it cannot read on this platform', () => {
    expect(() => loadCredentials({}, { store: 'os', platform: 'win32', run: keyStore({}).run })).toThrow(
      'The OS key store is supported on macOS and Linux.',
    );
  });
});
