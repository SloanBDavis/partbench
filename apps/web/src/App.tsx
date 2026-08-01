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
  type CadProject,
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
  FeatureShellOpenFaceRef,
  MirrorPlaneRef,
  PatternDirectionRef,
  PatternRotationAxisRef,
  CadQueryRequest,
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
  ProjectExportReadinessQueryResponse,
  ProjectHealthQueryResponse,
  ProjectImportReadinessQueryResponse,
  ProjectParameterEvaluationQueryResponse,
  ProjectTopologyIdentityReadinessQueryResponse,
  ReferenceHealthQueryResponse,
  SelectionReferenceCandidatesQueryResponse,
  TopologyCommandTargetReadinessQueryResponse,
  SketchDimensionEntryCurrent,
  SketchEvaluationQueryResponse,
  SketchSolverStatusQueryResponse,
  SketchPathCandidatesQueryResponse,
  SketchProfileCandidatesQueryResponse,
  WcadPackageValidationIssue,
  SketchEntitySnapshot,
  SketchSnapshot,
  SketchPathRef,
  SketchProfileRef,
  PreparedSketchCurveEditOp,
  SketchAddRoundedRectangleOp,
  SketchAddSlotOp,
  SketchCurveEditProposal,
  SketchProfileRegionCandidate,
  SketchProfileRegionCandidatesQuery,
  SketchProfileRegionValidateQueryResponse,
  SketchProfileRefV22,
  SketchRegionsProfileRef,
  Vec2
} from "@web-cad/cad-protocol";
import type { SketchRegionFeatureDraft } from "./modes/sketch/SketchRegionSelectionPanel";
import { createDerivedGeometryRuntime } from "@web-cad/derived-geometry-runtime";
import { emitGeometryDiagnosticEvent } from "./geometryDiagnosticEvents";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  lazy,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  Suspense,
  useState,
  type ReactNode
} from "react";
import {
  EMPTY_PROGRESSIVE_SKETCH_ANALYSIS,
  ProgressiveSketchAnalysisContext,
  useProgressiveSketchAnalysis,
  type ProgressiveSketchAnalysis
} from "./progressiveSketchAnalysisContext";
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
  buildCreateSphereOp,
  buildCreateTorusOp,
  buildDeleteParameterOp,
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
  type PrimitiveCommandForm,
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
  UI_ACTION_AVAILABILITY_MESSAGES,
  type UiActionAvailability,
  type UiActionAvailabilityProjection,
  type UiActionContext,
  type UiActionId
} from "./actions/actionRegistry";
import {
  formatShortcutHelpNotice,
  resolveShortcutRouterAction
} from "./actions/shortcutRouter";
import {
  closeTransientPopoversInDocument,
  hasTransientPopoverInDocument,
  resolveContributedEscapeEditorState,
  resolveEscapeRung
} from "./actions/escapeStackModel";
import {
  getFeatureApplyCanApply,
  subscribeFeatureApplyBridge,
  tryApplyFeatureDraft
} from "./editors/featureApplyBridge";
import {
  markPartbenchPerformance,
  PARTBENCH_PERFORMANCE_MARKS
} from "./workbench/performanceMarks";
import { GlobalHeader } from "./workbench/GlobalHeader";
import { ModeRibbon } from "./workbench/ModeRibbon";
import { StatusBar, type SketchStatus } from "./workbench/StatusBar";
import { WorkbenchShell } from "./workbench/WorkbenchShell";
import type { WorkbenchNavigationIntent } from "./workbench/types";
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
  type EdgeChoiceValue,
  type SolidChoice,
  type SolidCollectorRequest,
  type SolidCollectorSelection,
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
import type { SketchCurveEditSessionControl } from "./modes/sketch/SketchCurveEditPanel";
import { projectSketchCurveEditViewportPoint } from "./modes/sketch/sketchCurveEditViewportProjection";
import {
  getCurveEditDiscardFocusTarget,
  shouldRestoreResolvedCurveEditNavigationFocus
} from "./modes/sketch/curveEditNavigationGuardModel";
import type { SketchCurveEditViewportChoice } from "./modes/sketch/sketchCurveEditModel";
import { SketchCurveEditHoverScheduler } from "./modes/sketch/sketchCurveEditHoverScheduler";
import {
  normalizeSketchRegionSelectionForConsumer,
  updateSketchRegionSelection,
  type SketchRegionConsumerIntent
} from "./modes/sketch/sketchRegionSelectionModel";
import {
  type SketchRegionQueryClient,
  type SketchRegionCandidatesQueryResult,
  type SketchRegionValidateQueryResult
} from "./sketchRegionQueryClient";
import type { SketchCurveEditQueryClient } from "./sketchCurveEditQueryClient";
import {
  getActiveCurveEditInvocationAction,
  getCurveEditSketchSelectionAction,
  getSketchEditorActionNotice,
  getSketchCurveEditOwnershipPolicy
} from "./modes/sketch/sketchCurveEditOwnership";
import { submitPreparedSketchCurveEdit } from "./modes/sketch/sketchCurveEditWorkflow";
import {
  DocumentTreeDock,
  type DocumentTreeDockProps
} from "./workbench/DocumentTreeDock";
import {
  createDocumentTreeProjection,
  documentTreeSelectionKey,
  type CreateDocumentTreeProjectionInput,
  type DocumentTreeRowCapabilities,
  type DocumentTreeSelection
} from "./workbench/documentTreeProjection";
import { ContextualActionStrip } from "./workbench/ContextualActionStrip";
import type { ViewportCanvasPick } from "./components/ViewportCanvas";
import {
  VIEWPORT_COMMAND_EVENT,
  type ViewportCommand
} from "./components/viewportCanvasContract";
import type {
  DerivedGeometryRuntime,
  DerivedGeometryRuntimeWorkSnapshot
} from "./derivedGeometryRuntime";
import {
  createEmptyDerivedGeometrySnapshot,
  DerivedGeometryService,
  type DerivedGeometrySource,
  type DerivedGeometrySnapshot
} from "./derivedGeometry";
import { createBodyGeneratedReferenceEvidence } from "./derivedGeneratedReferences";
import {
  createLazyDerivedMeshOpfsCache,
  DERIVED_MESH_CACHE_ARTIFACT_VERSION,
  type DerivedMeshCacheContext
} from "./derivedMeshOpfsCacheLazy";
import type {
  VisualizationMeshExportResult,
  VisualizationMeshExportStatus
} from "./visualizationMeshExport";
import {
  createBodyTopologyDerivedExactMetadataSnapshot,
  createEmptyDerivedExactMetadataSnapshot,
  DerivedExactMetadataService,
  formatDerivedExactMetadataEntryStatus,
  getCurrentDerivedExactMetadataEntryForBody,
  planExactMetadataRetry,
  type DerivedExactMetadataSource,
  type DerivedExactMetadataSnapshot
} from "./derivedExactMetadata";
import {
  getReadyRuntimeExactSources,
  resolveCurrentExactBodies
} from "./currentExactBodyResolver";
import {
  createCurrentDerivedExactMetadataSnapshots,
  readProjectExactStepExport,
  readProjectExportReadiness
} from "./projectExactExportQueries";
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
  getSelectionReferenceCandidateForOperation,
  type GeneratedReferenceSelectionState,
  type SelectedGeneratedReference
} from "./generatedReferenceSelection";
import {
  createAddTargetBodyOptions,
  createCutTargetBodyOptions,
  createHoleTargetBodyOptions
} from "./sketchPanelUi";
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
import type { ViewportSelectionDisplay } from "./viewportSelectionDisplay";
import type { ViewportVisualStateModel } from "./viewportVisualState";
import type { ViewportMeasurementOverlay } from "./viewportMeasurementOverlay";
import { getHistoryKeyboardCommand } from "./viewportKeyboard";
import type {
  ViewportTwoTargetMeasurementSession,
  ViewportTwoTargetMeasurementTarget,
  ViewportTwoTargetMeasurementView
} from "./viewportTwoTargetMeasurement";
import {
  deriveModelingActions,
  type ModelingSelectionContext
} from "./modelingActions";
import type { ProjectJsonDraftSource } from "./projectJson";
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
import { isProjectWcadTopologyCheckpointPayloadError } from "./projectWcadTopologyCheckpointErrors";
import type {
  createProjectTopologyAnchorCreationPlanForGeneratedReference,
  createProjectTopologyAnchorRepairPlanForGeneratedReference
} from "./projectWcadTopologyCheckpoints";
import { createProjectStepImportPayloadStore } from "./projectStepImportPayloadStore";
import {
  createTopologyRepairCandidatePreview,
  createTopologyRepairPreviewKey,
  type TopologyRepairCandidatePreviewState
} from "./topologyRepairCandidatesUi";
import type { ProjectOpfsCacheTargetLike } from "./projectOpfsCache";
import { createInitialProjectOpfsCacheStatus } from "./projectOpfsCacheInitial";
import {
  clearLazyProjectOpfsCache,
  readLazyProjectOpfsCacheStatus
} from "./projectOpfsCacheLazy";
import type { SketchPanelSelectionContext } from "./sketchPanelUi";
import { createSketchModelingSelectionContext } from "./sketchModelingSelectionContext";
import {
  formatSketchSolverStatus,
  getParameterDimensionUsageCount
} from "./sketchStatusSummary";
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
const LocalAgentSessionController = lazy(() =>
  import("./LocalAgentSessionController").then((module) => ({
    default: module.LocalAgentSessionController
  }))
);
const SketchModeDock = lazy(() =>
  import("./modes/sketch").then((module) => ({
    default: module.SketchModeDock
  }))
);
const CommandSearchDialog = lazy(() =>
  import("./actions/CommandSearchDialog").then((module) => ({
    default: module.CommandSearchDialog
  }))
);
const CurveEditNavigationGuard = lazy(() =>
  import("./modes/sketch").then((module) => ({
    default: module.CurveEditNavigationGuard
  }))
);
const SketchViewportDragOverlay = lazy(() =>
  import("./modes/sketch").then((module) => ({
    default: module.SketchViewportDragOverlay
  }))
);
const SketchArcToolOverlay = lazy(() =>
  import("./modes/sketch").then((module) => ({
    default: module.SketchArcToolOverlay
  }))
);
const SketchRegionOverlay = lazy(() =>
  import("./modes/sketch").then((module) => ({
    default: module.SketchRegionOverlay
  }))
);
const ViewportCanvas = lazy(() =>
  import("./components/ViewportCanvas").then((module) => ({
    default: module.ViewportCanvas
  }))
);

function CommandSearchLoadingFallback({
  onRequestClose
}: {
  readonly onRequestClose: () => void;
}) {
  return (
    <div className="pb-modal-loading-backdrop">
      <div
        className="pb-modal-loading"
        role="dialog"
        aria-modal="true"
        aria-label="Loading command search"
        aria-busy="true"
        tabIndex={-1}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onRequestClose();
          } else if (event.key === "Tab") {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <span role="status" aria-live="polite">
          Loading command search…
        </span>
      </div>
    </div>
  );
}

function SketchOverlayLoadingFallback() {
  return (
    <div
      className="sketch-overlay-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      Loading sketch controls…
    </div>
  );
}

const engine = new CadEngine();
let cadV19RegionSourceValidationPolicyLoad: Promise<void> | undefined;

function ensureCadV19RegionSourceValidationPolicy(): Promise<void> {
  cadV19RegionSourceValidationPolicyLoad ??=
    import("@web-cad/cad-core/region-source-validation-policy").then(
      () => undefined
    );
  return cadV19RegionSourceValidationPolicyLoad;
}

const derivedGeometryEnabled = __PARTBENCH_DERIVED_GEOMETRY_ENABLED__;

type DerivedGeometrySourceBuilders = Pick<
  typeof import("./derivedGeometrySources"),
  | "createAuthoredFeatureDerivedGeometrySources"
  | "createDerivedGeometrySourcesFromDocument"
>;

let derivedGeometrySourceBuildersPromise:
  | Promise<DerivedGeometrySourceBuilders>
  | undefined;

function loadDerivedGeometrySourceBuilders(): Promise<DerivedGeometrySourceBuilders> {
  derivedGeometrySourceBuildersPromise ??= import("./derivedGeometrySources");
  return derivedGeometrySourceBuildersPromise;
}
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
      brepByteLength: payload.manifestEntry.brep.byteLength,
      brepSha256: payload.manifestEntry.brep.sha256,
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

function isSketchCurveEditUiAction(
  actionId: string | undefined
): actionId is
  | "sketch.trim"
  | "sketch.extend"
  | "sketch.split"
  | "sketch.explode-rectangle"
  | "sketch.offset" {
  return (
    actionId === "sketch.trim" ||
    actionId === "sketch.extend" ||
    actionId === "sketch.split" ||
    actionId === "sketch.explode-rectangle" ||
    actionId === "sketch.offset"
  );
}

function createCurveEditActionAvailability(
  sketch: SketchSnapshot | undefined,
  selectedEntity: SketchEntitySnapshot | undefined,
  supportedKinds: readonly SketchEntitySnapshot["kind"][],
  selectionMessage: string
): UiActionAvailability {
  if (!sketch) {
    return {
      status: "needs-selection",
      message: "Select or create a sketch first."
    };
  }
  if (selectedEntity && supportedKinds.includes(selectedEntity.kind)) {
    return { status: "ready" };
  }
  if (sketch.entities.some((entity) => supportedKinds.includes(entity.kind))) {
    return { status: "needs-selection", message: selectionMessage };
  }
  return {
    status: "blocked",
    message: `This sketch has no eligible ${supportedKinds.join(", ")} geometry.`
  };
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

function readEngineStateForDocument<T>(
  documentSnapshot: CadDocument,
  read: () => T
): T {
  void documentSnapshot;

  return read();
}

function exportCadProjectForDocument(
  engine: CadEngine,
  documentSnapshot: CadDocument
) {
  return readEngineStateForDocument(documentSnapshot, () =>
    exportCadProject(engine)
  );
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

function getCommandableReferenceCandidate(
  response: SelectionReferenceCandidatesQueryResponse | undefined,
  operation: CadSelectionReferenceOperation
) {
  const candidate = getSelectionReferenceCandidateForOperation(
    response,
    operation
  );
  return candidate?.commandable &&
    candidate.commandOperations.includes(operation)
    ? candidate
    : undefined;
}

function createSolidEdgeChoices(
  references: BodyGeneratedReferencesQueryResponse | undefined,
  namedReferences: readonly NamedGeneratedReferenceEntry[],
  candidatesByStableId: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  candidatesByName: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  operation: "feature.chamfer" | "feature.fillet"
): readonly SolidChoice<EdgeChoiceValue>[] {
  const choices: SolidChoice<EdgeChoiceValue>[] = [];
  for (const edge of references?.edges ?? []) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByStableId.get(edge.stableId),
      operation
    );
    if (!candidate || candidate.reference.kind !== "edge") continue;
    choices.push({
      key: `${operation}:${candidate.target.topologyAnchorId ? "topology" : "generated"}:${edge.stableId}`,
      value: {
        targetBodyId: candidate.target.bodyId,
        ...(candidate.target.topologyAnchorId
          ? { topologyAnchorId: candidate.target.topologyAnchorId }
          : { edgeStableId: candidate.target.stableId })
      },
      label: edge.label,
      kind: candidate.target.topologyAnchorId ? "saved edge" : "edge"
    });
  }
  for (const reference of namedReferences) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByName.get(reference.name),
      operation
    );
    if (!candidate || candidate.reference.kind !== "edge") continue;
    choices.push({
      key: `${operation}:named:${reference.name}`,
      value: {
        targetBodyId: candidate.target.bodyId,
        namedReference: reference.name
      },
      label: reference.name,
      kind: "named edge"
    });
  }
  return choices;
}

function createSolidDirectionChoices(
  references: BodyGeneratedReferencesQueryResponse | undefined,
  namedReferences: readonly NamedGeneratedReferenceEntry[],
  candidatesByStableId: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  candidatesByName: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  operation: "feature.linearPatternDirection" | "feature.circularPatternAxis"
): readonly SolidChoice<PatternDirectionRef>[] {
  const choices: SolidChoice<PatternDirectionRef>[] = (
    ["x", "y", "z"] as const
  ).map((axis) => ({
    key: `${operation}:axis:${axis}`,
    value: { kind: "globalAxis", axis },
    label: `${axis.toUpperCase()} axis`,
    kind: "global axis"
  }));
  for (const edge of references?.edges ?? []) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByStableId.get(edge.stableId),
      operation
    );
    if (!candidate || candidate.reference.kind !== "edge") continue;
    choices.push({
      key: `${operation}:${candidate.target.topologyAnchorId ? "topology" : "generated"}:${edge.stableId}`,
      value: candidate.target.topologyAnchorId
        ? {
            kind: "topologyAnchor",
            bodyId: candidate.target.bodyId,
            anchorId: candidate.target.topologyAnchorId
          }
        : {
            kind: "generatedEdge",
            bodyId: candidate.target.bodyId,
            stableId: candidate.target.stableId
          },
      label: edge.label,
      kind: candidate.target.topologyAnchorId ? "saved line edge" : "line edge"
    });
  }
  for (const reference of namedReferences) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByName.get(reference.name),
      operation
    );
    if (!candidate || candidate.reference.kind !== "edge") continue;
    choices.push({
      key: `${operation}:named:${reference.name}`,
      value: { kind: "namedReference", name: reference.name },
      label: reference.name,
      kind: "named line edge"
    });
  }
  return choices;
}

function createSolidFaceChoices(
  references: BodyGeneratedReferencesQueryResponse | undefined,
  namedReferences: readonly NamedGeneratedReferenceEntry[],
  candidatesByStableId: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  candidatesByName: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >,
  operation: "feature.shell" | "feature.mirrorPlane"
): readonly SolidChoice<FeatureShellOpenFaceRef>[] {
  const choices: SolidChoice<FeatureShellOpenFaceRef>[] = [];
  for (const face of references?.faces ?? []) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByStableId.get(face.stableId),
      operation
    );
    if (!candidate || candidate.reference.kind !== "face") continue;
    choices.push({
      key: `${operation}:${candidate.target.topologyAnchorId ? "topology" : "generated"}:${face.stableId}`,
      value: candidate.target.topologyAnchorId
        ? {
            kind: "topologyAnchor",
            bodyId: candidate.target.bodyId,
            anchorId: candidate.target.topologyAnchorId
          }
        : {
            kind: "generatedFace",
            bodyId: candidate.target.bodyId,
            stableId: candidate.target.stableId
          },
      label: face.label,
      kind: candidate.target.topologyAnchorId ? "saved planar face" : "face",
      targetBodyId: candidate.target.bodyId
    });
  }
  for (const reference of namedReferences) {
    const candidate = getCommandableReferenceCandidate(
      candidatesByName.get(reference.name),
      operation
    );
    if (!candidate || candidate.reference.kind !== "face") continue;
    choices.push({
      key: `${operation}:named:${reference.name}`,
      value: { kind: "namedReference", name: reference.name },
      label: reference.name,
      kind: "named planar face",
      targetBodyId: candidate.target.bodyId
    });
  }
  return choices;
}

function createSolidMirrorPlaneChoices(
  faceChoices: readonly SolidChoice<FeatureShellOpenFaceRef>[]
): readonly SolidChoice<MirrorPlaneRef>[] {
  return [
    ...(["XY", "XZ", "YZ"] as const).map((plane) => ({
      key: `feature.mirrorPlane:plane:${plane}`,
      value: { kind: "standardPlane" as const, plane },
      label: `${plane} plane`,
      kind: "standard plane"
    })),
    ...faceChoices.map((choice) => ({
      ...choice,
      value: choice.value as MirrorPlaneRef
    }))
  ];
}

function findSelectedEdgeChoice(
  choices: readonly SolidChoice<EdgeChoiceValue>[],
  state: GeneratedReferenceSelectionState,
  selectedName: string | undefined
): SolidChoice<EdgeChoiceValue> | undefined {
  if (selectedName) {
    return choices.find(
      (choice) => choice.value.namedReference === selectedName
    );
  }
  if (state.status !== "selected" || state.reference.kind !== "edge")
    return undefined;
  return choices.find(
    (choice) =>
      choice.value.edgeStableId === state.reference.stableId ||
      (state.selection.topologyAnchorId !== undefined &&
        choice.value.topologyAnchorId === state.selection.topologyAnchorId)
  );
}

function findSelectedDirectionChoice(
  choices: readonly SolidChoice<PatternDirectionRef>[],
  state: GeneratedReferenceSelectionState,
  selectedName: string | undefined
): SolidChoice<PatternDirectionRef> | undefined {
  if (selectedName) {
    return choices.find(
      (choice) =>
        choice.value.kind === "namedReference" &&
        choice.value.name === selectedName
    );
  }
  if (state.status !== "selected" || state.reference.kind !== "edge")
    return undefined;
  return choices.find(
    (choice) =>
      (choice.value.kind === "generatedEdge" &&
        choice.value.stableId === state.reference.stableId) ||
      (choice.value.kind === "topologyAnchor" &&
        choice.value.anchorId === state.selection.topologyAnchorId)
  );
}

function findSelectedFaceChoice<Value extends FeatureShellOpenFaceRef>(
  choices: readonly SolidChoice<Value>[],
  state: GeneratedReferenceSelectionState,
  selectedName: string | undefined
): SolidChoice<Value> | undefined {
  if (selectedName) {
    return choices.find(
      (choice) =>
        choice.value.kind === "namedReference" &&
        choice.value.name === selectedName
    );
  }
  if (state.status !== "selected" || state.reference.kind !== "face")
    return undefined;
  return choices.find(
    (choice) =>
      (choice.value.kind === "generatedFace" &&
        choice.value.stableId === state.reference.stableId) ||
      (choice.value.kind === "topologyAnchor" &&
        choice.value.anchorId === state.selection.topologyAnchorId)
  );
}

function includeCurrentSolidChoice<Value>(
  choices: readonly SolidChoice<Value>[],
  choice: SolidChoice<Value>
): readonly SolidChoice<Value>[] {
  return choices.some(
    (candidate) =>
      JSON.stringify(candidate.value) === JSON.stringify(choice.value)
  )
    ? choices
    : [choice, ...choices];
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
): ReadonlyMap<string, readonly SketchDimensionEntryCurrent[]> {
  const dimensionsBySketchId = new Map<
    string,
    readonly SketchDimensionEntryCurrent[]
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

function readSketchPathCandidatesBySketchId(
  sketches: readonly { readonly id: string }[]
): ReadonlyMap<string, SketchPathCandidatesQueryResponse> {
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
}

function ProgressiveSketchAnalysisProvider({
  active,
  authorityEpoch,
  eager,
  project,
  projectCacheKey,
  sketches,
  children
}: {
  readonly active: boolean;
  readonly authorityEpoch: number;
  readonly eager: ProgressiveSketchAnalysis;
  readonly project: CadProject;
  readonly projectCacheKey: string;
  readonly sketches: readonly SketchSnapshot[];
  readonly children: ReactNode;
}) {
  const nextRequestNumber = useRef(1);
  const [evaluations, setEvaluations] = useState<{
    readonly authorityEpoch: number;
    readonly values: ProgressiveSketchAnalysis["evaluationsBySketchId"];
  }>(() => ({
    authorityEpoch,
    values: EMPTY_PROGRESSIVE_SKETCH_ANALYSIS.evaluationsBySketchId
  }));
  const [solverStatuses, setSolverStatuses] = useState<{
    readonly authorityEpoch: number;
    readonly values: ProgressiveSketchAnalysis["solverStatusesBySketchId"];
  }>(() => ({
    authorityEpoch,
    values: EMPTY_PROGRESSIVE_SKETCH_ANALYSIS.solverStatusesBySketchId
  }));
  const [pathCandidates, setPathCandidates] = useState<{
    readonly authorityEpoch: number;
    readonly values: ProgressiveSketchAnalysis["pathCandidatesBySketchId"];
  }>(() => ({
    authorityEpoch,
    values: EMPTY_PROGRESSIVE_SKETCH_ANALYSIS.pathCandidatesBySketchId
  }));

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const publishIfCurrent = <T,>(
      values: T,
      publish: (state: {
        readonly authorityEpoch: number;
        readonly values: T;
      }) => void
    ) => {
      if (!cancelled && engine.getSourceAuthorityEpoch() === authorityEpoch) {
        startTransition(() => publish({ authorityEpoch, values }));
      }
    };
    const execute = async () => {
      const { getSharedBrowserCadQueryWorker } =
        await import("./browserCadQueryWorker");
      const worker = getSharedBrowserCadQueryWorker();
      const query = async (request: CadQueryRequest) =>
        worker.executeQuery({
          kind: "cad-worker.query",
          id: `sketch_analysis_${nextRequestNumber.current++}`,
          project,
          projectCacheKey,
          request
        });

      const nextEvaluations = new Map<string, SketchEvaluationQueryResponse>();
      for (const sketch of sketches) {
        const response = await query({
          version: "cadops.v1",
          query: { query: "sketch.evaluation", sketchId: sketch.id }
        });
        if (response.ok && response.query === "sketch.evaluation") {
          nextEvaluations.set(sketch.id, response);
        }
      }
      publishIfCurrent(nextEvaluations, setEvaluations);

      const nextSolverStatuses = new Map<
        string,
        SketchSolverStatusQueryResponse
      >();
      for (const sketch of sketches) {
        const response = await query({
          version: "cadops.v1",
          query: { query: "sketch.solverStatus", sketchId: sketch.id }
        });
        if (response.ok && response.query === "sketch.solverStatus") {
          nextSolverStatuses.set(sketch.id, response);
        }
      }
      publishIfCurrent(nextSolverStatuses, setSolverStatuses);

      const nextPathCandidates = new Map<
        string,
        SketchPathCandidatesQueryResponse
      >();
      for (const sketch of sketches) {
        const response = await query({
          version: "cadops.v1",
          query: { query: "sketch.pathCandidates", sketchId: sketch.id }
        });
        if (response.ok && response.query === "sketch.pathCandidates") {
          nextPathCandidates.set(sketch.id, response);
        }
      }
      publishIfCurrent(nextPathCandidates, setPathCandidates);
    };
    void execute().catch(() => {
      // Background analysis retries on the next source revision.
    });
    return () => {
      cancelled = true;
    };
  }, [active, authorityEpoch, project, projectCacheKey, sketches]);

  const value = useMemo<ProgressiveSketchAnalysis>(() => {
    if (!active) return eager;
    return {
      evaluationsBySketchId:
        evaluations.authorityEpoch === authorityEpoch
          ? evaluations.values
          : EMPTY_PROGRESSIVE_SKETCH_ANALYSIS.evaluationsBySketchId,
      solverStatusesBySketchId:
        solverStatuses.authorityEpoch === authorityEpoch
          ? solverStatuses.values
          : EMPTY_PROGRESSIVE_SKETCH_ANALYSIS.solverStatusesBySketchId,
      pathCandidatesBySketchId:
        pathCandidates.authorityEpoch === authorityEpoch
          ? pathCandidates.values
          : EMPTY_PROGRESSIVE_SKETCH_ANALYSIS.pathCandidatesBySketchId
    };
  }, [
    active,
    authorityEpoch,
    eager,
    evaluations,
    pathCandidates,
    solverStatuses
  ]);

  return (
    <ProgressiveSketchAnalysisContext.Provider value={value}>
      {children}
    </ProgressiveSketchAnalysisContext.Provider>
  );
}

function SketchStatusBarWithAnalysis({
  focusedSketchId,
  ...props
}: Omit<SketchStatus, "mode" | "solver"> & {
  readonly focusedSketchId?: string;
}) {
  const analysis = useProgressiveSketchAnalysis();
  return (
    <StatusBar
      {...props}
      mode="sketch"
      solver={formatSketchSolverStatus(
        focusedSketchId
          ? analysis.solverStatusesBySketchId.get(focusedSketchId)
          : undefined
      )}
    />
  );
}

function ProgressiveDocumentTreeDock({
  suppressSourceMutations,
  ...props
}: Omit<DocumentTreeDockProps, "projection"> &
  Omit<CreateDocumentTreeProjectionInput, "capabilitiesBySelectionKey"> & {
    readonly suppressSourceMutations: boolean;
  }) {
  const source = useMemo<CreateDocumentTreeProjectionInput>(
    () => ({
      parts: props.parts,
      parameters: props.parameters,
      sketches: props.sketches,
      features: props.features,
      bodies: props.bodies,
      objects: props.objects,
      namedReferences: props.namedReferences,
      health: props.health
    }),
    [
      props.bodies,
      props.features,
      props.health,
      props.namedReferences,
      props.objects,
      props.parameters,
      props.parts,
      props.sketches
    ]
  );
  const deferredSource = useDeferredValue(source);
  const capabilitiesBySelectionKey = useMemo(() => {
    const entries = new Map<string, DocumentTreeRowCapabilities>();
    const register = (
      selection: DocumentTreeSelection,
      capabilities: DocumentTreeRowCapabilities
    ) =>
      entries.set(
        documentTreeSelectionKey(selection),
        suppressSourceMutations ? {} : capabilities
      );

    for (const parameter of deferredSource.parameters) {
      register(
        { kind: "parameter", id: parameter.id },
        { canEdit: true, canDelete: true }
      );
    }
    for (const sketch of deferredSource.sketches) {
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
    for (const feature of deferredSource.features) {
      register(
        { kind: "feature", id: feature.id },
        {
          canEdit: feature.kind !== "importedBody",
          canDelete: feature.kind !== "primitive"
        }
      );
    }
    for (const object of deferredSource.objects) {
      register(
        { kind: "object", id: object.id },
        { canRename: true, canEdit: true, canDelete: true }
      );
    }
    for (const reference of deferredSource.namedReferences) {
      register(
        { kind: "named-reference", name: reference.name },
        { canEdit: true, canDelete: true }
      );
    }
    return entries;
  }, [deferredSource, suppressSourceMutations]);
  const projection = useMemo(
    () =>
      createDocumentTreeProjection({
        ...deferredSource,
        health: props.health,
        capabilitiesBySelectionKey
      }),
    [capabilitiesBySelectionKey, deferredSource, props.health]
  );

  return (
    <DocumentTreeDock
      projection={projection}
      selectedKey={props.selectedKey}
      editingKey={props.editingKey}
      initialExpandedIds={props.initialExpandedIds}
      onSelect={props.onSelect}
      onToggleVisibility={props.onToggleVisibility}
      onRename={props.onRename}
      onEdit={props.onEdit}
      onDelete={props.onDelete}
    />
  );
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
    readonly SketchDimensionEntryCurrent[]
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

function formatCancelledUserKinds(
  kinds: DerivedGeometryRuntimeWorkSnapshot["cancelledUserKinds"]
): string {
  const labels = kinds.map((kind) =>
    kind === "preflight" ? "hole preflight" : kind
  );
  if (labels.length === 0) return "model operation";
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

const EMPTY_TWO_TARGET_MEASUREMENT: ViewportTwoTargetMeasurementView = {
  status: "idle",
  results: [],
  diagnostics: [],
  prompt: "Select a first measurement target."
};

type ViewportMeasurementRuntime = {
  readonly createOverlay: typeof import("./viewportMeasurementOverlay").createViewportMeasurementOverlay;
  readonly createTarget: typeof import("./viewportTwoTargetMeasurement").createViewportTwoTargetMeasurementTarget;
  readonly createView: typeof import("./viewportTwoTargetMeasurement").createViewportTwoTargetMeasurementView;
  readonly createSelectionDisplay: typeof import("./viewportSelectionDisplay").createViewportSelectionDisplay;
  readonly createVisualState: typeof import("./viewportVisualState").createViewportVisualStateModel;
};

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
  const [modelWorkSnapshot, setModelWorkSnapshot] =
    useState<DerivedGeometryRuntimeWorkSnapshot>({
      generation: 0,
      stopped: false,
      active: false,
      queuedCount: 0,
      cancelledUserKinds: []
    });
  const [viewportMeasurementRuntime, setViewportMeasurementRuntime] =
    useState<ViewportMeasurementRuntime>();
  useEffect(() => {
    let active = true;
    void Promise.all([
      import("./viewportMeasurementOverlay"),
      import("./viewportTwoTargetMeasurement"),
      import("./viewportSelectionDisplay"),
      import("./viewportVisualState")
    ]).then(([overlay, twoTarget, selectionDisplay, visualState]) => {
      if (active) {
        setViewportMeasurementRuntime({
          createOverlay: overlay.createViewportMeasurementOverlay,
          createTarget: twoTarget.createViewportTwoTargetMeasurementTarget,
          createView: twoTarget.createViewportTwoTargetMeasurementView,
          createSelectionDisplay:
            selectionDisplay.createViewportSelectionDisplay,
          createVisualState: visualState.createViewportVisualStateModel
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);
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
  const derivedGeometrySourceBuildersRef = useRef<
    DerivedGeometrySourceBuilders | undefined
  >(undefined);
  const [derivedGeometrySourceBuilders, setDerivedGeometrySourceBuilders] =
    useState<DerivedGeometrySourceBuilders | undefined>(undefined);
  const getDerivedGeometrySourceBuilders =
    useCallback(async (): Promise<DerivedGeometrySourceBuilders> => {
      const builders =
        derivedGeometrySourceBuildersRef.current ??
        (await loadDerivedGeometrySourceBuilders());
      derivedGeometrySourceBuildersRef.current = builders;
      setDerivedGeometrySourceBuilders((current) => current ?? builders);
      return builders;
    }, []);
  const documentPublicationResolversRef = useRef(
    new Map<CadDocument, Set<() => void>>()
  );
  useEffect(() => {
    const resolvers = [
      ...(documentPublicationResolversRef.current.get(document) ?? [])
    ];
    documentPublicationResolversRef.current.delete(document);
    for (const resolve of resolvers) resolve();
  }, [document]);
  useEffect(
    () => () => {
      const resolvers = [
        ...documentPublicationResolversRef.current.values()
      ].flatMap((entries) => [...entries]);
      documentPublicationResolversRef.current.clear();
      for (const resolve of resolvers) resolve();
    },
    []
  );
  const currentProject = useMemo(
    () => exportCadProjectForDocument(engine, document),
    [document]
  );
  const [
    curveEditSourceAuthorityRevision,
    setCurveEditSourceAuthorityRevision
  ] = useState(0);
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
  const [solidCollectorRequest, setSolidCollectorRequest] = useState<
    SolidCollectorRequest | undefined
  >();
  const [solidCollectorSelectionOverride, setSolidCollectorSelectionOverride] =
    useState<SolidCollectorSelection | undefined>();
  const [activeSolidEditFeatureId, setActiveSolidEditFeatureId] = useState<
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
  const [openDrawer, setOpenDrawer] = useState<"left" | "right" | undefined>();
  const [featureApplyCanApply, setFeatureApplyCanApply] = useState(() =>
    getFeatureApplyCanApply()
  );
  const [sketchApplyCanApply, setSketchApplyCanApply] = useState(false);
  const [sketchIntentActionAvailability, setSketchIntentActionAvailability] =
    useState<UiActionAvailabilityProjection>({});
  const [focusedSketchId, setFocusedSketchId] = useState<string | undefined>();
  const [threePointArcTool, setThreePointArcTool] = useState<
    ThreePointArcToolSession | undefined
  >();
  const [curveEditViewportChoice, setCurveEditViewportChoice] = useState<
    SketchCurveEditViewportChoice | undefined
  >();
  const curveEditViewportChoiceSequenceRef = useRef(0);
  const [curveEditViewportHoverChoice, setCurveEditViewportHoverChoice] =
    useState<SketchCurveEditViewportChoice | undefined>();
  const [regionCandidates, setRegionCandidates] = useState<
    readonly SketchProfileRegionCandidate[]
  >([]);
  const [selectedRegionCandidateKeys, setSelectedRegionCandidateKeys] =
    useState<readonly string[]>([]);
  const [hoveredRegionCandidateKey, setHoveredRegionCandidateKey] = useState<
    string | undefined
  >();
  const [regionConsumer, setRegionConsumer] =
    useState<SketchRegionConsumerIntent>("extrude-new-body");
  const regionSelectionStateRef = useRef({
    candidates: regionCandidates,
    selectedCandidateKeys: selectedRegionCandidateKeys,
    consumer: regionConsumer
  });
  regionSelectionStateRef.current = {
    candidates: regionCandidates,
    selectedCandidateKeys: selectedRegionCandidateKeys,
    consumer: regionConsumer
  };
  const curveEditHoverSchedulerRef = useRef<
    SketchCurveEditHoverScheduler | undefined
  >(undefined);
  curveEditHoverSchedulerRef.current ??= new SketchCurveEditHoverScheduler({
    publish: (choice) =>
      setCurveEditViewportHoverChoice((current) => ({
        sequence: (current?.sequence ?? 0) + 1,
        ...choice
      }))
  });
  const curveEditSessionControlRef = useRef<
    SketchCurveEditSessionControl | undefined
  >(undefined);
  const commandSearchOpenerRef = useRef<HTMLElement | null>(null);
  const curveEditOpenerRef = useRef<HTMLElement | null>(null);
  const curveEditNavigationBypassRef = useRef(false);
  const curveEditPendingContinuationRef = useRef<(() => void) | undefined>(
    undefined
  );
  const curveEditOwnership = getSketchCurveEditOwnershipPolicy({
    active: workbenchUi.activeEditor?.kind === "sketch-curve-edit",
    dirty: workbenchUi.activeEditorDirty
  });
  const handleCurveEditDirtyChange = useCallback((dirty: boolean) => {
    dispatchWorkbench({ type: "set-editor-dirty", dirty });
  }, []);
  useEffect(
    () =>
      subscribeFeatureApplyBridge((state) =>
        setFeatureApplyCanApply(state.canApply)
      ),
    []
  );
  const handleCurveEditSessionControlChange = useCallback(
    (control: SketchCurveEditSessionControl | undefined) => {
      curveEditSessionControlRef.current = control;
      setSketchApplyCanApply(Boolean(control?.canApply));
      if (control) {
        dispatchWorkbench({
          type: "set-editor",
          editor: {
            kind: "sketch-curve-edit",
            ...(focusedSketchId ? { sourceId: focusedSketchId } : {})
          }
        });
      }
    },
    [focusedSketchId]
  );
  const clearCurveEditHoverPreview = useCallback(() => {
    setCurveEditViewportHoverChoice(undefined);
    curveEditHoverSchedulerRef.current?.clear();
  }, []);
  useEffect(() => () => curveEditHoverSchedulerRef.current?.clear(), []);
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
      const status = await readLazyProjectOpfsCacheStatus(
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
    const status = await clearLazyProjectOpfsCache(
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
  useEffect(() => {
    if (!derivedGeometryEnabled) return;
    const runtime = getDerivedGeometryRuntime();
    const update = () => setModelWorkSnapshot(runtime.getModelWorkSnapshot());
    update();
    return runtime.subscribeModelWork(update);
  }, [getDerivedGeometryRuntime]);
  const commandWorker = useMemo(() => new LazyCadCommandWorker(), []);
  const sketchCurveEditQueryClientLoadRef = useRef<
    Promise<SketchCurveEditQueryClient> | undefined
  >(undefined);
  const getSketchCurveEditQueryClient = useCallback(async () => {
    sketchCurveEditQueryClientLoadRef.current ??=
      import("./sketchCurveEditQueryClient")
        .then(
          ({ SketchCurveEditQueryClient: CurveEditQueryClient }) =>
            new CurveEditQueryClient()
        )
        .catch((error: unknown) => {
          sketchCurveEditQueryClientLoadRef.current = undefined;
          throw error;
        });
    return sketchCurveEditQueryClientLoadRef.current;
  }, []);
  const sketchRegionQueryClientRef = useRef<
    SketchRegionQueryClient | undefined
  >(undefined);
  const sketchRegionQueryClientLoadRef = useRef<
    Promise<SketchRegionQueryClient> | undefined
  >(undefined);
  const sketchRegionQueryClientDisposedRef = useRef(false);
  const getSketchRegionQueryClient = useCallback(async () => {
    if (sketchRegionQueryClientRef.current) {
      return sketchRegionQueryClientRef.current;
    }
    if (!sketchRegionQueryClientLoadRef.current) {
      const load = import("./sketchRegionQueryClient")
        .then(({ SketchRegionQueryClient: RegionQueryClient }) => {
          const client = new RegionQueryClient();
          if (sketchRegionQueryClientDisposedRef.current) {
            client.clearCache();
          } else {
            sketchRegionQueryClientRef.current = client;
          }
          return client;
        })
        .catch((error: unknown) => {
          sketchRegionQueryClientLoadRef.current = undefined;
          throw error;
        });
      sketchRegionQueryClientLoadRef.current = load;
    }
    return sketchRegionQueryClientLoadRef.current;
  }, []);
  useEffect(() => {
    sketchRegionQueryClientDisposedRef.current = false;
    return () => {
      sketchRegionQueryClientDisposedRef.current = true;
      sketchRegionQueryClientRef.current?.clearCache();
      sketchRegionQueryClientRef.current = undefined;
      sketchRegionQueryClientLoadRef.current = undefined;
    };
  }, []);
  const commandExecutor = useMemo(
    () =>
      new AsyncCadCommandExecutor(engine, commandWorker, {
        stepImportResolver: {
          async resolveProjectImportStep(input) {
            const { createProjectStepImportResolver } =
              await import("./projectStepImportResolver");
            return createProjectStepImportResolver({
              getRuntime: getDerivedGeometryRuntime,
              payloadStore: stepImportPayloadStoreRef.current
            }).resolveProjectImportStep(input);
          }
        }
      }),
    [commandWorker, getDerivedGeometryRuntime]
  );
  async function publishAgentCommit() {
    emitGeometryDiagnosticEvent({
      phase: "command-committed",
      timestamp: performance.now()
    });
    await syncDocument();
    successfulCommitCountRef.current += 1;
    setProjectFile((current) => markProjectFileDirty(current));
  }
  const readSketchCurveEditReadinessAsync = useCallback(
    async (proposal: SketchCurveEditProposal, signal: AbortSignal) => {
      const client = await getSketchCurveEditQueryClient();
      const sourceAuthorityEpoch = engine.getSourceAuthorityEpoch();
      const readiness = await client.queryReadiness(currentProject, proposal, {
        signal,
        projectCacheKey: String(curveEditSourceAuthorityRevision)
      });
      if (readiness.status === "ready") {
        engine.acceptTrustedQueryCurveEditEvidence(
          readiness.preparedOperation.precondition.expectedSourceRevision,
          readiness.preparedOperation.precondition
            .expectedSolverEvaluationIdentity,
          sourceAuthorityEpoch
        );
      }
      return readiness;
    },
    [
      currentProject,
      curveEditSourceAuthorityRevision,
      getSketchCurveEditQueryClient
    ]
  );
  const querySketchRegionCandidates = useCallback(
    async (
      query: SketchProfileRegionCandidatesQuery,
      signal: AbortSignal
    ): Promise<SketchRegionCandidatesQueryResult> => {
      const sketchRegionQueryClient = await getSketchRegionQueryClient();
      return sketchRegionQueryClient.queryCandidates(
        currentProject,
        { version: "cadops.v1", query },
        {
          signal,
          projectCacheKey: String(curveEditSourceAuthorityRevision)
        }
      );
    },
    [
      currentProject,
      curveEditSourceAuthorityRevision,
      getSketchRegionQueryClient
    ]
  );
  const validateSketchRegionProfile = useCallback(
    async (
      profile: SketchRegionsProfileRef,
      signal: AbortSignal
    ): Promise<SketchRegionValidateQueryResult> => {
      const sketchRegionQueryClient = await getSketchRegionQueryClient();
      return sketchRegionQueryClient.validateProfile(
        currentProject,
        {
          version: "cadops.v1",
          query: { query: "sketch.profileRegionValidate", profile }
        },
        {
          signal,
          projectCacheKey: String(curveEditSourceAuthorityRevision)
        }
      );
    },
    [
      currentProject,
      curveEditSourceAuthorityRevision,
      getSketchRegionQueryClient
    ]
  );
  const toggleRegionCandidate = useCallback((candidateKey: string) => {
    const current = regionSelectionStateRef.current;
    const update = updateSketchRegionSelection(
      current.candidates,
      current.selectedCandidateKeys,
      candidateKey,
      current.consumer
    );
    if (!update.ok && update.message) setCommandNotice(update.message);
    regionSelectionStateRef.current = {
      ...current,
      selectedCandidateKeys: update.selectedCandidateKeys
    };
    setSelectedRegionCandidateKeys(update.selectedCandidateKeys);
  }, []);
  const changeRegionConsumer = useCallback(
    (consumer: SketchRegionConsumerIntent) => {
      setRegionConsumer(consumer);
      setSelectedRegionCandidateKeys((current) =>
        normalizeSketchRegionSelectionForConsumer(current, consumer)
      );
    },
    []
  );
  const changeRegionCandidates = useCallback(
    (candidates: readonly SketchProfileRegionCandidate[]) => {
      const keys = new Set(
        candidates.map((candidate) => candidate.candidateKey)
      );
      setRegionCandidates(candidates);
      setSelectedRegionCandidateKeys((current) =>
        current.filter((candidateKey) => keys.has(candidateKey))
      );
      setHoveredRegionCandidateKey((current) =>
        current && keys.has(current) ? current : undefined
      );
    },
    []
  );
  async function acceptValidatedRegionSelection(
    profile: SketchRegionsProfileRef,
    _response: SketchProfileRegionValidateQueryResponse,
    featureDraft: SketchRegionFeatureDraft
  ): Promise<boolean> {
    setCommandError(undefined);
    await ensureCadV19RegionSourceValidationPolicy();
    if (featureDraft.consumer === "revolve-new-body") {
      const result = await commitOps(
        [
          {
            op: "feature.revolve",
            profile,
            axis: {
              type: "sketchLine",
              sketchId: profile.sketchId,
              entityId: featureDraft.axisEntityId
            },
            angleDegrees: featureDraft.angleDegrees,
            operationMode: "newBody"
          }
        ],
        (commandResponse) => commandResponse.createdBodyIds?.[0] ?? selectedId
      );
      if (!result?.ok) return false;
      setCommandNotice(`Created a ${featureDraft.angleDegrees}° revolve.`);
      return true;
    }
    const result = await commitOps(
      [
        {
          op: "feature.extrude",
          profile,
          operationMode: featureDraft.operationMode,
          ...(featureDraft.consumer === "extrude-add-cut"
            ? { targetBodyId: featureDraft.targetBodyId }
            : {}),
          depth: featureDraft.depth,
          side: featureDraft.side
        }
      ],
      (commandResponse) => commandResponse.createdBodyIds?.[0] ?? selectedId
    );
    if (!result?.ok) return false;
    setCommandNotice(`Created a ${featureDraft.operationMode} extrude.`);
    return true;
  }
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
  useLayoutEffect(() => {
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
        onChange: (snapshot) => {
          emitGeometryDiagnosticEvent({
            phase: "display-snapshot",
            timestamp: performance.now(),
            supportedCount: snapshot.supportedCount,
            pendingCount: snapshot.pendingCount,
            readyCount: snapshot.readyCount,
            errorCount: snapshot.errorCount,
            entries: snapshot.entries.map((entry) => ({
              id: entry.sourceId ?? entry.objectId,
              cacheKey: entry.cacheKey,
              status: entry.status
            }))
          });
          setDerivedGeometry(snapshot);
        },
        meshCache: createLazyDerivedMeshOpfsCache({
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
            onChange: (snapshot) => {
              emitGeometryDiagnosticEvent({
                phase: "exact-snapshot",
                timestamp: performance.now(),
                supportedCount: snapshot.supportedCount,
                pendingCount: snapshot.pendingCount,
                readyCount: snapshot.readyCount,
                errorCount: snapshot.errorCount,
                entries: snapshot.entries.map((entry) => ({
                  id: entry.bodyId,
                  cacheKey: entry.cacheKey,
                  status: entry.status
                }))
              });
              setDerivedExactMetadata(snapshot);
            }
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
  const progressiveSketchAnalysis =
    sketches.reduce(
      (entityCount, sketch) => entityCount + sketch.entities.length,
      0
    ) > 128;
  const sketchAnalysisAuthorityEpoch = engine.getSourceAuthorityEpoch();
  const profileCandidatesBySketchId = useMemo(() => {
    const responses = new Map<string, SketchProfileCandidatesQueryResponse>();
    if (workbenchUi.mode !== "solid") return responses;
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
  }, [sketches, workbenchUi.mode]);
  const eagerPathCandidatesBySketchId = useMemo(
    () =>
      progressiveSketchAnalysis
        ? new Map<string, SketchPathCandidatesQueryResponse>()
        : readSketchPathCandidatesBySketchId(sketches),
    [progressiveSketchAnalysis, sketches]
  );
  const pathCandidatesBySketchId = eagerPathCandidatesBySketchId;
  const projectStructure = useMemo(
    () => readEngineStateForDocument(document, readProjectStructure),
    [document]
  );
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
    () => readEngineStateForDocument(document, readProjectImportReadiness),
    [document]
  );
  const projectTopologyIdentityReadiness = useMemo(
    () =>
      readEngineStateForDocument(
        document,
        readProjectTopologyIdentityReadiness
      ),
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
      derivedGeometrySourceBuilders
        ? derivedGeometrySourceBuilders.createAuthoredFeatureDerivedGeometrySources(
            projectStructure.features,
            sketches,
            sourcePlacementFacesByKey,
            document.namedReferences,
            document.topologyIdentity,
            document,
            bodySourceIdentitySignatures
          )
        : [],
    [
      bodySourceIdentitySignatures,
      derivedGeometrySourceBuilders,
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
      derivedGeometrySourceBuilders
        ? derivedGeometrySourceBuilders.createDerivedGeometrySourcesFromDocument(
            document,
            projectStructure.features,
            sourcePlacementFacesByKey,
            bodySourceIdentitySignatures
          )
        : [],
    [
      bodySourceIdentitySignatures,
      derivedGeometrySourceBuilders,
      document,
      projectStructure.features,
      sourcePlacementFacesByKey
    ]
  );
  const currentExactBodyResolutions = useMemo(
    () =>
      resolveCurrentExactBodies({
        document,
        bodies: projectStructure.bodies,
        features: projectStructure.features,
        geometrySources: derivedGeometrySources,
        checkpointPayloads: wcadTopologyCheckpointPayloadCache,
        sourceIdentitySignaturesByBodyId: bodySourceIdentitySignatures
      }),
    [
      bodySourceIdentitySignatures,
      derivedGeometrySources,
      document,
      projectStructure.bodies,
      projectStructure.features,
      wcadTopologyCheckpointPayloadCache
    ]
  );
  const currentExactMetadataSources = useMemo<
    readonly DerivedExactMetadataSource[]
  >(
    () => getReadyRuntimeExactSources(currentExactBodyResolutions),
    [currentExactBodyResolutions]
  );
  const projectExportReadiness = useMemo(
    () =>
      readEngineStateForDocument(document, () =>
        readProjectExportReadiness(
          engine,
          derivedExactMetadata,
          currentExactMetadataSources
        )
      ),
    [derivedExactMetadata, currentExactMetadataSources, document]
  );
  const projectHealth = useMemo(
    () =>
      readEngineStateForDocument(document, () =>
        readProjectHealth(derivedExactMetadata, currentExactMetadataSources)
      ),
    [derivedExactMetadata, currentExactMetadataSources, document]
  );
  const retryableModelResultCount =
    derivedGeometry.errorCount +
    (derivedGeometry.cancelledCount ?? 0) +
    derivedExactMetadata.errorCount +
    (derivedExactMetadata.cancelledCount ?? 0);

  function cancelModelWork() {
    const runtime = derivedGeometryRuntimeRef.current;
    if (!runtime || !modelWorkSnapshot.active) return;
    runtime.cancelModelWork("Model work was cancelled by the user.");
    derivedGeometryServiceRef.current?.cancelPending();
    derivedExactMetadataServiceRef.current?.cancelPending();
    setCommandNotice("Model work cancelled. Retry or restart the operation.");
  }

  function retryModelResults() {
    const runtime = getDerivedGeometryRuntime();
    runtime.resumeModelWork();
    const geometryService = getDerivedGeometryService();
    const exactService = getDerivedExactMetadataService();
    geometryService.retryCurrent(derivedGeometrySources);
    const { immediate, deferred } = planExactMetadataRetry(
      currentExactMetadataSources,
      geometryService.getSnapshot()
    );
    exactService.deferRetryable(deferred);
    exactService.retryCurrent(immediate);
    setCommandError(undefined);
    setCommandNotice(
      modelWorkSnapshot.cancelledUserKinds.length > 0
        ? `Retrying results. Restart ${formatCancelledUserKinds(modelWorkSnapshot.cancelledUserKinds)}.`
        : "Retrying current model results."
    );
  }

  function resumeCancelledUserWork() {
    getDerivedGeometryRuntime().resumeModelWork();
    setCommandError(undefined);
    setCommandNotice(
      `Model worker resumed. Restart ${formatCancelledUserKinds(modelWorkSnapshot.cancelledUserKinds)}.`
    );
  }

  const modelWorkControl = modelWorkSnapshot.active
    ? {
        label: "Model results are building",
        actionLabel: "Cancel model work",
        onAction: cancelModelWork
      }
    : modelWorkSnapshot.stopped &&
        modelWorkSnapshot.cancelledUserKinds.length > 0 &&
        retryableModelResultCount === 0
      ? {
          label: `${formatCancelledUserKinds(modelWorkSnapshot.cancelledUserKinds)} cancelled`,
          actionLabel: "Resume model worker",
          onAction: resumeCancelledUserWork
        }
      : modelWorkSnapshot.stopped || retryableModelResultCount > 0
        ? {
            label: "Model results need attention",
            actionLabel: "Retry model results",
            onAction: retryModelResults
          }
        : undefined;
  const modelingResultState = useMemo(
    () =>
      createModelingResultState({
        commandPending,
        commandFailed: commandError !== undefined,
        derivedGeometryEnabled,
        derivedSourceCount: derivedGeometrySources.length,
        derivedGeometry,
        derivedExactSourceCount: currentExactMetadataSources.length,
        derivedExactMetadata,
        projectHealthStatus: projectHealth.status
      }),
    [
      commandError,
      commandPending,
      derivedGeometry,
      derivedGeometrySources.length,
      derivedExactMetadata,
      currentExactMetadataSources.length,
      projectHealth.status
    ]
  );
  const selectedObject = selectedId
    ? document.objects.get(selectedId)
    : undefined;
  const selectedBody = selectedId
    ? projectStructure.bodies.find((body) => body.id === selectedId)
    : undefined;
  const selectedBodyId = selectedBody?.id;
  const preferredHoleBodyId = selectedBodyId ?? preferredHoleTargetBodyId;
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
  const addTargetReadinessByTopologyAnchorId = useMemo(
    () =>
      readTopologyAnchorCommandTargetReadinessByAnchorId(
        document.topologyIdentity?.anchors,
        "feature.extrudeAddTarget"
      ),
    [document]
  );
  const selectedFeature = selectedBody
    ? projectStructure.features.find(
        (feature) => feature.id === selectedBody.featureId
      )
    : undefined;
  useEffect(() => {
    setRegionCandidates([]);
    const profile =
      workbenchUi.activeTool === "solid.edit" &&
      (selectedFeature?.kind === "extrude" ||
        selectedFeature?.kind === "revolve") &&
      selectedFeature.profile?.kind === "regions"
        ? selectedFeature.profile
        : undefined;
    if (!profile) return;

    const abortController = new AbortController();
    void querySketchRegionCandidates(
      {
        query: "sketch.profileRegionCandidates",
        sketchId: profile.sketchId
      },
      abortController.signal
    )
      .then((response) => {
        if (!abortController.signal.aborted && response.ok) {
          setRegionCandidates(response.candidates);
        }
      })
      .catch(() => {});
    return () => abortController.abort();
  }, [querySketchRegionCandidates, selectedFeature, workbenchUi.activeTool]);
  const selectedBodyGeneratedReferences = useMemo(
    () =>
      readEngineStateForDocument(document, () =>
        readBodyGeneratedReferences(
          selectedBodyId,
          selectedBodyId
            ? derivedGeneratedReferenceEvidenceByBodyId.get(selectedBodyId)
            : undefined
        )
      ),
    [derivedGeneratedReferenceEvidenceByBodyId, document, selectedBodyId]
  );
  const selectedGeneratedReferenceMeasurements = useMemo(
    () =>
      readEngineStateForDocument(document, () =>
        readGeneratedReferenceMeasurements(
          selectedBodyGeneratedReferences.references
        )
      ),
    [document, selectedBodyGeneratedReferences.references]
  );
  const selectedBodyMeasurements = useMemo(
    () =>
      readEngineStateForDocument(document, () =>
        selectedBodyId ? readBodyMeasurements(selectedBodyId) : {}
      ),
    [document, selectedBodyId]
  );
  const selectedBodyExactMetadataSource = selectedBodyId
    ? currentExactMetadataSources.find((source) => source.id === selectedBodyId)
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
  const namedReferences = useMemo(
    () => readEngineStateForDocument(document, readNamedReferences),
    [document]
  );
  const referenceHealth = useMemo(
    () => readEngineStateForDocument(document, readReferenceHealth),
    [document]
  );
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
      readEngineStateForDocument(document, () =>
        selectedBodyId
          ? readSelectionReferenceCandidates({
              type: "body",
              bodyId: selectedBodyId
            })
          : undefined
      ),
    [document, selectedBodyId]
  );
  const referenceCandidatesByStableId = useMemo(
    () =>
      readEngineStateForDocument(document, () =>
        readSelectionReferenceCandidatesByStableId(
          selectedBodyGeneratedReferences.references
        )
      ),
    [document, selectedBodyGeneratedReferences.references]
  );
  const namedReferenceCandidatesByName = useMemo(
    () =>
      readEngineStateForDocument(document, () =>
        readNamedReferenceCandidatesByName(namedReferences)
      ),
    [document, namedReferences]
  );
  const selectedNamedReference = selectedNamedReferenceName
    ? namedReferences.find(
        (reference) => reference.name === selectedNamedReferenceName
      )
    : undefined;
  const transactionHistory = useMemo(
    () => readEngineStateForDocument(document, readTransactionHistory),
    [document]
  );
  const parameters = useMemo(
    () => readEngineStateForDocument(document, readParameters),
    [document]
  );
  const parameterEvaluation = useMemo(
    () => readEngineStateForDocument(document, readParameterEvaluation),
    [document]
  );
  const sketchDimensionsBySketchId = useMemo(
    () =>
      readEngineStateForDocument(document, () =>
        readSketchDimensionsBySketchId(sketches)
      ),
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
  const eagerSketchEvaluationsBySketchId = useMemo(
    () =>
      progressiveSketchAnalysis
        ? new Map<string, SketchEvaluationQueryResponse>()
        : readEngineStateForDocument(document, () =>
            readSketchEvaluationsBySketchId(sketches)
          ),
    [document, progressiveSketchAnalysis, sketches]
  );
  const sketchEvaluationsBySketchId = eagerSketchEvaluationsBySketchId;
  const eagerSketchSolverStatusesBySketchId = useMemo(
    () =>
      progressiveSketchAnalysis
        ? new Map<string, SketchSolverStatusQueryResponse>()
        : readEngineStateForDocument(document, () =>
            readSketchSolverStatusesBySketchId(sketches)
          ),
    [document, progressiveSketchAnalysis, sketches]
  );
  const sketchSolverStatusesBySketchId = eagerSketchSolverStatusesBySketchId;
  const eagerSketchAnalysis = useMemo<ProgressiveSketchAnalysis>(
    () => ({
      evaluationsBySketchId: sketchEvaluationsBySketchId,
      solverStatusesBySketchId: sketchSolverStatusesBySketchId,
      pathCandidatesBySketchId
    }),
    [
      pathCandidatesBySketchId,
      sketchEvaluationsBySketchId,
      sketchSolverStatusesBySketchId
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
  const currentAgentSelection = {
    ...(selectedNamedReferenceName
      ? { namedReferenceName: selectedNamedReferenceName }
      : {}),
    ...(selectedGeneratedReferenceState.status === "selected"
      ? {
          generatedReference: {
            bodyId: selectedGeneratedReferenceState.reference.bodyId,
            stableId: selectedGeneratedReferenceState.reference.stableId,
            expectedKind: selectedGeneratedReferenceState.reference.kind
          }
        }
      : {}),
    ...(selectedSketchContext ? { sketch: selectedSketchContext } : {}),
    ...(selectedBody ? { bodyId: selectedBody.id } : {}),
    ...(selectedObject ? { objectId: selectedObject.id } : {})
  };
  const selectedGeneratedReferenceCandidates = useMemo(
    () =>
      readEngineStateForDocument(document, () =>
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
          : undefined
      ),
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
        holeTargetReadinessByTopologyAnchorId,
        sketchIntentActionAvailability
      }),
    [
      document.topologyIdentity?.anchors,
      holeTargetReadinessByTopologyAnchorId,
      modelingSelectionContext,
      preferredHoleBodyId,
      projectStructure.bodies,
      projectStructure.features,
      sketchIntentActionAvailability
    ]
  );
  const allSolidBodyChoices = useMemo<readonly SolidChoice<string>[]>(
    () =>
      projectStructure.bodies.map((body, index) => ({
        key: body.id,
        value: body.id,
        label: body.name ?? `Body ${index + 1}`,
        kind: "body"
      })),
    [projectStructure.bodies]
  );
  const solidSeedBodyChoices = useMemo<readonly SolidChoice<string>[]>(
    () =>
      projectStructure.bodies.flatMap((body, index) => {
        const feature = projectStructure.features.find(
          (candidate) => candidate.id === body.featureId
        );
        return feature?.kind === "extrude" &&
          body.consumedByFeatureId === undefined
          ? [
              {
                key: body.id,
                value: body.id,
                label: body.name ?? `Body ${index + 1}`,
                kind: "authored body"
              }
            ]
          : [];
      }),
    [projectStructure.bodies, projectStructure.features]
  );
  const solidAddTargetChoices = useMemo<readonly SolidChoice<string>[]>(
    () =>
      createAddTargetBodyOptions(
        projectStructure.bodies,
        projectStructure.features,
        preferredHoleBodyId,
        document.topologyIdentity?.anchors,
        addTargetReadinessByTopologyAnchorId
      ).map((target) => ({
        key: target.bodyId,
        value: target.bodyId,
        label: target.label,
        kind: "add target",
        targetTopologyAnchorId: target.targetTopologyAnchorId
      })),
    [
      addTargetReadinessByTopologyAnchorId,
      document.topologyIdentity?.anchors,
      preferredHoleBodyId,
      projectStructure.bodies,
      projectStructure.features
    ]
  );
  const solidCutTargetChoices = useMemo<readonly SolidChoice<string>[]>(
    () =>
      createCutTargetBodyOptions(
        projectStructure.bodies,
        projectStructure.features,
        preferredHoleBodyId,
        document.topologyIdentity?.anchors
      ).map((target) => ({
        key: target.bodyId,
        value: target.bodyId,
        label: target.label,
        kind: "cut target",
        targetTopologyAnchorId: target.targetTopologyAnchorId
      })),
    [
      document.topologyIdentity?.anchors,
      preferredHoleBodyId,
      projectStructure.bodies,
      projectStructure.features
    ]
  );
  const solidHoleTargetChoices = useMemo<readonly SolidChoice<string>[]>(
    () =>
      createHoleTargetBodyOptions(
        projectStructure.bodies,
        projectStructure.features,
        preferredHoleBodyId,
        document.topologyIdentity?.anchors,
        holeTargetReadinessByTopologyAnchorId
      ).map((target) => ({
        key: target.bodyId,
        value: target.bodyId,
        label: target.label,
        kind: "hole target",
        targetTopologyAnchorId: target.targetTopologyAnchorId
      })),
    [
      document.topologyIdentity?.anchors,
      holeTargetReadinessByTopologyAnchorId,
      preferredHoleBodyId,
      projectStructure.bodies,
      projectStructure.features
    ]
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
  const solidChamferEdgeChoices = useMemo(
    () =>
      createSolidEdgeChoices(
        selectedBodyGeneratedReferences.references,
        namedReferences,
        referenceCandidatesByStableId,
        namedReferenceCandidatesByName,
        "feature.chamfer"
      ),
    [
      namedReferenceCandidatesByName,
      namedReferences,
      referenceCandidatesByStableId,
      selectedBodyGeneratedReferences.references
    ]
  );
  const solidFilletEdgeChoices = useMemo(
    () =>
      createSolidEdgeChoices(
        selectedBodyGeneratedReferences.references,
        namedReferences,
        referenceCandidatesByStableId,
        namedReferenceCandidatesByName,
        "feature.fillet"
      ),
    [
      namedReferenceCandidatesByName,
      namedReferences,
      referenceCandidatesByStableId,
      selectedBodyGeneratedReferences.references
    ]
  );
  const solidShellFaceChoices = useMemo(
    () =>
      createSolidFaceChoices(
        selectedBodyGeneratedReferences.references,
        namedReferences,
        referenceCandidatesByStableId,
        namedReferenceCandidatesByName,
        "feature.shell"
      ),
    [
      namedReferenceCandidatesByName,
      namedReferences,
      referenceCandidatesByStableId,
      selectedBodyGeneratedReferences.references
    ]
  );
  const solidLinearDirectionChoices = useMemo(
    () =>
      createSolidDirectionChoices(
        selectedBodyGeneratedReferences.references,
        namedReferences,
        referenceCandidatesByStableId,
        namedReferenceCandidatesByName,
        "feature.linearPatternDirection"
      ),
    [
      namedReferenceCandidatesByName,
      namedReferences,
      referenceCandidatesByStableId,
      selectedBodyGeneratedReferences.references
    ]
  );
  const solidRotationAxisChoices = useMemo<
    readonly SolidChoice<PatternRotationAxisRef>[]
  >(
    () =>
      createSolidDirectionChoices(
        selectedBodyGeneratedReferences.references,
        namedReferences,
        referenceCandidatesByStableId,
        namedReferenceCandidatesByName,
        "feature.circularPatternAxis"
      ),
    [
      namedReferenceCandidatesByName,
      namedReferences,
      referenceCandidatesByStableId,
      selectedBodyGeneratedReferences.references
    ]
  );
  const solidMirrorFaceChoices = useMemo(
    () =>
      createSolidFaceChoices(
        selectedBodyGeneratedReferences.references,
        namedReferences,
        referenceCandidatesByStableId,
        namedReferenceCandidatesByName,
        "feature.mirrorPlane"
      ),
    [
      namedReferenceCandidatesByName,
      namedReferences,
      referenceCandidatesByStableId,
      selectedBodyGeneratedReferences.references
    ]
  );
  const solidPlaneChoices = useMemo(
    () => createSolidMirrorPlaneChoices(solidMirrorFaceChoices),
    [solidMirrorFaceChoices]
  );
  const selectedChamferEdgeChoice = findSelectedEdgeChoice(
    solidChamferEdgeChoices,
    selectedGeneratedReferenceState,
    selectedNamedReferenceName
  );
  const selectedFilletEdgeChoice = findSelectedEdgeChoice(
    solidFilletEdgeChoices,
    selectedGeneratedReferenceState,
    selectedNamedReferenceName
  );
  const selectedShellFaceChoice = findSelectedFaceChoice(
    solidShellFaceChoices,
    selectedGeneratedReferenceState,
    selectedNamedReferenceName
  );
  const selectedLinearDirectionChoice = findSelectedDirectionChoice(
    solidLinearDirectionChoices,
    selectedGeneratedReferenceState,
    selectedNamedReferenceName
  );
  const selectedRotationAxisChoice = findSelectedDirectionChoice(
    solidRotationAxisChoices,
    selectedGeneratedReferenceState,
    selectedNamedReferenceName
  );
  const selectedMirrorFaceChoice = findSelectedFaceChoice(
    solidMirrorFaceChoices,
    selectedGeneratedReferenceState,
    selectedNamedReferenceName
  );
  const selectedProfileChoice =
    modelingSelectionContext.selectionKind === "sketchEntity"
      ? solidProfileChoices.find(
          (choice) =>
            choice.value.kind === "entity" &&
            choice.value.sketchId === modelingSelectionContext.sketch.id &&
            choice.value.entityId === modelingSelectionContext.entity.id
        )
      : undefined;
  const selectedProfile = selectedProfileChoice?.value;
  const selectedEntityProfile =
    selectedProfile?.kind === "entity" ? selectedProfile : undefined;
  const selectedPathChoice =
    modelingSelectionContext.selectionKind === "sketchEntity"
      ? solidPathChoices.find((choice) => {
          const path = choice.value;
          return path.kind === "entity"
            ? path.sketchId === modelingSelectionContext.sketch.id &&
                path.entityId === modelingSelectionContext.entity.id
            : path.sketchId === modelingSelectionContext.sketch.id &&
                path.segments.some(
                  (segment) =>
                    segment.entityId === modelingSelectionContext.entity.id
                );
        })
      : undefined;
  const selectedPath = selectedPathChoice?.value;
  const selectedAxisChoice =
    modelingSelectionContext.selectionKind === "sketchEntity" &&
    modelingSelectionContext.entity.kind === "line"
      ? solidAxisChoices.find(
          (choice) =>
            choice.key ===
            `${modelingSelectionContext.sketch.id}:${modelingSelectionContext.entity.id}`
        )
      : undefined;
  const selectedSolidBodyId = selectedBody?.id ?? "";
  const selectedSeedBodyId =
    solidSeedBodyChoices.find((choice) => choice.value === selectedBody?.id)
      ?.value ?? "";
  const selectedHoleTargetChoice = solidHoleTargetChoices.find(
    (choice) => choice.value === selectedBody?.id
  );
  const solidCollectorSelection = useMemo<
    SolidCollectorSelection | undefined
  >(() => {
    const key = selectedNamedReferenceName
      ? `named:${selectedNamedReferenceName}`
      : selectedGeneratedReferenceState.status === "selected"
        ? `reference:${selectedGeneratedReferenceState.reference.bodyId}:${selectedGeneratedReferenceState.reference.stableId}:${selectedGeneratedReferenceState.selection.topologyAnchorId ?? ""}`
        : selectedSketchContext?.entityId
          ? `sketch:${selectedSketchContext.sketchId}:${selectedSketchContext.entityId}`
          : selectedBody
            ? `body:${selectedBody.id}`
            : undefined;
    if (!key) return undefined;
    return {
      key,
      choiceKeys: {
        ...(selectedBody
          ? {
              targetBody: selectedBody.id,
              seedBody: selectedBody.id
            }
          : {}),
        ...(selectedProfileChoice
          ? {
              profile: selectedProfileChoice.key,
              sections:
                selectedProfileChoice.value.kind === "entity"
                  ? `${selectedProfileChoice.value.sketchId}:${selectedProfileChoice.value.entityId}`
                  : undefined
            }
          : {}),
        ...(selectedPathChoice ? { path: selectedPathChoice.key } : {}),
        ...(selectedAxisChoice ? { axis: selectedAxisChoice.key } : {}),
        ...(workbenchUi.activeTool === "solid.fillet"
          ? selectedFilletEdgeChoice
            ? { edge: selectedFilletEdgeChoice.key }
            : {}
          : selectedChamferEdgeChoice
            ? { edge: selectedChamferEdgeChoice.key }
            : {}),
        ...(selectedShellFaceChoice
          ? { openFaces: selectedShellFaceChoice.key }
          : {}),
        ...(selectedLinearDirectionChoice
          ? { direction: selectedLinearDirectionChoice.key }
          : {}),
        ...(selectedRotationAxisChoice
          ? { rotationAxis: selectedRotationAxisChoice.key }
          : {}),
        ...(selectedMirrorFaceChoice
          ? { mirrorPlane: selectedMirrorFaceChoice.key }
          : {})
      }
    };
  }, [
    selectedAxisChoice,
    selectedBody,
    selectedChamferEdgeChoice,
    selectedFilletEdgeChoice,
    selectedGeneratedReferenceState,
    selectedLinearDirectionChoice,
    selectedMirrorFaceChoice,
    selectedNamedReferenceName,
    selectedPathChoice,
    selectedProfileChoice,
    selectedRotationAxisChoice,
    selectedShellFaceChoice,
    selectedSketchContext,
    workbenchUi.activeTool
  ]);
  const selectedFeatureBeforeEditor = selectedFeature;
  const solidEditorRequest = useMemo<SolidEditorRequest | undefined>(() => {
    const actionId = workbenchUi.activeTool;
    const selectedFeature =
      actionId === "solid.edit" && activeSolidEditFeatureId
        ? (projectStructure.features.find(
            (feature) => feature.id === activeSolidEditFeatureId
          ) ?? selectedFeatureBeforeEditor)
        : selectedFeatureBeforeEditor;
    const key = `${actionId ?? "solid"}:${transactionHistory.length}`;
    const profileChoices = (
      featureId: string,
      profile: SketchProfileRefV22 | undefined
    ) =>
      profile?.kind === "regions"
        ? [
            {
              key: `${featureId}:r`,
              value: profile,
              label: "Current regions",
              kind: "profile"
            },
            ...regionCandidates
              .filter(
                (candidate) =>
                  candidate.status === "valid" &&
                  !profile.regions.some(
                    (region) =>
                      JSON.stringify(region) ===
                      JSON.stringify(candidate.region)
                  )
              )
              .map((candidate, index) => ({
                key: `${featureId}:${candidate.candidateKey}`,
                value: {
                  kind: "regions" as const,
                  sketchId: profile.sketchId,
                  regions: [candidate.region] as const
                },
                label: `Alternative ${index + 1}`,
                kind: "profile"
              }))
          ]
        : solidProfileChoices;
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
        const currentTargetChoice = selectedFeature.targetBodyId
          ? allSolidBodyChoices.find(
              (choice) => choice.value === selectedFeature.targetBodyId
            )
          : undefined;
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
            profiles: profileChoices(selectedFeature.id, profile),
            addTargetBodies: currentTargetChoice
              ? includeCurrentSolidChoice(solidAddTargetChoices, {
                  ...currentTargetChoice,
                  targetTopologyAnchorId: selectedFeature.targetTopologyAnchorId
                })
              : solidAddTargetChoices,
            cutTargetBodies: currentTargetChoice
              ? includeCurrentSolidChoice(solidCutTargetChoices, {
                  ...currentTargetChoice,
                  targetTopologyAnchorId: selectedFeature.targetTopologyAnchorId
                })
              : solidCutTargetChoices
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
          choices: {
            profiles: profileChoices(selectedFeature.id, profile),
            axes: solidAxisChoices
          },
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
            sketchId: selectedFeature.sketchId,
            circleEntityId: selectedFeature.circleEntityId,
            name: selectedFeature.name ?? "",
            depthMode: selectedFeature.depthMode,
            depth: selectedFeature.depth ?? 10,
            direction: selectedFeature.direction
          },
          choices: { targetBodies: allSolidBodyChoices },
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
          choices: {
            edges: includeCurrentSolidChoice(
              selectedFeature.kind === "fillet"
                ? solidFilletEdgeChoices
                : solidChamferEdgeChoices,
              {
                key: `current:${selectedFeature.id}`,
                value: {
                  targetBodyId: selectedFeature.targetBodyId,
                  edgeStableId: selectedFeature.edgeStableId,
                  namedReference: selectedFeature.namedReference,
                  topologyAnchorId: selectedFeature.topologyAnchorId
                },
                label: "Current edge reference",
                kind: "edge"
              }
            )
          },
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
            targetBodies: allSolidBodyChoices,
            openFaces: selectedFeature.openFaceRefs.reduce(
              (choices, reference, index) =>
                includeCurrentSolidChoice(choices, {
                  key: `current:${selectedFeature.id}:${index}`,
                  value: reference,
                  label: `Current open face ${index + 1}`,
                  kind: "face"
                }),
              solidShellFaceChoices
            )
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
            seedBodies: allSolidBodyChoices,
            directions: includeCurrentSolidChoice(solidLinearDirectionChoices, {
              key: `current:${selectedFeature.id}`,
              value: selectedFeature.direction,
              label: "Current direction",
              kind: "direction"
            })
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
            seedBodies: allSolidBodyChoices,
            rotationAxes: includeCurrentSolidChoice(solidRotationAxisChoices, {
              key: `current:${selectedFeature.id}`,
              value: selectedFeature.rotationAxis,
              label: "Current rotation axis",
              kind: "axis"
            })
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
            seedBodies: allSolidBodyChoices,
            mirrorPlanes: includeCurrentSolidChoice(solidPlaneChoices, {
              key: `current:${selectedFeature.id}`,
              value: selectedFeature.plane,
              label: "Current mirror plane",
              kind: "plane"
            })
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
          addTargetBodies: solidAddTargetChoices,
          cutTargetBodies: solidCutTargetChoices
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
          axisEntityId:
            solidAxisChoices.find(
              (choice) =>
                selectedProfile?.kind === "entity" &&
                choice.key.startsWith(`${selectedProfile.sketchId}:`)
            )?.value ??
            solidAxisChoices[0]?.value ??
            "",
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
          path: selectedPath ??
            solidPathChoices[0]?.value ?? {
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
          selectedEntityProfile && solidPathChoices.length > 0
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
      const sections =
        selectedEntityProfile === undefined
          ? []
          : sectionChoices
              .filter(
                (choice) =>
                  choice.section.sketchId === selectedEntityProfile.sketchId &&
                  choice.section.entityId === selectedEntityProfile.entityId
              )
              .map((choice) => choice.section);
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
          sectionChoices.length >= 2
            ? undefined
            : "Create at least two profiles on parallel planes."
      } as SolidEditorRequest;
    }
    if (actionId === "solid.hole") {
      const circleReady =
        modelingSelectionContext.selectionKind === "sketchEntity" &&
        modelingSelectionContext.entity.kind === "circle";
      const target = selectedHoleTargetChoice ?? solidHoleTargetChoices[0];
      return {
        key,
        kind: "hole",
        title: "Create Hole",
        mode: "create",
        initialDraft: {
          id: "",
          bodyId: "",
          targetBodyId: target?.value ?? "",
          targetTopologyAnchorId: target?.targetTopologyAnchorId,
          sketchId: circleReady
            ? modelingSelectionContext.sketch.id
            : undefined,
          circleEntityId: circleReady
            ? modelingSelectionContext.entity.id
            : undefined,
          name: "",
          depthMode: "throughAll",
          depth: 10,
          direction: "positive"
        },
        choices: { targetBodies: solidHoleTargetChoices },
        blockedReason:
          circleReady && target
            ? undefined
            : circleReady
              ? "Select a supported hole target body."
              : "Select a supported sketch circle."
      } as SolidEditorRequest;
    }
    if (actionId === "solid.fillet" || actionId === "solid.chamfer") {
      const selectedEdge =
        actionId === "solid.fillet"
          ? selectedFilletEdgeChoice
          : selectedChamferEdgeChoice;
      const edge = selectedEdge?.value;
      const edgeChoices =
        actionId === "solid.fillet"
          ? solidFilletEdgeChoices
          : solidChamferEdgeChoices;
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
          namedReference: edge?.namedReference,
          topologyAnchorId: edge?.topologyAnchorId,
          topologyAnchorProof: edge?.topologyAnchorProof,
          distance: 1,
          radius: 1
        },
        choices: { edges: edgeChoices },
        blockedReason: edge ? undefined : "Select a supported edge."
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
          targetBodyId: selectedSeedBodyId,
          name: "",
          wallThickness: 1,
          openFaceRefs: selectedShellFaceChoice
            ? [selectedShellFaceChoice.value]
            : []
        },
        choices: {
          targetBodies: solidSeedBodyChoices,
          openFaces: solidShellFaceChoices
        },
        blockedReason: selectedSeedBodyId
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
          seedBodyId: selectedSeedBodyId,
          name: "",
          direction:
            selectedLinearDirectionChoice?.value ??
            solidLinearDirectionChoices[0]!.value,
          spacing: 10,
          instanceCount: 3
        },
        choices: {
          seedBodies: solidSeedBodyChoices,
          directions: solidLinearDirectionChoices
        },
        blockedReason: selectedSeedBodyId
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
          seedBodyId: selectedSeedBodyId,
          name: "",
          rotationAxis:
            selectedRotationAxisChoice?.value ??
            solidRotationAxisChoices[2]!.value,
          totalAngleDegrees: 360,
          instanceCount: 3
        },
        choices: {
          seedBodies: solidSeedBodyChoices,
          rotationAxes: solidRotationAxisChoices
        },
        blockedReason: selectedSeedBodyId
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
          seedBodyId: selectedSeedBodyId,
          name: "",
          plane: selectedMirrorFaceChoice?.value ?? solidPlaneChoices[0]!.value,
          includeOriginal: true
        },
        choices: {
          seedBodies: solidSeedBodyChoices,
          mirrorPlanes: solidPlaneChoices
        },
        blockedReason: selectedSeedBodyId
          ? undefined
          : "Select a supported seed body."
      } as SolidEditorRequest;
    }
    return undefined;
  }, [
    allSolidBodyChoices,
    activeSolidEditFeatureId,
    transactionHistory.length,
    modelingSelectionContext,
    selectedEntityProfile,
    selectedFeatureBeforeEditor,
    selectedFilletEdgeChoice,
    selectedChamferEdgeChoice,
    selectedHoleTargetChoice,
    selectedLinearDirectionChoice,
    selectedMirrorFaceChoice,
    selectedObject,
    selectedPath,
    selectedProfile,
    selectedRotationAxisChoice,
    selectedSeedBodyId,
    selectedShellFaceChoice,
    selectedSolidBodyId,
    sketches.length,
    solidAddTargetChoices,
    solidAxisChoices,
    solidChamferEdgeChoices,
    solidCutTargetChoices,
    solidFilletEdgeChoices,
    solidHoleTargetChoices,
    solidLinearDirectionChoices,
    solidRotationAxisChoices,
    solidSeedBodyChoices,
    solidShellFaceChoices,
    regionCandidates,
    solidPathChoices,
    solidPlaneChoices,
    solidProfileChoices,
    projectStructure.features,
    workbenchUi.activeTool
  ]);
  useEffect(() => {
    if (
      !solidEditorRequest ||
      solidCollectorRequest?.editorKey !== solidEditorRequest.key
    ) {
      setSolidCollectorRequest(undefined);
      setSolidCollectorSelectionOverride(undefined);
    }
  }, [solidCollectorRequest?.editorKey, solidEditorRequest]);
  const sketchViewportDragTarget =
    modelingSelectionContext.selectionKind === "sketchEntity"
      ? {
          entityId: modelingSelectionContext.entity.id,
          sketch: modelingSelectionContext.sketch
        }
      : undefined;
  const regionOverlaySketch =
    workbenchUi.activeTool === "sketch.regions"
      ? (sketches.find((sketch) => sketch.id === focusedSketchId) ??
        sketches[0])
      : undefined;
  const regionOverlayDisplayFrame = useMemo(() => {
    if (!regionOverlaySketch) return undefined;
    return (
      sketchDisplayState.frames.get(regionOverlaySketch.id) ??
      createDefaultSketchDisplayFrame(regionOverlaySketch.plane)
    );
  }, [regionOverlaySketch, sketchDisplayState.frames]);
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
  const viewportSelectionDisplay: ViewportSelectionDisplay =
    viewportMeasurementRuntime?.createSelectionDisplay({
      derivedGeometryEnabled,
      selectedBody,
      selectedGeneratedReferenceState,
      selectedGeometryEntry,
      selectedObject,
      selectionReferenceCandidates: selectedSelectionReferenceCandidates,
      viewportPickIntent
    }) ?? {
      selectionKind: "none",
      title: "No selection",
      detail: derivedGeometryEnabled
        ? "Select an object"
        : "Primitive fallback mode",
      tone: "idle",
      geometryStatus: "none",
      commandOperations: [],
      commandOperationLabels: [],
      diagnostics: []
    };
  const viewportHoverState = viewportHoverPick
    ? resolveViewportHoverIntent({
        hoveredRenderId: viewportHoverPick.pickedRenderId,
        bodies: projectStructure.bodies,
        objects: sceneObjects,
        sketches,
        readReferenceCandidates: readSelectionReferenceCandidates
      })
    : undefined;
  const viewportVisualState: ViewportVisualStateModel =
    viewportMeasurementRuntime?.createVisualState({
      hoverState: viewportHoverState,
      selectionDisplay: viewportSelectionDisplay,
      selectedGeneratedReferenceState
    }) ?? {
      rendererVisualStates: [],
      ...(viewportSelectionDisplay.renderTargetId
        ? { selectedRenderTargetId: viewportSelectionDisplay.renderTargetId }
        : {})
    };
  const viewportMeasurementOverlay: ViewportMeasurementOverlay | undefined =
    viewportMeasurementRuntime?.createOverlay({
      body: selectedBody,
      bodyMeasurements: selectedBodyMeasurements.measurements,
      bodyMeasurementsError: selectedBodyMeasurements.error,
      namedReferences,
      selectedGeneratedReferenceState,
      selectionReferenceCandidates: selectedSelectionReferenceCandidates,
      units: document.units
    });
  const viewportTwoTargetMeasurementTarget =
    viewportMeasurementRuntime?.createTarget({
      bodyMeasurements: selectedBodyMeasurements.measurements,
      generatedReferenceMeasurement:
        selectedGeneratedReferenceState.status === "selected"
          ? selectedGeneratedReferenceState.measurement?.measurement
          : undefined,
      measurementOverlay: viewportMeasurementOverlay
    });
  const viewportTwoTargetMeasurement =
    viewportMeasurementRuntime?.createView({
      activeTarget: viewportTwoTargetMeasurementTarget,
      session: viewportTwoTargetMeasurementSession,
      units: document.units
    }) ?? EMPTY_TWO_TARGET_MEASUREMENT;
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
  const viewportTwoTargetMeasurementSessionActive = Boolean(
    viewportTwoTargetMeasurementSession.firstTarget ||
    viewportTwoTargetMeasurementSession.secondTarget
  );
  const viewportGestureActive =
    threePointArcTool !== undefined ||
    viewportHoverPick !== undefined ||
    viewportPickIntent !== undefined;
  const measurementSecondTargetActive = Boolean(
    viewportTwoTargetMeasurementSession.firstTarget ||
    viewportTwoTargetMeasurementSession.secondTarget
  );
  const clearViewportGestures = useCallback(() => {
    setViewportHoverPick(undefined);
    setViewportPickIntent(undefined);
    setThreePointArcTool(undefined);
  }, []);
  const clearMeasurementSecondTargetCapture = useCallback(() => {
    setViewportTwoTargetMeasurementSession((current) => {
      if (current.secondTarget) {
        return { firstTarget: current.firstTarget };
      }
      if (current.firstTarget) {
        return {};
      }
      return current;
    });
  }, []);
  useEffect(() => {
    setViewportTwoTargetMeasurementSession((current) =>
      current.secondTarget ? { firstTarget: current.firstTarget } : current
    );
  }, [viewportContextualCommandSurface.selectionKey]);
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
  const projectStorageCapabilities = useMemo(
    () => createProjectStorageCapabilityStatus(window),
    []
  );
  const [
    loadedVisualizationMeshExportStatus,
    setVisualizationMeshExportStatus
  ] = useState<{
    readonly exportReadiness: ProjectExportReadinessQueryResponse;
    readonly derivedGeometry: DerivedGeometrySnapshot;
    readonly derivedGeometrySources: readonly DerivedGeometrySource[];
    readonly status: VisualizationMeshExportStatus;
  }>();
  const visualizationMeshExportStatus =
    workbenchUi.mode === "project" &&
    loadedVisualizationMeshExportStatus &&
    loadedVisualizationMeshExportStatus.exportReadiness ===
      projectExportReadiness &&
    loadedVisualizationMeshExportStatus.derivedGeometry === derivedGeometry &&
    loadedVisualizationMeshExportStatus.derivedGeometrySources ===
      derivedGeometrySources
      ? loadedVisualizationMeshExportStatus.status
      : undefined;
  useEffect(() => {
    let current = true;
    if (workbenchUi.mode !== "project" || !projectExportReadiness) {
      return () => {
        current = false;
      };
    }

    void import("./visualizationMeshExport")
      .then(({ createVisualizationMeshExportStatus }) => {
        if (!current) return;
        setVisualizationMeshExportStatus({
          exportReadiness: projectExportReadiness,
          derivedGeometry,
          derivedGeometrySources,
          status: createVisualizationMeshExportStatus({
            exportReadiness: projectExportReadiness,
            derivedGeometry,
            derivedGeometrySources
          })
        });
      })
      .catch(() => {
        if (current) setVisualizationMeshExportStatus(undefined);
      });

    return () => {
      current = false;
    };
  }, [
    derivedGeometry,
    derivedGeometrySources,
    projectExportReadiness,
    workbenchUi.mode
  ]);
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
    if (workbenchUi.mode !== "project") return;
    void refreshProjectOpfsCache();
  }, [refreshProjectOpfsCache, workbenchUi.mode]);

  useEffect(() => {
    if (
      !derivedGeometryEnabled ||
      (document.objects.size === 0 && projectStructure.features.length === 0)
    ) {
      return;
    }
    void getDerivedGeometrySourceBuilders();
  }, [document, getDerivedGeometrySourceBuilders, projectStructure.features]);

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

    const stagedExactSources = currentExactMetadataSources.filter((source) => {
      if (source.kind === "importedBody" || "object" in source) return true;
      const displayEntry = geometryService
        .getSnapshot()
        .entries.find((entry) => entry.sourceId === source.id);
      return (
        displayEntry?.status === "ready" ||
        displayEntry?.status === "error" ||
        displayEntry?.status === "unsupported"
      );
    });
    getDerivedExactMetadataService().reconcile(stagedExactSources);
  }, [
    derivedGeometrySources,
    derivedMeshCacheContextKey,
    currentExactMetadataSources,
    derivedGeometry,
    getDerivedExactMetadataService,
    getDerivedGeometryService
  ]);

  async function syncDocument(
    nextSelectedId: string | null | undefined = selectedId
  ): Promise<void> {
    const nextDocument = engine.getDocument();
    const nextStructure = readProjectStructure();
    return new Promise((resolve) => {
      const resolvers =
        documentPublicationResolversRef.current.get(nextDocument) ?? new Set();
      resolvers.add(resolve);
      documentPublicationResolversRef.current.set(nextDocument, resolvers);
      startTransition(() => {
        setDocument(nextDocument);
        setCurveEditSourceAuthorityRevision((current) => current + 1);
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
        setFocusedSketchId((current) =>
          current && nextDocument.sketches.has(current) ? current : undefined
        );
        setSelectedSketchContext((current) => {
          if (!current) return undefined;
          const sketch = nextDocument.sketches.get(current.sketchId);
          if (!sketch) return undefined;
          return current.entityId && !sketch.entities.has(current.entityId)
            ? { sketchId: current.sketchId }
            : current;
        });
        setViewportTwoTargetMeasurementSession({});
      });
    });
  }

  function applyObjectSelection(objectId: string | undefined) {
    setSolidCollectorSelectionOverride(undefined);
    setSelectedId(objectId);
    setSelectedGeneratedReference(undefined);
    setSelectedNamedReferenceName(undefined);
    setSelectedSketchContext(undefined);
    setViewportPickIntent(undefined);
    setViewportHoverPick(undefined);
    if (!solidCollectorRequest) {
      dispatchWorkbench({ type: "set-active-tool" });
    }
  }

  function runAfterCurveEditNavigationGuard(continuation: () => void) {
    if (curveEditOwnership.guardNavigation) {
      curveEditPendingContinuationRef.current = continuation;
      dispatchWorkbench({
        type: "request-navigation",
        intent: { kind: "close-editor" }
      });
      return;
    }
    if (curveEditOwnership.closeBeforeCleanNavigation) {
      clearCurveEditUi();
    }
    continuation();
  }

  function selectObject(objectId: string | undefined) {
    runAfterCurveEditNavigationGuard(() => applyObjectSelection(objectId));
  }

  function selectViewportPick(pick: ViewportCanvasPick) {
    setSolidCollectorSelectionOverride(undefined);
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
    setSelectedNamedReferenceName(undefined);
    setSelectedGeneratedReference(
      intent.kind === "generatedReference"
        ? {
            bodyId: intent.bodyId,
            stableId: intent.stableId,
            kind: intent.expectedKind
          }
        : undefined
    );
    if (intent.kind === "sketchEntity") {
      setFocusedSketchId(intent.sketchId);
      setSelectedSketchContext({
        sketchId: intent.sketchId,
        entityId: intent.entityId
      });
    } else {
      setSelectedSketchContext(undefined);
    }
    return intent;
  }

  function hoverViewportPick(pick: ViewportCanvasPick | undefined) {
    if (
      !pick ||
      !isSketchCurveEditUiAction(workbenchUi.activeTool) ||
      !focusedSketchId
    ) {
      setViewportHoverPick(pick);
      setCurveEditViewportHoverChoice(undefined);
      curveEditHoverSchedulerRef.current?.clear();
      return;
    }
    setViewportHoverPick((current) =>
      current?.pickedRenderId === pick.pickedRenderId ? current : pick
    );
    const intent = resolveViewportPickIntent({
      pickedRenderId: pick.pickedRenderId,
      bodies: projectStructure.bodies,
      objects: sceneObjects,
      sketches
    });
    const offsetActive = workbenchUi.activeTool === "sketch.offset";
    if (
      !offsetActive &&
      (intent.kind !== "sketchEntity" || intent.sketchId !== focusedSketchId)
    ) {
      setCurveEditViewportHoverChoice(undefined);
      curveEditHoverSchedulerRef.current?.clear();
      return;
    }
    const rawPoint = mapArcToolPickToSketchPoint(pick, focusedSketchId);
    const sketch = sketches.find(
      (candidate) => candidate.id === focusedSketchId
    );
    const entity =
      intent.kind === "sketchEntity"
        ? sketch?.entities.find((candidate) => candidate.id === intent.entityId)
        : undefined;
    const point =
      !offsetActive && rawPoint && entity
        ? projectSketchCurveEditViewportPoint(entity, rawPoint)
        : rawPoint;
    const hoverChoice = {
      ...(intent.kind === "sketchEntity" ? { entityId: intent.entityId } : {}),
      ...(point ? { point } : {})
    };
    curveEditHoverSchedulerRef.current?.schedule(hoverChoice);
  }

  function captureCurveEditViewportPick(pick: ViewportCanvasPick) {
    if (!focusedSketchId) return;
    const intent = resolveViewportPickIntent({
      pickedRenderId: pick.pickedRenderId,
      bodies: projectStructure.bodies,
      objects: sceneObjects,
      sketches
    });
    const offsetActive = workbenchUi.activeTool === "sketch.offset";
    if (
      !offsetActive &&
      (intent.kind !== "sketchEntity" || intent.sketchId !== focusedSketchId)
    ) {
      clearCurveEditHoverPreview();
      setCommandNotice("Choose geometry in the active sketch.");
      return;
    }
    const rawPoint = mapArcToolPickToSketchPoint(pick, focusedSketchId);
    const sketch = sketches.find(
      (candidate) => candidate.id === focusedSketchId
    );
    const entity =
      intent.kind === "sketchEntity"
        ? sketch?.entities.find((candidate) => candidate.id === intent.entityId)
        : undefined;
    const point =
      !offsetActive && rawPoint && entity
        ? projectSketchCurveEditViewportPoint(entity, rawPoint)
        : rawPoint;
    if (!point && intent.kind !== "sketchEntity") {
      clearCurveEditHoverPreview();
      setCommandNotice("Choose a point on the active sketch plane.");
      return;
    }
    clearCurveEditHoverPreview();
    setCurveEditViewportChoice({
      sequence: ++curveEditViewportChoiceSequenceRef.current,
      ...(intent.kind === "sketchEntity" ? { entityId: intent.entityId } : {}),
      ...(point ? { point } : {})
    });
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

      emitGeometryDiagnosticEvent({
        phase: "command-committed",
        timestamp: performance.now()
      });
      await syncDocument(getNextSelectedId(response));
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
    await createQuickStartBody(form, "box");
  }

  async function createCylinder(form: PrimitiveCommandForm) {
    await createQuickStartBody(form, "cylinder");
  }

  async function createQuickStartBody(
    form: PrimitiveCommandForm,
    kind: "box" | "cylinder"
  ) {
    const { createQuickStartSourceBodyPlan } =
      await import("./quickStartBodies");
    const plan = createQuickStartSourceBodyPlan({
      document,
      form,
      kind
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

  async function deleteSelectedObject(objectId = selectedObject?.id) {
    if (!objectId) {
      return;
    }

    await commitOps([buildDeleteObjectOp(objectId)], () => undefined);
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
      const { createSketchOnFaceCommandPlan } =
        await import("./sketchOnFacePromotion");
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

  function applySketchFocus(sketchId: string, entityId?: string) {
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

  function focusSketch(sketchId: string, entityId?: string) {
    const selectionAction = getCurveEditSketchSelectionAction({
      curveEditorActive: workbenchUi.activeEditor?.kind === "sketch-curve-edit",
      dirty: workbenchUi.activeEditorDirty,
      currentSketchId: focusedSketchId,
      nextSketchId: sketchId
    });
    if (selectionAction === "guard-selection") {
      dispatchWorkbench({
        type: "request-navigation",
        intent: {
          kind: "sketch-selection",
          sketchId,
          ...(entityId ? { entityId } : {})
        }
      });
      return;
    }
    if (selectionAction === "close-and-select") {
      clearCurveEditUi();
    }
    applySketchFocus(sketchId, entityId);
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

  async function applySketchCurveEdit(
    operation: PreparedSketchCurveEditOp
  ): Promise<boolean> {
    const response = await submitPreparedSketchCurveEdit(operation, (ops) =>
      commitOps(ops, () => null)
    );
    if (!response?.ok) return false;
    setFocusedSketchId(operation.sketchId);
    const entityId =
      operation.op === "sketch.offset"
        ? operation.createdEntityIds[0]
        : "entityId" in operation
          ? operation.entityId
          : undefined;
    setSelectedSketchContext({
      sketchId: operation.sketchId,
      ...(entityId ? { entityId } : {})
    });
    return true;
  }

  async function applySketchConvenience(
    operation: SketchAddSlotOp | SketchAddRoundedRectangleOp
  ): Promise<boolean> {
    const response = await commitOps([operation], () => null);
    if (!response?.ok) return false;
    setFocusedSketchId(operation.sketchId);
    const entityId = response.createdSketchEntityIds?.[0];
    setSelectedSketchContext({
      sketchId: operation.sketchId,
      ...(entityId ? { entityId } : {})
    });
    return true;
  }

  async function applySketchIntentOps(ops: readonly CadOp[]): Promise<boolean> {
    if (ops.length === 0) return true;
    const response = await commitOps(ops, () => selectedId);
    return response?.ok === true;
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
        const { preflightHoleGeometryCommand } =
          await import("./holeGeometryPreflight");
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
      const { createProjectTopologyAnchorCreationPlanForGeneratedReference } =
        await import("./projectWcadTopologyCheckpoints");
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
      const { createProjectTopologyAnchorRepairPlanForGeneratedReference } =
        await import("./projectWcadTopologyCheckpoints");
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
      const { createProjectTopologyAnchorRepairPlanForGeneratedReference } =
        await import("./projectWcadTopologyCheckpoints");
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
    setSelectedSketchContext(undefined);
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
        const modeledActionId = modelingAction.modelingActionId;
        if (modeledActionId?.startsWith("sketch.")) {
          runWorkbenchAction(modeledActionId as UiActionId);
          return;
        }
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
    setViewportTwoTargetMeasurementSession({ firstTarget: target });
  }

  function clearViewportTwoTargetMeasurement() {
    setViewportTwoTargetMeasurementSession({});
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

  function clearCurveEditUi(restoreFocus = false) {
    const opener =
      curveEditOpenerRef.current ??
      curveEditSessionControlRef.current?.getReturnFocusTarget?.() ??
      null;
    setThreePointArcTool(undefined);
    setCurveEditViewportChoice(undefined);
    setCurveEditViewportHoverChoice(undefined);
    setRegionCandidates([]);
    setSelectedRegionCandidateKeys([]);
    setHoveredRegionCandidateKey(undefined);
    setRegionConsumer("extrude-new-body");
    curveEditHoverSchedulerRef.current?.clear();
    curveEditSessionControlRef.current?.closeLocalDraft?.();
    curveEditSessionControlRef.current = undefined;
    dispatchWorkbench({ type: "set-active-tool" });
    dispatchWorkbench({ type: "set-editor" });
    curveEditOpenerRef.current = null;
    if (restoreFocus) {
      requestAnimationFrame(() => opener?.focus());
    }
  }

  function performUndo() {
    clearCurveEditUi();
    const result = engine.undo();
    void syncDocument();
    if (result) {
      setProjectFile((current) => markProjectFileDirty(current));
      setCommandNotice("Undo applied.");
    }
  }

  function undo() {
    if (
      workbenchUi.activeEditor?.kind === "sketch-curve-edit" &&
      workbenchUi.activeEditorDirty
    ) {
      dispatchWorkbench({
        type: "request-navigation",
        intent: { kind: "document-action", action: "undo" }
      });
      return;
    }
    performUndo();
  }

  function performRedo() {
    clearCurveEditUi();
    const result = engine.redo();
    void syncDocument(result?.transaction.diff.created[0]?.id ?? selectedId);
    if (result) {
      setProjectFile((current) => markProjectFileDirty(current));
      setCommandNotice("Redo applied.");
    }
  }

  function redo() {
    if (
      workbenchUi.activeEditor?.kind === "sketch-curve-edit" &&
      workbenchUi.activeEditorDirty
    ) {
      dispatchWorkbench({
        type: "request-navigation",
        intent: { kind: "document-action", action: "redo" }
      });
      return;
    }
    performRedo();
  }

  async function exportProjectJson() {
    setProjectJson(exportCadProjectJson(engine));
    setProjectJsonDraftSource({ kind: "generatedExport" });
    const { formatProjectJsonSummary, summarizeCadProject } =
      await import("./projectJson");
    setProjectMessage(
      `Generated ${formatProjectJsonSummary(summarizeCadProject(currentProject))}.`
    );
    setProjectMessageTone("info");
  }

  async function downloadProjectJson() {
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
    const { formatProjectJsonSummary, summarizeCadProject } =
      await import("./projectJson");
    setProjectMessage(
      `Downloaded ${formatProjectJsonSummary(summarizeCadProject(currentProject))}.`
    );
    setProjectMessageTone("info");
  }

  async function downloadVisualizationMeshExport() {
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

    let result: VisualizationMeshExportResult;
    try {
      const { createVisualizationMeshExportArtifact } =
        await import("./visualizationMeshExport");
      result = createVisualizationMeshExportArtifact({
        exportReadiness: projectExportReadiness,
        derivedGeometry,
        derivedGeometrySources
      });
    } catch {
      setProjectMessage(
        "Visualization export tools could not be loaded. Try again."
      );
      setProjectMessageTone("error");
      return;
    }

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

    const { executeProjectExactStepExport, isExactExportPlanCurrent } =
      await import("./projectExactStepExport");
    const runtime = getDerivedGeometryRuntime();
    let result;
    try {
      result = await executeProjectExactStepExport({
        engine,
        exactExport,
        resolutions: currentExactBodyResolutions,
        runtime
      });
    } catch (error) {
      const cancelled =
        error instanceof Error &&
        (error.name === "GeometryJobGenerationError" ||
          ("code" in error &&
            error.code === "GEOMETRY_JOB_GENERATION_CANCELLED"));
      setProjectMessage(
        cancelled
          ? "STEP export was cancelled. Resume the model worker, then invoke STEP export again."
          : `STEP export failed: ${error instanceof Error ? error.message : "The geometry worker did not complete the export."}`
      );
      setProjectMessageTone("error");
      return;
    }

    if (!isExactExportPlanCurrent(engine, result.plan)) {
      setProjectMessage(
        "EXPORT_SOURCE_CHANGED: Project or selected body source identity changed before download."
      );
      setProjectMessageTone("error");
      return;
    }

    try {
      const blob = new Blob([result.bytes as Uint8Array<ArrayBuffer>], {
        type: result.mimeType
      });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      try {
        link.href = url;
        link.download = result.fileName;
        window.document.body.append(link);
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      setProjectMessage(
        `STEP download failed: ${error instanceof Error ? error.message : "The browser did not accept the STEP artifact."}`
      );
      setProjectMessageTone("error");
      return;
    }
    setProjectMessage(
      `Downloaded ${result.fileName}: ${result.bodyCount} exact bod${
        result.bodyCount === 1 ? "y" : "ies"
      }, ${result.byteLength} bytes.`
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

      await syncDocument(createdBodyIds[0]);
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
    await ensureCadV19RegionSourceValidationPolicy();
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
    await syncDocument(undefined);
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
    const { exportProjectWcadWithTopologyCheckpoints } =
      await import("./projectWcadTopologyCheckpoints");

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
          // Fall through to the original direct-save error.
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
    void syncDocument(undefined);
  }

  function loadProjectJsonDraft(projectJsonText: string, fileName: string) {
    setProjectJson(projectJsonText);
    setProjectJsonDraftSource({ kind: "loadedFile", fileName });
    setProjectMessage(`Loaded ${fileName} for import validation.`);
    setProjectMessageTone("info");
  }

  async function importProjectJson() {
    await ensureCadV19RegionSourceValidationPolicy();
    const { createProjectJsonPreview, formatProjectJsonSummary } =
      await import("./projectJson");
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
    await syncDocument(undefined);
  }

  function selectDocumentTreeItem(selection: DocumentTreeSelection) {
    switch (selection.kind) {
      case "origin-plane":
        if (solidCollectorRequest?.collector === "mirrorPlane") {
          setSolidCollectorSelectionOverride({
            key: `origin-plane:${selection.plane}`,
            choiceKeys: {
              mirrorPlane: `feature.mirrorPlane:plane:${selection.plane}`
            }
          });
          return;
        }
        setCommandNotice(
          `${selection.plane} plane is available for a new sketch.`
        );
        return;
      case "parameter":
        runAfterCurveEditNavigationGuard(() => openProjectPage("parameters"));
        return;
      case "sketch":
        if (solidCollectorRequest) {
          setSolidCollectorSelectionOverride(undefined);
          setSelectedId(undefined);
          setSelectedGeneratedReference(undefined);
          setSelectedNamedReferenceName(undefined);
          setFocusedSketchId(selection.id);
          setSelectedSketchContext({ sketchId: selection.id });
          return;
        }
        focusSketch(selection.id);
        return;
      case "sketch-entity":
        if (solidCollectorRequest) {
          setSolidCollectorSelectionOverride(undefined);
          setSelectedId(undefined);
          setSelectedGeneratedReference(undefined);
          setSelectedNamedReferenceName(undefined);
          setFocusedSketchId(selection.sketchId);
          setSelectedSketchContext({
            sketchId: selection.sketchId,
            entityId: selection.id
          });
          return;
        }
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
        if (solidCollectorRequest) {
          setSolidCollectorSelectionOverride(undefined);
          inspectNamedReference(selection.name);
          return;
        }
        runAfterCurveEditNavigationGuard(() => {
          inspectNamedReference(selection.name);
          navigateToMode("inspect");
        });
        return;
    }
  }

  function editDocumentTreeItem(selection: DocumentTreeSelection) {
    if (selection.kind === "feature" || selection.kind === "object") {
      runAfterCurveEditNavigationGuard(() => {
        if (selection.kind === "feature") {
          const body = projectStructure.bodies.find(
            (candidate) => candidate.featureId === selection.id
          );
          applyObjectSelection(body?.id);
          setActiveSolidEditFeatureId(selection.id);
        } else {
          applyObjectSelection(selection.id);
          setActiveSolidEditFeatureId(undefined);
        }
        dispatchWorkbench({ type: "set-active-tool", actionId: "solid.edit" });
      });
      return;
    }
    selectDocumentTreeItem(selection);
  }

  function renameDocumentTreeItem(selection: DocumentTreeSelection) {
    if (curveEditOwnership.suppressTreeSourceMutations) {
      setCommandNotice(
        "Apply or discard the active sketch edit before renaming model sources."
      );
      return;
    }
    if (curveEditOwnership.closeBeforeCleanNavigation) clearCurveEditUi();
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
    if (curveEditOwnership.suppressTreeSourceMutations) {
      setCommandNotice(
        "Apply or discard the active sketch edit before deleting model sources."
      );
      return;
    }
    if (curveEditOwnership.closeBeforeCleanNavigation) clearCurveEditUi();
    const row = createDocumentTreeProjection({
      parts: projectStructure.parts,
      parameters,
      sketches,
      features: projectStructure.features,
      bodies: projectStructure.bodies,
      objects: sceneObjects,
      namedReferences,
      health: projectHealth
    }).rowsById.get(documentTreeSelectionKey(selection));
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
    page: "overview" | "files" | "parameters" | "history" | "agent" | "export"
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
    const draftSourceId =
      "id" in submission.draft ? submission.draft.id : undefined;
    const selectedFeature =
      workbenchUi.activeTool === "solid.edit"
        ? projectStructure.features.find(
            (feature) =>
              feature.id === draftSourceId ||
              (feature.kind === "primitive" &&
                feature.objectId === draftSourceId)
          )
        : undefined;
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
        if (submission.draft.sketchId && submission.draft.circleEntityId) {
          await holeSketchEntity(
            submission.draft.sketchId,
            submission.draft.circleEntityId,
            submission.draft
          );
          return;
        }
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

  function applyActiveFeatureDraft(): void {
    if (tryApplyFeatureDraft()) return;
    if (workbenchUi.activeEditor?.kind === "sketch-curve-edit") {
      void curveEditSessionControlRef.current?.apply();
    }
  }

  function runEscapeCancellationStack(): boolean {
    if (
      typeof window !== "undefined" &&
      window.document.querySelector(
        '[role="dialog"][aria-labelledby="curve-edit-navigation-title"]'
      )
    ) {
      // Navigation guard owns Escape; do not compete with its stay handler.
      return false;
    }

    const contributedEditor = resolveContributedEscapeEditorState();
    const solidEditorOpen = Boolean(solidEditorRequest);
    const sketchEditor =
      workbenchUi.activeEditor?.kind === "sketch-curve-edit"
        ? workbenchUi.activeEditorDirty
          ? ("dirty" as const)
          : ("clean" as const)
        : ("none" as const);
    const editorState =
      contributedEditor.state === "dirty" || sketchEditor === "dirty"
        ? ("dirty" as const)
        : contributedEditor.state !== "none"
          ? contributedEditor.state
          : sketchEditor !== "none"
            ? sketchEditor
            : solidEditorOpen
              ? ("clean" as const)
              : ("none" as const);

    // Right drawer forced open by an active solid editor cannot dismiss at step 2.
    const overlayDrawerCloseable =
      openDrawer !== undefined && !(openDrawer === "right" && solidEditorOpen);

    const rung = resolveEscapeRung({
      transientPopover: hasTransientPopoverInDocument(window.document),
      overlayDrawer: overlayDrawerCloseable,
      viewportGesture: viewportGestureActive,
      measurementSecondTarget: measurementSecondTargetActive,
      commandSearch: workbenchUi.commandSearchOpen,
      editor: editorState,
      selection: Boolean(
        selectedId ||
        selectedGeneratedReference ||
        selectedSketchContext ||
        selectedNamedReferenceName
      )
    });
    if (!rung) return false;

    switch (rung) {
      case "transient-popover":
        closeTransientPopoversInDocument(window.document);
        return true;
      case "overlay-drawer":
        setOpenDrawer(undefined);
        return true;
      case "viewport-gesture":
        clearViewportGestures();
        return true;
      case "measurement-second-target":
        clearMeasurementSecondTargetCapture();
        return true;
      case "command-search":
        closeCommandSearch();
        return true;
      case "editor": {
        if (contributedEditor.state === "dirty") {
          contributedEditor.requestDirtyGuard();
          return true;
        }
        if (sketchEditor === "dirty") {
          dispatchWorkbench({
            type: "request-navigation",
            intent: { kind: "close-editor" }
          });
          return true;
        }
        if (contributedEditor.state === "clean") {
          contributedEditor.cancelClean();
          return true;
        }
        if (sketchEditor === "clean") {
          clearCurveEditUi(true);
          return true;
        }
        if (solidEditorOpen) {
          dispatchWorkbench({ type: "set-active-tool" });
          return true;
        }
        return false;
      }
      case "selection":
        setSelectedId(undefined);
        setSelectedGeneratedReference(undefined);
        setSelectedSketchContext(undefined);
        setSelectedNamedReferenceName(undefined);
        return true;
      default:
        return false;
    }
  }

  function runWorkbenchAction(actionId: UiActionId): void {
    if (actionId === "project.apply") {
      applyActiveFeatureDraft();
      return;
    }
    if (actionId === "project.cancel") {
      runEscapeCancellationStack();
      return;
    }

    const bypassCurveGuard = curveEditNavigationBypassRef.current;
    curveEditNavigationBypassRef.current = false;
    const curveInvocation = getActiveCurveEditInvocationAction({
      curveEditorActive:
        !bypassCurveGuard &&
        workbenchUi.activeEditor?.kind === "sketch-curve-edit",
      dirty: workbenchUi.activeEditorDirty,
      activeActionId: workbenchUi.activeTool,
      invokedActionId: actionId
    });
    if (curveInvocation === "focus-existing") {
      curveEditSessionControlRef.current?.focus();
      return;
    }
    if (curveInvocation === "guard-navigation") {
      dispatchWorkbench({
        type: "request-navigation",
        intent: {
          kind: "command-search-action",
          actionId,
          mode: actionId.slice(0, actionId.indexOf(".")) as
            | "project"
            | "solid"
            | "sketch"
            | "inspect"
        }
      });
      return;
    }
    if (
      !bypassCurveGuard &&
      workbenchUi.activeEditor?.kind === "sketch-curve-edit"
    ) {
      clearCurveEditUi();
    }
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
      case "project.agent":
        openProjectPage("agent");
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
      case "project.command-search":
        openCommandSearch();
        return;
      case "project.help":
        setCommandNotice(formatShortcutHelpNotice());
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
        setCommandNotice("Choose a closed sketch profile.");
        return;
      case "solid.revolve":
        navigateToMode("solid");
        setCommandNotice("Choose a closed profile and axis.");
        return;
      case "solid.sweep":
        navigateToMode("solid");
        setCommandNotice("Choose a profile and path.");
        return;
      case "solid.loft":
        navigateToMode("solid");
        setCommandNotice("Choose ordered profiles on parallel planes.");
        return;
      case "solid.transform":
        navigateToMode("solid");
        setCommandNotice("Select an editable source object, then apply.");
        return;
      case "solid.edit":
        setActiveSolidEditFeatureId(selectedFeature?.id);
        navigateToMode("solid");
        setCommandNotice(
          "Select an editable feature or object to open its editor."
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
        setCommandNotice("Choose a seed body.");
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
      case "sketch.point":
        navigateToMode("sketch");
        setCommandNotice("Choose a sketch, then place a point.");
        return;
      case "sketch.line":
        navigateToMode("sketch");
        setCommandNotice("Choose a sketch, then draw a line.");
        return;
      case "sketch.rectangle":
        navigateToMode("sketch");
        setCommandNotice("Choose a sketch, then draw a rectangle.");
        return;
      case "sketch.circle":
        navigateToMode("sketch");
        setCommandNotice("Choose a sketch, then draw a circle.");
        return;
      case "sketch.trim":
      case "sketch.extend":
      case "sketch.split":
      case "sketch.explode-rectangle":
      case "sketch.offset":
      case "sketch.regions":
      case "sketch.slot":
      case "sketch.rounded-rectangle":
      case "sketch.horizontal":
      case "sketch.vertical":
      case "sketch.fixed":
      case "sketch.coincident":
      case "sketch.midpoint":
      case "sketch.parallel":
      case "sketch.perpendicular":
      case "sketch.tangent":
      case "sketch.concentric":
      case "sketch.equal-length":
      case "sketch.equal-radius":
      case "sketch.symmetry":
      case "sketch.rectangle-width":
      case "sketch.rectangle-height":
      case "sketch.line-length":
      case "sketch.radius":
      case "sketch.diameter":
      case "sketch.arc-sweep":
      case "sketch.point-distance":
      case "sketch.horizontal-distance":
      case "sketch.vertical-distance":
      case "sketch.point-line-distance":
      case "sketch.line-angle":
        curveEditOpenerRef.current =
          window.document.activeElement instanceof HTMLElement
            ? window.document.activeElement
            : null;
        setThreePointArcTool(undefined);
        setCurveEditViewportChoice(undefined);
        setCurveEditViewportHoverChoice(undefined);
        setRegionCandidates([]);
        setSelectedRegionCandidateKeys([]);
        setHoveredRegionCandidateKey(undefined);
        setRegionConsumer("extrude-new-body");
        curveEditHoverSchedulerRef.current?.clear();
        navigateToMode("sketch");
        dispatchWorkbench({
          type: "set-editor",
          editor: {
            kind: "sketch-curve-edit",
            ...(focusedSketchId ? { sourceId: focusedSketchId } : {})
          }
        });
        setCommandNotice(
          actionId === "sketch.regions"
            ? "Choose material regions and an operation."
            : getSketchEditorActionNotice(
                isSketchCurveEditUiAction(actionId) ||
                  actionId === "sketch.slot" ||
                  actionId === "sketch.rounded-rectangle"
                  ? "curve"
                  : "intent",
                actionId
              )
        );
        return;
      case "sketch.finish":
        setThreePointArcTool(undefined);
        navigateToMode("solid");
        setCommandNotice("Sketch finished. No model change was created.");
        return;
      default: {
        // Every registered action has an explicit case above, so this is only a
        // runtime guard against a registry entry added without a handler.
        const unhandled: string = actionId;
        const mode = unhandled.slice(0, unhandled.indexOf("."));
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

  function continueCurveEditNavigation(intent: WorkbenchNavigationIntent) {
    const pendingContinuation =
      intent.kind === "close-editor"
        ? curveEditPendingContinuationRef.current
        : undefined;
    curveEditPendingContinuationRef.current = undefined;
    switch (intent.kind) {
      case "document-action":
        if (intent.action === "undo") performUndo();
        else if (intent.action === "redo") performRedo();
        else {
          curveEditNavigationBypassRef.current = true;
          runWorkbenchAction(
            intent.action === "new" ? "project.new" : "project.open"
          );
        }
        return;
      case "command-search-action":
        curveEditNavigationBypassRef.current = true;
        runWorkbenchAction(intent.actionId as UiActionId);
        return;
      case "sketch-selection":
        applySketchFocus(intent.sketchId, intent.entityId);
        return;
      case "close-editor":
        if (pendingContinuation) pendingContinuation();
        else dispatchWorkbench({ type: "request-navigation", intent });
        return;
      default:
        dispatchWorkbench({ type: "request-navigation", intent });
    }
  }

  async function resolveCurveEditNavigation(
    resolution: "apply" | "discard" | "stay",
    navigationTrigger: HTMLElement | null = null
  ) {
    const intent = workbenchUi.navigationIntent;
    if (!intent) return;
    const editorReturnFocusTarget =
      curveEditSessionControlRef.current?.getReturnFocusTarget?.() ?? null;
    const navigationFocusTarget =
      resolution !== "stay"
        ? getCurveEditDiscardFocusTarget(
            intent,
            curveEditOpenerRef.current,
            navigationTrigger,
            editorReturnFocusTarget
          )
        : null;
    if (resolution === "stay") {
      curveEditPendingContinuationRef.current = undefined;
      dispatchWorkbench({ type: "resolve-navigation", resolution: "stay" });
      restoreCurveEditFocus();
      return;
    }
    if (resolution === "apply") {
      let applied = false;
      try {
        applied =
          (await curveEditSessionControlRef.current?.apply({
            restoreFocusOnSuccess: false
          })) === true;
      } catch (error) {
        setCommandError(
          error instanceof Error
            ? error.message
            : "The sketch edit could not be applied."
        );
      }
      if (!applied) {
        curveEditPendingContinuationRef.current = undefined;
        dispatchWorkbench({ type: "navigation-apply-failed" });
        restoreCurveEditFocus();
        return;
      }
    } else {
      clearCurveEditUi();
    }
    continueCurveEditNavigation(intent);
    restoreResolvedNavigationFocus(navigationFocusTarget, intent);
  }

  function restoreCurveEditFocus() {
    requestAnimationFrame(() => {
      if (curveEditSessionControlRef.current) {
        curveEditSessionControlRef.current.focus();
      } else {
        curveEditOpenerRef.current?.focus();
      }
    });
  }

  function restoreResolvedNavigationFocus(
    target: HTMLElement | null,
    intent: WorkbenchNavigationIntent
  ) {
    const restore = () => {
      const activeElement = window.document.activeElement;
      const resolvedTarget =
        intent.kind === "mode"
          ? [
              ...window.document.querySelectorAll<HTMLElement>(
                '[aria-label="Workbench mode"] button[aria-selected="true"]'
              )
            ].find(
              (candidate) =>
                candidate.textContent?.trim().toLowerCase() === intent.mode
            )
          : target?.isConnected === true
            ? target
            : undefined;
      const shouldRestore = shouldRestoreResolvedCurveEditNavigationFocus({
        activeElement:
          activeElement instanceof HTMLElement ? activeElement : null,
        body: window.document.body,
        documentElement: window.document.documentElement
      });
      if (shouldRestore && resolvedTarget?.isConnected) {
        resolvedTarget.focus();
      }
    };
    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
  }

  const uiActionAvailability = useMemo<UiActionAvailabilityProjection>(() => {
    void document;
    const ready = { status: "ready" } as const;
    const needs = (message: string) =>
      ({ status: "needs-selection", message }) as const;
    const blocked = (message: string) =>
      ({ status: "blocked", message }) as const;
    const selectedSketch = selectedSketchContext
      ? sketches.find(
          (candidate) => candidate.id === selectedSketchContext.sketchId
        )
      : undefined;
    const focusedSketch = focusedSketchId
      ? sketches.find((candidate) => candidate.id === focusedSketchId)
      : undefined;
    const selectedEntity = selectedSketch?.entities.find(
      (candidate) => candidate.id === selectedSketchContext?.entityId
    );
    const sketchReady = focusedSketchId
      ? ready
      : needs("Select or create a sketch first.");
    const selectedEntityReady = selectedEntity
      ? ready
      : needs(UI_ACTION_AVAILABILITY_MESSAGES.sketchConstruction);
    const canOpenWcad =
      projectStorageCapabilities.fileSystemAccessAvailable ||
      projectStorageCapabilities.wcadUploadAvailable;
    const canSave =
      projectFile.mode === "wcadHandle" ||
      projectStorageCapabilities.fileSystemAccessAvailable ||
      projectStorageCapabilities.wcadDownloadAvailable;
    const canOpenStep =
      projectStorageCapabilities.fileSystemAccessAvailable ||
      projectStorageCapabilities.jsonUploadAvailable;
    const pendingMutationBlock = blocked(
      "Wait for the current model update to finish before saving or exporting."
    );
    const sketchCurveApplyReady = Boolean(
      workbenchUi.activeEditor?.kind === "sketch-curve-edit" &&
      sketchApplyCanApply
    );
    const applyReady = featureApplyCanApply || sketchCurveApplyReady;

    return {
      "project.undo": engine.getTransactions().length
        ? ready
        : blocked("There is nothing to undo."),
      "project.redo": engine.getRedoStack().length
        ? ready
        : blocked("There is nothing to redo."),
      "project.command-search": ready,
      "project.help": ready,
      "project.cancel": ready,
      "project.apply": applyReady
        ? ready
        : blocked("Open a feature editor with a valid draft to apply."),
      "project.new": ready,
      "project.open": canOpenWcad
        ? ready
        : blocked(
            "Open .wcad is unavailable because this browser cannot access local project files."
          ),
      "project.save": commandPending
        ? pendingMutationBlock
        : canSave
          ? ready
          : blocked(
              "Save is unavailable until a writable .wcad location is available in this browser."
            ),
      "project.save-as": commandPending
        ? pendingMutationBlock
        : canSave
          ? ready
          : blocked(
              "Save as is unavailable until a writable .wcad download or file handle is available."
            ),
      "project.import-step": canOpenStep
        ? ready
        : blocked(
            "Import STEP is unavailable because this browser cannot open local STEP files."
          ),
      "project.import-json": projectStorageCapabilities.jsonUploadAvailable
        ? ready
        : blocked(
            "Import JSON is unavailable because this browser cannot open local JSON files."
          ),
      "project.export-json": commandPending ? pendingMutationBlock : ready,
      "project.download-json": commandPending
        ? pendingMutationBlock
        : projectStorageCapabilities.jsonDownloadAvailable
          ? ready
          : blocked(
              "Download JSON is unavailable because this browser cannot download files."
            ),
      "project.export-step": commandPending
        ? pendingMutationBlock
        : projectExportReadiness?.canExportFiles
          ? ready
          : blocked(
              projectExportReadiness
                ? "Download STEP is unavailable until the model has export-ready exact geometry."
                : "Project export readiness is unavailable."
            ),
      "project.export-glb": commandPending ? pendingMutationBlock : ready,
      "solid.extrude": selectedProfile
        ? ready
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidExtrude),
      "solid.revolve":
        selectedProfile && solidAxisChoices.length > 0
          ? ready
          : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidRevolve),
      "solid.sweep":
        selectedEntityProfile && solidPathChoices.length > 0
          ? ready
          : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidSweep),
      "solid.loft":
        solidProfileChoices.filter((choice) => choice.value.kind === "entity")
          .length >= 2
          ? ready
          : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidLoft),
      "solid.transform": selectedObject
        ? ready
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidTransform),
      "solid.hole":
        modelingSelectionContext.selectionKind === "sketchEntity" &&
        modelingSelectionContext.entity.kind === "circle" &&
        solidHoleTargetChoices.length > 0
          ? ready
          : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidHole),
      "solid.fillet": selectedFilletEdgeChoice
        ? ready
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidFillet),
      "solid.chamfer": selectedChamferEdgeChoice
        ? ready
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidChamfer),
      "solid.shell": selectedSeedBodyId
        ? ready
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidShell),
      "solid.linear-pattern": selectedSeedBodyId
        ? ready
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidLinearPattern),
      "solid.circular-pattern": selectedSeedBodyId
        ? ready
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidCircularPattern),
      "solid.mirror": selectedSeedBodyId
        ? ready
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidMirror),
      "solid.edit":
        selectedObject ||
        (selectedFeature && selectedFeature.kind !== "importedBody")
          ? ready
          : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidEdit),
      "solid.rename":
        selectedObject || selectedSketchContext
          ? ready
          : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidRename),
      "solid.delete":
        selectedObject ||
        selectedSketchContext ||
        (selectedFeature && selectedFeature.kind !== "primitive")
          ? ready
          : needs(UI_ACTION_AVAILABILITY_MESSAGES.solidDelete),
      "sketch.point": sketchReady,
      "sketch.line": sketchReady,
      "sketch.rectangle": sketchReady,
      "sketch.circle": sketchReady,
      "sketch.arc": sketchReady,
      "sketch.slot": sketchReady,
      "sketch.rounded-rectangle": sketchReady,
      "sketch.trim": createCurveEditActionAvailability(
        selectedSketch,
        selectedEntity,
        ["line", "arc", "circle"],
        UI_ACTION_AVAILABILITY_MESSAGES.sketchTrim
      ),
      "sketch.extend": createCurveEditActionAvailability(
        selectedSketch,
        selectedEntity,
        ["line", "arc"],
        UI_ACTION_AVAILABILITY_MESSAGES.sketchExtend
      ),
      "sketch.split": createCurveEditActionAvailability(
        selectedSketch,
        selectedEntity,
        ["line", "arc", "circle"],
        UI_ACTION_AVAILABILITY_MESSAGES.sketchSplit
      ),
      "sketch.explode-rectangle": createCurveEditActionAvailability(
        selectedSketch,
        selectedEntity,
        ["rectangle"],
        UI_ACTION_AVAILABILITY_MESSAGES.sketchExplodeRectangle
      ),
      "sketch.offset": createCurveEditActionAvailability(
        selectedSketch,
        selectedEntity,
        ["line", "arc", "circle", "rectangle"],
        UI_ACTION_AVAILABILITY_MESSAGES.sketchOffset
      ),
      "sketch.regions": focusedSketch
        ? focusedSketch.entities.some(
            (entity) =>
              !entity.construction &&
              (entity.kind === "rectangle" ||
                entity.kind === "circle" ||
                entity.kind === "line" ||
                entity.kind === "arc")
          )
          ? ready
          : {
              status: "blocked",
              message:
                "This sketch has no eligible non-construction profile geometry."
            }
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.sketchRegions),
      "sketch.construction": selectedEntityReady,
      "sketch.delete": selectedEntity
        ? ready
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.sketchDelete),
      ...sketchIntentActionAvailability,
      "inspect.mass-properties": selectedBody
        ? ready
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.inspectMassProperties),
      "inspect.name-reference":
        selectedGeneratedReferenceState.status === "selected"
          ? ready
          : needs(UI_ACTION_AVAILABILITY_MESSAGES.inspectNameReference),
      "inspect.repair-reference":
        selectedNamedReferenceName &&
        selectedGeneratedReferenceState.status === "selected"
          ? ready
          : needs(UI_ACTION_AVAILABILITY_MESSAGES.inspectRepairReference),
      "inspect.fit-selection": selectedViewportRenderId
        ? ready
        : needs(UI_ACTION_AVAILABILITY_MESSAGES.inspectFitSelection)
    };
  }, [
    commandPending,
    document,
    featureApplyCanApply,
    focusedSketchId,
    modelingSelectionContext,
    projectExportReadiness,
    projectFile.mode,
    projectStorageCapabilities,
    selectedBody,
    selectedEntityProfile,
    selectedFeature,
    selectedFilletEdgeChoice,
    selectedChamferEdgeChoice,
    selectedGeneratedReferenceState,
    selectedNamedReferenceName,
    selectedObject,
    selectedProfile,
    selectedSeedBodyId,
    selectedSketchContext,
    selectedViewportRenderId,
    sketchApplyCanApply,
    sketchIntentActionAvailability,
    sketches,
    solidAxisChoices.length,
    solidHoleTargetChoices.length,
    solidPathChoices.length,
    solidProfileChoices,
    workbenchUi.activeEditor
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
  const restoreCommandSearchFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const activeElement = window.document.activeElement;
      if (
        activeElement &&
        activeElement !== window.document.body &&
        activeElement !== window.document.documentElement
      ) {
        return;
      }
      if (commandSearchOpenerRef.current?.isConnected) {
        commandSearchOpenerRef.current.focus();
      }
    });
  }, []);
  const closeCommandSearch = useCallback(() => {
    dispatchWorkbench({
      type: "set-command-search-open",
      open: false
    });
  }, []);
  const openCommandSearch = useCallback(() => {
    if (!workbenchUi.commandSearchOpen) {
      commandSearchOpenerRef.current =
        window.document.activeElement instanceof HTMLElement
          ? window.document.activeElement
          : null;
    }
    dispatchWorkbench({
      type: "set-command-search-open",
      open: true
    });
  }, [workbenchUi.commandSearchOpen]);
  const onShortcutKeyDown = useEffectEvent((event: KeyboardEvent) => {
    {
      const resolved = resolveShortcutRouterAction(event, workbenchUi.mode);
      if (!resolved) return;

      const curveNavigationGuard = window.document.querySelector<HTMLElement>(
        '[role="dialog"][aria-labelledby="curve-edit-navigation-title"]'
      );
      if (curveNavigationGuard) {
        if (resolved.actionId === "project.apply") {
          event.preventDefault();
          event.stopPropagation();
          curveNavigationGuard
            .querySelector<HTMLButtonElement>("[data-dialog-initial-focus]")
            ?.click();
        }
        // The modal owns every other key while it resolves Apply/Discard/Stay.
        return;
      }

      if (resolved.actionId === "project.cancel") {
        if (
          workbenchUi.activeEditor &&
          event.target instanceof Element &&
          event.target.closest(".pb-dock--right.pb-dock--drawer")
        ) {
          // Let the drawer's Escape handler dismiss the forced narrow editor.
          return;
        }
        if (!runEscapeCancellationStack()) return;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // History chords stay on the dedicated helper so Ctrl+Y and editable
      // suppression stay consistent with existing undo/redo behavior.
      if (
        resolved.actionId === "project.undo" ||
        resolved.actionId === "project.redo"
      ) {
        const command = getHistoryKeyboardCommand(event);
        if (!command) return;
        event.preventDefault();
        const action = projectedUiActions.find(
          (candidate) => candidate.definition.id === `project.${command}`
        );
        if (action) void invokeUiAction(action, uiActionContext);
        return;
      }

      event.preventDefault();
      const action = projectedUiActions.find(
        (candidate) => candidate.definition.id === resolved.actionId
      );
      if (action) void invokeUiAction(action, uiActionContext);
    }
  });
  useEffect(() => {
    // `useEffectEvent` keeps the handler reading current mode, availability, and
    // Escape-stack state, so the listener binds once instead of on every change.
    const handleShortcut = (event: KeyboardEvent) => onShortcutKeyDown(event);
    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, []);

  return (
    <ProgressiveSketchAnalysisProvider
      active={progressiveSketchAnalysis}
      authorityEpoch={sketchAnalysisAuthorityEpoch}
      eager={eagerSketchAnalysis}
      project={currentProject}
      projectCacheKey={String(curveEditSourceAuthorityRevision)}
      sketches={sketches}
    >
      <>
        {window.location.hash.startsWith("#agentSession=") ? (
          <Suspense fallback={null}>
            <LocalAgentSessionController
              engine={engine}
              executor={commandExecutor}
              document={document}
              selection={currentAgentSelection}
              publishCommit={publishAgentCommit}
            />
          </Suspense>
        ) : null}
        {workbenchUi.navigationIntent &&
        workbenchUi.activeEditor?.kind === "sketch-curve-edit" ? (
          <Suspense fallback={null}>
            <CurveEditNavigationGuard
              intent={workbenchUi.navigationIntent}
              onApply={(navigationTrigger) =>
                resolveCurveEditNavigation("apply", navigationTrigger)
              }
              onDiscard={(navigationTrigger) =>
                void resolveCurveEditNavigation("discard", navigationTrigger)
              }
              onStay={() => void resolveCurveEditNavigation("stay")}
            />
          </Suspense>
        ) : null}
        <WorkbenchShell
          mode={workbenchUi.mode}
          activeEditor={Boolean(workbenchUi.activeEditor || solidEditorRequest)}
          activeEditorKey={
            solidEditorRequest?.key ??
            (workbenchUi.activeEditor
              ? `${workbenchUi.activeEditor.kind}:${workbenchUi.activeEditor.sourceId ?? workbenchUi.activeTool ?? ""}`
              : undefined)
          }
          leftDockWidth={workbenchUi.leftDockWidth}
          rightDockWidth={workbenchUi.rightDockWidth}
          leftDockCollapsed={workbenchUi.leftDockCollapsed}
          rightDockCollapsed={workbenchUi.rightDockCollapsed}
          projectDetailsOpen={false}
          openDrawer={openDrawer}
          onOpenDrawerChange={setOpenDrawer}
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
                  available:
                    !commandPending && engine.getRedoStack().length > 0,
                  pending: commandPending,
                  unavailableReason:
                    engine.getRedoStack().length === 0
                      ? "There is nothing to redo."
                      : undefined,
                  run: redo
                }}
                onOpenCommandSearch={openCommandSearch}
                onOpenHelp={() => setCommandNotice(formatShortcutHelpNotice())}
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
                    ["agent", "Agent"],
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
              <ProgressiveDocumentTreeDock
                parts={projectStructure.parts}
                parameters={parameters}
                sketches={sketches}
                features={projectStructure.features}
                bodies={projectStructure.bodies}
                objects={sceneObjects}
                namedReferences={namedReferences}
                health={projectHealth}
                suppressSourceMutations={
                  curveEditOwnership.suppressTreeSourceMutations
                }
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
            <Suspense
              fallback={<p className="panel-loading">Loading viewport…</p>}
            >
              <ViewportCanvas
                primitives={renderScene.primitives}
                meshes={renderScene.meshes}
                notifyHoverPointChanges={Boolean(
                  threePointArcTool ||
                  isSketchCurveEditUiAction(workbenchUi.activeTool)
                )}
                selectedId={selectedViewportRenderId}
                suspendHoverPicking={
                  workbenchUi.activeTool === "sketch.regions"
                }
                visualStates={viewportVisualState.rendererVisualStates}
                status={viewportVisualState.status}
                contextualSurface={
                  curveEditOwnership.suppressContextSourceMutations ? null : (
                    <ContextualActionStrip
                      disabled={commandPending}
                      surface={viewportContextualCommandSurface}
                      onExplainUnavailable={setCommandNotice}
                      onInvoke={(action) => {
                        if (action.route === "name" && action.target) {
                          const name = window.prompt("Reference name", "");
                          if (name?.trim()) {
                            void nameGeneratedReference(
                              name.trim(),
                              action.target
                            );
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
                  )
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
                  } else if (
                    isSketchCurveEditUiAction(workbenchUi.activeTool) &&
                    focusedSketchId
                  ) {
                    captureCurveEditViewportPick(pick);
                  } else {
                    selectViewportPick(pick);
                  }
                }}
                sketchOverlay={({ camera, size }) => (
                  <>
                    {regionOverlaySketch && regionOverlayDisplayFrame ? (
                      <Suspense fallback={<SketchOverlayLoadingFallback />}>
                        <SketchRegionOverlay
                          camera={camera}
                          candidates={regionCandidates}
                          displayFrame={regionOverlayDisplayFrame}
                          hoveredCandidateKey={hoveredRegionCandidateKey}
                          selectedCandidateKeys={selectedRegionCandidateKeys}
                          size={size}
                          sketch={regionOverlaySketch}
                          onHoverCandidate={setHoveredRegionCandidateKey}
                          onSelectCandidate={toggleRegionCandidate}
                        />
                      </Suspense>
                    ) : null}
                    {sketchViewportDragTarget &&
                    workbenchUi.activeTool !== "sketch.regions" ? (
                      <Suspense fallback={<SketchOverlayLoadingFallback />}>
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
                      </Suspense>
                    ) : null}
                    {threePointArcTool &&
                    getSketchViewportDisplayFrame(
                      threePointArcTool.sketchId
                    ) ? (
                      <Suspense fallback={<SketchOverlayLoadingFallback />}>
                        <SketchArcToolOverlay
                          camera={camera}
                          displayFrame={
                            getSketchViewportDisplayFrame(
                              threePointArcTool.sketchId
                            )!
                          }
                          session={threePointArcTool}
                          size={size}
                        />
                      </Suspense>
                    ) : null}
                  </>
                )}
              />
            </Suspense>
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
                currentProject={currentProject}
                projectFile={projectFile}
                storageCapabilities={projectStorageCapabilities}
                health={projectHealth}
                topologyIdentityReadiness={projectTopologyIdentityReadiness}
                importReadiness={projectImportReadiness}
                exportReadiness={projectExportReadiness}
                visualizationExport={visualizationMeshExportStatus}
                jsonDraft={projectJson}
                jsonDraftSource={projectJsonDraftSource}
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
                  void importProjectWcadBytes(
                    bytes,
                    fileName,
                    "uploadedFallback"
                  )
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
                    value.trim().length === 0
                      ? { kind: "empty" }
                      : { kind: "edited" }
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
                    disabled={commandPending}
                    collectorSelection={
                      solidCollectorSelectionOverride ?? solidCollectorSelection
                    }
                    onApply={applySolidEditorSubmission}
                    onCancel={() =>
                      dispatchWorkbench({ type: "set-active-tool" })
                    }
                    onDelete={(request) => {
                      const sourceId =
                        "id" in request.initialDraft
                          ? request.initialDraft.id
                          : undefined;
                      const feature = projectStructure.features.find(
                        (candidate) => candidate.id === sourceId
                      );
                      if (feature) return deleteAuthoredFeature(feature.id);
                      if (sourceId && document.objects.has(sourceId))
                        return deleteSelectedObject(sourceId);
                      return undefined;
                    }}
                    onCollect={(request) => {
                      setSolidCollectorRequest(request);
                      setSolidCollectorSelectionOverride(undefined);
                      if (!request) return;
                      dispatchWorkbench({
                        type: "set-selection-filter",
                        filter: request.acceptedKinds.some((kind) =>
                          kind.includes("edge")
                        )
                          ? "edge"
                          : request.acceptedKinds.some((kind) =>
                                kind.includes("face")
                              )
                            ? "face"
                            : "body"
                      });
                      setCommandNotice(
                        `Select ${request.acceptedKinds.join(" or ")} in the viewport or model tree.`
                      );
                    }}
                  />
                </Suspense>
              ) : null}

              {workbenchUi.mode === "inspect" ? (
                <Suspense
                  fallback={
                    <p className="panel-loading">Loading inspection…</p>
                  }
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
                      !selectedGeneratedReferenceState.selection
                        .topologyAnchorId
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
                    units={document.units}
                    features={projectStructure.features}
                    dimensionsBySketchId={sketchDimensionsBySketchId}
                    evaluationsBySketchId={sketchEvaluationsBySketchId}
                    solverStatusesBySketchId={sketchSolverStatusesBySketchId}
                    pathCandidatesBySketchId={pathCandidatesBySketchId}
                    activeSketchId={focusedSketchId}
                    selectedEntityId={selectedSketchContext?.entityId}
                    curveEditSourceAuthorityKey={
                      curveEditSourceAuthorityRevision
                    }
                    arcToolActiveSketchId={threePointArcTool?.sketchId}
                    initialActionId={
                      workbenchUi.activeTool as UiActionId | undefined
                    }
                    curveEditViewportChoice={curveEditViewportChoice}
                    curveEditViewportHoverChoice={curveEditViewportHoverChoice}
                    curveEditKeyboardSuspended={Boolean(
                      workbenchUi.navigationIntent &&
                      workbenchUi.activeEditor?.kind === "sketch-curve-edit"
                    )}
                    regionCandidates={regionCandidates}
                    selectedRegionCandidateKeys={selectedRegionCandidateKeys}
                    hoveredRegionCandidateKey={hoveredRegionCandidateKey}
                    regionConsumer={regionConsumer}
                    regionTargetBodies={projectStructure.bodies
                      .filter((body) => !body.consumedByFeatureId)
                      .map((body) => ({
                        id: body.id,
                        label: body.name ?? body.id
                      }))}
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
                    onSetEntityConstruction={(
                      sketchId,
                      entityId,
                      construction
                    ) =>
                      void setSketchEntityConstruction(
                        sketchId,
                        entityId,
                        construction
                      )
                    }
                    onStartThreePointArcTool={startThreePointArcTool}
                    onCancelGesture={() => setThreePointArcTool(undefined)}
                    onReadCurveEditReadinessAsync={
                      readSketchCurveEditReadinessAsync
                    }
                    onApplyCurveEdit={applySketchCurveEdit}
                    onApplySketchConvenience={applySketchConvenience}
                    onQueryRegionCandidates={querySketchRegionCandidates}
                    onValidateRegionProfile={validateSketchRegionProfile}
                    onRegionCandidatesChange={changeRegionCandidates}
                    onToggleRegionCandidate={toggleRegionCandidate}
                    onHoverRegionCandidate={setHoveredRegionCandidateKey}
                    onRegionConsumerChange={changeRegionConsumer}
                    onApplyRegionSelectionReady={acceptValidatedRegionSelection}
                    onCancelCurveEdit={(restoreFocus) => {
                      clearCurveEditUi(restoreFocus);
                    }}
                    onRequestCurveEditEscape={(dirty) => {
                      if (dirty) {
                        dispatchWorkbench({
                          type: "set-editor-dirty",
                          dirty: true
                        });
                        dispatchWorkbench({
                          type: "request-navigation",
                          intent: { kind: "close-editor" }
                        });
                      } else {
                        clearCurveEditUi(true);
                      }
                    }}
                    onCurveEditChoiceRejected={setCommandNotice}
                    onClearCurveEditHoverPreview={clearCurveEditHoverPreview}
                    onCurveEditDirtyChange={handleCurveEditDirtyChange}
                    onCurveEditSessionControlChange={
                      handleCurveEditSessionControlChange
                    }
                    onApplySketchIntentOps={applySketchIntentOps}
                    onIntentActionAvailabilityChange={
                      setSketchIntentActionAvailability
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
                modelWorkControl={modelWorkControl}
              />
            ) : workbenchUi.mode === "sketch" ? (
              <SketchStatusBarWithAnalysis
                focusedSketchId={focusedSketchId}
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
                pendingLabel={commandPending ? "Updating sketch" : undefined}
                modelWorkControl={modelWorkControl}
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
                modelWorkControl={modelWorkControl}
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
                modelSourceIds={derivedGeometry.entries.map(
                  (entry) => entry.sourceId ?? entry.objectId
                )}
                pendingLabel={commandPending ? "Updating model" : undefined}
                modelWorkControl={modelWorkControl}
              />
            )
          }
        />
        {workbenchUi.commandSearchOpen ? (
          <Suspense
            fallback={
              <CommandSearchLoadingFallback
                onRequestClose={() => {
                  closeCommandSearch();
                  restoreCommandSearchFocus();
                }}
              />
            }
          >
            <CommandSearchDialog
              open
              actions={projectedUiActions}
              actionContext={uiActionContext}
              currentMode={workbenchUi.mode}
              onRequestClose={closeCommandSearch}
              restoreFocus={restoreCommandSearchFocus}
              onInvocationError={(_action, error) =>
                setCommandError(
                  error instanceof Error
                    ? error.message
                    : "The command could not be started."
                )
              }
            />
          </Suspense>
        ) : null}
      </>
    </ProgressiveSketchAnalysisProvider>
  );
}
