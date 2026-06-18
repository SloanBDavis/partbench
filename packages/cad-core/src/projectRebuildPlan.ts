import type {
  BodyId,
  CadBodyLifecycleEffectSummary,
  CadBodyLifecycleRole,
  CadBodyLifecycleState,
  CadBodyLifecycleSummary,
  CadBodySnapshot,
  CadFeatureSummary,
  CadOpsVersion,
  CadRebuildAffectedSummary,
  CadRebuildPlanDiagnostic,
  CadRebuildPlanStatus,
  CadReferenceHealthEntry,
  CadReferenceHealthStatus,
  FeatureId,
  ProjectRebuildPlanQueryResponse,
  SketchEntityId,
  SketchId
} from "@web-cad/cad-protocol";

const SOURCE_BOUNDARY_NOTE =
  "Rebuild plan and body lifecycle are derived from authoritative document source features, bodies, dependency graph, reference health, and semantic diffs.";
const DERIVED_BOUNDARY_NOTE =
  "Renderer meshes, OCCT indexes, OPFS paths, file handles, viewport state, selection-buffer ids, and export artifacts are excluded from rebuild authority.";

export interface CreateProjectRebuildPlanOptions {
  readonly cadOpsVersion: CadOpsVersion;
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly referenceHealth: readonly CadReferenceHealthEntry[];
  readonly lifecycleEffects?: readonly CadBodyLifecycleEffectSummary[];
}

export function createProjectRebuildPlan(
  options: CreateProjectRebuildPlanOptions
): ProjectRebuildPlanQueryResponse {
  const bodyIds = new Set(options.bodies.map((body) => body.id));
  const lifecycleEffects = (options.lifecycleEffects ?? []).filter((effect) =>
    bodyIds.has(effect.bodyId)
  );
  const bodyLifecycles = options.bodies.map((body) =>
    createBodyLifecycleSummary(options, body, lifecycleEffects)
  );
  const diagnostics = collectRebuildDiagnostics(bodyLifecycles);
  const affected = createAffectedSummary(
    options.features,
    options.referenceHealth,
    bodyLifecycles,
    lifecycleEffects
  );

  return {
    ok: true,
    query: "project.rebuildPlan",
    cadOpsVersion: options.cadOpsVersion,
    status: combineRebuildPlanStatus(bodyLifecycles, diagnostics),
    bodyLifecycleCount: bodyLifecycles.length,
    bodyLifecycles,
    lifecycleEffectCount: lifecycleEffects.length,
    lifecycleEffects,
    affected,
    diagnosticCount: diagnostics.length,
    diagnostics,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    requiresProjectSchemaMigration: false
  };
}

function createBodyLifecycleSummary(
  options: CreateProjectRebuildPlanOptions,
  body: CadBodySnapshot,
  lifecycleEffects: readonly CadBodyLifecycleEffectSummary[]
): CadBodyLifecycleSummary {
  const feature = options.features.find(
    (candidate) => candidate.id === body.featureId
  );
  const effects = lifecycleEffects.filter(
    (effect) => effect.bodyId === body.id
  );
  const referenceHealthStatus = combineReferenceStatuses(
    options.referenceHealth
      .filter((entry) => entry.bodyId === body.id)
      .map((entry) => entry.status)
  );
  const role = lifecycleRoleForBody(body, feature);
  const baseStates = lifecycleStatesForBody(body, feature, role);
  const states = uniqueLifecycleStates([
    ...baseStates,
    ...effects.flatMap((effect) => effect.states)
  ]);
  const primaryState = primaryLifecycleState(states, effects, body, feature);
  const diagnostics = [
    ...createLifecycleDiagnostics(
      body,
      feature,
      role,
      states,
      referenceHealthStatus
    ),
    ...effects.flatMap((effect) => createLifecycleEffectDiagnostics(effect))
  ];
  const derivedRebuildPending = states.includes("derived-rebuild-pending");
  const rebuildRequired =
    derivedRebuildPending ||
    states.includes("modified") ||
    states.includes("replacement") ||
    states.includes("stale") ||
    states.includes("failed");

  return {
    bodyId: body.id,
    ...(body.name ? { bodyName: body.name } : {}),
    featureId: body.featureId,
    ...(feature ? { featureKind: feature.kind } : {}),
    role,
    sourceType: body.source.type,
    primaryState,
    states,
    ...(body.consumedByFeatureId
      ? { consumedByFeatureId: body.consumedByFeatureId }
      : {}),
    ...("targetBodyId" in body.source
      ? { targetBodyId: body.source.targetBodyId }
      : {}),
    ...(referenceHealthStatus ? { referenceHealthStatus } : {}),
    rebuildRequired,
    derivedRebuildPending,
    commandReady: isCommandReady(states, referenceHealthStatus, diagnostics),
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function lifecycleRoleForBody(
  body: CadBodySnapshot,
  feature: CadFeatureSummary | undefined
): CadBodyLifecycleRole {
  if (body.consumedByFeatureId) {
    return "target";
  }

  if (body.source.type === "primitiveFeature") {
    return "primitiveCompatibility";
  }

  if (
    body.source.type === "sketchExtrudeFeature" &&
    feature?.kind === "extrude" &&
    feature.operationMode === "newBody"
  ) {
    return "source";
  }

  return "result";
}

function lifecycleStatesForBody(
  body: CadBodySnapshot,
  feature: CadFeatureSummary | undefined,
  role: CadBodyLifecycleRole
): readonly CadBodyLifecycleState[] {
  if (body.consumedByFeatureId) {
    if (
      body.source.type === "sketchExtrudeFeature" &&
      feature?.kind === "extrude" &&
      feature.operationMode === "newBody"
    ) {
      return ["consumed", "source"];
    }

    if (body.source.type !== "primitiveFeature") {
      return ["consumed", "result"];
    }

    return ["consumed"];
  }

  if (role === "source") {
    return ["active", "source"];
  }

  if (role === "primitiveCompatibility") {
    return ["unsupported"];
  }

  if (
    body.source.type === "sketchExtrudeFeature" &&
    feature?.kind === "extrude" &&
    feature.operationMode !== "newBody"
  ) {
    return ["active", "result", "ambiguous", "repair-needed"];
  }

  if (body.source.type === "sketchRevolveFeature") {
    return ["active", "result", "ambiguous", "repair-needed"];
  }

  if (body.source.type === "sketchHoleFeature") {
    return ["active", "result"];
  }

  if (
    body.source.type === "edgeChamferFeature" ||
    body.source.type === "edgeFilletFeature"
  ) {
    return ["active", "result", "repair-needed"];
  }

  return ["unsupported"];
}

function primaryLifecycleState(
  states: readonly CadBodyLifecycleState[],
  effects: readonly CadBodyLifecycleEffectSummary[],
  body: CadBodySnapshot,
  feature: CadFeatureSummary | undefined
): CadBodyLifecycleState {
  const latestEffectPrimary = effects.at(-1)?.primaryState;

  if (latestEffectPrimary === "failed") {
    return latestEffectPrimary;
  }

  if (body.consumedByFeatureId) {
    return "consumed";
  }

  if (states.includes("failed")) {
    return "failed";
  }

  if (
    latestEffectPrimary &&
    ["replacement", "stale", "modified"].includes(latestEffectPrimary)
  ) {
    return latestEffectPrimary;
  }

  if (states.includes("repair-needed")) {
    return "repair-needed";
  }

  if (states.includes("ambiguous")) {
    return "ambiguous";
  }

  if (states.includes("derived-rebuild-pending")) {
    return "derived-rebuild-pending";
  }

  if (latestEffectPrimary) {
    return latestEffectPrimary;
  }

  if (
    body.source.type === "sketchExtrudeFeature" &&
    feature?.kind === "extrude" &&
    feature.operationMode === "newBody"
  ) {
    return "active";
  }

  return states[0] ?? "unsupported";
}

function createLifecycleDiagnostics(
  body: CadBodySnapshot,
  feature: CadFeatureSummary | undefined,
  role: CadBodyLifecycleRole,
  states: readonly CadBodyLifecycleState[],
  referenceHealthStatus: CadReferenceHealthStatus | undefined
): readonly CadRebuildPlanDiagnostic[] {
  const diagnostics: CadRebuildPlanDiagnostic[] = [];

  if (body.consumedByFeatureId) {
    diagnostics.push({
      code: "REBUILD_TARGET_CONSUMED",
      severity: "warning",
      status: "repair-needed",
      message: `Body ${body.id} is consumed by feature ${body.consumedByFeatureId}.`,
      bodyId: body.id,
      featureId: body.featureId,
      received: body.consumedByFeatureId
    });
  }

  if (role === "primitiveCompatibility") {
    diagnostics.push({
      code: "REBUILD_BODY_UNSUPPORTED",
      severity: "warning",
      status: "unsupported",
      message: `Primitive compatibility body ${body.id} does not participate in V10 rebuild lifecycle semantics.`,
      bodyId: body.id,
      featureId: body.featureId,
      expected: "authored source feature",
      received: body.source.type
    });
  }

  if (states.includes("ambiguous")) {
    diagnostics.push({
      code: "REBUILD_RESULT_TOPOLOGY_AMBIGUOUS",
      severity: "warning",
      status: "repair-needed",
      message: `Result body ${body.id} has ambiguous topology until explicit repair semantics are implemented.`,
      bodyId: body.id,
      featureId: body.featureId,
      ...("targetBodyId" in body.source
        ? { targetBodyId: body.source.targetBodyId }
        : {}),
      expected: "proven source-semantic topology",
      received: feature?.kind ?? body.source.type
    });
  } else if (states.includes("repair-needed")) {
    diagnostics.push({
      code: "REBUILD_RESULT_REPAIR_NEEDED",
      severity: "warning",
      status: "repair-needed",
      message: `Result body ${body.id} needs explicit reference repair semantics before downstream references are command-ready.`,
      bodyId: body.id,
      featureId: body.featureId,
      ...("targetBodyId" in body.source
        ? { targetBodyId: body.source.targetBodyId }
        : {}),
      expected: "repairable command-ready result topology",
      received: feature?.kind ?? body.source.type
    });
  }

  if (
    referenceHealthStatus &&
    referenceHealthStatus !== "active" &&
    !states.includes("consumed") &&
    !states.includes("repair-needed") &&
    !states.includes("ambiguous")
  ) {
    diagnostics.push({
      code:
        referenceHealthStatus === "unsupported"
          ? "REBUILD_BODY_UNSUPPORTED"
          : referenceHealthStatus === "stale"
            ? "REBUILD_SOURCE_STALE"
            : "REBUILD_REFERENCE_REPAIR_NEEDED",
      severity: referenceHealthStatus === "missing" ? "blocker" : "warning",
      status:
        referenceHealthStatus === "unsupported"
          ? "unsupported"
          : "repair-needed",
      message: `Reference health for body ${body.id} is ${referenceHealthStatus}.`,
      bodyId: body.id,
      featureId: body.featureId,
      expected: "active reference health",
      received: referenceHealthStatus
    });
  }

  return diagnostics;
}

function createLifecycleEffectDiagnostics(
  effect: CadBodyLifecycleEffectSummary
): readonly CadRebuildPlanDiagnostic[] {
  if (!effect.diagnosticCode) {
    return [];
  }

  return [
    {
      code: effect.diagnosticCode,
      severity:
        effect.diagnosticCode === "REBUILD_FAILED" ? "blocker" : "warning",
      status:
        effect.primaryState === "failed"
          ? "failed"
          : effect.states.includes("repair-needed") ||
              effect.states.includes("ambiguous")
            ? "repair-needed"
            : effect.states.includes("unsupported")
              ? "unsupported"
              : "pending",
      message: effect.message,
      bodyId: effect.bodyId,
      ...(effect.featureId ? { featureId: effect.featureId } : {}),
      ...(effect.targetFeatureId
        ? { targetFeatureId: effect.targetFeatureId }
        : {})
    }
  ];
}

function isCommandReady(
  states: readonly CadBodyLifecycleState[],
  referenceHealthStatus: CadReferenceHealthStatus | undefined,
  diagnostics: readonly CadRebuildPlanDiagnostic[]
): boolean {
  if (
    states.some((state) =>
      [
        "consumed",
        "ambiguous",
        "missing",
        "unsupported",
        "repair-needed",
        "deleted",
        "failed",
        "derived-rebuild-pending"
      ].includes(state)
    )
  ) {
    return false;
  }

  if (referenceHealthStatus && referenceHealthStatus !== "active") {
    return false;
  }

  return diagnostics.every((diagnostic) => diagnostic.severity !== "blocker");
}

function createAffectedSummary(
  features: readonly CadFeatureSummary[],
  referenceHealth: readonly CadReferenceHealthEntry[],
  bodyLifecycles: readonly CadBodyLifecycleSummary[],
  lifecycleEffects: readonly CadBodyLifecycleEffectSummary[]
): CadRebuildAffectedSummary {
  const affectedBodyIds = new Set<BodyId>(
    bodyLifecycles
      .filter(
        (body) =>
          body.rebuildRequired ||
          !body.commandReady ||
          body.states.includes("consumed")
      )
      .map((body) => body.bodyId)
  );

  for (const effect of lifecycleEffects) {
    affectedBodyIds.add(effect.bodyId);
  }

  const affectedFeatures = features.filter(
    (feature) =>
      affectedBodyIds.has(feature.bodyId) ||
      ("targetBodyId" in feature &&
        feature.targetBodyId !== undefined &&
        affectedBodyIds.has(feature.targetBodyId))
  );
  const affectedFeatureIds = new Set<FeatureId>(
    affectedFeatures.map((feature) => feature.id)
  );
  const affectedSketchIds = new Set<SketchId>();
  const affectedSketchEntityIds = new Set<SketchEntityId>();

  for (const feature of affectedFeatures) {
    if ("sketchId" in feature) {
      affectedSketchIds.add(feature.sketchId);
    }

    if ("entityId" in feature) {
      affectedSketchEntityIds.add(feature.entityId);
    }

    if ("circleEntityId" in feature) {
      affectedSketchEntityIds.add(feature.circleEntityId);
    }

    if (feature.kind === "revolve" && feature.axis.type === "sketchLine") {
      affectedSketchIds.add(feature.axis.sketchId);
      affectedSketchEntityIds.add(feature.axis.entityId);
    }
  }

  const affectedReferenceHealth = referenceHealth.filter(
    (entry) => entry.bodyId !== undefined && affectedBodyIds.has(entry.bodyId)
  );

  return {
    sketchIds: [...affectedSketchIds],
    sketchEntityIds: [...affectedSketchEntityIds],
    featureIds: [...affectedFeatureIds],
    bodyIds: [...affectedBodyIds],
    generatedReferenceCount: affectedReferenceHealth.filter(
      (entry) => entry.source === "generatedReference"
    ).length,
    namedReferenceCount: affectedReferenceHealth.filter(
      (entry) => entry.source === "namedReference"
    ).length,
    derivedArtifactKinds: affectedBodyIds.size > 0 ? ["derivedGeometry"] : []
  };
}

function collectRebuildDiagnostics(
  bodyLifecycles: readonly CadBodyLifecycleSummary[]
): readonly CadRebuildPlanDiagnostic[] {
  return bodyLifecycles.flatMap((body) => body.diagnostics);
}

function combineRebuildPlanStatus(
  bodyLifecycles: readonly CadBodyLifecycleSummary[],
  diagnostics: readonly CadRebuildPlanDiagnostic[]
): CadRebuildPlanStatus {
  if (
    diagnostics.some((diagnostic) => diagnostic.code === "REBUILD_FAILED") ||
    bodyLifecycles.some((body) => body.states.includes("failed"))
  ) {
    return "failed";
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "blocker")) {
    return "blocked";
  }

  if (
    bodyLifecycles.some(
      (body) =>
        body.states.includes("repair-needed") ||
        body.states.includes("ambiguous") ||
        body.states.includes("stale")
    )
  ) {
    return "repair-needed";
  }

  if (bodyLifecycles.some((body) => body.derivedRebuildPending)) {
    return "pending";
  }

  if (
    bodyLifecycles.length > 0 &&
    bodyLifecycles.every((body) => body.states.includes("unsupported"))
  ) {
    return "unsupported";
  }

  return "ready";
}

function combineReferenceStatuses(
  statuses: readonly CadReferenceHealthStatus[]
): CadReferenceHealthStatus | undefined {
  if (statuses.length === 0) {
    return undefined;
  }

  for (const status of [
    "missing",
    "deleted",
    "stale",
    "consumed",
    "ambiguous",
    "unsupported",
    "repair-needed",
    "replaced",
    "active"
  ] satisfies readonly CadReferenceHealthStatus[]) {
    if (statuses.includes(status)) {
      return status;
    }
  }

  return "active";
}

function uniqueLifecycleStates(
  states: readonly CadBodyLifecycleState[]
): readonly CadBodyLifecycleState[] {
  return [...new Set(states)];
}
