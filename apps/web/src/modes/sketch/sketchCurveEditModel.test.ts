import type {
  SketchCurveEditImpact,
  SketchCurveEditProposal,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";
import {
  applySketchCurveEditViewportChoice,
  buildSketchCurveEditProposal,
  createSketchCurveEditDraft,
  createSketchCurveEditReadinessAuthorityKey,
  createSketchCurveEditPreviewDraft,
  createSketchExtendHitChoices,
  createSketchTrimIntervalChoices,
  discoverSketchExtendHitChoices,
  formatCurveEditDiagnostic,
  getCurveEditKeyboardCommand,
  getSketchCurveEditEscapeAction,
  getSketchEntityDiscoveryWitnessPoints,
  getSketchEntitySemanticLabel,
  hasCollectedSketchCurveEditChoices,
  projectSketchCurveEditReadiness,
  summarizeCurveEditImpact
} from "./sketchCurveEditModel";
import {
  createSketchCurveEditHoverSemanticKey,
  shouldPublishSketchCurveEditHover
} from "./sketchCurveEditHoverScheduler";
import {
  getActiveCurveEditInvocationAction,
  getCurveEditSketchSelectionAction
} from "./sketchCurveEditOwnership";

describe("V19 sketch curve-edit draft model", () => {
  it("collects an exact trim target, boundary set, and interval point", () => {
    const sketch = createSketch();
    let draft = createSketchCurveEditDraft("trim", sketch, "line-target");

    expect(draft).toMatchObject({
      targetEntityId: "line-target",
      collector: "boundaries",
      boundaryEntityIds: []
    });
    expect(draft.pickPoint).toBeUndefined();

    draft = applySketchCurveEditViewportChoice(
      draft,
      { sequence: 1, entityId: "line-boundary" },
      sketch
    );
    draft = applySketchCurveEditViewportChoice(
      { ...draft, collector: "pick" },
      { sequence: 2, point: [3, 0] },
      sketch
    );

    expect(buildSketchCurveEditProposal(sketch.id, draft)).toEqual({
      kind: "trim",
      sketchId: "sketch-a",
      entityId: "line-target",
      boundaryEntityIds: ["line-boundary"],
      pickPoint: [3, 0]
    });
  });

  it("keeps target and boundary semantics explicit for pointer collection", () => {
    const sketch = createSketch();
    const initial = createSketchCurveEditDraft("extend", sketch, "line-target");
    const boundary = applySketchCurveEditViewportChoice(
      initial,
      { sequence: 1, entityId: "line-boundary" },
      sketch
    );
    const toggledOff = applySketchCurveEditViewportChoice(
      boundary,
      { sequence: 2, entityId: "line-boundary" },
      sketch
    );
    const wrongTarget = applySketchCurveEditViewportChoice(
      { ...initial, collector: "target" },
      { sequence: 3, entityId: "rect-target" },
      sketch
    );

    expect(boundary.boundaryEntityIds).toEqual(["line-boundary"]);
    expect(toggledOff.boundaryEntityIds).toEqual([]);
    expect(wrongTarget.targetEntityId).toBe("line-target");
    expect(buildSketchCurveEditProposal(sketch.id, boundary)).toBeUndefined();
  });

  it("shows the committed boundary immediately after hover-then-click clears hover", () => {
    const sketch = createSketch();
    const initial = createSketchCurveEditDraft("trim", sketch, "line-target");
    const choice = {
      sequence: 1,
      entityId: "line-boundary"
    } as const;
    const hoverPreview = createSketchCurveEditPreviewDraft(
      initial,
      choice,
      sketch
    );
    const committed = applySketchCurveEditViewportChoice(
      initial,
      choice,
      sketch
    );

    expect(hoverPreview.boundaryEntityIds).toEqual(["line-boundary"]);
    expect(
      createSketchCurveEditPreviewDraft(committed, undefined, sketch)
        .boundaryEntityIds
    ).toEqual(["line-boundary"]);
  });

  it("does not guess a target, trim interval, or extend endpoint", () => {
    const sketch = createSketch();
    const trim = createSketchCurveEditDraft("trim", sketch);
    const extend = createSketchCurveEditDraft("extend", sketch);

    expect(trim).toMatchObject({
      targetEntityId: "",
      collector: "target"
    });
    expect(trim.pickPoint).toBeUndefined();
    expect(extend).toMatchObject({
      targetEntityId: "",
      collector: "target"
    });
    expect(extend.endpoint).toBeUndefined();
    expect(buildSketchCurveEditProposal(sketch.id, trim)).toBeUndefined();
    expect(buildSketchCurveEditProposal(sketch.id, extend)).toBeUndefined();
  });

  it("collects keyboard-entered and viewport split points without duplicates", () => {
    const sketch = createSketch();
    const initial = createSketchCurveEditDraft("split", sketch, "line-target");
    const first = applySketchCurveEditViewportChoice(
      initial,
      { sequence: 1, point: [2, 0] },
      sketch
    );
    const duplicate = applySketchCurveEditViewportChoice(
      first,
      { sequence: 2, point: [2, 0] },
      sketch
    );

    expect(buildSketchCurveEditProposal(sketch.id, duplicate)).toEqual({
      kind: "split",
      sketchId: "sketch-a",
      entityId: "line-target",
      splitPoints: [[2, 0]]
    });
  });

  it("treats an edited pending split point as dirty before it is added", () => {
    const sketch = createSketch();
    const initial = createSketchCurveEditDraft("split", sketch, "line-target");

    expect(hasCollectedSketchCurveEditChoices(initial, initial)).toBe(false);
    expect(
      hasCollectedSketchCurveEditChoices(
        {
          ...initial,
          pendingSplitPoint: [initial.pendingSplitPoint[0] + 1, 0]
        },
        initial
      )
    ).toBe(true);
  });

  it("supports keyboard-complete apply/cancel and collector progression", () => {
    expect(getCurveEditKeyboardCommand({ key: "Escape" })).toBe("cancel");
    expect(getCurveEditKeyboardCommand({ key: "Enter", ctrlKey: true })).toBe(
      "apply"
    );
    expect(getCurveEditKeyboardCommand({ key: "Enter", metaKey: true })).toBe(
      "apply"
    );
    expect(getCurveEditKeyboardCommand({ key: "Enter" })).toBe(
      "next-collector"
    );
    expect(getCurveEditKeyboardCommand({ key: "Tab" })).toBeUndefined();
    expect(getSketchCurveEditEscapeAction(false)).toBe("cancel");
    expect(getSketchCurveEditEscapeAction(true)).toBe("guard");
  });

  it("focuses a re-invoked active tool without resetting its dirty draft", () => {
    expect(
      getActiveCurveEditInvocationAction({
        curveEditorActive: true,
        dirty: true,
        activeActionId: "sketch.trim",
        invokedActionId: "sketch.trim"
      })
    ).toBe("focus-existing");
    expect(
      getActiveCurveEditInvocationAction({
        curveEditorActive: true,
        dirty: true,
        activeActionId: "sketch.trim",
        invokedActionId: "sketch.split"
      })
    ).toBe("guard-navigation");
  });

  it("guards only cross-sketch selection that would replace a dirty editor", () => {
    expect(
      getCurveEditSketchSelectionAction({
        curveEditorActive: true,
        dirty: true,
        currentSketchId: "sketch-a",
        nextSketchId: "sketch-a"
      })
    ).toBe("select-in-place");
    expect(
      getCurveEditSketchSelectionAction({
        curveEditorActive: true,
        dirty: true,
        currentSketchId: "sketch-a",
        nextSketchId: "sketch-b"
      })
    ).toBe("guard-selection");
    expect(
      getCurveEditSketchSelectionAction({
        curveEditorActive: true,
        dirty: false,
        currentSketchId: "sketch-a",
        nextSketchId: "sketch-b"
      })
    ).toBe("close-and-select");
  });

  it("uses semantic labels and safe human copy outside technical details", () => {
    const sketch = createSketch();
    expect(getSketchEntitySemanticLabel(sketch.entities[0]!, sketch)).toBe(
      "Line 1"
    );
    expect(
      formatCurveEditDiagnostic({
        code: "SKETCH_EDIT_INVALID_PROPOSAL",
        severity: "blocker",
        message: "raw internal entity line-target parameter 0.123",
        sketchId: sketch.id
      })
    ).toBe(
      "One or more edit choices are invalid. Review the highlighted inputs."
    );
  });

  it("summarizes every impact category before apply", () => {
    const impact: SketchCurveEditImpact = {
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
      constraintImpacts: [],
      dimensionImpacts: [],
      requiredDeleteConstraintIds: [],
      requiredDeleteDimensionIds: [],
      affectedFeatureIds: ["feature-a"],
      postEditSolverStatus: "under-defined"
    };

    expect(summarizeCurveEditImpact(impact)).toEqual([
      "1 geometry replacement",
      "0 constraints retargeted",
      "0 constraints must be removed",
      "0 dimensions retargeted",
      "0 dimensions must be removed",
      "1 downstream feature affected",
      "Post-edit solver: under-defined"
    ]);
  });

  it("never grants apply authority to a transient hover readiness result", () => {
    const hoverReady = {
      ok: true,
      query: "sketch.curveEditReadiness",
      cadOpsVersion: "cadops.v1",
      status: "ready",
      preparedOperation: {
        op: "sketch.explodeRectangle",
        sketchId: "sketch-a",
        precondition: {
          expectedSourceRevision: `partbench-source-v1:${"a".repeat(64)}`,
          expectedSolverEvaluationIdentity: "none"
        },
        entityId: "rect-target",
        lineEntityIds: ["line-1", "line-2", "line-3", "line-4"],
        deleteConstraintIds: [],
        deleteDimensionIds: []
      },
      impact: {
        sketchId: "sketch-a",
        operation: "explodeRectangle",
        replacements: [],
        constraintImpacts: [],
        dimensionImpacts: [],
        requiredDeleteConstraintIds: [],
        requiredDeleteDimensionIds: [],
        affectedFeatureIds: [],
        postEditSolverStatus: "under-defined"
      },
      preview: {
        intersections: [],
        projectedSplitParameters: [],
        resultEntityCount: 4,
        resultEntities: []
      },
      diagnostics: []
    } as const;

    expect(projectSketchCurveEditReadiness(undefined, hoverReady)).toEqual({
      displayReadiness: hoverReady,
      displayingHoverPreview: true
    });
    const committedReady = {
      ...hoverReady,
      preparedOperation: {
        ...hoverReady.preparedOperation,
        entityId: "rect-committed"
      }
    };
    expect(projectSketchCurveEditReadiness(committedReady, hoverReady)).toEqual(
      {
        displayReadiness: hoverReady,
        displayingHoverPreview: true
      }
    );
  });

  it("invalidates committed and hover readiness for source or retry changes", () => {
    const initial = createSketchCurveEditReadinessAuthorityKey("source-a", 0);
    expect(createSketchCurveEditReadinessAuthorityKey("source-b", 0)).not.toBe(
      initial
    );
    expect(createSketchCurveEditReadinessAuthorityKey("source-a", 1)).not.toBe(
      initial
    );
  });

  it("builds keyboard trim intervals and extend hits from query preview evidence", () => {
    const sketch = createSketch();
    const preview = {
      intersections: [
        {
          boundaryEntityId: "line-boundary",
          point: [5, 0] as const,
          targetParameter: 5
        }
      ],
      projectedSplitParameters: [],
      resultEntityCount: 1,
      resultEntities: []
    };

    expect(
      createSketchTrimIntervalChoices(sketch.entities[0]!, preview, sketch)
    ).toEqual([
      expect.objectContaining({
        label: "Interval 1 · Line 2",
        witnessPoint: [2.5, 0],
        boundaryEntityIds: ["line-boundary"]
      }),
      expect.objectContaining({
        label: "Interval 2 · Line 2",
        witnessPoint: [7.5, 0],
        boundaryEntityIds: ["line-boundary"]
      })
    ]);
    expect(createSketchExtendHitChoices("end", preview, sketch)).toEqual([
      expect.objectContaining({
        label: "End endpoint → Line 2 at (5, 0)",
        endpoint: "end",
        boundaryEntityId: "line-boundary",
        hitPoint: [5, 0]
      })
    ]);
  });

  it("uses bounded non-intersection discovery witnesses for lines and circles", () => {
    const sketch = createSketch();
    const lineWitnesses = getSketchEntityDiscoveryWitnessPoints(
      sketch.entities[0]!
    );
    expect(lineWitnesses).toHaveLength(3);
    expect(lineWitnesses[0]![0]).not.toBe(5);
    expect(lineWitnesses[1]).toEqual([5, 0]);

    const circleWitnesses = getSketchEntityDiscoveryWitnessPoints({
      id: "circle-target",
      kind: "circle",
      center: [2, 3],
      radius: 4,
      construction: false
    });
    expect(circleWitnesses).toHaveLength(5);
    expect(circleWitnesses[0]).toEqual([6, 3]);
    expect(circleWitnesses[1]![0]).toBeCloseTo(2);
    expect(circleWitnesses[1]![1]).toBeCloseTo(7);
    expect(circleWitnesses[2]![0]).toBeCloseTo(-2);
    expect(circleWitnesses[2]![1]).toBeCloseTo(3);
    expect(circleWitnesses[3]![0]).toBeCloseTo(2);
    expect(circleWitnesses[3]![1]).toBeCloseTo(-1);
    expect(circleWitnesses[4]).not.toEqual(circleWitnesses[0]);
  });

  it("builds arc and circle-seam intervals with model-space witnesses", () => {
    const sketch = createSketch();
    const arc = {
      id: "arc-target",
      kind: "arc",
      center: [0, 0],
      radius: 10,
      startAngleDegrees: 0,
      sweepAngleDegrees: 90,
      construction: false
    } as const;
    const arcChoices = createSketchTrimIntervalChoices(
      arc,
      {
        intersections: [
          {
            boundaryEntityId: "line-boundary",
            point: [8.66, 5],
            targetParameter: 30
          },
          {
            boundaryEntityId: "line-boundary",
            point: [5, 8.66],
            targetParameter: 60
          }
        ],
        projectedSplitParameters: [],
        resultEntityCount: 1,
        resultEntities: []
      },
      sketch
    );
    expect(
      arcChoices.map(({ startParameter, endParameter }) => [
        startParameter,
        endParameter
      ])
    ).toEqual([
      [0, 30],
      [30, 60],
      [60, 90]
    ]);
    expect(arcChoices[1]!.witnessPoint[0]).toBeCloseTo(Math.sqrt(50));
    expect(arcChoices[1]!.witnessPoint[1]).toBeCloseTo(Math.sqrt(50));

    const circleChoices = createSketchTrimIntervalChoices(
      {
        id: "circle-target",
        kind: "circle",
        center: [0, 0],
        radius: 10,
        construction: false
      },
      {
        intersections: [
          {
            boundaryEntityId: "line-boundary",
            point: [9.85, -1.74],
            targetParameter: 350
          },
          {
            boundaryEntityId: "line-boundary",
            point: [9.85, 1.74],
            targetParameter: 10
          }
        ],
        projectedSplitParameters: [],
        resultEntityCount: 1,
        resultEntities: []
      },
      sketch
    );
    expect(
      circleChoices.map(({ startParameter, endParameter }) => [
        startParameter,
        endParameter
      ])
    ).toEqual([
      [10, 350],
      [350, 370]
    ]);
    expect(circleChoices[0]!.witnessPoint[0]).toBeCloseTo(-10);
    expect(circleChoices[1]!.witnessPoint[0]).toBeCloseTo(10);
  });

  it("does not offer an unready full-turn interval for one circle tangent", () => {
    const sketch = createSketch();
    expect(
      createSketchTrimIntervalChoices(
        {
          id: "circle-target",
          kind: "circle",
          center: [0, 0],
          radius: 10,
          construction: false
        },
        {
          intersections: [
            {
              boundaryEntityId: "line-boundary",
              point: [10, 0],
              targetParameter: 0
            }
          ],
          projectedSplitParameters: [],
          resultEntityCount: 0,
          resultEntities: []
        },
        sketch
      )
    ).toEqual([]);
  });

  it("keeps near and far extend hits as distinct query-derived choices", () => {
    const sketch = createSketch();
    const choices = [
      ...createSketchExtendHitChoices(
        "end",
        {
          intersections: [
            {
              boundaryEntityId: "line-boundary",
              point: [5, 0],
              targetParameter: 5
            }
          ],
          projectedSplitParameters: [],
          resultEntityCount: 1,
          resultEntities: []
        },
        sketch
      ),
      ...createSketchExtendHitChoices(
        "end",
        {
          intersections: [
            {
              boundaryEntityId: "line-far",
              point: [12, 0],
              targetParameter: 12
            }
          ],
          projectedSplitParameters: [],
          resultEntityCount: 1,
          resultEntities: []
        },
        sketch
      )
    ];
    expect(choices.map((choice) => choice.hitPoint)).toEqual([
      [5, 0],
      [12, 0]
    ]);
    expect(new Set(choices.map((choice) => choice.key)).size).toBe(2);
  });

  it("offers only the nearest command-selectable hit for one circle boundary", () => {
    const sketch = createSketch();
    const target = sketch.entities[0] as Extract<
      SketchSnapshot["entities"][number],
      { readonly kind: "line" | "arc" }
    >;
    const choices = createSketchExtendHitChoices(
      "end",
      {
        intersections: [
          {
            boundaryEntityId: "circle-boundary",
            point: [12, 0],
            targetParameter: 12
          },
          {
            boundaryEntityId: "circle-boundary",
            point: [20, 0],
            targetParameter: 20
          }
        ],
        projectedSplitParameters: [],
        resultEntityCount: 1,
        resultEntities: []
      },
      sketch,
      target
    );

    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({
      endpoint: "end",
      boundaryEntityId: "circle-boundary",
      hitPoint: [12, 0]
    });
  });

  it("discovers all extend hits with exactly one full-boundary query per endpoint", () => {
    const sketch = createSketch();
    const readReadiness = vi.fn((proposal: SketchCurveEditProposal) => ({
      ok: true as const,
      query: "sketch.curveEditReadiness" as const,
      cadOpsVersion: "cadops.v1" as const,
      status: "blocked" as const,
      diagnostics: [],
      preview: {
        intersections: [
          {
            boundaryEntityId: "line-boundary",
            point:
              proposal.kind === "extend" && proposal.endpoint === "start"
                ? ([-2, 0] as const)
                : ([12, 0] as const),
            targetParameter:
              proposal.kind === "extend" && proposal.endpoint === "start"
                ? -2
                : 12
          }
        ],
        projectedSplitParameters: [],
        resultEntityCount: 1,
        resultEntities: []
      }
    }));

    const choices = discoverSketchExtendHitChoices({
      sketch,
      target: sketch.entities[0] as Extract<
        SketchSnapshot["entities"][number],
        { readonly kind: "line" | "arc" }
      >,
      boundaryEntityIds: ["line-boundary", "line-far"],
      readReadiness
    });

    expect(readReadiness).toHaveBeenCalledTimes(2);
    expect(readReadiness.mock.calls.map(([proposal]) => proposal)).toEqual([
      expect.objectContaining({
        endpoint: "start",
        boundaryEntityIds: ["line-boundary", "line-far"]
      }),
      expect.objectContaining({
        endpoint: "end",
        boundaryEntityIds: ["line-boundary", "line-far"]
      })
    ]);
    expect(choices.map((choice) => choice.hitPoint)).toEqual([
      [-2, 0],
      [12, 0]
    ]);
  });

  it("bounds hover publication by semantic quantization and time", () => {
    const firstKey = createSketchCurveEditHoverSemanticKey({
      entityId: "line-target",
      point: [1.001, 2.001]
    });
    const sameBucket = createSketchCurveEditHoverSemanticKey({
      entityId: "line-target",
      point: [1.009, 2.009]
    });
    const nextBucket = createSketchCurveEditHoverSemanticKey({
      entityId: "line-target",
      point: [1.1, 2.1]
    });

    expect(firstKey).toBe(sameBucket);
    expect(
      shouldPublishSketchCurveEditHover({ publishedAt: 0 }, firstKey, 1)
    ).toBe(true);
    expect(
      shouldPublishSketchCurveEditHover(
        { semanticKey: firstKey, publishedAt: 1 },
        firstKey,
        100
      )
    ).toBe(false);
    expect(
      shouldPublishSketchCurveEditHover(
        { semanticKey: firstKey, publishedAt: 1 },
        nextBucket,
        25
      )
    ).toBe(false);
    expect(
      shouldPublishSketchCurveEditHover(
        { semanticKey: firstKey, publishedAt: 1 },
        nextBucket,
        55
      )
    ).toBe(true);
  });
});

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
