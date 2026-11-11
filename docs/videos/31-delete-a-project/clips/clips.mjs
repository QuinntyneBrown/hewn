// Captures the screens and clips for the journey 31 video (Delete a project). Start the stack first:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/31-delete-a-project/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { ProjectsPage } = await import(join(repo, "e2e/pages/projects.page.ts"));
const { DeleteProjectDialog } = await import(join(repo, "e2e/pages/delete-project.ts"));

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
async function aProject(page, name, idle, repository = null) {
  const headers = { "X-XSRF-TOKEN": await xsrf(page) };
  if (repository) {
    const readme = `# ${name}\n\nA CRM for small harbour chandleries, built by Hewn.\n`;
    const seeded = await page.request.put(`/api/fakes/github/hewn-builds/${repository}/files`, { data: { "README.md": readme } });
    if (!seeded.ok()) throw new Error(`seed: ${seeded.status()}`);
  }
  const r = await page.request.post("/api/projects", {
    data: {
      name,
      idea: repository ? "A CRM for small harbour chandleries." : "Tide and swell planner for small-boat charters.",
      stackPreference: null,
      repositoryUrl: repository ? `https://github.com/hewn-builds/${repository}` : null,
      budgetUsd: 300,
    },
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
  return { ctx, page, projects: new ProjectsPage(page), dialog: new DeleteProjectDialog(page) };
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
  const harbor = `Harbor CRM ${tag}`;
  const repository = `harbor-crm-${tag}`;
  const tidewater = `Tidewater ${tag}`;
  const harborId = await aProject(setup.page, harbor, true, repository);
  const tidewaterId = await aProject(setup.page, tidewater, false);
  await setup.ctx.close();

  // 1. Delete: the wrong name, then the right one; the row leaves; the repository is still there.
  const d = await recording(browser, "delete");
  await d.projects.open();
  const row = d.projects.row(harbor);
  await row.delete.waitFor();
  await d.page.waitForTimeout(2_000);
  await shot(d.page, "projects-owner");
  // Paced to the narration (captions): Delete is pressed as the dialog is described, ~9.5 s in.
  await d.page.waitForTimeout(4_000);
  await row.delete.hover();
  await d.page.waitForTimeout(1_500);
  await row.delete.click();
  await d.dialog.settled();
  records.title = await d.dialog.title.innerText();
  records.hint = await d.dialog.hint.innerText();
  await d.page.waitForTimeout(14_500);
  await shot(d.page, "dialog-default");
  await d.dialog.name.pressSequentially("Harbor", { delay: 140 });
  await d.page.keyboard.press("Tab");
  await d.dialog.error.waitFor();
  records.error = await d.dialog.error.innerText();
  records.disabledWhenWrong = await d.dialog.confirm.isDisabled();
  await d.page.waitForTimeout(6_000);
  await shot(d.page, "dialog-invalid");
  await d.dialog.name.fill("");
  await d.dialog.name.pressSequentially(harbor, { delay: 110 });
  await d.page.waitForTimeout(2_000);
  await d.dialog.confirm.hover();
  await d.page.waitForTimeout(1_000);
  const started = Date.now();
  await d.dialog.confirm.click();
  await d.projects.toastSettled(`${harbor} deleted`);
  records.deletedMs = Date.now() - started;
  records.toast = await d.projects.toast(`${harbor} deleted`).innerText();
  records.rowsAfter = await row.root.count();
  await d.page.waitForTimeout(6_500);
  await shot(d.page, "projects-deleted");
  records.projectStatus = (await d.page.request.get(`/api/projects/${harborId}`)).status();
  await d.page.goto(`/projects/${harborId}`);
  await d.page.waitForTimeout(3_500);
  await shot(d.page, "project-gone");
  await d.page.goto(`/api/fakes/github/hewn-builds/${repository}/contents/README.md`);
  records.readme = await d.page.locator("body").innerText();
  // The fake GitHub answers plain text; label it with the repository and path, and make it readable on video.
  await d.page.evaluate((label) => {
    const caption = document.createElement("p");
    caption.textContent = label;
    caption.style.cssText = "font: 600 22px system-ui, sans-serif; color: #59636e; margin: 0 0 16px";
    document.body.style.cssText = "margin: 0; padding: 48px; background: #fff";
    document.body.prepend(caption);
    const pre = document.querySelector("pre");
    if (pre) pre.style.cssText = "font-size: 30px; line-height: 1.5; border: 1px solid #d1d9e0; border-radius: 8px; padding: 24px; white-space: pre-wrap";
  }, `GitHub (e2e fake) · hewn-builds/${repository} · README.md on the default branch`);
  await d.page.waitForTimeout(6_500);
  await shot(d.page, "repository-kept");
  await d.done();

  // 2. The refusal: Delete disabled while a direction is active.
  const r = await recording(browser, "refused");
  await r.projects.open();
  const busy = r.projects.row(tidewater);
  await busy.deleteRefused.waitFor();
  records.refusedName = await busy.deleteRefused.getAttribute("aria-label");
  records.refusedTitle = await busy.deleteRefused.getAttribute("title");
  await r.page.waitForTimeout(2_000);
  await busy.deleteRefused.hover();
  await r.page.waitForTimeout(6_000);
  await shot(r.page, "row-active", r.projects.list);
  await busy.deleteRefused.click({ force: true });
  records.dialogOnRefused = await r.dialog.panel.count();
  await r.page.waitForTimeout(6_500);
  await r.done();
  await (async () => {
    const c = await context(browser);
    await cancel(c.page, tidewaterId);
    await c.ctx.close();
  })();

  // 3. Failed, Viewer, dark and phone screens.
  {
    const f = await context(browser);
    await f.projects.open();
    await f.projects.row(tidewater).delete.click();
    await f.dialog.name.fill(tidewater);
    await f.dialog.failDelete(503, "Service Unavailable", "unavailable");
    await f.dialog.confirm.click();
    await f.dialog.failure.waitFor();
    records.failure = await f.dialog.failure.innerText();
    await f.page.waitForTimeout(500);
    await shot(f.page, "dialog-failed");
    await f.ctx.close();
  }
  {
    const v = await context(browser, { login: "ada" });
    await v.projects.open();
    await v.projects.row(tidewater).status.waitFor();
    records.viewerDelete = await v.projects.row(tidewater).delete.count();
    await v.page.waitForTimeout(800);
    await shot(v.page, "projects-viewer");
    await v.ctx.close();
  }
  for (const [file, opts] of [["dialog-dark", { dark: true }], ["dialog-phone", { width: 390, height: 844 }]]) {
    const p = await context(browser, opts);
    await p.projects.open();
    await p.projects.row(tidewater).delete.click();
    await p.dialog.settled();
    await p.dialog.name.fill(tidewater);
    await p.page.waitForTimeout(600);
    await shot(p.page, file);
    await p.ctx.close();
  }
  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  await browser.close();
}
console.log(JSON.stringify(records));
