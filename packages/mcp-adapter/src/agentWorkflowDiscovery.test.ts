import { describe, expect, it } from "vitest";
import {
  CAD_OPERATION_NAMES,
  CAD_PARAMETER_EXPRESSION_HELP
} from "@web-cad/agent-adapter";
import { createCadMcpServer } from "./index";

function fixture() {
  return { server: createCadMcpServer() };
}

describe("agent command discovery and bounded inspection", () => {
  it("discovers every command by name and exact nested curve/gear fields on demand", () => {
    const { server } = fixture();
    const catalog = server.callTool({ name: "cad.operation_schema" });
    expect(catalog.isError).toBe(false);
    expect(catalog.structuredContent).toMatchObject({
      ok: true,
      operations: CAD_OPERATION_NAMES
    });
    expect(JSON.stringify(catalog).length).toBeLessThan(10_000);
    for (const name of [
      "sketch.addLine",
      "sketch.addArc",
      "sketch.addSpline",
      "feature.combine",
      "feature.spurGear",
      "feature.updateSpurGear"
    ]) {
      const discovered = server.callTool({
        name: "cad.operation_schema",
        arguments: { operation: name }
      });
      expect(discovered.isError).toBe(false);
      expect(discovered.structuredContent).toMatchObject({
        ok: true,
        operation: name,
        schema: { type: "object", properties: { op: { const: name } } }
      });
    }
    expect(
      server.callTool({
        name: "cad.operation_schema",
        arguments: { operation: "sketch.addLine" }
      }).structuredContent
    ).toMatchObject({
      schema: {
        required: ["op", "sketchId", "start", "end"],
        properties: {
          start: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: [{ type: "number" }, { type: "number" }]
          }
        }
      }
    });
    const arc = server.callTool({
      name: "cad.operation_schema",
      arguments: { operation: "sketch.addArc" }
    });
    expect(JSON.stringify(arc)).toContain("pointOnArc");
    expect(JSON.stringify(arc)).toContain("sweepAngleDegrees");
    const gear = server.callTool({
      name: "cad.operation_schema",
      arguments: { operation: "feature.spurGear" }
    });
    expect(JSON.stringify(gear)).toContain("parameterId");
    expect(
      server.callTool({
        name: "cad.operation_schema",
        arguments: { operation: "feature.magicGear" }
      })
    ).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          diagnostics: [{ path: "$.operation", code: "UNKNOWN_OPERATION" }]
        }
      }
    });
    expect(JSON.stringify(server.listTools())).not.toContain("pointOnArc");
  });

  it("publishes truthful measurements and executable name-bound expression guidance", () => {
    const { server } = fixture();
    const tools = server.listTools().tools;
    const mass = tools.find(
      (tool) => tool.name === "cad.body_mass_properties"
    )!;
    expect(mass.description).toContain("centerOfMass");
    expect(mass.description).toContain(
      "optional momentsOfInertia/principalMoments"
    );
    expect(mass.description).not.toMatch(/bounds|bounding/i);
    const schema = server.callTool({
      name: "cad.operation_schema",
      arguments: { operation: "parameter.setExpression" }
    });
    expect(schema).toMatchObject({
      isError: false,
      structuredContent: {
        schema: {
          properties: {
            id: {
              description: expect.stringContaining(
                "ID of the parameter receiving"
              )
            },
            expression: { description: CAD_PARAMETER_EXPRESSION_HELP }
          }
        }
      }
    });
    expect(
      JSON.stringify(
        tools.find((tool) => tool.name === "cad.batch")?.inputSchema
      )
    ).toContain(CAD_PARAMETER_EXPRESSION_HELP);
    const commit = (ops: unknown[]) =>
      server.callTool({
        name: "cad.batch",
        arguments: {
          allowCommit: true,
          batch: { version: "cadops.v1", mode: "commit", ops }
        }
      });
    const expression = "module * (input_teeth + [Output Teeth]) / 2";
    expect(
      commit([
        { op: "parameter.create", id: "p_module", name: "module", value: 1.5 },
        {
          op: "parameter.create",
          id: "p_input",
          name: "input_teeth",
          value: 20
        },
        {
          op: "parameter.create",
          id: "p_output",
          name: "Output Teeth",
          value: 40
        },
        {
          op: "parameter.create",
          id: "p_spacing",
          name: "Center spacing",
          value: 0
        },
        { op: "parameter.setExpression", id: "p_spacing", expression }
      ]).isError
    ).toBe(false);
    const spacing = () =>
      server.callTool({
        name: "cad.parameter_get",
        arguments: { id: "p_spacing" }
      }).structuredContent;
    expect(spacing()).toMatchObject({
      ok: true,
      parameter: { id: "p_spacing", name: "Center spacing", value: 45 }
    });
    expect(
      commit([{ op: "parameter.update", id: "p_output", value: 60 }]).isError
    ).toBe(false);
    expect(spacing()).toMatchObject({ parameter: { value: 60, expression } });
    expect(
      commit([
        {
          op: "parameter.setExpression",
          id: "p_spacing",
          expression: "p_module * (input_teeth + [Output Teeth]) / 2"
        }
      ])
    ).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "PARAMETER_REF_NOT_FOUND" } }
    });
    expect(spacing()).toMatchObject({ parameter: { value: 60, expression } });
  });

  it("reports exact missing, mistyped, unknown and union-variant field paths without mutation", () => {
    const { server } = fixture();
    const before = server.callTool({
      name: "cad.transaction_history",
      requestId: "history"
    });
    const cases = [
      {
        op: { op: "sketch.addLine", sketchId: "s", start: [0, 0] },
        path: "$.batch.ops[0].end",
        code: "MISSING_FIELD"
      },
      {
        op: {
          op: "sketch.addLine",
          sketchId: "s",
          start: [0, "bad"],
          end: [2, 2]
        },
        path: "$.batch.ops[0].start[1]",
        code: "INVALID_TYPE"
      },
      {
        op: {
          op: "sketch.addArc",
          sketchId: "s",
          definition: {
            kind: "threePoint",
            start: [0, 0],
            end: [2, 0],
            middle: [1, 1]
          }
        },
        path: "$.batch.ops[0].definition.pointOnArc",
        code: "MISSING_FIELD"
      },
      {
        op: {
          op: "feature.combine",
          mode: "union",
          targetBodyId: "a",
          toolBodyIds: ["b"]
        },
        path: "$.batch.ops[0].toolBodyId",
        code: "MISSING_FIELD"
      },
      {
        op: {
          op: "feature.spurGear",
          id: "g",
          bodyId: "b",
          sketchId: "s",
          teeth: { parameter: "teeth" },
          module: 1.5,
          faceWidth: 10
        },
        path: "$.batch.ops[0].teeth.parameterId",
        code: "MISSING_FIELD"
      },
      {
        op: { op: "sketch.magic" },
        path: "$.batch.ops[0].op",
        code: "UNKNOWN_OPERATION"
      }
    ];
    for (const item of cases) {
      const response = server.callTool({
        name: "cad.batch",
        arguments: {
          allowCommit: true,
          batch: { version: "cadops.v1", mode: "commit", ops: [item.op] }
        }
      });
      expect(response, JSON.stringify(item)).toMatchObject({
        isError: true,
        structuredContent: {
          error: {
            code: "INVALID_ARGUMENTS",
            diagnostics: expect.arrayContaining([
              expect.objectContaining({ path: item.path, code: item.code })
            ])
          }
        }
      });
      expect(
        server.callTool({
          name: "cad.transaction_history",
          requestId: "history"
        })
      ).toEqual(before);
    }
  });

  it("returns filtered paginated authoritative instance transforms without definition payloads", () => {
    const { server } = fixture();
    const seed = server.callTool({
      name: "cad.batch",
      arguments: {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createBox",
              id: "box",
              dimensions: { width: 2, height: 3, depth: 4 }
            },
            { op: "assembly.create", id: "a", name: "A" },
            { op: "assembly.create", id: "b", name: "B" },
            ...["a", "b"].flatMap((assemblyId) =>
              Array.from({ length: 3 }, (_, i) => ({
                op: "assembly.instance.insert" as const,
                assemblyId,
                id: `${assemblyId}${i}`,
                definition: { kind: "body" as const, bodyId: "body:box" },
                transform: { translation: [i, 2, 3] as const }
              }))
            )
          ]
        }
      }
    });
    expect(seed.isError).toBe(false);
    const page = server.callTool({
      name: "cad.project_structure",
      arguments: { projection: "poses", assemblyIds: ["b"], limit: 2 }
    });
    expect(page.structuredContent).toMatchObject({
      ok: true,
      projection: "poses",
      totalInstanceCount: 3,
      nextOffset: 2,
      parts: [],
      features: [],
      bodies: [],
      objectSources: [],
      instancePoses: [
        { assemblyId: "b", id: "b0", transform: { translation: [0, 2, 3] } },
        { assemblyId: "b", id: "b1", transform: { translation: [1, 2, 3] } }
      ]
    });
    expect(JSON.stringify(page).length).toBeLessThan(2500);
    const last = server.callTool({
      name: "cad.project_structure",
      arguments: {
        projection: "poses",
        assemblyIds: ["b"],
        offset: 2,
        limit: 2
      }
    });
    expect(last.structuredContent).toMatchObject({
      totalInstanceCount: 3,
      instancePoses: [{ id: "b2" }]
    });
    expect(last.structuredContent).not.toHaveProperty("nextOffset");
    expect(
      server.callTool({
        name: "cad.project_structure",
        arguments: { projection: "poses", instanceIds: ["a1"] }
      }).structuredContent
    ).toMatchObject({
      totalInstanceCount: 1,
      instancePoses: [{ assemblyId: "a", id: "a1" }]
    });
    const full = server.callTool({ name: "cad.project_structure" });
    expect(full.structuredContent).toHaveProperty("assemblies");
    expect(full.structuredContent).not.toHaveProperty("projection");
    for (const arguments_ of [
      { projection: "poses", limit: 1001 },
      { projection: "poses", offset: -1 },
      { limit: 1 },
      { projection: "poses", assemblyIds: ["a", "a"] }
    ]) {
      expect(
        server.callTool({
          name: "cad.project_structure",
          arguments: arguments_
        }).isError
      ).toBe(true);
    }
  });
});
