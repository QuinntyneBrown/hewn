// Runs stages 1 to 10 locally with the same executors, scripted agent, fake Magic Patterns server and scripted gate
// the e2e stack uses, against a temporary product repository, then renders what each stage wrote.
//   node docs/videos/01-build-a-new-product/clips/artifacts.ts
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");
const w = (path: string) => join(repoRoot, "worker/src", path);
const { ScriptedStageAgent } = await import(w("agents/scripted-agent.ts"));
const { DocumentStageExecutor } = await import(
  w("executors/document-executor.ts")
);
const { ScaffoldStageExecutor } = await import(
  w("executors/scaffold-executor.ts")
);
const { IncrementStageExecutor } = await import(
  w("executors/increment-executor.ts")
);
const { ScriptedTestGate } = await import(w("increments/scripted-gate.ts"));
const { dotnetAngularTemplate } = await import(
  w("scaffold/dotnet-angular-template.ts")
);
const { McpMagicPatterns } = await import(
  w("magic-patterns/magic-patterns.ts")
);
const { startFakeMagicPatterns } = await import(
  w("magic-patterns/fake-server.ts")
);
const { chromium } = createRequire(join(repoRoot, "worker/package.json"))(
  "playwright-core",
);

const screens = resolve(here, "../screens");
const out = resolve(here, "../artifacts");
mkdirSync(screens, { recursive: true });
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const root = mkdtempSync(join(tmpdir(), "hewn-video-"));
const repo = join(root, "kiln-booking-abc1234");
mkdirSync(repo);
cpSync(join(repoRoot, ".claude/skills"), join(repo, ".claude/skills"), {
  recursive: true,
}); // what stage 0 copies
const fake = await startFakeMagicPatterns({ token: "mp" });
const logs: string[] = [];
const pulls: { title: string; body: string }[] = [];
const base = {
  runId: "0412abcd-video",
  epoch: 1,
  projectId: "p",
  directionId: "d7d7d7d7-video",
  checkpointStep: 0,
  checkpointSha: null,
  project: {
    id: "p",
    name: "Kiln Booking",
    idea: "Booking firing slots for a shared pottery kiln, with deposits and a waitlist.",
    stackPreference: null,
    repository: "hewn-builds/kiln-booking",
  },
  skillsSource: "unused",
  descopeThresholdDays: 3,
  maxIterations: 10,
};
const NAMES = [
  "Bootstrap",
  "Idea",
  "Designs",
  "Design system",
  "Stack",
  "Requirements",
  "Scaffold",
  "Detailed designs",
  "User journeys",
  "Estimates",
  "Increments",
];
const queue = new Map<
  number,
  {
    number: number;
    title: string;
    journey: number;
    l2Ids: string[];
    estimateDays: number;
    dependsOn: number[];
    status: string;
    iterations: number;
  }
>();

function context(stage: number) {
  return {
    workspace: mkdtempSync(join(root, `ws-${stage}-`)),
    log: async (_l: string, text: string) => {
      logs.push(`[${stage}] ${text}`);
      console.log(`[${stage}] ${text}`);
    },
    listSkillFolders: async () => ({}),
    downloadRepository: async () =>
      execFileSync("tar", ["-czf", "-", "-C", root, "kiln-booking-abc1234"]),
    commit: async (
      _s: unknown,
      _m: string,
      files: { path: string; content: Buffer }[],
      branch?: string,
    ) => {
      // The fake merges a branch at once, so branch commits land too; that is what the default branch holds after merge.
      for (const f of files) {
        mkdirSync(dirname(join(repo, f.path)), { recursive: true });
        writeFileSync(join(repo, f.path), f.content);
      }
      return branch ? "b1" : "c1";
    },
    openPullRequest: async (
      _s: unknown,
      request: { title: string; body: string },
    ) => (
      pulls.push(request),
      {
        number: pulls.length + 1,
        url: `https://github.com/hewn-builds/kiln-booking/pull/${pulls.length + 1}`,
      }
    ),
    pullRequestChecks: async () =>
      ["backend", "frontend", "e2e"].map((name) => ({
        name,
        status: "completed",
        conclusion: "success",
      })),
    mergePullRequest: async () => "m1",
    protectDefaultBranch: async () => undefined,
    reportBacklog: async (report: {
      increments: {
        number: number;
        title: string;
        journey: number;
        l2Ids: string[];
        estimateDays: number;
        dependsOn: number[];
      }[];
    }) => {
      for (const i of report.increments)
        queue.set(i.number, { ...i, status: "Queued", iterations: 0 });
    },
    nextIncrement: async () =>
      [...queue.values()].find(
        (i) => i.status !== "Merged" && i.status !== "Blocked",
      ) ?? null,
    updateIncrement: async (n: number, update: { status: string }) =>
      void (queue.get(n)!.status = update.status),
  };
}

const agent = new ScriptedStageAgent(() => "2026-11-09");
const documents = new DocumentStageExecutor(
  agent,
  () => new McpMagicPatterns(fake.url, "mp", { pollMs: 1 }),
);
const scaffold = new ScaffoldStageExecutor([dotnetAngularTemplate], {
  pollMs: 1,
});
const increments = new IncrementStageExecutor(agent, [dotnetAngularTemplate], {
  gate: () => new ScriptedTestGate(),
  probe: async () => ({ width: 1920, height: 1080, duration: 3 }),
  pollMs: 1,
});
try {
  for (let stage = 1; stage <= 10; stage++) {
    const run = { ...base, stage, stageName: NAMES[stage] };
    console.log(`stage ${stage} ${NAMES[stage]}`);
    const executor =
      stage === 6 ? scaffold : stage === 10 ? increments : documents;
    for (const step of executor.plan(run, context(stage)))
      await step.execute(new AbortController().signal);
  }
} finally {
  await fake.close();
}

const pr = pulls.find((p) => p.title.includes("(journey"))!;
writeFileSync(join(out, "pr-body.md"), `# ${pr.title}\n\n${pr.body}`);
writeFileSync(join(out, "run-log.txt"), logs.join("\n"));

// Render each artifact as it sits in the repository.
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1.5,
});
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
async function file(name: string, path: string, lines = 34, from = 0) {
  const text = readFileSync(join(repo, path), "utf8")
    .split("\n")
    .slice(from, from + lines)
    .join("\n");
  await page.setContent(`<!doctype html><html><body style="margin:0;font:15px/1.5 ui-monospace,Menlo,monospace;background:#f5f3ef;color:#1d1b18">
    <div style="padding:14px 22px;background:#fff;border-bottom:1px solid #ddd8cf;font:600 16px system-ui">hewn-builds/kiln-booking · <span style="color:#1a5fb4">${esc(path)}</span></div>
    <pre style="margin:0;padding:18px 22px;white-space:pre-wrap">${esc(text)}</pre></body></html>`);
  await page.screenshot({ path: join(screens, `artifact-${name}.png`) });
}
async function html(name: string, path: string) {
  await page.goto(`file://${join(repo, path)}`);
  await page.screenshot({ path: join(screens, `artifact-${name}.png`) });
}
await file("brief", "docs/brief.md");
const screen = readdirSync(join(repo, "docs/mocks")).find((d) =>
  existsSync(join(repo, "docs/mocks", d, "default.html")),
)!;
await html("mock", `docs/mocks/${screen}/default.html`);
await html("design-system", "docs/design-system/components/button.html");
await file("adr", "docs/adr/0001-stack.md");
await file("specs", "docs/specs/L2.md");
const design = readdirSync(join(repo, "docs/detailed-designs/product"))[0];
await file("design", `docs/detailed-designs/product/${design}/README.md`);
await file("journeys", "docs/journeys.md");
await file("estimates", "docs/estimates/README.md", 40);
await file("decisions", "docs/decisions.md", 34, 4);
const l2 = pr.title.match(/L2-\d{3}/)![0]; // the test that pull request added
const test = readdirSync(join(repo, "e2e/tests")).find(
  (f) =>
    f.endsWith(".spec.ts") &&
    readFileSync(join(repo, "e2e/tests", f), "utf8").includes(
      `Traces to: ${l2}`,
    ),
)!;
await file("test", `e2e/tests/${test}`);
await page.setContent(`<!doctype html><html><body style="margin:0;font:15px/1.5 ui-monospace,Menlo,monospace;background:#fff;color:#1d1b18">
  <div style="padding:14px 22px;border-bottom:1px solid #ddd8cf;font:600 17px system-ui">${esc(pr.title)} <span style="color:#7a4fd6">· Merged</span></div>
  <pre style="margin:0;padding:18px 22px;white-space:pre-wrap">${esc(pr.body)}</pre></body></html>`);
await page.screenshot({
  path: join(screens, "artifact-pr-body.png"),
  fullPage: false,
});
await browser.close();
rmSync(root, { recursive: true, force: true });
console.log(`artifacts rendered to ${screens}`);
process.exit(0); // the fake server's sockets would otherwise keep Node alive
