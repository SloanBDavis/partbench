import {
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProject,
  type AsyncCadCommandExecutor
} from "@web-cad/cad-core";
import type { CadBatchResponse } from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";
import {
  CAD_AGENT_APPROVAL_MODES,
  CAD_AGENT_SESSION_DIAGNOSTIC_CODES,
  CadOpsAgentAdapter,
  createCadOpsAgentCurrentSelectionResponse,
  executeCadOpsAgentRequestAsync,
  parseCadAgentApprovalMode,
  parseCadAgentSessionDiagnosticCode,
  parseCadAgentSessionErrorResponse,
  parseCadCurrentSelection,
  parseCadOpsAgentCurrentSelectionRequest,
  parseCadOpsAgentCurrentSelectionResponse,
  type CadCurrentSelection,
  type CadOpsAgentRequest
} from "./index";

const selectionRequest = {
  requestId: "selection-1",
  adapterVersion: "web-cad.agent-adapter.v1"
} as const;

describe("V20 agent session contracts", () => {
  it("freezes the two approval modes and seven diagnostics", () => {
    expect(CAD_AGENT_APPROVAL_MODES).toEqual(["manualApproval", "approveAll"]);
    expect(CAD_AGENT_SESSION_DIAGNOSTIC_CODES).toEqual([
      "AGENT_SESSION_NOT_CONNECTED",
      "AGENT_SESSION_ALREADY_CONNECTED",
      "AGENT_SESSION_TOKEN_INVALID",
      "AGENT_SESSION_DISCONNECTED",
      "AGENT_APPROVAL_BUSY",
      "AGENT_COMMIT_REJECTED",
      "AGENT_PROPOSAL_STALE"
    ]);

    for (const mode of CAD_AGENT_APPROVAL_MODES) {
      expect(parseCadAgentApprovalMode(mode)).toBe(mode);
    }
    for (const code of CAD_AGENT_SESSION_DIAGNOSTIC_CODES) {
      expect(parseCadAgentSessionDiagnosticCode(code)).toBe(code);
    }

    expect(() => parseCadAgentApprovalMode("approveOnce")).toThrow(
      "Invalid CAD agent approval mode."
    );
    expect(() => parseCadAgentSessionDiagnosticCode("AGENT_UNKNOWN")).toThrow(
      "Invalid CAD agent session diagnostic code."
    );
  });

  it("accepts only the documented semantic selection union", () => {
    const selections: readonly CadCurrentSelection[] = [
      { kind: "none" },
      { kind: "sketch", sketchId: "sketch-1" },
      {
        kind: "sketchEntity",
        sketchId: "sketch-1",
        entityId: "line-1"
      },
      { kind: "object", objectId: "object-1" },
      { kind: "body", bodyId: "body-1" },
      {
        kind: "generatedReference",
        bodyId: "body-1",
        stableId: "generated:face:body-1:endCap",
        expectedKind: "face"
      },
      { kind: "namedReference", name: "Top face" }
    ];

    for (const selection of selections) {
      expect(parseCadCurrentSelection(selection)).toEqual(selection);
    }

    expect(() =>
      parseCadCurrentSelection({ kind: "none", rendererId: 3 })
    ).toThrow("Invalid CAD current selection.");
    expect(() =>
      parseCadCurrentSelection({ kind: "sketchEntity", sketchId: "sketch-1" })
    ).toThrow("Invalid CAD current selection.");
    expect(() =>
      parseCadCurrentSelection({
        kind: "generatedReference",
        bodyId: "body-1",
        stableId: "generated:face:body-1:endCap",
        expectedKind: "mesh"
      })
    ).toThrow("Invalid CAD current selection.");
  });

  it("returns none from the in-memory adapter with canonical source identity", () => {
    const engine = new CadEngine();
    const adapter = new CadOpsAgentAdapter(engine);
    const response = adapter.getCurrentSelection(selectionRequest);

    expect(response).toEqual({
      ok: true,
      ...selectionRequest,
      selection: { kind: "none" },
      sourceIdentity: createCadProjectSourceIdentity(exportCadProject(engine))
    });
    expect(parseCadOpsAgentCurrentSelectionResponse(response)).toBe(response);
    expect(
      createCadOpsAgentCurrentSelectionResponse(engine, selectionRequest, {
        kind: "body",
        bodyId: "body-1"
      }).selection
    ).toEqual({ kind: "body", bodyId: "body-1" });
  });

  it("strictly parses selection requests, responses, and session failures", () => {
    expect(parseCadOpsAgentCurrentSelectionRequest(selectionRequest)).toBe(
      selectionRequest
    );
    expect(() =>
      parseCadOpsAgentCurrentSelectionRequest({
        ...selectionRequest,
        rendererId: "hidden"
      })
    ).toThrow("Invalid CADOps agent current selection request.");

    const response = new CadOpsAgentAdapter().getCurrentSelection(
      selectionRequest
    );
    expect(() =>
      parseCadOpsAgentCurrentSelectionResponse({ ...response, port: 1234 })
    ).toThrow("Invalid CADOps agent current selection response.");
    expect(() =>
      parseCadOpsAgentCurrentSelectionResponse({
        ...response,
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256: "bad"
        }
      })
    ).toThrow("Invalid CADOps agent current selection response.");

    const failure = {
      ok: false,
      requestId: "session-1",
      error: {
        code: "AGENT_SESSION_DISCONNECTED",
        message: "The browser session disconnected."
      }
    } as const;
    expect(parseCadAgentSessionErrorResponse(failure)).toBe(failure);
    expect(() =>
      parseCadAgentSessionErrorResponse({
        ...failure,
        error: { ...failure.error, retry: true }
      })
    ).toThrow("Invalid CAD agent session error response.");
  });
});

describe("V20 async agent execution helper", () => {
  const request: CadOpsAgentRequest = {
    requestId: "async-1",
    adapterVersion: "web-cad.agent-adapter.v1",
    permissions: { allowCommit: true },
    actor: { type: "agent", id: "async-agent" },
    source: { source: "mcp", toolName: "cad.batch" },
    batch: {
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          id: "async-box",
          dimensions: { width: 1, height: 1, depth: 1 }
        }
      ]
    }
  };

  it("uses only the supplied async executor and applies actor/audit context", async () => {
    const engine = new CadEngine();
    const synchronousExecute = vi.spyOn(engine, "executeBatch");
    const executeBatch = vi.fn(async (batch: CadOpsAgentRequest["batch"]) => {
      const response: CadBatchResponse = {
        ok: true,
        mode: batch.mode,
        semanticDiff: { created: [], modified: [], deleted: [] },
        createdIds: [],
        modifiedIds: [],
        deletedIds: [],
        warnings: [],
        transactionId: "transaction-1",
        ...(batch.actor ? { actor: batch.actor } : {}),
        ...(batch.audit ? { audit: batch.audit } : {})
      };
      return response;
    });
    const executor = { executeBatch } as unknown as AsyncCadCommandExecutor;

    const response = await executeCadOpsAgentRequestAsync(
      engine,
      executor,
      request
    );

    expect(synchronousExecute).not.toHaveBeenCalled();
    expect(executeBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: request.actor,
        audit: {
          source: "mcp",
          requestId: request.requestId,
          toolName: "cad.batch",
          intent: "commit",
          operationCount: 1
        }
      })
    );
    expect(response).toMatchObject({
      ok: true,
      requestId: request.requestId,
      transactionId: "transaction-1",
      actor: request.actor,
      audit: {
        source: "mcp",
        requestId: request.requestId,
        toolName: "cad.batch",
        intent: "commit",
        operationCount: 1
      }
    });
  });

  it("returns the existing permission response without calling the executor", async () => {
    const engine = new CadEngine();
    const executeBatch = vi.fn();
    const executor = { executeBatch } as unknown as AsyncCadCommandExecutor;
    const response = await executeCadOpsAgentRequestAsync(engine, executor, {
      ...request,
      permissions: { allowCommit: false }
    });

    expect(executeBatch).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      error: { code: "COMMIT_NOT_ALLOWED" }
    });
  });
});
