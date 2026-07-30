import type {
  CadBatchValidationErrorCode,
  CadExactExportResolvedRegionLoop,
  CadExactExportResolvedRegionProfile,
  FeatureInputReferenceSemanticDiffCurrent,
  FeatureRevolveAxis,
  PartId,
  SketchEntityId,
  SketchEntitySnapshot,
  SketchLoopRef,
  SketchRegionsProfileRef,
  Vec2
} from "@web-cad/cad-protocol";

import type {
  GeneratedReferencesDocument,
  GeneratedReferencesSketch
} from "./generatedReferences";
import type { SketchProfileReadinessDocument } from "./sketchProfilePathQueries";
import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";
import { createSourceMeasurementFrame } from "./sourceMeasurementGeometry";
import {
  classifySketchSegmentAgainstInfiniteLine,
  classifySketchWireAgainstInfiniteLine,
  resolveOrientedSketchSegment,
  type ResolvedSketchSegment
} from "./sketchWireGeometry";
import {
  mapRegionSourceIssueToBatchError,
  validateRegisteredV22RegionSource
} from "./v19RegionPolicyRegistry";
import { createResolvedWireExtrudeRecipe } from "./wireExtrudeProfile";

type ProfileInputNormalization = NonNullable<
  Extract<
    FeatureInputReferenceSemanticDiffCurrent,
    { readonly inputKind: "profile" }
  >["normalization"]
>;

export type RegionRevolveProfileResolution =
  | {
      readonly ok: true;
      readonly profile: SketchRegionsProfileRef;
      readonly normalization: ProfileInputNormalization;
    }
  | {
      readonly ok: false;
      readonly code: CadBatchValidationErrorCode;
      readonly message: string;
      readonly sketchId?: string;
      readonly sketchEntityId?: string;
    };

export function resolveRegionRevolveProfile(
  document: SketchProfileReadinessDocument,
  profile: SketchRegionsProfileRef,
  axis: FeatureRevolveAxis
): RegionRevolveProfileResolution {
  const sketch = document.sketches.get(profile.sketchId);
  if (!sketch) {
    return {
      ok: false,
      code: "SKETCH_NOT_FOUND",
      message: `Sketch does not exist: ${profile.sketchId}`,
      sketchId: profile.sketchId
    };
  }

  const validation = validateRegisteredV22RegionSource(profile, sketch);
  if (!validation.ok) {
    const issue = validation.issues[0];
    return {
      ok: false,
      code: mapRegionSourceIssueToBatchError(issue?.code),
      message: issue?.message ?? "Exact regions profile is not feature-ready.",
      sketchId: profile.sketchId,
      ...(issue?.entityId ? { sketchEntityId: issue.entityId } : {})
    };
  }
  if (validation.normalizedProfile.regions.length !== 1) {
    return {
      ok: false,
      code: "SKETCH_REGION_CONSUMER_UNSUPPORTED",
      message: "Region revolve requires one material region.",
      sketchId: profile.sketchId
    };
  }
  if (axis.sketchId !== profile.sketchId) {
    return {
      ok: false,
      code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED",
      message: "Revolve axis must use the profile sketch.",
      sketchId: profile.sketchId,
      sketchEntityId: axis.entityId
    };
  }
  const region = validation.normalizedProfile.regions[0]!;
  if (
    [region.outer, ...region.holes].some((loop) =>
      loop.kind === "entity"
        ? loop.entityId === axis.entityId
        : loop.segments.some(({ entityId }) => entityId === axis.entityId)
    )
  ) {
    return {
      ok: false,
      code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED",
      message: "Revolve axis cannot be a profile member.",
      sketchId: profile.sketchId,
      sketchEntityId: axis.entityId
    };
  }
  const axisEntity = sketch.entities.get(axis.entityId);
  if (!axisEntity || axisEntity.kind !== "line") {
    return {
      ok: false,
      code: axisEntity
        ? "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED"
        : "SKETCH_ENTITY_NOT_FOUND",
      message: "Revolve axis must be an existing line.",
      sketchId: profile.sketchId,
      sketchEntityId: axis.entityId
    };
  }
  if (
    Math.hypot(
      axisEntity.end[0] - axisEntity.start[0],
      axisEntity.end[1] - axisEntity.start[1]
    ) <= SKETCH_GEOMETRY_POLICY.linearTolerance
  ) {
    return {
      ok: false,
      code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED",
      message: "Revolve axis line must have non-zero length.",
      sketchId: profile.sketchId,
      sketchEntityId: axis.entityId
    };
  }

  const outerSegments = resolveLoopSegments(region.outer, sketch.entities);
  if (!outerSegments) {
    return unresolvedLoop(profile.sketchId);
  }
  const outerEntity =
    region.outer.kind === "entity"
      ? sketch.entities.get(region.outer.entityId)
      : undefined;
  for (const segment of outerSegments) {
    const relation = classifySketchSegmentAgainstInfiniteLine(
      segment,
      axisEntity.start,
      axisEntity.end
    );
    const allowed =
      relation === "clear" ||
      (relation === "vertex-touch" && outerEntity?.kind !== "circle");
    if (!allowed) {
      return axisIntersection(profile.sketchId, segment.entityId, relation);
    }
  }
  const outerSide = classifySketchWireAgainstInfiniteLine(
    outerSegments,
    axisEntity.start,
    axisEntity.end
  );
  if (outerSide !== "positive" && outerSide !== "negative") {
    return axisIntersection(
      profile.sketchId,
      axis.entityId,
      outerSide === "straddling" ? "crossing" : "overlap"
    );
  }

  for (const hole of region.holes) {
    const segments = resolveLoopSegments(hole, sketch.entities);
    if (!segments) return unresolvedLoop(profile.sketchId);
    for (const segment of segments) {
      const relation = classifySketchSegmentAgainstInfiniteLine(
        segment,
        axisEntity.start,
        axisEntity.end
      );
      if (relation !== "clear") {
        return axisIntersection(profile.sketchId, segment.entityId, relation);
      }
    }
    const side = classifySketchWireAgainstInfiniteLine(
      segments,
      axisEntity.start,
      axisEntity.end
    );
    if (side !== outerSide) {
      return axisIntersection(profile.sketchId, axis.entityId, "crossing");
    }
  }

  return {
    ok: true,
    profile: validation.normalizedProfile,
    normalization: {
      outerOrientationsChanged:
        validation.normalization.outerOrientationsChanged,
      holeOrientationsChanged: validation.normalization.holeOrientationsChanged,
      cyclicStartsChanged: validation.normalization.cyclicStartsChanged,
      holeOrderChanged: validation.normalization.holeOrderChanged,
      regionOrderChanged: validation.normalization.regionOrderChanged
    }
  };
}

export function createResolvedRegionRevolveRecipe(
  profile: SketchRegionsProfileRef,
  axis: FeatureRevolveAxis,
  entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>,
  frame: CadExactExportResolvedRegionProfile["frame"]
):
  | {
      readonly profile: CadExactExportResolvedRegionProfile;
      readonly axis: {
        readonly sourceEntityId: SketchEntityId;
        readonly start: Vec2;
        readonly end: Vec2;
      };
    }
  | undefined {
  const region = profile.regions[0];
  const axisEntity = entities.get(axis.entityId);
  if (!region || profile.regions.length !== 1 || axisEntity?.kind !== "line") {
    return undefined;
  }
  const outer = createResolvedRegionLoop(
    profile.sketchId,
    region.outer,
    entities,
    frame
  );
  const holes = region.holes.map((hole) =>
    createResolvedRegionLoop(profile.sketchId, hole, entities, frame)
  );
  if (!outer || holes.some((hole) => !hole)) return undefined;

  return {
    profile: {
      kind: "region",
      frame,
      outer,
      holes: holes as CadExactExportResolvedRegionLoop[],
      sourceIdentity: `partbench-region-revolve-v1:${JSON.stringify([
        profile.sketchId,
        profile,
        frame,
        outer,
        holes,
        SKETCH_GEOMETRY_POLICY
      ])}`,
      geometryPolicy: SKETCH_GEOMETRY_POLICY
    },
    axis: {
      sourceEntityId: axisEntity.id,
      start: axisEntity.start,
      end: axisEntity.end
    }
  };
}

export function createResolvedRegionRevolveProfile(
  document: SketchProfileReadinessDocument & GeneratedReferencesDocument,
  profile: SketchRegionsProfileRef,
  axis: FeatureRevolveAxis,
  ownerPartId: PartId
): ReturnType<typeof createResolvedRegionRevolveRecipe> {
  const resolution = resolveRegionRevolveProfile(document, profile, axis);
  if (!resolution.ok) return undefined;
  const sketch = document.sketches.get(profile.sketchId) as
    | GeneratedReferencesSketch
    | undefined;
  if (!sketch) return undefined;
  const frame = createSourceMeasurementFrame(document, sketch, ownerPartId);
  if (!frame) return undefined;
  return createResolvedRegionRevolveRecipe(
    resolution.profile,
    axis,
    sketch.entities,
    { origin: frame.origin, uAxis: frame.uAxis, vAxis: frame.vAxis }
  );
}

function createResolvedRegionLoop(
  sketchId: string,
  loop: SketchLoopRef,
  entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>,
  frame: CadExactExportResolvedRegionProfile["frame"]
): CadExactExportResolvedRegionLoop | undefined {
  if (loop.kind === "wire") {
    return createResolvedWireExtrudeRecipe(
      { kind: "wire", sketchId, segments: loop.segments },
      entities,
      frame
    );
  }
  const entity = entities.get(loop.entityId);
  if (entity?.kind === "rectangle") {
    return {
      kind: "rectangle",
      center: entity.center,
      width: entity.width,
      height: entity.height
    };
  }
  if (entity?.kind === "circle") {
    return {
      kind: "circle",
      center: entity.center,
      radius: entity.radius
    };
  }
  return undefined;
}

function resolveLoopSegments(
  loop: SketchLoopRef,
  entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>
): readonly ResolvedSketchSegment[] | undefined {
  if (loop.kind === "wire") {
    const segments: ResolvedSketchSegment[] = [];
    for (const reference of loop.segments) {
      const entity = entities.get(reference.entityId);
      if (!entity || (entity.kind !== "line" && entity.kind !== "arc")) {
        return undefined;
      }
      const resolved = resolveOrientedSketchSegment(
        entity,
        reference.orientation
      );
      if (!resolved.ok) return undefined;
      segments.push(resolved.segment);
    }
    return segments;
  }
  const entity = entities.get(loop.entityId);
  if (entity?.kind === "rectangle") {
    const left = entity.center[0] - entity.width / 2;
    const right = entity.center[0] + entity.width / 2;
    const bottom = entity.center[1] - entity.height / 2;
    const top = entity.center[1] + entity.height / 2;
    const points: readonly Vec2[] = [
      [left, bottom],
      [right, bottom],
      [right, top],
      [left, top]
    ];
    return points.map((start, index) => ({
      kind: "line",
      entityId: entity.id,
      orientation: "forward",
      start,
      end: points[(index + 1) % points.length]!
    }));
  }
  if (entity?.kind === "circle") {
    const left: Vec2 = [entity.center[0] - entity.radius, entity.center[1]];
    const right: Vec2 = [entity.center[0] + entity.radius, entity.center[1]];
    return [
      {
        kind: "arc",
        entityId: entity.id,
        orientation: "forward",
        start: right,
        end: left,
        center: entity.center,
        radius: entity.radius,
        startAngleRadians: 0,
        sweepAngleRadians: Math.PI
      },
      {
        kind: "arc",
        entityId: entity.id,
        orientation: "forward",
        start: left,
        end: right,
        center: entity.center,
        radius: entity.radius,
        startAngleRadians: Math.PI,
        sweepAngleRadians: Math.PI
      }
    ];
  }
  return undefined;
}

function unresolvedLoop(sketchId: string): RegionRevolveProfileResolution {
  return {
    ok: false,
    code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED",
    message: "Region revolve loop is unresolved.",
    sketchId
  };
}

function axisIntersection(
  sketchId: string,
  entityId: string,
  relation: string
): RegionRevolveProfileResolution {
  return {
    ok: false,
    code: "COMPOSITE_REVOLVE_AXIS_INTERSECTION",
    message: `Region profile intersects the axis (${relation}): ${entityId}.`,
    sketchId,
    sketchEntityId: entityId
  };
}
