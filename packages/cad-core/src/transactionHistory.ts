import type {
  CadActorMetadata,
  CadObjectRef,
  CadOperationSummary,
  CadSemanticDiffSummary,
  CadSketchEntityRef,
  CadTransactionAuditMetadata,
  CadTransactionHistoryEntry,
  CadTransactionStatus,
  DocumentUnitUpdateMode,
  FeatureSemanticDiff,
  ObjectId,
  SemanticDiff,
  SketchEntityId,
  SketchEntityKind,
  SketchSemanticDiff,
  SketchId,
  TransactionId,
  CadOp
} from "@web-cad/cad-protocol";

export interface TransactionHistorySource {
  readonly id: TransactionId;
  readonly ops: readonly CadOp[];
  readonly status: CadTransactionStatus;
  readonly diff: SemanticDiff;
  readonly actor?: CadActorMetadata;
  readonly audit?: CadTransactionAuditMetadata;
}

export function createTransactionHistoryEntries(
  transactions: readonly TransactionHistorySource[]
): readonly CadTransactionHistoryEntry[] {
  return sortTransactions(transactions).map(createTransactionHistoryEntry);
}

export function sortTransactions<T extends { readonly id: TransactionId }>(
  transactions: readonly T[]
): readonly T[] {
  return [...transactions].sort((left, right) => {
    const leftNumber = parseTransactionNumber(left.id);
    const rightNumber = parseTransactionNumber(right.id);
    return leftNumber === rightNumber
      ? left.id.localeCompare(right.id)
      : leftNumber - rightNumber;
  });
}

export function parseTransactionNumber(id: TransactionId): number {
  const match = /^txn_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function createTransactionHistoryEntry(
  transaction: TransactionHistorySource
): CadTransactionHistoryEntry {
  const ops = createOperationSummaries(transaction);

  return {
    id: transaction.id,
    status: transaction.status,
    ...(transaction.actor ? { actor: transaction.actor } : {}),
    ...(transaction.audit ? { audit: transaction.audit } : {}),
    opCount: transaction.ops.length,
    ops,
    diff: createSemanticDiffSummary(transaction.diff)
  };
}

function createOperationSummaries(
  transaction: TransactionHistorySource
): readonly CadOperationSummary[] {
  let createdIndex = 0;
  let createdSketchIndex = 0;
  let createdSketchEntityIndex = 0;
  let createdFeatureIndex = 0;
  let deletedFeatureIndex = 0;

  return transaction.ops.map((op) => {
    const createdRef =
      op.op === "scene.createBox" ||
      op.op === "scene.createCylinder" ||
      op.op === "scene.createSphere" ||
      op.op === "scene.createCone" ||
      op.op === "scene.createTorus"
        ? transaction.diff.created[createdIndex++]
        : undefined;
    const createdSketchRef =
      op.op === "sketch.create" || op.op === "sketch.createOnFace"
        ? transaction.diff.sketches?.created?.[createdSketchIndex++]
        : undefined;
    const createdSketchEntityRef = isSketchAddEntityOp(op)
      ? transaction.diff.sketches?.entitiesCreated?.[createdSketchEntityIndex++]
      : undefined;
    const createdFeatureRef =
      op.op === "feature.extrude"
        ? transaction.diff.features?.created?.[createdFeatureIndex++]
        : undefined;
    const deletedFeatureRef =
      op.op === "feature.delete"
        ? transaction.diff.features?.deleted?.[deletedFeatureIndex++]
        : undefined;

    switch (op.op) {
      case "document.updateUnits":
        return {
          op: op.op,
          label: `Set document units to ${op.units} (${formatUnitUpdateModeLabel(op.mode)})`
        };

      case "scene.createBox": {
        const objectId = op.id ?? createdRef?.id;

        return createObjectOperationSummary({
          op: op.op,
          label: `Create box ${objectId ?? "with generated ID"}`,
          objectId,
          objectKind: "box"
        });
      }

      case "scene.createCylinder": {
        const objectId = op.id ?? createdRef?.id;

        return createObjectOperationSummary({
          op: op.op,
          label: `Create cylinder ${objectId ?? "with generated ID"}`,
          objectId,
          objectKind: "cylinder"
        });
      }

      case "scene.createSphere": {
        const objectId = op.id ?? createdRef?.id;

        return createObjectOperationSummary({
          op: op.op,
          label: `Create sphere ${objectId ?? "with generated ID"}`,
          objectId,
          objectKind: "sphere"
        });
      }

      case "scene.createCone": {
        const objectId = op.id ?? createdRef?.id;

        return createObjectOperationSummary({
          op: op.op,
          label: `Create cone ${objectId ?? "with generated ID"}`,
          objectId,
          objectKind: "cone"
        });
      }

      case "scene.createTorus": {
        const objectId = op.id ?? createdRef?.id;

        return createObjectOperationSummary({
          op: op.op,
          label: `Create torus ${objectId ?? "with generated ID"}`,
          objectId,
          objectKind: "torus"
        });
      }

      case "scene.deleteObject":
        return createObjectOperationSummary({
          op: op.op,
          label: `Delete object ${op.id}`,
          objectId: op.id,
          objectKind: findObjectKind(transaction.diff.deleted, op.id)
        });

      case "scene.updateTransform":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update transform for ${op.id}`,
          objectId: op.id,
          objectKind: findObjectKind(transaction.diff.modified, op.id)
        });

      case "scene.updateBoxDimensions":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update box dimensions for ${op.id}`,
          objectId: op.id,
          objectKind: "box"
        });

      case "scene.updateCylinderDimensions":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update cylinder dimensions for ${op.id}`,
          objectId: op.id,
          objectKind: "cylinder"
        });

      case "scene.updateSphereDimensions":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update sphere dimensions for ${op.id}`,
          objectId: op.id,
          objectKind: "sphere"
        });

      case "scene.updateConeDimensions":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update cone dimensions for ${op.id}`,
          objectId: op.id,
          objectKind: "cone"
        });

      case "scene.updateTorusDimensions":
        return createObjectOperationSummary({
          op: op.op,
          label: `Update torus dimensions for ${op.id}`,
          objectId: op.id,
          objectKind: "torus"
        });

      case "scene.renameObject":
        return createObjectOperationSummary({
          op: op.op,
          label: `Rename object ${op.id}`,
          objectId: op.id,
          objectKind: findObjectKind(transaction.diff.modified, op.id)
        });

      case "sketch.create": {
        const sketchId = op.id ?? createdSketchRef?.id;

        return createSketchOperationSummary({
          op: op.op,
          label: `Create sketch ${sketchId ?? "with generated ID"}`,
          sketchId
        });
      }

      case "sketch.createOnFace": {
        const sketchId = op.id ?? createdSketchRef?.id;

        return createSketchOperationSummary({
          op: op.op,
          label: `Create sketch ${sketchId ?? "with generated ID"} on ${op.faceStableId}`,
          sketchId
        });
      }

      case "sketch.rename":
        return createSketchOperationSummary({
          op: op.op,
          label: `Rename sketch ${op.id}`,
          sketchId: op.id
        });

      case "sketch.delete":
        return createSketchOperationSummary({
          op: op.op,
          label: `Delete sketch ${op.id}`,
          sketchId: op.id
        });

      case "sketch.addPoint":
      case "sketch.addLine":
      case "sketch.addRectangle":
      case "sketch.addCircle": {
        const entityId = op.id ?? createdSketchEntityRef?.id;
        const entityKind = getSketchEntityKindFromAddOp(op.op);

        return createSketchOperationSummary({
          op: op.op,
          label: `Add ${entityKind} ${entityId ?? "with generated ID"} to ${op.sketchId}`,
          sketchId: op.sketchId,
          sketchEntityId: entityId,
          sketchEntityKind: entityKind
        });
      }

      case "sketch.updateEntity": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) =>
            feature.sketchId === op.sketchId &&
            feature.entityId === op.entity.id
        );

        return createSketchOperationSummary({
          op: op.op,
          label: `Update ${op.entity.kind} ${op.entity.id} in ${op.sketchId}${
            modifiedFeatureRef?.bodyId
              ? ` and rebuild body ${modifiedFeatureRef.bodyId}`
              : ""
          }`,
          sketchId: op.sketchId,
          sketchEntityId: op.entity.id,
          sketchEntityKind: op.entity.kind,
          featureId: modifiedFeatureRef?.id,
          bodyId: modifiedFeatureRef?.bodyId
        });
      }

      case "sketch.deleteEntity":
        return createSketchOperationSummary({
          op: op.op,
          label: `Delete entity ${op.entityId} from ${op.sketchId}`,
          sketchId: op.sketchId,
          sketchEntityId: op.entityId,
          sketchEntityKind: findSketchEntityKind(
            transaction.diff.sketches?.entitiesDeleted ?? [],
            op.sketchId,
            op.entityId
          )
        });

      case "feature.extrude": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create extrude feature ${featureId ?? "with generated ID"} from ${op.sketchId}/${op.entityId}${
            bodyId ? ` -> body ${bodyId}` : ""
          }`,
          sketchId: op.sketchId,
          sketchEntityId: op.entityId,
          featureId,
          bodyId
        });
      }

      case "feature.delete": {
        const bodyLabel = deletedFeatureRef?.bodyId
          ? ` and body ${deletedFeatureRef.bodyId}`
          : "";

        return createFeatureOperationSummary({
          op: op.op,
          label: `Delete feature ${op.id}${bodyLabel}`,
          featureId: op.id,
          bodyId: deletedFeatureRef?.bodyId,
          sketchId: deletedFeatureRef?.sketchId,
          sketchEntityId: deletedFeatureRef?.entityId
        });
      }

      case "feature.updateExtrude": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update extrude feature ${op.id} ${formatExtrudeUpdateLabel(op)}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId,
          sketchId: modifiedFeatureRef?.sketchId,
          sketchEntityId: modifiedFeatureRef?.entityId
        });
      }
    }
  });
}

function formatUnitUpdateModeLabel(
  mode: DocumentUnitUpdateMode | undefined
): string {
  return mode === "preservePhysicalSize" ? "convert size" : "relabel values";
}

function formatExtrudeUpdateLabel(
  op: Extract<CadOp, { readonly op: "feature.updateExtrude" }>
): string {
  const edits = [
    ...(op.depth !== undefined ? [`depth to ${op.depth}`] : []),
    ...(op.side !== undefined ? [`side to ${op.side}`] : [])
  ];

  return edits.join(" and ");
}

function createObjectOperationSummary(
  summary: CadOperationSummary
): CadOperationSummary {
  return {
    op: summary.op,
    label: summary.label,
    ...(summary.objectId ? { objectId: summary.objectId } : {}),
    ...(summary.objectKind ? { objectKind: summary.objectKind } : {})
  };
}

function createSketchOperationSummary(
  summary: CadOperationSummary
): CadOperationSummary {
  return {
    op: summary.op,
    label: summary.label,
    ...(summary.sketchId ? { sketchId: summary.sketchId } : {}),
    ...(summary.sketchEntityId
      ? { sketchEntityId: summary.sketchEntityId }
      : {}),
    ...(summary.sketchEntityKind
      ? { sketchEntityKind: summary.sketchEntityKind }
      : {}),
    ...(summary.featureId ? { featureId: summary.featureId } : {}),
    ...(summary.bodyId ? { bodyId: summary.bodyId } : {})
  };
}

function createFeatureOperationSummary(
  summary: CadOperationSummary
): CadOperationSummary {
  return {
    op: summary.op,
    label: summary.label,
    ...(summary.sketchId ? { sketchId: summary.sketchId } : {}),
    ...(summary.sketchEntityId
      ? { sketchEntityId: summary.sketchEntityId }
      : {}),
    ...(summary.featureId ? { featureId: summary.featureId } : {}),
    ...(summary.bodyId ? { bodyId: summary.bodyId } : {})
  };
}

function findObjectKind(
  refs: readonly CadObjectRef[],
  id: ObjectId
): CadObjectRef["kind"] | undefined {
  return refs.find((ref) => ref.id === id)?.kind;
}

function findSketchEntityKind(
  refs: readonly CadSketchEntityRef[],
  sketchId: SketchId,
  entityId: SketchEntityId
): SketchEntityKind | undefined {
  return refs.find((ref) => ref.sketchId === sketchId && ref.id === entityId)
    ?.kind;
}

function getSketchEntityKindFromAddOp(
  op:
    | "sketch.addPoint"
    | "sketch.addLine"
    | "sketch.addRectangle"
    | "sketch.addCircle"
): SketchEntityKind {
  switch (op) {
    case "sketch.addPoint":
      return "point";
    case "sketch.addLine":
      return "line";
    case "sketch.addRectangle":
      return "rectangle";
    case "sketch.addCircle":
      return "circle";
  }
}

function createSemanticDiffSummary(diff: SemanticDiff): CadSemanticDiffSummary {
  return {
    created: [...diff.created],
    modified: [...diff.modified],
    deleted: [...diff.deleted],
    createdCount: diff.created.length,
    modifiedCount: diff.modified.length,
    deletedCount: diff.deleted.length,
    ...(diff.sketches
      ? {
          sketches: cloneSketchSemanticDiff(diff.sketches)
        }
      : {}),
    ...(diff.features
      ? {
          features: cloneFeatureSemanticDiff(diff.features)
        }
      : {}),
    ...(diff.document
      ? {
          document: {
            ...(diff.document.units
              ? {
                  units: {
                    before: diff.document.units.before,
                    after: diff.document.units.after,
                    ...(diff.document.units.mode
                      ? { mode: diff.document.units.mode }
                      : {}),
                    ...(diff.document.units.scaleFactor !== undefined
                      ? { scaleFactor: diff.document.units.scaleFactor }
                      : {})
                  }
                }
              : {})
          }
        }
      : {})
  };
}

function cloneSketchSemanticDiff(diff: SketchSemanticDiff): SketchSemanticDiff {
  return {
    ...(diff.created ? { created: [...diff.created] } : {}),
    ...(diff.modified ? { modified: [...diff.modified] } : {}),
    ...(diff.deleted ? { deleted: [...diff.deleted] } : {}),
    ...(diff.entitiesCreated
      ? { entitiesCreated: [...diff.entitiesCreated] }
      : {}),
    ...(diff.entitiesModified
      ? { entitiesModified: [...diff.entitiesModified] }
      : {}),
    ...(diff.entitiesDeleted
      ? { entitiesDeleted: [...diff.entitiesDeleted] }
      : {})
  };
}

function cloneFeatureSemanticDiff(
  diff: FeatureSemanticDiff
): FeatureSemanticDiff {
  return {
    ...(diff.created ? { created: [...diff.created] } : {}),
    ...(diff.modified ? { modified: [...diff.modified] } : {}),
    ...(diff.deleted ? { deleted: [...diff.deleted] } : {}),
    ...(diff.bodiesCreated ? { bodiesCreated: [...diff.bodiesCreated] } : {}),
    ...(diff.bodiesModified
      ? { bodiesModified: [...diff.bodiesModified] }
      : {}),
    ...(diff.bodiesDeleted ? { bodiesDeleted: [...diff.bodiesDeleted] } : {})
  };
}

function isSketchAddEntityOp(op: CadOp): op is Extract<
  CadOp,
  {
    readonly op:
      | "sketch.addPoint"
      | "sketch.addLine"
      | "sketch.addRectangle"
      | "sketch.addCircle";
  }
> {
  return (
    op.op === "sketch.addPoint" ||
    op.op === "sketch.addLine" ||
    op.op === "sketch.addRectangle" ||
    op.op === "sketch.addCircle"
  );
}
