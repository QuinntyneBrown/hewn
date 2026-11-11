import type { Log } from './work-loop.ts';
import { redact } from './redact.ts';

/**
 * A log that writes each entry as one line of JSON (L2-049 AC1): timestamp, level and message, then the entry's
 * fields, such as projectId, directionId, stage, runId and traceId. `level` is a field too, Information by default,
 * named as the API names them. Strings are redacted first.
 */
export function jsonLog(write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): Log {
  return (message, fields = {}) => {
    const { level = 'Information', ...rest } = fields;
    const entry: Record<string, unknown> = { timestamp: new Date().toISOString(), level, message: redact(message) };
    for (const [key, value] of Object.entries(rest)) entry[key] = typeof value === 'string' ? redact(value) : value;
    write(JSON.stringify(entry));
  };
}
