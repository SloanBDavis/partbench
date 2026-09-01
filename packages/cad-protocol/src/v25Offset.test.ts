import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE,
  type CadOp,
  type FeatureOffsetOp,
  type FeatureUpdateOffsetOp,
  type OffsetFeatureSnapshot
} from "./index";

describe("feature.offset protocol", () => {
  it("names a rebuildable offset of a sketch profile or a face without a schema bump", () => {
    const profile: FeatureOffsetOp = {
      op: "feature.offset",
      id: "feat_profile_offset",
      bodyId: "body_profile_offset",
      source: {
        kind: "sketchProfile",
        profile: {
          kind: "entity",
          sketchId: "sketch_plate",
          entityId: "rect_plate"
        }
      },
      distance: 4,
      side: "outward"
    };
    const face: FeatureOffsetOp = {
      op: "feature.offset",
      id: "feat_face_offset",
      bodyId: "body_face_offset",
      source: {
        kind: "face",
        face: {
          kind: "generatedFace",
          bodyId: "body_block",
          stableId: "generated:face:body_block:endCap"
        }
      },
      distance: 2,
      side: "outward"
    };
    const update: FeatureUpdateOffsetOp = {
      op: "feature.updateOffset",
      id: "feat_profile_offset",
      distance: 6,
      side: "inward"
    };
    const snapshot: OffsetFeatureSnapshot = {
      id: "feat_profile_offset",
      kind: "offset",
      source: profile.source,
      distance: 4,
      side: "outward",
      bodyId: "body_profile_offset"
    };
    const ops: readonly CadOp[] = [profile, face, update];

    expect(ops.map((op) => op.op)).toEqual([
      "feature.offset",
      "feature.offset",
      "feature.updateOffset"
    ]);
    expect(profile.source.kind).toBe("sketchProfile");
    expect(face.source.kind).toBe("face");
    expect(update.distance).toBe(6);
    expect(snapshot.kind).toBe("offset");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v23");
    expect(CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE.offsetFeature).toBe(
      "authoredOffset"
    );
  });
});
