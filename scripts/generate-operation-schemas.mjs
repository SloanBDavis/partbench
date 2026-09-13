import ts from "typescript";
import { format, resolveConfig } from "prettier";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sourcePath = fileURLToPath(
  new URL("../packages/cad-protocol/src/index.ts", import.meta.url)
);
const destination = fileURLToPath(
  new URL(
    "../packages/agent-adapter/src/operationSchemas.generated.ts",
    import.meta.url
  )
);

export async function generateOperationSchemas() {
  const program = ts.createProgram([sourcePath], {
    strict: true,
    target: ts.ScriptTarget.ES2022
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(sourcePath);
  const declaration = source.statements.find(
    (node) => ts.isTypeAliasDeclaration(node) && node.name.text === "CadOp"
  );
  if (!declaration) throw new Error("CadOp union missing");
  const operationType = checker.getTypeAtLocation(declaration);
  if (!operationType.isUnion())
    throw new Error("CadOp must remain an explicit union");
  const cache = new Map();
  const active = new Set();
  const shape = (type) => {
    if (cache.has(type)) return cache.get(type);
    if (active.has(type))
      throw new Error(
        `Recursive command type requires explicit schema support: ${checker.typeToString(type)}`
      );
    active.add(type);
    const result = convert(type);
    active.delete(type);
    cache.set(type, result);
    return result;
  };
  const convert = (type) => {
    if (type.flags & (ts.TypeFlags.Never | ts.TypeFlags.Undefined))
      return false;
    if (type.flags & ts.TypeFlags.StringLiteral) return { const: type.value };
    if (type.flags & ts.TypeFlags.NumberLiteral) return { const: type.value };
    if (type.flags & ts.TypeFlags.BooleanLiteral)
      return { const: type.intrinsicName === "true" };
    if (type.flags & ts.TypeFlags.Null) return { type: "null" };
    if (type.flags & ts.TypeFlags.String) return { type: "string" };
    if (type.flags & ts.TypeFlags.Number) return { type: "number" };
    if (type.flags & ts.TypeFlags.Boolean) return { type: "boolean" };
    if (type.isUnion()) {
      const alternatives = type.types
        .filter((item) => !(item.flags & ts.TypeFlags.Undefined))
        .map(shape);
      if (alternatives.length === 1) return alternatives[0];
      if (
        alternatives.every(
          (item) => item && Object.keys(item).length === 1 && "const" in item
        )
      )
        return { enum: alternatives.map((item) => item.const) };
      return { anyOf: alternatives };
    }
    if (checker.isTupleType(type)) {
      const items = checker.getTypeArguments(type).map(shape);
      const flags = type.target.elementFlags;
      const restIndex = flags.findIndex((flag) => flag & ts.ElementFlags.Rest);
      if (
        flags.some((flag) => flag & ts.ElementFlags.Variadic) ||
        (restIndex >= 0 && restIndex !== items.length - 1)
      )
        throw new Error("Variable tuple needs explicit support");
      return {
        type: "array",
        items: restIndex < 0 ? items : items.slice(0, restIndex),
        minItems: flags.filter((flag) => flag & ts.ElementFlags.Required)
          .length,
        ...(restIndex < 0
          ? { maxItems: items.length }
          : { additionalItems: items[restIndex] })
      };
    }
    if (checker.isArrayType(type))
      return { type: "array", items: shape(checker.getTypeArguments(type)[0]) };
    if (type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) {
      const properties = {};
      const required = [];
      for (const property of checker.getPropertiesOfType(type)) {
        const location =
          property.valueDeclaration ??
          property.declarations?.[0] ??
          declaration;
        const propertyType = checker.getTypeOfSymbolAtLocation(
          property,
          location
        );
        let schema = shape(propertyType);
        const description = ts.displayPartsToString(
          property.getDocumentationComment(checker)
        );
        if (description && schema !== false)
          schema = { ...schema, description };
        properties[property.name] = schema;
        if (!(property.flags & ts.SymbolFlags.Optional))
          required.push(property.name);
      }
      const stringIndex = checker.getIndexTypeOfType(type, ts.IndexKind.String);
      const numberIndex = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
      if (numberIndex && !stringIndex)
        throw new Error(
          `Unhandled numeric index type: ${checker.typeToString(type)}`
        );
      return {
        type: "object",
        additionalProperties: stringIndex ? shape(stringIndex) : false,
        required,
        properties
      };
    }
    throw new Error(
      `Unhandled command type ${checker.typeToString(type)} flags ${type.flags}`
    );
  };
  const grouped = {};
  for (const variant of operationType.types) {
    const discriminator = checker.getPropertyOfType(variant, "op");
    if (!discriminator)
      throw new Error(
        `Missing operation discriminator: ${checker.typeToString(variant)}`
      );
    const nameType = checker.getTypeOfSymbolAtLocation(
      discriminator,
      discriminator.valueDeclaration ?? declaration
    );
    if (!(nameType.flags & ts.TypeFlags.StringLiteral))
      throw new Error("Operation name must be a literal");
    (grouped[nameType.value] ??= []).push(shape(variant));
  }
  const schemas = Object.fromEntries(
    Object.keys(grouped)
      .sort()
      .map((name) => [
        name,
        grouped[name].length === 1 ? grouped[name][0] : { anyOf: grouped[name] }
      ])
  );
  const batchDeclaration = source.statements.find(
    (node) => ts.isInterfaceDeclaration(node) && node.name.text === "CadBatch"
  );
  const batchSchema = shape(checker.getTypeAtLocation(batchDeclaration));
  // Operations are discovered individually; do not duplicate the entire union in the envelope.
  batchSchema.properties.ops = { type: "array", items: { type: "object" } };
  const generated = `// Generated by scripts/generate-operation-schemas.mjs from canonical CadOp types.\n// Do not edit. Runtime command validation remains authoritative.\nimport type { CadOp } from '@web-cad/cad-protocol';\nimport type { OperationSchema } from './operationSchemas';\nexport const operationSchemas: Record<CadOp['op'], OperationSchema> = ${JSON.stringify(schemas, null, 2)};\nexport const batchSchema: OperationSchema = ${JSON.stringify(batchSchema, null, 2)};\n`;
  return format(generated, {
    ...(await resolveConfig(destination)),
    filepath: destination
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const generated = await generateOperationSchemas();
  if (process.argv.includes("--check")) {
    if (readFileSync(destination, "utf8") !== generated)
      throw new Error(
        "Operation schemas are stale. Run node scripts/generate-operation-schemas.mjs."
      );
  } else {
    writeFileSync(destination, generated);
    console.log(`Generated ${destination}`);
  }
}
