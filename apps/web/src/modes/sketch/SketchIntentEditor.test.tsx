import type {
  SketchConstraintEntry,
  SketchDimensionEntryV22,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SketchIntentEditor } from "./SketchIntentEditor";
import {
  applySketchIntentSessionV19,
  closeSketchIntentSessionV19,
  focusSketchIntentEditorV19,
  registerSketchIntentSessionV19
} from "./sketchIntentEditorModel";

describe("V19 sketch right editor", () => {
  it("renders evaluated/status/conflict detail without exposing raw codes as primary copy", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchIntentEditor, {
        disabled: false,
        sketch,
        selectedEntityId: "line_1",
        parameters: [],
        dimensions: [conflictingDimension],
        constraints: [conflictingConstraint],
        units: "mm",
        onApplyOps: vi.fn()
      })
    );

    expect(markup).toContain("Point distance");
    expect(markup).toContain("Evaluated 5 mm");
    expect(markup).toContain(
      "This intent conflicts with another sketch relationship."
    );
    expect(markup).toContain("Technical details");
    expect(markup).toContain("Line 1 and Line 2");
    expect(markup).toContain("Add dimension");
    expect(markup).toContain("Add constraint");
  });

  it("opens a keyboard-complete line-angle draft with literal-only binding", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchIntentEditor, {
        disabled: false,
        sketch,
        parameters: [{ id: "length", name: "Length", value: 5 }],
        dimensions: [],
        constraints: [],
        units: "mm",
        initialDimensionFamily: "lineAngle",
        onApplyOps: vi.fn()
      })
    );

    expect(markup).toContain('aria-label="Create dimension"');
    expect(markup).toContain("Line angle");
    expect(markup).toContain("First line");
    expect(markup).toContain("Second line");
    expect(markup).toContain("Angle sense");
    expect(markup).toContain("Counterclockwise");
    expect(markup).toContain("Value (degrees)");
    expect(markup).toContain('data-drawer-initial-focus="true"');
    expect(markup).toContain('type="submit"');
    expect(markup).toContain(
      'aria-describedby="dimension-draft-create-message"'
    );
    expect(markup).toContain('id="dimension-draft-create-message"');
    expect(markup).toContain("Current geometry:");
    expect(markup).toContain("Local input checks passed");
    expect(markup).not.toContain("Solver check ready");
    expect(markup).toContain("Add dimension");
    expect(markup).toContain("Add constraint");
    expect(markup).toContain("Apply");
    expect(markup).toContain("Cancel");
    expect(markup).not.toContain('value="parameter"');
  });

  it("keeps one session active, stable Add focus targets mounted, and opposite mutations disabled", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchIntentEditor, {
        disabled: false,
        sketch,
        parameters: [],
        dimensions: [conflictingDimension],
        constraints: [conflictingConstraint],
        units: "mm",
        initialDimensionFamily: "lineAngle",
        onApplyOps: vi.fn()
      })
    );

    expect(markup).toContain('aria-label="Create dimension"');
    expect(markup).toContain(
      '<button type="button" class="pb-button" disabled="">Add dimension</button>'
    );
    expect(markup).toContain(
      '<button type="button" class="pb-button" disabled="">Add constraint</button>'
    );
    expect(markup.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("keeps an unavailable exact action explicit instead of falling back to generic Add", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchIntentEditor, {
        disabled: false,
        sketch: { ...sketch, entities: [] },
        parameters: [],
        dimensions: [],
        constraints: [],
        units: "mm",
        initialDimensionFamily: "lineAngle",
        onApplyOps: vi.fn()
      })
    );

    expect(markup).toContain('aria-label="Line angle unavailable"');
    expect(markup).toContain("Line angle");
    expect(markup).toContain("Close Line angle");
    expect(markup).not.toContain("Add dimension");
    expect(markup).not.toContain('aria-label="Create dimension"');
  });

  it("renders the complete creatable Decision 14 matrix in the explicit collector", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchIntentEditor, {
        disabled: false,
        sketch,
        parameters: [],
        dimensions: [],
        constraints: [],
        units: "mm",
        initialConstraintKind: "fixed",
        onApplyOps: vi.fn()
      })
    );

    for (const label of [
      "Horizontal",
      "Vertical",
      "Fixed point",
      "Coincident",
      "Midpoint",
      "Parallel",
      "Perpendicular",
      "Tangent",
      "Concentric",
      "Equal length",
      "Equal radius",
      "Symmetry"
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).not.toContain('<option value="angle"');
  });

  it("retains rejected draft work and restores focus only after success", async () => {
    const ops = [{ op: "sketch.dimension.delete", id: "dimension_1" }] as const;
    const success = vi.fn();

    await expect(
      applySketchIntentSessionV19(ops, async () => false, success)
    ).resolves.toBe(false);
    expect(success).not.toHaveBeenCalled();

    await expect(
      applySketchIntentSessionV19(ops, async () => true, success)
    ).resolves.toBe(true);
    expect(success).toHaveBeenCalledTimes(1);

    const focus = vi.fn();
    focusSketchIntentEditorV19({ focus });
    expect(focus).toHaveBeenCalledOnce();
  });

  it("closes the local draft before notifying the shared editor owner", () => {
    const order: string[] = [];
    closeSketchIntentSessionV19(
      () => order.push("local"),
      (restoreFocus) => order.push(`owner:${restoreFocus}`),
      true
    );
    expect(order).toEqual(["local", "owner:true"]);
  });

  it("registers direct in-panel drafts with shared navigation ownership", () => {
    const changes: (object | undefined)[] = [];
    const control = {
      apply: async () => true,
      focus: vi.fn(),
      getReturnFocusTarget: vi.fn(() => null),
      closeLocalDraft: vi.fn()
    };
    const cleanup = registerSketchIntentSessionV19(
      true,
      (value) => changes.push(value),
      control
    );
    expect(changes).toEqual([control]);
    cleanup?.();
    expect(changes).toEqual([control, undefined]);
  });
});

const sketch: SketchSnapshot = {
  id: "sketch_1",
  name: "Profile",
  plane: "XY",
  entities: [
    {
      id: "point_1",
      kind: "point",
      point: [0, 5],
      construction: false
    },
    {
      id: "line_1",
      kind: "line",
      start: [0, 0],
      end: [5, 0],
      construction: false
    },
    {
      id: "line_2",
      kind: "line",
      start: [0, 0],
      end: [0, 5],
      construction: false
    },
    {
      id: "circle_1",
      kind: "circle",
      center: [5, 5],
      radius: 2,
      construction: false
    },
    {
      id: "arc_1",
      kind: "arc",
      center: [8, 5],
      radius: 2,
      startAngleDegrees: 0,
      sweepAngleDegrees: 90,
      construction: false
    }
  ]
};

const conflictingDimension: SketchDimensionEntryV22 = {
  sourceShape: "v22",
  id: "dimension_1",
  name: "Separation",
  sketchId: "sketch_1",
  target: {
    kind: "pointPair",
    primary: {
      entityId: "line_1",
      entityKind: "line",
      role: "start"
    },
    secondary: {
      entityId: "point_1",
      entityKind: "point",
      role: "position"
    },
    measurement: "distance"
  },
  valueSource: { type: "literal", value: 5 },
  effectiveValue: 5,
  status: "inconsistent",
  issues: [
    {
      code: "INCONSISTENT_CONSTRAINT",
      message: "Move the second point farther from the first."
    }
  ]
};

const conflictingConstraint: SketchConstraintEntry = {
  id: "constraint_1",
  name: "Perpendicular",
  sketchId: "sketch_1",
  entityId: "line_2",
  kind: "perpendicular",
  primaryLineEntityId: "line_1",
  secondaryLineEntityId: "line_2",
  status: "inconsistent",
  issues: [
    {
      code: "CONFLICTING_CONSTRAINT",
      message: "These line directions conflict."
    }
  ]
};
