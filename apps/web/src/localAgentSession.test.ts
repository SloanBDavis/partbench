import {
  AsyncCadCommandExecutor,
  CadEngine,
  SnapshotCadCommandWorker
} from "@web-cad/cad-core";
import type { CadOpsAgentRequest } from "@web-cad/agent-adapter";
import { describe, expect, it, vi } from "vitest";
import {
  LocalAgentSession,
  createCurrentAgentSelection,
  createCurrentAgentSelectionForEngine,
  readLocalAgentSessionToken
} from "./localAgentSession";

describe("local agent selection", () => {
  it("uses the documented semantic precedence and excludes axis internals", () => {
    expect(
      createCurrentAgentSelection({
        namedReferenceName: "Top",
        generatedReference: {
          bodyId: "body-1",
          stableId: "face-1",
          expectedKind: "face"
        },
        sketch: { sketchId: "sketch-1", entityId: "line-1" },
        bodyId: "body-1",
        objectId: "object-1"
      })
    ).toEqual({ kind: "namedReference", name: "Top" });
    expect(
      createCurrentAgentSelection({
        generatedReference: {
          bodyId: "body-1",
          stableId: "axis-1",
          expectedKind: "axis"
        }
      })
    ).toEqual({
      kind: "generatedReference",
      bodyId: "body-1",
      stableId: "axis-1"
    });
    expect(
      createCurrentAgentSelection({
        sketch: { sketchId: "sketch-1", entityId: "line-1" },
        bodyId: "body-1"
      })
    ).toEqual({
      kind: "sketchEntity",
      sketchId: "sketch-1",
      entityId: "line-1"
    });
    expect(createCurrentAgentSelection({ bodyId: "body-1" })).toEqual({
      kind: "body",
      bodyId: "body-1"
    });
    expect(createCurrentAgentSelection({})).toEqual({ kind: "none" });
  });

  it("accepts only the 256-bit launcher token fragment", () => {
    const token = "a".repeat(43);
    expect(readLocalAgentSessionToken(`#agentSession=${token}`)).toBe(token);
    expect(
      readLocalAgentSessionToken(`#agentSession=${token}x`)
    ).toBeUndefined();
    expect(
      readLocalAgentSessionToken("#agentSession=not/a/token")
    ).toBeUndefined();
  });

  it("drops deleted sketch and entity IDs from the reported selection", () => {
    const engine = new CadEngine();
    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.create",
          id: "sketch-1",
          name: "Selection sketch",
          plane: "XY"
        },
        {
          op: "sketch.addLine",
          sketchId: "sketch-1",
          id: "line-1",
          start: [0, 0],
          end: [1, 0]
        }
      ]
    });
    const selection = {
      sketch: { sketchId: "sketch-1", entityId: "line-1" }
    };
    expect(createCurrentAgentSelectionForEngine(engine, selection)).toEqual({
      kind: "sketchEntity",
      sketchId: "sketch-1",
      entityId: "line-1"
    });

    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.deleteEntity",
          sketchId: "sketch-1",
          entityId: "line-1"
        }
      ]
    });
    expect(createCurrentAgentSelectionForEngine(engine, selection)).toEqual({
      kind: "sketch",
      sketchId: "sketch-1"
    });

    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [{ op: "sketch.delete", id: "sketch-1" }]
    });
    expect(createCurrentAgentSelectionForEngine(engine, selection)).toEqual({
      kind: "none"
    });
  });
});

describe("local agent approval", () => {
  it("previews and rejects a manual commit without mutation", async () => {
    const fixture = createSession();
    const result = fixture.session.execute(createBoxRequest("reject-box"));
    await waitForProposal(fixture.session);

    expect(fixture.engine.getDocument().objects.size).toBe(0);
    expect(
      fixture.session.getSnapshot().proposal?.review.operations[0]?.label
    ).toBe("Create box reject-box");
    fixture.session.reject();

    await expect(result).resolves.toMatchObject({
      ok: false,
      error: { code: "AGENT_COMMIT_REJECTED" }
    });
    expect(fixture.engine.getDocument().objects.size).toBe(0);
    expect(fixture.publishCommit).not.toHaveBeenCalled();
  });

  it("approves through the shared executor and publishes one commit", async () => {
    const fixture = createSession();
    const result = fixture.session.execute(createBoxRequest("approved-box"));
    await waitForProposal(fixture.session);

    await fixture.session.approve();

    await expect(result).resolves.toMatchObject({
      ok: true,
      transactionId: "txn_1",
      createdIds: ["approved-box"]
    });
    expect(fixture.engine.getDocument().objects.has("approved-box")).toBe(true);
    expect(fixture.publishCommit).toHaveBeenCalledTimes(1);
  });

  it("keeps queries and dry-runs available while returning busy to another commit", async () => {
    const fixture = createSession();
    const pending = fixture.session.execute(createBoxRequest("pending-box"));
    await waitForProposal(fixture.session);

    await expect(
      fixture.session.execute(createBoxRequest("busy-box"))
    ).resolves.toMatchObject({ error: { code: "AGENT_APPROVAL_BUSY" } });
    await expect(
      fixture.session.execute({
        ...createBoxRequest("preview-box"),
        batch: { ...createBoxRequest("preview-box").batch, mode: "dryRun" }
      })
    ).resolves.toMatchObject({ ok: true, mode: "dryRun" });
    await expect(
      fixture.session.query({
        requestId: "summary",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: { version: "cadops.v1", query: { query: "project.summary" } }
      })
    ).resolves.toMatchObject({ ok: true, objectCount: 0 });

    fixture.session.reject();
    await pending;
  });

  it("reserves manual approval while the first preview is still running", async () => {
    const fixture = createSession(10);
    const pending = fixture.session.execute(createBoxRequest("first-box"));

    await expect(
      fixture.session.execute(createBoxRequest("second-box"))
    ).resolves.toMatchObject({ error: { code: "AGENT_APPROVAL_BUSY" } });
    await waitForProposal(fixture.session);
    fixture.session.reject();
    await pending;
  });

  it("settles a proposal stale after a human source change", async () => {
    const fixture = createSession();
    const pending = fixture.session.execute(createBoxRequest("stale-box"));
    await waitForProposal(fixture.session);
    await fixture.executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          id: "human-box",
          dimensions: { width: 2, height: 2, depth: 2 }
        }
      ]
    });

    fixture.session.refreshSourceIdentity();

    await expect(pending).resolves.toMatchObject({
      error: { code: "AGENT_PROPOSAL_STALE" }
    });
    expect(fixture.engine.getDocument().objects.has("stale-box")).toBe(false);
  });

  it("does not approve behind an already queued human edit", async () => {
    const fixture = createSession();
    const pending = fixture.session.execute(createBoxRequest("raced-box"));
    await waitForProposal(fixture.session);

    const humanCommit = fixture.executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          id: "queued-human-box",
          dimensions: { width: 2, height: 2, depth: 2 }
        }
      ]
    });
    const approval = fixture.session.approve();

    await humanCommit;
    await approval;
    await expect(pending).resolves.toMatchObject({
      error: { code: "AGENT_PROPOSAL_STALE" }
    });
    expect(fixture.engine.getDocument().objects.has("raced-box")).toBe(false);
  });

  it("rejects an approved commit when source changes during worker validation", async () => {
    const fixture = createSession(10);
    const pending = fixture.session.execute(
      createBoxRequest("worker-race-box")
    );
    await waitForProposal(fixture.session);

    const approval = fixture.session.approve();
    fixture.engine.loadProject(fixture.engine.exportProject());
    await approval;

    await expect(pending).resolves.toMatchObject({
      error: { code: "AGENT_PROPOSAL_STALE" }
    });
    expect(fixture.engine.getDocument().objects.has("worker-race-box")).toBe(
      false
    );
  });

  it("approveAll commits immediately but preserves explicit dry-runs", async () => {
    const fixture = createSession();
    expect(fixture.session.setApprovalMode("approveAll")).toBe(true);

    await expect(
      fixture.session.execute(createBoxRequest("immediate-box"))
    ).resolves.toMatchObject({ ok: true, mode: "commit" });
    await expect(
      fixture.session.execute({
        ...createBoxRequest("dry-box"),
        batch: { ...createBoxRequest("dry-box").batch, mode: "dryRun" }
      })
    ).resolves.toMatchObject({ ok: true, mode: "dryRun" });

    expect(fixture.engine.getDocument().objects.has("immediate-box")).toBe(
      true
    );
    expect(fixture.engine.getDocument().objects.has("dry-box")).toBe(false);
    expect(fixture.publishCommit).toHaveBeenCalledTimes(1);
  });

  it("queues concurrent approveAll commits against the current source", async () => {
    const fixture = createSession(5);
    fixture.session.setApprovalMode("approveAll");

    await expect(
      Promise.all([
        fixture.session.execute(createBoxRequest("concurrent-a")),
        fixture.session.execute(createBoxRequest("concurrent-b"))
      ])
    ).resolves.toEqual([
      expect.objectContaining({ ok: true, mode: "commit" }),
      expect.objectContaining({ ok: true, mode: "commit" })
    ]);
    expect(fixture.engine.getDocument().objects.size).toBe(2);
  });

  it("returns validation failures without proposing or committing in either mode", async () => {
    const request = createBoxRequest("invalid-box");
    const invalid = {
      ...request,
      batch: {
        ...request.batch,
        ops: [
          {
            op: "scene.createBox" as const,
            id: "invalid-box",
            dimensions: { width: 0, height: 1, depth: 1 }
          }
        ]
      }
    };
    const manual = createSession();
    await expect(manual.session.execute(invalid)).resolves.toMatchObject({
      ok: false
    });
    expect(manual.session.getSnapshot().proposal).toBeUndefined();

    const approveAll = createSession();
    approveAll.session.setApprovalMode("approveAll");
    await expect(approveAll.session.execute(invalid)).resolves.toMatchObject({
      ok: false
    });
    expect(approveAll.engine.getDocument().objects.size).toBe(0);
  });

  it("cancels an approval when the browser session ends during validation", async () => {
    vi.stubGlobal("window", { removeEventListener: vi.fn() });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true }))
    );
    try {
      const fixture = createSession(10);
      const pending = fixture.session.execute(
        createBoxRequest("disconnected-box")
      );
      await waitForProposal(fixture.session);
      const approval = fixture.session.approve();
      await fixture.session.dispose();
      await approval;

      await expect(pending).resolves.toMatchObject({
        error: { code: "AGENT_SESSION_DISCONNECTED" }
      });
      expect(fixture.engine.getDocument().objects.has("disconnected-box")).toBe(
        false
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function createSession(workerDelayMs = 0) {
  const engine = new CadEngine();
  const executor = new AsyncCadCommandExecutor(
    engine,
    new SnapshotCadCommandWorker({ delayMs: workerDelayMs })
  );
  const publishCommit = vi.fn(async () => undefined);
  const session = new LocalAgentSession({
    token: "a".repeat(43),
    engine,
    executor,
    readSelection: () => ({}),
    publishCommit
  });
  return { engine, executor, publishCommit, session };
}

function createBoxRequest(id: string): CadOpsAgentRequest {
  return {
    requestId: `request-${id}`,
    adapterVersion: "web-cad.agent-adapter.v1",
    actor: { type: "agent", id: "mcp", name: "MCP Client" },
    permissions: { allowCommit: false },
    source: { source: "mcp", toolName: "cad.batch" },
    batch: {
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          id,
          dimensions: { width: 1, height: 1, depth: 1 }
        }
      ]
    }
  };
}

async function waitForProposal(session: LocalAgentSession): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (session.getSnapshot().proposal) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for the manual agent proposal.");
}
