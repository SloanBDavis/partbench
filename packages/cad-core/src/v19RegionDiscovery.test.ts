import {
  CAD_V19_RESOURCE_LIMITS,
  type SketchEntitySnapshot,
  type SketchProfileRegionCandidatesQuery,
  type SketchRegionsProfileRef
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  createSketchProfileRegionCandidatesResponse,
  createSketchRegionSourceIdentities
} from "./v19RegionDiscovery";
import {
  analyzeV22RegionDiscoveryLoops,
  validateV22RegionSource,
  type V22RegionSourceSketch
} from "./v22RegionSourceValidation";

function rectangle(
  id: string,
  center: readonly [number, number],
  width: number,
  height: number
): SketchEntitySnapshot {
  return {
    id,
    kind: "rectangle",
    center,
    width,
    height,
    construction: false
  };
}

function circle(
  id: string,
  center: readonly [number, number],
  radius: number
): SketchEntitySnapshot {
  return {
    id,
    kind: "circle",
    center,
    radius,
    construction: false
  };
}

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number]
): SketchEntitySnapshot {
  return {
    id,
    kind: "line",
    start,
    end,
    construction: false
  };
}

function arc(
  id: string,
  center: readonly [number, number],
  radius: number,
  startAngleDegrees: number,
  sweepAngleDegrees: number
): SketchEntitySnapshot {
  return {
    id,
    kind: "arc",
    center,
    radius,
    startAngleDegrees,
    sweepAngleDegrees,
    construction: false
  };
}

function sketch(
  ...entities: readonly SketchEntitySnapshot[]
): V22RegionSourceSketch {
  return {
    id: "sketch",
    entities: new Map(entities.map((entity) => [entity.id, entity]))
  };
}

function query(
  overrides: Partial<SketchProfileRegionCandidatesQuery> = {}
): SketchProfileRegionCandidatesQuery {
  return {
    query: "sketch.profileRegionCandidates",
    sketchId: "sketch",
    ...overrides
  };
}

function response(
  source: V22RegionSourceSketch,
  overrides: Partial<SketchProfileRegionCandidatesQuery> = {}
) {
  return createSketchProfileRegionCandidatesResponse(
    source,
    query(overrides),
    "cadops.v1"
  );
}

function diagnosticCodes(
  value: ReturnType<typeof response>
): readonly string[] {
  return value.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("V19 material-region discovery", () => {
  it("builds one direct-child material cell at every containment depth", () => {
    const source = sketch(
      rectangle("outer", [0, 0], 20, 20),
      circle("hole", [0, 0], 5),
      circle("island", [0, 0], 2)
    );
    const result = response(source);

    expect(result.status).toBe("ready");
    expect(result.candidateCount).toBe(3);
    expect(
      result.candidates.map((candidate) => candidate.containmentDepth)
    ).toEqual([0, 1, 2]);
    expect(result.candidates[0]).toMatchObject({
      outerEntityIds: ["outer"],
      holeEntityIds: [["hole"]],
      status: "valid"
    });
    expect(result.candidates[1]).toMatchObject({
      outerEntityIds: ["hole"],
      holeEntityIds: [["island"]],
      status: "valid"
    });
    expect(result.candidates[2]).toMatchObject({
      outerEntityIds: ["island"],
      holeEntityIds: [],
      status: "valid"
    });
    for (const candidate of result.candidates) {
      const profile: SketchRegionsProfileRef = {
        kind: "regions",
        sketchId: source.id,
        regions: [candidate.region]
      };
      expect(validateV22RegionSource(profile, source).ok).toBe(true);
      expect(candidate.candidateKey).toBe(
        JSON.stringify([
          "region",
          candidate.containmentDepth,
          candidate.outerLoopKey,
          candidate.holeLoopKeys
        ])
      );
    }
  });

  it("discovers whole line and arc components without virtual intersections", () => {
    const source = sketch(
      line("line_a", [-4, -4], [4, -4]),
      line("line_b", [4, -4], [4, 4]),
      line("line_c", [4, 4], [-4, 4]),
      line("line_d", [-4, 4], [-4, -4]),
      arc("arc_a", [20, 0], 3, 0, 180),
      arc("arc_b", [20, 0], 3, 180, 180)
    );
    const result = response(source);

    expect(result.status).toBe("ready");
    expect(result.candidateCount).toBe(2);
    expect(
      result.candidates.map((candidate) => candidate.outerEntityIds)
    ).toEqual(
      expect.arrayContaining([
        ["line_a", "line_b", "line_c", "line_d"],
        ["arc_a", "arc_b"]
      ])
    );
    expect(
      result.candidates.every((candidate) => candidate.status === "valid")
    ).toBe(true);
  });

  it("keeps unresolved components in diagnostics and never invents a partial ref", () => {
    const source = sketch(
      circle("valid", [0, 0], 2),
      line("open_a", [10, 0], [12, 0]),
      line("open_b", [12, 0], [14, 1])
    );
    const result = response(source);

    expect(result.status).toBe("ready");
    expect(result.candidateCount).toBe(1);
    expect(result.candidates[0]!.outerEntityIds).toEqual(["valid"]);
    expect(diagnosticCodes(result)).toContain("SKETCH_REGION_LOOP_OPEN");
    expect(
      result.candidates.some((candidate) =>
        candidate.outerEntityIds.includes("open_a")
      )
    ).toBe(false);
  });

  it("returns exact invalid loop-backed candidates for boundary conflicts", () => {
    const result = response(
      sketch(circle("left", [-1, 0], 3), circle("right", [1, 0], 3))
    );

    expect(result.status).toBe("blocked");
    expect(result.candidateCount).toBe(2);
    expect(
      result.candidates.every((candidate) => candidate.status === "invalid")
    ).toBe(true);
    expect(
      result.candidates.flatMap((candidate) =>
        candidate.diagnostics.map((diagnostic) => diagnostic.code)
      )
    ).toContain("SKETCH_REGION_BOUNDARY_TOUCHING");
  });

  it("propagates sibling conflicts to their parent material cell", () => {
    const result = response(
      sketch(
        rectangle("outer", [0, 0], 20, 20),
        circle("left", [-1, 0], 3),
        circle("right", [1, 0], 3)
      )
    );
    const outer = result.candidates.find((candidate) =>
      candidate.outerEntityIds.includes("outer")
    );

    expect(result.status).toBe("blocked");
    expect(outer?.status).toBe("invalid");
    expect(outer?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "SKETCH_REGION_BOUNDARY_TOUCHING"
    );
  });

  it("paginates only after constructing the canonical full result", () => {
    const source = sketch(
      circle("a", [0, 0], 1),
      circle("b", [5, 0], 2),
      circle("c", [12, 0], 3)
    );
    const first = response(source, { limit: 2 });
    expect(first.candidateCount).toBe(3);
    expect(first.candidates).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    expect(first.nextAfterCandidateKey).toBe(
      first.candidates.at(-1)!.candidateKey
    );

    const second = response(source, {
      limit: 2,
      afterCandidateKey: first.nextAfterCandidateKey,
      sourceRevision: first.sourceRevision
    });
    expect(second.candidates).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    expect([...first.candidates, ...second.candidates]).toHaveLength(3);

    const unknown = response(source, {
      afterCandidateKey: "unknown",
      sourceRevision: first.sourceRevision
    });
    expect(unknown.status).toBe("blocked");
    expect(unknown.candidateCount).toBe(3);
    expect(unknown.candidates).toEqual([]);
    expect(diagnosticCodes(unknown)).toContain("SKETCH_REGION_CURSOR_INVALID");
  });

  it("binds paging revisions to the normalized narrowing and relevant source", () => {
    const source = sketch(circle("a", [0, 0], 1), circle("b", [5, 0], 1));
    const full = response(source, { limit: 1 });
    const narrowed = response(source, {
      entityIds: ["a"],
      limit: 1,
      afterCandidateKey: full.nextAfterCandidateKey,
      sourceRevision: full.sourceRevision
    });
    expect(narrowed.status).toBe("blocked");
    expect(diagnosticCodes(narrowed)).toContain(
      "SKETCH_REGION_SOURCE_REVISION_STALE"
    );

    const omitted = createSketchRegionSourceIdentities(source);
    const empty = createSketchRegionSourceIdentities(source, []);
    const reordered = createSketchRegionSourceIdentities(source, ["b", "a"]);
    const ordered = createSketchRegionSourceIdentities(source, ["a", "b"]);
    expect(omitted.sourceRevision).not.toBe(empty.sourceRevision);
    expect(reordered.sourceRevision).toBe(ordered.sourceRevision);
    expect(reordered.sourceFingerprint).toBe(omitted.sourceFingerprint);

    const changed = createSketchRegionSourceIdentities(
      sketch(circle("a", [0, 0], 2), circle("b", [5, 0], 1))
    );
    expect(changed.sourceFingerprint).not.toBe(omitted.sourceFingerprint);

    const reorderedSource = sketch(
      circle("b", [5, 0], 1),
      circle("a", [0, 0], 1)
    );
    expect(
      createSketchRegionSourceIdentities(reorderedSource).sourceFingerprint
    ).toBe(omitted.sourceFingerprint);
    const withIrrelevantPoint = sketch(
      circle("a", [0, 0], 1),
      circle("b", [5, 0], 1),
      {
        id: "point",
        kind: "point",
        point: [100, 100],
        construction: false
      }
    );
    expect(
      createSketchRegionSourceIdentities(withIrrelevantPoint).sourceFingerprint
    ).toBe(omitted.sourceFingerprint);
  });

  it("rejects invalid narrowing before discovery", () => {
    const source = sketch(circle("ready", [0, 0], 1), {
      id: "point",
      kind: "point",
      point: [2, 2],
      construction: false
    });
    const missing = response(source, { entityIds: ["missing"] });
    expect(missing.candidates).toEqual([]);
    expect(diagnosticCodes(missing)).toContain("SKETCH_REGION_ENTITY_MISSING");

    const mixedMissing = response(source, {
      entityIds: ["ready", "missing"]
    });
    expect(mixedMissing.status).toBe("blocked");
    expect(mixedMissing.candidates).toEqual([]);
    expect(diagnosticCodes(mixedMissing)).toContain(
      "SKETCH_REGION_ENTITY_MISSING"
    );
    expect(diagnosticCodes(mixedMissing)).not.toContain(
      "SKETCH_REGION_ENTITY_REPEATED"
    );

    const unsupported = response(source, { entityIds: ["point"] });
    expect(unsupported.candidates).toEqual([]);
    expect(diagnosticCodes(unsupported)).toContain(
      "SKETCH_REGION_ENTITY_UNSUPPORTED"
    );

    const duplicate = response(source, { entityIds: ["ready", "ready"] });
    expect(duplicate.candidates).toEqual([]);
    expect(diagnosticCodes(duplicate)).toContain(
      "SKETCH_REGION_ENTITY_REPEATED"
    );
  });

  it("accepts the exact candidate cap and blocks cap plus one without partial output", () => {
    const limit = CAD_V19_RESOURCE_LIMITS.maxDiscoveredCandidateRegions;
    const values = Array.from({ length: limit + 1 }, (_, index) =>
      circle(`circle_${String(index).padStart(3, "0")}`, [index * 3, 0], 0.5)
    );
    const atLimit = response(sketch(...values.slice(0, limit)));
    expect(atLimit.status).toBe("ready");
    expect(atLimit.candidateCount).toBe(limit);
    expect(atLimit.candidates).toHaveLength(
      CAD_V19_RESOURCE_LIMITS.maxRegionCandidatesPerPage
    );

    const overLimit = response(sketch(...values));
    expect(overLimit.status).toBe("blocked");
    expect(overLimit.candidateCount).toBe(0);
    expect(overLimit.candidates).toEqual([]);
    expect(diagnosticCodes(overLimit)).toContain(
      "SKETCH_REGION_COMPLEXITY_LIMIT"
    );
  });

  it("accepts the exact analytic visit cap and blocks the first excess visit", () => {
    const source = sketch();
    const atLimit = analyzeV22RegionDiscoveryLoops(
      source,
      [],
      CAD_V19_RESOURCE_LIMITS.maxCandidatePairEdgeVisits
    );
    const overLimit = analyzeV22RegionDiscoveryLoops(
      source,
      [],
      CAD_V19_RESOURCE_LIMITS.maxCandidatePairEdgeVisits + 1
    );

    expect(atLimit.ok).toBe(true);
    expect(atLimit.complexity.predicateVisitCount).toBe(
      CAD_V19_RESOURCE_LIMITS.maxCandidatePairEdgeVisits
    );
    expect(overLimit.ok).toBe(false);
    expect(overLimit.loops).toEqual([]);
    expect(overLimit.issues.map((issue) => issue.code)).toEqual([
      "SKETCH_REGION_COMPLEXITY_LIMIT"
    ]);
  });
});
