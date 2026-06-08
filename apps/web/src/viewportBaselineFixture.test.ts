import { CadEngine } from "@web-cad/cad-core";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadBodySnapshot,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import { getGeneratedReferenceItems } from "./generatedReferenceUi";
import { createViewportBaselineFixtureSnapshot } from "./viewportBaselineFixture";
import type { DerivedGeometryEntry } from "./derivedGeometry";
import { resolveViewportHoverIntent } from "./viewportHoverIntent";
import { createViewportMeasurementOverlay } from "./viewportMeasurementOverlay";
import { createViewportSelectionDisplay } from "./viewportSelectionDisplay";

describe("V7 viewport baseline fixture", () => {
  it("creates a deterministic semantic snapshot for a rectangle extrude body", () => {
    const engine = createRectangleExtrudeEngine();
    const body = readBody(engine, "body_rect_1");
    const references = readGeneratedReferences(engine, body.id);
    const referenceCandidatesByStableId =
      readSelectionReferenceCandidatesByStableId(engine, references);
    const bodyCandidates = readSelectionReferenceCandidates(engine, {
      type: "body",
      bodyId: body.id
    });
    const bodyMeasurements = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.measurements", bodyId: body.id }
    });
    const geometryEntry = createReadyGeometryEntry(body.id);
    const selectedGeneratedReferenceState = { status: "none" as const };
    const selectionDisplay = createViewportSelectionDisplay({
      derivedGeometryEnabled: true,
      selectedBody: body,
      selectedGeneratedReferenceState,
      selectedGeometryEntry: geometryEntry,
      selectionReferenceCandidates: bodyCandidates
    });
    const hoverState = resolveViewportHoverIntent({
      hoveredRenderId: body.id,
      bodies: [body],
      objects: [],
      readReferenceCandidates: (selection) =>
        readSelectionReferenceCandidates(engine, selection)
    });
    const measurementOverlay = createViewportMeasurementOverlay({
      body,
      bodyMeasurements:
        bodyMeasurements.ok && bodyMeasurements.query === "body.measurements"
          ? bodyMeasurements.measurements
          : undefined,
      selectedGeneratedReferenceState,
      units: "mm"
    });
    const snapshot = createViewportBaselineFixtureSnapshot({
      body,
      geometryEntry,
      hoverState,
      measurementOverlay,
      referenceCandidatesByStableId,
      references,
      selectionDisplay
    });

    expect(snapshot).toMatchObject({
      body: {
        id: "body_rect_1",
        label: "body_rect_1",
        geometryStatus: "ready",
        geometryDetail: "OCCT mesh ready"
      },
      selection: {
        title: "body_rect_1 (Body)",
        detail: "Command-ready reference",
        tone: "ready"
      },
      hover: {
        title: "body_rect_1 (Body)",
        tone: "ready"
      },
      measurement: {
        title: "Body measurements",
        detail: "body_rect_1",
        rows: [
          "Volume: 24 mm^3",
          "Surface area: 52 mm^2",
          "Local bounds: min -2 mm, -1 mm, 0 mm; max 2 mm, 1 mm, 3 mm; size 4 mm, 2 mm, 3 mm",
          "Centroid: 0, 0, 1.50",
          "Model: Source analytic"
        ]
      }
    });
    expect(snapshot.references).toHaveLength(27);
    expect(snapshot.references.slice(0, 3)).toEqual([
      {
        kind: "body",
        label: "Body: Rectangle extrude body",
        bodyId: "body_rect_1",
        stableId: "generated:body:body_rect_1",
        commandable: true,
        commandOperationLabels: [
          "Name reference",
          "Measure reference",
          "Inspect reference"
        ]
      },
      {
        kind: "face",
        label: "Face: Start cap",
        bodyId: "body_rect_1",
        stableId: "generated:face:body_rect_1:startCap",
        commandable: true,
        commandOperationLabels: [
          "Name reference",
          "Create sketch on face",
          "Measure reference",
          "Inspect reference"
        ]
      },
      {
        kind: "face",
        label: "Face: End cap",
        bodyId: "body_rect_1",
        stableId: "generated:face:body_rect_1:endCap",
        commandable: true,
        commandOperationLabels: [
          "Name reference",
          "Create sketch on face",
          "Measure reference",
          "Inspect reference"
        ]
      }
    ]);

    const visibleSnapshot = JSON.stringify(snapshot);
    expect(visibleSnapshot).not.toContain("selection-buffer");
    expect(visibleSnapshot).not.toContain("mesh-triangle");
    expect(visibleSnapshot).not.toContain("occt-shape");
    expect(visibleSnapshot).not.toContain("cacheKey");
    expect(visibleSnapshot).not.toContain("indices");
    expect(visibleSnapshot).not.toContain("vertices");
  });
});

function createRectangleExtrudeEngine(): CadEngine {
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

  return engine;
}

function readBody(engine: CadEngine, bodyId: string): CadBodySnapshot {
  const structure = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  if (!structure.ok || structure.query !== "project.structure") {
    throw new Error("Expected project structure.");
  }

  const body = structure.bodies.find((candidate) => candidate.id === bodyId);

  if (!body) {
    throw new Error(`Expected body ${bodyId}.`);
  }

  return body;
}

function readGeneratedReferences(
  engine: CadEngine,
  bodyId: string
): BodyGeneratedReferencesQueryResponse {
  const references = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.generatedReferences", bodyId }
  });

  if (!references.ok || references.query !== "body.generatedReferences") {
    throw new Error("Expected generated references.");
  }

  return references;
}

function readSelectionReferenceCandidates(
  engine: CadEngine,
  selection: SelectionReferenceCandidatesQueryResponse["selection"]
): SelectionReferenceCandidatesQueryResponse {
  const candidates = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "selection.referenceCandidates",
      selection
    }
  });

  if (!candidates.ok || candidates.query !== "selection.referenceCandidates") {
    throw new Error("Expected selection reference candidates.");
  }

  return candidates;
}

function readSelectionReferenceCandidatesByStableId(
  engine: CadEngine,
  references: BodyGeneratedReferencesQueryResponse
): ReadonlyMap<string, SelectionReferenceCandidatesQueryResponse> {
  return new Map(
    getGeneratedReferenceItems(references).map((reference) => [
      reference.stableId,
      readSelectionReferenceCandidates(engine, {
        type: "generatedReference",
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        expectedKind: reference.kind
      })
    ])
  );
}

function createReadyGeometryEntry(bodyId: string): DerivedGeometryEntry {
  return {
    objectId: bodyId,
    objectKind: "extrude",
    sourceId: bodyId,
    sourceKind: "extrude",
    cacheKey: "occt-shape:solid:42",
    status: "ready",
    mesh: createMesh(bodyId),
    metrics: {
      objectId: bodyId,
      roundTripMs: 1,
      vertexCount: 4,
      triangleCount: 2
    }
  };
}

function createMesh(id: string): RenderTriangleMesh {
  return {
    id,
    kind: "mesh",
    vertices: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0]
    ],
    indices: [0, 1, 2, 0, 2, 3],
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}
