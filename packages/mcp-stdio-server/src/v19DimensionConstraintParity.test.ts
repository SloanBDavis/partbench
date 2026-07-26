import { describe, expect, it } from "vitest";
import { createMcpStdioSession } from "./index";

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

const constraintCreates = [
  { kind: "horizontal", entityId: "line_a" },
  { kind: "vertical", entityId: "line_a" },
  { kind: "fixed", target: point("point_a"), coordinate: [0, 0] },
  {
    kind: "fixed",
    target: linePoint("line_a", "start"),
    coordinate: [0, 0]
  },
  {
    kind: "fixed",
    target: centerPoint("rectangle_a", "rectangle"),
    coordinate: [0, 0]
  },
  {
    kind: "fixed",
    target: centerPoint("circle_a", "circle"),
    coordinate: [0, 0]
  },
  {
    kind: "fixed",
    target: arcPoint("arc_a", "end"),
    coordinate: [0, 0]
  },
  {
    kind: "coincident",
    primaryTarget: point("point_a"),
    secondaryTarget: point("point_b")
  },
  { kind: "midpoint", lineEntityId: "line_a", target: point("point_a") },
  {
    kind: "midpoint",
    lineEntityId: "line_a",
    target: centerPoint("rectangle_a", "rectangle")
  },
  {
    kind: "midpoint",
    lineEntityId: "line_a",
    target: centerPoint("circle_a", "circle")
  },
  {
    kind: "parallel",
    primaryLineEntityId: "line_a",
    secondaryLineEntityId: "line_b"
  },
  {
    kind: "perpendicular",
    primaryLineEntityId: "line_a",
    secondaryLineEntityId: "line_b"
  },
  {
    kind: "tangent",
    primaryTarget: curve("line_a", "line"),
    secondaryTarget: curve("circle_a", "circle")
  },
  {
    kind: "tangent",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("line_a", "line")
  },
  {
    kind: "tangent",
    primaryTarget: curve("line_a", "line"),
    secondaryTarget: curve("arc_a", "arc")
  },
  {
    kind: "tangent",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("line_a", "line")
  },
  {
    kind: "tangent",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("arc_a", "arc")
  },
  {
    kind: "tangent",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("circle_a", "circle")
  },
  {
    kind: "tangent",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("arc_b", "arc")
  },
  {
    kind: "concentric",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("arc_a", "arc")
  },
  {
    kind: "concentric",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("circle_b", "circle")
  },
  {
    kind: "concentric",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("circle_a", "circle")
  },
  {
    kind: "concentric",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("arc_b", "arc")
  },
  {
    kind: "equalRadius",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("arc_a", "arc")
  },
  {
    kind: "equalRadius",
    primaryTarget: curve("circle_a", "circle"),
    secondaryTarget: curve("circle_b", "circle")
  },
  {
    kind: "equalRadius",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("circle_a", "circle")
  },
  {
    kind: "equalRadius",
    primaryTarget: curve("arc_a", "arc"),
    secondaryTarget: curve("arc_b", "arc")
  },
  {
    kind: "equalLength",
    primaryLineEntityId: "line_a",
    secondaryLineEntityId: "line_b"
  },
  {
    kind: "symmetry",
    primaryTarget: point("point_a"),
    secondaryTarget: point("point_b"),
    symmetryLineEntityId: "line_a"
  }
] as const;

const constraintDefinitions = [
  ...constraintCreates.map(({ kind, ...fields }) => ({ kind, ...fields })),
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

function callTool(
  session: ReturnType<typeof createMcpStdioSession>,
  id: string,
  name: string,
  arguments_: unknown
): Record<string, unknown> {
  return session.handleMessage(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: arguments_ }
    })
  ) as unknown as Record<string, unknown>;
}

function callBatch(
  session: ReturnType<typeof createMcpStdioSession>,
  id: string,
  ops: readonly unknown[],
  mode: "dryRun" | "commit" = "dryRun"
): Record<string, unknown> {
  return callTool(session, id, "cad.batch", {
    allowCommit: mode === "commit",
    batch: { version: "cadops.v1", mode, ops }
  });
}

function structuredContent(response: Record<string, unknown>) {
  return (
    response as {
      readonly result: {
        readonly structuredContent: Record<string, unknown>;
      };
    }
  ).result.structuredContent;
}

describe("V19 D5 stdio dimension and constraint parity", () => {
  it("transports the exact D5 cad.batch schema through tools/list", () => {
    const session = createMcpStdioSession();
    const response = session.handleMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "d5-tools",
        method: "tools/list"
      })
    ) as {
      readonly result: {
        readonly tools: readonly {
          readonly name: string;
          readonly description: string;
          readonly inputSchema: Record<string, unknown>;
        }[];
      };
    };
    const batch = response.result.tools.find(
      (tool) => tool.name === "cad.batch"
    );
    expect(batch?.description).toContain("lineAngle targets are literal-only");
    expect(batch?.description).toContain(
      "legacy angle supports update/rename/delete but not new create"
    );
    const schemas = (
      batch?.inputSchema as {
        properties: {
          batch: {
            properties: {
              ops: { items: { oneOf: readonly Record<string, unknown>[] } };
            };
          };
        };
      }
    ).properties.batch.properties.ops.items.oneOf;

    expect(schemas).toHaveLength(12);
    expect(schemas[3]).toMatchObject({
      additionalProperties: false,
      properties: {
        op: { const: "sketch.dimension.create" },
        target: { oneOf: expect.any(Array) }
      }
    });
    const constraintCreateVariants = (
      schemas[7] as {
        readonly oneOf: readonly {
          readonly additionalProperties: boolean;
          readonly properties: {
            readonly kind: { readonly const?: string };
          };
        }[];
      }
    ).oneOf;
    expect(
      constraintCreateVariants.some(
        (schema) =>
          !schema.additionalProperties &&
          schema.properties.kind.const === "symmetry"
      )
    ).toBe(true);
    expect(schemas[8]).toMatchObject({
      additionalProperties: false,
      properties: {
        op: { const: "sketch.constraint.update" },
        definition: { oneOf: expect.any(Array) }
      }
    });
  });

  it("carries every D5 union member through JSON-RPC with audit metadata", () => {
    const session = createMcpStdioSession();
    const ops = [
      ...dimensionTargets.flatMap((target, index) => {
        const literalOps = [
          {
            op: "sketch.dimension.create",
            id: `dimension_literal_${index}`,
            name: "Dimension",
            sketchId: "missing_sketch",
            target,
            value: dimensionLiteral(target)
          },
          {
            op: "sketch.dimension.update",
            id: `missing_dimension_literal_${index}`,
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
                name: "Parameter dimension",
                sketchId: "missing_sketch",
                target,
                parameterId: "parameter_1"
              },
              {
                op: "sketch.dimension.update",
                id: `missing_dimension_parameter_${index}`,
                target,
                parameterId: "parameter_1"
              }
            ];
      }),
      ...constraintCreates.map((fields, index) => ({
        op: "sketch.constraint.create",
        id: `constraint_${index}`,
        name: "Constraint",
        sketchId: "missing_sketch",
        ...fields
      })),
      ...constraintDefinitions.map((definition, index) => ({
        op: "sketch.constraint.update",
        id: `missing_constraint_${index}`,
        definition
      })),
      { op: "sketch.dimension.rename", id: "missing_dimension", name: "Name" },
      { op: "sketch.dimension.delete", id: "missing_dimension" },
      {
        op: "sketch.constraint.rename",
        id: "missing_constraint",
        name: "Name"
      },
      { op: "sketch.constraint.delete", id: "missing_constraint" }
    ];

    for (const [index, op] of ops.entries()) {
      const content = structuredContent(
        callBatch(session, `d5-stdio-${index}`, [op])
      );
      expect(content).toHaveProperty("error");
      expect(content).not.toMatchObject({
        error: { code: "INVALID_ARGUMENTS" }
      });
      expect(content).toMatchObject({
        ok: false,
        review: {
          operationCount: 1,
          operations: [{ op: (op as { op: string }).op }],
          audit: {
            source: "mcp",
            requestId: `mcp_jsonrpc_d5-stdio-${index}`,
            toolName: "cad.batch",
            intent: "dryRun"
          }
        }
      });
    }
    for (const invalid of [
      {
        op: "sketch.dimension.create",
        name: "Mixed",
        sketchId: "missing_sketch",
        entityId: "circle_a",
        target: dimensionTargets[4],
        value: 5
      },
      {
        op: "sketch.dimension.create",
        name: "Parameterized angle",
        sketchId: "missing_sketch",
        target: dimensionTargets[15],
        parameterId: "parameter_1"
      },
      {
        op: "sketch.dimension.update",
        id: "missing_angle",
        target: dimensionTargets[16],
        parameterId: "parameter_1"
      }
    ]) {
      expect(
        structuredContent(callBatch(session, "d5-stdio-invalid", [invalid]))
      ).toMatchObject({
        ok: false,
        error: { code: "INVALID_ARGUMENTS" }
      });
    }
  });

  it("round-trips V22 sourceShape, rename/delete, actor, and audit over stdio", () => {
    const session = createMcpStdioSession();
    expect(
      structuredContent(
        callBatch(
          session,
          "d5-setup",
          [
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
            },
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
          ],
          "commit"
        )
      )
    ).toMatchObject({ ok: true });
    const create = structuredContent(
      callBatch(
        session,
        "d5-create",
        [
          {
            op: "sketch.dimension.create",
            id: "distance",
            name: "Distance",
            sketchId: "sketch_1",
            target: distanceTarget,
            value: 5
          }
        ],
        "commit"
      )
    );
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
      actor: { type: "agent", id: "mcp" },
      audit: {
        source: "mcp",
        requestId: "mcp_jsonrpc_d5-create",
        toolName: "cad.batch",
        operationCount: 1
      }
    });

    const query = structuredContent(
      callTool(session, "d5-query", "cad.sketch_dimensions", {
        sketchId: "sketch_1"
      })
    );
    expect(query).toMatchObject({
      ok: true,
      requestId: "mcp_jsonrpc_d5-query",
      dimensions: [
        {
          sourceShape: "v22",
          id: "distance",
          target: distanceTarget
        }
      ]
    });
    const projected = (
      query as unknown as {
        readonly dimensions: readonly Record<string, unknown>[];
      }
    ).dimensions[0]!;
    expect(projected).not.toHaveProperty("entityId");
    for (const [id, name, arguments_] of [
      ["d5-get", "cad.sketch_dimension_get", { id: "distance" }],
      ["d5-solver", "cad.sketch_solver_status", { sketchId: "sketch_1" }],
      ["d5-evaluation", "cad.sketch_evaluation", { sketchId: "sketch_1" }]
    ] as const) {
      const content = structuredContent(
        callTool(session, id, name, arguments_)
      ) as {
        readonly ok: boolean;
        readonly dimension?: Record<string, unknown>;
        readonly dimensions?: readonly Record<string, unknown>[];
      };
      expect(content.ok).toBe(true);
      const entries = content.dimension
        ? [content.dimension]
        : (content.dimensions ?? []);
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceShape: "v22",
            target: distanceTarget
          })
        ])
      );
      expect(entries[0]?.id ?? entries[0]?.dimensionId).toBe("distance");
      expect(entries[0]).not.toHaveProperty("entityId");
    }

    const lifecycle = structuredContent(
      callBatch(
        session,
        "d5-lifecycle",
        [
          { op: "sketch.dimension.update", id: "distance", value: 6 },
          { op: "sketch.dimension.rename", id: "distance", name: "Six" },
          { op: "sketch.dimension.delete", id: "distance" }
        ],
        "commit"
      )
    );
    expect(lifecycle).toMatchObject({
      ok: true,
      modifiedSketchDimensionIds: ["distance"],
      deletedSketchDimensionIds: ["distance"],
      audit: {
        source: "mcp",
        requestId: "mcp_jsonrpc_d5-lifecycle",
        operationCount: 3
      },
      review: {
        operations: [
          { op: "sketch.dimension.update", intent: "modify" },
          { op: "sketch.dimension.rename", intent: "modify" },
          { op: "sketch.dimension.delete", intent: "delete" }
        ]
      }
    });

    expect(
      structuredContent(
        callBatch(
          session,
          "d5-constraint-create",
          [
            {
              op: "sketch.constraint.create",
              id: "horizontal",
              name: "Horizontal",
              sketchId: "sketch_1",
              kind: "horizontal",
              entityId: "line_a"
            }
          ],
          "commit"
        )
      )
    ).toMatchObject({
      ok: true,
      createdSketchConstraintIds: ["horizontal"]
    });
    expect(
      structuredContent(
        callBatch(
          session,
          "d5-constraint-lifecycle",
          [
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
          ],
          "commit"
        )
      )
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
