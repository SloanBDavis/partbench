import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  type CadOp,
  type DatumAxisCreateOp,
  type DatumAxisSnapshot,
  type FeatureCircularPatternOp,
  type PatternRotationAxisRef
} from "./index";

describe("datum.axis.create protocol", () => {
  it("names a persistent axis and grows the circular-pattern collector without a schema bump", () => {
    const create: DatumAxisCreateOp = {
      op: "datum.axis.create",
      id: "datum_axis_z",
      name: "Z axis",
      axis: { kind: "globalAxis", axis: "z" }
    };
    const fromEdge: DatumAxisCreateOp = {
      op: "datum.axis.create",
      id: "datum_from_edge",
      name: "Edge axis",
      axis: {
        kind: "generatedEdge",
        bodyId: "body_block",
        stableId: "generated:edge:body_block:line"
      }
    };
    const rotationAxis: PatternRotationAxisRef = {
      kind: "datumAxis",
      datumId: "datum_axis_z"
    };
    const pattern: FeatureCircularPatternOp = {
      op: "feature.circularPattern",
      id: "feat_pattern",
      bodyId: "body_patterned",
      seedBodyId: "body_block",
      rotationAxis,
      totalAngleDegrees: 360,
      instanceCount: 4
    };
    const snapshot: DatumAxisSnapshot = {
      id: "datum_axis_z",
      name: "Z axis",
      kind: "axis",
      axis: { kind: "globalAxis", axis: "z" }
    };
    const ops: readonly CadOp[] = [create, fromEdge, pattern];

    expect(ops.map((op) => op.op)).toEqual([
      "datum.axis.create",
      "datum.axis.create",
      "feature.circularPattern"
    ]);
    expect(create.axis).toEqual({ kind: "globalAxis", axis: "z" });
    expect(pattern.rotationAxis).toEqual({
      kind: "datumAxis",
      datumId: "datum_axis_z"
    });
    expect(snapshot.kind).toBe("axis");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v23");
  });
});
