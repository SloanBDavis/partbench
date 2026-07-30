import type {
  CadOp,
  SketchConstraintCreateOp,
  SketchConstraintEntry,
  SketchConstraintRenameOp,
  SketchConstraintUpdateOpV19,
  SketchDimensionCreateOpV22,
  SketchDimensionEntryCurrent,
  SketchDimensionRenameOp,
  SketchDimensionUpdateOpV22
} from "@web-cad/cad-protocol";
import {
  constraintEntryToDraftV19,
  dimensionEntryToDraftV19,
  type SketchConstraintDraftV19,
  type SketchDimensionDraftV19
} from "./sketchIntentEditorModel";

export function buildCreateDimensionOpsV19(
  sketchId: string,
  draft: SketchDimensionDraftV19
): readonly SketchDimensionCreateOpV22[] {
  return [
    {
      op: "sketch.dimension.create",
      id: optionalId(draft.id),
      name: draft.name.trim(),
      sketchId,
      target: draft.target,
      ...dimensionValueInput(draft)
    }
  ];
}

export function buildEditDimensionOpsV19(
  dimension: SketchDimensionEntryCurrent,
  draft: SketchDimensionDraftV19
): readonly (SketchDimensionRenameOp | SketchDimensionUpdateOpV22)[] {
  const current = dimensionEntryToDraftV19(dimension);
  const ops: (SketchDimensionRenameOp | SketchDimensionUpdateOpV22)[] = [];
  if (draft.name.trim() !== dimension.name) {
    ops.push({
      op: "sketch.dimension.rename",
      id: dimension.id,
      name: draft.name.trim()
    });
  }
  const sourceChanged =
    draft.valueSourceType !== current.valueSourceType ||
    (draft.valueSourceType === "literal"
      ? draft.value !== current.value
      : draft.parameterId !== current.parameterId);
  const targetChanged = !sameJson(draft.target, current.target);
  if (sourceChanged || targetChanged) {
    ops.push({
      op: "sketch.dimension.update",
      id: dimension.id,
      ...(targetChanged ? { target: draft.target } : {}),
      ...dimensionValueInput(draft)
    });
  }
  return ops;
}

export function buildDeleteDimensionOpV19(id: string): CadOp {
  return { op: "sketch.dimension.delete", id };
}

export function buildCreateConstraintOpsV19(
  sketchId: string,
  draft: SketchConstraintDraftV19
): readonly SketchConstraintCreateOp[] {
  if (draft.definition.kind === "angle") {
    throw new Error(
      "Legacy angle constraints are update-only; create a line-angle dimension."
    );
  }
  const base = {
    op: "sketch.constraint.create" as const,
    id: optionalId(draft.id),
    name: draft.name.trim(),
    sketchId
  };
  const definition = draft.definition;
  switch (definition.kind) {
    case "horizontal":
    case "vertical":
      return [
        { ...base, kind: definition.kind, entityId: definition.entityId }
      ];
    case "fixed":
      return [
        {
          ...base,
          kind: "fixed",
          target: definition.target,
          coordinate: definition.coordinate
        }
      ];
    case "coincident":
      return [
        {
          ...base,
          kind: "coincident",
          primaryTarget: definition.primaryTarget,
          secondaryTarget: definition.secondaryTarget
        }
      ];
    case "midpoint":
      return [
        {
          ...base,
          kind: "midpoint",
          lineEntityId: definition.lineEntityId,
          target: definition.target
        }
      ];
    case "parallel":
    case "perpendicular":
    case "equalLength":
      return [
        {
          ...base,
          kind: definition.kind,
          primaryLineEntityId: definition.primaryLineEntityId,
          secondaryLineEntityId: definition.secondaryLineEntityId
        }
      ];
    case "tangent":
      return [
        {
          ...base,
          kind: "tangent",
          primaryTarget: definition.primaryTarget,
          secondaryTarget: definition.secondaryTarget
        } as SketchConstraintCreateOp
      ];
    case "concentric":
    case "equalRadius":
      return [
        {
          ...base,
          kind: definition.kind,
          primaryTarget: definition.primaryTarget,
          secondaryTarget: definition.secondaryTarget
        }
      ];
    case "symmetry":
      return [
        {
          ...base,
          kind: "symmetry",
          primaryTarget: definition.primaryTarget,
          secondaryTarget: definition.secondaryTarget,
          symmetryLineEntityId: definition.symmetryLineEntityId
        }
      ];
  }
}

export function buildEditConstraintOpsV19(
  constraint: SketchConstraintEntry,
  draft: SketchConstraintDraftV19,
  entities: readonly import("@web-cad/cad-protocol").SketchEntitySnapshot[]
): readonly (SketchConstraintRenameOp | SketchConstraintUpdateOpV19)[] {
  const current = constraintEntryToDraftV19(constraint, entities);
  const ops: (SketchConstraintRenameOp | SketchConstraintUpdateOpV19)[] = [];
  if (draft.name.trim() !== constraint.name) {
    ops.push({
      op: "sketch.constraint.rename",
      id: constraint.id,
      name: draft.name.trim()
    });
  }
  if (!sameJson(draft.definition, current.definition)) {
    ops.push({
      op: "sketch.constraint.update",
      id: constraint.id,
      definition: draft.definition
    });
  }
  return ops;
}

export function buildDeleteConstraintOpV19(id: string): CadOp {
  return { op: "sketch.constraint.delete", id };
}

function dimensionValueInput(
  draft: SketchDimensionDraftV19
): { readonly value: number } | { readonly parameterId: string } {
  return draft.valueSourceType === "literal"
    ? { value: draft.value }
    : { parameterId: draft.parameterId.trim() };
}

function optionalId(id: string): string | undefined {
  const normalized = id.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
