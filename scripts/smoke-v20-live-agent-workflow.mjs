import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { clearTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import {
  connectToBrowser,
  findBrowserExecutable,
  getAvailablePort,
  stopBrowserProcess
} from "./occt-smoke/browser.mjs";
import { acquireBrowserSmokeLease } from "./v18-geometry-reliability.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireV21 = process.env.PARTBENCH_REQUIRE_V21 === "1";
const timeoutMs = Number(
  process.env.PARTBENCH_V20_BROWSER_TIMEOUT_MS ??
    (requireV21 ? 120_000 : 45_000)
);
const browserExecutable = findBrowserExecutable();
if (!browserExecutable) {
  throw new Error(
    "No Chromium-compatible browser was found. Set PARTBENCH_SMOKE_BROWSER."
  );
}

const profileDirectory = join(
  repositoryRoot,
  ".metrics",
  `chrome-profile-v20-agent-${process.pid}-${Date.now()}`
);
let browserProcess;
let browserClient;
let browserLease;
let mcp;

try {
  await mkdir(dirname(profileDirectory), { recursive: true });
  browserLease = await acquireBrowserSmokeLease({
    lockPath: join(repositoryRoot, ".metrics", "browser-smoke.lock")
  });
  mcp = await startMcpProcess();
  const remoteDebuggingPort = await getAvailablePort();
  browserProcess = spawn(
    browserExecutable,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-default-browser-check",
      "--no-first-run",
      ...(isTruthy(process.env.PARTBENCH_SMOKE_BROWSER_NO_SANDBOX)
        ? ["--no-sandbox"]
        : []),
      `--remote-debugging-port=${remoteDebuggingPort}`,
      `--user-data-dir=${profileDirectory}`,
      "about:blank"
    ],
    { stdio: "ignore" }
  );
  browserClient = (await connectToBrowser(remoteDebuggingPort)).client;
  const result = await runWorkflow(browserClient, mcp);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browserClient?.close().catch(() => {});
  await stopBrowserProcess(browserProcess, 2_000).catch(() => {});
  await mcp?.close().catch(() => {});
  await rm(profileDirectory, { force: true, recursive: true }).catch(() => {});
  await browserLease?.release().catch(() => {});
}

async function runWorkflow(client, mcpClient) {
  const checks = [];
  const browserErrors = [];
  const target = await client.send("Target.createTarget", {
    url: "about:blank"
  });
  const { sessionId } = await client.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true
  });

  client.on("Runtime.exceptionThrown", (params, context) => {
    if (context.sessionId !== sessionId) return;
    browserErrors.push(
      params.exceptionDetails?.exception?.description ??
        params.exceptionDetails?.text ??
        "Unknown browser exception"
    );
  });
  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Page.enable", {}, sessionId);
  await client.send(
    "Page.addScriptToEvaluateOnNewDocument",
    {
      source: `
        Object.defineProperty(window, "showOpenFilePicker", {
          configurable: true,
          value: undefined
        });
        Object.defineProperty(window, "showSaveFilePicker", {
          configurable: true,
          value: undefined
        });
        window.__partbenchV20Downloads = [];
        window.__partbenchV21Base64Calls = 0;
        window.__partbenchV21RevokedUrls = 0;
        const nativeAtob = window.atob.bind(window);
        const nativeBtoa = window.btoa.bind(window);
        window.atob = (...args) => {
          window.__partbenchV21Base64Calls += 1;
          return nativeAtob(...args);
        };
        window.btoa = (...args) => {
          window.__partbenchV21Base64Calls += 1;
          return nativeBtoa(...args);
        };
        const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
        const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = (value) => {
          if (value instanceof Blob) window.__partbenchV20Downloads.push(value);
          return nativeCreateObjectURL(value);
        };
        URL.revokeObjectURL = (value) => {
          window.__partbenchV21RevokedUrls += 1;
          return nativeRevokeObjectURL(value);
        };
      `
    },
    sessionId
  );
  await client.send(
    "Emulation.setDeviceMetricsOverride",
    { width: 1800, height: 1100, deviceScaleFactor: 1, mobile: false },
    sessionId
  );
  await client.send("Page.navigate", { url: mcpClient.launchUrl }, sessionId);

  const browser = createBrowserDriver(client, sessionId, timeoutMs);
  await browser.waitFor(
    `document.querySelector('[aria-label="Partbench document header"]')`,
    "production Partbench shell"
  );
  await browser.clickText('[aria-label="Workbench mode"] button', "Project");
  await browser.clickText('[aria-label="Project pages"] button', "Files");
  await browser.waitFor(
    `document.querySelector('.pb-project-mode-workspace')`,
    "Project Files page"
  );
  await browser.evaluate(`window.__partbenchV20Downloads.length = 0`);
  await browser.clickText(".pb-project-mode-workspace button", "Save as");
  await browser.waitFor(
    `window.__partbenchV20Downloads.length === 1 && document.body.textContent.includes('Downloaded .wcad package')`,
    "initial clean save"
  );
  await browser.waitFor(
    `document.querySelector('[aria-label="All changes saved in this browser"]')`,
    "clean initial file state"
  );

  await browser.clickText('[aria-label="Project pages"] button', "Agent");
  await browser.waitFor(
    `document.querySelector('.pb-project-mode-workspace')?.textContent.includes('Connected')`,
    "connected Agent page"
  );

  const listed = await mcpClient.request("tools/list", {});
  assert(
    listed.result?.tools?.some((tool) => tool.name === "cad.get_selection"),
    "tools/list must remain local and expose cad.get_selection"
  );
  const initialSelection = content(
    await mcpClient.callTool("cad.get_selection")
  );
  assert(
    initialSelection.selection?.kind === "none",
    "initial selection is none"
  );
  const initialIdentity = initialSelection.sourceIdentity;
  checks.push("same live project and selection identity");

  const invalidManual = content(
    await mcpClient.callTool("cad.batch", {
      batch: boxBatch("invalid-manual", 0, "commit")
    })
  );
  assert(
    !invalidManual.ok,
    "invalid manual commit must fail without a proposal"
  );
  await browser.waitFor(
    `!document.querySelector('.pb-project-agent-proposal')`,
    "no invalid proposal"
  );

  const rejectedCall = mcpClient.callTool("cad.batch", {
    allowCommit: false,
    batch: featureBatch()
  });
  await browser.waitFor(
    `document.querySelector('.pb-project-agent-proposal')?.textContent.includes('v20-feature')`,
    "manual feature proposal"
  );
  const pendingSelection = content(
    await mcpClient.callTool("cad.get_selection")
  );
  assertIdentity(
    pendingSelection.sourceIdentity,
    initialIdentity,
    "pending query"
  );
  const pendingDryRun = content(
    await mcpClient.callTool("cad.batch", {
      batch: boxBatch("pending-dry-run", 1, "dryRun")
    })
  );
  assert(
    pendingDryRun.ok && pendingDryRun.mode === "dryRun",
    "dry-run while pending"
  );
  const busy = content(
    await mcpClient.callTool("cad.batch", {
      batch: boxBatch("busy-box", 1, "commit")
    })
  );
  assert(
    busy.error?.code === "AGENT_APPROVAL_BUSY",
    "second commit must be busy"
  );
  await browser.clickText(".pb-project-agent-proposal button", "Reject");
  const rejected = content(await rejectedCall);
  assert(rejected.error?.code === "AGENT_COMMIT_REJECTED", "manual rejection");
  const afterReject = content(await mcpClient.callTool("cad.get_selection"));
  assertIdentity(
    afterReject.sourceIdentity,
    initialIdentity,
    "rejected proposal"
  );
  checks.push("manual reject, busy, query, and dry-run matrix");

  const approvedCall = mcpClient.callTool("cad.batch", {
    batch: featureBatch()
  });
  await browser.waitFor(
    `document.querySelector('.pb-project-agent-proposal')`,
    "manual approval proposal"
  );
  await browser.clickText(".pb-project-agent-proposal button", "Approve");
  const approved = content(await approvedCall);
  assert(approved.ok && approved.transactionId, "manual approval commit");
  const afterApprove = content(await mcpClient.callTool("cad.get_selection"));
  assert(
    afterApprove.sourceIdentity.sha256 !== initialIdentity.sha256,
    "approval must change source identity"
  );
  await browser.waitFor(
    `document.querySelector('[aria-label="Unsaved changes"]')`,
    "agent commit dirty state"
  );
  await browser.clickText('[aria-label="Project pages"] button', "History");
  await browser.waitFor(
    `document.querySelector('.pb-project-history-list')?.textContent.includes('MCP Client')`,
    "agent audit in History"
  );
  const historyAfterApprove = content(
    await mcpClient.callTool("cad.transaction_history")
  );
  assert(
    historyAfterApprove.transactions.some(
      (transaction) =>
        transaction.actor?.type === "agent" &&
        transaction.audit?.source === "mcp" &&
        transaction.audit?.toolName === "cad.batch"
    ),
    "history must retain agent and MCP audit metadata"
  );
  checks.push("approved feature, dirty state, and audited history");

  const staleCall = mcpClient.callTool("cad.batch", {
    batch: boxBatch("stale-box", 1, "commit")
  });
  await browser.clickText('[aria-label="Project pages"] button', "Agent");
  await browser.waitFor(
    `document.querySelector('.pb-project-agent-proposal')`,
    "proposal before human undo"
  );
  await browser.clickElement('[aria-label="Undo"]');
  const stale = content(await staleCall);
  assert(
    stale.error?.code === "AGENT_PROPOSAL_STALE",
    "human undo stales proposal"
  );
  const afterUndo = content(await mcpClient.callTool("cad.get_selection"));
  const afterUndoSummary = content(
    await mcpClient.callTool("cad.project_summary")
  );
  assert(
    afterUndo.sourceIdentity.sha256 !== afterApprove.sourceIdentity.sha256 &&
      afterUndoSummary.structure.featureCount === 0 &&
      afterUndoSummary.structure.bodyCount === 0,
    "undo must restore the prior model while recording its command-history change"
  );
  checks.push("human edit staleness and undo model restoration");

  const dialogAccepted = browser.acceptNextDialog();
  await browser.clickElement('input[value="approveAll"]');
  await dialogAccepted;
  await browser.waitFor(
    `document.querySelector('input[value="approveAll"]')?.checked`,
    "Approve all mode"
  );
  const firstImmediate = content(
    await mcpClient.callTool("cad.batch", {
      allowCommit: false,
      batch: boxBatch("approve-all-box", 2, "commit")
    })
  );
  const secondImmediate = content(
    await mcpClient.callTool("cad.batch", {
      batch: cylinderBatch("approve-all-cylinder")
    })
  );
  assert(
    firstImmediate.ok && secondImmediate.ok,
    "Approve all immediate commits"
  );
  const approveAllDryRun = content(
    await mcpClient.callTool("cad.batch", {
      batch: boxBatch("approve-all-preview", 1, "dryRun")
    })
  );
  assert(
    approveAllDryRun.ok && approveAllDryRun.mode === "dryRun",
    "Approve all dry-run"
  );
  const invalidApproveAll = content(
    await mcpClient.callTool("cad.batch", {
      batch: boxBatch("invalid-approve-all", 0, "commit")
    })
  );
  assert(!invalidApproveAll.ok, "invalid Approve all commit must fail");
  const summary = content(await mcpClient.callTool("cad.project_summary"));
  assert(
    summary.objectCount === 2,
    "dry-run and invalid commit must not mutate"
  );
  checks.push("Approve all matrix and unchanged explicit dry-run");

  await browser.clickText('[aria-label="Workbench mode"] button', "Solid");
  await browser.waitFor(
    `document.querySelector('[data-tree-select^="feature:"]') && document.querySelector('[aria-label="3D scene viewport"]')`,
    "rebuilt viewport and object tree"
  );
  await browser.clickElement('[data-tree-select^="feature:"]');
  const selectedObject = content(await mcpClient.callTool("cad.get_selection"));
  assert(
    selectedObject.selection?.kind === "body" &&
      selectedObject.selection.bodyId,
    "semantic body selection"
  );
  const finalIdentity = selectedObject.sourceIdentity;
  checks.push("viewport rebuild and semantic body selection");

  await browser.clickText('[aria-label="Workbench mode"] button', "Project");
  if (requireV21) {
    await browser.clickText('[aria-label="Project pages"] button', "Export");
    await browser.waitFor(
      `[...document.querySelectorAll('.pb-project-mode-workspace button')].some((button) => button.textContent.trim() === 'Export all bodies' && !button.disabled && button.getAttribute('aria-disabled') !== 'true')`,
      "ready V21 selected-body export"
    );
    const exactPlan = content(
      await mcpClient.callTool("cad.project_export_exact", {
        format: "step",
        bodyIds: [selectedObject.selection.bodyId]
      })
    );
    assert(
      exactPlan.available &&
      exactPlan.plan?.schema === "AP242DIS" &&
        exactPlan.plan?.orderedBodyIds?.[0] === selectedObject.selection.bodyId,
      "connected MCP exact plan must match the selected browser body"
    );
    await browser.evaluate(`window.__partbenchV20Downloads.length = 0`);
    await browser.clickText(
      ".pb-project-mode-workspace button",
      "Export selected body"
    );
    await browser.waitFor(
      `window.__partbenchV20Downloads.length === 1 && document.body.textContent.includes('Downloaded partbench-export.step')`,
      "V21 exact STEP download"
    );
    const stepDownload = await browser.evaluate(`(async () => {
      const blob = window.__partbenchV20Downloads[0];
      const text = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 32));
      return {
        type: blob.type,
        size: blob.size,
        header: text,
        base64Calls: window.__partbenchV21Base64Calls,
        revokedUrls: window.__partbenchV21RevokedUrls
      };
    })()`);
    assert(
      stepDownload.type === "model/step" &&
        stepDownload.size > 1_000 &&
        stepDownload.header.includes("ISO-10303-21") &&
        stepDownload.base64Calls === 0 &&
        stepDownload.revokedUrls >= 1,
      "V21 browser download must be direct STEP Blob bytes with URL cleanup and no base64"
    );
    checks.push("V21 selected-body AP242 plan and direct browser download");
  }
  await browser.clickText('[aria-label="Project pages"] button', "Files");
  await browser.evaluate(`window.__partbenchV20Downloads.length = 0`);
  await browser.clickText(".pb-project-mode-workspace button", "Save as");
  await browser.waitFor(
    `window.__partbenchV20Downloads.length === 1 && document.body.textContent.includes('Downloaded .wcad package')`,
    "final .wcad save"
  );
  const wcadBytes = await browser.evaluate(`(async () =>
    Array.from(new Uint8Array(await window.__partbenchV20Downloads[0].arrayBuffer()))
  )()`);
  await browser.evaluate(`(() => {
    const input = document.querySelector('input[type="file"][accept*=".wcad"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing .wcad input');
    const transfer = new DataTransfer();
    transfer.items.add(new File(
      [Uint8Array.from(${JSON.stringify(wcadBytes)})],
      'v20-agent-roundtrip.wcad',
      { type: 'application/vnd.partbench.wcad' }
    ));
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: transfer.files
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await browser.waitFor(
    `document.body.textContent.includes('Opened v20-agent-roundtrip.wcad')`,
    ".wcad reopen"
  );
  const reopenedSelection = content(
    await mcpClient.callTool("cad.get_selection")
  );
  assertIdentity(
    reopenedSelection.sourceIdentity,
    finalIdentity,
    ".wcad round-trip"
  );
  const reopenedHistory = content(
    await mcpClient.callTool("cad.transaction_history")
  );
  assert(
    reopenedHistory.transactions.filter(
      (transaction) => transaction.actor?.type === "agent"
    ).length >= 2,
    ".wcad must preserve agent history"
  );
  checks.push(".wcad save/open preserves source and agent audit history");

  assert(
    browserErrors.length === 0,
    `browser exceptions: ${browserErrors.join(" | ")}`
  );
  return {
    version: "partbench.v20-live-agent-workflow.v1",
    ok: true,
    checks,
    sourceIdentity: finalIdentity,
    wcadBytes: wcadBytes.length
  };
}

function featureBatch() {
  return {
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "sketch.create",
        id: "v20-sketch",
        name: "V20 profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v20-sketch",
        id: "v20-rectangle",
        center: [0, 0],
        width: 8,
        height: 6
      },
      {
        op: "feature.extrude",
        id: "v20-feature",
        bodyId: "v20-body",
        sketchId: "v20-sketch",
        entityId: "v20-rectangle",
        depth: 4
      }
    ]
  };
}

function boxBatch(id, size, mode) {
  return {
    version: "cadops.v1",
    mode,
    ops: [
      {
        op: "scene.createBox",
        id,
        dimensions: { width: size, height: size, depth: size }
      }
    ]
  };
}

function cylinderBatch(id) {
  return {
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "scene.createCylinder",
        id,
        dimensions: { radius: 1, height: 3 }
      }
    ]
  };
}

async function startMcpProcess() {
  const child = spawn(
    process.execPath,
    [join(repositoryRoot, "packages/mcp-stdio-server/dist/stdio.js")],
    {
      cwd: repositoryRoot,
      env: { ...process.env, PARTBENCH_SKIP_BROWSER_OPEN: "1" },
      stdio: ["pipe", "pipe", "pipe"]
    }
  );
  let stderr = "";
  let stdout = "";
  let nextId = 1;
  const pending = new Map();
  const launchUrl = await new Promise((resolveUrl, rejectUrl) => {
    const timeout = setTimeout(
      () =>
        rejectUrl(new Error(`Timed out starting stdio launcher. ${stderr}`)),
      timeoutMs
    );
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const match =
        /Partbench local agent: (http:\/\/127\.0\.0\.1:\d+\/#agentSession=[A-Za-z0-9_-]{43})/.exec(
          stderr
        );
      if (match?.[1]) {
        clearTimeout(timeout);
        resolveUrl(match[1]);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      rejectUrl(new Error(`stdio launcher exited with ${code}. ${stderr}`));
    });
  });

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    let newline = stdout.indexOf("\n");
    while (newline >= 0) {
      const line = stdout.slice(0, newline).trim();
      stdout = stdout.slice(newline + 1);
      if (line) {
        const response = JSON.parse(line);
        const request = pending.get(response.id);
        pending.delete(response.id);
        request?.resolve(response);
      }
      newline = stdout.indexOf("\n");
    }
  });
  child.once("exit", (code) => {
    for (const request of pending.values()) {
      request.reject(
        new Error(`stdio launcher exited with ${code}. ${stderr}`)
      );
    }
    pending.clear();
  });

  function request(method, params) {
    const id = nextId++;
    const response = new Promise((resolveResponse, rejectResponse) => {
      pending.set(id, { resolve: resolveResponse, reject: rejectResponse });
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`
    );
    return response;
  }

  return {
    child,
    launchUrl,
    request,
    callTool(name, args) {
      return request("tools/call", {
        name,
        ...(args === undefined ? {} : { arguments: args })
      });
    },
    async close() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.stdin.end();
      await Promise.race([
        new Promise((resolveExit) => child.once("exit", resolveExit)),
        new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2_000))
      ]);
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGTERM");
    }
  };
}

function createBrowserDriver(client, sessionId, workflowTimeoutMs) {
  let acceptDialog;
  client.on("Page.javascriptDialogOpening", (_params, context) => {
    if (context.sessionId !== sessionId || !acceptDialog) return;
    const resolveDialog = acceptDialog;
    acceptDialog = undefined;
    void client
      .send("Page.handleJavaScriptDialog", { accept: true }, sessionId)
      .then(resolveDialog);
  });

  async function evaluate(expression) {
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
    return response.result?.value;
  }

  async function waitFor(expression, label) {
    const deadline = Date.now() + workflowTimeoutMs;
    while (Date.now() < deadline) {
      if (await evaluate(`Boolean(${expression})`).catch(() => false)) return;
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
    const text = await evaluate(
      `document.body?.innerText?.replace(/\\s+/g, ' ').slice(0, 1000) ?? ''`
    ).catch(() => "");
    throw new Error(`Timed out waiting for ${label}. Page: ${text}`);
  }

  async function clickElement(selector, text) {
    const point = await evaluate(`(() => {
      const candidates = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const element = ${
        text === undefined
          ? "candidates[0]"
          : `candidates.find((candidate) => candidate.textContent.trim() === ${JSON.stringify(text)})`
      };
      if (!(element instanceof Element)) return undefined;
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    if (!point) throw new Error(`Could not find ${text ?? selector}.`);
    await client.send(
      "Input.dispatchMouseEvent",
      {
        type: "mousePressed",
        ...point,
        button: "left",
        buttons: 1,
        clickCount: 1
      },
      sessionId
    );
    await client.send(
      "Input.dispatchMouseEvent",
      {
        type: "mouseReleased",
        ...point,
        button: "left",
        buttons: 0,
        clickCount: 1
      },
      sessionId
    );
  }

  return {
    evaluate,
    waitFor,
    clickElement,
    clickText: (selector, text) => clickElement(selector, text),
    acceptNextDialog: () =>
      new Promise((resolveDialog) => {
        acceptDialog = resolveDialog;
      })
  };
}

function content(response) {
  if (response.error) throw new Error(JSON.stringify(response.error));
  const value = response.result?.structuredContent;
  if (!value)
    throw new Error(
      `Missing MCP structured content: ${JSON.stringify(response)}`
    );
  return value;
}

function assertIdentity(actual, expected, label) {
  assert(
    actual?.algorithm === expected?.algorithm &&
      actual?.sha256 === expected?.sha256,
    `${label} source identity mismatch`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isTruthy(value) {
  return value === "1" || value === "true";
}
