import { describe, expect, it } from "vitest";
import {
  validateSketchProfilePathQueryResponse,
  type SketchProfilePathQueryResponse
} from "@web-cad/cad-protocol";

import {
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProject
} from "./index";

function addSketch(
  engine: CadEngine,
  id: string,
  plane: "XY" | "XZ" | "YZ" = "XY"
): void {
  engine.apply({ op: "sketch.create", id, name: id, plane });
}

function addSquare(
  engine: CadEngine,
  sketchId: string,
  prefix: string,
  min: number,
  max: number,
  order = [2, 0, 3, 1]
): void {
  const lines = [
    { id: `${prefix}a`, start: [min, min] as const, end: [max, min] as const },
    { id: `${prefix}b`, start: [max, min] as const, end: [max, max] as const },
    { id: `${prefix}c`, start: [max, max] as const, end: [min, max] as const },
    { id: `${prefix}d`, start: [min, max] as const, end: [min, min] as const }
  ];
  engine.applyBatch(
    order.map((index) => ({
      op: "sketch.addLine" as const,
      sketchId,
      ...lines[index]!
    }))
  );
}

function addBodyTopologyAnchor(
  engine: CadEngine,
  bodyId: string,
  sourceFeatureId: string,
  anchorId = "target-anchor"
): void {
  engine.apply({
    op: "topology.checkpoint.create",
    checkpointId: "target-checkpoint",
    bodyId,
    sourceFeatureId,
    sourceIdentity: {
      algorithm: "partbench-source-v1",
      sha256: "1111111111111111111111111111111111111111111111111111111111111111"
    },
    status: "active"
  });
  engine.apply({
    op: "topology.anchor.create",
    anchorId,
    entityKind: "body",
    bodyId,
    checkpointId: "target-checkpoint",
    checkpointEntityId: "checkpoint-target-body",
    sourceFeatureId,
    stableId: `generated:body:${bodyId}`,
    sourceSemanticRole: "source body",
    signatureHash: "target_body_signature"
  });
}

function query<T extends SketchProfilePathQueryResponse>(
  engine: CadEngine,
  request: Parameters<CadEngine["executeQuery"]>[0]
): T {
  const response = engine.executeQuery(request);
  if (!response.ok) throw new Error(response.error.message);
  const validation = validateSketchProfilePathQueryResponse(response);
  expect(validation).toEqual({ ok: true, value: response });
  return response as T;
}

function sourceState(engine: CadEngine) {
  const project = exportCadProject(engine);
  return {
    project,
    snapshot: engine.createSnapshot(),
    identity: createCadProjectSourceIdentity(project)
  };
}

describe("V17 profile and path queries", () => {
  it("discovers entity and counterclockwise wire profiles deterministically without mutation", () => {
    const first = new CadEngine();
    const second = new CadEngine();
    for (const engine of [first, second]) {
      addSketch(engine, "sketch");
      engine.apply({
        op: "sketch.addRectangle",
        sketchId: "sketch",
        id: "rectangle",
        center: [4, 4],
        width: 2,
        height: 3
      });
      engine.apply({
        op: "sketch.addCircle",
        sketchId: "sketch",
        id: "guide",
        center: [8, 8],
        radius: 1,
        construction: true
      });
    }
    addSquare(first, "sketch", "", 0, 1, [2, 0, 3, 1]);
    addSquare(second, "sketch", "", 0, 1, [1, 3, 0, 2]);

    const before = sourceState(first);
    const firstResponse = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileCandidates" }
      >
    >(first, {
      version: "cadops.v1",
      query: { query: "sketch.profileCandidates", sketchId: "sketch" }
    });
    const secondResponse = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileCandidates" }
      >
    >(second, {
      version: "cadops.v1",
      query: { query: "sketch.profileCandidates", sketchId: "sketch" }
    });

    expect(sourceState(first)).toEqual(before);
    expect(firstResponse.candidates).toEqual(secondResponse.candidates);
    expect(
      firstResponse.candidates.map((candidate) => candidate.profile.kind)
    ).toEqual(["wire", "entity"]);
    expect(firstResponse.candidates[0]).toMatchObject({
      area: 1,
      signedArea: 1,
      orientation: "counterclockwise",
      intersectionStatus: "clear",
      dependencies: {
        sketchIds: ["sketch"],
        orderedEntityIds: ["a", "b", "c", "d"]
      }
    });
    expect(
      firstResponse.candidates.map((candidate) => candidate.profile)
    ).toEqual([
      {
        kind: "wire",
        sketchId: "sketch",
        segments: ["a", "b", "c", "d"].map((entityId) => ({
          entityId,
          orientation: "forward"
        }))
      },
      { kind: "entity", sketchId: "sketch", entityId: "rectangle" }
    ]);
    expect(firstResponse.constructionExclusions).toMatchObject([
      { entityId: "guide", entityKind: "circle" }
    ]);
  });

  it("normalizes an explicit clockwise profile and reports exact tolerance joins", () => {
    const engine = new CadEngine();
    addSketch(engine, "sketch");
    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch",
        id: "a",
        start: [0, 0],
        end: [1, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch",
        id: "b",
        start: [1, 0],
        end: [1, 1]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch",
        id: "c",
        start: [1, 1],
        end: [0, 1]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch",
        id: "d",
        start: [0, 1],
        end: [0, 0.00000005]
      }
    ]);
    const response = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile: {
          kind: "wire",
          sketchId: "sketch",
          segments: [
            { entityId: "a", orientation: "reverse" },
            { entityId: "d", orientation: "reverse" },
            { entityId: "c", orientation: "reverse" },
            { entityId: "b", orientation: "reverse" }
          ]
        },
        consumer: { featureKind: "extrude", operationMode: "newBody" }
      }
    });
    expect(response).toMatchObject({
      status: "ready",
      orientation: "counterclockwise",
      orientationNormalized: true,
      intersectionStatus: "clear"
    });
    expect(response.area).toBeCloseTo(0.999999975, 12);
    expect(response.signedArea).toBeCloseTo(0.999999975, 12);
    expect(response.joins.some((join) => join.coincidentWithinTolerance)).toBe(
      true
    );
    expect(response.normalizedProfile?.kind).toBe("wire");
  });

  it("discovers a two-arc closed profile using analytic area and finite supports", () => {
    const engine = new CadEngine();
    addSketch(engine, "arcs");
    engine.applyBatch([
      {
        op: "sketch.addArc",
        sketchId: "arcs",
        id: "a-upper",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 0,
          sweepAngleDegrees: 180
        }
      },
      {
        op: "sketch.addArc",
        sketchId: "arcs",
        id: "b-lower",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 180,
          sweepAngleDegrees: 180
        }
      }
    ]);
    const response = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileCandidates" }
      >
    >(engine, {
      version: "cadops.v1",
      query: { query: "sketch.profileCandidates", sketchId: "arcs" }
    });
    expect(response.candidateCount).toBe(1);
    expect(response.candidates[0]).toMatchObject({
      profile: { kind: "wire" },
      intersectionStatus: "clear",
      joinCount: 2
    });
    expect(response.candidates[0]!.area).toBeCloseTo(Math.PI, 12);
  });

  it("blocks entity profiles below minimum area with current diagnostics", () => {
    const engine = new CadEngine();
    addSketch(engine, "tiny");
    engine.applyBatch([
      {
        op: "sketch.addRectangle",
        sketchId: "tiny",
        id: "tiny-rectangle",
        center: [0, 0],
        width: 0.0000005,
        height: 0.0000001
      },
      {
        op: "sketch.addCircle",
        sketchId: "tiny",
        id: "tiny-circle",
        center: [1, 0],
        radius: 0.0000002
      },
      {
        op: "sketch.addRectangle",
        sketchId: "tiny",
        id: "boundary-rectangle",
        center: [2, 0],
        width: 0.000001,
        height: 0.000001
      },
      {
        op: "sketch.addCircle",
        sketchId: "tiny",
        id: "boundary-circle",
        center: [3, 0],
        radius: Math.sqrt(0.000000000001 / Math.PI) * (1 + 1e-10)
      }
    ]);

    for (const entityId of ["tiny-rectangle", "tiny-circle"]) {
      const response = query<
        Extract<
          SketchProfilePathQueryResponse,
          { query: "sketch.profileReadiness" }
        >
      >(engine, {
        version: "cadops.v1",
        query: {
          query: "sketch.profileReadiness",
          profile: { kind: "entity", sketchId: "tiny", entityId },
          consumer: { featureKind: "extrude", operationMode: "newBody" }
        }
      });
      expect(response.status).toBe("blocked");
      expect(response.diagnosticCount).toBe(response.diagnostics.length);
      expect(response.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        ["SKETCH_PROFILE_AREA_TOO_SMALL"]
      );
    }

    for (const entityId of ["boundary-rectangle", "boundary-circle"]) {
      const response = query<
        Extract<
          SketchProfilePathQueryResponse,
          { query: "sketch.profileReadiness" }
        >
      >(engine, {
        version: "cadops.v1",
        query: {
          query: "sketch.profileReadiness",
          profile: { kind: "entity", sketchId: "tiny", entityId },
          consumer: { featureKind: "extrude", operationMode: "newBody" }
        }
      });
      expect(response.status).toBe("ready");
      expect(response.area).toBeCloseTo(0.000000000001, 18);
      expect(response.diagnostics).toEqual([]);
    }
  });

  it("rejects branches, gaps, overlaps, self-intersections, and nested loops explicitly", () => {
    const branch = new CadEngine();
    addSketch(branch, "branch");
    branch.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "branch",
        id: "a",
        start: [0, 0],
        end: [1, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "branch",
        id: "b",
        start: [1, 0],
        end: [2, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "branch",
        id: "c",
        start: [1, 0],
        end: [1, 1]
      }
    ]);
    const branchResponse = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileCandidates" }
      >
    >(branch, {
      version: "cadops.v1",
      query: { query: "sketch.profileCandidates", sketchId: "branch" }
    });
    expect(
      branchResponse.rejectedComponents[0]?.diagnostics.map(
        (value) => value.code
      )
    ).toContain("SKETCH_PROFILE_BRANCHING");

    const invalid = new CadEngine();
    addSketch(invalid, "invalid");
    invalid.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "invalid",
        id: "a",
        start: [0, 0],
        end: [2, 2]
      },
      {
        op: "sketch.addLine",
        sketchId: "invalid",
        id: "b",
        start: [2, 2],
        end: [0, 2]
      },
      {
        op: "sketch.addLine",
        sketchId: "invalid",
        id: "c",
        start: [0, 2],
        end: [2, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "invalid",
        id: "d",
        start: [2, 0],
        end: [0, 0]
      }
    ]);
    const crossing = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(invalid, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile: {
          kind: "wire",
          sketchId: "invalid",
          segments: ["a", "b", "c", "d"].map((entityId) => ({
            entityId,
            orientation: "forward"
          }))
        },
        consumer: { featureKind: "revolve", operationMode: "newBody" }
      }
    });
    expect(crossing.status).toBe("blocked");
    expect(crossing.diagnostics.map((value) => value.code)).toContain(
      "SKETCH_PROFILE_SELF_INTERSECTING"
    );

    const overlap = new CadEngine();
    addSketch(overlap, "overlap");
    overlap.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "overlap",
        id: "out",
        start: [0, 0],
        end: [1, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "overlap",
        id: "back",
        start: [1, 0],
        end: [0, 0]
      }
    ]);
    const opposing = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(overlap, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile: {
          kind: "wire",
          sketchId: "overlap",
          segments: [
            { entityId: "out", orientation: "forward" },
            { entityId: "back", orientation: "forward" }
          ]
        },
        consumer: { featureKind: "extrude", operationMode: "newBody" }
      }
    });
    expect(opposing.status).toBe("blocked");
    expect(opposing.diagnostics.map((value) => value.code)).toEqual(
      expect.arrayContaining([
        "SKETCH_PROFILE_OVERLAPPING",
        "SKETCH_PROFILE_AREA_TOO_SMALL"
      ])
    );

    const gap = new CadEngine();
    addSketch(gap, "gap");
    gap.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "gap",
        id: "a",
        start: [0, 0],
        end: [1, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "gap",
        id: "b",
        start: [1, 0],
        end: [0, 1]
      },
      {
        op: "sketch.addLine",
        sketchId: "gap",
        id: "c",
        start: [0, 1],
        end: [0, 0.000000101]
      }
    ]);
    const open = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(gap, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile: {
          kind: "wire",
          sketchId: "gap",
          segments: ["a", "b", "c"].map((entityId) => ({
            entityId,
            orientation: "forward"
          }))
        },
        consumer: { featureKind: "extrude", operationMode: "newBody" }
      }
    });
    expect(open.status).toBe("blocked");
    expect(open.diagnostics.map((value) => value.code)).toContain(
      "SKETCH_PROFILE_OPEN"
    );

    const nested = new CadEngine();
    addSketch(nested, "nested");
    addSquare(nested, "nested", "outer-", 0, 10);
    addSquare(nested, "nested", "inner-", 2, 3);
    const nestedResponse = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileCandidates" }
      >
    >(nested, {
      version: "cadops.v1",
      query: { query: "sketch.profileCandidates", sketchId: "nested" }
    });
    expect(nestedResponse.candidateCount).toBe(0);
    expect(nestedResponse.rejectedComponents).toHaveLength(2);
    expect(nestedResponse.diagnostics.map((value) => value.code)).toContain(
      "SKETCH_PROFILE_INNER_LOOP_UNSUPPORTED"
    );
    const nestedReadiness = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(nested, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile: {
          kind: "wire",
          sketchId: "nested",
          segments: ["a", "b", "c", "d"].map((suffix) => ({
            entityId: `outer-${suffix}`,
            orientation: "forward"
          }))
        },
        consumer: { featureKind: "extrude", operationMode: "newBody" }
      }
    });
    expect(nestedReadiness.status).toBe("blocked");
    expect(nestedReadiness.diagnostics.map((value) => value.code)).toContain(
      "SKETCH_PROFILE_INNER_LOOP_UNSUPPORTED"
    );
  });

  it("discovers both orientations of construction-capable G1 paths and rejects G0 chains", () => {
    const engine = new CadEngine();
    addSketch(engine, "paths");
    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "paths",
        id: "line",
        start: [0, 0],
        end: [1, 0],
        construction: true
      },
      {
        op: "sketch.addArc",
        sketchId: "paths",
        id: "arc",
        construction: true,
        definition: {
          kind: "centerAngles",
          center: [1, 1],
          radius: 1,
          startAngleDegrees: 270,
          sweepAngleDegrees: 90
        }
      }
    ]);
    const candidates = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.pathCandidates" }
      >
    >(engine, {
      version: "cadops.v1",
      query: { query: "sketch.pathCandidates", sketchId: "paths" }
    });
    expect(candidates.candidateCount).toBe(6);
    const chains = candidates.candidates
      .map((candidate) => candidate.path)
      .filter((path) => path.kind === "chain");
    expect(chains).toEqual([
      {
        kind: "chain",
        sketchId: "paths",
        segments: [
          { entityId: "arc", orientation: "reverse" },
          { entityId: "line", orientation: "reverse" }
        ]
      },
      {
        kind: "chain",
        sketchId: "paths",
        segments: [
          { entityId: "line", orientation: "forward" },
          { entityId: "arc", orientation: "forward" }
        ]
      }
    ]);
    expect(candidates.rejectedComponentCount).toBe(0);

    const reverseInsertion = new CadEngine();
    addSketch(reverseInsertion, "paths");
    reverseInsertion.applyBatch([
      {
        op: "sketch.addArc",
        sketchId: "paths",
        id: "arc",
        construction: true,
        definition: {
          kind: "centerAngles",
          center: [1, 1],
          radius: 1,
          startAngleDegrees: 270,
          sweepAngleDegrees: 90
        }
      },
      {
        op: "sketch.addLine",
        sketchId: "paths",
        id: "line",
        start: [0, 0],
        end: [1, 0],
        construction: true
      }
    ]);
    const reverseCandidates = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.pathCandidates" }
      >
    >(reverseInsertion, {
      version: "cadops.v1",
      query: { query: "sketch.pathCandidates", sketchId: "paths" }
    });
    expect(reverseCandidates.candidates).toEqual(candidates.candidates);

    const g0 = new CadEngine();
    addSketch(g0, "g0");
    g0.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "g0",
        id: "a",
        start: [0, 0],
        end: [1, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "g0",
        id: "b",
        start: [1, 0],
        end: [1, 1]
      }
    ]);
    const rejected = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.pathCandidates" }
      >
    >(g0, {
      version: "cadops.v1",
      query: { query: "sketch.pathCandidates", sketchId: "g0" }
    });
    expect(
      rejected.candidates.filter((candidate) => candidate.path.kind === "chain")
    ).toHaveLength(0);
    expect(
      rejected.rejectedComponents[0]?.diagnostics.map((value) => value.code)
    ).toContain("SKETCH_PATH_JOIN_NOT_TANGENT");
  });

  it("reports branching and analytic self-intersection for path selections", () => {
    const branch = new CadEngine();
    addSketch(branch, "branch-path");
    branch.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "branch-path",
        id: "a",
        start: [0, 0],
        end: [1, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "branch-path",
        id: "b",
        start: [1, 0],
        end: [2, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "branch-path",
        id: "c",
        start: [1, 0],
        end: [1, 1]
      }
    ]);
    const branchResponse = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.pathCandidates" }
      >
    >(branch, {
      version: "cadops.v1",
      query: { query: "sketch.pathCandidates", sketchId: "branch-path" }
    });
    expect(
      branchResponse.rejectedComponents[0]?.diagnostics.map(
        (diagnostic) => diagnostic.code
      )
    ).toContain("SKETCH_PATH_BRANCHING");
    expect(branchResponse.rejectedComponents[0]).toMatchObject({
      connectionStatus: "branching",
      entityIds: ["a", "b", "c"],
      diagnostics: [
        {
          code: "SKETCH_PATH_BRANCHING",
          severity: "blocker",
          sketchId: "branch-path"
        }
      ]
    });

    const crossing = new CadEngine();
    addSketch(crossing, "crossing-path");
    crossing.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "crossing-path",
        id: "a",
        start: [0, 0],
        end: [2, 2]
      },
      {
        op: "sketch.addLine",
        sketchId: "crossing-path",
        id: "b",
        start: [2, 2],
        end: [0, 2]
      },
      {
        op: "sketch.addLine",
        sketchId: "crossing-path",
        id: "c",
        start: [0, 2],
        end: [2, 0]
      }
    ]);
    const crossingResponse = query<
      Extract<SketchProfilePathQueryResponse, { query: "sketch.pathReadiness" }>
    >(crossing, {
      version: "cadops.v1",
      query: {
        query: "sketch.pathReadiness",
        path: {
          kind: "chain",
          sketchId: "crossing-path",
          segments: ["a", "b", "c"].map((entityId) => ({
            entityId,
            orientation: "forward"
          }))
        }
      }
    });
    expect(crossingResponse.status).toBe("blocked");
    expect(crossingResponse.selfIntersectionStatus).toBe("self-intersecting");
    expect(
      crossingResponse.diagnostics.map((diagnostic) => diagnostic.code)
    ).toContain("SKETCH_PATH_SELF_INTERSECTING");

    const overlap = new CadEngine();
    addSketch(overlap, "overlapping-arcs");
    overlap.applyBatch([
      {
        op: "sketch.addArc",
        sketchId: "overlapping-arcs",
        id: "a",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 0,
          sweepAngleDegrees: 270
        }
      },
      {
        op: "sketch.addArc",
        sketchId: "overlapping-arcs",
        id: "b",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 270,
          sweepAngleDegrees: 180
        }
      }
    ]);
    const overlapResponse = query<
      Extract<SketchProfilePathQueryResponse, { query: "sketch.pathReadiness" }>
    >(overlap, {
      version: "cadops.v1",
      query: {
        query: "sketch.pathReadiness",
        path: {
          kind: "chain",
          sketchId: "overlapping-arcs",
          segments: ["a", "b"].map((entityId) => ({
            entityId,
            orientation: "forward"
          }))
        }
      }
    });
    expect(overlapResponse).toMatchObject({
      status: "blocked",
      connectionStatus: "connected",
      tangentStatus: "tangent",
      selfIntersectionStatus: "self-intersecting"
    });
    expect(
      overlapResponse.diagnostics.map((diagnostic) => diagnostic.code)
    ).toContain("SKETCH_PATH_SELF_INTERSECTING");

    const extraCrossing = new CadEngine();
    addSketch(extraCrossing, "adjacent-crossing");
    extraCrossing.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "adjacent-crossing",
        id: "line",
        start: [-2, 0],
        end: [1, 0]
      },
      {
        op: "sketch.addArc",
        sketchId: "adjacent-crossing",
        id: "arc",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 0,
          sweepAngleDegrees: 180
        }
      }
    ]);
    const extraCrossingResponse = query<
      Extract<SketchProfilePathQueryResponse, { query: "sketch.pathReadiness" }>
    >(extraCrossing, {
      version: "cadops.v1",
      query: {
        query: "sketch.pathReadiness",
        path: {
          kind: "chain",
          sketchId: "adjacent-crossing",
          segments: [
            { entityId: "line", orientation: "forward" },
            { entityId: "arc", orientation: "forward" }
          ]
        }
      }
    });
    expect(extraCrossingResponse.selfIntersectionStatus).toBe(
      "self-intersecting"
    );

    const valid = new CadEngine();
    addSketch(valid, "valid-lines");
    addSketch(valid, "valid-line-arc");
    addSketch(valid, "valid-arcs");
    valid.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "valid-lines",
        id: "a",
        start: [0, 0],
        end: [1, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "valid-lines",
        id: "b",
        start: [1, 0],
        end: [2, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "valid-line-arc",
        id: "a",
        start: [0, 0],
        end: [1, 0]
      },
      {
        op: "sketch.addArc",
        sketchId: "valid-line-arc",
        id: "b",
        definition: {
          kind: "centerAngles",
          center: [1, 1],
          radius: 1,
          startAngleDegrees: 270,
          sweepAngleDegrees: 90
        }
      },
      {
        op: "sketch.addArc",
        sketchId: "valid-arcs",
        id: "a",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 0,
          sweepAngleDegrees: 90
        }
      },
      {
        op: "sketch.addArc",
        sketchId: "valid-arcs",
        id: "b",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 90,
          sweepAngleDegrees: 90
        }
      }
    ]);
    for (const sketchId of ["valid-lines", "valid-line-arc", "valid-arcs"]) {
      const validResponse = query<
        Extract<
          SketchProfilePathQueryResponse,
          { query: "sketch.pathReadiness" }
        >
      >(valid, {
        version: "cadops.v1",
        query: {
          query: "sketch.pathReadiness",
          path: {
            kind: "chain",
            sketchId,
            segments: ["a", "b"].map((entityId) => ({
              entityId,
              orientation: "forward"
            }))
          }
        }
      });
      expect(validResponse).toMatchObject({
        status: "ready",
        connectionStatus: "connected",
        tangentStatus: "tangent",
        selfIntersectionStatus: "clear"
      });
    }
  });

  it("reports consumer and target compatibility without enabling later feature commands", () => {
    const engine = new CadEngine();
    addSketch(engine, "profiles");
    engine.applyBatch([
      {
        op: "sketch.addRectangle",
        sketchId: "profiles",
        id: "target-profile",
        center: [0, 0],
        width: 4,
        height: 4
      },
      {
        op: "feature.extrude",
        id: "target-feature",
        bodyId: "target-body",
        sketchId: "profiles",
        entityId: "target-profile",
        depth: 2
      }
    ]);
    addSquare(engine, "profiles", "tool-", 5, 6);
    const profile = {
      kind: "wire" as const,
      sketchId: "profiles",
      segments: ["a", "b", "c", "d"].map((suffix) => ({
        entityId: `tool-${suffix}`,
        orientation: "forward" as const
      }))
    };

    const addReady = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile,
        consumer: {
          featureKind: "extrude",
          operationMode: "add",
          targetBodyId: "target-body"
        }
      }
    });
    expect(addReady).toMatchObject({
      status: "ready",
      consumerCompatibility: { status: "ready" },
      targetCompatibility: { status: "ready", targetBodyId: "target-body" }
    });

    engine.applyBatch([
      {
        op: "scene.createBox",
        id: "box",
        dimensions: { width: 1, height: 1, depth: 1 }
      },
      {
        op: "scene.createCylinder",
        id: "cylinder",
        dimensions: { radius: 1, height: 1 }
      },
      {
        op: "scene.createSphere",
        id: "sphere",
        dimensions: { radius: 1 }
      },
      {
        op: "scene.createCone",
        id: "cone",
        dimensions: { radius: 1, height: 1 }
      },
      {
        op: "scene.createTorus",
        id: "torus",
        dimensions: { majorRadius: 2, minorRadius: 0.5 }
      }
    ]);
    for (const primitiveId of ["box", "cylinder", "sphere", "cone", "torus"]) {
      for (const operationMode of ["add", "cut"] as const) {
        const primitive = query<
          Extract<
            SketchProfilePathQueryResponse,
            { query: "sketch.profileReadiness" }
          >
        >(engine, {
          version: "cadops.v1",
          query: {
            query: "sketch.profileReadiness",
            profile,
            consumer: {
              featureKind: "extrude",
              operationMode,
              targetBodyId: `body:${primitiveId}`
            }
          }
        });
        expect(primitive).toMatchObject({
          status: "blocked",
          targetCompatibility: {
            status: "unsupported",
            targetBodyId: `body:${primitiveId}`,
            diagnostics: [{ code: "TARGET_BODY_NOT_SUPPORTED" }]
          }
        });
      }
    }
    const trulyMissing = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile,
        consumer: {
          featureKind: "extrude",
          operationMode: "cut",
          targetBodyId: "body:missing"
        }
      }
    });
    expect(trulyMissing).toMatchObject({
      status: "blocked",
      targetCompatibility: {
        status: "unsupported",
        targetBodyId: "body:missing",
        diagnostics: [{ code: "BODY_NOT_FOUND" }]
      }
    });

    addBodyTopologyAnchor(engine, "target-body", "target-feature");
    const anchorReady = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile,
        consumer: {
          featureKind: "extrude",
          operationMode: "add",
          targetTopologyAnchorId: "target-anchor"
        }
      }
    });
    expect(anchorReady).toMatchObject({
      status: "ready",
      targetCompatibility: {
        status: "ready",
        targetBodyId: "target-body",
        targetTopologyAnchorId: "target-anchor"
      }
    });

    const anchoredDocument = engine.getDocument();
    const staleAnchorEngine = new CadEngine({
      ...anchoredDocument,
      topologyIdentity: {
        ...anchoredDocument.topologyIdentity!,
        checkpoints: anchoredDocument.topologyIdentity!.checkpoints.map(
          (checkpoint) => ({ ...checkpoint, status: "stale" as const })
        )
      }
    });
    const staleAnchor = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(staleAnchorEngine, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile,
        consumer: {
          featureKind: "extrude",
          operationMode: "cut",
          targetTopologyAnchorId: "target-anchor"
        }
      }
    });
    expect(staleAnchor).toMatchObject({
      status: "blocked",
      targetCompatibility: {
        status: "stale",
        targetBodyId: "target-body",
        targetTopologyAnchorId: "target-anchor"
      }
    });

    const wrongKindAnchorEngine = new CadEngine({
      ...anchoredDocument,
      topologyIdentity: {
        ...anchoredDocument.topologyIdentity!,
        anchors: anchoredDocument.topologyIdentity!.anchors.map((anchor) => ({
          ...anchor,
          entityKind: "edge" as const
        }))
      }
    });
    const wrongKindAnchor = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(wrongKindAnchorEngine, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile,
        consumer: {
          featureKind: "extrude",
          operationMode: "cut",
          targetTopologyAnchorId: "target-anchor"
        }
      }
    });
    expect(wrongKindAnchor).toMatchObject({
      status: "blocked",
      targetCompatibility: {
        status: "unsupported",
        targetBodyId: "target-body",
        targetTopologyAnchorId: "target-anchor"
      }
    });

    const missingAnchor = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile,
        consumer: {
          featureKind: "extrude",
          operationMode: "cut",
          targetTopologyAnchorId: "missing-anchor"
        }
      }
    });
    expect(missingAnchor).toMatchObject({
      status: "blocked",
      targetCompatibility: {
        status: "missing",
        targetTopologyAnchorId: "missing-anchor"
      }
    });

    engine.applyBatch([
      {
        op: "sketch.addRectangle",
        sketchId: "profiles",
        id: "anchor-tool",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "anchor-add-feature",
        bodyId: "anchor-add-body",
        sketchId: "profiles",
        entityId: "anchor-tool",
        depth: 1,
        operationMode: "add",
        targetTopologyAnchorId: "target-anchor"
      }
    ]);
    const advancedAnchor = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile,
        consumer: {
          featureKind: "extrude",
          operationMode: "cut",
          targetTopologyAnchorId: "target-anchor"
        }
      }
    });
    expect(advancedAnchor).toMatchObject({
      status: "ready",
      targetCompatibility: {
        status: "ready",
        targetBodyId: "anchor-add-body",
        targetTopologyAnchorId: "target-anchor"
      }
    });

    const consumedDirect = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile,
        consumer: {
          featureKind: "extrude",
          operationMode: "cut",
          targetBodyId: "target-body"
        }
      }
    });
    expect(consumedDirect).toMatchObject({
      status: "blocked",
      targetCompatibility: {
        status: "unsupported",
        targetBodyId: "target-body"
      }
    });

    const missingTarget = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile,
        consumer: { featureKind: "extrude", operationMode: "cut" }
      }
    });
    expect(missingTarget).toMatchObject({
      status: "blocked",
      targetCompatibility: { status: "missing" }
    });

    const sweepUnsupported = query<
      Extract<
        SketchProfilePathQueryResponse,
        { query: "sketch.profileReadiness" }
      >
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.profileReadiness",
        profile,
        consumer: { featureKind: "sweep", operationMode: "newBody" }
      }
    });
    expect(sweepUnsupported).toMatchObject({
      status: "blocked",
      consumerCompatibility: { status: "blocked" }
    });
    expect(sweepUnsupported.diagnostics.map((value) => value.code)).toContain(
      "SKETCH_PROFILE_CONSUMER_UNSUPPORTED"
    );
  });

  it("reports repeated, closed, unsupported, and frame-invalid path rows without source mutation", () => {
    const engine = new CadEngine();
    addSketch(engine, "profile", "XY");
    addSketch(engine, "path", "XZ");
    engine.applyBatch([
      {
        op: "sketch.addRectangle",
        sketchId: "profile",
        id: "profile-rect",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "sketch.addLine",
        sketchId: "path",
        id: "normal",
        start: [0, 0],
        end: [0, 2]
      },
      {
        op: "sketch.addLine",
        sketchId: "path",
        id: "bad-frame",
        start: [0, 0],
        end: [2, 0]
      },
      {
        op: "sketch.addArc",
        sketchId: "path",
        id: "normal-arc",
        definition: {
          kind: "centerAngles",
          center: [-1, 0],
          radius: 1,
          startAngleDegrees: 0,
          sweepAngleDegrees: 90
        }
      },
      {
        op: "sketch.addLine",
        sketchId: "path",
        id: "chain-a",
        start: [0, 0],
        end: [0, 1]
      },
      {
        op: "sketch.addLine",
        sketchId: "path",
        id: "chain-b",
        start: [0, 1],
        end: [0, 2]
      },
      {
        op: "sketch.addCircle",
        sketchId: "path",
        id: "circle",
        center: [0, 0],
        radius: 1
      }
    ]);
    const before = sourceState(engine);
    const ready = query<
      Extract<SketchProfilePathQueryResponse, { query: "sketch.pathReadiness" }>
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.pathReadiness",
        path: {
          kind: "entity",
          sketchId: "path",
          entityId: "normal",
          orientation: "forward"
        },
        sweepProfile: {
          kind: "entity",
          sketchId: "profile",
          entityId: "profile-rect"
        }
      }
    });
    expect(ready).toMatchObject({ status: "ready", frameStatus: "ready" });
    expect(sourceState(engine)).toEqual(before);

    const frameCases = [
      {
        path: {
          kind: "entity" as const,
          sketchId: "path",
          entityId: "normal-arc",
          orientation: "forward" as const
        }
      },
      {
        path: {
          kind: "chain" as const,
          sketchId: "path",
          segments: ["chain-a", "chain-b"].map((entityId) => ({
            entityId,
            orientation: "forward" as const
          }))
        }
      }
    ];
    for (const frameCase of frameCases) {
      const withProfile = query<
        Extract<
          SketchProfilePathQueryResponse,
          { query: "sketch.pathReadiness" }
        >
      >(engine, {
        version: "cadops.v1",
        query: {
          query: "sketch.pathReadiness",
          path: frameCase.path,
          sweepProfile: {
            kind: "entity",
            sketchId: "profile",
            entityId: "profile-rect"
          }
        }
      });
      expect(withProfile).toMatchObject({
        status: "ready",
        frameStatus: "ready"
      });

      const withoutProfile = query<
        Extract<
          SketchProfilePathQueryResponse,
          { query: "sketch.pathReadiness" }
        >
      >(engine, {
        version: "cadops.v1",
        query: { query: "sketch.pathReadiness", path: frameCase.path }
      });
      expect(withoutProfile).toMatchObject({
        status: "ready",
        frameStatus: "not-evaluated"
      });
    }

    const badFrame = query<
      Extract<SketchProfilePathQueryResponse, { query: "sketch.pathReadiness" }>
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.pathReadiness",
        path: {
          kind: "entity",
          sketchId: "path",
          entityId: "bad-frame",
          orientation: "forward"
        },
        sweepProfile: {
          kind: "entity",
          sketchId: "profile",
          entityId: "profile-rect"
        }
      }
    });
    expect(badFrame).toMatchObject({
      status: "blocked",
      frameStatus: "invalid"
    });
    expect(badFrame.diagnostics.map((value) => value.code)).toContain(
      "SKETCH_PATH_FRAME_INVALID"
    );

    const unsupported = query<
      Extract<SketchProfilePathQueryResponse, { query: "sketch.pathReadiness" }>
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.pathReadiness",
        path: {
          kind: "entity",
          sketchId: "path",
          entityId: "circle",
          orientation: "forward"
        }
      }
    });
    expect(unsupported.status).toBe("blocked");
    expect(unsupported.diagnostics.map((value) => value.code)).toContain(
      "SKETCH_PATH_ENTITY_UNSUPPORTED"
    );

    const repeated = query<
      Extract<SketchProfilePathQueryResponse, { query: "sketch.pathReadiness" }>
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.pathReadiness",
        path: {
          kind: "chain",
          sketchId: "path",
          segments: [
            { entityId: "normal", orientation: "forward" },
            { entityId: "normal", orientation: "reverse" }
          ]
        }
      }
    });
    expect(repeated.status).toBe("blocked");
    expect(repeated.diagnostics.map((value) => value.code)).toContain(
      "SKETCH_PATH_ENTITY_REPEATED"
    );

    const crossSketch = query<
      Extract<SketchProfilePathQueryResponse, { query: "sketch.pathReadiness" }>
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.pathReadiness",
        path: {
          kind: "entity",
          sketchId: "path",
          entityId: "profile-rect",
          orientation: "forward"
        }
      }
    });
    expect(crossSketch.status).toBe("blocked");
    expect(crossSketch.diagnostics.map((value) => value.code)).toContain(
      "SKETCH_PATH_ENTITY_MISSING"
    );

    addSketch(engine, "closed", "XZ");
    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "closed",
        id: "a",
        start: [0, 0],
        end: [1, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "closed",
        id: "b",
        start: [1, 0],
        end: [0, 1]
      },
      {
        op: "sketch.addLine",
        sketchId: "closed",
        id: "c",
        start: [0, 1],
        end: [0, 0]
      }
    ]);
    const closed = query<
      Extract<SketchProfilePathQueryResponse, { query: "sketch.pathReadiness" }>
    >(engine, {
      version: "cadops.v1",
      query: {
        query: "sketch.pathReadiness",
        path: {
          kind: "chain",
          sketchId: "closed",
          segments: ["a", "b", "c"].map((entityId) => ({
            entityId,
            orientation: "forward"
          }))
        }
      }
    });
    expect(closed.status).toBe("blocked");
    expect(closed.diagnostics.map((value) => value.code)).toContain(
      "SKETCH_PATH_CLOSED_UNSUPPORTED"
    );
  });

  it("keeps malformed envelopes and missing sketches out of successful geometry responses", () => {
    const engine = new CadEngine();
    const malformed = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.profileCandidates", sketchId: "" }
    });
    expect(malformed).toMatchObject({
      ok: false,
      error: { code: "INVALID_QUERY" }
    });

    const missing = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.pathCandidates", sketchId: "missing" }
    });
    expect(missing).toMatchObject({
      ok: false,
      query: "sketch.pathCandidates",
      error: { code: "SKETCH_NOT_FOUND", sketchId: "missing" }
    });
  });
});
