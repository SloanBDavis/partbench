import type {
  FeatureSnapshot,
  FeatureSnapshotV21,
  LoftFeatureV21,
  OrientedSketchSegmentRef,
  ProfileConsumerFeatureV21,
  SketchEntityId,
  SketchEntityProfileRef,
  SketchId,
  SketchPathRef,
  SketchProfileRef
} from "@web-cad/cad-protocol";

export type NormalizedFeature = FeatureSnapshotV21;

export interface NormalizedSketchEntityRef {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly orientation?: "forward" | "reverse";
}

function cloneSegments(
  segments: readonly OrientedSketchSegmentRef[]
): readonly OrientedSketchSegmentRef[] {
  return segments.map((segment) => ({ ...segment }));
}

export function cloneSketchProfileRef(
  profile: SketchProfileRef
): SketchProfileRef {
  return profile.kind === "entity"
    ? { ...profile }
    : { ...profile, segments: cloneSegments(profile.segments) };
}

export function cloneSketchPathRef(path: SketchPathRef): SketchPathRef {
  return path.kind === "entity"
    ? { ...path }
    : { ...path, segments: cloneSegments(path.segments) };
}

/** Converts every V1-V20 profile consumer to the sole normalized in-memory form. */
export function normalizeFeatureInputs(
  feature: FeatureSnapshot | FeatureSnapshotV21
): NormalizedFeature {
  const stored = feature as unknown as Record<string, unknown>;
  if (feature.kind === "extrude" || feature.kind === "revolve") {
    if (stored.profile && typeof stored.profile === "object") {
      return {
        ...feature,
        profile: cloneSketchProfileRef(stored.profile as SketchProfileRef)
      } as NormalizedFeature;
    }
    const { sketchId, entityId, profileKind: _profileKind, ...base } = stored;
    void _profileKind;
    return {
      ...base,
      profile: { kind: "entity", sketchId, entityId }
    } as NormalizedFeature;
  }
  if (feature.kind === "sweep") {
    if (stored.profile && stored.path) {
      return {
        ...feature,
        profile: cloneSketchProfileRef(
          stored.profile as SketchEntityProfileRef
        ),
        path: cloneSketchPathRef(stored.path as SketchPathRef)
      } as NormalizedFeature;
    }
    const {
      profileSketchId,
      profileEntityId,
      pathSketchId,
      pathEntityIds,
      ...base
    } = stored;
    return {
      ...base,
      profile: {
        kind: "entity",
        sketchId: profileSketchId,
        entityId: profileEntityId
      },
      path: {
        kind: "entity",
        sketchId: pathSketchId,
        entityId: Array.isArray(pathEntityIds) ? pathEntityIds[0] : undefined,
        orientation: "forward"
      }
    } as NormalizedFeature;
  }
  if (feature.kind === "loft") {
    return {
      ...feature,
      sections: (stored.sections as readonly Record<string, unknown>[]).map(
        (section) => ({
          profile: section.profile
            ? cloneSketchProfileRef(section.profile as SketchEntityProfileRef)
            : {
                kind: "entity" as const,
                sketchId: section.sketchId as SketchId,
                entityId: section.entityId as SketchEntityId
              }
        })
      )
    } as LoftFeatureV21;
  }
  return structuredClone(feature) as NormalizedFeature;
}

export function getProfileEntityRefs(
  profile: SketchProfileRef
): readonly NormalizedSketchEntityRef[] {
  return profile.kind === "entity"
    ? [{ sketchId: profile.sketchId, entityId: profile.entityId }]
    : profile.segments.map((segment) => ({
        sketchId: profile.sketchId,
        entityId: segment.entityId,
        orientation: segment.orientation
      }));
}

export function getPathEntityRefs(
  path: SketchPathRef
): readonly NormalizedSketchEntityRef[] {
  return path.kind === "entity"
    ? [
        {
          sketchId: path.sketchId,
          entityId: path.entityId,
          orientation: path.orientation
        }
      ]
    : path.segments.map((segment) => ({
        sketchId: path.sketchId,
        entityId: segment.entityId,
        orientation: segment.orientation
      }));
}

export function getProfileConsumerRefs(
  feature: ProfileConsumerFeatureV21
): readonly NormalizedSketchEntityRef[] {
  if (feature.kind === "loft") {
    return feature.sections.flatMap((section) =>
      getProfileEntityRefs(section.profile)
    );
  }
  const profileRefs = getProfileEntityRefs(feature.profile);
  return feature.kind === "sweep"
    ? [...profileRefs, ...getPathEntityRefs(feature.path)]
    : profileRefs;
}

export function getSingleEntityProfile(
  feature: Exclude<ProfileConsumerFeatureV21, LoftFeatureV21>
): SketchEntityProfileRef | undefined {
  return feature.profile.kind === "entity" ? feature.profile : undefined;
}
