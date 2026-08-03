import {
  AsyncCadCommandExecutor,
  CadEngine,
  createCadProjectSourceIdentity,
  SnapshotCadCommandWorker
} from "@web-cad/cad-core";
import type {
  CadAgentExactExportProposal,
  CadAgentExactExportRequest,
  CadAgentExactExportResult,
  CadOpsAgentCurrentExactEvidence,
  CadOpsAgentRequest
} from "@web-cad/agent-adapter";
import { describe, expect, it, vi } from "vitest";
import {
  LocalAgentSession,
  createCurrentAgentSelection,
  createCurrentAgentSelectionForEngine,
  readLocalAgentSessionToken,
  type LocalAgentCommitPreflight
} from "./localAgentSession";
import { isExactExportPlanCurrent } from "./projectExactStepExport";

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
  it("shares the manual proposal slot across commits and browser exports", async () => {
    const fixture = createExactExportSession();
    const request = createExactExportRequest("manual-export");
    const result = fixture.session.requestExactExport(request);
    await waitForProposal(fixture.session);

    expect(fixture.session.getSnapshot().proposal).toMatchObject({
      requestId: request.requestId,
      plan: { orderedBodyIds: ["body-agent-export"] }
    });
    await expect(
      fixture.session.execute(createBoxRequest("busy-while-export-pending"))
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "AGENT_APPROVAL_BUSY" }
    });
    await fixture.session.approve();
    await expect(result).resolves.toMatchObject({
      status: "downloadRequested",
      selectedBodyIds: ["body-agent-export"]
    });
    expect(fixture.executeExactExport).toHaveBeenCalledTimes(1);
  });

  it("rejects manual exports and executes approveAll without a proposal", async () => {
    const manual = createExactExportSession();
    const rejected = manual.session.requestExactExport(
      createExactExportRequest("rejected-export")
    );
    await waitForProposal(manual.session);
    manual.session.reject();
    await expect(rejected).resolves.toMatchObject({ status: "rejected" });
    expect(manual.executeExactExport).not.toHaveBeenCalled();

    const automatic = createExactExportSession();
    automatic.session.setApprovalMode("approveAll");
    await expect(
      automatic.session.requestExactExport(
        createExactExportRequest("approve-all-export")
      )
    ).resolves.toMatchObject({ status: "downloadRequested" });
    expect(automatic.session.getSnapshot().proposal).toBeUndefined();
    expect(automatic.executeExactExport).toHaveBeenCalledTimes(1);
  });

  it("invalidates a stale manual export before browser execution", async () => {
    const fixture = createExactExportSession();
    const result = fixture.session.requestExactExport(
      createExactExportRequest("stale-export")
    );
    await waitForProposal(fixture.session);
    fixture.engine.apply({
      op: "scene.createBox",
      id: "human-source-change",
      dimensions: { width: 1, height: 1, depth: 1 }
    });
    fixture.session.refreshSourceIdentity();

    await expect(result).resolves.toMatchObject({
      ok: false,
      error: { code: "AGENT_PROPOSAL_STALE" }
    });
    expect(fixture.executeExactExport).not.toHaveBeenCalled();
  });

  it("settles manual and approve-all exports when the browser executor throws", async () => {
    const manual = createExactExportSession();
    manual.executeExactExport.mockRejectedValueOnce(new Error("writer fault"));
    const pending = manual.session.requestExactExport(
      createExactExportRequest("manual-writer-fault")
    );
    await waitForProposal(manual.session);
    await manual.session.approve();
    await expect(pending).resolves.toMatchObject({
      status: "failed",
      diagnostics: [{ code: "EXPORT_STEP_TRANSFER_FAILED" }]
    });
    expect(manual.session.getSnapshot()).toMatchObject({ approving: false });
    expect(manual.session.getSnapshot().proposal).toBeUndefined();

    const automatic = createExactExportSession();
    automatic.executeExactExport.mockRejectedValueOnce(
      new Error("writer fault")
    );
    automatic.session.setApprovalMode("approveAll");
    await expect(
      automatic.session.requestExactExport(
        createExactExportRequest("automatic-writer-fault")
      )
    ).resolves.toMatchObject({
      status: "failed",
      diagnostics: [{ code: "EXPORT_STEP_TRANSFER_FAILED" }]
    });
  });

  it("previews and rejects a manual commit without mutation", async () => {
    const fixture = createSession();
    const result = fixture.session.execute(createBoxRequest("reject-box"));
    await waitForProposal(fixture.session);

    expect(fixture.engine.getDocument().objects.size).toBe(0);
    const proposal = fixture.session.getSnapshot().proposal;
    expect(
      proposal && "review" in proposal
        ? proposal.review.operations[0]?.label
        : undefined
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

  it("preflights manual and approveAll commits once at their captured source epoch", async () => {
    const manualPreflight = vi.fn(async () => true);
    const manual = createSession(0, undefined, manualPreflight);
    const manualRequest = createBoxRequest("manual-preflight-box");
    const manualResult = manual.session.execute(manualRequest);
    await waitForProposal(manual.session);

    await manual.session.approve();

    await expect(manualResult).resolves.toMatchObject({ ok: true });
    expect(manualPreflight).toHaveBeenCalledTimes(1);
    expect(manualPreflight).toHaveBeenCalledWith(manualRequest, 0);
    expect(manual.publishCommit).toHaveBeenCalledTimes(1);

    const approveAllPreflight = vi.fn(async () => true);
    const approveAll = createSession(0, undefined, approveAllPreflight);
    approveAll.session.setApprovalMode("approveAll");
    const approveAllRequest = createBoxRequest("approve-all-preflight-box");

    await expect(
      approveAll.session.execute(approveAllRequest)
    ).resolves.toMatchObject({ ok: true });
    expect(approveAllPreflight).toHaveBeenCalledTimes(1);
    expect(approveAllPreflight).toHaveBeenCalledWith(approveAllRequest, 0);
    expect(approveAll.publishCommit).toHaveBeenCalledTimes(1);
  });

  it("skips commit preflight for dry-runs", async () => {
    const preflightCommit = vi.fn(async () => true);
    const fixture = createSession(0, undefined, preflightCommit);
    const request = createBoxRequest("preflight-dry-run-box");

    await expect(
      fixture.session.execute({
        ...request,
        batch: { ...request.batch, mode: "dryRun" }
      })
    ).resolves.toMatchObject({ ok: true, mode: "dryRun" });

    expect(preflightCommit).not.toHaveBeenCalled();
    expect(fixture.engine.getDocument().objects.size).toBe(0);
    expect(fixture.publishCommit).not.toHaveBeenCalled();
  });

  it.each([false, undefined])(
    "blocks approveAll commit and publication when preflight returns %s",
    async (preflightResult) => {
      const preflightCommit = vi.fn(async () => preflightResult);
      const fixture = createSession(0, undefined, preflightCommit);
      fixture.session.setApprovalMode("approveAll");

      await expect(
        fixture.session.execute(createBoxRequest("blocked-preflight-box"))
      ).resolves.toMatchObject({
        ok: false,
        error: { code: "AGENT_COMMIT_REJECTED" }
      });

      expect(preflightCommit).toHaveBeenCalledTimes(1);
      expect(fixture.engine.getDocument().objects.size).toBe(0);
      expect(fixture.publishCommit).not.toHaveBeenCalled();
    }
  );

  it("returns the browser exact-preflight diagnostic without calling commit", async () => {
    const fixture = createSession(
      0,
      undefined,
      vi.fn(async () => ({
        ok: false as const,
        message: "Could not apply this hole (HOLE_RESULT_INVALID)."
      }))
    );
    fixture.session.setApprovalMode("approveAll");

    await expect(
      fixture.session.execute(createBoxRequest("geometry-rejected-box"))
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "AGENT_COMMIT_REJECTED",
        message: "Could not apply this hole (HOLE_RESULT_INVALID)."
      }
    });
    expect(fixture.engine.getDocument().objects.size).toBe(0);
    expect(fixture.publishCommit).not.toHaveBeenCalled();
  });

  it("blocks a manual commit when its source changes during preflight", async () => {
    let resolvePreflight: ((accepted: boolean) => void) | undefined;
    const preflightCommit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePreflight = resolve;
        })
    );
    const fixture = createSession(0, undefined, preflightCommit);
    const result = fixture.session.execute(
      createBoxRequest("stale-preflight-box")
    );
    await waitForProposal(fixture.session);

    const approval = fixture.session.approve();
    await waitForCall(preflightCommit);
    fixture.engine.apply({
      op: "scene.createBox",
      id: "human-preflight-box",
      dimensions: { width: 1, height: 1, depth: 1 }
    });
    resolvePreflight?.(true);
    await approval;

    await expect(result).resolves.toMatchObject({
      ok: false,
      error: { code: "AGENT_PROPOSAL_STALE" }
    });
    expect(preflightCommit).toHaveBeenCalledTimes(1);
    expect(
      fixture.engine.getDocument().objects.has("stale-preflight-box")
    ).toBe(false);
    expect(fixture.publishCommit).not.toHaveBeenCalled();
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

  it("reads connected exact evidence without creating an approval proposal", async () => {
    const readCurrentExactEvidence = vi.fn(
      (): CadOpsAgentCurrentExactEvidence => ({
        derivedExactMetadata: [],
        currentExactResults: []
      })
    );
    const fixture = createSession(0, readCurrentExactEvidence);

    await expect(
      fixture.session.query({
        requestId: "exact-readiness",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "project.exportExact", format: "step" }
        }
      })
    ).resolves.toMatchObject({
      ok: true,
      query: "project.exportExact",
      artifactPolicy: {
        artifactBytesReturned: false,
        fileWritesPerformed: false
      }
    });
    expect(readCurrentExactEvidence).toHaveBeenCalledTimes(1);
    expect(fixture.session.getSnapshot().approvalMode).toBe("manualApproval");
    expect(fixture.session.getSnapshot().proposal).toBeUndefined();
    expect(fixture.session.setApprovalMode("approveAll")).toBe(true);
    expect(fixture.session.getSnapshot().approvalMode).toBe("approveAll");
    expect(fixture.session.getSnapshot().proposal).toBeUndefined();
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

  it("stales an existing exact export plan after an approved agent edit", async () => {
    const fixture = createSession();
    fixture.engine.apply({
      op: "scene.createBox",
      id: "agent-edit-box",
      dimensions: { width: 1, height: 2, depth: 3 }
    });
    const topology = fixture.engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "body:agent-edit-box" }
    });
    if (!topology.ok || topology.query !== "body.topology") {
      throw new Error("Expected primitive body topology.");
    }
    const exactExport = fixture.engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "project.exportExact",
        format: "step",
        bodyIds: ["body:agent-edit-box"],
        derivedExactMetadata: [
          {
            bodyId: "body:agent-edit-box",
            sourceIdentitySignature: topology.topology.sourceIdentity.signature,
            status: "ready",
            metadata: {
              source: "kernel-derived",
              confidence: "kernel-derived",
              bounds: {
                min: [0, 0, 0],
                max: [1, 2, 3],
                size: [1, 2, 3],
                center: [0.5, 1, 1.5]
              },
              volume: 6,
              diagnostics: []
            }
          }
        ]
      }
    });
    if (
      !exactExport.ok ||
      exactExport.query !== "project.exportExact" ||
      !exactExport.plan
    ) {
      throw new Error("Expected current exact export plan.");
    }

    const pending = fixture.session.execute({
      ...createBoxRequest("unused"),
      requestId: "request-agent-edit-box",
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.updateBoxDimensions",
            id: "agent-edit-box",
            dimensions: { width: 2, height: 2, depth: 3 }
          }
        ]
      }
    });
    await waitForProposal(fixture.session);
    await fixture.session.approve();
    await expect(pending).resolves.toMatchObject({ ok: true, mode: "commit" });

    expect(isExactExportPlanCurrent(fixture.engine, exactExport.plan)).toBe(
      false
    );
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

  it("blocks commit and publication when the session ends during preflight", async () => {
    vi.stubGlobal("window", { removeEventListener: vi.fn() });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true }))
    );
    try {
      let resolvePreflight: ((accepted: boolean) => void) | undefined;
      const preflightCommit = vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            resolvePreflight = resolve;
          })
      );
      const fixture = createSession(0, undefined, preflightCommit);
      fixture.session.setApprovalMode("approveAll");
      const result = fixture.session.execute(
        createBoxRequest("disconnected-preflight-box")
      );
      await waitForCall(preflightCommit);

      await fixture.session.dispose();
      resolvePreflight?.(true);

      await expect(result).resolves.toMatchObject({
        ok: false,
        error: { code: "AGENT_SESSION_DISCONNECTED" }
      });
      expect(preflightCommit).toHaveBeenCalledTimes(1);
      expect(
        fixture.engine.getDocument().objects.has("disconnected-preflight-box")
      ).toBe(false);
      expect(fixture.publishCommit).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
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

      const approveAll = createSession(10);
      approveAll.session.setApprovalMode("approveAll");
      const immediate = approveAll.session.execute(
        createBoxRequest("disconnected-approve-all-box")
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      await approveAll.session.dispose();
      await expect(immediate).resolves.toMatchObject({
        error: { code: "AGENT_SESSION_DISCONNECTED" }
      });
      expect(
        approveAll.engine
          .getDocument()
          .objects.has("disconnected-approve-all-box")
      ).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function createSession(
  workerDelayMs = 0,
  readCurrentExactEvidence?: () => CadOpsAgentCurrentExactEvidence,
  preflightCommit?: LocalAgentCommitPreflight
) {
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
    ...(readCurrentExactEvidence ? { readCurrentExactEvidence } : {}),
    preflightCommit: preflightCommit ?? (async () => true),
    publishCommit
  });
  return { engine, executor, publishCommit, session };
}

function createExactExportSession() {
  const engine = new CadEngine();
  const executor = new AsyncCadCommandExecutor(
    engine,
    new SnapshotCadCommandWorker()
  );
  const sourceIdentity = createCadProjectSourceIdentity(engine.exportProject());
  const planExactExport = vi.fn(
    (
      request: CadAgentExactExportRequest
    ): {
      readonly status: "proposal";
      readonly proposal: CadAgentExactExportProposal;
    } => ({
      status: "proposal",
      proposal: {
        requestId: request.requestId,
        sourceIdentity,
        warnings: [],
        plan: {
          format: "step",
          schema: "AP242DIS",
          units: "mm",
          sourceIdentity,
          orderedBodyIds: ["body-agent-export"],
          allOrNothing: true,
          planIdentity: "b".repeat(64),
          bodies: [
            {
              bodyId: "body-agent-export",
              bodyName: "Agent export body",
              partId: "part:default",
              featureId: "feature-agent-export",
              sourceType: "primitiveFeature",
              sourceIdentitySignature: "source-agent-export",
              status: "ready",
              diagnostics: []
            }
          ]
        }
      }
    })
  );
  const executeExactExport = vi.fn(
    async (
      proposal: CadAgentExactExportProposal
    ): Promise<CadAgentExactExportResult> => ({
      requestId: proposal.requestId,
      status: "downloadRequested",
      selectedBodyIds: proposal.plan.orderedBodyIds,
      selectedBodyCount: proposal.plan.orderedBodyIds.length,
      schema: "AP242DIS",
      units: proposal.plan.units,
      planIdentity: proposal.plan.planIdentity,
      artifactByteLength: 123,
      artifactSha256: "c".repeat(64),
      diagnostics: []
    })
  );
  const session = new LocalAgentSession({
    token: "a".repeat(43),
    engine,
    executor,
    readSelection: () => ({}),
    preflightCommit: async () => true,
    publishCommit: async () => undefined,
    planExactExport,
    executeExactExport
  });
  return { engine, session, planExactExport, executeExactExport };
}

function createExactExportRequest(
  requestId: string
): CadAgentExactExportRequest {
  return { requestId, selection: { mode: "all" } };
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

async function waitForCall(mock: { readonly mock: { calls: unknown[] } }) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (mock.mock.calls.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for the commit preflight.");
}
