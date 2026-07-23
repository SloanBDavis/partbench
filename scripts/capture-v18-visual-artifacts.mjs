import { spawn } from "node:child_process";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectToBrowser,
  findBrowserExecutable,
  getAvailablePort,
  startStaticServer,
  stopBrowserProcess
} from "./occt-smoke/browser.mjs";
import { acquireBrowserSmokeLease } from "./v18-geometry-reliability.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = join(repositoryRoot, "apps/web/dist");
const outputDirectory = join(repositoryRoot, "docs/v18-ui-artifacts");
const browserExecutable = findBrowserExecutable();

if (!browserExecutable) {
  throw new Error(
    "No Chromium-compatible browser was found. Set PARTBENCH_SMOKE_BROWSER."
  );
}
await stat(join(distDirectory, "index.html")).catch(() => {
  throw new Error("The production web build is missing. Run pnpm build first.");
});

await mkdir(outputDirectory, { recursive: true });
const profileDirectory = join(
  repositoryRoot,
  ".metrics",
  `chrome-profile-v18-visuals-${process.pid}`
);
let client;
let browserLease;
let server;
let browser;
try {
  browserLease = await acquireBrowserSmokeLease({
    lockPath: join(repositoryRoot, ".metrics", "browser-smoke.lock")
  });
  server = await startStaticServer(distDirectory);
  await mkdir(profileDirectory, { recursive: true });
  const port = await getAvailablePort();
  browser = spawn(
    browserExecutable,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--force-prefers-reduced-motion",
      "--no-default-browser-check",
      "--no-first-run",
      ...(process.env.PARTBENCH_SMOKE_BROWSER_NO_SANDBOX === "1"
        ? ["--no-sandbox"]
        : []),
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDirectory}`,
      "about:blank"
    ],
    { stdio: "ignore" }
  );
  ({ client } = await connectToBrowser(port));
  const target = await client.send("Target.createTarget", {
    url: "about:blank"
  });
  const attached = await client.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true
  });
  const sessionId = attached.sessionId;
  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Page.enable", {}, sessionId);

  const states = [
    {
      name: "reference-solid-1536x1024",
      width: 1536,
      height: 1024,
      mode: "Solid"
    },
    {
      name: "reference-sketch-1536x1024",
      width: 1536,
      height: 1024,
      mode: "Sketch"
    },
    {
      name: "reference-feature-edit-1536x1024",
      width: 1536,
      height: 1024,
      mode: "Solid",
      action: "Box",
      readyText: "Create Box"
    },
    {
      name: "reference-inspect-1536x1024",
      width: 1536,
      height: 1024,
      mode: "Inspect"
    },
    {
      name: "reference-project-1536x1024",
      width: 1536,
      height: 1024,
      mode: "Project"
    },
    { name: "shell-1024x768", width: 1024, height: 768, mode: "Solid" },
    { name: "shell-390x740", width: 390, height: 740, mode: "Solid" }
  ];

  for (const state of states) {
    await client.send(
      "Emulation.setDeviceMetricsOverride",
      {
        width: state.width,
        height: state.height,
        deviceScaleFactor: 1,
        mobile: false
      },
      sessionId
    );
    await client.send(
      "Page.navigate",
      { url: `http://127.0.0.1:${server.port}/index.html` },
      sessionId
    );
    await evaluate(
      client,
      sessionId,
      `(async () => {
        const wait = (predicate, label) => new Promise((resolve, reject) => {
          const deadline = performance.now() + 8000;
          const poll = () => {
            if (predicate()) return resolve();
            if (performance.now() > deadline) return reject(new Error(label));
            requestAnimationFrame(poll);
          };
          poll();
        });
        await wait(
          () => performance.getEntriesByName("partbench:shell-ready").length,
          "shell-ready mark missing"
        );
        const mode = ${JSON.stringify(state.mode)};
        const modeButton = [...document.querySelectorAll('[aria-label="Workbench mode"] button')]
          .find((candidate) => candidate.textContent.trim() === mode);
        modeButton.click();
        await wait(() => modeButton.getAttribute("aria-selected") === "true", "mode change");
        const modeReadyText = {
          Project: "Document overview",
          Sketch: "Create sketch",
          Inspect: "Selection details",
          Solid: "No active operation"
        }[mode];
        await wait(
          () => [...document.querySelectorAll("h1, h2, h3")]
            .some((heading) => heading.textContent.trim() === modeReadyText),
          "mode surface"
        );
        const action = ${JSON.stringify(state.action ?? null)};
        if (action) {
          const actionButton = [...document.querySelectorAll("button")]
            .find((candidate) => candidate.textContent.trim() === action && !candidate.disabled);
          actionButton.click();
          const readyText = ${JSON.stringify(state.readyText ?? "")};
          await wait(
            () => [...document.querySelectorAll("h1, h2, h3")]
              .some((heading) => heading.textContent.trim() === readyText),
            "editor state"
          );
        }
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      })()`
    );
    const screenshot = await client.send(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: false, fromSurface: true },
      sessionId
    );
    await writeFile(
      join(outputDirectory, `${state.name}.png`),
      screenshot.data,
      "base64"
    );
    console.log(`Captured ${state.name}.png`);
  }
} finally {
  await client?.close().catch(() => {});
  await stopBrowserProcess(browser);
  await server?.close();
  await rm(profileDirectory, { recursive: true, force: true }).catch(() => {});
  await browserLease?.release();
}

async function evaluate(client, sessionId, expression) {
  const response = await client.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    sessionId
  );
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text ??
        "Browser evaluation failed."
    );
  }
  return response.result.value;
}
