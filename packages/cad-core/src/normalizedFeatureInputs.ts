import type {
  FeatureExtrudeProfileKind,
  FeatureSnapshot,
  FeatureSnapshotV21,
  FeatureSnapshotV22,
  LoftFeatureV22,
  OrientedSketchSegmentRef,
  ProfileConsumerFeatureV22,
  SketchEntityId,
  SketchEntityProfileRef,
  SketchId,
  SketchLoopRef,
  SketchPathRef,
  SketchProfileRefV22
} from "@web-cad/cad-protocol";
import { cloneSketchProfileRefV22 } from "./v22SourceShapes";

export type NormalizedFeature = FeatureSnapshotV22;

export interface NormalizedSketchEntityRef {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly orientation?: "forward" | "reverse";
}

export type NormalizedEntityProfileConsumerFeature = Exclude<
  ProfileConsumerFeatureV22,
  LoftFeatureV22
>;

export type NormalizedSingleProfileConsumerFeature = Exclude<
  ProfileConsumerFeatureV22,
  LoftFeatureV22
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
  profile: SketchProfileRefV22
): SketchProfileRefV22 {
  return cloneSketchProfileRefV22(profile);
}

export function cloneSketchPathRef(path: SketchPathRef): SketchPathRef {
  return path.kind === "entity"
    ? { ...path }
    : { ...path, segments: cloneSegments(path.segments) };
}

export function normalizeFeatureInputs(
  feature: FeatureSnapshot | FeatureSnapshotV21 | FeatureSnapshotV22
): NormalizedFeature {
  const stored = feature as unknown as Record<string, unknown>;
  if (feature.kind === "extrude" || feature.kind === "revolve") {
    if (stored.profile && typeof stored.profile === "object") {
      return {
        ...feature,
        profile: cloneSketchProfileRef(stored.profile as SketchProfileRefV22)
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
    } as LoftFeatureV22;
  }
  return structuredClone(feature) as NormalizedFeature;
}

export function getProfileEntityRefs(
  profile: SketchProfileRefV22
): readonly NormalizedSketchEntityRef[] {
  if (profile.kind === "entity") {
    return [{ sketchId: profile.sketchId, entityId: profile.entityId }];
  }
  if (profile.kind === "wire") {
    return profile.segments.map((segment) => ({
      sketchId: profile.sketchId,
      entityId: segment.entityId,
      orientation: segment.orientation
    }));
  }
  return profile.regions.flatMap((region) => [
    ...getLoopEntityRefs(profile.sketchId, region.outer),
    ...region.holes.flatMap((hole) => getLoopEntityRefs(profile.sketchId, hole))
  ]);
}

function getLoopEntityRefs(
  sketchId: SketchId,
  loop: SketchLoopRef
): readonly NormalizedSketchEntityRef[] {
  return loop.kind === "entity"
    ? [{ sketchId, entityId: loop.entityId }]
    : loop.segments.map((segment) => ({
        sketchId,
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
  feature: ProfileConsumerFeatureV22
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
  feature: Exclude<ProfileConsumerFeatureV22, LoftFeatureV22>
): SketchEntityProfileRef | undefined {
  return feature.profile.kind === "entity" ? feature.profile : undefined;
}

export function getFeatureProfileRef(
  feature: NormalizedSingleProfileConsumerFeature
): SketchProfileRefV22 {
  return feature.profile;
}

export const getEntityProfileRef = getSingleEntityProfile;

export function getFeatureEntityProfileRef(
  feature: NormalizedEntityProfileConsumerFeature
): SketchEntityProfileRef | undefined {
  return getSingleEntityProfile(feature);
}

export function getProfileSketchId(profile: SketchProfileRefV22): SketchId {
  return profile.sketchId;
}

export function getProfileEntityIds(
  profile: SketchProfileRefV22
): readonly SketchEntityId[] {
  return getProfileEntityRefs(profile).map((reference) => reference.entityId);
}

export function getProfileEntityReferences(
  profile: SketchProfileRefV22
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
  feature: LoftFeatureV22
): readonly SketchEntityProfileRef[] {
  return feature.sections.map((section) => section.profile);
}
