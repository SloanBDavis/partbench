import { describe, expect, it } from "vitest";
import type {
  CadQueryRequest,
  CadQueryResponse,
  SketchPathCandidatesQueryResponse,
  SketchPathReadinessQueryResponse,
  SketchProfileCandidatesQueryResponse,
  SketchProfileDiagnostic,
  SketchProfileReadinessQueryResponse
} from "./index";
import {
  validateSketchProfilePathQueryRequest,
  validateSketchProfilePathQueryResponse
} from "./index";

const entityProfile = {
  kind: "entity",
  sketchId: "sketch_1",
  entityId: "circle_1"
} as const;

const entityPath = {
  kind: "entity",
  sketchId: "sketch_1",
  entityId: "arc_1",
  orientation: "reverse"
} as const;

describe("V17 Slice D query contracts", () => {
  it("accepts exactly the four pure profile/path request shapes", () => {
    const requests: readonly CadQueryRequest[] = [
      {
        version: "cadops.v1",
        query: { query: "sketch.profileCandidates", sketchId: "sketch_1" }
      },
      {
        version: "cadops.v1",
        query: {
          query: "sketch.profileReadiness",
          profile: {
            kind: "wire",
            sketchId: "sketch_1",
            segments: [
              { entityId: "line_1", orientation: "forward" },
              { entityId: "arc_1", orientation: "reverse" }
            ]
          },
          consumer: {
            featureKind: "extrude",
            operationMode: "cut",
            targetBodyId: "body_1"
          }
        }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.pathCandidates", sketchId: "sketch_1" }
      },
      {
        version: "cadops.v1",
        query: {
          query: "sketch.pathReadiness",
          path: entityPath,
          sweepProfile: entityProfile
        }
      }
    ];

    for (const request of requests) {
      expect(validateSketchProfilePathQueryRequest(request)).toEqual({
        ok: true,
        value: request
      });
    }
  });

  it("rejects unknown, mixed, and consumer-incompatible request fields", () => {
    const invalid = [
      {
        version: "cadops.v1",
        query: {
          query: "sketch.profileCandidates",
          sketchId: "sketch_1",
          includeAnalyticGraph: true
        }
      },
      {
        version: "cadops.v1",
        query: {
          query: "sketch.profileReadiness",
          profile: {
            kind: "entity",
            sketchId: "sketch_1",
            entityId: "circle_1",
            segments: []
          },
          consumer: {
            featureKind: "extrude",
            operationMode: "newBody",
            targetBodyId: "body_1"
          }
        }
      },
      {
        version: "cadops.v1",
        query: {
          query: "sketch.pathReadiness",
          path: entityPath,
          sweepProfile: {
            kind: "wire",
            sketchId: "sketch_1",
            segments: []
          }
        }
      }
    ];

    const results = invalid.map(validateSketchProfilePathQueryRequest);
    expect(results.every((result) => !result.ok)).toBe(true);
    expect(
      results
        .flatMap((result) => (result.ok ? [] : result.issues))
        .map((issue) => issue.code)
    ).toContain("UNKNOWN_FIELD");
  });

  it("validates deterministic candidate and readiness response envelopes", () => {
    const profileCandidates: SketchProfileCandidatesQueryResponse = {
      ok: true,
      query: "sketch.profileCandidates",
      cadOpsVersion: "cadops.v1",
      sketchId: "sketch_1",
      status: "ready",
      candidateCount: 0,
      candidates: [],
      rejectedComponentCount: 1,
      rejectedComponents: [
        {
          status: "blocked",
          componentIndex: 0,
          sortKey: "arc_1|line_1|line_2",
          sketchId: "sketch_1",
          entityIds: ["arc_1", "line_1", "line_2"],
          closed: false,
          branchFree: false,
          intersectionStatus: "not-evaluated",
          joinCount: 0,
          joins: [],
          diagnosticCount: 1,
          diagnostics: [
            {
              code: "SKETCH_PROFILE_BRANCHING",
              severity: "blocker",
              message: "The component contains a branch vertex."
            }
          ]
        }
      ],
      constructionExclusionCount: 0,
      constructionExclusions: [],
      diagnosticCount: 0,
      diagnostics: []
    };
    const profileReadiness: SketchProfileReadinessQueryResponse = {
      ok: true,
      query: "sketch.profileReadiness",
      cadOpsVersion: "cadops.v1",
      status: "ready",
      requestedProfile: entityProfile,
      normalizedProfile: entityProfile,
      consumer: { featureKind: "extrude", operationMode: "newBody" },
      consumerCompatibility: {
        status: "ready",
        featureKind: "extrude",
        operationMode: "newBody",
        diagnosticCount: 0,
        diagnostics: []
      },
      targetCompatibility: {
        status: "not-applicable",
        diagnosticCount: 0,
        diagnostics: []
      },
      dependencies: {
        sketchIds: ["sketch_1"],
        orderedEntityIds: ["circle_1"]
      },
      joinCount: 0,
      joins: [],
      intersectionStatus: "clear",
      orientation: "counterclockwise",
      orientationNormalized: false,
      area: Math.PI,
      signedArea: Math.PI,
      bounds: { min: [-1, -1], max: [1, 1] },
      diagnosticCount: 0,
      diagnostics: []
    };
    const pathCandidates: SketchPathCandidatesQueryResponse = {
      ok: true,
      query: "sketch.pathCandidates",
      cadOpsVersion: "cadops.v1",
      sketchId: "sketch_1",
      status: "ready",
      candidateCount: 1,
      candidates: [
        {
          status: "ready",
          candidateIndex: 0,
          sortKey: "arc_1",
          path: entityPath,
          length: Math.PI,
          bounds: { min: [-1, 0], max: [1, 1] },
          connectionStatus: "connected",
          tangentStatus: "tangent",
          selfIntersectionStatus: "clear",
          joinCount: 0,
          joins: [],
          dependencies: {
            sketchIds: ["sketch_1"],
            orderedEntityIds: ["arc_1"]
          },
          diagnosticCount: 0,
          diagnostics: []
        }
      ],
      rejectedComponentCount: 0,
      rejectedComponents: [],
      diagnosticCount: 0,
      diagnostics: []
    };
    const pathReadiness: SketchPathReadinessQueryResponse = {
      ok: true,
      query: "sketch.pathReadiness",
      cadOpsVersion: "cadops.v1",
      status: "blocked",
      requestedPath: entityPath,
      sweepProfile: entityProfile,
      consumer: { featureKind: "sweep", operationMode: "newBody" },
      dependencies: {
        sketchIds: ["sketch_1"],
        orderedEntityIds: ["arc_1", "circle_1"]
      },
      connectionStatus: "connected",
      tangentStatus: "tangent",
      selfIntersectionStatus: "clear",
      frameStatus: "invalid",
      joinCount: 0,
      joins: [],
      diagnosticCount: 1,
      diagnostics: [
        {
          code: "SKETCH_PATH_FRAME_INVALID",
          severity: "blocker",
          message: "The path start does not satisfy the sweep profile frame."
        }
      ]
    };
    const responses: readonly CadQueryResponse[] = [
      profileCandidates,
      profileReadiness,
      pathCandidates,
      pathReadiness
    ];

    for (const response of responses) {
      expect(validateSketchProfilePathQueryResponse(response)).toEqual({
        ok: true,
        value: response
      });
    }
  });

  it("rejects response count drift, missing normalized refs, and private fields", () => {
    const countDrift = {
      ok: true,
      query: "sketch.pathCandidates",
      cadOpsVersion: "cadops.v1",
      sketchId: "sketch_1",
      status: "ready",
      candidateCount: 1,
      candidates: [],
      rejectedComponentCount: 0,
      rejectedComponents: [],
      diagnosticCount: 0,
      diagnostics: []
    };
    const missingNormalized = {
      ok: true,
      query: "sketch.profileReadiness",
      cadOpsVersion: "cadops.v1",
      status: "ready",
      requestedProfile: entityProfile,
      consumer: { featureKind: "extrude", operationMode: "newBody" },
      consumerCompatibility: {
        status: "ready",
        featureKind: "extrude",
        operationMode: "newBody",
        diagnosticCount: 0,
        diagnostics: []
      },
      targetCompatibility: {
        status: "not-applicable",
        diagnosticCount: 0,
        diagnostics: []
      },
      dependencies: { sketchIds: ["sketch_1"], orderedEntityIds: ["circle_1"] },
      joinCount: 0,
      joins: [],
      intersectionStatus: "clear",
      orientationNormalized: false,
      diagnosticCount: 0,
      diagnostics: []
    };
    const privateField = {
      ok: true,
      query: "sketch.profileCandidates",
      cadOpsVersion: "cadops.v1",
      sketchId: "sketch_1",
      status: "ready",
      candidateCount: 0,
      candidates: [],
      rejectedComponentCount: 0,
      rejectedComponents: [],
      constructionExclusionCount: 0,
      constructionExclusions: [],
      diagnosticCount: 0,
      diagnostics: [],
      analyticIntersectionGraph: {}
    };

    for (const response of [countDrift, missingNormalized, privateField]) {
      expect(validateSketchProfilePathQueryResponse(response).ok).toBe(false);
    }
  });

  it("keeps missing sketches at the query-error envelope", () => {
    const invalidDiagnostic: SketchProfileDiagnostic = {
      // @ts-expect-error SKETCH_NOT_FOUND is a CadQueryError, not a successful profile diagnostic.
      code: "SKETCH_NOT_FOUND",
      severity: "blocker",
      message: "Missing sketch."
    };
    expect(invalidDiagnostic.code).toBe("SKETCH_NOT_FOUND");
  });
});
