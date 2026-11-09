import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const DESIGNS = 'docs/detailed-designs';
const ESTIMATES = 'docs/estimates';

/** A detailed design with its estimate from `docs/estimates/{subsystem}.md`. */
export interface EstimatedDesign {
  /** `{subsystem}/{feature}` */
  design: string;
  title: string;
  l2Ids: string[];
  dependsOn: string[];
  estimateDays: number;
  completePercent: number;
}

export interface DeferredDesign {
  design: string;
  title: string;
  l2Ids: string[];
  estimateDays: number;
  reason: string;
}

export interface PlannedIncrement {
  number: number;
  title: string;
  journey: number;
  l2Ids: string[];
  estimateDays: number;
  dependsOn: number[];
  designs: string[];
}

export interface Backlog {
  thresholdDays: number;
  increments: PlannedIncrement[];
  deferred: DeferredDesign[];
}

interface Journey {
  number: number;
  title: string;
  covers: Set<string>;
}

/**
 * Stage 9's planners (L2-019, L2-020): descope, then order the remaining designs into increments of one journey
 * or part of one, each holding at most `thresholdDays` of work, with every dependency in an earlier increment.
 * Writes `docs/estimates/README.md`, `docs/estimates/backlog.json` and the Deferred status lines in L2.md.
 */
export function planBacklog(workspace: string, thresholdDays: number): Backlog {
  const designs = readEstimatedDesigns(workspace);
  const journeys = readJourneys(workspace);
  const deferred = descope(workspace, designs, journeys, thresholdDays);
  const deferredNames = new Set(deferred.map((d) => d.design));
  const active = designs.filter((d) => !deferredNames.has(d.design));
  const increments = order(active, journeys, thresholdDays);

  const backlog: Backlog = { thresholdDays, increments, deferred };
  write(workspace, `${ESTIMATES}/README.md`, readme(active, backlog));
  write(workspace, `${ESTIMATES}/backlog.json`, `${JSON.stringify(backlog, null, 2)}\n`);
  annotateDeferred(workspace, active, deferred);
  return backlog;
}

function descope(
  workspace: string,
  designs: EstimatedDesign[],
  journeys: Journey[],
  threshold: number,
): DeferredDesign[] {
  const brief = read(workspace, 'docs/brief.md') ?? '';
  const outOfScope = bullets(brief, /^##\s+Out of scope\s*$/im);
  const niceToHave = bullets(brief, /^##\s+Nice[ -]to[ -]have\s*$/im);
  const onJourney = new Set(journeys.flatMap((j) => [...j.covers]));

  const reasons = new Map<string, { rule: number; reason: string }>();
  for (const d of designs) {
    const outMatch = outOfScope.find((b) => matches(d.title, b));
    const niceMatch = niceToHave.find((b) => matches(d.title, b));
    const rule =
      d.estimateDays > threshold
        ? {
            rule: 0,
            reason: `Estimated at ${d.estimateDays} days, above the ${threshold}-day threshold, and could not be split`,
          }
        : outMatch
          ? { rule: 1, reason: `Listed as out of scope in the brief: ${outMatch}` }
          : niceMatch
            ? { rule: 1, reason: `Listed as nice-to-have in the brief: ${niceMatch}` }
            : !d.l2Ids.some((id) => onJourney.has(id))
              ? { rule: 2, reason: "Its requirements appear in no journey's main path" }
              : null;
    if (rule) reasons.set(d.design, rule);
  }

  // A design that needs a deferred design cannot ship either; repeat until nothing changes.
  for (let changed = true; changed;) {
    changed = false;
    for (const d of designs) {
      const blocker = d.dependsOn.find((dep) => reasons.has(dep));
      if (!reasons.has(d.design) && blocker) {
        reasons.set(d.design, { rule: 3, reason: `Depends on a deferred design: ${blocker}` });
        changed = true;
      }
    }
  }

  return designs
    .filter((d) => reasons.has(d.design))
    .sort((a, b) => reasons.get(a.design)!.rule - reasons.get(b.design)!.rule || a.design.localeCompare(b.design))
    .map((d) => ({
      design: d.design,
      title: d.title,
      l2Ids: d.l2Ids,
      estimateDays: d.estimateDays,
      reason: reasons.get(d.design)!.reason,
    }));
}

function order(active: EstimatedDesign[], journeys: Journey[], threshold: number): PlannedIncrement[] {
  const byName = new Map(active.map((d) => [d.design, d]));
  const placed = new Set<string>();
  const increments: PlannedIncrement[] = [];
  const incrementOf = new Map<string, number>();

  for (const journey of [...journeys].sort((a, b) => a.number - b.number)) {
    const sequence: EstimatedDesign[] = [];
    const visiting: string[] = [];
    const place = (name: string) => {
      if (placed.has(name)) return;
      const at = visiting.indexOf(name);
      if (at >= 0)
        throw new Error(`Designs depend on each other in a cycle: ${[...visiting.slice(at)].sort().join(', ')}`);
      const design = byName.get(name);
      if (!design) return;
      visiting.push(name);
      design.dependsOn.forEach(place);
      visiting.pop();
      placed.add(name);
      sequence.push(design);
    };
    active.filter((d) => d.l2Ids.some((id) => journey.covers.has(id))).forEach((d) => place(d.design));
    if (sequence.length === 0) continue;

    const parts: EstimatedDesign[][] = [];
    for (const design of sequence) {
      const current = parts.at(-1);
      const total = current?.reduce((sum, d) => sum + d.estimateDays, 0) ?? Infinity;
      if (current && total + design.estimateDays <= threshold) current.push(design);
      else parts.push([design]);
    }

    parts.forEach((part, i) => {
      const number = increments.length + 1;
      part.forEach((d) => incrementOf.set(d.design, number));
      const deps = new Set(
        part.flatMap((d) =>
          d.dependsOn.map((dep) => incrementOf.get(dep)).filter((n): n is number => n !== undefined && n !== number),
        ),
      );
      increments.push({
        number,
        title: parts.length > 1 ? `${journey.title} (part ${i + 1} of ${parts.length})` : journey.title,
        journey: journey.number,
        l2Ids: [...new Set(part.flatMap((d) => d.l2Ids))].sort(),
        estimateDays: round(part.reduce((sum, d) => sum + d.estimateDays, 0)),
        dependsOn: [...deps].sort((a, b) => a - b),
        designs: part.map((d) => d.design),
      });
    });
  }
  return increments;
}

function readme(active: EstimatedDesign[], backlog: Backlog): string {
  const total = round(active.reduce((sum, d) => sum + d.estimateDays, 0));
  const done = active.reduce((sum, d) => sum + (d.estimateDays * d.completePercent) / 100, 0);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const subsystems = [...new Set(active.map((d) => d.design.split('/')[0]!))].sort();
  const roadmap = backlog.increments
    .map(
      (i) =>
        `| ${i.number} | ${i.title} | ${i.journey} | ${i.l2Ids.join(', ')} | ${i.estimateDays} | ${i.dependsOn.join(', ') || '—'} |`,
    )
    .join('\n');
  const deferred = backlog.deferred.length
    ? `| Design | L2s | Estimate (days) | Reason |\n|---|---|---:|---|\n${backlog.deferred
        .map((d) => `| ${d.title} | ${d.l2Ids.join(', ')} | ${d.estimateDays} | ${d.reason} |`)
        .join('\n')}\n`
    : 'Nothing is deferred.\n';
  return `# Estimates

**Overall estimate:** ${total} ideal days across ${active.length} designs

**Percent complete:** ${percent}%

**Descope threshold:** ${backlog.thresholdDays} ideal days

## Roadmap

Increments in build order. Each covers one journey or part of one, and comes after every increment it depends on.

| # | Increment | Journey | L2s | Estimate (days) | Depends on |
|---:|---|---:|---|---:|---|
${roadmap}

## Subsystems

${subsystems.map((s) => `- [${s}](${s}.md): ${round(active.filter((d) => d.design.startsWith(`${s}/`)).reduce((sum, d) => sum + d.estimateDays, 0))} days`).join('\n')}

## Deferred

${deferred}`;
}

/** L2-019 AC3: an L2 every one of whose designs is deferred gains `**Status:** Deferred ({reason})` under its heading. */
function annotateDeferred(workspace: string, active: EstimatedDesign[], deferred: DeferredDesign[]): void {
  const path = 'docs/specs/L2.md';
  const text = read(workspace, path);
  if (text === null) return;
  const activeIds = new Set(active.flatMap((d) => d.l2Ids));
  const reasonFor = new Map<string, string>();
  for (const d of deferred)
    for (const id of d.l2Ids) if (!activeIds.has(id) && !reasonFor.has(id)) reasonFor.set(id, d.reason);

  const updated = text.replace(
    /^(##\s+(L2-\d+)\b[^\n]*\n)(\*\*Status:\*\*[^\n]*\n)?/gm,
    (_all, heading: string, id: string) => {
      const reason = reasonFor.get(id);
      return reason ? `${heading}**Status:** Deferred (${reason})\n` : heading;
    },
  );
  if (updated !== text) write(workspace, path, updated);
}

// --- reading ---------------------------------------------------------------------------------------------------

export function readEstimatedDesigns(workspace: string): EstimatedDesign[] {
  const estimates = readEstimateRows(workspace);
  return designFolders(workspace).flatMap((design) => {
    const estimate = estimates.get(design);
    if (!estimate) return [];
    const text = readFileSync(join(workspace, DESIGNS, design, 'README.md'), 'utf8');
    return [
      {
        design,
        title: /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? design,
        l2Ids: [...new Set(text.match(/L2-\d+/g) ?? [])].sort(),
        dependsOn: (/\*\*Depends on:\*\*(.*)/.exec(text)?.[1]?.match(/[\w-]+\/[\w-]+/g) ?? []).sort(),
        estimateDays: estimate.days,
        completePercent: estimate.complete,
      },
    ];
  });
}

/** Active design folders: `{subsystem}/{feature}` with a README not marked `**Status:** Split`. */
export function designFolders(workspace: string): string[] {
  const root = join(workspace, DESIGNS);
  if (!existsSync(root)) return [];
  const folders: string[] = [];
  for (const subsystem of readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    for (const feature of readdirSync(join(root, subsystem.name), { withFileTypes: true }).filter((e) =>
      e.isDirectory(),
    )) {
      const readme = join(root, subsystem.name, feature.name, 'README.md');
      if (existsSync(readme) && !/^\*\*Status:\*\*\s*Split\b/im.test(readFileSync(readme, 'utf8'))) {
        folders.push(`${subsystem.name}/${feature.name}`);
      }
    }
  }
  return folders.sort();
}

/** Rows of every `docs/estimates/{subsystem}.md` table, by design, from the Estimate and Complete columns. */
export function readEstimateRows(workspace: string): Map<string, { days: number; complete: number }> {
  const rows = new Map<string, { days: number; complete: number }>();
  const root = join(workspace, ESTIMATES);
  if (!existsSync(root)) return rows;
  for (const file of readdirSync(root).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    let estimateAt = -1;
    let completeAt = -1;
    for (const line of readFileSync(join(root, file), 'utf8').split('\n')) {
      if (!line.trim().startsWith('|')) continue;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      const header = cells.findIndex((c) => /estimate/i.test(c));
      if (header >= 0 && !/detailed-designs/.test(line)) {
        estimateAt = header;
        completeAt = cells.findIndex((c) => /complete/i.test(c));
        continue;
      }
      const design = /detailed-designs\/([\w.-]+\/[\w.-]+)/.exec(line)?.[1];
      const days = Number.parseFloat(cells[estimateAt] ?? '');
      if (design && estimateAt >= 0 && Number.isFinite(days)) {
        rows.set(design, { days, complete: completeAt >= 0 ? Number.parseFloat(cells[completeAt] ?? '0') || 0 : 0 });
      }
    }
  }
  return rows;
}

function readJourneys(workspace: string): Journey[] {
  const text = read(workspace, 'docs/journeys.md') ?? '';
  return [...text.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)].map((m, i, all) => {
    const body = text.slice(m.index! + m[0].length, all[i + 1]?.index ?? text.length);
    return {
      number: Number(m[1]),
      title: m[2]!.trim(),
      covers: new Set(/\*\*Covers:\*\*(.*)/.exec(body)?.[1]?.match(/L2-\d+/g) ?? []),
    };
  });
}

function bullets(markdown: string, heading: RegExp): string[] {
  const match = heading.exec(markdown);
  if (!match) return [];
  const body = markdown.slice(match.index + match[0].length).split(/^##\s/m)[0] ?? '';
  return [...body.matchAll(/^-\s+(.+)$/gm)].map((m) => m[1]!.trim());
}

function matches(title: string, bullet: string): boolean {
  const t = normalize(title);
  const b = normalize(bullet);
  return b.length >= 3 && (t === b || t.includes(b) || b.includes(t));
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function read(workspace: string, path: string): string | null {
  const full = join(workspace, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
}

function write(workspace: string, path: string, content: string): void {
  mkdirSync(dirname(join(workspace, path)), { recursive: true });
  writeFileSync(join(workspace, path), content);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
