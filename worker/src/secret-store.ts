import { spawnSync } from 'node:child_process';

/** Runs a key store tool and returns its exit status and output. Nothing is ever passed to it but names. */
export type KeyStoreCommand = (file: string, args: readonly string[]) => { status: number | null; stdout: string };

/** The credentials a worker uses, by store name and the environment variable it fills (L2-040 AC1). */
export const WORKER_CREDENTIALS = [
  { name: 'worker-token', env: 'HEWN_WORKER_TOKEN' },
  { name: 'model-api-key', env: 'ANTHROPIC_API_KEY' },
  { name: 'magic-patterns-token', env: 'HEWN_MAGIC_PATTERNS_TOKEN' },
] as const;

const PREFIX = 'hewn1:';

const runTool: KeyStoreCommand = (file, args) => {
  const result = spawnSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return { status: result.status, stdout: result.stdout ?? '' };
};

/** Reads one credential `hewn secret set` wrote: `hewn1:{unix ms}:{base64}` under the service, account = name. */
function read(name: string, service: string, platform: NodeJS.Platform, run: KeyStoreCommand): string | undefined {
  const { status, stdout } =
    platform === 'darwin'
      ? run('security', ['find-generic-password', '-s', service, '-a', name, '-w'])
      : run('secret-tool', ['lookup', 'service', service, 'account', name]);
  const item = stdout.trim();
  if (status !== 0 || !item.startsWith(PREFIX)) return undefined;
  const [, encoded] = item.slice(PREFIX.length).split(':', 2);
  return encoded === undefined ? undefined : Buffer.from(encoded, 'base64').toString('utf8');
}

/**
 * With `HEWN_SECRET_STORE=os`, fills each worker credential's environment variable from the OS key store, which
 * encrypts it at rest (macOS keychain, Linux Secret Service; ADR 0037). A stored value wins over the environment, as
 * in the API. Returns the names it found. Cloud workers get theirs from Key Vault through the container's settings.
 */
export function loadCredentials(
  env: Record<string, string | undefined>,
  options: { store: string | undefined; platform?: NodeJS.Platform; service?: string; run?: KeyStoreCommand },
): string[] {
  if (options.store !== 'os') return [];
  const platform = options.platform ?? process.platform;
  if (platform !== 'darwin' && platform !== 'linux') {
    throw new Error('The OS key store is supported on macOS and Linux.');
  }
  const loaded: string[] = [];
  for (const credential of WORKER_CREDENTIALS) {
    const value = read(credential.name, options.service ?? 'hewn', platform, options.run ?? runTool);
    if (value === undefined) continue;
    env[credential.env] = value;
    loaded.push(credential.name);
  }
  return loaded;
}
