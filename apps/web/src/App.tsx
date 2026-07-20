import {
  AsyncCadCommandExecutor,
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  readCadProjectWcad,
  WcadPackageImportError,
  type CadBodySnapshot,
  type CadBodyTopologySnapshot,
  type CadAsyncBatchResponse,
  type CadDocument,
  type CadFeatureSummary,
  type CadPartSnapshot,
  type CadTransactionHistoryEntry,
  type WcadTopologyCheckpointPayload,
  type WcadTopologyCheckpointPayloadInput,
  type WcadPackageExportResult,
  type BodyMeasurementsSnapshot,
  type ObjectMeasurementsSnapshot
} from "@web-cad/cad-core";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadBodyGeneratedReferenceEvidenceSnapshot,
  CadBatchResponse,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadSelectionReferenceOperation,
  CadSelectionReferenceInput,
  CadParameterSnapshot,
  CadTopologyIdentitySourceSnapshot,
  CadMassPropertiesSnapshot,
  GeneratedReferenceMeasurement,
  NamedGeneratedReferenceEntry,
  CadOp,
  DocumentUnitUpdateMode,
  FeatureHoleDepthMode,
  FeatureHoleDirection,
  ProjectHealthQueryResponse,
  ProjectImportReadinessQueryResponse,
  ProjectParameterEvaluationQueryResponse,
  ProjectTopologyIdentityReadinessQueryResponse,
  ReferenceHealthQueryResponse,
  SelectionReferenceCandidatesQueryResponse,
  TopologyCommandTargetReadinessQueryResponse,
  SketchDimensionEntry,
  SketchDimensionTarget,
  SketchConstraintEntry,
  SketchEvaluationQueryResponse,
  SketchSolverStatusQueryResponse,
  SketchPathCandidatesQueryResponse,
  SketchProfileCandidatesQueryResponse,
  WcadPackageValidationIssue,
  SketchEntitySnapshot,
  SketchSnapshot,
  SketchPathRef,
  SketchProfileRef,
  Vec2
} from "@web-cad/cad-protocol";
import { createDerivedGeometryRuntime } from "@web-cad/derived-geometry-runtime";
import {
  useCallback,
  useEffect,
  lazy,
  useMemo,
  useReducer,
  useRef,
  Suspense,
  useState
} from "react";
import {
  buildBatch,
  buildAddSketchArcOp,
  buildAddSketchThreePointArcOp,
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
  buildFeatureCircularPatternOp,
  buildFeatureExtrudeOp,
  buildFeatureCompositeExtrudeOp,
  buildFeatureFilletOp,
  buildFeatureHoleOp,
  buildFeatureLinearPatternOp,
  buildFeatureMirrorOp,
  buildFeatureRevolveOp,
  buildFeatureCompositeRevolveOp,
  buildFeatureShellOp,
  buildFeatureSweepOp,
  buildFeatureCompositeSweepOp,
  buildFeatureLoftOp,
  buildFeatureUpdateChamferOp,
  buildFeatureUpdateCircularPatternOp,
  buildFeatureUpdateCompositeExtrudeOp,
  buildFeatureUpdateFilletOp,
  buildFeatureUpdateHoleOp,
  buildFeatureUpdateLinearPatternOp,
  buildFeatureUpdateMirrorOp,
  buildFeatureUpdateCompositeRevolveOp,
  buildFeatureUpdateCompositeSweepOp,
  buildFeatureUpdateShellOp,
  buildNameGeneratedReferenceOp,
  buildParameterEditOps,
  buildRepairNamedReferenceOp,
  buildRepairNamedReferenceToTopologyAnchorOp,
  buildRenameObjectOp,
  buildRenameSketchOp,
  buildSketchConstraintEditOps,
  buildSketchDimensionEditOps,
  buildUpdateSketchEntityOp,
  buildSetSketchEntityConstructionOp,
  buildUpdateBoxDimensionsOp,
  buildUpdateConeDimensionsOp,
  buildUpdateCylinderDimensionsOp,
  buildUpdateSphereDimensionsOp,
  buildUpdateTorusDimensionsOp,
  buildUpdateUnitsOp,
  buildUpdateTransformOp,
  WEB_UI_ACTOR,
  type FeatureEdgeFinishForm,
  type FeatureCircularPatternEdit,
  type FeatureCircularPatternForm,
  type FeatureExtrudeForm,
  type FeatureCompositeExtrudeForm,
  type FeatureHoleForm,
  type FeatureLinearPatternEdit,
  type FeatureLinearPatternForm,
  type FeatureMirrorEdit,
  type FeatureMirrorForm,
  type FeatureRevolveForm,
  type FeatureCompositeRevolveForm,
  type FeatureShellEdit,
  type FeatureShellForm,
  type FeatureSweepForm,
  type FeatureCompositeSweepForm,
  type FeatureLoftForm,
  type ParameterCreateForm,
  type ParameterEditForm,
  type SketchConstraintForm,
  type PrimitiveCommandForm,
  type SketchDimensionForm,
  type SketchCreateOnFaceForm,
  type SketchCreateForm,
  type SketchEntityForm,
  type CreatableSketchEntityKind,
  type TransformCommandForm
} from "./cadCommands";
import type { EdgeFinishOperation } from "./edgeFinishUi";
import { LazyCadCommandWorker } from "./lazyCadCommandWorker";
import {
  invokeUiAction,
  projectUiActions,
  type UiActionAvailabilityProjection,
  type UiActionContext,
  type UiActionId
} from "./actions/actionRegistry";
import { CommandSearchDialog } from "./actions/CommandSearchDialog";
import {
  markPartbenchPerformance,
  PARTBENCH_PERFORMANCE_MARKS
} from "./workbench/performanceMarks";
import { GlobalHeader } from "./workbench/GlobalHeader";
import { ModeRibbon } from "./workbench/ModeRibbon";
import { StatusBar } from "./workbench/StatusBar";
import { WorkbenchShell } from "./workbench/WorkbenchShell";
import type {
  InspectHealthProjection,
  InspectMeasurementsProjection,
  InspectMetricProjection,
  InspectReferenceProjection,
  InspectSelectionProjection
} from "./modes/inspect/InspectPanel";
import {
  createPrimitiveDraft,
  createSketchDraft,
  createTransformDraft,
  type SolidChoice,
  type SolidEditorRequest,
  type SolidEditorSubmission
} from "./modes/solid";
import { applyCommittedSolidEditorSubmission } from "./modes/solid/solidEditorApply";
import {
  createInitialWorkbenchUiState,
  workbenchReducer
} from "./state/workbenchReducer";
import {
  loadWorkbenchUiPreferences,
  saveWorkbenchUiPreferences
} from "./state/uiPreferences";
import { SketchArcToolOverlay } from "./components/SketchArcToolOverlay";
import { SketchViewportDragOverlay } from "./components/SketchViewportDragOverlay";
import { DocumentTreeDock } from "./workbench/DocumentTreeDock";
import {
  createDocumentTreeProjection,
  documentTreeSelectionKey,
  type DocumentTreeRowCapabilities,
  type DocumentTreeSelection
} from "./workbench/documentTreeProjection";
import { ContextualActionStrip } from "./workbench/ContextualActionStrip";
import {
  VIEWPORT_COMMAND_EVENT,
  ViewportCanvas,
  type ViewportCanvasPick,
  type ViewportCommand
} from "./components/ViewportCanvas";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createEmptyDerivedGeometrySnapshot,
  DerivedGeometryService,
  type DerivedGeometrySource,
  type DerivedGeometrySnapshot
} from "./derivedGeometry";
import { createBodyGeneratedReferenceEvidence } from "./derivedGeneratedReferences";
import {
  createDerivedMeshOpfsCache,
  DERIVED_MESH_CACHE_ARTIFACT_VERSION,
  type DerivedMeshCacheContext
} from "./derivedMeshOpfsCache";
import {
  createVisualizationMeshExportArtifact,
  createVisualizationMeshExportStatus
} from "./visualizationMeshExport";
import {
  createBodyTopologyDerivedExactMetadataSnapshot,
  createEmptyDerivedExactMetadataSnapshot,
  createImportedBodyExactMetadataSources,
  DerivedExactMetadataService,
  formatDerivedExactMetadataEntryStatus,
  getCurrentDerivedExactMetadataEntryForBody,
  isExactMetadataSource,
  type DerivedExactMetadataSource,
  type DerivedExactMetadataSnapshot
} from "./derivedExactMetadata";
import {
  createCurrentDerivedExactMetadataSnapshots,
  readProjectExactStepExport,
  readProjectExportReadiness
} from "./projectExactExportQueries";
import {
  createAuthoredFeatureDerivedGeometrySources,
  createDerivedGeometrySourcesFromDocument
} from "./derivedGeometrySources";
import { preflightHoleGeometryCommand } from "./holeGeometryPreflight";
import {
  createBodyMeasurementRows,
  formatArea,
  formatBodyMeasurementError,
  formatBodyTopologyStatus,
  formatBodyTopologyError,
  formatBounds,
  formatDimensions,
  formatObjectKind,
  formatVector,
  formatVolume
} from "./sceneObjectDisplay";
import { createQuickStartSourceBodyPlan } from "./quickStartBodies";
import { createRenderSceneInputs } from "./renderScene";
import { createModelingResultState } from "./modelingResultState";
import {
  createDefaultSketchDisplayFrame,
  createGeneratedFaceReferenceKey,
  createSketchDisplayState
} from "./sketchDisplayFrames";
import {
  createSketchViewportProjectionBasis,
  mapViewportPointToSketchPoint
} from "./sketchViewportDrag";
import {
  captureThreePointArcToolPoint,
  createThreePointArcToolSession,
  getThreePointArcDefinition,
  updateThreePointArcToolHover,
  type ThreePointArcToolSession
} from "./v17ProductIntegration";
import {
  formatGeneratedReferenceMeasurementError,
  formatGeneratedReferenceKind,
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
import {
  createProjectStepImportPayloadStore,
  createProjectStepImportResolver
} from "./projectStepImportResolver";
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
  formatSketchSolverStatus,
  getParameterDimensionUsageCount,
  type SketchPanelSelectionContext
} from "./sketchPanelUi";
import { createSketchModelingSelectionContext } from "./sketchModelingSelectionContext";
import {
  createNamedReferenceHealthByName,
  formatNamedReferenceRepairBatchError,
  formatNamedReferenceRepairBatchMessage
} from "./namedReferenceRepairUi";
import "./styles/base.css";
import "./styles/viewport.css";

const InspectPanel = lazy(() =>
  import("./modes/inspect/InspectPanel").then((module) => ({
    default: module.InspectPanel
  }))
);
const SolidModePanel = lazy(() =>
  import("./modes/solid").then((module) => ({
    default: module.SolidModePanel
  }))
);
const ProjectWorkspace = lazy(() =>
  import("./modes/project/ProjectWorkspace").then((module) => ({
    default: module.ProjectWorkspace
  }))
);
const SketchModeDock = lazy(() =>
  import("./modes/sketch").then((module) => ({
    default: module.SketchModeDock
  }))
);

const engine = new CadEngine();
const derivedGeometryEnabled = __PARTBENCH_DERIVED_GEOMETRY_ENABLED__;
const supportedOpfsCacheArtifactVersions = [
  DERIVED_MESH_CACHE_ARTIFACT_VERSION
] as const;

function createWcadTopologyCheckpointPayloadInputCache(
  payloads: readonly WcadTopologyCheckpointPayload[] | undefined
): readonly WcadTopologyCheckpointPayloadInput[] {
  return (
    payloads?.map((payload) => ({
      checkpointId: payload.checkpointId,
      bodyId: payload.bodyId,
      ...(payload.sourceFeatureId
        ? { sourceFeatureId: payload.sourceFeatureId }
        : {}),
      units: payload.manifestEntry.units,
      kernel: payload.manifestEntry.kernel,
      tolerance: payload.manifestEntry.tolerance,
      brepBytes: payload.brepBytes,
      topologyBytes: payload.topologyBytes,
      signatureBytes: payload.signatureBytes
    })) ?? []
  );
}

function mergeWcadTopologyCheckpointPayloadInputCache(
  current: readonly WcadTopologyCheckpointPayloadInput[],
  incoming: readonly WcadTopologyCheckpointPayloadInput[] | undefined
): readonly WcadTopologyCheckpointPayloadInput[] {
  if (!incoming || incoming.length === 0) {
    return current;
  }

  const payloadsByCheckpointId = new Map(
    current.map((payload) => [payload.checkpointId, payload])
  );

  for (const payload of incoming) {
    payloadsByCheckpointId.set(payload.checkpointId, payload);
  }

  return [...payloadsByCheckpointId.values()];
}

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

function readBodySourceIdentitySignatures(
  bodyIds: Iterable<string>
): ReadonlyMap<string, string> {
  const signatures = new Map<string, string>();

  for (const bodyId of bodyIds) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId }
    });
    if (response.ok && response.query === "body.topology") {
      signatures.set(bodyId, response.topology.sourceIdentity.signature);
    }
  }

  return signatures;
}

function readProjectHealth(
  exactMetadata: DerivedExactMetadataSnapshot,
  currentSources: readonly DerivedExactMetadataSource[]
): ProjectHealthQueryResponse {
  const derivedExactMetadata = createCurrentDerivedExactMetadataSnapshots(
    engine,
    exactMetadata,
    currentSources
  );
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
        authoredShellCount: 0,
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
        authoredShells: [],
        attachedSketches: [],
        sketchEvaluations: [],
        sketchDimensions: [],
        sketchConstraints: [],
        namedReferences: []
      };
}

function readProjectImportReadiness():
  | ProjectImportReadinessQueryResponse
  | undefined {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.importReadiness" }
  });

  return response.ok && response.query === "project.importReadiness"
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

function formatStepImportDryRunPreview(
  fileName: string,
  response: CadAsyncBatchResponse,
  units: CadDocument["units"]
): string {
  const bodyCount = response.ok ? (response.createdBodyIds?.length ?? 0) : 0;
  const previewBodies = response.importedStepPreviewBodies ?? [];
  const checkpointCount = response.importedStepCheckpointPayloads?.length ?? 0;
  const diagnostics = response.importedStepDiagnostics ?? [];
  const lines = [
    `Import ${fileName}?`,
    "",
    `Bodies: ${bodyCount}`,
    `Shape evidence records: ${checkpointCount}`
  ];

  if (previewBodies.length > 0) {
    lines.push("", "Bounding boxes:");
    for (const body of previewBodies) {
      const label = body.name ?? body.bodyId;
      lines.push(
        `- ${label}: min ${formatStepImportVec3(body.bounds.min, units)}; max ${formatStepImportVec3(
          body.bounds.max,
          units
        )}; size ${formatStepImportVec3(body.bounds.size, units)}`
      );
    }
  } else {
    lines.push("", "Bounding boxes: unavailable");
  }

  if (diagnostics.length > 0) {
    lines.push("", "Diagnostics:");
    for (const diagnostic of diagnostics.slice(0, 6)) {
      lines.push(`- ${diagnostic.message}`);
    }
    if (diagnostics.length > 6) {
      lines.push(`- ${diagnostics.length - 6} more diagnostic(s)`);
    }
  } else {
    lines.push("", "Diagnostics: none reported");
  }

  return lines.join("\n");
}

function formatStepImportVec3(
  values: readonly [number, number, number],
  units: CadDocument["units"]
): string {
  return `${values.map(formatStepImportNumber).join(", ")} ${units}`;
}

function formatStepImportNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "unknown";
  }

  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(3).replace(/\.?0+$/, "");
}

function readBodyGeneratedReferences(
  bodyId: string | undefined,
  derivedEvidence?: CadBodyGeneratedReferenceEvidenceSnapshot
): {
  readonly references?: BodyGeneratedReferencesQueryResponse;
  readonly error?: string;
} {
  if (!bodyId) {
    return {};
  }

  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "body.generatedReferences",
      bodyId,
      ...(derivedEvidence
        ? { derivedGeneratedReferences: derivedEvidence }
        : {})
    }
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

function readParameterEvaluation():
  | ProjectParameterEvaluationQueryResponse
  | undefined {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.parameterEvaluation" }
  });

  return response.ok && response.query === "project.parameterEvaluation"
    ? response
    : undefined;
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
  exactMetadata: DerivedExactMetadataSnapshot,
  currentExactMetadataSource: DerivedExactMetadataSource | undefined
): {
  readonly topology?: CadBodyTopologySnapshot;
  readonly error?: string;
  readonly exactMetadataStatus?: string;
} {
  if (!bodyId) {
    return {};
  }

  const exactMetadataEntry = getCurrentDerivedExactMetadataEntryForBody(
    exactMetadata,
    bodyId,
    currentExactMetadataSource
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

function readBodyMassProperties(
  bodyId: string,
  topology: CadBodyTopologySnapshot | undefined,
  exactMetadata: DerivedExactMetadataSnapshot,
  currentExactMetadataSource: DerivedExactMetadataSource | undefined
): {
  readonly massProperties?: CadMassPropertiesSnapshot;
  readonly error?: string;
} {
  const entry = getCurrentDerivedExactMetadataEntryForBody(
    exactMetadata,
    bodyId,
    currentExactMetadataSource
  );
  const derivedExactMetadata = topology
    ? createBodyTopologyDerivedExactMetadataSnapshot(
        entry,
        topology.sourceIdentity.signature
      )
    : undefined;
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "body.massProperties",
      bodyId,
      ...(derivedExactMetadata ? { derivedExactMetadata } : {})
    }
  });

  return response.ok && response.query === "body.massProperties"
    ? { massProperties: response.massProperties }
    : response.ok
      ? { error: "Mass properties are unavailable." }
      : { error: response.error.message };
}

function readGeneratedFaceReferencesByKey(
  bodies: readonly CadBodySnapshot[],
  evidenceByBodyId: ReadonlyMap<
    string,
    CadBodyGeneratedReferenceEvidenceSnapshot
  > = new Map()
): ReadonlyMap<string, CadGeneratedFaceReference> {
  const facesByKey = new Map<string, CadGeneratedFaceReference>();

  for (const body of bodies) {
    const response = readBodyGeneratedReferences(
      body.id,
      evidenceByBodyId.get(body.id)
    );

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
  bodies: readonly CadBodySnapshot[],
  evidenceByBodyId: ReadonlyMap<
    string,
    CadBodyGeneratedReferenceEvidenceSnapshot
  > = new Map()
): ReadonlyMap<string, CadGeneratedEdgeReference> {
  const edgesByKey = new Map<string, CadGeneratedEdgeReference>();

  for (const body of bodies) {
    const response = readBodyGeneratedReferences(
      body.id,
      evidenceByBodyId.get(body.id)
    );

    for (const edge of response.references?.edges ?? []) {
      edgesByKey.set(`${edge.bodyId}\n${edge.stableId}`, edge);
    }
  }

  return edgesByKey;
}

function createDerivedGeneratedReferenceEvidenceByBodyId(
  snapshot: DerivedGeometrySnapshot,
  sources: readonly DerivedGeometrySource[]
): ReadonlyMap<string, CadBodyGeneratedReferenceEvidenceSnapshot> {
  const evidenceByBodyId = new Map<
    string,
    CadBodyGeneratedReferenceEvidenceSnapshot
  >();

  for (const source of sources) {
    if (source.kind !== "extrude" || source.profile.kind !== "wire") {
      continue;
    }

    const topology = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: source.id }
    });
    if (!topology.ok || topology.query !== "body.topology") {
      continue;
    }

    const evidence = createBodyGeneratedReferenceEvidence(
      source.id,
      topology.topology.sourceIdentity.signature,
      snapshot,
      sources
    );
    if (evidence) {
      evidenceByBodyId.set(source.id, evidence);
    }
  }

  return evidenceByBodyId;
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

function formatCadKindLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

export function App() {
  const [workbenchUi, dispatchWorkbench] = useReducer(
    workbenchReducer,
    undefined,
    () => {
      const preferences = loadWorkbenchUiPreferences();
      return createInitialWorkbenchUiState({
        leftDockWidth: preferences.leftDockWidth,
        rightDockWidth: preferences.rightDockWidth,
        leftDockCollapsed: preferences.leftDockCollapsed,
        rightDockCollapsed: preferences.rightDockCollapsed
      });
    }
  );
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
  const successfulCommitCountRef = useRef(0);
  const stepImportPayloadStoreRef = useRef(
    createProjectStepImportPayloadStore()
  );
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
  const [focusedSketchId, setFocusedSketchId] = useState<string | undefined>();
  const [threePointArcTool, setThreePointArcTool] = useState<
    ThreePointArcToolSession | undefined
  >();
  const [selectedSketchContext, setSelectedSketchContext] = useState<
    SketchPanelSelectionContext | undefined
  >();
  const [preferredHoleTargetBodyId, setPreferredHoleTargetBodyId] = useState<
    string | undefined
  >();
  const [projectJson, setProjectJson] = useState("");
  const [projectJsonDraftSource, setProjectJsonDraftSource] =
    useState<ProjectJsonDraftSource>({ kind: "empty" });
  const [projectFile, setProjectFile] = useState<ProjectFileWorkflowState>(() =>
    createInitialProjectFileWorkflowState()
  );
  const [
    wcadTopologyCheckpointPayloadCache,
    setWcadTopologyCheckpointPayloadCache
  ] = useState<readonly WcadTopologyCheckpointPayloadInput[]>([]);
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
  const commandWorker = useMemo(() => new LazyCadCommandWorker(), []);
  const commandExecutor = useMemo(
    () =>
      new AsyncCadCommandExecutor(engine, commandWorker, {
        stepImportResolver: createProjectStepImportResolver({
          getRuntime: getDerivedGeometryRuntime,
          payloadStore: stepImportPayloadStoreRef.current
        })
      }),
    [commandWorker, getDerivedGeometryRuntime]
  );
  const commandWorkerLifecycleRef = useRef(0);
  useEffect(() => {
    const lifecycle = commandWorkerLifecycleRef.current + 1;
    commandWorkerLifecycleRef.current = lifecycle;

    return () => {
      queueMicrotask(() => {
        if (commandWorkerLifecycleRef.current === lifecycle) {
          commandWorker.dispose();
        }
      });
    };
  }, [commandWorker]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      markPartbenchPerformance(PARTBENCH_PERFORMANCE_MARKS.shellReady);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    saveWorkbenchUiPreferences({
      leftDockWidth: workbenchUi.leftDockWidth,
      rightDockWidth: workbenchUi.rightDockWidth,
      leftDockCollapsed: workbenchUi.leftDockCollapsed,
      rightDockCollapsed: workbenchUi.rightDockCollapsed
    });
  }, [
    workbenchUi.leftDockCollapsed,
    workbenchUi.leftDockWidth,
    workbenchUi.rightDockCollapsed,
    workbenchUi.rightDockWidth
  ]);
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
  const profileCandidatesBySketchId = useMemo(() => {
    const responses = new Map<string, SketchProfileCandidatesQueryResponse>();
    for (const sketch of sketches) {
      const response = engine.executeQuery({
        version: "cadops.v1",
        query: { query: "sketch.profileCandidates", sketchId: sketch.id }
      });
      if (response.ok && response.query === "sketch.profileCandidates") {
        responses.set(sketch.id, response);
      }
    }
    return responses;
  }, [sketches]);
  const pathCandidatesBySketchId = useMemo(() => {
    const responses = new Map<string, SketchPathCandidatesQueryResponse>();
    for (const sketch of sketches) {
      const response = engine.executeQuery({
        version: "cadops.v1",
        query: { query: "sketch.pathCandidates", sketchId: sketch.id }
      });
      if (response.ok && response.query === "sketch.pathCandidates") {
        responses.set(sketch.id, response);
      }
    }
    return responses;
  }, [sketches]);
  const projectStructure = useMemo(() => readProjectStructure(), [document]);
  const bodySourceIdentitySignatures = useMemo(
    () =>
      readBodySourceIdentitySignatures(
        new Set([
          ...document.objects.keys(),
          ...[...document.features.values()].map((feature) => feature.bodyId)
        ])
      ),
    [document]
  );
  const projectImportReadiness = useMemo(
    () => readProjectImportReadiness(),
    [document]
  );
  const projectTopologyIdentityReadiness = useMemo(
    () => readProjectTopologyIdentityReadiness(),
    [document]
  );
  const sketchExtrudeBodies = useMemo(
    () =>
      projectStructure.bodies.filter(
        (body) => body.source.type === "sketchExtrudeFeature"
      ),
    [projectStructure.bodies]
  );
  const sourcePlacementFacesByKey = useMemo(
    () => readGeneratedFaceReferencesByKey(sketchExtrudeBodies),
    [sketchExtrudeBodies]
  );
  const featureGeometrySources = useMemo(
    () =>
      createAuthoredFeatureDerivedGeometrySources(
        projectStructure.features,
        sketches,
        sourcePlacementFacesByKey,
        document.namedReferences,
        document.topologyIdentity,
        document,
        bodySourceIdentitySignatures
      ),
    [
      bodySourceIdentitySignatures,
      document,
      projectStructure.features,
      sourcePlacementFacesByKey,
      sketches
    ]
  );
  const derivedGeneratedReferenceEvidenceByBodyId = useMemo(
    () =>
      createDerivedGeneratedReferenceEvidenceByBodyId(
        derivedGeometry,
        featureGeometrySources
      ),
    [derivedGeometry, featureGeometrySources]
  );
  const generatedFacesByKey = useMemo(
    () =>
      readGeneratedFaceReferencesByKey(
        sketchExtrudeBodies,
        derivedGeneratedReferenceEvidenceByBodyId
      ),
    [derivedGeneratedReferenceEvidenceByBodyId, sketchExtrudeBodies]
  );
  const generatedEdgesByKey = useMemo(
    () =>
      readGeneratedEdgeReferencesByKey(
        sketchExtrudeBodies,
        derivedGeneratedReferenceEvidenceByBodyId
      ),
    [derivedGeneratedReferenceEvidenceByBodyId, sketchExtrudeBodies]
  );
  const sketchDisplayState = useMemo(
    () => createSketchDisplayState(sketches, generatedFacesByKey),
    [generatedFacesByKey, sketches]
  );
  const derivedGeometrySources = useMemo<readonly DerivedGeometrySource[]>(
    () =>
      createDerivedGeometrySourcesFromDocument(
        document,
        projectStructure.features,
        sourcePlacementFacesByKey,
        bodySourceIdentitySignatures
      ),
    [
      bodySourceIdentitySignatures,
      document,
      projectStructure.features,
      sourcePlacementFacesByKey
    ]
  );
  const importedExactMetadataSources = useMemo(() => {
    return createImportedBodyExactMetadataSources(
      projectStructure.features,
      wcadTopologyCheckpointPayloadCache
    );
  }, [projectStructure.features, wcadTopologyCheckpointPayloadCache]);
  const currentExactMetadataSources = useMemo<
    readonly DerivedExactMetadataSource[]
  >(
    () => [
      ...derivedGeometrySources.filter(
        (
          source
        ): source is DerivedGeometrySource & DerivedExactMetadataSource =>
          isExactMetadataSource(source)
      ),
      ...importedExactMetadataSources
    ],
    [derivedGeometrySources, importedExactMetadataSources]
  );
  const projectExportReadiness = useMemo(
    () =>
      readProjectExportReadiness(
        engine,
        derivedExactMetadata,
        currentExactMetadataSources
      ),
    [derivedExactMetadata, currentExactMetadataSources, document]
  );
  const projectHealth = useMemo(
    () => readProjectHealth(derivedExactMetadata, currentExactMetadataSources),
    [derivedExactMetadata, currentExactMetadataSources, document]
  );
  const modelingResultState = useMemo(
    () =>
      createModelingResultState({
        commandPending,
        commandFailed: commandError !== undefined,
        derivedGeometryEnabled,
        derivedSourceCount: derivedGeometrySources.length,
        derivedGeometry,
        projectHealthStatus: projectHealth.status
      }),
    [
      commandError,
      commandPending,
      derivedGeometry,
      derivedGeometrySources.length,
      projectHealth.status
    ]
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
  const holeTargetReadinessByTopologyAnchorId = useMemo(
    () =>
      readTopologyAnchorCommandTargetReadinessByAnchorId(
        document.topologyIdentity?.anchors,
        "feature.holeTarget"
      ),
    [document]
  );
  const selectedFeature = selectedBody
    ? projectStructure.features.find(
        (feature) => feature.id === selectedBody.featureId
      )
    : undefined;
  const selectedBodyGeneratedReferences = useMemo(
    () =>
      readBodyGeneratedReferences(
        selectedBody?.id,
        selectedBody
          ? derivedGeneratedReferenceEvidenceByBodyId.get(selectedBody.id)
          : undefined
      ),
    [derivedGeneratedReferenceEvidenceByBodyId, document, selectedBody?.id]
  );
  const selectedGeneratedReferenceMeasurements = useMemo(
    () =>
      readGeneratedReferenceMeasurements(
        selectedBodyGeneratedReferences.references
      ),
    [document, selectedBodyGeneratedReferences.references]
  );
  const selectedBodyMeasurements = useMemo(
    () => (selectedBody ? readBodyMeasurements(selectedBody.id) : {}),
    [document, selectedBody]
  );
  const selectedBodyExactMetadataSource = selectedBody
    ? currentExactMetadataSources.find(
        (source) => source.id === selectedBody.id
      )
    : undefined;
  const selectedBodyTopology = useMemo(
    () =>
      selectedBody !== undefined
        ? readBodyTopology(
            selectedBody.id,
            derivedExactMetadata,
            selectedBodyExactMetadataSource
          )
        : {},
    [derivedExactMetadata, selectedBody, selectedBodyExactMetadataSource]
  );
  const selectedBodyMassProperties = useMemo(
    () =>
      selectedBody
        ? readBodyMassProperties(
            selectedBody.id,
            selectedBodyTopology.topology,
            derivedExactMetadata,
            selectedBodyExactMetadataSource
          )
        : {},
    [
      derivedExactMetadata,
      selectedBody,
      selectedBodyExactMetadataSource,
      selectedBodyTopology.topology
    ]
  );
  const namedReferences = useMemo(() => readNamedReferences(), [document]);
  const referenceHealth = useMemo(() => readReferenceHealth(), [document]);
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
  const selectedBodyReferenceCandidates = useMemo(
    () =>
      selectedBody
        ? readSelectionReferenceCandidates({
            type: "body",
            bodyId: selectedBody.id
          })
        : undefined,
    [document, selectedBody]
  );
  const referenceCandidatesByStableId = useMemo(
    () =>
      readSelectionReferenceCandidatesByStableId(
        selectedBodyGeneratedReferences.references
      ),
    [document, selectedBodyGeneratedReferences.references]
  );
  const namedReferenceCandidatesByName = useMemo(
    () => readNamedReferenceCandidatesByName(namedReferences),
    [document, namedReferences]
  );
  const selectedNamedReference = selectedNamedReferenceName
    ? namedReferences.find(
        (reference) => reference.name === selectedNamedReferenceName
      )
    : undefined;
  const transactionHistory = useMemo(
    () => readTransactionHistory(),
    [document]
  );
  const parameters = useMemo(() => readParameters(), [document]);
  const parameterEvaluation = useMemo(
    () => readParameterEvaluation(),
    [document]
  );
  const sketchDimensionsBySketchId = useMemo(
    () => readSketchDimensionsBySketchId(sketches),
    [document, sketches]
  );
  const parameterUsageCounts = useMemo(
    () =>
      Object.fromEntries(
        parameters.map((parameter) => [
          parameter.id,
          getParameterDimensionUsageCount(
            parameter.id,
            [...sketchDimensionsBySketchId.values()].flat()
          )
        ])
      ),
    [parameters, sketchDimensionsBySketchId]
  );
  const sketchEvaluationsBySketchId = useMemo(
    () => readSketchEvaluationsBySketchId(sketches),
    [document, sketches]
  );
  const sketchSolverStatusesBySketchId = useMemo(
    () => readSketchSolverStatusesBySketchId(sketches),
    [document, sketches]
  );
  const documentTreeCapabilities = useMemo(() => {
    const entries = new Map<string, DocumentTreeRowCapabilities>();
    const register = (
      selection: DocumentTreeSelection,
      capabilities: DocumentTreeRowCapabilities
    ) => entries.set(documentTreeSelectionKey(selection), capabilities);

    for (const parameter of parameters) {
      register(
        { kind: "parameter", id: parameter.id },
        { canEdit: true, canDelete: true }
      );
    }
    for (const sketch of sketches) {
      register(
        { kind: "sketch", id: sketch.id },
        { canRename: true, canEdit: true, canDelete: true }
      );
      for (const entity of sketch.entities) {
        register(
          { kind: "sketch-entity", sketchId: sketch.id, id: entity.id },
          { canEdit: true, canDelete: true }
        );
      }
    }
    for (const feature of projectStructure.features) {
      register(
        { kind: "feature", id: feature.id },
        {
          canEdit: feature.kind !== "importedBody",
          canDelete: feature.kind !== "primitive"
        }
      );
    }
    for (const object of sceneObjects) {
      register(
        { kind: "object", id: object.id },
        { canRename: true, canEdit: true, canDelete: true }
      );
    }
    for (const reference of namedReferences) {
      register(
        { kind: "named-reference", name: reference.name },
        { canEdit: true, canDelete: true }
      );
    }
    return entries;
  }, [
    namedReferences,
    parameters,
    projectStructure.features,
    sceneObjects,
    sketches
  ]);
  const documentTreeProjection = useMemo(
    () =>
      createDocumentTreeProjection({
        parts: projectStructure.parts,
        parameters,
        sketches,
        features: projectStructure.features,
        bodies: projectStructure.bodies,
        objects: sceneObjects,
        namedReferences,
        health: projectHealth,
        capabilitiesBySelectionKey: documentTreeCapabilities
      }),
    [
      documentTreeCapabilities,
      namedReferences,
      parameters,
      projectHealth,
      projectStructure.bodies,
      projectStructure.features,
      projectStructure.parts,
      sceneObjects,
      sketches
    ]
  );
  const selectedDocumentTreeKey = selectedNamedReferenceName
    ? documentTreeSelectionKey({
        kind: "named-reference",
        name: selectedNamedReferenceName
      })
    : selectedSketchContext?.entityId
      ? documentTreeSelectionKey({
          kind: "sketch-entity",
          sketchId: selectedSketchContext.sketchId,
          id: selectedSketchContext.entityId
        })
      : selectedSketchContext
        ? documentTreeSelectionKey({
            kind: "sketch",
            id: selectedSketchContext.sketchId
          })
        : selectedBody
          ? documentTreeSelectionKey({ kind: "body", id: selectedBody.id })
          : selectedObject
            ? documentTreeSelectionKey({
                kind: "object",
                id: selectedObject.id
              })
            : undefined;
  const selectedTopologyAnchoredGeneratedReference = useMemo(
    () =>
      enrichSelectedGeneratedReferenceWithTopologyAnchor(
        selectedGeneratedReference,
        document.topologyIdentity
      ),
    [document.topologyIdentity, selectedGeneratedReference]
  );
  const selectedGeneratedReferenceState = useMemo(
    () =>
      getGeneratedReferenceSelectionState(
        selectedTopologyAnchoredGeneratedReference,
        selectedBodyGeneratedReferences.references,
        selectedGeneratedReferenceMeasurements,
        document.units
      ),
    [
      document.units,
      selectedBodyGeneratedReferences.references,
      selectedGeneratedReferenceMeasurements,
      selectedTopologyAnchoredGeneratedReference
    ]
  );
  const selectedGeneratedReferenceCandidates = useMemo(
    () =>
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
        : undefined,
    [document, referenceCandidatesByStableId, selectedGeneratedReferenceState]
  );
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
  const modelingSelectionContext = useMemo(
    () =>
      createModelingSelectionContext({
        focusedSketchId,
        namedReferences,
        referenceCandidatesByStableId,
        selectedBody,
        selectedBodyGeneratedReferences:
          selectedBodyGeneratedReferences.references,
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
      }),
    [
      focusedSketchId,
      namedReferences,
      referenceCandidatesByStableId,
      selectedBody,
      selectedBodyGeneratedReferences.references,
      selectedBodyReferenceCandidates,
      selectedFeature,
      selectedGeneratedReferenceState,
      selectedId,
      selectedReferenceCandidates,
      selectedSketchContext,
      sketchDimensionsBySketchId,
      sketchEvaluationsBySketchId,
      sketchSolverStatusesBySketchId,
      sketches
    ]
  );
  const modelingActions = useMemo(
    () =>
      deriveModelingActions({
        context: modelingSelectionContext,
        bodies: projectStructure.bodies,
        features: projectStructure.features,
        preferredBodyId: preferredHoleBodyId,
        topologyAnchors: document.topologyIdentity?.anchors,
        holeTargetReadinessByTopologyAnchorId
      }),
    [
      document.topologyIdentity?.anchors,
      holeTargetReadinessByTopologyAnchorId,
      modelingSelectionContext,
      preferredHoleBodyId,
      projectStructure.bodies,
      projectStructure.features
    ]
  );
  const solidBodyChoices = useMemo<readonly SolidChoice<string>[]>(
    () =>
      projectStructure.bodies
        .filter((body) => body.consumedByFeatureId === undefined)
        .map((body, index) => ({
          key: body.id,
          value: body.id,
          label: body.name ?? `Body ${index + 1}`,
          kind: "body"
        })),
    [projectStructure.bodies]
  );
  const solidProfileChoices = useMemo(
    () =>
      sketches.flatMap((sketch) =>
        (profileCandidatesBySketchId.get(sketch.id)?.candidates ?? []).map(
          (candidate) => {
            const profile = candidate.profile;
            const entity =
              profile.kind === "entity"
                ? sketch.entities.find((item) => item.id === profile.entityId)
                : undefined;
            const profileKind =
              profile.kind === "wire"
                ? "Wire profile"
                : `${formatCadKindLabel(entity?.kind ?? "entity")} profile`;
            return {
              key: `${sketch.id}:${candidate.sortKey}`,
              value: profile,
              label: `${sketch.name} · ${profileKind} ${candidate.candidateIndex + 1}`,
              kind: profileKind.toLocaleLowerCase()
            };
          }
        )
      ),
    [profileCandidatesBySketchId, sketches]
  );
  const solidPathChoices = useMemo(
    () =>
      sketches.flatMap((sketch) =>
        (pathCandidatesBySketchId.get(sketch.id)?.candidates ?? []).map(
          (candidate) => {
            const path = candidate.path;
            const entity =
              path.kind === "entity"
                ? sketch.entities.find((item) => item.id === path.entityId)
                : undefined;
            const description =
              path.kind === "entity"
                ? `${formatCadKindLabel(entity?.kind ?? "curve")} path · ${formatCadKindLabel(path.orientation)}`
                : `${path.segments.length}-segment tangent path`;
            return {
              key: `${sketch.id}:${candidate.sortKey}`,
              value: path,
              label: `${sketch.name} · ${description}`,
              kind: path.kind === "chain" ? "chain" : "path"
            };
          }
        )
      ),
    [pathCandidatesBySketchId, sketches]
  );
  const solidAxisChoices = useMemo(
    () =>
      sketches.flatMap((sketch) =>
        sketch.entities
          .filter((entity) => entity.kind === "line")
          .map((entity, index) => ({
            key: `${sketch.id}:${entity.id}`,
            value: entity.id,
            label: `${sketch.name} · ${entity.construction ? "Construction line" : "Line"} ${index + 1}`,
            kind: entity.construction ? "construction line" : "sketch line"
          }))
      ),
    [sketches]
  );
  const solidEdgeChoices = useMemo(
    () =>
      (selectedBodyGeneratedReferences.references?.edges ?? []).map(
        (edge, index) => ({
          key: edge.stableId,
          value: {
            targetBodyId: edge.bodyId,
            edgeStableId: edge.stableId
          },
          label: edge.label || `Edge ${index + 1}`,
          kind: "edge"
        })
      ),
    [selectedBodyGeneratedReferences.references]
  );
  const solidFaceChoices = useMemo(
    () =>
      (selectedBodyGeneratedReferences.references?.faces ?? []).map(
        (face, index) => ({
          key: face.stableId,
          value: {
            kind: "generatedFace" as const,
            bodyId: face.bodyId,
            stableId: face.stableId
          },
          label: face.label || `Face ${index + 1}`,
          kind: "face"
        })
      ),
    [selectedBodyGeneratedReferences.references]
  );
  const solidDirectionChoices = useMemo(
    () => [
      ...(["x", "y", "z"] as const).map((axis) => ({
        key: `axis:${axis}`,
        value: { kind: "globalAxis" as const, axis },
        label: `${axis.toUpperCase()} axis`,
        kind: "global axis"
      })),
      ...(selectedBodyGeneratedReferences.references?.edges ?? []).map(
        (edge, index) => ({
          key: `edge:${edge.stableId}`,
          value: {
            kind: "generatedEdge" as const,
            bodyId: edge.bodyId,
            stableId: edge.stableId
          },
          label: edge.label || `Edge ${index + 1}`,
          kind: "generated edge"
        })
      )
    ],
    [selectedBodyGeneratedReferences.references]
  );
  const solidPlaneChoices = useMemo(
    () =>
      (["XY", "XZ", "YZ"] as const).map((plane) => ({
        key: `plane:${plane}`,
        value: { kind: "standardPlane" as const, plane },
        label: `${plane} plane`,
        kind: "standard plane"
      })),
    []
  );
  const selectedProfile =
    (modelingSelectionContext.selectionKind === "sketchEntity"
      ? solidProfileChoices.find(
          (choice) =>
            choice.value.kind === "entity" &&
            choice.value.sketchId === modelingSelectionContext.sketch.id &&
            choice.value.entityId === modelingSelectionContext.entity.id
        )?.value
      : undefined) ?? solidProfileChoices[0]?.value;
  const selectedEntityProfile =
    selectedProfile?.kind === "entity" ? selectedProfile : undefined;
  const selectedPath = solidPathChoices[0]?.value;
  const selectedSolidBodyId =
    selectedBody?.id ?? solidBodyChoices[0]?.value ?? "";
  const solidEditorRequest = useMemo<SolidEditorRequest | undefined>(() => {
    const actionId = workbenchUi.activeTool;
    const key = `${actionId ?? "solid"}:${transactionHistory.length}`;
    if (
      actionId === "solid.box" ||
      actionId === "solid.cylinder" ||
      actionId === "solid.sphere" ||
      actionId === "solid.cone" ||
      actionId === "solid.torus"
    ) {
      const kind = actionId.slice("solid.".length) as
        | "box"
        | "cylinder"
        | "sphere"
        | "cone"
        | "torus";
      return {
        key,
        kind,
        title: `Create ${formatCadKindLabel(kind)}`,
        mode: "create",
        initialDraft: createPrimitiveDraft(kind)
      } as SolidEditorRequest;
    }
    if (actionId === "solid.sketch") {
      return {
        key,
        kind: "sketch",
        title: "Create Sketch",
        mode: "create",
        initialDraft: createSketchDraft(sketches.length + 1)
      } as SolidEditorRequest;
    }
    if (actionId === "solid.edit" && selectedFeature) {
      if (selectedFeature.kind === "primitive") {
        const transform = selectedFeature.transform;
        return {
          key,
          kind: selectedFeature.primitive,
          title: `Edit ${formatCadKindLabel(selectedFeature.primitive)}`,
          mode: "edit",
          initialDraft: {
            ...createPrimitiveDraft(selectedFeature.primitive),
            ...selectedFeature.dimensions,
            id: selectedFeature.objectId,
            translationX: transform.translation[0],
            translationY: transform.translation[1],
            translationZ: transform.translation[2]
          }
        } as SolidEditorRequest;
      }
      if (selectedFeature.kind === "extrude") {
        const profile =
          selectedFeature.profile ??
          (selectedFeature.entityId
            ? {
                kind: "entity" as const,
                sketchId: selectedFeature.sketchId,
                entityId: selectedFeature.entityId
              }
            : undefined);
        return {
          key,
          kind: "compositeExtrude",
          title: "Edit Extrude",
          mode: "edit",
          initialDraft: {
            id: selectedFeature.id,
            bodyId: selectedFeature.bodyId,
            name: selectedFeature.name ?? "",
            profile: profile ?? {
              kind: "entity",
              sketchId: "",
              entityId: ""
            },
            depth: selectedFeature.depth,
            side: selectedFeature.side,
            operationMode: selectedFeature.operationMode,
            targetBodyId: selectedFeature.targetBodyId,
            targetTopologyAnchorId: selectedFeature.targetTopologyAnchorId
          },
          choices: {
            profiles: solidProfileChoices,
            targetBodies: solidBodyChoices
          },
          blockedReason: profile
            ? undefined
            : "The source profile is unavailable.",
          deletable: true
        } as SolidEditorRequest;
      }
      if (selectedFeature.kind === "revolve") {
        const profile =
          selectedFeature.profile ??
          (selectedFeature.entityId
            ? {
                kind: "entity" as const,
                sketchId: selectedFeature.sketchId,
                entityId: selectedFeature.entityId
              }
            : undefined);
        return {
          key,
          kind: "compositeRevolve",
          title: "Edit Revolve",
          mode: "edit",
          initialDraft: {
            id: selectedFeature.id,
            bodyId: selectedFeature.bodyId,
            name: selectedFeature.name ?? "",
            profile: profile ?? {
              kind: "entity",
              sketchId: "",
              entityId: ""
            },
            axisEntityId: selectedFeature.axis.entityId,
            angleDegrees: selectedFeature.angleDegrees
          },
          choices: { profiles: solidProfileChoices, axes: solidAxisChoices },
          blockedReason: profile
            ? undefined
            : "The source profile is unavailable.",
          deletable: true
        } as SolidEditorRequest;
      }
      if (selectedFeature.kind === "sweep") {
        return {
          key,
          kind: "compositeSweep",
          title: "Edit Sweep",
          mode: "edit",
          initialDraft: {
            id: selectedFeature.id,
            bodyId: selectedFeature.bodyId,
            name: selectedFeature.name ?? "",
            profile: selectedFeature.profile,
            path: selectedFeature.path
          },
          choices: {
            profiles: solidProfileChoices.filter(
              (choice) => choice.value.kind === "entity"
            ),
            paths: solidPathChoices
          },
          deletable: true
        } as SolidEditorRequest;
      }
      if (selectedFeature.kind === "hole") {
        return {
          key,
          kind: "hole",
          title: "Edit Hole",
          mode: "edit",
          initialDraft: {
            id: selectedFeature.id,
            bodyId: selectedFeature.bodyId,
            targetBodyId: selectedFeature.targetBodyId,
            targetTopologyAnchorId: selectedFeature.targetTopologyAnchorId,
            name: selectedFeature.name ?? "",
            depthMode: selectedFeature.depthMode,
            depth: selectedFeature.depth ?? 10,
            direction: selectedFeature.direction
          },
          choices: { targetBodies: solidBodyChoices },
          deletable: true
        } as SolidEditorRequest;
      }
      if (
        selectedFeature.kind === "fillet" ||
        selectedFeature.kind === "chamfer"
      ) {
        return {
          key,
          kind: selectedFeature.kind,
          title:
            selectedFeature.kind === "fillet" ? "Edit Fillet" : "Edit Chamfer",
          mode: "edit",
          initialDraft: {
            id: selectedFeature.id,
            bodyId: selectedFeature.bodyId,
            targetBodyId: selectedFeature.targetBodyId,
            name: selectedFeature.name ?? "",
            edgeStableId: selectedFeature.edgeStableId,
            namedReference: selectedFeature.namedReference,
            topologyAnchorId: selectedFeature.topologyAnchorId,
            distance:
              selectedFeature.kind === "chamfer" ? selectedFeature.distance : 1,
            radius:
              selectedFeature.kind === "fillet" ? selectedFeature.radius : 1
          },
          choices: { edges: solidEdgeChoices },
          deletable: true
        } as SolidEditorRequest;
      }
      if (selectedFeature.kind === "shell") {
        return {
          key,
          kind: "shell",
          title: "Edit Shell",
          mode: "edit",
          initialDraft: {
            id: selectedFeature.id,
            bodyId: selectedFeature.bodyId,
            targetBodyId: selectedFeature.targetBodyId,
            name: selectedFeature.name ?? "",
            wallThickness: selectedFeature.wallThickness,
            openFaceRefs: selectedFeature.openFaceRefs
          },
          choices: {
            targetBodies: solidBodyChoices,
            openFaces: solidFaceChoices
          },
          deletable: true
        } as SolidEditorRequest;
      }
      if (selectedFeature.kind === "linearPattern") {
        return {
          key,
          kind: "linearPattern",
          title: "Edit Linear Pattern",
          mode: "edit",
          initialDraft: {
            id: selectedFeature.id,
            bodyId: selectedFeature.bodyId,
            seedBodyId: selectedFeature.seedBodyId,
            name: selectedFeature.name ?? "",
            direction: selectedFeature.direction,
            spacing: selectedFeature.spacing,
            instanceCount: selectedFeature.instanceCount
          },
          choices: {
            seedBodies: solidBodyChoices,
            directions: solidDirectionChoices
          },
          deletable: true
        } as SolidEditorRequest;
      }
      if (selectedFeature.kind === "circularPattern") {
        return {
          key,
          kind: "circularPattern",
          title: "Edit Circular Pattern",
          mode: "edit",
          initialDraft: {
            id: selectedFeature.id,
            bodyId: selectedFeature.bodyId,
            seedBodyId: selectedFeature.seedBodyId,
            name: selectedFeature.name ?? "",
            rotationAxis: selectedFeature.rotationAxis,
            totalAngleDegrees: selectedFeature.totalAngleDegrees,
            instanceCount: selectedFeature.instanceCount
          },
          choices: {
            seedBodies: solidBodyChoices,
            rotationAxes: solidDirectionChoices
          },
          deletable: true
        } as SolidEditorRequest;
      }
      if (selectedFeature.kind === "mirror") {
        return {
          key,
          kind: "mirror",
          title: "Edit Mirror",
          mode: "edit",
          initialDraft: {
            id: selectedFeature.id,
            bodyId: selectedFeature.bodyId,
            seedBodyId: selectedFeature.seedBodyId,
            name: selectedFeature.name ?? "",
            plane: selectedFeature.plane,
            includeOriginal: selectedFeature.includeOriginal
          },
          choices: {
            seedBodies: solidBodyChoices,
            mirrorPlanes: solidPlaneChoices
          },
          deletable: true
        } as SolidEditorRequest;
      }
      return {
        key,
        kind: "transform",
        title: `Edit ${formatCadKindLabel(selectedFeature.kind)}`,
        mode: "edit",
        initialDraft: createTransformDraft(),
        blockedReason:
          "This feature family does not support property editing in the V17 command matrix.",
        deletable: true
      } as SolidEditorRequest;
    }
    if (actionId === "solid.transform" || actionId === "solid.edit") {
      const currentTransform = selectedObject?.transform;
      return {
        key,
        kind: "transform",
        title: "Transform Object",
        mode: currentTransform ? "edit" : "create",
        initialDraft: currentTransform
          ? {
              translationX: currentTransform.translation[0],
              translationY: currentTransform.translation[1],
              translationZ: currentTransform.translation[2],
              rotationX: currentTransform.rotation[0],
              rotationY: currentTransform.rotation[1],
              rotationZ: currentTransform.rotation[2],
              scaleX: currentTransform.scale[0],
              scaleY: currentTransform.scale[1],
              scaleZ: currentTransform.scale[2]
            }
          : createTransformDraft(),
        blockedReason: selectedObject
          ? undefined
          : "Select an editable source object.",
        deletable: Boolean(selectedObject)
      } as SolidEditorRequest;
    }
    if (actionId === "solid.extrude") {
      return {
        key,
        kind: "compositeExtrude",
        title: "Extrude Profile",
        mode: "create",
        initialDraft: {
          id: "",
          bodyId: "",
          name: "",
          profile: selectedProfile ?? {
            kind: "entity",
            sketchId: "",
            entityId: ""
          },
          depth: 10,
          side: "positive",
          operationMode: "newBody"
        },
        choices: {
          profiles: solidProfileChoices,
          targetBodies: solidBodyChoices
        },
        blockedReason: selectedProfile
          ? undefined
          : "Create or select a supported closed sketch profile."
      } as SolidEditorRequest;
    }
    if (actionId === "solid.revolve") {
      return {
        key,
        kind: "compositeRevolve",
        title: "Revolve Profile",
        mode: "create",
        initialDraft: {
          id: "",
          bodyId: "",
          name: "",
          profile: selectedProfile ?? {
            kind: "entity",
            sketchId: "",
            entityId: ""
          },
          axisEntityId: solidAxisChoices[0]?.value ?? "",
          angleDegrees: 360
        },
        choices: { profiles: solidProfileChoices, axes: solidAxisChoices },
        blockedReason:
          selectedProfile && solidAxisChoices.length > 0
            ? undefined
            : "A supported profile and sketch line axis are required."
      } as SolidEditorRequest;
    }
    if (actionId === "solid.sweep") {
      return {
        key,
        kind: "compositeSweep",
        title: "Sweep Profile",
        mode: "create",
        initialDraft: {
          id: "",
          bodyId: "",
          name: "",
          profile: selectedEntityProfile ?? {
            kind: "entity",
            sketchId: "",
            entityId: ""
          },
          path: selectedPath ?? {
            kind: "entity",
            sketchId: "",
            entityId: "",
            orientation: "forward"
          }
        },
        choices: {
          profiles: solidProfileChoices.filter(
            (choice) => choice.value.kind === "entity"
          ),
          paths: solidPathChoices
        },
        blockedReason:
          selectedEntityProfile && selectedPath
            ? undefined
            : "A supported entity profile and tangent path are required."
      } as SolidEditorRequest;
    }
    if (actionId === "solid.loft") {
      const sectionChoices = solidProfileChoices.flatMap((choice) =>
        choice.value.kind === "entity"
          ? [
              {
                section: {
                  sketchId: choice.value.sketchId,
                  entityId: choice.value.entityId
                },
                sourceLabel: choice.label
              }
            ]
          : []
      );
      const sections = sectionChoices.map((choice) => choice.section);
      return {
        key,
        kind: "loft",
        title: "Loft Sections",
        mode: "create",
        initialDraft: { id: "", bodyId: "", name: "", sections },
        choices: {
          loftSections: sectionChoices.map((choice, index) => ({
            key: `${choice.section.sketchId}:${choice.section.entityId}`,
            value: choice.section,
            label: `${index + 1}. ${choice.sourceLabel}`,
            kind: "profile section"
          }))
        },
        blockedReason:
          sections.length >= 2
            ? undefined
            : "Loft needs at least two profiles on parallel planes. Select a planar body face and choose Create sketch to add an offset section."
      } as SolidEditorRequest;
    }
    if (actionId === "solid.hole") {
      const circleReady =
        modelingSelectionContext.selectionKind === "sketchEntity" &&
        modelingSelectionContext.entity.kind === "circle";
      return {
        key,
        kind: "hole",
        title: "Create Hole",
        mode: "create",
        initialDraft: {
          id: "",
          bodyId: "",
          targetBodyId: selectedSolidBodyId,
          name: "",
          depthMode: "throughAll",
          depth: 10,
          direction: "positive"
        },
        choices: { targetBodies: solidBodyChoices },
        blockedReason: circleReady
          ? undefined
          : "Select a supported sketch circle."
      } as SolidEditorRequest;
    }
    if (actionId === "solid.fillet" || actionId === "solid.chamfer") {
      const edge = solidEdgeChoices[0]?.value;
      return {
        key,
        kind: actionId === "solid.fillet" ? "fillet" : "chamfer",
        title: actionId === "solid.fillet" ? "Fillet Edge" : "Chamfer Edge",
        mode: "create",
        initialDraft: {
          id: "",
          bodyId: "",
          targetBodyId: edge?.targetBodyId ?? selectedSolidBodyId,
          name: "",
          edgeStableId: edge?.edgeStableId,
          distance: 1,
          radius: 1
        },
        choices: { edges: solidEdgeChoices },
        blockedReason: edge ? undefined : "Select a supported generated edge."
      } as SolidEditorRequest;
    }
    if (actionId === "solid.shell") {
      return {
        key,
        kind: "shell",
        title: "Shell Body",
        mode: "create",
        initialDraft: {
          id: "",
          bodyId: "",
          targetBodyId: selectedSolidBodyId,
          name: "",
          wallThickness: 1,
          openFaceRefs: []
        },
        choices: {
          targetBodies: solidBodyChoices,
          openFaces: solidFaceChoices
        },
        blockedReason: selectedSolidBodyId
          ? undefined
          : "Select a supported body."
      } as SolidEditorRequest;
    }
    if (actionId === "solid.linear-pattern") {
      return {
        key,
        kind: "linearPattern",
        title: "Linear Body Pattern",
        mode: "create",
        initialDraft: {
          id: "",
          bodyId: "",
          seedBodyId: selectedSolidBodyId,
          name: "",
          direction: solidDirectionChoices[0]!.value,
          spacing: 10,
          instanceCount: 3
        },
        choices: {
          seedBodies: solidBodyChoices,
          directions: solidDirectionChoices
        },
        blockedReason: selectedSolidBodyId
          ? undefined
          : "Select a supported seed body."
      } as SolidEditorRequest;
    }
    if (actionId === "solid.circular-pattern") {
      return {
        key,
        kind: "circularPattern",
        title: "Circular Body Pattern",
        mode: "create",
        initialDraft: {
          id: "",
          bodyId: "",
          seedBodyId: selectedSolidBodyId,
          name: "",
          rotationAxis: solidDirectionChoices[2]!.value,
          totalAngleDegrees: 360,
          instanceCount: 3
        },
        choices: {
          seedBodies: solidBodyChoices,
          rotationAxes: solidDirectionChoices
        },
        blockedReason: selectedSolidBodyId
          ? undefined
          : "Select a supported seed body."
      } as SolidEditorRequest;
    }
    if (actionId === "solid.mirror") {
      return {
        key,
        kind: "mirror",
        title: "Mirror Body",
        mode: "create",
        initialDraft: {
          id: "",
          bodyId: "",
          seedBodyId: selectedSolidBodyId,
          name: "",
          plane: solidPlaneChoices[0]!.value,
          includeOriginal: true
        },
        choices: {
          seedBodies: solidBodyChoices,
          mirrorPlanes: solidPlaneChoices
        },
        blockedReason: selectedSolidBodyId
          ? undefined
          : "Select a supported seed body."
      } as SolidEditorRequest;
    }
    return undefined;
  }, [
    transactionHistory.length,
    modelingSelectionContext,
    selectedBody,
    selectedEntityProfile,
    selectedFeature,
    selectedObject,
    selectedPath,
    selectedProfile,
    selectedSolidBodyId,
    sketches.length,
    solidAxisChoices,
    solidBodyChoices,
    solidDirectionChoices,
    solidEdgeChoices,
    solidFaceChoices,
    solidPathChoices,
    solidPlaneChoices,
    solidProfileChoices,
    workbenchUi.activeTool
  ]);
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
        sketches,
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
  const selectedPart = selectedBody
    ? projectStructure.parts.find((part) => part.id === selectedBody.partId)
    : projectStructure.parts[0];
  const selectedReferenceHealth = selectedNamedReferenceName
    ? namedReferenceHealthByName.get(selectedNamedReferenceName)
    : selectedGeneratedReferenceState.status === "selected"
      ? referenceHealth?.referenceHealth.find(
          (entry) =>
            entry.stableId ===
              selectedGeneratedReferenceState.reference.stableId &&
            entry.bodyId === selectedGeneratedReferenceState.reference.bodyId
        )
      : undefined;
  const inspectSelection = useMemo<
    InspectSelectionProjection | undefined
  >(() => {
    if (selectedGeneratedReferenceState.status === "selected") {
      const reference = selectedGeneratedReferenceState.reference;
      return {
        kind:
          reference.kind === "edge"
            ? "edge"
            : reference.kind === "face"
              ? "face"
              : "body",
        typeLabel: formatGeneratedReferenceKind(reference.kind),
        name: reference.label,
        owner: {
          part: selectedPart?.name,
          body: selectedBody?.name ?? "Result body",
          feature: selectedFeature
            ? formatCadKindLabel(selectedFeature.kind)
            : undefined
        }
      };
    }

    if (selectedNamedReference) {
      return {
        kind: "named-reference",
        typeLabel: "Named reference",
        name: selectedNamedReference.name,
        owner: {
          part: selectedPart?.name,
          body: selectedBody?.name ?? "Result body"
        },
        properties: [
          {
            label: "Target",
            value: formatGeneratedReferenceKind(selectedNamedReference.kind)
          }
        ]
      };
    }

    if (selectedBody) {
      return {
        kind: "body",
        typeLabel: "Body",
        name: selectedBody.name ?? "Result body",
        owner: {
          part: selectedPart?.name,
          feature: selectedFeature
            ? formatCadKindLabel(selectedFeature.kind)
            : undefined
        },
        properties: [
          { label: "Shape", value: "Solid" },
          ...(selectedBody.primitive
            ? [
                {
                  label: "Source",
                  value: formatObjectKind(selectedBody.primitive)
                }
              ]
            : [])
        ]
      };
    }

    if (selectedObject) {
      return {
        kind: "object",
        typeLabel: formatObjectKind(selectedObject.kind),
        name: selectedObject.name ?? formatObjectKind(selectedObject.kind),
        owner: { part: selectedPart?.name },
        properties: [
          {
            label: "Dimensions",
            value: formatDimensions(selectedObject, document.units)
          },
          {
            label: "Position",
            value: formatVector(selectedObject.transform.translation)
          }
        ]
      };
    }

    return undefined;
  }, [
    document.units,
    selectedBody,
    selectedFeature,
    selectedGeneratedReferenceState,
    selectedNamedReference,
    selectedObject,
    selectedPart?.name
  ]);
  const inspectMeasurements = useMemo<InspectMeasurementsProjection>(
    () => ({
      ...(selectedMeasurements
        ? {
            object: {
              title: "Authored measurements",
              status: "ready" as const,
              confidence: "From authored values",
              rows: [
                {
                  label: "Local bounds",
                  value: formatBounds(
                    selectedMeasurements.localBounds,
                    document.units
                  )
                },
                {
                  label: "World bounds",
                  value: formatBounds(
                    selectedMeasurements.worldBounds,
                    document.units
                  )
                },
                {
                  label: "Approximate volume",
                  value: formatVolume(
                    selectedMeasurements.approximateVolume,
                    document.units
                  )
                }
              ]
            }
          }
        : {}),
      ...(selectedBody
        ? {
            body: selectedBodyMeasurements.measurements
              ? {
                  title: "Body measurements",
                  status: "ready" as const,
                  confidence: "Source analytic",
                  rows: createBodyMeasurementRows(
                    selectedBodyMeasurements.measurements,
                    document.units
                  ).filter((row) => row.label !== "Model")
                }
              : {
                  title: "Body measurements",
                  status: "blocked" as const,
                  message:
                    selectedBodyMeasurements.error ??
                    "Measurements are unavailable for this body."
                }
          }
        : {}),
      ...(selectedGeneratedReferenceState.status === "selected"
        ? {
            generatedReference: {
              title: `${formatGeneratedReferenceKind(
                selectedGeneratedReferenceState.reference.kind
              )} measurements`,
              status: selectedGeneratedReferenceState.measurement?.measurement
                ? ("ready" as const)
                : ("blocked" as const),
              confidence: selectedGeneratedReferenceState.measurement
                ?.measurement
                ? "Source analytic"
                : undefined,
              rows: selectedGeneratedReferenceState.measurementRows,
              message:
                selectedGeneratedReferenceState.measurement?.error ?? undefined
            }
          }
        : {}),
      twoTarget: {
        status:
          viewportTwoTargetMeasurement.status === "waitingForSecond"
            ? "waiting-for-second"
            : viewportTwoTargetMeasurement.status,
        firstTarget: viewportTwoTargetMeasurement.firstTarget?.title,
        secondTarget: viewportTwoTargetMeasurement.secondTarget?.title,
        prompt: viewportTwoTargetMeasurement.prompt,
        results: viewportTwoTargetMeasurement.results.flatMap(
          (result) => result.rows
        ),
        confidence: viewportTwoTargetMeasurement.results[0]?.authorityLabel
      }
    }),
    [
      document.units,
      selectedBody,
      selectedBodyMeasurements.error,
      selectedBodyMeasurements.measurements,
      selectedGeneratedReferenceState,
      selectedMeasurements,
      viewportTwoTargetMeasurement
    ]
  );
  const inspectMassProperties = useMemo<InspectMetricProjection | undefined>(
    () =>
      selectedBody
        ? selectedBodyMassProperties.massProperties
          ? {
              title: "Exact mass properties",
              status: "ready",
              confidence: "Kernel derived",
              rows: [
                {
                  label: "Volume",
                  value: formatVolume(
                    selectedBodyMassProperties.massProperties.volume,
                    document.units
                  )
                },
                {
                  label: "Surface area",
                  value: formatArea(
                    selectedBodyMassProperties.massProperties.surfaceArea,
                    document.units
                  )
                },
                {
                  label: "Center of mass",
                  value: formatVector(
                    selectedBodyMassProperties.massProperties.centerOfMass
                  )
                },
                {
                  label: "Mass",
                  value:
                    selectedBodyMassProperties.massProperties.mass.toString()
                }
              ]
            }
          : {
              title: "Exact mass properties",
              status: "blocked",
              message:
                selectedBodyMassProperties.error ??
                "Exact mass properties are unavailable for this body."
            }
        : undefined,
    [document.units, selectedBody, selectedBodyMassProperties]
  );
  const inspectHealth = useMemo<readonly InspectHealthProjection[]>(
    () => [
      {
        scope: "project",
        label: "Project",
        statusLabel: formatCadKindLabel(projectHealth.status),
        tone:
          projectHealth.status === "healthy"
            ? "success"
            : projectHealth.status === "under-defined"
              ? "warning"
              : "danger",
        message:
          projectHealth.issueCount === 0
            ? "No dependency issues reported."
            : `${projectHealth.issueCount} dependency issue${projectHealth.issueCount === 1 ? "" : "s"} reported.`
      },
      ...(selectedBody
        ? [
            {
              scope: "body" as const,
              label: "Body topology",
              statusLabel: selectedBodyTopology.topology
                ? formatBodyTopologyStatus(selectedBodyTopology.topology.status)
                : "Unavailable",
              tone:
                selectedBodyTopology.topology?.status === "healthy"
                  ? ("success" as const)
                  : selectedBodyTopology.error
                    ? ("danger" as const)
                    : ("warning" as const),
              message:
                selectedBodyTopology.error ??
                selectedBodyTopology.exactMetadataStatus
            }
          ]
        : []),
      ...(selectedReferenceHealth
        ? [
            {
              scope: "reference" as const,
              label: "Reference",
              statusLabel: formatCadKindLabel(selectedReferenceHealth.status),
              tone: selectedReferenceHealth.commandable
                ? ("success" as const)
                : selectedReferenceHealth.status === "repair-needed" ||
                    selectedReferenceHealth.status === "ambiguous"
                  ? ("warning" as const)
                  : ("danger" as const),
              message: selectedReferenceHealth.diagnostics[0]?.message
            }
          ]
        : [])
    ],
    [
      projectHealth.issueCount,
      projectHealth.status,
      selectedBody,
      selectedBodyTopology,
      selectedReferenceHealth
    ]
  );
  const inspectReference = useMemo<
    InspectReferenceProjection | undefined
  >(() => {
    if (selectedGeneratedReferenceState.status !== "selected") {
      return undefined;
    }
    const reference = selectedGeneratedReferenceState.reference;
    const referenceName = namedReferences.find(
      (candidate) =>
        candidate.bodyId === reference.bodyId &&
        candidate.stableId === reference.stableId
    )?.name;
    const healthy = selectedReferenceHealth?.commandable ?? true;
    const previewKey = createTopologyRepairPreviewKey(
      selectedGeneratedReferenceState.selection
    );
    const repairPreview =
      topologyRepairPreview?.key === previewKey
        ? topologyRepairPreview
        : undefined;
    const repairableCandidates =
      repairPreview?.preview?.rows.filter((row) => row.repairable) ?? [];
    return {
      kindLabel: formatGeneratedReferenceKind(reference.kind),
      name: referenceName,
      health: {
        scope: "reference",
        label: "Reference health",
        statusLabel: healthy ? "Ready" : "Needs attention",
        tone: healthy ? "success" : "warning",
        message: selectedReferenceHealth?.diagnostics[0]?.message
      },
      naming: {
        status: commandPending ? "pending" : "ready",
        message: commandPending ? "A command is already running." : undefined
      },
      ...(!selectedGeneratedReferenceState.selection.topologyAnchorId
        ? {
            stability: {
              status: commandPending
                ? ("pending" as const)
                : ("ready" as const),
              message: commandPending
                ? "A command is already running."
                : undefined
            }
          }
        : {}),
      ...(repairPreview
        ? {
            repairPreview: repairPreview.pending
              ? {
                  title: "Repair candidates",
                  status: "loading" as const
                }
              : repairPreview.error
                ? {
                    title: "Repair candidates",
                    status: "blocked" as const,
                    message: repairPreview.error
                  }
                : {
                    title: "Repair candidates",
                    status:
                      repairableCandidates.length > 0
                        ? ("ready" as const)
                        : ("blocked" as const),
                    message: repairPreview.preview?.summary,
                    rows: repairPreview.preview?.rows.map((row, index) => ({
                      label: `${row.entityKind} ${index + 1} · ${row.confidence}`,
                      value: `${row.state} · ${row.action}`
                    }))
                  }
          }
        : {}),
      ...(referenceName
        ? {
            repair: {
              status: healthy ? ("ready" as const) : ("ready" as const)
            }
          }
        : {})
    };
  }, [
    commandPending,
    namedReferences,
    selectedGeneratedReferenceState,
    selectedReferenceHealth,
    topologyRepairPreview
  ]);
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
    threePointArcTool !== undefined ||
    viewportHoverPick !== undefined ||
    viewportPickIntent !== undefined;
  const clearViewportTransientState = useCallback(() => {
    setViewportHoverPick(undefined);
    setViewportPickIntent(undefined);
    setThreePointArcTool(undefined);
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

    getDerivedExactMetadataService().reconcile(currentExactMetadataSources);
  }, [
    derivedGeometrySources,
    derivedMeshCacheContextKey,
    currentExactMetadataSources,
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

  function selectObject(objectId: string | undefined) {
    setSelectedId(objectId);
    setSelectedGeneratedReference(undefined);
    setViewportPickIntent(undefined);
    setViewportHoverPick(undefined);
    dispatchWorkbench({ type: "set-active-tool" });
  }

  function selectViewportPick(pick: ViewportCanvasPick) {
    const pickedBodyId = resolveViewportPickedBodyId({
      pickedRenderId: pick.pickedRenderId,
      bodies: projectStructure.bodies,
      objects: sceneObjects
    });
    const targetGeneratedReferenceBodyId =
      chooseViewportGeneratedReferencePickBodyId({
        activeSelectionPanel:
          workbenchUi.mode === "inspect" ||
          workbenchUi.selectionFilter !== "body",
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
      sketches,
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
      nextGeneratedFacesByKey,
      readBodySourceIdentitySignatures(
        nextStructure.bodies.map((body) => body.id)
      )
    );
    getDerivedGeometryService().reconcile(nextDerivedGeometrySources);
  }

  async function commitOps(
    ops: readonly CadOp[],
    getNextSelectedId: (response: CadBatchResponse) => string | null | undefined
  ): Promise<CadAsyncBatchResponse | undefined> {
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
      successfulCommitCountRef.current += 1;
      setWcadTopologyCheckpointPayloadCache((current) =>
        mergeWcadTopologyCheckpointPayloadInputCache(
          current,
          response.importedStepCheckpointPayloads
        )
      );
      setProjectFile((current) => markProjectFileDirty(current));
      return response;
    } finally {
      setCommandPending(false);
    }
  }

  async function createBox(form: PrimitiveCommandForm) {
    const plan = createQuickStartSourceBodyPlan({
      document,
      form,
      kind: "box"
    });

    await commitOps(plan.ops, () => plan.bodyId);
  }

  async function createCylinder(form: PrimitiveCommandForm) {
    const plan = createQuickStartSourceBodyPlan({
      document,
      form,
      kind: "cylinder"
    });

    await commitOps(plan.ops, () => plan.bodyId);
  }

  async function createSphere(form: PrimitiveCommandForm) {
    await commitOps(
      [buildCreateSphereOp(form)],
      (response) => response.createdIds[0]
    );
  }

  async function createCone(form: PrimitiveCommandForm) {
    await commitOps(
      [buildCreateConeOp(form)],
      (response) => response.createdIds[0]
    );
  }

  async function createTorus(form: PrimitiveCommandForm) {
    await commitOps(
      [buildCreateTorusOp(form)],
      (response) => response.createdIds[0]
    );
  }

  async function updateDocumentUnits(
    units: CadDocument["units"],
    mode: DocumentUnitUpdateMode
  ) {
    if (units === document.units) {
      return;
    }

    await commitOps([buildUpdateUnitsOp(units, mode)], () => selectedId);
  }

  async function updateSelectedTransform(form: TransformCommandForm) {
    if (!selectedObject) {
      return;
    }

    const objectId = selectedObject.id;
    await commitOps([buildUpdateTransformOp(objectId, form)], () => objectId);
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
      dispatchWorkbench({
        type: "request-navigation",
        intent: { kind: "mode", mode: "sketch" }
      });
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

  async function createLinearPattern(form: FeatureLinearPatternForm) {
    await commitOps(
      [buildFeatureLinearPatternOp(form)],
      (response) => response.createdBodyIds?.[0] ?? (form.bodyId || selectedId)
    );
  }

  async function createCircularPattern(form: FeatureCircularPatternForm) {
    await commitOps(
      [buildFeatureCircularPatternOp(form)],
      (response) => response.createdBodyIds?.[0] ?? (form.bodyId || selectedId)
    );
  }

  async function createMirror(form: FeatureMirrorForm) {
    await commitOps(
      [buildFeatureMirrorOp(form)],
      (response) => response.createdBodyIds?.[0] ?? (form.bodyId || selectedId)
    );
  }

  async function createShell(form: FeatureShellForm) {
    await commitOps(
      [buildFeatureShellOp(form)],
      (response) => response.createdBodyIds?.[0] ?? (form.bodyId || selectedId)
    );
  }

  async function createSweep(
    profileSketchId: string,
    profileEntityId: string,
    form: FeatureSweepForm
  ) {
    await commitOps(
      [buildFeatureSweepOp(profileSketchId, profileEntityId, form)],
      (response) => response.createdBodyIds?.[0] ?? (form.bodyId || selectedId)
    );
  }

  async function createCompositeExtrude(form: FeatureCompositeExtrudeForm) {
    await commitOps(
      [buildFeatureCompositeExtrudeOp(form)],
      (response) => response.createdBodyIds?.[0] ?? selectedId
    );
  }

  async function createCompositeRevolve(form: FeatureCompositeRevolveForm) {
    await commitOps(
      [buildFeatureCompositeRevolveOp(form)],
      (response) => response.createdBodyIds?.[0] ?? selectedId
    );
  }

  async function createCompositeSweep(form: FeatureCompositeSweepForm) {
    await commitOps(
      [buildFeatureCompositeSweepOp(form)],
      (response) => response.createdBodyIds?.[0] ?? selectedId
    );
  }

  async function createLoft(form: FeatureLoftForm) {
    await commitOps(
      [buildFeatureLoftOp(form)],
      (response) => response.createdBodyIds?.[0] ?? (form.bodyId || selectedId)
    );
  }

  async function updateAuthoredLinearPattern(
    featureId: string,
    edit: FeatureLinearPatternEdit
  ) {
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === featureId
    );

    if (feature?.kind !== "linearPattern") {
      return;
    }

    await commitOps(
      [buildFeatureUpdateLinearPatternOp(feature.id, edit)],
      () => feature.bodyId
    );
  }

  async function updateAuthoredCircularPattern(
    featureId: string,
    edit: FeatureCircularPatternEdit
  ) {
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === featureId
    );

    if (feature?.kind !== "circularPattern") {
      return;
    }

    await commitOps(
      [buildFeatureUpdateCircularPatternOp(feature.id, edit)],
      () => feature.bodyId
    );
  }

  async function updateAuthoredMirror(
    featureId: string,
    edit: FeatureMirrorEdit
  ) {
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === featureId
    );

    if (feature?.kind !== "mirror") {
      return;
    }

    await commitOps(
      [buildFeatureUpdateMirrorOp(feature.id, edit)],
      () => feature.bodyId
    );
  }

  async function updateAuthoredShell(
    featureId: string,
    edit: FeatureShellEdit
  ) {
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === featureId
    );

    if (feature?.kind !== "shell") {
      return;
    }

    await commitOps(
      [buildFeatureUpdateShellOp(feature.id, edit)],
      () => feature.bodyId
    );
  }

  function focusSketch(sketchId: string, entityId?: string) {
    setSelectedId(undefined);
    setSelectedGeneratedReference(undefined);
    setFocusedSketchId(sketchId);
    setSelectedSketchContext({
      sketchId,
      ...(entityId ? { entityId } : {})
    });
    dispatchWorkbench({
      type: "request-navigation",
      intent: { kind: "mode", mode: "sketch" }
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
    kind: CreatableSketchEntityKind,
    form: SketchEntityForm
  ) {
    const op =
      kind === "point"
        ? buildAddSketchPointOp(sketchId, form)
        : kind === "line"
          ? buildAddSketchLineOp(sketchId, form)
          : kind === "rectangle"
            ? buildAddSketchRectangleOp(sketchId, form)
            : kind === "circle"
              ? buildAddSketchCircleOp(sketchId, form)
              : buildAddSketchArcOp(sketchId, form);

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

  async function setSketchEntityConstruction(
    sketchId: string,
    entityId: string,
    construction: boolean
  ) {
    await commitOps(
      [buildSetSketchEntityConstructionOp(sketchId, entityId, construction)],
      () => selectedId
    );
  }

  function startThreePointArcTool(sketchId: string) {
    setThreePointArcTool(createThreePointArcToolSession(sketchId));
    setFocusedSketchId(sketchId);
    setSelectedSketchContext({ sketchId });
    setViewportHoverPick(undefined);
    setViewportPickIntent(undefined);
  }

  function getSketchViewportDisplayFrame(sketchId: string) {
    const resolved = sketchDisplayState.frames.get(sketchId);
    if (resolved) return resolved;
    const sketch = sketches.find((candidate) => candidate.id === sketchId);
    return sketch ? createDefaultSketchDisplayFrame(sketch.plane) : undefined;
  }

  function mapArcToolPickToSketchPoint(
    pick: ViewportCanvasPick,
    sketchId: string
  ): Vec2 | undefined {
    const displayFrame = getSketchViewportDisplayFrame(sketchId);
    if (!displayFrame) return undefined;
    const basis = createSketchViewportProjectionBasis({
      camera: pick.camera,
      displayFrame,
      size: pick.size
    });
    return basis ? mapViewportPointToSketchPoint(basis, pick.point) : undefined;
  }

  function hoverThreePointArcTool(pick: ViewportCanvasPick | undefined) {
    setThreePointArcTool((current) => {
      if (!current) return current;
      const point = pick
        ? mapArcToolPickToSketchPoint(pick, current.sketchId)
        : undefined;
      return updateThreePointArcToolHover(current, point);
    });
  }

  async function captureThreePointArcToolPick(pick: ViewportCanvasPick) {
    if (commandPending) return;
    const current = threePointArcTool;
    if (!current) return;
    const point = mapArcToolPickToSketchPoint(pick, current.sketchId);
    if (!point) {
      setCommandError(
        "The active sketch plane cannot be projected in this view."
      );
      return;
    }

    const next = captureThreePointArcToolPoint(current, point);
    const definition = getThreePointArcDefinition(next);
    if (!definition || definition.kind !== "threePoint") {
      setThreePointArcTool(next);
      return;
    }

    const response = await commitOps(
      [
        buildAddSketchThreePointArcOp(current.sketchId, {
          id: "",
          construction: false,
          start: definition.start,
          pointOnArc: definition.pointOnArc,
          end: definition.end
        })
      ],
      () => null
    );
    if (response?.ok) {
      const entityId = response.createdSketchEntityIds?.[0];
      setThreePointArcTool(undefined);
      setSelectedSketchContext({
        sketchId: current.sketchId,
        ...(entityId ? { entityId } : {})
      });
    } else {
      setThreePointArcTool(next);
    }
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

  async function updateCompositeSweepRefs(
    featureId: string,
    profile: Extract<SketchProfileRef, { readonly kind: "entity" }>,
    path: SketchPathRef
  ) {
    const feature = projectStructure.features.find(
      (candidate) => candidate.id === featureId
    );
    if (feature?.kind !== "sweep") return;
    await commitOps(
      [buildFeatureUpdateCompositeSweepOp(featureId, profile, path)],
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
        const actionId =
          modelingAction.id === "feature.chamfer"
            ? "solid.chamfer"
            : modelingAction.id === "feature.fillet"
              ? "solid.fillet"
              : modelingAction.id === "feature.shell"
                ? "solid.shell"
                : undefined;
        if (actionId) {
          navigateToMode("solid");
          dispatchWorkbench({ type: "set-active-tool", actionId });
          setCommandNotice("Review the selection and parameters, then apply.");
        } else {
          setCommandNotice(
            modelingAction.id === "sketch.createOnFace"
              ? "Use the selected face from the Sketch creation workflow."
              : "Continue in Solid for the full command inputs."
          );
        }
      },
      onCreateEdgeFinish: (operation, form) =>
        void createEdgeFinish(operation, form),
      onCreateShell: (form) => void createShell(form),
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
      feature.kind === "hole" ||
      feature.kind === "sweep" ||
      feature.kind === "loft"
    ) {
      if (feature.kind === "sweep") return feature.profileSketchId;
      if (feature.kind === "loft") return feature.sections[0]?.sketchId;
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
      case "importedBody":
        return "imported body";
      case "linearPattern":
        return "linear pattern";
      case "circularPattern":
        return "circular pattern";
      case "mirror":
        return "mirror";
      case "shell":
        return "shell";
      case "sweep":
        return "sweep";
      case "loft":
        return "loft";
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

    const exactExport = readProjectExactStepExport(
      engine,
      derivedExactMetadata,
      currentExactMetadataSources
    );

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

    const [
      { createGeometryKernelBrowserWorker },
      { executeProjectExactStepExport }
    ] = await Promise.all([
      import("@web-cad/geometry-worker/browser"),
      import("./projectExactStepExport")
    ]);
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

  async function openProjectStepImport(): Promise<boolean> {
    try {
      const target = window as unknown as WcadFilePickerTargetLike;

      if (typeof target.showOpenFilePicker !== "function") {
        throw new Error("File System Access open picker is unavailable.");
      }

      const handles = await target.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "STEP CAD file",
            accept: {
              "application/octet-stream": [".step", ".stp"]
            }
          }
        ],
        excludeAcceptAllOption: false
      });
      const handle = handles[0];

      if (!handle) {
        throw new Error("No STEP file was selected.");
      }

      const file = await handle.getFile();
      await importProjectStepBytes(
        await readBytesFromWcadFile(file),
        file.name ?? handle.name ?? "import.step"
      );

      return true;
    } catch (error) {
      if (isFilePickerAbort(error)) {
        setProjectMessage("STEP import was cancelled.");
        setProjectMessageTone("info");
        return true;
      }

      if (projectStorageCapabilities.jsonUploadAvailable) {
        setProjectMessage(
          "Direct STEP open failed; choose a STEP file to upload."
        );
        setProjectMessageTone("error");
        return false;
      }

      setProjectMessage(
        error instanceof Error ? error.message : "Could not open STEP file."
      );
      setProjectMessageTone("error");
      return true;
    }
  }

  async function importProjectStepBytes(bytes: Uint8Array, fileName: string) {
    const payloadId = `step_import_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2)}`;
    const op: CadOp = {
      op: "project.importStep",
      sourceFileName: fileName,
      sourceFormat: "step",
      payloadRef: {
        kind: "transient",
        payloadId,
        byteLength: bytes.byteLength
      },
      maxBodyCount: 1
    };

    stepImportPayloadStoreRef.current.putPayload(payloadId, bytes);
    setCommandPending(true);
    setCommandError(undefined);
    setCommandNotice(undefined);
    setProjectMessage(`Previewing ${fileName}...`);
    setProjectMessageTone("info");

    try {
      const dryRun = await commandExecutor.executeBatch(
        buildBatch("dryRun", [op], WEB_UI_ACTOR)
      );

      if (!dryRun.ok) {
        setCommandError(dryRun.error.message);
        setProjectMessage(dryRun.error.message);
        setProjectMessageTone("error");
        return;
      }

      const confirmed = window.confirm(
        formatStepImportDryRunPreview(fileName, dryRun, document.units)
      );

      if (!confirmed) {
        setProjectMessage("STEP import preview was cancelled.");
        setProjectMessageTone("info");
        return;
      }

      const response = await commandExecutor.executeBatch(
        buildBatch("commit", [op], WEB_UI_ACTOR)
      );

      if (!response.ok) {
        setCommandError(response.error.message);
        setProjectMessage(response.error.message);
        setProjectMessageTone("error");
        return;
      }

      const createdBodyIds = response.createdBodyIds ?? [];
      if (createdBodyIds.length === 0) {
        setCommandError("STEP import succeeded without returning a body.");
        setProjectMessage("STEP import succeeded without returning a body.");
        setProjectMessageTone("error");
        return;
      }

      syncDocument(createdBodyIds[0]);
      setWcadTopologyCheckpointPayloadCache((current) =>
        mergeWcadTopologyCheckpointPayloadInputCache(
          current,
          response.importedStepCheckpointPayloads
        )
      );
      setProjectFile((current) => markProjectFileDirty(current));
      setProjectMessage(
        `Imported ${fileName}: ${createdBodyIds.length} bod${
          createdBodyIds.length === 1 ? "y" : "ies"
        }.`
      );
      setProjectMessageTone("info");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not import STEP file.";
      setCommandError(message);
      setProjectMessage(message);
      setProjectMessageTone("error");
    } finally {
      stepImportPayloadStoreRef.current.deletePayload(payloadId);
      setCommandPending(false);
    }
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
    stepImportPayloadStoreRef.current.clear();
    setWcadTopologyCheckpointPayloadCache(
      createWcadTopologyCheckpointPayloadInputCache(result.checkpointPayloads)
    );
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
      importedCheckpointPayloads: wcadTopologyCheckpointPayloadCache,
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

  function createNewProject() {
    engine.loadProject(exportCadProject(new CadEngine()));
    stepImportPayloadStoreRef.current.clear();
    setWcadTopologyCheckpointPayloadCache([]);
    setProjectFileHandle(undefined);
    setProjectFile(createInitialProjectFileWorkflowState());
    setProjectJson("");
    setProjectJsonDraftSource({ kind: "empty" });
    setCommandError(undefined);
    setSelectedGeneratedReference(undefined);
    setSelectedNamedReferenceName(undefined);
    setFocusedSketchId(undefined);
    setSelectedSketchContext(undefined);
    setProjectMessage("Created a new project.");
    setProjectMessageTone("info");
    syncDocument(undefined);
  }

  function loadProjectJsonDraft(projectJsonText: string, fileName: string) {
    setProjectJson(projectJsonText);
    setProjectJsonDraftSource({ kind: "loadedFile", fileName });
    setProjectMessage(`Loaded ${fileName} for import validation.`);
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
    stepImportPayloadStoreRef.current.clear();
    setWcadTopologyCheckpointPayloadCache([]);
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

  function selectDocumentTreeItem(selection: DocumentTreeSelection) {
    switch (selection.kind) {
      case "origin-plane":
        setCommandNotice(
          `${selection.plane} plane is available for a new sketch.`
        );
        return;
      case "parameter":
        openProjectPage("parameters");
        return;
      case "sketch":
        focusSketch(selection.id);
        return;
      case "sketch-entity":
        focusSketch(selection.sketchId, selection.id);
        return;
      case "feature": {
        const body = projectStructure.bodies.find(
          (candidate) => candidate.featureId === selection.id
        );
        selectObject(body?.id);
        return;
      }
      case "object":
      case "body":
        selectObject(selection.id);
        return;
      case "named-reference":
        inspectNamedReference(selection.name);
        navigateToMode("inspect");
        return;
    }
  }

  function editDocumentTreeItem(selection: DocumentTreeSelection) {
    selectDocumentTreeItem(selection);
    if (selection.kind === "feature" || selection.kind === "object") {
      dispatchWorkbench({ type: "set-active-tool", actionId: "solid.edit" });
    }
  }

  function renameDocumentTreeItem(selection: DocumentTreeSelection) {
    if (selection.kind === "sketch") {
      const sketch = sketches.find(
        (candidate) => candidate.id === selection.id
      );
      const name = window.prompt("Sketch name", sketch?.name ?? "Sketch");
      if (name?.trim()) void renameSketch(selection.id, name.trim());
      return;
    }
    if (selection.kind === "object") {
      const object = document.objects.get(selection.id);
      const name = window.prompt("Object name", object?.name ?? "Object");
      if (name?.trim()) {
        void commitOps(
          [buildRenameObjectOp(selection.id, name.trim())],
          () => selection.id
        );
      }
    }
  }

  function deleteDocumentTreeItem(selection: DocumentTreeSelection) {
    const row = documentTreeProjection.rowsById.get(
      documentTreeSelectionKey(selection)
    );
    if (!window.confirm(`Delete ${row?.label ?? "this item"}?`)) return;

    switch (selection.kind) {
      case "parameter":
        void deleteParameter(selection.id);
        return;
      case "sketch":
        void deleteSketch(selection.id);
        return;
      case "sketch-entity":
        void deleteSketchEntity(selection.sketchId, selection.id);
        return;
      case "feature":
        void deleteAuthoredFeature(selection.id);
        return;
      case "object":
        void commitOps([buildDeleteObjectOp(selection.id)], () => undefined);
        return;
      case "named-reference":
        void deleteNamedReference(selection.name);
        return;
      case "origin-plane":
      case "body":
        return;
    }
  }

  function navigateToMode(mode: "project" | "solid" | "sketch" | "inspect") {
    dispatchWorkbench({
      type: "request-navigation",
      intent: { kind: "mode", mode }
    });
  }

  function openProjectPage(
    page: "overview" | "files" | "parameters" | "history" | "export"
  ) {
    dispatchWorkbench({
      type: "request-navigation",
      intent: { kind: "project-page", page }
    });
  }

  async function applySolidEditorSubmission(
    submission: SolidEditorSubmission
  ): Promise<void> {
    await applyCommittedSolidEditorSubmission({
      readSuccessfulCommitCount: () => successfulCommitCountRef.current,
      submit: () => executeSolidEditorSubmission(submission),
      close: () => dispatchWorkbench({ type: "set-active-tool" })
    });
  }

  async function executeSolidEditorSubmission(
    submission: SolidEditorSubmission
  ): Promise<void> {
    if (workbenchUi.activeTool === "solid.edit" && selectedFeature) {
      if (
        selectedFeature.kind === "primitive" &&
        submission.kind === selectedFeature.primitive
      ) {
        const dimensionsOp =
          submission.kind === "box"
            ? buildUpdateBoxDimensionsOp(
                selectedFeature.objectId,
                submission.draft
              )
            : submission.kind === "cylinder"
              ? buildUpdateCylinderDimensionsOp(
                  selectedFeature.objectId,
                  submission.draft
                )
              : submission.kind === "sphere"
                ? buildUpdateSphereDimensionsOp(
                    selectedFeature.objectId,
                    submission.draft
                  )
                : submission.kind === "cone"
                  ? buildUpdateConeDimensionsOp(
                      selectedFeature.objectId,
                      submission.draft
                    )
                  : buildUpdateTorusDimensionsOp(
                      selectedFeature.objectId,
                      submission.draft
                    );
        const transform = selectedFeature.transform;
        await commitOps(
          [
            dimensionsOp,
            buildUpdateTransformOp(selectedFeature.objectId, {
              translationX: submission.draft.translationX,
              translationY: submission.draft.translationY,
              translationZ: submission.draft.translationZ,
              rotationX: transform.rotation[0],
              rotationY: transform.rotation[1],
              rotationZ: transform.rotation[2],
              scaleX: transform.scale[0],
              scaleY: transform.scale[1],
              scaleZ: transform.scale[2]
            })
          ],
          () => selectedFeature.objectId
        );
        return;
      }
      if (
        selectedFeature.kind === "extrude" &&
        submission.kind === "compositeExtrude"
      ) {
        if (
          submission.draft.operationMode !== selectedFeature.operationMode ||
          submission.draft.targetBodyId !== selectedFeature.targetBodyId
        ) {
          throw new Error(
            "The V17 command matrix does not support changing an extrude boolean target."
          );
        }
        await commitOps(
          [
            buildFeatureUpdateCompositeExtrudeOp(
              selectedFeature.id,
              submission.draft.profile,
              submission.draft.depth,
              submission.draft.side
            )
          ],
          () => selectedFeature.bodyId
        );
        return;
      }
      if (
        selectedFeature.kind === "revolve" &&
        submission.kind === "compositeRevolve"
      ) {
        if (submission.draft.axisEntityId !== selectedFeature.axis.entityId) {
          throw new Error(
            "The V17 command matrix does not support changing a revolve axis."
          );
        }
        await commitOps(
          [
            buildFeatureUpdateCompositeRevolveOp(
              selectedFeature.id,
              submission.draft.profile,
              submission.draft.angleDegrees
            )
          ],
          () => selectedFeature.bodyId
        );
        return;
      }
      if (
        selectedFeature.kind === "sweep" &&
        submission.kind === "compositeSweep"
      ) {
        await updateCompositeSweepRefs(
          selectedFeature.id,
          submission.draft.profile,
          submission.draft.path
        );
        return;
      }
      if (selectedFeature.kind === "hole" && submission.kind === "hole") {
        if (submission.draft.targetBodyId !== selectedFeature.targetBodyId) {
          throw new Error(
            "The V17 command matrix does not support changing a hole target body."
          );
        }
        await updateAuthoredHole(
          selectedFeature.id,
          submission.draft.depthMode,
          submission.draft.depthMode === "blind"
            ? submission.draft.depth
            : undefined,
          submission.draft.direction
        );
        return;
      }
      if (selectedFeature.kind === "chamfer" && submission.kind === "chamfer") {
        await updateAuthoredChamfer(
          selectedFeature.id,
          submission.draft.distance
        );
        return;
      }
      if (selectedFeature.kind === "fillet" && submission.kind === "fillet") {
        await updateAuthoredFillet(selectedFeature.id, submission.draft.radius);
        return;
      }
      if (selectedFeature.kind === "shell" && submission.kind === "shell") {
        if (submission.draft.targetBodyId !== selectedFeature.targetBodyId) {
          throw new Error(
            "The V17 command matrix does not support changing a shell target body."
          );
        }
        await updateAuthoredShell(selectedFeature.id, {
          wallThickness: submission.draft.wallThickness,
          openFaceRefs: submission.draft.openFaceRefs
        });
        return;
      }
      if (
        selectedFeature.kind === "linearPattern" &&
        submission.kind === "linearPattern"
      ) {
        if (submission.draft.seedBodyId !== selectedFeature.seedBodyId) {
          throw new Error(
            "The V17 command matrix does not support changing a pattern seed body."
          );
        }
        await updateAuthoredLinearPattern(selectedFeature.id, {
          direction: submission.draft.direction,
          spacing: submission.draft.spacing,
          instanceCount: submission.draft.instanceCount
        });
        return;
      }
      if (
        selectedFeature.kind === "circularPattern" &&
        submission.kind === "circularPattern"
      ) {
        if (submission.draft.seedBodyId !== selectedFeature.seedBodyId) {
          throw new Error(
            "The V17 command matrix does not support changing a pattern seed body."
          );
        }
        await updateAuthoredCircularPattern(selectedFeature.id, {
          rotationAxis: submission.draft.rotationAxis,
          totalAngleDegrees: submission.draft.totalAngleDegrees,
          instanceCount: submission.draft.instanceCount
        });
        return;
      }
      if (selectedFeature.kind === "mirror" && submission.kind === "mirror") {
        if (submission.draft.seedBodyId !== selectedFeature.seedBodyId) {
          throw new Error(
            "The V17 command matrix does not support changing a mirror seed body."
          );
        }
        await updateAuthoredMirror(selectedFeature.id, {
          plane: submission.draft.plane,
          includeOriginal: submission.draft.includeOriginal
        });
        return;
      }
      throw new Error(
        "This feature edit is not supported by the V17 command matrix."
      );
    }
    switch (submission.kind) {
      case "box":
        await createBox(submission.draft);
        return;
      case "cylinder":
        await createCylinder(submission.draft);
        return;
      case "sphere":
        await createSphere(submission.draft);
        return;
      case "cone":
        await createCone(submission.draft);
        return;
      case "torus":
        await createTorus(submission.draft);
        return;
      case "sketch":
        await createSketch(submission.draft);
        return;
      case "transform":
        await updateSelectedTransform(submission.draft);
        return;
      case "compositeExtrude":
        await createCompositeExtrude(submission.draft);
        return;
      case "compositeRevolve":
        await createCompositeRevolve(submission.draft);
        return;
      case "compositeSweep":
        await createCompositeSweep(submission.draft);
        return;
      case "loft":
        await createLoft(submission.draft);
        return;
      case "fillet":
      case "chamfer":
        await createEdgeFinish(submission.kind, submission.draft);
        return;
      case "shell":
        await createShell(submission.draft);
        return;
      case "linearPattern":
        await createLinearPattern(submission.draft);
        return;
      case "circularPattern":
        await createCircularPattern(submission.draft);
        return;
      case "mirror":
        await createMirror(submission.draft);
        return;
      case "extrude":
        if (modelingSelectionContext.selectionKind === "sketchEntity") {
          await extrudeSketchEntity(
            modelingSelectionContext.sketch.id,
            modelingSelectionContext.entity.id,
            submission.draft
          );
        }
        return;
      case "revolve":
        if (modelingSelectionContext.selectionKind === "sketchEntity") {
          await revolveSketchEntity(
            modelingSelectionContext.sketch.id,
            modelingSelectionContext.entity.id,
            submission.draft
          );
        }
        return;
      case "sweep":
        if (modelingSelectionContext.selectionKind === "sketchEntity") {
          await createSweep(
            modelingSelectionContext.sketch.id,
            modelingSelectionContext.entity.id,
            submission.draft
          );
        }
        return;
      case "hole":
        if (
          modelingSelectionContext.selectionKind === "sketchEntity" &&
          modelingSelectionContext.entity.kind === "circle"
        ) {
          await holeSketchEntity(
            modelingSelectionContext.sketch.id,
            modelingSelectionContext.entity.id,
            submission.draft
          );
        }
    }
  }

  function runWorkbenchAction(actionId: UiActionId): void {
    dispatchWorkbench({ type: "set-active-tool", actionId });
    switch (actionId) {
      case "project.new":
        openProjectPage("files");
        createNewProject();
        return;
      case "project.open":
        openProjectPage("files");
        void openProjectWcad();
        return;
      case "project.save":
        void saveProjectWcad();
        return;
      case "project.save-as":
        void saveProjectWcadAs();
        return;
      case "project.import-step":
        openProjectPage("files");
        void openProjectStepImport();
        return;
      case "project.import-json":
        openProjectPage("files");
        return;
      case "project.export-json":
        openProjectPage("files");
        exportProjectJson();
        return;
      case "project.download-json":
        downloadProjectJson();
        return;
      case "project.export-step":
        openProjectPage("export");
        void downloadExactStepExport();
        return;
      case "project.export-glb":
        openProjectPage("export");
        downloadVisualizationMeshExport();
        return;
      case "project.overview":
        openProjectPage("overview");
        return;
      case "project.files":
        openProjectPage("files");
        return;
      case "project.parameters":
        openProjectPage("parameters");
        return;
      case "project.create-parameter":
        openProjectPage("parameters");
        setCommandNotice(
          "Complete the new parameter draft, then choose Create parameter."
        );
        return;
      case "project.history":
        openProjectPage("history");
        return;
      case "project.export":
        openProjectPage("export");
        return;
      case "project.undo":
        undo();
        return;
      case "project.redo":
        redo();
        return;
      case "solid.box":
      case "solid.cylinder":
      case "solid.sphere":
      case "solid.cone":
      case "solid.torus":
      case "solid.sketch":
        navigateToMode("solid");
        setCommandNotice("Review the draft, then choose Apply.");
        return;
      case "solid.extrude":
        navigateToMode("solid");
        setCommandNotice(
          "Choose a closed sketch profile, review the operation, then apply."
        );
        return;
      case "solid.revolve":
        navigateToMode("solid");
        setCommandNotice(
          "Choose a closed profile and a sketch line axis, then apply. Construction lines are listed as axes."
        );
        return;
      case "solid.sweep":
        navigateToMode("solid");
        setCommandNotice(
          "Choose a profile and path direction, review the path preview, then apply."
        );
        return;
      case "solid.loft":
        navigateToMode("solid");
        setCommandNotice(
          "Loft needs at least two ordered profiles on parallel planes. Create the next section on a parallel planar body face."
        );
        return;
      case "solid.hole":
        navigateToMode("solid");
        setCommandNotice(
          "Select a circle sketch profile; the intersected solid is offered as the target body."
        );
        return;
      case "solid.fillet":
      case "solid.chamfer":
        navigateToMode("solid");
        dispatchWorkbench({ type: "set-selection-filter", filter: "edge" });
        setCommandNotice(
          "Edge selection is active. Select a generated solid edge, review the size, then apply."
        );
        return;
      case "solid.shell":
        navigateToMode("solid");
        dispatchWorkbench({ type: "set-selection-filter", filter: "face" });
        setCommandNotice(
          "Face selection is active. Choose the body and any faces to open, then apply."
        );
        return;
      case "solid.linear-pattern":
      case "solid.circular-pattern":
      case "solid.mirror":
        navigateToMode("solid");
        dispatchWorkbench({ type: "set-selection-filter", filter: "body" });
        setCommandNotice(
          "This operation repeats the selected result body. Choose a seed body and review the placement."
        );
        return;
      case "solid.measure":
      case "inspect.measure":
        navigateToMode("inspect");
        if (viewportTwoTargetMeasurementTarget) {
          startViewportTwoTargetMeasurement(viewportTwoTargetMeasurementTarget);
        }
        return;
      case "solid.rename":
        if (selectedObject) {
          renameDocumentTreeItem({ kind: "object", id: selectedObject.id });
        } else if (selectedSketchContext) {
          renameDocumentTreeItem({
            kind: "sketch",
            id: selectedSketchContext.sketchId
          });
        }
        return;
      case "solid.delete":
        if (selectedFeature && selectedFeature.kind !== "primitive") {
          if (
            window.confirm(
              `Delete ${selectedFeature.name ?? formatCadKindLabel(selectedFeature.kind)}?`
            )
          ) {
            void deleteAuthoredFeature(selectedFeature.id);
          }
        } else if (selectedObject) {
          deleteDocumentTreeItem({ kind: "object", id: selectedObject.id });
        } else if (selectedSketchContext?.entityId) {
          deleteDocumentTreeItem({
            kind: "sketch-entity",
            sketchId: selectedSketchContext.sketchId,
            id: selectedSketchContext.entityId
          });
        } else if (selectedSketchContext) {
          deleteDocumentTreeItem({
            kind: "sketch",
            id: selectedSketchContext.sketchId
          });
        }
        return;
      case "inspect.name-reference":
        navigateToMode("inspect");
        if (selectedGeneratedReferenceState.status === "selected") {
          const name = window.prompt(
            "Reference name",
            inspectReference?.name ?? ""
          );
          if (name?.trim()) {
            void nameGeneratedReference(
              name.trim(),
              selectedGeneratedReferenceState.selection
            );
          }
        }
        return;
      case "inspect.repair-reference":
        navigateToMode("inspect");
        if (
          selectedNamedReferenceName &&
          selectedGeneratedReferenceState.status === "selected"
        ) {
          void repairNamedReference(
            selectedNamedReferenceName,
            selectedGeneratedReferenceState.selection
          );
        }
        return;
      case "sketch.construction":
        if (selectedSketchContext?.entityId) {
          const sketch = sketches.find(
            (candidate) => candidate.id === selectedSketchContext.sketchId
          );
          const entity = sketch?.entities.find(
            (candidate) => candidate.id === selectedSketchContext.entityId
          );
          if (entity) {
            void setSketchEntityConstruction(
              sketch!.id,
              entity.id,
              !entity.construction
            );
          }
        }
        return;
      case "sketch.delete":
        if (selectedSketchContext?.entityId) {
          deleteDocumentTreeItem({
            kind: "sketch-entity",
            sketchId: selectedSketchContext.sketchId,
            id: selectedSketchContext.entityId
          });
        }
        return;
      case "inspect.fit-all":
      case "inspect.fit-selection":
      case "inspect.top":
      case "inspect.front":
      case "inspect.right":
      case "inspect.isometric": {
        const command = actionId.slice("inspect.".length) as ViewportCommand;
        window.dispatchEvent(
          new CustomEvent(VIEWPORT_COMMAND_EVENT, { detail: command })
        );
        return;
      }
      case "inspect.measure-between":
      case "inspect.mass-properties":
      case "inspect.health":
        navigateToMode("inspect");
        return;
      case "sketch.arc":
        if (focusedSketchId) startThreePointArcTool(focusedSketchId);
        else setCommandNotice("Select or create a sketch first.");
        return;
      case "sketch.finish":
        setThreePointArcTool(undefined);
        navigateToMode("solid");
        setCommandNotice("Sketch finished. No model change was created.");
        return;
      default: {
        const mode = actionId.slice(0, actionId.indexOf("."));
        if (
          mode === "project" ||
          mode === "solid" ||
          mode === "sketch" ||
          mode === "inspect"
        ) {
          navigateToMode(mode);
        }
        setCommandNotice(
          "Complete this action in the focused workbench panel."
        );
      }
    }
  }

  const uiActionAvailability = useMemo<UiActionAvailabilityProjection>(() => {
    const ready = { status: "ready" } as const;
    const needs = (message: string) =>
      ({ status: "needs-selection", message }) as const;
    const selectedSketch = selectedSketchContext
      ? sketches.find(
          (candidate) => candidate.id === selectedSketchContext.sketchId
        )
      : undefined;
    const selectedEntity = selectedSketch?.entities.find(
      (candidate) => candidate.id === selectedSketchContext?.entityId
    );
    const sketchReady = focusedSketchId
      ? ready
      : needs("Select or create a sketch first.");
    const selectedEntityReady = selectedEntity
      ? ready
      : needs("Select a sketch entity first.");
    return {
      "project.undo": engine.getTransactions().length
        ? ready
        : { status: "blocked", message: "There is nothing to undo." },
      "project.redo": engine.getRedoStack().length
        ? ready
        : { status: "blocked", message: "There is nothing to redo." },
      "solid.extrude": selectedProfile
        ? ready
        : needs("Select a supported sketch profile."),
      "solid.revolve":
        selectedProfile && solidAxisChoices.length > 0
          ? ready
          : needs("Select a supported sketch profile and axis."),
      "solid.sweep":
        selectedEntityProfile && selectedPath
          ? ready
          : needs("Select a supported profile and path."),
      "solid.loft":
        solidProfileChoices.filter((choice) => choice.value.kind === "entity")
          .length >= 2
          ? ready
          : needs(
              "Select at least two profiles on parallel planes. Create a sketch on a parallel planar body face to add an offset section."
            ),
      "solid.transform": selectedObject
        ? ready
        : needs("Select an editable source object."),
      "solid.hole":
        modelingSelectionContext.selectionKind === "sketchEntity" &&
        modelingSelectionContext.entity.kind === "circle" &&
        Boolean(selectedSolidBodyId)
          ? ready
          : needs("Select a supported circle and target body."),
      "solid.fillet":
        solidEdgeChoices.length > 0
          ? ready
          : needs("Select a supported generated edge."),
      "solid.chamfer":
        solidEdgeChoices.length > 0
          ? ready
          : needs("Select a supported generated edge."),
      "solid.shell": selectedSolidBodyId
        ? ready
        : needs("Select a supported body."),
      "solid.linear-pattern": selectedSolidBodyId
        ? ready
        : needs("Select a supported body."),
      "solid.circular-pattern": selectedSolidBodyId
        ? ready
        : needs("Select a supported body."),
      "solid.mirror": selectedSolidBodyId
        ? ready
        : needs("Select a supported body."),
      "solid.edit":
        selectedObject ||
        (selectedFeature && selectedFeature.kind !== "importedBody")
          ? ready
          : needs("Select an editable feature or object."),
      "solid.rename":
        selectedObject || selectedSketchContext
          ? ready
          : needs("Select a renameable object or sketch."),
      "solid.delete":
        selectedObject || selectedSketchContext
          ? ready
          : needs("Select a deletable object or sketch item."),
      "sketch.point": sketchReady,
      "sketch.line": sketchReady,
      "sketch.rectangle": sketchReady,
      "sketch.circle": sketchReady,
      "sketch.arc": sketchReady,
      "sketch.construction": selectedEntityReady,
      "sketch.delete": selectedEntityReady,
      "sketch.horizontal":
        selectedEntity?.kind === "line"
          ? ready
          : needs("Select an eligible line."),
      "sketch.vertical":
        selectedEntity?.kind === "line"
          ? ready
          : needs("Select an eligible line."),
      "sketch.fixed": selectedEntityReady,
      "sketch.coincident": selectedEntityReady,
      "sketch.midpoint": selectedEntityReady,
      "sketch.parallel":
        selectedEntity?.kind === "line"
          ? ready
          : needs("Select an eligible line."),
      "sketch.perpendicular":
        selectedEntity?.kind === "line"
          ? ready
          : needs("Select an eligible line."),
      "sketch.rectangle-width":
        selectedEntity?.kind === "rectangle"
          ? ready
          : needs("Select a rectangle."),
      "sketch.rectangle-height":
        selectedEntity?.kind === "rectangle"
          ? ready
          : needs("Select a rectangle."),
      "sketch.line-length":
        selectedEntity?.kind === "line" ? ready : needs("Select a line."),
      "sketch.radius":
        selectedEntity?.kind === "circle" || selectedEntity?.kind === "arc"
          ? ready
          : needs("Select a circle or arc."),
      "sketch.arc-sweep":
        selectedEntity?.kind === "arc" ? ready : needs("Select an arc."),
      "inspect.mass-properties": selectedBody ? ready : needs("Select a body."),
      "inspect.name-reference":
        selectedGeneratedReferenceState.status === "selected"
          ? ready
          : needs("Select a supported face or edge."),
      "inspect.repair-reference":
        selectedNamedReferenceName &&
        selectedGeneratedReferenceState.status === "selected"
          ? ready
          : needs("Select a named reference and its replacement."),
      "inspect.fit-selection": selectedViewportRenderId
        ? ready
        : needs("Select a visible body, face, or edge.")
    };
  }, [
    document,
    focusedSketchId,
    modelingSelectionContext,
    selectedBody,
    selectedEntityProfile,
    selectedFeature,
    selectedGeneratedReferenceState,
    selectedNamedReferenceName,
    selectedObject,
    selectedPath,
    selectedProfile,
    selectedSketchContext,
    selectedSolidBodyId,
    selectedViewportRenderId,
    sketches,
    solidAxisChoices.length,
    solidEdgeChoices.length,
    solidProfileChoices
  ]);
  const workbenchActionRunnerRef = useRef<(id: UiActionId) => void>(
    () => undefined
  );
  workbenchActionRunnerRef.current = runWorkbenchAction;
  const uiActionContext = useMemo<UiActionContext>(
    () => ({
      availability: uiActionAvailability,
      pending: commandPending,
      runAction: (id) => workbenchActionRunnerRef.current(id),
      explainUnavailable: (_id, availability) =>
        setCommandNotice(availability.message)
    }),
    [commandPending, uiActionAvailability]
  );
  const projectedUiActions = useMemo(
    () => projectUiActions(uiActionContext),
    [uiActionContext]
  );
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dispatchWorkbench({
          type: "set-command-search-open",
          open: true
        });
      }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  return (
    <>
      <WorkbenchShell
        mode={workbenchUi.mode}
        leftDockWidth={workbenchUi.leftDockWidth}
        rightDockWidth={workbenchUi.rightDockWidth}
        leftDockCollapsed={workbenchUi.leftDockCollapsed}
        rightDockCollapsed={workbenchUi.rightDockCollapsed}
        projectDetailsOpen={false}
        onDockCollapsedChange={(side, collapsed) =>
          dispatchWorkbench({
            type: "set-dock-collapsed",
            side,
            collapsed
          })
        }
        onDockWidthChange={(side, width) =>
          dispatchWorkbench({ type: "set-dock-width", side, width })
        }
        header={
          <>
            <GlobalHeader
              documentName={getProjectFileNameLabel(projectFile)}
              saveState={
                projectFile.dirty || projectFile.mode === "unsaved"
                  ? "unsaved"
                  : projectFile.mode === "wcadHandle" && projectFileHandle
                    ? "saved-local"
                    : "saved-browser"
              }
              undo={{
                available:
                  !commandPending && engine.getTransactions().length > 0,
                pending: commandPending,
                unavailableReason:
                  engine.getTransactions().length === 0
                    ? "There is nothing to undo."
                    : undefined,
                run: undo
              }}
              redo={{
                available: !commandPending && engine.getRedoStack().length > 0,
                pending: commandPending,
                unavailableReason:
                  engine.getRedoStack().length === 0
                    ? "There is nothing to redo."
                    : undefined,
                run: redo
              }}
              onOpenCommandSearch={() =>
                dispatchWorkbench({
                  type: "set-command-search-open",
                  open: true
                })
              }
              onOpenHelp={() =>
                setCommandNotice(
                  "Shortcuts: Ctrl+K search, Ctrl+Z undo, Ctrl+Shift+Z redo, F fit, Escape cancel."
                )
              }
              pendingLabel={commandPending ? "Updating model" : undefined}
            />
          </>
        }
        ribbon={
          <ModeRibbon
            mode={workbenchUi.mode}
            actions={projectedUiActions}
            activeActionId={workbenchUi.activeTool}
            onModeChange={navigateToMode}
            onInvokeAction={(action) =>
              void invokeUiAction(action, uiActionContext)
            }
            onExplainUnavailable={(_action, availability) =>
              setCommandNotice(availability.message)
            }
          />
        }
        leftDock={
          workbenchUi.mode === "project" ? (
            <nav className="pb-project-navigation" aria-label="Project pages">
              {(
                [
                  ["overview", "Overview"],
                  ["files", "Files"],
                  ["parameters", "Parameters"],
                  ["history", "History"],
                  ["export", "Export"]
                ] as const
              ).map(([page, label]) => (
                <button
                  key={page}
                  type="button"
                  aria-current={
                    (workbenchUi.projectPage ?? "overview") === page
                      ? "page"
                      : undefined
                  }
                  onClick={() => openProjectPage(page)}
                >
                  {label}
                </button>
              ))}
            </nav>
          ) : (
            <DocumentTreeDock
              projection={documentTreeProjection}
              selectedKey={selectedDocumentTreeKey}
              editingKey={
                workbenchUi.activeEditor?.sourceId
                  ? `feature:${workbenchUi.activeEditor.sourceId}`
                  : undefined
              }
              onSelect={selectDocumentTreeItem}
              onRename={renameDocumentTreeItem}
              onEdit={editDocumentTreeItem}
              onDelete={deleteDocumentTreeItem}
            />
          )
        }
        viewport={
          <ViewportCanvas
            primitives={renderScene.primitives}
            meshes={renderScene.meshes}
            notifyHoverPointChanges={Boolean(threePointArcTool)}
            selectedId={selectedViewportRenderId}
            visualStates={viewportVisualState.rendererVisualStates}
            status={viewportVisualState.status}
            contextualSurface={
              <ContextualActionStrip
                disabled={commandPending}
                surface={viewportContextualCommandSurface}
                onInvoke={(action) => {
                  if (action.route === "name" && action.target) {
                    const name = window.prompt("Reference name", "");
                    if (name?.trim()) {
                      void nameGeneratedReference(name.trim(), action.target);
                    }
                    return;
                  }
                  if (
                    action.route === "inspect" ||
                    action.route === "measure" ||
                    action.route === "references"
                  ) {
                    navigateToMode("inspect");
                    if (
                      action.route === "measure" &&
                      viewportTwoTargetMeasurementTarget
                    ) {
                      startViewportTwoTargetMeasurement(
                        viewportTwoTargetMeasurementTarget
                      );
                    }
                    return;
                  }
                  runViewportContextualCommand(action);
                }}
              />
            }
            onHover={(pick) => {
              if (threePointArcTool) {
                hoverThreePointArcTool(pick);
              } else {
                hoverViewportPick(pick);
              }
            }}
            onSelect={(pick) => {
              if (threePointArcTool) {
                void captureThreePointArcToolPick(pick);
              } else {
                selectViewportPick(pick);
              }
            }}
            onCancelTransientState={clearViewportTransientState}
            sketchOverlay={({ camera, size }) => (
              <>
                {sketchViewportDragTarget ? (
                  <SketchViewportDragOverlay
                    camera={camera}
                    disabled={commandPending}
                    displayFrame={getSketchViewportDisplayFrame(
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
                ) : null}
                {threePointArcTool &&
                getSketchViewportDisplayFrame(threePointArcTool.sketchId) ? (
                  <SketchArcToolOverlay
                    camera={camera}
                    displayFrame={
                      getSketchViewportDisplayFrame(threePointArcTool.sketchId)!
                    }
                    session={threePointArcTool}
                    size={size}
                  />
                ) : null}
              </>
            )}
          />
        }
        projectWorkspace={
          <Suspense
            fallback={<p className="panel-loading">Loading project…</p>}
          >
            <ProjectWorkspace
              page={workbenchUi.projectPage ?? "overview"}
              disabled={commandPending}
              documentName={getProjectFileNameLabel(projectFile)}
              units={document.units}
              summary={currentProjectSummary}
              projectFile={projectFile}
              storageCapabilities={projectStorageCapabilities}
              health={projectHealth}
              topologyIdentityReadiness={projectTopologyIdentityReadiness}
              importReadiness={projectImportReadiness}
              exportReadiness={projectExportReadiness}
              visualizationExport={visualizationMeshExportStatus}
              jsonDraft={projectJson}
              jsonWorkflow={projectJsonWorkflow}
              opfsCacheStatus={projectOpfsCacheStatus}
              parameters={parameters}
              parameterEvaluation={parameterEvaluation}
              parameterUsageCounts={parameterUsageCounts}
              transactions={transactionHistory}
              canUndo={engine.getTransactions().length > 0}
              canRedo={engine.getRedoStack().length > 0}
              message={projectMessage}
              messageTone={projectMessageTone}
              onNew={createNewProject}
              onOpenWcad={openProjectWcad}
              onOpenStep={openProjectStepImport}
              onOpenWcadFileLoaded={(bytes, fileName) =>
                void importProjectWcadBytes(bytes, fileName, "uploadedFallback")
              }
              onStepFileLoaded={(bytes, fileName) =>
                void importProjectStepBytes(bytes, fileName)
              }
              onJsonFileLoaded={loadProjectJsonDraft}
              onFileError={(message) => {
                setProjectMessage(message);
                setProjectMessageTone("error");
              }}
              onSave={() => void saveProjectWcad()}
              onSaveAs={() => void saveProjectWcadAs()}
              onPrepareJson={exportProjectJson}
              onDownloadJson={downloadProjectJson}
              onJsonDraftChange={(value) => {
                setProjectJson(value);
                setProjectJsonDraftSource(
                  createProjectJsonDraftSourceForEditorValue(value)
                );
                setProjectMessage(undefined);
              }}
              onImportJson={importProjectJson}
              onRefreshOpfsCache={() => void refreshProjectOpfsCache(true)}
              onClearOpfsCache={() => void clearProjectOpfsCache()}
              onDownloadStep={() => void downloadExactStepExport()}
              onDownloadVisualization={downloadVisualizationMeshExport}
              onUpdateUnits={(units, mode) =>
                void updateDocumentUnits(units, mode)
              }
              onCreateParameter={(form) => void createParameter(form)}
              onEditParameter={(parameter, form) =>
                void applyParameterEdit(parameter, form)
              }
              onDeleteParameter={(parameterId) =>
                void deleteParameter(parameterId)
              }
              onUndo={undo}
              onRedo={redo}
            />
          </Suspense>
        }
        rightDock={
          <div className="right-rail" aria-label="Project and modeling tools">
            {workbenchUi.mode === "solid" ? (
              <Suspense
                fallback={
                  <p className="panel-loading">Loading modeling tools…</p>
                }
              >
                <SolidModePanel
                  activeEditor={solidEditorRequest}
                  onApply={applySolidEditorSubmission}
                  onCancel={() =>
                    dispatchWorkbench({ type: "set-active-tool" })
                  }
                  onDelete={
                    selectedObject
                      ? () => void deleteSelectedObject()
                      : selectedFeature
                        ? () => void deleteAuthoredFeature(selectedFeature.id)
                        : undefined
                  }
                  onCollect={(request) =>
                    setCommandNotice(
                      `Select ${request.acceptedKinds.join(" or ")} in the viewport or model tree.`
                    )
                  }
                />
              </Suspense>
            ) : null}

            {workbenchUi.mode === "inspect" ? (
              <Suspense
                fallback={<p className="panel-loading">Loading inspection…</p>}
              >
                <InspectPanel
                  selection={inspectSelection}
                  measurements={inspectMeasurements}
                  massProperties={inspectMassProperties}
                  reference={inspectReference}
                  health={inspectHealth}
                  onMeasureSelection={
                    viewportTwoTargetMeasurementTarget
                      ? () =>
                          startViewportTwoTargetMeasurement(
                            viewportTwoTargetMeasurementTarget
                          )
                      : undefined
                  }
                  onBeginTwoTargetMeasurement={
                    viewportTwoTargetMeasurementTarget
                      ? () =>
                          startViewportTwoTargetMeasurement(
                            viewportTwoTargetMeasurementTarget
                          )
                      : undefined
                  }
                  onClearTwoTargetMeasurement={
                    viewportTwoTargetMeasurementSessionActive
                      ? clearViewportTwoTargetMeasurement
                      : undefined
                  }
                  onNameReference={
                    selectedGeneratedReferenceState.status === "selected"
                      ? () => {
                          const name = window.prompt(
                            "Reference name",
                            inspectReference?.name ?? ""
                          );
                          if (name?.trim()) {
                            void nameGeneratedReference(
                              name.trim(),
                              selectedGeneratedReferenceState.selection
                            );
                          }
                        }
                      : undefined
                  }
                  onRepairReference={
                    selectedNamedReferenceName &&
                    selectedGeneratedReferenceState.status === "selected"
                      ? () =>
                          void repairNamedReference(
                            selectedNamedReferenceName,
                            selectedGeneratedReferenceState.selection
                          )
                      : undefined
                  }
                  onSaveStableReference={
                    selectedGeneratedReferenceState.status === "selected" &&
                    !selectedGeneratedReferenceState.selection.topologyAnchorId
                      ? () =>
                          void createStableTopologyReference(
                            selectedGeneratedReferenceState.selection
                          )
                      : undefined
                  }
                  onPreviewStableRepair={
                    selectedGeneratedReferenceState.status === "selected" &&
                    selectedGeneratedReferenceState.selection.topologyAnchorId
                      ? () =>
                          void previewStableTopologyRepair(
                            selectedGeneratedReferenceState.selection
                          )
                      : undefined
                  }
                  onRepairStableReference={
                    selectedGeneratedReferenceState.status === "selected" &&
                    topologyRepairPreview?.preview?.rows.some(
                      (row) => row.repairable
                    )
                      ? () => {
                          const candidate =
                            topologyRepairPreview.preview?.rows.find(
                              (row) => row.repairable
                            );
                          if (candidate) {
                            void repairStableTopologyReference(
                              selectedGeneratedReferenceState.selection,
                              candidate.candidateId
                            );
                          }
                        }
                      : undefined
                  }
                />
              </Suspense>
            ) : null}

            {workbenchUi.mode === "sketch" ? (
              <Suspense
                fallback={
                  <p className="panel-loading">Loading sketch tools…</p>
                }
              >
                <SketchModeDock
                  key={`${focusedSketchId ?? "sketch-mode"}:${workbenchUi.activeTool ?? ""}`}
                  disabled={commandPending}
                  sketches={sketches}
                  parameters={parameters}
                  features={projectStructure.features}
                  dimensionsBySketchId={sketchDimensionsBySketchId}
                  evaluationsBySketchId={sketchEvaluationsBySketchId}
                  solverStatusesBySketchId={sketchSolverStatusesBySketchId}
                  pathCandidatesBySketchId={pathCandidatesBySketchId}
                  activeSketchId={focusedSketchId}
                  selectedEntityId={selectedSketchContext?.entityId}
                  arcToolActiveSketchId={threePointArcTool?.sketchId}
                  initialActionId={
                    workbenchUi.activeTool as UiActionId | undefined
                  }
                  onSelectSketch={focusSketch}
                  onSelectEntity={focusSketch}
                  onCreateSketch={(form) => void createSketch(form)}
                  onAddEntity={(sketchId, kind, form) =>
                    void addSketchEntity(sketchId, kind, form)
                  }
                  onUpdateEntity={(sketchId, entity) =>
                    void updateSketchEntity(sketchId, entity)
                  }
                  onDeleteEntity={(sketchId, entityId) =>
                    void deleteSketchEntity(sketchId, entityId)
                  }
                  onSetEntityConstruction={(sketchId, entityId, construction) =>
                    void setSketchEntityConstruction(
                      sketchId,
                      entityId,
                      construction
                    )
                  }
                  onStartThreePointArcTool={startThreePointArcTool}
                  onCancelGesture={() => setThreePointArcTool(undefined)}
                  onCreateDimension={(sketchId, entityId, target, form) =>
                    void createSketchDimension(sketchId, entityId, target, form)
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
                  onFinish={() => {
                    setThreePointArcTool(undefined);
                    navigateToMode("solid");
                  }}
                />
              </Suspense>
            ) : null}
          </div>
        }
        statusBar={
          workbenchUi.mode === "project" ? (
            <StatusBar
              mode="project"
              fileState={getProjectFileNameLabel(projectFile)}
              saveState={getProjectFileDirtyLabel(projectFile)}
              readiness={
                commandError ?? commandNotice ?? "Review export readiness"
              }
              pendingLabel={commandPending ? "Updating model" : undefined}
            />
          ) : workbenchUi.mode === "sketch" ? (
            <StatusBar
              mode="sketch"
              instruction={
                commandError ??
                commandNotice ??
                (threePointArcTool
                  ? "Place the next arc point"
                  : focusedSketchId
                    ? "Sketch tools are ready"
                    : "Select or create a sketch")
              }
              zoom="Viewport"
              units={document.units}
              solver={formatSketchSolverStatus(
                focusedSketchId
                  ? sketchSolverStatusesBySketchId.get(focusedSketchId)
                  : undefined
              )}
              pendingLabel={commandPending ? "Updating sketch" : undefined}
            />
          ) : workbenchUi.mode === "inspect" ? (
            <StatusBar
              mode="inspect"
              instruction={
                commandError ??
                commandNotice ??
                (viewportTwoTargetMeasurementSessionActive
                  ? "Select the second measurement target"
                  : "Select geometry to inspect")
              }
              selectionFilter={workbenchUi.selectionFilter}
              onSelectionFilterChange={(filter) =>
                dispatchWorkbench({
                  type: "set-selection-filter",
                  filter
                })
              }
              zoom="Viewport"
              units={document.units}
              pendingLabel={commandPending ? "Updating model" : undefined}
            />
          ) : (
            <StatusBar
              mode="solid"
              instruction={
                commandError ??
                commandNotice ??
                (selectedGeneratedReference
                  ? "Reference selected"
                  : selectedBody
                    ? "Body selected"
                    : selectedObject
                      ? "Object selected"
                      : "Select geometry or choose a modeling tool")
              }
              selectionFilter={workbenchUi.selectionFilter}
              onSelectionFilterChange={(filter) =>
                dispatchWorkbench({
                  type: "set-selection-filter",
                  filter
                })
              }
              zoom="Viewport"
              units={document.units}
              rebuildState={modelingResultState}
              pendingLabel={commandPending ? "Updating model" : undefined}
            />
          )
        }
      />
      <CommandSearchDialog
        open={workbenchUi.commandSearchOpen}
        actions={projectedUiActions}
        actionContext={uiActionContext}
        currentMode={workbenchUi.mode}
        onRequestClose={() =>
          dispatchWorkbench({
            type: "set-command-search-open",
            open: false
          })
        }
        onInvocationError={(_action, error) =>
          setCommandError(
            error instanceof Error
              ? error.message
              : "The command could not be started."
          )
        }
      />
    </>
  );
}
