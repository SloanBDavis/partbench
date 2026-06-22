import type {
  CadActorMetadata,
  CadObjectRef,
  CadOperationSummary,
  CadSemanticDiffSummary,
  CadSketchConstraintRef,
  CadSketchDimensionRef,
  CadFeatureRef,
  CadSketchEntityRef,
  CadTransactionAuditMetadata,
  CadTransactionHistoryEntry,
  CadTransactionStatus,
  DocumentUnitUpdateMode,
  FeatureSemanticDiff,
  ReferenceSemanticDiff,
  ParameterSemanticDiff,
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
  let createdNamedReferenceIndex = 0;
  let repairedNamedReferenceIndex = 0;
  let deletedNamedReferenceIndex = 0;
  let createdTopologyCheckpointIndex = 0;
  let createdTopologyAnchorIndex = 0;
  let repairedTopologyAnchorIndex = 0;
  let createdParameterIndex = 0;
  let deletedParameterIndex = 0;
  let createdSketchDimensionIndex = 0;
  let deletedSketchDimensionIndex = 0;
  let createdSketchConstraintIndex = 0;
  let deletedSketchConstraintIndex = 0;

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
      op.op === "feature.extrude" ||
      op.op === "feature.revolve" ||
      op.op === "feature.hole" ||
      op.op === "feature.chamfer" ||
      op.op === "feature.fillet"
        ? transaction.diff.features?.created?.[createdFeatureIndex++]
        : undefined;
    const deletedFeatureRef =
      op.op === "feature.delete"
        ? transaction.diff.features?.deleted?.[deletedFeatureIndex++]
        : undefined;
    const createdNamedReferenceRef =
      op.op === "reference.nameGenerated"
        ? transaction.diff.references?.namedCreated?.[
            createdNamedReferenceIndex++
          ]
        : undefined;
    const repairedNamedReferenceRef =
      op.op === "reference.repairName"
        ? transaction.diff.references?.namedRepaired?.[
            repairedNamedReferenceIndex++
          ]
        : undefined;
    const deletedNamedReferenceRef =
      op.op === "reference.deleteName"
        ? transaction.diff.references?.namedDeleted?.[
            deletedNamedReferenceIndex++
          ]
        : undefined;
    const createdTopologyCheckpointRef =
      op.op === "topology.checkpoint.create"
        ? transaction.diff.references?.topologyCheckpointsCreated?.[
            createdTopologyCheckpointIndex++
          ]
        : undefined;
    const createdTopologyAnchorRef =
      op.op === "topology.anchor.create"
        ? transaction.diff.references?.topologyAnchorsCreated?.[
            createdTopologyAnchorIndex++
          ]
        : undefined;
    const repairedTopologyAnchorRef =
      op.op === "topology.anchor.repair"
        ? transaction.diff.references?.topologyAnchorsRepaired?.[
            repairedTopologyAnchorIndex++
          ]
        : undefined;
    const createdParameterRef =
      op.op === "parameter.create"
        ? transaction.diff.parameters?.created?.[createdParameterIndex++]
        : undefined;
    const deletedParameterRef =
      op.op === "parameter.delete"
        ? transaction.diff.parameters?.deleted?.[deletedParameterIndex++]
        : undefined;
    const createdSketchDimensionRef =
      op.op === "sketch.dimension.create"
        ? transaction.diff.sketchDimensions?.created?.[
            createdSketchDimensionIndex++
          ]
        : undefined;
    const deletedSketchDimensionRef =
      op.op === "sketch.dimension.delete"
        ? transaction.diff.sketchDimensions?.deleted?.[
            deletedSketchDimensionIndex++
          ]
        : undefined;
    const createdSketchConstraintRef =
      op.op === "sketch.constraint.create"
        ? transaction.diff.sketchConstraints?.created?.[
            createdSketchConstraintIndex++
          ]
        : undefined;
    const deletedSketchConstraintRef =
      op.op === "sketch.constraint.delete"
        ? transaction.diff.sketchConstraints?.deleted?.[
            deletedSketchConstraintIndex++
          ]
        : undefined;

    switch (op.op) {
      case "parameter.create": {
        const parameterId = op.id ?? createdParameterRef?.id;

        return createParameterOperationSummary({
          op: op.op,
          label: `Create parameter ${parameterId ?? "with generated ID"}`,
          parameterId
        });
      }

      case "parameter.update":
        return createParameterOperationSummary({
          op: op.op,
          label: `Update parameter ${op.id}`,
          parameterId: op.id
        });

      case "parameter.rename":
        return createParameterOperationSummary({
          op: op.op,
          label: `Rename parameter ${op.id}`,
          parameterId: op.id
        });

      case "parameter.delete":
        return createParameterOperationSummary({
          op: op.op,
          label: `Delete parameter ${op.id}`,
          parameterId: op.id ?? deletedParameterRef?.id
        });

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
        const target = op.referenceName
          ? `named reference ${op.referenceName}`
          : op.topologyAnchorId
            ? `topology anchor ${op.topologyAnchorId}`
            : op.faceStableId;

        return createSketchOperationSummary({
          op: op.op,
          label: `Create sketch ${sketchId ?? "with generated ID"} on ${target}`,
          sketchId,
          ...(op.bodyId ? { bodyId: op.bodyId } : {}),
          ...(op.faceStableId ? { stableId: op.faceStableId } : {}),
          ...(op.referenceName ? { referenceName: op.referenceName } : {}),
          ...(op.topologyAnchorId
            ? { topologyAnchorId: op.topologyAnchorId }
            : {})
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
            getFeatureRefSketchId(feature) === op.sketchId &&
            getFeatureRefSketchEntityId(feature) === op.entity.id
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

      case "sketch.dimension.create": {
        const dimensionId = op.id ?? createdSketchDimensionRef?.id;

        return createSketchDimensionOperationSummary({
          op: op.op,
          label: `Create sketch dimension ${dimensionId ?? "with generated ID"} on ${op.sketchId}/${op.entityId}`,
          sketchDimensionId: dimensionId,
          sketchId: op.sketchId,
          sketchEntityId: op.entityId
        });
      }

      case "sketch.dimension.update":
        return createSketchDimensionOperationSummary({
          op: op.op,
          label: `Update sketch dimension ${op.id}`,
          sketchDimensionId: op.id
        });

      case "sketch.dimension.rename":
        return createSketchDimensionOperationSummary({
          op: op.op,
          label: `Rename sketch dimension ${op.id}`,
          sketchDimensionId: op.id
        });

      case "sketch.dimension.delete":
        return createSketchDimensionOperationSummary({
          op: op.op,
          label: `Delete sketch dimension ${op.id}`,
          sketchDimensionId: op.id ?? deletedSketchDimensionRef?.id
        });

      case "sketch.constraint.create": {
        const constraintId = op.id ?? createdSketchConstraintRef?.id;
        const targetEntityId =
          op.kind === "fixed"
            ? op.target.entityId
            : op.kind === "coincident"
              ? op.primaryTarget.entityId
              : op.kind === "midpoint"
                ? op.lineEntityId
                : op.kind === "parallel" || op.kind === "perpendicular"
                  ? op.secondaryLineEntityId
                  : op.entityId;
        const targetLabel =
          op.kind === "fixed"
            ? `${op.sketchId}/${op.target.entityId}.${op.target.role}`
            : op.kind === "coincident"
              ? `${op.sketchId}/${op.primaryTarget.entityId}.${op.primaryTarget.role} = ${op.secondaryTarget.entityId}.${op.secondaryTarget.role}`
              : op.kind === "midpoint"
                ? `${op.sketchId}/${op.lineEntityId} midpoint -> ${op.target.entityId}.${op.target.role}`
                : op.kind === "parallel" || op.kind === "perpendicular"
                  ? `${op.sketchId}/${op.primaryLineEntityId} ${op.kind} -> ${op.secondaryLineEntityId}`
                  : `${op.sketchId}/${op.entityId}`;

        return createSketchConstraintOperationSummary({
          op: op.op,
          label: `Create ${op.kind} sketch constraint ${constraintId ?? "with generated ID"} on ${targetLabel}`,
          sketchConstraintId: constraintId,
          sketchId: op.sketchId,
          sketchEntityId: targetEntityId
        });
      }

      case "sketch.constraint.rename":
        return createSketchConstraintOperationSummary({
          op: op.op,
          label: `Rename sketch constraint ${op.id}`,
          sketchConstraintId: op.id
        });

      case "sketch.constraint.delete":
        return createSketchConstraintOperationSummary({
          op: op.op,
          label: `Delete sketch constraint ${op.id}`,
          sketchConstraintId: op.id ?? deletedSketchConstraintRef?.id
        });

      case "feature.extrude": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const operationMode = op.operationMode ?? "newBody";
        const operationLabel =
          operationMode === "newBody" ? "new body" : operationMode;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create ${operationLabel} extrude feature ${featureId ?? "with generated ID"} from ${op.sketchId}/${op.entityId}${
            bodyId ? ` -> body ${bodyId}` : ""
          }`,
          sketchId: op.sketchId,
          sketchEntityId: op.entityId,
          featureId,
          bodyId,
          targetBodyId: op.targetBodyId,
          operationMode
        });
      }

      case "feature.revolve": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const operationMode = op.operationMode ?? "newBody";

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create new body revolve feature ${featureId ?? "with generated ID"} from ${op.sketchId}/${op.entityId} around ${op.axis.entityId} at ${op.angleDegrees} degrees${
            bodyId ? ` -> body ${bodyId}` : ""
          }`,
          sketchId: op.sketchId,
          sketchEntityId: op.entityId,
          featureId,
          bodyId,
          targetBodyId: op.targetBodyId,
          operationMode
        });
      }

      case "feature.hole": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const depthLabel =
          op.depthMode === "blind" ? `blind ${op.depth}` : "through all";
        const direction = op.direction ?? "positive";

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create ${depthLabel} ${direction} hole feature ${featureId ?? "with generated ID"} from ${op.sketchId}/${op.circleEntityId} into ${op.targetBodyId}${
            bodyId ? ` -> body ${bodyId}` : ""
          }`,
          sketchId: op.sketchId,
          sketchEntityId: op.circleEntityId,
          featureId,
          bodyId,
          targetBodyId: op.targetBodyId
        });
      }

      case "feature.chamfer": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const edgeLabel = op.namedReference
          ? `named reference ${op.namedReference}`
          : op.edgeStableId;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create chamfer feature ${featureId ?? "with generated ID"} on ${edgeLabel} of ${op.targetBodyId}${
            bodyId ? ` -> body ${bodyId}` : ""
          }`,
          featureId,
          bodyId,
          targetBodyId: op.targetBodyId,
          stableId: op.edgeStableId,
          referenceName: op.namedReference
        });
      }

      case "feature.fillet": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const edgeLabel = op.namedReference
          ? `named reference ${op.namedReference}`
          : op.edgeStableId;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create fillet feature ${featureId ?? "with generated ID"} on ${edgeLabel} of ${op.targetBodyId}${
            bodyId ? ` -> body ${bodyId}` : ""
          }`,
          featureId,
          bodyId,
          targetBodyId: op.targetBodyId,
          stableId: op.edgeStableId,
          referenceName: op.namedReference
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
          sketchId: deletedFeatureRef
            ? getFeatureRefSketchId(deletedFeatureRef)
            : undefined,
          sketchEntityId: deletedFeatureRef
            ? getFeatureRefSketchEntityId(deletedFeatureRef)
            : undefined
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
          sketchId: modifiedFeatureRef
            ? getFeatureRefSketchId(modifiedFeatureRef)
            : undefined,
          sketchEntityId: modifiedFeatureRef
            ? getFeatureRefSketchEntityId(modifiedFeatureRef)
            : undefined
        });
      }

      case "feature.updateRevolve": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update revolve feature ${op.id} angle to ${op.angleDegrees}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId,
          sketchId: modifiedFeatureRef
            ? getFeatureRefSketchId(modifiedFeatureRef)
            : undefined,
          sketchEntityId: modifiedFeatureRef
            ? getFeatureRefSketchEntityId(modifiedFeatureRef)
            : undefined
        });
      }

      case "feature.updateHole": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update hole feature ${op.id} ${formatHoleUpdateLabel(op)}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId,
          targetBodyId:
            modifiedFeatureRef?.kind === "hole"
              ? modifiedFeatureRef.targetBodyId
              : undefined,
          sketchId: modifiedFeatureRef
            ? getFeatureRefSketchId(modifiedFeatureRef)
            : undefined,
          sketchEntityId: modifiedFeatureRef
            ? getFeatureRefSketchEntityId(modifiedFeatureRef)
            : undefined
        });
      }

      case "feature.updateChamfer": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update chamfer feature ${op.id} distance to ${op.distance}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId,
          targetBodyId:
            modifiedFeatureRef?.kind === "chamfer"
              ? modifiedFeatureRef.targetBodyId
              : undefined
        });
      }

      case "feature.updateFillet": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update fillet feature ${op.id} radius to ${op.radius}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId,
          targetBodyId:
            modifiedFeatureRef?.kind === "fillet"
              ? modifiedFeatureRef.targetBodyId
              : undefined
        });
      }

      case "reference.nameGenerated": {
        const kindLabel = createdNamedReferenceRef?.kind
          ? `${createdNamedReferenceRef.kind} `
          : "";

        return createReferenceOperationSummary({
          op: op.op,
          label: `Name generated ${kindLabel}reference ${op.name}`,
          referenceName: op.name,
          bodyId: op.bodyId,
          stableId: op.stableId,
          generatedReferenceKind: createdNamedReferenceRef?.kind
        });
      }

      case "reference.repairName": {
        const kindLabel = repairedNamedReferenceRef?.after.kind
          ? `${repairedNamedReferenceRef.after.kind} `
          : "";

        return createReferenceOperationSummary({
          op: op.op,
          label: `Repair named ${kindLabel}reference ${op.name}`,
          referenceName: op.name,
          bodyId: op.bodyId,
          stableId: op.stableId,
          generatedReferenceKind: repairedNamedReferenceRef?.after.kind
        });
      }

      case "reference.deleteName": {
        const targetLabel = deletedNamedReferenceRef?.stableId
          ? ` for ${deletedNamedReferenceRef.stableId}`
          : "";

        return createReferenceOperationSummary({
          op: op.op,
          label: `Delete named reference ${op.name}${targetLabel}`,
          referenceName: op.name,
          bodyId: deletedNamedReferenceRef?.bodyId,
          stableId: deletedNamedReferenceRef?.stableId,
          generatedReferenceKind: deletedNamedReferenceRef?.kind
        });
      }

      case "topology.checkpoint.create": {
        return createReferenceOperationSummary({
          op: op.op,
          label: `Create topology checkpoint ${op.checkpointId}`,
          bodyId: op.bodyId,
          checkpointId: op.checkpointId,
          featureId: createdTopologyCheckpointRef?.sourceFeatureId
        });
      }

      case "topology.anchor.create": {
        return createReferenceOperationSummary({
          op: op.op,
          label: `Create ${op.entityKind} topology anchor ${op.anchorId}`,
          bodyId: op.bodyId,
          stableId: op.stableId,
          topologyAnchorId: op.anchorId,
          checkpointId: op.checkpointId,
          checkpointEntityId: op.checkpointEntityId,
          topologyEntityKind: createdTopologyAnchorRef?.entityKind
        });
      }

      case "topology.anchor.repair": {
        return createReferenceOperationSummary({
          op: op.op,
          label: `Repair topology anchor ${op.anchorId}`,
          bodyId: repairedTopologyAnchorRef?.after.bodyId,
          stableId: repairedTopologyAnchorRef?.after.stableId,
          topologyAnchorId: op.anchorId,
          checkpointId: op.replacementCheckpointId,
          checkpointEntityId: op.replacementCheckpointEntityId,
          repairId: op.repairId,
          topologyEntityKind: repairedTopologyAnchorRef?.after.entityKind,
          confidence: op.confidence
        });
      }
    }
  });
}

function getFeatureRefSketchEntityId(
  feature: CadFeatureRef
): SketchEntityId | undefined {
  if (feature.kind === "hole") {
    return feature.circleEntityId;
  }

  if (feature.kind === "chamfer" || feature.kind === "fillet") {
    return undefined;
  }

  return feature.entityId;
}

function getFeatureRefSketchId(feature: CadFeatureRef): SketchId | undefined {
  if (feature.kind === "chamfer" || feature.kind === "fillet") {
    return undefined;
  }

  return feature.sketchId;
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

function formatHoleUpdateLabel(
  op: Extract<CadOp, { readonly op: "feature.updateHole" }>
): string {
  const edits = [
    ...(op.depthMode !== undefined ? [`depth mode to ${op.depthMode}`] : []),
    ...(op.depth !== undefined ? [`depth to ${op.depth}`] : []),
    ...(op.direction !== undefined ? [`direction to ${op.direction}`] : [])
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

function createParameterOperationSummary(
  summary: CadOperationSummary
): CadOperationSummary {
  return {
    op: summary.op,
    label: summary.label,
    ...(summary.parameterId ? { parameterId: summary.parameterId } : {})
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
    ...(summary.bodyId ? { bodyId: summary.bodyId } : {}),
    ...(summary.stableId ? { stableId: summary.stableId } : {}),
    ...(summary.referenceName ? { referenceName: summary.referenceName } : {}),
    ...(summary.topologyAnchorId
      ? { topologyAnchorId: summary.topologyAnchorId }
      : {}),
    ...(summary.checkpointId ? { checkpointId: summary.checkpointId } : {})
  };
}

function createSketchDimensionOperationSummary(
  summary: CadOperationSummary
): CadOperationSummary {
  return {
    op: summary.op,
    label: summary.label,
    ...(summary.sketchDimensionId
      ? { sketchDimensionId: summary.sketchDimensionId }
      : {}),
    ...(summary.sketchId ? { sketchId: summary.sketchId } : {}),
    ...(summary.sketchEntityId
      ? { sketchEntityId: summary.sketchEntityId }
      : {})
  };
}

function createSketchConstraintOperationSummary(
  summary: CadOperationSummary
): CadOperationSummary {
  return {
    op: summary.op,
    label: summary.label,
    ...(summary.sketchConstraintId
      ? { sketchConstraintId: summary.sketchConstraintId }
      : {}),
    ...(summary.sketchId ? { sketchId: summary.sketchId } : {}),
    ...(summary.sketchEntityId
      ? { sketchEntityId: summary.sketchEntityId }
      : {})
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
    ...(summary.bodyId ? { bodyId: summary.bodyId } : {}),
    ...(summary.targetBodyId ? { targetBodyId: summary.targetBodyId } : {}),
    ...(summary.operationMode ? { operationMode: summary.operationMode } : {})
  };
}

function createReferenceOperationSummary(
  summary: CadOperationSummary
): CadOperationSummary {
  return {
    op: summary.op,
    label: summary.label,
    ...(summary.referenceName ? { referenceName: summary.referenceName } : {}),
    ...(summary.bodyId ? { bodyId: summary.bodyId } : {}),
    ...(summary.stableId ? { stableId: summary.stableId } : {}),
    ...(summary.generatedReferenceKind
      ? { generatedReferenceKind: summary.generatedReferenceKind }
      : {}),
    ...(summary.featureId ? { featureId: summary.featureId } : {}),
    ...(summary.topologyAnchorId
      ? { topologyAnchorId: summary.topologyAnchorId }
      : {}),
    ...(summary.checkpointId ? { checkpointId: summary.checkpointId } : {}),
    ...(summary.checkpointEntityId
      ? { checkpointEntityId: summary.checkpointEntityId }
      : {}),
    ...(summary.repairId ? { repairId: summary.repairId } : {}),
    ...(summary.topologyEntityKind
      ? { topologyEntityKind: summary.topologyEntityKind }
      : {}),
    ...(summary.confidence ? { confidence: summary.confidence } : {})
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
    ...(diff.references
      ? {
          references: cloneReferenceSemanticDiff(diff.references)
        }
      : {}),
    ...(diff.parameters
      ? {
          parameters: cloneParameterSemanticDiff(diff.parameters)
        }
      : {}),
    ...(diff.sketchDimensions
      ? {
          sketchDimensions: cloneSketchDimensionSemanticDiff(
            diff.sketchDimensions
          )
        }
      : {}),
    ...(diff.sketchConstraints
      ? {
          sketchConstraints: cloneSketchConstraintSemanticDiff(
            diff.sketchConstraints
          )
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

function cloneReferenceSemanticDiff(
  diff: ReferenceSemanticDiff
): ReferenceSemanticDiff {
  return {
    ...(diff.namedCreated ? { namedCreated: [...diff.namedCreated] } : {}),
    ...(diff.namedRepaired ? { namedRepaired: [...diff.namedRepaired] } : {}),
    ...(diff.namedDeleted ? { namedDeleted: [...diff.namedDeleted] } : {}),
    ...(diff.topologyCheckpointsCreated
      ? { topologyCheckpointsCreated: [...diff.topologyCheckpointsCreated] }
      : {}),
    ...(diff.topologyAnchorsCreated
      ? { topologyAnchorsCreated: [...diff.topologyAnchorsCreated] }
      : {}),
    ...(diff.topologyAnchorsRepaired
      ? { topologyAnchorsRepaired: [...diff.topologyAnchorsRepaired] }
      : {})
  };
}

function cloneParameterSemanticDiff(
  diff: ParameterSemanticDiff
): ParameterSemanticDiff {
  return {
    ...(diff.created ? { created: [...diff.created] } : {}),
    ...(diff.modified ? { modified: [...diff.modified] } : {}),
    ...(diff.deleted ? { deleted: [...diff.deleted] } : {})
  };
}

function cloneSketchDimensionSemanticDiff(diff: {
  readonly created?: readonly CadSketchDimensionRef[];
  readonly modified?: readonly CadSketchDimensionRef[];
  readonly deleted?: readonly CadSketchDimensionRef[];
}): {
  readonly created?: readonly CadSketchDimensionRef[];
  readonly modified?: readonly CadSketchDimensionRef[];
  readonly deleted?: readonly CadSketchDimensionRef[];
} {
  return {
    ...(diff.created ? { created: [...diff.created] } : {}),
    ...(diff.modified ? { modified: [...diff.modified] } : {}),
    ...(diff.deleted ? { deleted: [...diff.deleted] } : {})
  };
}

function cloneSketchConstraintSemanticDiff(diff: {
  readonly created?: readonly CadSketchConstraintRef[];
  readonly modified?: readonly CadSketchConstraintRef[];
  readonly deleted?: readonly CadSketchConstraintRef[];
}): {
  readonly created?: readonly CadSketchConstraintRef[];
  readonly modified?: readonly CadSketchConstraintRef[];
  readonly deleted?: readonly CadSketchConstraintRef[];
} {
  return {
    ...(diff.created ? { created: [...diff.created] } : {}),
    ...(diff.modified ? { modified: [...diff.modified] } : {}),
    ...(diff.deleted ? { deleted: [...diff.deleted] } : {})
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
    ...(diff.bodiesDeleted ? { bodiesDeleted: [...diff.bodiesDeleted] } : {}),
    ...(diff.referenceEffects
      ? { referenceEffects: [...diff.referenceEffects] }
      : {}),
    ...(diff.lifecycleEffects
      ? { lifecycleEffects: [...diff.lifecycleEffects] }
      : {})
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
