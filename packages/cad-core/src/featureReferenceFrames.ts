import type {
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  MirrorPlaneRef,
  PatternDirectionRef,
  PatternRotationAxisRef,
  Vec3
} from "@web-cad/cad-protocol";
import type { CadDocument } from "./index";
import {
  createBodyGeneratedReferences,
  resolveGeneratedReference
} from "./generatedReferences";
import { createGeneratedReferenceMeasurements } from "./generatedReferenceMeasurements";

const DEFAULT_PART_ID = "part:default";

export interface ResolvedPatternAxisFrame {
  readonly origin: Vec3;
  readonly direction: Vec3;
}

export interface ResolvedMirrorPlaneFrame {
  readonly point: Vec3;
  readonly normal: Vec3;
}

export type FeatureReferenceFrameResolution<T> =
  | { readonly ok: true; readonly frame: T }
  | {
      readonly ok: false;
      readonly code:
        | "PATTERN_DIRECTION_UNRESOLVED"
        | "PATTERN_DIRECTION_UNSUPPORTED"
        | "PATTERN_AXIS_UNRESOLVED"
        | "PATTERN_AXIS_UNSUPPORTED"
        | "MIRROR_PLANE_UNRESOLVED"
        | "MIRROR_PLANE_UNSUPPORTED"
        | "MIRROR_OFFSET_INVALID";
      readonly message: string;
    };

export function resolvePatternDirectionFrame(
  document: CadDocument,
  reference: PatternDirectionRef
): FeatureReferenceFrameResolution<Vec3> {
  if (reference.kind === "globalAxis") {
    return { ok: true, frame: globalAxisVector(reference.axis) };
  }

  const edge = resolveEdgeReference(document, reference);
  if (!edge) {
    return unresolved(
      "PATTERN_DIRECTION_UNRESOLVED",
      "Pattern direction reference no longer resolves to a generated edge."
    );
  }
  if (
    edge.geometricSignature.curveType !== "line" ||
    !edge.geometricSignature.axis
  ) {
    return unresolved(
      "PATTERN_DIRECTION_UNSUPPORTED",
      "Pattern direction requires a proven linear edge."
    );
  }

  const direction = unitVector(edge.geometricSignature.axis);
  return direction
    ? { ok: true, frame: direction }
    : unresolved(
        "PATTERN_DIRECTION_UNSUPPORTED",
        "Pattern direction edge has a degenerate axis."
      );
}

export function resolvePatternRotationAxisFrame(
  document: CadDocument,
  reference: PatternRotationAxisRef
): FeatureReferenceFrameResolution<ResolvedPatternAxisFrame> {
  if (reference.kind === "globalAxis") {
    return {
      ok: true,
      frame: { origin: [0, 0, 0], direction: globalAxisVector(reference.axis) }
    };
  }

  const edge = resolveEdgeReference(document, reference);
  if (!edge) {
    return unresolved(
      "PATTERN_AXIS_UNRESOLVED",
      "Pattern rotation-axis reference no longer resolves to a generated edge."
    );
  }
  if (
    edge.geometricSignature.curveType !== "line" ||
    !edge.geometricSignature.axis
  ) {
    return unresolved(
      "PATTERN_AXIS_UNSUPPORTED",
      "Pattern rotation axis requires a proven linear edge."
    );
  }

  const direction = unitVector(edge.geometricSignature.axis);
  const origin = resolveEdgeOrigin(document, edge);
  return direction && origin
    ? { ok: true, frame: { origin, direction } }
    : unresolved(
        "PATTERN_AXIS_UNRESOLVED",
        "Pattern rotation-axis origin could not be reconstructed from the edge proof."
      );
}

export function resolveMirrorPlaneFrame(
  document: CadDocument,
  reference: MirrorPlaneRef
): FeatureReferenceFrameResolution<ResolvedMirrorPlaneFrame> {
  const offset = reference.offset ?? 0;
  if (!Number.isFinite(offset)) {
    return unresolved(
      "MIRROR_OFFSET_INVALID",
      "Mirror plane offset must be finite."
    );
  }

  if (reference.kind === "standardPlane") {
    const normal = standardPlaneNormal(reference.plane);
    return {
      ok: true,
      frame: {
        point: scaleVector(normal, offset),
        normal
      }
    };
  }

  const face = resolveFaceReference(document, reference);
  if (!face) {
    return unresolved(
      "MIRROR_PLANE_UNRESOLVED",
      "Mirror plane reference no longer resolves to a generated face."
    );
  }
  if (
    face.geometricSignature.surfaceType !== "plane" ||
    !face.geometricSignature.normal
  ) {
    return unresolved(
      "MIRROR_PLANE_UNSUPPORTED",
      "Mirror plane requires a proven planar face."
    );
  }

  const normal = unitVector(face.geometricSignature.normal);
  const point = resolveFacePoint(document, face);
  return normal && point
    ? {
        ok: true,
        frame: { point: addVectors(point, scaleVector(normal, offset)), normal }
      }
    : unresolved(
        "MIRROR_PLANE_UNRESOLVED",
        "Mirror plane point could not be reconstructed from the face proof."
      );
}

function resolveEdgeReference(
  document: CadDocument,
  reference: Exclude<PatternDirectionRef, { readonly kind: "globalAxis" }>
): CadGeneratedEdgeReference | undefined {
  const target = resolveReferenceTarget(document, reference);
  if (!target) {
    return undefined;
  }
  const references = createBodyGeneratedReferences(
    document,
    target.bodyId,
    DEFAULT_PART_ID
  );
  const resolved = references
    ? resolveGeneratedReference(references, target.stableId)
    : undefined;
  return resolved?.reference.kind === "edge" ? resolved.reference : undefined;
}

function resolveFaceReference(
  document: CadDocument,
  reference: Exclude<MirrorPlaneRef, { readonly kind: "standardPlane" }>
): CadGeneratedFaceReference | undefined {
  const target = resolveReferenceTarget(document, reference);
  if (!target) {
    return undefined;
  }
  const references = createBodyGeneratedReferences(
    document,
    target.bodyId,
    DEFAULT_PART_ID
  );
  const resolved = references
    ? resolveGeneratedReference(references, target.stableId)
    : undefined;
  return resolved?.reference.kind === "face" ? resolved.reference : undefined;
}

function resolveReferenceTarget(
  document: CadDocument,
  reference:
    | Exclude<PatternDirectionRef, { readonly kind: "globalAxis" }>
    | Exclude<MirrorPlaneRef, { readonly kind: "standardPlane" }>
): { readonly bodyId: string; readonly stableId: string } | undefined {
  if (
    reference.kind === "generatedEdge" ||
    reference.kind === "generatedFace"
  ) {
    return reference;
  }
  if (reference.kind === "namedReference") {
    return document.namedReferences.get(reference.name);
  }

  const anchor = document.topologyIdentity?.anchors.find(
    (candidate) =>
      candidate.anchorId === reference.anchorId &&
      candidate.bodyId === reference.bodyId &&
      candidate.state === "active" &&
      candidate.stableId
  );
  return anchor?.stableId
    ? { bodyId: anchor.bodyId, stableId: anchor.stableId }
    : undefined;
}

function resolveEdgeOrigin(
  document: CadDocument,
  edge: CadGeneratedEdgeReference
): Vec3 | undefined {
  const measurement = createGeneratedReferenceMeasurements({
    document,
    bodyId: edge.bodyId,
    stableId: edge.stableId,
    units: document.units,
    ownerPartId: DEFAULT_PART_ID,
    bodyExists: (bodyId) =>
      [...document.features.values()].some(
        (feature) => feature.bodyId === bodyId
      )
  });
  if (!measurement.ok || measurement.measurements.kind !== "edge") {
    return undefined;
  }
  const { startPoint, endPoint, center } = measurement.measurements;
  return startPoint && endPoint ? midpoint(startPoint, endPoint) : center;
}

function resolveFacePoint(
  document: CadDocument,
  face: CadGeneratedFaceReference
): Vec3 | undefined {
  const measurement = createGeneratedReferenceMeasurements({
    document,
    bodyId: face.bodyId,
    stableId: face.stableId,
    units: document.units,
    ownerPartId: DEFAULT_PART_ID,
    bodyExists: (bodyId) =>
      [...document.features.values()].some(
        (feature) => feature.bodyId === bodyId
      )
  });
  return measurement.ok && measurement.measurements.kind === "face"
    ? measurement.measurements.center
    : undefined;
}

function globalAxisVector(axis: "x" | "y" | "z"): Vec3 {
  return axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
}

function standardPlaneNormal(plane: "XY" | "XZ" | "YZ"): Vec3 {
  return plane === "XY" ? [0, 0, 1] : plane === "XZ" ? [0, 1, 0] : [1, 0, 0];
}

function unitVector(vector: Vec3): Vec3 | undefined {
  const length = Math.hypot(...vector);
  return Number.isFinite(length) && length > 1e-12
    ? [vector[0] / length, vector[1] / length, vector[2] / length]
    : undefined;
}

function midpoint(left: Vec3, right: Vec3): Vec3 {
  return [
    (left[0] + right[0]) / 2,
    (left[1] + right[1]) / 2,
    (left[2] + right[2]) / 2
  ];
}

function scaleVector(vector: Vec3, scalar: number): Vec3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function addVectors(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function unresolved<T>(
  code: Extract<
    FeatureReferenceFrameResolution<T>,
    { readonly ok: false }
  >["code"],
  message: string
): FeatureReferenceFrameResolution<T> {
  return { ok: false, code, message };
}
