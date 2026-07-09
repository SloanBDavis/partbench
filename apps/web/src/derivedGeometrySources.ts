import type {
  CadDocument,
  CadFeatureSummary,
  SketchSnapshot
} from "@web-cad/cad-core";
import type {
  CadGeneratedFaceReference,
  FeatureShellOpenFaceRef
} from "@web-cad/cad-protocol";
import {
  createPrimitiveDerivedGeometrySource,
  type DerivedBooleanExtrudeGeometrySource,
  type DerivedCircularPatternGeometrySource,
  type DerivedEdgeFinishGeometrySource,
  type DerivedExtrudeGeometrySource,
  type DerivedGeometrySource,
  type DerivedHoleGeometrySource,
  type DerivedLinearPatternGeometrySource,
  type DerivedMirrorGeometrySource,
  type DerivedRevolveGeometrySource,
  type DerivedShellGeometrySource
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
      document.namedReferences,
      document.topologyIdentity
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
  namedReferences: CadDocument["namedReferences"] = new Map(),
  topologyIdentity: CadDocument["topologyIdentity"] = undefined
): readonly (
  | DerivedExtrudeGeometrySource
  | DerivedBooleanExtrudeGeometrySource
  | DerivedRevolveGeometrySource
  | DerivedHoleGeometrySource
  | DerivedEdgeFinishGeometrySource
  | DerivedLinearPatternGeometrySource
  | DerivedCircularPatternGeometrySource
  | DerivedMirrorGeometrySource
  | DerivedShellGeometrySource
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
    ),
    ...createLinearPatternDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds
    ),
    ...createCircularPatternDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds
    ),
    ...createMirrorDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds
    ),
    ...createShellDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      namedReferences,
      topologyIdentity,
      consumedBodyIds
    )
  ];
}

export function createShellDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  namedReferences: CadDocument["namedReferences"] = new Map(),
  topologyIdentity: CadDocument["topologyIdentity"] = undefined,
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features)
): readonly DerivedShellGeometrySource[] {
  const extrudeFeaturesByBodyId = createExtrudeFeaturesByBodyId(features);

  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "shell" }> =>
        feature.kind === "shell"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature) => {
      const target = resolveExtrudeFamilySeedSource(
        feature.targetBodyId,
        extrudeFeaturesByBodyId,
        sketches,
        generatedFacesByKey
      );
      const openFaceResolution = resolveShellOpenFaceStableIds(
        feature,
        generatedFacesByKey,
        namedReferences,
        topologyIdentity
      );

      return {
        id: feature.bodyId,
        kind: "shell",
        target: target ?? createUnavailableExtrudeSource(feature.targetBodyId),
        wallThickness: feature.wallThickness,
        openFaceStableIds: openFaceResolution.stableIds,
        placementError:
          target === undefined
            ? `Shell feature ${feature.id} cannot be displayed because target body ${feature.targetBodyId} is not an authored extrude-family body.`
            : openFaceResolution.error
      };
    });
}

export function createLinearPatternDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features)
): readonly DerivedLinearPatternGeometrySource[] {
  const extrudeFeaturesByBodyId = createExtrudeFeaturesByBodyId(features);

  return features
    .filter(
      (
        feature
      ): feature is Extract<CadFeatureSummary, { kind: "linearPattern" }> =>
        feature.kind === "linearPattern"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature) => {
      const seed = resolveExtrudeFamilySeedSource(
        feature.seedBodyId,
        extrudeFeaturesByBodyId,
        sketches,
        generatedFacesByKey
      );

      return {
        id: feature.bodyId,
        kind: "linearPattern" as const,
        seed: seed ?? createUnavailableExtrudeSource(feature.seedBodyId),
        axis: feature.axis,
        spacing: feature.spacing,
        instanceCount: feature.instanceCount,
        ...(seed
          ? {}
          : {
              placementError: `Linear pattern feature ${feature.id} cannot be displayed because seed body ${feature.seedBodyId} is not a displayable extrude-family body.`
            })
      };
    });
}

export function createCircularPatternDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features)
): readonly DerivedCircularPatternGeometrySource[] {
  const extrudeFeaturesByBodyId = createExtrudeFeaturesByBodyId(features);

  return features
    .filter(
      (
        feature
      ): feature is Extract<CadFeatureSummary, { kind: "circularPattern" }> =>
        feature.kind === "circularPattern"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature) => {
      const seed = resolveExtrudeFamilySeedSource(
        feature.seedBodyId,
        extrudeFeaturesByBodyId,
        sketches,
        generatedFacesByKey
      );

      return {
        id: feature.bodyId,
        kind: "circularPattern" as const,
        seed: seed ?? createUnavailableExtrudeSource(feature.seedBodyId),
        rotationAxis: feature.rotationAxis,
        totalAngleDegrees: feature.totalAngleDegrees,
        instanceCount: feature.instanceCount,
        ...(seed
          ? {}
          : {
              placementError: `Circular pattern feature ${feature.id} cannot be displayed because seed body ${feature.seedBodyId} is not a displayable extrude-family body.`
            })
      };
    });
}

export function createMirrorDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features)
): readonly DerivedMirrorGeometrySource[] {
  const extrudeFeaturesByBodyId = createExtrudeFeaturesByBodyId(features);

  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "mirror" }> =>
        feature.kind === "mirror"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature) => {
      const seed = resolveExtrudeFamilySeedSource(
        feature.seedBodyId,
        extrudeFeaturesByBodyId,
        sketches,
        generatedFacesByKey
      );

      return {
        id: feature.bodyId,
        kind: "mirror" as const,
        seed: seed ?? createUnavailableExtrudeSource(feature.seedBodyId),
        mirrorPlane: feature.mirrorPlane,
        includeOriginal: feature.includeOriginal,
        ...(seed
          ? {}
          : {
              placementError: `Mirror feature ${feature.id} cannot be displayed because seed body ${feature.seedBodyId} is not a displayable extrude result.`
            })
      };
    });
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

        if (
          feature.kind === "linearPattern" ||
          feature.kind === "circularPattern"
        ) {
          return [feature.seedBodyId];
        }

        if (feature.kind === "mirror" && feature.includeOriginal) {
          return [feature.seedBodyId];
        }

        if (feature.kind === "shell") {
          return [feature.targetBodyId];
        }

        return [];
      })
      .filter((bodyId): bodyId is string => Boolean(bodyId))
  );
}

function createExtrudeFeaturesByBodyId(
  features: readonly CadFeatureSummary[]
): Map<string, Extract<CadFeatureSummary, { kind: "extrude" }>> {
  return new Map(
    features
      .filter(
        (feature): feature is Extract<CadFeatureSummary, { kind: "extrude" }> =>
          feature.kind === "extrude"
      )
      .map((feature) => [feature.bodyId, feature])
  );
}

function resolveExtrudeFamilySeedSource(
  seedBodyId: string,
  extrudeFeaturesByBodyId: ReadonlyMap<
    string,
    Extract<CadFeatureSummary, { kind: "extrude" }>
  >,
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>
):
  | DerivedExtrudeGeometrySource
  | DerivedBooleanExtrudeGeometrySource
  | undefined {
  const seedFeature = extrudeFeaturesByBodyId.get(seedBodyId);
  if (!seedFeature) {
    return undefined;
  }

  return createBooleanSourceForFeature(
    seedFeature,
    extrudeFeaturesByBodyId,
    sketches,
    generatedFacesByKey
  );
}

function resolveShellOpenFaceStableIds(
  feature: Extract<CadFeatureSummary, { kind: "shell" }>,
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  namedReferences: CadDocument["namedReferences"],
  topologyIdentity: CadDocument["topologyIdentity"]
): {
  readonly stableIds: readonly string[];
  readonly error?: string;
} {
  if (feature.openFaceRefs.length === 0) {
    return { stableIds: [] };
  }

  const failures: string[] = [];
  const stableIds: string[] = [];

  for (const ref of feature.openFaceRefs) {
    const resolved = resolveShellOpenFaceStableId(
      feature,
      ref,
      generatedFacesByKey,
      namedReferences,
      topologyIdentity
    );

    if (resolved.stableId) {
      stableIds.push(resolved.stableId);
    } else {
      failures.push(resolved.error);
    }
  }

  if (stableIds.length > 0) {
    return { stableIds };
  }

  return {
    stableIds: [],
    error: `Shell feature ${feature.id} cannot open faces because no references resolved. ${failures.join(" ")}`
  };
}

function resolveShellOpenFaceStableId(
  feature: Extract<CadFeatureSummary, { kind: "shell" }>,
  ref: FeatureShellOpenFaceRef,
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  namedReferences: CadDocument["namedReferences"],
  topologyIdentity: CadDocument["topologyIdentity"]
): {
  readonly stableId?: string;
  readonly error: string;
} {
  if (ref.kind === "generatedFace") {
    if (ref.bodyId !== feature.targetBodyId) {
      return {
        error: `Generated face ${ref.stableId} belongs to body ${ref.bodyId}, not target ${feature.targetBodyId}.`
      };
    }

    const face = generatedFacesByKey.get(
      createGeneratedFaceReferenceKey(ref.bodyId, ref.stableId)
    );

    if (!face) {
      return {
        error: `Generated face ${ref.stableId} is unavailable on ${ref.bodyId}.`
      };
    }

    return { stableId: face.stableId, error: "" };
  }

  if (ref.kind === "namedReference") {
    const named = namedReferences.get(ref.name);

    if (!named) {
      return {
        error: `Named reference ${ref.name} is unavailable.`
      };
    }

    if (named.kind !== "face") {
      return {
        error: `Named reference ${ref.name} is a ${named.kind}, not a face.`
      };
    }

    if (named.bodyId !== feature.targetBodyId) {
      return {
        error: `Named reference ${ref.name} resolves to body ${named.bodyId}, not target ${feature.targetBodyId}.`
      };
    }

    return { stableId: named.stableId, error: "" };
  }

  const anchor = topologyIdentity?.anchors.find(
    (candidate) => candidate.anchorId === ref.anchorId
  );

  if (!anchor) {
    return {
      error: `Topology anchor ${ref.anchorId} is unavailable.`
    };
  }

  if (anchor.entityKind !== "face") {
    return {
      error: `Topology anchor ${ref.anchorId} targets a ${anchor.entityKind}, not a face.`
    };
  }

  if (
    anchor.bodyId !== feature.targetBodyId ||
    ref.bodyId !== feature.targetBodyId
  ) {
    return {
      error: `Topology anchor ${ref.anchorId} does not target body ${feature.targetBodyId}.`
    };
  }

  if (anchor.state !== "active") {
    return {
      error: `Topology anchor ${ref.anchorId} is ${anchor.state}.`
    };
  }

  if (anchor.stableId) {
    return { stableId: anchor.stableId, error: "" };
  }

  if (anchor.sourceSemanticRole) {
    const matches = [...generatedFacesByKey.values()].filter(
      (face) =>
        face.bodyId === feature.targetBodyId &&
        face.role === anchor.sourceSemanticRole
    );

    if (matches.length === 1) {
      return { stableId: matches[0].stableId, error: "" };
    }

    return {
      error:
        matches.length === 0
          ? `Topology anchor ${ref.anchorId} has no generated face for role ${anchor.sourceSemanticRole}.`
          : `Topology anchor ${ref.anchorId} role ${anchor.sourceSemanticRole} is ambiguous.`
    };
  }

  return {
    error: `Topology anchor ${ref.anchorId} has no stable generated face.`
  };
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
