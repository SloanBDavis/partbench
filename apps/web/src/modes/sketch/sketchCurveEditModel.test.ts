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
  discoverSketchExtendHitChoicesAsync,
  discoverSketchTrimIntervalChoicesAsync,
  formatCurveEditDiagnostic,
  getCurveEditKeyboardCommand,
  getSketchCurveEditEscapeAction,
  getSketchOffsetSideChoices,
  getSketchEntityDiscoveryWitnessPoints,
  getSketchEntitySemanticLabel,
  hasCollectedSketchCurveEditChoices,
  projectSketchCurveEditReadiness,
  summarizeCurveEditImpact
} from "./sketchCurveEditModel";
import type { SketchCurveEditDraft } from "./sketchCurveEditModel";
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

  it("builds an explicit individual offset with deterministic model-space side evidence", () => {
    const sketch = createSketch();
    const initial = createSketchCurveEditDraft("offset", sketch, "line-target");
    const left = getSketchOffsetSideChoices(initial, sketch)[0]!;
    const draft = {
      ...initial,
      offsetSide: left.side,
      offsetUseReferencePoint: true,
      offsetReferencePoint: left.witnessPoint
    };

    expect(left).toEqual({ side: "left", witnessPoint: [5, 1] });
    expect(buildSketchCurveEditProposal(sketch.id, draft)).toEqual({
      kind: "offset",
      sketchId: "sketch-a",
      source: { kind: "entity", entityId: "line-target" },
      distance: 1,
      side: "left",
      referencePoint: [5, 1]
    });
  });

  it("collects an ordered oriented offset chain and exact viewport witness", () => {
    const sketch = createSketch();
    let draft: SketchCurveEditDraft = {
      ...createSketchCurveEditDraft("offset", sketch),
      offsetSourceMode: "chain" as const,
      collector: "chain" as const
    };
    draft = applySketchCurveEditViewportChoice(
      draft,
      { sequence: 1, entityId: "line-target" },
      sketch
    );
    draft = applySketchCurveEditViewportChoice(
      draft,
      { sequence: 2, entityId: "line-boundary" },
      sketch
    );
    draft = {
      ...draft,
      offsetSegments: [
        draft.offsetSegments[0]!,
        { ...draft.offsetSegments[1]!, orientation: "reverse" as const }
      ],
      offsetSide: "right",
      offsetUseReferencePoint: true,
      collector: "witness"
    };
    draft = applySketchCurveEditViewportChoice(
      draft,
      { sequence: 3, point: [4.25, 2.5] },
      sketch
    );

    expect(buildSketchCurveEditProposal(sketch.id, draft)).toEqual({
      kind: "offset",
      sketchId: "sketch-a",
      source: {
        kind: "chain",
        segments: [
          { entityId: "line-target", orientation: "forward" },
          { entityId: "line-boundary", orientation: "reverse" }
        ],
        closed: false
      },
      distance: 1,
      side: "right",
      referencePoint: [4.25, 2.5]
    });
  });

  it("keeps closed-chain inward and outward witnesses correct across winding reversal", () => {
    const sketch: SketchSnapshot = {
      id: "closed-sketch",
      name: "Closed chain",
      plane: "XY",
      entities: [
        line("bottom", [-2, -2], [2, -2]),
        line("right", [2, -2], [2, 2]),
        line("top", [2, 2], [-2, 2]),
        line("left", [-2, 2], [-2, -2])
      ]
    };
    const base = {
      ...createSketchCurveEditDraft("offset", sketch),
      offsetSourceMode: "chain" as const,
      offsetClosed: true
    };
    const counterClockwise: SketchCurveEditDraft = {
      ...base,
      offsetSegments: ["bottom", "right", "top", "left"].map((entityId) => ({
        entityId,
        orientation: "forward" as const
      }))
    };
    const clockwise: SketchCurveEditDraft = {
      ...base,
      offsetSegments: ["bottom", "left", "top", "right"].map((entityId) => ({
        entityId,
        orientation: "reverse" as const
      }))
    };

    for (const draft of [counterClockwise, clockwise]) {
      expect(getSketchOffsetSideChoices(draft, sketch)).toEqual([
        { side: "inward", witnessPoint: [0, -1] },
        { side: "outward", witnessPoint: [0, -3] }
      ]);
    }
  });

  it("keeps translated closed-line-chain winding representable", () => {
    const origin = 1e16;
    const sketch: SketchSnapshot = {
      id: "translated-closed-sketch",
      name: "Translated closed chain",
      plane: "XY",
      entities: [
        line("bottom", [origin, origin], [origin + 4, origin]),
        line("right", [origin + 4, origin], [origin + 4, origin + 4]),
        line("top", [origin + 4, origin + 4], [origin, origin + 4]),
        line("left", [origin, origin + 4], [origin, origin])
      ]
    };
    const draft: SketchCurveEditDraft = {
      ...createSketchCurveEditDraft("offset", sketch),
      offsetSourceMode: "chain",
      offsetClosed: true,
      offsetDistance: 2,
      offsetSegments: ["bottom", "right", "top", "left"].map((entityId) => ({
        entityId,
        orientation: "forward" as const
      }))
    };

    expect(getSketchOffsetSideChoices(draft, sketch)).toEqual([
      {
        side: "inward",
        witnessPoint: [origin + 2, origin + 2]
      },
      {
        side: "outward",
        witnessPoint: [origin + 2, origin - 2]
      }
    ]);
  });

  it("keeps inward arc-chain witnesses correct for reversed traversal", () => {
    const sketch: SketchSnapshot = {
      id: "closed-arc-sketch",
      name: "Closed arc chain",
      plane: "XY",
      entities: [arc("upper", 0, 180), arc("lower", 180, 180)]
    };
    const forward: SketchCurveEditDraft = {
      ...createSketchCurveEditDraft("offset", sketch),
      offsetSourceMode: "chain",
      offsetClosed: true,
      offsetSegments: ["upper", "lower"].map((entityId) => ({
        entityId,
        orientation: "forward" as const
      }))
    };
    const reverse: SketchCurveEditDraft = {
      ...forward,
      offsetSegments: ["lower", "upper"].map((entityId) => ({
        entityId,
        orientation: "reverse" as const
      }))
    };

    const forwardInward = getSketchOffsetSideChoices(forward, sketch)[0];
    expect(forwardInward?.side).toBe("inward");
    expect(forwardInward?.witnessPoint?.[0]).toBeCloseTo(0);
    expect(forwardInward?.witnessPoint?.[1]).toBeCloseTo(1);

    const reverseInward = getSketchOffsetSideChoices(reverse, sketch)[0];
    expect(reverseInward?.side).toBe("inward");
    expect(reverseInward?.witnessPoint?.[0]).toBeCloseTo(0);
    expect(reverseInward?.witnessPoint?.[1]).toBeCloseTo(-1);
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
    expect(
      formatCurveEditDiagnostic({
        code: "SKETCH_OFFSET_SELF_INTERSECTION",
        severity: "blocker",
        message: "raw segment pair 2:7",
        sketchId: sketch.id
      })
    ).toBe(
      "This offset would cross or overlap itself. Choose another distance or side."
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

  it("discovers trim choices asynchronously with the caller's cancellation signal", async () => {
    const sketch = createSketch();
    const controller = new AbortController();
    const readReadiness = vi.fn(
      async (proposal: SketchCurveEditProposal, signal: AbortSignal) => {
        void proposal;
        void signal;
        return {
          ok: true as const,
          query: "sketch.curveEditReadiness" as const,
          cadOpsVersion: "cadops.v1" as const,
          status: "blocked" as const,
          diagnostics: [],
          preview: {
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
          }
        };
      }
    );

    const choices = await discoverSketchTrimIntervalChoicesAsync({
      sketch,
      target: sketch.entities[0] as Extract<
        SketchSnapshot["entities"][number],
        { readonly kind: "line" }
      >,
      boundaryEntityIds: ["line-boundary"],
      readReadiness,
      signal: controller.signal
    });

    expect(choices).toHaveLength(2);
    expect(readReadiness).toHaveBeenCalledTimes(1);
    expect(readReadiness.mock.calls[0]?.[1]).toBe(controller.signal);
  });

  it("stops asynchronous extend discovery after cancellation", async () => {
    const sketch = createSketch();
    const controller = new AbortController();
    const readReadiness = vi.fn(
      async (proposal: SketchCurveEditProposal, signal: AbortSignal) => {
        void proposal;
        void signal;
        controller.abort();
        return {
          ok: true as const,
          query: "sketch.curveEditReadiness" as const,
          cadOpsVersion: "cadops.v1" as const,
          status: "blocked" as const,
          diagnostics: []
        };
      }
    );

    await expect(
      discoverSketchExtendHitChoicesAsync({
        sketch,
        target: sketch.entities[0] as Extract<
          SketchSnapshot["entities"][number],
          { readonly kind: "line" }
        >,
        boundaryEntityIds: ["line-boundary"],
        readReadiness,
        signal: controller.signal
      })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(readReadiness).toHaveBeenCalledTimes(1);
    expect(readReadiness.mock.calls[0]?.[1]).toBe(controller.signal);
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

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number]
): SketchSnapshot["entities"][number] {
  return {
    id,
    kind: "line",
    start,
    end,
    construction: false
  };
}

function arc(
  id: string,
  startAngleDegrees: number,
  sweepAngleDegrees: number
): SketchSnapshot["entities"][number] {
  return {
    id,
    kind: "arc",
    center: [0, 0],
    radius: 2,
    startAngleDegrees,
    sweepAngleDegrees,
    construction: false
  };
}
