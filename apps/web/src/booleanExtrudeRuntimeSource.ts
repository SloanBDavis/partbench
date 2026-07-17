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
    : createPrimitiveBooleanExtrudeRuntimeSource(source);
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
      target,
      tool: createBooleanExtrudeToolRuntimeSource(source.tool)
    };
  }

  return {
    kind: "booleanExtrudes",
    operation: "add",
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
  } else if (source.target.profile.kind === "wire") {
    return "Boolean result targets must resolve to a supported primitive or topology-backed result body, not a composite new-body wire extrude.";
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

function createBooleanExtrudeToolRuntimeSource(
  source: DerivedExtrudeGeometrySource
): DerivedGeometryBooleanExtrudeToolInputSource {
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
