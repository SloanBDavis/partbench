import type {
  CadBodySnapshot,
  CadFeatureSummary,
  SketchEntityId,
  SketchEntityKind,
  SketchId,
  SketchEntitySnapshot,
  SketchSnapshot
} from "@web-cad/cad-protocol";

export interface CutTargetBodyOption {
  readonly bodyId: string;
  readonly featureId: string;
  readonly label: string;
}

export function chooseSketchPanelSelection(
  sketches: readonly SketchSnapshot[],
  currentSketchId: SketchId | undefined,
  focusedSketchId: SketchId | undefined
): SketchId | undefined {
  if (
    currentSketchId &&
    sketches.some((sketch) => sketch.id === currentSketchId)
  ) {
    return currentSketchId;
  }

  if (
    focusedSketchId &&
    sketches.some((sketch) => sketch.id === focusedSketchId)
  ) {
    return focusedSketchId;
  }

  return sketches[0]?.id;
}

export function getDefaultSketchEntityKind(
  sketch: SketchSnapshot | undefined
): SketchEntityKind {
  return sketch?.attachment && sketch.entities.length === 0
    ? "rectangle"
    : "point";
}

export function chooseSketchEntitySelection(
  entities: readonly SketchEntitySnapshot[],
  currentEntityId: SketchEntityId | undefined
): SketchEntityId | undefined {
  if (
    currentEntityId &&
    entities.some((entity) => entity.id === currentEntityId)
  ) {
    return currentEntityId;
  }

  return entities[0]?.id;
}

export function getSketchEntityOptionLabel(
  entity: SketchEntitySnapshot
): string {
  switch (entity.kind) {
    case "point":
      return `${entity.id} / point`;
    case "line":
      return `${entity.id} / line`;
    case "rectangle":
      return `${entity.id} / rectangle ${entity.width} x ${entity.height}`;
    case "circle":
      return `${entity.id} / circle r ${entity.radius}`;
  }
}

export function isExtrudableSketchEntity(
  entity: SketchEntitySnapshot | undefined
): entity is SketchEntitySnapshot & { kind: "rectangle" | "circle" } {
  return entity?.kind === "rectangle" || entity?.kind === "circle";
}

export function createCutTargetBodyOptions(
  bodies: readonly CadBodySnapshot[],
  features: readonly CadFeatureSummary[],
  preferredBodyId?: string
): readonly CutTargetBodyOption[] {
  const options = bodies
    .filter(
      (body) =>
        body.source.type === "sketchExtrudeFeature" &&
        body.consumedByFeatureId === undefined
    )
    .flatMap((body) => {
      const feature = features.find(
        (
          candidate
        ): candidate is Extract<CadFeatureSummary, { kind: "extrude" }> =>
          candidate.kind === "extrude" && candidate.id === body.featureId
      );

      if (
        !feature ||
        feature.operationMode !== "newBody" ||
        feature.profileKind !== "rectangle"
      ) {
        return [];
      }

      return [
        {
          bodyId: body.id,
          featureId: feature.id,
          label: `${body.name ?? body.id} / ${feature.id}`
        }
      ];
    });

  if (!preferredBodyId) {
    return options;
  }

  return [...options].sort((left, right) => {
    if (left.bodyId === preferredBodyId) {
      return -1;
    }

    if (right.bodyId === preferredBodyId) {
      return 1;
    }

    return 0;
  });
}
