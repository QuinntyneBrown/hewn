/**
 * Masks credentials in text before the worker prints it (L2-040). The same patterns as the API's SecretRedactor:
 * private keys, GitHub, OpenAI-style and AWS keys, bearer tokens, and `password=`, `token:` style assignments.
 */
const patterns = new RegExp(
  [
    String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----`,
    String.raw`\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}`,
    String.raw`\bgithub_pat_[A-Za-z0-9_]{20,}`,
    String.raw`\bsk-[A-Za-z0-9_\-]{20,}`,
    String.raw`\bAKIA[0-9A-Z]{16}\b`,
    String.raw`[Bb][Ee][Aa][Rr][Ee][Rr]\s+[A-Za-z0-9._\-~+/]{16,}=*`,
    String.raw`(?:[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]|[Pp][Aa][Ss][Ss][Ww][Dd]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Tt][Oo][Kk][Ee][Nn]|[Aa][Pp][Ii][_-]?[Kk][Ee][Yy])\s*[:=]\s*\S+`,
  ].join('|'),
  'g',
);

export const MASK = '[redacted]';

export function redact(text: string): string {
  return text.replace(patterns, MASK);
}
