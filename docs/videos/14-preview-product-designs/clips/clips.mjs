// Captures the Mission Control screens and clips for the journey 14 video (Preview product designs) from the running
// app, reusing the e2e page objects. A real worker runs stages 0 to 2 against the fakes, so the gallery shows the
// designs stage 2 exported; a second project holds the isolation probe from the e2e tests. Start a fresh stack:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/14-preview-product-designs/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { DesignsPage } = await import(join(repo, "e2e/pages/designs.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));
const { designedFiles } = await import(join(repo, "e2e/support/designed-files.ts"));
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
  return { ctx, page, designs: new DesignsPage(page) };
}

const shot = async (page, name, fullPage = false) => (
  await page.mouse.move(0, 0),
  page.screenshot({ path: join(screens, `${name}.png`), animations: "disabled", caret: "hide", fullPage })
);

const browser = await chromium.launch();

/** Records `act` in a 1408x792 page opened at `path` and writes it to clips/<name>.mp4. */
async function clip(name, path, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, designs } = await context(browser, { width: 1408, height: 792, video: raw });
  await page.goto(path);
  await act(page, designs);
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

let stopWorkers = () => Promise.resolve();
try {
  // 1. Kiln Booking: a real worker runs stages 0 to 2, so its designs come from stage 2 and the fake Magic Patterns.
  const kiln = await submit("Kiln Booking", "Studio time booking for shared ceramics kilns, with firing schedules and costs.");
  stopWorkers = startWorkers(1, 150);
  for (let i = 0; ; i++) {
    const project = await get(`/api/projects/${kiln}`);
    if (project.directions[0].stages[2].status === "Succeeded") break;
    if (i > 360) throw new Error("Stage 2 never finished");
    await owner.page.waitForTimeout(500);
  }
  await cancel(kiln);
  await stopWorkers();

  // 2. Browsing, the sizes and the themes, as one clip.
  await clip("browse", `/projects/${kiln}`, async (page, designs) => {
    await pause(page, 1_000);
    await designs.tab("Designs").click();
    await designs.previewHeading().waitFor();
    await pause(page, 2_000);
    const titles = await designs.screenTitles();
    await designs.state(titles[0], "Empty").click();
    await pause(page);
    await designs.state(titles.at(-1), "Error").click();
    await pause(page);
    await designs.state(titles.at(-1), "Default").click();
    await pause(page);
    for (const size of ["XS", "S", "M", "L", "XL"]) {
      await designs.width(size).click();
      await pause(page, 1_400);
    }
    await designs.theme("Dark").click();
    await pause(page, 1_600);
    await designs.width("XS").click();
    await pause(page, 1_600);
    await designs.theme("Light").click();
    await designs.width("L").click();
    await pause(page, 1_500);
  });

  const shapes = [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone", false],
  ];
  for (const [width, height, tag, dark] of shapes) {
    const { ctx, page, designs } = await context(browser, { width, height, dark });
    await designs.open(kiln);
    await designs.previewHeading().waitFor();
    await pause(page, 1_500);
    if (width < 600) {
      // Chromium leaves a cross-origin frame unpainted in a full-page shot, so the phone shows the preview in view.
      await designs.frameBox.evaluate((e) => e.scrollIntoView({ block: "end" }));
      await pause(page, 1_500);
    }
    await shot(page, `gallery-${tag}`);
    if (tag === "desktop") {
      await designs.width("XS").click();
      await designs.theme("Dark").click();
      await pause(page, 1_500);
      await shot(page, "xs-dark-desktop");
      await designs.width("XL").click();
      await designs.theme("Light").click();
      await pause(page, 1_500);
      await shot(page, "xl-desktop");
    }
    await ctx.close();
  }

  // 3. The isolation probe from the e2e tests, on a repository holding the designs.
  const repository = `ledgerline-designs-${Date.now().toString(36)}`;
  await owner.page.request.put(`/api/fakes/github/hewn-builds/${repository}/files`, { data: designedFiles() });
  const ledgerline = await submit(
    "Ledgerline",
    "A web app for small accounting teams to reconcile statements.",
    `https://github.com/hewn-builds/${repository}`,
  );
  await cancel(ledgerline);
  {
    const { ctx, page, designs } = await context(browser);
    await designs.open(ledgerline);
    await page.evaluate(() => localStorage.setItem("hewn-probe", "Mission Control storage"));
    await designs.state("Reconcile statement", "Review").click();
    await designs.probe();
    await designs.width("M").click();
    await pause(page, 1_500);
    await shot(page, "probe-desktop");
    await ctx.close();
  }

  // 4. The empty and error states.
  {
    const { ctx, page, designs } = await context(browser);
    const parcel = await submit("Parcel Post", "A shared mailroom log for coworking spaces, with parcels in and signatures out.");
    await cancel(parcel);
    await designs.open(parcel);
    await designs.empty.waitFor();
    await pause(page, 800);
    await shot(page, "empty-desktop");
    const broken = `parcel-broken-${Date.now().toString(36)}`;
    await owner.page.request.put(`/api/fakes/github/hewn-builds/${broken}/files`, { data: { "docs/mocks/manifest.json": '{ "screens": [' } });
    const harbour = await submit("Harbour Rota", "Crew rotas for small harbour ferries, with swaps and cover.", `https://github.com/hewn-builds/${broken}`);
    await cancel(harbour);
    await designs.open(harbour);
    await designs.failure.waitFor();
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
