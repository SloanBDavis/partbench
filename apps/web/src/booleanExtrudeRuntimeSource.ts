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
      tool: createPrimitiveBooleanExtrudeRuntimeSource(source.tool)
    };
  }

  return {
    kind: "booleanExtrudes",
    operation: "add",
    target,
    tool: createAddBooleanExtrudeToolRuntimeSource(source.tool)
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

  if (source.operation === "cut" && source.tool.profile.kind === "wire") {
    return "Composite wire extrudes are not supported as cut tools until the V17 cut row is enabled.";
  }

  return undefined;
}

export function createPrimitiveBooleanExtrudeRuntimeSource(
  source: DerivedExtrudeGeometrySource
): DerivedGeometryBooleanExtrudePrimitiveInputSource {
  if (source.profile.kind === "wire") {
    throw new Error(
      "Composite wire extrudes are supported only as add tools; boolean targets and cut tools remain primitive-only."
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

function createAddBooleanExtrudeToolRuntimeSource(
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
