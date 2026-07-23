import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V19,
  CadEngine,
  exportCadProject,
  parseParameterExpression
} from "./index";

function createExpressionEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "parameter.create", id: "p_angle", name: "angle", value: 30 },
    { op: "parameter.create", id: "p_radius", name: "radius", value: 10 },
    { op: "parameter.create", id: "p_result", name: "result", value: 0 }
  ]);
  return engine;
}

function setResultExpression(engine: CadEngine, expression: string): void {
  engine.apply({
    op: "parameter.setExpression",
    id: "p_result",
    expression
  });
}

function resultValue(engine: CadEngine): number | undefined {
  return engine.getDocument().parameters.get("p_result")?.value;
}

describe("parameter expression language v2", () => {
  it("reports deeply nested expressions without leaking a stack overflow", () => {
    const depth = 20_000;
    const expression = `${"(".repeat(depth)}1${")".repeat(depth)}`;

    expect(parseParameterExpression(expression)).toMatchObject({
      ok: false,
      diagnostic: {
        code: "EXPRESSION_PARSE_ERROR",
        expected: "expression with shallower nesting",
        received: "parser recursion limit exceeded"
      }
    });
  });

  it("handles terminal tokens and incomplete lookahead without unsafe character reads", () => {
    for (const expression of ["42", "radius", "1."]) {
      expect(parseParameterExpression(expression)).toMatchObject({ ok: true });
    }

    expect(parseParameterExpression("[radius")).toMatchObject({
      ok: false,
      diagnostic: {
        code: "EXPRESSION_PARSE_ERROR",
        position: 0,
        expected: "]",
        received: "end of expression"
      }
    });
    expect(parseParameterExpression("@")).toMatchObject({
      ok: false,
      diagnostic: {
        code: "EXPRESSION_PARSE_ERROR",
        position: 0,
        received: "@"
      }
    });
  });

  it("evaluates degree-first trigonometry and explicit angle conversions", () => {
    const cases: readonly [string, number][] = [
      ["radius * sin(angle)", 5],
      ["radius * cos(60)", 5],
      ["tan(45)", 1],
      ["asin(0.5)", 30],
      ["acos(0.5)", 60],
      ["atan(1)", 45],
      ["atan2(1, 1)", 45],
      ["deg(3.141592653589793)", 180],
      ["rad(180)", Math.PI]
    ];

    for (const [expression, expected] of cases) {
      const engine = createExpressionEngine();
      setResultExpression(engine, expression);
      expect(resultValue(engine)).toBeCloseTo(expected, 12);
    }
  });

  it("evaluates comparisons, lazy ternaries, and lazy if calls", () => {
    const cases: readonly [string, number][] = [
      ["radius > 5 ? 2 : 1", 2],
      ["radius <= 5 ? 2 : 1", 1],
      ["radius == 10", 1],
      ["radius != 10", 0],
      ["0.1 + 0.2 == 0.3", 0],
      ["0 ? asin(2) : 7", 7],
      ["if(1, 8, asin(2))", 8],
      ["radius > 20 ? 1 : radius > 5 ? 3 : 2", 3]
    ];

    for (const [expression, expected] of cases) {
      const engine = createExpressionEngine();
      setResultExpression(engine, expression);
      expect(resultValue(engine)).toBe(expected);
    }
  });

  it("rejects domain errors and unsupported boolean-language tokens atomically", () => {
    for (const expression of ["asin(2)", "acos(-2)", "tan(90)"]) {
      const engine = createExpressionEngine();
      const response = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [{ op: "parameter.setExpression", id: "p_result", expression }]
      });
      expect(response).toMatchObject({
        ok: false,
        error: { code: "EXPRESSION_DOMAIN_ERROR", parameterId: "p_result" }
      });
      expect(engine.getDocument().parameters.get("p_result")).toMatchObject({
        value: 0
      });
      expect(
        engine.getDocument().parameters.get("p_result")?.expression
      ).toBeUndefined();
    }

    for (const expression of [
      "radius > 0 && angle < 90",
      "radius || angle",
      "!radius"
    ]) {
      const engine = createExpressionEngine();
      const response = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [{ op: "parameter.setExpression", id: "p_result", expression }]
      });
      expect(response).toMatchObject({
        ok: false,
        error: { code: "EXPRESSION_LANGUAGE_UNSUPPORTED_TOKEN" }
      });
    }
  });

  it("reports v2 portability without forcing a V20 schema", () => {
    const engine = createExpressionEngine();
    setResultExpression(engine, "radius * sin(angle)");

    const evaluation = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.parameterEvaluation" }
    });
    expect(evaluation).toMatchObject({
      ok: true,
      status: "valid",
      diagnostics: [
        expect.objectContaining({
          code: "EXPRESSION_LANGUAGE_V2_FEATURES_PRESENT"
        })
      ]
    });
    expect(exportCadProject(engine).schemaVersion).toBe(
      CAD_PROJECT_FORMAT_VERSION_V19
    );
  });
});
