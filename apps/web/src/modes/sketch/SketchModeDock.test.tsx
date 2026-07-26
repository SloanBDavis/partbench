import type {
  SketchCurveEditReadinessQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  SketchModeDock,
  canNavigateSketchDockSectionV19,
  getRequestedConstraintKind,
  getRequestedDimensionFamily,
  type SketchModeDockProps
} from "./SketchModeDock";

describe("V18 Sketch mode dock", () => {
  it("renders the supported precision tool set and truthful Finish semantics", () => {
    const markup = renderToStaticMarkup(
      createElement(
        SketchModeDock,
        props({ arcToolActiveSketchId: "sketch-a" })
      )
    );

    expect(markup).toContain('aria-label="Sketch editor"');
    expect(markup).toContain("Point");
    expect(markup).toContain("Line");
    expect(markup).toContain("Rectangle");
    expect(markup).toContain("Circle");
    expect(markup).toContain("Cancel Arc");
    expect(markup).toContain(
      "Click start, a point on the arc, then end. Press Escape to cancel without mutation."
    );
    expect(markup).toContain("Construction geometry");
    expect(markup).toContain("Finish Sketch");
    expect(markup).toContain(
      "Finish exits Sketch mode. Committed geometry remains in the document."
    );
    expect(markup).not.toContain("Cancel Sketch");
    expect(markup).not.toContain("Trim");
    expect(markup).not.toContain("Extend");
    expect(markup).not.toContain("Offset");
    expect(markup).not.toContain("Auto-constraints");
  });

  it("shows a mutation-free sketch collector when no active sketch exists", () => {
    const markup = renderToStaticMarkup(
      createElement(SketchModeDock, props({ sketches: [] }))
    );

    expect(markup).toContain("Create sketch");
    expect(markup).toContain("Top · XY");
    expect(markup).toContain("Front · XZ");
    expect(markup).toContain("Right · YZ");
    expect(markup).toContain("Optional sketch ID");
    expect(markup).toContain("Cancel");
    expect(markup).not.toContain("Finish Sketch");
  });

  it("renders selected-entity intent and downstream usage without raw diagnostics", () => {
    const markup = renderToStaticMarkup(createElement(SketchModeDock, props()));

    expect(markup).toContain("Selected entity");
    expect(markup).toContain("No dimensions or constraints");
    expect(markup).toContain("Not used by an authored feature");
    expect(markup).toContain('role="listbox"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).not.toContain("sourceBoundaryNote");
    expect(markup).not.toContain("derivedBoundaryNote");
  });

  it("opens exact ribbon geometry and dimension drafts without mutating", () => {
    const lineMarkup = renderToStaticMarkup(
      createElement(SketchModeDock, props({ initialActionId: "sketch.line" }))
    );
    const widthMarkup = renderToStaticMarkup(
      createElement(
        SketchModeDock,
        props({ initialActionId: "sketch.rectangle-width" })
      )
    );

    expect(lineMarkup).toContain('aria-label="Create Line"');
    expect(lineMarkup).toContain("Draft");
    expect(widthMarkup).toContain('value="Width"');
    expect(widthMarkup).toContain("Value source");
  });

  it("keeps active and blocked exact intent tools mounted until explicit close", () => {
    const emptySketch: SketchSnapshot = {
      id: "sketch-empty",
      name: "Empty",
      plane: "XY",
      entities: []
    };
    const markup = renderToStaticMarkup(
      createElement(
        SketchModeDock,
        props({
          sketches: [emptySketch],
          activeSketchId: emptySketch.id,
          selectedEntityId: undefined,
          initialActionId: "sketch.line-angle"
        })
      )
    );

    expect(markup).toContain('aria-label="Line angle unavailable"');
    expect(markup).toContain(
      '<button type="button" disabled="">Geometry</button>'
    );
    expect(markup).toContain(
      '<button type="button" disabled="">Status</button>'
    );
    expect(canNavigateSketchDockSectionV19("constraints", true)).toBe(true);
    expect(canNavigateSketchDockSectionV19("geometry", true)).toBe(false);
  });

  it("maps all registry-owned dimension and constraint actions to collectors", () => {
    expect(
      [
        "rectangleWidth",
        "rectangleHeight",
        "lineLength",
        "radius",
        "diameter",
        "arcSweep",
        "pointDistance",
        "horizontalDistance",
        "verticalDistance",
        "pointLineDistance",
        "lineAngle"
      ].map((_, index) =>
        getRequestedDimensionFamily(
          [
            "sketch.rectangle-width",
            "sketch.rectangle-height",
            "sketch.line-length",
            "sketch.radius",
            "sketch.diameter",
            "sketch.arc-sweep",
            "sketch.point-distance",
            "sketch.horizontal-distance",
            "sketch.vertical-distance",
            "sketch.point-line-distance",
            "sketch.line-angle"
          ][index] as Parameters<typeof getRequestedDimensionFamily>[0]
        )
      )
    ).toEqual([
      "rectangleWidth",
      "rectangleHeight",
      "lineLength",
      "radius",
      "diameter",
      "arcSweep",
      "pointDistance",
      "horizontalDistance",
      "verticalDistance",
      "pointLineDistance",
      "lineAngle"
    ]);
    expect(
      [
        "sketch.horizontal",
        "sketch.vertical",
        "sketch.fixed",
        "sketch.coincident",
        "sketch.midpoint",
        "sketch.parallel",
        "sketch.perpendicular",
        "sketch.tangent",
        "sketch.concentric",
        "sketch.equal-length",
        "sketch.equal-radius",
        "sketch.symmetry"
      ].map((id) =>
        getRequestedConstraintKind(
          id as Parameters<typeof getRequestedConstraintKind>[0]
        )
      )
    ).toEqual([
      "horizontal",
      "vertical",
      "fixed",
      "coincident",
      "midpoint",
      "parallel",
      "perpendicular",
      "tangent",
      "concentric",
      "equalLength",
      "equalRadius",
      "symmetry"
    ]);
  });

  it("opens the V19 Modify collector only for a registry-owned curve action", () => {
    const trimMarkup = renderToStaticMarkup(
      createElement(
        SketchModeDock,
        props({
          initialActionId: "sketch.trim",
          selectedEntityId: undefined
        })
      )
    );

    expect(trimMarkup).toContain('aria-label="Trim sketch geometry"');
    expect(trimMarkup).toContain("Choose the curve to edit");
    expect(trimMarkup).toContain("Choose target…");
    expect(trimMarkup).toContain("Complete the edit choices");
    expect(trimMarkup).not.toContain("Offset");
  });

  it("opens the V19 Offset and convenience command editors from registry actions", () => {
    const offset = renderToStaticMarkup(
      createElement(
        SketchModeDock,
        props({
          initialActionId: "sketch.offset",
          selectedEntityId: undefined
        })
      )
    );
    const slot = renderToStaticMarkup(
      createElement(SketchModeDock, props({ initialActionId: "sketch.slot" }))
    );
    const rounded = renderToStaticMarkup(
      createElement(
        SketchModeDock,
        props({ initialActionId: "sketch.rounded-rectangle" })
      )
    );

    expect(offset).toContain('aria-label="Offset sketch geometry"');
    expect(slot).toContain('aria-label="Create Slot"');
    expect(rounded).toContain('aria-label="Create Rounded Rectangle"');
  });
});

function props(
  overrides: Partial<SketchModeDockProps> = {}
): SketchModeDockProps {
  const sketches: readonly SketchSnapshot[] = [
    {
      id: "sketch-a",
      name: "Base profile",
      plane: "XY",
      entities: [
        {
          id: "rect-a",
          kind: "rectangle",
          center: [0, 0],
          width: 12,
          height: 8,
          construction: false
        }
      ]
    }
  ];
  return {
    disabled: false,
    sketches,
    parameters: [],
    dimensionsBySketchId: new Map([["sketch-a", []]]),
    evaluationsBySketchId: new Map(),
    solverStatusesBySketchId: new Map(),
    activeSketchId: "sketch-a",
    selectedEntityId: "rect-a",
    curveEditSourceAuthorityKey: 1,
    onSelectSketch: vi.fn(),
    onSelectEntity: vi.fn(),
    onCreateSketch: vi.fn(),
    onAddEntity: vi.fn(),
    onUpdateEntity: vi.fn(),
    onDeleteEntity: vi.fn(),
    onSetEntityConstruction: vi.fn(),
    onStartThreePointArcTool: vi.fn(),
    onCancelGesture: vi.fn(),
    onReadCurveEditReadiness: vi.fn(
      (): SketchCurveEditReadinessQueryResponse => ({
        ok: true,
        query: "sketch.curveEditReadiness",
        cadOpsVersion: "cadops.v1",
        status: "blocked",
        diagnostics: []
      })
    ),
    onApplyCurveEdit: vi.fn(),
    onApplySketchConvenience: vi.fn(),
    onCancelCurveEdit: vi.fn(),
    onApplySketchIntentOps: vi.fn(() => true),
    onFinish: vi.fn(),
    ...overrides
  };
}
