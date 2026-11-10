// Captures the screens and clips for the journey 29 video (Update project skills). It commits to the e2e stack's
// local Greenlit, as Greenlit's maintainers would. Start the stack first:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/29-update-project-skills/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { ProjectPage } = await import(join(repo, "e2e/pages/project.page.ts"));
const { SkillsUpdate } = await import(join(repo, "e2e/pages/skills-update.ts"));

// The e2e stack's local Greenlit, committed to as its maintainers would (as e2e/support/skills.ts does).
const greenlit = join(repo, "backend/.e2e/greenlit");
const git = (...args) => execFileSync("git", ["-C", greenlit, ...args], { encoding: "utf8" }).trim();
const greenlitHead = () => git("rev-parse", "HEAD");
function commitToGreenlit(message, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(greenlit, path)), { recursive: true });
    writeFileSync(join(greenlit, path), content);
  }
  git("add", "-A");
  git("-c", "user.name=Greenlit", "-c", "user.email=greenlit@example.invalid", "commit", "-q", "--allow-empty", "-m", message);
  return greenlitHead();
}
async function xsrf(page) {
  await page.request.get("/api/me");
  return (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
}
/** A project on a repository whose skills are locked at `sha`, with CI; its direction cancelled so no worker runs. */
async function projectOnSkills(page, name, sha) {
  const repository = `skills-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const seeded = await page.request.put(`/api/fakes/github/hewn-builds/${repository}/files`, {
    data: {
      ".hewn/skills.lock": `${JSON.stringify({ source: `file://${greenlit}`, sha, skills: ["estimating-designs", "grilling"] }, null, 2)}\n`,
      ".claude/skills/grilling/SKILL.md": "# Grilling\n",
      ".claude/skills/estimating-designs/SKILL.md": "# Estimating designs\n",
      ".github/workflows/ci.yml": "name: CI\non: [pull_request]\njobs:\n  build:\n    runs-on: ubuntu-latest\n",
    },
  });
  if (!seeded.ok()) throw new Error(`seed: ${seeded.status()}`);
  const headers = { "X-XSRF-TOKEN": await xsrf(page) };
  const r = await page.request.post("/api/projects", {
    data: { name, idea: "A web app for small accounting teams to reconcile statements.", stackPreference: null, repositoryUrl: `https://github.com/hewn-builds/${repository}`, budgetUsd: 300 },
    headers,
  });
  if (r.status() !== 201) throw new Error(`submit: ${r.status()} ${await r.text()}`);
  const { projectId } = await r.json();
  const project = await (await page.request.get(`/api/projects/${projectId}`)).json();
  await page.request.post(`/api/projects/${projectId}/directions/${project.directions[0].id}/cancel`, { data: {}, headers });
  return { projectId, repository };
}
async function lockedSha(page, repository) {
  const r = await page.request.get(`/api/fakes/github/hewn-builds/${repository}/contents/.hewn/skills.lock`);
  return r.ok() ? JSON.parse(await r.text()).sha : null;
}

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const tag = Date.now().toString(36).slice(-4);
const records = {};

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
  return { ctx, page, project: new ProjectPage(page), skills: new SkillsUpdate(page) };
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
  // A project locked at Greenlit's head; then Greenlit moves on by three commits.
  const setup = await context(browser);
  const locked = greenlitHead();
  const { projectId, repository } = await projectOnSkills(setup.page, `Ledgerline ${tag}`, locked);
  const second = await projectOnSkills(setup.page, `Kiln Booking ${tag}`, locked);
  await setup.ctx.close();
  commitToGreenlit("grilling: answer for the user when running unattended", {
    ".claude/skills/grilling/SKILL.md": "# Grilling\n\nAnswer for the user when running unattended.\n",
  });
  commitToGreenlit("implementing-incrementally: record red before green", {
    ".claude/skills/implementing-incrementally/SKILL.md": "# Implementing incrementally\n\nRecord red before green.\n",
  });
  const head = commitToGreenlit("estimating-designs: 3-day descope threshold by default", {
    ".claude/skills/estimating-designs/SKILL.md": "# Estimating designs\n\n3-day descope threshold by default.\n",
  });
  records.locked = locked.slice(0, 7);
  records.head = head.slice(0, 7);

  // 1. The Owner sees the update, reads the commits and updates; the link goes; the pull request merges.
  const o = await recording(browser, "update-skills");
  await o.project.open(projectId);
  await o.skills.link.waitFor();
  records.link = await o.skills.link.innerText();
  await o.page.waitForTimeout(2_000);
  await shot(o.page, "project-update-available");
  await o.skills.link.hover();
  await o.page.waitForTimeout(700);
  await o.skills.open();
  await o.page.waitForTimeout(3_500);
  await shot(o.page, "dialog-default", o.skills.panel);
  await o.skills.update.hover();
  await o.page.waitForTimeout(800);
  const started = Date.now();
  await o.skills.update.click();
  await o.skills.openedToast.waitFor();
  records.openedAfterMs = Date.now() - started;
  records.toast = await o.skills.openedToast.innerText();
  await o.page.waitForTimeout(2_500);
  await shot(o.page, "project-update-opened");
  for (let i = 0; i < 60 && (await lockedSha(o.page, repository)) !== head; i++) await o.page.waitForTimeout(1_000);
  records.mergedAfterMs = Date.now() - started;
  records.mergedLock = (await lockedSha(o.page, repository))?.slice(0, 7);
  await o.page.reload();
  await o.project.headerMeta.waitFor();
  await o.page.waitForTimeout(2_500);
  records.linkAfterMerge = await o.skills.link.count();
  await o.done();

  // 2. Greenlit can't be reached: the dialog says so and offers Try again.
  const f = await recording(browser, "update-failed");
  await f.project.open(second.projectId);
  await f.skills.link.waitFor();
  await f.page.waitForTimeout(1_200);
  await f.skills.open();
  await f.page.waitForTimeout(1_200);
  await f.skills.failUpdate(502, "Greenlit couldn’t be fetched (git exited with 128)", "greenlit_unreachable");
  await f.skills.update.click();
  await f.skills.failure.waitFor();
  await f.page.waitForTimeout(3_500);
  await shot(f.page, "dialog-failed", f.skills.panel);
  await f.skills.tryAgain.hover();
  await f.page.waitForTimeout(2_500);
  await f.done();

  // 3. A Viewer sees no link; dark mode and a phone.
  {
    const v = await context(browser, { login: "ada" });
    await v.project.open(second.projectId);
    await v.project.headerMeta.waitFor();
    await v.page.waitForTimeout(1_500);
    records.viewerLinks = await v.skills.link.count();
    await shot(v.page, "project-viewer");
    await v.ctx.close();
  }
  for (const [file, opts] of [["dialog-dark", { dark: true }], ["dialog-phone", { width: 390, height: 844 }]]) {
    const d = await context(browser, opts);
    await d.project.open(second.projectId);
    await d.skills.link.waitFor();
    await d.skills.open();
    await d.page.waitForTimeout(600);
    await shot(d.page, file);
    await d.ctx.close();
  }
  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  await browser.close();
}
console.log(JSON.stringify(records));
