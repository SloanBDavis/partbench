import type {
  CadGeneratedFaceReference,
  SketchAttachmentSnapshot
} from "@web-cad/cad-protocol";

const SKETCH_PLANE_OPERATION = "feature.attachSketchPlane";

export function canCreateSketchOnFace(
  face: CadGeneratedFaceReference
): boolean {
  return face.eligibleOperations.includes(SKETCH_PLANE_OPERATION);
}

export function getSketchAttachableFaces(
  faces: readonly CadGeneratedFaceReference[]
): readonly CadGeneratedFaceReference[] {
  return faces.filter(canCreateSketchOnFace);
}

export function createSketchOnFaceDefaultName(
  face: CadGeneratedFaceReference
): string {
  return `${face.label} sketch`;
}

export function formatGeneratedFaceEligibility(
  face: CadGeneratedFaceReference
): string {
  if (canCreateSketchOnFace(face)) {
    return "Sketch plane";
  }

  return face.eligibilityNotes?.[0] ?? "Not eligible for sketch attachment";
}

export function formatSketchAttachmentLabel(
  attachment: SketchAttachmentSnapshot
): string {
  return `${attachment.faceRole} on ${attachment.bodyId}`;
}
