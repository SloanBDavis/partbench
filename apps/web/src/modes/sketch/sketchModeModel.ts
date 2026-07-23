import type {
  SketchConstraintEntry,
  SketchDimensionEntry,
  SketchDimensionTarget,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import type {
  SketchConstraintForm,
  SketchDimensionForm,
  SketchEntityForm
} from "../../cadCommands";
import { defaultSketchEntityForm } from "../../sketchEntityForms";

export type SketchCreateEntityKind = Exclude<SketchEntityKind, "arc">;

export const DEFAULT_SKETCH_DIMENSION_FORM: SketchDimensionForm = {
  id: "",
  name: "Dimension",
  valueSourceType: "literal",
  value: 1,
  parameterId: ""
};

export const DEFAULT_SKETCH_CONSTRAINT_FORM: SketchConstraintForm = {
  id: "",
  name: "Horizontal",
  kind: "horizontal",
  targetRole: "start",
  coordinateMode: "current",
  coordinateX: 0,
  coordinateY: 0,
  secondaryEntityId: "",
  secondaryTargetRole: "position"
};

export function resolveActiveSketch(
  sketches: readonly SketchSnapshot[],
  activeSketchId: string | undefined
): SketchSnapshot | undefined {
  return sketches.find((sketch) => sketch.id === activeSketchId) ?? sketches[0];
}

export function resolveSelectedSketchEntity(
  sketch: SketchSnapshot | undefined,
  selectedEntityId: string | undefined
): SketchEntitySnapshot | undefined {
  return (
    sketch?.entities.find((entity) => entity.id === selectedEntityId) ??
    sketch?.entities[0]
  );
}

export function createEntityDraft(construction: boolean): SketchEntityForm {
  return { ...defaultSketchEntityForm, construction };
}

export function dimensionToDraft(
  dimension: SketchDimensionEntry
): SketchDimensionForm {
  return {
    id: "",
    name: dimension.name,
    valueSourceType: dimension.valueSource.type,
    value:
      dimension.valueSource.type === "literal"
        ? dimension.valueSource.value
        : (dimension.effectiveValue ?? 1),
    parameterId:
      dimension.valueSource.type === "parameter"
        ? dimension.valueSource.parameterId
        : ""
  };
}

export function createDimensionDraft(
  label: string,
  target: SketchDimensionTarget,
  currentValue: number
): {
  readonly target: SketchDimensionTarget;
  readonly form: SketchDimensionForm;
} {
  return {
    target,
    form: {
      ...DEFAULT_SKETCH_DIMENSION_FORM,
      name: label,
      value: currentValue
    }
  };
}

export function constraintToRenameDraft(
  constraint: SketchConstraintEntry
): SketchConstraintForm {
  return {
    ...DEFAULT_SKETCH_CONSTRAINT_FORM,
    name: constraint.name,
    kind:
      constraint.kind === "tangent" ||
      constraint.kind === "concentric" ||
      constraint.kind === "equalLength" ||
      constraint.kind === "equalRadius" ||
      constraint.kind === "angle" ||
      constraint.kind === "symmetry"
        ? "horizontal"
        : constraint.kind
  };
}

export function dimensionTargetKey(
  target: SketchDimensionTarget | undefined
): string {
  return target ? `${target.entityKind}:${target.role}` : "";
}

export function isLinePairConstraintKind(
  kind: SketchConstraintForm["kind"] | undefined
): kind is "parallel" | "perpendicular" {
  return kind === "parallel" || kind === "perpendicular";
}
