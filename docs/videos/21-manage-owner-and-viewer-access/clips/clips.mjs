// Captures the Mission Control screens and clips for the journey 21 video (Manage Owner and Viewer access) from the
// running app, reusing the e2e page objects. Sign-in goes through the e2e stack's fake GitHub authorize page. Start
// a fresh stack (the logins added here must be new):
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/21-manage-owner-and-viewer-access/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { SettingsPage } = await import(join(repo, "e2e/pages/settings.page.ts"));
const { SignInPage } = await import(join(repo, "e2e/pages/sign-in.page.ts"));
const { ProjectPage } = await import(join(repo, "e2e/pages/project.page.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });

async function context(browser, { width = 1280, height = 900, dark = false, video, login, scale } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: scale ?? (width < 600 ? 2 : 1),
    colorScheme: dark ? "dark" : "light",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  if (login) {
    const r = await page.request.post("/api/auth/dev/sign-in", { data: { login } });
    if (r.status() !== 204) throw new Error(`sign in ${login}: ${r.status()}`);
  }
  return { ctx, page, settings: new SettingsPage(page), signIn: new SignInPage(page), project: new ProjectPage(page) };
}

const shot = async (page, name) => (
  await page.mouse.move(0, 0),
  page.screenshot({ path: join(screens, `${name}.png`), animations: "disabled", caret: "hide" })
);
const pause = (page, ms = 1_200) => page.waitForTimeout(ms);

const browser = await chromium.launch();

/** Records `act` in a 1408x792 page and writes it to clips/<name>.mp4. */
async function clip(name, opts, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const c = await context(browser, { width: 1408, height: 792, video: raw, ...opts });
  await act(c);
  await c.ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

try {
  // 1. The Owner adds nadia-k as a Viewer.
  await clip("add-viewer", { login: "quinntynebrown" }, async ({ page, settings }) => {
    await settings.open();
    await settings.accessRows.first().waitFor();
    await pause(page, 2_000);
    await settings.addLogin.click();
    await settings.addLoginInput.waitFor();
    await pause(page, 800);
    await settings.addLoginInput.pressSequentially("nadia-k", { delay: 110 });
    await pause(page, 800);
    await settings.addViewer.hover();
    await pause(page, 800);
    await settings.addConfirm.click();
    await settings.accessRow("nadia-k").row.waitFor();
    await pause(page, 3_000);
  });

  // 2. nadia-k signs in through GitHub and finds Settings read-only; then tries a change by hand: 403.
  const answers = {};
  await clip("viewer", {}, async ({ page, settings, signIn }) => {
    await signIn.open();
    await pause(page, 1_000);
    await signIn.continueWithGitHub.click();
    await signIn.gitHubLogin.waitFor();
    await signIn.gitHubLogin.pressSequentially("nadia-k", { delay: 100 });
    await signIn.gitHubAuthorize.click();
    await page.locator(".sidebar__foot").getByText("nadia-k").waitFor();
    await pause(page, 2_000);
    await page.getByRole("link", { name: "Settings" }).first().click();
    await settings.accessRows.first().waitFor();
    await pause(page, 2_500);
    await settings.readOnlyCallout.scrollIntoViewIfNeeded();
    await pause(page, 2_500);
    answers.addAsViewer = await settings.tryToChange("POST", "/api/allow-list", { login: "nadias-friend", role: "Owner" });
    answers.stopAsViewer = await settings.tryToChange("POST", "/api/workers/stop");
  });

  // 3. The Owner removes nadia-k; her open Mission Control goes to sign-in on its next request.
  await clip("remove", { login: "quinntynebrown" }, async ({ page, settings }) => {
    const hers = await context(browser, { login: "nadia-k" });
    await hers.page.goto("/projects");
    await settings.open();
    await settings.accessRow("nadia-k").row.waitFor();
    await pause(page, 1_500);
    await settings.accessRow("nadia-k").remove.hover();
    await pause(page, 1_000);
    await settings.accessRow("nadia-k").remove.click();
    await settings.accessRow("nadia-k").row.waitFor({ state: "detached" });
    await pause(page, 3_000);
    answers.removedMe = (await hers.page.request.get("/api/me")).status();
    await hers.ctx.close();
  });

  // What the API answers: a Viewer's writes, a removed login, and a project nobody can see.
  {
    const { ctx, page } = await context(browser, { login: "ada" });
    const hidden = "0b5e1f9c-7d1a-4c55-9a6e-3f1f1b2b9c11";
    const notFound = await page.request.get(`/api/projects/${hidden}`);
    answers.hidden = { url: `/api/projects/${hidden}`, status: notFound.status(), body: await notFound.json() };
    writeFileSync(join(screens, "answers.json"), `${JSON.stringify(answers, null, 2)}\n`);
    await page.goto(`/projects/${hidden}`);
    await page.getByRole("heading", { level: 1, name: "Project not found" }).waitFor();
    await shot(page, "project-not-found");
    await ctx.close();
  }

  // 4. Screens: Owner and Viewer Settings, the dialog's invalid and failed states, dark, phone.
  for (const [tag, opts] of [
    ["owner", { login: "quinntynebrown" }],
    ["viewer", { login: "ada" }],
    ["dark", { login: "quinntynebrown", dark: true }],
    ["phone", { login: "ada", width: 390, height: 844 }],
  ]) {
    const { ctx, page, settings } = await context(browser, opts);
    await settings.open();
    await settings.accessRows.first().waitFor();
    await pause(page, 500);
    await shot(page, `settings-${tag}`);
    await ctx.close();
  }
  for (const [tag, login] of [["invalid", "ada"], ["failed", "rate-limited"]]) {
    const { ctx, page, settings } = await context(browser, { login: "quinntynebrown" });
    await settings.open();
    await settings.fillAdd(login);
    await settings.addConfirm.click();
    await (tag === "invalid" ? settings.addLoginError : settings.addFailure).waitFor();
    await pause(page, 400);
    await shot(page, `add-${tag}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
