import type {
  CadBatch,
  CadBatchMode,
  CadOp,
  ObjectId,
  SceneCreateBoxOp,
  SceneCreateCylinderOp,
  SceneDeleteObjectOp,
  SceneUpdateTransformOp,
  Transform,
  Vec3
} from "@web-cad/cad-protocol";

export type BatchOperationKind =
  | "scene.createBox"
  | "scene.createCylinder"
  | "scene.updateTransform"
  | "scene.deleteObject";

export interface PrimitiveCommandForm {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly radius: number;
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
    case "scene.deleteObject":
      return buildDeleteObjectOp(requireTargetId(form.targetId));
  }
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
