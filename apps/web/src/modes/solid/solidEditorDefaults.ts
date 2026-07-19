import type {
  PrimitiveCommandForm,
  SketchCreateForm,
  TransformCommandForm
} from "../../cadCommands";
import type { PrimitiveEditorKind } from "./solidEditorTypes";

const BASE_PRIMITIVE: PrimitiveCommandForm = {
  id: "",
  width: 10,
  height: 10,
  depth: 10,
  radius: 5,
  majorRadius: 8,
  minorRadius: 2,
  translationX: 0,
  translationY: 0,
  translationZ: 0
};

/** Defaults seed a visible draft only; opening an editor never submits them. */
export function createPrimitiveDraft(
  kind: PrimitiveEditorKind
): PrimitiveCommandForm {
  void kind;
  return { ...BASE_PRIMITIVE };
}

export function createSketchDraft(index = 1): SketchCreateForm {
  return { id: "", name: `Sketch ${index}`, plane: "XY" };
}

export function createTransformDraft(): TransformCommandForm {
  return {
    translationX: 0,
    translationY: 0,
    translationZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1
  };
}
