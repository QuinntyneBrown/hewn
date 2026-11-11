// Captures the screens and clips for the journey 30 video (Archive and restore a project). Start the stack first:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/30-archive-and-restore-a-project/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { ProjectsPage } = await import(join(repo, "e2e/pages/projects.page.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const tag = Date.now().toString(36).slice(-4);
const records = {};

async function xsrf(page) {
  await page.request.get("/api/me");
  return (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
}

/** A real project; `idle` cancels its direction straight away so it has no active direction. */
async function aProject(page, name, idle) {
  const headers = { "X-XSRF-TOKEN": await xsrf(page) };
  const r = await page.request.post("/api/projects", {
    data: { name, idea: "Bird-count logging for estuary volunteers.", stackPreference: null, repositoryUrl: null, budgetUsd: 300 },
    headers,
  });
  if (r.status() !== 201) throw new Error(`submit: ${r.status()} ${await r.text()}`);
  const { projectId } = await r.json();
  if (idle) {
    const project = await (await page.request.get(`/api/projects/${projectId}`)).json();
    await page.request.post(`/api/projects/${projectId}/directions/${project.directions[0].id}/cancel`, { data: {}, headers });
  }
  return projectId;
}

async function cancel(page, projectId) {
  const headers = { "X-XSRF-TOKEN": await xsrf(page) };
  const project = await (await page.request.get(`/api/projects/${projectId}`)).json();
  await page.request.post(`/api/projects/${projectId}/directions/${project.directions[0].id}/cancel`, { data: {}, headers });
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
  return { ctx, page, projects: new ProjectsPage(page) };
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
  const setup = await context(browser);
  const saltmarsh = `Saltmarsh Survey ${tag}`;
  const tidewater = `Tidewater ${tag}`;
  await aProject(setup.page, saltmarsh, true);
  const tidewaterId = await aProject(setup.page, tidewater, false);
  await setup.ctx.close();

  // 1. Archive an idle project, find it under Archived, restore it.
  const a = await recording(browser, "archive-and-restore");
  await a.projects.open();
  const row = a.projects.row(saltmarsh);
  await row.archive.waitFor();
  await a.page.waitForTimeout(2_000);
  await shot(a.page, "projects-owner");
  // Paced to the narration: the rows and their Archive control are described before the click.
  await a.page.waitForTimeout(5_500);
  await row.archive.hover();
  await a.page.waitForTimeout(2_000);
  await row.archive.click();
  await a.projects.toastSettled(`${saltmarsh} archived`);
  records.archivedToast = await a.projects.toast(`${saltmarsh} archived`).innerText();
  await a.page.waitForTimeout(5_000);
  await shot(a.page, "projects-archived-toast");
  await a.projects.toast(`${saltmarsh} archived`).getByRole("link", { name: "Show archived" }).click();
  await row.restore.waitFor();
  await a.page.waitForTimeout(6_000);
  await shot(a.page, "projects-archived");
  await row.restore.hover();
  await a.page.waitForTimeout(800);
  await row.restore.click();
  await a.projects.toastSettled(`${saltmarsh} restored`);
  await a.page.waitForTimeout(2_000);
  await a.projects.tab("All").click();
  await row.archive.waitFor();
  records.restoredStatus = await row.status.innerText();
  await a.page.waitForTimeout(2_500);
  await a.done();

  // 2. The refusal: Archive disabled on a project with an active direction; the API's answer when one started meanwhile.
  const r = await recording(browser, "refused");
  await r.projects.open();
  const busy = r.projects.row(tidewater);
  await busy.archiveRefused.waitFor();
  records.refusedName = await busy.archiveRefused.getAttribute("aria-label");
  records.refusedTitle = await busy.archiveRefused.getAttribute("title");
  await busy.archiveRefused.hover();
  await r.page.waitForTimeout(2_500);
  await shot(r.page, "row-active", r.projects.list);
  await cancel(r.page, tidewaterId);
  await busy.archive.waitFor();
  await r.page.waitForTimeout(1_500);
  await r.projects.refuseArchive(409, "Cancel the running direction first", "active_direction");
  await busy.archive.click();
  await r.projects.toastSettled(`${tidewater} wasn’t archived`);
  records.refusedToast = await r.projects.toast(`${tidewater} wasn’t archived`).innerText();
  await r.page.waitForTimeout(2_500);
  await shot(r.page, "projects-refused");
  await r.page.waitForTimeout(1_500);
  await r.done();

  // 3. Archive Saltmarsh again for the Viewer, dark and phone screens.
  {
    const o = await context(browser);
    await o.projects.open();
    await o.projects.row(saltmarsh).archive.click();
    await o.projects.toastSettled(`${saltmarsh} archived`);
    await o.ctx.close();
  }
  {
    const v = await context(browser, { login: "ada" });
    await v.projects.open("?status=archived");
    await v.projects.row(saltmarsh).status.waitFor();
    records.viewerRestore = await v.projects.row(saltmarsh).restore.count();
    await v.page.waitForTimeout(800);
    await shot(v.page, "projects-archived-viewer");
    await v.ctx.close();
  }
  for (const [file, opts] of [["projects-archived-dark", { dark: true }], ["projects-archived-phone", { width: 390, height: 844 }]]) {
    const d = await context(browser, opts);
    await d.projects.open("?status=archived");
    await d.projects.row(saltmarsh).restore.waitFor();
    await d.page.waitForTimeout(600);
    await shot(d.page, file);
    await d.ctx.close();
  }
  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  await browser.close();
}
console.log(JSON.stringify(records));
