import type {
  CadDocument,
  CadFeatureSummary,
  SketchSnapshot
} from "@web-cad/cad-core";
import type { CadGeneratedFaceReference } from "@web-cad/cad-protocol";
import {
  createPrimitiveDerivedGeometrySource,
  type DerivedBooleanExtrudeGeometrySource,
  type DerivedExtrudeGeometrySource,
  type DerivedGeometrySource
} from "./derivedGeometry";
import {
  createAttachedSketchGeometryFrame,
  createGeneratedFaceReferenceKey,
  type SketchDisplayFrame
} from "./sketchDisplayFrames";

export function createDerivedGeometrySourcesFromDocument(
  document: CadDocument,
  features: readonly CadFeatureSummary[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map()
): readonly DerivedGeometrySource[] {
  const sketches = [...document.sketches.values()].map((sketch) => ({
    id: sketch.id,
    name: sketch.name,
    plane: sketch.plane,
    attachment: sketch.attachment,
    entities: [...sketch.entities.values()]
  }));

  return [
    ...[...document.objects.values()].map(createPrimitiveDerivedGeometrySource),
    ...createExtrudeDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey
    )
  ];
}

export function createExtrudeDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map()
): readonly (
  | DerivedExtrudeGeometrySource
  | DerivedBooleanExtrudeGeometrySource
)[] {
  const extrudeFeatures = features.filter(
    (feature): feature is Extract<CadFeatureSummary, { kind: "extrude" }> =>
      feature.kind === "extrude"
  );
  const featuresByBodyId = new Map(
    extrudeFeatures.map((feature) => [feature.bodyId, feature])
  );
  const consumedBodyIds = new Set(
    extrudeFeatures
      .filter(
        (feature) =>
          feature.operationMode === "add" || feature.operationMode === "cut"
      )
      .map((feature) => feature.targetBodyId)
      .filter((bodyId): bodyId is string => Boolean(bodyId))
  );
  const sources: (
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource
  )[] = [];

  for (const feature of extrudeFeatures) {
    if (feature.operationMode === "add" || feature.operationMode === "cut") {
      const targetFeature = feature.targetBodyId
        ? featuresByBodyId.get(feature.targetBodyId)
        : undefined;
      const target = targetFeature
        ? createExtrudeSourceForFeature(
            targetFeature,
            sketches,
            generatedFacesByKey
          )
        : undefined;
      const tool = createExtrudeSourceForFeature(
        feature,
        sketches,
        generatedFacesByKey
      );

      sources.push({
        id: feature.bodyId,
        kind: "extrudeBoolean",
        operation: feature.operationMode,
        ...(target && tool
          ? { target, tool }
          : {
              target: target ?? createUnavailableExtrudeSource(feature.bodyId),
              tool: tool ?? createUnavailableExtrudeSource(feature.bodyId)
            }),
        ...createBooleanPlacementError(feature, target, tool)
      });
      continue;
    }

    if (consumedBodyIds.has(feature.bodyId)) {
      continue;
    }

    const source = createExtrudeSourceForFeature(
      feature,
      sketches,
      generatedFacesByKey
    );

    if (source) {
      sources.push(source);
    }
  }

  return sources;
}

function createExtrudeSourceForFeature(
  feature: Extract<CadFeatureSummary, { kind: "extrude" }>,
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>
): DerivedExtrudeGeometrySource | undefined {
  const sketch = sketches.find(
    (candidate) => candidate.id === feature.sketchId
  );
  const entity = sketch?.entities.find(
    (candidate) => candidate.id === feature.entityId
  );

  if (!sketch || !entity) {
    return undefined;
  }

  const placement = createAttachedSketchExtrudePlacement(
    sketch,
    generatedFacesByKey
  );

  if (entity.kind === "rectangle") {
    return {
      id: feature.bodyId,
      kind: "extrude",
      sketchPlane: sketch.plane,
      profile: {
        kind: entity.kind,
        center: entity.center,
        width: entity.width,
        height: entity.height
      },
      depth: feature.depth,
      side: feature.side,
      ...placement
    };
  }

  if (entity.kind === "circle") {
    return {
      id: feature.bodyId,
      kind: "extrude",
      sketchPlane: sketch.plane,
      profile: {
        kind: entity.kind,
        center: entity.center,
        radius: entity.radius
      },
      depth: feature.depth,
      side: feature.side,
      ...placement
    };
  }

  return undefined;
}

function createBooleanPlacementError(
  feature: Extract<CadFeatureSummary, { kind: "extrude" }>,
  target: DerivedExtrudeGeometrySource | undefined,
  tool: DerivedExtrudeGeometrySource | undefined
): { readonly placementError?: string } {
  if (!target || !tool) {
    const operation = feature.operationMode === "add" ? "Add" : "Cut";

    return {
      placementError: `${operation} feature ${feature.id} cannot be displayed because its target or tool source is unavailable.`
    };
  }

  if (target.placementError) {
    return { placementError: target.placementError };
  }

  if (tool.placementError) {
    return { placementError: tool.placementError };
  }

  return {};
}

function createUnavailableExtrudeSource(
  id: string
): DerivedExtrudeGeometrySource {
  return {
    id,
    kind: "extrude",
    sketchPlane: "XY",
    profile: { kind: "rectangle", center: [0, 0], width: 1, height: 1 },
    depth: 1,
    side: "positive",
    placementError: "Extrude source is unavailable."
  };
}

function createAttachedSketchExtrudePlacement(
  sketch: SketchSnapshot,
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>
): {
  readonly placementFrame?: SketchDisplayFrame;
  readonly placementError?: string;
} {
  const attachment = sketch.attachment;

  if (!attachment) {
    return {};
  }

  const face = generatedFacesByKey.get(
    createGeneratedFaceReferenceKey(attachment.bodyId, attachment.faceStableId)
  );

  if (!face) {
    return {
      placementError: `Attachment unresolved for ${sketch.name}; derived extrude mesh is unavailable.`
    };
  }

  const frame = createAttachedSketchGeometryFrame(sketch, face);

  if (!frame) {
    return {
      placementError: `Attachment face cannot place ${sketch.name}; derived extrude mesh is unavailable.`
    };
  }

  return { placementFrame: frame };
}
