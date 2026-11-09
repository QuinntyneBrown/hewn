import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StageAgent, StageAgentTask } from './stage-agent.ts';
import { appendDecision } from './decision-log.ts';
import { colorsIn } from '../validators/colors.ts';
import { designFolders } from '../estimates/backlog-planner.ts';
import { scriptedImplementation } from '../increments/scripted-gate.ts';
import { execFileSync } from 'node:child_process';

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
    const decide = (
      question: string,
      answer: string,
      rationale: string,
      architecture?: { context: string; consequences: string },
    ) =>
      appendDecision(directory, {
        date: this.today(),
        stage: run.stage,
        stageName: run.stageName,
        question,
        answer,
        rationale,
        ...(architecture ? { architecture } : {}),
      });

    switch (run.stage) {
      case 1: {
        const features = featuresFrom(run.project.idea);
        write(
          'docs/brief.md',
          `# ${run.project.name} brief\n\n## Problem\n${run.project.idea}\n\n## Users\nThe people the direction describes: ${lowerFirst(firstSentence(run.project.idea))}\n\n## Core features\n${features.map((f) => `- ${f}`).join('\n')}\n\n## Out of scope\n- Native mobile apps\n- Integrations beyond CSV import and export\n\n## Assumptions\n- Users work in a modern desktop or phone browser.\n- One team per account in the first release.\n`,
        );
        decide(
          'Who is the primary user?',
          `The people the direction describes: ${lowerFirst(firstSentence(run.project.idea))}`,
          'The direction names its audience; a narrower first user keeps the brief testable.',
        );
        return;
      }
      case 2: {
        const magicPatterns = task.magicPatterns;
        if (!magicPatterns) throw new Error('Stage 2 needs Magic Patterns.');
        const screens = [];
        for (const feature of sectionList(read('docs/brief.md'), 'Core features').map((f) => f.split(' — ')[0]!)) {
          const design = await magicPatterns.createDesign({
            name: feature,
            prompt: `The ${feature} screen of ${run.project.name}, responsive from 375 px, light and dark, as raw HTML files default.html, loading.html, empty.html and error.html.`,
          });
          await magicPatterns.waitUntilReady(design.editorId);
          screens.push({
            screen: slug(feature),
            feature,
            magicPatternsUrl: design.url,
            editorId: design.editorId,
            states: ['default', 'loading', 'empty', 'error'],
            notApplicable: {},
          });
        }
        write('docs/mocks/manifest.json', `${JSON.stringify({ screens }, null, 2)}\n`);
        decide(
          'Which states does each screen need?',
          'Default, loading, empty and error for every screen.',
          'Each screen loads data, so every state applies (writing-html-mocks state rules).',
        );
        return;
      }
      case 3: {
        const mocks = readdirSync(join(directory, 'docs/mocks'), { recursive: true, withFileTypes: true })
          .filter((e) => e.isFile() && e.name.endsWith('.html'))
          .map((e) => readFileSync(join(e.parentPath, e.name), 'utf8'));
        const light = new Set<string>();
        const dark = new Set<string>();
        for (const html of mocks) {
          const [before, ...after] = html.split(/@media\s*\(prefers-color-scheme:\s*dark\)/);
          colorsIn(before!).forEach((c) => light.add(c));
          colorsIn(after.join(' ')).forEach((c) => dark.add(c));
        }
        const group = (colors: Set<string>) =>
          Object.fromEntries([...colors].map((c, i) => [`color-${i + 1}`, { $type: 'color', $value: c }]));
        const tokens = {
          color: { light: group(light), dark: group(dark.size > 0 ? dark : light) },
          typography: { body: { $type: 'fontFamily', $value: 'system-ui, sans-serif' } },
          spacing: { '2': { $type: 'dimension', $value: '8px' }, '4': { $type: 'dimension', $value: '16px' } },
          radius: { md: { $type: 'dimension', $value: '8px' } },
          elevation: { '1': { $type: 'shadow', $value: '0 1px 2px rgb(0 0 0 / 10%)' } },
          motion: { fast: { $type: 'duration', $value: '150ms' } },
        };
        write('docs/design-system/tokens.json', `${JSON.stringify(tokens, null, 2)}\n`);
        write(
          'docs/design-system/components/button.html',
          '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Button</title></head>\n<body><h1>Button</h1><p>Primary action. Uses color tokens and radius md.</p></body>\n</html>\n',
        );
        decide(
          'How are colour tokens named?',
          'By order of first use until a designer names them.',
          'Names carry meaning only once roles are known; the values are what the mocks require.',
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
        const bullets = sectionList(read('docs/brief.md'), 'Core features');
        const features = bullets.map((b) => b.split(' — ')[0]!);
        const l1 = bullets
          .map((b, i) => `## L1-${pad(i + 1)}: ${features[i]}\n${b.replace(' — ', ': ')}.\n`)
          .join('\n');
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
        if (!/\*\*ADR:\*\*/.test(read('docs/decisions.md'))) {
          decide(
            'How do the frontend and the API talk?',
            'REST over JSON between the Angular app and the API.',
            'The scaffold already serves a REST API and an Angular client; nothing in the brief needs push updates.',
            {
              context: 'Every design pairs a page with an endpoint, so the two apps need one contract.',
              consequences: 'Each design names its endpoints; real-time features would need a new decision.',
            },
          );
        }
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
      case 9: {
        const bySubsystem = new Map<string, string[]>();
        for (const design of designFolders(directory)) {
          const [subsystem, feature] = design.split('/') as [string, string];
          bySubsystem.set(subsystem, [...(bySubsystem.get(subsystem) ?? []), feature]);
        }
        for (const [subsystem, features] of bySubsystem) {
          write(
            `docs/estimates/${subsystem}.md`,
            `# ${subsystem}\n\n| Design | Estimate (days) | Complete |\n|---|---:|---:|\n${features
              .map((f) => `| [${f}](../detailed-designs/${subsystem}/${f}/README.md) | 2 | 0% |`)
              .join('\n')}\n`,
          );
        }
        decide(
          'How large is each design?',
          'Two ideal days each, none split.',
          'Each design is one page, one endpoint and one table, within the descope threshold.',
        );
        return;
      }
      case 10: {
        const increment = task.increment;
        if (!increment) throw new Error('Stage 10 sessions name their increment.');
        const test = `e2e/tests/${increment.slug}.spec.ts`;
        switch (increment.phase) {
          case 'tests':
            write(
              test,
              `// Acceptance Test\n// Traces to: ${increment.l2Ids.join(', ')}\n// Description: ${increment.title}\n\nimport { expect, test } from '@playwright/test';\n\ntest('${increment.title.replace(/'/g, "\\'")}', async () => {\n  expect(true).toBe(true);\n});\n`,
            );
            return;
          case 'implement':
            write(
              scriptedImplementation(test),
              `/** ${increment.title} (${increment.l2Ids.join(', ')}). */\nexport const ${camel(increment.slug)} = true;\n`,
            );
            if (!(increment.failing ?? []).length) {
              decide(
                `How should ${increment.title} be built?`,
                'As one feature folder in the frontend, behind the existing shell.',
                'The smallest change that makes the acceptance tests pass.',
              );
            }
            return;
          case 'video':
            recordStillVideo(directory, increment.slug, increment.title);
            return;
          case 'resolve':
            // The branch's version already holds both sides' intent in the scripted repository.
            return;
        }
        return;
      }
      default:
        throw new Error(`The scripted agent has no script for stage ${run.stage}.`);
    }
  }
}

function featuresFrom(idea: string): string[] {
  const workflow = (firstSentence(idea).split(',')[0] ?? idea).replace(/\.$/, '').trim();
  return ['Sign in', `Main workflow — ${lowerFirst(workflow)}`, 'Review history'];
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

function camel(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase()).replace(/^[0-9]/, (d) => `n${d}`);
}

/** A 3-second 1080p title card with captions, standing in for a walkthrough; ffmpeg must be installed. */
function recordStillVideo(directory: string, slug: string, title: string): void {
  const folder = join(directory, 'docs/videos', slug);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'script.md'), `# ${title}\n\nThe journey, step by step, in the running app.\n`);
  writeFileSync(join(folder, `${slug}.vtt`), `WEBVTT\n\n00:00.000 --> 00:03.000\n${title}\n`);
  try {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=0xf5f3ef:s=1920x1080:d=3',
        '-pix_fmt',
        'yuv420p',
        join(folder, `${slug}.mp4`),
      ],
      { stdio: 'ignore' },
    );
  } catch (error) {
    throw new Error(
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'ffmpeg is not installed'
        : 'ffmpeg could not record the video',
    );
  }
}
