import { CadEngine, exportCadProjectJson } from "@web-cad/cad-core";
import type { SceneObject } from "@web-cad/cad-core";
import type {
  CadBodySnapshot,
  CadGeneratedFaceReference,
  CadSelectionReferenceIssue,
  SketchSnapshot,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import { resolveViewportHoverIntent } from "./viewportHoverIntent";

describe("viewport hover intent", () => {
  it("resolves authored body render IDs to semantic body hover state", () => {
    const body = createExtrudeBody("body_rect", "Base");
    const face = createFaceReference(body.id);
    const response = createCandidateResponse({
      bodyId: body.id,
      reference: face,
      status: "resolved"
    });
    const hover = resolveViewportHoverIntent({
      hoveredRenderId: body.id,
      bodies: [body],
      objects: [],
      readReferenceCandidates: (selection) => {
        expect(selection).toEqual({ type: "body", bodyId: body.id });
        return response;
      }
    });

    expect(hover).toMatchObject({
      kind: "body",
      title: "Base (Body)",
      detail: "4 available actions",
      tone: "ready",
      bodyId: "body_rect",
      renderTargetId: "body_rect",
      semanticSelection: { type: "body", bodyId: "body_rect" },
      referenceStatus: "resolved",
      commandOperationLabels: [
        "Name reference",
        "Create sketch on face",
        "Measure reference",
        "Inspect reference"
      ],
      diagnostics: []
    });
  });

  it("keeps primitive object hover separate from object-backed body diagnostics", () => {
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
    const hover = resolveViewportHoverIntent({
      hoveredRenderId: object.id,
      bodies: [body],
      objects: [object],
      readReferenceCandidates: () => response
    });

    expect(hover).toMatchObject({
      kind: "object",
      title: "box_1 (Box)",
      objectId: "box_1",
      bodyId: "body:box_1",
      renderTargetId: "box_1",
      semanticSelection: { type: "body", bodyId: "body:box_1" },
      referenceStatus: "unsupported",
      tone: "blocked",
      diagnostics: [
        {
          code: "UNSUPPORTED_SELECTION_TARGET",
          status: "unsupported"
        }
      ]
    });
  });

  it.each([
    ["missing", "MISSING_SELECTION_TARGET"],
    ["stale", "STALE_SELECTION_REFERENCE"],
    ["unsupported", "UNSUPPORTED_SELECTION_TARGET"],
    ["ambiguous", "AMBIGUOUS_SELECTION_TOPOLOGY"],
    ["consumed", "CONSUMED_SELECTION_BODY"],
    ["non-commandable", "NON_COMMANDABLE_SELECTION_TARGET"]
  ] as const)(
    "carries structured %s diagnostics from CADOps candidate responses",
    (status, code) => {
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
      const hover = resolveViewportHoverIntent({
        hoveredRenderId: body.id,
        bodies: [body],
        objects: [],
        readReferenceCandidates: () => response
      });

      expect(hover.kind).toBe("body");
      expect(hover.diagnostics).toEqual([
        {
          code,
          status,
          message: `${status} body diagnostic`
        }
      ]);
    }
  );

  it("does not convert sketch or unknown render IDs into generated-reference hover state", () => {
    const sketchHover = resolveViewportHoverIntent({
      hoveredRenderId: "sketch:sketch_1",
      bodies: [],
      objects: []
    });
    const unknownHover = resolveViewportHoverIntent({
      hoveredRenderId: "selection-buffer:face:17",
      bodies: [],
      objects: []
    });

    expect(sketchHover).toMatchObject({
      kind: "unsupported",
      title: "Viewport hover unsupported",
      diagnostics: [
        {
          code: "UNSUPPORTED_SELECTION_TARGET",
          status: "unsupported"
        }
      ]
    });
    expect(unknownHover).toMatchObject({
      kind: "missing",
      title: "Viewport hover unavailable",
      diagnostics: [
        {
          code: "MISSING_SELECTION_TARGET",
          status: "missing"
        }
      ]
    });
    expect(sketchHover).not.toHaveProperty("selectedId");
    expect(unknownHover).not.toHaveProperty("selectedId");
    expect(JSON.stringify(unknownHover)).not.toContain("selection-buffer");
  });

  it("hovers a construction arc as one current sketch entity", () => {
    const sketch: SketchSnapshot = {
      id: "sketch_1",
      name: "Guide sketch",
      plane: "XY",
      entities: [
        {
          id: "arc_1",
          kind: "arc",
          center: [0, 0],
          radius: 2,
          startAngleDegrees: 0,
          sweepAngleDegrees: -90,
          construction: true
        }
      ]
    };
    const hover = resolveViewportHoverIntent({
      hoveredRenderId: "sketch:sketch_1:entity:arc_1",
      bodies: [],
      objects: [],
      sketches: [sketch]
    });

    expect(hover).toEqual({
      kind: "sketchEntity",
      title: "arc_1 (Arc)",
      detail: "Construction arc in Guide sketch",
      tone: "idle",
      sketchId: "sketch_1",
      entityId: "arc_1",
      renderTargetId: "sketch:sketch_1:entity:arc_1",
      commandOperations: [],
      commandOperationLabels: [],
      diagnostics: []
    });
  });

  it("keeps hover and candidate query state out of project JSON", () => {
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
        id: "feat_rect_1",
        bodyId: "body_rect_1",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 3
      }
    ]);

    const before = exportCadProjectJson(engine);
    engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "selection.referenceCandidates",
        selection: { type: "body", bodyId: "body_rect_1" }
      }
    });

    expect(exportCadProjectJson(engine)).toBe(before);
    expect(before).not.toContain("viewportHover");
    expect(before).not.toContain("hoveredRenderId");
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

function createExtrudeBody(id: string, name?: string): CadBodySnapshot {
  return {
    id,
    ...(name ? { name } : {}),
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
  reference = createFaceReference(bodyId),
  status
}: {
  readonly bodyId: string;
  readonly issue?: CadSelectionReferenceIssue;
  readonly reference?: CadGeneratedFaceReference;
  readonly status: SelectionReferenceCandidatesQueryResponse["status"];
}): SelectionReferenceCandidatesQueryResponse {
  return {
    ok: true,
    query: "selection.referenceCandidates",
    cadOpsVersion: "cadops.v1",
    selection: { type: "body", bodyId },
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
              stableId: reference.stableId,
              kind: reference.kind
            },
            reference,
            commandable: true,
            commandOperations: [
              "reference.nameGenerated",
              "feature.attachSketchPlane",
              "feature.measureReference",
              "feature.selectReference"
            ],
            label: reference.label,
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
    eligibleOperations: ["feature.attachSketchPlane"],
    geometricSignature: {
      profileKind: "rectangle",
      sketchPlane: "XY",
      extrudeSide: "positive",
      depth: 2,
      surfaceType: "plane"
    }
  };
}
