import type {
  BodyId,
  CadSelectionReferenceOperation,
  FeatureExtrudeOperationMode,
  FeatureExtrudeProfileKind,
  FeatureId,
  SketchEntityId,
  SketchId,
  SketchProfileRef
} from "@web-cad/cad-protocol";

import { getSupportedEntityProfileKind } from "./normalizedFeatureInputs";

export interface BooleanTargetSupportFeature {
  readonly id: FeatureId;
  readonly kind: string;
  readonly bodyId: BodyId;
  readonly profile?: SketchProfileRef;
  readonly operationMode?: string;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
}

export interface BooleanTargetSupportDocument<
  TFeature extends BooleanTargetSupportFeature
> {
  readonly features: ReadonlyMap<FeatureId, TFeature>;
  readonly sketches: ReadonlyMap<
    SketchId,
    {
      readonly entities: ReadonlyMap<SketchEntityId, { readonly kind: string }>;
    }
  >;
}

type SupportedBooleanTargetKind = FeatureExtrudeProfileKind | "importedBody";

export function createSupportedBooleanBodyTargetOperations<
  TFeature extends BooleanTargetSupportFeature
>(
  document: BooleanTargetSupportDocument<TFeature>,
  bodyId: BodyId,
  topologyAnchorId?: string
): readonly CadSelectionReferenceOperation[] {
  const targetFeature = findFeatureByBodyId(document.features, bodyId);
  const targetProfileKind = resolveSupportedBooleanTargetProfileKind(
    document,
    targetFeature,
    topologyAnchorId,
    bodyId
  );
  const operations: CadSelectionReferenceOperation[] = [];

  if (
    targetProfileKind !== undefined &&
    isSupportedCutTargetProfileKind(targetProfileKind)
  ) {
    operations.push("feature.extrudeCutTarget");
  }

  if (
    targetProfileKind !== undefined &&
    isSupportedAddTargetProfileKind(
      targetProfileKind,
      topologyAnchorId !== undefined
    )
  ) {
    operations.push("feature.extrudeAddTarget");
  }

  if (
    targetProfileKind !== undefined &&
    isSupportedHoleTargetProfileKind(targetProfileKind)
  ) {
    operations.push("feature.holeTarget");
  }

  return operations;
}

export function filterSupportedBooleanBodyTargetOperations<
  TFeature extends BooleanTargetSupportFeature
>(
  document: BooleanTargetSupportDocument<TFeature>,
  bodyId: BodyId,
  topologyAnchorId: string,
  operations: readonly CadSelectionReferenceOperation[]
): readonly CadSelectionReferenceOperation[] {
  const supportedOperations = new Set(
    createSupportedBooleanBodyTargetOperations(
      document,
      bodyId,
      topologyAnchorId
    )
  );

  return operations.filter((operation) =>
    isBooleanBodyTargetOperation(operation)
      ? supportedOperations.has(operation)
      : true
  );
}

function isBooleanBodyTargetOperation(
  operation: CadSelectionReferenceOperation
): boolean {
  return (
    operation === "feature.extrudeCutTarget" ||
    operation === "feature.extrudeAddTarget" ||
    operation === "feature.holeTarget"
  );
}

function findFeatureByBodyId<TFeature extends BooleanTargetSupportFeature>(
  features: ReadonlyMap<FeatureId, TFeature>,
  bodyId: BodyId
): TFeature | undefined {
  return [...features.values()].find((feature) => feature.bodyId === bodyId);
}

function resolveSupportedBooleanTargetProfileKind<
  TFeature extends BooleanTargetSupportFeature
>(
  document: BooleanTargetSupportDocument<TFeature>,
  targetFeature: TFeature | undefined,
  targetTopologyAnchorId?: string,
  activeResultBodyId?: BodyId
): SupportedBooleanTargetKind | undefined {
  if (targetFeature?.kind === "importedBody") {
    return targetTopologyAnchorId !== undefined ? "importedBody" : undefined;
  }

  if (
    targetFeature?.kind !== "extrude" ||
    !isFeatureExtrudeOperationMode(targetFeature.operationMode)
  ) {
    return undefined;
  }

  const targetProfileKind = resolveProfileKind(document, targetFeature);
  if (!targetProfileKind) return undefined;

  if (targetFeature.operationMode === "newBody") {
    return targetProfileKind;
  }

  if (!isConsumingExtrudeOperationMode(targetFeature.operationMode)) {
    return undefined;
  }

  const allowActiveResultBodyAnchor =
    targetTopologyAnchorId !== undefined &&
    activeResultBodyId === targetFeature.bodyId;
  if (targetTopologyAnchorId === undefined && !allowActiveResultBodyAnchor) {
    return undefined;
  }

  let current: TFeature | undefined = targetFeature;
  const visitedFeatureIds = new Set<FeatureId>();

  while (
    current?.kind === "extrude" &&
    isFeatureExtrudeOperationMode(current.operationMode) &&
    !visitedFeatureIds.has(current.id)
  ) {
    visitedFeatureIds.add(current.id);

    if (current.operationMode === "newBody") {
      return resolveProfileKind(document, current);
    }

    if (current.targetBodyId === undefined) {
      return undefined;
    }

    const isAllowedActiveResultBody =
      allowActiveResultBodyAnchor && current.id === targetFeature.id;
    if (
      !isAllowedActiveResultBody &&
      current.targetTopologyAnchorId !== targetTopologyAnchorId
    ) {
      return undefined;
    }

    current = findFeatureByBodyId(document.features, current.targetBodyId);
  }

  return undefined;
}

function resolveProfileKind<TFeature extends BooleanTargetSupportFeature>(
  document: BooleanTargetSupportDocument<TFeature>,
  feature: TFeature
): FeatureExtrudeProfileKind | undefined {
  const profile =
    feature.profile?.kind === "entity" ? feature.profile : undefined;
  const entity = profile
    ? document.sketches.get(profile.sketchId)?.entities.get(profile.entityId)
    : undefined;
  return getSupportedEntityProfileKind(entity);
}

function isFeatureExtrudeOperationMode(
  operationMode: string | undefined
): operationMode is FeatureExtrudeOperationMode {
  return (
    operationMode === "newBody" ||
    operationMode === "add" ||
    operationMode === "cut"
  );
}

function isConsumingExtrudeOperationMode(
  operationMode: FeatureExtrudeOperationMode
): boolean {
  return operationMode === "add" || operationMode === "cut";
}

function isSupportedCutTargetProfileKind(
  profileKind: SupportedBooleanTargetKind
): boolean {
  return (
    profileKind === "rectangle" ||
    profileKind === "circle" ||
    profileKind === "importedBody"
  );
}

function isSupportedAddTargetProfileKind(
  profileKind: SupportedBooleanTargetKind,
  hasTopologyAnchorTarget: boolean
): boolean {
  return (
    profileKind === "rectangle" ||
    (hasTopologyAnchorTarget && profileKind === "circle") ||
    profileKind === "importedBody"
  );
}

function isSupportedHoleTargetProfileKind(
  profileKind: SupportedBooleanTargetKind
): boolean {
  return profileKind === "rectangle" || profileKind === "circle";
}
