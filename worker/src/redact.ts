/**
 * Replaces secrets with `***` in text before the worker prints it or sends it to the API (L2-040 AC2): the value of
 * every credential the worker holds, and the API's SecretRedactor patterns — private keys, GitHub, Anthropic,
 * OpenAI-style, AWS and Azure keys, bearer tokens, and the value of a `password=` or `token:` style assignment.
 */
const patterns = new RegExp(
  [
    String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----`,
    String.raw`\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}`,
    String.raw`\bgithub_pat_[A-Za-z0-9_]{20,}`,
    // Anthropic keys (sk-ant-…) and other sk- keys.
    String.raw`\bsk-[A-Za-z0-9_\-]{20,}`,
    String.raw`\bAKIA[0-9A-Z]{16}\b`,
    // Azure: storage and Service Bus connection string keys, SAS signatures, and Entra ID client secrets.
    String.raw`(?<=\b(?:[Aa]ccount[Kk]ey|[Ss]hared[Aa]ccess[Kk]ey|[Ss]hared[Aa]ccess[Ss]ignature|sig)=)[^;&\s"']{8,}`,
    String.raw`\b[A-Za-z0-9_~.\-]{3}\dQ~[A-Za-z0-9_~.\-]{31,34}`,
    String.raw`(?<=[Bb][Ee][Aa][Rr][Ee][Rr]\s+)[A-Za-z0-9._\-~+/]{16,}=*`,
    String.raw`(?<=(?:[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]|[Pp][Aa][Ss][Ss][Ww][Dd]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Tt][Oo][Kk][Ee][Nn]|[Aa][Pp][Ii][_-]?[Kk][Ee][Yy])\s*[:=]\s*)[^\s;&"']+`,
  ].join('|'),
  'g',
);

export const MASK = '***';

/** Values shorter than this aren't matched as they are, so a short setting can't mask ordinary words. */
const MINIMUM_KNOWN_LENGTH = 8;

let known: string[] = [];

/** Adds a credential's value to those replaced wherever they appear; blank and short values are ignored. */
export function rememberSecret(value: string | undefined): void {
  if (value === undefined || value.trim().length < MINIMUM_KNOWN_LENGTH || known.includes(value)) return;
  known = [...known, value].sort((a, b) => b.length - a.length);
}

export function redact(text: string): string {
  for (const value of known) text = text.split(value).join(MASK);
  return text.replace(patterns, MASK);
}
