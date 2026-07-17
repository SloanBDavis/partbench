import type {
  CadDocument,
  CadFeatureSummary,
  SketchSnapshot
} from "@web-cad/cad-core";
import {
  SKETCH_GEOMETRY_POLICY,
  resolveMirrorPlaneFrame,
  resolvePatternDirectionFrame,
  resolvePatternRotationAxisFrame
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
  type DerivedShellGeometrySource,
  type DerivedSweepGeometrySource,
  type DerivedLoftGeometrySource
} from "./derivedGeometry";
import type { DerivedGeometryWireExtrudeProfile } from "./derivedGeometryRuntime";
import {
  createAttachedSketchGeometryFrame,
  createDefaultSketchDisplayFrame,
  createGeneratedFaceReferenceKey,
  createTopologyAnchorFaceDisplayFrame,
  mapSketchPointToDisplayFrame,
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
      document.topologyIdentity,
      document
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
  topologyIdentity: CadDocument["topologyIdentity"] = undefined,
  referenceDocument?: CadDocument
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
  | DerivedSweepGeometrySource
  | DerivedLoftGeometrySource
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
    ...createSweepDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds
    ),
    ...createLoftDerivedGeometrySources(
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
      consumedBodyIds,
      referenceDocument
    ),
    ...createCircularPatternDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds,
      referenceDocument
    ),
    ...createMirrorDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds,
      referenceDocument
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

export function createLoftDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features)
): readonly DerivedLoftGeometrySource[] {
  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "loft" }> =>
        feature.kind === "loft"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature): DerivedLoftGeometrySource | undefined => {
      const placementErrors: string[] = [];
      const sections = feature.sections.map((section) => {
        const sketch = sketches.find(
          (candidate) => candidate.id === section.sketchId
        );
        const entity = sketch?.entities.find(
          (candidate) => candidate.id === section.entityId
        );
        if (
          !sketch ||
          !entity ||
          (entity.kind !== "rectangle" && entity.kind !== "circle")
        ) {
          return undefined;
        }
        const placement = createAttachedSketchFeaturePlacement(
          sketch,
          generatedFacesByKey,
          "loft"
        );
        if (placement.placementError)
          placementErrors.push(placement.placementError);
        const profile =
          entity.kind === "rectangle"
            ? {
                kind: entity.kind,
                center: entity.center,
                width: entity.width,
                height: entity.height
              }
            : {
                kind: entity.kind,
                center: entity.center,
                radius: entity.radius
              };
        return {
          sketchPlane: sketch.plane,
          profile,
          ...(placement.placementFrame
            ? { placementFrame: placement.placementFrame }
            : {})
        };
      });

      if (sections.some((section) => section === undefined)) return undefined;
      return {
        id: feature.bodyId,
        kind: "loft",
        sections: sections as DerivedLoftGeometrySource["sections"],
        ...(placementErrors[0] ? { placementError: placementErrors[0] } : {})
      };
    })
    .filter(
      (source): source is DerivedLoftGeometrySource => source !== undefined
    );
}

export function createSweepDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features)
): readonly DerivedSweepGeometrySource[] {
  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "sweep" }> =>
        feature.kind === "sweep"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature): DerivedSweepGeometrySource | undefined => {
      const profileSketch = sketches.find(
        (sketch) => sketch.id === feature.profileSketchId
      );
      const profileEntity = profileSketch?.entities.find(
        (entity) => entity.id === feature.profileEntityId
      );
      const pathSketch = sketches.find(
        (sketch) => sketch.id === feature.pathSketchId
      );
      const pathEntities = feature.pathEntityIds.map((entityId) =>
        pathSketch?.entities.find((entity) => entity.id === entityId)
      );

      if (
        !profileSketch ||
        !profileEntity ||
        (profileEntity.kind !== "rectangle" &&
          profileEntity.kind !== "circle") ||
        !pathSketch ||
        pathEntities.length !== 1 ||
        pathEntities[0]?.kind !== "line"
      ) {
        return undefined;
      }

      const profilePlacement = createAttachedSketchFeaturePlacement(
        profileSketch,
        generatedFacesByKey,
        "sweep"
      );
      const pathPlacement = createAttachedSketchFeaturePlacement(
        pathSketch,
        generatedFacesByKey,
        "sweep"
      );
      const pathFrame =
        pathPlacement.placementFrame ??
        createDefaultSketchDisplayFrame(pathSketch.plane);
      const path = pathEntities[0];
      const profile =
        profileEntity.kind === "rectangle"
          ? {
              kind: profileEntity.kind,
              center: profileEntity.center,
              width: profileEntity.width,
              height: profileEntity.height
            }
          : {
              kind: profileEntity.kind,
              center: profileEntity.center,
              radius: profileEntity.radius
            };

      return {
        id: feature.bodyId,
        kind: "sweep" as const,
        profile: {
          sketchPlane: profileSketch.plane,
          profile,
          ...(profilePlacement.placementFrame
            ? { placementFrame: profilePlacement.placementFrame }
            : {})
        },
        pathSegments: [
          {
            start: mapSketchPointToDisplayFrame(pathFrame, path.start),
            end: mapSketchPointToDisplayFrame(pathFrame, path.end)
          }
        ],
        ...(profilePlacement.placementError || pathPlacement.placementError
          ? {
              placementError:
                profilePlacement.placementError ?? pathPlacement.placementError
            }
          : {})
      };
    })
    .filter(
      (source): source is DerivedSweepGeometrySource => source !== undefined
    );
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
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features),
  referenceDocument?: CadDocument
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
      const resolved = resolveSeededResultSeed(
        feature.id,
        feature.seedBodyId,
        "Linear pattern",
        extrudeFeaturesByBodyId,
        sketches,
        generatedFacesByKey
      );

      const direction = resolvePatternDirection(
        feature.direction,
        referenceDocument
      );
      return {
        id: feature.bodyId,
        kind: "linearPattern" as const,
        seed: resolved.seed,
        direction: direction.value,
        spacing: feature.spacing,
        instanceCount: feature.instanceCount,
        ...(resolved.placementError || direction.error
          ? { placementError: resolved.placementError ?? direction.error }
          : {})
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
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features),
  referenceDocument?: CadDocument
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
      const resolved = resolveSeededResultSeed(
        feature.id,
        feature.seedBodyId,
        "Circular pattern",
        extrudeFeaturesByBodyId,
        sketches,
        generatedFacesByKey
      );

      const axis = resolvePatternAxis(feature.rotationAxis, referenceDocument);
      return {
        id: feature.bodyId,
        kind: "circularPattern" as const,
        seed: resolved.seed,
        axis: axis.value,
        totalAngleDegrees: feature.totalAngleDegrees,
        instanceCount: feature.instanceCount,
        ...(resolved.placementError || axis.error
          ? { placementError: resolved.placementError ?? axis.error }
          : {})
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
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features),
  referenceDocument?: CadDocument
): readonly DerivedMirrorGeometrySource[] {
  const extrudeFeaturesByBodyId = createExtrudeFeaturesByBodyId(features);

  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "mirror" }> =>
        feature.kind === "mirror"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature) => {
      const resolved = resolveSeededResultSeed(
        feature.id,
        feature.seedBodyId,
        "Mirror",
        extrudeFeaturesByBodyId,
        sketches,
        generatedFacesByKey
      );

      const plane = resolveMirrorPlane(feature.plane, referenceDocument);
      return {
        id: feature.bodyId,
        kind: "mirror" as const,
        seed: resolved.seed,
        plane: plane.value,
        includeOriginal: feature.includeOriginal,
        ...(resolved.placementError || plane.error
          ? { placementError: resolved.placementError ?? plane.error }
          : {})
      };
    });
}

function resolvePatternDirection(
  ref: Extract<CadFeatureSummary, { kind: "linearPattern" }>["direction"],
  document?: CadDocument
): {
  readonly value: readonly [number, number, number];
  readonly error?: string;
} {
  if (document) {
    const resolution = resolvePatternDirectionFrame(document, ref);
    return resolution.ok
      ? { value: resolution.frame }
      : { value: [1, 0, 0], error: resolution.message };
  }
  if (ref.kind === "globalAxis") {
    return {
      value:
        ref.axis === "x" ? [1, 0, 0] : ref.axis === "y" ? [0, 1, 0] : [0, 0, 1]
    };
  }
  return {
    value: [1, 0, 0],
    error:
      "Pattern direction reference has not been resolved to a document-space vector."
  };
}

function resolvePatternAxis(
  ref: Extract<CadFeatureSummary, { kind: "circularPattern" }>["rotationAxis"],
  document?: CadDocument
): {
  readonly value: {
    readonly origin: readonly [number, number, number];
    readonly direction: readonly [number, number, number];
  };
  readonly error?: string;
} {
  if (document) {
    const resolution = resolvePatternRotationAxisFrame(document, ref);
    return resolution.ok
      ? { value: resolution.frame }
      : {
          value: { origin: [0, 0, 0], direction: [1, 0, 0] },
          error: resolution.message
        };
  }
  const resolved = resolvePatternDirection(ref);
  return {
    value: { origin: [0, 0, 0], direction: resolved.value },
    ...(resolved.error ? { error: resolved.error } : {})
  };
}

function resolveMirrorPlane(
  ref: Extract<CadFeatureSummary, { kind: "mirror" }>["plane"],
  document?: CadDocument
): {
  readonly value: {
    readonly point: readonly [number, number, number];
    readonly normal: readonly [number, number, number];
  };
  readonly error?: string;
} {
  if (document) {
    const resolution = resolveMirrorPlaneFrame(document, ref);
    return resolution.ok
      ? { value: resolution.frame }
      : {
          value: { point: [0, 0, 0], normal: [0, 0, 1] },
          error: resolution.message
        };
  }
  if (ref.kind === "standardPlane") {
    const normal =
      ref.plane === "XY"
        ? ([0, 0, 1] as const)
        : ref.plane === "XZ"
          ? ([0, 1, 0] as const)
          : ([1, 0, 0] as const);
    const offset = ref.offset ?? 0;
    return {
      value: {
        point: [normal[0] * offset, normal[1] * offset, normal[2] * offset],
        normal
      }
    };
  }
  return {
    value: { point: [0, 0, 0], normal: [0, 0, 1] },
    error:
      "Mirror plane reference has not been resolved to a document-space plane."
  };
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

    sources.push(
      source ??
        createUnavailableExtrudeSource(
          feature.bodyId,
          `Extrude feature ${feature.id} cannot be displayed because its current profile source is unavailable.`
        )
    );
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

  if (!sketch) {
    return undefined;
  }

  if (feature.profile?.kind === "wire") {
    return createWireExtrudeSource(
      feature,
      feature.profile,
      sketch,
      generatedFacesByKey
    );
  }

  const entity = sketch.entities.find(
    (candidate) => candidate.id === feature.entityId
  );

  if (!entity) {
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

function createWireExtrudeSource(
  feature: Extract<CadFeatureSummary, { kind: "extrude" }>,
  profile: NonNullable<
    Extract<CadFeatureSummary, { kind: "extrude" }>["profile"]
  >,
  sketch: SketchSnapshot,
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>
): DerivedExtrudeGeometrySource {
  const placement = createAttachedSketchFeaturePlacement(
    sketch,
    generatedFacesByKey,
    "extrude"
  );
  const frame =
    placement.placementFrame ?? createDefaultSketchDisplayFrame(sketch.plane);
  const segments: Array<DerivedGeometryWireExtrudeProfile["segments"][number]> =
    [];

  for (const reference of profile.segments) {
    const entity = sketch.entities.find(
      (candidate) => candidate.id === reference.entityId
    );

    if (!entity || (entity.kind !== "line" && entity.kind !== "arc")) {
      return createUnavailableExtrudeSource(
        feature.bodyId,
        `Composite extrude feature ${feature.id} cannot be displayed because profile entity ${reference.entityId} is unavailable.`
      );
    }

    if (entity.kind === "line") {
      segments.push({
        kind: "line",
        sourceEntityId: entity.id,
        start: reference.orientation === "forward" ? entity.start : entity.end,
        end: reference.orientation === "forward" ? entity.end : entity.start
      });
      continue;
    }

    const forward = reference.orientation === "forward";
    segments.push({
      kind: "arc",
      sourceEntityId: entity.id,
      center: entity.center,
      radius: entity.radius,
      startAngleDegrees: normalizeDegrees(
        forward
          ? entity.startAngleDegrees
          : entity.startAngleDegrees + entity.sweepAngleDegrees
      ),
      sweepAngleDegrees: forward
        ? entity.sweepAngleDegrees
        : -entity.sweepAngleDegrees
    });
  }

  const identityRecipe = {
    sketchId: sketch.id,
    frame,
    segments,
    geometryPolicy: SKETCH_GEOMETRY_POLICY
  };
  return {
    id: feature.bodyId,
    kind: "extrude",
    sketchPlane: sketch.plane,
    profile: {
      kind: "wire",
      frame,
      closed: true,
      segments,
      sourceIdentity: `partbench-wire-extrude-v1:${JSON.stringify(identityRecipe)}`,
      geometryPolicy: SKETCH_GEOMETRY_POLICY
    },
    depth: feature.depth,
    side: feature.side,
    ...(placement.placementError
      ? { placementError: placement.placementError }
      : {})
  };
}

function normalizeDegrees(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
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

function resolveSeededResultSeed(
  featureId: string,
  seedBodyId: string,
  label: string,
  extrudeFeaturesByBodyId: ReadonlyMap<
    string,
    Extract<CadFeatureSummary, { kind: "extrude" }>
  >,
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>
): {
  readonly seed:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource;
  readonly placementError?: string;
} {
  const seed = resolveExtrudeFamilySeedSource(
    seedBodyId,
    extrudeFeaturesByBodyId,
    sketches,
    generatedFacesByKey
  );

  if (seed) {
    return { seed };
  }

  return {
    seed: createUnavailableExtrudeSource(seedBodyId),
    placementError: `${label} feature ${featureId} cannot be displayed because seed body ${seedBodyId} is not a displayable extrude-family body.`
  };
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
  id: string,
  placementError = "Extrude source is unavailable."
): DerivedExtrudeGeometrySource {
  return {
    id,
    kind: "extrude",
    sketchPlane: "XY",
    profile: { kind: "rectangle", center: [0, 0], width: 1, height: 1 },
    depth: 1,
    side: "positive",
    placementError
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
  featureKind: "extrude" | "revolve" | "hole" | "sweep" | "loft"
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
