import type {
  CadFeatureSummary,
  PatternDirectionRef,
  PatternRotationAxisRef,
  SketchPathRef,
  SketchProfileRefV22
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import type {
  FeatureCompositeExtrudeForm,
  FeatureCompositeRevolveForm,
  FeatureCompositeSweepForm,
  FeatureEdgeFinishForm,
  FeatureExtrudeForm,
  FeatureHoleForm,
  FeatureLinearPatternForm,
  FeatureLoftForm,
  FeatureMirrorForm,
  FeatureCombineForm,
  FeatureOffsetForm,
  FeatureRevolveForm,
  FeatureShellForm,
  FeatureSweepForm
} from "../../cadCommands";
import {
  planExactFeaturePreview,
  type ExactFeaturePreviewPlan,
  type SolidSelectedSketchEntityContext
} from "./exactFeaturePreviewPlan";
import type {
  SolidDraft,
  SolidEditorKind,
  SolidEditorRequest,
  SolidEditorSubmission
} from "./solidEditorTypes";

const profile: SketchProfileRefV22 = {
  kind: "entity",
  sketchId: "sketch-profile",
  entityId: "profile-entity"
};
const path: SketchPathRef = {
  kind: "entity",
  sketchId: "sketch-path",
  entityId: "path-entity",
  orientation: "forward"
};
const direction: PatternDirectionRef = {
  kind: "globalAxis",
  axis: "x"
};
const rotationAxis: PatternRotationAxisRef = {
  kind: "globalAxis",
  axis: "z"
};
const mirrorPlane = {
  kind: "standardPlane" as const,
  plane: "XY" as const,
  offset: 2
};
const selectedSketchEntity: SolidSelectedSketchEntityContext = {
  sketchId: "sketch-selected",
  entityId: "entity-selected",
  entityKind: "rectangle"
};
const selectedCircle: SolidSelectedSketchEntityContext = {
  ...selectedSketchEntity,
  entityKind: "circle"
};

function makeInput(
  kind: SolidEditorKind,
  draft: SolidDraft,
  mode: "create" | "edit",
  existingFeature?: CadFeatureSummary,
  selectedSketchEntityContext?: SolidSelectedSketchEntityContext
) {
  return {
    request: {
      key: `${mode}:${kind}`,
      kind,
      title: kind,
      mode,
      initialDraft: draft
    } as SolidEditorRequest,
    submission: { kind, draft } as SolidEditorSubmission,
    ...(existingFeature ? { existingFeature } : {}),
    ...(selectedSketchEntityContext ? { selectedSketchEntityContext } : {})
  };
}

function feature(
  kind: CadFeatureSummary["kind"],
  overrides: Record<string, unknown> = {}
): CadFeatureSummary {
  return {
    id: "feature-existing",
    kind,
    bodyId: "body-existing",
    ...overrides
  } as unknown as CadFeatureSummary;
}

function expectSupported(
  result: ExactFeaturePreviewPlan,
  op: string,
  bodyId: string | undefined,
  requiresExactDownstreamCommitPreflight: boolean
) {
  expect(result.status).toBe("supported");
  if (result.status !== "supported") return;
  expect(result.ops).toHaveLength(1);
  expect(result.ops[0]?.op).toBe(op);
  expect(result.affectedBodyId).toBe(bodyId);
  expect(result.resultBodyId).toBe(bodyId);
  expect(result.requiresExactDownstreamCommitPreflight).toBe(
    requiresExactDownstreamCommitPreflight
  );
}

describe("V22 exact feature preview planner", () => {
  it.each([
    {
      kind: "extrude" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        targetBodyId: undefined,
        name: "",
        depth: 4,
        side: "positive" as const,
        operationMode: "newBody" as const
      } satisfies FeatureExtrudeForm,
      context: selectedSketchEntity,
      op: "feature.extrude"
    },
    {
      kind: "compositeExtrude" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        name: "",
        profile,
        depth: 4,
        side: "positive" as const,
        operationMode: "newBody" as const
      } satisfies FeatureCompositeExtrudeForm,
      op: "feature.extrude"
    },
    {
      kind: "revolve" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        name: "",
        axisEntityId: "axis-entity",
        angleDegrees: 90
      } satisfies FeatureRevolveForm,
      context: selectedSketchEntity,
      op: "feature.revolve"
    },
    {
      kind: "compositeRevolve" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        name: "",
        profile,
        axisEntityId: "axis-entity",
        angleDegrees: 90
      } satisfies FeatureCompositeRevolveForm,
      op: "feature.revolve"
    },
    {
      kind: "hole" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        targetBodyId: "body-target",
        sketchId: "sketch-hole",
        circleEntityId: "circle-hole",
        name: "",
        depthMode: "blind" as const,
        depth: 2,
        direction: "positive" as const
      } satisfies FeatureHoleForm,
      op: "feature.hole",
      exact: true
    },
    {
      kind: "chamfer" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        targetBodyId: "body-target",
        edgeStableId: "edge-1",
        name: "",
        distance: 1,
        radius: 1
      } satisfies FeatureEdgeFinishForm,
      op: "feature.chamfer"
    },
    {
      kind: "fillet" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        targetBodyId: "body-target",
        edgeStableId: "edge-1",
        name: "",
        distance: 1,
        radius: 1
      } satisfies FeatureEdgeFinishForm,
      op: "feature.fillet"
    },
    {
      kind: "linearPattern" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        seedBodyId: "body-seed",
        seedFeatureId: "",
        name: "",
        direction,
        spacing: 3,
        instanceCount: 3
      } satisfies FeatureLinearPatternForm,
      op: "feature.linearPattern",
      exact: true
    },
    {
      kind: "circularPattern" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        seedBodyId: "body-seed",
        seedFeatureId: "",
        name: "",
        rotationAxis,
        totalAngleDegrees: 180,
        instanceCount: 3
      },
      op: "feature.circularPattern",
      exact: true
    },
    {
      kind: "mirror" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        seedBodyId: "body-seed",
        name: "",
        plane: mirrorPlane,
        includeOriginal: true
      } satisfies FeatureMirrorForm,
      op: "feature.mirror",
      exact: true
    },
    {
      kind: "combine" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        name: "",
        mode: "union" as const,
        targetBodyId: "body_hub",
        toolBodyId: "body_step"
      } satisfies FeatureCombineForm,
      op: "feature.combine"
    },
    {
      kind: "offset" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        name: "",
        sourceKind: "sketchProfile" as const,
        profileSketchId: "sketch-profile",
        profileEntityId: "profile-entity",
        distance: 4,
        side: "outward" as const
      } satisfies FeatureOffsetForm,
      op: "feature.offset"
    },
    {
      kind: "shell" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        targetBodyId: "body-target",
        name: "",
        wallThickness: 1,
        openFaceRefs: []
      } satisfies FeatureShellForm,
      op: "feature.shell",
      exact: true
    },
    {
      kind: "sweep" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        name: "",
        pathSketchId: "sketch-path",
        pathEntityIds: ["path-entity"]
      } satisfies FeatureSweepForm,
      context: selectedSketchEntity,
      op: "feature.sweep"
    },
    {
      kind: "compositeSweep" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        name: "",
        profile: { ...profile, kind: "entity" as const },
        path
      } satisfies FeatureCompositeSweepForm,
      op: "feature.sweep"
    },
    {
      kind: "loft" as const,
      draft: {
        id: "feature-created",
        bodyId: "body-created",
        name: "",
        sections: [
          { sketchId: "sketch-a", entityId: "section-a" },
          { sketchId: "sketch-b", entityId: "section-b" }
        ]
      } satisfies FeatureLoftForm,
      op: "feature.loft"
    }
  ])(
    "plans the $kind create row with the existing operation",
    ({ kind, draft, context, op, exact }) => {
      const result = planExactFeaturePreview(
        makeInput(kind, draft, "create", undefined, context)
      );
      expectSupported(result, op, "body-created", exact === true);
    }
  );

  it("submits the same feature.offset batch as the associative-offset CADOps case", () => {
    const profileDraft = {
      id: "feat_profile_offset",
      bodyId: "body_profile_offset",
      name: "",
      sourceKind: "sketchProfile" as const,
      profileSketchId: "sketch_plate",
      profileEntityId: "rect_plate",
      distance: 4,
      side: "outward" as const
    } satisfies FeatureOffsetForm;
    const faceDraft = {
      id: "feat_face_offset",
      bodyId: "body_face_offset",
      name: "",
      sourceKind: "face" as const,
      profileSketchId: "",
      profileEntityId: "",
      face: {
        kind: "generatedFace" as const,
        bodyId: "body_block",
        stableId: "generated:face:body_block:endCap"
      },
      distance: 2,
      side: "outward" as const
    } satisfies FeatureOffsetForm;
    expect(planExactFeaturePreview(makeInput("offset", profileDraft, "create"))).toMatchObject({
      status: "supported",
      ops: [
        {
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
        }
      ]
    });
    expect(planExactFeaturePreview(makeInput("offset", faceDraft, "create"))).toMatchObject({
      status: "supported",
      ops: [
        {
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
        }
      ]
    });
  });

  it("submits the same feature.combine batch as the stepped-pulley CADOps case", () => {
    const draft = {
      id: "feat_union",
      bodyId: "body_pulley",
      name: "",
      mode: "union" as const,
      targetBodyId: "body_hub",
      toolBodyId: "body_step"
    } satisfies FeatureCombineForm;
    const result = planExactFeaturePreview(
      makeInput("combine", draft, "create")
    );
    expect(result).toMatchObject({
      status: "supported",
      requiresExactDownstreamCommitPreflight: false,
      ops: [
        {
          op: "feature.combine",
          id: "feat_union",
          bodyId: "body_pulley",
          mode: "union",
          targetBodyId: "body_hub",
          toolBodyId: "body_step"
        }
      ]
    });
  });

  it("submits the same feature.combine batch as the combine-intersect CADOps case", () => {
    const draft = {
      id: "feat_intersect",
      bodyId: "body_overlap",
      name: "",
      mode: "intersect" as const,
      targetBodyId: "body_block_a",
      toolBodyId: "body_block_b"
    } satisfies FeatureCombineForm;
    const result = planExactFeaturePreview(
      makeInput("combine", draft, "create")
    );
    expect(result).toMatchObject({
      status: "supported",
      requiresExactDownstreamCommitPreflight: false,
      ops: [
        {
          op: "feature.combine",
          id: "feat_intersect",
          bodyId: "body_overlap",
          mode: "intersect",
          targetBodyId: "body_block_a",
          toolBodyId: "body_block_b"
        }
      ]
    });
  });

  it.each([
    {
      kind: "extrude" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        name: "",
        depth: 5,
        side: "negative" as const,
        operationMode: "newBody" as const
      } satisfies FeatureExtrudeForm,
      feature: feature("extrude", {
        operationMode: "newBody",
        targetBodyId: undefined,
        targetTopologyAnchorId: undefined
      }),
      op: "feature.updateExtrude"
    },
    {
      kind: "compositeExtrude" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        name: "",
        profile,
        depth: 5,
        side: "negative" as const,
        operationMode: "newBody"
      } satisfies FeatureCompositeExtrudeForm,
      feature: feature("extrude", {
        operationMode: "newBody",
        targetBodyId: undefined,
        targetTopologyAnchorId: undefined
      }),
      op: "feature.updateExtrude"
    },
    {
      kind: "revolve" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        name: "",
        axisEntityId: "axis-entity",
        angleDegrees: 180
      } satisfies FeatureRevolveForm,
      feature: feature("revolve", {
        axis: {
          type: "sketchLine",
          sketchId: "sketch",
          entityId: "axis-entity"
        }
      }),
      op: "feature.updateRevolve"
    },
    {
      kind: "compositeRevolve" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        name: "",
        profile,
        axisEntityId: "axis-entity",
        angleDegrees: 180
      } satisfies FeatureCompositeRevolveForm,
      feature: feature("revolve", {
        axis: {
          type: "sketchLine",
          sketchId: "sketch",
          entityId: "axis-entity"
        }
      }),
      op: "feature.updateRevolve"
    },
    {
      kind: "hole" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        targetBodyId: "body-target",
        targetTopologyAnchorId: "anchor",
        sketchId: "sketch-hole",
        circleEntityId: "circle-hole",
        name: "",
        depthMode: "blind" as const,
        depth: 4,
        direction: "negative" as const
      } satisfies FeatureHoleForm,
      feature: feature("hole", {
        targetBodyId: "body-target",
        targetTopologyAnchorId: "anchor"
      }),
      op: "feature.updateHole",
      exact: true
    },
    {
      kind: "chamfer" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        targetBodyId: "body-target",
        name: "",
        distance: 2,
        radius: 1
      } satisfies FeatureEdgeFinishForm,
      feature: feature("chamfer"),
      op: "feature.updateChamfer"
    },
    {
      kind: "fillet" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        targetBodyId: "body-target",
        name: "",
        distance: 1,
        radius: 2
      } satisfies FeatureEdgeFinishForm,
      feature: feature("fillet"),
      op: "feature.updateFillet"
    },
    {
      kind: "linearPattern" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        seedBodyId: "body-seed",
        seedFeatureId: "",
        name: "",
        direction,
        spacing: 5,
        instanceCount: 4
      } satisfies FeatureLinearPatternForm,
      feature: feature("linearPattern", { seedBodyId: "body-seed" }),
      op: "feature.updateLinearPattern",
      exact: true
    },
    {
      kind: "circularPattern" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        seedBodyId: "body-seed",
        seedFeatureId: "",
        name: "",
        rotationAxis,
        totalAngleDegrees: 270,
        instanceCount: 4
      },
      feature: feature("circularPattern", { seedBodyId: "body-seed" }),
      op: "feature.updateCircularPattern",
      exact: true
    },
    {
      kind: "mirror" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        seedBodyId: "body-seed",
        name: "",
        plane: mirrorPlane,
        includeOriginal: false
      } satisfies FeatureMirrorForm,
      feature: feature("mirror", { seedBodyId: "body-seed" }),
      op: "feature.updateMirror",
      exact: true
    },
    {
      kind: "shell" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        targetBodyId: "body-target",
        name: "",
        wallThickness: 2,
        openFaceRefs: []
      } satisfies FeatureShellForm,
      feature: feature("shell", { targetBodyId: "body-target" }),
      op: "feature.updateShell",
      exact: true
    },
    {
      kind: "offset" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        name: "",
        sourceKind: "sketchProfile" as const,
        profileSketchId: "sketch-profile",
        profileEntityId: "profile-entity",
        distance: 6,
        side: "inward" as const
      } satisfies FeatureOffsetForm,
      feature: feature("offset", {
        offsetSource: {
          kind: "sketchProfile",
          profile: {
            kind: "entity",
            sketchId: "sketch-profile",
            entityId: "profile-entity"
          }
        },
        distance: 4,
        side: "outward"
      }),
      op: "feature.updateOffset"
    },
    {
      kind: "compositeSweep" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        name: "",
        profile: { ...profile, kind: "entity" as const },
        path
      } satisfies FeatureCompositeSweepForm,
      feature: feature("sweep"),
      op: "feature.updateSweep"
    },
    {
      kind: "loft" as const,
      draft: {
        id: "feature-existing",
        bodyId: "body-existing",
        name: "",
        sections: [
          { sketchId: "sketch-a", entityId: "section-a" },
          { sketchId: "sketch-b", entityId: "section-b" }
        ]
      } satisfies FeatureLoftForm,
      feature: feature("loft"),
      op: "feature.updateLoft"
    }
  ])(
    "plans the $kind update row with the existing operation",
    ({ kind, draft, feature: currentFeature, op, exact }) => {
      const result = planExactFeaturePreview(
        makeInput(kind, draft, "edit", currentFeature)
      );
      expectSupported(result, op, "body-existing", exact === true);
    }
  );

  it("keeps one plan batch reusable by preview and Apply", () => {
    const plan = planExactFeaturePreview(
      makeInput(
        "compositeExtrude",
        {
          id: "feature-created",
          bodyId: "body-created",
          name: "",
          profile,
          depth: 5,
          side: "positive",
          operationMode: "newBody"
        },
        "create"
      )
    );
    expect(plan.status).toBe("supported");
    if (plan.status !== "supported") return;
    const previewBatch = plan.ops;
    const applyBatch = plan.ops;
    expect(previewBatch).toBe(applyBatch);
    expect(previewBatch[0]).toBe(applyBatch[0]);
  });

  it("blocks the inherited edit invariants", () => {
    const extrude = planExactFeaturePreview(
      makeInput(
        "compositeExtrude",
        {
          id: "feature-existing",
          bodyId: "body-existing",
          name: "",
          profile,
          depth: 5,
          side: "positive",
          operationMode: "add",
          targetBodyId: "new-target"
        },
        "edit",
        feature("extrude", {
          operationMode: "add",
          targetBodyId: "old-target"
        })
      )
    );
    expect(extrude).toMatchObject({ status: "unsupported" });
    expect((extrude as { reason: string }).reason).toContain("boolean target");

    const revolve = planExactFeaturePreview(
      makeInput(
        "compositeRevolve",
        {
          id: "feature-existing",
          bodyId: "body-existing",
          name: "",
          profile,
          axisEntityId: "new-axis",
          angleDegrees: 90
        },
        "edit",
        feature("revolve", {
          axis: { type: "sketchLine", sketchId: "sketch", entityId: "old-axis" }
        })
      )
    );
    expect(revolve).toMatchObject({ status: "unsupported" });
    expect((revolve as { reason: string }).reason).toContain("revolve axis");

    const seed = planExactFeaturePreview(
      makeInput(
        "linearPattern",
        {
          id: "feature-existing",
          bodyId: "body-existing",
          seedBodyId: "new-seed",
          seedFeatureId: "",
          name: "",
          direction,
          spacing: 5,
          instanceCount: 3
        },
        "edit",
        feature("linearPattern", { seedBodyId: "old-seed" })
      )
    );
    expect(seed).toMatchObject({ status: "unsupported" });
    expect((seed as { reason: string }).reason).toContain("seed body");

    const shell = planExactFeaturePreview(
      makeInput(
        "shell",
        {
          id: "feature-existing",
          bodyId: "body-existing",
          targetBodyId: "new-target",
          name: "",
          wallThickness: 2,
          openFaceRefs: []
        },
        "edit",
        feature("shell", { targetBodyId: "old-target" })
      )
    );
    expect(shell).toMatchObject({ status: "unsupported" });
    expect((shell as { reason: string }).reason).toContain("target body");
  });

  it("returns human reasons for missing context and unsupported kinds", () => {
    const missingEntity = planExactFeaturePreview(
      makeInput(
        "extrude",
        {
          id: "feature-created",
          bodyId: "body-created",
          name: "",
          depth: 2,
          side: "positive",
          operationMode: "newBody"
        },
        "create"
      )
    );
    expect(missingEntity).toMatchObject({ status: "unsupported" });
    expect((missingEntity as { reason: string }).reason).toContain(
      "sketch entity"
    );

    const wrongCircle = planExactFeaturePreview(
      makeInput(
        "hole",
        {
          id: "feature-created",
          bodyId: "body-created",
          targetBodyId: "body-target",
          name: "",
          depthMode: "throughAll",
          depth: 2,
          direction: "positive"
        },
        "create",
        undefined,
        selectedSketchEntity
      )
    );
    expect(wrongCircle).toMatchObject({ status: "unsupported" });
    expect((wrongCircle as { reason: string }).reason).toContain("circle");

    const primitive = planExactFeaturePreview(
      makeInput(
        "box",
        {
          id: "box",
          width: 1,
          height: 1,
          depth: 1,
          radius: 1,
          majorRadius: 2,
          minorRadius: 1,
          translationX: 0,
          translationY: 0,
          translationZ: 0
        },
        "create"
      )
    );
    expect(primitive).toMatchObject({ status: "unsupported" });
  });

  it("rejects request/submission mismatches and stale edit identities", () => {
    const mismatch = planExactFeaturePreview({
      request: {
        key: "create:loft",
        kind: "loft",
        title: "Loft",
        mode: "create",
        initialDraft: {
          id: "",
          bodyId: "",
          name: "",
          sections: []
        }
      },
      submission: {
        kind: "shell",
        draft: {
          id: "",
          bodyId: "",
          targetBodyId: "target",
          name: "",
          wallThickness: 1,
          openFaceRefs: []
        }
      }
    } as unknown as Parameters<typeof planExactFeaturePreview>[0]);
    expect(mismatch).toMatchObject({ status: "unsupported" });

    const stale = planExactFeaturePreview(
      makeInput(
        "loft",
        {
          id: "different-feature",
          bodyId: "body-existing",
          name: "",
          sections: [
            { sketchId: "sketch-a", entityId: "section-a" },
            { sketchId: "sketch-b", entityId: "section-b" }
          ]
        },
        "edit",
        feature("loft")
      )
    );
    expect(stale).toMatchObject({ status: "unsupported" });
    expect((stale as { reason: string }).reason).toContain("different feature");
  });

  it("uses a selected circle context when the hole draft has no source fields", () => {
    const result = planExactFeaturePreview(
      makeInput(
        "hole",
        {
          id: "feature-created",
          bodyId: "body-created",
          targetBodyId: "body-target",
          name: "",
          depthMode: "throughAll",
          depth: 2,
          direction: "positive"
        },
        "create",
        undefined,
        selectedCircle
      )
    );
    expectSupported(result, "feature.hole", "body-created", true);
    if (result.status === "supported") {
      expect(result.ops[0]).toMatchObject({
        sketchId: "sketch-selected",
        circleEntityId: "entity-selected"
      });
    }
  });

  it("prepends pending current-exact promotion ops onto a chamfer create plan", () => {
    const pendingCurrentExactPromotionOps = [
      {
        op: "topology.checkpoint.create" as const,
        checkpointId: "topology_checkpoint_current_abc",
        bodyId: "body_rect_1",
        sourceIdentity: {
          algorithm: "partbench-source-v1" as const,
          sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        status: "active" as const
      },
      {
        op: "topology.anchor.create" as const,
        anchorId: "topology_anchor_current_abc",
        entityKind: "edge" as const,
        bodyId: "body_rect_1",
        checkpointId: "topology_checkpoint_current_abc",
        checkpointEntityId: "snapshot-local:edge:2"
      }
    ];
    const draft: FeatureEdgeFinishForm = {
      id: "feature-created",
      bodyId: "body-created",
      targetBodyId: "body_rect_1",
      topologyAnchorId: "topology_anchor_current_abc",
      name: "",
      distance: 1,
      radius: 1
    };
    const result = planExactFeaturePreview({
      request: {
        key: "create:chamfer",
        kind: "chamfer",
        title: "chamfer",
        mode: "create",
        initialDraft: draft,
        pendingCurrentExactPromotionOps
      },
      submission: { kind: "chamfer", draft }
    });

    expect(result.status).toBe("supported");
    if (result.status !== "supported") return;
    expect(result.ops.map((op) => op.op)).toEqual([
      "topology.checkpoint.create",
      "topology.anchor.create",
      "feature.chamfer"
    ]);
    expect(result.ops[2]).toMatchObject({
      op: "feature.chamfer",
      topologyAnchorId: "topology_anchor_current_abc"
    });
  });
});
