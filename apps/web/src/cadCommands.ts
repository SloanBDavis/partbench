import type {
  CadActorMetadata,
  CadBatch,
  CadBatchMode,
  CadOp,
  DocumentUnitUpdateMode,
  DocumentUnits,
  DocumentUpdateUnitsOp,
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
  SketchCreateOp,
  SketchDeleteEntityOp,
  SketchDeleteOp,
  SketchEntitySnapshot,
  SketchId,
  SketchPlane,
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

export type BatchOperationKind =
  | "document.updateUnits"
  | "scene.createBox"
  | "scene.createCylinder"
  | "scene.createSphere"
  | "scene.createCone"
  | "scene.createTorus"
  | "scene.updateTransform"
  | "scene.updateBoxDimensions"
  | "scene.updateCylinderDimensions"
  | "scene.updateSphereDimensions"
  | "scene.updateConeDimensions"
  | "scene.updateTorusDimensions"
  | "scene.renameObject"
  | "scene.deleteObject";

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

export interface BatchOperationForm
  extends PrimitiveCommandForm, TransformCommandForm {
  readonly op: BatchOperationKind;
  readonly targetId: string;
  readonly name: string;
  readonly units: DocumentUnits;
  readonly unitUpdateMode?: DocumentUnitUpdateMode;
}

export interface SketchCreateForm {
  readonly id: string;
  readonly name: string;
  readonly plane: SketchPlane;
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

export function buildOperationFromBatchForm(form: BatchOperationForm): CadOp {
  switch (form.op) {
    case "document.updateUnits":
      return buildUpdateUnitsOp(form.units, form.unitUpdateMode);
    case "scene.createBox":
      return buildCreateBoxOp(form);
    case "scene.createCylinder":
      return buildCreateCylinderOp(form);
    case "scene.createSphere":
      return buildCreateSphereOp(form);
    case "scene.createCone":
      return buildCreateConeOp(form);
    case "scene.createTorus":
      return buildCreateTorusOp(form);
    case "scene.updateTransform":
      return buildUpdateTransformOp(requireTargetId(form.targetId), form);
    case "scene.updateBoxDimensions":
      return buildUpdateBoxDimensionsOp(requireTargetId(form.targetId), form);
    case "scene.updateCylinderDimensions":
      return buildUpdateCylinderDimensionsOp(
        requireTargetId(form.targetId),
        form
      );
    case "scene.updateSphereDimensions":
      return buildUpdateSphereDimensionsOp(
        requireTargetId(form.targetId),
        form
      );
    case "scene.updateConeDimensions":
      return buildUpdateConeDimensionsOp(requireTargetId(form.targetId), form);
    case "scene.updateTorusDimensions":
      return buildUpdateTorusDimensionsOp(requireTargetId(form.targetId), form);
    case "scene.renameObject":
      return buildRenameObjectOp(requireTargetId(form.targetId), form.name);
    case "scene.deleteObject":
      return buildDeleteObjectOp(requireTargetId(form.targetId));
  }
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

function requireTargetId(id: string): string {
  const normalized = id.trim();

  if (normalized.length === 0) {
    throw new Error("Target object ID is required.");
  }

  return normalized;
}
