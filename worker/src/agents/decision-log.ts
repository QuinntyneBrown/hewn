import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** One entry in `docs/decisions.md` (L2-054 AC2). */
export interface Decision {
  date: string;
  stage: number;
  stageName: string;
  question: string;
  answer: string;
  rationale: string;
}

export const DECISIONS = 'docs/decisions.md';

const HEADER = '# Decisions\n\nQuestions agents answered for themselves, oldest first.\n';

export function formatDecision(d: Decision): string {
  return `\n## ${d.date} · Stage ${d.stage} ${d.stageName}\n\n**Question:** ${d.question}\n\n**Answer:** ${d.answer}\n\n**Rationale:** ${d.rationale}\n`;
}

export function appendDecision(directory: string, decision: Decision): void {
  const path = join(directory, DECISIONS);
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) appendFileSync(path, HEADER);
  appendFileSync(path, formatDecision(decision));
}

/** Decisions in the log text, in order; entries that are missing a field are skipped. */
export function parseDecisions(text: string): { question: string; answer: string }[] {
  return text
    .split(/^## /m)
    .slice(1)
    .flatMap((entry) => {
      const question = /\*\*Question:\*\*\s*(.+)/.exec(entry)?.[1]?.trim();
      const answer = /\*\*Answer:\*\*\s*(.+)/.exec(entry)?.[1]?.trim();
      return question && answer ? [{ question, answer }] : [];
    });
}

export function readDecisions(directory: string): string {
  const path = join(directory, DECISIONS);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}
