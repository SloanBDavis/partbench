import type {
  CadDocument,
  CadFeatureSummary,
  SketchSnapshot
} from "@web-cad/cad-core";
import type { CadGeneratedFaceReference } from "@web-cad/cad-protocol";
import {
  createPrimitiveDerivedGeometrySource,
  type DerivedBooleanExtrudeGeometrySource,
  type DerivedEdgeFinishGeometrySource,
  type DerivedExtrudeGeometrySource,
  type DerivedGeometrySource,
  type DerivedHoleGeometrySource,
  type DerivedRevolveGeometrySource
} from "./derivedGeometry";
import {
  createAttachedSketchGeometryFrame,
  createGeneratedFaceReferenceKey,
  createTopologyAnchorFaceDisplayFrame,
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
    ...createAuthoredFeatureDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      document.namedReferences
    )
  ];
}

export function createAuthoredFeatureDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  namedReferences: CadDocument["namedReferences"] = new Map()
): readonly (
  | DerivedExtrudeGeometrySource
  | DerivedBooleanExtrudeGeometrySource
  | DerivedRevolveGeometrySource
  | DerivedHoleGeometrySource
  | DerivedEdgeFinishGeometrySource
)[] {
  const consumedBodyIds = createConsumedBodyIds(features);

  return [
    ...createExtrudeDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds
    ),
    ...createRevolveDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds
    ),
    ...createHoleDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds
    ),
    ...createEdgeFinishDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      namedReferences,
      consumedBodyIds
    )
  ];
}

export function createExtrudeDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features)
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
  const sources: (
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource
  )[] = [];

  for (const feature of extrudeFeatures) {
    if (consumedBodyIds.has(feature.bodyId)) {
      continue;
    }

    if (feature.operationMode === "add" || feature.operationMode === "cut") {
      sources.push(
        createBooleanSourceForFeature(
          feature,
          featuresByBodyId,
          sketches,
          generatedFacesByKey
        )
      );
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

function createBooleanSourceForFeature(
  feature: Extract<CadFeatureSummary, { kind: "extrude" }>,
  featuresByBodyId: ReadonlyMap<
    string,
    Extract<CadFeatureSummary, { kind: "extrude" }>
  >,
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  visitedFeatureIds: ReadonlySet<string> = new Set()
): DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource {
  if (feature.operationMode !== "add" && feature.operationMode !== "cut") {
    return (
      createExtrudeSourceForFeature(feature, sketches, generatedFacesByKey) ??
      createUnavailableExtrudeSource(feature.bodyId)
    );
  }

  if (visitedFeatureIds.has(feature.id)) {
    return {
      id: feature.bodyId,
      kind: "extrudeBoolean",
      operation: feature.operationMode,
      target: createUnavailableExtrudeSource(feature.bodyId),
      tool: createUnavailableExtrudeSource(feature.bodyId),
      placementError: `Boolean feature ${feature.id} cannot be displayed because its target chain is cyclic.`
    };
  }

  const nextVisitedFeatureIds = new Set(visitedFeatureIds);
  nextVisitedFeatureIds.add(feature.id);
  const targetFeature = feature.targetBodyId
    ? featuresByBodyId.get(feature.targetBodyId)
    : undefined;
  const target = targetFeature
    ? createBooleanSourceForFeature(
        targetFeature,
        featuresByBodyId,
        sketches,
        generatedFacesByKey,
        nextVisitedFeatureIds
      )
    : undefined;
  const tool = createExtrudeSourceForFeature(
    feature,
    sketches,
    generatedFacesByKey
  );

  return {
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
  };
}

export function createRevolveDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features)
): readonly DerivedRevolveGeometrySource[] {
  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "revolve" }> =>
        feature.kind === "revolve"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature) =>
      createRevolveSourceForFeature(feature, sketches, generatedFacesByKey)
    )
    .filter(
      (source): source is DerivedRevolveGeometrySource => source !== undefined
    );
}

export function createHoleDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features)
): readonly DerivedHoleGeometrySource[] {
  const extrudeFeaturesByBodyId = new Map(
    features
      .filter(
        (feature): feature is Extract<CadFeatureSummary, { kind: "extrude" }> =>
          feature.kind === "extrude"
      )
      .map((feature) => [feature.bodyId, feature])
  );

  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "hole" }> =>
        feature.kind === "hole"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature) => {
      const targetFeature = extrudeFeaturesByBodyId.get(feature.targetBodyId);
      const target =
        targetFeature !== undefined
          ? createBooleanSourceForFeature(
              targetFeature,
              extrudeFeaturesByBodyId,
              sketches,
              generatedFacesByKey
            )
          : undefined;
      const toolResult = createHoleToolSourceForFeature(
        feature,
        sketches,
        generatedFacesByKey
      );

      return {
        id: feature.bodyId,
        kind: "hole",
        target: target ?? createUnavailableExtrudeSource(feature.bodyId),
        tool: toolResult.tool ?? createUnavailableHoleToolSource(),
        ...createHolePlacementError(feature, target, toolResult)
      };
    });
}

export function createEdgeFinishDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  namedReferences: CadDocument["namedReferences"] = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features)
): readonly DerivedEdgeFinishGeometrySource[] {
  const extrudeFeaturesByBodyId = new Map(
    features
      .filter(
        (feature): feature is Extract<CadFeatureSummary, { kind: "extrude" }> =>
          feature.kind === "extrude"
      )
      .map((feature) => [feature.bodyId, feature])
  );

  return features
    .filter(
      (
        feature
      ): feature is Extract<
        CadFeatureSummary,
        { kind: "chamfer" | "fillet" }
      > => feature.kind === "chamfer" || feature.kind === "fillet"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature) => {
      const targetFeature = extrudeFeaturesByBodyId.get(feature.targetBodyId);
      const target =
        targetFeature !== undefined
          ? createBooleanSourceForFeature(
              targetFeature,
              extrudeFeaturesByBodyId,
              sketches,
              generatedFacesByKey
            )
          : undefined;
      const edgeReference = resolveEdgeFinishStableId(feature, namedReferences);
      const placement = createEdgeFinishPlacementError(
        feature,
        target,
        edgeReference
      );

      if (feature.kind === "chamfer") {
        return {
          id: feature.bodyId,
          kind: "edgeFinish",
          operation: "chamfer",
          target: target ?? createUnavailableExtrudeSource(feature.bodyId),
          edgeStableId: edgeReference.edgeStableId ?? "",
          distance: feature.distance,
          ...placement
        };
      }

      return {
        id: feature.bodyId,
        kind: "edgeFinish",
        operation: "fillet",
        target: target ?? createUnavailableExtrudeSource(feature.bodyId),
        edgeStableId: edgeReference.edgeStableId ?? "",
        radius: feature.radius,
        ...placement
      };
    });
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

  const placement = createAttachedSketchFeaturePlacement(
    sketch,
    generatedFacesByKey,
    "extrude"
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

function createHoleToolSourceForFeature(
  feature: Extract<CadFeatureSummary, { kind: "hole" }>,
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>
): {
  readonly tool?: DerivedHoleGeometrySource["tool"];
  readonly placementError?: string;
} {
  const sketch = sketches.find(
    (candidate) => candidate.id === feature.sketchId
  );
  const entity = sketch?.entities.find(
    (candidate) => candidate.id === feature.circleEntityId
  );

  if (!sketch || !entity || entity.kind !== "circle") {
    return {};
  }

  const placement = createAttachedSketchFeaturePlacement(
    sketch,
    generatedFacesByKey,
    "hole"
  );

  if (placement.placementError) {
    return placement;
  }

  return {
    tool: {
      sketchPlane: sketch.plane,
      circle: {
        kind: entity.kind,
        center: entity.center,
        radius: entity.radius
      },
      depthMode: feature.depthMode,
      depth: feature.depth,
      direction: feature.direction,
      placementFrame: placement.placementFrame
    }
  };
}

function createRevolveSourceForFeature(
  feature: Extract<CadFeatureSummary, { kind: "revolve" }>,
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>
): DerivedRevolveGeometrySource | undefined {
  const sketch = sketches.find(
    (candidate) => candidate.id === feature.sketchId
  );
  const entity = sketch?.entities.find(
    (candidate) => candidate.id === feature.entityId
  );
  const axis = sketch?.entities.find(
    (candidate) => candidate.id === feature.axis.entityId
  );

  if (!sketch || !entity || !axis || axis.kind !== "line") {
    return undefined;
  }

  const placement = createAttachedSketchFeaturePlacement(
    sketch,
    generatedFacesByKey,
    "revolve"
  );
  const placementState =
    feature.operationMode === "newBody"
      ? placement
      : {
          placementError:
            "Revolve display currently supports newBody revolve features only."
        };

  if (entity.kind === "rectangle") {
    return {
      id: feature.bodyId,
      kind: "revolve",
      sketchPlane: sketch.plane,
      profile: {
        kind: entity.kind,
        center: entity.center,
        width: entity.width,
        height: entity.height
      },
      axis: { start: axis.start, end: axis.end },
      angleDegrees: feature.angleDegrees,
      ...placementState
    };
  }

  if (entity.kind === "circle") {
    return {
      id: feature.bodyId,
      kind: "revolve",
      sketchPlane: sketch.plane,
      profile: {
        kind: entity.kind,
        center: entity.center,
        radius: entity.radius
      },
      axis: { start: axis.start, end: axis.end },
      angleDegrees: feature.angleDegrees,
      ...placementState
    };
  }

  return undefined;
}

function createConsumedBodyIds(
  features: readonly CadFeatureSummary[]
): ReadonlySet<string> {
  return new Set(
    features
      .flatMap((feature) => {
        if (
          feature.kind === "extrude" &&
          (feature.operationMode === "add" || feature.operationMode === "cut")
        ) {
          return feature.targetBodyId ? [feature.targetBodyId] : [];
        }

        if (feature.kind === "hole") {
          return [feature.targetBodyId];
        }

        if (feature.kind === "chamfer" || feature.kind === "fillet") {
          return [feature.targetBodyId];
        }

        return [];
      })
      .filter((bodyId): bodyId is string => Boolean(bodyId))
  );
}

function createBooleanPlacementError(
  feature: Extract<CadFeatureSummary, { kind: "extrude" }>,
  target:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource
    | undefined,
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

function createHolePlacementError(
  feature: Extract<CadFeatureSummary, { kind: "hole" }>,
  target:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource
    | undefined,
  toolResult: {
    readonly tool?: DerivedHoleGeometrySource["tool"];
    readonly placementError?: string;
  }
): { readonly placementError?: string } {
  if (toolResult.placementError) {
    return { placementError: toolResult.placementError };
  }

  if (!target || !toolResult.tool) {
    return {
      placementError: `Hole feature ${feature.id} cannot be displayed because its target or circle tool source is unavailable.`
    };
  }

  if (target.placementError) {
    return { placementError: target.placementError };
  }

  return {};
}

function createEdgeFinishPlacementError(
  feature: Extract<CadFeatureSummary, { kind: "chamfer" | "fillet" }>,
  target:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource
    | undefined,
  edgeReference: {
    readonly edgeStableId?: string;
    readonly placementError?: string;
  }
): { readonly placementError?: string } {
  if (edgeReference.placementError) {
    return { placementError: edgeReference.placementError };
  }

  if (!target) {
    return {
      placementError: `${formatEdgeFinishLabel(feature)} feature ${feature.id} cannot be displayed because its target source is unavailable.`
    };
  }

  if (target.placementError) {
    return { placementError: target.placementError };
  }

  if (!edgeReference.edgeStableId) {
    return {
      placementError: `${formatEdgeFinishLabel(feature)} feature ${feature.id} cannot be displayed because its edge reference is unavailable.`
    };
  }

  return {};
}

function resolveEdgeFinishStableId(
  feature: Extract<CadFeatureSummary, { kind: "chamfer" | "fillet" }>,
  namedReferences: CadDocument["namedReferences"]
): {
  readonly edgeStableId?: string;
  readonly placementError?: string;
} {
  if (feature.edgeStableId) {
    return { edgeStableId: feature.edgeStableId };
  }

  if (!feature.namedReference) {
    return {
      placementError: `${formatEdgeFinishLabel(feature)} feature ${feature.id} cannot be displayed because it is missing an edge reference.`
    };
  }

  const reference = namedReferences.get(feature.namedReference);

  if (!reference) {
    return {
      placementError: `${formatEdgeFinishLabel(feature)} feature ${feature.id} cannot be displayed because named reference ${feature.namedReference} is unavailable.`
    };
  }

  if (reference.bodyId !== feature.targetBodyId) {
    return {
      placementError: `${formatEdgeFinishLabel(feature)} feature ${feature.id} cannot be displayed because named reference ${feature.namedReference} resolves to body ${reference.bodyId}.`
    };
  }

  if (reference.kind !== "edge") {
    return {
      placementError: `${formatEdgeFinishLabel(feature)} feature ${feature.id} cannot be displayed because named reference ${feature.namedReference} is not an edge.`
    };
  }

  return { edgeStableId: reference.stableId };
}

function formatEdgeFinishLabel(
  feature: Extract<CadFeatureSummary, { kind: "chamfer" | "fillet" }>
): "Chamfer" | "Fillet" {
  return feature.kind === "chamfer" ? "Chamfer" : "Fillet";
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

function createUnavailableHoleToolSource(): DerivedHoleGeometrySource["tool"] {
  return {
    sketchPlane: "XY",
    circle: { kind: "circle", center: [0, 0], radius: 1 },
    depthMode: "blind",
    depth: 1,
    direction: "positive"
  };
}

function createAttachedSketchFeaturePlacement(
  sketch: SketchSnapshot,
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  featureKind: "extrude" | "revolve" | "hole"
): {
  readonly placementFrame?: SketchDisplayFrame;
  readonly placementError?: string;
} {
  const attachment = sketch.attachment;

  if (!attachment) {
    return {};
  }

  if (attachment.kind === "topologyAnchorFace") {
    return {
      placementFrame: createTopologyAnchorFaceDisplayFrame(attachment)
    };
  }

  const face = generatedFacesByKey.get(
    createGeneratedFaceReferenceKey(attachment.bodyId, attachment.faceStableId)
  );

  if (!face) {
    return {
      placementError: `Attachment unresolved for ${sketch.name}; derived ${featureKind} mesh is unavailable.`
    };
  }

  const frame = createAttachedSketchGeometryFrame(sketch, face);

  if (!frame) {
    return {
      placementError: `Attachment face cannot place ${sketch.name}; derived ${featureKind} mesh is unavailable.`
    };
  }

  return { placementFrame: frame };
}
