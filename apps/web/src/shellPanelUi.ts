import type {
  CadBodySnapshot,
  CadFeatureSummary,
  CadGeneratedFaceReference,
  FeatureShellOpenFaceRef
} from "@web-cad/cad-protocol";

const SHELL_FACE_OPERATION = "feature.shell";

export type ShellPanelState =
  | {
      readonly mode: "create";
      readonly targetBodyId: string;
      readonly targetLabel: string;
    }
  | {
      readonly mode: "edit";
      readonly featureId: string;
      readonly targetBodyId: string;
      readonly wallThickness: number;
      readonly openFaceRefs: readonly FeatureShellOpenFaceRef[];
    }
  | {
      readonly mode: "unavailable";
      readonly reason: string;
    };

export interface ShellOpenFaceOption {
  readonly stableId: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly reason?: string;
}

export function getShellPanelState(
  body: CadBodySnapshot,
  feature: CadFeatureSummary | undefined
): ShellPanelState {
  if (feature?.kind === "shell") {
    return {
      mode: "edit",
      featureId: feature.id,
      targetBodyId: feature.targetBodyId,
      wallThickness: feature.wallThickness,
      openFaceRefs: feature.openFaceRefs
    };
  }

  if (!feature || feature.kind === "primitive") {
    return {
      mode: "unavailable",
      reason: "Primitive-derived bodies cannot be shell targets."
    };
  }

  if (body.consumedByFeatureId) {
    return {
      mode: "unavailable",
      reason: `Body ${body.id} is consumed by feature ${body.consumedByFeatureId} and cannot be shelled.`
    };
  }

  return {
    mode: "create",
    targetBodyId: body.id,
    targetLabel: body.name ?? body.id
  };
}

export function createShellDefaultName(
  targetLabel: string,
  wallThickness: number
): string {
  return `Shell ${targetLabel} ${formatShellThickness(wallThickness)}`;
}

export function getShellOpenFaceOptions(
  faces: readonly CadGeneratedFaceReference[]
): readonly ShellOpenFaceOption[] {
  return faces.map((face) => {
    const eligible = face.eligibleOperations.includes(SHELL_FACE_OPERATION);

    return {
      stableId: face.stableId,
      label: face.label || face.role,
      disabled: !eligible,
      ...(eligible
        ? {}
        : {
            reason:
              face.eligibilityNotes?.[0] ??
              "This face is not eligible for shell opening."
          })
    };
  });
}

export function buildShellGeneratedOpenFaceRefs(
  targetBodyId: string,
  stableIds: readonly string[]
): readonly FeatureShellOpenFaceRef[] {
  return stableIds.map((stableId) => ({
    kind: "generatedFace" as const,
    bodyId: targetBodyId,
    stableId
  }));
}

function formatShellThickness(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
