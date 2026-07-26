import { CadEngine } from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import {
  CadOpsAgentAdapter,
  executeCadOpsAgentQueryRequest,
  parseCadOpsAgentQueryRequest,
  parseCadOpsAgentRequest
} from "./index";

const point = (entityId: string) => ({
  entityId,
  entityKind: "point" as const,
  role: "position" as const
});

const linePoint = (entityId: string, role: "start" | "end") => ({
  entityId,
  entityKind: "line" as const,
  role
});

const centerPoint = (entityId: string, entityKind: "rectangle" | "circle") => ({
  entityId,
  entityKind,
  role: "center" as const
});

const arcPoint = (entityId: string, role: "center" | "start" | "end") => ({
  entityId,
  entityKind: "arc" as const,
  role
});

const curve = (entityId: string, entityKind: "line" | "circle" | "arc") => ({
  entityId,
  entityKind
});

const commonCreate = {
  op: "sketch.constraint.create",
  name: "Constraint",
  sketchId: "sketch_1"
} as const;

const constraintCreates = [
  { ...commonCreate, kind: "horizontal", entityId: "line_a" },
  { ...commonCreate, kind: "vertical", entityId: "line_a" },
  {
    ...commonCreate,
    kind: "fixed",
    target: point("point_a"),
    coordinate: [0, 0]
  },
  {
    ...commonCreate,
    kind: "fixed",
    target: linePoint("line_a", "start"),
    coordinate: [0, 0]
  },
  {
    ...commonCreate,
    kind: "fixed",
    target: centerPoint("rectangle_a", "rectangle"),
    coordinate: [0, 0]
  },
  {
    ...commonCreate,
    kind: "fixed",
    target: centerPoint("circle_a", "circle"),
    coordinate: [0, 0]
  },
  {
    ...commonCreate,
    kind: "fixed",
    target: arcPoint("arc_a", "end"),
    coordinate: [0, 0]
  },
  {
    ...commonCreate,
    kind: "coincident",
    primaryTarget: point("point_a"),
    secondaryTarget: point("point_b")
  },
  {
    ...commonCreate,
    kind: "midpoint",
    lineEntityId: "line_a",
    target: point("point_a")
  },
  {
    ...commonCreate,
    kind: "midpoint",
    lineEntityId: "line_a",
    target: centerPoint("rectangle_a", "rectangle")
  },
  {
    ...commonCreate,
    kind: "midpoint",
    lineEntityId: "line_a",
    target: centerPoint("circle_a", "circle")
  },
  {
    ...commonCreate,
    kind: "parallel",
    primaryLineEntityId: "line_a",
    secondaryLineEntityId: "line_b"
  },
  {
    ...commonCreate,
    kind: "perpendicular",
    primaryLineEntityId: "line_a",
    secondaryLineEntityId: "line_b"
  },
  {
    ...commonCreate,
    kind: "tangent",
    primaryTarget: curve("line_a", "line"),
    secondaryTarget: curve("circle_a", "circle")
  },
  {
    ...commonCreate,
    kind: "tangent",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("line_a", "line")
  },
  {
    ...commonCreate,
    kind: "tangent",
    primaryTarget: curve("line_a", "line"),
    secondaryTarget: curve("arc_a", "arc")
  },
  {
    ...commonCreate,
    kind: "tangent",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("line_a", "line")
  },
  {
    ...commonCreate,
    kind: "tangent",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("arc_a", "arc")
  },
  {
    ...commonCreate,
    kind: "tangent",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("circle_a", "circle")
  },
  {
    ...commonCreate,
    kind: "tangent",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("arc_b", "arc")
  },
  {
    ...commonCreate,
    kind: "concentric",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("arc_a", "arc")
  },
  {
    ...commonCreate,
    kind: "concentric",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("circle_b", "circle")
  },
  {
    ...commonCreate,
    kind: "concentric",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("circle_a", "circle")
  },
  {
    ...commonCreate,
    kind: "concentric",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("arc_b", "arc")
  },
  {
    ...commonCreate,
    kind: "equalRadius",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("arc_a", "arc")
  },
  {
    ...commonCreate,
    kind: "equalRadius",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("circle_b", "circle")
  },
  {
    ...commonCreate,
    kind: "equalRadius",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("circle_a", "circle")
  },
  {
    ...commonCreate,
    kind: "equalRadius",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("arc_b", "arc")
  },
  {
    ...commonCreate,
    kind: "equalLength",
    primaryLineEntityId: "line_a",
    secondaryLineEntityId: "line_b"
  },
  {
    ...commonCreate,
    kind: "symmetry",
    primaryTarget: point("point_a"),
    secondaryTarget: point("point_b"),
    symmetryLineEntityId: "line_a"
  }
] as const;

const constraintDefinitions = [
  ...constraintCreates.map(({ op, name, sketchId, ...definition }) => {
    void op;
    void name;
    void sketchId;
    return definition;
  }),
  {
    kind: "angle",
    primaryLineEntityId: "line_a",
    secondaryLineEntityId: "line_b",
    angleDegrees: 45
  }
] as const;

const dimensionTargets = [
  {
    kind: "entityScalar",
    entityId: "rectangle_a",
    entityKind: "rectangle",
    role: "width"
  },
  {
    kind: "entityScalar",
    entityId: "rectangle_a",
    entityKind: "rectangle",
    role: "height"
  },
  {
    kind: "entityScalar",
    entityId: "line_a",
    entityKind: "line",
    role: "length"
  },
  {
    kind: "entityScalar",
    entityId: "circle_a",
    entityKind: "circle",
    role: "radius"
  },
  {
    kind: "entityScalar",
    entityId: "circle_a",
    entityKind: "circle",
    role: "diameter"
  },
  {
    kind: "entityScalar",
    entityId: "arc_a",
    entityKind: "arc",
    role: "radius"
  },
  {
    kind: "entityScalar",
    entityId: "arc_a",
    entityKind: "arc",
    role: "diameter"
  },
  {
    kind: "entityScalar",
    entityId: "arc_a",
    entityKind: "arc",
    role: "sweep"
  },
  {
    kind: "pointPair",
    primary: point("point_a"),
    secondary: point("point_b"),
    measurement: "distance"
  },
  {
    kind: "pointPair",
    primary: point("point_a"),
    secondary: point("point_b"),
    measurement: "horizontal",
    direction: "positive"
  },
  {
    kind: "pointPair",
    primary: point("point_a"),
    secondary: point("point_b"),
    measurement: "horizontal",
    direction: "negative"
  },
  {
    kind: "pointPair",
    primary: point("point_a"),
    secondary: point("point_b"),
    measurement: "vertical",
    direction: "positive"
  },
  {
    kind: "pointPair",
    primary: point("point_a"),
    secondary: point("point_b"),
    measurement: "vertical",
    direction: "negative"
  },
  {
    kind: "pointLineDistance",
    point: point("point_a"),
    lineEntityId: "line_a",
    side: "left"
  },
  {
    kind: "pointLineDistance",
    point: point("point_a"),
    lineEntityId: "line_a",
    side: "right"
  },
  {
    kind: "lineAngle",
    primaryLineEntityId: "line_a",
    secondaryLineEntityId: "line_b",
    sense: "clockwise"
  },
  {
    kind: "lineAngle",
    primaryLineEntityId: "line_a",
    secondaryLineEntityId: "line_b",
    sense: "counterclockwise"
  }
] as const;

const dimensionLiteral = (target: (typeof dimensionTargets)[number]) =>
  target.kind === "lineAngle" ||
  (target.kind === "entityScalar" && target.role === "sweep")
    ? 45
    : 5;

const distanceTarget = dimensionTargets[8];

function request(ops: readonly unknown[]) {
  return {
    requestId: "d5_agent_parity",
    adapterVersion: "web-cad.agent-adapter.v1",
    actor: { type: "agent", id: "d5-agent" },
    batch: {
      version: "cadops.v1",
      mode: "dryRun",
      ops,
      audit: {
        source: "agent-test",
        requestId: "d5_agent_parity",
        toolName: "cad.batch",
        intent: "dryRun",
        operationCount: ops.length
      }
    }
  } as const;
}

describe("V19 D5 agent dimension and constraint parity", () => {
  it("strictly accepts every normalized dimension and Decision 14 command row", () => {
    const dimensionOps = dimensionTargets.flatMap((target, index) => {
      const literalOps = [
        {
          op: "sketch.dimension.create",
          id: `dimension_literal_${index}`,
          name: `Dimension ${index}`,
          sketchId: "sketch_1",
          target,
          value: dimensionLiteral(target)
        },
        {
          op: "sketch.dimension.update",
          id: `dimension_literal_${index}`,
          target,
          value: dimensionLiteral(target)
        }
      ];
      return target.kind === "lineAngle"
        ? literalOps
        : [
            ...literalOps,
            {
              op: "sketch.dimension.create",
              id: `dimension_parameter_${index}`,
              name: `Parameter dimension ${index}`,
              sketchId: "sketch_1",
              target,
              parameterId: "parameter_1"
            },
            {
              op: "sketch.dimension.update",
              id: `dimension_parameter_${index}`,
              target,
              parameterId: "parameter_1"
            }
          ];
    });
    const constraintOps = [
      ...constraintCreates.map((op, index) => ({
        ...op,
        id: `constraint_create_${index}`
      })),
      ...constraintDefinitions.map((definition, index) => ({
        op: "sketch.constraint.update",
        id: `constraint_update_${index}`,
        definition
      })),
      { op: "sketch.dimension.rename", id: "dimension_0", name: "Renamed" },
      { op: "sketch.dimension.delete", id: "dimension_0" },
      { op: "sketch.constraint.rename", id: "constraint_0", name: "Renamed" },
      { op: "sketch.constraint.delete", id: "constraint_0" }
    ];

    const parsed = parseCadOpsAgentRequest(
      request([...dimensionOps, ...constraintOps])
    );
    expect(parsed.batch.ops).toHaveLength(
      dimensionOps.length +
        constraintCreates.length +
        constraintDefinitions.length +
        4
    );
    expect(parsed.actor).toEqual({ type: "agent", id: "d5-agent" });
    expect(parsed.batch.audit).toMatchObject({
      source: "agent-test",
      operationCount: parsed.batch.ops.length
    });
  });

  it("rejects unknown fields on every exact D5 union member", () => {
    const exactOps = [
      ...dimensionTargets.map((target, index) => ({
        op: "sketch.dimension.create",
        id: `dimension_${index}`,
        name: "Dimension",
        sketchId: "sketch_1",
        target,
        value: dimensionLiteral(target)
      })),
      ...constraintCreates,
      ...constraintDefinitions.map((definition, index) => ({
        op: "sketch.constraint.update",
        id: `constraint_${index}`,
        definition
      })),
      { op: "sketch.dimension.rename", id: "dimension_0", name: "Renamed" },
      { op: "sketch.dimension.delete", id: "dimension_0" },
      { op: "sketch.constraint.rename", id: "constraint_0", name: "Renamed" },
      { op: "sketch.constraint.delete", id: "constraint_0" }
    ];

    for (const op of exactOps) {
      expect(() =>
        parseCadOpsAgentRequest(request([{ ...op, viewportToken: "opaque" }]))
      ).toThrow("Invalid CADOps agent adapter request.");
    }
    expect(() =>
      parseCadOpsAgentRequest(
        request([
          {
            op: "sketch.dimension.create",
            name: "Invalid source shape",
            sketchId: "sketch_1",
            target: {
              ...dimensionTargets[0],
              sourceShape: "v22"
            },
            value: 5
          }
        ])
      )
    ).toThrow("Invalid CADOps agent adapter request.");
    for (const op of [
      {
        op: "sketch.dimension.create",
        name: "Mixed",
        sketchId: "sketch_1",
        entityId: "circle_a",
        target: dimensionTargets[4],
        value: 5
      },
      {
        op: "sketch.dimension.create",
        name: "Parameterized angle",
        sketchId: "sketch_1",
        target: dimensionTargets[15],
        parameterId: "parameter_1"
      },
      {
        op: "sketch.dimension.update",
        id: "angle",
        target: dimensionTargets[16],
        parameterId: "parameter_1"
      }
    ]) {
      expect(() => parseCadOpsAgentRequest(request([op]))).toThrow(
        "Invalid CADOps agent adapter request."
      );
    }
  });

  it("rejects unknown agent envelope, query, permission, and source fields", () => {
    const valid = request([]);
    for (const invalid of [
      { ...valid, screenshot: "opaque" },
      { ...valid, filesystemPath: "/tmp/model.wcad" },
      {
        ...valid,
        permissions: { allowCommit: false, candidateToken: "opaque" }
      },
      {
        ...valid,
        source: {
          source: "agent-test",
          toolName: "cad.batch",
          viewportToken: "opaque"
        }
      }
    ]) {
      expect(() => parseCadOpsAgentRequest(invalid)).toThrow(
        "Invalid CADOps agent adapter request."
      );
    }
    expect(() =>
      parseCadOpsAgentQueryRequest({
        requestId: "bad_query_envelope",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "project.summary" }
        },
        screenshot: "opaque"
      })
    ).toThrow("Invalid CADOps agent adapter query request.");
  });

  it("preserves V22 sourceShape projections and audit through a dimension lifecycle", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "D5", plane: "XY" },
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
        point: [3, 4]
      }
    ]);
    const adapter = new CadOpsAgentAdapter(engine);
    const create = adapter.execute({
      ...request([
        {
          op: "sketch.dimension.create",
          id: "distance",
          name: "Distance",
          sketchId: "sketch_1",
          target: distanceTarget,
          value: 5
        }
      ]),
      requestId: "d5_dimension_create",
      permissions: { allowCommit: true },
      batch: {
        ...request([]).batch,
        mode: "commit",
        ops: [
          {
            op: "sketch.dimension.create",
            id: "distance",
            name: "Distance",
            sketchId: "sketch_1",
            target: distanceTarget,
            value: 5
          }
        ],
        audit: {
          source: "agent-test",
          requestId: "d5_dimension_create",
          toolName: "cad.batch",
          intent: "commit",
          operationCount: 1
        }
      }
    });
    expect(create).toMatchObject({
      ok: true,
      createdSketchDimensionIds: ["distance"],
      semanticDiff: {
        sketchDimensions: {
          created: [
            {
              sourceShape: "v22",
              id: "distance",
              target: distanceTarget
            }
          ]
        }
      },
      audit: {
        requestId: "d5_dimension_create",
        operationCount: 1
      },
      review: {
        operations: [
          {
            op: "sketch.dimension.create",
            sketchDimensionId: "distance"
          }
        ]
      }
    });

    const dimensions = executeCadOpsAgentQueryRequest(engine, {
      requestId: "d5_dimensions",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "sketch.dimensions", sketchId: "sketch_1" }
      }
    });
    expect(dimensions).toMatchObject({
      ok: true,
      dimensions: [
        {
          sourceShape: "v22",
          id: "distance",
          target: distanceTarget
        }
      ]
    });
    if (dimensions.ok && dimensions.query === "sketch.dimensions") {
      expect("entityId" in dimensions.dimensions[0]!).toBe(false);
    }
    for (const query of [
      { query: "sketch.dimension.get", id: "distance" },
      { query: "sketch.solverStatus", sketchId: "sketch_1" },
      { query: "sketch.evaluation", sketchId: "sketch_1" }
    ] as const) {
      const projected = executeCadOpsAgentQueryRequest(engine, {
        requestId: `d5_${query.query}`,
        adapterVersion: "web-cad.agent-adapter.v1",
        query: { version: "cadops.v1", query }
      });
      expect(projected).toMatchObject({ ok: true });
      const entries =
        projected.ok && projected.query === "sketch.dimension.get"
          ? [projected.dimension]
          : projected.ok &&
              (projected.query === "sketch.solverStatus" ||
                projected.query === "sketch.evaluation")
            ? projected.dimensions
            : [];
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceShape: "v22",
            target: distanceTarget
          })
        ])
      );
      expect(
        "id" in entries[0]!
          ? entries[0]!.id
          : "dimensionId" in entries[0]!
            ? entries[0]!.dimensionId
            : undefined
      ).toBe("distance");
      expect(entries[0]).not.toHaveProperty("entityId");
    }

    const lifecycle = adapter.execute({
      requestId: "d5_dimension_lifecycle",
      adapterVersion: "web-cad.agent-adapter.v1",
      actor: { type: "agent", id: "d5-agent" },
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          { op: "sketch.dimension.update", id: "distance", value: 6 },
          { op: "sketch.dimension.rename", id: "distance", name: "Six" },
          { op: "sketch.dimension.delete", id: "distance" }
        ]
      }
    });
    expect(lifecycle).toMatchObject({
      ok: true,
      modifiedSketchDimensionIds: ["distance"],
      deletedSketchDimensionIds: ["distance"],
      audit: {
        source: "agent-adapter",
        requestId: "d5_dimension_lifecycle",
        operationCount: 3
      },
      review: {
        operations: [
          { op: "sketch.dimension.update", intent: "modify" },
          { op: "sketch.dimension.rename", intent: "modify" },
          {
            op: "sketch.dimension.delete",
            intent: "delete",
            destructive: true
          }
        ]
      }
    });
    expect(engine.getTransactions().at(-1)?.audit).toEqual(lifecycle.audit);
  });

  it("commits a constraint create/update/rename/delete lifecycle", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "D5", plane: "XY" },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "line_a",
        start: [0, 0],
        end: [4, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "line_b",
        start: [0, 2],
        end: [4, 2]
      }
    ]);
    const adapter = new CadOpsAgentAdapter(engine);
    const commit = (requestId: string, ops: readonly unknown[]) =>
      adapter.execute(
        parseCadOpsAgentRequest({
          requestId,
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: { version: "cadops.v1", mode: "commit", ops }
        })
      );
    expect(
      commit("constraint_create", [
        {
          op: "sketch.constraint.create",
          id: "horizontal",
          name: "Horizontal",
          sketchId: "sketch_1",
          kind: "horizontal",
          entityId: "line_a"
        }
      ])
    ).toMatchObject({
      ok: true,
      createdSketchConstraintIds: ["horizontal"]
    });
    expect(
      commit("constraint_lifecycle", [
        {
          op: "sketch.constraint.update",
          id: "horizontal",
          definition: { kind: "horizontal", entityId: "line_b" }
        },
        {
          op: "sketch.constraint.rename",
          id: "horizontal",
          name: "Other horizontal"
        },
        { op: "sketch.constraint.delete", id: "horizontal" }
      ])
    ).toMatchObject({
      ok: true,
      modifiedSketchConstraintIds: ["horizontal"],
      deletedSketchConstraintIds: ["horizontal"],
      review: {
        operations: [
          { op: "sketch.constraint.update", intent: "modify" },
          { op: "sketch.constraint.rename", intent: "modify" },
          { op: "sketch.constraint.delete", intent: "delete" }
        ]
      }
    });
  });
});
