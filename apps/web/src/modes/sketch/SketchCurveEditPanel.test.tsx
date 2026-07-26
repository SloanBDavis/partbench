import type {
  SketchCurveEditReadinessQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  commitSketchCurveEditDraftChange,
  handleSketchCurveEditWindowShortcut
} from "./sketchCurveEditModel";
import {
  SketchCurveEditPanel,
  type SketchCurveEditPanelProps
} from "./SketchCurveEditPanel";

describe("V19 Sketch Modify editor", () => {
  it("renders a keyboard-complete trim collector with human visible copy", () => {
    const markup = render(
      props({
        readReadiness: () => blockedReadiness()
      })
    );

    expect(markup).toContain('aria-label="Trim sketch geometry"');
    expect(markup).toContain("Collect target");
    expect(markup).toContain("Collect boundaries");
    expect(markup).toContain("Collect removal point");
    expect(markup).toContain("Line 1");
    expect(markup).toContain("Line 2");
    expect(markup).toContain("Point on interval to remove");
    expect(markup).toContain("Escape cancels without changing the sketch");
    expect(markup).toContain("data-drawer-initial-focus");
    expect(markup).toContain('class="pb-curve-edit__scroll"');
    expect(markup).toContain('<footer class="pb-curve-edit__footer">');
    expect(markup).toContain(
      'class="pb-sketch-actions pb-curve-edit__actions"'
    );
    expect(markup).toContain("Complete the edit choices");
    expect(markup).not.toContain("raw line-target parameter");
  });

  it("shows complete ready geometry and consequence preview copy", () => {
    const markup = render(
      props({
        kind: "explodeRectangle",
        selectedEntityId: "rect-target",
        readReadiness: () => readyReadiness()
      })
    );

    expect(markup).toContain("Ready to apply");
    expect(markup).toContain("Geometry preview");
    expect(markup).toContain("1 result entity");
    expect(markup).toContain("Line 2 at (5, 0)");
    expect(markup).toContain("Consequences");
    expect(markup).toContain("Line 1: modified → Line 1 (identity preserved)");
    expect(markup).toContain(
      "Keep horizontal: retargeted to the replacement geometry"
    );
    expect(markup).toContain("horizontal on Line 1 → horizontal on Line 2");
    expect(markup).toContain("Remove length: must be removed");
    expect(markup).toContain("length on Line 1 → removed");
    expect(markup).toContain("Post-edit solver: under-defined");
    expect(markup).toContain("Constraint constraint-horizontal: distance 0");
    expect(markup).toContain("Dimension dimension-length: distance 0.25");
    expect(markup).toContain("feature-downstream");
    expect(markup).toContain("Apply Explode Rectangle");
    expect(markup).toContain("one undoable transaction");
    expect(markup).not.toContain("Offset");
  });

  it("uses safe visible diagnostics while retaining codes in Technical details", () => {
    const markup = render(
      props({
        kind: "explodeRectangle",
        selectedEntityId: "rect-target",
        readReadiness: () => blockedReadiness()
      })
    );

    expect(markup).toContain(
      "The selected curves do not meet in a usable location."
    );
    expect(markup).toContain("SKETCH_EDIT_INTERSECTION_MISSING");
    expect(markup).toContain("boundaryEntityIds");
    expect(markup).toContain("expected an intersecting boundary");
    expect(markup).toContain("received line-boundary");
    expect(markup).toContain("recovery Choose a boundary");
    expect(markup).toContain("sketch sketch-a");
    expect(markup).toContain("entity line-target");
    expect(markup).not.toContain("raw line-target parameter");
  });

  it("labels blocked intersections as candidate evidence, not zero results", () => {
    const blocked = blockedReadiness();
    const markup = render(
      props({
        kind: "explodeRectangle",
        selectedEntityId: "rect-target",
        readReadiness: () => ({
          ...blocked,
          preview: {
            intersections: [
              {
                boundaryEntityId: "line-boundary",
                point: [5, 0],
                targetParameter: 5
              }
            ],
            projectedSplitParameters: [],
            resultEntityCount: 0,
            resultEntities: []
          }
        })
      })
    );

    expect(markup).toContain("Candidate evidence");
    expect(markup).toContain(
      "Choose an exact interval or finite hit to preview a result."
    );
    expect(markup).not.toContain("0 result entities");
  });

  it("keeps a ready hover preview display-only over a committed ready draft", () => {
    const markup = render(
      props({
        kind: "explodeRectangle",
        selectedEntityId: "rect-target",
        viewportHoverChoice: {
          sequence: 1,
          entityId: "rect-target",
          point: [0, 0]
        },
        readReadiness: () => readyReadiness()
      })
    );

    expect(markup).toContain("Hover preview is active");
    expect(markup).toContain("cannot be applied until the choice is clicked");
    expect(markup).toMatch(
      /<button[^>]*disabled=""[^>]*>Apply Explode Rectangle<\/button>/
    );
  });

  it("renders only the committed Slice B collectors for each tool", () => {
    const extend = render(props({ kind: "extend" }));
    const split = render(props({ kind: "split" }));
    const explode = render(props({ kind: "explodeRectangle" }));

    expect(extend).toContain("Endpoint");
    expect(extend).toContain("Start endpoint");
    expect(split).toContain("Add split point");
    expect(split).toContain("No split points collected");
    expect(explode).toContain("Explode Rectangle");
    for (const markup of [extend, split, explode]) {
      expect(markup).not.toContain("Offset");
      expect(markup).not.toContain("Slot");
      expect(markup).not.toContain("Rounded Rectangle");
    }
  });

  it("clears hover evidence before committing a toggle draft change", () => {
    const order: string[] = [];
    commitSketchCurveEditDraftChange(
      () => order.push("clear-hover"),
      () => order.push("commit-choice")
    );

    expect(order).toEqual(["clear-hover", "commit-choice"]);
  });

  it("does not invoke panel Apply for Ctrl/Cmd+Enter while the guard is open", () => {
    const apply = vi.fn();
    const preventDefault = vi.fn();

    expect(
      handleSketchCurveEditWindowShortcut({
        event: {
          key: "Enter",
          ctrlKey: true,
          preventDefault
        },
        suspended: true,
        dirty: true,
        canApply: true,
        onApply: apply,
        onCancel: vi.fn(),
        onDirtyEscape: vi.fn()
      })
    ).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

function render(propsValue: SketchCurveEditPanelProps): string {
  return renderToStaticMarkup(createElement(SketchCurveEditPanel, propsValue));
}

function props(
  overrides: Partial<SketchCurveEditPanelProps> = {}
): SketchCurveEditPanelProps {
  return {
    disabled: false,
    kind: "trim",
    sketch: createSketch(),
    selectedEntityId: "line-target",
    sourceAuthorityKey: 1,
    readReadiness: () => blockedReadiness(),
    onSelectEntity: vi.fn(),
    onApply: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  };
}

function blockedReadiness(): SketchCurveEditReadinessQueryResponse {
  return {
    ok: true,
    query: "sketch.curveEditReadiness",
    cadOpsVersion: "cadops.v1",
    status: "blocked",
    diagnostics: [
      {
        code: "SKETCH_EDIT_INTERSECTION_MISSING",
        severity: "blocker",
        message: "raw line-target parameter 1.500",
        fieldPath: "boundaryEntityIds",
        expected: "an intersecting boundary",
        received: "line-boundary",
        sketchId: "sketch-a",
        sketchEntityId: "line-target",
        recoveryAction: "Choose a boundary that intersects the target."
      }
    ]
  };
}

function readyReadiness(): SketchCurveEditReadinessQueryResponse {
  return {
    ok: true,
    query: "sketch.curveEditReadiness",
    cadOpsVersion: "cadops.v1",
    status: "ready",
    preparedOperation: {
      op: "sketch.trim",
      sketchId: "sketch-a",
      precondition: {
        expectedSourceRevision: `partbench-source-v1:${"a".repeat(64)}`,
        expectedSolverEvaluationIdentity: "none"
      },
      entityId: "line-target",
      boundaryEntityIds: ["line-boundary"],
      pickPoint: [2, 0],
      createdEntityIds: [],
      deleteConstraintIds: [],
      deleteDimensionIds: []
    },
    impact: {
      sketchId: "sketch-a",
      operation: "trim",
      replacements: [
        {
          sourceEntityId: "line-target",
          disposition: "modified",
          resultEntityIds: ["line-target"],
          preservedResultEntityId: "line-target"
        }
      ],
      constraintImpacts: [
        {
          id: "constraint-horizontal",
          disposition: "retargeted",
          before: {
            id: "constraint-horizontal",
            name: "Keep horizontal",
            sketchId: "sketch-a",
            entityId: "line-target",
            lineEntityId: "line-target",
            kind: "horizontal"
          },
          after: {
            id: "constraint-horizontal",
            name: "Keep horizontal",
            sketchId: "sketch-a",
            entityId: "line-boundary",
            lineEntityId: "line-boundary",
            kind: "horizontal"
          },
          residualFamily: "distance",
          residual: 0
        }
      ],
      dimensionImpacts: [
        {
          id: "dimension-length",
          disposition: "invalid",
          before: {
            id: "dimension-length",
            name: "Remove length",
            sketchId: "sketch-a",
            entityId: "line-target",
            target: {
              entityKind: "line",
              role: "length"
            }
          },
          residualFamily: "distance",
          residual: 0.25
        }
      ],
      requiredDeleteConstraintIds: [],
      requiredDeleteDimensionIds: ["dimension-length"],
      affectedFeatureIds: ["feature-downstream"],
      postEditSolverStatus: "under-defined"
    },
    preview: {
      intersections: [
        {
          boundaryEntityId: "line-boundary",
          point: [5, 0],
          targetParameter: 0.5
        }
      ],
      projectedSplitParameters: [0.5],
      resultEntityCount: 1,
      resultEntities: [
        {
          id: "line-target",
          kind: "line",
          start: [5, 0],
          end: [10, 0],
          construction: false
        }
      ]
    },
    diagnostics: []
  };
}

function createSketch(): SketchSnapshot {
  return {
    id: "sketch-a",
    name: "Edit sketch",
    plane: "XY",
    entities: [
      {
        id: "line-target",
        kind: "line",
        start: [0, 0],
        end: [10, 0],
        construction: false
      },
      {
        id: "line-boundary",
        kind: "line",
        start: [5, -5],
        end: [5, 5],
        construction: false
      },
      {
        id: "rect-target",
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 2,
        construction: false
      }
    ]
  };
}
