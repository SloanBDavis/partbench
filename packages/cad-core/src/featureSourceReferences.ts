import type {
  ExtrudeFeatureV21,
  FeatureExtrudeProfileKind,
  LoftFeatureV21,
  ProfileConsumerFeatureV21,
  RevolveFeatureV21,
  SketchEntityId,
  SketchEntityProfileRef,
  SketchId,
  SketchPathRef,
  SketchProfileRef,
  SweepFeatureV21
} from "@web-cad/cad-protocol";

export type NormalizedEntityProfileConsumerFeature =
  | ExtrudeFeatureV21
  | RevolveFeatureV21
  | SweepFeatureV21;

export type NormalizedSingleProfileConsumerFeature = Exclude<
  ProfileConsumerFeatureV21,
  LoftFeatureV21
>;

export interface SketchEntitySourceReference {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
}

export function getFeatureProfileRef(
  feature: NormalizedSingleProfileConsumerFeature
): SketchProfileRef {
  return feature.profile;
}

export function getEntityProfileRef(
  profile: SketchProfileRef
): SketchEntityProfileRef | undefined {
  return profile.kind === "entity" ? profile : undefined;
}

export function getFeatureEntityProfileRef(
  feature: NormalizedEntityProfileConsumerFeature
): SketchEntityProfileRef | undefined {
  return getEntityProfileRef(feature.profile);
}

export function getProfileSketchId(profile: SketchProfileRef): SketchId {
  return profile.sketchId;
}

export function getProfileEntityIds(
  profile: SketchProfileRef
): readonly SketchEntityId[] {
  return profile.kind === "entity"
    ? [profile.entityId]
    : profile.segments.map((segment) => segment.entityId);
}

export function getProfileEntityReferences(
  profile: SketchProfileRef
): readonly SketchEntitySourceReference[] {
  return getProfileEntityIds(profile).map((entityId) => ({
    sketchId: profile.sketchId,
    entityId
  }));
}

export function getSweepPathSketchId(path: SketchPathRef): SketchId {
  return path.sketchId;
}

export function getSweepPathEntityIds(
  path: SketchPathRef
): readonly SketchEntityId[] {
  return path.kind === "entity"
    ? [path.entityId]
    : path.segments.map((segment) => segment.entityId);
}

export function getSweepPathEntityReferences(
  path: SketchPathRef
): readonly SketchEntitySourceReference[] {
  return getSweepPathEntityIds(path).map((entityId) => ({
    sketchId: path.sketchId,
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
