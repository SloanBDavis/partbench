import type {
  FeatureAlignPlane,
  FeatureAlignTransform,
  Vec3
} from "@web-cad/cad-protocol";

const ALIGN_EPSILON = 1e-9;

export interface AlignAxisFrame {
  readonly origin: Vec3;
  readonly direction: Vec3;
}

export interface ComputedAlignPose {
  readonly transform: FeatureAlignTransform;
  readonly alignedSourceFace: FeatureAlignPlane;
}

/**
 * Face/plane target: shortest rotation that matches source normal to target
 * normal, then translation along the target normal so the source face becomes
 * coplanar with the target. Remaining in-plane slide and spin about the common
 * normal stay locked at identity.
 *
 * Datum-axis target: the axis is the remaining rotation/lock. Rotate the
 * source face so its normal is perpendicular to the axis (smallest rotation
 * about axis × normal), then translate along the new normal so the axis lies
 * in the source face. Remaining spin about the axis stays locked at identity.
 */
export function computeAlignPose(
  source: FeatureAlignPlane,
  target:
    | { readonly kind: "plane"; readonly plane: FeatureAlignPlane }
    | { readonly kind: "axis"; readonly axis: AlignAxisFrame }
): ComputedAlignPose {
  return target.kind === "plane"
    ? alignPlaneToPlane(source, target.plane)
    : alignPlaneToAxis(source, target.axis);
}

/**
 * Axis–axis concentric: shortest rotation that matches source direction to
 * target direction (preferring same sense), then radial translation so the
 * axes coincide. Remaining slide along the common axis stays free.
 */
export function computeConcentricAxisPose(
  source: AlignAxisFrame,
  target: AlignAxisFrame
): { readonly transform: FeatureAlignTransform } {
  const sourceDir = unitOrThrow(source.direction, "source axis direction");
  const targetDir = unitOrThrow(target.direction, "target axis direction");
  // Prefer same-sense alignment; if anti-parallel is closer, flip target sense.
  const same = shortestRotation(sourceDir, targetDir);
  const flipped = shortestRotation(sourceDir, scale(targetDir, -1));
  const useFlipped =
    Math.abs(flipped.degrees) + ALIGN_EPSILON < Math.abs(same.degrees);
  const rotation = useFlipped ? flipped : same;
  const commonDir = useFlipped ? scale(targetDir, -1) : targetDir;
  // Radial correction onto the common axis line (axial slide stays free).
  const signedAlong = dot(sub(source.origin, target.origin), commonDir);
  const onAxis = add(target.origin, scale(commonDir, signedAlong));
  const translation = sub(onAxis, source.origin);
  return {
    transform: {
      translation: canonicalVec3(translation),
      rotationAxis: canonicalVec3(rotation.axis),
      rotationDegrees: rotation.degrees
    }
  };
}

function alignPlaneToPlane(
  source: FeatureAlignPlane,
  target: FeatureAlignPlane
): ComputedAlignPose {
  const sourceNormal = unitOrThrow(source.normal, "source face normal");
  const targetNormal = unitOrThrow(target.normal, "target plane normal");
  const rotation = shortestRotation(sourceNormal, targetNormal);
  const rotatedPoint = rotatePoint(
    source.point,
    source.point,
    rotation.axis,
    rotation.degrees
  );
  const signedDistance = dot(sub(rotatedPoint, target.point), targetNormal);
  const translation = scale(targetNormal, -signedDistance);
  const alignedPoint = add(rotatedPoint, translation);
  return {
    transform: {
      translation: canonicalVec3(translation),
      rotationAxis: canonicalVec3(rotation.axis),
      rotationDegrees: rotation.degrees
    },
    alignedSourceFace: {
      point: canonicalVec3(alignedPoint),
      normal: canonicalVec3(targetNormal)
    }
  };
}

function alignPlaneToAxis(
  source: FeatureAlignPlane,
  axis: AlignAxisFrame
): ComputedAlignPose {
  const sourceNormal = unitOrThrow(source.normal, "source face normal");
  const axisDirection = unitOrThrow(axis.direction, "datum axis direction");
  const rejected = sub(
    sourceNormal,
    scale(axisDirection, dot(sourceNormal, axisDirection))
  );
  const desiredNormal =
    length(rejected) <= ALIGN_EPSILON
      ? perpendicularTo(axisDirection)
      : unitOrThrow(rejected, "axis-perpendicular face normal");
  const rotation = shortestRotation(sourceNormal, desiredNormal);
  const rotatedPoint = rotatePoint(
    source.point,
    source.point,
    rotation.axis,
    rotation.degrees
  );
  const rotatedNormal = rotateVector(sourceNormal, rotation.axis, rotation.degrees);
  const signedDistance = dot(sub(rotatedPoint, axis.origin), rotatedNormal);
  const translation = scale(rotatedNormal, -signedDistance);
  return {
    transform: {
      translation: canonicalVec3(translation),
      rotationAxis: canonicalVec3(rotation.axis),
      rotationDegrees: rotation.degrees
    },
    alignedSourceFace: {
      point: canonicalVec3(add(rotatedPoint, translation)),
      normal: canonicalVec3(rotatedNormal)
    }
  };
}

function shortestRotation(
  from: Vec3,
  to: Vec3
): { readonly axis: Vec3; readonly degrees: number } {
  const source = unitOrThrow(from, "rotation source");
  const target = unitOrThrow(to, "rotation target");
  const cosTheta = clamp(dot(source, target), -1, 1);
  if (cosTheta > 1 - ALIGN_EPSILON) {
    return { axis: [0, 0, 1], degrees: 0 };
  }
  if (cosTheta < -1 + ALIGN_EPSILON) {
    return { axis: perpendicularTo(source), degrees: 180 };
  }
  const axis = unitOrThrow(cross(source, target), "rotation axis");
  return { axis, degrees: (Math.acos(cosTheta) * 180) / Math.PI };
}

function rotatePoint(
  point: Vec3,
  origin: Vec3,
  axis: Vec3,
  degrees: number
): Vec3 {
  return add(origin, rotateVector(sub(point, origin), axis, degrees));
}

function rotateVector(vector: Vec3, axis: Vec3, degrees: number): Vec3 {
  if (Math.abs(degrees) <= ALIGN_EPSILON) {
    return vector;
  }
  const unitAxis = unitOrThrow(axis, "rotation axis");
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const parallel = scale(unitAxis, dot(unitAxis, vector));
  const rejection = sub(vector, parallel);
  return add(add(parallel, scale(rejection, cos)), scale(cross(unitAxis, vector), sin));
}

function perpendicularTo(vector: Vec3): Vec3 {
  const helper: Vec3 =
    Math.abs(vector[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return unitOrThrow(cross(vector, helper), "perpendicular");
}

function unitOrThrow(vector: Vec3, label: string): Vec3 {
  const magnitude = length(vector);
  if (!Number.isFinite(magnitude) || magnitude <= ALIGN_EPSILON) {
    throw new Error(`Align ${label} is degenerate.`);
  }
  return scale(vector, 1 / magnitude);
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function canonicalNumber(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function canonicalVec3(vector: Vec3): Vec3 {
  return [
    canonicalNumber(vector[0]),
    canonicalNumber(vector[1]),
    canonicalNumber(vector[2])
  ];
}
