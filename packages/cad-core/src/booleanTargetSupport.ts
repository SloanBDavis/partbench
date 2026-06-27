import type {
  BodyId,
  CadSelectionReferenceOperation,
  FeatureExtrudeOperationMode,
  FeatureExtrudeProfileKind,
  FeatureId
} from "@web-cad/cad-protocol";

export interface BooleanTargetSupportFeature {
  readonly id: FeatureId;
  readonly kind: string;
  readonly bodyId: BodyId;
  readonly profileKind?: string;
  readonly operationMode?: string;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
}

export function createSupportedBooleanBodyTargetOperations<
  TFeature extends BooleanTargetSupportFeature
>(
  features: ReadonlyMap<FeatureId, TFeature>,
  bodyId: BodyId,
  topologyAnchorId: string
): readonly CadSelectionReferenceOperation[] {
  const targetFeature = findFeatureByBodyId(features, bodyId);
  const targetProfileKind = resolveSupportedBooleanTargetProfileKind(
    features,
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
    isSupportedAddTargetProfileKind(targetProfileKind)
  ) {
    operations.push("feature.extrudeAddTarget");
  }

  if (
    targetProfileKind !== undefined &&
    isSupportedCutTargetProfileKind(targetProfileKind)
  ) {
    operations.push("feature.holeTarget");
  }

  return operations;
}

export function filterSupportedBooleanBodyTargetOperations<
  TFeature extends BooleanTargetSupportFeature
>(
  features: ReadonlyMap<FeatureId, TFeature>,
  bodyId: BodyId,
  topologyAnchorId: string,
  operations: readonly CadSelectionReferenceOperation[]
): readonly CadSelectionReferenceOperation[] {
  const supportedOperations = new Set(
    createSupportedBooleanBodyTargetOperations(
      features,
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
  features: ReadonlyMap<FeatureId, TFeature>,
  targetFeature: TFeature | undefined,
  targetTopologyAnchorId?: string,
  activeResultBodyId?: BodyId
): FeatureExtrudeProfileKind | undefined {
  if (
    targetFeature?.kind !== "extrude" ||
    !isFeatureExtrudeProfileKind(targetFeature.profileKind) ||
    !isFeatureExtrudeOperationMode(targetFeature.operationMode)
  ) {
    return undefined;
  }

  if (targetFeature.operationMode === "newBody") {
    return targetFeature.profileKind;
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
    isFeatureExtrudeProfileKind(current.profileKind) &&
    isFeatureExtrudeOperationMode(current.operationMode) &&
    !visitedFeatureIds.has(current.id)
  ) {
    visitedFeatureIds.add(current.id);

    if (current.operationMode === "newBody") {
      return current.profileKind;
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

    current = findFeatureByBodyId(features, current.targetBodyId);
  }

  return undefined;
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

function isFeatureExtrudeProfileKind(
  profileKind: string | undefined
): profileKind is FeatureExtrudeProfileKind {
  return profileKind === "rectangle" || profileKind === "circle";
}

function isSupportedCutTargetProfileKind(
  profileKind: FeatureExtrudeProfileKind
): boolean {
  return profileKind === "rectangle" || profileKind === "circle";
}

function isSupportedAddTargetProfileKind(
  profileKind: FeatureExtrudeProfileKind
): boolean {
  return profileKind === "rectangle" || profileKind === "circle";
}
