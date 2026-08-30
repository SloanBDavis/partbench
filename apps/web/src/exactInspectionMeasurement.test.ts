import { describe, expect, it } from "vitest";
import {
  bindExactInspectionTarget,
  measureExactInspectionPair,
  measureExactInspectionSingle,
  type ExactInspectionArtifact,
  type ExactInspectionIdentity
} from "./exactInspectionMeasurement";

const ARTIFACT: ExactInspectionArtifact = {
  bodyId: "body_box",
  bodySourceIdentitySignature: "src-1",
  topologySignature: "topo-1",
  metadata: {
    volume: 24,
    surfaceArea: 52,
    centroid: [0, 0, 1.5],
    bounds: { min: [-2, -1, 0], max: [2, 1, 3] },
    momentsOfInertia: { xx: 1, yy: 2, zz: 3 }
  },
  entities: [
    {
      localId: "face_top",
      kind: "face",
      signature: "sig-top",
      surfaceClass: "plane",
      area: 8,
      normal: [0, 0, 1],
      midpoint: [0, 0, 3]
    },
    {
      localId: "face_bottom",
      kind: "face",
      signature: "sig-bottom",
      surfaceClass: "plane",
      area: 8,
      normal: [0, 0, -1],
      midpoint: [0, 0, 0]
    },
    {
      localId: "face_side",
      kind: "face",
      signature: "sig-side",
      surfaceClass: "plane",
      area: 12,
      normal: [1, 0, 0],
      midpoint: [2, 0, 1.5]
    },
    {
      localId: "edge_x",
      kind: "edge",
      signature: "sig-edge",
      curveClass: "line",
      length: 4,
      midpoint: [0, -1, 0],
      axis: [1, 0, 0]
    },
    {
      localId: "edge_y",
      kind: "edge",
      signature: "sig-edge-y",
      curveClass: "line",
      length: 2,
      midpoint: [-2, 0, 0],
      axis: [0, 1, 0]
    },
    {
      localId: "vertex_a",
      kind: "vertex",
      signature: "sig-va",
      point: [-2, -1, 0]
    },
    {
      localId: "vertex_b",
      kind: "vertex",
      signature: "sig-vb",
      point: [2, -1, 0]
    }
  ]
};

function identity(
  kind: ExactInspectionIdentity["entityKind"],
  localId?: string,
  entitySignature?: string
): ExactInspectionIdentity {
  return {
    bodyId: "body_box",
    bodySourceIdentitySignature: "src-1",
    topologySignature: "topo-1",
    entityKind: kind,
    ...(localId ? { localId } : {}),
    ...(entitySignature ? { entitySignature } : {})
  };
}

describe("exact inspection measurement", () => {
  it("measures current exact body, face, edge, and vertex values", () => {
    const body = measureExactInspectionSingle(
      bindExactInspectionTarget(identity("body"), [ARTIFACT], "Box"),
      "mm"
    );
    const face = measureExactInspectionSingle(
      bindExactInspectionTarget(identity("face", "face_top", "sig-top"), [ARTIFACT]),
      "mm"
    );
    const edge = measureExactInspectionSingle(
      bindExactInspectionTarget(identity("edge", "edge_x", "sig-edge"), [ARTIFACT]),
      "mm"
    );
    const vertex = measureExactInspectionSingle(
      bindExactInspectionTarget(identity("vertex", "vertex_a", "sig-va"), [ARTIFACT]),
      "mm"
    );

    expect(body).toMatchObject({
      status: "ready",
      authority: "geometryBoundaryExact"
    });
    expect(body.rows.some((row) => row.label === "Volume")).toBe(true);
    expect(face.values[0]).toMatchObject({ label: "Area", value: 8 });
    expect(edge.values[0]).toMatchObject({ label: "Length", value: 4 });
    expect(vertex.rows[0]?.value).toContain("-2");
  });

  it("measures pair distance and planar/linear angles without approximate fallback", () => {
    const oppositeFaces = measureExactInspectionPair(
      bindExactInspectionTarget(identity("face", "face_top", "sig-top"), [ARTIFACT]),
      bindExactInspectionTarget(identity("face", "face_bottom", "sig-bottom"), [ARTIFACT]),
      "mm"
    );
    const adjacentFaces = measureExactInspectionPair(
      bindExactInspectionTarget(identity("face", "face_top", "sig-top"), [ARTIFACT]),
      bindExactInspectionTarget(identity("face", "face_side", "sig-side"), [ARTIFACT]),
      "mm"
    );
    const vertices = measureExactInspectionPair(
      bindExactInspectionTarget(identity("vertex", "vertex_a", "sig-va"), [ARTIFACT]),
      bindExactInspectionTarget(identity("vertex", "vertex_b", "sig-vb"), [ARTIFACT]),
      "mm"
    );
    const edges = measureExactInspectionPair(
      bindExactInspectionTarget(identity("edge", "edge_x", "sig-edge"), [ARTIFACT]),
      bindExactInspectionTarget(identity("edge", "edge_y", "sig-edge-y"), [ARTIFACT]),
      "mm"
    );

    expect(oppositeFaces.status).toBe("ready");
    expect(oppositeFaces.values.find((value) => value.kind === "distance")?.value).toBe(3);
    expect(oppositeFaces.values.find((value) => value.kind === "angle")?.value).toBe(0);
    expect(adjacentFaces.values.find((value) => value.kind === "angle")?.value).toBe(90);
    expect(vertices.values[0]?.value).toBe(4);
    expect(edges.values.find((value) => value.kind === "angle")?.value).toBe(90);
  });

  it("returns typed unavailable for body pairs and no number for stale identity", () => {
    const bodyPair = measureExactInspectionPair(
      bindExactInspectionTarget(identity("body"), [ARTIFACT]),
      bindExactInspectionTarget(
        { ...identity("body"), bodyId: "other" },
        [{ ...ARTIFACT, bodyId: "other" }]
      ),
      "mm"
    );
    const stale = measureExactInspectionSingle(
      bindExactInspectionTarget(
        { ...identity("face", "face_top", "sig-top"), topologySignature: "old" },
        [ARTIFACT]
      ),
      "mm"
    );

    expect(bodyPair.status).toBe("unavailable");
    expect(bodyPair.values).toEqual([]);
    expect(stale.status).toBe("stale");
    expect(stale.values).toEqual([]);
    expect(stale.diagnostics[0]?.code).toBe("EXACT_MEASUREMENT_STALE");
  });
});
