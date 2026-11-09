// Runs the fake Magic Patterns MCP server for the e2e stack: PORT and MAGIC_PATTERNS_TOKEN are required.
import { startFakeMagicPatterns } from './fake-server.ts';

const port = Number(process.env.PORT);
const token = process.env.MAGIC_PATTERNS_TOKEN;
if (!port || !token) {
  console.error('PORT and MAGIC_PATTERNS_TOKEN are required.');
  process.exit(2);
}

const server = await startFakeMagicPatterns({ port, token });
console.log(`Fake Magic Patterns MCP on ${server.url}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => void server.close().then(() => process.exit(0)));
