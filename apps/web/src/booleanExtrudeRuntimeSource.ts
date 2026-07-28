import type {
  DerivedBooleanExtrudeGeometrySource,
  DerivedExtrudeGeometrySource
} from "./derivedGeometry";
import type {
  DerivedGeometryBooleanExtrudeInputSource,
  DerivedGeometryBooleanExtrudePrimitiveInputSource,
  DerivedGeometryBooleanExtrudeResultInputSource,
  DerivedGeometryBooleanExtrudeToolInputSource
} from "./derivedGeometryRuntime";

export function createBooleanExtrudeRuntimeSource(
  source: DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource
): DerivedGeometryBooleanExtrudeInputSource {
  return source.kind === "extrudeBoolean"
    ? createBooleanExtrudeResultRuntimeSource(source)
    : createBaseBooleanExtrudeRuntimeSource(source);
}

export function createBooleanExtrudeResultRuntimeSource(
  source: DerivedBooleanExtrudeGeometrySource
): DerivedGeometryBooleanExtrudeResultInputSource {
  const unsupportedMessage = getBooleanExtrudeRuntimeSourceError(source);
  if (unsupportedMessage) {
    throw new Error(unsupportedMessage);
  }

  const target = createBooleanExtrudeRuntimeSource(source.target);

  if (source.operation === "cut") {
    return {
      kind: "booleanExtrudes",
      operation: "cut",
      ...(source.materialPolicy
        ? { materialPolicy: source.materialPolicy }
        : {}),
      target,
      tool: createBooleanExtrudeToolRuntimeSource(source.tool)
    };
  }

  return {
    kind: "booleanExtrudes",
    operation: "add",
    ...(source.materialPolicy ? { materialPolicy: source.materialPolicy } : {}),
    target,
    tool: createBooleanExtrudeToolRuntimeSource(source.tool)
  };
}

export function getBooleanExtrudeRuntimeSourceError(
  source: DerivedBooleanExtrudeGeometrySource
): string | undefined {
  if (source.target.kind === "extrudeBoolean") {
    const targetError = getBooleanExtrudeRuntimeSourceError(source.target);
    if (targetError) return targetError;
  }
  if (source.tool.kind === "extrudeBoolean") {
    return getBooleanExtrudeRuntimeSourceError(source.tool);
  }

  return undefined;
}

export function createPrimitiveBooleanExtrudeRuntimeSource(
  source: DerivedExtrudeGeometrySource
): DerivedGeometryBooleanExtrudePrimitiveInputSource {
  if (source.profile.kind === "wire") {
    throw new Error(
      "Composite wire extrudes are supported only as boolean tools, not standalone boolean targets."
    );
  }

  return {
    sketchPlane: source.sketchPlane,
    profile: source.profile,
    depth: source.depth,
    side: source.side,
    ...(source.placementFrame ? { placementFrame: source.placementFrame } : {})
  };
}

function createBaseBooleanExtrudeRuntimeSource(
  source: DerivedExtrudeGeometrySource
): DerivedGeometryBooleanExtrudeInputSource {
  return source.profile.kind === "wire"
    ? createWireBooleanExtrudeRuntimeSource(source)
    : createPrimitiveBooleanExtrudeRuntimeSource(source);
}

function createBooleanExtrudeToolRuntimeSource(
  source: DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource
): DerivedGeometryBooleanExtrudeToolInputSource {
  return source.kind === "extrudeBoolean"
    ? createBooleanExtrudeResultRuntimeSource(source)
    : createBaseBooleanExtrudeRuntimeSource(source);
}

function createWireBooleanExtrudeRuntimeSource(
  source: DerivedExtrudeGeometrySource
): DerivedGeometryBooleanExtrudeInputSource {
  if (source.profile.kind !== "wire") {
    return createPrimitiveBooleanExtrudeRuntimeSource(source);
  }
  return {
    sketchPlane: source.sketchPlane,
    profile: source.profile,
    depth: source.depth,
    side: source.side
  };
}
