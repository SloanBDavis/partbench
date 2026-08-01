import { describe, expect, it } from "vitest";
import type {
  CadBodySource,
  CadCurrentExactResult,
  CadExactExportArtifact,
  CadExactExportPlan,
  CadExactExportQueryEvidence,
  CadExportBodySourceKind,
  ProjectExactExportQuery
} from "./index";
import {
  CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE,
  CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS,
  validateCadCurrentExactResults,
  validateCadExactExportPlan,
  validateCadExactExportQueryEvidence,
  validateProjectExactExportQuery
} from "./index";

const SHA256 = "0123456789abcdef".repeat(4);

function createPlan(): CadExactExportPlan {
  return {
    format: "step",
    schema: "AP242DIS",
    units: "mm",
    sourceIdentity: {
      algorithm: "partbench-source-v1",
      sha256: SHA256
    },
    orderedBodyIds: ["body_1", "body_2"],
    allOrNothing: true,
    planIdentity: SHA256,
    bodies: [
      {
        bodyId: "body_1",
        bodyName: "Bracket",
        partId: "part_default",
        featureId: "feature_1",
        sourceType: "sketchExtrudeFeature",
        sourceIdentitySignature: "body-1-source",
        status: "ready",
        diagnostics: []
      },
      {
        bodyId: "body_2",
        bodyName: "body_2",
        partId: "part_default",
        featureId: "feature_2",
        sourceType: "loftFeature",
        sourceIdentitySignature: "body-2-source",
        status: "blocked",
        diagnostics: [
          {
            code: "EXPORT_EXACT_SOURCE_STALE",
            status: "unavailable",
            message: "The exact source evidence is stale.",
            bodyId: "body_2"
          }
        ]
      }
    ]
  };
}

function createCurrentExactResults(): readonly CadCurrentExactResult[] {
  return [
    {
      status: "ready",
      bodyId: "body_1",
      sourceType: "sketchExtrudeFeature",
      sourceIdentitySignature: "body-1-source",
      artifactEvidence: {
        bodyId: "body_1",
        sourceType: "sketchExtrudeFeature",
        documentSourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256: SHA256
        },
        bodySourceIdentitySignature: "body-1-source",
        sourceGraphNodeCount: 2,
        brepFormat: "occt-brep",
        brepByteLength: 128,
        brepSha256: SHA256
      },
      diagnostics: []
    },
    {
      status: "stale",
      bodyId: "body_2",
      sourceType: "loftFeature",
      diagnostics: [
        {
          code: "EXPORT_EXACT_SOURCE_STALE",
          status: "stale",
          message: "The exact result belongs to an older body source.",
          bodyId: "body_2",
          sourceType: "loftFeature"
        }
      ]
    }
  ];
}

describe("V21 exact export protocol", () => {
  it("validates additive plan and byte-free exact-result evidence", () => {
    const evidence: CadExactExportQueryEvidence = {
      plan: createPlan(),
      currentExactResults: createCurrentExactResults()
    };

    expect(validateCadExactExportPlan(evidence.plan)).toEqual({
      ok: true,
      value: evidence.plan
    });
    expect(
      validateCadCurrentExactResults(evidence.currentExactResults)
    ).toEqual({
      ok: true,
      value: evidence.currentExactResults
    });
    expect(validateCadExactExportQueryEvidence(evidence)).toEqual({
      ok: true,
      value: evidence
    });

    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain("bytesBase64");
    expect(serialized).not.toContain("brepBytes");
    expect(serialized).not.toContain("cacheKey");
    expect(serialized).not.toContain("rendererId");
    expect(serialized).not.toContain("fileHandle");
    expect(serialized).not.toContain("localPath");
  });

  it("keeps legacy artifact fields readable but rejects them as V21 evidence", () => {
    const compatibilityArtifact: CadExactExportArtifact = {
      format: "step",
      fileName: "legacy.step",
      mimeType: "model/step",
      byteLength: 3,
      sha256: SHA256,
      bytesBase64: "QUJD"
    };

    expect(compatibilityArtifact.bytesBase64).toBe("QUJD");
    const validation = validateCadExactExportQueryEvidence({
      artifact: compatibilityArtifact
    });
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          code: "UNKNOWN_FIELD",
          path: "$.artifact"
        })
      );
    }
  });

  it("strictly validates exact export selection requests", () => {
    const request: ProjectExactExportQuery = {
      query: "project.exportExact",
      format: "step",
      bodyIds: ["body_2", "body_1"],
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256: SHA256
      },
      currentExactResults: createCurrentExactResults()
    };

    expect(validateProjectExactExportQuery(request)).toEqual({
      ok: true,
      value: request
    });

    for (const invalid of [
      { ...request, unknown: true },
      { ...request, format: "stl" },
      {
        ...request,
        sourceIdentity: { ...request.sourceIdentity!, sha256: "bad" }
      },
      { ...request, bodyIds: [""] },
      { ...request, bodyIds: ["body_1", 2] },
      { ...request, bodyIds: ["body_1", "body_1"] },
      { ...request, currentExactResults: [{ status: "ready" }] },
      {
        ...request,
        bodyIds: Array.from(
          {
            length: CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies + 1
          },
          (_, index) => `body_${index}`
        )
      }
    ]) {
      expect(validateProjectExactExportQuery(invalid).ok).toBe(false);
    }
  });

  it("covers every current body source type with one public export source kind", () => {
    const mapping = CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE satisfies Record<
      CadBodySource["type"],
      CadExportBodySourceKind
    >;

    expect(mapping).toEqual({
      primitiveFeature: "primitiveCompatibility",
      sketchExtrudeFeature: "authoredExtrude",
      sketchRevolveFeature: "authoredRevolve",
      sketchHoleFeature: "authoredHole",
      edgeChamferFeature: "authoredChamfer",
      edgeFilletFeature: "authoredFillet",
      linearPatternFeature: "authoredLinearPattern",
      circularPatternFeature: "authoredCircularPattern",
      mirrorFeature: "authoredMirror",
      shellFeature: "authoredShell",
      sweepFeature: "authoredSweep",
      loftFeature: "authoredLoft",
      importedStepBody: "importedBody"
    });
  });

  it("rejects malformed identities, statuses, counts, duplicates, and bytes", () => {
    const duplicatePlan = createPlan() as unknown as Record<string, unknown>;
    duplicatePlan.orderedBodyIds = ["body_1", "body_1"];

    const malformedIdentity = createPlan() as unknown as Record<
      string,
      unknown
    >;
    malformedIdentity.sourceIdentity = {
      algorithm: "partbench-source-v1",
      sha256: "not-a-sha256"
    };

    const malformedPlanIdentity = createPlan() as unknown as Record<
      string,
      unknown
    >;
    malformedPlanIdentity.planIdentity = "v21-plan-signature";

    const invalidStatus = createCurrentExactResults().map((result) => ({
      ...result
    })) as unknown as Record<string, unknown>[];
    invalidStatus[1]!.status = "cached";

    const nonFiniteCount = createCurrentExactResults().map((result) => ({
      ...result,
      ...(result.status === "ready"
        ? {
            artifactEvidence: {
              ...result.artifactEvidence!,
              sourceGraphNodeCount: Number.POSITIVE_INFINITY
            }
          }
        : {})
    }));

    const byteClaim = createCurrentExactResults().map((result) => ({
      ...result,
      ...(result.status === "ready"
        ? {
            artifactEvidence: {
              ...result.artifactEvidence!,
              brepBytes: new Uint8Array([1, 2, 3])
            }
          }
        : {})
    }));

    expect(validateCadExactExportPlan(duplicatePlan).ok).toBe(false);
    expect(validateCadExactExportPlan(malformedIdentity).ok).toBe(false);
    expect(validateCadExactExportPlan(malformedPlanIdentity).ok).toBe(false);
    expect(validateCadCurrentExactResults(invalidStatus).ok).toBe(false);
    expect(validateCadCurrentExactResults(nonFiniteCount).ok).toBe(false);
    const byteValidation = validateCadCurrentExactResults(byteClaim);
    expect(byteValidation.ok).toBe(false);
    if (!byteValidation.ok) {
      expect(byteValidation.issues).toContainEqual(
        expect.objectContaining({
          code: "UNKNOWN_FIELD",
          path: "$[0].artifactEvidence.brepBytes"
        })
      );
    }
  });

  it("caps current exact-result evidence at the selected-body limit", () => {
    const results = Array.from(
      { length: CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSelectedBodies + 1 },
      (_, index): CadCurrentExactResult => ({
        status: "pending",
        bodyId: `body_${index}`,
        sourceType: "primitiveFeature",
        diagnostics: []
      })
    );

    expect(validateCadCurrentExactResults(results).ok).toBe(false);
  });

  it("publishes the exact V21 export resource ceilings", () => {
    expect(CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS).toEqual({
      maxSelectedBodies: 256,
      maxSourceGraphNodes: 4_096,
      maxBrepArtifactBytes: 128 * 1024 * 1024,
      maxAggregateBrepArtifactBytes: 512 * 1024 * 1024,
      maxStepArtifactBytes: 512 * 1024 * 1024
    });
  });
});
