import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Each validator returns the problems it found, in a stable order; an empty list means valid. */
export type Problems = string[];

const BRIEF = 'docs/brief.md';
const STACK = 'docs/adr/0001-stack.md';
const L1 = 'docs/specs/L1.md';
const L2 = 'docs/specs/L2.md';
const DESIGNS = 'docs/detailed-designs';
const JOURNEYS = 'docs/journeys.md';

/** Stage 1 (L2-009 AC1, AC3). */
export function validateBrief(workspace: string): Problems {
  return requiredSections(workspace, BRIEF, ['Problem', 'Users', 'Core features', 'Out of scope', 'Assumptions']);
}

/** Stage 4 (L2-013 AC1-AC3). With no preference the decision names .NET and Angular; otherwise it names the preference. */
export function validateStackDecision(workspace: string, stackPreference: string | null): Problems {
  const problems = requiredSections(workspace, STACK, ['Context', 'Decision', 'Alternatives', 'Consequences']);
  const decision = sections(read(workspace, STACK) ?? '').get('decision');
  if (decision === undefined || decision.trim() === '') return problems;

  if (stackPreference === null || stackPreference.trim() === '') {
    if (!/\.NET\b/i.test(decision) || !/\bAngular\b/i.test(decision)) {
      problems.push(
        `${STACK} must choose the current LTS .NET backend and current major Angular frontend when no stack was named`,
      );
    }
  } else if (!normalize(decision).includes(normalize(stackPreference))) {
    problems.push(`${STACK} must choose the named stack "${stackPreference.trim()}"`);
  }
  return problems;
}

/** Stage 5 (L2-014 AC2, AC3). */
export function validateRequirements(workspace: string): Problems {
  const l1Text = read(workspace, L1);
  const l2Text = read(workspace, L2);
  const missing = [L1, L2].filter((path, i) => [l1Text, l2Text][i] === null).map((path) => `${path} does not exist`);
  if (missing.length > 0) return missing;

  const l1 = idSections(l1Text!, 'L1');
  const l2 = idSections(l2Text!, 'L2');
  const problems: Problems = [];

  for (const id of duplicates([...l1, ...l2].map((s) => s.id))) problems.push(`Duplicate ID: ${id}`);

  const l1Ids = new Set(l1.map((s) => s.id));
  const traced = new Set<string>();
  for (const req of l2) {
    const traces = /\*\*Traces to:\*\*(.*)/i.exec(req.body)?.[1]?.match(/L1-\d+/g) ?? [];
    if (traces.length === 0) problems.push(`${req.id} does not trace to an L1 requirement`);
    for (const trace of traces) {
      traced.add(trace);
      if (!l1Ids.has(trace)) problems.push(`${req.id} traces to ${trace}, which does not exist`);
    }
  }

  for (const id of l1Ids) if (!traced.has(id)) problems.push(`${id} has no L2 requirement`);

  for (const req of l2) {
    if (criteria(req.body).length === 0) problems.push(`${req.id} has no Given/When/Then criterion`);
  }

  for (const section of [...l1, ...l2]) {
    for (const word of ['should', 'may', 'might']) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(unquoted(section.body))) problems.push(`${section.id} uses "${word}"`);
    }
  }
  return problems;
}

/** Stage 7 (L2-016 AC1, AC2). */
export function validateDesignCoverage(workspace: string): Problems {
  const l2Text = read(workspace, L2);
  if (l2Text === null) return [`${L2} does not exist`];

  const designs = designFolders(workspace);
  const problems: Problems = [];
  if (designs.length === 0) problems.push(`${DESIGNS} holds no {subsystem}/{feature}/README.md designs`);

  const covered = new Set<string>();
  for (const folder of designs) {
    const ids = readFileSync(join(workspace, folder, 'README.md'), 'utf8').match(/L2-\d+/g) ?? [];
    if (ids.length === 0) problems.push(`${folder} lists no L2 IDs`);
    ids.forEach((id) => covered.add(id));
  }

  for (const req of idSections(l2Text, 'L2')) if (!covered.has(req.id)) problems.push(`No design covers ${req.id}`);
  return problems;
}

/** Stage 8 (L2-017 AC1, AC2). Journeys are `## {n}. {title}` with Actor, Mocks, Covers and Steps. */
export function validateJourneys(workspace: string): Problems {
  const l2Text = read(workspace, L2);
  const text = read(workspace, JOURNEYS);
  if (text === null) return [`${JOURNEYS} does not exist`];
  if (l2Text === null) return [`${L2} does not exist`];

  const journeys = [...text.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)].map((m, i, all) => ({
    number: Number(m[1]),
    body: text.slice(m.index! + m[0].length, all[i + 1]?.index ?? text.length),
  }));
  if (journeys.length === 0) return [`${JOURNEYS} lists no numbered journeys`];

  const problems: Problems = [];
  for (const n of duplicates(journeys.map((j) => String(j.number)))) problems.push(`Journey number ${n} is used twice`);

  const covered = new Set<string>();
  for (const journey of journeys) {
    for (const field of ['Actor', 'Mocks', 'Covers']) {
      const value = new RegExp(`\\*\\*${field}:\\*\\*(.*)`, 'i').exec(journey.body)?.[1]?.trim();
      if (!value) problems.push(`Journey ${journey.number} has no ${field}`);
    }
    if (!/\*\*Steps:\*\*\s*\n\s*(\d+\.|-)\s+\S/i.test(journey.body))
      problems.push(`Journey ${journey.number} has no Steps`);
    (/\*\*Covers:\*\*(.*)/i.exec(journey.body)?.[1]?.match(/L2-\d+/g) ?? []).forEach((id) => covered.add(id));
  }

  for (const req of idSections(l2Text, 'L2')) {
    if (criteria(req.body).some(namesUserInterface) && !covered.has(req.id)) {
      problems.push(`No journey covers ${req.id}, which has a user interface criterion`);
    }
  }
  return problems;
}

// --- helpers -------------------------------------------------------------------------------------------------

function read(workspace: string, path: string): string | null {
  const full = join(workspace, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
}

/** Level-2 sections by lower-cased heading. */
function sections(markdown: string): Map<string, string> {
  const result = new Map<string, string>();
  const headings = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)];
  headings.forEach((m, i) => {
    const end = headings[i + 1]?.index ?? markdown.length;
    result.set(m[1]!.toLowerCase(), markdown.slice(m.index! + m[0].length, end));
  });
  return result;
}

function requiredSections(workspace: string, path: string, names: string[]): Problems {
  const text = read(workspace, path);
  if (text === null) return [`${path} does not exist`];
  const found = sections(text);
  return names.flatMap((name) => {
    const body = found.get(name.toLowerCase());
    if (body === undefined) return [`${path} is missing the ${name} section`];
    return body.trim() === '' ? [`${path} has an empty ${name} section`] : [];
  });
}

function idSections(markdown: string, level: 'L1' | 'L2'): { id: string; body: string }[] {
  const headings = [...markdown.matchAll(new RegExp(`^##\\s+(${level}-\\d+)\\b.*$`, 'gm'))];
  return headings.map((m, i) => ({
    id: m[1]!,
    body: markdown.slice(m.index! + m[0].length, headings[i + 1]?.index ?? markdown.length),
  }));
}

function criteria(body: string): string[] {
  return body.split('\n').filter((line) => /\bgiven\b.*\bwhen\b.*\bthen\b/i.test(line));
}

/** The starting rule from the design: a criterion that names a page, dialog, control or visible message. */
function namesUserInterface(criterion: string): boolean {
  return /\b(page|pages|dialog|screen|button|control|form|field|message|link|toast|banner|view|tab|menu)\b/i.test(
    criterion,
  );
}

/** Text with quoted strings, inline code and fenced code removed. */
function unquoted(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/"[^"\n]*"/g, ' ')
    .replace(/“[^”\n]*”/g, ' ');
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function designFolders(workspace: string): string[] {
  const root = join(workspace, DESIGNS);
  if (!existsSync(root)) return [];
  const folders: string[] = [];
  for (const subsystem of readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    for (const feature of readdirSync(join(root, subsystem.name), { withFileTypes: true }).filter((e) =>
      e.isDirectory(),
    )) {
      if (existsSync(join(root, subsystem.name, feature.name, 'README.md')))
        folders.push(`${DESIGNS}/${subsystem.name}/${feature.name}`);
    }
  }
  return folders.sort();
}

/** The text of a file before the stage's agent ran, by path; absent when the file did not exist. */
export type Baseline = ReadonlyMap<string, string>;

/**
 * L2-005 AC3, L2-014, L2-017 AC3: numbered items a later direction must keep. Every item the file had before is
 * still there, and every new item takes a number above the highest existing one.
 */
export function validateKeptNumbers(
  directory: string,
  baseline: Baseline,
  path: string,
  pattern: RegExp,
  label: (n: string) => string,
): Problems {
  const before = baseline.get(path);
  if (before === undefined) return [];
  const after = read(directory, path) ?? '';
  const numbers = (text: string) => [...text.matchAll(pattern)].map((m) => m[1]!);
  const old = numbers(before);
  const now = numbers(after);
  const highest = Math.max(0, ...old.map(Number));
  const width = old[0]?.length ?? 1;
  return [
    ...old.filter((n) => !now.includes(n)).map((n) => `${path} dropped ${label(n)}`),
    ...now
      .filter((n) => !old.includes(n) && Number(n) <= highest)
      .map(
        (n) =>
          `${path} numbers new ${label(n)} below the next free number, ${label(String(highest + 1).padStart(width, '0'))}`,
      ),
  ];
}

/** L2-010 AC6: a feature direction updates or adds designs; it never drops one from the manifest. */
export function validateKeptDesigns(directory: string, baseline: Baseline): Problems {
  const path = 'docs/mocks/manifest.json';
  const screens = (text: string | null | undefined) => {
    try {
      return ((JSON.parse(text ?? '{}') as { screens?: { screen: string }[] }).screens ?? []).map((s) => s.screen);
    } catch {
      return [];
    }
  };
  const before = baseline.get(path);
  if (before === undefined) return [];
  const now = screens(read(directory, path));
  return screens(before)
    .filter((s) => !now.includes(s))
    .map((s) => `${path} dropped the ${s} design`);
}
