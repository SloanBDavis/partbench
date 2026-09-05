import type {
  CadActorMetadata,
  CadObjectRef,
  CadOperationSummary,
  CadSemanticDiffSummary,
  CadSketchConstraintRef,
  CadSketchDimensionRefCurrent,
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
  SketchProfileRefV22,
  SketchDimensionTargetV22,
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
  let createdDatumIndex = 0;
  let createdAssemblyIndex = 0;
  let createdAssemblyInstanceIndex = 0;
  let createdAssemblyMateIndex = 0;
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
    const createdDatumRef =
      op.op === "datum.plane.create" || op.op === "datum.axis.create"
        ? transaction.diff.datums?.created?.[createdDatumIndex++]
        : undefined;
    const createdAssemblyRef =
      op.op === "assembly.create"
        ? transaction.diff.assemblies?.created?.[createdAssemblyIndex++]
        : undefined;
    const createdAssemblyInstanceRef =
      op.op === "assembly.instance.insert"
        ? transaction.diff.assemblies?.instancesCreated?.[
            createdAssemblyInstanceIndex++
          ]
        : undefined;
    const createdAssemblyMateRef =
      op.op === "assembly.mate.create"
        ? transaction.diff.assemblies?.matesCreated?.[
            createdAssemblyMateIndex++
          ]
        : undefined;
    const createdSketchEntityRef = isSketchAddEntityOp(op)
      ? transaction.diff.sketches?.entitiesCreated?.[createdSketchEntityIndex++]
      : undefined;
    const createdFeatureRef =
      op.op === "feature.extrude" ||
      op.op === "feature.revolve" ||
      op.op === "feature.hole" ||
      op.op === "feature.chamfer" ||
      op.op === "feature.fillet" ||
      op.op === "feature.sweep" ||
      op.op === "feature.loft" ||
      op.op === "feature.linearPattern" ||
      op.op === "feature.circularPattern" ||
      op.op === "feature.mirror" ||
      op.op === "feature.combine" ||
      op.op === "feature.offset" ||
      op.op === "feature.align" ||
      op.op === "feature.draft" ||
      op.op === "feature.shell"
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
      case "project.importStep":
        return {
          op: op.op,
          label: `Import STEP ${op.sourceFileName}`
        };

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

      case "parameter.setExpression":
        return createParameterOperationSummary({
          op: op.op,
          label:
            op.expression === undefined ||
            op.expression === null ||
            op.expression.trim() === ""
              ? `Clear expression on parameter ${op.id}`
              : `Set expression on parameter ${op.id}`,
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
        const planeLabel = op.datumId
          ? `datum ${op.datumId}`
          : (op.plane ?? createdSketchRef?.plane ?? "plane");

        return createSketchOperationSummary({
          op: op.op,
          label: `Create sketch ${sketchId ?? "with generated ID"} on ${planeLabel}`,
          sketchId,
          ...(op.datumId ? { datumId: op.datumId } : {})
        });
      }

      case "datum.plane.create": {
        const datumId = op.id ?? createdDatumRef?.id;
        return {
          op: op.op,
          label: `Create datum plane ${datumId ?? "with generated ID"}`,
          datumId
        };
      }

      case "datum.axis.create": {
        const datumId = op.id ?? createdDatumRef?.id;
        return {
          op: op.op,
          label: `Create datum axis ${datumId ?? "with generated ID"}`,
          datumId
        };
      }

      case "assembly.create": {
        const assemblyId = op.id ?? createdAssemblyRef?.id;
        return {
          op: op.op,
          label: `Create assembly ${assemblyId ?? "with generated ID"}`
        };
      }

      case "assembly.instance.insert": {
        const instanceId = op.id ?? createdAssemblyInstanceRef?.id;
        return {
          op: op.op,
          label: `Insert assembly instance ${instanceId ?? "with generated ID"} of ${op.definition.bodyId} into ${op.assemblyId}`
        };
      }

      case "assembly.mate.create": {
        const mateId = op.id ?? createdAssemblyMateRef?.id;
        const target =
          op.kind === "fixed"
            ? `on ${op.instanceId}`
            : op.kind === "coincident"
              ? `planes ${op.primary.instanceId}/${op.primary.plane} ~ ${op.secondary.instanceId}/${op.secondary.plane}`
              : op.kind === "concentric"
                ? `axes ${op.primary.instanceId}/${op.primary.axis} ~ ${op.secondary.instanceId}/${op.secondary.axis}`
                : `kind ${String(op.kind)}`;
        return {
          op: op.op,
          label: `Create ${op.kind} mate ${mateId ?? "with generated ID"} ${target} in ${op.assemblyId}`
        };
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
      case "sketch.addCircle":
      case "sketch.addArc":
      case "sketch.addSpline": {
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

      case "sketch.setEntityConstruction":
        return createSketchOperationSummary({
          op: op.op,
          label: `Set construction=${op.construction} on entity ${op.entityId} in ${op.sketchId}`,
          sketchId: op.sketchId,
          sketchEntityId: op.entityId
        });

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

      case "sketch.trim":
      case "sketch.extend":
      case "sketch.split":
      case "sketch.explodeRectangle":
      case "sketch.offset":
        return createSketchOperationSummary({
          op: op.op,
          label: `${formatCurveEditOperation(op.op)} in ${op.sketchId}`,
          sketchId: op.sketchId,
          ...("entityId" in op ? { sketchEntityId: op.entityId } : {})
        });

      case "sketch.addSlot":
      case "sketch.addRoundedRectangle":
        return createSketchOperationSummary({
          op: op.op,
          label: `${op.op === "sketch.addSlot" ? "Add slot" : "Add rounded rectangle"} to ${op.sketchId}`,
          sketchId: op.sketchId
        });

      case "sketch.dimension.create": {
        const dimensionId = op.id ?? createdSketchDimensionRef?.id;
        const sketchEntityId =
          "entityId" in op && op.entityId
            ? op.entityId
            : getPrimaryDimensionTargetEntityId(op.target);

        return createSketchDimensionOperationSummary({
          op: op.op,
          label: `Create sketch dimension ${dimensionId ?? "with generated ID"} on ${op.sketchId}${sketchEntityId ? `/${sketchEntityId}` : ""}`,
          sketchDimensionId: dimensionId,
          sketchId: op.sketchId,
          sketchEntityId
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
                : op.kind === "parallel" ||
                    op.kind === "perpendicular" ||
                    op.kind === "equalLength"
                  ? op.secondaryLineEntityId
                  : op.kind === "tangent" || op.kind === "symmetry"
                    ? op.primaryTarget.entityId
                    : op.kind === "concentric" || op.kind === "equalRadius"
                      ? (op.primaryTarget?.entityId ?? op.primaryCircleEntityId)
                      : op.entityId;
        const targetLabel =
          op.kind === "fixed"
            ? `${op.sketchId}/${op.target.entityId}.${op.target.role}`
            : op.kind === "coincident"
              ? `${op.sketchId}/${op.primaryTarget.entityId}.${op.primaryTarget.role} = ${op.secondaryTarget.entityId}.${op.secondaryTarget.role}`
              : op.kind === "midpoint"
                ? `${op.sketchId}/${op.lineEntityId} midpoint -> ${op.target.entityId}.${op.target.role}`
                : op.kind === "parallel" ||
                    op.kind === "perpendicular" ||
                    op.kind === "equalLength"
                  ? `${op.sketchId}/${op.primaryLineEntityId} ${op.kind} -> ${op.secondaryLineEntityId}`
                  : op.kind === "tangent"
                    ? `${op.sketchId}/${op.primaryTarget.entityId} ${op.kind} -> ${op.secondaryTarget.entityId}`
                    : op.kind === "concentric" || op.kind === "equalRadius"
                      ? `${op.sketchId}/${op.primaryTarget?.entityId ?? op.primaryCircleEntityId} ${op.kind} -> ${op.secondaryTarget?.entityId ?? op.secondaryCircleEntityId}`
                      : op.kind === "symmetry"
                        ? `${op.sketchId}/${op.primaryTarget.entityId} symmetry ${op.secondaryTarget.entityId} about ${op.symmetryLineEntityId}`
                        : `${op.sketchId}/${op.entityId}`;

        return createSketchConstraintOperationSummary({
          op: op.op,
          label: `Create ${op.kind} sketch constraint ${constraintId ?? "with generated ID"} on ${targetLabel}`,
          sketchConstraintId: constraintId,
          sketchId: op.sketchId,
          sketchEntityId: targetEntityId
        });
      }

      case "sketch.constraint.update":
        return createSketchConstraintOperationSummary({
          op: op.op,
          label: `Update ${op.definition.kind} sketch constraint ${op.id}`,
          sketchConstraintId: op.id
        });

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
        const profile: SketchProfileRefV22 =
          "profile" in op && op.profile
            ? op.profile
            : {
                kind: "entity",
                sketchId: op.sketchId,
                entityId: op.entityId
              };

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create ${operationLabel} extrude feature ${featureId ?? "with generated ID"} from ${formatProfileRefLabel(profile)}${
            bodyId ? ` -> body ${bodyId}` : ""
          }`,
          sketchId: profile.sketchId,
          sketchEntityId:
            profile.kind === "entity" ? profile.entityId : undefined,
          featureId,
          bodyId,
          targetBodyId: op.targetBodyId,
          targetTopologyAnchorId: op.targetTopologyAnchorId,
          operationMode
        });
      }

      case "feature.revolve": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const operationMode = op.operationMode ?? "newBody";
        const profile: SketchProfileRefV22 =
          "profile" in op && op.profile
            ? op.profile
            : {
                kind: "entity" as const,
                sketchId: op.sketchId,
                entityId: op.entityId
              };
        const profileLabel = formatProfileRefLabel(profile);

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create new body revolve feature ${featureId ?? "with generated ID"} from ${profileLabel} around ${op.axis.entityId} at ${op.angleDegrees} degrees${
            bodyId ? ` -> body ${bodyId}` : ""
          }`,
          sketchId: profile.sketchId,
          sketchEntityId:
            profile.kind === "entity" ? profile.entityId : undefined,
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
        const targetLabel =
          op.targetBodyId ?? op.targetTopologyAnchorId ?? "target body";

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create ${depthLabel} ${direction} hole feature ${featureId ?? "with generated ID"} from ${op.sketchId}/${op.circleEntityId} into ${targetLabel}${
            bodyId ? ` -> body ${bodyId}` : ""
          }`,
          sketchId: op.sketchId,
          sketchEntityId: op.circleEntityId,
          featureId,
          bodyId,
          targetBodyId: op.targetBodyId,
          targetTopologyAnchorId: op.targetTopologyAnchorId
        });
      }

      case "feature.sweep": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const profileSketchId = op.profile?.sketchId ?? op.profileSketchId;
        const profileEntityId =
          (op.profile?.kind === "entity"
            ? op.profile.entityId
            : op.profile
              ? undefined
              : undefined) ?? op.profileEntityId;
        const pathEntityIds = op.path
          ? op.path.kind === "entity"
            ? [op.path.entityId]
            : op.path.segments.map((segment) => segment.entityId)
          : (op.pathEntityIds ?? []);

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create sweep feature ${featureId ?? "with generated ID"} from profile ${profileSketchId}/${profileEntityId} along ${pathEntityIds.length} path segment${pathEntityIds.length === 1 ? "" : "s"}${bodyId ? ` -> body ${bodyId}` : ""}`,
          sketchId: profileSketchId,
          sketchEntityId: profileEntityId,
          featureId,
          bodyId
        });
      }

      case "feature.loft": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create loft feature ${featureId ?? "with generated ID"} through ${op.sections.length} sections${bodyId ? ` -> body ${bodyId}` : ""}`,
          featureId,
          bodyId
        });
      }

      case "feature.chamfer": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const edgeLabel = op.namedReference
          ? `named reference ${op.namedReference}`
          : op.topologyAnchorId
            ? `topology anchor ${op.topologyAnchorId}`
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
          referenceName: op.namedReference,
          topologyAnchorId: op.topologyAnchorId
        });
      }

      case "feature.fillet": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const edgeLabel = op.namedReference
          ? `named reference ${op.namedReference}`
          : op.topologyAnchorId
            ? `topology anchor ${op.topologyAnchorId}`
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
          referenceName: op.namedReference,
          topologyAnchorId: op.topologyAnchorId
        });
      }

      case "feature.linearPattern": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create linear pattern feature ${featureId ?? "with generated ID"} from ${op.seedFeatureId ? `feature ${op.seedFeatureId}` : `body ${op.seedBodyId}`}${bodyId ? ` -> body ${bodyId}` : ""}`,
          featureId,
          bodyId
        });
      }

      case "feature.circularPattern": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create circular pattern feature ${featureId ?? "with generated ID"} from ${op.seedFeatureId ? `feature ${op.seedFeatureId}` : `body ${op.seedBodyId}`}${bodyId ? ` -> body ${bodyId}` : ""}`,
          featureId,
          bodyId
        });
      }

      case "feature.mirror": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create mirror feature ${featureId ?? "with generated ID"} from body ${op.seedBodyId} across ${op.mirrorPlane}${op.includeOriginal ? " (union with original)" : ""}${bodyId ? ` -> body ${bodyId}` : ""}`,
          featureId,
          bodyId
        });
      }

      case "feature.combine": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create combine feature ${featureId ?? "with generated ID"} ${op.mode} of ${op.targetBodyId} and ${op.toolBodyId}${bodyId ? ` -> body ${bodyId}` : ""}`,
          featureId,
          bodyId,
          targetBodyId: op.targetBodyId
        });
      }

      case "feature.offset": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const sourceLabel =
          op.source.kind === "sketchProfile"
            ? `sketch profile ${op.source.profile.entityId}`
            : "face";

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create offset feature ${featureId ?? "with generated ID"} of ${sourceLabel} distance ${op.distance} ${op.side}${bodyId ? ` -> body ${bodyId}` : ""}`,
          featureId,
          bodyId
        });
      }

      case "feature.align": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const targetLabel =
          op.target.kind === "planarFace"
            ? "planar face"
            : op.target.kind === "datumPlane"
              ? `datum plane ${op.target.datumId}`
              : `datum axis ${op.target.datumId}`;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create align feature ${featureId ?? "with generated ID"} of body ${op.seedBodyId} onto ${targetLabel}${bodyId ? ` -> body ${bodyId}` : ""}`,
          featureId,
          bodyId
        });
      }

      case "feature.draft": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const faceCount = op.faces.length;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create draft feature ${featureId ?? "with generated ID"} on ${faceCount} face${faceCount === 1 ? "" : "s"} of body ${op.targetBodyId} at ${op.angleDegrees}°${bodyId ? ` -> body ${bodyId}` : ""}`,
          featureId,
          bodyId,
          targetBodyId: op.targetBodyId
        });
      }

      case "feature.shell": {
        const featureId = op.id ?? createdFeatureRef?.id;
        const bodyId = op.bodyId ?? createdFeatureRef?.bodyId;
        const openFaceCount = op.openFaceRefs?.length ?? 0;

        return createFeatureOperationSummary({
          op: op.op,
          label: `Create shell feature ${featureId ?? "with generated ID"} from body ${op.targetBodyId} thickness ${op.wallThickness}${openFaceCount > 0 ? ` with ${openFaceCount} open face${openFaceCount === 1 ? "" : "s"}` : " as closed shell"}${bodyId ? ` -> body ${bodyId}` : ""}`,
          featureId,
          bodyId,
          targetBodyId: op.targetBodyId
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
          label: `Update revolve feature ${op.id}${
            op.angleDegrees === undefined
              ? " profile"
              : ` angle to ${op.angleDegrees}`
          }`,
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

      case "feature.updateSweep": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update sweep feature ${op.id}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId
        });
      }

      case "feature.updateLoft": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update loft feature ${op.id}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId
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

      case "feature.updateLinearPattern": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update linear pattern feature ${op.id}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId
        });
      }

      case "feature.updateCircularPattern": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update circular pattern feature ${op.id}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId
        });
      }

      case "feature.updateMirror": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update mirror feature ${op.id}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId
        });
      }

      case "feature.updateShell": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update shell feature ${op.id}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId,
          targetBodyId:
            modifiedFeatureRef?.kind === "shell"
              ? modifiedFeatureRef.targetBodyId
              : undefined
        });
      }

      case "feature.updateOffset": {
        const modifiedFeatureRef = transaction.diff.features?.modified?.find(
          (feature) => feature.id === op.id
        );

        return createFeatureOperationSummary({
          op: op.op,
          label: `Update offset feature ${op.id}`,
          featureId: op.id,
          bodyId: modifiedFeatureRef?.bodyId,
          targetBodyId:
            modifiedFeatureRef?.kind === "offset"
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
          bodyId: repairedNamedReferenceRef?.after.bodyId ?? op.bodyId,
          stableId: repairedNamedReferenceRef?.after.stableId ?? op.stableId,
          generatedReferenceKind: repairedNamedReferenceRef?.after.kind,
          ...((repairedNamedReferenceRef?.after.topologyAnchorId ??
          op.topologyAnchorId)
            ? {
                topologyAnchorId:
                  repairedNamedReferenceRef?.after.topologyAnchorId ??
                  op.topologyAnchorId
              }
            : {})
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

  if (
    feature.kind === "chamfer" ||
    feature.kind === "fillet" ||
    feature.kind === "importedBody" ||
    feature.kind === "linearPattern" ||
    feature.kind === "circularPattern" ||
    feature.kind === "mirror" ||
    feature.kind === "combine" ||
    feature.kind === "offset" ||
    feature.kind === "align" ||
    feature.kind === "draft" ||
    feature.kind === "shell" ||
    feature.kind === "sweep" ||
    feature.kind === "loft"
  ) {
    return undefined;
  }

  return feature.entityId;
}

function getFeatureRefSketchId(feature: CadFeatureRef): SketchId | undefined {
  if (
    feature.kind === "chamfer" ||
    feature.kind === "fillet" ||
    feature.kind === "importedBody" ||
    feature.kind === "linearPattern" ||
    feature.kind === "circularPattern" ||
    feature.kind === "mirror" ||
    feature.kind === "combine" ||
    feature.kind === "offset" ||
    feature.kind === "align" ||
    feature.kind === "draft" ||
    feature.kind === "shell" ||
    feature.kind === "sweep" ||
    feature.kind === "loft"
  ) {
    return undefined;
  }

  return feature.sketchId;
}

function formatUnitUpdateModeLabel(
  mode: DocumentUnitUpdateMode | undefined
): string {
  return mode === "preservePhysicalSize" ? "convert size" : "relabel values";
}

function formatCurveEditOperation(
  op:
    | "sketch.trim"
    | "sketch.extend"
    | "sketch.split"
    | "sketch.explodeRectangle"
    | "sketch.offset"
): string {
  switch (op) {
    case "sketch.trim":
      return "Trim curve";
    case "sketch.extend":
      return "Extend curve";
    case "sketch.split":
      return "Split curve";
    case "sketch.explodeRectangle":
      return "Explode rectangle";
    case "sketch.offset":
      return "Offset sketch geometry";
  }
}

function getPrimaryDimensionTargetEntityId(
  target:
    | Extract<CadOp, { readonly op: "sketch.dimension.create" }>["target"]
    | undefined
): SketchEntityId | undefined {
  if (!target || !("kind" in target)) {
    return undefined;
  }
  const normalized = target as SketchDimensionTargetV22;
  switch (normalized.kind) {
    case "entityScalar":
      return normalized.entityId;
    case "pointPair":
      return normalized.primary.entityId;
    case "pointLineDistance":
      return normalized.point.entityId;
    case "lineAngle":
      return normalized.primaryLineEntityId;
  }
}

function formatProfileRefLabel(profile: SketchProfileRefV22): string {
  if (profile.kind === "entity") {
    return `${profile.sketchId}/${profile.entityId}`;
  }
  if (profile.kind === "wire") {
    return `${profile.sketchId}/wire(${profile.segments
      .map((segment) => segment.entityId)
      .join(",")})`;
  }
  return `${profile.sketchId}/regions(${profile.regions.length})`;
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
    ...(summary.datumId ? { datumId: summary.datumId } : {}),
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
    ...(summary.targetTopologyAnchorId
      ? { targetTopologyAnchorId: summary.targetTopologyAnchorId }
      : {}),
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
    | "sketch.addArc"
    | "sketch.addSpline"
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
    case "sketch.addArc":
      return "arc";
    case "sketch.addSpline":
      return "spline";
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
    ...(diff.datums
      ? {
          datums: {
            ...(diff.datums.created
              ? { created: [...diff.datums.created] }
              : {}),
            ...(diff.datums.modified
              ? { modified: [...diff.datums.modified] }
              : {}),
            ...(diff.datums.deleted
              ? { deleted: [...diff.datums.deleted] }
              : {})
          }
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
    ...(diff.sketches?.curveEdits
      ? { curveEdits: [...diff.sketches.curveEdits] }
      : {}),
    ...(diff.sketches?.convenienceOperations
      ? { convenienceOperations: [...diff.sketches.convenienceOperations] }
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
    ...(diff.topologyCheckpointsDeleted
      ? { topologyCheckpointsDeleted: [...diff.topologyCheckpointsDeleted] }
      : {}),
    ...(diff.topologyAnchorsCreated
      ? { topologyAnchorsCreated: [...diff.topologyAnchorsCreated] }
      : {}),
    ...(diff.topologyAnchorsDeleted
      ? { topologyAnchorsDeleted: [...diff.topologyAnchorsDeleted] }
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
  readonly created?: readonly CadSketchDimensionRefCurrent[];
  readonly modified?: readonly CadSketchDimensionRefCurrent[];
  readonly deleted?: readonly CadSketchDimensionRefCurrent[];
}): {
  readonly created?: readonly CadSketchDimensionRefCurrent[];
  readonly modified?: readonly CadSketchDimensionRefCurrent[];
  readonly deleted?: readonly CadSketchDimensionRefCurrent[];
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
      : {}),
    ...(diff.entityChanges ? { entityChanges: [...diff.entityChanges] } : {}),
    ...(diff.curveEdits ? { curveEdits: [...diff.curveEdits] } : {}),
    ...(diff.convenienceOperations
      ? { convenienceOperations: [...diff.convenienceOperations] }
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
      : {}),
    ...(diff.inputReferences
      ? { inputReferences: [...diff.inputReferences] }
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
      | "sketch.addCircle"
      | "sketch.addArc"
      | "sketch.addSpline";
  }
> {
  return (
    op.op === "sketch.addPoint" ||
    op.op === "sketch.addLine" ||
    op.op === "sketch.addRectangle" ||
    op.op === "sketch.addCircle" ||
    op.op === "sketch.addArc" ||
    op.op === "sketch.addSpline"
  );
}
