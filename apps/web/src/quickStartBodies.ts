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
  const featureBaseName = kind === "box" ? "Box" : "Cylinder";
  const featureName = createNextFeatureName(
    featureBaseName,
    [...document.features.values()].map((feature) => feature.name)
  );
  const sketchName = `${featureName} profile`;
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

function createNextFeatureName(
  baseName: string,
  existingNames: Iterable<string | undefined>
): string {
  let highest = 0;
  const numbered = new RegExp(`^${baseName} (\\d+)$`);

  for (const name of existingNames) {
    if (name === baseName) highest = Math.max(highest, 1);
    const match = name?.match(numbered);
    if (match) highest = Math.max(highest, Number(match[1]));
  }

  return `${baseName} ${highest + 1}`;
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
