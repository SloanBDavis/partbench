import type { CadDocument } from "@web-cad/cad-core";
import type { CadOp, BodyId } from "@web-cad/cad-protocol";
import type { PrimitiveCommandForm } from "./cadCommands";

export type QuickStartSourceBodyKind = "box" | "cylinder";

export interface QuickStartSourceBodyPlan {
  readonly ops: readonly CadOp[];
  readonly bodyId: BodyId;
  readonly featureId: string;
  readonly sketchId: string;
  readonly entityId: string;
}

export function createQuickStartSourceBodyPlan({
  document,
  form,
  kind
}: {
  readonly document: CadDocument;
  readonly form: PrimitiveCommandForm;
  readonly kind: QuickStartSourceBodyKind;
}): QuickStartSourceBodyPlan {
  const sketchId = createNextAvailableId("sketch", document.sketches.keys());
  const entityId = createNextAvailableId(
    "skent",
    readSketchEntityIds(document)
  );
  const featureId = createNextAvailableId("feat", document.features.keys());
  const bodyId = createNextAvailableId("body", readBodyIds(document));
  const center: readonly [number, number] = [
    form.translationX,
    form.translationY
  ];
  const sketchName = kind === "box" ? "Box profile" : "Cylinder profile";
  const featureName = kind === "box" ? "Box" : "Cylinder";
  const profileOp: CadOp =
    kind === "box"
      ? {
          op: "sketch.addRectangle",
          sketchId,
          id: entityId,
          center,
          width: form.width,
          height: form.height
        }
      : {
          op: "sketch.addCircle",
          sketchId,
          id: entityId,
          center,
          radius: form.radius
        };

  return {
    bodyId,
    entityId,
    featureId,
    sketchId,
    ops: [
      {
        op: "sketch.create",
        id: sketchId,
        name: sketchName,
        plane: "XY"
      },
      profileOp,
      {
        op: "feature.extrude",
        id: featureId,
        bodyId,
        name: featureName,
        sketchId,
        entityId,
        depth: kind === "box" ? form.depth : form.height,
        side: "symmetric",
        operationMode: "newBody"
      }
    ]
  };
}

function createNextAvailableId(
  prefix: string,
  existingIds: Iterable<string>
): string {
  const existing = new Set(existingIds);
  let nextNumber = 1;
  let id = `${prefix}_${nextNumber}`;

  while (existing.has(id)) {
    nextNumber += 1;
    id = `${prefix}_${nextNumber}`;
  }

  return id;
}

function* readSketchEntityIds(document: CadDocument): IterableIterator<string> {
  for (const sketch of document.sketches.values()) {
    yield* sketch.entities.keys();
  }
}

function* readBodyIds(document: CadDocument): IterableIterator<BodyId> {
  for (const feature of document.features.values()) {
    yield feature.bodyId;
  }
}
