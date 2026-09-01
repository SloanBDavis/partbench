import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  type CadOp,
  type DatumPlaneCreateOp,
  type DatumPlaneSnapshot,
  type MirrorPlaneRef,
  type SketchCreateOp
} from "./index";

describe("datum.plane.create protocol", () => {
  it("names persistent offset planes without a schema bump and grows sketch.create", () => {
    const fromWorld: DatumPlaneCreateOp = {
      op: "datum.plane.create",
      id: "datum_ear_a",
      name: "Ear A",
      plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
    };
    const fromFace: DatumPlaneCreateOp = {
      op: "datum.plane.create",
      id: "datum_from_face",
      name: "Face offset",
      plane: {
        kind: "generatedFace",
        bodyId: "body_plate",
        stableId: "generated:face:body_plate:endCap",
        offset: 8
      }
    };
    const sketchOnDatum: SketchCreateOp = {
      op: "sketch.create",
      id: "sketch_ear_a",
      name: "Ear A",
      datumId: "datum_ear_a"
    };
    const worldSketch: SketchCreateOp = {
      op: "sketch.create",
      id: "sketch_plate",
      name: "Plate",
      plane: "XY"
    };
    const mirrorOnDatum: MirrorPlaneRef = {
      kind: "datumPlane",
      datumId: "datum_ear_a"
    };
    const snapshot: DatumPlaneSnapshot = {
      id: "datum_ear_a",
      name: "Ear A",
      kind: "plane",
      plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
    };
    const ops: readonly CadOp[] = [fromWorld, fromFace, sketchOnDatum, worldSketch];

    expect(ops.map((op) => op.op)).toEqual([
      "datum.plane.create",
      "datum.plane.create",
      "sketch.create",
      "sketch.create"
    ]);
    expect(sketchOnDatum.datumId).toBe("datum_ear_a");
    expect(sketchOnDatum.plane).toBeUndefined();
    expect(worldSketch.plane).toBe("XY");
    expect(worldSketch.datumId).toBeUndefined();
    expect(mirrorOnDatum.kind).toBe("datumPlane");
    expect(snapshot.kind).toBe("plane");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
  });
});
