import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StageAgent, StageAgentTask } from './stage-agent.ts';
import { appendDecision, UI_CHANGE_QUESTION } from './decision-log.ts';
import { colorsIn } from '../validators/colors.ts';
import { designFolders, readEstimateRows } from '../estimates/backlog-planner.ts';
import { scriptedImplementation } from '../increments/scripted-gate.ts';
import { execFileSync } from 'node:child_process';

/**
 * A deterministic stand-in for the model, used by tests and the e2e stack. It writes documents that pass each
 * stage's validator from the direction and the documents earlier stages wrote, and records one decision per
 * stage the way the real agent answers a skill's question itself (L2-054).
 */
export interface ScriptedAgentOptions {
  /** An increment whose title contains this is never implemented, so its tests stay red and it blocks (L2-022 AC2). */
  blockIncrement?: string;
  /** Waits this long in each stage 10 session, so a run can be watched increment by increment (e2e, videos). */
  incrementDelayMs?: number;
}

export class ScriptedStageAgent implements StageAgent {
  private readonly today: () => string;
  private readonly options: ScriptedAgentOptions;

  constructor(today: () => string = () => new Date().toISOString().slice(0, 10), options: ScriptedAgentOptions = {}) {
    this.today = today;
    this.options = options;
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
      architecture?: { context: string; consequences: string; alternatives?: string },
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

    const feature = run.direction?.kind === 'Feature' ? run.direction.idea : null;

    switch (run.stage) {
      case 1: {
        if (feature) {
          // A feature direction adds one core feature to the existing brief and decides whether the UI changes.
          const title = featureTitle(feature);
          const brief = read('docs/brief.md');
          write(
            'docs/brief.md',
            brief.replace(
              /(^## Core features\s*\n(?:-.*\n)*)/m,
              `$1- ${title} — ${lowerFirst(firstSentence(feature))}\n`,
            ),
          );
          const ui = /\b(page|screen|view|form|button|dialog|tab|ui)\b/i.test(feature);
          decide(
            UI_CHANGE_QUESTION,
            ui ? `Yes. ${title} needs a new or changed screen.` : `No. ${title} changes no screen or state.`,
            ui
              ? `The feature names a screen: ${lowerFirst(firstSentence(feature))}`
              : 'The feature adds no screen or state; it changes behaviour behind the existing pages.',
          );
          return;
        }
        const features = featuresFrom(run.project.idea);
        write(
          'docs/brief.md',
          `# ${run.project.name} brief\n\n## Problem\n${run.project.idea}\n\n## Users\nThe people the direction describes: ${lowerFirst(firstSentence(run.project.idea))}\n\n## Core features\n${features.map((f) => `- ${f}`).join('\n')}\n\n## Out of scope\n- Native mobile apps\n- Integrations beyond CSV import and export\n${niceToHave(run.project.idea)}\n## Assumptions\n- Users work in a modern desktop or phone browser.\n- One team per account in the first release.\n`,
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
        const existing = read('docs/mocks/manifest.json');
        const screens: { screen: string; [field: string]: unknown }[] = existing
          ? (JSON.parse(existing) as { screens: { screen: string }[] }).screens
          : [];
        const designed = new Set(screens.map((s) => s.screen));
        for (const feature of sectionList(read('docs/brief.md'), 'Core features')
          .map((f) => f.split(' — ')[0]!)
          .filter((f) => !designed.has(slug(f)))) {
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
        for (const [file, html] of designSystemPages(tokens)) write(`docs/design-system/${file}`, html);
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
        // Existing requirements keep their IDs; features without one take the next free numbers (L2-005 AC3).
        const oldL1 = read('docs/specs/L1.md') || '# L1 - High-Level Requirements\n';
        const oldL2 = read('docs/specs/L2.md') || '# L2 - Detailed Requirements\n';
        const known = new Set(requirements(oldL2).map((r) => r.title));
        const next = (text: string, level: string) =>
          Math.max(0, ...[...text.matchAll(new RegExp(`^## ${level}-(\\d+)`, 'gm'))].map((m) => Number(m[1]))) + 1;
        let l1Next = next(oldL1, 'L1');
        let l2Next = next(oldL2, 'L2');
        let l1 = '';
        let l2 = '';
        for (const bullet of sectionList(read('docs/brief.md'), 'Core features')) {
          const f = bullet.split(' — ')[0]!;
          if (known.has(f)) continue;
          const l1Id = `L1-${pad(l1Next++)}`;
          l1 += `\n## ${l1Id}: ${f}\n${bullet.replace(' — ', ': ')}.\n`;
          l2 += `\n## L2-${pad(l2Next++)}: ${f}\n**Traces to:** ${l1Id}\n\n**Acceptance Criteria:**\n1. Given a signed-in user on the ${f} page, when they complete the main action, then the page shows the result.\n`;
        }
        write('docs/specs/L1.md', `${oldL1.trimEnd()}\n${l1}`);
        write('docs/specs/L2.md', `${oldL2.trimEnd()}\n${l2}`);
        decide(
          'How fine-grained are the first requirements?',
          'One L1 and one L2 per core feature in the brief.',
          'Later directions refine them; every feature is traceable from the start.',
        );
        return;
      }
      case 7: {
        for (const { id, title } of requirements(read('docs/specs/L2.md'))) {
          if (read(`docs/detailed-designs/product/${slug(title)}/README.md`)) continue;
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
              alternatives:
                'GraphQL, rejected as more machinery than one client needs; SignalR, not needed without push updates.',
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
        const estimates = readEstimateRows(directory);
        const bySubsystem = new Map<string, string[]>();
        for (const design of designFolders(directory)) {
          const [subsystem, feature] = design.split('/') as [string, string];
          bySubsystem.set(subsystem, [...(bySubsystem.get(subsystem) ?? []), feature]);
        }
        for (const [subsystem, features] of bySubsystem) {
          write(
            `docs/estimates/${subsystem}.md`,
            `# ${subsystem}\n\n| Design | Estimate (days) | Complete |\n|---|---:|---:|\n${features
              .map((f) => {
                const kept = estimates.get(`${subsystem}/${f}`);
                return `| [${f}](../detailed-designs/${subsystem}/${f}/README.md) | ${kept?.days ?? 2} | ${kept?.complete ?? 0}% |`;
              })
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
        if (this.options.incrementDelayMs) await new Promise((done) => setTimeout(done, this.options.incrementDelayMs));
        const test = `e2e/tests/${increment.slug}.spec.ts`;
        switch (increment.phase) {
          case 'tests':
            write(
              test,
              `// Acceptance Test\n// Traces to: ${increment.l2Ids.join(', ')}\n// Description: ${increment.title}\n\nimport { expect, test } from '@playwright/test';\n\ntest('${increment.title.replace(/'/g, "\\'")}', async () => {\n  expect(true).toBe(true);\n});\n`,
            );
            return;
          case 'implement':
            if (this.options.blockIncrement && includes(increment.title, this.options.blockIncrement)) return;
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

/** "Add a CSV export of the shift report, one row per shift" → "CSV export of the shift report". */
function featureTitle(text: string): string {
  const title = (firstSentence(text).split(',')[0] ?? text)
    .replace(/\.$/, '')
    .replace(/^(add|build|let|allow|support)\s+(an?|the)?\s*/i, '')
    .split(/\s+with\s+/)[0]!
    .trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** "… Nice to have: review history and exports." → a brief section listing them, which stage 9 descopes (L2-019 AC2). */
function niceToHave(idea: string): string {
  const named = /nice[ -]to[ -]have:\s*([^.]+)/i.exec(idea)?.[1];
  if (!named) return '';
  const items = named
    .split(/,\s*|\s+and\s+/)
    .map((i) => i.trim())
    .filter(Boolean);
  return `\n## Nice to have\n${items.map((i) => `- ${i.charAt(0).toUpperCase()}${i.slice(1)}`).join('\n')}\n`;
}

function includes(text: string, part: string): boolean {
  return text.toLowerCase().includes(part.toLowerCase());
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

type TokenGroup = Record<string, { $type: string; $value: string }>;

/**
 * The token pages under foundations/ and the button's page under components/, as the extracting-design-systems
 * skill writes them: each follows `<html data-theme>`, and the swatches show the light or dark colour tokens.
 */
export function designSystemPages(tokens: {
  color: { light: TokenGroup; dark: TokenGroup };
  typography: TokenGroup;
  spacing: TokenGroup;
  radius: TokenGroup;
  elevation: TokenGroup;
  motion: TokenGroup;
}): [string, string][] {
  const vars = (group: TokenGroup) =>
    Object.entries(group)
      .map(([name, t]) => `--${name}: ${t.$value};`)
      .join(' ');
  const rows = (group: TokenGroup, sample: (value: string) => string) =>
    Object.entries(group)
      .map(
        ([name, t]) =>
          `<tr><td><code>${name}</code></td><td><code>${t.$value}</code></td><td>${sample(t.$value)}</td></tr>`,
      )
      .join('\n');
  const page = (title: string, lede: string, body: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Design system</title>
<style>
:root { color-scheme: light; --page: #ffffff; --ink: #14181d; --muted: #5b6573; --line: #dde1e6; --accent: #2f6fed; ${vars(tokens.color.light)} }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; --page: #14181d; --ink: #f4f5f7; --muted: #a3acb9; --line: #2c333c; --accent: #6f9bff; ${vars(tokens.color.dark)} } }
:root[data-theme="dark"] { color-scheme: dark; --page: #14181d; --ink: #f4f5f7; --muted: #a3acb9; --line: #2c333c; --accent: #6f9bff; ${vars(tokens.color.dark)} }
body { margin: 0; padding: 32px; background: var(--page); color: var(--ink); font: 16px/1.5 system-ui, sans-serif; }
h1 { margin: 0 0 4px; font-size: 28px; } p { margin: 0 0 24px; color: var(--muted); }
table { width: 100%; border-collapse: collapse; } td { padding: 10px 8px; border-top: 1px solid var(--line); vertical-align: middle; }
code { font: 13px ui-monospace, monospace; }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
.swatch { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; } .swatch span { display: block; height: 72px; }
.swatch div { padding: 8px; font-size: 13px; }
.btn { font: inherit; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--accent); cursor: pointer; }
.btn--primary { background: var(--accent); color: #fff; } .btn--secondary { background: transparent; color: var(--accent); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; } .row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
</style>
</head>
<body>
<h1>${title}</h1>
<p>${lede}</p>
${body}
</body>
</html>
`;
  const swatches = Object.keys(tokens.color.light)
    .map(
      (name) =>
        `<div class="swatch"><span style="background: var(--${name})"></span><div><code>${name}</code></div></div>`,
    )
    .join('\n');
  return [
    [
      'foundations/colour.html',
      page(
        'Colour',
        `${Object.keys(tokens.color.light).length} colour tokens, light and dark. Switch the theme to see the dark values.`,
        `<div class="swatches">\n${swatches}\n</div>`,
      ),
    ],
    [
      'foundations/typography.html',
      page(
        'Typography',
        'The type families every screen uses.',
        `<table>${rows(tokens.typography, (v) => `<span style="font-family: ${v}">Reconcile the statement</span>`)}</table>`,
      ),
    ],
    [
      'foundations/spacing.html',
      page(
        'Spacing',
        'The spacing scale.',
        `<table>${rows(tokens.spacing, (v) => `<span style="display: inline-block; height: 12px; width: ${v}; background: var(--accent)"></span>`)}</table>`,
      ),
    ],
    [
      'foundations/radius.html',
      page(
        'Radius',
        'Corner radii.',
        `<table>${rows(tokens.radius, (v) => `<span style="display: inline-block; width: 48px; height: 32px; border: 2px solid var(--accent); border-radius: ${v}"></span>`)}</table>`,
      ),
    ],
    [
      'foundations/elevation.html',
      page(
        'Elevation',
        'Shadows for raised surfaces.',
        `<table>${rows(tokens.elevation, (v) => `<span style="display: inline-block; width: 64px; height: 40px; border-radius: 8px; background: var(--page); box-shadow: ${v}"></span>`)}</table>`,
      ),
    ],
    [
      'foundations/motion.html',
      page('Motion', 'Durations for transitions.', `<table>${rows(tokens.motion, (v) => `<span>${v}</span>`)}</table>`),
    ],
    [
      'components/button.html',
      page(
        'Button',
        'Primary and secondary actions. Uses the accent colour and radius md.',
        '<div class="row"><button class="btn btn--primary" type="button">Save</button><button class="btn btn--secondary" type="button">Cancel</button><button class="btn btn--primary" type="button" disabled>Saving…</button></div>',
      ),
    ],
  ];
}
