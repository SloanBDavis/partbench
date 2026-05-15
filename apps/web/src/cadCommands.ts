import type {
  CadBatch,
  CadBatchMode,
  CadOp,
  ObjectId,
  SceneCreateBoxOp,
  SceneCreateCylinderOp,
  SceneDeleteObjectOp,
  SceneUpdateBoxDimensionsOp,
  SceneUpdateCylinderDimensionsOp,
  SceneUpdateTransformOp,
  Transform,
  Vec3
} from "@web-cad/cad-protocol";

export type BatchOperationKind =
  | "scene.createBox"
  | "scene.createCylinder"
  | "scene.updateTransform"
  | "scene.updateBoxDimensions"
  | "scene.updateCylinderDimensions"
  | "scene.deleteObject";

export interface DimensionCommandForm {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly radius: number;
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

export function buildDeleteObjectOp(id: ObjectId): SceneDeleteObjectOp {
  return {
    op: "scene.deleteObject",
    id
  };
}

export function buildBatch(
  mode: CadBatchMode,
  ops: readonly CadOp[]
): CadBatch {
  return {
    version: "cadops.v1",
    mode,
    ops
  };
}

export function buildOperationFromBatchForm(form: BatchOperationForm): CadOp {
  switch (form.op) {
    case "scene.createBox":
      return buildCreateBoxOp(form);
    case "scene.createCylinder":
      return buildCreateCylinderOp(form);
    case "scene.updateTransform":
      return buildUpdateTransformOp(requireTargetId(form.targetId), form);
    case "scene.updateBoxDimensions":
      return buildUpdateBoxDimensionsOp(requireTargetId(form.targetId), form);
    case "scene.updateCylinderDimensions":
      return buildUpdateCylinderDimensionsOp(
        requireTargetId(form.targetId),
        form
      );
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
    radius: 1
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
    radius: input.radius
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
