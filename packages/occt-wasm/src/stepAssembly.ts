import type {
  OpenCascadeInstance,
  TDF_Label,
  XCAFDoc_ColorTool,
  XCAFDoc_ColorType,
  Quantity_TypeOfColor
} from "opencascade.js";

/** Row-major affine 3x4 matrix; translation uses the document's length unit. */
export type OcctStepPlacement = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

/** Linear RGB, as represented by XDE. */
export type OcctStepColor = readonly [number, number, number];

export interface OcctStepOccurrence {
  readonly id: string;
  readonly definitionId: string;
  readonly name: string;
  readonly transform: OcctStepPlacement;
  readonly color?: OcctStepColor;
}

export interface OcctStepAssemblyDefinition {
  readonly id: string;
  readonly name: string;
  readonly components: readonly OcctStepOccurrence[];
  readonly color?: OcctStepColor;
}

export interface OcctStepAssembly {
  /** Assembly definitions only; leaf definition IDs refer to imported bodies. */
  readonly definitions: readonly OcctStepAssemblyDefinition[];
  readonly roots: readonly OcctStepOccurrence[];
  /** Expanded leaf count, including repeated occurrences. */
  readonly occurrenceCount: number;
}

export const OCCT_STEP_IDENTITY_PLACEMENT: OcctStepPlacement = [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0
];

export function stepUnitScale(unit: "mm" | "cm" | "m" | "in"): number {
  return unit === "mm" ? 1 : unit === "cm" ? 10 : unit === "m" ? 1_000 : 25.4;
}

export function assertStepRigidPlacement(
  matrix: OcctStepPlacement,
  id: string
): void {
  if (matrix.length !== 12 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error(
      `STEP occurrence ${id} requires a finite affine 3x4 placement.`
    );
  }
  const axes = [
    [matrix[0], matrix[4], matrix[8]],
    [matrix[1], matrix[5], matrix[9]],
    [matrix[2], matrix[6], matrix[10]]
  ];
  for (let first = 0; first < 3; first++)
    for (let second = first; second < 3; second++) {
      const dot = axes[first]!.reduce(
        (sum, value, index) => sum + value * axes[second]![index]!,
        0
      );
      if (Math.abs(dot - (first === second ? 1 : 0)) > 1e-8) {
        throw new Error(
          `STEP occurrence ${id} contains scale or shear; bake that transform into its exact part geometry before assembly export.`
        );
      }
    }
  const determinant =
    matrix[0] * (matrix[5] * matrix[10] - matrix[6] * matrix[9]) -
    matrix[1] * (matrix[4] * matrix[10] - matrix[6] * matrix[8]) +
    matrix[2] * (matrix[4] * matrix[9] - matrix[5] * matrix[8]);
  if (determinant < 0) {
    throw new Error(
      `STEP occurrence ${id} contains a reflection; bake that transform into its exact part geometry before assembly export.`
    );
  }
}

export function readStepName(
  oc: OpenCascadeInstance,
  label: TDF_Label
): string | undefined {
  const handle = new oc.Handle_TDF_Attribute_1();
  const guid = oc.TDataStd_Name.GetID();
  try {
    if (!label.FindAttribute_1(guid, handle)) return undefined;
    const attribute = handle.get() as unknown as {
      Get(): InstanceType<OpenCascadeInstance["TCollection_ExtendedString_1"]>;
    };
    const value = attribute.Get();
    try {
      // A zero replacement requests OCCT's UTF-8 conversion; ExtendedString
      // Value/ToExtString expose unbound char16_t types in the pinned WASM build.
      const utf8 = new oc.TCollection_AsciiString_13(value, 0);
      try {
        const bytes = Uint8Array.from(utf8.ToCString(), (char: string) =>
          char.charCodeAt(0)
        );
        return new TextDecoder().decode(bytes).trim() || undefined;
      } finally {
        utf8.delete();
      }
    } finally {
      value.delete();
    }
  } finally {
    guid.delete();
    handle.delete();
  }
}

export function readStepColor(
  oc: OpenCascadeInstance,
  tool: XCAFDoc_ColorTool,
  label: TDF_Label
): OcctStepColor | undefined {
  const color = new oc.Quantity_Color_1();
  try {
    if (
      tool.GetColor_4(
        label,
        oc.XCAFDoc_ColorType.XCAFDoc_ColorSurf as XCAFDoc_ColorType,
        color
      ) ||
      tool.GetColor_4(
        label,
        oc.XCAFDoc_ColorType.XCAFDoc_ColorGen as XCAFDoc_ColorType,
        color
      )
    ) {
      return [color.Red(), color.Green(), color.Blue()];
    }
    return undefined;
  } finally {
    color.delete();
  }
}

export function stepAppearanceIsPartial(
  oc: OpenCascadeInstance,
  tool: XCAFDoc_ColorTool,
  label: TDF_Label
): boolean {
  const rgba = new oc.Quantity_ColorRGBA_1();
  const subshapes = new oc.TDF_LabelSequence_1();
  try {
    for (const kind of [
      oc.XCAFDoc_ColorType.XCAFDoc_ColorGen,
      oc.XCAFDoc_ColorType.XCAFDoc_ColorSurf
    ]) {
      if (
        tool.GetColor_5(label, kind as XCAFDoc_ColorType, rgba) &&
        rgba.Alpha() < 1 - 1e-7
      )
        return true;
    }
    if (
      tool.IsSet_1(
        label,
        oc.XCAFDoc_ColorType.XCAFDoc_ColorCurv as XCAFDoc_ColorType
      )
    )
      return true;
    oc.XCAFDoc_ShapeTool.GetSubShapes(label, subshapes);
    for (let index = 1; index <= subshapes.Length(); index++) {
      const subshape = subshapes.Value(index);
      try {
        if (
          readStepColor(oc, tool, subshape) ||
          tool.IsSet_1(
            subshape,
            oc.XCAFDoc_ColorType.XCAFDoc_ColorCurv as XCAFDoc_ColorType
          )
        )
          return true;
      } finally {
        subshape.delete();
      }
    }
    return false;
  } finally {
    subshapes.delete();
    rgba.delete();
  }
}

export function setStepName(
  oc: OpenCascadeInstance,
  label: TDF_Label,
  name: string
): void {
  const value = new oc.TCollection_ExtendedString_2(name, true);
  try {
    oc.TDataStd_Name.Set_1(label, value).delete();
  } finally {
    value.delete();
  }
}

export function setStepColor(
  oc: OpenCascadeInstance,
  tool: XCAFDoc_ColorTool,
  label: TDF_Label,
  rgb: OcctStepColor | undefined
): void {
  if (!rgb) return;
  if (rgb.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error("STEP color components must be finite values from 0 to 1.");
  }
  const color = new oc.Quantity_Color_3(
    ...rgb,
    oc.Quantity_TypeOfColor.Quantity_TOC_RGB as Quantity_TypeOfColor
  );
  try {
    tool.SetColor_2(
      label,
      color,
      oc.XCAFDoc_ColorType.XCAFDoc_ColorGen as XCAFDoc_ColorType
    );
  } finally {
    color.delete();
  }
}
