import {
  AsyncCadCommandExecutor,
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  readCadProjectWcad,
  WcadPackageImportError,
  type CadBodySnapshot,
  type CadBodyTopologySnapshot,
  type CadDocument,
  type CadFeatureSummary,
  type CadPartSnapshot,
  type CadTransactionHistoryEntry,
  type WcadPackageExportResult,
  type BodyMeasurementsSnapshot,
  type ObjectMeasurementsSnapshot
} from "@web-cad/cad-core";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadBatchResponse,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadSelectionReferenceOperation,
  CadSelectionReferenceInput,
  CadParameterSnapshot,
  CadTopologyIdentitySourceSnapshot,
  GeneratedReferenceMeasurement,
  NamedGeneratedReferenceEntry,
  CadOp,
  DocumentUnitUpdateMode,
  FeatureExtrudeSide,
  FeatureEditabilityQueryResponse,
  FeatureHoleDepthMode,
  FeatureHoleDirection,
  ProjectExactExportQueryResponse,
  ProjectExportReadinessQueryResponse,
  ProjectHealthQueryResponse,
  ProjectTopologyIdentityReadinessQueryResponse,
  ReferenceHealthQueryResponse,
  SelectionReferenceCandidatesQueryResponse,
  TopologyCommandTargetReadinessQueryResponse,
  SketchDimensionEntry,
  SketchDimensionTarget,
  SketchConstraintEntry,
  SketchEvaluationQueryResponse,
  SketchSolverStatusQueryResponse,
  WcadPackageValidationIssue,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createGeometryKernelBrowserWorker } from "@web-cad/geometry-worker/browser";
import { createDerivedGeometryRuntime } from "@web-cad/derived-geometry-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildBatch,
  buildAddSketchCircleOp,
  buildAddSketchLineOp,
  buildAddSketchPointOp,
  buildAddSketchRectangleOp,
  buildCreateSketchOp,
  buildCreateConeOp,
  buildCreateParameterOp,
  buildCreateSketchConstraintOp,
  buildCreateSphereOp,
  buildCreateSketchDimensionOp,
  buildCreateTorusOp,
  buildDeleteSketchConstraintOp,
  buildDeleteParameterOp,
  buildDeleteSketchDimensionOp,
  buildDeleteNamedReferenceOp,
  buildDeleteObjectOp,
  buildDeleteSketchEntityOp,
  buildDeleteSketchOp,
  buildFeatureDeleteOp,
  buildFeatureChamferOp,
  buildFeatureExtrudeOp,
  buildFeatureFilletOp,
  buildFeatureHoleOp,
  buildFeatureRevolveOp,
  buildFeatureUpdateChamferOp,
  buildFeatureUpdateExtrudeOp,
  buildFeatureUpdateFilletOp,
  buildFeatureUpdateHoleOp,
  buildFeatureUpdateRevolveOp,
  buildNameGeneratedReferenceOp,
  buildParameterEditOps,
  buildRepairNamedReferenceOp,
  buildRepairNamedReferenceToTopologyAnchorOp,
  buildRenameObjectOp,
  buildRenameSketchOp,
  buildSketchConstraintEditOps,
  buildSketchDimensionEditOps,
  buildUpdateBoxDimensionsOp,
  buildUpdateConeDimensionsOp,
  buildUpdateCylinderDimensionsOp,
  buildUpdateSketchEntityOp,
  buildUpdateSphereDimensionsOp,
  buildUpdateTorusDimensionsOp,
  buildUpdateUnitsOp,
  buildUpdateTransformOp,
  WEB_UI_ACTOR,
  type DimensionCommandForm,
  type FeatureEdgeFinishForm,
  type FeatureExtrudeForm,
  type FeatureHoleForm,
  type FeatureRevolveForm,
  type ParameterCreateForm,
  type ParameterEditForm,
  type SketchConstraintForm,
  type PrimitiveCommandForm,
  type SketchDimensionForm,
  type SketchCreateOnFaceForm,
  type SketchCreateForm,
  type SketchEntityForm,
  type TransformCommandForm
} from "./cadCommands";
import type { EdgeFinishOperation } from "./edgeFinishUi";
import { BrowserCadCommandWorker } from "./browserCadCommandWorker";
import { HistoryPanel } from "./components/HistoryPanel";
import { Inspector } from "./components/Inspector";
import { ModelingActionsPanel } from "./components/ModelingActionsPanel";
import { ProjectJsonPanel } from "./components/ProjectJsonPanel";
import { SketchPanel } from "./components/SketchPanel";
import { SketchViewportDragOverlay } from "./components/SketchViewportDragOverlay";
import { StructurePanel } from "./components/StructurePanel";
import type { StructureSelectionOptions } from "./components/StructurePanel";
import { ViewportContextualCommandSurface } from "./components/ViewportContextualCommandSurface";
import {
  ViewportCanvas,
  type ViewportCanvasPick
} from "./components/ViewportCanvas";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createEmptyDerivedGeometrySnapshot,
  DerivedGeometryService,
  getDerivedGeometryStatusLabel,
  type DerivedGeometrySource,
  type DerivedGeometrySnapshot
} from "./derivedGeometry";
import {
  createDerivedMeshOpfsCache,
  DERIVED_MESH_CACHE_ARTIFACT_VERSION,
  type DerivedMeshCacheContext
} from "./derivedMeshOpfsCache";
import {
  createVisualizationMeshExportArtifact,
  createVisualizationMeshExportStatus
} from "./visualizationMeshExport";
import { executeProjectExactStepExport } from "./projectExactStepExport";
import {
  createBodyTopologyDerivedExactMetadataSnapshot,
  createEmptyDerivedExactMetadataSnapshot,
  createProjectQueryDerivedExactMetadataSnapshots,
  DerivedExactMetadataService,
  formatDerivedExactMetadataEntryStatus,
  getDerivedExactMetadataEntryForBody,
  type DerivedExactMetadataSnapshot
} from "./derivedExactMetadata";
import {
  createAuthoredFeatureDerivedGeometrySources,
  createDerivedGeometrySourcesFromDocument
} from "./derivedGeometrySources";
import { preflightHoleGeometryCommand } from "./holeGeometryPreflight";
import {
  formatBodyMeasurementError,
  formatBodyTopologyError
} from "./sceneObjectDisplay";
import { createQuickStartSourceBodyPlan } from "./quickStartBodies";
import { createRenderSceneInputs } from "./renderScene";
import {
  createGeneratedFaceReferenceKey,
  createSketchDisplayState
} from "./sketchDisplayFrames";
import {
  formatGeneratedReferenceMeasurementError,
  formatGeneratedReferencesError,
  getGeneratedReferenceItems,
  type GeneratedReferenceMeasurementDisplay
} from "./generatedReferenceUi";
import {
  createSelectedGeneratedReference,
  enrichSelectedGeneratedReferenceWithTopologyAnchor,
  getGeneratedReferenceSelectionState,
  reconcileSelectedGeneratedReferenceBody,
  type GeneratedReferenceSelectionState,
  type SelectedGeneratedReference
} from "./generatedReferenceSelection";
import {
  createViewportContextualCommandSurface,
  runViewportContextualCommandAction,
  type ViewportContextualCommandAction
} from "./viewportContextualCommands";
import {
  chooseViewportGeneratedReferencePickBodyId,
  resolveViewportPickIntent,
  resolveViewportPickedBodyId,
  type ViewportPickIntent
} from "./viewportPickIntent";
import { createViewportGeneratedPlanarFaceHitCandidate } from "./viewportGeneratedFacePicking";
import { createViewportGeneratedEdgeHitCandidate } from "./viewportGeneratedEdgePicking";
import { resolveViewportHoverIntent } from "./viewportHoverIntent";
import { createViewportSelectionDisplay } from "./viewportSelectionDisplay";
import { createViewportVisualStateModel } from "./viewportVisualState";
import { createViewportMeasurementOverlay } from "./viewportMeasurementOverlay";
import { shouldCancelViewportTransientState } from "./viewportKeyboard";
import {
  clearViewportTwoTargetMeasurementSecondTargetOnSelectionChange,
  createViewportTwoTargetMeasurementTarget,
  createViewportTwoTargetMeasurementView,
  isViewportTwoTargetMeasurementSessionActive,
  updateViewportTwoTargetMeasurementSession,
  type ViewportTwoTargetMeasurementSession,
  type ViewportTwoTargetMeasurementTarget
} from "./viewportTwoTargetMeasurement";
import { createViewportReferenceActions } from "./viewportReferenceActions";
import { createViewportInteractionSurface } from "./viewportInteractionSurface";
import {
  deriveModelingActions,
  type ModelingSelectionContext
} from "./modelingActions";
import {
  createProjectJsonDraftSourceForEditorValue,
  createProjectJsonPreview,
  createProjectJsonWorkflowState,
  formatProjectJsonSummary,
  type ProjectJsonDraftSource
} from "./projectJson";
import { createProjectStorageCapabilityStatus } from "./projectStorageCapabilities";
import {
  createInitialProjectFileWorkflowState,
  createJsonFallbackProjectFileState,
  createProjectFileCancelledState,
  createProjectFileFailureState,
  createProjectFileStateFromExport,
  createProjectFileStateFromRead,
  DEFAULT_WCAD_PROJECT_FILE_NAME,
  ensureWcadFileExtension,
  getProjectFileDirtyLabel,
  getProjectFileNameLabel,
  isFilePickerAbort,
  pickWcadOpenFile,
  pickWcadSaveFile,
  readBytesFromWcadFile,
  WCAD_MIME_TYPE,
  writeBytesToWcadHandle,
  markProjectFileDirty,
  type ProjectFileWorkflowState,
  type WcadFileHandleLike,
  type WcadFilePickerTargetLike
} from "./projectWcadWorkflow";
import {
  createProjectTopologyAnchorCreationPlanForGeneratedReference,
  createProjectTopologyAnchorRepairPlanForGeneratedReference,
  exportProjectWcadWithTopologyCheckpoints,
  isProjectWcadTopologyCheckpointPayloadError
} from "./projectWcadTopologyCheckpoints";
import { createSketchOnFaceCommandPlan } from "./sketchOnFacePromotion";
import {
  createTopologyRepairCandidatePreview,
  createTopologyRepairPreviewKey,
  type TopologyRepairCandidatePreviewState
} from "./topologyRepairCandidatesUi";
import {
  clearProjectOpfsCache as clearProjectOpfsCacheStorage,
  createInitialProjectOpfsCacheStatus,
  readProjectOpfsCacheStatus,
  type ProjectOpfsCacheTargetLike
} from "./projectOpfsCache";
import {
  createAddTargetBodyOptions,
  createCutTargetBodyOptions,
  createHoleTargetBodyOptions,
  createSketchEntitySelectionId,
  createSketchSelectionId,
  type SketchPanelSelectionContext
} from "./sketchPanelUi";
import {
  createNamedReferenceHealthByName,
  formatNamedReferenceRepairBatchError,
  formatNamedReferenceRepairBatchMessage
} from "./namedReferenceRepairUi";
import "./styles.css";

const engine = new CadEngine();
const commandExecutor = new AsyncCadCommandExecutor(
  engine,
  new BrowserCadCommandWorker()
);
const derivedGeometryEnabled = __PARTBENCH_DERIVED_GEOMETRY_ENABLED__;
const supportedOpfsCacheArtifactVersions = [
  DERIVED_MESH_CACHE_ARTIFACT_VERSION
] as const;

const quickBoxForm: PrimitiveCommandForm = {
  id: "",
  width: 2.4,
  height: 1.8,
  depth: 1.6,
  radius: 0.9,
  majorRadius: 1.4,
  minorRadius: 0.35,
  translationX: 0,
  translationY: 0,
  translationZ: 0.8
};

const quickCylinderForm: PrimitiveCommandForm = {
  id: "",
  width: 2,
  height: 2.2,
  depth: 2,
  radius: 0.9,
  majorRadius: 1.4,
  minorRadius: 0.35,
  translationX: 0,
  translationY: 0,
  translationZ: 1.1
};

const quickSphereForm: PrimitiveCommandForm = {
  id: "",
  width: 2,
  height: 2,
  depth: 2,
  radius: 1,
  majorRadius: 1.4,
  minorRadius: 0.35,
  translationX: 0,
  translationY: 0,
  translationZ: 1
};

const quickConeForm: PrimitiveCommandForm = {
  id: "",
  width: 2,
  height: 2.4,
  depth: 2,
  radius: 1,
  majorRadius: 1.4,
  minorRadius: 0.35,
  translationX: 0,
  translationY: 0,
  translationZ: 1.2
};

const quickTorusForm: PrimitiveCommandForm = {
  id: "",
  width: 2,
  height: 2,
  depth: 2,
  radius: 1,
  majorRadius: 1.4,
  minorRadius: 0.35,
  translationX: 0,
  translationY: 0,
  translationZ: 0
};

type UtilityPanelId = "sketches" | "history";

type ModelBrowserPanelId = "tree" | "selection";

function readTransactionHistory(): readonly CadTransactionHistoryEntry[] {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "transaction.history" }
  });

  return response.ok && response.query === "transaction.history"
    ? response.transactions
    : [];
}

function readProjectStructure(): {
  readonly parts: readonly CadPartSnapshot[];
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
} {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  return response.ok && response.query === "project.structure"
    ? {
        parts: response.parts,
        features: response.features,
        bodies: response.bodies
      }
    : { parts: [], features: [], bodies: [] };
}

function readProjectHealth(
  exactMetadata: DerivedExactMetadataSnapshot
): ProjectHealthQueryResponse {
  const derivedExactMetadata =
    createDerivedExactMetadataSnapshotsForProjectQuery(exactMetadata);
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "project.health",
      ...(derivedExactMetadata.length > 0 ? { derivedExactMetadata } : {})
    }
  });

  return response.ok && response.query === "project.health"
    ? response
    : {
        ok: true,
        query: "project.health",
        cadOpsVersion: "cadops.v1",
        status: "healthy",
        issueCount: 0,
        authoredExtrudeCount: 0,
        authoredRevolveCount: 0,
        authoredHoleCount: 0,
        authoredChamferCount: 0,
        authoredFilletCount: 0,
        attachedSketchCount: 0,
        sketchEvaluationCount: 0,
        sketchDimensionCount: 0,
        sketchConstraintCount: 0,
        namedReferenceCount: 0,
        authoredExtrudes: [],
        authoredRevolves: [],
        authoredHoles: [],
        authoredChamfers: [],
        authoredFillets: [],
        attachedSketches: [],
        sketchEvaluations: [],
        sketchDimensions: [],
        sketchConstraints: [],
        namedReferences: []
      };
}

function readProjectExportReadiness():
  | ProjectExportReadinessQueryResponse
  | undefined {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.exportReadiness" }
  });

  return response.ok && response.query === "project.exportReadiness"
    ? response
    : undefined;
}

function readProjectTopologyIdentityReadiness():
  | ProjectTopologyIdentityReadinessQueryResponse
  | undefined {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.topologyIdentityReadiness" }
  });

  return response.ok && response.query === "project.topologyIdentityReadiness"
    ? response
    : undefined;
}

function readProjectExactStepExport():
  | ProjectExactExportQueryResponse
  | undefined {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.exportExact", format: "step" }
  });

  return response.ok && response.query === "project.exportExact"
    ? response
    : undefined;
}

function readFeatureEditability(
  featureId: string | undefined
): FeatureEditabilityQueryResponse | undefined {
  if (!featureId) {
    return undefined;
  }

  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "feature.editability",
      featureId
    }
  });

  return response.ok && response.query === "feature.editability"
    ? response
    : undefined;
}

function createDerivedExactMetadataSnapshotsForProjectQuery(
  exactMetadata: DerivedExactMetadataSnapshot
) {
  if (exactMetadata.entries.length === 0) {
    return [];
  }

  const sourceIdentitySignaturesByBodyId = new Map<string, string>();

  for (const entry of exactMetadata.entries) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: entry.bodyId }
    });

    if (response.ok && response.query === "body.topology") {
      sourceIdentitySignaturesByBodyId.set(
        entry.bodyId,
        response.topology.sourceIdentity.signature
      );
    }
  }

  return createProjectQueryDerivedExactMetadataSnapshots(
    exactMetadata,
    sourceIdentitySignaturesByBodyId
  );
}

function exportCadProjectForDocument(
  engine: CadEngine,
  documentSnapshot: CadDocument
) {
  // CadEngine is stable and mutates internally; documentSnapshot invalidates
  // React memoization after command application.
  void documentSnapshot;

  return exportCadProject(engine);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  return copy.buffer;
}

function readBodyGeneratedReferences(bodyId: string | undefined): {
  readonly references?: BodyGeneratedReferencesQueryResponse;
  readonly error?: string;
} {
  if (!bodyId) {
    return {};
  }

  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.generatedReferences", bodyId }
  });

  if (response.ok && response.query === "body.generatedReferences") {
    return { references: response };
  }

  return !response.ok && response.query === "body.generatedReferences"
    ? { error: formatGeneratedReferencesError(response.error) }
    : {};
}

function readGeneratedReferenceMeasurements(
  references: BodyGeneratedReferencesQueryResponse | undefined
): ReadonlyMap<string, GeneratedReferenceMeasurementDisplay> | undefined {
  if (!references) {
    return undefined;
  }

  const measurements = new Map<
    string,
    {
      readonly measurement?: GeneratedReferenceMeasurement;
      readonly error?: string;
    }
  >();
  const referenceItems = [
    references.body,
    ...references.faces,
    ...references.edges,
    ...references.vertices
  ];

  for (const reference of referenceItems) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.generatedReferenceMeasurements",
        bodyId: reference.bodyId,
        stableId: reference.stableId
      }
    });

    if (
      response.ok &&
      response.query === "body.generatedReferenceMeasurements"
    ) {
      measurements.set(reference.stableId, {
        measurement: response.measurements
      });
    } else if (
      !response.ok &&
      response.query === "body.generatedReferenceMeasurements"
    ) {
      measurements.set(reference.stableId, {
        error: formatGeneratedReferenceMeasurementError(response.error)
      });
    }
  }

  return measurements;
}

function readNamedReferences(): readonly NamedGeneratedReferenceEntry[] {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "reference.listNamed" }
  });

  return response.ok && response.query === "reference.listNamed"
    ? response.references
    : [];
}

function readReferenceHealth(): ReferenceHealthQueryResponse | undefined {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "reference.health", target: { type: "all" } }
  });

  return response.ok && response.query === "reference.health"
    ? response
    : undefined;
}

function readSelectionReferenceCandidates(
  selection: CadSelectionReferenceInput | undefined
): SelectionReferenceCandidatesQueryResponse | undefined {
  if (!selection) {
    return undefined;
  }

  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "selection.referenceCandidates",
      selection
    }
  });

  return response.ok && response.query === "selection.referenceCandidates"
    ? response
    : undefined;
}

function readTopologyCommandTargetReadiness(
  target: CadSelectionReferenceInput | undefined,
  desiredOperation?: CadSelectionReferenceOperation
): TopologyCommandTargetReadinessQueryResponse | undefined {
  if (!target) {
    return undefined;
  }

  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "topology.commandTargetReadiness",
      target,
      ...(desiredOperation ? { desiredOperation } : {})
    }
  });

  return response.ok && response.query === "topology.commandTargetReadiness"
    ? response
    : undefined;
}

function readTopologyAnchorCommandTargetReadinessByAnchorId(
  anchors: CadTopologyIdentitySourceSnapshot["anchors"] | undefined,
  desiredOperation: CadSelectionReferenceOperation
): ReadonlyMap<string, TopologyCommandTargetReadinessQueryResponse> {
  const readinessByAnchorId = new Map<
    string,
    TopologyCommandTargetReadinessQueryResponse
  >();

  if (!anchors) {
    return readinessByAnchorId;
  }

  for (const anchor of anchors) {
    if (anchor.entityKind !== "body") {
      continue;
    }

    const response = readTopologyCommandTargetReadiness(
      { type: "topologyAnchor", anchorId: anchor.anchorId },
      desiredOperation
    );

    if (response) {
      readinessByAnchorId.set(anchor.anchorId, response);
    }
  }

  return readinessByAnchorId;
}

function readSelectionReferenceCandidatesByStableId(
  references: BodyGeneratedReferencesQueryResponse | undefined
): ReadonlyMap<string, SelectionReferenceCandidatesQueryResponse> {
  const candidatesByStableId = new Map<
    string,
    SelectionReferenceCandidatesQueryResponse
  >();

  if (!references) {
    return candidatesByStableId;
  }

  for (const reference of getGeneratedReferenceItems(references)) {
    const response = readSelectionReferenceCandidates({
      type: "generatedReference",
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      expectedKind: reference.kind
    });

    if (response) {
      candidatesByStableId.set(reference.stableId, response);
    }
  }

  return candidatesByStableId;
}

function readNamedReferenceCandidatesByName(
  references: readonly NamedGeneratedReferenceEntry[]
): ReadonlyMap<string, SelectionReferenceCandidatesQueryResponse> {
  const candidatesByName = new Map<
    string,
    SelectionReferenceCandidatesQueryResponse
  >();

  for (const reference of references) {
    const response = readSelectionReferenceCandidates({
      type: "namedReference",
      name: reference.name
    });

    if (response) {
      candidatesByName.set(reference.name, response);
    }
  }

  return candidatesByName;
}

function readParameters(): readonly CadParameterSnapshot[] {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "parameter.list" }
  });

  return response.ok && response.query === "parameter.list"
    ? response.parameters
    : [];
}

function enrichSketchOnFaceFormWithTopologyAnchor(
  form: SketchCreateOnFaceForm,
  topologyIdentity: CadTopologyIdentitySourceSnapshot | undefined
): SketchCreateOnFaceForm {
  const topologyAnchorId = form.topologyAnchorId?.trim();

  if (topologyAnchorId) {
    const suppliedAnchor = topologyIdentity?.anchors.find(
      (candidate) => candidate.anchorId === topologyAnchorId
    );

    if (
      suppliedAnchor &&
      isActiveTopologyAnchorFaceForSketchOnFace(suppliedAnchor, form)
    ) {
      return form;
    }

    form = stripSketchOnFaceTopologyAnchor(form);
  }

  const anchor = topologyIdentity?.anchors.find((candidate) =>
    isActiveTopologyAnchorFaceForSketchOnFace(candidate, form)
  );

  return anchor ? { ...form, topologyAnchorId: anchor.anchorId } : form;
}

function isActiveTopologyAnchorFaceForSketchOnFace(
  anchor: CadTopologyIdentitySourceSnapshot["anchors"][number],
  form: SketchCreateOnFaceForm
): boolean {
  return (
    anchor.state === "active" &&
    anchor.entityKind === "face" &&
    anchor.bodyId === form.bodyId &&
    anchor.stableId === form.faceStableId
  );
}

function stripSketchOnFaceTopologyAnchor(
  form: SketchCreateOnFaceForm
): SketchCreateOnFaceForm {
  return {
    id: form.id,
    name: form.name,
    bodyId: form.bodyId,
    faceStableId: form.faceStableId
  };
}

function readSketchDimensionsBySketchId(
  sketches: readonly { readonly id: string }[]
): ReadonlyMap<string, readonly SketchDimensionEntry[]> {
  const dimensionsBySketchId = new Map<
    string,
    readonly SketchDimensionEntry[]
  >();

  for (const sketch of sketches) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.dimensions", sketchId: sketch.id }
    });

    dimensionsBySketchId.set(
      sketch.id,
      response.ok && response.query === "sketch.dimensions"
        ? response.dimensions
        : []
    );
  }

  return dimensionsBySketchId;
}

function readSketchEvaluationsBySketchId(
  sketches: readonly { readonly id: string }[]
): ReadonlyMap<string, SketchEvaluationQueryResponse> {
  const evaluationsBySketchId = new Map<
    string,
    SketchEvaluationQueryResponse
  >();

  for (const sketch of sketches) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.evaluation", sketchId: sketch.id }
    });

    if (response.ok && response.query === "sketch.evaluation") {
      evaluationsBySketchId.set(sketch.id, response);
    }
  }

  return evaluationsBySketchId;
}

function readSketchSolverStatusesBySketchId(
  sketches: readonly { readonly id: string }[]
): ReadonlyMap<string, SketchSolverStatusQueryResponse> {
  const statusesBySketchId = new Map<string, SketchSolverStatusQueryResponse>();

  for (const sketch of sketches) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.solverStatus", sketchId: sketch.id }
    });

    if (response.ok && response.query === "sketch.solverStatus") {
      statusesBySketchId.set(sketch.id, response);
    }
  }

  return statusesBySketchId;
}

function readBodyMeasurements(bodyId: string | undefined): {
  readonly measurements?: BodyMeasurementsSnapshot;
  readonly error?: string;
} {
  if (!bodyId) {
    return {};
  }

  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.measurements", bodyId }
  });

  if (response.ok && response.query === "body.measurements") {
    return { measurements: response.measurements };
  }

  return !response.ok && response.query === "body.measurements"
    ? { error: formatBodyMeasurementError(response.error) }
    : {};
}

function readBodyTopology(
  bodyId: string | undefined,
  exactMetadata: DerivedExactMetadataSnapshot
): {
  readonly topology?: CadBodyTopologySnapshot;
  readonly error?: string;
  readonly exactMetadataStatus?: string;
} {
  if (!bodyId) {
    return {};
  }

  const exactMetadataEntry = getDerivedExactMetadataEntryForBody(
    exactMetadata,
    bodyId
  );
  const exactMetadataStatus =
    formatDerivedExactMetadataEntryStatus(exactMetadataEntry);
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId }
  });

  if (response.ok && response.query === "body.topology") {
    const derivedExactMetadata = createBodyTopologyDerivedExactMetadataSnapshot(
      exactMetadataEntry,
      response.topology.sourceIdentity.signature
    );

    if (!derivedExactMetadata) {
      return { topology: response.topology, exactMetadataStatus };
    }

    const enrichedResponse = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.topology",
        bodyId,
        derivedExactMetadata
      }
    });

    if (enrichedResponse.ok && enrichedResponse.query === "body.topology") {
      return {
        topology: enrichedResponse.topology,
        exactMetadataStatus
      };
    }

    return { topology: response.topology, exactMetadataStatus };
  }

  return !response.ok && response.query === "body.topology"
    ? { error: formatBodyTopologyError(response.error), exactMetadataStatus }
    : {};
}

function readGeneratedFaceReferencesByKey(
  bodies: readonly CadBodySnapshot[]
): ReadonlyMap<string, CadGeneratedFaceReference> {
  const facesByKey = new Map<string, CadGeneratedFaceReference>();

  for (const body of bodies) {
    const response = readBodyGeneratedReferences(body.id);

    for (const face of response.references?.faces ?? []) {
      facesByKey.set(
        createGeneratedFaceReferenceKey(face.bodyId, face.stableId),
        face
      );
    }
  }

  return facesByKey;
}

function readGeneratedEdgeReferencesByKey(
  bodies: readonly CadBodySnapshot[]
): ReadonlyMap<string, CadGeneratedEdgeReference> {
  const edgesByKey = new Map<string, CadGeneratedEdgeReference>();

  for (const body of bodies) {
    const response = readBodyGeneratedReferences(body.id);

    for (const edge of response.references?.edges ?? []) {
      edgesByKey.set(`${edge.bodyId}\n${edge.stableId}`, edge);
    }
  }

  return edgesByKey;
}

function createModelingSelectionContext({
  focusedSketchId,
  namedReferences,
  referenceCandidatesByStableId,
  selectedBody,
  selectedBodyGeneratedReferences,
  selectedBodyReferenceCandidates,
  selectedFeature,
  selectedGeneratedReferenceCandidates,
  selectedGeneratedReferenceState,
  selectedId,
  selectedSketchContext,
  sketchDimensionsBySketchId,
  sketchEvaluationsBySketchId,
  sketchSolverStatusesBySketchId,
  sketches
}: {
  readonly focusedSketchId?: string;
  readonly namedReferences: readonly NamedGeneratedReferenceEntry[];
  readonly selectedBody?: CadBodySnapshot;
  readonly selectedBodyGeneratedReferences?: BodyGeneratedReferencesQueryResponse;
  readonly selectedBodyReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly selectedFeature?: CadFeatureSummary;
  readonly selectedGeneratedReferenceCandidates?: SelectionReferenceCandidatesQueryResponse;
  readonly selectedGeneratedReferenceState: GeneratedReferenceSelectionState;
  readonly selectedId?: string;
  readonly referenceCandidatesByStableId: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly selectedSketchContext?: SketchPanelSelectionContext;
  readonly sketchDimensionsBySketchId: ReadonlyMap<
    string,
    readonly SketchDimensionEntry[]
  >;
  readonly sketchEvaluationsBySketchId: ReadonlyMap<
    string,
    SketchEvaluationQueryResponse
  >;
  readonly sketchSolverStatusesBySketchId: ReadonlyMap<
    string,
    SketchSolverStatusQueryResponse
  >;
  readonly sketches: readonly SketchSnapshot[];
}): ModelingSelectionContext {
  if (selectedGeneratedReferenceState.status === "selected") {
    return {
      selectionKind: "generatedReference",
      reference: selectedGeneratedReferenceState.reference,
      topologyAnchorId:
        selectedGeneratedReferenceState.selection.topologyAnchorId,
      body: selectedBody,
      feature: selectedFeature,
      namedReferences,
      selectionReferenceCandidates: selectedGeneratedReferenceCandidates
    };
  }

  if (selectedBody) {
    return {
      selectionKind: "body",
      body: selectedBody,
      feature: selectedFeature,
      generatedReferences: selectedBodyGeneratedReferences,
      referenceCandidatesByStableId,
      selectionReferenceCandidates: selectedBodyReferenceCandidates
    };
  }

  return (
    createSketchModelingSelectionContext({
      focusedSketchId,
      selectedId,
      selectedSketchContext,
      sketchDimensionsBySketchId,
      sketchEvaluationsBySketchId,
      sketchSolverStatusesBySketchId,
      sketches
    }) ?? { selectionKind: "none" }
  );
}

function createSketchModelingSelectionContext({
  focusedSketchId,
  selectedId,
  selectedSketchContext,
  sketchDimensionsBySketchId,
  sketchEvaluationsBySketchId,
  sketchSolverStatusesBySketchId,
  sketches
}: {
  readonly focusedSketchId?: string;
  readonly selectedId?: string;
  readonly selectedSketchContext?: SketchPanelSelectionContext;
  readonly sketchDimensionsBySketchId: ReadonlyMap<
    string,
    readonly SketchDimensionEntry[]
  >;
  readonly sketchEvaluationsBySketchId: ReadonlyMap<
    string,
    SketchEvaluationQueryResponse
  >;
  readonly sketchSolverStatusesBySketchId: ReadonlyMap<
    string,
    SketchSolverStatusQueryResponse
  >;
  readonly sketches: readonly SketchSnapshot[];
}): ModelingSelectionContext | undefined {
  if (selectedSketchContext) {
    const sketch = sketches.find(
      (candidate) => candidate.id === selectedSketchContext.sketchId
    );
    const entity = sketch?.entities.find(
      (candidate) => candidate.id === selectedSketchContext.entityId
    );

    if (sketch && entity) {
      const evaluation = sketchEvaluationsBySketchId.get(sketch.id);
      const solverStatus = sketchSolverStatusesBySketchId.get(sketch.id);

      return {
        selectionKind: "sketchEntity",
        sketch,
        entity,
        dimensions:
          evaluation?.dimensions ?? sketchDimensionsBySketchId.get(sketch.id),
        constraints: evaluation?.constraints,
        solverStatus
      };
    }

    if (sketch) {
      return {
        selectionKind: "sketch",
        sketch,
        solverStatus: sketchSolverStatusesBySketchId.get(sketch.id)
      };
    }
  }

  if (selectedId) {
    for (const sketch of sketches) {
      for (const entity of sketch.entities) {
        if (
          selectedId === createSketchEntitySelectionId(sketch.id, entity.id)
        ) {
          const evaluation = sketchEvaluationsBySketchId.get(sketch.id);
          const solverStatus = sketchSolverStatusesBySketchId.get(sketch.id);

          return {
            selectionKind: "sketchEntity",
            sketch,
            entity,
            dimensions:
              evaluation?.dimensions ??
              sketchDimensionsBySketchId.get(sketch.id),
            constraints: evaluation?.constraints,
            solverStatus
          };
        }
      }

      if (selectedId === createSketchSelectionId(sketch.id)) {
        return {
          selectionKind: "sketch",
          sketch,
          solverStatus: sketchSolverStatusesBySketchId.get(sketch.id)
        };
      }
    }
  }

  const focusedSketch = focusedSketchId
    ? sketches.find((sketch) => sketch.id === focusedSketchId)
    : undefined;

  return focusedSketch
    ? {
        selectionKind: "sketch",
        sketch: focusedSketch,
        solverStatus: sketchSolverStatusesBySketchId.get(focusedSketch.id)
      }
    : undefined;
}

export function App() {
  const derivedGeometryRuntimeRef = useRef<DerivedGeometryRuntime | undefined>(
    undefined
  );
  const derivedGeometryServiceRef = useRef<DerivedGeometryService | undefined>(
    undefined
  );
  const derivedMeshCacheContextRef = useRef<
    DerivedMeshCacheContext | undefined
  >(undefined);
  const derivedMeshCacheContextKeyRef = useRef<string | undefined>(undefined);
  const derivedExactMetadataServiceRef = useRef<
    DerivedExactMetadataService | undefined
  >(undefined);
  const [document, setDocument] = useState<CadDocument>(() =>
    engine.getDocument()
  );
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedGeneratedReference, setSelectedGeneratedReference] = useState<
    SelectedGeneratedReference | undefined
  >();
  const [topologyRepairPreview, setTopologyRepairPreview] = useState<
    TopologyRepairCandidatePreviewState | undefined
  >();
  const [selectedNamedReferenceName, setSelectedNamedReferenceName] = useState<
    string | undefined
  >();
  const [viewportHoverPick, setViewportHoverPick] = useState<
    ViewportCanvasPick | undefined
  >();
  const [viewportPickIntent, setViewportPickIntent] = useState<
    ViewportPickIntent | undefined
  >();
  const [
    viewportTwoTargetMeasurementSession,
    setViewportTwoTargetMeasurementSession
  ] = useState<ViewportTwoTargetMeasurementSession>({});
  const [commandError, setCommandError] = useState<string | undefined>();
  const [commandNotice, setCommandNotice] = useState<string | undefined>();
  const [commandPending, setCommandPending] = useState(false);
  const [activeUtilityPanel, setActiveUtilityPanel] =
    useState<UtilityPanelId>("sketches");
  const [activeModelBrowserPanel, setActiveModelBrowserPanel] =
    useState<ModelBrowserPanelId>("tree");
  const [focusedSketchId, setFocusedSketchId] = useState<string | undefined>();
  const [selectedSketchContext, setSelectedSketchContext] = useState<
    SketchPanelSelectionContext | undefined
  >();
  const [preferredHoleTargetBodyId, setPreferredHoleTargetBodyId] = useState<
    string | undefined
  >();
  const [unitUpdateMode, setUnitUpdateMode] =
    useState<DocumentUnitUpdateMode>("metadataOnly");
  const [projectJson, setProjectJson] = useState("");
  const [projectJsonDraftSource, setProjectJsonDraftSource] =
    useState<ProjectJsonDraftSource>({ kind: "empty" });
  const [projectFile, setProjectFile] = useState<ProjectFileWorkflowState>(() =>
    createInitialProjectFileWorkflowState()
  );
  const [projectFileHandle, setProjectFileHandle] = useState<
    WcadFileHandleLike | undefined
  >();
  const [projectOpfsCacheStatus, setProjectOpfsCacheStatus] = useState(() =>
    createInitialProjectOpfsCacheStatus(
      typeof window !== "undefined" &&
        typeof window.navigator?.storage?.getDirectory === "function"
    )
  );
  const [projectMessage, setProjectMessage] = useState<string | undefined>();
  const [projectMessageTone, setProjectMessageTone] = useState<
    "info" | "error"
  >("info");
  const derivedMeshCacheContext = useMemo<
    DerivedMeshCacheContext | undefined
  >(() => {
    if (
      projectFile.dirty ||
      !projectFile.sourceIdentity ||
      !projectFile.documentSchemaVersion
    ) {
      return undefined;
    }

    return {
      sourceIdentity: projectFile.sourceIdentity,
      documentSchemaVersion: projectFile.documentSchemaVersion,
      units: document.units
    };
  }, [
    document.units,
    projectFile.dirty,
    projectFile.documentSchemaVersion,
    projectFile.sourceIdentity
  ]);
  const derivedMeshCacheContextKey = derivedMeshCacheContext
    ? [
        derivedMeshCacheContext.sourceIdentity.algorithm,
        derivedMeshCacheContext.sourceIdentity.sha256,
        derivedMeshCacheContext.documentSchemaVersion,
        derivedMeshCacheContext.units
      ].join(":")
    : undefined;
  derivedMeshCacheContextRef.current = derivedMeshCacheContext;
  const refreshProjectOpfsCache = useCallback(
    async (announce = false) => {
      const status = await readProjectOpfsCacheStatus(
        typeof window !== "undefined"
          ? (window as unknown as ProjectOpfsCacheTargetLike)
          : {},
        {
          currentSourceIdentity: derivedMeshCacheContext?.sourceIdentity,
          supportedArtifactVersions: supportedOpfsCacheArtifactVersions
        }
      );
      setProjectOpfsCacheStatus(status);

      if (announce) {
        setProjectMessage(status.lastResult ?? "OPFS cache status refreshed.");
        setProjectMessageTone(
          status.diagnostics.some(
            (diagnostic) => diagnostic.severity === "error"
          )
            ? "error"
            : "info"
        );
      }
    },
    [derivedMeshCacheContext?.sourceIdentity]
  );
  const clearProjectOpfsCache = useCallback(async () => {
    const status = await clearProjectOpfsCacheStorage(
      typeof window !== "undefined"
        ? (window as unknown as ProjectOpfsCacheTargetLike)
        : {}
    );
    setProjectOpfsCacheStatus(status);
    setProjectMessage(status.lastResult ?? "OPFS cache clear finished.");
    setProjectMessageTone(status.state === "error" ? "error" : "info");
  }, []);
  const [derivedGeometry, setDerivedGeometry] =
    useState<DerivedGeometrySnapshot>(() =>
      createEmptyDerivedGeometrySnapshot()
    );
  const [derivedExactMetadata, setDerivedExactMetadata] =
    useState<DerivedExactMetadataSnapshot>(() =>
      createEmptyDerivedExactMetadataSnapshot()
    );
  const getDerivedGeometryRuntime = useCallback((): DerivedGeometryRuntime => {
    if (!derivedGeometryRuntimeRef.current) {
      derivedGeometryRuntimeRef.current = createDerivedGeometryRuntime();
    }

    return derivedGeometryRuntimeRef.current;
  }, []);
  const getDerivedGeometryService = useCallback((): DerivedGeometryService => {
    if (!derivedGeometryServiceRef.current) {
      derivedGeometryServiceRef.current = new DerivedGeometryService({
        runtime: getDerivedGeometryRuntime(),
        onChange: setDerivedGeometry,
        meshCache: createDerivedMeshOpfsCache({
          target:
            typeof window !== "undefined"
              ? (window as unknown as ProjectOpfsCacheTargetLike)
              : {},
          getContext: () => derivedMeshCacheContextRef.current,
          onStatus: setProjectOpfsCacheStatus
        })
      });
    }

    return derivedGeometryServiceRef.current;
  }, [getDerivedGeometryRuntime]);
  const getDerivedExactMetadataService =
    useCallback((): DerivedExactMetadataService => {
      if (!derivedExactMetadataServiceRef.current) {
        derivedExactMetadataServiceRef.current =
          new DerivedExactMetadataService({
            runtime: getDerivedGeometryRuntime(),
            onChange: setDerivedExactMetadata
          });
      }

      return derivedExactMetadataServiceRef.current;
    }, [getDerivedGeometryRuntime]);

  const sceneObjects = useMemo(
    () => [...document.objects.values()],
    [document]
  );
  const sketches = useMemo(
    () =>
      [...document.sketches.values()].map((sketch) => ({
        id: sketch.id,
        name: sketch.name,
        plane: sketch.plane,
        attachment: sketch.attachment,
        entities: [...sketch.entities.values()]
      })),
    [document]
  );
  const projectStructure = readProjectStructure();
  const projectHealth = readProjectHealth(derivedExactMetadata);
  const projectExportReadiness = readProjectExportReadiness();
  const projectTopologyIdentityReadiness =
    readProjectTopologyIdentityReadiness();
  const sketchExtrudeBodies = useMemo(
    () =>
      projectStructure.bodies.filter(
        (body) => body.source.type === "sketchExtrudeFeature"
      ),
    [projectStructure.bodies]
  );
  const generatedFacesByKey = useMemo(
    () => readGeneratedFaceReferencesByKey(sketchExtrudeBodies),
    [sketchExtrudeBodies]
  );
  const generatedEdgesByKey = useMemo(
    () => readGeneratedEdgeReferencesByKey(sketchExtrudeBodies),
    [sketchExtrudeBodies]
  );
  const sketchDisplayState = useMemo(
    () => createSketchDisplayState(sketches, generatedFacesByKey),
    [generatedFacesByKey, sketches]
  );
  const featureGeometrySources = useMemo(
    () =>
      createAuthoredFeatureDerivedGeometrySources(
        projectStructure.features,
        sketches,
        generatedFacesByKey,
        document.namedReferences
      ),
    [
      document.namedReferences,
      generatedFacesByKey,
      projectStructure.features,
      sketches
    ]
  );
  const derivedGeometrySources = useMemo<readonly DerivedGeometrySource[]>(
    () =>
      createDerivedGeometrySourcesFromDocument(
        document,
        projectStructure.features,
        generatedFacesByKey
      ),
    [document, generatedFacesByKey, projectStructure.features]
  );
  const selectedObject = selectedId
    ? document.objects.get(selectedId)
    : undefined;
  const selectedBody = selectedId
    ? projectStructure.bodies.find((body) => body.id === selectedId)
    : undefined;
  const preferredHoleBodyId = selectedBody?.id ?? preferredHoleTargetBodyId;
  useEffect(() => {
    if (
      preferredHoleTargetBodyId &&
      !projectStructure.bodies.some(
        (body) =>
          body.id === preferredHoleTargetBodyId &&
          body.consumedByFeatureId === undefined
      )
    ) {
      setPreferredHoleTargetBodyId(undefined);
    }
  }, [preferredHoleTargetBodyId, projectStructure.bodies]);
  const addTargetReadinessByTopologyAnchorId =
    readTopologyAnchorCommandTargetReadinessByAnchorId(
      document.topologyIdentity?.anchors,
      "feature.extrudeAddTarget"
    );
  const addTargetBodyOptions = useMemo(
    () =>
      createAddTargetBodyOptions(
        projectStructure.bodies,
        projectStructure.features,
        selectedBody?.id,
        document.topologyIdentity?.anchors,
        addTargetReadinessByTopologyAnchorId
      ),
    [
      addTargetReadinessByTopologyAnchorId,
      document.topologyIdentity?.anchors,
      projectStructure.bodies,
      projectStructure.features,
      selectedBody?.id
    ]
  );
  const cutTargetBodyOptions = useMemo(
    () =>
      createCutTargetBodyOptions(
        projectStructure.bodies,
        projectStructure.features,
        selectedBody?.id,
        document.topologyIdentity?.anchors
      ),
    [
      document.topologyIdentity?.anchors,
      projectStructure.bodies,
      projectStructure.features,
      selectedBody?.id
    ]
  );
  const holeTargetReadinessByTopologyAnchorId =
    readTopologyAnchorCommandTargetReadinessByAnchorId(
      document.topologyIdentity?.anchors,
      "feature.holeTarget"
    );
  const holeTargetBodyOptions = createHoleTargetBodyOptions(
    projectStructure.bodies,
    projectStructure.features,
    preferredHoleBodyId,
    document.topologyIdentity?.anchors,
    holeTargetReadinessByTopologyAnchorId
  );
  const selectedFeature = selectedBody
    ? projectStructure.features.find(
        (feature) => feature.id === selectedBody.featureId
      )
    : undefined;
  const selectedFeatureEditability = readFeatureEditability(
    selectedFeature?.id
  );
  const selectedBodyGeneratedReferences = readBodyGeneratedReferences(
    selectedBody?.id
  );
  const selectedGeneratedReferenceMeasurements =
    readGeneratedReferenceMeasurements(
      selectedBodyGeneratedReferences.references
    );
  const selectedBodyMeasurements = selectedBody
    ? readBodyMeasurements(selectedBody.id)
    : {};
  const selectedBodyTopology =
    selectedBody !== undefined
      ? readBodyTopology(selectedBody.id, derivedExactMetadata)
      : {};
  const namedReferences = readNamedReferences();
  const referenceHealth = readReferenceHealth();
  const namedReferenceHealthByName =
    createNamedReferenceHealthByName(referenceHealth);
  useEffect(() => {
    if (
      selectedNamedReferenceName &&
      !namedReferences.some(
        (reference) => reference.name === selectedNamedReferenceName
      )
    ) {
      setSelectedNamedReferenceName(undefined);
    }
  }, [namedReferences, selectedNamedReferenceName]);
  useEffect(() => {
    setTopologyRepairPreview(undefined);
  }, [
    selectedGeneratedReference?.bodyId,
    selectedGeneratedReference?.stableId,
    selectedGeneratedReference?.kind,
    selectedGeneratedReference?.topologyAnchorId
  ]);
  const selectedBodyReferenceCandidates = selectedBody
    ? readSelectionReferenceCandidates({
        type: "body",
        bodyId: selectedBody.id
      })
    : undefined;
  const referenceCandidatesByStableId =
    readSelectionReferenceCandidatesByStableId(
      selectedBodyGeneratedReferences.references
    );
  const namedReferenceCandidatesByName =
    readNamedReferenceCandidatesByName(namedReferences);
  const selectedNamedReference = selectedNamedReferenceName
    ? namedReferences.find(
        (reference) => reference.name === selectedNamedReferenceName
      )
    : undefined;
  const transactionHistory = readTransactionHistory();
  const parameters = readParameters();
  const sketchDimensionsBySketchId = readSketchDimensionsBySketchId(sketches);
  const sketchEvaluationsBySketchId = readSketchEvaluationsBySketchId(sketches);
  const sketchSolverStatusesBySketchId =
    readSketchSolverStatusesBySketchId(sketches);
  const selectedTopologyAnchoredGeneratedReference =
    enrichSelectedGeneratedReferenceWithTopologyAnchor(
      selectedGeneratedReference,
      document.topologyIdentity
    );
  const selectedGeneratedReferenceState = getGeneratedReferenceSelectionState(
    selectedTopologyAnchoredGeneratedReference,
    selectedBodyGeneratedReferences.references,
    selectedGeneratedReferenceMeasurements,
    document.units
  );
  const selectedGeneratedReferenceCandidates =
    selectedGeneratedReferenceState.status === "selected"
      ? (referenceCandidatesByStableId.get(
          selectedGeneratedReferenceState.reference.stableId
        ) ??
        readSelectionReferenceCandidates({
          type: "generatedReference",
          bodyId: selectedGeneratedReferenceState.reference.bodyId,
          stableId: selectedGeneratedReferenceState.reference.stableId,
          expectedKind: selectedGeneratedReferenceState.reference.kind
        }))
      : undefined;
  const selectedNamedReferenceCandidates =
    selectedNamedReference &&
    selectedGeneratedReferenceState.status === "selected" &&
    selectedGeneratedReferenceState.reference.bodyId ===
      selectedNamedReference.bodyId &&
    selectedGeneratedReferenceState.reference.stableId ===
      selectedNamedReference.stableId
      ? namedReferenceCandidatesByName.get(selectedNamedReference.name)
      : undefined;
  const selectedReferenceCandidates =
    selectedNamedReferenceCandidates ?? selectedGeneratedReferenceCandidates;
  const selectedSelectionReferenceCandidates =
    selectedReferenceCandidates ?? selectedBodyReferenceCandidates;
  const modelingSelectionContext = createModelingSelectionContext({
    focusedSketchId,
    namedReferences,
    referenceCandidatesByStableId,
    selectedBody,
    selectedBodyGeneratedReferences: selectedBodyGeneratedReferences.references,
    selectedBodyReferenceCandidates,
    selectedFeature,
    selectedGeneratedReferenceCandidates: selectedReferenceCandidates,
    selectedGeneratedReferenceState,
    selectedId,
    selectedSketchContext,
    sketchDimensionsBySketchId,
    sketchEvaluationsBySketchId,
    sketchSolverStatusesBySketchId,
    sketches
  });
  const modelingActions = deriveModelingActions({
    context: modelingSelectionContext,
    bodies: projectStructure.bodies,
    features: projectStructure.features,
    preferredBodyId: preferredHoleBodyId,
    topologyAnchors: document.topologyIdentity?.anchors,
    holeTargetReadinessByTopologyAnchorId
  });
  const sketchViewportDragTarget =
    modelingSelectionContext.selectionKind === "sketchEntity"
      ? {
          entityId: modelingSelectionContext.entity.id,
          sketch: modelingSelectionContext.sketch
        }
      : undefined;
  const selectedMeasurements = useMemo<
    ObjectMeasurementsSnapshot | undefined
  >(() => {
    if (!selectedObject) {
      return undefined;
    }

    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "object.measurements", id: selectedObject.id }
    });

    return response.ok && response.query === "object.measurements"
      ? response.measurements
      : undefined;
  }, [selectedObject]);
  const derivedGeometryBySourceId = useMemo(
    () =>
      new Map(
        derivedGeometry.entries.map((entry) => [
          entry.sourceId ?? entry.objectId,
          entry
        ])
      ),
    [derivedGeometry]
  );
  const selectedGeometryEntry = selectedBody
    ? (derivedGeometryBySourceId.get(selectedBody.id) ??
      (selectedBody.objectId
        ? derivedGeometryBySourceId.get(selectedBody.objectId)
        : undefined))
    : selectedObject
      ? derivedGeometryBySourceId.get(selectedObject.id)
      : undefined;
  const viewportSelectionDisplay = createViewportSelectionDisplay({
    derivedGeometryEnabled,
    selectedBody,
    selectedGeneratedReferenceState,
    selectedGeometryEntry,
    selectedObject,
    selectionReferenceCandidates: selectedSelectionReferenceCandidates,
    viewportPickIntent
  });
  const viewportHoverState = viewportHoverPick
    ? resolveViewportHoverIntent({
        hoveredRenderId: viewportHoverPick.pickedRenderId,
        bodies: projectStructure.bodies,
        objects: sceneObjects,
        readReferenceCandidates: readSelectionReferenceCandidates
      })
    : undefined;
  const viewportVisualState = createViewportVisualStateModel({
    hoverState: viewportHoverState,
    selectionDisplay: viewportSelectionDisplay,
    selectedGeneratedReferenceState
  });
  const viewportMeasurementOverlay = createViewportMeasurementOverlay({
    body: selectedBody,
    bodyMeasurements: selectedBodyMeasurements.measurements,
    bodyMeasurementsError: selectedBodyMeasurements.error,
    namedReferences,
    selectedGeneratedReferenceState,
    selectionReferenceCandidates: selectedSelectionReferenceCandidates,
    units: document.units
  });
  const viewportTwoTargetMeasurementTarget =
    createViewportTwoTargetMeasurementTarget({
      bodyMeasurements: selectedBodyMeasurements.measurements,
      generatedReferenceMeasurement:
        selectedGeneratedReferenceState.status === "selected"
          ? selectedGeneratedReferenceState.measurement?.measurement
          : undefined,
      measurementOverlay: viewportMeasurementOverlay
    });
  const viewportTwoTargetMeasurement = createViewportTwoTargetMeasurementView({
    activeTarget: viewportTwoTargetMeasurementTarget,
    session: viewportTwoTargetMeasurementSession,
    units: document.units
  });
  const viewportReferenceActions = createViewportReferenceActions({
    candidatesByStableId: referenceCandidatesByStableId,
    references: selectedBodyGeneratedReferences.references,
    selectedGeneratedReference
  });
  const viewportInteractionSurface = createViewportInteractionSurface({
    selectionDisplay: viewportSelectionDisplay,
    hoverState: viewportHoverState,
    measurementOverlay: viewportMeasurementOverlay,
    referenceActions: viewportReferenceActions,
    maxMeasurementRows: 3,
    maxReferenceActions: 4
  });
  const viewportContextualCommandSurface =
    createViewportContextualCommandSurface({
      modelingActions,
      namedReferences,
      namedReferenceHealthByName,
      selectedNamedReferenceName,
      selectionDisplay: viewportSelectionDisplay,
      selectedGeneratedReferenceState,
      selectionReferenceCandidates: selectedSelectionReferenceCandidates
    });
  const viewportTwoTargetMeasurementSessionActive =
    isViewportTwoTargetMeasurementSessionActive(
      viewportTwoTargetMeasurementSession
    );
  const viewportTransientStateActive =
    viewportTwoTargetMeasurementSessionActive ||
    viewportHoverPick !== undefined ||
    viewportPickIntent !== undefined;
  const clearViewportTransientState = useCallback(() => {
    setViewportHoverPick(undefined);
    setViewportPickIntent(undefined);
    setViewportTwoTargetMeasurementSession((current) =>
      updateViewportTwoTargetMeasurementSession(current, { type: "clear" })
    );
  }, []);
  useEffect(() => {
    setViewportTwoTargetMeasurementSession((current) =>
      clearViewportTwoTargetMeasurementSecondTargetOnSelectionChange(current)
    );
  }, [viewportContextualCommandSurface.selectionKey]);
  useEffect(() => {
    if (!viewportTransientStateActive) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (shouldCancelViewportTransientState(event)) {
        clearViewportTransientState();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearViewportTransientState, viewportTransientStateActive]);
  const geometryStatusBySourceId = useMemo(
    () =>
      new Map(
        derivedGeometry.entries.map((entry) => [
          entry.sourceId ?? entry.objectId,
          {
            label: getDerivedGeometryStatusLabel(entry),
            status: entry.status
          }
        ])
      ),
    [derivedGeometry]
  );
  const selectedViewportRenderId =
    viewportVisualState.selectedRenderTargetId ??
    selectedObject?.id ??
    selectedBody?.objectId ??
    selectedBody?.id ??
    selectedId;
  const renderScene = useMemo(
    () =>
      createRenderSceneInputs(
        sceneObjects,
        derivedGeometryBySourceId,
        featureGeometrySources,
        sketches,
        sketchDisplayState.frames
      ),
    [
      derivedGeometryBySourceId,
      featureGeometrySources,
      sceneObjects,
      sketchDisplayState.frames,
      sketches
    ]
  );
  const currentProject = useMemo(
    () => exportCadProjectForDocument(engine, document),
    [document]
  );
  const projectJsonWorkflow = useMemo(
    () =>
      createProjectJsonWorkflowState({
        currentProject,
        draftJson: projectJson,
        draftSource: projectJsonDraftSource
      }),
    [currentProject, projectJson, projectJsonDraftSource]
  );
  const currentProjectSummary = projectJsonWorkflow.current.summary;
  const projectStorageCapabilities = useMemo(
    () => createProjectStorageCapabilityStatus(window),
    []
  );
  const visualizationMeshExportStatus = useMemo(
    () =>
      projectExportReadiness
        ? createVisualizationMeshExportStatus({
            exportReadiness: projectExportReadiness,
            derivedGeometry,
            derivedGeometrySources
          })
        : undefined,
    [derivedGeometry, derivedGeometrySources, projectExportReadiness]
  );
  const utilityPanels: readonly {
    readonly id: UtilityPanelId;
    readonly label: string;
  }[] = [
    { id: "sketches", label: "Sketches" },
    { id: "history", label: "Log" }
  ];

  useEffect(() => {
    return () => {
      derivedGeometryServiceRef.current?.dispose();
      derivedGeometryServiceRef.current = undefined;
      derivedExactMetadataServiceRef.current?.dispose();
      derivedExactMetadataServiceRef.current = undefined;
      derivedGeometryRuntimeRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    void refreshProjectOpfsCache();
  }, [refreshProjectOpfsCache]);

  useEffect(() => {
    if (!derivedGeometryEnabled) {
      return;
    }

    const geometryService = getDerivedGeometryService();
    const cacheContextChanged =
      derivedMeshCacheContextKeyRef.current !== derivedMeshCacheContextKey;

    derivedMeshCacheContextKeyRef.current = derivedMeshCacheContextKey;

    if (cacheContextChanged && derivedMeshCacheContextKey) {
      geometryService.refresh(derivedGeometrySources);
    } else {
      geometryService.reconcile(derivedGeometrySources);
    }

    getDerivedExactMetadataService().reconcile(derivedGeometrySources);
  }, [
    derivedGeometrySources,
    derivedMeshCacheContextKey,
    getDerivedExactMetadataService,
    getDerivedGeometryService
  ]);

  function syncDocument(
    nextSelectedId: string | null | undefined = selectedId
  ) {
    const nextDocument = engine.getDocument();
    const nextStructure = readProjectStructure();
    reconcileDerivedGeometry(nextDocument, nextStructure);
    setDocument(nextDocument);
    setSelectedId(
      nextSelectedId !== null &&
        nextSelectedId &&
        (nextDocument.objects.has(nextSelectedId) ||
          nextStructure.bodies.some((body) => body.id === nextSelectedId))
        ? nextSelectedId
        : undefined
    );
    setSelectedGeneratedReference((current) =>
      reconcileSelectedGeneratedReferenceBody(current, nextStructure.bodies)
    );
    setViewportTwoTargetMeasurementSession((current) =>
      updateViewportTwoTargetMeasurementSession(current, { type: "clear" })
    );
  }

  function selectObject(
    objectId: string | undefined,
    options?: StructureSelectionOptions
  ) {
    setSelectedId(objectId);
    setSelectedGeneratedReference(undefined);
    setViewportPickIntent(undefined);
    setViewportHoverPick(undefined);
    if (options?.panel) {
      setActiveModelBrowserPanel(options.panel);
    }
  }

  function selectViewportPick(pick: ViewportCanvasPick) {
    const pickedBodyId = resolveViewportPickedBodyId({
      pickedRenderId: pick.pickedRenderId,
      bodies: projectStructure.bodies,
      objects: sceneObjects
    });
    const targetGeneratedReferenceBodyId =
      chooseViewportGeneratedReferencePickBodyId({
        activeSelectionPanel: activeModelBrowserPanel === "selection",
        generatedReferenceSelected: selectedGeneratedReference !== undefined,
        pickedBodyId,
        selectedBodyId: selectedBody?.id
      });
    const generatedEdgeHitCandidate = createViewportGeneratedEdgeHitCandidate({
      camera: pick.camera,
      edges: [...generatedEdgesByKey.values()],
      pickedRenderId: pick.pickedRenderId,
      point: pick.point,
      targetBodyId: targetGeneratedReferenceBodyId,
      size: pick.size,
      sketchDisplayFrames: sketchDisplayState.frames
    });
    const generatedFaceHitCandidate =
      createViewportGeneratedPlanarFaceHitCandidate({
        camera: pick.camera,
        faces: [...generatedFacesByKey.values()],
        pickedRenderId: pick.pickedRenderId,
        point: pick.point,
        targetBodyId: targetGeneratedReferenceBodyId,
        size: pick.size,
        sketchDisplayFrames: sketchDisplayState.frames
      });
    const intent = resolveViewportPickIntent({
      hitCandidate: generatedEdgeHitCandidate ?? generatedFaceHitCandidate,
      pickedRenderId: pick.pickedRenderId,
      bodies: projectStructure.bodies,
      objects: sceneObjects,
      readReferenceCandidates: readSelectionReferenceCandidates
    });

    setViewportPickIntent(intent);
    setSelectedId(intent.selectedId);
    setSelectedGeneratedReference(
      intent.kind === "generatedReference"
        ? {
            bodyId: intent.bodyId,
            stableId: intent.stableId,
            kind: intent.expectedKind
          }
        : undefined
    );
  }

  function hoverViewportPick(pick: ViewportCanvasPick | undefined) {
    setViewportHoverPick(pick);
  }

  function reconcileDerivedGeometry(
    nextDocument: CadDocument,
    nextStructure = readProjectStructure()
  ) {
    if (!derivedGeometryEnabled) {
      return;
    }

    const nextSketchExtrudeBodies = nextStructure.bodies.filter(
      (body) => body.source.type === "sketchExtrudeFeature"
    );
    const nextGeneratedFacesByKey = readGeneratedFaceReferencesByKey(
      nextSketchExtrudeBodies
    );

    const nextDerivedGeometrySources = createDerivedGeometrySourcesFromDocument(
      nextDocument,
      nextStructure.features,
      nextGeneratedFacesByKey
    );
    getDerivedGeometryService().reconcile(nextDerivedGeometrySources);
    getDerivedExactMetadataService().reconcile(nextDerivedGeometrySources);
  }

  async function commitOps(
    ops: readonly CadOp[],
    getNextSelectedId: (response: CadBatchResponse) => string | null | undefined
  ): Promise<CadBatchResponse | undefined> {
    setCommandPending(true);
    setCommandError(undefined);
    setCommandNotice(undefined);

    try {
      const response = await commandExecutor.executeBatch(
        buildBatch("commit", ops, WEB_UI_ACTOR)
      );

      if (!response.ok) {
        setCommandError(response.error.message);
        return response;
      }

      syncDocument(getNextSelectedId(response));
      setProjectFile((current) => markProjectFileDirty(current));
      return response;
    } finally {
      setCommandPending(false);
    }
  }

  async function createBox() {
    const offset = projectStructure.bodies.length * 2.8;
    const plan = createQuickStartSourceBodyPlan({
      document,
      form: {
        ...quickBoxForm,
        translationX: offset
      },
      kind: "box"
    });

    await commitOps(plan.ops, () => plan.bodyId);
  }

  async function createCylinder() {
    const offset = projectStructure.bodies.length * 2.8;
    const plan = createQuickStartSourceBodyPlan({
      document,
      form: {
        ...quickCylinderForm,
        translationX: offset
      },
      kind: "cylinder"
    });

    await commitOps(plan.ops, () => plan.bodyId);
  }

  async function createSphere() {
    const offset = document.objects.size * 2.8;
    await commitOps(
      [
        buildCreateSphereOp({
          ...quickSphereForm,
          translationX: offset
        })
      ],
      (response) => response.createdIds[0]
    );
  }

  async function createCone() {
    const offset = document.objects.size * 2.8;
    await commitOps(
      [
        buildCreateConeOp({
          ...quickConeForm,
          translationX: offset
        })
      ],
      (response) => response.createdIds[0]
    );
  }

  async function createTorus() {
    const offset = document.objects.size * 2.8;
    await commitOps(
      [
        buildCreateTorusOp({
          ...quickTorusForm,
          translationX: offset
        })
      ],
      (response) => response.createdIds[0]
    );
  }

  async function updateDocumentUnits(units: CadDocument["units"]) {
    if (units === document.units) {
      return;
    }

    await commitOps(
      [buildUpdateUnitsOp(units, unitUpdateMode)],
      () => selectedId
    );
  }

  async function renameSelectedObject(name: string) {
    if (!selectedObject) {
      return;
    }

    const objectId = selectedObject.id;
    await commitOps([buildRenameObjectOp(objectId, name)], () => objectId);
  }

  async function updateSelectedTransform(form: TransformCommandForm) {
    if (!selectedObject) {
      return;
    }

    const objectId = selectedObject.id;
    await commitOps([buildUpdateTransformOp(objectId, form)], () => objectId);
  }

  async function updateSelectedDimensions(form: DimensionCommandForm) {
    if (!selectedObject) {
      return;
    }

    const objectId = selectedObject.id;
    const op =
      selectedObject.kind === "box"
        ? buildUpdateBoxDimensionsOp(objectId, form)
        : selectedObject.kind === "cylinder"
          ? buildUpdateCylinderDimensionsOp(objectId, form)
          : selectedObject.kind === "sphere"
            ? buildUpdateSphereDimensionsOp(objectId, form)
            : selectedObject.kind === "cone"
              ? buildUpdateConeDimensionsOp(objectId, form)
              : buildUpdateTorusDimensionsOp(objectId, form);

    await commitOps([op], () => objectId);
  }

  async function deleteSelectedObject() {
    if (!selectedObject) {
      return;
    }

    await commitOps([buildDeleteObjectOp(selectedObject.id)], () => undefined);
  }

  async function createSketch(
    form: SketchCreateForm,
    options: { readonly preferredHoleTargetBodyId?: string } = {}
  ) {
    if (options.preferredHoleTargetBodyId === undefined) {
      setPreferredHoleTargetBodyId(undefined);
    }

    const response = await commitOps([buildCreateSketchOp(form)], () => null);
    const sketchId = response?.ok
      ? (response.createdSketchIds?.[0] ?? form.id.trim())
      : undefined;

    if (sketchId) {
      setPreferredHoleTargetBodyId(options.preferredHoleTargetBodyId);
      setSelectedGeneratedReference(undefined);
      setFocusedSketchId(sketchId);
      setSelectedSketchContext({ sketchId });
    }

    return sketchId;
  }

  async function createSideHoleSketch(
    form: SketchCreateForm,
    targetBodyId: string
  ) {
    const sketchId = await createSketch(form, {
      preferredHoleTargetBodyId: targetBodyId
    });

    if (sketchId) {
      setCommandNotice(
        "Draw a circle, then create a hole through this target."
      );
    }
  }

  async function createParameter(form: ParameterCreateForm) {
    await commitOps([buildCreateParameterOp(form)], () => selectedId);
  }

  async function applyParameterEdit(
    parameter: CadParameterSnapshot,
    form: ParameterEditForm
  ) {
    const ops = buildParameterEditOps(parameter, form);

    if (ops.length === 0) {
      return;
    }

    await commitOps(ops, () => selectedId);
  }

  async function deleteParameter(parameterId: string) {
    await commitOps([buildDeleteParameterOp(parameterId)], () => selectedId);
  }

  async function createSketchOnFace(form: SketchCreateOnFaceForm) {
    setCommandPending(true);
    setCommandError(undefined);
    setCommandNotice(undefined);

    const commandForm = enrichSketchOnFaceFormWithTopologyAnchor(
      form,
      document.topologyIdentity
    );
    const currentStructure = readProjectStructure();
    let ops: readonly CadOp[] = [];

    try {
      const plan = await createSketchOnFaceCommandPlan({
        engine,
        features: currentStructure.features,
        sketches,
        generatedFacesByKey,
        runtime: getDerivedGeometryRuntime(),
        form: commandForm
      });

      if (!plan.ok) {
        setCommandError(plan.message);
        return;
      }

      ops = plan.ops;

      const dryRun = await commandExecutor.executeBatch(
        buildBatch("dryRun", ops, WEB_UI_ACTOR)
      );

      if (!dryRun.ok) {
        setCommandError(dryRun.error.message);
        return;
      }
    } catch (error) {
      setCommandError(
        error instanceof Error
          ? error.message
          : "Could not create attached sketch."
      );
      return;
    } finally {
      setCommandPending(false);
    }

    const response = await commitOps(ops, () => null);
    const sketchId = response?.ok
      ? (response.createdSketchIds?.[0] ?? commandForm.id.trim())
      : undefined;

    if (sketchId) {
      setSelectedGeneratedReference(undefined);
      setFocusedSketchId(sketchId);
      setSelectedSketchContext({ sketchId });
    }
  }

  async function createEdgeFinish(
    operation: EdgeFinishOperation,
    form: FeatureEdgeFinishForm
  ) {
    const op =
      operation === "chamfer"
        ? buildFeatureChamferOp(form)
        : buildFeatureFilletOp(form);

    await commitOps(
      [op],
      (response) => response.createdBodyIds?.[0] ?? (form.bodyId || selectedId)
    );
  }

  function focusSketch(sketchId: string, entityId?: string) {
    setSelectedId(undefined);
    setSelectedGeneratedReference(undefined);
    setFocusedSketchId(sketchId);
    setActiveUtilityPanel("sketches");
    setSelectedSketchContext({
      sketchId,
      ...(entityId ? { entityId } : {})
    });
  }

  async function renameSketch(sketchId: string, name: string) {
    await commitOps([buildRenameSketchOp(sketchId, name)], () => selectedId);
  }

  async function deleteSketch(sketchId: string) {
    await commitOps([buildDeleteSketchOp(sketchId)], () => null);
    setFocusedSketchId((current) =>
      current === sketchId ? undefined : current
    );
    setSelectedSketchContext((current) =>
      current?.sketchId === sketchId ? undefined : current
    );
  }

  async function addSketchEntity(
    sketchId: string,
    kind: SketchEntityKind,
    form: SketchEntityForm
  ) {
    const op =
      kind === "point"
        ? buildAddSketchPointOp(sketchId, form)
        : kind === "line"
          ? buildAddSketchLineOp(sketchId, form)
          : kind === "rectangle"
            ? buildAddSketchRectangleOp(sketchId, form)
            : buildAddSketchCircleOp(sketchId, form);

    await commitOps([op], (response) => {
      const entityId = response.createdSketchEntityIds?.[0];

      if (entityId) {
        setSelectedGeneratedReference(undefined);
        setFocusedSketchId(sketchId);
        setSelectedSketchContext({ sketchId, entityId });
      }

      return null;
    });
  }

  async function updateSketchEntity(
    sketchId: string,
    entity: SketchEntitySnapshot
  ) {
    await commitOps(
      [buildUpdateSketchEntityOp(sketchId, entity)],
      () => selectedId
    );
  }

  async function previewSketchEntityUpdate(
    sketchId: string,
    entity: SketchEntitySnapshot
  ): Promise<boolean> {
    const response = await commandExecutor.executeBatch(
      buildBatch(
        "dryRun",
        [buildUpdateSketchEntityOp(sketchId, entity)],
        WEB_UI_ACTOR
      )
    );

    return response.ok;
  }

  async function deleteSketchEntity(sketchId: string, entityId: string) {
    await commitOps(
      [buildDeleteSketchEntityOp(sketchId, entityId)],
      () => null
    );
    setFocusedSketchId(sketchId);
    setSelectedSketchContext((current) =>
      current?.sketchId === sketchId && current.entityId === entityId
        ? { sketchId }
        : current
    );
  }

  async function createSketchDimension(
    sketchId: string,
    entityId: string,
    target: SketchDimensionTarget,
    form: SketchDimensionForm
  ) {
    await commitOps(
      [buildCreateSketchDimensionOp(sketchId, entityId, target, form)],
      () => selectedId
    );
  }

  async function applySketchDimensionEdit(
    dimension: SketchDimensionEntry,
    form: SketchDimensionForm
  ) {
    const ops = buildSketchDimensionEditOps(dimension, form);

    if (ops.length === 0) {
      return;
    }

    await commitOps(ops, () => selectedId);
  }

  async function deleteSketchDimension(dimensionId: string) {
    await commitOps(
      [buildDeleteSketchDimensionOp(dimensionId)],
      () => selectedId
    );
  }

  async function createSketchConstraint(
    sketchId: string,
    entityId: string,
    form: SketchConstraintForm
  ) {
    await commitOps(
      [buildCreateSketchConstraintOp(sketchId, entityId, form)],
      () => selectedId
    );
  }

  async function applySketchConstraintEdit(
    constraint: SketchConstraintEntry,
    form: SketchConstraintForm
  ) {
    const ops = buildSketchConstraintEditOps(constraint, form);

    if (ops.length === 0) {
      return;
    }

    await commitOps(ops, () => selectedId);
  }

  async function deleteSketchConstraint(constraintId: string) {
    await commitOps(
      [buildDeleteSketchConstraintOp(constraintId)],
      () => selectedId
    );
  }

  async function extrudeSketchEntity(
    sketchId: string,
    entityId: string,
    form: FeatureExtrudeForm
  ) {
    await commitOps(
      [buildFeatureExtrudeOp(sketchId, entityId, form)],
      (response) => response.createdBodyIds?.[0] ?? selectedId
    );
  }

  async function revolveSketchEntity(
    sketchId: string,
    entityId: string,
    form: FeatureRevolveForm
  ) {
    await commitOps(
      [buildFeatureRevolveOp(sketchId, entityId, form)],
      (response) => response.createdBodyIds?.[0] ?? selectedId
    );
  }

  async function holeSketchEntity(
    sketchId: string,
    circleEntityId: string,
    form: FeatureHoleForm
  ) {
    const op = buildFeatureHoleOp(sketchId, circleEntityId, form);

    if (derivedGeometryEnabled) {
      setCommandPending(true);
      setCommandError(undefined);
      setCommandNotice(undefined);

      try {
        const preflight = await preflightHoleGeometryCommand({
          engine,
          ops: [op],
          bodyId: op.bodyId,
          runtime: getDerivedGeometryRuntime()
        });

        if (!preflight.ok) {
          setCommandError(preflight.message);
          return;
        }
      } finally {
        setCommandPending(false);
      }
    }

    const response = await commitOps(
      [op],
      (response) => response.createdBodyIds?.[0] ?? selectedId
    );

    if (response?.ok) {
      setPreferredHoleTargetBodyId((current) =>
        current === form.targetBodyId ? undefined : current
      );
    }
  }

  async function deleteAuthoredFeature(featureId: string) {
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === featureId
    );

    if (!feature || feature.kind === "primitive") {
      return;
    }

    const targetBodyId = getFeatureTargetBodyId(feature);
    const sourceSketchId = getFeatureSourceSketchId(feature);
    const response = await commitOps(
      [buildFeatureDeleteOp(feature.id)],
      () => targetBodyId ?? undefined
    );

    if (!response?.ok) {
      return;
    }

    if (!targetBodyId && sourceSketchId) {
      setFocusedSketchId(sourceSketchId);
      setSelectedSketchContext({ sketchId: sourceSketchId });
    }

    setCommandNotice(formatFeatureDeleteNotice(feature));
  }

  async function updateAuthoredExtrude(
    featureId: string,
    depth: number,
    side: FeatureExtrudeSide
  ) {
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === featureId
    );

    if (feature?.kind !== "extrude") {
      return;
    }

    await commitOps(
      [buildFeatureUpdateExtrudeOp(feature.id, depth, side)],
      () => feature.bodyId
    );
  }

  async function updateAuthoredRevolve(
    featureId: string,
    angleDegrees: number
  ) {
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === featureId
    );

    if (feature?.kind !== "revolve") {
      return;
    }

    await commitOps(
      [buildFeatureUpdateRevolveOp(feature.id, angleDegrees)],
      () => feature.bodyId
    );
  }

  async function updateAuthoredHole(
    featureId: string,
    depthMode: FeatureHoleDepthMode,
    depth: number | undefined,
    direction: FeatureHoleDirection
  ) {
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === featureId
    );

    if (feature?.kind !== "hole") {
      return;
    }

    await commitOps(
      [buildFeatureUpdateHoleOp(feature.id, depthMode, depth, direction)],
      () => feature.bodyId
    );
  }

  async function updateAuthoredChamfer(featureId: string, distance: number) {
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === featureId
    );

    if (feature?.kind !== "chamfer") {
      return;
    }

    await commitOps(
      [buildFeatureUpdateChamferOp(feature.id, distance)],
      () => feature.bodyId
    );
  }

  async function updateAuthoredFillet(featureId: string, radius: number) {
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === featureId
    );

    if (feature?.kind !== "fillet") {
      return;
    }

    await commitOps(
      [buildFeatureUpdateFilletOp(feature.id, radius)],
      () => feature.bodyId
    );
  }

  async function nameGeneratedReference(
    name: string,
    target: SelectedGeneratedReference
  ) {
    await commitOps(
      [buildNameGeneratedReferenceOp(name, target.bodyId, target.stableId)],
      () => selectedId
    );
  }

  async function createStableTopologyReference(
    target: SelectedGeneratedReference
  ) {
    setCommandPending(true);
    setCommandError(undefined);
    setCommandNotice(undefined);

    let plan: Awaited<
      ReturnType<
        typeof createProjectTopologyAnchorCreationPlanForGeneratedReference
      >
    >;

    try {
      plan = await createProjectTopologyAnchorCreationPlanForGeneratedReference(
        {
          engine,
          features: projectStructure.features,
          sketches,
          generatedFacesByKey,
          runtime: getDerivedGeometryRuntime(),
          target
        }
      );

      if (!plan.ok) {
        setCommandError(plan.message);
        return;
      }

      if (plan.plan.status === "alreadyExists") {
        setSelectedGeneratedReference({
          ...target,
          ...(plan.plan.anchorId
            ? { topologyAnchorId: plan.plan.anchorId }
            : {})
        });
        setCommandNotice("Saved reference already exists.");
        return;
      }

      const dryRun = await commandExecutor.executeBatch(
        buildBatch("dryRun", plan.plan.ops, WEB_UI_ACTOR)
      );

      if (!dryRun.ok) {
        setCommandError(dryRun.error.message);
        return;
      }
    } catch (error) {
      setCommandError(
        error instanceof Error ? error.message : "Could not save reference."
      );
      return;
    } finally {
      setCommandPending(false);
    }

    const response = await commitOps(plan.plan.ops, () => target.bodyId);

    if (response?.ok) {
      setSelectedGeneratedReference({
        ...target,
        ...(plan.plan.anchorId ? { topologyAnchorId: plan.plan.anchorId } : {})
      });
      setCommandNotice("Saved reference.");
    }
  }

  async function repairStableTopologyReference(
    target: SelectedGeneratedReference,
    selectedRepairCandidateId?: string
  ) {
    setCommandPending(true);
    setCommandError(undefined);
    setCommandNotice(undefined);

    let plan: Awaited<
      ReturnType<
        typeof createProjectTopologyAnchorRepairPlanForGeneratedReference
      >
    >;

    try {
      plan = await createProjectTopologyAnchorRepairPlanForGeneratedReference({
        engine,
        features: projectStructure.features,
        sketches,
        generatedFacesByKey,
        runtime: getDerivedGeometryRuntime(),
        target: {
          ...target,
          ...(selectedRepairCandidateId ? { selectedRepairCandidateId } : {})
        }
      });

      if (!plan.ok) {
        setCommandError(plan.message);
        return;
      }

      if (plan.plan.status === "alreadyCurrent") {
        setCommandNotice("Saved reference is already current.");
        return;
      }

      const dryRun = await commandExecutor.executeBatch(
        buildBatch("dryRun", plan.plan.ops, WEB_UI_ACTOR)
      );

      if (!dryRun.ok) {
        setCommandError(dryRun.error.message);
        return;
      }
    } catch (error) {
      setCommandError(
        error instanceof Error
          ? error.message
          : "Could not repair saved reference."
      );
      return;
    } finally {
      setCommandPending(false);
    }

    const response = await commitOps(plan.plan.ops, () => target.bodyId);

    if (response?.ok) {
      setSelectedGeneratedReference({
        ...target,
        ...(plan.plan.anchorId ? { topologyAnchorId: plan.plan.anchorId } : {})
      });
      setTopologyRepairPreview(undefined);
      setCommandNotice("Repaired saved reference.");
    }
  }

  async function previewStableTopologyRepair(
    target: SelectedGeneratedReference
  ) {
    const key = createTopologyRepairPreviewKey(target);

    setTopologyRepairPreview({ key, pending: true });

    try {
      const result =
        await createProjectTopologyAnchorRepairPlanForGeneratedReference({
          engine,
          features: projectStructure.features,
          sketches,
          generatedFacesByKey,
          runtime: getDerivedGeometryRuntime(),
          target
        });
      const plan = result.ok ? result.plan : result.plan;

      setTopologyRepairPreview({
        key,
        pending: false,
        preview: createTopologyRepairCandidatePreview({
          status: result.ok ? result.plan.status : result.status,
          repairCandidates: plan?.repairCandidates ?? []
        }),
        ...(result.ok ? {} : { error: result.message })
      });
    } catch (error) {
      setTopologyRepairPreview({
        key,
        pending: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not check saved reference repair options."
      });
    }
  }

  async function repairNamedReference(
    name: string,
    target: SelectedGeneratedReference
  ) {
    const op = target.topologyAnchorId
      ? buildRepairNamedReferenceToTopologyAnchorOp(
          name,
          target.topologyAnchorId
        )
      : buildRepairNamedReferenceOp(name, target.bodyId, target.stableId);

    setCommandPending(true);
    setCommandError(undefined);
    setCommandNotice(undefined);

    try {
      const dryRun = await commandExecutor.executeBatch(
        buildBatch("dryRun", [op], WEB_UI_ACTOR)
      );

      if (!dryRun.ok) {
        setCommandError(formatNamedReferenceRepairBatchError(dryRun.error));
        return;
      }
      setCommandNotice(
        formatNamedReferenceRepairBatchMessage(dryRun, name.trim())
      );
    } finally {
      setCommandPending(false);
    }

    const response = await commitOps([op], () => target.bodyId);

    if (response?.ok) {
      setSelectedNamedReferenceName(name.trim());
      setSelectedGeneratedReference(target);
      setCommandNotice(
        formatNamedReferenceRepairBatchMessage(response, name.trim())
      );
    } else if (response) {
      setCommandError(formatNamedReferenceRepairBatchError(response.error));
    }
  }

  async function deleteNamedReference(name: string) {
    const response = await commitOps(
      [buildDeleteNamedReferenceOp(name)],
      () => selectedId
    );

    if (response?.ok && selectedNamedReferenceName === name.trim()) {
      setSelectedNamedReferenceName(undefined);
    }
  }

  function inspectNamedReference(name: string) {
    setSelectedNamedReferenceName(name);
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "reference.resolveNamed", name }
    });

    if (!response.ok || response.query !== "reference.resolveNamed") {
      setCommandError(undefined);
      setCommandNotice(
        "Select a replacement generated reference, then repair the name."
      );
      return;
    }

    setCommandError(undefined);
    setCommandNotice(undefined);
    setSelectedId(response.reference.bodyId);
    setSelectedGeneratedReference(
      createSelectedGeneratedReference(response.reference)
    );
    setViewportPickIntent(undefined);
    setViewportHoverPick(undefined);
  }

  function selectGeneratedReference(reference: CadGeneratedReference) {
    setSelectedId(reference.bodyId);
    setSelectedGeneratedReference(createSelectedGeneratedReference(reference));
    setViewportPickIntent(undefined);
    setViewportHoverPick(undefined);
  }

  function runViewportContextualCommand(
    action: ViewportContextualCommandAction
  ) {
    const routed = runViewportContextualCommandAction({
      action,
      body: selectedBody,
      disabled: commandPending,
      namedReferences,
      selectionReferenceCandidates: selectedSelectionReferenceCandidates,
      selectedGeneratedReferenceState,
      onContinueInModeling: (modelingAction) => {
        setCommandNotice(
          modelingAction.id === "sketch.createOnFace"
            ? "Continue in Modeling to choose the target face."
            : "Continue in Modeling for the full command inputs."
        );
      },
      onCreateEdgeFinish: (operation, form) =>
        void createEdgeFinish(operation, form),
      onCreateSideHoleSketch: (form, targetBodyId) =>
        void createSideHoleSketch(form, targetBodyId),
      onCreateSketchOnFace: (form) => void createSketchOnFace(form),
      onRepairNamedReference: (name, target) =>
        void repairNamedReference(name, target)
    });

    if (!routed && action.route === "command") {
      setCommandNotice("This contextual command needs the Modeling panel.");
    }
  }

  function nameViewportContextualReference(
    name: string,
    target: SelectedGeneratedReference
  ) {
    void nameGeneratedReference(name, target);
  }

  function startViewportTwoTargetMeasurement(
    target: ViewportTwoTargetMeasurementTarget
  ) {
    setViewportTwoTargetMeasurementSession((current) =>
      updateViewportTwoTargetMeasurementSession(current, {
        type: "start",
        target
      })
    );
  }

  function setSecondViewportTwoTargetMeasurement(
    target: ViewportTwoTargetMeasurementTarget
  ) {
    setViewportTwoTargetMeasurementSession((current) =>
      updateViewportTwoTargetMeasurementSession(current, {
        type: "setSecond",
        target
      })
    );
  }

  function clearViewportTwoTargetMeasurement() {
    setViewportTwoTargetMeasurementSession((current) =>
      updateViewportTwoTargetMeasurementSession(current, { type: "clear" })
    );
  }

  function getFeatureTargetBodyId(
    feature: CadFeatureSummary
  ): string | undefined {
    if (
      feature.kind === "extrude" ||
      feature.kind === "revolve" ||
      feature.kind === "hole" ||
      feature.kind === "chamfer" ||
      feature.kind === "fillet"
    ) {
      return feature.targetBodyId;
    }

    return undefined;
  }

  function getFeatureSourceSketchId(
    feature: CadFeatureSummary
  ): string | undefined {
    if (
      feature.kind === "extrude" ||
      feature.kind === "revolve" ||
      feature.kind === "hole"
    ) {
      return feature.sketchId;
    }

    return undefined;
  }

  function formatFeatureDeleteNotice(feature: CadFeatureSummary): string {
    const label = formatFeatureNoticeLabel(feature);

    if (getFeatureTargetBodyId(feature)) {
      return `Deleted ${label}; target body restored.`;
    }

    return `Deleted ${label}; result body removed.`;
  }

  function formatFeatureNoticeLabel(feature: CadFeatureSummary): string {
    switch (feature.kind) {
      case "extrude":
        return feature.operationMode === "newBody"
          ? "extrude"
          : `${feature.operationMode} extrude`;
      case "revolve":
        return "revolve";
      case "hole":
        return "hole";
      case "chamfer":
        return "chamfer";
      case "fillet":
        return "fillet";
      case "primitive":
        return feature.primitive;
    }
  }

  function undo() {
    const result = engine.undo();
    syncDocument();
    if (result) {
      setProjectFile((current) => markProjectFileDirty(current));
      setCommandNotice("Undo applied.");
    }
  }

  function redo() {
    const result = engine.redo();
    syncDocument(result?.transaction.diff.created[0]?.id ?? selectedId);
    if (result) {
      setProjectFile((current) => markProjectFileDirty(current));
      setCommandNotice("Redo applied.");
    }
  }

  function exportProjectJson() {
    setProjectJson(exportCadProjectJson(engine));
    setProjectJsonDraftSource({ kind: "generatedExport" });
    setProjectMessage(
      `Generated ${formatProjectJsonSummary(currentProjectSummary)}.`
    );
    setProjectMessageTone("info");
  }

  function downloadProjectJson() {
    if (!projectStorageCapabilities.jsonDownloadAvailable) {
      setProjectMessage(
        "Project JSON download is unavailable in this browser runtime."
      );
      setProjectMessageTone("error");
      return;
    }

    const projectJson = exportCadProjectJson(engine);
    const blob = new Blob([projectJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "partbench-project.json";
    window.document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setProjectJson(projectJson);
    setProjectJsonDraftSource({
      kind: "downloadedExport",
      fileName: "partbench-project.json"
    });
    setProjectMessage(
      `Downloaded ${formatProjectJsonSummary(currentProjectSummary)}.`
    );
    setProjectMessageTone("info");
  }

  function downloadVisualizationMeshExport() {
    if (!projectStorageCapabilities.jsonDownloadAvailable) {
      setProjectMessage(
        "Visualization GLB download is unavailable in this browser runtime."
      );
      setProjectMessageTone("error");
      return;
    }

    if (!projectExportReadiness) {
      setProjectMessage("Project export readiness is unavailable.");
      setProjectMessageTone("error");
      return;
    }

    const result = createVisualizationMeshExportArtifact({
      exportReadiness: projectExportReadiness,
      derivedGeometry,
      derivedGeometrySources
    });

    if (!result.ok) {
      const diagnostic = result.diagnostics[0];
      setProjectMessage(
        diagnostic
          ? `${diagnostic.code}: ${diagnostic.message}`
          : "Visualization GLB export is unavailable."
      );
      setProjectMessageTone("error");
      return;
    }

    const { artifact } = result;
    const blob = new Blob([artifact.bytes], { type: artifact.mimeType });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = artifact.fileName;
    window.document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setProjectMessage(
      `Downloaded ${artifact.fileName}: ${artifact.metadata.bodyCount} visualization bod${
        artifact.metadata.bodyCount === 1 ? "y" : "ies"
      }, ${artifact.metadata.vertexCount} vertices, ${artifact.metadata.triangleCount} triangles.`
    );
    setProjectMessageTone("info");
  }

  async function downloadExactStepExport() {
    if (!projectStorageCapabilities.jsonDownloadAvailable) {
      setProjectMessage(
        "STEP download is unavailable in this browser runtime."
      );
      setProjectMessageTone("error");
      return;
    }

    const exactExport = readProjectExactStepExport();

    if (!exactExport?.available) {
      const diagnostic = exactExport?.diagnostics.find(
        (entry) => entry.status !== "supported"
      );
      setProjectMessage(
        diagnostic
          ? `${diagnostic.code}: ${diagnostic.message}`
          : "STEP export needs a supported active authored body."
      );
      setProjectMessageTone("error");
      return;
    }

    const result = await executeProjectExactStepExport({
      exactExport,
      worker: createGeometryKernelBrowserWorker()
    });

    if (!result.artifact) {
      const diagnostic = result.diagnostics.find(
        (entry) => entry.status !== "supported"
      );
      setProjectMessage(
        diagnostic
          ? `${diagnostic.code}: ${diagnostic.message}`
          : "STEP export did not produce an artifact."
      );
      setProjectMessageTone("error");
      return;
    }

    const bytes = base64ToBytes(result.artifact.bytesBase64);
    const blob = new Blob([copyBytesToArrayBuffer(bytes)], {
      type: result.artifact.mimeType
    });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = result.artifact.fileName;
    window.document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setProjectMessage(
      `Downloaded ${result.artifact.fileName}: ${result.exportableBodyCount} exact bod${
        result.exportableBodyCount === 1 ? "y" : "ies"
      }, ${result.artifact.byteLength} bytes.`
    );
    setProjectMessageTone("info");
  }

  async function openProjectWcad(): Promise<boolean> {
    try {
      const handle = await pickWcadOpenFile(
        window as unknown as WcadFilePickerTargetLike
      );
      const file = await handle.getFile();
      await importProjectWcadBytes(
        await readBytesFromWcadFile(file),
        file.name ?? handle.name ?? DEFAULT_WCAD_PROJECT_FILE_NAME,
        "wcadHandle",
        handle
      );

      return true;
    } catch (error) {
      if (isFilePickerAbort(error)) {
        setProjectFile((current) =>
          createProjectFileCancelledState(current, "open")
        );
        setProjectMessage("Open .wcad was cancelled.");
        setProjectMessageTone("info");
        return true;
      }

      if (projectStorageCapabilities.wcadUploadAvailable) {
        setProjectFile((current) =>
          createProjectFileFailureState(current, {
            operation: "open",
            message: "Direct open failed; use upload fallback.",
            detail: error instanceof Error ? error.message : "Open failed."
          })
        );
        setProjectMessage("Direct open failed; choose a .wcad file to upload.");
        setProjectMessageTone("error");
        return false;
      }

      setProjectFile((current) =>
        createProjectFileFailureState(current, {
          operation: "open",
          message: "Could not open .wcad package.",
          detail: error instanceof Error ? error.message : "Open failed."
        })
      );
      setProjectMessage(
        error instanceof Error ? error.message : "Could not open .wcad package."
      );
      setProjectMessageTone("error");
      return true;
    }
  }

  async function importProjectWcadBytes(
    bytes: Uint8Array,
    fileName: string,
    mode: "wcadHandle" | "uploadedFallback",
    handle?: WcadFileHandleLike
  ) {
    const result = await readCadProjectWcad(bytes);

    setProjectFile((current) =>
      createProjectFileStateFromRead(result, {
        current,
        mode,
        fileName
      })
    );

    if (!result.ok) {
      setProjectMessage("Could not open .wcad package.");
      setProjectMessageTone("error");
      return;
    }

    engine.loadProject(result.project);
    setProjectFileHandle(handle);
    setCommandError(undefined);
    setSelectedGeneratedReference(undefined);
    setProjectJson("");
    setProjectJsonDraftSource({ kind: "empty" });
    setProjectMessage(`Opened ${fileName}.`);
    setProjectMessageTone("info");
    syncDocument(undefined);
  }

  async function saveProjectWcad() {
    if (projectFileHandle && projectFile.mode === "wcadHandle") {
      await saveProjectWcadToHandle(projectFileHandle, "save");
      return;
    }

    await saveProjectWcadAs();
  }

  async function exportProjectWcadForSave(): Promise<WcadPackageExportResult> {
    const timestamp = new Date().toISOString();

    return exportProjectWcadWithTopologyCheckpoints({
      engine,
      features: projectStructure.features,
      sketches,
      generatedFacesByKey,
      runtime: getDerivedGeometryRuntime(),
      createdAt: timestamp,
      modifiedAt: timestamp
    });
  }

  function getProjectWcadSaveFailureDiagnostics(
    error: unknown
  ): readonly WcadPackageValidationIssue[] | undefined {
    if (isProjectWcadTopologyCheckpointPayloadError(error)) {
      return error.issues;
    }

    if (error instanceof WcadPackageImportError) {
      return error.issues;
    }

    return undefined;
  }

  async function saveProjectWcadAs() {
    try {
      const exported = await exportProjectWcadForSave();

      if (projectStorageCapabilities.fileSystemAccessAvailable) {
        try {
          const handle = await pickWcadSaveFile(
            window as unknown as WcadFilePickerTargetLike,
            ensureWcadFileExtension(projectFile.fileName ?? "")
          );
          await writeBytesToWcadHandle(handle, exported.bytes);
          setProjectFileHandle(handle);
          setProjectFile(
            createProjectFileStateFromExport(exported, {
              mode: "wcadHandle",
              fileName: handle.name ?? DEFAULT_WCAD_PROJECT_FILE_NAME,
              operation: "saveAs"
            })
          );
          setProjectMessage(`Saved ${handle.name ?? "project.wcad"}.`);
          setProjectMessageTone("info");
          return;
        } catch (error) {
          if (isFilePickerAbort(error)) {
            setProjectFile((current) =>
              createProjectFileCancelledState(current, "saveAs")
            );
            setProjectMessage("Save As .wcad was cancelled.");
            setProjectMessageTone("info");
            return;
          }

          if (!projectStorageCapabilities.wcadDownloadAvailable) {
            throw error;
          }

          downloadWcadPackage(exported.bytes, DEFAULT_WCAD_PROJECT_FILE_NAME);
          setProjectFileHandle(undefined);
          setProjectFile(
            createProjectFileStateFromExport(exported, {
              mode: "downloadedFallback",
              fileName: DEFAULT_WCAD_PROJECT_FILE_NAME,
              operation: "saveAs"
            })
          );
          setProjectMessage(
            "Direct Save As failed; downloaded .wcad fallback."
          );
          setProjectMessageTone("error");
          return;
        }
      }

      if (!projectStorageCapabilities.wcadDownloadAvailable) {
        setProjectFile((current) =>
          createProjectFileFailureState(current, {
            operation: "saveAs",
            message: "Could not save .wcad package.",
            detail:
              "This browser runtime is missing direct save and download fallback."
          })
        );
        setProjectMessage("WCAD download is unavailable in this browser.");
        setProjectMessageTone("error");
        return;
      }

      downloadWcadPackage(exported.bytes, DEFAULT_WCAD_PROJECT_FILE_NAME);
      setProjectFileHandle(undefined);
      setProjectFile(
        createProjectFileStateFromExport(exported, {
          mode: "downloadedFallback",
          fileName: DEFAULT_WCAD_PROJECT_FILE_NAME,
          operation: "saveAs"
        })
      );
      setProjectMessage("Downloaded .wcad package.");
      setProjectMessageTone("info");
    } catch (error) {
      setProjectFile((current) =>
        createProjectFileFailureState(current, {
          operation: "saveAs",
          message: "Could not save .wcad package.",
          diagnostics: getProjectWcadSaveFailureDiagnostics(error),
          detail: error instanceof Error ? error.message : "Save failed."
        })
      );
      setProjectMessage(
        error instanceof Error ? error.message : "Could not save .wcad package."
      );
      setProjectMessageTone("error");
    }
  }

  async function saveProjectWcadToHandle(
    handle: WcadFileHandleLike,
    operation: "save" | "saveAs"
  ) {
    let exported: WcadPackageExportResult | undefined;

    try {
      exported = await exportProjectWcadForSave();
      await writeBytesToWcadHandle(handle, exported.bytes);
      setProjectFile(
        createProjectFileStateFromExport(exported, {
          mode: "wcadHandle",
          fileName: handle.name ?? projectFile.fileName,
          operation
        })
      );
      setProjectMessage(`Saved ${handle.name ?? "project.wcad"}.`);
      setProjectMessageTone("info");
    } catch (error) {
      if (projectStorageCapabilities.wcadDownloadAvailable && exported) {
        try {
          downloadWcadPackage(exported.bytes, DEFAULT_WCAD_PROJECT_FILE_NAME);
          setProjectFileHandle(undefined);
          setProjectFile(
            createProjectFileStateFromExport(exported, {
              mode: "downloadedFallback",
              fileName: DEFAULT_WCAD_PROJECT_FILE_NAME,
              operation
            })
          );
          setProjectMessage("Direct save failed; downloaded .wcad fallback.");
          setProjectMessageTone("error");
          return;
        } catch {
          // Fall through to the original direct-save error below.
        }
      }

      setProjectFile((current) =>
        createProjectFileFailureState(current, {
          operation,
          message: "Could not save .wcad package.",
          diagnostics: getProjectWcadSaveFailureDiagnostics(error),
          detail: error instanceof Error ? error.message : "Save failed."
        })
      );
      setProjectMessage(
        error instanceof Error ? error.message : "Could not save .wcad package."
      );
      setProjectMessageTone("error");
    }
  }

  function downloadWcadPackage(bytes: Uint8Array, fileName: string) {
    const packageBytes = new Uint8Array(bytes);
    const blob = new Blob([packageBytes.buffer], { type: WCAD_MIME_TYPE });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = ensureWcadFileExtension(fileName);
    window.document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function loadProjectFile(projectJson: string, fileName: string) {
    setProjectJson(projectJson);
    setProjectJsonDraftSource({ kind: "loadedFile", fileName });
    setProjectMessage(`Loaded ${fileName} for import preview.`);
    setProjectMessageTone("info");
  }

  function importProjectJson() {
    const preview = createProjectJsonPreview(projectJson);

    if (preview.status !== "valid") {
      setProjectMessage(
        preview.status === "invalid"
          ? preview.message
          : "Load or paste valid project JSON before importing."
      );
      setProjectMessageTone("error");
      return;
    }

    engine.loadProject(preview.project);
    setProjectFileHandle(undefined);
    setProjectFile(
      createJsonFallbackProjectFileState(
        "fileName" in projectJsonDraftSource
          ? projectJsonDraftSource.fileName
          : undefined
      )
    );
    setCommandError(undefined);
    setSelectedGeneratedReference(undefined);
    setProjectMessage(`Imported ${formatProjectJsonSummary(preview.summary)}.`);
    setProjectMessageTone("info");
    syncDocument(undefined);
  }

  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <div className="brand-block">
          <img className="brand-mark" src="/favicon.svg" alt="" aria-hidden />
          <div className="brand-copy">
            <h1>Partbench</h1>
          </div>
        </div>
        <div className="toolbar-actions" aria-label="Command controls">
          {commandPending && (
            <span className="pending-status" role="status">
              Updating model
            </span>
          )}
          <div className="toolbar-group toolbar-units">
            <label className="toolbar-field">
              Units
              <select
                value={document.units}
                disabled={commandPending}
                onChange={(event) =>
                  void updateDocumentUnits(
                    event.currentTarget.value as CadDocument["units"]
                  )
                }
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
                <option value="in">in</option>
              </select>
            </label>
            <label className="toolbar-field wide">
              Unit change
              <select
                value={unitUpdateMode}
                disabled={commandPending}
                onChange={(event) =>
                  setUnitUpdateMode(
                    event.currentTarget.value as DocumentUnitUpdateMode
                  )
                }
              >
                <option value="metadataOnly">Relabel values</option>
                <option value="preservePhysicalSize">Convert size</option>
              </select>
            </label>
          </div>
          <div className="toolbar-group quick-create">
            <button
              type="button"
              aria-label="Create box"
              title="Create box"
              onClick={() => void createBox()}
              disabled={commandPending}
            >
              Box
            </button>
            <button
              type="button"
              aria-label="Create cylinder"
              title="Create cylinder"
              onClick={() => void createCylinder()}
              disabled={commandPending}
            >
              Cylinder
            </button>
            <button
              type="button"
              aria-label="Create sphere"
              title="Create sphere"
              onClick={() => void createSphere()}
              disabled={commandPending}
            >
              Sphere
            </button>
            <button
              type="button"
              aria-label="Create cone"
              title="Create cone"
              onClick={() => void createCone()}
              disabled={commandPending}
            >
              Cone
            </button>
            <button
              type="button"
              aria-label="Create torus"
              title="Create torus"
              onClick={() => void createTorus()}
              disabled={commandPending}
            >
              Torus
            </button>
          </div>
          <div className="toolbar-group history-controls">
            <button
              type="button"
              onClick={undo}
              disabled={commandPending || engine.getTransactions().length === 0}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={commandPending || engine.getRedoStack().length === 0}
            >
              Redo
            </button>
          </div>
        </div>
        {commandError && <p className="toolbar-error">{commandError}</p>}
        {commandNotice && !commandError && (
          <p className="toolbar-notice">{commandNotice}</p>
        )}
      </header>

      <section className="workspace" aria-label="CAD workspace">
        <aside className="model-browser-shell" aria-label="Model browser">
          <div
            className="model-browser-tabs"
            role="tablist"
            aria-label="Model browser tabs"
          >
            <button
              id="model-browser-tab-tree"
              type="button"
              role="tab"
              aria-controls="model-browser-panel-tree"
              aria-selected={activeModelBrowserPanel === "tree"}
              className={activeModelBrowserPanel === "tree" ? "active" : ""}
              onClick={() => setActiveModelBrowserPanel("tree")}
            >
              <span>Tree</span>
            </button>
            <button
              id="model-browser-tab-selection"
              type="button"
              role="tab"
              aria-controls="model-browser-panel-selection"
              aria-selected={activeModelBrowserPanel === "selection"}
              className={
                activeModelBrowserPanel === "selection" ? "active" : ""
              }
              onClick={() => setActiveModelBrowserPanel("selection")}
            >
              <span>Selection</span>
            </button>
          </div>

          <div
            id="model-browser-panel-tree"
            role="tabpanel"
            aria-labelledby="model-browser-tab-tree"
            className="model-browser-panel"
            hidden={activeModelBrowserPanel !== "tree"}
          >
            <StructurePanel
              bodies={projectStructure.bodies}
              features={projectStructure.features}
              featureEditability={selectedFeatureEditability}
              focusedSketchId={focusedSketchId}
              generatedReferences={selectedBodyGeneratedReferences.references}
              geometryStatuses={
                derivedGeometryEnabled ? geometryStatusBySourceId : undefined
              }
              health={projectHealth}
              namedReferences={namedReferences}
              namedReferenceCandidatesByName={namedReferenceCandidatesByName}
              objects={sceneObjects}
              parts={projectStructure.parts}
              referenceCandidatesByStableId={referenceCandidatesByStableId}
              selectedId={selectedId}
              selectedGeneratedReference={selectedGeneratedReference}
              sketches={sketches}
              units={document.units}
              onFocusSketch={focusSketch}
              onInspectNamedReference={inspectNamedReference}
              onSelect={selectObject}
              onSelectGeneratedReference={selectGeneratedReference}
            />
          </div>

          <div
            id="model-browser-panel-selection"
            role="tabpanel"
            aria-labelledby="model-browser-tab-selection"
            className="model-browser-panel selection-browser-panel"
            hidden={activeModelBrowserPanel !== "selection"}
          >
            <Inspector
              disabled={commandPending}
              measurements={selectedMeasurements}
              bodyMeasurements={selectedBodyMeasurements.measurements}
              bodyMeasurementsError={selectedBodyMeasurements.error}
              bodyTopology={selectedBodyTopology.topology}
              bodyTopologyError={selectedBodyTopology.error}
              bodyTopologyExactMetadataStatus={
                selectedBodyTopology.exactMetadataStatus
              }
              body={selectedBody}
              featureEditability={selectedFeatureEditability}
              feature={selectedFeature}
              generatedReferences={selectedBodyGeneratedReferences.references}
              generatedReferencesError={selectedBodyGeneratedReferences.error}
              generatedReferenceMeasurements={
                selectedGeneratedReferenceMeasurements
              }
              namedReferences={namedReferences}
              namedReferenceHealthByName={namedReferenceHealthByName}
              namedReferenceCandidatesByName={namedReferenceCandidatesByName}
              object={selectedObject}
              referenceCandidatesByStableId={referenceCandidatesByStableId}
              selectedGeneratedReference={selectedGeneratedReference}
              selectedNamedReferenceName={selectedNamedReferenceName}
              selectionReferenceCandidates={
                selectedSelectionReferenceCandidates
              }
              units={document.units}
              onApplyDimensions={(form) => void updateSelectedDimensions(form)}
              onApplyName={(name) => void renameSelectedObject(name)}
              onApplyTransform={(form) => void updateSelectedTransform(form)}
              onDelete={() => void deleteSelectedObject()}
              onDeleteFeature={(featureId) =>
                void deleteAuthoredFeature(featureId)
              }
              onCreateSketchOnFace={(form) => void createSketchOnFace(form)}
              onCreateEdgeFinish={(operation, form) =>
                void createEdgeFinish(operation, form)
              }
              onDeleteNamedReference={(name) => void deleteNamedReference(name)}
              onNameGeneratedReference={(name, target) =>
                void nameGeneratedReference(name, target)
              }
              onCreateTopologyAnchor={(target) =>
                void createStableTopologyReference(target)
              }
              onRepairTopologyAnchor={(target) =>
                void repairStableTopologyReference(target)
              }
              onRepairTopologyAnchorCandidate={(target, candidateId) =>
                void repairStableTopologyReference(target, candidateId)
              }
              onPreviewTopologyAnchorRepair={(target) =>
                void previewStableTopologyRepair(target)
              }
              onRepairNamedReference={(name, target) =>
                void repairNamedReference(name, target)
              }
              onInspectNamedReference={inspectNamedReference}
              onSelectGeneratedReference={(selection) => {
                setSelectedGeneratedReference(selection);
                setViewportPickIntent(undefined);
                setViewportHoverPick(undefined);
              }}
              onUpdateExtrude={(featureId, depth, side) =>
                void updateAuthoredExtrude(featureId, depth, side)
              }
              onUpdateRevolve={(featureId, angleDegrees) =>
                void updateAuthoredRevolve(featureId, angleDegrees)
              }
              onUpdateHole={(featureId, depthMode, depth, direction) =>
                void updateAuthoredHole(featureId, depthMode, depth, direction)
              }
              onUpdateChamfer={(featureId, distance) =>
                void updateAuthoredChamfer(featureId, distance)
              }
              onUpdateFillet={(featureId, radius) =>
                void updateAuthoredFillet(featureId, radius)
              }
              topologyRepairPreview={topologyRepairPreview}
            />
          </div>
        </aside>

        <ViewportCanvas
          primitives={renderScene.primitives}
          meshes={renderScene.meshes}
          selectedId={selectedViewportRenderId}
          visualStates={viewportVisualState.rendererVisualStates}
          status={viewportVisualState.status}
          contextualSurface={
            <ViewportContextualCommandSurface
              disabled={commandPending}
              surface={viewportContextualCommandSurface}
              interactionSurface={viewportInteractionSurface}
              twoTargetMeasurement={viewportTwoTargetMeasurement}
              onClearTwoTargetMeasurement={clearViewportTwoTargetMeasurement}
              onContinueInModeling={runViewportContextualCommand}
              onNameReference={nameViewportContextualReference}
              onRunCommand={runViewportContextualCommand}
              onSetSecondTwoTargetMeasurement={
                setSecondViewportTwoTargetMeasurement
              }
              onStartTwoTargetMeasurement={startViewportTwoTargetMeasurement}
              onSelectReference={selectGeneratedReference}
            />
          }
          onHover={hoverViewportPick}
          onSelect={selectViewportPick}
          onCancelTransientState={clearViewportTransientState}
          sketchOverlay={({ camera, size }) =>
            sketchViewportDragTarget ? (
              <SketchViewportDragOverlay
                camera={camera}
                disabled={commandPending}
                displayFrame={sketchDisplayState.frames.get(
                  sketchViewportDragTarget.sketch.id
                )}
                selectedEntityId={sketchViewportDragTarget.entityId}
                size={size}
                sketch={sketchViewportDragTarget.sketch}
                onCommitEntity={(sketchId, entity) =>
                  void updateSketchEntity(sketchId, entity)
                }
                onPreviewEntity={previewSketchEntityUpdate}
              />
            ) : null
          }
        />

        <div className="right-rail" aria-label="Project and modeling tools">
          <ModelingActionsPanel
            actions={modelingActions}
            addTargetBodies={addTargetBodyOptions}
            context={modelingSelectionContext}
            cutTargetBodies={cutTargetBodyOptions}
            disabled={commandPending}
            holeTargetBodies={holeTargetBodyOptions}
            namedReferences={namedReferences}
            namedReferenceHealthByName={namedReferenceHealthByName}
            selectedNamedReferenceName={selectedNamedReferenceName}
            sketches={sketches}
            onAddEntity={(sketchId, kind, form) =>
              void addSketchEntity(sketchId, kind, form)
            }
            onCreateConstraint={(sketchId, entityId, form) =>
              void createSketchConstraint(sketchId, entityId, form)
            }
            onCreateDimension={(sketchId, entityId, target, form) =>
              void createSketchDimension(sketchId, entityId, target, form)
            }
            onCreateEdgeFinish={(operation, form) =>
              void createEdgeFinish(operation, form)
            }
            onCreateSideHoleSketch={(form, targetBodyId) =>
              void createSideHoleSketch(form, targetBodyId)
            }
            onCreateSketch={(form) => void createSketch(form)}
            onCreateSketchOnFace={(form) => void createSketchOnFace(form)}
            onExtrudeEntity={(sketchId, entityId, form) =>
              void extrudeSketchEntity(sketchId, entityId, form)
            }
            onHoleEntity={(sketchId, entityId, form) =>
              void holeSketchEntity(sketchId, entityId, form)
            }
            onNameGeneratedReference={(name, target) =>
              void nameGeneratedReference(name, target)
            }
            onRepairNamedReference={(name, target) =>
              void repairNamedReference(name, target)
            }
            onSelectBody={selectObject}
            onDeleteFeature={(featureId) =>
              void deleteAuthoredFeature(featureId)
            }
            onDeleteEntity={(sketchId, entityId) =>
              void deleteSketchEntity(sketchId, entityId)
            }
            onDeleteSketch={(sketchId) => void deleteSketch(sketchId)}
            onRenameSketch={(sketchId, name) =>
              void renameSketch(sketchId, name)
            }
            onRevolveEntity={(sketchId, entityId, form) =>
              void revolveSketchEntity(sketchId, entityId, form)
            }
            onSelectSketch={focusSketch}
            onUpdateEntity={(sketchId, entity) =>
              void updateSketchEntity(sketchId, entity)
            }
          />

          <details className="project-file-drawer">
            <summary>
              <span>Project/File</span>
              <small>
                {getProjectFileNameLabel(projectFile)} ·{" "}
                {getProjectFileDirtyLabel(projectFile)}
              </small>
            </summary>

            <ProjectJsonPanel
              disabled={commandPending}
              exportReadiness={projectExportReadiness}
              topologyIdentityReadiness={projectTopologyIdentityReadiness}
              visualizationDownloadAvailable={
                projectStorageCapabilities.jsonDownloadAvailable
              }
              visualizationExport={visualizationMeshExportStatus}
              projectJson={projectJson}
              projectFile={projectFile}
              opfsCacheStatus={projectOpfsCacheStatus}
              storageCapabilities={projectStorageCapabilities}
              workflow={projectJsonWorkflow}
              message={projectMessage}
              messageTone={projectMessageTone}
              onOpenWcad={openProjectWcad}
              onOpenWcadFileLoaded={(bytes, fileName) =>
                void importProjectWcadBytes(bytes, fileName, "uploadedFallback")
              }
              onProjectJsonChange={(value) => {
                setProjectJson(value);
                setProjectJsonDraftSource(
                  createProjectJsonDraftSourceForEditorValue(value)
                );
                setProjectMessage(undefined);
              }}
              onProjectFileLoaded={loadProjectFile}
              onProjectFileError={(message) => {
                setProjectMessage(message);
                setProjectMessageTone("error");
              }}
              onRefreshOpfsCache={() => void refreshProjectOpfsCache(true)}
              onClearOpfsCache={() => void clearProjectOpfsCache()}
              onSaveWcad={() => void saveProjectWcad()}
              onSaveAsWcad={() => void saveProjectWcadAs()}
              onExport={exportProjectJson}
              onDownload={downloadProjectJson}
              onDownloadStep={() => void downloadExactStepExport()}
              onDownloadVisualization={downloadVisualizationMeshExport}
              onImport={importProjectJson}
            />
          </details>

          <details className="advanced-tools-drawer">
            <summary>
              <span>Workspace tools</span>
              <small>Sketches, log</small>
            </summary>

            <section className="utility-dock" aria-label="Workspace tools">
              <div
                className="utility-tabs"
                role="tablist"
                aria-label="Tool tabs"
              >
                {utilityPanels.map((panel) => (
                  <button
                    key={panel.id}
                    id={`utility-tab-${panel.id}`}
                    type="button"
                    role="tab"
                    aria-controls={`utility-panel-${panel.id}`}
                    aria-selected={activeUtilityPanel === panel.id}
                    className={activeUtilityPanel === panel.id ? "active" : ""}
                    onClick={() => setActiveUtilityPanel(panel.id)}
                  >
                    <span>{panel.label}</span>
                  </button>
                ))}
              </div>

              <div className="utility-panels">
                <div
                  id="utility-panel-sketches"
                  role="tabpanel"
                  aria-labelledby="utility-tab-sketches"
                  className="utility-panel"
                  hidden={activeUtilityPanel !== "sketches"}
                >
                  <SketchPanel
                    key={focusedSketchId ?? "sketch-panel"}
                    disabled={commandPending}
                    sketches={sketches}
                    parameters={parameters}
                    sketchDimensionsBySketchId={sketchDimensionsBySketchId}
                    sketchEvaluationsBySketchId={sketchEvaluationsBySketchId}
                    sketchSolverStatusesBySketchId={
                      sketchSolverStatusesBySketchId
                    }
                    addTargetBodies={addTargetBodyOptions}
                    cutTargetBodies={cutTargetBodyOptions}
                    holeTargetBodies={holeTargetBodyOptions}
                    displayStatuses={sketchDisplayState.statuses}
                    focusedSketchId={focusedSketchId}
                    focusedEntityId={selectedSketchContext?.entityId}
                    features={projectStructure.features}
                    onCreateSketch={(form) => void createSketch(form)}
                    onCreateParameter={(form) => void createParameter(form)}
                    onApplyParameterEdit={(parameter, form) =>
                      void applyParameterEdit(parameter, form)
                    }
                    onDeleteParameter={(parameterId) =>
                      void deleteParameter(parameterId)
                    }
                    onRenameSketch={(sketchId, name) =>
                      void renameSketch(sketchId, name)
                    }
                    onDeleteSketch={(sketchId) => void deleteSketch(sketchId)}
                    onAddEntity={(sketchId, kind, form) =>
                      void addSketchEntity(sketchId, kind, form)
                    }
                    onUpdateEntity={(sketchId, entity) =>
                      void updateSketchEntity(sketchId, entity)
                    }
                    onDeleteEntity={(sketchId, entityId) =>
                      void deleteSketchEntity(sketchId, entityId)
                    }
                    onCreateDimension={(sketchId, entityId, target, form) =>
                      void createSketchDimension(
                        sketchId,
                        entityId,
                        target,
                        form
                      )
                    }
                    onApplyDimensionEdit={(dimension, form) =>
                      void applySketchDimensionEdit(dimension, form)
                    }
                    onDeleteDimension={(dimensionId) =>
                      void deleteSketchDimension(dimensionId)
                    }
                    onCreateConstraint={(sketchId, entityId, form) =>
                      void createSketchConstraint(sketchId, entityId, form)
                    }
                    onApplyConstraintEdit={(constraint, form) =>
                      void applySketchConstraintEdit(constraint, form)
                    }
                    onDeleteConstraint={(constraintId) =>
                      void deleteSketchConstraint(constraintId)
                    }
                    onExtrudeEntity={(sketchId, entityId, form) =>
                      void extrudeSketchEntity(sketchId, entityId, form)
                    }
                    onRevolveEntity={(sketchId, entityId, form) =>
                      void revolveSketchEntity(sketchId, entityId, form)
                    }
                    onHoleEntity={(sketchId, entityId, form) =>
                      void holeSketchEntity(sketchId, entityId, form)
                    }
                    onSelectionContextChange={setSelectedSketchContext}
                  />
                </div>

                <div
                  id="utility-panel-history"
                  role="tabpanel"
                  aria-labelledby="utility-tab-history"
                  className="utility-panel"
                  hidden={activeUtilityPanel !== "history"}
                >
                  <HistoryPanel transactions={transactionHistory} />
                </div>
              </div>
            </section>
          </details>
        </div>
      </section>
    </main>
  );
}
