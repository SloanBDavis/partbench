import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE,
  type CadOp,
  type AlignFeatureSnapshot,
  type FeatureAlignOp
} from "./index";

describe("feature.align protocol", () => {
  it("names a document-true body move onto a face, datum plane, or datum axis without a schema bump", () => {
    const ontoFace: FeatureAlignOp = {
      op: "feature.align",
      id: "feat_align_face",
      bodyId: "body_align_face",
      seedBodyId: "body_source_face",
      sourceFace: {
        kind: "generatedFace",
        bodyId: "body_source_face",
        stableId: "generated:face:body_source_face:endCap"
      },
      target: {
        kind: "planarFace",
        face: {
          kind: "generatedFace",
          bodyId: "body_target",
          stableId: "generated:face:body_target:endCap"
        }
      }
    };
    const ontoPlane: FeatureAlignOp = {
      op: "feature.align",
      id: "feat_align_plane",
      bodyId: "body_align_plane",
      seedBodyId: "body_source_plane",
      sourceFace: {
        kind: "generatedFace",
        bodyId: "body_source_plane",
        stableId: "generated:face:body_source_plane:endCap"
      },
      target: { kind: "datumPlane", datumId: "datum_xy_20" }
    };
    const ontoAxis: FeatureAlignOp = {
      op: "feature.align",
      id: "feat_align_axis",
      bodyId: "body_align_axis",
      seedBodyId: "body_source_axis",
      sourceFace: {
        kind: "generatedFace",
        bodyId: "body_source_axis",
        stableId: "generated:face:body_source_axis:side:uMax"
      },
      target: { kind: "datumAxis", datumId: "datum_axis_z" }
    };
    const snapshot: AlignFeatureSnapshot = {
      id: "feat_align_face",
      kind: "align",
      seedBodyId: "body_source_face",
      sourceFace: ontoFace.sourceFace,
      target: ontoFace.target,
      transform: {
        translation: [0, 0, 2],
        rotationAxis: [0, 0, 1],
        rotationDegrees: 0
      },
      alignedSourceFace: { point: [40, 0, 10], normal: [0, 0, 1] },
      bodyId: "body_align_face"
    };
    const ops: readonly CadOp[] = [ontoFace, ontoPlane, ontoAxis];

    expect(ops.map((op) => op.op)).toEqual([
      "feature.align",
      "feature.align",
      "feature.align"
    ]);
    expect(ontoFace.target.kind).toBe("planarFace");
    expect(ontoPlane.target.kind).toBe("datumPlane");
    expect(ontoAxis.target.kind).toBe("datumAxis");
    expect(snapshot.kind).toBe("align");
    expect(snapshot.transform.translation).toEqual([0, 0, 2]);
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v23");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v25");
    expect(CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE.alignFeature).toBe(
      "authoredAlign"
    );
  });
});
