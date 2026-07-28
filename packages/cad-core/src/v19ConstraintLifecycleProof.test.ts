import type { CadOp, SketchConstraintUpdateOpV19 } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  CAD_PROJECT_FORMAT_VERSION_V21,
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  importCadProject,
  type CadProject
} from "./index";

type ConstraintDefinition = SketchConstraintUpdateOpV19["definition"];

interface ConstraintLifecycleCase {
  readonly label: string;
  readonly create: CadOp;
  readonly update: ConstraintDefinition;
  readonly numerical: boolean;
}

function createConstraintLifecycleEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_1",
      name: "Decision 14 lifecycle",
      plane: "XY"
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "point_a",
      point: [0, 0]
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "point_b",
      point: [12, 4]
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "point_mid",
      point: [2, 0]
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "symmetry_a",
      point: [-2, 2]
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "symmetry_b",
      point: [-2, -2]
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "symmetry_c",
      point: [6, 1]
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "symmetry_d",
      point: [8, -2]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_1",
      start: [0, 0],
      end: [4, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_2",
      start: [0, 2],
      end: [0, 6]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_3",
      start: [5, 1],
      end: [8, 3]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_4",
      start: [10, 0],
      end: [14, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_tangent",
      start: [2, -2],
      end: [2, 2]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_slanted",
      start: [3, -2],
      end: [4, 2]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "axis",
      start: [-5, 0],
      end: [5, 0],
      construction: true
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rectangle_a",
      center: [2, 0],
      width: 2,
      height: 2
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rectangle_b",
      center: [12, 3],
      width: 2,
      height: 2
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_same",
      center: [0, 0],
      radius: 2
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_tangent",
      center: [4, 0],
      radius: 2
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_far",
      center: [8, 3],
      radius: 1
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_mid",
      center: [2, 0],
      radius: 1
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_mid_b",
      center: [12, 4],
      radius: 1
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_1",
      id: "arc_a",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90
      }
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_1",
      id: "arc_b",
      definition: {
        kind: "centerAngles",
        center: [4, 0],
        radius: 2,
        startAngleDegrees: 180,
        sweepAngleDegrees: -90
      }
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_1",
      id: "arc_far",
      definition: {
        kind: "centerAngles",
        center: [8, 3],
        radius: 1,
        startAngleDegrees: 90,
        sweepAngleDegrees: 180
      }
    }
  ]);
  return engine;
}

const lifecycleCases: readonly ConstraintLifecycleCase[] = [
  {
    label: "horizontal",
    numerical: false,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_horizontal",
      name: "horizontal",
      sketchId: "sketch_1",
      kind: "horizontal",
      entityId: "line_1"
    },
    update: { kind: "horizontal", entityId: "line_3" }
  },
  {
    label: "vertical",
    numerical: false,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_vertical",
      name: "vertical",
      sketchId: "sketch_1",
      kind: "vertical",
      entityId: "line_2"
    },
    update: { kind: "vertical", entityId: "line_3" }
  },
  {
    label: "fixed",
    numerical: true,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_fixed",
      name: "fixed",
      sketchId: "sketch_1",
      kind: "fixed",
      target: {
        entityId: "point_a",
        entityKind: "point",
        role: "position"
      }
    },
    update: {
      kind: "fixed",
      target: {
        entityId: "point_b",
        entityKind: "point",
        role: "position"
      },
      coordinate: [13, 5]
    }
  },
  {
    label: "coincident",
    numerical: true,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_coincident",
      name: "coincident",
      sketchId: "sketch_1",
      kind: "coincident",
      primaryTarget: {
        entityId: "point_a",
        entityKind: "point",
        role: "position"
      },
      secondaryTarget: {
        entityId: "line_1",
        entityKind: "line",
        role: "start"
      }
    },
    update: {
      kind: "coincident",
      primaryTarget: {
        entityId: "point_b",
        entityKind: "point",
        role: "position"
      },
      secondaryTarget: {
        entityId: "line_4",
        entityKind: "line",
        role: "start"
      }
    }
  },
  {
    label: "midpoint point target",
    numerical: false,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_midpoint_point",
      name: "midpoint point",
      sketchId: "sketch_1",
      kind: "midpoint",
      lineEntityId: "line_1",
      target: {
        entityId: "point_mid",
        entityKind: "point",
        role: "position"
      }
    },
    update: {
      kind: "midpoint",
      lineEntityId: "line_4",
      target: {
        entityId: "point_b",
        entityKind: "point",
        role: "position"
      }
    }
  },
  {
    label: "midpoint rectangle center",
    numerical: false,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_midpoint_rectangle",
      name: "midpoint rectangle",
      sketchId: "sketch_1",
      kind: "midpoint",
      lineEntityId: "line_1",
      target: {
        entityId: "rectangle_a",
        entityKind: "rectangle",
        role: "center"
      }
    },
    update: {
      kind: "midpoint",
      lineEntityId: "line_4",
      target: {
        entityId: "rectangle_b",
        entityKind: "rectangle",
        role: "center"
      }
    }
  },
  {
    label: "midpoint circle center",
    numerical: false,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_midpoint_circle",
      name: "midpoint circle",
      sketchId: "sketch_1",
      kind: "midpoint",
      lineEntityId: "line_1",
      target: {
        entityId: "circle_mid",
        entityKind: "circle",
        role: "center"
      }
    },
    update: {
      kind: "midpoint",
      lineEntityId: "line_4",
      target: {
        entityId: "circle_mid_b",
        entityKind: "circle",
        role: "center"
      }
    }
  },
  {
    label: "parallel",
    numerical: false,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_parallel",
      name: "parallel",
      sketchId: "sketch_1",
      kind: "parallel",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_4"
    },
    update: {
      kind: "parallel",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_3"
    }
  },
  {
    label: "perpendicular",
    numerical: false,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_perpendicular",
      name: "perpendicular",
      sketchId: "sketch_1",
      kind: "perpendicular",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    },
    update: {
      kind: "perpendicular",
      primaryLineEntityId: "line_4",
      secondaryLineEntityId: "line_3"
    }
  },
  {
    label: "tangent line-circle",
    numerical: true,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_tangent_line_circle",
      name: "tangent line circle",
      sketchId: "sketch_1",
      kind: "tangent",
      primaryTarget: { entityId: "line_slanted", entityKind: "line" },
      secondaryTarget: { entityId: "circle_tangent", entityKind: "circle" }
    },
    update: {
      kind: "tangent",
      primaryTarget: { entityId: "line_slanted", entityKind: "line" },
      secondaryTarget: { entityId: "circle_far", entityKind: "circle" }
    }
  },
  {
    label: "tangent line-arc",
    numerical: true,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_tangent_line_arc",
      name: "tangent line arc",
      sketchId: "sketch_1",
      kind: "tangent",
      primaryTarget: { entityId: "line_tangent", entityKind: "line" },
      secondaryTarget: { entityId: "arc_a", entityKind: "arc" }
    },
    update: {
      kind: "tangent",
      primaryTarget: { entityId: "line_slanted", entityKind: "line" },
      secondaryTarget: { entityId: "arc_far", entityKind: "arc" }
    }
  },
  {
    label: "tangent circle-arc",
    numerical: true,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_tangent_circle_arc",
      name: "tangent circle arc",
      sketchId: "sketch_1",
      kind: "tangent",
      primaryTarget: { entityId: "circle_tangent", entityKind: "circle" },
      secondaryTarget: { entityId: "arc_a", entityKind: "arc" }
    },
    update: {
      kind: "tangent",
      primaryTarget: { entityId: "circle_far", entityKind: "circle" },
      secondaryTarget: { entityId: "arc_a", entityKind: "arc" }
    }
  },
  {
    label: "tangent arc-arc",
    numerical: true,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_tangent_arc_arc",
      name: "tangent arc arc",
      sketchId: "sketch_1",
      kind: "tangent",
      primaryTarget: { entityId: "arc_a", entityKind: "arc" },
      secondaryTarget: { entityId: "arc_b", entityKind: "arc" }
    },
    update: {
      kind: "tangent",
      primaryTarget: { entityId: "arc_a", entityKind: "arc" },
      secondaryTarget: { entityId: "arc_far", entityKind: "arc" }
    }
  },
  {
    label: "concentric",
    numerical: true,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_concentric",
      name: "concentric",
      sketchId: "sketch_1",
      kind: "concentric",
      primaryTarget: { entityId: "circle_same", entityKind: "circle" },
      secondaryTarget: { entityId: "arc_a", entityKind: "arc" }
    },
    update: {
      kind: "concentric",
      primaryTarget: { entityId: "circle_far", entityKind: "circle" },
      secondaryTarget: { entityId: "arc_a", entityKind: "arc" }
    }
  },
  {
    label: "equal radius",
    numerical: true,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_equal_radius",
      name: "equal radius",
      sketchId: "sketch_1",
      kind: "equalRadius",
      primaryTarget: { entityId: "circle_same", entityKind: "circle" },
      secondaryTarget: { entityId: "arc_a", entityKind: "arc" }
    },
    update: {
      kind: "equalRadius",
      primaryTarget: { entityId: "circle_far", entityKind: "circle" },
      secondaryTarget: { entityId: "arc_a", entityKind: "arc" }
    }
  },
  {
    label: "equal length",
    numerical: true,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_equal_length",
      name: "equal length",
      sketchId: "sketch_1",
      kind: "equalLength",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_4"
    },
    update: {
      kind: "equalLength",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_3"
    }
  },
  {
    label: "symmetry",
    numerical: true,
    create: {
      op: "sketch.constraint.create",
      id: "constraint_symmetry",
      name: "symmetry",
      sketchId: "sketch_1",
      kind: "symmetry",
      primaryTarget: {
        entityId: "symmetry_a",
        entityKind: "point",
        role: "position"
      },
      secondaryTarget: {
        entityId: "symmetry_b",
        entityKind: "point",
        role: "position"
      },
      symmetryLineEntityId: "axis"
    },
    update: {
      kind: "symmetry",
      primaryTarget: {
        entityId: "symmetry_c",
        entityKind: "point",
        role: "position"
      },
      secondaryTarget: {
        entityId: "symmetry_d",
        entityKind: "point",
        role: "position"
      },
      symmetryLineEntityId: "axis"
    }
  }
];

function constraintIdOf(op: CadOp): string {
  if (op.op !== "sketch.constraint.create" || !op.id) {
    throw new Error("Lifecycle proof requires an explicit constraint id.");
  }
  return op.id;
}

function createLegacyAngleEngine(): CadEngine {
  const base = exportCadProject(createConstraintLifecycleEngine());
  const project = {
    ...base,
    schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21,
    history: [],
    redoStack: [],
    document: {
      ...base.document,
      sketches: base.document.sketches.map((sketch) => ({
        ...sketch,
        entities: sketch.entities.map((entity) => ({
          ...entity,
          construction: entity.construction ?? false
        }))
      })),
      sketchConstraints: [
        {
          id: "legacy_angle",
          name: "Legacy angle",
          sketchId: "sketch_1",
          entityId: "line_2",
          kind: "angle",
          primaryLineEntityId: "line_1",
          secondaryLineEntityId: "line_2",
          angleDegrees: 90
        }
      ],
      nextSketchConstraintNumber: 2
    }
  } as CadProject;
  return importCadProject(project);
}

const legacyAngleUpdate: SketchConstraintUpdateOpV19 = {
  op: "sketch.constraint.update",
  id: "legacy_angle",
  definition: {
    kind: "angle",
    primaryLineEntityId: "line_1",
    secondaryLineEntityId: "line_3",
    angleDegrees: 45
  }
};

describe("Decision 14 command lifecycle proof", () => {
  it.each(lifecycleCases)(
    "proves $label create/update/rename/delete, diffs, rollback, history, and replay",
    ({ create, update, numerical }) => {
      const engine = createConstraintLifecycleEngine();
      const id = constraintIdOf(create);
      const beforeCreate = exportCadProjectJson(engine);

      expect(
        engine.executeBatch({
          version: "cadops.v1",
          mode: "dryRun",
          ops: [create]
        })
      ).toMatchObject({
        ok: true,
        createdSketchConstraintIds: [id]
      });
      expect(exportCadProjectJson(engine)).toBe(beforeCreate);

      const created = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [create]
      });
      expect(created).toMatchObject({
        ok: true,
        createdSketchConstraintIds: [id]
      });
      expect(
        engine.getTransactions().at(-1)?.diff.sketchConstraints?.created
      ).toEqual([expect.objectContaining({ id })]);

      const updateOp: SketchConstraintUpdateOpV19 = {
        op: "sketch.constraint.update",
        id,
        definition: update
      };
      const beforeUpdate = exportCadProjectJson(engine);
      const beforeUpdateSnapshot = engine.createSnapshot();
      const failedBatch = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          updateOp,
          {
            op: "sketch.constraint.rename",
            id: "missing_constraint",
            name: "Must roll back"
          }
        ]
      });
      expect(failedBatch).toMatchObject({
        ok: false,
        error: { code: "SKETCH_CONSTRAINT_NOT_FOUND" }
      });
      expect(engine.createSnapshot()).toEqual(beforeUpdateSnapshot);
      expect(exportCadProjectJson(engine)).toBe(beforeUpdate);

      expect(
        engine.executeBatch({
          version: "cadops.v1",
          mode: "dryRun",
          ops: [updateOp]
        })
      ).toMatchObject({
        ok: true,
        modifiedSketchConstraintIds: [id]
      });
      expect(exportCadProjectJson(engine)).toBe(beforeUpdate);

      const updated = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [updateOp]
      });
      expect(updated).toMatchObject({
        ok: true,
        modifiedSketchConstraintIds: [id]
      });
      expect(
        engine.getTransactions().at(-1)?.diff.sketchConstraints?.modified
      ).toEqual([
        expect.objectContaining({
          id,
          kind: update.kind
        })
      ]);
      if (numerical) {
        expect(updated.modifiedSketchEntityIds?.length ?? 0).toBeGreaterThan(0);
      }

      const projectAfterUpdate = exportCadProject(engine);
      expect(exportCadProject(importCadProject(projectAfterUpdate))).toEqual(
        projectAfterUpdate
      );

      const renamed = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.constraint.rename",
            id,
            name: `Renamed ${id}`
          }
        ]
      });
      expect(renamed).toMatchObject({
        ok: true,
        modifiedSketchConstraintIds: [id]
      });
      expect(
        engine.getTransactions().at(-1)?.diff.sketchConstraints?.modified
      ).toEqual([expect.objectContaining({ id, name: `Renamed ${id}` })]);

      const beforeDelete = engine.createSnapshot();
      const deleted = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [{ op: "sketch.constraint.delete", id }]
      });
      expect(deleted).toMatchObject({
        ok: true,
        deletedSketchConstraintIds: [id]
      });
      expect(
        engine.getTransactions().at(-1)?.diff.sketchConstraints?.deleted
      ).toEqual([expect.objectContaining({ id })]);
      expect(engine.getDocument().sketchConstraints.has(id)).toBe(false);

      engine.undo();
      expect(engine.createSnapshot()).toEqual(beforeDelete);
      engine.redo();
      expect(engine.getDocument().sketchConstraints.has(id)).toBe(false);
    }
  );

  it("proves legacy angle is update/rename/delete-only with exact rollback", () => {
    const engine = createLegacyAngleEngine();
    const before = exportCadProjectJson(engine);

    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          legacyAngleUpdate,
          {
            op: "sketch.constraint.rename",
            id: "missing_constraint",
            name: "Must roll back"
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "SKETCH_CONSTRAINT_NOT_FOUND" }
    });
    expect(exportCadProjectJson(engine)).toBe(before);

    const updated = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [legacyAngleUpdate]
    });
    expect(updated).toMatchObject({
      ok: true,
      modifiedSketchConstraintIds: ["legacy_angle"]
    });
    expect(
      engine.getTransactions().at(-1)?.diff.sketchConstraints?.modified
    ).toEqual([
      expect.objectContaining({
        id: "legacy_angle",
        kind: "angle",
        angleDegrees: 45
      })
    ]);
    expect(updated.modifiedSketchEntityIds?.length ?? 0).toBeGreaterThan(0);

    engine.apply({
      op: "sketch.constraint.rename",
      id: "legacy_angle",
      name: "Renamed legacy angle"
    });
    const beforeDelete = engine.createSnapshot();
    const deleted = engine.apply({
      op: "sketch.constraint.delete",
      id: "legacy_angle"
    });
    expect(deleted.transaction.diff.sketchConstraints?.deleted).toEqual([
      expect.objectContaining({ id: "legacy_angle", kind: "angle" })
    ]);
    engine.undo();
    expect(engine.createSnapshot()).toEqual(beforeDelete);
    engine.redo();
    expect(engine.getDocument().sketchConstraints.has("legacy_angle")).toBe(
      false
    );

    expect(
      createConstraintLifecycleEngine().executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.constraint.create",
            id: "forbidden_angle",
            name: "Forbidden angle",
            sketchId: "sketch_1",
            kind: "angle",
            primaryLineEntityId: "line_1",
            secondaryLineEntityId: "line_2",
            angleDegrees: 45
          }
        ]
      } as never)
    ).toMatchObject({ ok: false });
  });

  it("round-trips a compatibility update applied to a retained legacy angle", () => {
    const engine = createLegacyAngleEngine();
    engine.apply(legacyAngleUpdate);
    const saved = exportCadProject(engine);
    expect(exportCadProject(importCadProject(saved))).toEqual(saved);
  });
});
