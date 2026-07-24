import type {
  OrientedSketchSegmentRef,
  SketchDimensionSnapshot,
  SketchDimensionSnapshotV22,
  SketchDimensionTarget,
  SketchDimensionTargetV22,
  SketchDimensionValueSource,
  SketchEntityId,
  SketchEntityScalarDimensionTargetV22,
  SketchLoopRef,
  SketchProfileRef,
  SketchProfileRefV22,
  SketchProfileRegionRef,
  SketchRegionsProfileRef,
  SketchWireLoopRef
} from "@web-cad/cad-protocol";

export type SketchDimensionSnapshotCurrent =
  | SketchDimensionSnapshot
  | SketchDimensionSnapshotV22;

export type SketchLoopRole = "outer" | "hole";

export type SketchLoopOrientationNormalizer = (
  loop: SketchLoopRef,
  role: SketchLoopRole
) => SketchLoopRef;

export function cloneSketchDimensionValueSource(
  valueSource: SketchDimensionValueSource
): SketchDimensionValueSource {
  return valueSource.type === "literal"
    ? { type: "literal", value: valueSource.value }
    : { type: "parameter", parameterId: valueSource.parameterId };
}

export function cloneSketchDimensionTargetV22(
  target: SketchDimensionTargetV22
): SketchDimensionTargetV22 {
  switch (target.kind) {
    case "entityScalar":
      return { ...target };
    case "pointPair":
      return {
        ...target,
        primary: { ...target.primary },
        secondary: { ...target.secondary }
      };
    case "pointLineDistance":
      return {
        ...target,
        point: { ...target.point }
      };
    case "lineAngle":
      return { ...target };
  }
}

export function cloneSketchDimensionSnapshotV22(
  dimension: SketchDimensionSnapshotV22
): SketchDimensionSnapshotV22 {
  return {
    id: dimension.id,
    name: dimension.name,
    sketchId: dimension.sketchId,
    target: cloneSketchDimensionTargetV22(dimension.target),
    valueSource: cloneSketchDimensionValueSource(dimension.valueSource)
  };
}

export function normalizeSketchDimensionTargetV22(
  entityId: SketchEntityId,
  target: SketchDimensionTarget
): SketchEntityScalarDimensionTargetV22 {
  return {
    kind: "entityScalar",
    entityId,
    entityKind: target.entityKind,
    role: target.role
  } as SketchEntityScalarDimensionTargetV22;
}

export function isSketchDimensionSnapshotV22(
  dimension: SketchDimensionSnapshotCurrent
): dimension is SketchDimensionSnapshotV22 {
  return (
    !Object.prototype.hasOwnProperty.call(dimension, "entityId") &&
    typeof dimension.target === "object" &&
    dimension.target !== null &&
    "kind" in dimension.target
  );
}

export function normalizeSketchDimensionSnapshotV22(
  dimension: SketchDimensionSnapshotCurrent
): SketchDimensionSnapshotV22 {
  if (isSketchDimensionSnapshotV22(dimension)) {
    return cloneSketchDimensionSnapshotV22(dimension);
  }

  return {
    id: dimension.id,
    name: dimension.name,
    sketchId: dimension.sketchId,
    target: normalizeSketchDimensionTargetV22(
      dimension.entityId,
      dimension.target
    ),
    valueSource: cloneSketchDimensionValueSource(dimension.valueSource)
  };
}

export function downconvertSketchDimensionSnapshotV22(
  dimension: SketchDimensionSnapshotV22
): SketchDimensionSnapshot | undefined {
  if (
    dimension.target.kind !== "entityScalar" ||
    dimension.target.role === "diameter"
  ) {
    return undefined;
  }

  const { entityId, kind: _kind, ...legacyTarget } = dimension.target;
  void _kind;

  return {
    id: dimension.id,
    name: dimension.name,
    sketchId: dimension.sketchId,
    entityId,
    target: legacyTarget as SketchDimensionTarget,
    valueSource: cloneSketchDimensionValueSource(dimension.valueSource)
  };
}

export function sketchDimensionRequiresV22(
  dimension: SketchDimensionSnapshotV22 | SketchDimensionTargetV22
): boolean {
  const target = "target" in dimension ? dimension.target : dimension;
  return target.kind !== "entityScalar" || target.role === "diameter";
}

export function getSketchDimensionTargetEntityIdsV22(
  target: SketchDimensionTargetV22
): readonly SketchEntityId[] {
  switch (target.kind) {
    case "entityScalar":
      return [target.entityId];
    case "pointPair":
      return [target.primary.entityId, target.secondary.entityId];
    case "pointLineDistance":
      return [target.point.entityId, target.lineEntityId];
    case "lineAngle":
      return [target.primaryLineEntityId, target.secondaryLineEntityId];
  }
}

export function getSketchDimensionTargetKeyV22(
  sketchId: string,
  target: SketchDimensionTargetV22
): string {
  const targetKey =
    target.kind === "entityScalar"
      ? [target.kind, target.entityId, target.entityKind, target.role]
      : target.kind === "pointPair"
        ? [
            target.kind,
            target.measurement,
            "direction" in target ? target.direction : "",
            target.primary.entityId,
            target.primary.entityKind,
            target.primary.role,
            target.secondary.entityId,
            target.secondary.entityKind,
            target.secondary.role
          ]
        : target.kind === "pointLineDistance"
          ? [
              target.kind,
              target.point.entityId,
              target.point.entityKind,
              target.point.role,
              target.lineEntityId,
              target.side
            ]
          : [
              target.kind,
              target.primaryLineEntityId,
              target.secondaryLineEntityId,
              target.sense
            ];
  return JSON.stringify([sketchId, ...targetKey]);
}

function cloneOrientedSegment(
  segment: OrientedSketchSegmentRef
): OrientedSketchSegmentRef {
  return {
    entityId: segment.entityId,
    orientation: segment.orientation
  };
}

export function cloneSketchLoopRef(loop: SketchLoopRef): SketchLoopRef {
  return loop.kind === "entity"
    ? { kind: "entity", entityId: loop.entityId }
    : {
        kind: "wire",
        segments: loop.segments.map(cloneOrientedSegment)
      };
}

export function cloneSketchProfileRegionRef(
  region: SketchProfileRegionRef
): SketchProfileRegionRef {
  return {
    outer: cloneSketchLoopRef(region.outer),
    holes: region.holes.map(cloneSketchLoopRef)
  };
}

export function cloneSketchRegionsProfileRef(
  profile: SketchRegionsProfileRef
): SketchRegionsProfileRef {
  const regions = profile.regions.map(cloneSketchProfileRegionRef);
  return {
    kind: "regions",
    sketchId: profile.sketchId,
    regions: toNonEmptyRegions(regions)
  };
}

export function cloneSketchProfileRefV22(
  profile: SketchProfileRefV22
): SketchProfileRefV22 {
  if (profile.kind === "entity") {
    return { ...profile };
  }
  if (profile.kind === "wire") {
    return {
      ...profile,
      segments: profile.segments.map(cloneOrientedSegment)
    };
  }
  return cloneSketchRegionsProfileRef(profile);
}

function compareSegments(
  left: OrientedSketchSegmentRef,
  right: OrientedSketchSegmentRef
): number {
  const idOrder = compareSketchCanonicalKeys(left.entityId, right.entityId);
  return idOrder !== 0
    ? idOrder
    : compareSketchCanonicalKeys(left.orientation, right.orientation);
}

function compareSegmentSequences(
  left: readonly OrientedSketchSegmentRef[],
  right: readonly OrientedSketchSegmentRef[]
): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const comparison = compareSegments(left[index]!, right[index]!);
    if (comparison !== 0) {
      return comparison;
    }
  }
  return left.length - right.length;
}

export function normalizeSketchWireLoopCyclicStart(
  loop: SketchWireLoopRef
): SketchWireLoopRef {
  if (loop.segments.length < 2) {
    return cloneSketchLoopRef(loop) as SketchWireLoopRef;
  }

  let best = loop.segments.map(cloneOrientedSegment);
  for (let index = 1; index < loop.segments.length; index += 1) {
    const candidate = [
      ...loop.segments.slice(index),
      ...loop.segments.slice(0, index)
    ].map(cloneOrientedSegment);
    if (compareSegmentSequences(candidate, best) < 0) {
      best = candidate;
    }
  }

  return { kind: "wire", segments: best };
}

export function reverseSketchWireLoop(
  loop: SketchWireLoopRef
): SketchWireLoopRef {
  return {
    kind: "wire",
    segments: [...loop.segments].reverse().map((segment) => ({
      entityId: segment.entityId,
      orientation: segment.orientation === "forward" ? "reverse" : "forward"
    }))
  };
}

export function getSketchLoopCanonicalKey(loop: SketchLoopRef): string {
  return loop.kind === "entity"
    ? JSON.stringify(["entity", loop.entityId])
    : JSON.stringify([
        "wire",
        ...loop.segments.map((segment) => [
          segment.entityId,
          segment.orientation
        ])
      ]);
}

export function compareSketchCanonicalKeys(
  left: string,
  right: string
): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeLoop(
  loop: SketchLoopRef,
  role: SketchLoopRole,
  orientLoop?: SketchLoopOrientationNormalizer
): SketchLoopRef {
  const oriented = orientLoop
    ? orientLoop(cloneSketchLoopRef(loop), role)
    : cloneSketchLoopRef(loop);
  return oriented.kind === "wire"
    ? normalizeSketchWireLoopCyclicStart(oriented)
    : oriented;
}

export function normalizeSketchRegionsProfileRef(
  profile: SketchRegionsProfileRef,
  orientLoop?: SketchLoopOrientationNormalizer
): SketchRegionsProfileRef {
  const regions = profile.regions
    .map((region): SketchProfileRegionRef => {
      const outer = normalizeLoop(region.outer, "outer", orientLoop);
      const holes = region.holes
        .map((hole) => normalizeLoop(hole, "hole", orientLoop))
        .sort((left, right) =>
          compareSketchCanonicalKeys(
            getSketchLoopCanonicalKey(left),
            getSketchLoopCanonicalKey(right)
          )
        );
      return { outer, holes };
    })
    .sort((left, right) =>
      compareSketchCanonicalKeys(
        getSketchLoopCanonicalKey(left.outer),
        getSketchLoopCanonicalKey(right.outer)
      )
    );

  return {
    kind: "regions",
    sketchId: profile.sketchId,
    regions: toNonEmptyRegions(regions)
  };
}

export function normalizeSketchProfileRefV22(
  profile: SketchProfileRefV22,
  orientLoop?: SketchLoopOrientationNormalizer
): SketchProfileRefV22 {
  return profile.kind === "regions"
    ? normalizeSketchRegionsProfileRef(profile, orientLoop)
    : cloneSketchProfileRefV22(profile);
}

export function downconvertSketchProfileRefV22(
  profile: SketchProfileRefV22
): SketchProfileRef | undefined {
  if (profile.kind === "regions") {
    return undefined;
  }
  return profile.kind === "entity"
    ? { ...profile }
    : { ...profile, segments: profile.segments.map(cloneOrientedSegment) };
}

function toNonEmptyRegions(
  regions: readonly SketchProfileRegionRef[]
): SketchRegionsProfileRef["regions"] {
  const first = regions[0];
  if (!first) {
    throw new Error("A regions profile must contain at least one region.");
  }
  return [first, ...regions.slice(1)];
}

export function sketchProfileRequiresV22(
  profile: SketchProfileRefV22
): profile is SketchRegionsProfileRef {
  return profile.kind === "regions";
}
