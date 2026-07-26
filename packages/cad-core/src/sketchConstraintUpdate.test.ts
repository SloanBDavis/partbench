import type {
  SketchConstraintSnapshot,
  SketchConstraintUpdateOpV19,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  planSketchConstraintUpdate,
  type SketchConstraintUpdateIssueCode
} from "./sketchConstraintUpdate";

const entities: readonly SketchEntitySnapshot[] = [
  {
    id: "point-1",
    kind: "point",
    point: [0, 0],
    construction: false
  },
  {
    id: "point-2",
    kind: "point",
    point: [2, 0],
    construction: false
  },
  {
    id: "line-1",
    kind: "line",
    start: [0, 0],
    end: [4, 0],
    construction: false
  },
  {
    id: "line-2",
    kind: "line",
    start: [0, 2],
    end: [4, 2],
    construction: false
  },
  {
    id: "axis",
    kind: "line",
    start: [0, -4],
    end: [0, 4],
    construction: true
  },
  {
    id: "rectangle-1",
    kind: "rectangle",
    center: [1, 1],
    width: 2,
    height: 2,
    construction: false
  },
  {
    id: "circle-1",
    kind: "circle",
    center: [0, 0],
    radius: 2,
    construction: false
  },
  {
    id: "circle-2",
    kind: "circle",
    center: [5, 0],
    radius: 2,
    construction: false
  },
  {
    id: "arc-1",
    kind: "arc",
    center: [0, 0],
    radius: 2,
    startAngleDegrees: 0,
    sweepAngleDegrees: 90,
    construction: false
  },
  {
    id: "arc-2",
    kind: "arc",
    center: [4, 0],
    radius: 2,
    startAngleDegrees: 90,
    sweepAngleDegrees: 90,
    construction: false
  }
];

const metadata = {
  id: "constraint-1",
  name: "Preserved constraint name",
  sketchId: "sketch-1"
} as const;

type Definition = SketchConstraintUpdateOpV19["definition"];

function operation(definition: Definition): SketchConstraintUpdateOpV19 {
  return {
    op: "sketch.constraint.update",
    id: metadata.id,
    definition
  };
}

function ready(
  existing: SketchConstraintSnapshot,
  definition: Definition
): SketchConstraintSnapshot {
  const result = planSketchConstraintUpdate(
    existing,
    operation(definition),
    entities
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.issue.code);
  return result.constraint;
}

function blocked(
  existing: SketchConstraintSnapshot,
  definition: Definition,
  code: SketchConstraintUpdateIssueCode,
  entitySet: readonly SketchEntitySnapshot[] = entities
) {
  const result = planSketchConstraintUpdate(
    existing,
    operation(definition),
    entitySet
  );
  expect(result).toMatchObject({ ok: false, issue: { code } });
  if (result.ok) throw new Error("Expected a blocked update.");
  return result.issue;
}

const existingByKind = {
  horizontal: {
    ...metadata,
    kind: "horizontal",
    entityId: "line-1"
  },
  vertical: {
    ...metadata,
    kind: "vertical",
    entityId: "line-1"
  },
  fixed: {
    ...metadata,
    kind: "fixed",
    entityId: "point-1",
    target: { entityId: "point-1", role: "position" },
    coordinate: [0, 0]
  },
  coincident: {
    ...metadata,
    kind: "coincident",
    entityId: "point-1",
    primaryTarget: { entityId: "point-1", role: "position" },
    secondaryTarget: { entityId: "line-1", role: "start" }
  },
  midpoint: {
    ...metadata,
    kind: "midpoint",
    entityId: "line-1",
    lineEntityId: "line-1",
    target: { entityId: "point-1", role: "position" }
  },
  parallel: {
    ...metadata,
    kind: "parallel",
    entityId: "line-2",
    primaryLineEntityId: "line-1",
    secondaryLineEntityId: "line-2"
  },
  perpendicular: {
    ...metadata,
    kind: "perpendicular",
    entityId: "line-2",
    primaryLineEntityId: "line-1",
    secondaryLineEntityId: "line-2"
  },
  equalLength: {
    ...metadata,
    kind: "equalLength",
    entityId: "line-2",
    primaryLineEntityId: "line-1",
    secondaryLineEntityId: "line-2"
  },
  tangent: {
    ...metadata,
    kind: "tangent",
    entityId: "arc-1",
    primaryTarget: { entityId: "line-1", entityKind: "line" },
    secondaryTarget: { entityId: "arc-1", entityKind: "arc" }
  },
  concentric: {
    ...metadata,
    kind: "concentric",
    entityId: "arc-1",
    primaryTarget: { entityId: "circle-1", entityKind: "circle" },
    secondaryTarget: { entityId: "arc-1", entityKind: "arc" }
  },
  equalRadius: {
    ...metadata,
    kind: "equalRadius",
    entityId: "arc-1",
    primaryTarget: { entityId: "circle-1", entityKind: "circle" },
    secondaryTarget: { entityId: "arc-1", entityKind: "arc" }
  },
  symmetry: {
    ...metadata,
    kind: "symmetry",
    entityId: "point-2",
    primaryTarget: { entityId: "point-1", role: "position" },
    secondaryTarget: { entityId: "point-2", role: "position" },
    symmetryLineEntityId: "axis"
  },
  angle: {
    ...metadata,
    kind: "angle",
    entityId: "line-2",
    primaryLineEntityId: "line-1",
    secondaryLineEntityId: "line-2",
    angleDegrees: 45
  }
} as const satisfies Record<string, SketchConstraintSnapshot>;

describe("Decision 14 structural constraint update planning", () => {
  it.each([
    [
      "horizontal",
      existingByKind.horizontal,
      { kind: "horizontal", entityId: "line-2" }
    ],
    [
      "vertical",
      existingByKind.vertical,
      { kind: "vertical", entityId: "line-2" }
    ],
    [
      "fixed",
      existingByKind.fixed,
      {
        kind: "fixed",
        target: { entityId: "line-1", entityKind: "line", role: "end" },
        coordinate: [4, 0]
      }
    ],
    [
      "coincident",
      existingByKind.coincident,
      {
        kind: "coincident",
        primaryTarget: {
          entityId: "arc-1",
          entityKind: "arc",
          role: "start"
        },
        secondaryTarget: {
          entityId: "circle-1",
          entityKind: "circle",
          role: "center"
        }
      }
    ],
    [
      "midpoint",
      existingByKind.midpoint,
      {
        kind: "midpoint",
        lineEntityId: "line-2",
        target: {
          entityId: "rectangle-1",
          entityKind: "rectangle",
          role: "center"
        }
      }
    ],
    [
      "parallel",
      existingByKind.parallel,
      {
        kind: "parallel",
        primaryLineEntityId: "line-2",
        secondaryLineEntityId: "axis"
      }
    ],
    [
      "perpendicular",
      existingByKind.perpendicular,
      {
        kind: "perpendicular",
        primaryLineEntityId: "line-2",
        secondaryLineEntityId: "axis"
      }
    ],
    [
      "equalLength",
      existingByKind.equalLength,
      {
        kind: "equalLength",
        primaryLineEntityId: "line-2",
        secondaryLineEntityId: "axis"
      }
    ],
    [
      "tangent",
      existingByKind.tangent,
      {
        kind: "tangent",
        primaryTarget: { entityId: "circle-1", entityKind: "circle" },
        secondaryTarget: { entityId: "arc-2", entityKind: "arc" }
      }
    ],
    [
      "concentric",
      existingByKind.concentric,
      {
        kind: "concentric",
        primaryTarget: { entityId: "arc-1", entityKind: "arc" },
        secondaryTarget: { entityId: "circle-2", entityKind: "circle" }
      }
    ],
    [
      "equalRadius",
      existingByKind.equalRadius,
      {
        kind: "equalRadius",
        primaryTarget: { entityId: "arc-1", entityKind: "arc" },
        secondaryTarget: { entityId: "circle-2", entityKind: "circle" }
      }
    ],
    [
      "symmetry",
      existingByKind.symmetry,
      {
        kind: "symmetry",
        primaryTarget: {
          entityId: "arc-1",
          entityKind: "arc",
          role: "start"
        },
        secondaryTarget: {
          entityId: "point-2",
          entityKind: "point",
          role: "position"
        },
        symmetryLineEntityId: "axis"
      }
    ],
    [
      "legacy angle",
      existingByKind.angle,
      {
        kind: "angle",
        primaryLineEntityId: "line-2",
        secondaryLineEntityId: "axis",
        angleDegrees: 60
      }
    ]
  ] as const)("plans the %s update row", (_label, existing, definition) => {
    const constraint = ready(existing, definition);
    expect(constraint).toMatchObject(metadata);
    expect(constraint.kind).toBe(definition.kind);
  });

  it("normalizes V22 point targets into the established V21 storage shapes", () => {
    expect(
      ready(existingByKind.coincident, {
        kind: "coincident",
        primaryTarget: {
          entityId: "arc-1",
          entityKind: "arc",
          role: "end"
        },
        secondaryTarget: {
          entityId: "circle-1",
          entityKind: "circle",
          role: "center"
        }
      })
    ).toEqual({
      ...metadata,
      kind: "coincident",
      entityId: "arc-1",
      primaryTarget: {
        entityId: "arc-1",
        entityKind: "arc",
        role: "end"
      },
      secondaryTarget: { entityId: "circle-1", role: "center" }
    });
  });

  it("preserves id, name, and sketchId while deriving the V21 owner entity", () => {
    expect(
      ready(existingByKind.equalLength, {
        kind: "equalLength",
        primaryLineEntityId: "line-2",
        secondaryLineEntityId: "axis"
      })
    ).toEqual({
      ...metadata,
      kind: "equalLength",
      entityId: "axis",
      primaryLineEntityId: "line-2",
      secondaryLineEntityId: "axis"
    });
  });

  it("rejects operation-id and kind changes deterministically", () => {
    expect(
      planSketchConstraintUpdate(
        existingByKind.horizontal,
        {
          op: "sketch.constraint.update",
          id: "another-constraint",
          definition: { kind: "horizontal", entityId: "line-2" }
        },
        entities
      )
    ).toMatchObject({
      ok: false,
      issue: { code: "SKETCH_CONSTRAINT_UPDATE_ID_MISMATCH", path: "$.id" }
    });
    blocked(
      existingByKind.horizontal,
      {
        kind: "vertical",
        entityId: "line-2"
      },
      "SKETCH_CONSTRAINT_UPDATE_KIND_CHANGE_UNSUPPORTED"
    );
  });

  it.each([
    [
      "missing target",
      existingByKind.horizontal,
      { kind: "horizontal", entityId: "missing" },
      "SKETCH_CONSTRAINT_UPDATE_TARGET_NOT_FOUND"
    ],
    [
      "wrong line kind",
      existingByKind.horizontal,
      { kind: "horizontal", entityId: "point-1" },
      "SKETCH_CONSTRAINT_UPDATE_TARGET_KIND_MISMATCH"
    ],
    [
      "same coincident point",
      existingByKind.coincident,
      {
        kind: "coincident",
        primaryTarget: {
          entityId: "point-1",
          entityKind: "point",
          role: "position"
        },
        secondaryTarget: {
          entityId: "point-1",
          entityKind: "point",
          role: "position"
        }
      },
      "SKETCH_CONSTRAINT_UPDATE_TARGETS_NOT_DISTINCT"
    ],
    [
      "arc midpoint",
      existingByKind.midpoint,
      {
        kind: "midpoint",
        lineEntityId: "line-1",
        target: {
          entityId: "arc-1",
          entityKind: "arc",
          role: "center"
        }
      },
      "SKETCH_CONSTRAINT_UPDATE_TARGET_KIND_MISMATCH"
    ],
    [
      "same line pair",
      existingByKind.equalLength,
      {
        kind: "equalLength",
        primaryLineEntityId: "line-1",
        secondaryLineEntityId: "line-1"
      },
      "SKETCH_CONSTRAINT_UPDATE_SELF_REFERENCE"
    ],
    [
      "line-line tangent",
      existingByKind.tangent,
      {
        kind: "tangent",
        primaryTarget: { entityId: "line-1", entityKind: "line" },
        secondaryTarget: { entityId: "line-2", entityKind: "line" }
      },
      "SKETCH_CONSTRAINT_UPDATE_TARGET_PAIR_UNSUPPORTED"
    ],
    [
      "same tangent curve",
      existingByKind.tangent,
      {
        kind: "tangent",
        primaryTarget: { entityId: "arc-1", entityKind: "arc" },
        secondaryTarget: { entityId: "arc-1", entityKind: "arc" }
      },
      "SKETCH_CONSTRAINT_UPDATE_SELF_REFERENCE"
    ],
    [
      "line radius target",
      existingByKind.equalRadius,
      {
        kind: "equalRadius",
        primaryTarget: { entityId: "line-1", entityKind: "line" },
        secondaryTarget: { entityId: "arc-1", entityKind: "arc" }
      },
      "SKETCH_CONSTRAINT_UPDATE_TARGET_KIND_MISMATCH"
    ],
    [
      "same symmetry point",
      existingByKind.symmetry,
      {
        kind: "symmetry",
        primaryTarget: {
          entityId: "point-1",
          entityKind: "point",
          role: "position"
        },
        secondaryTarget: {
          entityId: "point-1",
          entityKind: "point",
          role: "position"
        },
        symmetryLineEntityId: "axis"
      },
      "SKETCH_CONSTRAINT_UPDATE_TARGETS_NOT_DISTINCT"
    ],
    [
      "same angle line",
      existingByKind.angle,
      {
        kind: "angle",
        primaryLineEntityId: "line-1",
        secondaryLineEntityId: "line-1",
        angleDegrees: 45
      },
      "SKETCH_CONSTRAINT_UPDATE_SELF_REFERENCE"
    ]
  ] as const)("blocks %s", (_label, existing, definition, expectedCode) => {
    blocked(existing, definition as Definition, expectedCode);
  });

  it("validates runtime point roles, entity-kind claims, and finite values", () => {
    blocked(
      existingByKind.fixed,
      {
        kind: "fixed",
        target: {
          entityId: "circle-1",
          entityKind: "circle",
          role: "position"
        },
        coordinate: [0, 0]
      } as unknown as Definition,
      "SKETCH_CONSTRAINT_UPDATE_TARGET_ROLE_INVALID"
    );
    blocked(
      existingByKind.fixed,
      {
        kind: "fixed",
        target: {
          entityId: "point-1",
          entityKind: "line",
          role: "start"
        },
        coordinate: [0, 0]
      },
      "SKETCH_CONSTRAINT_UPDATE_TARGET_KIND_MISMATCH"
    );
    blocked(
      existingByKind.fixed,
      {
        kind: "fixed",
        target: {
          entityId: "point-1",
          entityKind: "point",
          role: "position"
        },
        coordinate: [Number.NaN, 0]
      },
      "SKETCH_CONSTRAINT_UPDATE_VALUE_INVALID"
    );
    for (const angleDegrees of [0, 180, Number.POSITIVE_INFINITY]) {
      blocked(
        existingByKind.angle,
        {
          kind: "angle",
          primaryLineEntityId: "line-1",
          secondaryLineEntityId: "line-2",
          angleDegrees
        },
        "SKETCH_CONSTRAINT_UPDATE_VALUE_INVALID"
      );
    }
  });

  it("does not mutate the existing constraint, operation, or entity list", () => {
    const existing = structuredClone(existingByKind.fixed);
    const update = operation({
      kind: "fixed",
      target: { entityId: "line-1", entityKind: "line", role: "start" },
      coordinate: [3, 4]
    });
    const before = {
      existing: structuredClone(existing),
      update: structuredClone(update),
      entities: structuredClone(entities)
    };

    expect(planSketchConstraintUpdate(existing, update, entities).ok).toBe(
      true
    );
    expect({ existing, update, entities }).toEqual(before);
  });
});
