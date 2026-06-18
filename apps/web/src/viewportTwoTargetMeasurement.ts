import type { BodyMeasurementsSnapshot } from "@web-cad/cad-core";
import type {
  CadViewportInteractionStatus,
  CadViewportMeasurementAuthority,
  CadViewportTwoTargetMeasurementDiagnostic,
  CadViewportTwoTargetMeasurementResult,
  CadViewportTwoTargetMeasurementTarget,
  DocumentUnits,
  GeneratedReferenceMeasurement,
  Vec3
} from "@web-cad/cad-protocol";
import { formatBounds, type MeasurementDisplayRow } from "./sceneObjectDisplay";
import {
  formatViewportMeasurementAuthority,
  type ViewportMeasurementOverlay
} from "./viewportMeasurementOverlay";
import { redactInternalViewportIds } from "./viewportVisibleText";

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
}

export interface CreateViewportTwoTargetMeasurementViewInput {
  readonly activeTarget?: ViewportTwoTargetMeasurementTarget;
  readonly session: ViewportTwoTargetMeasurementSession;
  readonly units: DocumentUnits;
}

export function createViewportTwoTargetMeasurementTarget({
  bodyMeasurements,
  generatedReferenceMeasurement,
  measurementOverlay
}: CreateViewportTwoTargetMeasurementTargetInput):
  | ViewportTwoTargetMeasurementTarget
  | undefined {
  if (!measurementOverlay) {
    return undefined;
  }

  const { target } = measurementOverlay;
  const base = createTargetBase(measurementOverlay);

  if (target.targetKind === "body") {
    return {
      ...base,
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
      ...base,
      summaryRows: []
    };
  }

  if (generatedReferenceMeasurement.kind === "face") {
    return {
      ...base,
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
      ...base,
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
    ...base,
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
      ? createResults(firstTarget, comparisonTarget, units)
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
            "This target pair has no source-backed center distance or angle vectors.",
            {
              expected:
                "body centroids, generated face centers/normals, or generated linear edge centers/directions",
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

function createResults(
  firstTarget: ViewportTwoTargetMeasurementTarget,
  secondTarget: ViewportTwoTargetMeasurementTarget,
  units: DocumentUnits
): readonly ViewportTwoTargetMeasurementDisplayResult[] {
  const results: ViewportTwoTargetMeasurementDisplayResult[] = [];

  if (firstTarget.point && secondTarget.point) {
    const value = distance(firstTarget.point, secondTarget.point);
    const authority = combineAuthority(
      getPointAuthority(firstTarget),
      getPointAuthority(secondTarget)
    );
    const diagnostics = createResultAuthorityDiagnostics(authority);

    results.push({
      kind: "distance",
      title: "Distance",
      detail: `${firstTarget.pointLabel ?? "First point"} to ${
        secondTarget.pointLabel ?? "second point"
      }`,
      authority,
      authorityLabel: formatViewportMeasurementAuthority(authority),
      value,
      units,
      diagnostics,
      rows: [
        { label: "Distance", value: formatDistance(value, units) },
        {
          label: "Basis",
          value: `${firstTarget.pointLabel ?? "First point"} to ${
            secondTarget.pointLabel ?? "second point"
          }`
        }
      ]
    });
  }

  if (firstTarget.vector && secondTarget.vector) {
    const value = angleDegrees(firstTarget.vector, secondTarget.vector);
    const authority = combineAuthority(
      getVectorAuthority(firstTarget),
      getVectorAuthority(secondTarget)
    );
    const diagnostics = createResultAuthorityDiagnostics(authority);

    if (Number.isFinite(value)) {
      results.push({
        kind: "angle",
        title: "Angle",
        detail: `${firstTarget.vectorLabel ?? "First vector"} to ${
          secondTarget.vectorLabel ?? "second vector"
        }`,
        authority,
        authorityLabel: formatViewportMeasurementAuthority(authority),
        value,
        units: "deg",
        diagnostics,
        rows: [
          { label: "Angle", value: `${formatNumber(value)} deg` },
          {
            label: "Basis",
            value: `${firstTarget.vectorLabel ?? "First vector"} to ${
              secondTarget.vectorLabel ?? "second vector"
            }`
          }
        ]
      });
    }
  }

  return results.map(cleanResult);
}

function createResultAuthorityDiagnostics(
  authority: CadViewportMeasurementAuthority
): readonly CadViewportTwoTargetMeasurementDiagnostic[] {
  return authority === "displayApproximation"
    ? [
        createDiagnostic(
          "VIEWPORT_TWO_TARGET_DISPLAY_APPROXIMATION_ONLY",
          "unsupported",
          "This result is display approximation only."
        )
      ]
    : [];
}

function getPointAuthority(
  target: ViewportTwoTargetMeasurementTarget
): CadViewportMeasurementAuthority {
  return getSourceBackedInputAuthority(target, Boolean(target.point));
}

function getVectorAuthority(
  target: ViewportTwoTargetMeasurementTarget
): CadViewportMeasurementAuthority {
  return getSourceBackedInputAuthority(target, Boolean(target.vector));
}

function getSourceBackedInputAuthority(
  target: ViewportTwoTargetMeasurementTarget,
  hasInput: boolean
): CadViewportMeasurementAuthority {
  if (!hasInput || target.authority !== "unsupported") {
    return target.authority;
  }

  return target.source === "body.measurements" ||
    target.source === "body.generatedReferenceMeasurements"
    ? "sourceAnalytic"
    : target.authority;
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

function combineAuthority(
  first: CadViewportMeasurementAuthority,
  second: CadViewportMeasurementAuthority
): CadViewportMeasurementAuthority {
  if (first === "unsupported" || second === "unsupported") {
    return "unsupported";
  }

  if (first === "displayApproximation" || second === "displayApproximation") {
    return "displayApproximation";
  }

  if (first === "sourceAnalytic" || second === "sourceAnalytic") {
    return "sourceAnalytic";
  }

  if (first === "geometryBoundaryExact" && second === "geometryBoundaryExact") {
    return "geometryBoundaryExact";
  }

  return "semanticDocument";
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

function dedupeDiagnostics(
  diagnostics: readonly CadViewportTwoTargetMeasurementDiagnostic[]
): readonly CadViewportTwoTargetMeasurementDiagnostic[] {
  const seen = new Set<string>();
  const deduped: CadViewportTwoTargetMeasurementDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.code}:${diagnostic.status}:${diagnostic.message}`;

    if (seen.has(key)) {
      continue;
    }

    deduped.push(diagnostic);
    seen.add(key);
  }

  return deduped;
}

function formatStatus(status: CadViewportInteractionStatus): string {
  switch (status) {
    case "resolved":
      return "resolved";
    case "empty":
      return "missing";
    case "missing":
      return "missing";
    case "stale":
      return "stale";
    case "unsupported":
      return "unsupported";
    case "ambiguous":
      return "ambiguous";
    case "consumed":
      return "consumed";
    case "non-commandable":
      return "not commandable";
    case "renderer-only":
      return "renderer-only";
    case "assembly-unsupported":
      return "assembly-unsupported";
  }
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

function distance(first: Vec3, second: Vec3): number {
  return Math.hypot(
    first[0] - second[0],
    first[1] - second[1],
    first[2] - second[2]
  );
}

function dot(first: Vec3, second: Vec3): number {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function normalize(vector: Vec3): Vec3 | undefined {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length === 0) {
    return undefined;
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function angleDegrees(first: Vec3, second: Vec3): number {
  const normalizedFirst = normalize(first);
  const normalizedSecond = normalize(second);

  if (!normalizedFirst || !normalizedSecond) {
    return Number.NaN;
  }

  const cosine = Math.max(
    -1,
    Math.min(1, dot(normalizedFirst, normalizedSecond))
  );

  return (Math.acos(cosine) * 180) / Math.PI;
}

function formatDistance(value: number, units: DocumentUnits): string {
  return `${formatNumber(value)} ${units}`;
}

function formatPoint(point: Vec3, units: DocumentUnits): string {
  return point.map((value) => `${formatNumber(value)} ${units}`).join(", ");
}

function formatVector(vector: Vec3): string {
  return vector.map(formatNumber).join(", ");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function clean(text: string): string {
  return redactInternalViewportIds(text);
}
