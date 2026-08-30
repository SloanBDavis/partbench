import type { BodyMeasurementsSnapshot } from "@web-cad/cad-core";
import type {
  CadViewportInteractionStatus,
  CadViewportTwoTargetMeasurementDiagnostic,
  CadViewportTwoTargetMeasurementResult,
  CadViewportTwoTargetMeasurementTarget,
  DocumentUnits,
  GeneratedReferenceMeasurement,
  Vec3
} from "@web-cad/cad-protocol";
import {
  formatBounds,
  formatNumber,
  formatPoint,
  type MeasurementDisplayRow
} from "./sceneObjectDisplay";
import {
  bindExactInspectionTarget,
  measureExactInspectionPair,
  type ExactInspectionArtifact,
  type ExactInspectionBindResult,
  type ExactInspectionEntity,
  type ExactInspectionIdentity,
  type ExactInspectionResult
} from "./exactInspectionMeasurement";
import {
  formatViewportMeasurementAuthority,
  type ViewportMeasurementOverlay
} from "./viewportMeasurementOverlay";
import {
  dedupeDiagnostics,
  redactInternalViewportIds
} from "./viewportVisibleText";

export type ViewportTwoTargetMeasurementSource =
  | "body.measurements"
  | "body.generatedReferenceMeasurements"
  | "selection.referenceCandidates"
  | "unsupported";

export interface ViewportTwoTargetMeasurementTarget extends CadViewportTwoTargetMeasurementTarget {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly authorityLabel: string;
  readonly source: ViewportTwoTargetMeasurementSource;
  readonly point?: Vec3;
  readonly pointLabel?: string;
  readonly vector?: Vec3;
  readonly vectorLabel?: string;
  readonly exactIdentity?: ExactInspectionIdentity;
  readonly exactEntity?: ExactInspectionEntity;
  readonly summaryRows: readonly MeasurementDisplayRow[];
}

export interface ViewportTwoTargetMeasurementSession {
  readonly firstTarget?: ViewportTwoTargetMeasurementTarget;
  readonly secondTarget?: ViewportTwoTargetMeasurementTarget;
}

export type ViewportTwoTargetMeasurementSessionAction =
  | {
      readonly type: "start";
      readonly target?: ViewportTwoTargetMeasurementTarget;
    }
  | {
      readonly type: "setSecond";
      readonly target?: ViewportTwoTargetMeasurementTarget;
    }
  | { readonly type: "clear" };

export type ViewportTwoTargetMeasurementViewStatus =
  | "idle"
  | "waitingForSecond"
  | "preview"
  | "complete"
  | "blocked";

export interface ViewportTwoTargetMeasurementDisplayResult extends CadViewportTwoTargetMeasurementResult {
  readonly title: string;
  readonly detail: string;
  readonly authorityLabel: string;
  readonly rows: readonly MeasurementDisplayRow[];
}

export interface ViewportTwoTargetMeasurementView {
  readonly status: ViewportTwoTargetMeasurementViewStatus;
  readonly firstTarget?: ViewportTwoTargetMeasurementTarget;
  readonly secondTarget?: ViewportTwoTargetMeasurementTarget;
  readonly pendingTarget?: ViewportTwoTargetMeasurementTarget;
  readonly activeTarget?: ViewportTwoTargetMeasurementTarget;
  readonly results: readonly ViewportTwoTargetMeasurementDisplayResult[];
  readonly diagnostics: readonly CadViewportTwoTargetMeasurementDiagnostic[];
  readonly prompt: string;
}

export interface CreateViewportTwoTargetMeasurementTargetInput {
  readonly measurementOverlay?: ViewportMeasurementOverlay;
  readonly bodyMeasurements?: BodyMeasurementsSnapshot;
  readonly generatedReferenceMeasurement?: GeneratedReferenceMeasurement;
  readonly exactIdentity?: ExactInspectionIdentity;
  readonly exactEntity?: ExactInspectionEntity;
  readonly exactArtifacts?: readonly ExactInspectionArtifact[];
}

export interface CreateViewportTwoTargetMeasurementViewInput {
  readonly activeTarget?: ViewportTwoTargetMeasurementTarget;
  readonly session: ViewportTwoTargetMeasurementSession;
  readonly units: DocumentUnits;
  readonly exactArtifacts?: readonly ExactInspectionArtifact[];
}

export function createViewportTwoTargetMeasurementTarget({
  bodyMeasurements,
  generatedReferenceMeasurement,
  measurementOverlay,
  exactArtifacts,
  exactEntity,
  exactIdentity
}: CreateViewportTwoTargetMeasurementTargetInput):
  | ViewportTwoTargetMeasurementTarget
  | undefined {
  if (!measurementOverlay) {
    return undefined;
  }

  const { target } = measurementOverlay;
  const base = createTargetBase(measurementOverlay);
  const boundExact = attachExactTarget(
    base,
    exactIdentity,
    exactEntity,
    exactArtifacts
  );

  if (target.targetKind === "body") {
    return {
      ...boundExact,
      ...(bodyMeasurements
        ? {
            point: bodyMeasurements.centroid,
            pointLabel: "Body centroid",
            pointRole: "bodyCentroid" as const,
            summaryRows: [
              {
                label: "Centroid",
                value: formatPoint(
                  bodyMeasurements.centroid,
                  bodyMeasurements.units
                )
              },
              {
                label: "Bounds",
                value: formatBounds(
                  bodyMeasurements.localBounds,
                  bodyMeasurements.units
                )
              }
            ]
          }
        : {
            summaryRows: []
          })
    };
  }

  if (!generatedReferenceMeasurement) {
    return {
      ...boundExact,
      summaryRows: []
    };
  }

  if (generatedReferenceMeasurement.kind === "face") {
    return {
      ...boundExact,
      point: generatedReferenceMeasurement.center,
      pointLabel: "Face center",
      pointRole: "generatedFaceCenter",
      ...(generatedReferenceMeasurement.surfaceType === "plane" &&
      generatedReferenceMeasurement.normal
        ? {
            vector: generatedReferenceMeasurement.normal,
            vectorLabel: "Face normal",
            vectorRole: "generatedFaceNormal" as const
          }
        : {}),
      summaryRows: [
        {
          label: "Center",
          value: formatPoint(
            generatedReferenceMeasurement.center,
            generatedReferenceMeasurement.units
          )
        },
        ...(generatedReferenceMeasurement.normal
          ? [
              {
                label: "Normal",
                value: formatVector(generatedReferenceMeasurement.normal)
              }
            ]
          : [])
      ]
    };
  }

  if (generatedReferenceMeasurement.kind === "edge") {
    const center =
      generatedReferenceMeasurement.center ??
      (generatedReferenceMeasurement.startPoint &&
      generatedReferenceMeasurement.endPoint
        ? midpoint(
            generatedReferenceMeasurement.startPoint,
            generatedReferenceMeasurement.endPoint
          )
        : undefined);
    const direction =
      generatedReferenceMeasurement.curveType === "line" &&
      generatedReferenceMeasurement.startPoint &&
      generatedReferenceMeasurement.endPoint
        ? subtract(
            generatedReferenceMeasurement.endPoint,
            generatedReferenceMeasurement.startPoint
          )
        : undefined;

    return {
      ...boundExact,
      ...(center
        ? {
            point: center,
            pointLabel: "Edge center",
            pointRole: "generatedEdgeCenter" as const
          }
        : {}),
      ...(direction
        ? {
            vector: direction,
            vectorLabel: "Linear edge direction",
            vectorRole: "generatedLinearEdgeDirection" as const
          }
        : {}),
      summaryRows: [
        ...(center
          ? [
              {
                label: "Center",
                value: formatPoint(center, generatedReferenceMeasurement.units)
              }
            ]
          : []),
        ...(direction
          ? [
              {
                label: "Direction",
                value: formatVector(normalize(direction) ?? direction)
              }
            ]
          : [])
      ]
    };
  }

  return {
    ...boundExact,
    summaryRows: []
  };
}

export function updateViewportTwoTargetMeasurementSession(
  session: ViewportTwoTargetMeasurementSession,
  action: ViewportTwoTargetMeasurementSessionAction
): ViewportTwoTargetMeasurementSession {
  switch (action.type) {
    case "start":
      return action.target ? { firstTarget: action.target } : {};
    case "setSecond":
      if (!session.firstTarget) {
        return action.target ? { firstTarget: action.target } : {};
      }

      return action.target
        ? { firstTarget: session.firstTarget, secondTarget: action.target }
        : session;
    case "clear":
      return {};
  }
}

export function clearViewportTwoTargetMeasurementSecondTargetOnSelectionChange(
  session: ViewportTwoTargetMeasurementSession
): ViewportTwoTargetMeasurementSession {
  return session.secondTarget ? { firstTarget: session.firstTarget } : session;
}

export function isViewportTwoTargetMeasurementSessionActive(
  session: ViewportTwoTargetMeasurementSession
): boolean {
  return Boolean(session.firstTarget || session.secondTarget);
}

export function createViewportTwoTargetMeasurementView({
  activeTarget,
  exactArtifacts = [],
  session,
  units
}: CreateViewportTwoTargetMeasurementViewInput): ViewportTwoTargetMeasurementView {
  const firstTarget = session.firstTarget;
  const secondTarget = session.secondTarget;
  const pendingTarget =
    firstTarget &&
    !secondTarget &&
    activeTarget &&
    activeTarget.key !== firstTarget.key
      ? activeTarget
      : undefined;
  const comparisonTarget = secondTarget ?? pendingTarget;
  const baseDiagnostics = createBaseDiagnostics(firstTarget, comparisonTarget);
  const results =
    firstTarget && comparisonTarget && baseDiagnostics.length === 0
      ? createResults(firstTarget, comparisonTarget, units, exactArtifacts)
      : [];
  const resultDiagnostics =
    firstTarget &&
    comparisonTarget &&
    baseDiagnostics.length === 0 &&
    results.length === 0
      ? [
          createDiagnostic(
            "VIEWPORT_TWO_TARGET_UNSUPPORTED_PAIR",
            "unsupported",
            "This target pair has no current exact supporting plane, line, or point.",
            {
              expected:
                "current exact face, edge, or vertex identities with supporting geometry",
              received: `${firstTarget.detail} and ${comparisonTarget.detail}`
            }
          )
        ]
      : [];
  const diagnostics = dedupeDiagnostics([
    ...baseDiagnostics,
    ...results.flatMap((result) => result.diagnostics),
    ...resultDiagnostics
  ]);

  return {
    status: getViewStatus({
      diagnostics,
      firstTarget,
      pendingTarget,
      results,
      secondTarget
    }),
    ...(firstTarget ? { firstTarget: cleanTarget(firstTarget) } : {}),
    ...(secondTarget ? { secondTarget: cleanTarget(secondTarget) } : {}),
    ...(pendingTarget ? { pendingTarget: cleanTarget(pendingTarget) } : {}),
    ...(activeTarget ? { activeTarget: cleanTarget(activeTarget) } : {}),
    results,
    diagnostics,
    prompt: createPrompt(firstTarget, secondTarget, pendingTarget, diagnostics)
  };
}

function createTargetBase(
  overlay: ViewportMeasurementOverlay
): Omit<ViewportTwoTargetMeasurementTarget, "summaryRows"> {
  const { target } = overlay;

  return {
    key: createTargetKey(target),
    targetKind: target.targetKind,
    title: clean(target.title),
    detail: clean(target.detail),
    label: target.label ? clean(target.label) : undefined,
    bodyId: target.bodyId,
    stableId: target.stableId ? clean(target.stableId) : undefined,
    referenceName: target.referenceName
      ? clean(target.referenceName)
      : undefined,
    selection: target.selection,
    authority: target.authority,
    authorityLabel: clean(target.authorityLabel),
    status: target.status,
    diagnostics: target.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      message: clean(diagnostic.message)
    })),
    source: overlay.source
  };
}

function createTargetKey(target: ViewportMeasurementOverlay["target"]): string {
  if (target.bodyId && target.stableId) {
    return `${target.bodyId}:${target.stableId}:${target.targetKind}`;
  }

  if (target.bodyId) {
    return `body:${target.bodyId}`;
  }

  if (target.referenceName) {
    return `name:${target.referenceName}`;
  }

  return `${target.targetKind}:${target.title}`;
}

function cleanTarget(
  target: ViewportTwoTargetMeasurementTarget
): ViewportTwoTargetMeasurementTarget {
  return {
    ...target,
    key: clean(target.key),
    title: clean(target.title),
    detail: clean(target.detail),
    ...(target.label ? { label: clean(target.label) } : {}),
    ...(target.bodyId ? { bodyId: clean(target.bodyId) } : {}),
    ...(target.stableId ? { stableId: clean(target.stableId) } : {}),
    ...(target.referenceName
      ? { referenceName: clean(target.referenceName) }
      : {}),
    ...(target.selection
      ? { selection: cleanSelection(target.selection) }
      : {}),
    ...(target.exactIdentity ? { exactIdentity: target.exactIdentity } : {}),
    ...(target.exactEntity ? { exactEntity: target.exactEntity } : {}),
    authorityLabel: clean(target.authorityLabel),
    diagnostics: target.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      message: clean(diagnostic.message)
    })),
    summaryRows: target.summaryRows.map((row) => ({
      label: clean(row.label),
      value: clean(row.value)
    }))
  };
}

function cleanSelection(
  selection: NonNullable<ViewportTwoTargetMeasurementTarget["selection"]>
): NonNullable<ViewportTwoTargetMeasurementTarget["selection"]> {
  switch (selection.type) {
    case "body":
      return {
        type: "body",
        bodyId: clean(selection.bodyId)
      };
    case "generatedReference":
      return {
        type: "generatedReference",
        bodyId: clean(selection.bodyId),
        stableId: clean(selection.stableId),
        ...(selection.expectedKind
          ? { expectedKind: selection.expectedKind }
          : {})
      };
    case "namedReference":
      return {
        type: "namedReference",
        name: clean(selection.name)
      };
    case "topologyAnchor":
      return {
        type: "topologyAnchor",
        anchorId: clean(selection.anchorId)
      };
  }
}

function createBaseDiagnostics(
  firstTarget: ViewportTwoTargetMeasurementTarget | undefined,
  secondTarget: ViewportTwoTargetMeasurementTarget | undefined
): readonly CadViewportTwoTargetMeasurementDiagnostic[] {
  if (!firstTarget) {
    return [
      createDiagnostic(
        "VIEWPORT_TWO_TARGET_MISSING_FIRST_TARGET",
        "missing",
        "Start a two-target measure from a supported selected target."
      )
    ];
  }

  if (!secondTarget) {
    return [
      ...createTargetDiagnostics(firstTarget, "First"),
      createDiagnostic(
        "VIEWPORT_TWO_TARGET_MISSING_SECOND_TARGET",
        "missing",
        "Select a second supported semantic target, then open Measure."
      )
    ];
  }

  return dedupeDiagnostics([
    ...createTargetDiagnostics(firstTarget, "First"),
    ...createTargetDiagnostics(secondTarget, "Second"),
    ...(firstTarget.key === secondTarget.key
      ? [
          createDiagnostic(
            "VIEWPORT_TWO_TARGET_AMBIGUOUS_PAIR",
            "ambiguous",
            "Choose a second semantic target different from the first target."
          )
        ]
      : []),
    ...(firstTarget.authority === "displayApproximation" ||
    secondTarget.authority === "displayApproximation"
      ? [
          createDiagnostic(
            "VIEWPORT_TWO_TARGET_DISPLAY_APPROXIMATION_ONLY",
            "unsupported",
            "Only display approximation is available for this target pair."
          )
        ]
      : [])
  ]);
}

function createTargetDiagnostics(
  target: ViewportTwoTargetMeasurementTarget,
  role: "First" | "Second"
): readonly CadViewportTwoTargetMeasurementDiagnostic[] {
  const status = target.status;

  if (status === "resolved") {
    return [];
  }

  const message =
    target.diagnostics[0]?.message ??
    `${role} target ${target.title} is ${formatStatus(status)}.`;

  switch (status) {
    case "stale":
      return [
        createDiagnostic("VIEWPORT_TWO_TARGET_STALE_TARGET", "stale", message)
      ];
    case "consumed":
      return [
        createDiagnostic(
          "VIEWPORT_TWO_TARGET_CONSUMED_TARGET",
          "consumed",
          message
        )
      ];
    case "ambiguous":
      return [
        createDiagnostic(
          "VIEWPORT_TWO_TARGET_AMBIGUOUS_PAIR",
          "ambiguous",
          message
        )
      ];
    case "non-commandable":
      return [
        createDiagnostic(
          "VIEWPORT_TWO_TARGET_NON_COMMANDABLE_TARGET",
          "non-commandable",
          message
        )
      ];
    case "missing":
      return [
        createDiagnostic(
          role === "First"
            ? "VIEWPORT_TWO_TARGET_MISSING_FIRST_TARGET"
            : "VIEWPORT_TWO_TARGET_MISSING_SECOND_TARGET",
          "missing",
          message
        )
      ];
    case "unsupported":
    case "renderer-only":
    case "assembly-unsupported":
    case "empty":
      return [
        createDiagnostic(
          "VIEWPORT_TWO_TARGET_UNSUPPORTED_TARGET",
          status === "empty" ? "missing" : status,
          message
        )
      ];
  }
}

function attachExactTarget(
  base: Omit<ViewportTwoTargetMeasurementTarget, "summaryRows">,
  exactIdentity: ExactInspectionIdentity | undefined,
  exactEntity: ExactInspectionEntity | undefined,
  exactArtifacts: readonly ExactInspectionArtifact[] | undefined
): Omit<ViewportTwoTargetMeasurementTarget, "summaryRows"> {
  if (!exactIdentity) {
    return base;
  }
  const bound =
    exactArtifacts && exactArtifacts.length > 0
      ? bindExactInspectionTarget(exactIdentity, exactArtifacts, base.title)
      : undefined;
  return {
    ...base,
    exactIdentity,
    ...(exactEntity
      ? { exactEntity }
      : bound?.current && bound.entity
        ? { exactEntity: bound.entity }
        : {}),
    authority: bound && !bound.current ? "unsupported" : "geometryBoundaryExact",
    authorityLabel: formatViewportMeasurementAuthority(
      bound && !bound.current ? "unsupported" : "geometryBoundaryExact"
    ),
    status: bound && !bound.current ? bound.reason : base.status
  };
}

function createResults(
  firstTarget: ViewportTwoTargetMeasurementTarget,
  secondTarget: ViewportTwoTargetMeasurementTarget,
  units: DocumentUnits,
  artifacts: readonly ExactInspectionArtifact[]
): readonly ViewportTwoTargetMeasurementDisplayResult[] {
  const first = bindPairTarget(firstTarget, artifacts);
  const second = bindPairTarget(secondTarget, artifacts);
  if (!first || !second) {
    return [];
  }
  const measured = measureExactInspectionPair(first, second, units);
  return exactResultToDisplayResults(measured, firstTarget, secondTarget, units);
}

function bindPairTarget(
  target: ViewportTwoTargetMeasurementTarget,
  artifacts: readonly ExactInspectionArtifact[]
): ExactInspectionBindResult | undefined {
  if (!target.exactIdentity) {
    return undefined;
  }
  if (artifacts.length > 0) {
    return bindExactInspectionTarget(
      target.exactIdentity,
      artifacts,
      target.title
    );
  }
  if (target.exactIdentity.entityKind === "body") {
    return {
      identity: target.exactIdentity,
      title: target.title,
      current: true
    };
  }
  if (!target.exactEntity) {
    return {
      identity: target.exactIdentity,
      title: target.title,
      current: false,
      reason: "missing"
    };
  }
  return {
    identity: target.exactIdentity,
    title: target.title,
    current: true,
    entity: target.exactEntity
  };
}

function exactResultToDisplayResults(
  measured: ExactInspectionResult,
  firstTarget: ViewportTwoTargetMeasurementTarget,
  secondTarget: ViewportTwoTargetMeasurementTarget,
  units: DocumentUnits
): readonly ViewportTwoTargetMeasurementDisplayResult[] {
  if (measured.status !== "ready") {
    return [];
  }
  const results: ViewportTwoTargetMeasurementDisplayResult[] = [];
  for (const value of measured.values) {
    if (value.kind !== "distance" && value.kind !== "angle") continue;
    results.push(
      cleanResult({
        kind: value.kind,
        title: value.kind === "distance" ? "Distance" : "Angle",
        detail:
          value.kind === "distance"
            ? `${firstTarget.title} to ${secondTarget.title}`
            : `${firstTarget.title} and ${secondTarget.title}`,
        authority: measured.authority,
        authorityLabel: measured.authorityLabel,
        value: value.value,
        units: value.kind === "angle" ? "deg" : units,
        diagnostics: [],
        rows: measured.rows.filter((row) =>
          value.kind === "distance"
            ? row.label === "Distance"
            : row.label === "Angle"
        )
      })
    );
  }
  return results;
}

function cleanResult(
  result: ViewportTwoTargetMeasurementDisplayResult
): ViewportTwoTargetMeasurementDisplayResult {
  return {
    ...result,
    title: clean(result.title),
    detail: clean(result.detail),
    authorityLabel: clean(result.authorityLabel),
    rows: result.rows.map((row) => ({
      label: clean(row.label),
      value: clean(row.value)
    })),
    diagnostics: result.diagnostics.map(cleanTwoTargetDiagnostic)
  };
}

function getViewStatus({
  diagnostics,
  firstTarget,
  pendingTarget,
  results,
  secondTarget
}: {
  readonly diagnostics: readonly CadViewportTwoTargetMeasurementDiagnostic[];
  readonly firstTarget?: ViewportTwoTargetMeasurementTarget;
  readonly pendingTarget?: ViewportTwoTargetMeasurementTarget;
  readonly results: readonly ViewportTwoTargetMeasurementDisplayResult[];
  readonly secondTarget?: ViewportTwoTargetMeasurementTarget;
}): ViewportTwoTargetMeasurementViewStatus {
  if (!firstTarget) {
    return "idle";
  }

  if (!secondTarget && !pendingTarget) {
    return "waitingForSecond";
  }

  if (diagnostics.some((diagnostic) => diagnostic.status !== "unsupported")) {
    return "blocked";
  }

  if (secondTarget && results.length > 0) {
    return "complete";
  }

  if (pendingTarget && results.length > 0) {
    return "preview";
  }

  if (diagnostics.length > 0) {
    return "blocked";
  }

  return "waitingForSecond";
}

function createPrompt(
  firstTarget: ViewportTwoTargetMeasurementTarget | undefined,
  secondTarget: ViewportTwoTargetMeasurementTarget | undefined,
  pendingTarget: ViewportTwoTargetMeasurementTarget | undefined,
  diagnostics: readonly CadViewportTwoTargetMeasurementDiagnostic[]
): string {
  if (!firstTarget) {
    return "Use the selected target as the first measurement target.";
  }

  if (secondTarget) {
    return "Two-target measurement complete for this session.";
  }

  if (pendingTarget && diagnostics.length === 0) {
    return "Previewing selected target as the second measurement target.";
  }

  return "Select a second supported target, then open Measure.";
}

function createDiagnostic(
  code: CadViewportTwoTargetMeasurementDiagnostic["code"],
  status: CadViewportTwoTargetMeasurementDiagnostic["status"],
  message: string,
  details: {
    readonly expected?: string;
    readonly received?: string;
  } = {}
): CadViewportTwoTargetMeasurementDiagnostic {
  return cleanTwoTargetDiagnostic({
    code,
    status,
    message,
    ...(details.expected ? { expected: details.expected } : {}),
    ...(details.received ? { received: details.received } : {})
  });
}

function cleanTwoTargetDiagnostic(
  diagnostic: CadViewportTwoTargetMeasurementDiagnostic
): CadViewportTwoTargetMeasurementDiagnostic {
  return {
    ...diagnostic,
    message: clean(diagnostic.message),
    ...(diagnostic.expected ? { expected: clean(diagnostic.expected) } : {}),
    ...(diagnostic.received ? { received: clean(diagnostic.received) } : {})
  };
}

function formatStatus(status: CadViewportInteractionStatus): string {
  return status === "empty" || status === "missing"
    ? "missing"
    : status === "non-commandable"
      ? "not available"
      : status;
}

function formatVector(vector: Vec3): string {
  return vector.map(formatNumber).join(", ");
}

function midpoint(first: Vec3, second: Vec3): Vec3 {
  return [
    (first[0] + second[0]) / 2,
    (first[1] + second[1]) / 2,
    (first[2] + second[2]) / 2
  ];
}

function subtract(first: Vec3, second: Vec3): Vec3 {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

function normalize(vector: Vec3): Vec3 | undefined {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  return length === 0
    ? undefined
    : [vector[0] / length, vector[1] / length, vector[2] / length];
}

function clean(text: string): string {
  return redactInternalViewportIds(text);
}
