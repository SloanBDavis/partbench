import { CadEngine, exportCadProjectJson } from "@web-cad/cad-core";
import type { CadBodySnapshot } from "@web-cad/cad-protocol";
import type { RenderExactPickBody } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  getNextViewportExactCandidateIndex,
  reconcileViewportExactCandidateSession
} from "./viewportExactSelectionSession";
import { resolveViewportPickIntent } from "./viewportPickIntent";

describe("viewport exact selection app selection path", () => {
  it("keeps source, history, and dirty state byte-identical through hover, select, and cycle", () => {
    const engine = createEngineWithExtrude();
    const before = exportCadProjectJson(engine);
    const body = createExtrudeBodySnapshot();
    const exactBodies = [createExactPickBody(body.id)];

    const session = reconcileViewportExactCandidateSession(
      undefined,
      {
        status: "ready",
        candidates: [
          {
            bodyId: body.id,
            bodySourceIdentitySignature: "source",
            topologySignature: "topology",
            entityKind: "body",
            depth: 1,
            distance: 0,
            occluded: false
          },
          {
            bodyId: body.id,
            bodySourceIdentitySignature: "source",
            topologySignature: "topology",
            entityKind: "face",
            localId: "face:1",
            entitySignature: "face-signature:1",
            depth: 2,
            distance: 0,
            occluded: false
          }
        ],
        examined: 2,
        truncated: false
      },
      { x: 100, y: 100 },
      exactBodies
    );

    const intent = resolveViewportPickIntent({
      pickedRenderId: body.id,
      bodies: [body],
      objects: [],
      readReferenceCandidates: (selection) => {
        const response = engine.executeQuery({
          version: "cadops.v1",
          query: { query: "selection.referenceCandidates", selection }
        });
        return response.ok && response.query === "selection.referenceCandidates"
          ? response
          : undefined;
      }
    });

    expect(intent.kind).toBe("body");
    const next = getNextViewportExactCandidateIndex(session);
    if (next < 0) throw new Error("expected a cycleable candidate session");
    expectNumber(next);

    expect(exportCadProjectJson(engine)).toBe(before);
  });

  it("falls back to body selection when the exact pick session is absent", () => {
    const engine = createEngineWithExtrude();
    const body = createExtrudeBodySnapshot();
    const before = exportCadProjectJson(engine);

    const absent = reconcileViewportExactCandidateSession(
      undefined,
      undefined,
      undefined,
      []
    );
    expect(absent).toBeUndefined();

    const intent = resolveViewportPickIntent({
      pickedRenderId: body.id,
      bodies: [body],
      objects: []
    });
    expect(intent.kind).toBe("body");
    expect(intent.selectedId).toBe(body.id);
    expect(exportCadProjectJson(engine)).toBe(before);
  });
});

function createEngineWithExtrude(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [0, 0],
      width: 4,
      height: 2
    },
    {
      op: "feature.extrude",
      id: "feat_rect",
      bodyId: "body_rect",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 3
    }
  ]);
  return engine;
}

function createExtrudeBodySnapshot(): CadBodySnapshot {
  return {
    id: "body_rect",
    kind: "solid",
    partId: "part:default",
    featureId: "feat_rect",
    source: {
      type: "sketchExtrudeFeature",
      featureId: "feat_rect",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle"
    }
  };
}

function createExactPickBody(bodyId: string): RenderExactPickBody {
  return {
    mesh: {
      id: bodyId,
      kind: "mesh",
      vertices: [
        [-2, 0, -2],
        [2, 0, -2],
        [2, 0, 2],
        [-2, 0, 2]
      ],
      indices: [0, 1, 2, 0, 2, 3],
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    },
    pickMap: {
      version: "partbench.exact-pick-map.v1",
      bodyId,
      bodySourceIdentitySignature: "source",
      topologySignature: "topology",
      meshVertexCount: 4,
      meshTriangleCount: 2,
      faces: [{ localId: "face", entitySignature: "face-signature" }],
      edges: [{ localId: "edge", entitySignature: "edge-signature" }],
      vertices: [{ localId: "vertex", entitySignature: "vertex-signature" }],
      faceTriangleRanges: new Uint32Array([0, 2]),
      edgePointRanges: new Uint32Array([0, 2]),
      edgePoints: new Float64Array([-1, 0, 0, 1, 0, 0]),
      vertexPoints: new Float64Array([0, 0, 0])
    }
  };
}

function expectNumber(value: number): void {
  if (!Number.isInteger(value)) throw new Error("expected integer cycle index");
}
