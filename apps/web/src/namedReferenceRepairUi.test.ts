import type {
  CadBatchValidationError,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadReferenceHealthEntry,
  CadReferenceHealthStatus,
  NamedGeneratedReferenceEntry,
  ReferenceHealthQueryResponse,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import type { SelectedGeneratedReference } from "./generatedReferenceSelection";
import {
  createNamedReferenceHealthByName,
  createNamedReferenceRepairUiState,
  formatNamedReferenceRepairBatchError,
  isRepairableNamedReferenceHealth
} from "./namedReferenceRepairUi";

describe("namedReferenceRepairUi", () => {
  it("offers repair only for a stale named reference with a query-proven same-kind generated target", () => {
    const face = createFace();
    const state = createNamedReferenceRepairUiState({
      namedReferences: [createNamedReference()],
      namedReferenceHealthByName: new Map([
        ["Mounting face", createHealthEntry("stale")]
      ]),
      selectedNamedReferenceName: "Mounting face",
      selectedGeneratedReference: selectReference(face),
      selectionReferenceCandidates: createSelectionReferenceCandidates(face)
    });

    expect(state.status).toBe("ready");
    expect(state.status === "ready" ? state.target : undefined).toEqual({
      bodyId: "body_rect",
      stableId: "generated:face:body_rect:endCap",
      kind: "face"
    });
    expect(state.status === "ready" ? state.message : "").toContain(
      "Repair Mounting face"
    );
  });

  it("offers repair for query-proven add-result edge targets", () => {
    const edge = createAddCapEdge();
    const state = createNamedReferenceRepairUiState({
      namedReferences: [
        createNamedReference({
          name: "Mounting edge",
          bodyId: "body_source",
          stableId: "generated:edge:body_source:end:uMin",
          kind: "edge"
        })
      ],
      namedReferenceHealthByName: new Map([
        [
          "Mounting edge",
          {
            ...createHealthEntry("repair-needed"),
            label: "Mounting edge",
            kind: "edge",
            referenceName: "Mounting edge",
            stableId: "generated:edge:body_source:end:uMin"
          }
        ]
      ]),
      selectedNamedReferenceName: "Mounting edge",
      selectedGeneratedReference: selectReference(edge),
      selectionReferenceCandidates: createSelectionReferenceCandidates(edge)
    });

    expect(state).toMatchObject({
      status: "ready",
      healthStatus: "repair-needed",
      target: {
        bodyId: "body_add",
        stableId: "generated:edge:body_add:end:uMin",
        kind: "edge"
      }
    });
    expect(state.status === "ready" ? state.message : "").toContain(
      "Repair Mounting edge"
    );
  });

  it("preserves topology-anchor-backed repair targets from selection candidates", () => {
    const face = createFace();
    const state = createNamedReferenceRepairUiState({
      namedReferences: [createNamedReference()],
      namedReferenceHealthByName: new Map([
        ["Mounting face", createHealthEntry("repair-needed")]
      ]),
      selectedNamedReferenceName: "Mounting face",
      selectedGeneratedReference: selectReference(face),
      selectionReferenceCandidates: createSelectionReferenceCandidates(face, {
        topologyAnchorId: "anchor_face_1"
      })
    });

    expect(state).toMatchObject({
      status: "ready",
      target: {
        bodyId: "body_rect",
        stableId: "generated:face:body_rect:endCap",
        kind: "face",
        topologyAnchorId: "anchor_face_1"
      }
    });
    expect(JSON.stringify(state)).not.toMatch(
      /checkpoint-local|checkpointEntityId|rendererId|meshId|occtId|gpuId|selectionBufferId|pixelId|opfsPath|fileHandle/i
    );
  });

  it("offers repair for resolved named references with repairable health", () => {
    const face = createFace();
    const state = createNamedReferenceRepairUiState({
      namedReferences: [
        {
          ...createNamedReference(),
          status: "resolved",
          reference: createFace()
        }
      ],
      namedReferenceHealthByName: new Map([
        ["Mounting face", createHealthEntry("missing")]
      ]),
      selectedNamedReferenceName: "Mounting face",
      selectedGeneratedReference: selectReference(face),
      selectionReferenceCandidates: createSelectionReferenceCandidates(face)
    });

    expect(state).toMatchObject({
      status: "ready",
      healthStatus: "missing",
      target: {
        bodyId: "body_rect",
        stableId: "generated:face:body_rect:endCap",
        kind: "face"
      }
    });
  });

  it("shares the same repairable health statuses across repair surfaces", () => {
    expect(isRepairableNamedReferenceHealth("stale")).toBe(true);
    expect(isRepairableNamedReferenceHealth("missing")).toBe(true);
    expect(isRepairableNamedReferenceHealth("repair-needed")).toBe(true);
    expect(isRepairableNamedReferenceHealth("active")).toBe(false);
    expect(isRepairableNamedReferenceHealth("unsupported")).toBe(false);
    expect(isRepairableNamedReferenceHealth(undefined)).toBe(false);
  });

  it("blocks repair when the selected target has not been proven by selection.referenceCandidates", () => {
    const face = createFace();
    const state = createNamedReferenceRepairUiState({
      namedReferences: [createNamedReference()],
      namedReferenceHealthByName: new Map([
        ["Mounting face", createHealthEntry("missing")]
      ]),
      selectedNamedReferenceName: "Mounting face",
      selectedGeneratedReference: selectReference(face)
    });

    expect(state.status).toBe("blocked");
    expect(state.status === "blocked" ? state.message : "").toContain(
      "selection.referenceCandidates"
    );
    expect(
      state.status === "blocked" ? state.diagnostics[1] : undefined
    ).toMatchObject({
      source: "selection.referenceCandidates",
      message:
        "Repair targets must be proven command-ready by the shared reference query."
    });
  });

  it("does not surface repair for unsupported named-reference health", () => {
    const state = createNamedReferenceRepairUiState({
      namedReferences: [
        {
          ...createNamedReference(),
          status: "resolved",
          reference: createFace()
        }
      ],
      namedReferenceHealthByName: new Map([
        ["Mounting face", createHealthEntry("unsupported")]
      ]),
      selectedNamedReferenceName: "Mounting face",
      selectedGeneratedReference: selectReference(createFace()),
      selectionReferenceCandidates:
        createSelectionReferenceCandidates(createFace())
    });

    expect(state).toEqual({ status: "none" });
  });

  it("blocks repair when the selected generated reference kind does not match", () => {
    const face = createFace();
    const state = createNamedReferenceRepairUiState({
      namedReferences: [createNamedReference()],
      namedReferenceHealthByName: new Map([
        ["Mounting face", createHealthEntry("repair-needed")]
      ]),
      selectedNamedReferenceName: "Mounting face",
      selectedGeneratedReference: {
        ...selectReference(face),
        kind: "edge"
      },
      selectionReferenceCandidates: createSelectionReferenceCandidates(face)
    });

    expect(state.status).toBe("blocked");
    expect(state.status === "blocked" ? state.message : "").toContain(
      "not a face"
    );
  });

  it("preserves consumed target diagnostics from selection.referenceCandidates", () => {
    const face = createFace();
    const state = createNamedReferenceRepairUiState({
      namedReferences: [createNamedReference()],
      namedReferenceHealthByName: new Map([
        ["Mounting face", createHealthEntry("stale")]
      ]),
      selectedNamedReferenceName: "Mounting face",
      selectedGeneratedReference: selectReference(face),
      selectionReferenceCandidates: createSelectionReferenceCandidates(face, {
        status: "consumed",
        commandable: false,
        commandOperations: [],
        message: "Body body_rect was consumed by feat_cut."
      })
    });

    expect(state.status).toBe("blocked");
    expect(state.status === "blocked" ? state.message : "").toBe(
      "Body body_rect was consumed by feat_cut."
    );
    expect(
      state.status === "blocked" ? state.diagnostics[1] : undefined
    ).toMatchObject({
      code: "CONSUMED_SELECTION_BODY",
      source: "selection.referenceCandidates",
      message: "Body body_rect was consumed by feat_cut."
    });
  });

  it("maps only named-reference health entries by name", () => {
    const healthByName = createNamedReferenceHealthByName({
      ok: true,
      query: "reference.health",
      cadOpsVersion: "cadops.v1",
      target: { type: "all" },
      status: "stale",
      referenceHealthCount: 2,
      referenceHealth: [
        createHealthEntry("stale"),
        {
          ...createHealthEntry("stale"),
          source: "generatedReference",
          referenceName: undefined
        }
      ],
      diagnosticCount: 0,
      diagnostics: [],
      sourceBoundaryNote:
        "Source/session/generated reference health is reported separately.",
      derivedBoundaryNote:
        "Derived meshes remain a cache and are not repair authority.",
      requiresProjectSchemaMigration: false
    } satisfies ReferenceHealthQueryResponse);

    expect([...healthByName.keys()]).toEqual(["Mounting face"]);
  });

  it("formats validation diagnostics with concise expected and received details", () => {
    const error: CadBatchValidationError = {
      code: "TARGET_BODY_NOT_SUPPORTED",
      message: "Named reference Mounting face cannot be repaired to target.",
      op: "reference.repairName",
      referenceName: "Mounting face",
      expected: "active face reference on an unconsumed source body",
      received: "consumed target body"
    };

    expect(formatNamedReferenceRepairBatchError(error)).toBe(
      "TARGET_BODY_NOT_SUPPORTED: Named reference Mounting face cannot be repaired to target. Expected active face reference on an unconsumed source body; received consumed target body."
    );
  });
});

function createNamedReference(
  overrides: Partial<NamedGeneratedReferenceEntry> = {}
): NamedGeneratedReferenceEntry {
  return {
    name: "Mounting face",
    bodyId: "body_source",
    stableId: "generated:face:body_source:startCap",
    kind: "face",
    status: "stale",
    error: {
      code: "GENERATED_REFERENCE_NOT_FOUND",
      message: "Named reference Mounting face is stale."
    },
    ...overrides
  };
}

function createFace(): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: "generated:face:body_rect:endCap",
    label: "End cap",
    eligibleOperations: [
      "feature.attachSketchPlane",
      "feature.measureReference",
      "feature.selectReference"
    ],
    bodyId: "body_rect",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role: "endCap",
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      surfaceType: "plane"
    }
  };
}

function createAddCapEdge(): CadGeneratedEdgeReference {
  return {
    kind: "edge",
    stableId: "generated:edge:body_add:end:uMin",
    label: "Added cap profile edge uMin",
    eligibleOperations: ["feature.measureReference", "feature.selectReference"],
    bodyId: "body_add",
    ownerPartId: "part:default",
    sourceFeatureId: "feat_add",
    sourceSketchId: "sketch_add",
    sourceSketchEntityId: "rect_add",
    role: "end:uMin",
    adjacentFaceRoles: ["endCap", "side:uMin"],
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      sourceKind: "extrude",
      extrudeOperationMode: "add",
      targetBodyId: "body_rect",
      curveType: "line",
      axisRole: "addedCapProfile:uMin"
    }
  };
}

function selectReference(
  reference: CadGeneratedReference
): SelectedGeneratedReference {
  return {
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    kind: reference.kind
  };
}

function createHealthEntry(
  status: CadReferenceHealthStatus
): CadReferenceHealthEntry {
  return {
    source: "namedReference",
    status,
    commandable: status === "stale" || status === "repair-needed",
    commandOperations:
      status === "stale" || status === "repair-needed"
        ? ["feature.selectReference"]
        : [],
    label: "Mounting face",
    bodyId: "body_source",
    stableId: "generated:face:body_source:startCap",
    kind: "face",
    referenceName: "Mounting face",
    sourceFeatureId: "feat_rect",
    dependencies: {
      sketchIds: ["sketch_1"],
      sketchEntityIds: ["rect_1"],
      featureIds: ["feat_rect"],
      bodyIds: ["body_source"],
      generatedReferenceStableIds: ["generated:face:body_source:startCap"],
      namedReferenceNames: ["Mounting face"]
    },
    diagnosticCount: 1,
    diagnostics: [
      {
        code:
          status === "repair-needed"
            ? "REFERENCE_REPAIR_NEEDED"
            : status === "missing"
              ? "REFERENCE_TARGET_MISSING"
              : status === "unsupported"
                ? "REFERENCE_UNSUPPORTED"
                : "REFERENCE_STALE",
        severity: status === "unsupported" ? "warning" : "blocker",
        message: `Named reference Mounting face is ${status}.`,
        status,
        referenceName: "Mounting face",
        stableId: "generated:face:body_source:startCap"
      }
    ]
  };
}

function createSelectionReferenceCandidates(
  reference: CadGeneratedReference,
  overrides: {
    readonly status?: SelectionReferenceCandidatesQueryResponse["status"];
    readonly commandable?: boolean;
    readonly commandOperations?: SelectionReferenceCandidatesQueryResponse["candidates"][number]["commandOperations"];
    readonly message?: string;
    readonly topologyAnchorId?: string;
  } = {}
): SelectionReferenceCandidatesQueryResponse {
  const status = overrides.status ?? "resolved";
  const message = overrides.message ?? "Selection is not commandable.";
  const issue =
    status === "resolved"
      ? undefined
      : {
          code: "CONSUMED_SELECTION_BODY" as const,
          status: status as Exclude<
            SelectionReferenceCandidatesQueryResponse["status"],
            "resolved"
          >,
          message,
          bodyId: reference.bodyId,
          featureId: "feat_cut"
        };

  return {
    ok: true,
    query: "selection.referenceCandidates",
    cadOpsVersion: "cadops.v1",
    selection: {
      type: "generatedReference",
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      expectedKind: reference.kind
    },
    status,
    candidateCount: 1,
    candidates: [
      {
        source: "generatedReferenceSelection",
        target: {
          type: "generatedReference",
          bodyId: reference.bodyId,
          stableId: reference.stableId,
          kind: reference.kind,
          ...(overrides.topologyAnchorId
            ? { topologyAnchorId: overrides.topologyAnchorId }
            : {})
        },
        reference,
        commandable: overrides.commandable ?? true,
        commandOperations:
          overrides.commandOperations ??
          ([
            "reference.nameGenerated",
            ...reference.eligibleOperations
          ] as const),
        label: reference.label,
        issues: issue ? [issue] : []
      }
    ],
    issueCount: issue ? 1 : 0,
    issues: issue ? [issue] : []
  };
}
