import type { SceneObject } from "@web-cad/cad-core";
import type {
  CadBodySnapshot,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadSelectionReferenceInput,
  CadSelectionReferenceIssue,
  SketchSnapshot,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import { createAssemblyInstanceRenderId } from "./assemblyInstanceExactDisplay";
import {
  createViewportCurrentTopologyPickIntent,
  createViewportExactSelection,
  isSameViewportExactSelection,
  createViewportBodyHitTarget,
  resolveViewportPickIntent
} from "./viewportPickIntent";
import {
  createSketchEntitySelectionId,
  createSketchSelectionId
} from "./sketchRenderIds";

describe("viewport pick intent", () => {
  it("strips renderer-only hit details into bounded current-topology selection", () => {
    const candidate = {
      bodyId: "body_exact",
      bodySourceIdentitySignature: "source-current",
      topologySignature: "topology-current",
      entityKind: "face",
      localId: "face-local-1",
      entitySignature: "face-signature-1",
      depth: 4,
      distance: 2,
      occluded: false
    } as const;
    const intent = createViewportCurrentTopologyPickIntent(candidate);
    const selection = createViewportExactSelection(candidate);

    expect(intent).toEqual({
      kind: "currentTopology",
      selectedId: "body_exact",
      bodyId: "body_exact",
      bodySourceIdentitySignature: "source-current",
      topologySignature: "topology-current",
      entityKind: "face",
      localId: "face-local-1",
      entitySignature: "face-signature-1",
      renderTargetId: "body_exact",
      issues: [],
      interactionDiagnostics: []
    });
    expect(intent).not.toHaveProperty("depth");
    expect(intent).not.toHaveProperty("distance");
    expect(intent).not.toHaveProperty("occluded");
    expect(selection).toEqual({
      bodyId: "body_exact",
      bodySourceIdentitySignature: "source-current",
      topologySignature: "topology-current",
      entityKind: "face",
      localId: "face-local-1",
      entitySignature: "face-signature-1"
    });
    expect(isSameViewportExactSelection(selection, { ...selection })).toBe(
      true
    );
    expect(
      isSameViewportExactSelection(selection, {
        ...selection,
        entitySignature: "changed"
      })
    ).toBe(false);
  });

  it("maps body render IDs to semantic body targets", () => {
    const body = createExtrudeBody("body_rect");
    const target = createViewportBodyHitTarget({
      pickedRenderId: body.id,
      bodies: [body],
      objects: []
    });

    expect(target).toMatchObject({
      kind: "body",
      bodyId: "body_rect",
      renderTargetId: "body_rect"
    });
  });

  it("resolves authored body render IDs through V9 semantic body selection", () => {
    const body = createExtrudeBody("body_rect");
    const response = createCandidateResponse({
      bodyId: body.id,
      status: "resolved"
    });
    const intent = resolveViewportPickIntent({
      pickedRenderId: body.id,
      bodies: [body],
      objects: [],
      readReferenceCandidates: (selection) => {
        expect(selection).toEqual({ type: "body", bodyId: body.id });
        return response;
      }
    });

    expect(intent).toMatchObject({
      kind: "body",
      selectedId: "body_rect",
      renderTargetId: "body_rect",
      semanticSelection: { type: "body", bodyId: "body_rect" },
      referenceCandidates: response,
      issues: [],
      interactionDiagnostics: []
    });
    expect(JSON.stringify(intent)).not.toContain("renderer-hit");
  });

  it("routes primitive object-backed viewport picks to semantic body selection", () => {
    const object = createBoxObject("box_1");
    const body = createPrimitiveBody("body:box_1", object.id);
    const response = createCandidateResponse({
      bodyId: body.id,
      status: "unsupported",
      issue: {
        code: "UNSUPPORTED_SELECTION_TARGET",
        status: "unsupported",
        message:
          "Primitive body body:box_1 does not expose command-ready semantic generated references.",
        bodyId: body.id
      }
    });
    const intent = resolveViewportPickIntent({
      pickedRenderId: object.id,
      bodies: [body],
      objects: [object],
      readReferenceCandidates: () => response
    });

    expect(intent).toMatchObject({
      kind: "object",
      selectedId: "body:box_1",
      objectId: "box_1",
      bodyId: "body:box_1",
      renderTargetId: "box_1",
      semanticSelection: { type: "body", bodyId: "body:box_1" },
      referenceCandidates: response,
      issues: [
        {
          code: "UNSUPPORTED_SELECTION_TARGET",
          status: "unsupported"
        }
      ],
      interactionDiagnostics: [
        {
          code: "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY",
          status: "unsupported"
        }
      ]
    });
    expect(JSON.stringify(intent)).not.toContain("renderer-hit");
  });

  it.each([
    ["missing", "MISSING_SELECTION_TARGET", "VIEWPORT_MISSING_HIT_TARGET"],
    ["stale", "STALE_SELECTION_REFERENCE", "VIEWPORT_STALE_SEMANTIC_HINT"],
    [
      "unsupported",
      "UNSUPPORTED_SELECTION_TARGET",
      "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY"
    ],
    [
      "ambiguous",
      "AMBIGUOUS_SELECTION_TOPOLOGY",
      "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE"
    ],
    ["consumed", "CONSUMED_SELECTION_BODY", "VIEWPORT_CONSUMED_TARGET"],
    [
      "non-commandable",
      "NON_COMMANDABLE_SELECTION_TARGET",
      "VIEWPORT_NON_COMMANDABLE_TARGET"
    ]
  ] as const)(
    "carries structured %s diagnostics from CADOps candidate responses",
    (status, code, viewportCode) => {
      const body = createExtrudeBody("body_rect");
      const response = createCandidateResponse({
        bodyId: body.id,
        status,
        issue: {
          code,
          status,
          message: `${status} body diagnostic`,
          bodyId: body.id
        }
      });
      const intent = resolveViewportPickIntent({
        pickedRenderId: body.id,
        bodies: [body],
        objects: [],
        readReferenceCandidates: () => response
      });

      expect(intent.kind).toBe("body");
      expect(intent.issues).toEqual([
        {
          code,
          status,
          message: `${status} body diagnostic`,
          bodyId: body.id
        }
      ]);
      expect(intent.interactionDiagnostics).toEqual([
        {
          code: viewportCode,
          status,
          message: `${status} body diagnostic`
        }
      ]);
    }
  );

  it("returns V9 unsupported and renderer-only diagnostics for non-body picks", () => {
    const sketchIntent = resolveViewportPickIntent({
      pickedRenderId: createSketchSelectionId("sketch_1"),
      bodies: [],
      objects: []
    });
    const unknownIntent = resolveViewportPickIntent({
      pickedRenderId: "selection-buffer:face:17",
      bodies: [],
      objects: []
    });

    expect(sketchIntent).toMatchObject({
      kind: "unsupported",
      issues: [
        {
          code: "UNSUPPORTED_SELECTION_TARGET",
          status: "unsupported"
        }
      ],
      interactionDiagnostics: [
        {
          code: "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY",
          status: "unsupported"
        }
      ]
    });
    expect(unknownIntent).toMatchObject({
      kind: "renderer-only",
      issues: [
        {
          code: "UNSUPPORTED_SELECTION_TARGET",
          status: "unsupported"
        }
      ],
      interactionDiagnostics: [
        {
          code: "VIEWPORT_RENDERER_ONLY_TARGET",
          status: "renderer-only"
        }
      ]
    });
    expect(sketchIntent).not.toHaveProperty("selectedId");
    expect(sketchIntent).not.toHaveProperty("semanticSelection");
    expect(unknownIntent).not.toHaveProperty("selectedId");
    expect(unknownIntent).not.toHaveProperty("semanticSelection");
    expect(JSON.stringify(unknownIntent.issues)).not.toContain(
      "selection-buffer"
    );
    expect(JSON.stringify(unknownIntent.interactionDiagnostics)).not.toContain(
      "selection-buffer"
    );
  });

  it("selects a current sketch arc by its stable semantic render ID", () => {
    const sketch: SketchSnapshot = {
      id: "sketch_1",
      name: "Arc sketch",
      plane: "XY",
      entities: [
        {
          id: "arc_1",
          kind: "arc",
          center: [0, 0],
          radius: 2,
          startAngleDegrees: 350,
          sweepAngleDegrees: 30,
          construction: false
        }
      ]
    };
    const intent = resolveViewportPickIntent({
      pickedRenderId: createSketchEntitySelectionId("sketch_1", "arc_1"),
      bodies: [],
      objects: [],
      sketches: [sketch]
    });

    expect(intent).toEqual({
      kind: "sketchEntity",
      selectedId: createSketchEntitySelectionId("sketch_1", "arc_1"),
      sketchId: "sketch_1",
      entityId: "arc_1",
      renderTargetId: createSketchEntitySelectionId("sketch_1", "arc_1"),
      issues: [],
      interactionDiagnostics: []
    });
  });

  it("returns an ambiguous diagnostic when an object maps to multiple bodies", () => {
    const object = createBoxObject("box_1");
    const firstBody = createPrimitiveBody("body:box_1:a", object.id);
    const secondBody = createPrimitiveBody("body:box_1:b", object.id);
    const intent = resolveViewportPickIntent({
      pickedRenderId: object.id,
      bodies: [firstBody, secondBody],
      objects: [object]
    });

    expect(intent).toMatchObject({
      kind: "ambiguous",
      issues: [
        {
          code: "AMBIGUOUS_SELECTION_TOPOLOGY",
          status: "ambiguous"
        }
      ],
      interactionDiagnostics: [
        {
          code: "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE",
          status: "ambiguous"
        }
      ]
    });
    expect(intent).not.toHaveProperty("selectedId");
  });

  it("resolves body-level pick on an assembly instance mesh to the instance", () => {
    const renderId = createAssemblyInstanceRenderId("asm_bolts", "inst_b");
    const body = createExtrudeBody("body_bolt");
    const intent = resolveViewportPickIntent({
      pickedRenderId: renderId,
      bodies: [body],
      objects: [],
      assemblies: [
        {
          id: "asm_bolts",
          name: "Bolts",
          instances: [
            {
              id: "inst_a",
              name: "Bolt A",
              definition: { kind: "body", bodyId: "body_bolt" },
              transform: {
                translation: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
              }
            },
            {
              id: "inst_b",
              name: "Bolt B",
              definition: { kind: "body", bodyId: "body_bolt" },
              transform: {
                translation: [40, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
              }
            }
          ]
        }
      ]
    });

    expect(intent).toMatchObject({
      kind: "assemblyInstance",
      assemblyId: "asm_bolts",
      instanceId: "inst_b",
      bodyId: "body_bolt",
      renderTargetId: renderId,
      semanticSelection: { type: "body", bodyId: "body_bolt" }
    });
    expect(intent).not.toHaveProperty("selectedId");
  });
});

function createPrimitiveBody(id: string, objectId: string): CadBodySnapshot {
  return {
    id,
    kind: "solid",
    partId: "part:default",
    featureId: `feature:${objectId}`,
    objectId,
    primitive: "box",
    source: {
      type: "primitiveFeature",
      featureId: `feature:${objectId}`,
      objectId
    }
  };
}

function createExtrudeBody(id: string): CadBodySnapshot {
  return {
    id,
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

function createBoxObject(id: string): SceneObject {
  return {
    id,
    kind: "box",
    dimensions: { width: 2, height: 2, depth: 2 },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createCandidateResponse({
  bodyId,
  issue,
  reference,
  selection,
  status
}: {
  readonly bodyId: string;
  readonly issue?: CadSelectionReferenceIssue;
  readonly reference?: CadGeneratedReference;
  readonly selection?: CadSelectionReferenceInput;
  readonly status: SelectionReferenceCandidatesQueryResponse["status"];
}): SelectionReferenceCandidatesQueryResponse {
  const candidateReference = reference ?? createFaceReference(bodyId);
  const candidateSelection = selection ?? { type: "body", bodyId };

  return {
    ok: true,
    query: "selection.referenceCandidates",
    cadOpsVersion: "cadops.v1",
    selection: candidateSelection,
    status,
    candidateCount: issue ? 0 : 1,
    candidates: issue
      ? []
      : [
          {
            source: "bodySelection",
            target: {
              type: "generatedReference",
              bodyId,
              stableId: candidateReference.stableId,
              kind: candidateReference.kind
            },
            reference: candidateReference,
            commandable: true,
            commandOperations: [
              "reference.nameGenerated",
              "feature.selectReference"
            ],
            label: candidateReference.label,
            issues: []
          }
        ],
    issueCount: issue ? 1 : 0,
    issues: issue ? [issue] : []
  };
}

function createFaceReference(bodyId: string): CadGeneratedFaceReference {
  return {
    kind: "face",
    stableId: `generated:face:${bodyId}:startCap`,
    label: "Start cap",
    bodyId,
    ownerPartId: "part:default",
    sourceFeatureId: "feat_rect",
    sourceSketchId: "sketch_1",
    sourceSketchEntityId: "rect_1",
    role: "startCap",
    eligibleOperations: ["feature.selectReference"],
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      surfaceType: "plane"
    }
  };
}
