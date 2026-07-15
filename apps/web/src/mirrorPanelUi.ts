import type {
  CadBodySnapshot,
  CadFeatureSummary,
  FeatureMirrorPlane,
  MirrorPlaneRef
} from "@web-cad/cad-protocol";

export const MIRROR_PLANE_OPTIONS: readonly FeatureMirrorPlane[] = [
  "XY",
  "XZ",
  "YZ"
];

export type MirrorPanelState =
  | {
      readonly mode: "create";
      readonly seedBodyId: string;
      readonly seedLabel: string;
    }
  | {
      readonly mode: "edit";
      readonly featureId: string;
      readonly plane: MirrorPlaneRef;
      readonly includeOriginal: boolean;
    }
  | {
      readonly mode: "unavailable";
      readonly reason: string;
    };

/**
 * Classifies the selected body for the Mirror workbench card.
 *
 * - A mirror result body opens the edit form for its mirror feature.
 * - An active authored feature body is offered as the mirror seed.
 * - Primitive-derived and consumed bodies are ineligible seeds, matching the
 *   cad-core feature.mirror validation (MIRROR_SEED_BODY_UNSUPPORTED /
 *   MIRROR_SEED_BODY_CONSUMED).
 */
export function getMirrorPanelState(
  body: CadBodySnapshot,
  feature: CadFeatureSummary | undefined
): MirrorPanelState {
  if (feature?.kind === "mirror") {
    return {
      mode: "edit",
      featureId: feature.id,
      plane: feature.plane,
      includeOriginal: feature.includeOriginal
    };
  }

  if (!feature || feature.kind === "primitive") {
    return {
      mode: "unavailable",
      reason: "Primitive-derived bodies cannot seed a mirror feature."
    };
  }

  if (body.consumedByFeatureId) {
    return {
      mode: "unavailable",
      reason: `Body ${body.id} is consumed by feature ${body.consumedByFeatureId} and cannot seed a mirror.`
    };
  }

  return {
    mode: "create",
    seedBodyId: body.id,
    seedLabel: body.name ?? body.id
  };
}

export function createMirrorDefaultName(
  seedLabel: string,
  planeLabel: string
): string {
  return `Mirror ${seedLabel} across ${planeLabel}`;
}

export function formatMirrorPlaneLabel(plane: FeatureMirrorPlane): string {
  return `${plane} plane`;
}
