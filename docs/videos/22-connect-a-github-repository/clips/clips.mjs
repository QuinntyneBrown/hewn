// Captures the Mission Control screens and clips for the journey 22 video (Connect a GitHub repository) from the
// running e2e stack, reusing the e2e page objects, with real workers running stages 0 to 10 against the fake GitHub.
// Start a fresh stack (the project names here must be new):
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/22-connect-a-github-repository/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { NewDirectionPage } = await import(join(repo, "e2e/pages/new-direction.page.ts"));
const { ProjectPage } = await import(join(repo, "e2e/pages/project.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const idea = "Book firing slots for a shared pottery kiln, with reminders and a waiting list.";

async function context(browser, { width = 1280, height = 900, dark = false, video } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? "dark" : "light",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post("/api/auth/dev/sign-in", { data: { login: "quinntynebrown" } });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  return { ctx, page, newDirection: new NewDirectionPage(page), project: new ProjectPage(page) };
}

const shot = async (page, name, locator) => (
  await page.mouse.move(0, 0),
  (locator ?? page).screenshot({ path: join(screens, `${name}.png`), animations: "disabled", caret: "hide" })
);
const pause = (page, ms = 1_200) => page.waitForTimeout(ms);

const browser = await chromium.launch();

async function clip(name, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const c = await context(browser, { width: 1408, height: 792, video: raw });
  await act(c);
  await c.ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

const stopWorkers = startWorkers(3, 150);
const records = {};
try {
  // 1. An existing repository Hewn can't write to is refused; one it can write to is connected.
  await clip("existing-repository", async ({ page, newDirection, project }) => {
    await newDirection.open();
    await pause(page, 1_000);
    await newDirection.name.pressSequentially("Handover Desk", { delay: 60 });
    await newDirection.idea.fill("Shift handover notes for a small hospital ward, signed off by the next nurse in charge.");
    await newDirection.repository.pressSequentially("https://github.com/northwind/handover", { delay: 40 });
    await pause(page, 800);
    await newDirection.submit();
    await newDirection.errorFor("repo").waitFor();
    await pause(page, 3_500);
    await newDirection.repository.fill("");
    await newDirection.repository.pressSequentially("https://github.com/acme/handover", { delay: 40 });
    await pause(page, 800);
    await newDirection.submit();
    await project.repository.waitFor();
    await pause(page, 3_000);
  });

  // 2. No repository: stage 0 creates a private one, named in kebab case; records.json keeps the fake GitHub's record.
  let repository;
  await clip("new-repository", async ({ page, newDirection, project }) => {
    await newDirection.open();
    await newDirection.name.pressSequentially("Kiln Scheduler", { delay: 60 });
    await newDirection.idea.fill(idea);
    await pause(page, 1_000);
    await newDirection.submit();
    await project.heading.waitFor();
    await project.repository.waitFor({ timeout: 60_000 });
    repository = (await project.repository.textContent()).trim();
    await pause(page, 2_500);
    records.created = await project.gitHubRepository(repository);
  });

  // Once stage 6 merges the scaffold, the default branch requires its checks.
  {
    const { ctx, page, project } = await context(browser);
    await page.goto("/projects");
    await page.getByRole("link", { name: "Kiln Scheduler" }).first().click();
    await project.completeCallout.waitFor({ timeout: 120_000 });
    records.protected = await project.gitHubRepository(repository);
    await shot(page, "project-complete");
    await ctx.close();
  }
  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);

  // 3. Screens: the repo-no-access error on desktop, dark and phone; the connected project.
  for (const [tag, opts] of [["desktop", {}], ["dark", { dark: true }], ["phone", { width: 390, height: 844 }]]) {
    const { ctx, page, newDirection } = await context(browser, opts);
    await newDirection.open();
    await newDirection.fill({ name: `Northwind ${tag}`, idea, repository: "https://github.com/northwind/handover" });
    await newDirection.submit();
    await newDirection.errorFor("repo").waitFor();
    await pause(page, 400);
    await shot(page, `repo-no-access-${tag}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  await stopWorkers();
}
console.log(`screens in ${screens}, clips in ${here}`);
