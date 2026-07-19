import type {
  SketchConstraintEntry,
  SketchDimensionEntry,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  constraintToRenameDraft,
  createDimensionDraft,
  createEntityDraft,
  dimensionToDraft,
  resolveActiveSketch,
  resolveSelectedSketchEntity
} from "./sketchModeModel";

const sketches: readonly SketchSnapshot[] = [
  {
    id: "sketch-a",
    name: "Sketch A",
    plane: "XY",
    entities: [
      {
        id: "line-a",
        kind: "line",
        start: [0, 0],
        end: [4, 0],
        construction: false
      }
    ]
  },
  { id: "sketch-b", name: "Sketch B", plane: "YZ", entities: [] }
];

describe("V18 Sketch mode draft model", () => {
  it("resolves exact active and selected source records with stable fallbacks", () => {
    expect(resolveActiveSketch(sketches, "sketch-b")?.id).toBe("sketch-b");
    expect(resolveActiveSketch(sketches, "missing")?.id).toBe("sketch-a");
    expect(resolveSelectedSketchEntity(sketches[0], "line-a")?.id).toBe(
      "line-a"
    );
    expect(resolveSelectedSketchEntity(sketches[0], "missing")?.id).toBe(
      "line-a"
    );
  });

  it("creates local entity drafts without mutating the source snapshot", () => {
    const source = sketches[0]!.entities[0]!;
    const draft = createEntityDraft("rectangle", true);
    const changed = { ...draft, width: 12 };

    expect(changed).toMatchObject({ construction: true, width: 12 });
    expect(source).toMatchObject({ kind: "line", construction: false });
    expect(sketches[0]!.entities).toHaveLength(1);
  });

  it("round-trips literal and parameter dimensions into explicit edit drafts", () => {
    const literal: SketchDimensionEntry = {
      id: "width",
      name: "Width",
      sketchId: "sketch-a",
      entityId: "rect-a",
      target: { entityKind: "rectangle", role: "width" },
      valueSource: { type: "literal", value: 8 },
      effectiveValue: 8,
      status: "healthy",
      issues: []
    };
    const parameter: SketchDimensionEntry = {
      ...literal,
      id: "height",
      name: "Height",
      target: { entityKind: "rectangle", role: "height" },
      valueSource: { type: "parameter", parameterId: "height-param" },
      effectiveValue: 5
    };

    expect(dimensionToDraft(literal)).toMatchObject({
      valueSourceType: "literal",
      value: 8,
      parameterId: ""
    });
    expect(dimensionToDraft(parameter)).toMatchObject({
      valueSourceType: "parameter",
      value: 5,
      parameterId: "height-param"
    });
    expect(
      createDimensionDraft("Sweep", { entityKind: "arc", role: "sweep" }, 90)
    ).toMatchObject({ form: { name: "Sweep", value: 90 } });
  });

  it("makes loaded advanced constraints rename-only in the V18 editor", () => {
    const tangent = {
      id: "tangent-a",
      name: "Tangent guide",
      sketchId: "sketch-a",
      entityId: "line-a",
      kind: "tangent",
      primaryTarget: { entityId: "line-a", entityKind: "line" },
      secondaryTarget: { entityId: "arc-a", entityKind: "arc" },
      status: "healthy",
      issues: []
    } as SketchConstraintEntry;

    const draft = constraintToRenameDraft(tangent);
    expect(draft.name).toBe("Tangent guide");
    expect(draft.kind).toBe("horizontal");
    expect(draft.id).toBe("");
  });
});
