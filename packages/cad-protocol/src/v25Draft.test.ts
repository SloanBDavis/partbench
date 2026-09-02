import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE,
  type CadOp,
  type DraftFeatureSnapshot,
  type FeatureDraftOp
} from "./index";

describe("feature.draft protocol", () => {
  it("names a drafted planar face set on a completed exact solid without a schema bump", () => {
    const draft: FeatureDraftOp = {
      op: "feature.draft",
      id: "feat_draft_side",
      bodyId: "body_draft_side",
      targetBodyId: "body_block",
      faces: [
        {
          kind: "generatedFace",
          bodyId: "body_block",
          stableId: "generated:face:body_block:side:uMax"
        }
      ],
      angleDegrees: 10,
      neutralPlane: {
        kind: "planarFace",
        face: {
          kind: "generatedFace",
          bodyId: "body_block",
          stableId: "generated:face:body_block:startCap"
        }
      }
    };
    const snapshot: DraftFeatureSnapshot = {
      id: "feat_draft_side",
      kind: "draft",
      targetBodyId: "body_block",
      faces: draft.faces,
      angleDegrees: 10,
      neutralPlane: draft.neutralPlane,
      pullDirection: [0, 0, 1],
      draftedFaces: [
        {
          face: draft.faces[0]!,
          plane: {
            point: [5, 0, 0],
            normal: [0.984807753012, 0, 0.173648177667]
          }
        }
      ],
      bodyId: "body_draft_side"
    };
    const ops: readonly CadOp[] = [draft];

    expect(ops.map((op) => op.op)).toEqual(["feature.draft"]);
    expect(draft.faces).toHaveLength(1);
    expect(draft.angleDegrees).toBe(10);
    expect(draft.neutralPlane.kind).toBe("planarFace");
    expect(snapshot.kind).toBe("draft");
    expect(snapshot.pullDirection).toEqual([0, 0, 1]);
    expect(snapshot.draftedFaces[0]?.plane.normal[0]).not.toBe(1);
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v23");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v25");
    expect(CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE.draftFeature).toBe(
      "authoredDraft"
    );
  });
});
