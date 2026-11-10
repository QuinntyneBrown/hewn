// Captures the Mission Control screens and clips for the journey 20 video (Sign in and sign out) from the API serving
// the built app with its security headers, reusing the e2e page objects. Sign-in goes through the e2e stack's fake
// GitHub authorize page. Build the app and start the API serving it:
//   cd frontend && npx ng build mission-control && cd ..
//   Hewn__MissionControl__Root=$PWD/frontend/dist/mission-control/browser Hewn__Auth__PublicOrigin=http://localhost:5300 \
//     pwsh eng/Start-E2eApi.ps1
// then from the repo root:
//   node docs/videos/20-sign-in-and-sign-out/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { SignInPage } = await import(join(repo, "e2e/pages/sign-in.page.ts"));

const base = process.env.APP_URL ?? "http://localhost:5300";
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
    if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  }
  return { ctx, page, signIn: new SignInPage(page) };
}

const shot = async (page, name) => (
  await page.mouse.move(0, 0),
  page.screenshot({ path: join(screens, `${name}.png`), animations: "disabled", caret: "hide" })
);
const pause = (page, ms = 1_200) => page.waitForTimeout(ms);

const browser = await chromium.launch();

/** Records `act` in a signed-out 1408x792 page and writes it to clips/<name>.mp4. */
async function clip(name, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, signIn } = await context(browser, { width: 1408, height: 792, video: raw });
  await act(page, signIn);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

async function throughGitHub(page, signIn, login) {
  await signIn.continueWithGitHub.click();
  await signIn.gitHubLogin.waitFor();
  await pause(page, 1_000);
  await signIn.gitHubLogin.pressSequentially(login, { delay: 90 });
  await pause(page, 600);
  await signIn.gitHubAuthorize.click();
}

try {
  // What the API answers for a page without a session, for the slides.
  const page = await (await browser.newContext({ baseURL: base })).newPage();
  const answer = await page.request.get("/workers", { maxRedirects: 0 });
  const signInPage = await page.request.get("/sign-in");
  const pick = (r, names) => names.filter((n) => r.headers()[n]).map((n) => `${n}: ${r.headers()[n]}`).join("\n");
  writeFileSync(
    join(screens, "headers.txt"),
    `GET /workers\n${answer.status()} ${pick(answer, ["location", "x-content-type-options"])}\n\nGET /sign-in\n${signInPage.status()}\n` +
      `${pick(signInPage, ["content-security-policy", "x-content-type-options", "referrer-policy"])}\n`,
  );

  // 1. Signed out, a page goes to sign-in, through GitHub and back; then Sign out.
  await clip("sign-in", async (page, signIn) => {
    await page.goto("/workers");
    await signIn.heading.waitFor();
    await pause(page, 2_500);
    await throughGitHub(page, signIn, "quinntynebrown");
    await page.getByRole("heading", { level: 1, name: "Workers" }).waitFor();
    await pause(page, 2_500);
    await signIn.signOut.hover();
    await pause(page, 1_200);
    await signIn.signOut.click();
    await signIn.status.waitFor();
    await pause(page, 3_000);
  });

  // 2. A login not on the allow list.
  await clip("denied", async (page, signIn) => {
    await signIn.open();
    await pause(page, 1_500);
    await throughGitHub(page, signIn, "devon-park");
    await signIn.alert.waitFor();
    await pause(page, 3_500);
  });

  // 3. Screens: each state, dark, a phone, the sidebar's Sign out.
  for (const [tag, query, opts] of [
    ["default", "", {}],
    ["denied", "error=denied&login=devon-park", {}],
    ["error", "error=github", {}],
    ["expired", "reason=expired", {}],
    ["signed-out", "reason=signed-out", {}],
    ["dark", "reason=expired", { dark: true }],
    ["phone", "error=denied&login=devon-park", { width: 390, height: 844 }],
  ]) {
    const { ctx, page, signIn } = await context(browser, opts);
    await signIn.open(query);
    await pause(page, 500);
    await shot(page, `sign-in-${tag}`);
    await ctx.close();
  }
  {
    const { ctx, page, signIn } = await context(browser, { login: "ada", scale: 2 });
    await page.goto("/workers");
    await signIn.signOut.hover();
    await pause(page, 500);
    await page.locator(".sidebar__foot").screenshot({ path: join(screens, "sidebar-sign-out.png"), animations: "disabled" });
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
