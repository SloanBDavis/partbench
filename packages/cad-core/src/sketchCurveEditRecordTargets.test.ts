import { describe, expect, it } from "vitest";

import type {
  SketchConstraintSnapshot,
  SketchDimensionSnapshotV22,
  SketchEntityKind,
  SketchEntityReplacement,
  SketchPointTargetV22
} from "@web-cad/cad-protocol";

import {
  compareSketchCurveEditRecordIds,
  createSketchPointTargetProvenanceKey,
  getSketchConstraintPointTargetProvenanceKeys,
  getSketchConstraintTargetEntityIds,
  getSketchDimensionPointTargetProvenanceKeys,
  getSketchDimensionTargetEntityIds,
  retargetSketchCurveEditConstraint,
  retargetSketchCurveEditDimension,
  sortUniqueSketchCurveEditRecordIds,
  type SketchCurveEditRecordTargetContext
} from "./sketchCurveEditRecordTargets";

const base = {
  id: "constraint-1",
  name: "Constraint 1",
  sketchId: "sketch-1"
} as const;

const sourceKinds = new Map<string, SketchEntityKind>([
  ["arc-a", "arc"],
  ["arc-b", "arc"],
  ["circle-a", "circle"],
  ["circle-b", "circle"],
  ["line-a", "line"],
  ["line-b", "line"],
  ["line-c", "line"],
  ["point-a", "point"],
  ["point-b", "point"],
  ["rectangle-a", "rectangle"]
]);

function replacement(
  sourceEntityId: string,
  resultEntityIds: readonly string[],
  preservedResultEntityId?: string
): SketchEntityReplacement {
  return {
    sourceEntityId,
    disposition:
      preservedResultEntityId === sourceEntityId ? "modified" : "deleted",
    resultEntityIds,
    ...(preservedResultEntityId ? { preservedResultEntityId } : {})
  };
}

function context(
  replacements: readonly SketchEntityReplacement[],
  provenance: readonly [
    SketchPointTargetV22,
    {
      readonly entityId: string;
      readonly entityKind: "line" | "arc";
      readonly role: "start" | "end";
    }
  ][] = [],
  resultKindEntries: readonly (readonly [string, SketchEntityKind])[] = []
): SketchCurveEditRecordTargetContext {
  return {
    replacements,
    endpointProvenance: new Map(
      provenance.map(([source, result]) => [
        createSketchPointTargetProvenanceKey(source),
        result
      ])
    ),
    sourceEntityKinds: sourceKinds,
    resultEntityKinds: new Map([...sourceKinds, ...resultKindEntries])
  };
}

function dimension(
  target: SketchDimensionSnapshotV22["target"]
): SketchDimensionSnapshotV22 {
  return {
    id: "dimension-1",
    name: "Dimension 1",
    sketchId: "sketch-1",
    target,
    valueSource: { type: "literal", value: 10 }
  };
}

describe("sketch curve-edit target enumeration", () => {
  it("sorts and deduplicates by locale-independent code-unit order", () => {
    expect(compareSketchCurveEditRecordIds("Z", "a")).toBeLessThan(0);
    expect(
      sortUniqueSketchCurveEditRecordIds(["ä", "a", "Z", "a", "10", "2"])
    ).toEqual(["10", "2", "Z", "a", "ä"]);
  });

  it("uses a collision-free authored entity-ID and role provenance key", () => {
    expect(
      createSketchPointTargetProvenanceKey({
        entityId: "a:start",
        role: "end"
      })
    ).not.toBe(
      createSketchPointTargetProvenanceKey({
        entityId: "a",
        role: "start"
      })
    );
  });

  it.each([
    [
      "horizontal",
      { ...base, entityId: "line-a", kind: "horizontal" },
      ["line-a"]
    ],
    ["vertical", { ...base, entityId: "line-a", kind: "vertical" }, ["line-a"]],
    [
      "fixed",
      {
        ...base,
        entityId: "line-a",
        kind: "fixed",
        target: { entityId: "line-a", role: "start" },
        coordinate: [0, 0]
      },
      ["line-a"]
    ],
    [
      "coincident",
      {
        ...base,
        entityId: "line-a",
        kind: "coincident",
        primaryTarget: { entityId: "line-a", role: "end" },
        secondaryTarget: { entityId: "line-b", role: "start" }
      },
      ["line-a", "line-b"]
    ],
    [
      "midpoint",
      {
        ...base,
        entityId: "line-a",
        kind: "midpoint",
        lineEntityId: "line-a",
        target: { entityId: "point-a", role: "position" }
      },
      ["line-a", "point-a"]
    ],
    [
      "parallel",
      {
        ...base,
        entityId: "line-b",
        kind: "parallel",
        primaryLineEntityId: "line-a",
        secondaryLineEntityId: "line-b"
      },
      ["line-a", "line-b"]
    ],
    [
      "perpendicular",
      {
        ...base,
        entityId: "line-b",
        kind: "perpendicular",
        primaryLineEntityId: "line-a",
        secondaryLineEntityId: "line-b"
      },
      ["line-a", "line-b"]
    ],
    [
      "equalLength",
      {
        ...base,
        entityId: "line-b",
        kind: "equalLength",
        primaryLineEntityId: "line-a",
        secondaryLineEntityId: "line-b"
      },
      ["line-a", "line-b"]
    ],
    [
      "angle",
      {
        ...base,
        entityId: "line-b",
        kind: "angle",
        primaryLineEntityId: "line-a",
        secondaryLineEntityId: "line-b",
        angleDegrees: 45
      },
      ["line-a", "line-b"]
    ],
    [
      "tangent",
      {
        ...base,
        entityId: "arc-a",
        kind: "tangent",
        primaryTarget: { entityId: "line-a", entityKind: "line" },
        secondaryTarget: { entityId: "arc-a", entityKind: "arc" }
      },
      ["arc-a", "line-a"]
    ],
    [
      "concentric",
      {
        ...base,
        entityId: "circle-b",
        kind: "concentric",
        primaryTarget: { entityId: "circle-a", entityKind: "circle" },
        secondaryTarget: { entityId: "circle-b", entityKind: "circle" }
      },
      ["circle-a", "circle-b"]
    ],
    [
      "equalRadius",
      {
        ...base,
        entityId: "arc-b",
        kind: "equalRadius",
        primaryTarget: { entityId: "arc-a", entityKind: "arc" },
        secondaryTarget: { entityId: "arc-b", entityKind: "arc" }
      },
      ["arc-a", "arc-b"]
    ],
    [
      "symmetry",
      {
        ...base,
        entityId: "line-b",
        kind: "symmetry",
        primaryTarget: { entityId: "point-a", role: "position" },
        secondaryTarget: { entityId: "point-b", role: "position" },
        symmetryLineEntityId: "line-a"
      },
      ["line-a", "line-b", "point-a", "point-b"]
    ]
  ])("enumerates every %s constraint reference", (_name, value, expected) => {
    expect(
      getSketchConstraintTargetEntityIds(value as SketchConstraintSnapshot)
    ).toEqual(expected);
  });

  it.each([
    [
      {
        kind: "entityScalar",
        entityId: "line-a",
        entityKind: "line",
        role: "length"
      },
      ["line-a"]
    ],
    [
      {
        kind: "pointPair",
        primary: {
          entityId: "line-b",
          entityKind: "line",
          role: "start"
        },
        secondary: {
          entityId: "line-a",
          entityKind: "line",
          role: "end"
        },
        measurement: "distance"
      },
      ["line-a", "line-b"]
    ],
    [
      {
        kind: "pointLineDistance",
        point: {
          entityId: "line-b",
          entityKind: "line",
          role: "start"
        },
        lineEntityId: "line-a",
        side: "left"
      },
      ["line-a", "line-b"]
    ],
    [
      {
        kind: "lineAngle",
        primaryLineEntityId: "line-b",
        secondaryLineEntityId: "line-a",
        sense: "clockwise"
      },
      ["line-a", "line-b"]
    ]
  ] as const)(
    "enumerates every normalized V22 dimension target",
    (target, expected) => {
      expect(getSketchDimensionTargetEntityIds(target)).toEqual(expected);
    }
  );

  it("extracts exact point provenance only from authored point members", () => {
    const coincident = {
      ...base,
      entityId: "line-a",
      kind: "coincident",
      primaryTarget: { entityId: "line-b", role: "start" },
      secondaryTarget: { entityId: "line-a", role: "end" }
    } as const;
    expect(getSketchConstraintPointTargetProvenanceKeys(coincident)).toEqual([
      createSketchPointTargetProvenanceKey(coincident.secondaryTarget),
      createSketchPointTargetProvenanceKey(coincident.primaryTarget)
    ]);
    expect(
      getSketchDimensionPointTargetProvenanceKeys({
        kind: "pointLineDistance",
        point: {
          entityId: "arc-a",
          entityKind: "arc",
          role: "start"
        },
        lineEntityId: "line-a",
        side: "left"
      })
    ).toEqual([
      createSketchPointTargetProvenanceKey({
        entityId: "arc-a",
        role: "start"
      })
    ]);
  });
});

describe("sketch curve-edit constraint retargeting", () => {
  it("classifies records without edited targets as unaffected", () => {
    const constraint = {
      ...base,
      entityId: "line-b",
      kind: "horizontal"
    } as const;
    expect(
      retargetSketchCurveEditConstraint(
        constraint,
        context([replacement("line-a", ["line-a"], "line-a")])
      )
    ).toMatchObject({
      disposition: "unaffected",
      before: constraint,
      after: constraint
    });
  });

  it("retargets fixed endpoints solely through explicit provenance and updates the owner", () => {
    const constraint = {
      ...base,
      entityId: "line-a",
      kind: "fixed",
      target: { entityId: "line-a", role: "end" },
      coordinate: [4, 0]
    } as const;
    const result = retargetSketchCurveEditConstraint(
      constraint,
      context(
        [replacement("line-a", ["line-a", "line-c"], "line-a")],
        [
          [
            { entityId: "line-a", entityKind: "line", role: "end" },
            { entityId: "line-c", entityKind: "line", role: "end" }
          ]
        ]
      )
    );
    expect(result).toMatchObject({
      disposition: "retargeted",
      after: {
        entityId: "line-c",
        target: { entityId: "line-c", role: "end" },
        coordinate: [4, 0]
      }
    });
  });

  it("retargets coincident endpoints and rejects a same-target collapse", () => {
    const constraint = {
      ...base,
      entityId: "line-a",
      kind: "coincident",
      primaryTarget: { entityId: "line-a", role: "end" },
      secondaryTarget: { entityId: "line-b", role: "start" }
    } as const;
    const edit = replacement(
      "line-a",
      ["line-a", "line-b", "line-c"],
      "line-a"
    );
    const preserved = retargetSketchCurveEditConstraint(
      constraint,
      context(
        [edit],
        [
          [
            { entityId: "line-a", entityKind: "line", role: "end" },
            { entityId: "line-c", entityKind: "line", role: "start" }
          ]
        ]
      )
    );
    expect(preserved).toMatchObject({
      disposition: "retargeted",
      after: {
        entityId: "line-c",
        primaryTarget: { entityId: "line-c", role: "start" }
      }
    });

    const collapsed = retargetSketchCurveEditConstraint(
      constraint,
      context(
        [edit],
        [
          [
            { entityId: "line-a", entityKind: "line", role: "end" },
            { entityId: "line-b", entityKind: "line", role: "start" }
          ]
        ]
      )
    );
    expect(collapsed).toMatchObject({
      disposition: "invalid",
      reason: "same-target-collapse"
    });
    expect(collapsed.after).toBeUndefined();
  });

  it("rejects missing, out-of-replacement, and kind-changing endpoint provenance", () => {
    const constraint = {
      ...base,
      entityId: "line-a",
      kind: "fixed",
      target: { entityId: "line-a", role: "start" },
      coordinate: [0, 0]
    } as const;
    const edit = replacement("line-a", ["line-c"]);
    expect(
      retargetSketchCurveEditConstraint(constraint, context([edit]))
    ).toMatchObject({
      disposition: "invalid",
      reason: "endpoint-provenance-missing"
    });
    expect(
      retargetSketchCurveEditConstraint(
        constraint,
        context(
          [edit],
          [
            [
              { entityId: "line-a", entityKind: "line", role: "start" },
              { entityId: "line-b", entityKind: "line", role: "start" }
            ]
          ]
        )
      )
    ).toMatchObject({
      disposition: "invalid",
      reason: "endpoint-provenance-outside-replacement"
    });
    expect(
      retargetSketchCurveEditConstraint(
        constraint,
        context(
          [replacement("line-a", ["arc-b"])],
          [
            [
              { entityId: "line-a", entityKind: "line", role: "start" },
              { entityId: "arc-b", entityKind: "arc", role: "start" }
            ]
          ]
        )
      )
    ).toMatchObject({
      disposition: "invalid",
      reason: "endpoint-kind-changed"
    });
  });

  it("preserves centers only when the exact ID and kind survive", () => {
    const constraint = {
      ...base,
      entityId: "circle-a",
      kind: "fixed",
      target: { entityId: "circle-a", role: "center" },
      coordinate: [0, 0]
    } as const;
    expect(
      retargetSketchCurveEditConstraint(
        constraint,
        context([replacement("circle-a", ["circle-a"], "circle-a")])
      )
    ).toMatchObject({ disposition: "preserved" });
    expect(
      retargetSketchCurveEditConstraint(
        constraint,
        context([replacement("circle-a", ["arc-a"])], [], [["arc-a", "arc"]])
      )
    ).toMatchObject({
      disposition: "invalid",
      reason: "point-target-replaced"
    });
  });

  it("never retargets symmetry, even when endpoint provenance is unique", () => {
    const constraint = {
      ...base,
      entityId: "line-b",
      kind: "symmetry",
      primaryTarget: { entityId: "line-a", role: "start" },
      secondaryTarget: { entityId: "line-b", role: "end" },
      symmetryLineEntityId: "line-c"
    } as const;
    expect(
      retargetSketchCurveEditConstraint(
        constraint,
        context(
          [replacement("line-a", ["line-a"], "line-a")],
          [
            [
              { entityId: "line-a", entityKind: "line", role: "start" },
              { entityId: "line-a", entityKind: "line", role: "start" }
            ]
          ]
        )
      )
    ).toMatchObject({
      disposition: "invalid",
      reason: "symmetry-retarget-forbidden"
    });
  });

  it("does not retarget an endpoint target owned by midpoint", () => {
    const constraint = {
      ...base,
      entityId: "line-b",
      kind: "midpoint",
      lineEntityId: "line-b",
      target: { entityId: "line-a", role: "start" }
    } as const;
    expect(
      retargetSketchCurveEditConstraint(
        constraint,
        context(
          [replacement("line-a", ["line-c"])],
          [
            [
              { entityId: "line-a", entityKind: "line", role: "start" },
              { entityId: "line-c", entityKind: "line", role: "start" }
            ]
          ]
        )
      )
    ).toMatchObject({
      disposition: "invalid",
      reason: "curve-wide-target-replaced"
    });
  });

  it.each([
    {
      ...base,
      entityId: "line-a",
      kind: "horizontal",
      editedId: "line-a"
    },
    {
      ...base,
      entityId: "line-a",
      kind: "vertical",
      editedId: "line-a"
    },
    {
      ...base,
      entityId: "line-a",
      kind: "midpoint",
      lineEntityId: "line-a",
      target: { entityId: "point-a", role: "position" },
      editedId: "line-a"
    },
    {
      ...base,
      entityId: "line-b",
      kind: "parallel",
      primaryLineEntityId: "line-a",
      secondaryLineEntityId: "line-b",
      editedId: "line-a"
    },
    {
      ...base,
      entityId: "line-b",
      kind: "perpendicular",
      primaryLineEntityId: "line-a",
      secondaryLineEntityId: "line-b",
      editedId: "line-a"
    },
    {
      ...base,
      entityId: "line-b",
      kind: "equalLength",
      primaryLineEntityId: "line-a",
      secondaryLineEntityId: "line-b",
      editedId: "line-a"
    },
    {
      ...base,
      entityId: "line-b",
      kind: "angle",
      primaryLineEntityId: "line-a",
      secondaryLineEntityId: "line-b",
      angleDegrees: 30,
      editedId: "line-a"
    },
    {
      ...base,
      entityId: "arc-a",
      kind: "tangent",
      primaryTarget: { entityId: "line-a", entityKind: "line" },
      secondaryTarget: { entityId: "arc-a", entityKind: "arc" },
      editedId: "line-a"
    },
    {
      ...base,
      entityId: "circle-b",
      kind: "concentric",
      primaryTarget: { entityId: "circle-a", entityKind: "circle" },
      secondaryTarget: { entityId: "circle-b", entityKind: "circle" },
      editedId: "circle-a"
    },
    {
      ...base,
      entityId: "arc-b",
      kind: "equalRadius",
      primaryTarget: { entityId: "arc-a", entityKind: "arc" },
      secondaryTarget: { entityId: "arc-b", entityKind: "arc" },
      editedId: "arc-a"
    }
  ] as const)(
    "preserves exact curve-wide $kind targets but never clones them",
    ({ editedId, ...constraint }) => {
      const exact = retargetSketchCurveEditConstraint(
        constraint as SketchConstraintSnapshot,
        context([replacement(editedId, [editedId], editedId)])
      );
      expect(exact.disposition).toBe("preserved");

      const cloned = retargetSketchCurveEditConstraint(
        constraint as SketchConstraintSnapshot,
        context(
          [replacement(editedId, ["line-c"])],
          [],
          [["line-c", sourceKinds.get(editedId)!]]
        )
      );
      expect(cloned).toMatchObject({
        disposition: "invalid",
        reason: "curve-wide-target-replaced"
      });
    }
  );
});

describe("sketch curve-edit normalized V22 dimension retargeting", () => {
  it("retargets both pointPair members from exact endpoint provenance", () => {
    const source = dimension({
      kind: "pointPair",
      primary: {
        entityId: "line-a",
        entityKind: "line",
        role: "end"
      },
      secondary: {
        entityId: "line-b",
        entityKind: "line",
        role: "start"
      },
      measurement: "horizontal",
      direction: "positive"
    });
    const result = retargetSketchCurveEditDimension(
      source,
      context(
        [replacement("line-a", ["line-a", "line-c"], "line-a")],
        [
          [
            { entityId: "line-a", entityKind: "line", role: "end" },
            { entityId: "line-c", entityKind: "line", role: "start" }
          ]
        ]
      )
    );
    expect(result).toMatchObject({
      disposition: "retargeted",
      after: {
        target: {
          kind: "pointPair",
          primary: {
            entityId: "line-c",
            entityKind: "line",
            role: "start"
          },
          measurement: "horizontal",
          direction: "positive"
        }
      }
    });
  });

  it("rejects pointPair collapse after retargeting", () => {
    const source = dimension({
      kind: "pointPair",
      primary: {
        entityId: "line-a",
        entityKind: "line",
        role: "end"
      },
      secondary: {
        entityId: "line-b",
        entityKind: "line",
        role: "start"
      },
      measurement: "distance"
    });
    expect(
      retargetSketchCurveEditDimension(
        source,
        context(
          [replacement("line-a", ["line-b"])],
          [
            [
              { entityId: "line-a", entityKind: "line", role: "end" },
              { entityId: "line-b", entityKind: "line", role: "start" }
            ]
          ]
        )
      )
    ).toMatchObject({
      disposition: "invalid",
      reason: "same-target-collapse"
    });
  });

  it("retargets only the point member of pointLineDistance", () => {
    const source = dimension({
      kind: "pointLineDistance",
      point: {
        entityId: "arc-a",
        entityKind: "arc",
        role: "end"
      },
      lineEntityId: "line-a",
      side: "right"
    });
    expect(
      retargetSketchCurveEditDimension(
        source,
        context(
          [replacement("arc-a", ["arc-a", "arc-b"], "arc-a")],
          [
            [
              { entityId: "arc-a", entityKind: "arc", role: "end" },
              { entityId: "arc-b", entityKind: "arc", role: "end" }
            ]
          ]
        )
      )
    ).toMatchObject({
      disposition: "retargeted",
      after: {
        target: {
          point: {
            entityId: "arc-b",
            entityKind: "arc",
            role: "end"
          },
          lineEntityId: "line-a"
        }
      }
    });
  });

  it("refuses curve-wide cloning for pointLineDistance line, scalar, and angle targets", () => {
    const pointLine = dimension({
      kind: "pointLineDistance",
      point: {
        entityId: "point-a",
        entityKind: "point",
        role: "position"
      },
      lineEntityId: "line-a",
      side: "left"
    });
    const scalar = dimension({
      kind: "entityScalar",
      entityId: "circle-a",
      entityKind: "circle",
      role: "radius"
    });
    const angle = dimension({
      kind: "lineAngle",
      primaryLineEntityId: "line-a",
      secondaryLineEntityId: "line-b",
      sense: "counterclockwise"
    });
    expect(
      retargetSketchCurveEditDimension(
        pointLine,
        context([replacement("line-a", ["line-c"])], [], [["line-c", "line"]])
      )
    ).toMatchObject({
      disposition: "invalid",
      reason: "curve-wide-target-replaced"
    });
    expect(
      retargetSketchCurveEditDimension(
        scalar,
        context([replacement("circle-a", ["arc-a"])], [], [["arc-a", "arc"]])
      )
    ).toMatchObject({
      disposition: "invalid",
      reason: "curve-wide-target-replaced"
    });
    expect(
      retargetSketchCurveEditDimension(
        angle,
        context([replacement("line-a", ["line-c"])], [], [["line-c", "line"]])
      )
    ).toMatchObject({
      disposition: "invalid",
      reason: "curve-wide-target-replaced"
    });
  });

  it("preserves exact same-ID dimension targets and invalidates a same-ID kind change", () => {
    const scalar = dimension({
      kind: "entityScalar",
      entityId: "circle-a",
      entityKind: "circle",
      role: "diameter"
    });
    expect(
      retargetSketchCurveEditDimension(
        scalar,
        context([replacement("circle-a", ["circle-a"], "circle-a")])
      )
    ).toMatchObject({ disposition: "preserved" });
    expect(
      retargetSketchCurveEditDimension(
        scalar,
        context(
          [replacement("circle-a", ["circle-a"], "circle-a")],
          [],
          [["circle-a", "arc"]]
        )
      )
    ).toMatchObject({
      disposition: "invalid",
      reason: "target-kind-changed"
    });
  });

  it("requires dimension center targets to retain the exact ID", () => {
    const centerPair = dimension({
      kind: "pointPair",
      primary: {
        entityId: "circle-a",
        entityKind: "circle",
        role: "center"
      },
      secondary: {
        entityId: "point-a",
        entityKind: "point",
        role: "position"
      },
      measurement: "distance"
    });
    expect(
      retargetSketchCurveEditDimension(
        centerPair,
        context([replacement("circle-a", ["circle-a"], "circle-a")])
      )
    ).toMatchObject({ disposition: "preserved" });
    expect(
      retargetSketchCurveEditDimension(
        centerPair,
        context([replacement("circle-a", ["arc-a"])], [], [["arc-a", "arc"]])
      )
    ).toMatchObject({
      disposition: "invalid",
      reason: "point-target-replaced"
    });
  });
});
