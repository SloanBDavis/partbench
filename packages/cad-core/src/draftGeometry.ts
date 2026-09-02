import type {
  FeatureDraftPlane,
  Vec3
} from "@web-cad/cad-protocol";

const DRAFT_EPSILON = 1e-9;
const MAX_DRAFT_ANGLE_DEGREES = 89;

export interface ComputedDraftFace {
  readonly plane: FeatureDraftPlane;
}

export interface ComputedDraftGeometry {
  readonly pullDirection: Vec3;
  readonly draftedFaces: readonly ComputedDraftFace[];
}

export type DraftGeometryFailure =
  | { readonly ok: false; readonly code: "NON_PLANAR"; readonly message: string }
  | { readonly ok: false; readonly code: "PARALLEL_TO_PULL"; readonly message: string }
  | { readonly ok: false; readonly code: "WOULD_INVERT"; readonly message: string }
  | { readonly ok: false; readonly code: "INVALID_ANGLE"; readonly message: string };

export type DraftGeometryResult =
  | ({ readonly ok: true } & ComputedDraftGeometry)
  | DraftGeometryFailure;

export interface DraftFaceInput {
  readonly plane: FeatureDraftPlane;
  readonly spanAlongPull: number;
  readonly materialExtent: number;
}

/**
 * Neutral-plane draft: pull direction is the neutral normal oriented toward
 * the drafted faces. Positive angle tapers the face inward (material removed)
 * as you travel along pull. The drafted face rotates about its intersection
 * with the neutral plane so the far edge moves inward by height * tan(angle).
 */
export function computeDraftGeometry(
  faces: readonly DraftFaceInput[],
  neutral: FeatureDraftPlane,
  angleDegrees: number
): DraftGeometryResult {
  if (
    !Number.isFinite(angleDegrees) ||
    angleDegrees === 0 ||
    Math.abs(angleDegrees) >= MAX_DRAFT_ANGLE_DEGREES
  ) {
    return {
      ok: false,
      code: "INVALID_ANGLE",
      message:
        "feature.draft angleDegrees must be a non-zero finite number whose absolute value is less than 89°."
    };
  }
  if (faces.length === 0) {
    return {
      ok: false,
      code: "NON_PLANAR",
      message: "feature.draft requires at least one planar face."
    };
  }

  const neutralNormal = unitOrUndefined(neutral.normal);
  if (!neutralNormal) {
    return {
      ok: false,
      code: "NON_PLANAR",
      message: "feature.draft neutral plane must have a finite unit normal."
    };
  }

  const pullTowardFirst = unitOrUndefined(
    sub(faces[0]!.plane.point, neutral.point)
  );
  const pullDirection = canonicalVec3(
    pullTowardFirst && dot(pullTowardFirst, neutralNormal) < 0
      ? scale(neutralNormal, -1)
      : neutralNormal
  );

  const draftedFaces: ComputedDraftFace[] = [];
  const radians = (angleDegrees * Math.PI) / 180;
  const tanAngle = Math.tan(Math.abs(radians));

  for (const face of faces) {
    const faceNormal = unitOrUndefined(face.plane.normal);
    if (!faceNormal) {
      return {
        ok: false,
        code: "NON_PLANAR",
        message: "feature.draft face set must be planar or planar-adjacent."
      };
    }
    const hingeAxis = cross(faceNormal, pullDirection);
    if (length(hingeAxis) < DRAFT_EPSILON) {
      return {
        ok: false,
        code: "PARALLEL_TO_PULL",
        message:
          "feature.draft face is parallel to the pull direction and cannot taper."
      };
    }
    const axis = unitOrUndefined(hingeAxis);
    if (!axis) {
      return {
        ok: false,
        code: "PARALLEL_TO_PULL",
        message:
          "feature.draft face is parallel to the pull direction and cannot taper."
      };
    }
    if (
      !Number.isFinite(face.spanAlongPull) ||
      face.spanAlongPull <= DRAFT_EPSILON ||
      !Number.isFinite(face.materialExtent) ||
      face.materialExtent <= DRAFT_EPSILON
    ) {
      return {
        ok: false,
        code: "WOULD_INVERT",
        message: "feature.draft face set would invert the solid."
      };
    }
    if (face.spanAlongPull * tanAngle >= face.materialExtent - DRAFT_EPSILON) {
      return {
        ok: false,
        code: "WOULD_INVERT",
        message: "feature.draft face set would invert the solid."
      };
    }

    const signedAngle = angleDegrees < 0 ? -radians : radians;
    const draftedNormal = rotateAroundAxis(faceNormal, axis, signedAngle);
    const hingePoint = projectOntoPlane(face.plane.point, neutral.point, pullDirection);
    draftedFaces.push({
      plane: {
        point: canonicalVec3(hingePoint),
        normal: canonicalVec3(unitOrUndefined(draftedNormal) ?? draftedNormal)
      }
    });
  }

  return {
    ok: true,
    pullDirection,
    draftedFaces
  };
}

function projectOntoPlane(point: Vec3, planePoint: Vec3, planeNormal: Vec3): Vec3 {
  return sub(point, scale(planeNormal, dot(sub(point, planePoint), planeNormal)));
}

function rotateAroundAxis(vector: Vec3, axis: Vec3, radians: number): Vec3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return add(
    add(scale(vector, cosine), scale(cross(axis, vector), sine)),
    scale(axis, dot(axis, vector) * (1 - cosine))
  );
}

function unitOrUndefined(vector: Vec3): Vec3 | undefined {
  const magnitude = length(vector);
  return Number.isFinite(magnitude) && magnitude > DRAFT_EPSILON
    ? scale(vector, 1 / magnitude)
    : undefined;
}

function add(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function sub(left: Vec3, right: Vec3): Vec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function scale(vector: Vec3, scalar: number): Vec3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function dot(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function length(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function canonicalNumber(value: number): number {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function canonicalVec3(vector: Vec3): Vec3 {
  return [
    canonicalNumber(vector[0]),
    canonicalNumber(vector[1]),
    canonicalNumber(vector[2])
  ];
}
