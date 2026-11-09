import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StageAgent, StageAgentTask } from './stage-agent.ts';
import { appendDecision } from './decision-log.ts';

/**
 * A deterministic stand-in for the model, used by tests and the e2e stack. It writes documents that pass each
 * stage's validator from the direction and the documents earlier stages wrote, and records one decision per
 * stage the way the real agent answers a skill's question itself (L2-054).
 */
export class ScriptedStageAgent implements StageAgent {
  private readonly today: () => string;

  constructor(today: () => string = () => new Date().toISOString().slice(0, 10)) {
    this.today = today;
  }

  async run(task: StageAgentTask): Promise<void> {
    const { run, directory } = task;
    const write = (path: string, content: string) => {
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      writeFileSync(join(directory, path), content);
    };
    const read = (path: string) =>
      existsSync(join(directory, path)) ? readFileSync(join(directory, path), 'utf8') : '';
    const decide = (question: string, answer: string, rationale: string) =>
      appendDecision(directory, {
        date: this.today(),
        stage: run.stage,
        stageName: run.stageName,
        question,
        answer,
        rationale,
      });

    switch (run.stage) {
      case 1: {
        const features = featuresFrom(run.project.idea);
        write(
          'docs/brief.md',
          `# ${run.project.name} brief\n\n## Problem\n${run.project.idea}\n\n## Users\nPeople who ${lowerFirst(features[0]!)} today by hand.\n\n## Core features\n${features.map((f) => `- ${f}`).join('\n')}\n\n## Out of scope\n- Native mobile apps\n- Integrations beyond CSV import and export\n\n## Assumptions\n- Users work in a modern desktop or phone browser.\n- One team per account in the first release.\n`,
        );
        decide(
          'Who is the primary user?',
          `The people the idea names: ${firstSentence(run.project.idea)}`,
          'The direction names its audience; a narrower first user keeps the brief testable.',
        );
        return;
      }
      case 4: {
        const preference = run.project.stackPreference?.trim();
        const stack = preference ? preference : '.NET 10 (LTS) backend with an Angular 21 frontend';
        write(
          'docs/adr/0001-stack.md',
          `# 0001. Stack\n\n## Context\n${run.project.name} is a web application; the direction ${preference ? `names the stack "${preference}"` : 'names no stack'}.\n\n## Decision\nStack: ${stack}.\n\n## Alternatives\n- Node.js with React: one language end to end, weaker typing at the API boundary.\n- A server-rendered monolith: simpler hosting, less interactive pages.\n\n## Consequences\n- The backend and frontend build, test and deploy separately.\n- Agents in later stages follow this stack's conventions.\n`,
        );
        decide(
          'Which stack should the product use?',
          stack,
          preference ? 'The direction named it.' : 'No stack was named, so the default applies (L2-013).',
        );
        return;
      }
      case 5: {
        const features = sectionList(read('docs/brief.md'), 'Core features');
        const l1 = features.map((f, i) => `## L1-${pad(i + 1)}: ${f}\n${f}.\n`).join('\n');
        const l2 = features
          .map(
            (f, i) =>
              `## L2-${pad(i + 1)}: ${f}\n**Traces to:** L1-${pad(i + 1)}\n\n**Acceptance Criteria:**\n1. Given a signed-in user on the ${f} page, when they complete the main action, then the page shows the result.\n`,
          )
          .join('\n');
        write('docs/specs/L1.md', `# L1 - High-Level Requirements\n\n${l1}`);
        write('docs/specs/L2.md', `# L2 - Detailed Requirements\n\n${l2}`);
        decide(
          'How fine-grained are the first requirements?',
          'One L1 and one L2 per core feature in the brief.',
          'Later directions refine them; every feature is traceable from the start.',
        );
        return;
      }
      case 7: {
        for (const { id, title } of requirements(read('docs/specs/L2.md'))) {
          write(
            `docs/detailed-designs/product/${slug(title)}/README.md`,
            `# ${title}\n\n## Description\nOne page, one API endpoint and one table.\n\n## Requirements\n- ${id}\n`,
          );
        }
        decide(
          'How are features grouped into subsystems?',
          'One subsystem, product, until the product grows a second area.',
          'There are few features; extra subsystems would be empty.',
        );
        return;
      }
      case 8: {
        const existing = read('docs/journeys.md');
        const numbers = [...existing.matchAll(/^##\s+(\d+)\./gm)].map((m) => Number(m[1]));
        const covered = new Set(existing.match(/L2-\d+/g) ?? []);
        let next = Math.max(0, ...numbers) + 1;
        const journeys = requirements(read('docs/specs/L2.md'))
          .filter((r) => !covered.has(r.id))
          .map(
            ({ id, title }) =>
              `## ${next++}. ${title}\n\n**Actor:** Signed-in user\n\n**Mocks:** docs/mocks/pages/${slug(title)}/default.html\n\n**Covers:** ${id}\n\n**Steps:**\n1. Open the ${title} page.\n2. Complete the main action.\n3. See the result.\n`,
          )
          .join('\n');
        write('docs/journeys.md', `${existing || '# User journeys\n'}\n${journeys}`);
        decide(
          'How are journeys numbered?',
          'Existing numbers are kept; new journeys take the next free numbers.',
          'Journey numbers appear in tests and videos, so they never change (L2-017).',
        );
        return;
      }
      default:
        throw new Error(`The scripted agent has no script for stage ${run.stage}.`);
    }
  }
}

function featuresFrom(idea: string): string[] {
  const subject = firstSentence(idea)
    .replace(/^an?\s+/i, '')
    .replace(/\.$/, '');
  return [`Sign in`, `Record ${shorten(subject)}`, `Review history`];
}

function shorten(text: string): string {
  return text.split(/\s+/).slice(0, 6).join(' ');
}

function firstSentence(text: string): string {
  return (text.split(/(?<=\.)\s/)[0] ?? text).trim();
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function sectionList(markdown: string, heading: string): string[] {
  const body = markdown.split(new RegExp(`^## ${heading}\\s*$`, 'm'))[1]?.split(/^## /m)[0] ?? '';
  return [...body.matchAll(/^-\s+(.+)$/gm)].map((m) => m[1]!.trim());
}

function requirements(l2: string): { id: string; title: string }[] {
  return [...l2.matchAll(/^##\s+(L2-\d+):\s*(.+)$/gm)].map((m) => ({ id: m[1]!, title: m[2]!.trim() }));
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function pad(n: number): string {
  return String(n).padStart(3, '0');
}
