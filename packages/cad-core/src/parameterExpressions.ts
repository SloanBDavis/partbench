import type {
  CadParameterEvaluationCycle,
  CadParameterEvaluationNode,
  CadParameterEvaluationStatus,
  CadParameterExpressionDiagnostic,
  CadParameterSnapshot,
  ParameterId
} from "@web-cad/cad-protocol";

type ExpressionAst =
  | { readonly kind: "literal"; readonly value: number }
  | { readonly kind: "parameter"; readonly name: string }
  | {
      readonly kind: "unary";
      readonly operator: "-";
      readonly operand: ExpressionAst;
    }
  | {
      readonly kind: "binary";
      readonly operator:
        | "+"
        | "-"
        | "*"
        | "/"
        | "<"
        | ">"
        | "<="
        | ">="
        | "=="
        | "!=";
      readonly left: ExpressionAst;
      readonly right: ExpressionAst;
    }
  | {
      readonly kind: "conditional";
      readonly condition: ExpressionAst;
      readonly whenTrue: ExpressionAst;
      readonly whenFalse: ExpressionAst;
    }
  | {
      readonly kind: "call";
      readonly name: string;
      readonly args: readonly ExpressionAst[];
    };

type Token =
  | {
      readonly kind: "number";
      readonly value: number;
      readonly raw: string;
      readonly position: number;
    }
  | {
      readonly kind: "identifier";
      readonly value: string;
      readonly position: number;
    }
  | {
      readonly kind: "parameterName";
      readonly value: string;
      readonly position: number;
    }
  | {
      readonly kind:
        | "+"
        | "-"
        | "*"
        | "/"
        | "<"
        | ">"
        | "<="
        | ">="
        | "=="
        | "!="
        | "?"
        | ":"
        | "("
        | ")"
        | ","
        | "eof";
      readonly position: number;
    };

interface ParsedExpression {
  readonly ast: ExpressionAst;
  readonly referenceNames: readonly string[];
}

export interface ParameterExpressionValueChange {
  readonly parameterId: ParameterId;
  readonly before: number;
  readonly after: number;
}

export interface ParameterExpressionEvaluationResult {
  readonly status: CadParameterEvaluationStatus;
  readonly nodes: readonly CadParameterEvaluationNode[];
  readonly evaluationOrder: readonly ParameterId[];
  readonly cycles: readonly CadParameterEvaluationCycle[];
  readonly diagnostics: readonly CadParameterExpressionDiagnostic[];
  readonly valueChanges: readonly ParameterExpressionValueChange[];
}

const BUILTIN_ARITIES = new Map<string, readonly number[]>([
  ["max", [2]],
  ["min", [2]],
  ["abs", [1]],
  ["sqrt", [1]],
  ["round", [1]],
  ["floor", [1]],
  ["ceil", [1]],
  ["sin", [1]],
  ["cos", [1]],
  ["tan", [1]],
  ["asin", [1]],
  ["acos", [1]],
  ["atan", [1]],
  ["atan2", [2]],
  ["deg", [1]],
  ["rad", [1]],
  ["if", [3]]
]);

export function parseParameterExpression(expression: string):
  | { readonly ok: true; readonly parsed: ParsedExpression }
  | {
      readonly ok: false;
      readonly diagnostic: CadParameterExpressionDiagnostic;
    } {
  const tokens = tokenizeExpression(expression);

  if (!tokens.ok) {
    return tokens;
  }

  const parser = new ExpressionParser(tokens.tokens, expression);
  try {
    return parser.parse();
  } catch (error) {
    if (error instanceof RangeError) {
      return {
        ok: false,
        diagnostic: {
          code: "EXPRESSION_PARSE_ERROR",
          message: "Parameter expression is too deeply nested to parse safely.",
          expression,
          position: 0,
          expected: "expression with shallower nesting",
          received: "parser recursion limit exceeded"
        }
      };
    }
    throw error;
  }
}

export function evaluateParameterExpressions(
  parameters: readonly CadParameterSnapshot[],
  extraDiagnostics: readonly CadParameterExpressionDiagnostic[] = []
): ParameterExpressionEvaluationResult {
  const parameterById = new Map(
    parameters.map((parameter) => [parameter.id, parameter])
  );
  const parameterIds = parameters.map((parameter) => parameter.id);
  const parameterNamesById = new Map(
    parameters.map((parameter) => [parameter.id, parameter.name] as const)
  );
  const parametersByName = createParameterNameIndex(parameters);
  const nodeDiagnostics = new Map<
    ParameterId,
    CadParameterExpressionDiagnostic[]
  >();
  const astById = new Map<ParameterId, ExpressionAst>();
  const referenceNamesById = new Map<ParameterId, readonly string[]>();
  const referencesById = new Map<ParameterId, readonly ParameterId[]>();
  const dependentsById = new Map<ParameterId, ParameterId[]>(
    parameterIds.map((id) => [id, []])
  );
  let usesV2Features = false;

  for (const parameter of parameters) {
    const expression = normalizeStoredExpression(parameter.expression);

    if (!expression) {
      referenceNamesById.set(parameter.id, []);
      referencesById.set(parameter.id, []);
      continue;
    }

    const parsed = parseParameterExpression(expression);

    if (!parsed.ok) {
      addNodeDiagnostic(
        nodeDiagnostics,
        parameter.id,
        withParameterContext(parsed.diagnostic, parameter, expression)
      );
      referenceNamesById.set(parameter.id, []);
      referencesById.set(parameter.id, []);
      continue;
    }

    astById.set(parameter.id, parsed.parsed.ast);
    usesV2Features ||= usesV2ExpressionAst(parsed.parsed.ast);
    referenceNamesById.set(parameter.id, parsed.parsed.referenceNames);

    const references: ParameterId[] = [];
    for (const referenceName of parsed.parsed.referenceNames) {
      const matches = parametersByName.get(referenceName) ?? [];
      const match = matches[0];

      if (!match) {
        addNodeDiagnostic(
          nodeDiagnostics,
          parameter.id,
          createDiagnostic({
            code: "PARAMETER_REF_NOT_FOUND",
            message: `Parameter expression references unknown parameter ${referenceName}.`,
            parameter,
            expression,
            referencedName: referenceName,
            expected: "existing parameter name",
            received: referenceName
          })
        );
        continue;
      }

      if (matches.length > 1) {
        addNodeDiagnostic(
          nodeDiagnostics,
          parameter.id,
          createDiagnostic({
            code: "PARAMETER_REF_AMBIGUOUS",
            message: `Parameter expression reference ${referenceName} is ambiguous.`,
            parameter,
            expression,
            referencedName: referenceName,
            expected: "unique parameter name",
            received: matches.map((match) => match.id).join(", ")
          })
        );
        continue;
      }

      references.push(match.id);
    }

    const uniqueReferences = [...new Set(references)];
    referencesById.set(parameter.id, uniqueReferences);

    for (const reference of uniqueReferences) {
      dependentsById.get(reference)?.push(parameter.id);
    }
  }

  const cycles = findParameterCycles(
    parameterIds,
    referencesById,
    parameterNamesById
  );
  const cycleParameterIds = new Set(
    cycles.flatMap((cycle) => cycle.parameterIds)
  );

  for (const cycle of cycles) {
    for (const parameterId of cycle.parameterIds) {
      const parameter = parameterById.get(parameterId);
      if (!parameter) {
        continue;
      }

      addNodeDiagnostic(
        nodeDiagnostics,
        parameterId,
        createDiagnostic({
          code: "PARAMETER_CIRCULAR_REFERENCE",
          message: `Parameter expression has a circular reference: ${cycle.parameterNames.join(" -> ")}.`,
          parameter,
          expression: normalizeStoredExpression(parameter.expression),
          cycle: cycle.parameterIds,
          expected: "acyclic parameter references",
          received: cycle.parameterNames.join(" -> ")
        })
      );
    }
  }

  const evaluationOrder = topologicallySortParameters(
    parameterIds,
    referencesById
  );
  const values = new Map(
    parameters.map((parameter) => [parameter.id, parameter.value])
  );
  const valueChanges: ParameterExpressionValueChange[] = [];

  for (const parameterId of evaluationOrder) {
    const parameter = parameterById.get(parameterId);
    const ast = astById.get(parameterId);

    if (!parameter || !ast || cycleParameterIds.has(parameterId)) {
      continue;
    }

    if ((nodeDiagnostics.get(parameterId)?.length ?? 0) > 0) {
      continue;
    }

    const evaluated = evaluateAst(ast, {
      parameter,
      expression: normalizeStoredExpression(parameter.expression),
      values,
      parametersByName
    });

    if (!evaluated.ok) {
      addNodeDiagnostic(nodeDiagnostics, parameterId, evaluated.diagnostic);
      continue;
    }

    const before = values.get(parameterId) ?? parameter.value;
    const after = cleanExpressionNumber(evaluated.value);

    if (!Object.is(before, after)) {
      values.set(parameterId, after);
      valueChanges.push({ parameterId, before, after });
    }
  }

  const nodes: CadParameterEvaluationNode[] = parameters.map((parameter) => {
    const diagnostics = nodeDiagnostics.get(parameter.id) ?? [];
    return {
      parameterId: parameter.id,
      name: parameter.name,
      value: values.get(parameter.id) ?? parameter.value,
      ...(normalizeStoredExpression(parameter.expression)
        ? { expression: normalizeStoredExpression(parameter.expression) }
        : {}),
      referenceNames: referenceNamesById.get(parameter.id) ?? [],
      references: referencesById.get(parameter.id) ?? [],
      dependents: dependentsById.get(parameter.id) ?? [],
      diagnostics
    };
  });

  const diagnostics = [
    ...nodes.flatMap((node) => node.diagnostics),
    ...extraDiagnostics,
    ...(usesV2Features
      ? [
          {
            code: "EXPRESSION_LANGUAGE_V2_FEATURES_PRESENT" as const,
            message:
              "Parameter expressions use V16 language features and require a V16-capable evaluator."
          }
        ]
      : [])
  ];
  const hasBlockingDiagnostics = diagnostics.some(
    (diagnostic) =>
      diagnostic.code !== "EXPRESSION_VALUE_INCONSISTENCY" &&
      diagnostic.code !== "EXPRESSION_LANGUAGE_V2_FEATURES_PRESENT"
  );

  return {
    status:
      cycles.length > 0
        ? "circular"
        : hasBlockingDiagnostics
          ? "invalid"
          : "valid",
    nodes,
    evaluationOrder,
    cycles,
    diagnostics,
    valueChanges
  };
}

function usesV2ExpressionAst(ast: ExpressionAst): boolean {
  switch (ast.kind) {
    case "literal":
    case "parameter":
      return false;
    case "unary":
      return usesV2ExpressionAst(ast.operand);
    case "conditional":
      return true;
    case "binary":
      return (
        isComparisonToken(ast.operator) ||
        usesV2ExpressionAst(ast.left) ||
        usesV2ExpressionAst(ast.right)
      );
    case "call":
      return (
        [
          "sin",
          "cos",
          "tan",
          "asin",
          "acos",
          "atan",
          "atan2",
          "deg",
          "rad",
          "if"
        ].includes(ast.name) || ast.args.some(usesV2ExpressionAst)
      );
  }
}

function tokenizeExpression(expression: string):
  | { readonly ok: true; readonly tokens: readonly Token[] }
  | {
      readonly ok: false;
      readonly diagnostic: CadParameterExpressionDiagnostic;
    } {
  const tokens: Token[] = [];
  let position = 0;

  while (position < expression.length) {
    const char = expression.charAt(position);

    if (/\s/.test(char)) {
      position += 1;
      continue;
    }

    if (/[0-9]/.test(char)) {
      const start = position;
      position += 1;
      while (
        position < expression.length &&
        /[0-9]/.test(expression.charAt(position))
      ) {
        position += 1;
      }
      if (expression.charAt(position) === ".") {
        position += 1;
        while (
          position < expression.length &&
          /[0-9]/.test(expression.charAt(position))
        ) {
          position += 1;
        }
      }
      const raw = expression.slice(start, position);
      const value = Number(raw);

      if (!Number.isFinite(value)) {
        return {
          ok: false,
          diagnostic: {
            code: "EXPRESSION_PARSE_ERROR",
            message: `Invalid numeric literal ${raw}.`,
            expression,
            position: start,
            expected: "finite numeric literal",
            received: raw
          }
        };
      }

      tokens.push({ kind: "number", raw, value, position: start });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = position;
      position += 1;
      while (
        position < expression.length &&
        /[A-Za-z0-9_]/.test(expression.charAt(position))
      ) {
        position += 1;
      }
      tokens.push({
        kind: "identifier",
        value: expression.slice(start, position),
        position: start
      });
      continue;
    }

    if (char === "[") {
      const start = position;
      position += 1;
      while (
        position < expression.length &&
        expression.charAt(position) !== "]"
      ) {
        position += 1;
      }

      if (position >= expression.length) {
        return {
          ok: false,
          diagnostic: {
            code: "EXPRESSION_PARSE_ERROR",
            message:
              "Bracketed parameter reference is missing a closing bracket.",
            expression,
            position: start,
            expected: "]",
            received: "end of expression"
          }
        };
      }

      const value = expression.slice(start + 1, position).trim();
      if (value.length === 0) {
        return {
          ok: false,
          diagnostic: {
            code: "EXPRESSION_PARSE_ERROR",
            message: "Bracketed parameter reference must not be empty.",
            expression,
            position: start,
            expected: "parameter name",
            received: "empty parameter name"
          }
        };
      }

      tokens.push({ kind: "parameterName", value, position: start });
      position += 1;
      continue;
    }

    const pair = expression.slice(position, position + 2);
    if (isComparisonPairTokenKind(pair)) {
      tokens.push({ kind: pair, position });
      position += 2;
      continue;
    }

    if (pair === "&&" || pair === "||" || char === "!") {
      return {
        ok: false,
        diagnostic: {
          code: "EXPRESSION_LANGUAGE_UNSUPPORTED_TOKEN",
          message: `Unsupported token ${pair === "&&" || pair === "||" ? pair : char} in parameter expression.`,
          expression,
          position,
          expected:
            "comparison, ternary, or if(condition, trueValue, falseValue)",
          received: pair === "&&" || pair === "||" ? pair : char
        }
      };
    }

    if (isOperatorTokenKind(char)) {
      tokens.push({ kind: char, position });
      position += 1;
      continue;
    }

    return {
      ok: false,
      diagnostic: {
        code: "EXPRESSION_PARSE_ERROR",
        message: `Unexpected character ${char} in parameter expression.`,
        expression,
        position,
        expected:
          "number, identifier, bracketed parameter reference, operator, comma, or parenthesis",
        received: char
      }
    };
  }

  tokens.push({ kind: "eof", position: expression.length });
  return { ok: true, tokens };
}

function isOperatorTokenKind(
  value: string
): value is "+" | "-" | "*" | "/" | "<" | ">" | "?" | ":" | "(" | ")" | "," {
  return (
    value === "+" ||
    value === "-" ||
    value === "*" ||
    value === "/" ||
    value === "<" ||
    value === ">" ||
    value === "?" ||
    value === ":" ||
    value === "(" ||
    value === ")" ||
    value === ","
  );
}

function isComparisonPairTokenKind(
  value: string
): value is "<=" | ">=" | "==" | "!=" {
  return value === "<=" || value === ">=" || value === "==" || value === "!=";
}

class ExpressionParser {
  #index = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly expression: string
  ) {}

  parse():
    | { readonly ok: true; readonly parsed: ParsedExpression }
    | {
        readonly ok: false;
        readonly diagnostic: CadParameterExpressionDiagnostic;
      } {
    if (this.#peek().kind === "eof") {
      return {
        ok: false,
        diagnostic: this.#parseError(
          "Expression must not be empty.",
          "expression"
        )
      };
    }

    const ast = this.#parseExpression();
    if (!ast.ok) {
      return ast;
    }

    if (this.#peek().kind !== "eof") {
      return {
        ok: false,
        diagnostic: this.#parseError(
          "Unexpected token after complete expression.",
          "end of expression"
        )
      };
    }

    return {
      ok: true,
      parsed: {
        ast: ast.ast,
        referenceNames: collectReferenceNames(ast.ast)
      }
    };
  }

  #parseExpression():
    | { readonly ok: true; readonly ast: ExpressionAst }
    | {
        readonly ok: false;
        readonly diagnostic: CadParameterExpressionDiagnostic;
      } {
    return this.#parseTernary();
  }

  #parseTernary():
    | { readonly ok: true; readonly ast: ExpressionAst }
    | {
        readonly ok: false;
        readonly diagnostic: CadParameterExpressionDiagnostic;
      } {
    const condition = this.#parseComparison();
    if (!condition.ok || this.#peek().kind !== "?") {
      return condition;
    }

    this.#consume();
    const whenTrue = this.#parseExpression();
    if (!whenTrue.ok) {
      return whenTrue;
    }
    if (this.#peek().kind !== ":") {
      return {
        ok: false,
        diagnostic: this.#parseError(
          "Conditional expression is missing a colon before its false branch.",
          ":",
          "EXPRESSION_TERNARY_INVALID"
        )
      };
    }
    this.#consume();
    const whenFalse = this.#parseExpression();
    if (!whenFalse.ok) {
      return whenFalse;
    }

    return {
      ok: true,
      ast: {
        kind: "conditional",
        condition: condition.ast,
        whenTrue: whenTrue.ast,
        whenFalse: whenFalse.ast
      }
    };
  }

  #parseComparison():
    | { readonly ok: true; readonly ast: ExpressionAst }
    | {
        readonly ok: false;
        readonly diagnostic: CadParameterExpressionDiagnostic;
      } {
    const left = this.#parseAdditive();
    if (!left.ok || !isComparisonToken(this.#peek().kind)) {
      return left;
    }
    const operator = this.#consume().kind as ComparisonOperator;
    const right = this.#parseAdditive();
    return right.ok
      ? {
          ok: true,
          ast: { kind: "binary", operator, left: left.ast, right: right.ast }
        }
      : right;
  }

  #parseAdditive():
    | { readonly ok: true; readonly ast: ExpressionAst }
    | {
        readonly ok: false;
        readonly diagnostic: CadParameterExpressionDiagnostic;
      } {
    let left = this.#parseMultiplicative();
    if (!left.ok) {
      return left;
    }

    while (this.#peek().kind === "+" || this.#peek().kind === "-") {
      const operator = this.#consume().kind as "+" | "-";
      const right = this.#parseMultiplicative();
      if (!right.ok) {
        return right;
      }
      left = {
        ok: true,
        ast: { kind: "binary", operator, left: left.ast, right: right.ast }
      };
    }

    return left;
  }

  #parseMultiplicative():
    | { readonly ok: true; readonly ast: ExpressionAst }
    | {
        readonly ok: false;
        readonly diagnostic: CadParameterExpressionDiagnostic;
      } {
    let left = this.#parseUnary();
    if (!left.ok) {
      return left;
    }

    while (this.#peek().kind === "*" || this.#peek().kind === "/") {
      const operator = this.#consume().kind as "*" | "/";
      const right = this.#parseUnary();
      if (!right.ok) {
        return right;
      }
      left = {
        ok: true,
        ast: { kind: "binary", operator, left: left.ast, right: right.ast }
      };
    }

    return left;
  }

  #parseUnary():
    | { readonly ok: true; readonly ast: ExpressionAst }
    | {
        readonly ok: false;
        readonly diagnostic: CadParameterExpressionDiagnostic;
      } {
    if (this.#peek().kind === "-") {
      this.#consume();
      const operand = this.#parseUnary();
      if (!operand.ok) {
        return operand;
      }
      return {
        ok: true,
        ast: { kind: "unary", operator: "-", operand: operand.ast }
      };
    }

    return this.#parsePrimary();
  }

  #parsePrimary():
    | { readonly ok: true; readonly ast: ExpressionAst }
    | {
        readonly ok: false;
        readonly diagnostic: CadParameterExpressionDiagnostic;
      } {
    const token = this.#peek();

    if (token.kind === "number") {
      this.#consume();
      return { ok: true, ast: { kind: "literal", value: token.value } };
    }

    if (token.kind === "identifier") {
      this.#consume();
      if (this.#peek().kind !== "(") {
        return { ok: true, ast: { kind: "parameter", name: token.value } };
      }

      this.#consume();
      const args: ExpressionAst[] = [];

      if (this.#peek().kind !== ")") {
        while (true) {
          const arg = this.#parseExpression();
          if (!arg.ok) {
            return arg;
          }
          args.push(arg.ast);

          if (this.#peek().kind !== ",") {
            break;
          }
          this.#consume();
        }
      }

      if (this.#peek().kind !== ")") {
        return {
          ok: false,
          diagnostic: this.#parseError(
            "Function call is missing a closing parenthesis.",
            ")"
          )
        };
      }

      this.#consume();
      return { ok: true, ast: { kind: "call", name: token.value, args } };
    }

    if (token.kind === "parameterName") {
      this.#consume();
      return { ok: true, ast: { kind: "parameter", name: token.value } };
    }

    if (token.kind === "(") {
      this.#consume();
      const expression = this.#parseExpression();
      if (!expression.ok) {
        return expression;
      }

      if (this.#peek().kind !== ")") {
        return {
          ok: false,
          diagnostic: this.#parseError(
            "Grouped expression is missing a closing parenthesis.",
            ")"
          )
        };
      }

      this.#consume();
      return expression;
    }

    return {
      ok: false,
      diagnostic: this.#parseError(
        "Expected a number, parameter reference, function call, or grouped expression.",
        "factor"
      )
    };
  }

  #peek(): Token {
    return (
      this.tokens[this.#index] ?? {
        kind: "eof",
        position: this.expression.length
      }
    );
  }

  #consume(): Token {
    const token = this.#peek();
    this.#index += 1;
    return token;
  }

  #parseError(
    message: string,
    expected: string,
    code: CadParameterExpressionDiagnostic["code"] = "EXPRESSION_PARSE_ERROR"
  ): CadParameterExpressionDiagnostic {
    const token = this.#peek();
    return {
      code,
      message,
      expression: this.expression,
      position: token.position,
      expected,
      received: token.kind === "eof" ? "end of expression" : token.kind
    };
  }
}

type ComparisonOperator = "<" | ">" | "<=" | ">=" | "==" | "!=";

function isComparisonToken(value: Token["kind"]): value is ComparisonOperator {
  return (
    value === "<" ||
    value === ">" ||
    value === "<=" ||
    value === ">=" ||
    value === "==" ||
    value === "!="
  );
}

function collectReferenceNames(ast: ExpressionAst): readonly string[] {
  const names = new Set<string>();

  function visit(node: ExpressionAst): void {
    switch (node.kind) {
      case "literal":
        return;
      case "parameter":
        names.add(node.name);
        return;
      case "unary":
        visit(node.operand);
        return;
      case "binary":
        visit(node.left);
        visit(node.right);
        return;
      case "conditional":
        visit(node.condition);
        visit(node.whenTrue);
        visit(node.whenFalse);
        return;
      case "call":
        for (const arg of node.args) {
          visit(arg);
        }
        return;
    }
  }

  visit(ast);
  return [...names];
}

function evaluateAst(
  ast: ExpressionAst,
  context: {
    readonly parameter: CadParameterSnapshot;
    readonly expression?: string;
    readonly values: ReadonlyMap<ParameterId, number>;
    readonly parametersByName: ReadonlyMap<
      string,
      readonly CadParameterSnapshot[]
    >;
  }
):
  | { readonly ok: true; readonly value: number }
  | {
      readonly ok: false;
      readonly diagnostic: CadParameterExpressionDiagnostic;
    } {
  switch (ast.kind) {
    case "literal":
      return { ok: true, value: ast.value };
    case "parameter": {
      const matches = context.parametersByName.get(ast.name) ?? [];
      const parameter = matches[0];
      const value = parameter ? context.values.get(parameter.id) : undefined;

      if (!parameter || value === undefined) {
        return {
          ok: false,
          diagnostic: createDiagnostic({
            code: "PARAMETER_REF_NOT_FOUND",
            message: `Parameter expression references unknown parameter ${ast.name}.`,
            parameter: context.parameter,
            expression: context.expression,
            referencedName: ast.name,
            expected: "evaluated parameter value",
            received: ast.name
          })
        };
      }

      return { ok: true, value };
    }
    case "unary": {
      const operand = evaluateAst(ast.operand, context);
      return operand.ok ? { ok: true, value: -operand.value } : operand;
    }
    case "binary": {
      const left = evaluateAst(ast.left, context);
      if (!left.ok) {
        return left;
      }
      const right = evaluateAst(ast.right, context);
      if (!right.ok) {
        return right;
      }

      if (ast.operator === "/" && right.value === 0) {
        return {
          ok: false,
          diagnostic: createDiagnostic({
            code: "EXPRESSION_DIVISION_BY_ZERO",
            message: "Parameter expression attempted to divide by zero.",
            parameter: context.parameter,
            expression: context.expression,
            expected: "non-zero divisor",
            received: "0"
          })
        };
      }

      const value = evaluateBinaryOperator(
        ast.operator,
        left.value,
        right.value
      );
      return validateEvaluatedNumber(value, context);
    }
    case "conditional": {
      const condition = evaluateAst(ast.condition, context);
      if (!condition.ok) {
        return condition;
      }
      return evaluateAst(
        condition.value === 0 ? ast.whenFalse : ast.whenTrue,
        context
      );
    }
    case "call": {
      const arities = BUILTIN_ARITIES.get(ast.name);

      if (!arities) {
        return {
          ok: false,
          diagnostic: createDiagnostic({
            code: "EXPRESSION_UNKNOWN_IDENTIFIER",
            message: `Unsupported expression function ${ast.name}.`,
            parameter: context.parameter,
            expression: context.expression,
            referencedName: ast.name,
            expected:
              "max, min, abs, sqrt, round, floor, ceil, trigonometry, deg, rad, or if",
            received: ast.name
          })
        };
      }

      const invalidArityResult = () =>
        ({
          ok: false,
          diagnostic: createDiagnostic({
            code: "EXPRESSION_INVALID_FUNCTION",
            message: `Expression function ${ast.name} received ${ast.args.length} argument(s).`,
            parameter: context.parameter,
            expression: context.expression,
            referencedName: ast.name,
            expected: `${arities.join(" or ")} argument(s)`,
            received: String(ast.args.length)
          })
        }) as const;

      if (!arities.includes(ast.args.length)) {
        return invalidArityResult();
      }

      if (ast.name === "if") {
        const [conditionAst, whenTrueAst, whenFalseAst] = ast.args;
        if (!conditionAst || !whenTrueAst || !whenFalseAst) {
          return invalidArityResult();
        }
        const condition = evaluateAst(conditionAst, context);
        if (!condition.ok) {
          return condition;
        }
        return evaluateAst(
          condition.value === 0 ? whenFalseAst : whenTrueAst,
          context
        );
      }

      const args: number[] = [];
      for (const arg of ast.args) {
        const evaluated = evaluateAst(arg, context);
        if (!evaluated.ok) {
          return evaluated;
        }
        args.push(evaluated.value);
      }
      const [firstArg, secondArg] = args;
      if (firstArg === undefined) {
        return invalidArityResult();
      }
      if (
        (ast.name === "max" || ast.name === "min" || ast.name === "atan2") &&
        secondArg === undefined
      ) {
        return invalidArityResult();
      }
      const binarySecondArg = secondArg ?? firstArg;

      if (ast.name === "sqrt" && firstArg < 0) {
        return {
          ok: false,
          diagnostic: createDiagnostic({
            code: "EXPRESSION_INVALID_VALUE",
            message: "sqrt() requires a non-negative argument.",
            parameter: context.parameter,
            expression: context.expression,
            referencedName: ast.name,
            expected: "non-negative value",
            received: String(firstArg)
          })
        };
      }

      if (
        (ast.name === "asin" || ast.name === "acos") &&
        (firstArg < -1 || firstArg > 1)
      ) {
        return expressionDomainError(
          context,
          ast.name,
          "value in [-1, 1]",
          firstArg
        );
      }

      if (
        ast.name === "tan" &&
        Math.abs(Math.cos(degreesToRadians(firstArg))) <= 1e-12
      ) {
        return expressionDomainError(
          context,
          ast.name,
          "angle whose cosine is non-zero",
          firstArg
        );
      }

      const value =
        ast.name === "max"
          ? Math.max(firstArg, binarySecondArg)
          : ast.name === "min"
            ? Math.min(firstArg, binarySecondArg)
            : ast.name === "abs"
              ? Math.abs(firstArg)
              : ast.name === "sqrt"
                ? Math.sqrt(firstArg)
                : ast.name === "round"
                  ? Math.round(firstArg)
                  : ast.name === "floor"
                    ? Math.floor(firstArg)
                    : ast.name === "ceil"
                      ? Math.ceil(firstArg)
                      : ast.name === "sin"
                        ? Math.sin(degreesToRadians(firstArg))
                        : ast.name === "cos"
                          ? Math.cos(degreesToRadians(firstArg))
                          : ast.name === "tan"
                            ? Math.tan(degreesToRadians(firstArg))
                            : ast.name === "asin"
                              ? radiansToDegrees(Math.asin(firstArg))
                              : ast.name === "acos"
                                ? radiansToDegrees(Math.acos(firstArg))
                                : ast.name === "atan"
                                  ? radiansToDegrees(Math.atan(firstArg))
                                  : ast.name === "atan2"
                                    ? radiansToDegrees(
                                        Math.atan2(firstArg, binarySecondArg)
                                      )
                                    : ast.name === "deg"
                                      ? radiansToDegrees(firstArg)
                                      : degreesToRadians(firstArg);
      return validateEvaluatedNumber(value, context);
    }
  }
}

function evaluateBinaryOperator(
  operator: Extract<ExpressionAst, { readonly kind: "binary" }>["operator"],
  left: number,
  right: number
): number {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return left / right;
    case "<":
      return left < right ? 1 : 0;
    case ">":
      return left > right ? 1 : 0;
    case "<=":
      return left <= right ? 1 : 0;
    case ">=":
      return left >= right ? 1 : 0;
    case "==":
      return left === right ? 1 : 0;
    case "!=":
      return left !== right ? 1 : 0;
  }
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function expressionDomainError(
  context: {
    readonly parameter: CadParameterSnapshot;
    readonly expression?: string;
  },
  functionName: string,
  expected: string,
  received: number
): {
  readonly ok: false;
  readonly diagnostic: CadParameterExpressionDiagnostic;
} {
  return {
    ok: false,
    diagnostic: createDiagnostic({
      code: "EXPRESSION_DOMAIN_ERROR",
      message: `${functionName}() argument is outside its supported domain.`,
      parameter: context.parameter,
      expression: context.expression,
      referencedName: functionName,
      expected,
      received: String(received)
    })
  };
}

function validateEvaluatedNumber(
  value: number,
  context: {
    readonly parameter: CadParameterSnapshot;
    readonly expression?: string;
  }
):
  | { readonly ok: true; readonly value: number }
  | {
      readonly ok: false;
      readonly diagnostic: CadParameterExpressionDiagnostic;
    } {
  if (Number.isFinite(value)) {
    return { ok: true, value };
  }

  return {
    ok: false,
    diagnostic: createDiagnostic({
      code: "EXPRESSION_INVALID_VALUE",
      message: "Parameter expression evaluated to a non-finite value.",
      parameter: context.parameter,
      expression: context.expression,
      expected: "finite number",
      received: String(value)
    })
  };
}

function createParameterNameIndex(
  parameters: readonly CadParameterSnapshot[]
): ReadonlyMap<string, readonly CadParameterSnapshot[]> {
  const byName = new Map<string, CadParameterSnapshot[]>();

  for (const parameter of parameters) {
    const existing = byName.get(parameter.name) ?? [];
    existing.push(parameter);
    byName.set(parameter.name, existing);
  }

  return byName;
}

function topologicallySortParameters(
  parameterIds: readonly ParameterId[],
  referencesById: ReadonlyMap<ParameterId, readonly ParameterId[]>
): readonly ParameterId[] {
  const indegree = new Map(parameterIds.map((id) => [id, 0]));
  const dependents = new Map<ParameterId, ParameterId[]>(
    parameterIds.map((id) => [id, []])
  );

  for (const [parameterId, references] of referencesById) {
    for (const reference of references) {
      indegree.set(parameterId, (indegree.get(parameterId) ?? 0) + 1);
      dependents.get(reference)?.push(parameterId);
    }
  }

  const queue = parameterIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: ParameterId[] = [];

  for (let index = 0; index < queue.length; index += 1) {
    const parameterId = queue[index];
    order.push(parameterId);

    for (const dependent of dependents.get(parameterId) ?? []) {
      const nextDegree = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, nextDegree);
      if (nextDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  for (const parameterId of parameterIds) {
    if (!order.includes(parameterId)) {
      order.push(parameterId);
    }
  }

  return order;
}

function findParameterCycles(
  parameterIds: readonly ParameterId[],
  referencesById: ReadonlyMap<ParameterId, readonly ParameterId[]>,
  parameterNamesById: ReadonlyMap<ParameterId, string>
): readonly CadParameterEvaluationCycle[] {
  const cycles: CadParameterEvaluationCycle[] = [];
  const indexById = new Map<ParameterId, number>();
  const lowLinkById = new Map<ParameterId, number>();
  const stack: ParameterId[] = [];
  const onStack = new Set<ParameterId>();
  const parameterIdSet = new Set(parameterIds);
  let nextIndex = 0;

  function strongConnect(parameterId: ParameterId): void {
    indexById.set(parameterId, nextIndex);
    lowLinkById.set(parameterId, nextIndex);
    nextIndex += 1;
    stack.push(parameterId);
    onStack.add(parameterId);

    for (const reference of referencesById.get(parameterId) ?? []) {
      if (!parameterIdSet.has(reference)) {
        continue;
      }

      if (!indexById.has(reference)) {
        strongConnect(reference);
        lowLinkById.set(
          parameterId,
          Math.min(
            lowLinkById.get(parameterId) ?? 0,
            lowLinkById.get(reference) ?? 0
          )
        );
      } else if (onStack.has(reference)) {
        lowLinkById.set(
          parameterId,
          Math.min(
            lowLinkById.get(parameterId) ?? 0,
            indexById.get(reference) ?? 0
          )
        );
      }
    }

    if (lowLinkById.get(parameterId) !== indexById.get(parameterId)) {
      return;
    }

    const component: ParameterId[] = [];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        break;
      }
      onStack.delete(current);
      component.push(current);
      if (current === parameterId) {
        break;
      }
    }

    const selfReferences = (referencesById.get(parameterId) ?? []).includes(
      parameterId
    );
    if (component.length > 1 || selfReferences) {
      const ordered = parameterIds.filter((id) => component.includes(id));
      cycles.push({
        parameterIds: ordered,
        parameterNames: ordered.map((id) => parameterNamesById.get(id) ?? id)
      });
    }
  }

  for (const parameterId of parameterIds) {
    if (!indexById.has(parameterId)) {
      strongConnect(parameterId);
    }
  }

  return cycles;
}

function createDiagnostic(args: {
  readonly code: CadParameterExpressionDiagnostic["code"];
  readonly message: string;
  readonly parameter: CadParameterSnapshot;
  readonly expression?: string;
  readonly referencedName?: string;
  readonly cycle?: readonly ParameterId[];
  readonly expected?: string;
  readonly received?: string;
}): CadParameterExpressionDiagnostic {
  return {
    code: args.code,
    message: args.message,
    parameterId: args.parameter.id,
    parameterName: args.parameter.name,
    ...(args.expression ? { expression: args.expression } : {}),
    ...(args.referencedName ? { referencedName: args.referencedName } : {}),
    ...(args.cycle ? { cycle: args.cycle } : {}),
    ...(args.expected ? { expected: args.expected } : {}),
    ...(args.received ? { received: args.received } : {})
  };
}

function withParameterContext(
  diagnostic: CadParameterExpressionDiagnostic,
  parameter: CadParameterSnapshot,
  expression: string
): CadParameterExpressionDiagnostic {
  return {
    ...diagnostic,
    parameterId: parameter.id,
    parameterName: parameter.name,
    expression
  };
}

function addNodeDiagnostic(
  diagnostics: Map<ParameterId, CadParameterExpressionDiagnostic[]>,
  parameterId: ParameterId,
  diagnostic: CadParameterExpressionDiagnostic
): void {
  const existing = diagnostics.get(parameterId) ?? [];
  existing.push(diagnostic);
  diagnostics.set(parameterId, existing);
}

export function normalizeStoredExpression(
  expression: CadParameterSnapshot["expression"]
): string | undefined {
  return typeof expression === "string" && expression.trim().length > 0
    ? expression.trim()
    : undefined;
}

function cleanExpressionNumber(value: number): number {
  return Object.is(value, -0) ? 0 : Number(value.toPrecision(12));
}
