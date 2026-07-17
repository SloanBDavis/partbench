import type { CadBodyGeneratedReferenceEvidenceSnapshot } from "@web-cad/cad-protocol";

import type {
  DerivedExtrudeGeometrySource,
  DerivedGeometrySource
} from "./derivedGeometry";
import {
  createGeneratedFaceReferenceKey,
  type SketchDisplayFrame
} from "./sketchDisplayFrames";

export function createCompositeGeneratedFaceFrames(
  sources: readonly DerivedGeometrySource[],
  evidenceByBodyId: ReadonlyMap<
    string,
    CadBodyGeneratedReferenceEvidenceSnapshot
  >
): ReadonlyMap<string, SketchDisplayFrame> {
  const frames = new Map<string, SketchDisplayFrame>();

  for (const source of sources) {
    if (source.kind !== "extrude" || source.profile.kind !== "wire") {
      continue;
    }
    const evidence = evidenceByBodyId.get(source.id);
    if (
      evidence?.status !== "ready" ||
      evidence.recipeIdentity !== source.profile.sourceIdentity
    ) {
      continue;
    }

    const wireSource = { ...source, profile: source.profile };
    addCapFrames(frames, wireSource, evidence);
    addPlanarSideFrames(frames, wireSource, evidence);
  }

  return frames;
}

function addCapFrames(
  frames: Map<string, SketchDisplayFrame>,
  source: DerivedExtrudeGeometrySource & {
    readonly profile: Extract<
      DerivedExtrudeGeometrySource["profile"],
      { readonly kind: "wire" }
    >;
  },
  evidence: CadBodyGeneratedReferenceEvidenceSnapshot
): void {
  const normal = frameNormal(source.profile.frame);
  const range = extrusionRange(source);

  for (const role of ["startCap", "endCap"] as const) {
    if (
      !evidence.faces.some(
        (face) => face.role === role && face.surfaceClass === "plane"
      )
    ) {
      continue;
    }
    const distance = role === "startCap" ? range.start : range.end;
    frames.set(
      createGeneratedFaceReferenceKey(
        source.id,
        `generated:face:${source.id}:${role}`
      ),
      {
        origin: addScaled(source.profile.frame.origin, normal, distance),
        uAxis:
          role === "startCap"
            ? scale(source.profile.frame.uAxis, -1)
            : source.profile.frame.uAxis,
        vAxis: source.profile.frame.vAxis
      }
    );
  }
}

function addPlanarSideFrames(
  frames: Map<string, SketchDisplayFrame>,
  source: DerivedExtrudeGeometrySource & {
    readonly profile: Extract<
      DerivedExtrudeGeometrySource["profile"],
      { readonly kind: "wire" }
    >;
  },
  evidence: CadBodyGeneratedReferenceEvidenceSnapshot
): void {
  const profileNormal = frameNormal(source.profile.frame);
  const range = extrusionRange(source);
  const extrusionAxis =
    range.end >= range.start ? profileNormal : scale(profileNormal, -1);

  for (const face of evidence.faces) {
    if (
      face.role !== "side" ||
      face.surfaceClass !== "plane" ||
      !face.sourceEntityId
    ) {
      continue;
    }
    const segment = source.profile.segments.find(
      (candidate) => candidate.sourceEntityId === face.sourceEntityId
    );
    if (!segment || segment.kind !== "line") {
      continue;
    }
    const direction = normalize([
      segment.end[0] - segment.start[0],
      segment.end[1] - segment.start[1]
    ]);
    const uAxis = add(
      scale(source.profile.frame.uAxis, direction[0]),
      scale(source.profile.frame.vAxis, direction[1])
    );
    const profilePoint = add(
      add(
        source.profile.frame.origin,
        scale(source.profile.frame.uAxis, segment.start[0])
      ),
      scale(source.profile.frame.vAxis, segment.start[1])
    );
    frames.set(
      createGeneratedFaceReferenceKey(
        source.id,
        `generated:face:${source.id}:side:${encodeURIComponent(face.sourceEntityId)}`
      ),
      {
        origin: addScaled(profilePoint, profileNormal, range.start),
        uAxis,
        vAxis: extrusionAxis
      }
    );
  }
}

function extrusionRange(source: DerivedExtrudeGeometrySource): {
  readonly start: number;
  readonly end: number;
} {
  if (source.side === "symmetric") {
    return { start: -source.depth / 2, end: source.depth / 2 };
  }
  return source.side === "negative"
    ? { start: -source.depth, end: 0 }
    : { start: 0, end: source.depth };
}

function frameNormal(
  frame: SketchDisplayFrame
): readonly [number, number, number] {
  return normalize3([
    frame.uAxis[1] * frame.vAxis[2] - frame.uAxis[2] * frame.vAxis[1],
    frame.uAxis[2] * frame.vAxis[0] - frame.uAxis[0] * frame.vAxis[2],
    frame.uAxis[0] * frame.vAxis[1] - frame.uAxis[1] * frame.vAxis[0]
  ]);
}

function normalize(
  value: readonly [number, number]
): readonly [number, number] {
  const length = Math.hypot(value[0], value[1]);
  return [value[0] / length, value[1] / length];
}

function normalize3(
  value: readonly [number, number, number]
): readonly [number, number, number] {
  const length = Math.hypot(...value);
  return [value[0] / length, value[1] / length, value[2] / length];
}

function add(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): readonly [number, number, number] {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function scale(
  value: readonly [number, number, number],
  scalar: number
): readonly [number, number, number] {
  return [
    canonicalZero(value[0] * scalar),
    canonicalZero(value[1] * scalar),
    canonicalZero(value[2] * scalar)
  ];
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function addScaled(
  point: readonly [number, number, number],
  direction: readonly [number, number, number],
  distance: number
): readonly [number, number, number] {
  return add(point, scale(direction, distance));
}
