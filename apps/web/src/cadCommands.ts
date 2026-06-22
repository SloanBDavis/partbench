import type {
  CadActorMetadata,
  CadBatch,
  CadBatchMode,
  CadOp,
  CadParameterSnapshot,
  CurrentSketchConstraintKind,
  DocumentUnitUpdateMode,
  DocumentUnits,
  DocumentUpdateUnitsOp,
  FeatureDeleteOp,
  FeatureExtrudeOperationMode,
  FeatureExtrudeSide,
  FeatureExtrudeOp,
  FeatureChamferOp,
  FeatureFilletOp,
  FeatureHoleDepthMode,
  FeatureHoleDirection,
  FeatureHoleOp,
  FeatureRevolveOp,
  FeatureUpdateExtrudeOp,
  FeatureUpdateChamferOp,
  FeatureUpdateFilletOp,
  FeatureUpdateHoleOp,
  FeatureUpdateRevolveOp,
  ParameterCreateOp,
  ParameterDeleteOp,
  ParameterId,
  ParameterRenameOp,
  ParameterUpdateOp,
  ReferenceDeleteNameOp,
  ReferenceNameGeneratedOp,
  ReferenceRepairNameOp,
  ObjectId,
  SceneCreateBoxOp,
  SceneCreateConeOp,
  SceneCreateCylinderOp,
  SceneCreateSphereOp,
  SceneCreateTorusOp,
  SceneDeleteObjectOp,
  SceneRenameObjectOp,
  SceneUpdateBoxDimensionsOp,
  SceneUpdateConeDimensionsOp,
  SceneUpdateCylinderDimensionsOp,
  SceneUpdateSphereDimensionsOp,
  SceneUpdateTorusDimensionsOp,
  SceneUpdateTransformOp,
  SketchAddCircleOp,
  SketchAddLineOp,
  SketchAddPointOp,
  SketchAddRectangleOp,
  SketchCreateOnFaceOp,
  SketchCreateOp,
  SketchDeleteEntityOp,
  SketchDeleteOp,
  SketchDimensionCreateOp,
  SketchDimensionDeleteOp,
  SketchDimensionEntry,
  SketchDimensionId,
  SketchDimensionRenameOp,
  SketchDimensionTarget,
  SketchDimensionUpdateOp,
  SketchConstraintCreateOp,
  SketchConstraintDeleteOp,
  SketchConstraintEntry,
  SketchConstraintId,
  SketchConstraintRenameOp,
  SketchEntitySnapshot,
  SketchId,
  SketchPlane,
  SketchPointTargetRole,
  SketchRenameOp,
  SketchUpdateEntityOp,
  Transform,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

export const WEB_UI_ACTOR: CadActorMetadata = {
  type: "human",
  id: "web-ui",
  name: "Web UI"
};

export interface DimensionCommandForm {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly radius: number;
  readonly majorRadius: number;
  readonly minorRadius: number;
}

export interface PrimitiveCommandForm extends DimensionCommandForm {
  readonly id: string;
  readonly translationX: number;
  readonly translationY: number;
  readonly translationZ: number;
}

export interface TransformCommandForm {
  readonly translationX: number;
  readonly translationY: number;
  readonly translationZ: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly scaleZ: number;
}

export interface SketchCreateForm {
  readonly id: string;
  readonly name: string;
  readonly plane: SketchPlane;
}

export interface SketchCreateOnFaceForm {
  readonly id: string;
  readonly name: string;
  readonly bodyId: string;
  readonly faceStableId: string;
}

export interface ParameterCreateForm {
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly description: string;
}

export interface ParameterEditForm {
  readonly name: string;
  readonly value: number;
  readonly description: string;
}

export interface SketchDimensionForm {
  readonly id: string;
  readonly name: string;
  readonly valueSourceType: "literal" | "parameter";
  readonly value: number;
  readonly parameterId: string;
}

export interface SketchConstraintForm {
  readonly id: string;
  readonly name: string;
  readonly kind: CurrentSketchConstraintKind;
  readonly targetRole: SketchPointTargetRole;
  readonly coordinateMode: "current" | "custom";
  readonly coordinateX: number;
  readonly coordinateY: number;
  readonly secondaryEntityId: string;
  readonly secondaryTargetRole: SketchPointTargetRole;
}

export interface SketchEntityForm {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly x2: number;
  readonly y2: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

export interface FeatureExtrudeForm {
  readonly id: string;
  readonly bodyId: string;
  readonly targetBodyId?: string;
  readonly name: string;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly operationMode: FeatureExtrudeOperationMode;
}

export interface FeatureRevolveForm {
  readonly id: string;
  readonly bodyId: string;
  readonly name: string;
  readonly axisEntityId: string;
  readonly angleDegrees: number;
}

export interface FeatureHoleForm {
  readonly id: string;
  readonly bodyId: string;
  readonly targetBodyId: string;
  readonly name: string;
  readonly depthMode: FeatureHoleDepthMode;
  readonly depth: number;
  readonly direction: FeatureHoleDirection;
}

export interface FeatureEdgeFinishForm {
  readonly id: string;
  readonly bodyId: string;
  readonly targetBodyId: string;
  readonly name: string;
  readonly edgeStableId?: string;
  readonly namedReference?: string;
  readonly topologyAnchorId?: string;
  readonly distance: number;
  readonly radius: number;
}

export function buildCreateBoxOp(form: PrimitiveCommandForm): SceneCreateBoxOp {
  return {
    op: "scene.createBox",
    id: normalizeOptionalId(form.id),
    dimensions: {
      width: form.width,
      height: form.height,
      depth: form.depth
    },
    transform: {
      translation: [form.translationX, form.translationY, form.translationZ]
    }
  };
}

export function buildCreateCylinderOp(
  form: PrimitiveCommandForm
): SceneCreateCylinderOp {
  return {
    op: "scene.createCylinder",
    id: normalizeOptionalId(form.id),
    dimensions: {
      radius: form.radius,
      height: form.height
    },
    transform: {
      translation: [form.translationX, form.translationY, form.translationZ]
    }
  };
}

export function buildCreateSphereOp(
  form: PrimitiveCommandForm
): SceneCreateSphereOp {
  return {
    op: "scene.createSphere",
    id: normalizeOptionalId(form.id),
    dimensions: {
      radius: form.radius
    },
    transform: {
      translation: [form.translationX, form.translationY, form.translationZ]
    }
  };
}

export function buildCreateConeOp(
  form: PrimitiveCommandForm
): SceneCreateConeOp {
  return {
    op: "scene.createCone",
    id: normalizeOptionalId(form.id),
    dimensions: {
      radius: form.radius,
      height: form.height
    },
    transform: {
      translation: [form.translationX, form.translationY, form.translationZ]
    }
  };
}

export function buildCreateTorusOp(
  form: PrimitiveCommandForm
): SceneCreateTorusOp {
  return {
    op: "scene.createTorus",
    id: normalizeOptionalId(form.id),
    dimensions: {
      majorRadius: form.majorRadius,
      minorRadius: form.minorRadius
    },
    transform: {
      translation: [form.translationX, form.translationY, form.translationZ]
    }
  };
}

export function buildUpdateUnitsOp(
  units: DocumentUnits,
  mode: DocumentUnitUpdateMode = "metadataOnly"
): DocumentUpdateUnitsOp {
  return {
    op: "document.updateUnits",
    units,
    mode
  };
}

export function buildUpdateTransformOp(
  id: ObjectId,
  form: TransformCommandForm
): SceneUpdateTransformOp {
  return {
    op: "scene.updateTransform",
    id,
    transform: buildTransform(form)
  };
}

export function buildRenameObjectOp(
  id: ObjectId,
  name: string
): SceneRenameObjectOp {
  return {
    op: "scene.renameObject",
    id,
    name: name.trim()
  };
}

export function buildUpdateBoxDimensionsOp(
  id: ObjectId,
  form: DimensionCommandForm
): SceneUpdateBoxDimensionsOp {
  return {
    op: "scene.updateBoxDimensions",
    id,
    dimensions: {
      width: form.width,
      height: form.height,
      depth: form.depth
    }
  };
}

export function buildUpdateCylinderDimensionsOp(
  id: ObjectId,
  form: DimensionCommandForm
): SceneUpdateCylinderDimensionsOp {
  return {
    op: "scene.updateCylinderDimensions",
    id,
    dimensions: {
      radius: form.radius,
      height: form.height
    }
  };
}

export function buildUpdateSphereDimensionsOp(
  id: ObjectId,
  form: DimensionCommandForm
): SceneUpdateSphereDimensionsOp {
  return {
    op: "scene.updateSphereDimensions",
    id,
    dimensions: {
      radius: form.radius
    }
  };
}

export function buildUpdateConeDimensionsOp(
  id: ObjectId,
  form: DimensionCommandForm
): SceneUpdateConeDimensionsOp {
  return {
    op: "scene.updateConeDimensions",
    id,
    dimensions: {
      radius: form.radius,
      height: form.height
    }
  };
}

export function buildUpdateTorusDimensionsOp(
  id: ObjectId,
  form: DimensionCommandForm
): SceneUpdateTorusDimensionsOp {
  return {
    op: "scene.updateTorusDimensions",
    id,
    dimensions: {
      majorRadius: form.majorRadius,
      minorRadius: form.minorRadius
    }
  };
}

export function buildDeleteObjectOp(id: ObjectId): SceneDeleteObjectOp {
  return {
    op: "scene.deleteObject",
    id
  };
}

export function buildCreateSketchOp(form: SketchCreateForm): SketchCreateOp {
  return {
    op: "sketch.create",
    id: normalizeOptionalId(form.id),
    name: form.name.trim(),
    plane: form.plane
  };
}

export function buildCreateSketchOnFaceOp(
  form: SketchCreateOnFaceForm
): SketchCreateOnFaceOp {
  return {
    op: "sketch.createOnFace",
    id: normalizeOptionalId(form.id),
    name: form.name.trim(),
    bodyId: form.bodyId,
    faceStableId: form.faceStableId
  };
}

export function buildCreateParameterOp(
  form: ParameterCreateForm
): ParameterCreateOp {
  const description = normalizeOptionalText(form.description);

  return {
    op: "parameter.create",
    id: normalizeOptionalId(form.id),
    name: form.name.trim(),
    value: form.value,
    ...(description ? { description } : {})
  };
}

export function buildUpdateParameterOp(
  id: ParameterId,
  form: ParameterEditForm
): ParameterUpdateOp {
  const description = normalizeOptionalText(form.description);

  return {
    op: "parameter.update",
    id,
    value: form.value,
    ...(description ? { description } : {})
  };
}

export function buildRenameParameterOp(
  id: ParameterId,
  name: string
): ParameterRenameOp {
  return {
    op: "parameter.rename",
    id,
    name: name.trim()
  };
}

export function buildDeleteParameterOp(id: ParameterId): ParameterDeleteOp {
  return {
    op: "parameter.delete",
    id
  };
}

export function buildParameterEditOps(
  parameter: CadParameterSnapshot,
  form: ParameterEditForm
): readonly (ParameterRenameOp | ParameterUpdateOp)[] {
  const ops: (ParameterRenameOp | ParameterUpdateOp)[] = [];
  const nextName = form.name.trim();
  const nextDescription = normalizeOptionalText(form.description);

  if (nextName !== parameter.name) {
    ops.push(buildRenameParameterOp(parameter.id, nextName));
  }

  if (
    form.value !== parameter.value ||
    nextDescription !== parameter.description
  ) {
    const update = buildUpdateParameterOp(parameter.id, form);
    ops.push(
      nextDescription === undefined && parameter.description !== undefined
        ? { ...update, description: "" }
        : update
    );
  }

  return ops;
}

export function buildRenameSketchOp(
  id: SketchId,
  name: string
): SketchRenameOp {
  return {
    op: "sketch.rename",
    id,
    name: name.trim()
  };
}

export function buildDeleteSketchOp(id: SketchId): SketchDeleteOp {
  return {
    op: "sketch.delete",
    id
  };
}

export function buildAddSketchPointOp(
  sketchId: SketchId,
  form: SketchEntityForm
): SketchAddPointOp {
  return {
    op: "sketch.addPoint",
    sketchId,
    id: normalizeOptionalId(form.id),
    point: toVec2(form.x, form.y)
  };
}

export function buildAddSketchLineOp(
  sketchId: SketchId,
  form: SketchEntityForm
): SketchAddLineOp {
  return {
    op: "sketch.addLine",
    sketchId,
    id: normalizeOptionalId(form.id),
    start: toVec2(form.x, form.y),
    end: toVec2(form.x2, form.y2)
  };
}

export function buildAddSketchRectangleOp(
  sketchId: SketchId,
  form: SketchEntityForm
): SketchAddRectangleOp {
  return {
    op: "sketch.addRectangle",
    sketchId,
    id: normalizeOptionalId(form.id),
    center: toVec2(form.x, form.y),
    width: form.width,
    height: form.height
  };
}

export function buildAddSketchCircleOp(
  sketchId: SketchId,
  form: SketchEntityForm
): SketchAddCircleOp {
  return {
    op: "sketch.addCircle",
    sketchId,
    id: normalizeOptionalId(form.id),
    center: toVec2(form.x, form.y),
    radius: form.radius
  };
}

export function buildUpdateSketchEntityOp(
  sketchId: SketchId,
  entity: SketchEntitySnapshot
): SketchUpdateEntityOp {
  return {
    op: "sketch.updateEntity",
    sketchId,
    entity
  };
}

export function buildDeleteSketchEntityOp(
  sketchId: SketchId,
  entityId: string
): SketchDeleteEntityOp {
  return {
    op: "sketch.deleteEntity",
    sketchId,
    entityId
  };
}

export function buildCreateSketchDimensionOp(
  sketchId: SketchId,
  entityId: string,
  target: SketchDimensionTarget,
  form: SketchDimensionForm
): SketchDimensionCreateOp {
  return {
    op: "sketch.dimension.create",
    id: normalizeOptionalId(form.id),
    name: form.name.trim(),
    sketchId,
    entityId,
    target,
    ...buildSketchDimensionValueInput(form)
  };
}

export function buildUpdateSketchDimensionOp(
  id: SketchDimensionId,
  form: SketchDimensionForm
): SketchDimensionUpdateOp {
  return {
    op: "sketch.dimension.update",
    id,
    ...buildSketchDimensionValueInput(form)
  };
}

export function buildRenameSketchDimensionOp(
  id: SketchDimensionId,
  name: string
): SketchDimensionRenameOp {
  return {
    op: "sketch.dimension.rename",
    id,
    name: name.trim()
  };
}

export function buildDeleteSketchDimensionOp(
  id: SketchDimensionId
): SketchDimensionDeleteOp {
  return {
    op: "sketch.dimension.delete",
    id
  };
}

export function buildSketchDimensionEditOps(
  dimension: SketchDimensionEntry,
  form: SketchDimensionForm
): readonly (SketchDimensionRenameOp | SketchDimensionUpdateOp)[] {
  const ops: (SketchDimensionRenameOp | SketchDimensionUpdateOp)[] = [];
  const nextName = form.name.trim();

  if (nextName !== dimension.name) {
    ops.push(buildRenameSketchDimensionOp(dimension.id, nextName));
  }

  const nextValueSource = buildSketchDimensionValueInput(form);
  if (
    (form.valueSourceType === "literal" &&
      (dimension.valueSource.type !== "literal" ||
        dimension.valueSource.value !== nextValueSource.value)) ||
    (form.valueSourceType === "parameter" &&
      (dimension.valueSource.type !== "parameter" ||
        dimension.valueSource.parameterId !== nextValueSource.parameterId))
  ) {
    ops.push(buildUpdateSketchDimensionOp(dimension.id, form));
  }

  return ops;
}

export function buildCreateSketchConstraintOp(
  sketchId: SketchId,
  entityId: string,
  form: SketchConstraintForm
): SketchConstraintCreateOp {
  if (form.kind === "fixed") {
    const coordinate: Vec2 = [form.coordinateX, form.coordinateY];

    return {
      op: "sketch.constraint.create",
      id: normalizeOptionalId(form.id),
      name: form.name.trim(),
      sketchId,
      kind: "fixed",
      target: { entityId, role: form.targetRole },
      ...(form.coordinateMode === "custom" ? { coordinate } : {})
    };
  }

  if (form.kind === "coincident") {
    return {
      op: "sketch.constraint.create",
      id: normalizeOptionalId(form.id),
      name: form.name.trim(),
      sketchId,
      kind: "coincident",
      primaryTarget: { entityId, role: form.targetRole },
      secondaryTarget: {
        entityId: form.secondaryEntityId,
        role: form.secondaryTargetRole
      }
    };
  }

  if (form.kind === "midpoint") {
    return {
      op: "sketch.constraint.create",
      id: normalizeOptionalId(form.id),
      name: form.name.trim(),
      sketchId,
      kind: "midpoint",
      lineEntityId: entityId,
      target: {
        entityId: form.secondaryEntityId,
        role: form.secondaryTargetRole
      }
    };
  }

  if (form.kind === "parallel" || form.kind === "perpendicular") {
    return {
      op: "sketch.constraint.create",
      id: normalizeOptionalId(form.id),
      name: form.name.trim(),
      sketchId,
      kind: form.kind,
      primaryLineEntityId: entityId,
      secondaryLineEntityId: form.secondaryEntityId
    };
  }

  return {
    op: "sketch.constraint.create",
    id: normalizeOptionalId(form.id),
    name: form.name.trim(),
    sketchId,
    entityId,
    kind: form.kind
  };
}

export function buildRenameSketchConstraintOp(
  id: SketchConstraintId,
  name: string
): SketchConstraintRenameOp {
  return {
    op: "sketch.constraint.rename",
    id,
    name: name.trim()
  };
}

export function buildDeleteSketchConstraintOp(
  id: SketchConstraintId
): SketchConstraintDeleteOp {
  return {
    op: "sketch.constraint.delete",
    id
  };
}

export function buildSketchConstraintEditOps(
  constraint: SketchConstraintEntry,
  form: SketchConstraintForm
): readonly SketchConstraintRenameOp[] {
  const nextName = form.name.trim();

  return nextName !== constraint.name
    ? [buildRenameSketchConstraintOp(constraint.id, nextName)]
    : [];
}

export function buildFeatureExtrudeOp(
  sketchId: SketchId,
  entityId: string,
  form: FeatureExtrudeForm
): FeatureExtrudeOp {
  const targetBodyId = normalizeOptionalId(form.targetBodyId ?? "");

  return {
    op: "feature.extrude",
    id: normalizeOptionalId(form.id),
    bodyId: normalizeOptionalId(form.bodyId),
    ...(targetBodyId ? { targetBodyId } : {}),
    name: form.name.trim() || undefined,
    sketchId,
    entityId,
    depth: form.depth,
    side: form.side,
    operationMode: form.operationMode
  };
}

export function buildFeatureRevolveOp(
  sketchId: SketchId,
  entityId: string,
  form: FeatureRevolveForm
): FeatureRevolveOp {
  return {
    op: "feature.revolve",
    id: normalizeOptionalId(form.id),
    bodyId: normalizeOptionalId(form.bodyId),
    name: form.name.trim() || undefined,
    sketchId,
    entityId,
    axis: {
      type: "sketchLine",
      sketchId,
      entityId: form.axisEntityId
    },
    angleDegrees: form.angleDegrees,
    operationMode: "newBody"
  };
}

export function buildFeatureHoleOp(
  sketchId: SketchId,
  circleEntityId: string,
  form: FeatureHoleForm
): FeatureHoleOp {
  return {
    op: "feature.hole",
    id: normalizeOptionalId(form.id),
    bodyId: normalizeOptionalId(form.bodyId),
    targetBodyId: form.targetBodyId,
    name: form.name.trim() || undefined,
    sketchId,
    circleEntityId,
    depthMode: form.depthMode,
    ...(form.depthMode === "blind" ? { depth: form.depth } : {}),
    direction: form.direction
  };
}

export function buildFeatureChamferOp(
  form: FeatureEdgeFinishForm
): FeatureChamferOp {
  const edgeStableId = normalizeOptionalId(form.edgeStableId ?? "");
  const namedReference = normalizeOptionalText(form.namedReference ?? "");
  const topologyAnchorId = normalizeOptionalId(form.topologyAnchorId ?? "");

  return {
    op: "feature.chamfer",
    id: normalizeOptionalId(form.id),
    bodyId: normalizeOptionalId(form.bodyId),
    targetBodyId: form.targetBodyId,
    ...(topologyAnchorId
      ? { topologyAnchorId }
      : edgeStableId
        ? { edgeStableId }
        : {}),
    ...(!topologyAnchorId && namedReference ? { namedReference } : {}),
    distance: form.distance,
    name: form.name.trim() || undefined
  };
}

export function buildFeatureFilletOp(
  form: FeatureEdgeFinishForm
): FeatureFilletOp {
  const edgeStableId = normalizeOptionalId(form.edgeStableId ?? "");
  const namedReference = normalizeOptionalText(form.namedReference ?? "");
  const topologyAnchorId = normalizeOptionalId(form.topologyAnchorId ?? "");

  return {
    op: "feature.fillet",
    id: normalizeOptionalId(form.id),
    bodyId: normalizeOptionalId(form.bodyId),
    targetBodyId: form.targetBodyId,
    ...(topologyAnchorId
      ? { topologyAnchorId }
      : edgeStableId
        ? { edgeStableId }
        : {}),
    ...(!topologyAnchorId && namedReference ? { namedReference } : {}),
    radius: form.radius,
    name: form.name.trim() || undefined
  };
}

export function buildFeatureDeleteOp(id: string): FeatureDeleteOp {
  return {
    op: "feature.delete",
    id
  };
}

export function buildFeatureUpdateExtrudeOp(
  id: string,
  depth: number,
  side?: FeatureExtrudeSide
): FeatureUpdateExtrudeOp {
  return {
    op: "feature.updateExtrude",
    id,
    depth,
    ...(side ? { side } : {})
  };
}

export function buildFeatureUpdateRevolveOp(
  id: string,
  angleDegrees: number
): FeatureUpdateRevolveOp {
  return {
    op: "feature.updateRevolve",
    id,
    angleDegrees
  };
}

export function buildFeatureUpdateHoleOp(
  id: string,
  depthMode?: FeatureHoleDepthMode,
  depth?: number,
  direction?: FeatureHoleDirection
): FeatureUpdateHoleOp {
  return {
    op: "feature.updateHole",
    id,
    ...(depthMode ? { depthMode } : {}),
    ...(depth !== undefined ? { depth } : {}),
    ...(direction ? { direction } : {})
  };
}

export function buildFeatureUpdateChamferOp(
  id: string,
  distance: number
): FeatureUpdateChamferOp {
  return {
    op: "feature.updateChamfer",
    id,
    distance
  };
}

export function buildFeatureUpdateFilletOp(
  id: string,
  radius: number
): FeatureUpdateFilletOp {
  return {
    op: "feature.updateFillet",
    id,
    radius
  };
}

export function buildNameGeneratedReferenceOp(
  name: string,
  bodyId: string,
  stableId: string
): ReferenceNameGeneratedOp {
  return {
    op: "reference.nameGenerated",
    name: name.trim(),
    bodyId,
    stableId
  };
}

export function buildRepairNamedReferenceOp(
  name: string,
  bodyId: string,
  stableId: string
): ReferenceRepairNameOp {
  return {
    op: "reference.repairName",
    name: name.trim(),
    bodyId,
    stableId
  };
}

export function buildDeleteNamedReferenceOp(
  name: string
): ReferenceDeleteNameOp {
  return {
    op: "reference.deleteName",
    name: name.trim()
  };
}

export function buildBatch(
  mode: CadBatchMode,
  ops: readonly CadOp[],
  actor?: CadActorMetadata
): CadBatch {
  return {
    version: "cadops.v1",
    mode,
    ops,
    ...(actor ? { actor } : {})
  };
}

export function boxDimensionsToForm(input: {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}): DimensionCommandForm {
  return {
    width: input.width,
    height: input.height,
    depth: input.depth,
    radius: 1,
    majorRadius: 2,
    minorRadius: 0.5
  };
}

export function cylinderDimensionsToForm(input: {
  readonly radius: number;
  readonly height: number;
}): DimensionCommandForm {
  return {
    width: 1,
    height: input.height,
    depth: 1,
    radius: input.radius,
    majorRadius: 2,
    minorRadius: 0.5
  };
}

export function sphereDimensionsToForm(input: {
  readonly radius: number;
}): DimensionCommandForm {
  return {
    width: 1,
    height: 1,
    depth: 1,
    radius: input.radius,
    majorRadius: 2,
    minorRadius: 0.5
  };
}

export function coneDimensionsToForm(input: {
  readonly radius: number;
  readonly height: number;
}): DimensionCommandForm {
  return {
    width: 1,
    height: input.height,
    depth: 1,
    radius: input.radius,
    majorRadius: 2,
    minorRadius: 0.5
  };
}

export function torusDimensionsToForm(input: {
  readonly majorRadius: number;
  readonly minorRadius: number;
}): DimensionCommandForm {
  return {
    width: 1,
    height: 1,
    depth: 1,
    radius: 1,
    majorRadius: input.majorRadius,
    minorRadius: input.minorRadius
  };
}

export function areBoxDimensionFormsEqual(
  left: DimensionCommandForm,
  right: DimensionCommandForm
): boolean {
  return (
    left.width === right.width &&
    left.height === right.height &&
    left.depth === right.depth
  );
}

export function areCylinderDimensionFormsEqual(
  left: DimensionCommandForm,
  right: DimensionCommandForm
): boolean {
  return left.radius === right.radius && left.height === right.height;
}

export function areSphereDimensionFormsEqual(
  left: DimensionCommandForm,
  right: DimensionCommandForm
): boolean {
  return left.radius === right.radius;
}

export function areConeDimensionFormsEqual(
  left: DimensionCommandForm,
  right: DimensionCommandForm
): boolean {
  return left.radius === right.radius && left.height === right.height;
}

export function areTorusDimensionFormsEqual(
  left: DimensionCommandForm,
  right: DimensionCommandForm
): boolean {
  return (
    left.majorRadius === right.majorRadius &&
    left.minorRadius === right.minorRadius
  );
}

export function transformToForm(transform: Transform): TransformCommandForm {
  return {
    translationX: transform.translation[0],
    translationY: transform.translation[1],
    translationZ: transform.translation[2],
    rotationX: transform.rotation[0],
    rotationY: transform.rotation[1],
    rotationZ: transform.rotation[2],
    scaleX: transform.scale[0],
    scaleY: transform.scale[1],
    scaleZ: transform.scale[2]
  };
}

export function areTransformFormsEqual(
  left: TransformCommandForm,
  right: TransformCommandForm
): boolean {
  return (
    left.translationX === right.translationX &&
    left.translationY === right.translationY &&
    left.translationZ === right.translationZ &&
    left.rotationX === right.rotationX &&
    left.rotationY === right.rotationY &&
    left.rotationZ === right.rotationZ &&
    left.scaleX === right.scaleX &&
    left.scaleY === right.scaleY &&
    left.scaleZ === right.scaleZ
  );
}

export function resetTransformTranslation(
  form: TransformCommandForm
): TransformCommandForm {
  return {
    ...form,
    translationX: 0,
    translationY: 0,
    translationZ: 0
  };
}

export function resetTransformRotation(
  form: TransformCommandForm
): TransformCommandForm {
  return {
    ...form,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0
  };
}

export function resetTransformScale(
  form: TransformCommandForm
): TransformCommandForm {
  return {
    ...form,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1
  };
}

function buildTransform(form: TransformCommandForm): Transform {
  return {
    translation: toVec3(
      form.translationX,
      form.translationY,
      form.translationZ
    ),
    rotation: toVec3(form.rotationX, form.rotationY, form.rotationZ),
    scale: toVec3(form.scaleX, form.scaleY, form.scaleZ)
  };
}

function toVec3(x: number, y: number, z: number): Vec3 {
  return [x, y, z];
}

function toVec2(x: number, y: number): Vec2 {
  return [x, y];
}

function normalizeOptionalId(id: string): string | undefined {
  const normalized = id.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function buildSketchDimensionValueInput(
  form: SketchDimensionForm
): Pick<SketchDimensionCreateOp, "value" | "parameterId"> {
  return form.valueSourceType === "parameter"
    ? { parameterId: form.parameterId.trim() }
    : { value: form.value };
}
