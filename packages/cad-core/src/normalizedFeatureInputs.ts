import type {
  ExtrudeFeatureV21,
  FeatureExtrudeProfileKind,
  FeatureSnapshot,
  FeatureSnapshotV21,
  LoftFeatureV21,
  OrientedSketchSegmentRef,
  ProfileConsumerFeatureV21,
  RevolveFeatureV21,
  SketchEntityId,
  SketchEntityProfileRef,
  SketchId,
  SketchPathRef,
  SketchProfileRef,
  SweepFeatureV21
} from "@web-cad/cad-protocol";

export type NormalizedFeature = FeatureSnapshotV21;

export interface NormalizedSketchEntityRef {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly orientation?: "forward" | "reverse";
}

export type NormalizedEntityProfileConsumerFeature =
  | ExtrudeFeatureV21
  | RevolveFeatureV21
  | SweepFeatureV21;

export type NormalizedSingleProfileConsumerFeature = Exclude<
  ProfileConsumerFeatureV21,
  LoftFeatureV21
>;

export type SketchEntitySourceReference = Pick<
  NormalizedSketchEntityRef,
  "sketchId" | "entityId"
>;

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

export function getFeatureProfileRef(
  feature: NormalizedSingleProfileConsumerFeature
): SketchProfileRef {
  return feature.profile;
}

export const getEntityProfileRef = getSingleEntityProfile;

export function getFeatureEntityProfileRef(
  feature: NormalizedEntityProfileConsumerFeature
): SketchEntityProfileRef | undefined {
  return getSingleEntityProfile(feature);
}

export function getProfileSketchId(profile: SketchProfileRef): SketchId {
  return profile.sketchId;
}

export function getProfileEntityIds(
  profile: SketchProfileRef
): readonly SketchEntityId[] {
  return getProfileEntityRefs(profile).map((reference) => reference.entityId);
}

export function getProfileEntityReferences(
  profile: SketchProfileRef
): readonly SketchEntitySourceReference[] {
  return getProfileEntityRefs(profile).map(({ sketchId, entityId }) => ({
    sketchId,
    entityId
  }));
}

export function getSweepPathSketchId(path: SketchPathRef): SketchId {
  return path.sketchId;
}

export function getSweepPathEntityIds(
  path: SketchPathRef
): readonly SketchEntityId[] {
  return getPathEntityRefs(path).map((reference) => reference.entityId);
}

export function getSweepPathEntityReferences(
  path: SketchPathRef
): readonly SketchEntitySourceReference[] {
  return getPathEntityRefs(path).map(({ sketchId, entityId }) => ({
    sketchId,
    entityId
  }));
}

export function getFeaturePrimaryEntityRef(
  feature: NormalizedEntityProfileConsumerFeature
): SketchEntitySourceReference | undefined {
  const profile = getFeatureEntityProfileRef(feature);
  return profile
    ? { sketchId: profile.sketchId, entityId: profile.entityId }
    : undefined;
}

export function getSupportedEntityProfileKind(
  entity: { readonly kind: string } | undefined
): FeatureExtrudeProfileKind | undefined {
  return entity?.kind === "rectangle" || entity?.kind === "circle"
    ? entity.kind
    : undefined;
}

export function getLoftSectionProfiles(
  feature: LoftFeatureV21
): readonly SketchEntityProfileRef[] {
  return feature.sections.map((section) => section.profile);
}
