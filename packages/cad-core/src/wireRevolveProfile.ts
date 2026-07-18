import type {
  CadExactExportResolvedWireProfile,
  FeatureRevolveAxis,
  PartId,
  SketchEntityId,
  SketchEntitySnapshot,
  SketchWireProfileRef,
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
  createResolvedWireExtrudeRecipe,
  resolveWireExtrudeProfile,
  type WireExtrudeProfileResolution
} from "./wireExtrudeProfile";

export type WireRevolveProfileResolution = WireExtrudeProfileResolution;

export function resolveWireRevolveProfile(
  document: SketchProfileReadinessDocument,
  profile: SketchWireProfileRef,
  axis: FeatureRevolveAxis
): WireRevolveProfileResolution {
  if (axis.sketchId !== profile.sketchId) {
    return {
      ok: false,
      code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED",
      message: "Composite revolve axis must belong to the profile sketch.",
      sketchId: profile.sketchId,
      sketchEntityId: axis.entityId
    };
  }
  if (profile.segments.some((ref) => ref.entityId === axis.entityId)) {
    return {
      ok: false,
      code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED",
      message: "Composite revolve axis cannot also be a profile entity.",
      sketchId: profile.sketchId,
      sketchEntityId: axis.entityId
    };
  }
  const requestedSketch = document.sketches.get(profile.sketchId);
  const requestedAxisEntity = requestedSketch?.entities.get(axis.entityId);
  if (!requestedAxisEntity || requestedAxisEntity.kind !== "line") {
    return {
      ok: false,
      code: requestedAxisEntity
        ? "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED"
        : "SKETCH_ENTITY_NOT_FOUND",
      message: "Composite revolve axis must reference an existing line.",
      sketchId: profile.sketchId,
      sketchEntityId: axis.entityId
    };
  }
  if (
    Math.hypot(
      requestedAxisEntity.end[0] - requestedAxisEntity.start[0],
      requestedAxisEntity.end[1] - requestedAxisEntity.start[1]
    ) <= SKETCH_GEOMETRY_POLICY.linearTolerance
  ) {
    return {
      ok: false,
      code: "COMPOSITE_REVOLVE_PROFILE_UNSUPPORTED",
      message: "Composite revolve axis line must have non-zero length.",
      sketchId: profile.sketchId,
      sketchEntityId: axis.entityId
    };
  }
  const resolution = resolveWireExtrudeProfile(document, profile, "newBody");
  if (!resolution.ok) return resolution;
  const sketch = requestedSketch!;
  const axisEntity = requestedAxisEntity;
  const resolvedSegments: ResolvedSketchSegment[] = [];
  for (const ref of resolution.profile.segments) {
    const entity = sketch.entities.get(ref.entityId);
    if (!entity || (entity.kind !== "line" && entity.kind !== "arc")) continue;
    const resolvedSegment = resolveOrientedSketchSegment(
      entity,
      ref.orientation
    );
    if (!resolvedSegment.ok) continue;
    resolvedSegments.push(resolvedSegment.segment);
    const relation = classifySketchSegmentAgainstInfiniteLine(
      resolvedSegment.segment,
      axisEntity.start,
      axisEntity.end
    );
    if (relation !== "clear" && relation !== "vertex-touch") {
      return {
        ok: false,
        code: "COMPOSITE_REVOLVE_AXIS_INTERSECTION",
        message:
          relation === "overlap"
            ? `Composite revolve profile edge overlaps the axis: ${entity.id}.`
            : `Composite revolve profile crosses or touches the axis away from a profile vertex: ${entity.id}.`,
        sketchId: profile.sketchId,
        sketchEntityId: entity.id
      };
    }
  }
  if (
    classifySketchWireAgainstInfiniteLine(
      resolvedSegments,
      axisEntity.start,
      axisEntity.end
    ) === "straddling"
  ) {
    return {
      ok: false,
      code: "COMPOSITE_REVOLVE_AXIS_INTERSECTION",
      message:
        "Composite revolve profile occupies both sides of the axis despite vertex-only contacts.",
      sketchId: profile.sketchId,
      sketchEntityId: axis.entityId
    };
  }
  return resolution;
}

export function createResolvedWireRevolveRecipe(
  profile: SketchWireProfileRef,
  axis: FeatureRevolveAxis,
  entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>,
  frame: CadExactExportResolvedWireProfile["frame"]
):
  | {
      readonly profile: CadExactExportResolvedWireProfile;
      readonly axis: {
        readonly sourceEntityId: SketchEntityId;
        readonly start: Vec2;
        readonly end: Vec2;
      };
    }
  | undefined {
  const resolvedProfile = createResolvedWireExtrudeRecipe(
    profile,
    entities,
    frame
  );
  const axisEntity = entities.get(axis.entityId);
  if (!resolvedProfile || axisEntity?.kind !== "line") return undefined;
  return {
    profile: resolvedProfile,
    axis: {
      sourceEntityId: axisEntity.id,
      start: axisEntity.start,
      end: axisEntity.end
    }
  };
}

export function createResolvedWireRevolveProfile(
  document: SketchProfileReadinessDocument & GeneratedReferencesDocument,
  profile: SketchWireProfileRef,
  axis: FeatureRevolveAxis,
  ownerPartId: PartId
): ReturnType<typeof createResolvedWireRevolveRecipe> {
  const resolution = resolveWireRevolveProfile(document, profile, axis);
  if (!resolution.ok) return undefined;
  const sketch = document.sketches.get(profile.sketchId) as
    | GeneratedReferencesSketch
    | undefined;
  if (!sketch) return undefined;
  const frame = createSourceMeasurementFrame(document, sketch, ownerPartId);
  if (!frame) return undefined;
  return createResolvedWireRevolveRecipe(
    resolution.profile,
    axis,
    sketch.entities,
    { origin: frame.origin, uAxis: frame.uAxis, vAxis: frame.vAxis }
  );
}
