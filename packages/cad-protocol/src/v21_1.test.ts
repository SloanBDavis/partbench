import { describe, expect, it } from "vitest";

import {
  CAD_EXPORT_DIAGNOSTIC_CODES,
  type CadCurrentExactResult,
  type CadExactArtifactCacheSummary,
  type CadExactReadySubsetMetadata,
  type FeatureUpdateHoleOp,
  type ProjectCheckpointPayloadRecoveryResult,
  type ProjectPortabilityStatus,
  validateCadCurrentExactResults,
  validateCadExactArtifactCacheSummary,
  validateCadExactReadySubsetMetadata,
  validateCadExportDiagnostics,
  validateFeatureUpdateHoleOp,
  validateProjectCheckpointPayloadRecoveryResult,
  validateProjectPortabilityStatus
} from "./index";

const sourceIdentity = {
  algorithm: "partbench-source-v1" as const,
  sha256: "a".repeat(64)
};

function downstreamReadiness() {
  return [
    {
      operation: "holeTarget" as const,
      status: "ready" as const,
      requiredShapePolicy: "singleShapeOneOrMoreSolids" as const,
      shapePolicy: "singleSolid" as const,
      diagnostics: []
    },
    {
      operation: "patternSeed" as const,
      status: "ready" as const,
      requiredShapePolicy: "singleShapeOneOrMoreSolids" as const,
      shapePolicy: "singleSolid" as const,
      diagnostics: []
    },
    {
      operation: "mirrorSeed" as const,
      status: "ready" as const,
      requiredShapePolicy: "singleShapeOneOrMoreSolids" as const,
      shapePolicy: "singleSolid" as const,
      diagnostics: []
    },
    {
      operation: "shellTarget" as const,
      status: "ready" as const,
      requiredShapePolicy: "singleSolid" as const,
      shapePolicy: "singleSolid" as const,
      diagnostics: []
    }
  ];
}

describe("V21.1 additive protocol contracts", () => {
  it("validates hole retarget fields without weakening historical updates", () => {
    const historical: FeatureUpdateHoleOp = {
      op: "feature.updateHole",
      id: "hole-1",
      depth: 4
    };
    const bodyRetarget: FeatureUpdateHoleOp = {
      ...historical,
      targetBodyId: "body-2"
    };
    const anchorRetarget: FeatureUpdateHoleOp = {
      ...historical,
      targetTopologyAnchorId: "anchor-2"
    };
    const ambiguousRetarget: FeatureUpdateHoleOp = {
      ...historical,
      targetBodyId: "body-2",
      targetTopologyAnchorId: "anchor-2"
    };

    expect(validateFeatureUpdateHoleOp(historical).ok).toBe(true);
    expect(validateFeatureUpdateHoleOp(bodyRetarget).ok).toBe(true);
    expect(validateFeatureUpdateHoleOp(anchorRetarget).ok).toBe(true);
    expect(
      validateFeatureUpdateHoleOp({
        op: "feature.updateHole",
        id: "hole-1"
      }).ok
    ).toBe(false);
    expect(validateFeatureUpdateHoleOp(ambiguousRetarget).ok).toBe(false);
    expect(
      validateFeatureUpdateHoleOp({ ...historical, brepBytes: [1, 2, 3] }).ok
    ).toBe(false);
  });

  it("keeps exact downstream evidence exhaustive and byte-free", () => {
    const current: CadCurrentExactResult = {
      status: "ready",
      bodyId: "body-1",
      sourceType: "sketchHoleFeature",
      sourceIdentitySignature: "source-1",
      artifactEvidence: {
        bodyId: "body-1",
        sourceType: "sketchHoleFeature",
        documentSourceIdentity: sourceIdentity,
        bodySourceIdentitySignature: "source-1",
        sourceGraphNodeCount: 2,
        brepFormat: "occt-brep",
        brepByteLength: 128,
        brepSha256: "b".repeat(64),
        shapePolicy: "singleSolid",
        topologySignature: "topology-1"
      },
      downstreamReadiness: downstreamReadiness(),
      diagnostics: []
    };

    expect(validateCadCurrentExactResults([current]).ok).toBe(true);
    const sparseResults = new Array<CadCurrentExactResult>(1);
    expect(validateCadCurrentExactResults(sparseResults).ok).toBe(false);
    const sparseDownstream = new Array(4);
    sparseDownstream[0] = downstreamReadiness()[0];
    expect(
      validateCadCurrentExactResults([
        { ...current, downstreamReadiness: sparseDownstream }
      ]).ok
    ).toBe(false);
    expect(
      validateCadCurrentExactResults([
        { ...current, downstreamReadiness: downstreamReadiness().slice(1) }
      ]).ok
    ).toBe(false);
    expect(
      validateCadCurrentExactResults([
        {
          ...current,
          downstreamReadiness: downstreamReadiness().map((entry) =>
            entry.operation === "shellTarget"
              ? {
                  ...entry,
                  requiredShapePolicy: "singleShapeOneOrMoreSolids"
                }
              : entry
          )
        }
      ]).ok
    ).toBe(false);
    expect(
      validateCadCurrentExactResults([
        {
          ...current,
          downstreamReadiness: downstreamReadiness().map((entry) => ({
            ...entry,
            ...(entry.operation === "holeTarget" ? { brepBytes: [1] } : {})
          }))
        }
      ]).ok
    ).toBe(false);

    const historical: CadCurrentExactResult = {
      status: "ready",
      bodyId: "body-old",
      sourceType: "sketchExtrudeFeature",
      sourceIdentitySignature: "source-old",
      diagnostics: []
    };
    expect(validateCadCurrentExactResults([historical]).ok).toBe(true);
  });

  it("validates explicit ready-subset review metadata", () => {
    const blocker = {
      code: "EXPORT_EXACT_SOURCE_STALE" as const,
      status: "unavailable" as const,
      message: "The exact source is stale.",
      bodyId: "body-2"
    };
    const subset: CadExactReadySubsetMetadata = {
      orderedBodyIds: ["body-1"],
      includedBodies: [
        { bodyId: "body-1", bodyName: "Ready body", diagnostics: [] }
      ],
      excludedBodies: [
        { bodyId: "body-2", bodyName: "Blocked body", diagnostics: [blocker] }
      ],
      allOrNothing: true
    };

    expect(validateCadExactReadySubsetMetadata(subset).ok).toBe(true);
    expect(
      validateCadExactReadySubsetMetadata({
        ...subset,
        excludedBodies: [{ ...subset.includedBodies[0], diagnostics: [] }]
      }).ok
    ).toBe(false);
    expect(
      validateCadExactReadySubsetMetadata({
        ...subset,
        excludedBodies: [
          {
            ...subset.excludedBodies[0],
            diagnostics: [{ ...blocker, status: "deferred" }]
          }
        ]
      }).ok
    ).toBe(true);
    const sparseIncluded = new Array(1);
    expect(
      validateCadExactReadySubsetMetadata({
        ...subset,
        includedBodies: sparseIncluded
      }).ok
    ).toBe(false);
    expect(
      validateCadExactReadySubsetMetadata({
        ...subset,
        excludedBodies: [
          {
            ...subset.excludedBodies[0],
            diagnostics: Array.from({ length: 257 }, () => blocker)
          }
        ]
      }).ok
    ).toBe(false);
    expect(
      validateCadExactReadySubsetMetadata({
        ...subset,
        includedBodies: [
          { ...subset.includedBodies[0], diagnostics: [blocker] }
        ]
      }).ok
    ).toBe(false);
    expect(
      validateCadExactReadySubsetMetadata({
        ...subset,
        includedBodies: [
          {
            ...subset.includedBodies[0],
            diagnostics: [{ ...blocker, status: "deferred" }]
          }
        ]
      }).ok
    ).toBe(false);
    expect(
      validateCadExactReadySubsetMetadata({
        ...subset,
        excludedBodies: [
          {
            ...subset.excludedBodies[0],
            diagnostics: [{ ...blocker, status: "supported" }]
          }
        ]
      }).ok
    ).toBe(false);
    expect(
      validateCadExactReadySubsetMetadata({
        ...subset,
        excludedBodies: [
          { ...subset.excludedBodies[0], bodyId: subset.orderedBodyIds[0] }
        ]
      }).ok
    ).toBe(false);
  });

  it("validates portability and atomic byte-free recovery metadata", () => {
    const portable: ProjectPortabilityStatus = { status: "portable-json" };
    const required: ProjectPortabilityStatus = {
      status: "wcad-required",
      checkpointIds: ["checkpoint-1"]
    };
    const recovered: ProjectCheckpointPayloadRecoveryResult = {
      status: "recovered",
      projectSourceIdentity: sourceIdentity,
      requestedCheckpointIds: ["checkpoint-1"],
      recoveredCheckpointIds: ["checkpoint-1"],
      diagnostics: []
    };
    const rejected: ProjectCheckpointPayloadRecoveryResult = {
      status: "rejected",
      projectSourceIdentity: sourceIdentity,
      requestedCheckpointIds: ["checkpoint-1"],
      recoveredCheckpointIds: [],
      diagnostics: [
        {
          code: "CHECKPOINT_PAYLOAD_RECOVERY_MISMATCH",
          checkpointId: "checkpoint-1",
          message: "The checkpoint hash does not match.",
          expected: "expected-hash",
          received: "received-hash"
        }
      ]
    };

    expect(validateProjectPortabilityStatus(portable).ok).toBe(true);
    expect(validateProjectPortabilityStatus(required).ok).toBe(true);
    expect(
      validateProjectPortabilityStatus({
        status: "payload-missing",
        checkpointIds: []
      }).ok
    ).toBe(false);
    const sparseCheckpointIds = new Array(1);
    expect(
      validateProjectPortabilityStatus({
        status: "payload-missing",
        checkpointIds: sparseCheckpointIds
      }).ok
    ).toBe(false);
    expect(validateProjectCheckpointPayloadRecoveryResult(recovered).ok).toBe(
      true
    );
    expect(validateProjectCheckpointPayloadRecoveryResult(rejected).ok).toBe(
      true
    );
    expect(
      validateProjectCheckpointPayloadRecoveryResult({
        ...rejected,
        recoveredCheckpointIds: ["checkpoint-1"]
      }).ok
    ).toBe(false);
    expect(
      validateProjectCheckpointPayloadRecoveryResult({
        ...recovered,
        requestedCheckpointIds: sparseCheckpointIds,
        recoveredCheckpointIds: sparseCheckpointIds
      }).ok
    ).toBe(false);
    const sparseRecoveryDiagnostics = new Array(1);
    expect(
      validateProjectCheckpointPayloadRecoveryResult({
        ...rejected,
        diagnostics: sparseRecoveryDiagnostics
      }).ok
    ).toBe(false);
    expect(
      validateProjectCheckpointPayloadRecoveryResult({
        ...recovered,
        brepBytes: [1, 2, 3]
      }).ok
    ).toBe(false);
  });

  it("validates bounded cache summaries and the shared diagnostics", () => {
    const summary: CadExactArtifactCacheSummary = {
      status: "ready",
      entryCount: 2,
      retainedByteLength: 1_024
    };
    const newCodes = [
      "HOLE_TOOL_NO_INTERSECTION",
      "HOLE_RESULT_INVALID",
      "SHELL_TARGET_MULTI_SOLID_UNSUPPORTED",
      "EXACT_CACHE_ENTRY_INVALID",
      "CHECKPOINT_PAYLOAD_RECOVERY_MISMATCH"
    ] as const;

    expect(validateCadExactArtifactCacheSummary(summary).ok).toBe(true);
    expect(
      validateCadExactArtifactCacheSummary({
        ...summary,
        entryCount: 5_000
      }).ok
    ).toBe(true);
    const inheritedRequired = Object.create(summary) as unknown;
    expect(validateCadExactArtifactCacheSummary(inheritedRequired).ok).toBe(
      false
    );
    const inheritedExtra = Object.assign(
      Object.create({ brepBytes: [1] }) as object,
      summary
    );
    expect(validateCadExactArtifactCacheSummary(inheritedExtra).ok).toBe(false);
    const hiddenExtra = { ...summary } as Record<PropertyKey, unknown>;
    Object.defineProperty(hiddenExtra, "brepBytes", { value: [1] });
    expect(validateCadExactArtifactCacheSummary(hiddenExtra).ok).toBe(false);
    const symbolExtra = { ...summary } as Record<PropertyKey, unknown>;
    symbolExtra[Symbol("brepBytes")] = [1];
    expect(validateCadExactArtifactCacheSummary(symbolExtra).ok).toBe(false);
    expect(
      validateCadExactArtifactCacheSummary({
        ...summary,
        status: "unavailable"
      }).ok
    ).toBe(false);
    expect(
      newCodes.every((code) => CAD_EXPORT_DIAGNOSTIC_CODES.includes(code))
    ).toBe(true);
    expect(
      validateCadExportDiagnostics(
        newCodes.map((code) => ({
          code,
          status: "unavailable",
          message: code
        }))
      ).ok
    ).toBe(true);
    expect(
      validateCadExportDiagnostics([
        {
          code: "HOLE_RESULT_INVALID",
          status: "unavailable",
          message: "Invalid hole result.",
          brepBytes: [1]
        }
      ]).ok
    ).toBe(false);
    expect(validateCadExportDiagnostics(new Array(1)).ok).toBe(false);
  });
});
