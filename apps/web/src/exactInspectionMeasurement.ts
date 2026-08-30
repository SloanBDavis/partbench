import type { CadViewportMeasurementAuthority, DocumentUnits } from "@web-cad/cad-protocol";
import type { MeasurementDisplayRow } from "./sceneObjectDisplay";
import {
  formatArea,
  formatBounds,
  formatNumber,
  formatPoint,
  formatVolume
} from "./sceneObjectDisplay";
import { formatViewportMeasurementAuthority } from "./viewportMeasurementOverlay";

export type ExactInspectionEntityKind = "body" | "face" | "edge" | "vertex";

export interface ExactInspectionIdentity {
  readonly bodyId: string;
  readonly bodySourceIdentitySignature: string;
  readonly topologySignature: string;
  readonly entityKind: ExactInspectionEntityKind;
  readonly localId?: string;
  readonly entitySignature?: string;
}

export interface ExactInspectionEntity {
  readonly localId: string;
  readonly kind: string;
  readonly signature: string;
  readonly surfaceClass?: string;
  readonly curveClass?: string;
  readonly point?: readonly [number, number, number];
  readonly midpoint?: readonly [number, number, number];
  readonly normal?: readonly [number, number, number];
  readonly axis?: readonly [number, number, number];
  readonly radius?: number;
  readonly area?: number;
  readonly length?: number;
}

export interface ExactInspectionBodyMetadata {
  readonly volume?: number;
  readonly surfaceArea?: number;
  readonly centroid?: readonly [number, number, number];
  readonly bounds?: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  };
  readonly momentsOfInertia?: {
    readonly xx: number;
    readonly yy: number;
    readonly zz: number;
  };
  readonly principalMoments?: readonly [number, number, number];
}

export interface ExactInspectionArtifact {
  readonly bodyId: string;
  readonly bodySourceIdentitySignature: string;
  readonly topologySignature: string;
  readonly metadata: ExactInspectionBodyMetadata;
  readonly entities: readonly ExactInspectionEntity[];
}

export interface ExactInspectionBoundTarget {
  readonly identity: ExactInspectionIdentity;
  readonly title: string;
  readonly current: true;
  readonly entity?: ExactInspectionEntity;
  readonly metadata?: ExactInspectionBodyMetadata;
}

export type ExactInspectionBindResult =
  | ExactInspectionBoundTarget
  | {
      readonly identity: ExactInspectionIdentity;
      readonly title: string;
      readonly current: false;
      readonly reason: "stale" | "missing";
    };

export interface ExactInspectionValue {
  readonly kind: "distance" | "angle" | "scalar";
  readonly label: string;
  readonly value: number;
  readonly units?: DocumentUnits | "deg";
  readonly closestPoints?: readonly [
    readonly [number, number, number],
    readonly [number, number, number]
  ];
}

export type ExactInspectionResult =
  | {
      readonly status: "ready";
      readonly authority: Extract<
        CadViewportMeasurementAuthority,
        "geometryBoundaryExact"
      >;
      readonly authorityLabel: string;
      readonly rows: readonly MeasurementDisplayRow[];
      readonly values: readonly ExactInspectionValue[];
      readonly diagnostics: readonly ExactInspectionDiagnostic[];
    }
  | {
      readonly status: "unavailable" | "stale" | "missing" | "ambiguous";
      readonly authority: Extract<
        CadViewportMeasurementAuthority,
        "unsupported"
      >;
      readonly authorityLabel: string;
      readonly rows: readonly MeasurementDisplayRow[];
      readonly values: readonly [];
      readonly diagnostics: readonly ExactInspectionDiagnostic[];
    };

export interface ExactInspectionDiagnostic {
  readonly code:
    | "EXACT_MEASUREMENT_STALE"
    | "EXACT_MEASUREMENT_MISSING"
    | "EXACT_MEASUREMENT_AMBIGUOUS"
    | "EXACT_MEASUREMENT_UNAVAILABLE"
    | "EXACT_MEASUREMENT_NON_UNIQUE_CLOSEST_POINT";
  readonly status: "stale" | "missing" | "ambiguous" | "unsupported";
  readonly message: string;
}

const PARALLEL_COSINE = 1 - 1e-9;
const EXACT_AUTHORITY: Extract<
  CadViewportMeasurementAuthority,
  "geometryBoundaryExact"
> = "geometryBoundaryExact";

export function toExactInspectionArtifact(artifact: {
  readonly bodyId: string;
  readonly bodySourceIdentitySignature: string;
  readonly topologySnapshot: {
    readonly signature: string;
    readonly entities: readonly ExactInspectionEntity[];
  };
  readonly metadata: ExactInspectionBodyMetadata;
}): ExactInspectionArtifact {
  return {
    bodyId: artifact.bodyId,
    bodySourceIdentitySignature: artifact.bodySourceIdentitySignature,
    topologySignature: artifact.topologySnapshot.signature,
    metadata: artifact.metadata,
    entities: artifact.topologySnapshot.entities
  };
}

export function exactInspectionIdentityKey(
  identity: ExactInspectionIdentity
): string {
  return identity.entityKind === "body"
    ? `body:${identity.bodyId}:${identity.bodySourceIdentitySignature}:${identity.topologySignature}`
    : `${identity.entityKind}:${identity.bodyId}:${identity.localId}:${identity.entitySignature}:${identity.topologySignature}`;
}

export function bindExactInspectionTarget(
  identity: ExactInspectionIdentity,
  artifacts: readonly ExactInspectionArtifact[],
  title = identity.entityKind
): ExactInspectionBindResult {
  const artifact = artifacts.find((candidate) => candidate.bodyId === identity.bodyId);
  if (!artifact) {
    return { identity, title, current: false, reason: "missing" };
  }
  if (
    artifact.bodySourceIdentitySignature !== identity.bodySourceIdentitySignature ||
    artifact.topologySignature !== identity.topologySignature
  ) {
    return { identity, title, current: false, reason: "stale" };
  }
  if (identity.entityKind === "body") {
    return {
      identity,
      title,
      current: true,
      metadata: artifact.metadata
    };
  }
  const entity = artifact.entities.find(
    (candidate) =>
      candidate.localId === identity.localId &&
      candidate.signature === identity.entitySignature &&
      candidate.kind === identity.entityKind
  );
  if (!entity) {
    return { identity, title, current: false, reason: "missing" };
  }
  return { identity, title, current: true, entity };
}

export function measureExactInspectionSingle(
  bound: ExactInspectionBindResult,
  units: DocumentUnits
): ExactInspectionResult {
  if (!bound.current) {
    return unavailable(bound.reason, bound.reason === "stale"
      ? "This measurement is stale. The current exact identity no longer matches."
      : "The current exact target is missing.");
  }
  if (bound.identity.entityKind === "body") {
    return measureBody(bound.metadata, units);
  }
  if (!bound.entity) {
    return unavailable("missing", "The current exact target is missing.");
  }
  if (bound.identity.entityKind === "face") {
    return measureFace(bound.entity, units);
  }
  if (bound.identity.entityKind === "edge") {
    return measureEdge(bound.entity, units);
  }
  return measureVertex(bound.entity, units);
}

export function measureExactInspectionPair(
  first: ExactInspectionBindResult,
  second: ExactInspectionBindResult,
  units: DocumentUnits
): ExactInspectionResult {
  if (!first.current || !second.current) {
    const reason = !first.current ? first.reason : second.reason;
    return unavailable(
      reason,
      reason === "stale"
        ? "A measurement target is stale. Pins and results do not silently rebind."
        : "A measurement target is missing from the current exact artifact."
    );
  }
  if (exactInspectionIdentityKey(first.identity) === exactInspectionIdentityKey(second.identity)) {
    return unavailable(
      "ambiguous",
      "Choose a second current exact target different from the first target."
    );
  }
  if (first.identity.entityKind === "body" || second.identity.entityKind === "body") {
    return unavailable(
      "unavailable",
      "Body pairs are unavailable. Measure a face, edge, or vertex pair."
    );
  }
  if (!first.entity || !second.entity) {
    return unavailable("missing", "A measurement target is missing.");
  }
  return measurePair(first.entity, first.identity.entityKind, second.entity, second.identity.entityKind, units);
}

function measureBody(
  metadata: ExactInspectionBodyMetadata | undefined,
  units: DocumentUnits
): ExactInspectionResult {
  if (!metadata || !isFiniteNumber(metadata.volume) || !isFiniteNumber(metadata.surfaceArea) || !metadata.centroid || !metadata.bounds) {
    return unavailable("unavailable", "Exact body measurements are not available for this target.");
  }
  const values: ExactInspectionValue[] = [
    { kind: "scalar", label: "Volume", value: metadata.volume, units },
    { kind: "scalar", label: "Surface area", value: metadata.surfaceArea, units }
  ];
  const rows: MeasurementDisplayRow[] = [
    { label: "Volume", value: formatVolume(metadata.volume, units) },
    { label: "Surface area", value: formatArea(metadata.surfaceArea, units) },
    { label: "Centroid", value: formatPoint(metadata.centroid, units) },
    {
      label: "Bounds",
      value: formatBounds(
        {
          min: metadata.bounds.min,
          max: metadata.bounds.max,
          size: subtract(metadata.bounds.max, metadata.bounds.min),
          center: metadata.centroid
        },
        units
      )
    }
  ];
  if (metadata.momentsOfInertia) {
    rows.push({
      label: "Inertia",
      value: [metadata.momentsOfInertia.xx, metadata.momentsOfInertia.yy, metadata.momentsOfInertia.zz]
        .map(formatNumber)
        .join(", ")
    });
  }
  if (metadata.principalMoments) {
    rows.push({
      label: "Principal moments",
      value: metadata.principalMoments.map(formatNumber).join(", ")
    });
  }
  return ready(values, rows);
}

function measureFace(
  entity: ExactInspectionEntity,
  units: DocumentUnits
): ExactInspectionResult {
  if (!isFiniteNumber(entity.area) || !entity.surfaceClass) {
    return unavailable("unavailable", "Exact face measurements are not available for this target.");
  }
  const values: ExactInspectionValue[] = [
    { kind: "scalar", label: "Area", value: entity.area, units }
  ];
  const rows: MeasurementDisplayRow[] = [
    { label: "Area", value: formatArea(entity.area, units) },
    { label: "Surface", value: entity.surfaceClass }
  ];
  if (entity.normal) {
    rows.push({ label: "Normal", value: formatVector(entity.normal) });
  }
  if (entity.axis) {
    rows.push({ label: "Axis", value: formatVector(entity.axis) });
  }
  if (isFiniteNumber(entity.radius)) {
    values.push({ kind: "scalar", label: "Radius", value: entity.radius, units });
    rows.push({ label: "Radius", value: `${formatNumber(entity.radius)} ${units}` });
  }
  return ready(values, rows);
}

function measureEdge(
  entity: ExactInspectionEntity,
  units: DocumentUnits
): ExactInspectionResult {
  if (!isFiniteNumber(entity.length) || !entity.curveClass) {
    return unavailable("unavailable", "Exact edge measurements are not available for this target.");
  }
  const values: ExactInspectionValue[] = [
    { kind: "scalar", label: "Length", value: entity.length, units }
  ];
  const rows: MeasurementDisplayRow[] = [
    { label: "Length", value: `${formatNumber(entity.length)} ${units}` },
    { label: "Curve", value: entity.curveClass }
  ];
  if (entity.midpoint) {
    rows.push({ label: "Midpoint", value: formatPoint(entity.midpoint, units) });
  }
  if (isFiniteNumber(entity.radius)) {
    values.push({ kind: "scalar", label: "Radius", value: entity.radius, units });
    rows.push({ label: "Radius", value: `${formatNumber(entity.radius)} ${units}` });
  }
  return ready(values, rows);
}

function measureVertex(
  entity: ExactInspectionEntity,
  units: DocumentUnits
): ExactInspectionResult {
  if (!entity.point) {
    return unavailable("unavailable", "Exact vertex coordinates are not available for this target.");
  }
  return ready(
    [{ kind: "scalar", label: "Coordinates", value: entity.point[0], units }],
    [{ label: "Coordinates", value: formatPoint(entity.point, units) }]
  );
}

function measurePair(
  first: ExactInspectionEntity,
  firstKind: ExactInspectionEntityKind,
  second: ExactInspectionEntity,
  secondKind: ExactInspectionEntityKind,
  units: DocumentUnits
): ExactInspectionResult {
  const firstSupport = supportingGeometry(first, firstKind);
  const secondSupport = supportingGeometry(second, secondKind);
  if (!firstSupport || !secondSupport) {
    return unavailable(
      "unavailable",
      "This pair has no current exact supporting plane, line, or point."
    );
  }

  const values: ExactInspectionValue[] = [];
  const rows: MeasurementDisplayRow[] = [];
  const diagnostics: ExactInspectionDiagnostic[] = [];
  const distance = minimumDistance(firstSupport, secondSupport);
  if (!distance) {
    return unavailable(
      "unavailable",
      "Exact minimum distance is unavailable for this pair."
    );
  }
  values.push({
    kind: "distance",
    label: "Distance",
    value: distance.value,
    units,
    ...(distance.closestPoints ? { closestPoints: distance.closestPoints } : {})
  });
  rows.push({ label: "Distance", value: `${formatNumber(distance.value)} ${units}` });
  if (!distance.closestPoints) {
    diagnostics.push({
      code: "EXACT_MEASUREMENT_NON_UNIQUE_CLOSEST_POINT",
      status: "unsupported",
      message: "Closest points are omitted because no single deterministic pair exists."
    });
  }

  const angle = supportAngle(firstSupport, secondSupport);
  if (angle !== undefined) {
    values.push({ kind: "angle", label: "Angle", value: angle, units: "deg" });
    rows.push({ label: "Angle", value: `${formatNumber(angle)} deg` });
  }

  return ready(values, rows, diagnostics);
}

type Support =
  | { readonly kind: "point"; readonly point: readonly [number, number, number] }
  | {
      readonly kind: "line";
      readonly point: readonly [number, number, number];
      readonly direction: readonly [number, number, number];
    }
  | {
      readonly kind: "plane";
      readonly point: readonly [number, number, number];
      readonly normal: readonly [number, number, number];
    };

function supportingGeometry(
  entity: ExactInspectionEntity,
  kind: ExactInspectionEntityKind
): Support | undefined {
  if (kind === "vertex" && entity.point) {
    return { kind: "point", point: entity.point };
  }
  if (kind === "edge" && entity.curveClass === "line" && entity.axis && entity.midpoint) {
    const direction = normalize(entity.axis);
    return direction ? { kind: "line", point: entity.midpoint, direction } : undefined;
  }
  if (kind === "face" && entity.surfaceClass === "plane" && entity.normal) {
    const normal = normalize(entity.normal);
    const point = entity.midpoint ?? entity.point ?? planePointFromNormal(entity);
    return normal && point ? { kind: "plane", point, normal } : undefined;
  }
  return undefined;
}

function planePointFromNormal(
  entity: ExactInspectionEntity
): readonly [number, number, number] | undefined {
  return entity.point ?? entity.midpoint;
}

function minimumDistance(
  first: Support,
  second: Support
):
  | {
      readonly value: number;
      readonly closestPoints?: readonly [
        readonly [number, number, number],
        readonly [number, number, number]
      ];
    }
  | undefined {
  if (first.kind === "point" && second.kind === "point") {
    return {
      value: distance(first.point, second.point),
      closestPoints: [first.point, second.point]
    };
  }
  if (first.kind === "point" && second.kind === "line") {
    return pointLineDistance(first.point, second);
  }
  if (first.kind === "line" && second.kind === "point") {
    const result = pointLineDistance(second.point, first);
    return result?.closestPoints
      ? { value: result.value, closestPoints: [result.closestPoints[1], result.closestPoints[0]] }
      : result;
  }
  if (first.kind === "point" && second.kind === "plane") {
    return pointPlaneDistance(first.point, second);
  }
  if (first.kind === "plane" && second.kind === "point") {
    const result = pointPlaneDistance(second.point, first);
    return result?.closestPoints
      ? { value: result.value, closestPoints: [result.closestPoints[1], result.closestPoints[0]] }
      : result;
  }
  if (first.kind === "line" && second.kind === "line") {
    return lineLineDistance(first, second);
  }
  if (first.kind === "line" && second.kind === "plane") {
    return linePlaneDistance(first, second);
  }
  if (first.kind === "plane" && second.kind === "line") {
    return linePlaneDistance(second, first);
  }
  if (first.kind === "plane" && second.kind === "plane") {
    return planePlaneDistance(first, second);
  }
  return undefined;
}

function supportAngle(first: Support, second: Support): number | undefined {
  if (first.kind === "plane" && second.kind === "plane") {
    return unsignedSupportAngle(first.normal, second.normal);
  }
  if (first.kind === "line" && second.kind === "line") {
    return unsignedSupportAngle(first.direction, second.direction);
  }
  return undefined;
}

function unsignedSupportAngle(
  first: readonly [number, number, number],
  second: readonly [number, number, number]
): number {
  const cosine = Math.min(1, Math.abs(dot(first, second)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

function pointLineDistance(
  point: readonly [number, number, number],
  line: Extract<Support, { readonly kind: "line" }>
): {
  readonly value: number;
  readonly closestPoints: readonly [
    readonly [number, number, number],
    readonly [number, number, number]
  ];
} {
  const offset = subtract(point, line.point);
  const along = dot(offset, line.direction);
  const closest = add(line.point, scale(line.direction, along));
  return { value: distance(point, closest), closestPoints: [point, closest] };
}

function pointPlaneDistance(
  point: readonly [number, number, number],
  plane: Extract<Support, { readonly kind: "plane" }>
): {
  readonly value: number;
  readonly closestPoints: readonly [
    readonly [number, number, number],
    readonly [number, number, number]
  ];
} {
  const signed = dot(subtract(point, plane.point), plane.normal);
  const closest = subtract(point, scale(plane.normal, signed));
  return { value: Math.abs(signed), closestPoints: [point, closest] };
}

function lineLineDistance(
  first: Extract<Support, { readonly kind: "line" }>,
  second: Extract<Support, { readonly kind: "line" }>
): { readonly value: number } | undefined {
  const cosine = Math.abs(dot(first.direction, second.direction));
  if (cosine >= PARALLEL_COSINE) {
    return { value: pointLineDistance(first.point, second).value };
  }
  const normal = cross(first.direction, second.direction);
  const length = Math.hypot(...normal);
  if (length === 0) return undefined;
  return { value: Math.abs(dot(subtract(second.point, first.point), scale(normal, 1 / length))) };
}

function linePlaneDistance(
  line: Extract<Support, { readonly kind: "line" }>,
  plane: Extract<Support, { readonly kind: "plane" }>
): { readonly value: number } | undefined {
  if (Math.abs(dot(line.direction, plane.normal)) > 1e-9) {
    return { value: 0 };
  }
  return { value: pointPlaneDistance(line.point, plane).value };
}

function planePlaneDistance(
  first: Extract<Support, { readonly kind: "plane" }>,
  second: Extract<Support, { readonly kind: "plane" }>
): { readonly value: number } {
  if (Math.abs(dot(first.normal, second.normal)) >= PARALLEL_COSINE) {
    return { value: Math.abs(dot(subtract(second.point, first.point), first.normal)) };
  }
  return { value: 0 };
}

function ready(
  values: readonly ExactInspectionValue[],
  rows: readonly MeasurementDisplayRow[],
  diagnostics: readonly ExactInspectionDiagnostic[] = []
): ExactInspectionResult {
  return {
    status: "ready",
    authority: EXACT_AUTHORITY,
    authorityLabel: formatViewportMeasurementAuthority(EXACT_AUTHORITY),
    rows,
    values,
    diagnostics
  };
}

function unavailable(
  status: "unavailable" | "stale" | "missing" | "ambiguous",
  message: string
): ExactInspectionResult {
  const code =
    status === "stale"
      ? "EXACT_MEASUREMENT_STALE"
      : status === "missing"
        ? "EXACT_MEASUREMENT_MISSING"
        : status === "ambiguous"
          ? "EXACT_MEASUREMENT_AMBIGUOUS"
          : "EXACT_MEASUREMENT_UNAVAILABLE";
  return {
    status,
    authority: "unsupported",
    authorityLabel: formatViewportMeasurementAuthority("unsupported"),
    rows: [],
    values: [],
    diagnostics: [
      {
        code,
        status: status === "unavailable" ? "unsupported" : status,
        message
      }
    ]
  };
}

function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function formatVector(vector: readonly [number, number, number]): string {
  return vector.map(formatNumber).join(", ");
}

function add(
  first: readonly [number, number, number],
  second: readonly [number, number, number]
): readonly [number, number, number] {
  return [first[0] + second[0], first[1] + second[1], first[2] + second[2]];
}

function subtract(
  first: readonly [number, number, number],
  second: readonly [number, number, number]
): readonly [number, number, number] {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

function scale(
  vector: readonly [number, number, number],
  value: number
): readonly [number, number, number] {
  return [vector[0] * value, vector[1] * value, vector[2] * value];
}

function dot(
  first: readonly [number, number, number],
  second: readonly [number, number, number]
): number {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function cross(
  first: readonly [number, number, number],
  second: readonly [number, number, number]
): readonly [number, number, number] {
  return [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0]
  ];
}

function distance(
  first: readonly [number, number, number],
  second: readonly [number, number, number]
): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

function normalize(
  vector: readonly [number, number, number]
): readonly [number, number, number] | undefined {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  return length === 0 ? undefined : scale(vector, 1 / length);
}
