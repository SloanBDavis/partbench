import { describe, expect, it } from "vitest";
import type {
  CadQueryRequest,
  CadQueryResponse,
  SketchPathCandidatesQueryResponse,
  SketchPathReadinessQueryResponse,
  SketchProfileCandidatesQueryResponse,
  SketchProfileDiagnostic,
  SketchProfilePathQueryResponse,
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

type MutableRecord = Record<string, unknown>;

function mutableRecord(value: unknown): MutableRecord {
  return value as MutableRecord;
}

function mutableArray(value: unknown): unknown[] {
  return value as unknown[];
}

function makeProfileCandidatesResponse(): SketchProfileCandidatesQueryResponse {
  return {
    ok: true,
    query: "sketch.profileCandidates",
    cadOpsVersion: "cadops.v1",
    sketchId: "sketch_1",
    status: "ready",
    candidateCount: 1,
    candidates: [
      {
        status: "ready",
        candidateIndex: 0,
        sortKey: "arc_1|arc_2",
        profile: {
          kind: "wire",
          sketchId: "sketch_1",
          segments: [
            { entityId: "arc_1", orientation: "forward" },
            { entityId: "arc_2", orientation: "forward" }
          ]
        },
        orientation: "counterclockwise",
        area: 1,
        signedArea: 1,
        bounds: { min: [0, 0], max: [1, 1] },
        joinCount: 1,
        joins: [
          {
            joinIndex: 0,
            primaryEntityId: "arc_1",
            secondaryEntityId: "arc_2",
            connectionStatus: "exact",
            coincidentWithinTolerance: false,
            gapDistance: 0
          }
        ],
        intersectionStatus: "clear",
        dependencies: {
          sketchIds: ["sketch_1"],
          orderedEntityIds: ["arc_1", "arc_2"]
        },
        diagnosticCount: 0,
        diagnostics: []
      }
    ],
    rejectedComponentCount: 1,
    rejectedComponents: [
      {
        status: "blocked",
        componentIndex: 0,
        sortKey: "line_3",
        sketchId: "sketch_1",
        entityIds: ["line_3"],
        bounds: { min: [0, 0], max: [0, 0] },
        closed: false,
        branchFree: true,
        intersectionStatus: "not-evaluated",
        area: 0,
        joinCount: 0,
        joins: [],
        diagnosticCount: 1,
        diagnostics: [
          {
            code: "SKETCH_PROFILE_OPEN",
            severity: "blocker",
            message: "The component is open.",
            sketchId: "sketch_1",
            entityId: "line_3",
            segmentIndex: 0,
            joinIndex: 0,
            expected: "closed",
            received: ""
          }
        ]
      }
    ],
    constructionExclusionCount: 1,
    constructionExclusions: [
      {
        entityId: "arc_construction",
        entityKind: "arc",
        diagnostic: {
          code: "SKETCH_PROFILE_CONSTRUCTION_ENTITY",
          severity: "info",
          message: "Construction geometry is excluded."
        }
      }
    ],
    diagnosticCount: 0,
    diagnostics: []
  };
}

function makePathCandidatesResponse(): SketchPathCandidatesQueryResponse {
  return {
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
        sortKey: "line_1|arc_1",
        path: {
          kind: "chain",
          sketchId: "sketch_1",
          segments: [
            { entityId: "line_1", orientation: "forward" },
            { entityId: "arc_1", orientation: "forward" }
          ]
        },
        length: 1,
        bounds: { min: [0, 0], max: [1, 1] },
        connectionStatus: "connected",
        tangentStatus: "tangent",
        selfIntersectionStatus: "clear",
        joinCount: 1,
        joins: [
          {
            joinIndex: 0,
            primaryEntityId: "line_1",
            secondaryEntityId: "arc_1",
            connectionStatus: "within-tolerance",
            coincidentWithinTolerance: true,
            gapDistance: 0,
            tangentStatus: "tangent",
            angularDeviationDegrees: 0
          }
        ],
        dependencies: {
          sketchIds: ["sketch_1"],
          orderedEntityIds: ["line_1", "arc_1"]
        },
        diagnosticCount: 0,
        diagnostics: []
      }
    ],
    rejectedComponentCount: 1,
    rejectedComponents: [
      {
        status: "blocked",
        componentIndex: 0,
        sortKey: "line_2|line_3",
        sketchId: "sketch_1",
        entityIds: ["line_2", "line_3"],
        bounds: { min: [0, 0], max: [0, 0] },
        connectionStatus: "disconnected",
        tangentStatus: "not-evaluated",
        selfIntersectionStatus: "not-evaluated",
        joinCount: 0,
        joins: [],
        diagnosticCount: 1,
        diagnostics: [
          {
            code: "SKETCH_PATH_DISCONNECTED",
            severity: "blocker",
            message: "The path is disconnected.",
            sketchId: "sketch_1",
            entityId: "line_2",
            segmentIndex: 0,
            joinIndex: 0,
            expected: "connected",
            received: ""
          }
        ]
      }
    ],
    diagnosticCount: 0,
    diagnostics: []
  };
}

function makeProfileReadinessResponse(): SketchProfileReadinessQueryResponse {
  return {
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
    area: 1,
    signedArea: 1,
    bounds: { min: [0, 0], max: [1, 1] },
    diagnosticCount: 0,
    diagnostics: []
  };
}

function makePathReadinessResponse(): SketchPathReadinessQueryResponse {
  return {
    ok: true,
    query: "sketch.pathReadiness",
    cadOpsVersion: "cadops.v1",
    status: "ready",
    requestedPath: entityPath,
    normalizedPath: entityPath,
    consumer: { featureKind: "sweep", operationMode: "newBody" },
    dependencies: {
      sketchIds: ["sketch_1"],
      orderedEntityIds: ["arc_1"]
    },
    connectionStatus: "connected",
    tangentStatus: "tangent",
    selfIntersectionStatus: "clear",
    frameStatus: "not-evaluated",
    length: 1,
    bounds: { min: [0, 0], max: [1, 1] },
    joinCount: 0,
    joins: [],
    diagnosticCount: 0,
    diagnostics: []
  };
}

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

  it("rejects malformed nested fields across every response family", () => {
    type MalformedCase = {
      readonly name: string;
      readonly make: () => SketchProfilePathQueryResponse;
      readonly mutate: (response: MutableRecord) => void;
      readonly path: string;
    };
    const cases: readonly MalformedCase[] = [
      {
        name: "profile root status",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          response.status = "partial";
        },
        path: "$.status"
      },
      {
        name: "profile candidate status",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.candidates)[0]).status =
            "blocked";
        },
        path: "$.candidates[0].status"
      },
      {
        name: "profile candidate index",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.candidates)[0]).candidateIndex =
            -1;
        },
        path: "$.candidates[0].candidateIndex"
      },
      {
        name: "profile sort key",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.candidates)[0]).sortKey = "";
        },
        path: "$.candidates[0].sortKey"
      },
      {
        name: "profile orientation",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.candidates)[0]).orientation =
            "clockwise";
        },
        path: "$.candidates[0].orientation"
      },
      {
        name: "profile area",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.candidates)[0]).area = Number.NaN;
        },
        path: "$.candidates[0].area"
      },
      {
        name: "profile signed area",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.candidates)[0]).signedArea =
            Number.POSITIVE_INFINITY;
        },
        path: "$.candidates[0].signedArea"
      },
      {
        name: "profile bounds",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(
            mutableRecord(mutableArray(response.candidates)[0]).bounds
          ).min = [2, 2];
        },
        path: "$.candidates[0].bounds"
      },
      {
        name: "profile join connection",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          const candidate = mutableRecord(mutableArray(response.candidates)[0]);
          mutableRecord(mutableArray(candidate.joins)[0]).connectionStatus =
            "near";
        },
        path: "$.candidates[0].joins[0].connectionStatus"
      },
      {
        name: "profile join coincidence",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          const candidate = mutableRecord(mutableArray(response.candidates)[0]);
          mutableRecord(
            mutableArray(candidate.joins)[0]
          ).coincidentWithinTolerance = "yes";
        },
        path: "$.candidates[0].joins[0].coincidentWithinTolerance"
      },
      {
        name: "profile join index",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          const candidate = mutableRecord(mutableArray(response.candidates)[0]);
          mutableRecord(mutableArray(candidate.joins)[0]).joinIndex = 1;
        },
        path: "$.candidates[0].joins[0].joinIndex"
      },
      {
        name: "profile join entity id",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          const candidate = mutableRecord(mutableArray(response.candidates)[0]);
          mutableRecord(mutableArray(candidate.joins)[0]).primaryEntityId = "";
        },
        path: "$.candidates[0].joins[0].primaryEntityId"
      },
      {
        name: "profile join gap",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          const candidate = mutableRecord(mutableArray(response.candidates)[0]);
          mutableRecord(mutableArray(candidate.joins)[0]).gapDistance = -1;
        },
        path: "$.candidates[0].joins[0].gapDistance"
      },
      {
        name: "profile join private tangent",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          const candidate = mutableRecord(mutableArray(response.candidates)[0]);
          mutableRecord(mutableArray(candidate.joins)[0]).tangentStatus =
            "tangent";
        },
        path: "$.candidates[0].joins[0].tangentStatus"
      },
      {
        name: "profile rejected status",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.rejectedComponents)[0]).status =
            "ready";
        },
        path: "$.rejectedComponents[0].status"
      },
      {
        name: "profile rejected boolean",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.rejectedComponents)[0]).closed =
            0;
        },
        path: "$.rejectedComponents[0].closed"
      },
      {
        name: "profile rejected index",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(
            mutableArray(response.rejectedComponents)[0]
          ).componentIndex = 2;
        },
        path: "$.rejectedComponents[0].componentIndex"
      },
      {
        name: "profile rejected id",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(
            mutableArray(response.rejectedComponents)[0]
          ).entityIds = [""];
        },
        path: "$.rejectedComponents[0].entityIds[0]"
      },
      {
        name: "profile rejected sort key",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.rejectedComponents)[0]).sortKey =
            "";
        },
        path: "$.rejectedComponents[0].sortKey"
      },
      {
        name: "profile rejected intersection",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(
            mutableArray(response.rejectedComponents)[0]
          ).intersectionStatus = "unknown";
        },
        path: "$.rejectedComponents[0].intersectionStatus"
      },
      {
        name: "construction exclusion id",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(
            mutableArray(response.constructionExclusions)[0]
          ).entityId = "";
        },
        path: "$.constructionExclusions[0].entityId"
      },
      {
        name: "construction exclusion kind",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          mutableRecord(
            mutableArray(response.constructionExclusions)[0]
          ).entityKind = "point";
        },
        path: "$.constructionExclusions[0].entityKind"
      },
      {
        name: "construction exclusion diagnostic code",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          const exclusion = mutableRecord(
            mutableArray(response.constructionExclusions)[0]
          );
          mutableRecord(exclusion.diagnostic).code = "SKETCH_PROFILE_OPEN";
        },
        path: "$.constructionExclusions[0].diagnostic.code"
      },
      {
        name: "profile diagnostic optional index",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          const component = mutableRecord(
            mutableArray(response.rejectedComponents)[0]
          );
          mutableRecord(mutableArray(component.diagnostics)[0]).segmentIndex =
            0.5;
        },
        path: "$.rejectedComponents[0].diagnostics[0].segmentIndex"
      },
      {
        name: "profile diagnostic private field",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          const component = mutableRecord(
            mutableArray(response.rejectedComponents)[0]
          );
          mutableRecord(mutableArray(component.diagnostics)[0]).kernelHandle =
            7;
        },
        path: "$.rejectedComponents[0].diagnostics[0].kernelHandle"
      },
      {
        name: "profile diagnostic optional text",
        make: makeProfileCandidatesResponse,
        mutate: (response) => {
          const component = mutableRecord(
            mutableArray(response.rejectedComponents)[0]
          );
          mutableRecord(mutableArray(component.diagnostics)[0]).expected = 3;
        },
        path: "$.rejectedComponents[0].diagnostics[0].expected"
      },
      {
        name: "path root status",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          response.status = "partial";
        },
        path: "$.status"
      },
      {
        name: "path candidate length",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.candidates)[0]).length =
            Number.POSITIVE_INFINITY;
        },
        path: "$.candidates[0].length"
      },
      {
        name: "path candidate status",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.candidates)[0]).status =
            "blocked";
        },
        path: "$.candidates[0].status"
      },
      {
        name: "path candidate index",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.candidates)[0]).candidateIndex =
            1;
        },
        path: "$.candidates[0].candidateIndex"
      },
      {
        name: "path candidate connection",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.candidates)[0]).connectionStatus =
            "disconnected";
        },
        path: "$.candidates[0].connectionStatus"
      },
      {
        name: "path candidate tangent",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.candidates)[0]).tangentStatus =
            "not-tangent";
        },
        path: "$.candidates[0].tangentStatus"
      },
      {
        name: "path candidate self intersection",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(
            mutableArray(response.candidates)[0]
          ).selfIntersectionStatus = "self-intersecting";
        },
        path: "$.candidates[0].selfIntersectionStatus"
      },
      {
        name: "path join tangent",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          const candidate = mutableRecord(mutableArray(response.candidates)[0]);
          mutableRecord(mutableArray(candidate.joins)[0]).tangentStatus =
            "corner";
        },
        path: "$.candidates[0].joins[0].tangentStatus"
      },
      {
        name: "path join angle",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          const candidate = mutableRecord(mutableArray(response.candidates)[0]);
          mutableRecord(
            mutableArray(candidate.joins)[0]
          ).angularDeviationDegrees = Number.NaN;
        },
        path: "$.candidates[0].joins[0].angularDeviationDegrees"
      },
      {
        name: "path join coincidence consistency",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          const candidate = mutableRecord(mutableArray(response.candidates)[0]);
          mutableRecord(
            mutableArray(candidate.joins)[0]
          ).coincidentWithinTolerance = false;
        },
        path: "$.candidates[0].joins[0].coincidentWithinTolerance"
      },
      {
        name: "path rejected connection",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(
            mutableArray(response.rejectedComponents)[0]
          ).connectionStatus = "open";
        },
        path: "$.rejectedComponents[0].connectionStatus"
      },
      {
        name: "path rejected tangent",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(
            mutableArray(response.rejectedComponents)[0]
          ).tangentStatus = "corner";
        },
        path: "$.rejectedComponents[0].tangentStatus"
      },
      {
        name: "path rejected self intersection",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(
            mutableArray(response.rejectedComponents)[0]
          ).selfIntersectionStatus = "overlapping";
        },
        path: "$.rejectedComponents[0].selfIntersectionStatus"
      },
      {
        name: "path rejected status",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.rejectedComponents)[0]).status =
            "ready";
        },
        path: "$.rejectedComponents[0].status"
      },
      {
        name: "path rejected index",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(
            mutableArray(response.rejectedComponents)[0]
          ).componentIndex = -1;
        },
        path: "$.rejectedComponents[0].componentIndex"
      },
      {
        name: "path rejected id",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          mutableRecord(mutableArray(response.rejectedComponents)[0]).sketchId =
            "";
        },
        path: "$.rejectedComponents[0].sketchId"
      },
      {
        name: "profile readiness orientation flag",
        make: makeProfileReadinessResponse,
        mutate: (response) => {
          response.orientationNormalized = "false";
        },
        path: "$.orientationNormalized"
      },
      {
        name: "profile readiness orientation",
        make: makeProfileReadinessResponse,
        mutate: (response) => {
          response.orientation = "clockwise";
        },
        path: "$.orientation"
      },
      {
        name: "profile readiness intersection",
        make: makeProfileReadinessResponse,
        mutate: (response) => {
          response.intersectionStatus = "unknown";
        },
        path: "$.intersectionStatus"
      },
      {
        name: "profile readiness area",
        make: makeProfileReadinessResponse,
        mutate: (response) => {
          response.area = Number.NEGATIVE_INFINITY;
        },
        path: "$.area"
      },
      {
        name: "profile consumer compatibility status",
        make: makeProfileReadinessResponse,
        mutate: (response) => {
          mutableRecord(response.consumerCompatibility).status = "unsupported";
        },
        path: "$.consumerCompatibility.status"
      },
      {
        name: "profile consumer compatibility echo",
        make: makeProfileReadinessResponse,
        mutate: (response) => {
          mutableRecord(response.consumerCompatibility).featureKind = "revolve";
        },
        path: "$.consumerCompatibility"
      },
      {
        name: "profile target compatibility",
        make: makeProfileReadinessResponse,
        mutate: (response) => {
          mutableRecord(response.targetCompatibility).status = "ready";
          mutableRecord(response.targetCompatibility).targetBodyId = "body_1";
        },
        path: "$.targetCompatibility.status"
      },
      {
        name: "profile target private field",
        make: makeProfileReadinessResponse,
        mutate: (response) => {
          mutableRecord(response.targetCompatibility).topologyHandle = 1;
        },
        path: "$.targetCompatibility.topologyHandle"
      },
      {
        name: "profile target requested id echo",
        make: makeProfileReadinessResponse,
        mutate: (response) => {
          response.consumer = {
            featureKind: "extrude",
            operationMode: "cut",
            targetBodyId: "body_1"
          };
          response.consumerCompatibility = {
            status: "ready",
            featureKind: "extrude",
            operationMode: "cut",
            diagnosticCount: 0,
            diagnostics: []
          };
          response.targetCompatibility = {
            status: "ready",
            targetBodyId: "body_2",
            diagnosticCount: 0,
            diagnostics: []
          };
        },
        path: "$.targetCompatibility.targetBodyId"
      },
      {
        name: "path readiness status",
        make: makePathReadinessResponse,
        mutate: (response) => {
          response.status = "partial";
        },
        path: "$.status"
      },
      {
        name: "path readiness connection",
        make: makePathReadinessResponse,
        mutate: (response) => {
          response.connectionStatus = "open";
        },
        path: "$.connectionStatus"
      },
      {
        name: "path readiness tangent",
        make: makePathReadinessResponse,
        mutate: (response) => {
          response.tangentStatus = "corner";
        },
        path: "$.tangentStatus"
      },
      {
        name: "path readiness self intersection",
        make: makePathReadinessResponse,
        mutate: (response) => {
          response.selfIntersectionStatus = "overlapping";
        },
        path: "$.selfIntersectionStatus"
      },
      {
        name: "path readiness frame",
        make: makePathReadinessResponse,
        mutate: (response) => {
          response.frameStatus = "invalid";
        },
        path: "$.frameStatus"
      },
      {
        name: "path readiness length",
        make: makePathReadinessResponse,
        mutate: (response) => {
          response.length = Number.NaN;
        },
        path: "$.length"
      },
      {
        name: "path readiness consumer private field",
        make: makePathReadinessResponse,
        mutate: (response) => {
          mutableRecord(response.consumer).transitionMode = "rounded";
        },
        path: "$.consumer.transitionMode"
      },
      {
        name: "path diagnostic profile-only body id",
        make: makePathCandidatesResponse,
        mutate: (response) => {
          const component = mutableRecord(
            mutableArray(response.rejectedComponents)[0]
          );
          mutableRecord(mutableArray(component.diagnostics)[0]).bodyId =
            "body_1";
        },
        path: "$.rejectedComponents[0].diagnostics[0].bodyId"
      },
      {
        name: "dependency id",
        make: makePathReadinessResponse,
        mutate: (response) => {
          mutableRecord(response.dependencies).orderedEntityIds = [""];
        },
        path: "$.dependencies.orderedEntityIds[0]"
      }
    ];

    for (const malformedCase of cases) {
      const response = mutableRecord(structuredClone(malformedCase.make()));
      malformedCase.mutate(response);
      const result = validateSketchProfilePathQueryResponse(response);
      expect(result.ok, malformedCase.name).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.some((issue) => issue.path === malformedCase.path),
          malformedCase.name
        ).toBe(true);
      }
    }
  });

  it("accepts finite zero boundaries in blocked health and validates request echoes", () => {
    const blockedProfile = mutableRecord(makeProfileReadinessResponse());
    blockedProfile.status = "blocked";
    blockedProfile.orientation = "clockwise";
    blockedProfile.orientationNormalized = true;
    blockedProfile.intersectionStatus = "not-evaluated";
    blockedProfile.area = 0;
    blockedProfile.signedArea = 0;
    blockedProfile.bounds = { min: [0, 0], max: [0, 0] };

    const blockedPath = mutableRecord(makePathReadinessResponse());
    blockedPath.status = "blocked";
    blockedPath.sweepProfile = entityProfile;
    blockedPath.frameStatus = "invalid";
    blockedPath.length = 0;
    blockedPath.bounds = { min: [0, 0], max: [0, 0] };

    const addWithoutTarget = mutableRecord(makeProfileReadinessResponse());
    addWithoutTarget.status = "blocked";
    addWithoutTarget.consumer = {
      featureKind: "extrude",
      operationMode: "add"
    };
    addWithoutTarget.consumerCompatibility = {
      status: "blocked",
      featureKind: "extrude",
      operationMode: "add",
      diagnosticCount: 0,
      diagnostics: []
    };
    addWithoutTarget.targetCompatibility = {
      status: "missing",
      diagnosticCount: 0,
      diagnostics: []
    };

    for (const response of [
      makeProfileCandidatesResponse(),
      makePathCandidatesResponse(),
      blockedProfile,
      blockedPath,
      addWithoutTarget
    ]) {
      expect(validateSketchProfilePathQueryResponse(response).ok).toBe(true);
    }

    const request = {
      version: "cadops.v1",
      query: {
        query: "sketch.pathReadiness",
        path: entityPath
      }
    } as const;
    expect(
      validateSketchProfilePathQueryResponse(
        makePathReadinessResponse(),
        request
      ).ok
    ).toBe(true);

    const mismatchedRequest = {
      version: "cadops.v1",
      query: {
        query: "sketch.pathReadiness",
        path: { ...entityPath, entityId: "arc_other" }
      }
    } as const;
    expect(
      validateSketchProfilePathQueryResponse(
        makePathReadinessResponse(),
        mismatchedRequest
      ).ok
    ).toBe(false);
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
