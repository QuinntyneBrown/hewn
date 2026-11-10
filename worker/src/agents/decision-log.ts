import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** One entry in `docs/decisions.md` (L2-054 AC2). */
export interface Decision {
  date: string;
  stage: number;
  stageName: string;
  question: string;
  answer: string;
  rationale: string;
  /** Set when the decision changes architecture; it is then also recorded as an ADR (L2-054 AC2). */
  architecture?: { context: string; consequences: string; alternatives?: string };
}

/**
 * L2-054 AC1, L2-028 AC2: every agent session is told that nobody will answer, and how to record what it decides.
 * Agents are never given a tool that asks a human.
 */
export const AUTONOMY = [
  'Nobody will answer questions, review your work or approve anything: carry on without waiting.',
  'When a skill or task asks a question meant for the user, answer it yourself from the direction, docs/brief.md and the existing documents.',
  'Append each answer to docs/decisions.md as "## {date} · Stage {n} {stage name}" followed by **Question:**, **Answer:** and **Rationale:** lines.',
  'When a decision changes the architecture, also write docs/adr/{NNNN}-{slug}.md (the next free number) with Context, Decision and Consequences, and add an **ADR:** link to the entry.',
].join('\n');

export const DECISIONS = 'docs/decisions.md';

const HEADER = '# Decisions\n\nQuestions agents answered for themselves, oldest first.\n';

export function formatDecision(d: Decision, adr?: string): string {
  return `\n## ${d.date} · Stage ${d.stage} ${d.stageName}\n\n**Question:** ${d.question}\n\n**Answer:** ${d.answer}\n\n**Rationale:** ${d.rationale}\n${
    adr ? `\n**ADR:** [${adr}](adr/${adr}.md)\n` : ''
  }`;
}

export function appendDecision(directory: string, decision: Decision): void {
  const path = join(directory, DECISIONS);
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) appendFileSync(path, HEADER);
  const adr = decision.architecture ? writeAdr(directory, decision) : undefined;
  appendFileSync(path, formatDecision(decision, adr));
}

/** Writes `docs/adr/{NNNN}-{slug}.md` with the next free number and returns its name without the extension. */
function writeAdr(directory: string, decision: Decision): string {
  const folder = join(directory, 'docs/adr');
  mkdirSync(folder, { recursive: true });
  const numbers = readdirSync(folder)
    .map((f) => /^(\d{4})-/.exec(f)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  const number = Math.max(0, ...numbers) + 1;
  const title = decision.answer.replace(/[.\s]+$/, '');
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
  const name = `${String(number).padStart(4, '0')}-${slug}`;
  writeFileSync(
    join(folder, `${name}.md`),
    `# ${number}. ${title}\n\n**Status:** Accepted · ${decision.date} · Stage ${decision.stage} ${decision.stageName}\n\n## Context\n\n${decision.architecture!.context}\n\n## Decision\n\n${decision.answer} ${decision.rationale}\n\n## Alternatives\n\n${decision.architecture!.alternatives ?? 'None recorded.'}\n\n## Consequences\n\n${decision.architecture!.consequences}\n`,
  );
  return name;
}

/** L2-054 AC2: every entry has the heading and the three fields, and every linked ADR exists. */
export function validateDecisions(directory: string): string[] {
  const text = readDecisions(directory);
  return text
    .split(/^## /m)
    .slice(1)
    .flatMap((entry, i) => {
      const question = /\*\*Question:\*\*\s*(.+)/.exec(entry)?.[1]?.trim();
      const label = `Decision ${i + 1}${question ? ` ("${question}")` : ''}`;
      const problems: string[] = [];
      if (!/^\d{4}-\d{2}-\d{2} · Stage \d+ \S/.test(entry))
        problems.push(`${label} has no "{date} · Stage {n} {name}" heading`);
      for (const field of ['Question', 'Answer', 'Rationale']) {
        if (!new RegExp(`\\*\\*${field}:\\*\\*\\s*\\S`).test(entry)) problems.push(`${label} has no **${field}:**`);
      }
      const adr = /\*\*ADR:\*\*\s*\[[^\]]*\]\(adr\/([^)]+)\)/.exec(entry)?.[1];
      if (adr && !existsSync(join(directory, 'docs/adr', adr)))
        problems.push(`${label} links docs/adr/${adr}, which does not exist`);
      return problems;
    });
}

/** ADR files linked from the decision log, as repository paths. */
export function linkedAdrs(directory: string): string[] {
  return [...readDecisions(directory).matchAll(/\*\*ADR:\*\*\s*\[[^\]]*\]\(adr\/([^)]+)\)/g)].map(
    (m) => `docs/adr/${m[1]}`,
  );
}

/** Decisions in the log text, in order; entries that are missing a field are skipped. */
export function parseDecisions(text: string): { question: string; answer: string; rationale: string; adr?: string }[] {
  return text
    .split(/^## /m)
    .slice(1)
    .flatMap((entry) => {
      const question = /\*\*Question:\*\*\s*(.+)/.exec(entry)?.[1]?.trim();
      const answer = /\*\*Answer:\*\*\s*(.+)/.exec(entry)?.[1]?.trim();
      const rationale = /\*\*Rationale:\*\*\s*(.+)/.exec(entry)?.[1]?.trim() ?? '';
      // L2-054 AC2: the ADR an architecture decision links, as docs/adr/NNNN-slug.md.
      const adr = /\*\*ADR:\*\*.*\]\(adr\/(\d{4}-[a-z0-9-]+\.md)\)/.exec(entry)?.[1];
      return question && answer ? [{ question, answer, rationale, ...(adr ? { adr: `docs/adr/${adr}` } : {}) }] : [];
    });
}

export function readDecisions(directory: string): string {
  const path = join(directory, DECISIONS);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/** The question stage 1 of a feature direction answers, so Hewn knows whether stages 2 and 3 run (L2-005 AC2). */
export const UI_CHANGE_QUESTION = 'Does this feature change the user interface?';

/**
 * The latest answer to {@link UI_CHANGE_QUESTION} among the entries after `skip`: an answer starting "No" means no
 * UI change. Null when the agent recorded none.
 */
export function uiChangeDecision(directory: string, skip = 0): { hasUiChange: boolean; rationale: string } | null {
  const entry = readDecisions(directory)
    .split(/^## /m)
    .slice(1 + skip)
    .filter((e) => /\*\*Question:\*\*\s*(.+)/.exec(e)?.[1]?.trim() === UI_CHANGE_QUESTION)
    .at(-1);
  if (!entry) return null;
  const answer = /\*\*Answer:\*\*\s*(.+)/.exec(entry)?.[1]?.trim() ?? '';
  const rationale = /\*\*Rationale:\*\*\s*(.+)/.exec(entry)?.[1]?.trim() ?? answer;
  return { hasUiChange: !/^no\b/i.test(answer), rationale };
}
