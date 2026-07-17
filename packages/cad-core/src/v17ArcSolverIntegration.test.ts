import { describe, expect, it } from "vitest";
import type { CadOp, CadQueryResponse } from "@web-cad/cad-protocol";

import {
  CAD_PROJECT_FORMAT_VERSION_V21,
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  exportCadProjectToWcad,
  importCadProjectJson,
  readCadProjectWcad
} from "./index";
import { createSketchSolverStatusResponse } from "./sketchSolverStatus";

function createArcSolverEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Arc solve", plane: "XY" },
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
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_tangent",
      start: [2, -2],
      end: [2, 2]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "axis",
      start: [-5, 0],
      end: [5, 0]
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "point_start",
      point: [2, 0]
    }
  ]);
  return engine;
}

function expectConstraintTransactionProof(op: CadOp, invalidOp: CadOp): void {
  const engine = createArcSolverEngine();
  const beforeSnapshot = engine.createSnapshot();
  const beforeJson = exportCadProjectJson(engine);
  const dryRun = engine.executeBatch({
    version: "cadops.v1",
    mode: "dryRun",
    ops: [op]
  });
  expect(dryRun).toMatchObject({ ok: true });
  expect(exportCadProjectJson(engine)).toBe(beforeJson);

  const commit = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [op]
  });
  expect(commit).toMatchObject({ ok: true });
  const constraintId = (op as { readonly id: string }).id;
  expect(commit).toMatchObject({ createdSketchConstraintIds: [constraintId] });
  expect(
    engine.getTransactions().at(-1)?.diff.sketchConstraints?.created
  ).toEqual([expect.objectContaining({ id: constraintId })]);
  const committedSnapshot = engine.createSnapshot();

  engine.undo();
  expect(engine.createSnapshot()).toEqual(beforeSnapshot);
  engine.redo();
  expect(engine.createSnapshot()).toEqual(committedSnapshot);

  const committedJson = exportCadProjectJson(engine);
  const invalid = engine.executeBatch({
    version: "cadops.v1",
    mode: "dryRun",
    ops: [invalidOp]
  });
  expect(invalid).toMatchObject({ ok: false });
  expect(exportCadProjectJson(engine)).toBe(committedJson);
}

function readSolverStatus(engine: CadEngine): CadQueryResponse {
  return engine.executeQuery({
    version: "cadops.v1",
    query: { query: "sketch.solverStatus", sketchId: "sketch_1" }
  });
}

describe("V17 cad-core arc solver integration", () => {
  it.each(["center", "start", "end"] as const)(
    "proves fixed arc %s target dry-run/commit/diff/undo/redo/invalid",
    (role) => {
      expectConstraintTransactionProof(
        {
          op: "sketch.constraint.create",
          id: `fixed_arc_${role}`,
          name: `Fixed arc ${role}`,
          sketchId: "sketch_1",
          kind: "fixed",
          target: { entityId: "arc_a", entityKind: "arc", role }
        },
        {
          op: "sketch.constraint.create",
          id: `fixed_arc_${role}_invalid`,
          name: "Invalid fixed arc target",
          sketchId: "sketch_1",
          kind: "fixed",
          target: { entityId: "missing_arc", entityKind: "arc", role }
        }
      );
    }
  );

  it("proves coincident arc-point target lifecycle and validation", () => {
    expectConstraintTransactionProof(
      {
        op: "sketch.constraint.create",
        id: "coincident_arc_start",
        name: "Arc start at point",
        sketchId: "sketch_1",
        kind: "coincident",
        primaryTarget: {
          entityId: "arc_a",
          entityKind: "arc",
          role: "start"
        },
        secondaryTarget: { entityId: "point_start", role: "position" }
      },
      {
        op: "sketch.constraint.create",
        id: "coincident_arc_invalid",
        name: "Invalid coincident arc",
        sketchId: "sketch_1",
        kind: "coincident",
        primaryTarget: {
          entityId: "missing_arc",
          entityKind: "arc",
          role: "start"
        },
        secondaryTarget: { entityId: "point_start", role: "position" }
      }
    );
  });

  it.each([
    [
      "line_arc",
      { entityId: "line_tangent", entityKind: "line" },
      { entityId: "arc_a", entityKind: "arc" }
    ],
    [
      "arc_circle",
      { entityId: "arc_a", entityKind: "arc" },
      { entityId: "circle_tangent", entityKind: "circle" }
    ],
    [
      "arc_arc",
      { entityId: "arc_a", entityKind: "arc" },
      { entityId: "arc_b", entityKind: "arc" }
    ]
  ] as const)(
    "proves tangent %s lifecycle and validation",
    (suffix, primaryTarget, secondaryTarget) => {
      expectConstraintTransactionProof(
        {
          op: "sketch.constraint.create",
          id: `tangent_${suffix}`,
          name: `Tangent ${suffix}`,
          sketchId: "sketch_1",
          kind: "tangent",
          primaryTarget,
          secondaryTarget
        },
        {
          op: "sketch.constraint.create",
          id: `tangent_${suffix}_invalid`,
          name: "Invalid tangent",
          sketchId: "sketch_1",
          kind: "tangent",
          primaryTarget: { entityId: "missing_arc", entityKind: "arc" },
          secondaryTarget
        }
      );
    }
  );

  it.each(["concentric", "equalRadius"] as const)(
    "proves %s arc-circle and arc-arc target lifecycles",
    (kind) => {
      for (const [suffix, secondaryTarget] of [
        [
          "arc_circle",
          { entityId: "circle_same", entityKind: "circle" as const }
        ],
        ["arc_arc", { entityId: "arc_b", entityKind: "arc" as const }]
      ] as const) {
        expectConstraintTransactionProof(
          {
            op: "sketch.constraint.create",
            id: `${kind}_${suffix}`,
            name: `${kind} ${suffix}`,
            sketchId: "sketch_1",
            kind,
            primaryTarget: { entityId: "arc_a", entityKind: "arc" },
            secondaryTarget
          },
          {
            op: "sketch.constraint.create",
            id: `${kind}_${suffix}_invalid`,
            name: `Invalid ${kind}`,
            sketchId: "sketch_1",
            kind,
            primaryTarget: { entityId: "missing_arc", entityKind: "arc" },
            secondaryTarget
          }
        );
      }
    }
  );

  it("proves symmetry arc point target lifecycle and validation", () => {
    const engine = createArcSolverEngine();
    engine.apply({
      op: "sketch.addArc",
      sketchId: "sketch_1",
      id: "arc_symmetric",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: -45,
        sweepAngleDegrees: 90
      }
    });
    const op: CadOp = {
      op: "sketch.constraint.create",
      id: "symmetry_arc_points",
      name: "Symmetric arc endpoints",
      sketchId: "sketch_1",
      kind: "symmetry",
      primaryTarget: {
        entityId: "arc_symmetric",
        entityKind: "arc",
        role: "start"
      },
      secondaryTarget: {
        entityId: "arc_symmetric",
        entityKind: "arc",
        role: "end"
      },
      symmetryLineEntityId: "axis"
    };
    const before = engine.createSnapshot();
    const dry = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [op]
    });
    expect(dry).toMatchObject({ ok: true });
    expect(engine.createSnapshot()).toEqual(before);
    const commit = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [op]
    });
    expect(commit).toMatchObject({
      ok: true,
      createdSketchConstraintIds: ["symmetry_arc_points"]
    });
    expect(
      engine.getTransactions().at(-1)?.diff.sketchConstraints?.created
    ).toEqual([
      expect.objectContaining({ id: "symmetry_arc_points", kind: "symmetry" })
    ]);
    const committed = engine.createSnapshot();
    engine.undo();
    expect(engine.createSnapshot()).toEqual(before);
    engine.redo();
    expect(engine.createSnapshot()).toEqual(committed);
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            ...op,
            id: "symmetry_arc_invalid",
            symmetryLineEntityId: "missing_line"
          }
        ]
      })
    ).toMatchObject({ ok: false, error: { code: "SKETCH_ENTITY_NOT_FOUND" } });
  });

  it("drives arc radius and signed sweep from literal and parameter sources", () => {
    const engine = createArcSolverEngine();
    engine.apply({
      op: "parameter.create",
      id: "arc_radius",
      name: "Arc Radius",
      value: 4
    });
    const before = engine.createSnapshot();
    const ops: readonly CadOp[] = [
      {
        op: "sketch.dimension.create",
        id: "dim_arc_radius",
        name: "Arc radius",
        sketchId: "sketch_1",
        entityId: "arc_a",
        target: { entityKind: "arc", role: "radius" },
        parameterId: "arc_radius"
      },
      {
        op: "sketch.dimension.create",
        id: "dim_arc_sweep",
        name: "Arc sweep",
        sketchId: "sketch_1",
        entityId: "arc_b",
        target: { entityKind: "arc", role: "sweep" },
        value: 30
      }
    ];
    expect(
      engine.executeBatch({ version: "cadops.v1", mode: "dryRun", ops })
    ).toMatchObject({ ok: true });
    expect(engine.createSnapshot()).toEqual(before);
    expect(
      engine.executeBatch({ version: "cadops.v1", mode: "commit", ops })
    ).toMatchObject({
      ok: true,
      createdSketchDimensionIds: ["dim_arc_radius", "dim_arc_sweep"],
      modifiedSketchEntityIds: expect.arrayContaining(["arc_a", "arc_b"])
    });
    const entities = engine.getDocument().sketches.get("sketch_1")!.entities;
    expect(entities.get("arc_a")).toMatchObject({ radius: 4 });
    expect(entities.get("arc_b")).toMatchObject({ sweepAngleDegrees: -30 });
    expect(
      engine.getTransactions().at(-1)?.diff.sketchDimensions?.created
    ).toHaveLength(2);
    const committed = engine.createSnapshot();
    engine.undo();
    expect(engine.createSnapshot()).toEqual(before);
    engine.redo();
    expect(engine.createSnapshot()).toEqual(committed);

    engine.apply({ op: "parameter.update", id: "arc_radius", value: 5 });
    expect(
      engine.getDocument().sketches.get("sketch_1")!.entities.get("arc_a")
    ).toMatchObject({ radius: 5 });
    expect(readSolverStatus(engine)).toMatchObject({
      ok: true,
      status: expect.stringMatching(/defined|over-defined/)
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.health" }
      })
    ).toMatchObject({
      ok: true,
      sketchDimensions: expect.arrayContaining([
        expect.objectContaining({
          dimensionId: "dim_arc_radius",
          parameterId: "arc_radius",
          effectiveValue: 5,
          status: "healthy"
        })
      ])
    });
    expect(
      engine.getTransactions().at(-1)?.diff.sketches?.entitiesModified
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "arc_a" })])
    );

    const stable = exportCadProjectJson(engine);
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "sketch.dimension.create",
            id: "dim_arc_sweep_invalid",
            name: "Invalid sweep",
            sketchId: "sketch_1",
            entityId: "arc_a",
            target: { entityKind: "arc", role: "sweep" },
            value: 0
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "SKETCH_ARC_DIMENSION_INVALID" }
    });
    expect(exportCadProjectJson(engine)).toBe(stable);
  });

  it("reports under, fully, over, and conflicting arc solver states with residual evidence", () => {
    const createSingleArcEngine = () => {
      const engine = new CadEngine();
      engine.applyBatch([
        {
          op: "sketch.create",
          id: "sketch_1",
          name: "Arc states",
          plane: "XY"
        },
        {
          op: "sketch.addArc",
          sketchId: "sketch_1",
          id: "arc_state",
          definition: {
            kind: "centerAngles",
            center: [0, 0],
            radius: 2,
            startAngleDegrees: 0,
            sweepAngleDegrees: 90
          }
        }
      ]);
      return engine;
    };

    const engine = createSingleArcEngine();
    expect(readSolverStatus(engine)).toMatchObject({
      status: "under-defined",
      solver: {
        numericalSolverStatus: "under-defined",
        variableCount: 5,
        degreesOfFreedomEstimate: 5,
        maxResidual: expect.any(Number),
        rmsResidual: expect.any(Number)
      }
    });
    engine.applyBatch([
      {
        op: "sketch.constraint.create",
        id: "fix_center",
        name: "Fix center",
        sketchId: "sketch_1",
        kind: "fixed",
        target: { entityId: "arc_state", entityKind: "arc", role: "center" }
      },
      {
        op: "sketch.constraint.create",
        id: "fix_start",
        name: "Fix start",
        sketchId: "sketch_1",
        kind: "fixed",
        target: { entityId: "arc_state", entityKind: "arc", role: "start" }
      },
      {
        op: "sketch.dimension.create",
        id: "dim_sweep_state",
        name: "Sweep",
        sketchId: "sketch_1",
        entityId: "arc_state",
        target: { entityKind: "arc", role: "sweep" },
        value: 90
      }
    ]);
    expect(readSolverStatus(engine)).toMatchObject({
      status: "fully-defined",
      solver: {
        numericalSolverStatus: "converged",
        degreesOfFreedomEstimate: 0,
        maxResidual: expect.any(Number),
        rmsResidual: expect.any(Number)
      }
    });
    engine.apply({
      op: "sketch.constraint.create",
      id: "fix_end_redundant",
      name: "Fix end redundantly",
      sketchId: "sketch_1",
      kind: "fixed",
      target: { entityId: "arc_state", entityKind: "arc", role: "end" }
    });
    expect(readSolverStatus(engine)).toMatchObject({
      status: "over-defined",
      solver: {
        numericalSolverStatus: "over-defined",
        maxResidual: expect.any(Number),
        rmsResidual: expect.any(Number)
      }
    });

    const conflicting = createSingleArcEngine();
    const conflictingDocument = conflicting.getDocument();
    const conflictingConstraints = new Map(
      conflictingDocument.sketchConstraints
    );
    conflictingConstraints.set("fix_center_a", {
      id: "fix_center_a",
      name: "First center",
      sketchId: "sketch_1",
      entityId: "arc_state",
      kind: "fixed",
      target: { entityId: "arc_state", entityKind: "arc", role: "center" },
      coordinate: [0, 0]
    });
    conflictingConstraints.set("fix_center_b", {
      id: "fix_center_b",
      name: "Conflicting center",
      sketchId: "sketch_1",
      entityId: "arc_state",
      kind: "fixed",
      target: { entityId: "arc_state", entityKind: "arc", role: "center" },
      coordinate: [3, 0]
    });
    const conflictingSketch = conflictingDocument.sketches.get("sketch_1")!;
    const conflictingStatus = createSketchSolverStatusResponse({
      cadOpsVersion: "cadops.v1",
      document: {
        ...conflictingDocument,
        sketchConstraints: conflictingConstraints
      },
      sketch: conflictingSketch,
      currentProjectSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V21
    });
    expect(conflictingStatus).toMatchObject({
      status: "conflicting",
      solver: {
        numericalSolverStatus: "conflicting",
        maxResidual: expect.any(Number),
        rmsResidual: expect.any(Number)
      },
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "SKETCH_SOLVER_CONFLICTING" })
      ])
    });
  });

  it("rejects unsupported arc rows and preserves source on finite-support tangency failure", () => {
    const engine = createArcSolverEngine();
    const unsupportedOps = [
      {
        op: "sketch.constraint.create",
        id: "midpoint_arc",
        name: "Midpoint arc",
        sketchId: "sketch_1",
        kind: "midpoint",
        lineEntityId: "line_tangent",
        target: { entityId: "arc_a", entityKind: "arc", role: "start" }
      },
      {
        op: "sketch.constraint.create",
        id: "parallel_arc",
        name: "Parallel arc",
        sketchId: "sketch_1",
        kind: "parallel",
        primaryLineEntityId: "arc_a",
        secondaryLineEntityId: "line_tangent"
      },
      {
        op: "sketch.constraint.create",
        id: "equal_length_arc",
        name: "Equal length arc",
        sketchId: "sketch_1",
        kind: "equalLength",
        primaryLineEntityId: "arc_a",
        secondaryLineEntityId: "line_tangent"
      },
      {
        op: "sketch.constraint.create",
        id: "angle_arc",
        name: "Angle arc",
        sketchId: "sketch_1",
        kind: "angle",
        primaryLineEntityId: "arc_a",
        secondaryLineEntityId: "line_tangent",
        angleDegrees: 45
      }
    ] as unknown as readonly CadOp[];
    for (const op of unsupportedOps) {
      expect(
        engine.executeBatch({ version: "cadops.v1", mode: "dryRun", ops: [op] })
      ).toMatchObject({
        ok: false,
        error: { code: "INVALID_SKETCH_CONSTRAINT" }
      });
    }

    engine.apply({
      op: "sketch.addArc",
      sketchId: "sketch_1",
      id: "arc_outside",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 90,
        sweepAngleDegrees: 90
      }
    });
    const before = exportCadProjectJson(engine);
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.constraint.create",
            id: "tangent_outside",
            name: "Tangency outside finite arc",
            sketchId: "sketch_1",
            kind: "tangent",
            primaryTarget: { entityId: "line_tangent", entityKind: "line" },
            secondaryTarget: { entityId: "arc_outside", entityKind: "arc" }
          }
        ]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "SKETCH_TANGENCY_OUTSIDE_ARC" }
    });
    expect(exportCadProjectJson(engine)).toBe(before);
  });

  it("round-trips V21 arc solver source and transaction history through JSON and WCAD", async () => {
    const engine = createArcSolverEngine();
    engine.apply({
      op: "sketch.constraint.create",
      id: "coincident_roundtrip",
      name: "Coincident roundtrip",
      sketchId: "sketch_1",
      kind: "coincident",
      primaryTarget: { entityId: "arc_a", entityKind: "arc", role: "start" },
      secondaryTarget: { entityId: "point_start", role: "position" }
    });
    engine.apply({
      op: "sketch.dimension.create",
      id: "sweep_roundtrip",
      name: "Sweep roundtrip",
      sketchId: "sketch_1",
      entityId: "arc_b",
      target: { entityKind: "arc", role: "sweep" },
      value: 45
    });
    const project = exportCadProject(engine);
    expect(project.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V21);
    const jsonRestored = importCadProjectJson(exportCadProjectJson(engine));
    expect(exportCadProject(jsonRestored)).toEqual(project);

    const wcad = await exportCadProjectToWcad(project);
    const read = await readCadProjectWcad(wcad.bytes);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.project).toEqual(project);
      expect(read.project.history.map((entry) => entry.ops)).toEqual(
        project.history.map((entry) => entry.ops)
      );
    }
  });
});
