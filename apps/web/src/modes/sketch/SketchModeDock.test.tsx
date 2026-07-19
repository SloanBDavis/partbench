import type { SketchSnapshot } from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SketchModeDock, type SketchModeDockProps } from "./SketchModeDock";

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
    onSelectSketch: vi.fn(),
    onSelectEntity: vi.fn(),
    onCreateSketch: vi.fn(),
    onAddEntity: vi.fn(),
    onUpdateEntity: vi.fn(),
    onDeleteEntity: vi.fn(),
    onSetEntityConstruction: vi.fn(),
    onStartThreePointArcTool: vi.fn(),
    onCancelGesture: vi.fn(),
    onCreateDimension: vi.fn(),
    onApplyDimensionEdit: vi.fn(),
    onDeleteDimension: vi.fn(),
    onCreateConstraint: vi.fn(),
    onApplyConstraintEdit: vi.fn(),
    onDeleteConstraint: vi.fn(),
    onFinish: vi.fn(),
    ...overrides
  };
}
