import type {
  CadDocument,
  CadFeatureSummary,
  SketchSnapshot
} from "@web-cad/cad-core";
import {
  createResolvedSweepSource,
  createResolvedRegionRevolveProfile,
  createResolvedWireExtrudeRecipe,
  createResolvedWireRevolveRecipe,
  validateRegisteredV22RegionSource
} from "@web-cad/cad-core";
import type {
  CadGeneratedFaceReference,
  SketchLoopRef,
  SketchRegionsProfileRef
} from "@web-cad/cad-protocol";
import {
  createPrimitiveDerivedGeometrySource,
  type DerivedBooleanExtrudeGeometrySource,
  type DerivedEdgeFinishGeometrySource,
  type DerivedExtrudeGeometrySource,
  type DerivedGeometrySource,
  type DerivedHoleGeometrySource,
  type DerivedRevolveGeometrySource,
  type DerivedSweepGeometrySource,
  type DerivedLoftGeometrySource
} from "./derivedGeometry";
import {
  createAttachedSketchGeometryFrame,
  createDefaultSketchDisplayFrame,
  createDatumSketchDisplayFrame,
  createGeneratedFaceReferenceKey,
  createTopologyAnchorFaceDisplayFrame,
  type SketchDisplayFrame
} from "./sketchDisplayFrames";
import { mapResolvedSweepPathSegmentToWorld } from "./sweepGeometryRecipe";

type DatumMap = CadDocument["datums"] | undefined;
export {
  getReadyRuntimeExactSources,
  resolveCurrentExactBodies
} from "./currentExactBodyResolver";
export {
  createCurrentExactResultProjections,
  toCadCurrentExactResults
} from "./currentExactResultProjection";
export {
  createCurrentDerivedExactMetadataSnapshots,
  readProjectExactStepExport,
  readProjectExportReadiness
} from "./projectExactExportQueries";
export {
  createBodyTopologyDerivedExactMetadataSnapshot,
  DerivedExactMetadataService,
  formatDerivedExactMetadataEntryStatus,
  getCurrentDerivedExactMetadataEntryForBody,
  planExactMetadataRetry
} from "./derivedExactMetadata";
export {
  createCurrentExactEvidence,
  createCurrentExactSources,
  projectCurrentExactBodyArtifacts
} from "./currentExactPipeline";

export function createDerivedGeometrySourcesFromDocument(
  document: CadDocument,
  features: readonly CadFeatureSummary[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  sourceIdentitySignaturesByBodyId: ReadonlyMap<string, string> = new Map(),
  includeConsumed = false
): readonly DerivedGeometrySource[] {
  const primitives = [...document.objects.values()].map(
    createPrimitiveDerivedGeometrySource
  );
  if (features.length === 0) return primitives;

  const sketches = [...document.sketches.values()].map((sketch) => ({
    id: sketch.id,
    name: sketch.name,
    plane: sketch.plane,
    ...(sketch.datumId ? { datumId: sketch.datumId } : {}),
    attachment: sketch.attachment,
    entities: [...sketch.entities.values()]
  }));

  return [
    ...primitives,
    ...createAuthoredFeatureDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      document.namedReferences,
      document,
      sourceIdentitySignaturesByBodyId,
      includeConsumed
    )
  ];
}

export function removeConsumedDerivedGeometrySources(
  sources: readonly DerivedGeometrySource[],
  features: readonly CadFeatureSummary[]
): readonly DerivedGeometrySource[] {
  const consumedBodyIds = createConsumedBodyIds(features);
  return sources.filter((source) => !consumedBodyIds.has(source.id));
}

export function createAuthoredFeatureDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  namedReferences: CadDocument["namedReferences"] = new Map(),
  referenceDocument?: CadDocument,
  sourceIdentitySignaturesByBodyId: ReadonlyMap<string, string> = new Map(),
  includeConsumed = false
): readonly (
  | DerivedExtrudeGeometrySource
  | DerivedBooleanExtrudeGeometrySource
  | DerivedRevolveGeometrySource
  | DerivedHoleGeometrySource
  | DerivedEdgeFinishGeometrySource
  | DerivedSweepGeometrySource
  | DerivedLoftGeometrySource
)[] {
  const consumedBodyIds = includeConsumed
    ? new Set<string>()
    : createConsumedBodyIds(features);

  const datums = referenceDocument?.datums;
  const sources = [
    ...createExtrudeDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds,
      datums
    ),
    ...createRevolveDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds,
      referenceDocument
    ),
    ...createSweepDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds,
      referenceDocument
    ),
    ...createLoftDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds,
      datums
    ),
    ...createCombineDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds,
      datums
    ),
    ...createHoleDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      consumedBodyIds,
      datums
    ),
    ...createEdgeFinishDerivedGeometrySources(
      features,
      sketches,
      generatedFacesByKey,
      namedReferences,
      consumedBodyIds
    )
  ];

  return sources.map((source) => {
    const sourceIdentitySignature = sourceIdentitySignaturesByBodyId.get(
      source.id
    );
    return sourceIdentitySignature
      ? { ...source, sourceIdentitySignature }
      : source;
  });
}

export function createLoftDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features),
  datums?: DatumMap
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
          "loft",
          datums
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
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features),
  referenceDocument?: CadDocument
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
      const pathSketch = sketches.find(
        (sketch) => sketch.id === feature.pathSketchId
      );
      const resolved = referenceDocument
        ? createResolvedSweepSource(referenceDocument, feature, feature.partId)
        : undefined;

      if (!profileSketch || !pathSketch || !resolved) {
        return undefined;
      }

      const profilePlacement = createAttachedSketchFeaturePlacement(
        profileSketch,
        generatedFacesByKey,
        "sweep",
        referenceDocument?.datums
      );
      const pathPlacement = createAttachedSketchFeaturePlacement(
        pathSketch,
        generatedFacesByKey,
        "sweep",
        referenceDocument?.datums
      );
      const pathFrame =
        pathPlacement.placementFrame ??
        createDefaultSketchDisplayFrame(pathSketch.plane);
      const preserveLegacyLineShape =
        feature.path.kind === "entity" &&
        resolved.path.segments[0]?.kind === "line";

      return {
        id: feature.bodyId,
        kind: "sweep" as const,
        profile: {
          sketchPlane: profileSketch.plane,
          profile: resolved.profile,
          ...(profilePlacement.placementFrame
            ? { placementFrame: profilePlacement.placementFrame }
            : {})
        },
        pathSegments: resolved.path.segments.map((segment) => {
          const worldSegment = mapResolvedSweepPathSegmentToWorld(
            segment,
            pathFrame
          );
          return preserveLegacyLineShape && worldSegment.kind === "line"
            ? { start: worldSegment.start, end: worldSegment.end }
            : worldSegment;
        }),
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

export function createExtrudeDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features),
  datums?: DatumMap
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
          generatedFacesByKey,
          new Set(),
          datums
        )
      );
      continue;
    }

    const source = createExtrudeSourceForFeature(
      feature,
      sketches,
      generatedFacesByKey,
      datums
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

type BooleanCapableFeature = Extract<
  CadFeatureSummary,
  { kind: "extrude" | "combine" }
>;

function createBooleanCapableFeaturesByBodyId(
  features: readonly CadFeatureSummary[]
): ReadonlyMap<string, BooleanCapableFeature> {
  return new Map(
    features
      .filter(
        (feature): feature is BooleanCapableFeature =>
          feature.kind === "extrude" || feature.kind === "combine"
      )
      .map((feature) => [feature.bodyId, feature])
  );
}

function createSolidBooleanSourceForFeature(
  feature: BooleanCapableFeature,
  featuresByBodyId: ReadonlyMap<string, BooleanCapableFeature>,
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  visitedFeatureIds: ReadonlySet<string> = new Set(),
  datums?: DatumMap
): DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource {
  if (visitedFeatureIds.has(feature.id)) {
    return {
      id: feature.bodyId,
      kind: "extrudeBoolean",
      operation: "add",
      target: createUnavailableExtrudeSource(feature.bodyId),
      tool: createUnavailableExtrudeSource(feature.bodyId),
      placementError: `Boolean feature ${feature.id} cannot be displayed because its target chain is cyclic.`
    };
  }

  const nextVisitedFeatureIds = new Set(visitedFeatureIds);
  nextVisitedFeatureIds.add(feature.id);

  if (feature.kind === "combine") {
    const targetFeature = featuresByBodyId.get(feature.targetBodyId);
    const toolFeature = featuresByBodyId.get(feature.toolBodyId);
    const target = targetFeature
      ? createSolidBooleanSourceForFeature(
          targetFeature,
          featuresByBodyId,
          sketches,
          generatedFacesByKey,
          nextVisitedFeatureIds,
          datums
        )
      : undefined;
    const tool = toolFeature
      ? createSolidBooleanSourceForFeature(
          toolFeature,
          featuresByBodyId,
          sketches,
          generatedFacesByKey,
          nextVisitedFeatureIds,
          datums
        )
      : undefined;
    const operation = feature.mode === "union" ? "add" : "cut";
    return {
      id: feature.bodyId,
      kind: "extrudeBoolean",
      operation,
      target: target ?? createUnavailableExtrudeSource(feature.bodyId),
      tool: tool
        ? { ...tool, id: `${feature.bodyId}:tool` }
        : createUnavailableExtrudeSource(feature.bodyId),
      ...(!target || !tool
        ? {
            placementError: `Combine feature ${feature.id} cannot be displayed because its target or tool solid is unavailable.`
          }
        : target.placementError
          ? { placementError: target.placementError }
          : tool.placementError
            ? { placementError: tool.placementError }
            : {})
    };
  }

  if (feature.operationMode === "add" || feature.operationMode === "cut") {
    const extrudeFeaturesByBodyId = new Map(
      [...featuresByBodyId.entries()].flatMap(([bodyId, candidate]) =>
        candidate.kind === "extrude" ? [[bodyId, candidate] as const] : []
      )
    );
    return createBooleanSourceForFeature(
      feature,
      extrudeFeaturesByBodyId,
      sketches,
      generatedFacesByKey,
      nextVisitedFeatureIds,
      datums
    );
  }

  return (
    createExtrudeSourceForFeature(
      feature,
      sketches,
      generatedFacesByKey,
      datums
    ) ?? createUnavailableExtrudeSource(feature.bodyId)
  );
}

function createBooleanSourceForFeature(
  feature: Extract<CadFeatureSummary, { kind: "extrude" }>,
  featuresByBodyId: ReadonlyMap<
    string,
    Extract<CadFeatureSummary, { kind: "extrude" }>
  >,
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  visitedFeatureIds: ReadonlySet<string> = new Set(),
  datums?: DatumMap
): DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource {
  if (feature.operationMode !== "add" && feature.operationMode !== "cut") {
    return (
      createExtrudeSourceForFeature(
        feature,
        sketches,
        generatedFacesByKey,
        datums
      ) ?? createUnavailableExtrudeSource(feature.bodyId)
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
        nextVisitedFeatureIds,
        datums
      )
    : undefined;
  if (feature.profile?.kind === "regions") {
    const regionProfile = feature.profile;
    const operationMode = feature.operationMode;
    const sketch = sketches.find(
      (candidate) => candidate.id === feature.sketchId
    );
    if (!target || !sketch) {
      return {
        id: feature.bodyId,
        kind: "extrudeBoolean",
        operation: operationMode,
        target: target ?? createUnavailableExtrudeSource(feature.bodyId),
        tool: createUnavailableExtrudeSource(feature.bodyId),
        placementError: `${feature.operationMode === "add" ? "Add" : "Cut"} feature ${feature.id} cannot be displayed because its target or exact region tools are unavailable.`
      };
    }
    const validation = validateRegisteredV22RegionSource(regionProfile, {
      id: sketch.id,
      entities: new Map(sketch.entities.map((entity) => [entity.id, entity]))
    });
    if (!validation.ok) {
      return {
        id: feature.bodyId,
        kind: "extrudeBoolean",
        operation: operationMode,
        target,
        tool: createUnavailableExtrudeSource(feature.bodyId),
        placementError: `${feature.operationMode === "add" ? "Add" : "Cut"} feature ${feature.id} cannot be displayed because its exact region tools are unavailable.`
      };
    }
    const tools = validation.normalizedProfile.regions.map(
      (region, regionIndex) =>
        createRegionMaterialExtrudeSource(
          {
            id: feature.id,
            bodyId: `${feature.bodyId}:region:${regionIndex}`,
            depth: feature.depth,
            side: feature.side
          },
          region,
          sketch,
          generatedFacesByKey,
          datums
        )
    );
    return tools.reduce<
      DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource
    >(
      (currentTarget, tool, regionIndex) => ({
        id:
          regionIndex === tools.length - 1
            ? feature.bodyId
            : `${feature.bodyId}:region-result:${regionIndex}`,
        kind: "extrudeBoolean",
        operation: operationMode,
        materialPolicy: "regionPositiveVolumeSingleSolid",
        target: currentTarget,
        tool,
        ...(currentTarget.placementError
          ? { placementError: currentTarget.placementError }
          : tool.placementError
            ? { placementError: tool.placementError }
            : {})
      }),
      target
    );
  }
  const resolvedTool = createExtrudeSourceForFeature(
    feature,
    sketches,
    generatedFacesByKey,
    datums
  );
  const tool = resolvedTool
    ? { ...resolvedTool, id: `${feature.bodyId}:tool` }
    : undefined;

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
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features),
  referenceDocument?: CadDocument
): readonly DerivedRevolveGeometrySource[] {
  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "revolve" }> =>
        feature.kind === "revolve"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature) =>
      createRevolveSourceForFeature(
        feature,
        sketches,
        generatedFacesByKey,
        referenceDocument
      )
    )
    .filter(
      (source): source is DerivedRevolveGeometrySource => source !== undefined
    );
}

export function createCombineDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features),
  datums?: DatumMap
): readonly (
  | DerivedExtrudeGeometrySource
  | DerivedBooleanExtrudeGeometrySource
)[] {
  const featuresByBodyId = createBooleanCapableFeaturesByBodyId(features);
  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "combine" }> =>
        feature.kind === "combine"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature) =>
      createSolidBooleanSourceForFeature(
        feature,
        featuresByBodyId,
        sketches,
        generatedFacesByKey,
        new Set(),
        datums
      )
    );
}

export function createHoleDerivedGeometrySources(
  features: readonly CadFeatureSummary[],
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<
    string,
    CadGeneratedFaceReference
  > = new Map(),
  consumedBodyIds: ReadonlySet<string> = createConsumedBodyIds(features),
  datums?: DatumMap
): readonly DerivedHoleGeometrySource[] {
  const featuresByBodyId = createBooleanCapableFeaturesByBodyId(features);

  return features
    .filter(
      (feature): feature is Extract<CadFeatureSummary, { kind: "hole" }> =>
        feature.kind === "hole"
    )
    .filter((feature) => !consumedBodyIds.has(feature.bodyId))
    .map((feature) => {
      const targetFeature = featuresByBodyId.get(feature.targetBodyId);
      const target =
        targetFeature !== undefined
          ? createSolidBooleanSourceForFeature(
              targetFeature,
              featuresByBodyId,
              sketches,
              generatedFacesByKey,
              new Set(),
              datums
            )
          : undefined;
      const toolResult = createHoleToolSourceForFeature(
        feature,
        sketches,
        generatedFacesByKey,
        datums
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
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  datums?: DatumMap
):
  | DerivedExtrudeGeometrySource
  | DerivedBooleanExtrudeGeometrySource
  | undefined {
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
      generatedFacesByKey,
      datums
    );
  }

  if (feature.profile?.kind === "regions") {
    return feature.operationMode === "newBody"
      ? createRegionNewBodyExtrudeSource(
          feature,
          feature.profile,
          sketch,
          generatedFacesByKey,
          datums
        )
      : createUnavailableExtrudeSource(
          feature.bodyId,
          `Region ${feature.operationMode} feature ${feature.id} awaits the V19 sequential region boolean slice.`
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
    "extrude",
    datums
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

function createRegionNewBodyExtrudeSource(
  feature: Pick<
    Extract<CadFeatureSummary, { kind: "extrude" }>,
    "id" | "bodyId" | "depth" | "side"
  >,
  profile: SketchRegionsProfileRef,
  sketch: SketchSnapshot,
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  datums?: DatumMap
): DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource {
  const validation = validateRegisteredV22RegionSource(profile, {
    id: sketch.id,
    entities: new Map(sketch.entities.map((entity) => [entity.id, entity]))
  });
  if (!validation.ok || validation.normalizedProfile.regions.length !== 1) {
    return createUnavailableExtrudeSource(
      feature.bodyId,
      `Region new-body extrude feature ${feature.id} no longer forms one valid material region.`
    );
  }
  return createRegionMaterialExtrudeSource(
    feature,
    validation.normalizedProfile.regions[0],
    sketch,
    generatedFacesByKey,
    datums
  );
}

function createRegionMaterialExtrudeSource(
  feature: Pick<
    Extract<CadFeatureSummary, { kind: "extrude" }>,
    "id" | "bodyId" | "depth" | "side"
  >,
  region: SketchRegionsProfileRef["regions"][number],
  sketch: SketchSnapshot,
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  datums?: DatumMap
): DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource {
  const outer = createRegionLoopExtrudeSource(
    feature,
    region.outer,
    sketch,
    generatedFacesByKey,
    `${feature.bodyId}:outer`,
    datums
  );
  if (!outer) {
    return createUnavailableExtrudeSource(
      feature.bodyId,
      `Region extrude feature ${feature.id} cannot resolve its outer loop.`
    );
  }

  let result:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource = outer;
  for (const [holeIndex, hole] of region.holes.entries()) {
    const tool = createRegionLoopExtrudeSource(
      feature,
      hole,
      sketch,
      generatedFacesByKey,
      `${feature.bodyId}:hole:${holeIndex}`,
      datums
    );
    if (!tool) {
      return createUnavailableExtrudeSource(
        feature.bodyId,
        `Region extrude feature ${feature.id} cannot resolve hole loop ${holeIndex + 1}.`
      );
    }
    result = {
      id:
        holeIndex === region.holes.length - 1
          ? feature.bodyId
          : `${feature.bodyId}:void:${holeIndex}`,
      kind: "extrudeBoolean",
      operation: "cut",
      materialPolicy: "regionPositiveVolumeSingleSolid",
      target: result,
      tool,
      ...(result.placementError
        ? { placementError: result.placementError }
        : tool.placementError
          ? { placementError: tool.placementError }
          : {})
    };
  }

  return region.holes.length === 0 ? { ...outer, id: feature.bodyId } : result;
}

function createRegionLoopExtrudeSource(
  feature: Pick<
    Extract<CadFeatureSummary, { kind: "extrude" }>,
    "depth" | "side"
  >,
  loop: SketchLoopRef,
  sketch: SketchSnapshot,
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  id: string,
  datums?: DatumMap
): DerivedExtrudeGeometrySource | undefined {
  const placement = createAttachedSketchFeaturePlacement(
    sketch,
    generatedFacesByKey,
    "extrude",
    datums
  );
  if (loop.kind === "entity") {
    const entity = sketch.entities.find(
      (candidate) => candidate.id === loop.entityId
    );
    if (!entity || (entity.kind !== "rectangle" && entity.kind !== "circle")) {
      return undefined;
    }
    return {
      id,
      kind: "extrude",
      sketchPlane: sketch.plane,
      profile:
        entity.kind === "rectangle"
          ? {
              kind: "rectangle",
              center: entity.center,
              width: entity.width,
              height: entity.height
            }
          : {
              kind: "circle",
              center: entity.center,
              radius: entity.radius
            },
      depth: feature.depth,
      side: feature.side,
      ...placement
    };
  }

  const frame =
    placement.placementFrame ?? createDefaultSketchDisplayFrame(sketch.plane);
  const resolvedProfile = createResolvedWireExtrudeRecipe(
    {
      kind: "wire",
      sketchId: sketch.id,
      segments: loop.segments
    },
    new Map(sketch.entities.map((entity) => [entity.id, entity])),
    frame
  );
  if (!resolvedProfile) return undefined;
  return {
    id,
    kind: "extrude",
    sketchPlane: sketch.plane,
    profile: resolvedProfile,
    depth: feature.depth,
    side: feature.side,
    ...(placement.placementError
      ? { placementError: placement.placementError }
      : {})
  };
}

function createWireExtrudeSource(
  feature: Extract<CadFeatureSummary, { kind: "extrude" }>,
  profile: Extract<
    NonNullable<Extract<CadFeatureSummary, { kind: "extrude" }>["profile"]>,
    { kind: "wire" }
  >,
  sketch: SketchSnapshot,
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  datums?: DatumMap
): DerivedExtrudeGeometrySource {
  const placement = createAttachedSketchFeaturePlacement(
    sketch,
    generatedFacesByKey,
    "extrude",
    datums
  );
  const frame =
    placement.placementFrame ?? createDefaultSketchDisplayFrame(sketch.plane);
  const entities = new Map(
    sketch.entities.map((entity) => [entity.id, entity])
  );
  const resolvedProfile = createResolvedWireExtrudeRecipe(
    profile,
    entities,
    frame
  );
  if (!resolvedProfile) {
    const unavailableEntityId = profile.segments.find((reference) => {
      const entity = entities.get(reference.entityId);
      return !entity || (entity.kind !== "line" && entity.kind !== "arc");
    })?.entityId;
    return createUnavailableExtrudeSource(
      feature.bodyId,
      `Composite extrude feature ${feature.id} cannot be displayed because profile entity ${unavailableEntityId ?? "unknown"} is unavailable.`
    );
  }

  return {
    id: feature.bodyId,
    kind: "extrude",
    sketchPlane: sketch.plane,
    profile: resolvedProfile,
    depth: feature.depth,
    side: feature.side,
    ...(placement.placementError
      ? { placementError: placement.placementError }
      : {})
  };
}

function createHoleToolSourceForFeature(
  feature: Extract<CadFeatureSummary, { kind: "hole" }>,
  sketches: readonly SketchSnapshot[],
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  datums?: DatumMap
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
    "hole",
    datums
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
  generatedFacesByKey: ReadonlyMap<string, CadGeneratedFaceReference>,
  referenceDocument?: CadDocument
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

  if (!sketch) {
    return undefined;
  }

  const placement = createAttachedSketchFeaturePlacement(
    sketch,
    generatedFacesByKey,
    "revolve",
    referenceDocument?.datums
  );
  const placementState =
    feature.operationMode === "newBody"
      ? placement
      : {
          placementError:
            "Revolve display currently supports newBody revolve features only."
        };

  if (feature.profile?.kind === "wire") {
    const frame =
      placement.placementFrame ?? createDefaultSketchDisplayFrame(sketch.plane);
    const recipe = createResolvedWireRevolveRecipe(
      feature.profile,
      feature.axis,
      new Map(sketch.entities.map((candidate) => [candidate.id, candidate])),
      frame
    );
    if (!recipe) {
      return undefined;
    }
    return {
      id: feature.bodyId,
      kind: "revolve",
      sketchPlane: sketch.plane,
      profile: recipe.profile,
      axis: { start: recipe.axis.start, end: recipe.axis.end },
      angleDegrees: feature.angleDegrees,
      ...(placementState.placementError
        ? { placementError: placementState.placementError }
        : {})
    };
  }

  if (feature.profile?.kind === "regions") {
    if (!referenceDocument) return undefined;
    const recipe = createResolvedRegionRevolveProfile(
      referenceDocument,
      feature.profile,
      feature.axis,
      feature.partId
    );
    if (!recipe) return undefined;
    return {
      id: feature.bodyId,
      kind: "revolve",
      sketchPlane: sketch.plane,
      profile: recipe.profile,
      axis: { start: recipe.axis.start, end: recipe.axis.end },
      angleDegrees: feature.angleDegrees,
      ...(placementState.placementError
        ? { placementError: placementState.placementError }
        : {})
    };
  }

  if (!entity || !axis || axis.kind !== "line") {
    return undefined;
  }

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
          if (feature.seedBodyId) return [feature.seedBodyId];
          if (feature.seedFeatureId) {
            const seed = features.find(
              (candidate) => candidate.id === feature.seedFeatureId
            );
            return seed ? [seed.bodyId] : [];
          }
          return [];
        }

        if (feature.kind === "mirror" && feature.includeOriginal) {
          return [feature.seedBodyId];
        }

        if (feature.kind === "shell") {
          return [feature.targetBodyId];
        }

        if (feature.kind === "combine") {
          return [feature.targetBodyId, feature.toolBodyId];
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
  tool:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource
    | undefined
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
  featureKind: "extrude" | "revolve" | "hole" | "sweep" | "loft",
  datums?: CadDocument["datums"]
): {
  readonly placementFrame?: SketchDisplayFrame;
  readonly placementError?: string;
} {
  if (!sketch.attachment && sketch.datumId) {
    const datum = datums?.get(sketch.datumId);
    const frame = datum ? createDatumSketchDisplayFrame(datum) : undefined;
    return frame ? { placementFrame: frame } : {};
  }

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

  if (!face.eligibleOperations.includes("feature.attachSketchPlane")) {
    return {
      placementError: `Attachment face is not eligible to place ${sketch.name}; derived ${featureKind} mesh is unavailable.`
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
