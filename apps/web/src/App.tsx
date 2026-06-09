import {
  AsyncCadCommandExecutor,
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  type CadBodySnapshot,
  type CadBodyTopologySnapshot,
  type CadDocument,
  type CadFeatureSummary,
  type CadPartSnapshot,
  type CadTransactionHistoryEntry,
  type BodyMeasurementsSnapshot,
  type ObjectMeasurementsSnapshot
} from "@web-cad/cad-core";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadBatchResponse,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadSelectionReferenceInput,
  CadParameterSnapshot,
  GeneratedReferenceMeasurement,
  NamedGeneratedReferenceEntry,
  CadOp,
  DocumentUnitUpdateMode,
  FeatureExtrudeSide,
  ProjectExportReadinessQueryResponse,
  ProjectHealthQueryResponse,
  SelectionReferenceCandidatesQueryResponse,
  SketchDimensionEntry,
  SketchDimensionTarget,
  SketchConstraintEntry,
  SketchEvaluationQueryResponse,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { createDerivedGeometryRuntime } from "@web-cad/derived-geometry-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildBatch,
  buildAddSketchCircleOp,
  buildAddSketchLineOp,
  buildAddSketchPointOp,
  buildAddSketchRectangleOp,
  buildCreateSketchOnFaceOp,
  buildCreateSketchOp,
  buildCreateBoxOp,
  buildCreateConeOp,
  buildCreateCylinderOp,
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
  buildFeatureUpdateExtrudeOp,
  buildNameGeneratedReferenceOp,
  buildParameterEditOps,
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
import { StructurePanel } from "./components/StructurePanel";
import { ViewportCanvas } from "./components/ViewportCanvas";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
import {
  createEmptyDerivedGeometrySnapshot,
  DerivedGeometryService,
  getDerivedGeometryStatusLabel,
  type DerivedGeometrySource,
  type DerivedGeometrySnapshot
} from "./derivedGeometry";
import {
  createVisualizationMeshExportArtifact,
  createVisualizationMeshExportStatus
} from "./visualizationMeshExport";
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
import {
  formatBodyMeasurementError,
  formatBodyTopologyError
} from "./sceneObjectDisplay";
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
  getGeneratedReferenceSelectionState,
  reconcileSelectedGeneratedReferenceBody,
  type GeneratedReferenceSelectionState,
  type SelectedGeneratedReference
} from "./generatedReferenceSelection";
import { resolveViewportPickIntent } from "./viewportPickIntent";
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
  createAddTargetBodyOptions,
  createCutTargetBodyOptions,
  createHoleTargetBodyOptions,
  createSketchEntitySelectionId,
  createSketchSelectionId,
  type SketchPanelSelectionContext
} from "./sketchPanelUi";
import "./styles.css";

const engine = new CadEngine();
const commandExecutor = new AsyncCadCommandExecutor(
  engine,
  new BrowserCadCommandWorker()
);
const derivedGeometryEnabled = __PARTBENCH_DERIVED_GEOMETRY_ENABLED__;

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

type UtilityPanelId = "sketches" | "history" | "project";

type ModelBrowserPanelId = "tree" | "selection";

function formatSchemaBadge(schemaVersion: string): string {
  return schemaVersion.replace("web-cad.project.", "").toUpperCase();
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

function createDerivedExactMetadataSnapshotsForProjectQuery(
  exactMetadata: DerivedExactMetadataSnapshot
) {
  if (exactMetadata.entries.length === 0) {
    return [];
  }

  const sourceIdentityCacheKeysByBodyId = new Map<string, string>();

  for (const entry of exactMetadata.entries) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: entry.bodyId }
    });

    if (response.ok && response.query === "body.topology") {
      sourceIdentityCacheKeysByBodyId.set(
        entry.bodyId,
        response.topology.sourceIdentity.cacheKey
      );
    }
  }

  return createProjectQueryDerivedExactMetadataSnapshots(
    exactMetadata,
    sourceIdentityCacheKeysByBodyId
  );
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
      response.topology.sourceIdentity.cacheKey
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
  readonly sketches: readonly SketchSnapshot[];
}): ModelingSelectionContext {
  if (selectedGeneratedReferenceState.status === "selected") {
    return {
      selectionKind: "generatedReference",
      reference: selectedGeneratedReferenceState.reference,
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

      return {
        selectionKind: "sketchEntity",
        sketch,
        entity,
        dimensions:
          evaluation?.dimensions ?? sketchDimensionsBySketchId.get(sketch.id),
        constraints: evaluation?.constraints
      };
    }

    if (sketch) {
      return { selectionKind: "sketch", sketch };
    }
  }

  if (selectedId) {
    for (const sketch of sketches) {
      for (const entity of sketch.entities) {
        if (
          selectedId === createSketchEntitySelectionId(sketch.id, entity.id)
        ) {
          const evaluation = sketchEvaluationsBySketchId.get(sketch.id);

          return {
            selectionKind: "sketchEntity",
            sketch,
            entity,
            dimensions:
              evaluation?.dimensions ??
              sketchDimensionsBySketchId.get(sketch.id),
            constraints: evaluation?.constraints
          };
        }
      }

      if (selectedId === createSketchSelectionId(sketch.id)) {
        return { selectionKind: "sketch", sketch };
      }
    }
  }

  const focusedSketch = focusedSketchId
    ? sketches.find((sketch) => sketch.id === focusedSketchId)
    : undefined;

  return focusedSketch
    ? { selectionKind: "sketch", sketch: focusedSketch }
    : undefined;
}

export function App() {
  const derivedGeometryRuntimeRef = useRef<DerivedGeometryRuntime | undefined>(
    undefined
  );
  const derivedGeometryServiceRef = useRef<DerivedGeometryService | undefined>(
    undefined
  );
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
  const [unitUpdateMode, setUnitUpdateMode] =
    useState<DocumentUnitUpdateMode>("metadataOnly");
  const [projectJson, setProjectJson] = useState("");
  const [projectJsonDraftSource, setProjectJsonDraftSource] =
    useState<ProjectJsonDraftSource>({ kind: "empty" });
  const [projectMessage, setProjectMessage] = useState<string | undefined>();
  const [projectMessageTone, setProjectMessageTone] = useState<
    "info" | "error"
  >("info");
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
        onChange: setDerivedGeometry
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
  const addTargetBodyOptions = useMemo(
    () =>
      createAddTargetBodyOptions(
        projectStructure.bodies,
        projectStructure.features,
        selectedBody?.id
      ),
    [projectStructure.bodies, projectStructure.features, selectedBody?.id]
  );
  const cutTargetBodyOptions = useMemo(
    () =>
      createCutTargetBodyOptions(
        projectStructure.bodies,
        projectStructure.features,
        selectedBody?.id
      ),
    [projectStructure.bodies, projectStructure.features, selectedBody?.id]
  );
  const holeTargetBodyOptions = useMemo(
    () =>
      createHoleTargetBodyOptions(
        projectStructure.bodies,
        projectStructure.features,
        selectedBody?.id
      ),
    [projectStructure.bodies, projectStructure.features, selectedBody?.id]
  );
  const selectedFeature = selectedBody
    ? projectStructure.features.find(
        (feature) => feature.id === selectedBody.featureId
      )
    : undefined;
  const selectedBodyGeneratedReferences =
    selectedFeature?.kind === "extrude"
      ? readBodyGeneratedReferences(selectedBody?.id)
      : {};
  const selectedGeneratedReferenceMeasurements =
    selectedFeature?.kind === "extrude"
      ? readGeneratedReferenceMeasurements(
          selectedBodyGeneratedReferences.references
        )
      : undefined;
  const selectedBodyMeasurements = selectedBody
    ? readBodyMeasurements(selectedBody.id)
    : {};
  const selectedBodyTopology =
    selectedBody !== undefined
      ? readBodyTopology(selectedBody.id, derivedExactMetadata)
      : {};
  const namedReferences = readNamedReferences();
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
  const transactionHistory = readTransactionHistory();
  const parameters = readParameters();
  const sketchDimensionsBySketchId = readSketchDimensionsBySketchId(sketches);
  const sketchEvaluationsBySketchId = readSketchEvaluationsBySketchId(sketches);
  const selectedGeneratedReferenceState = getGeneratedReferenceSelectionState(
    selectedGeneratedReference,
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
  const selectedSelectionReferenceCandidates =
    selectedGeneratedReferenceCandidates ?? selectedBodyReferenceCandidates;
  const modelingSelectionContext = createModelingSelectionContext({
    focusedSketchId,
    namedReferences,
    referenceCandidatesByStableId,
    selectedBody,
    selectedBodyGeneratedReferences: selectedBodyGeneratedReferences.references,
    selectedBodyReferenceCandidates,
    selectedFeature,
    selectedGeneratedReferenceCandidates,
    selectedGeneratedReferenceState,
    selectedId,
    selectedSketchContext,
    sketchDimensionsBySketchId,
    sketchEvaluationsBySketchId,
    sketches
  });
  const modelingActions = deriveModelingActions({
    context: modelingSelectionContext,
    bodies: projectStructure.bodies,
    features: projectStructure.features,
    preferredBodyId: selectedBody?.id
  });
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
    selectedGeneratedReferenceState.status === "selected" ||
    selectedGeneratedReferenceState.status === "stale"
      ? selectedGeneratedReferenceState.selection.bodyId
      : (selectedObject?.id ?? selectedBody?.id ?? selectedId);
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
  const currentProject = exportCadProject(engine);
  const projectJsonWorkflow = createProjectJsonWorkflowState({
    currentProject,
    draftJson: projectJson,
    draftSource: projectJsonDraftSource
  });
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
  const currentProjectSummary = projectJsonWorkflow.current.summary;
  const utilityPanels: readonly {
    readonly id: UtilityPanelId;
    readonly label: string;
    readonly count?: number | string;
  }[] = [
    { id: "sketches", label: "Sketches", count: sketches.length },
    { id: "history", label: "Log", count: transactionHistory.length },
    {
      id: "project",
      label: "File",
      count: formatSchemaBadge(currentProjectSummary.schemaVersion)
    }
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
    if (!derivedGeometryEnabled) {
      return;
    }

    getDerivedGeometryService().reconcile(derivedGeometrySources);
    getDerivedExactMetadataService().reconcile(derivedGeometrySources);
  }, [
    derivedGeometrySources,
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
  }

  function selectObject(objectId: string | undefined) {
    setSelectedId(objectId);
    setSelectedGeneratedReference(undefined);
  }

  function selectViewportPick(pickedRenderId: string | undefined) {
    const intent = resolveViewportPickIntent({
      pickedRenderId,
      bodies: projectStructure.bodies,
      objects: sceneObjects,
      readReferenceCandidates: readSelectionReferenceCandidates
    });

    setSelectedId(intent.selectedId);
    setSelectedGeneratedReference(undefined);
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
      return response;
    } finally {
      setCommandPending(false);
    }
  }

  async function createBox() {
    const offset = document.objects.size * 2.8;
    await commitOps(
      [
        buildCreateBoxOp({
          ...quickBoxForm,
          translationX: offset
        })
      ],
      (response) => response.createdIds[0]
    );
  }

  async function createCylinder() {
    const offset = document.objects.size * 2.8;
    await commitOps(
      [
        buildCreateCylinderOp({
          ...quickCylinderForm,
          translationX: offset
        })
      ],
      (response) => response.createdIds[0]
    );
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

  async function createSketch(form: SketchCreateForm) {
    const response = await commitOps([buildCreateSketchOp(form)], () => null);
    const sketchId = response?.ok
      ? (response.createdSketchIds?.[0] ?? form.id.trim())
      : undefined;

    if (sketchId) {
      setSelectedGeneratedReference(undefined);
      setFocusedSketchId(sketchId);
      setSelectedSketchContext({ sketchId });
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
    const response = await commitOps(
      [buildCreateSketchOnFaceOp(form)],
      () => null
    );
    const sketchId = response?.ok
      ? (response.createdSketchIds?.[0] ?? form.id.trim())
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
    await commitOps(
      [buildFeatureHoleOp(sketchId, circleEntityId, form)],
      (response) => response.createdBodyIds?.[0] ?? selectedId
    );
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

  async function nameGeneratedReference(
    name: string,
    target: SelectedGeneratedReference
  ) {
    await commitOps(
      [buildNameGeneratedReferenceOp(name, target.bodyId, target.stableId)],
      () => selectedId
    );
  }

  async function deleteNamedReference(name: string) {
    await commitOps([buildDeleteNamedReferenceOp(name)], () => selectedId);
  }

  function inspectNamedReference(name: string) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "reference.resolveNamed", name }
    });

    if (!response.ok || response.query !== "reference.resolveNamed") {
      setCommandError(
        !response.ok ? response.error.message : "Named reference unavailable."
      );
      return;
    }

    setCommandError(undefined);
    setSelectedId(response.reference.bodyId);
    setSelectedGeneratedReference(
      createSelectedGeneratedReference(response.reference)
    );
  }

  function selectGeneratedReference(reference: CadGeneratedReference) {
    setSelectedId(reference.bodyId);
    setSelectedGeneratedReference(createSelectedGeneratedReference(reference));
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
      setCommandNotice("Undo applied.");
    }
  }

  function redo() {
    const result = engine.redo();
    syncDocument(result?.transaction.diff.created[0]?.id ?? selectedId);
    if (result) {
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
              Worker running
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
              feature={selectedFeature}
              generatedReferences={selectedBodyGeneratedReferences.references}
              generatedReferencesError={selectedBodyGeneratedReferences.error}
              generatedReferenceMeasurements={
                selectedGeneratedReferenceMeasurements
              }
              namedReferences={namedReferences}
              namedReferenceCandidatesByName={namedReferenceCandidatesByName}
              object={selectedObject}
              referenceCandidatesByStableId={referenceCandidatesByStableId}
              selectedGeneratedReference={selectedGeneratedReference}
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
              onInspectNamedReference={inspectNamedReference}
              onSelectGeneratedReference={(selection) => {
                setSelectedGeneratedReference(selection);
              }}
              onUpdateExtrude={(featureId, depth, side) =>
                void updateAuthoredExtrude(featureId, depth, side)
              }
            />
          </div>
        </aside>

        <ViewportCanvas
          primitives={renderScene.primitives}
          meshes={renderScene.meshes}
          selectedId={selectedViewportRenderId}
          onSelect={selectViewportPick}
        />

        <div className="right-rail" aria-label="Context and advanced tools">
          <ModelingActionsPanel
            actions={modelingActions}
            addTargetBodies={addTargetBodyOptions}
            context={modelingSelectionContext}
            cutTargetBodies={cutTargetBodyOptions}
            disabled={commandPending}
            holeTargetBodies={holeTargetBodyOptions}
            namedReferences={namedReferences}
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

          <details className="advanced-tools-drawer">
            <summary>
              <span>Advanced tools</span>
              <small>Sketches, file, log</small>
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
                    {panel.count !== undefined && <small>{panel.count}</small>}
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
                    addTargetBodies={addTargetBodyOptions}
                    cutTargetBodies={cutTargetBodyOptions}
                    holeTargetBodies={holeTargetBodyOptions}
                    displayStatuses={sketchDisplayState.statuses}
                    focusedSketchId={focusedSketchId}
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

                <div
                  id="utility-panel-project"
                  role="tabpanel"
                  aria-labelledby="utility-tab-project"
                  className="utility-panel"
                  hidden={activeUtilityPanel !== "project"}
                >
                  <ProjectJsonPanel
                    disabled={commandPending}
                    exportReadiness={projectExportReadiness}
                    visualizationDownloadAvailable={
                      projectStorageCapabilities.jsonDownloadAvailable
                    }
                    visualizationExport={visualizationMeshExportStatus}
                    projectJson={projectJson}
                    storageCapabilities={projectStorageCapabilities}
                    workflow={projectJsonWorkflow}
                    message={projectMessage}
                    messageTone={projectMessageTone}
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
                    onExport={exportProjectJson}
                    onDownload={downloadProjectJson}
                    onDownloadVisualization={downloadVisualizationMeshExport}
                    onImport={importProjectJson}
                  />
                </div>
              </div>
            </section>
          </details>
        </div>
      </section>
    </main>
  );
}
