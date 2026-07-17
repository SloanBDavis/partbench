import type {
  BodyId,
  BodyMeasurementsSnapshot,
  DocumentUnits,
  PartId,
  Vec3
} from "@web-cad/cad-protocol";

import type { SketchEntity } from "./index";
import type { GeneratedReferencesDocument } from "./generatedReferences";
import {
  cleanMeasurementNumber,
  createExtrudeMeasurementDepthRange,
  createMeasurementBounds,
  createSourceMeasurementFrame,
  mapLocalExtrudePointToSourceMeasurementFrame
} from "./sourceMeasurementGeometry";
import {
  getFeatureEntityProfileRef,
  getSupportedEntityProfileKind
} from "./normalizedFeatureInputs";

export function createBodyMeasurements(
  document: GeneratedReferencesDocument,
  bodyId: BodyId,
  units: DocumentUnits,
  ownerPartId: PartId
): BodyMeasurementsSnapshot | undefined {
  const feature = [...document.features.values()].find(
    (candidate) => candidate.bodyId === bodyId
  );

  if (!feature) {
    return undefined;
  }

  if (feature.kind !== "extrude") {
    return undefined;
  }

  if (feature.operationMode !== "newBody") {
    return undefined;
  }

  const profile = getFeatureEntityProfileRef(feature);
  const sketch = profile ? document.sketches.get(profile.sketchId) : undefined;
  const entity = sketch?.entities.get(profile?.entityId ?? "");
  const profileKind = getSupportedEntityProfileKind(entity);

  if (!profile || !sketch || !entity || !isExtrudeMeasurementEntity(entity)) {
    return undefined;
  }

  const frame = createSourceMeasurementFrame(document, sketch, ownerPartId);

  if (!frame) {
    return undefined;
  }

  const depthRange = createExtrudeMeasurementDepthRange(
    feature.depth,
    feature.side
  );
  const measurement =
    entity.kind === "rectangle"
      ? createRectangleExtrudeMeasurementInput(entity, depthRange)
      : createCircleExtrudeMeasurementInput(entity, depthRange);
  const points = measurement.points.map((point) =>
    mapLocalExtrudePointToSourceMeasurementFrame(frame, point)
  );
  const localBounds = createMeasurementBounds(points);

  return {
    bodyId: feature.bodyId,
    sourceFeatureId: feature.id,
    sourceSketchId: profile.sketchId,
    sourceSketchEntityId: profile.entityId,
    profileKind: profileKind!,
    units,
    sketchPlane: sketch.plane,
    side: feature.side,
    depth: feature.depth,
    measurementModel: "sourceAnalytic",
    localBounds,
    localExtents: localBounds.size,
    centroid: mapLocalExtrudePointToSourceMeasurementFrame(
      frame,
      measurement.centroid
    ),
    volume: cleanMeasurementNumber(measurement.volume),
    surfaceArea: cleanMeasurementNumber(measurement.surfaceArea)
  };
}

type ExtrudeMeasurementEntity =
  | Extract<SketchEntity, { readonly kind: "rectangle" }>
  | Extract<SketchEntity, { readonly kind: "circle" }>;

function isExtrudeMeasurementEntity(
  entity: SketchEntity
): entity is ExtrudeMeasurementEntity {
  return entity.kind === "rectangle" || entity.kind === "circle";
}

interface ExtrudeMeasurementInput {
  readonly points: readonly Vec3[];
  readonly centroid: Vec3;
  readonly volume: number;
  readonly surfaceArea: number;
}

function createRectangleExtrudeMeasurementInput(
  entity: Extract<SketchEntity, { readonly kind: "rectangle" }>,
  depthRange: readonly [number, number]
): ExtrudeMeasurementInput {
  const uMin = entity.center[0] - entity.width / 2;
  const uMax = entity.center[0] + entity.width / 2;
  const vMin = entity.center[1] - entity.height / 2;
  const vMax = entity.center[1] + entity.height / 2;
  const depth = Math.abs(depthRange[1] - depthRange[0]);

  return {
    points: createProfileExtrudeBoundsPoints(
      uMin,
      uMax,
      vMin,
      vMax,
      depthRange
    ),
    centroid: [
      entity.center[0],
      entity.center[1],
      (depthRange[0] + depthRange[1]) / 2
    ],
    volume: entity.width * entity.height * depth,
    surfaceArea:
      2 *
      (entity.width * entity.height +
        entity.width * depth +
        entity.height * depth)
  };
}

function createCircleExtrudeMeasurementInput(
  entity: Extract<SketchEntity, { readonly kind: "circle" }>,
  depthRange: readonly [number, number]
): ExtrudeMeasurementInput {
  const uMin = entity.center[0] - entity.radius;
  const uMax = entity.center[0] + entity.radius;
  const vMin = entity.center[1] - entity.radius;
  const vMax = entity.center[1] + entity.radius;
  const depth = Math.abs(depthRange[1] - depthRange[0]);

  return {
    points: createProfileExtrudeBoundsPoints(
      uMin,
      uMax,
      vMin,
      vMax,
      depthRange
    ),
    centroid: [
      entity.center[0],
      entity.center[1],
      (depthRange[0] + depthRange[1]) / 2
    ],
    volume: Math.PI * entity.radius * entity.radius * depth,
    surfaceArea: 2 * Math.PI * entity.radius * (entity.radius + depth)
  };
}

function createProfileExtrudeBoundsPoints(
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
  depthRange: readonly [number, number]
): readonly Vec3[] {
  return [
    [uMin, vMin, depthRange[0]],
    [uMax, vMin, depthRange[0]],
    [uMax, vMax, depthRange[0]],
    [uMin, vMax, depthRange[0]],
    [uMin, vMin, depthRange[1]],
    [uMax, vMin, depthRange[1]],
    [uMax, vMax, depthRange[1]],
    [uMin, vMax, depthRange[1]]
  ];
}
