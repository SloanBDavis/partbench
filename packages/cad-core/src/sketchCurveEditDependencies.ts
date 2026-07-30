import type {
  FeatureId,
  FeatureSnapshot,
  FeatureSnapshotV21,
  FeatureSnapshotV22,
  SketchEntityId,
  SketchId
} from "@web-cad/cad-protocol";

import {
  getPathEntityRefs,
  getProfileEntityRefs,
  getProfileConsumerRefs,
  normalizeFeatureInputs
} from "./normalizedFeatureInputs";

export interface SketchCurveEditFeatureDependency {
  readonly featureId: FeatureId;
  readonly roles: readonly ("profile" | "path" | "axis" | "hole-center")[];
  readonly referencedEntityIds: readonly SketchEntityId[];
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function collectSketchCurveEditFeatureDependencies(
  features: Iterable<FeatureSnapshot | FeatureSnapshotV21 | FeatureSnapshotV22>,
  sketchId: SketchId,
  entityIds: ReadonlySet<SketchEntityId> | readonly SketchEntityId[]
): readonly SketchCurveEditFeatureDependency[] {
  const targetIds =
    entityIds instanceof Set ? entityIds : new Set<SketchEntityId>(entityIds);
  const dependencies: SketchCurveEditFeatureDependency[] = [];

  for (const source of features) {
    const feature = normalizeFeatureInputs(source);
    const references = new Map<
      SketchEntityId,
      Set<SketchCurveEditFeatureDependency["roles"][number]>
    >();
    const add = (
      entityId: SketchEntityId,
      role: SketchCurveEditFeatureDependency["roles"][number],
      candidateSketchId: SketchId
    ): void => {
      if (candidateSketchId !== sketchId || !targetIds.has(entityId)) return;
      const roles = references.get(entityId) ?? new Set();
      roles.add(role);
      references.set(entityId, roles);
    };

    if (feature.kind === "sweep") {
      for (const reference of getProfileEntityRefs(feature.profile)) {
        add(reference.entityId, "profile", reference.sketchId);
      }
      for (const reference of getPathEntityRefs(feature.path)) {
        add(reference.entityId, "path", reference.sketchId);
      }
    } else if (
      feature.kind === "extrude" ||
      feature.kind === "revolve" ||
      feature.kind === "loft"
    ) {
      for (const reference of getProfileConsumerRefs(feature)) {
        add(reference.entityId, "profile", reference.sketchId);
      }
    }

    if (feature.kind === "revolve") {
      add(feature.axis.entityId, "axis", feature.axis.sketchId);
    }
    if (feature.kind === "hole") {
      add(feature.circleEntityId, "hole-center", feature.sketchId);
    }

    if (references.size === 0) continue;
    dependencies.push({
      featureId: feature.id,
      roles: [
        ...new Set(
          [...references.values()].flatMap((roles) => [...roles.values()])
        )
      ].sort(compareCodeUnits),
      referencedEntityIds: [...references.keys()].sort(compareCodeUnits)
    });
  }

  return dependencies.sort((left, right) =>
    compareCodeUnits(left.featureId, right.featureId)
  );
}
