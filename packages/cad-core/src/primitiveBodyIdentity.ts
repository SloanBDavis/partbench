import type { BodyId, ObjectId } from "@web-cad/cad-protocol";

export interface PrimitiveBodyIdentityDocument {
  readonly objects: ReadonlyMap<ObjectId, unknown>;
}

export function createPrimitiveBodyId(objectId: ObjectId): BodyId {
  return `body:${objectId}`;
}

export function isPrimitiveBodyId(
  document: PrimitiveBodyIdentityDocument,
  bodyId: BodyId
): boolean {
  return (
    bodyId.startsWith("body:") &&
    document.objects.has(bodyId.slice("body:".length))
  );
}
