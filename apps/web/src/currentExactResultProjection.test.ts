import { V21_EXACT_BODY_SOURCE_POLICY } from "@web-cad/cad-core";
import type {
  CadBodySource,
  CadCurrentExactResultStatus
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import type { CurrentExactBodyResolution } from "./currentExactBodyResolver";
import {
  createCurrentExactResultProjection,
  type CurrentExactResultConsumerEvidence
} from "./currentExactResultProjection";

const CONSUMERS = [
  "display",
  "metadata",
  "topology",
  "checkpoint",
  "export"
] as const;

describe("currentExactResultProjection", () => {
  it("enforces blocker, active-build, failure, stale, and ready precedence", () => {
    const cases: readonly [
      readonly CadCurrentExactResultStatus[],
      CadCurrentExactResultStatus
    ][] = [
      [
        ["ready", "unsupported", "blocked", "pending", "failed", "stale"],
        "unsupported"
      ],
      [["ready", "blocked", "pending", "failed", "stale"], "blocked"],
      [["ready", "pending", "failed", "stale"], "pending"],
      [["ready", "failed", "stale"], "failed"],
      [["ready", "stale"], "stale"],
      [["ready", "ready"], "ready"]
    ];

    for (const [statuses, expected] of cases) {
      expect(
        createCurrentExactResultProjection({
          resolution: readyResolution("primitiveFeature"),
          evidence: statuses.map((status, index) => ({
            consumer: CONSUMERS[index % CONSUMERS.length]!,
            required: true,
            status
          }))
        }).status
      ).toBe(expected);
    }
  });

  it("keeps an active current build pending and marks terminal identity/cache mismatches stale", () => {
    const resolution = readyResolution("sketchExtrudeFeature");
    const evidence = (status: CadCurrentExactResultStatus) => ({
      consumer: "display" as const,
      required: true,
      status,
      sourceIdentitySignature: "body-topology-source:v1:old",
      cacheKey: "old",
      expectedCacheKey: "current"
    });

    expect(
      createCurrentExactResultProjection({
        resolution,
        evidence: [evidence("pending")]
      }).status
    ).toBe("pending");
    expect(
      createCurrentExactResultProjection({
        resolution,
        evidence: [evidence("ready")]
      }).status
    ).toBe("stale");
  });

  it("keeps authoritative source blockers ahead of successful derived evidence", () => {
    const resolution = blockedResolution("importedStepBody", "blocked");
    const projection = createCurrentExactResultProjection({
      resolution,
      sourceIdentitySignature: "body-topology-source:v1:current",
      evidence: readyEvidence()
    });

    expect(projection.status).toBe("blocked");
    expect(projection.ready).toBe(false);
    expect(
      projection.consumers.every(({ status }) => status === "blocked")
    ).toBe(true);
    expect(JSON.stringify(projection)).not.toMatch(
      /rendererId|meshId|pixelId|selectionBufferId|occtId|gpuId/i
    );
  });

  it("covers every frozen V21 matrix case and bounded status", () => {
    const statuses: readonly CadCurrentExactResultStatus[] = [
      "pending",
      "ready",
      "stale",
      "blocked",
      "failed",
      "unsupported"
    ];
    let caseCount = 0;

    for (const [sourceType, policy] of Object.entries(
      V21_EXACT_BODY_SOURCE_POLICY
    ) as readonly [
      CadBodySource["type"],
      (typeof V21_EXACT_BODY_SOURCE_POLICY)[CadBodySource["type"]]
    ][]) {
      for (const matrixCase of policy.cases) {
        caseCount += 1;
        for (const status of statuses) {
          const resolution =
            status === "ready"
              ? readyResolution(sourceType)
              : blockedResolution(sourceType, status);
          const projection = createCurrentExactResultProjection({
            resolution,
            evidence: readyEvidence()
          });
          expect(
            projection.status,
            `${sourceType}:${matrixCase}:${status}`
          ).toBe(status);
          expect(projection.ready).toBe(status === "ready");
        }
      }
    }
    expect(caseCount).toBeGreaterThan(30);
  });
});

function readyEvidence(): readonly CurrentExactResultConsumerEvidence[] {
  return CONSUMERS.map((consumer) => ({
    consumer,
    required: true,
    status: "ready",
    sourceIdentitySignature: "body-topology-source:v1:current"
  }));
}

function readyResolution(
  sourceType: CadBodySource["type"]
): Extract<CurrentExactBodyResolution, { readonly status: "ready" }> {
  return {
    status: "ready",
    bodyId: `body:${sourceType}`,
    sourceType,
    sourceIdentitySignature: "body-topology-source:v1:current",
    cacheKeySha256: "a".repeat(64),
    sourceGraphNodeCount: 1,
    source: {
      id: `body:${sourceType}`,
      kind: "box",
      object: {
        id: `body:${sourceType}`,
        kind: "box",
        dimensions: { width: 1, height: 1, depth: 1 },
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      },
      sourceIdentitySignature: "body-topology-source:v1:current"
    },
    diagnostics: []
  };
}

function blockedResolution(
  sourceType: CadBodySource["type"],
  status: Exclude<CadCurrentExactResultStatus, "ready">
): CurrentExactBodyResolution {
  return {
    status,
    bodyId: `body:${sourceType}`,
    sourceType,
    diagnostics: [
      {
        code:
          status === "unsupported"
            ? "EXPORT_BODY_SOURCE_UNSUPPORTED"
            : status === "failed"
              ? "EXPORT_EXACT_ARTIFACT_FAILED"
              : status === "stale"
                ? "EXPORT_EXACT_SOURCE_STALE"
                : "EXPORT_EXACT_SOURCE_UNAVAILABLE",
        status,
        message: `${sourceType} is ${status}.`,
        bodyId: `body:${sourceType}`,
        sourceType
      }
    ]
  };
}
