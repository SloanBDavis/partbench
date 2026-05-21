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
  readonly profileKind: "rectangle" | "circle";
  readonly label: string;
  readonly detail: string;
}

export interface CutOperationStatus {
  readonly available: boolean;
  readonly message: string;
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
        !isSupportedCutTargetProfileKind(feature.profileKind)
      ) {
        return [];
      }

      return [
        {
          bodyId: body.id,
          featureId: feature.id,
          profileKind: feature.profileKind,
          label: `${body.name ?? body.id} / ${feature.id}`,
          detail: `${formatProfileKind(feature.profileKind)} new body / ${feature.depth} / ${feature.side}`
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

export function getCutOperationStatus(
  entity: SketchEntitySnapshot | undefined,
  cutTargets: readonly CutTargetBodyOption[]
): CutOperationStatus {
  if (!entity) {
    return {
      available: false,
      message: "Select a rectangle profile to cut an existing body."
    };
  }

  if (entity.kind !== "rectangle") {
    return {
      available: false,
      message:
        "Cut currently supports rectangle profiles only. This profile can still create a new body."
    };
  }

  if (cutTargets.length === 0) {
    return {
      available: false,
      message:
        "Create an active rectangle or circle new body before using Cut body."
    };
  }

  return {
    available: true,
    message:
      cutTargets.length === 1
        ? "1 eligible cut target body."
        : `${cutTargets.length} eligible cut target bodies.`
  };
}

function isSupportedCutTargetProfileKind(
  profileKind: Extract<CadFeatureSummary, { kind: "extrude" }>["profileKind"]
): boolean {
  return profileKind === "rectangle" || profileKind === "circle";
}

function formatProfileKind(
  profileKind: Extract<CadFeatureSummary, { kind: "extrude" }>["profileKind"]
): string {
  return profileKind === "rectangle" ? "Rectangle" : "Circle";
}
