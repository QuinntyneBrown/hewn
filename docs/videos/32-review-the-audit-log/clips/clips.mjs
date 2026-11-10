// Captures the screens and clips for the journey 32 video (Review the audit log). Start the stack first:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/32-review-the-audit-log/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { AuditPage } = await import(join(repo, "e2e/pages/audit.page.ts"));
const { WorkersPage } = await import(join(repo, "e2e/pages/workers.page.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const tag = Date.now().toString(36).slice(-4);
const records = {};

async function xsrf(page) {
  await page.request.get("/api/me");
  return (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
}

async function post(page, url, data = {}) {
  const r = await page.request.post(url, { data, headers: { "X-XSRF-TOKEN": await xsrf(page) } });
  if (!r.ok()) throw new Error(`${url}: ${r.status()} ${await r.text()}`);
  return r.status() === 204 ? null : r.json();
}

/** A real project, and its first direction's id. */
async function aProject(page, name) {
  const { projectId } = await post(page, "/api/projects", {
    name,
    idea: "Tide and swell planner for small-boat charters.",
    stackPreference: null,
    repositoryUrl: null,
    budgetUsd: 300,
  });
  const project = await (await page.request.get(`/api/projects/${projectId}`)).json();
  return { projectId, directionId: project.directions[0].id };
}

async function context(browser, { width = 1280, height = 900, dark = false, video, login = "quinntynebrown" } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? "dark" : "light",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post("/api/auth/dev/sign-in", { data: { login } });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  return { ctx, page, audit: new AuditPage(page), workers: new WorkersPage(page) };
}

/** Each method an API might use to change an entry, as e2e/support/audit.ts sends them, and each answer. */
async function tryToEditAuditEntries(page) {
  const headers = { "X-XSRF-TOKEN": await xsrf(page) };
  const answers = {};
  for (const method of ["PUT", "PATCH", "DELETE", "POST"]) {
    for (const url of ["/api/audit", "/api/audit/1"]) {
      answers[`${method} ${url}`] = (await page.request.fetch(url, { method, data: { actor: "someone-else" }, headers })).status();
    }
  }
  return answers;
}

const shot = async (page, file, locator) => {
  await page.mouse.move(0, 0);
  const options = { path: join(screens, `${file}.png`), animations: "disabled", caret: "hide" };
  return locator ? locator.screenshot(options) : page.screenshot(options);
};

async function recording(browser, file, opts = {}) {
  const raw = join(here, `.raw-${file}`);
  rmSync(raw, { recursive: true, force: true });
  const c = await context(browser, { width: 1408, height: 792, video: raw, ...opts });
  return {
    ...c,
    done: async () => {
      await c.ctx.close();
      const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${file}.mp4`)]);
      rmSync(raw, { recursive: true, force: true });
    },
  };
}

const browser = await chromium.launch();
try {
  // Setup through the API, as an Owner would through the UI: two directions, a pause and resume, a cancel, a token.
  const setup = await context(browser);
  const ledgerline = `Ledgerline ${tag}`;
  const tidewater = `Tidewater ${tag}`;
  const l = await aProject(setup.page, ledgerline);
  const t = await aProject(setup.page, tidewater);
  await post(setup.page, `/api/projects/${t.projectId}/directions/${t.directionId}/pause`);
  await post(setup.page, `/api/projects/${t.projectId}/directions/${t.directionId}/resume`);
  await post(setup.page, `/api/projects/${l.projectId}/directions/${l.directionId}/cancel`);
  await post(setup.page, "/api/worker-tokens", { name: `hewn-cloud-${tag}`, location: "Cloud", expiresInDays: 90 });
  await setup.ctx.close();

  // 1. Stop all workers and start them again in the UI, then find both in Audit and filter. Paced to the narration
  // (captions): `at(n)` waits until n seconds into the recording.
  const a = await recording(browser, "audit");
  const t0 = Date.now();
  const at = (seconds) => a.page.waitForTimeout(Math.max(0, t0 + seconds * 1_000 - Date.now()));
  await a.workers.open();
  await a.workers.heading.waitFor();
  await at(7.5);
  await a.workers.stopAllButton.hover();
  await at(8.8);
  await a.workers.stopAllButton.click();
  await a.workers.stopConfirm.waitFor();
  await at(12.4);
  await a.workers.stopConfirm.hover();
  await at(13.6);
  await a.workers.stopConfirm.click();
  await a.workers.stoppedBanner.waitFor();
  await at(18.2);
  await a.workers.startWorkersButton.click();
  await a.workers.stoppedBanner.waitFor({ state: "hidden" });
  await at(20.8);
  await a.audit.open();
  records.newest = (await a.audit.entries()).slice(0, 8);
  await at(32);
  await shot(a.page, "audit-owner");
  await at(43.4);
  await a.audit.projectFilter.selectOption({ label: tidewater });
  await a.page.waitForTimeout(500);
  records.tidewater = await a.audit.entries();
  records.url = new URL(a.page.url()).search;
  await at(47);
  await shot(a.page, "audit-tidewater");
  await at(50.6);
  await a.audit.actionFilter.selectOption({ label: "Pause" });
  await a.page.waitForTimeout(500);
  records.tidewaterPause = await a.audit.entries();
  await at(52.4);
  await a.audit.actionFilter.selectOption({ label: "Stop all workers" });
  await a.audit.emptyTitle.waitFor();
  records.noResults = await a.audit.emptyText.innerText();
  await at(55);
  await shot(a.page, "audit-no-results");
  await at(56.8);
  await a.audit.clearFilters.hover();
  await at(57.8);
  await a.audit.clearFilters.click();
  await a.audit.rows.first().waitFor();
  await at(61);
  await a.done();

  // 2. No API edits an entry; the answers, shown as a page.
  {
    const e = await context(browser);
    records.edits = await tryToEditAuditEntries(e.page);
    await e.page.setContent(
      `<body style="margin:0;padding:48px;font:20px system-ui,sans-serif;background:#fff;color:#1f2328">
      <p style="font-weight:600;color:#59636e;margin:0 0 16px">Trying to change the audit log through the API</p>
      <pre style="font-size:26px;line-height:1.55;border:1px solid #d1d9e0;border-radius:8px;padding:24px;margin:0">${Object.entries(records.edits)
        .map(([req, status]) => `${req.padEnd(26)} → ${status}`)
        .join("\n")}</pre></body>`,
    );
    await shot(e.page, "edits-refused");
    await e.ctx.close();
  }

  // 3. Viewer, dark and phone screens.
  {
    const v = await context(browser, { login: "ada" });
    records.viewerStatus = (await v.page.request.get("/api/audit")).status();
    await v.audit.open();
    await v.audit.emptyTitle.waitFor();
    records.viewerTitle = await v.audit.emptyTitle.innerText();
    await v.page.waitForTimeout(500);
    await shot(v.page, "audit-viewer");
    await v.ctx.close();
  }
  for (const [file, opts] of [["audit-dark", { dark: true }], ["audit-phone", { width: 390, height: 844 }]]) {
    const p = await context(browser, opts);
    await p.audit.open();
    await p.audit.rows.first().waitFor();
    await p.page.waitForTimeout(600);
    await shot(p.page, file);
    await p.ctx.close();
  }
  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  await browser.close();
}
console.log(JSON.stringify(records));
