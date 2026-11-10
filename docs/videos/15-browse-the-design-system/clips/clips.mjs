// Captures the Mission Control screens and clips for the journey 15 video (Browse the design system) from the running
// app, reusing the e2e page objects. A real worker runs stages 0 to 3 against the fakes, so the Design system tab shows
// the token and component pages stage 3 extracted. Start a fresh stack:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/15-browse-the-design-system/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { DesignSystemPage } = await import(join(repo, "e2e/pages/design-system.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));
async function xsrfToken(page) {
  await page.request.get("/api/me");
  return (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
}

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });

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
  return { ctx, page, system: new DesignSystemPage(page) };
}

const shot = async (page, name) => (
  await page.mouse.move(0, 0),
  page.screenshot({ path: join(screens, `${name}.png`), animations: "disabled", caret: "hide" })
);

const browser = await chromium.launch();

/** Records `act` in a 1408x792 page opened at `path` and writes it to clips/<name>.mp4. */
async function clip(name, path, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, system } = await context(browser, { width: 1408, height: 792, video: raw });
  await page.goto(path);
  await act(page, system);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

const owner = await context(browser);
const headers = { "X-XSRF-TOKEN": await xsrfToken(owner.page) };
const get = async (url) => (await owner.page.request.get(url)).json();
async function submit(name, idea, repositoryUrl = null) {
  const r = await owner.page.request.post("/api/projects", {
    data: { name, idea, stackPreference: null, repositoryUrl, budgetUsd: 300 },
    headers,
  });
  if (r.status() !== 201) throw new Error(`submit ${name}: ${r.status()}`);
  return (await r.json()).projectId;
}
async function cancel(id) {
  const project = await get(`/api/projects/${id}`);
  const d = project.directions.at(-1);
  if (["Cancelled", "Completed"].includes(d.status)) return;
  await owner.page.request.post(`/api/projects/${id}/directions/${d.id}/cancel`, { data: {}, headers });
}
const pause = (page, ms = 1_200) => page.waitForTimeout(ms);
/** Scrolls the preview frame into view: Chromium leaves a cross-origin frame unpainted below the fold. */
const frameInView = async (page, system) => {
  await system.frame.evaluate((e) => e.scrollIntoView({ block: "end" }));
  await pause(page, 1_500);
};

let stopWorkers = () => Promise.resolve();
try {
  // 1. Kiln Booking: a real worker runs stages 0 to 3, so its design system comes from stage 3.
  const kiln = await submit("Kiln Booking", "Studio time booking for shared ceramics kilns, with firing schedules and costs.");
  stopWorkers = startWorkers(1, 150);
  for (let i = 0; ; i++) {
    const project = await get(`/api/projects/${kiln}`);
    if (project.directions[0].stages[3].status === "Succeeded") break;
    if (i > 480) throw new Error("Stage 3 never finished");
    await owner.page.waitForTimeout(500);
  }
  await cancel(kiln);
  await stopWorkers();

  // What the preview host answers, for the slides: the response headers of a token page.
  const listed = await get(`/api/projects/${kiln}/design-system`);
  const colour = listed.foundations[0].previewUrl;
  const served = await fetch(`${colour}?theme=dark`);
  const lines = [`GET ${new URL(colour).pathname.replace(/preview\/[^/]+/, "preview/{token}")}?theme=dark`, `${served.status} ${served.statusText}`];
  for (const name of ["content-type", "content-security-policy", "x-content-type-options", "referrer-policy", "cache-control", "set-cookie"])
    lines.push(`${name}: ${served.headers.get(name) ?? "(none)"}`);
  writeFileSync(join(screens, "served.txt"), `${lines.join("\n")}\n`);

  // 2. Browsing tokens then a component, in light and dark, as one clip.
  await clip("browse", `/projects/${kiln}`, async (page, system) => {
    await pause(page, 1_000);
    await system.tab("Design system").click();
    await system.previewHeading().waitFor();
    await pause(page, 2_200);
    for (const title of ["Typography", "Spacing", "Colour"]) {
      await system.pageLink(title).click();
      await pause(page, 1_500);
    }
    await system.theme("Dark").click();
    await pause(page, 2_000);
    await system.pageLink("Button").click();
    await pause(page, 2_000);
    await system.theme("Light").click();
    await pause(page, 1_600);
    await system.width("XS").click();
    await pause(page, 1_600);
    await system.width("L").click();
    await pause(page, 1_500);
  });

  // 3. Tokens and a component, light and dark; Mission Control dark; a phone.
  {
    const { ctx, page, system } = await context(browser);
    await system.open(kiln);
    await system.previewHeading().waitFor();
    await pause(page, 1_500);
    await shot(page, "tokens-light");
    await system.theme("Dark").click();
    await pause(page, 1_500);
    await shot(page, "tokens-dark");
    await system.pageLink("Button").click();
    await pause(page, 1_500);
    await shot(page, "button-dark");
    await system.theme("Light").click();
    await pause(page, 1_500);
    await shot(page, "button-light");
    await ctx.close();
  }
  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone", false],
  ]) {
    const { ctx, page, system } = await context(browser, { width, height, dark });
    await system.open(kiln);
    await system.previewHeading().waitFor();
    await pause(page, 1_500);
    if (width < 600) await frameInView(page, system);
    await shot(page, `system-${tag}`);
    await ctx.close();
  }

  // 4. The empty and error states.
  {
    const { ctx, page, system } = await context(browser);
    const parcel = await submit("Parcel Post", "A shared mailroom log for coworking spaces, with parcels in and signatures out.");
    await cancel(parcel);
    await system.open(parcel);
    await system.empty.waitFor();
    await pause(page, 800);
    await shot(page, "empty-desktop");
    const broken = `harbour-broken-${Date.now().toString(36)}`;
    await owner.page.request.put(`/api/fakes/github/hewn-builds/${broken}/files`, {
      data: { "docs/design-system/tokens.json": '{ "color": {' },
    });
    const harbour = await submit("Harbour Rota", "Crew rotas for small harbour ferries, with swaps and cover.", `https://github.com/hewn-builds/${broken}`);
    await cancel(harbour);
    await system.open(harbour);
    await system.failure.waitFor();
    await pause(page, 800);
    await shot(page, "error-desktop");
    await ctx.close();
  }
} finally {
  await stopWorkers();
  await owner.ctx.close();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
