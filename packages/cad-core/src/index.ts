import type {
  CadActorMetadata,
  BoxDimensions,
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadBatchValidationResult,
  CadAxisAlignedBounds,
  BodyExtentSnapshot,
  CadBodyRef,
  CadBodySnapshot,
  CadFeatureRef,
  CadFeatureSummary,
  CadGeneratedFaceReference,
  CadGeneratedEntityKind,
  CadNamedReferenceRef,
  CadObjectSnapshot,
  CadObjectRef,
  CadOp,
  CadObjectModelSource,
  CadParameterRef,
  CadParameterSnapshot,
  CadPartSnapshot,
  CadPrimitiveFeatureSource,
  CadPrimitiveFeatureSummary,
  CadQueryError,
  CadQueryKind,
  CadQueryRequest,
  CadQueryResponse,
  CadSketchEntityRef,
  CadSketchConstraintRef,
  CadSketchDimensionRef,
  CadSketchRef,
  CadTransactionStatus,
  ConeDimensions,
  CylinderDimensions,
  DocumentSemanticDiff,
  DocumentUnitUpdateMode,
  DocumentUnits,
  ObjectMeasurementsSnapshot,
  ProjectExtentsWarning,
  ObjectId,
  PartId,
  SemanticDiff,
  SketchEntityId,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchId,
  SketchAttachmentSnapshot,
  SketchPlane,
  SketchPointTarget,
  SketchSemanticDiff,
  SketchSnapshot,
  SphereDimensions,
  TorusDimensions,
  BodyId,
  CadTransactionAuditMetadata,
  ExtrudeFeatureSnapshot,
  FeatureExtrudeOperationMode,
  FeatureId,
  FeatureExtrudeProfileKind,
  FeatureExtrudeSide,
  FeatureSemanticDiff,
  NamedGeneratedReferenceEntry,
  NamedGeneratedReferenceSnapshot,
  NamedReferenceName,
  ParameterId,
  ParameterSemanticDiff,
  ReferenceSemanticDiff,
  TransactionId,
  SketchConstraintId,
  SketchConstraintKind,
  SketchConstraintSemanticDiff,
  SketchConstraintSnapshot,
  SketchDimensionId,
  SketchDimensionSnapshot,
  SketchDimensionTarget,
  SketchDimensionValueSource,
  SketchDimensionSemanticDiff,
  Transform,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

import {
  createTransactionHistoryEntries,
  parseTransactionNumber,
  sortTransactions
} from "./transactionHistory";
import {
  createBodyGeneratedReferences,
  type GeneratedReferenceValidationError,
  resolveGeneratedReference,
  validateGeneratedReference
} from "./generatedReferences";
import { createBodyMeasurements } from "./bodyMeasurements";
import { createGeneratedReferenceMeasurements } from "./generatedReferenceMeasurements";
import { createProjectHealth } from "./projectHealth";
import {
  applySketchConstraintValue,
  applySketchDimensionValue,
  createSketchEvaluationQueryResponse,
  evaluateSketchDimension,
  getLineLength,
  getSketchDimensionTargetValue,
  isSupportedSketchDimensionTarget,
  sketchConstraintMatchesLine,
  type SketchSolverApplyIssue,
  type SketchSolverDocument
} from "./sketchSolver";

export type {
  CadActorMetadata,
  BoxDimensions,
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadBatchValidationResult,
  CadAxisAlignedBounds,
  CadBodyRef,
  CadBodySnapshot,
  CadAttachedSketchHealth,
  CadAuthoredExtrudeHealth,
  CadDependencyHealthIssue,
  CadDependencyHealthIssueCode,
  CadDependencyHealthStatus,
  CadSketchDimensionHealth,
  CadFeatureRef,
  CadFeatureSummary,
  CadGeneratedBodyReference,
  CadGeneratedCurveType,
  CadGeneratedEdgeReference,
  CadGeneratedEntityKind,
  CadGeneratedExtrudeEdgeRole,
  CadGeneratedExtrudeFaceRole,
  CadGeneratedExtrudeVertexRole,
  CadGeneratedFaceReference,
  CadGeneratedReference,
  CadGeneratedReferenceEligibleOperation,
  CadGeneratedReferenceProfileSignature,
  CadGeneratedReferenceSignature,
  CadGeneratedVertexReference,
  CadNamedReferenceRef,
  CadParameterRef,
  CadParameterSnapshot,
  CadObjectSnapshot,
  CadObjectRef,
  CadOperationSummary,
  CadOp,
  CadObjectModelSource,
  CadPartSnapshot,
  CadPrimitiveFeatureSource,
  CadPrimitiveFeatureSummary,
  CadQueryRequest,
  CadQueryError,
  CadQueryResponse,
  CadSemanticDiffSummary,
  CadSketchDimensionRef,
  CadSketchConstraintRef,
  CadSketchEntityRef,
  CadSketchRef,
  CadTransactionHistoryEntry,
  CadTransactionStatus,
  CadTransactionAuditMetadata,
  NamedGeneratedReferenceEntry,
  CadNamedReferenceHealth,
  NamedGeneratedReferenceSnapshot,
  NamedReferenceName,
  ParameterId,
  ParameterSemanticDiff,
  ReferenceSemanticDiff,
  SketchDimensionEntry,
  SketchConstraintEntry,
  SketchConstraintId,
  SketchConstraintIssue,
  SketchConstraintKind,
  SketchConstraintSnapshot,
  SketchConstraintSemanticDiff,
  SketchDimensionId,
  SketchDimensionIssue,
  SketchDimensionSnapshot,
  SketchDimensionTarget,
  SketchDimensionValueSource,
  SketchDimensionSemanticDiff,
  ExtrudeFeatureSnapshot,
  FeatureId,
  FeatureExtrudeOperationMode,
  FeatureExtrudeProfileKind,
  FeatureExtrudeSide,
  FeatureSemanticDiff,
  ConeDimensions,
  CylinderDimensions,
  DocumentSemanticDiff,
  DocumentUnitUpdateMode,
  DocumentUnits,
  ObjectMeasurementsSnapshot,
  ObjectId,
  PartId,
  SemanticDiff,
  SketchEntityId,
  SketchEntityKind,
  SketchEntitySnapshot,
  SketchId,
  SketchAttachmentSnapshot,
  SketchGeneratedFaceAttachmentSnapshot,
  SketchPlane,
  SketchPointTarget,
  SketchSemanticDiff,
  SketchSnapshot,
  SphereDimensions,
  TorusDimensions,
  BodyId,
  TransactionId,
  Transform,
  Vec2,
  Vec3
} from "@web-cad/cad-protocol";

export type { BodyMeasurementsSnapshot } from "@web-cad/cad-protocol";

export interface PackageInfo {
  readonly name: string;
  readonly status: "ready";
}

export interface BoxObject {
  readonly id: ObjectId;
  readonly kind: "box";
  readonly name?: string;
  readonly dimensions: BoxDimensions;
  readonly transform: Transform;
}

export interface CylinderObject {
  readonly id: ObjectId;
  readonly kind: "cylinder";
  readonly name?: string;
  readonly dimensions: CylinderDimensions;
  readonly transform: Transform;
}

export interface SphereObject {
  readonly id: ObjectId;
  readonly kind: "sphere";
  readonly name?: string;
  readonly dimensions: SphereDimensions;
  readonly transform: Transform;
}

export interface ConeObject {
  readonly id: ObjectId;
  readonly kind: "cone";
  readonly name?: string;
  readonly dimensions: ConeDimensions;
  readonly transform: Transform;
}

export interface TorusObject {
  readonly id: ObjectId;
  readonly kind: "torus";
  readonly name?: string;
  readonly dimensions: TorusDimensions;
  readonly transform: Transform;
}

export type SceneObject =
  | BoxObject
  | CylinderObject
  | SphereObject
  | ConeObject
  | TorusObject;

export type SketchEntity = SketchEntitySnapshot;

export interface Sketch {
  readonly id: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
  readonly attachment?: SketchAttachmentSnapshot;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntity>;
}

export type CadParameter = CadParameterSnapshot;

export type SketchDimension = SketchDimensionSnapshot;

export type SketchConstraint = SketchConstraintSnapshot;

export type Feature = ExtrudeFeature;

export interface ExtrudeFeature {
  readonly id: FeatureId;
  readonly kind: "extrude";
  readonly name?: string;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureExtrudeProfileKind;
  readonly depth: number;
  readonly side: FeatureExtrudeSide;
  readonly operationMode: FeatureExtrudeOperationMode;
  readonly targetBodyId?: BodyId;
  readonly bodyId: BodyId;
}

export interface CadDocument {
  readonly objects: ReadonlyMap<ObjectId, SceneObject>;
  readonly sketches: ReadonlyMap<SketchId, Sketch>;
  readonly parameters: ReadonlyMap<ParameterId, CadParameter>;
  readonly sketchDimensions: ReadonlyMap<SketchDimensionId, SketchDimension>;
  readonly sketchConstraints: ReadonlyMap<SketchConstraintId, SketchConstraint>;
  readonly features: ReadonlyMap<FeatureId, Feature>;
  readonly namedReferences: ReadonlyMap<
    NamedReferenceName,
    NamedGeneratedReferenceSnapshot
  >;
  readonly units: DocumentUnits;
}

export interface Transaction {
  readonly id: TransactionId;
  readonly ops: readonly CadOp[];
  readonly status: CadTransactionStatus;
  readonly diff: SemanticDiff;
  readonly actor?: CadActorMetadata;
  readonly audit?: CadTransactionAuditMetadata;
}

export interface ApplyResult {
  readonly transaction: Transaction;
  readonly document: CadDocument;
}

export interface CadEngineOptions {
  readonly nextObjectNumber?: number;
  readonly nextSketchNumber?: number;
  readonly nextSketchEntityNumber?: number;
  readonly nextParameterNumber?: number;
  readonly nextSketchDimensionNumber?: number;
  readonly nextSketchConstraintNumber?: number;
  readonly nextFeatureNumber?: number;
  readonly nextBodyNumber?: number;
}

export interface CadExecutionOptions {
  readonly actor?: CadActorMetadata;
  readonly audit?: CadTransactionAuditMetadata;
}

export interface CadDocumentSnapshot {
  readonly units: DocumentUnits;
  readonly objects: readonly SceneObject[];
  readonly sketches: readonly SketchSnapshot[];
  readonly parameters: readonly CadParameterSnapshot[];
  readonly sketchDimensions: readonly SketchDimensionSnapshot[];
  readonly sketchConstraints: readonly SketchConstraintSnapshot[];
  readonly features: readonly ExtrudeFeatureSnapshot[];
  readonly namedReferences: readonly NamedGeneratedReferenceSnapshot[];
  readonly nextObjectNumber: number;
  readonly nextSketchNumber: number;
  readonly nextSketchEntityNumber: number;
  readonly nextParameterNumber: number;
  readonly nextSketchDimensionNumber: number;
  readonly nextSketchConstraintNumber: number;
  readonly nextFeatureNumber: number;
  readonly nextBodyNumber: number;
}

export interface CadWorkerRequest {
  readonly id: string;
  readonly batch: CadBatch;
  readonly document: CadDocumentSnapshot;
}

export interface CadWorkerResponse {
  readonly id: string;
  readonly response: CadBatchResponse;
}

export interface CadCommandWorker {
  execute(request: CadWorkerRequest): Promise<CadWorkerResponse>;
}

export interface SnapshotCadCommandWorkerOptions {
  readonly delayMs?: number;
}

export type MockCadCommandWorkerOptions = SnapshotCadCommandWorkerOptions;

export const CAD_PROJECT_FORMAT_VERSION_V1 = "web-cad.project.v1";
export const CAD_PROJECT_FORMAT_VERSION_V2 = "web-cad.project.v2";
export const CAD_PROJECT_FORMAT_VERSION_V3 = "web-cad.project.v3";
export const CAD_PROJECT_FORMAT_VERSION_V4 = "web-cad.project.v4";
export const CAD_PROJECT_FORMAT_VERSION_V5 = "web-cad.project.v5";
export const CAD_PROJECT_FORMAT_VERSION_V6 = "web-cad.project.v6";
export const CAD_PROJECT_FORMAT_VERSION_V7 = "web-cad.project.v7";
export const CAD_PROJECT_FORMAT_VERSION_V8 = "web-cad.project.v8";
export const CAD_PROJECT_FORMAT_VERSION_V9 = "web-cad.project.v9";
export const CAD_PROJECT_FORMAT_VERSION_V10 = "web-cad.project.v10";
export const CURRENT_CAD_PROJECT_FORMAT_VERSION = "web-cad.project.v11";

export type CadProjectFormatVersion =
  | typeof CAD_PROJECT_FORMAT_VERSION_V1
  | typeof CAD_PROJECT_FORMAT_VERSION_V2
  | typeof CAD_PROJECT_FORMAT_VERSION_V3
  | typeof CAD_PROJECT_FORMAT_VERSION_V4
  | typeof CAD_PROJECT_FORMAT_VERSION_V5
  | typeof CAD_PROJECT_FORMAT_VERSION_V6
  | typeof CAD_PROJECT_FORMAT_VERSION_V7
  | typeof CAD_PROJECT_FORMAT_VERSION_V8
  | typeof CAD_PROJECT_FORMAT_VERSION_V9
  | typeof CAD_PROJECT_FORMAT_VERSION_V10
  | typeof CURRENT_CAD_PROJECT_FORMAT_VERSION;

export type CadProjectImportErrorCode =
  | "INVALID_JSON"
  | "INVALID_PROJECT"
  | "UNSUPPORTED_PROJECT_VERSION"
  | "INVALID_DOCUMENT"
  | "INVALID_UNITS"
  | "INVALID_OBJECT"
  | "INVALID_OBJECT_NAME"
  | "INVALID_SKETCH"
  | "INVALID_SKETCH_NAME"
  | "INVALID_SKETCH_ENTITY"
  | "INVALID_PARAMETER"
  | "INVALID_SKETCH_DIMENSION"
  | "INVALID_SKETCH_CONSTRAINT"
  | "INVALID_FEATURE"
  | "INVALID_NAMED_REFERENCE"
  | "INVALID_DIMENSIONS"
  | "INVALID_TRANSFORM"
  | "INVALID_TRANSACTION"
  | "INVALID_TRANSACTION_HISTORY";

export interface CadProjectImportIssue {
  readonly code: CadProjectImportErrorCode;
  readonly path: string;
  readonly message: string;
}

export class CadProjectImportError extends Error {
  readonly issues: readonly CadProjectImportIssue[];

  constructor(issues: readonly CadProjectImportIssue[]) {
    super(formatCadProjectImportIssues(issues));
    this.name = "CadProjectImportError";
    this.issues = issues;
  }
}

export interface CadProject {
  readonly schemaVersion: CadProjectFormatVersion;
  readonly document: CadDocumentSnapshot;
  readonly history: readonly Transaction[];
  readonly redoStack: readonly Transaction[];
}

interface TransactionEntry {
  transaction: Transaction;
  before: CadDocument;
  after: CadDocument;
}

interface OperationRunResult {
  readonly document: CadDocument;
  readonly diff: SemanticDiff;
  readonly nextObjectNumber: number;
  readonly nextSketchNumber: number;
  readonly nextSketchEntityNumber: number;
  readonly nextParameterNumber: number;
  readonly nextSketchDimensionNumber: number;
  readonly nextSketchConstraintNumber: number;
  readonly nextFeatureNumber: number;
  readonly nextBodyNumber: number;
}

export const corePackage: PackageInfo = {
  name: "@web-cad/cad-core",
  status: "ready"
};

export const DEFAULT_DOCUMENT_UNITS: DocumentUnits = "mm";
export const DEFAULT_PART_ID: PartId = "part:default";
export const DEFAULT_PART_NAME = "Default Part";

export function createDefaultTransform(): Transform {
  return {
    translation: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  };
}

export function createCadDocument(
  objects: Iterable<readonly [ObjectId, SceneObject]> = [],
  units: DocumentUnits = DEFAULT_DOCUMENT_UNITS,
  sketches: Iterable<readonly [SketchId, Sketch]> = [],
  parameters: Iterable<readonly [ParameterId, CadParameter]> = [],
  sketchDimensions: Iterable<
    readonly [SketchDimensionId, SketchDimension]
  > = [],
  sketchConstraints: Iterable<
    readonly [SketchConstraintId, SketchConstraint]
  > = [],
  features: Iterable<readonly [FeatureId, Feature]> = [],
  namedReferences: Iterable<
    readonly [NamedReferenceName, NamedGeneratedReferenceSnapshot]
  > = []
): CadDocument {
  return {
    objects: new Map(objects),
    sketches: new Map(sketches),
    parameters: new Map(parameters),
    sketchDimensions: new Map(sketchDimensions),
    sketchConstraints: new Map(sketchConstraints),
    features: new Map(features),
    namedReferences: new Map(namedReferences),
    units
  };
}

export class CadEngine {
  #document: CadDocument;
  #history: TransactionEntry[] = [];
  #redoStack: TransactionEntry[] = [];
  #nextObjectNumber = 1;
  #nextSketchNumber = 1;
  #nextSketchEntityNumber = 1;
  #nextParameterNumber = 1;
  #nextSketchDimensionNumber = 1;
  #nextSketchConstraintNumber = 1;
  #nextFeatureNumber = 1;
  #nextBodyNumber = 1;
  #nextTransactionNumber = 1;

  constructor(
    document: CadDocument = createCadDocument(),
    options: CadEngineOptions = {}
  ) {
    this.#document = cloneDocument(document);
    this.#nextObjectNumber =
      options.nextObjectNumber ?? inferNextObjectNumber(document);
    this.#nextSketchNumber =
      options.nextSketchNumber ?? inferNextSketchNumber(document);
    this.#nextSketchEntityNumber =
      options.nextSketchEntityNumber ?? inferNextSketchEntityNumber(document);
    this.#nextParameterNumber =
      options.nextParameterNumber ?? inferNextParameterNumber(document);
    this.#nextSketchDimensionNumber =
      options.nextSketchDimensionNumber ??
      inferNextSketchDimensionNumber(document);
    this.#nextSketchConstraintNumber =
      options.nextSketchConstraintNumber ??
      inferNextSketchConstraintNumber(document);
    this.#nextFeatureNumber =
      options.nextFeatureNumber ?? inferNextFeatureNumber(document);
    this.#nextBodyNumber =
      options.nextBodyNumber ?? inferNextBodyNumber(document);
  }

  getDocument(): CadDocument {
    return cloneDocument(this.#document);
  }

  getTransactions(): readonly Transaction[] {
    return this.#history.map((entry) => entry.transaction);
  }

  getRedoStack(): readonly Transaction[] {
    return this.#redoStack.map((entry) => entry.transaction);
  }

  exportProject(): CadProject {
    return exportCadProject(this);
  }

  loadProject(project: CadProject): void {
    const normalizedProject = normalizeCadProject(project);
    const state = createProjectState(project);

    this.#document = state.document;
    this.#history = state.history;
    this.#redoStack = state.redoStack;
    this.#nextObjectNumber = normalizedProject.document.nextObjectNumber;
    this.#nextSketchNumber = normalizedProject.document.nextSketchNumber;
    this.#nextSketchEntityNumber =
      normalizedProject.document.nextSketchEntityNumber;
    this.#nextParameterNumber = normalizedProject.document.nextParameterNumber;
    this.#nextSketchDimensionNumber =
      normalizedProject.document.nextSketchDimensionNumber;
    this.#nextSketchConstraintNumber =
      normalizedProject.document.nextSketchConstraintNumber;
    this.#nextFeatureNumber = normalizedProject.document.nextFeatureNumber;
    this.#nextBodyNumber = normalizedProject.document.nextBodyNumber;
    this.#nextTransactionNumber = inferNextTransactionNumber([
      ...normalizedProject.history,
      ...normalizedProject.redoStack
    ]);
  }

  static fromProject(project: CadProject): CadEngine {
    const engine = new CadEngine();
    engine.loadProject(project);
    return engine;
  }

  createSnapshot(): CadDocumentSnapshot {
    return createCadDocumentSnapshot(
      this.#document,
      this.#nextObjectNumber,
      this.#nextSketchNumber,
      this.#nextSketchEntityNumber,
      this.#nextParameterNumber,
      this.#nextSketchDimensionNumber,
      this.#nextSketchConstraintNumber,
      this.#nextFeatureNumber,
      this.#nextBodyNumber
    );
  }

  apply(op: CadOp, options: CadExecutionOptions = {}): ApplyResult {
    return this.applyBatch([op], options);
  }

  applyBatch(
    ops: readonly CadOp[],
    options: CadExecutionOptions = {}
  ): ApplyResult {
    const actor = normalizeActorMetadata(options.actor);
    const audit = normalizeAuditMetadata(options.audit, "commit", ops.length);
    const before = cloneDocument(this.#document);
    const run = this.#runOperations(ops);

    const transaction: Transaction = {
      id: this.#createTransactionId(),
      ops: [...ops],
      status: "committed",
      diff: run.diff,
      ...(actor ? { actor } : {}),
      ...(audit ? { audit } : {})
    };

    const entry: TransactionEntry = {
      transaction,
      before,
      after: cloneDocument(run.document)
    };

    this.#document = run.document;
    this.#nextObjectNumber = run.nextObjectNumber;
    this.#nextSketchNumber = run.nextSketchNumber;
    this.#nextSketchEntityNumber = run.nextSketchEntityNumber;
    this.#nextParameterNumber = run.nextParameterNumber;
    this.#nextSketchDimensionNumber = run.nextSketchDimensionNumber;
    this.#nextSketchConstraintNumber = run.nextSketchConstraintNumber;
    this.#nextFeatureNumber = run.nextFeatureNumber;
    this.#nextBodyNumber = run.nextBodyNumber;
    this.#history.push(entry);
    this.#redoStack = [];

    return {
      transaction,
      document: cloneDocument(this.#document)
    };
  }

  executeBatch(batch: CadBatch): CadBatchResponse {
    const validation = this.validateBatch(batch);

    if (!validation.ok) {
      return {
        ok: false,
        mode: getBatchResponseMode(batch),
        error: validation.errors[0],
        errors: validation.errors,
        createdIds: [],
        modifiedIds: [],
        deletedIds: [],
        warnings: validation.warnings
      };
    }

    const run = this.#runOperations(batch.ops);
    const diffIds = toDiffIds(run.diff);
    const audit = normalizeAuditMetadata(
      batch.audit,
      batch.mode,
      batch.ops.length
    );

    if (batch.mode === "dryRun") {
      return {
        ok: true,
        mode: batch.mode,
        ...diffIds,
        warnings: validation.warnings,
        ...(audit ? { audit } : {})
      };
    }

    const actor = normalizeActorMetadata(batch.actor);
    const result = this.applyBatch(batch.ops, { actor, audit });

    return {
      ok: true,
      mode: batch.mode,
      ...diffIds,
      warnings: validation.warnings,
      transactionId: result.transaction.id,
      ...(result.transaction.actor ? { actor: result.transaction.actor } : {}),
      ...(result.transaction.audit ? { audit: result.transaction.audit } : {})
    };
  }

  executeQuery(request: CadQueryRequest): CadQueryResponse {
    const requestError = validateQueryRequestEnvelope(request);

    if (requestError) {
      return requestError;
    }

    switch (request.query.query) {
      case "parameter.list": {
        const parameters = [...this.#document.parameters.values()].map(
          cloneParameterSnapshot
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          parameterCount: parameters.length,
          parameters
        };
      }

      case "parameter.get": {
        const parameter = this.#document.parameters.get(request.query.id);

        if (!parameter) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "PARAMETER_NOT_FOUND",
              message: `Parameter does not exist: ${request.query.id}`,
              parameterId: request.query.id
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          parameter: cloneParameterSnapshot(parameter)
        };
      }

      case "project.summary": {
        const objects = [...this.#document.objects.values()].map(
          createCadObjectSnapshot
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          units: this.#document.units,
          objectCount: objects.length,
          objects
        };
      }

      case "project.features": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          featureCount: structure.features.length,
          features: structure.features
        };
      }

      case "project.structure": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          partCount: structure.parts.length,
          featureCount: structure.features.length,
          bodyCount: structure.bodies.length,
          parts: structure.parts,
          features: structure.features,
          bodies: structure.bodies,
          objectSources: structure.objectSources
        };
      }

      case "project.health": {
        const structure = createProjectStructure(
          this.#document,
          this.#history.map((entry) => entry.transaction)
        );

        return createProjectHealth({
          document: this.#document,
          cadOpsVersion: request.version,
          ownerPartId: DEFAULT_PART_ID,
          bodyExists: (bodyId) =>
            structure.bodies.some((body) => body.id === bodyId)
        });
      }

      case "project.sketches": {
        const sketches = [...this.#document.sketches.values()].map(
          createSketchSnapshot
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          sketchCount: sketches.length,
          sketches
        };
      }

      case "object.get": {
        const object = this.#document.objects.get(request.query.id);

        if (!object) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "OBJECT_NOT_FOUND",
              message: `Object does not exist: ${request.query.id}`,
              objectId: request.query.id
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          object: createCadObjectSnapshot(object)
        };
      }

      case "object.measurements": {
        const object = this.#document.objects.get(request.query.id);

        if (!object) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "OBJECT_NOT_FOUND",
              message: `Object does not exist: ${request.query.id}`,
              objectId: request.query.id
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          measurements: createObjectMeasurements(object, this.#document.units)
        };
      }

      case "project.extents": {
        const measurements = [...this.#document.objects.values()].map(
          (object) => createObjectMeasurements(object, this.#document.units)
        );
        const bodyExtents = createBodyExtents(
          this.#document,
          this.#document.units,
          this.#history.map((entry) => entry.transaction)
        );
        const allBounds = [
          ...measurements.map((measurement) => measurement.worldBounds),
          ...bodyExtents.bodies.map((body) => body.worldBounds)
        ];

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          units: this.#document.units,
          objectCount: measurements.length,
          bodyCount: bodyExtents.bodies.length,
          ...(allBounds.length > 0
            ? {
                bounds: mergeBounds(allBounds)
              }
            : {}),
          approximateVolume:
            sumApproximateVolumes(measurements) +
            sumBodyExtentVolumes(bodyExtents.bodies),
          objects: measurements.map((measurement) => ({
            id: measurement.id,
            kind: measurement.kind,
            name: measurement.name,
            worldBounds: measurement.worldBounds,
            approximateVolume: measurement.approximateVolume
          })),
          bodies: bodyExtents.bodies,
          warnings: bodyExtents.warnings
        };
      }

      case "sketch.get": {
        const sketch = this.#document.sketches.get(request.query.id);

        if (!sketch) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "SKETCH_NOT_FOUND",
              message: `Sketch does not exist: ${request.query.id}`,
              sketchId: request.query.id
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          sketch: createSketchSnapshot(sketch)
        };
      }

      case "sketch.dimensions": {
        const sketch = this.#document.sketches.get(request.query.sketchId);

        if (!sketch) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "SKETCH_NOT_FOUND",
              message: `Sketch does not exist: ${request.query.sketchId}`,
              sketchId: request.query.sketchId
            }
          };
        }

        const dimensions = [...this.#document.sketchDimensions.values()]
          .filter((dimension) => dimension.sketchId === sketch.id)
          .map((dimension) =>
            evaluateSketchDimension(this.#document, dimension)
          );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          sketchId: sketch.id,
          dimensionCount: dimensions.length,
          dimensions
        };
      }

      case "sketch.evaluation": {
        const sketch = this.#document.sketches.get(request.query.sketchId);

        if (!sketch) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "SKETCH_NOT_FOUND",
              message: `Sketch does not exist: ${request.query.sketchId}`,
              sketchId: request.query.sketchId
            }
          };
        }

        return createSketchEvaluationQueryResponse(
          this.#document,
          sketch,
          request.version
        );
      }

      case "sketch.dimension.get": {
        const dimension = this.#document.sketchDimensions.get(request.query.id);

        if (!dimension) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "SKETCH_DIMENSION_NOT_FOUND",
              message: `Sketch dimension does not exist: ${request.query.id}`,
              sketchDimensionId: request.query.id
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          dimension: evaluateSketchDimension(this.#document, dimension)
        };
      }

      case "body.measurements": {
        const { bodyId } = request.query;
        const measurements = createBodyMeasurements(
          this.#document,
          bodyId,
          this.#document.units,
          DEFAULT_PART_ID
        );

        if (!measurements) {
          const bodyExists = createProjectStructure(
            this.#document,
            this.#history.map((entry) => entry.transaction)
          ).bodies.some((body) => body.id === bodyId);

          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: bodyExists
              ? {
                  code: "UNSUPPORTED_BODY_MEASUREMENTS",
                  message:
                    "Body measurements are currently available only for authored rectangle/circle sketch-extrude bodies.",
                  bodyId
                }
              : {
                  code: "BODY_NOT_FOUND",
                  message: `Body does not exist: ${bodyId}`,
                  bodyId
                }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          measurements
        };
      }

      case "body.generatedReferenceMeasurements": {
        const { bodyId, stableId } = request.query;
        const measurements = createGeneratedReferenceMeasurements({
          document: this.#document,
          bodyId,
          stableId,
          units: this.#document.units,
          ownerPartId: DEFAULT_PART_ID,
          bodyExists: (candidateBodyId) =>
            createProjectStructure(
              this.#document,
              this.#history.map((entry) => entry.transaction)
            ).bodies.some((body) => body.id === candidateBodyId)
        });

        if (!measurements.ok) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: measurements.error
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          bodyId,
          stableId,
          kind: measurements.kind,
          reference: measurements.reference,
          measurements: measurements.measurements
        };
      }

      case "body.generatedReferences": {
        const { bodyId } = request.query;
        const references = createBodyGeneratedReferences(
          this.#document,
          bodyId,
          DEFAULT_PART_ID
        );

        if (!references) {
          const bodyExists = createProjectStructure(
            this.#document,
            this.#history.map((entry) => entry.transaction)
          ).bodies.some((body) => body.id === bodyId);

          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: bodyExists
              ? {
                  code: "UNSUPPORTED_BODY_REFERENCES",
                  message:
                    "Generated references are currently available only for authored sketch-extrude bodies.",
                  bodyId
                }
              : {
                  code: "BODY_NOT_FOUND",
                  message: `Body does not exist: ${bodyId}`,
                  bodyId
                }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          body: references.body,
          faceCount: references.faces.length,
          faces: references.faces,
          edgeCount: references.edges.length,
          edges: references.edges,
          vertexCount: references.vertices.length,
          vertices: references.vertices
        };
      }

      case "body.resolveGeneratedReference": {
        const { bodyId, stableId } = request.query;
        const references = createBodyGeneratedReferences(
          this.#document,
          bodyId,
          DEFAULT_PART_ID
        );

        if (!references) {
          const bodyExists = createProjectStructure(
            this.#document,
            this.#history.map((entry) => entry.transaction)
          ).bodies.some((body) => body.id === bodyId);

          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: bodyExists
              ? {
                  code: "UNSUPPORTED_BODY_REFERENCES",
                  message:
                    "Generated references are currently available only for authored sketch-extrude bodies.",
                  bodyId
                }
              : {
                  code: "BODY_NOT_FOUND",
                  message: `Body does not exist: ${bodyId}`,
                  bodyId
                }
          };
        }

        const resolution = resolveGeneratedReference(references, stableId);

        if (!resolution) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "GENERATED_REFERENCE_NOT_FOUND",
              message: `Generated reference does not exist on body ${bodyId}: ${stableId}`,
              bodyId,
              stableId
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          bodyId,
          stableId,
          kind: resolution.kind,
          reference: resolution.reference
        };
      }

      case "reference.listNamed": {
        const references = [...this.#document.namedReferences.values()].map(
          (reference) =>
            createNamedReferenceEntry(
              this.#document,
              reference,
              this.#history.map((entry) => entry.transaction)
            )
        );

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          referenceCount: references.length,
          references
        };
      }

      case "reference.resolveNamed": {
        const reference = this.#document.namedReferences.get(
          request.query.name
        );

        if (!reference) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: {
              code: "NAMED_REFERENCE_NOT_FOUND",
              message: `Named reference does not exist: ${request.query.name}`,
              referenceName: request.query.name
            }
          };
        }

        const entry = createNamedReferenceEntry(
          this.#document,
          reference,
          this.#history.map((historyEntry) => historyEntry.transaction)
        );

        if (entry.status === "stale" || !entry.reference) {
          return {
            ok: false,
            query: request.query.query,
            cadOpsVersion: request.version,
            error: entry.error ?? {
              code: "GENERATED_REFERENCE_NOT_FOUND",
              message: `Named reference target is stale: ${request.query.name}`,
              bodyId: reference.bodyId,
              stableId: reference.stableId,
              referenceName: request.query.name
            }
          };
        }

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          name: reference.name,
          target: cloneNamedReferenceSnapshot(reference),
          reference: entry.reference
        };
      }

      case "transaction.history": {
        const transactions = createTransactionHistoryEntries([
          ...this.#history.map((entry) => entry.transaction),
          ...this.#redoStack.map((entry) => entry.transaction)
        ]);

        return {
          ok: true,
          query: request.query.query,
          cadOpsVersion: request.version,
          transactionCount: transactions.length,
          transactions
        };
      }

      default:
        return createQueryErrorResponse(request, {
          code: "UNKNOWN_QUERY",
          message: `Unsupported query: ${String(
            (request.query as { readonly query?: unknown }).query
          )}.`
        });
    }
  }

  validateBatch(batch: CadBatch): CadBatchValidationResult {
    try {
      validateBatchEnvelope(batch);
      normalizeActorMetadata(batch.actor);
      normalizeAuditMetadata(batch.audit, batch.mode, batch.ops.length);
      this.#runOperations(batch.ops);
      return {
        ok: true,
        errors: [],
        warnings: []
      };
    } catch (error) {
      if (error instanceof BatchValidationFailure) {
        return {
          ok: false,
          errors: [error.validationError],
          warnings: []
        };
      }

      throw error;
    }
  }

  undo(): ApplyResult | undefined {
    const entry = this.#history.pop();

    if (!entry) {
      return undefined;
    }

    entry.transaction = {
      ...entry.transaction,
      status: "undone"
    };

    this.#document = cloneDocument(entry.before);
    this.#redoStack.push(entry);

    return {
      transaction: entry.transaction,
      document: cloneDocument(this.#document)
    };
  }

  redo(): ApplyResult | undefined {
    const entry = this.#redoStack.pop();

    if (!entry) {
      return undefined;
    }

    entry.transaction = {
      ...entry.transaction,
      status: "committed"
    };

    this.#document = cloneDocument(entry.after);
    this.#history.push(entry);

    return {
      transaction: entry.transaction,
      document: cloneDocument(this.#document)
    };
  }

  #createTransactionId(): TransactionId {
    const id = `txn_${this.#nextTransactionNumber}`;
    this.#nextTransactionNumber += 1;
    return id;
  }

  #runOperations(ops: readonly CadOp[]): OperationRunResult {
    return runOperations(
      ops,
      this.#document,
      this.#nextObjectNumber,
      this.#nextSketchNumber,
      this.#nextSketchEntityNumber,
      this.#nextParameterNumber,
      this.#nextSketchDimensionNumber,
      this.#nextSketchConstraintNumber,
      this.#nextFeatureNumber,
      this.#nextBodyNumber
    );
  }
}

export class SnapshotCadCommandWorker implements CadCommandWorker {
  readonly #delayMs: number;

  constructor(options: SnapshotCadCommandWorkerOptions = {}) {
    this.#delayMs = options.delayMs ?? 0;
  }

  async execute(request: CadWorkerRequest): Promise<CadWorkerResponse> {
    if (this.#delayMs > 0) {
      await delay(this.#delayMs);
    }

    const engine = new CadEngine(
      createCadDocumentFromSnapshot(request.document),
      {
        nextObjectNumber: request.document.nextObjectNumber,
        nextSketchNumber: request.document.nextSketchNumber,
        nextSketchEntityNumber: request.document.nextSketchEntityNumber,
        nextParameterNumber: request.document.nextParameterNumber,
        nextSketchDimensionNumber: request.document.nextSketchDimensionNumber,
        nextFeatureNumber: request.document.nextFeatureNumber,
        nextBodyNumber: request.document.nextBodyNumber
      }
    );

    return {
      id: request.id,
      response: engine.executeBatch(request.batch)
    };
  }
}

export const MockCadCommandWorker = SnapshotCadCommandWorker;

export class AsyncCadCommandExecutor {
  #nextRequestNumber = 1;
  #queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly engine: CadEngine,
    private readonly worker: CadCommandWorker
  ) {}

  async executeBatch(batch: CadBatch): Promise<CadBatchResponse> {
    const response = this.#queue.then(() => this.#executeBatchNow(batch));
    this.#queue = response.then(
      () => undefined,
      () => undefined
    );
    return response;
  }

  async #executeBatchNow(batch: CadBatch): Promise<CadBatchResponse> {
    const workerResponse = await this.worker.execute({
      id: this.#createRequestId(),
      batch,
      document: this.engine.createSnapshot()
    });

    if (!workerResponse.response.ok || batch.mode === "dryRun") {
      return workerResponse.response;
    }

    return this.engine.executeBatch(batch);
  }

  #createRequestId(): string {
    const id = `worker_req_${this.#nextRequestNumber}`;
    this.#nextRequestNumber += 1;
    return id;
  }
}

export function exportCadProject(engine: CadEngine): CadProject {
  return {
    schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
    document: engine.createSnapshot(),
    history: engine.getTransactions(),
    redoStack: engine.getRedoStack()
  };
}

export function exportCadProjectJson(engine: CadEngine): string {
  return JSON.stringify(exportCadProject(engine), null, 2);
}

export function parseCadProjectJson(json: string): CadProject {
  let value: unknown;

  try {
    value = JSON.parse(json);
  } catch {
    throw new CadProjectImportError([
      {
        code: "INVALID_JSON",
        path: "$",
        message: "Project JSON could not be parsed."
      }
    ]);
  }

  return parseCadProject(value);
}

export function importCadProject(project: CadProject): CadEngine {
  return CadEngine.fromProject(project);
}

export function importCadProjectJson(json: string): CadEngine {
  return importCadProject(parseCadProjectJson(json));
}

export function formatCadProjectImportError(error: unknown): string {
  if (error instanceof CadProjectImportError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Invalid project JSON.";
}

type MutableSemanticDiff = {
  created: CadObjectRef[];
  modified: CadObjectRef[];
  deleted: CadObjectRef[];
  document?: MutableDocumentSemanticDiff;
  sketches?: MutableSketchSemanticDiff;
  features?: MutableFeatureSemanticDiff;
  references?: MutableReferenceSemanticDiff;
  parameters?: MutableParameterSemanticDiff;
  sketchDimensions?: MutableSketchDimensionSemanticDiff;
  sketchConstraints?: MutableSketchConstraintSemanticDiff;
};

type MutableDocumentSemanticDiff = {
  units?: {
    before: DocumentUnits;
    after: DocumentUnits;
    mode: DocumentUnitUpdateMode;
    scaleFactor: number;
  };
};

type MutableSketchSemanticDiff = {
  created: CadSketchRef[];
  modified: CadSketchRef[];
  deleted: CadSketchRef[];
  entitiesCreated: CadSketchEntityRef[];
  entitiesModified: CadSketchEntityRef[];
  entitiesDeleted: CadSketchEntityRef[];
};

type MutableFeatureSemanticDiff = {
  created: CadFeatureRef[];
  modified: CadFeatureRef[];
  deleted: CadFeatureRef[];
  bodiesCreated: CadBodyRef[];
  bodiesModified: CadBodyRef[];
  bodiesDeleted: CadBodyRef[];
};

type MutableReferenceSemanticDiff = {
  namedCreated: CadNamedReferenceRef[];
  namedDeleted: CadNamedReferenceRef[];
};

type MutableParameterSemanticDiff = {
  created: CadParameterRef[];
  modified: CadParameterRef[];
  deleted: CadParameterRef[];
};

type MutableSketchDimensionSemanticDiff = {
  created: CadSketchDimensionRef[];
  modified: CadSketchDimensionRef[];
  deleted: CadSketchDimensionRef[];
};

type MutableSketchConstraintSemanticDiff = {
  created: CadSketchConstraintRef[];
  modified: CadSketchConstraintRef[];
  deleted: CadSketchConstraintRef[];
};

type SketchEntityImportRef = {
  readonly sketchId: SketchId;
  readonly kind: SketchEntityKind;
  readonly entity: unknown;
};

interface MutableDocumentState {
  objects: Map<ObjectId, SceneObject>;
  sketches: Map<SketchId, Sketch>;
  parameters: Map<ParameterId, CadParameter>;
  sketchDimensions: Map<SketchDimensionId, SketchDimension>;
  sketchConstraints: Map<SketchConstraintId, SketchConstraint>;
  features: Map<FeatureId, Feature>;
  namedReferences: Map<NamedReferenceName, NamedGeneratedReferenceSnapshot>;
  units: DocumentUnits;
}

function applyOperation(
  op: CadOp,
  state: MutableDocumentState,
  diff: MutableSemanticDiff,
  createObjectId: () => ObjectId,
  createSketchId: () => SketchId,
  createSketchEntityId: () => SketchEntityId,
  createParameterId: () => ParameterId,
  createSketchDimensionId: () => SketchDimensionId,
  createSketchConstraintId: () => SketchConstraintId,
  createFeatureId: () => FeatureId,
  createBodyId: () => BodyId,
  opIndex: number
): void {
  switch (op.op) {
    case "parameter.create": {
      const parameter: CadParameter = {
        id: op.id ?? createParameterId(),
        name: normalizeParameterName(op.name, opIndex, op.id),
        value: validateFiniteParameterValue(op.value, opIndex, "value"),
        ...(op.description !== undefined
          ? {
              description: normalizeOptionalDescription(op.description, opIndex)
            }
          : {})
      };

      addParameter(state.parameters, parameter, diff, opIndex);
      reevaluateParameterDimensions(state, parameter.id, diff, opIndex);
      return;
    }

    case "parameter.update": {
      assertParameterUpdateHasChanges(op, opIndex);
      const existing = getParameterOrThrow(state.parameters, op.id, opIndex);
      const nextDescription =
        op.description !== undefined
          ? normalizeParameterUpdateDescription(op.description, opIndex)
          : existing.description;
      const updated: CadParameter = {
        id: existing.id,
        name: existing.name,
        ...(op.value !== undefined
          ? { value: validateFiniteParameterValue(op.value, opIndex, "value") }
          : { value: existing.value }),
        ...(nextDescription !== undefined
          ? { description: nextDescription }
          : {})
      };

      state.parameters.set(op.id, updated);
      pushParameterModified(diff, parameterRef(updated));
      reevaluateParameterDimensions(state, op.id, diff, opIndex);
      return;
    }

    case "parameter.rename": {
      const existing = getParameterOrThrow(state.parameters, op.id, opIndex);
      const updated: CadParameter = {
        ...existing,
        name: normalizeParameterName(op.name, opIndex, op.id)
      };

      state.parameters.set(op.id, updated);
      pushParameterModified(diff, parameterRef(updated));
      return;
    }

    case "parameter.delete": {
      const existing = getParameterOrThrow(state.parameters, op.id, opIndex);
      assertParameterNotInUse(state.sketchDimensions, op.id, opIndex);
      state.parameters.delete(op.id);
      pushParameterDeleted(diff, parameterRef(existing));
      return;
    }

    case "document.updateUnits": {
      validateDocumentUnits(op.units, opIndex);
      const unitUpdateMode = validateDocumentUnitUpdateMode(op.mode, opIndex);

      if (state.units !== op.units) {
        const previousUnitDiff = diff.document?.units;
        const before = previousUnitDiff?.before ?? state.units;
        const operationScaleFactor =
          unitUpdateMode === "preservePhysicalSize"
            ? getUnitConversionScaleFactor(state.units, op.units)
            : 1;
        const scaleFactor = cleanMeasurementNumber(
          (previousUnitDiff?.scaleFactor ?? 1) * operationScaleFactor
        );
        const diffMode =
          previousUnitDiff?.mode === "preservePhysicalSize" ||
          unitUpdateMode === "preservePhysicalSize"
            ? "preservePhysicalSize"
            : "metadataOnly";

        if (unitUpdateMode === "preservePhysicalSize") {
          scaleDocumentLengthValues(state, operationScaleFactor, diff);
        }

        diff.document = {
          ...diff.document,
          units: {
            before,
            after: op.units,
            mode: diffMode,
            scaleFactor
          }
        };
        state.units = op.units;
      }

      return;
    }

    case "scene.createBox": {
      validateBoxDimensions(op.dimensions, opIndex);

      const object: BoxObject = {
        id: op.id ?? createObjectId(),
        kind: "box",
        name: normalizeOptionalObjectName(op.name, opIndex, op.id),
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(state.objects, object, diff, opIndex);
      return;
    }

    case "scene.createCylinder": {
      validateCylinderDimensions(op.dimensions, opIndex);

      const object: CylinderObject = {
        id: op.id ?? createObjectId(),
        kind: "cylinder",
        name: normalizeOptionalObjectName(op.name, opIndex, op.id),
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(state.objects, object, diff, opIndex);
      return;
    }

    case "scene.createSphere": {
      validateSphereDimensions(op.dimensions, opIndex);

      const object: SphereObject = {
        id: op.id ?? createObjectId(),
        kind: "sphere",
        name: normalizeOptionalObjectName(op.name, opIndex, op.id),
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(state.objects, object, diff, opIndex);
      return;
    }

    case "scene.createCone": {
      validateConeDimensions(op.dimensions, opIndex);

      const object: ConeObject = {
        id: op.id ?? createObjectId(),
        kind: "cone",
        name: normalizeOptionalObjectName(op.name, opIndex, op.id),
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(state.objects, object, diff, opIndex);
      return;
    }

    case "scene.createTorus": {
      validateTorusDimensions(op.dimensions, opIndex);

      const object: TorusObject = {
        id: op.id ?? createObjectId(),
        kind: "torus",
        name: normalizeOptionalObjectName(op.name, opIndex, op.id),
        dimensions: op.dimensions,
        transform: mergeTransform(op.transform)
      };

      addObject(state.objects, object, diff, opIndex);
      return;
    }

    case "scene.deleteObject": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      state.objects.delete(op.id);
      diff.deleted.push(objectRef(existing));
      return;
    }

    case "scene.updateTransform": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      const updated: SceneObject = {
        ...existing,
        transform: mergeTransform(op.transform, existing.transform)
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateBoxDimensions": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      assertObjectKind(existing, "box", opIndex);
      validateBoxDimensions(op.dimensions, opIndex, op.id);

      const updated: BoxObject = {
        ...existing,
        dimensions: op.dimensions
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateCylinderDimensions": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      assertObjectKind(existing, "cylinder", opIndex);
      validateCylinderDimensions(op.dimensions, opIndex, op.id);

      const updated: CylinderObject = {
        ...existing,
        dimensions: op.dimensions
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateSphereDimensions": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      assertObjectKind(existing, "sphere", opIndex);
      validateSphereDimensions(op.dimensions, opIndex, op.id);

      const updated: SphereObject = {
        ...existing,
        dimensions: op.dimensions
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateConeDimensions": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      assertObjectKind(existing, "cone", opIndex);
      validateConeDimensions(op.dimensions, opIndex, op.id);

      const updated: ConeObject = {
        ...existing,
        dimensions: op.dimensions
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.updateTorusDimensions": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      assertObjectKind(existing, "torus", opIndex);
      validateTorusDimensions(op.dimensions, opIndex, op.id);

      const updated: TorusObject = {
        ...existing,
        dimensions: op.dimensions
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "scene.renameObject": {
      const existing = getObjectOrThrow(state.objects, op.id, opIndex);
      const name = normalizeObjectName(op.name, opIndex, op.id);
      const updated: SceneObject = {
        ...existing,
        name
      };

      state.objects.set(op.id, updated);
      diff.modified.push(objectRef(updated));
      return;
    }

    case "sketch.create": {
      const sketch: Sketch = {
        id: op.id ?? createSketchId(),
        name: normalizeSketchName(op.name, opIndex, op.id),
        plane: validateSketchPlane(op.plane, opIndex),
        entities: new Map()
      };

      addSketch(state.sketches, sketch, diff, opIndex);
      return;
    }

    case "sketch.createOnFace": {
      const face = validateSketchAttachmentFace(state, op, opIndex);
      const sketch: Sketch = {
        id: op.id ?? createSketchId(),
        name: normalizeSketchName(op.name, opIndex, op.id),
        plane: createSketchPlaneFromFaceReference(face, opIndex),
        attachment: createSketchFaceAttachment(face),
        entities: new Map()
      };

      addSketch(state.sketches, sketch, diff, opIndex);
      return;
    }

    case "sketch.rename": {
      const existing = getSketchOrThrow(state.sketches, op.id, opIndex);
      const updated: Sketch = {
        ...existing,
        name: normalizeSketchName(op.name, opIndex, op.id)
      };

      state.sketches.set(op.id, updated);
      pushSketchModified(diff, sketchRef(updated));
      return;
    }

    case "sketch.delete": {
      const existing = getSketchOrThrow(state.sketches, op.id, opIndex);
      assertSketchNotInUse(state.features, op.id, opIndex);
      state.sketches.delete(op.id);
      pushSketchDeleted(diff, sketchRef(existing));

      for (const entity of existing.entities.values()) {
        pushSketchEntityDeleted(diff, sketchEntityRef(existing.id, entity));
      }

      for (const dimension of state.sketchDimensions.values()) {
        if (dimension.sketchId !== op.id) {
          continue;
        }

        state.sketchDimensions.delete(dimension.id);
        pushSketchDimensionDeleted(diff, sketchDimensionRef(dimension));
      }

      for (const constraint of state.sketchConstraints.values()) {
        if (constraint.sketchId !== op.id) {
          continue;
        }

        state.sketchConstraints.delete(constraint.id);
        pushSketchConstraintDeleted(diff, sketchConstraintRef(constraint));
      }

      return;
    }

    case "sketch.addPoint": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity: SketchEntity = {
        id: op.id ?? createSketchEntityId(),
        kind: "point",
        point: validateVec2(op.point, opIndex, "point")
      };

      addSketchEntity(state.sketches, sketch, entity, diff, opIndex);
      return;
    }

    case "sketch.addLine": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity: SketchEntity = {
        id: op.id ?? createSketchEntityId(),
        kind: "line",
        start: validateVec2(op.start, opIndex, "start"),
        end: validateVec2(op.end, opIndex, "end")
      };

      addSketchEntity(state.sketches, sketch, entity, diff, opIndex);
      return;
    }

    case "sketch.addRectangle": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity: SketchEntity = {
        id: op.id ?? createSketchEntityId(),
        kind: "rectangle",
        center: validateVec2(op.center, opIndex, "center"),
        width: validatePositiveSketchMeasurement(op.width, opIndex, "width"),
        height: validatePositiveSketchMeasurement(op.height, opIndex, "height")
      };

      addSketchEntity(state.sketches, sketch, entity, diff, opIndex);
      return;
    }

    case "sketch.addCircle": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity: SketchEntity = {
        id: op.id ?? createSketchEntityId(),
        kind: "circle",
        center: validateVec2(op.center, opIndex, "center"),
        radius: validatePositiveSketchMeasurement(op.radius, opIndex, "radius")
      };

      addSketchEntity(state.sketches, sketch, entity, diff, opIndex);
      return;
    }

    case "sketch.updateEntity": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const existing = sketch.entities.get(op.entity.id);

      if (!existing) {
        throwSketchEntityNotFound(op.sketchId, op.entity.id, opIndex);
      }

      const entity = normalizeSketchEntity(op.entity, opIndex);
      assertSketchDimensionTargetsStillValid(
        state.sketchDimensions,
        op.sketchId,
        entity,
        opIndex
      );
      assertSketchConstraintTargetsStillValid(
        state.sketchConstraints,
        op.sketchId,
        entity,
        opIndex
      );
      const constrainedEntity = applySketchConstraintsToEntity(
        state,
        op.sketchId,
        entity,
        opIndex
      );
      syncDimensionsForSketchEntityUpdate(
        state,
        op.sketchId,
        existing,
        constrainedEntity,
        diff,
        opIndex
      );
      updateSketchEntityAndDependents(
        state,
        sketch,
        constrainedEntity,
        diff,
        opIndex
      );

      return;
    }

    case "sketch.deleteEntity": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const existing = sketch.entities.get(op.entityId);

      if (!existing) {
        throwSketchEntityNotFound(op.sketchId, op.entityId, opIndex);
      }

      assertSketchEntityNotInUse(
        state.features,
        op.sketchId,
        op.entityId,
        opIndex
      );
      const entities = new Map(sketch.entities);
      entities.delete(op.entityId);
      state.sketches.set(sketch.id, { ...sketch, entities });
      pushSketchEntityDeleted(diff, sketchEntityRef(sketch.id, existing));

      for (const dimension of state.sketchDimensions.values()) {
        if (
          dimension.sketchId !== op.sketchId ||
          dimension.entityId !== op.entityId
        ) {
          continue;
        }

        state.sketchDimensions.delete(dimension.id);
        pushSketchDimensionDeleted(diff, sketchDimensionRef(dimension));
      }
      for (const constraint of state.sketchConstraints.values()) {
        if (
          constraint.sketchId !== op.sketchId ||
          constraint.entityId !== op.entityId
        ) {
          continue;
        }

        state.sketchConstraints.delete(constraint.id);
        pushSketchConstraintDeleted(diff, sketchConstraintRef(constraint));
      }
      return;
    }

    case "sketch.dimension.create": {
      const target = validateSketchDimensionTarget(state, op, opIndex);
      const valueSource = createSketchDimensionValueSource(op, opIndex);
      const dimension: SketchDimension = {
        id: op.id ?? createSketchDimensionId(),
        name: normalizeSketchDimensionName(op.name, opIndex, op.id),
        sketchId: op.sketchId,
        entityId: op.entityId,
        target,
        valueSource
      };

      addSketchDimension(state.sketchDimensions, dimension, diff, opIndex);
      applySketchDimensionToEntity(state, dimension, diff, opIndex);
      return;
    }

    case "sketch.dimension.update": {
      const existing = getSketchDimensionOrThrow(
        state.sketchDimensions,
        op.id,
        opIndex
      );
      const valueSource = createSketchDimensionValueSource(op, opIndex);
      const updated: SketchDimension = {
        ...existing,
        valueSource
      };

      state.sketchDimensions.set(op.id, updated);
      pushSketchDimensionModified(diff, sketchDimensionRef(updated));
      applySketchDimensionToEntity(state, updated, diff, opIndex);
      return;
    }

    case "sketch.dimension.rename": {
      const existing = getSketchDimensionOrThrow(
        state.sketchDimensions,
        op.id,
        opIndex
      );
      const updated: SketchDimension = {
        ...existing,
        name: normalizeSketchDimensionName(op.name, opIndex, op.id)
      };

      state.sketchDimensions.set(op.id, updated);
      pushSketchDimensionModified(diff, sketchDimensionRef(updated));
      return;
    }

    case "sketch.dimension.delete": {
      const existing = getSketchDimensionOrThrow(
        state.sketchDimensions,
        op.id,
        opIndex
      );

      state.sketchDimensions.delete(op.id);
      pushSketchDimensionDeleted(diff, sketchDimensionRef(existing));
      return;
    }

    case "sketch.constraint.create": {
      const constraint = createSketchConstraintFromOp(
        state,
        op,
        op.id ?? createSketchConstraintId(),
        opIndex
      );

      addSketchConstraint(state.sketchConstraints, constraint, diff, opIndex);
      applySketchConstraintToEntity(state, constraint, diff, opIndex);
      return;
    }

    case "sketch.constraint.rename": {
      const existing = getSketchConstraintOrThrow(
        state.sketchConstraints,
        op.id,
        opIndex
      );
      const updated: SketchConstraint = {
        ...existing,
        name: normalizeSketchConstraintName(op.name, opIndex, op.id)
      };

      state.sketchConstraints.set(op.id, updated);
      pushSketchConstraintModified(diff, sketchConstraintRef(updated));
      return;
    }

    case "sketch.constraint.delete": {
      const existing = getSketchConstraintOrThrow(
        state.sketchConstraints,
        op.id,
        opIndex
      );

      state.sketchConstraints.delete(op.id);
      pushSketchConstraintDeleted(diff, sketchConstraintRef(existing));
      return;
    }

    case "feature.extrude": {
      const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
      const entity = sketch.entities.get(op.entityId);

      if (!entity) {
        throwSketchEntityNotFound(op.sketchId, op.entityId, opIndex);
      }

      const profileKind = assertExtrudableProfile(
        entity,
        opIndex,
        op.sketchId,
        op.entityId
      );
      const depth = validateExtrudeDepth(op.depth, opIndex);
      const side = validateExtrudeSide(op.side, opIndex);
      const operationMode = parseExtrudeOperationMode(
        op.operationMode,
        opIndex
      );
      const targetBodyId = validateExtrudeTargetBodyId(
        state,
        operationMode,
        op.targetBodyId,
        opIndex
      );
      assertSupportedExtrudeOperation(
        state,
        operationMode,
        profileKind,
        targetBodyId,
        opIndex
      );
      const feature: ExtrudeFeature = {
        id: op.id ?? createFeatureId(),
        kind: "extrude",
        name: normalizeOptionalFeatureName(op.name, opIndex, op.id),
        sketchId: op.sketchId,
        entityId: op.entityId,
        profileKind,
        depth,
        side,
        operationMode,
        targetBodyId,
        bodyId: op.bodyId ?? createBodyId()
      };

      addFeature(state, feature, diff, opIndex);
      return;
    }

    case "feature.delete": {
      deleteFeature(state, op.id, diff, opIndex);
      return;
    }

    case "feature.updateExtrude": {
      updateExtrudeFeature(state, op, diff, opIndex);
      return;
    }

    case "reference.nameGenerated": {
      const name = normalizeNamedReferenceName(op.name, opIndex);

      if (state.namedReferences.has(name)) {
        throwValidationError({
          code: "NAMED_REFERENCE_ALREADY_EXISTS",
          message: `Named reference already exists: ${name}`,
          opIndex,
          referenceName: name,
          path: operationPath(opIndex, "name"),
          expected: "unique named reference",
          received: name
        });
      }

      const validation = validateGeneratedReference({
        document: state,
        ownerPartId: DEFAULT_PART_ID,
        bodyId: op.bodyId,
        stableId: op.stableId,
        bodyExists: (bodyId) => documentBodyExists(state, bodyId)
      });

      if (!validation.ok) {
        throwGeneratedReferenceValidationError(
          validation.error,
          opIndex,
          "stableId"
        );
      }

      const reference: NamedGeneratedReferenceSnapshot = {
        name,
        bodyId: op.bodyId,
        stableId: op.stableId,
        kind: validation.kind
      };
      state.namedReferences.set(name, reference);
      pushNamedReferenceCreated(diff, reference);
      return;
    }

    case "reference.deleteName": {
      const name = normalizeNamedReferenceName(op.name, opIndex);
      const reference = state.namedReferences.get(name);

      if (!reference) {
        throwValidationError({
          code: "NAMED_REFERENCE_NOT_FOUND",
          message: `Named reference does not exist: ${name}`,
          opIndex,
          referenceName: name,
          path: operationPath(opIndex, "name"),
          expected: "existing named reference",
          received: name
        });
      }

      state.namedReferences.delete(name);
      pushNamedReferenceDeleted(diff, reference);
      return;
    }

    default: {
      const unknownOp = op as unknown;

      throwValidationError({
        code: "INVALID_OPERATION",
        message: `Unsupported operation: ${
          isRecord(unknownOp)
            ? String(unknownOp.op)
            : describeReceived(unknownOp)
        }.`,
        opIndex,
        op:
          isRecord(unknownOp) && typeof unknownOp.op === "string"
            ? (unknownOp.op as CadOp["op"])
            : undefined,
        path: operationPath(opIndex, "op"),
        expected: "supported CADOps operation",
        received: isRecord(unknownOp)
          ? describeReceived(unknownOp.op)
          : describeReceived(unknownOp)
      });
    }
  }
}

function validateBatchEnvelope(batch: CadBatch): void {
  const value = batch as unknown;

  if (!isRecord(value)) {
    throwValidationError({
      code: "INVALID_BATCH",
      message: "CADOps batch must be an object.",
      path: "$",
      expected: "batch object",
      received: describeReceived(value)
    });
  }

  if (value.version !== "cadops.v1") {
    throwValidationError({
      code: "INVALID_CADOPS_VERSION",
      message: "CADOps batch version must be cadops.v1.",
      path: "$.version",
      expected: "cadops.v1",
      received: describeReceived(value.version)
    });
  }

  if (value.mode !== "dryRun" && value.mode !== "commit") {
    throwValidationError({
      code: "INVALID_BATCH_MODE",
      message: "CADOps batch mode must be dryRun or commit.",
      path: "$.mode",
      expected: "dryRun or commit",
      received: describeReceived(value.mode)
    });
  }

  if (!Array.isArray(value.ops)) {
    throwValidationError({
      code: "INVALID_BATCH",
      message: "CADOps batch ops must be an array.",
      path: "$.ops",
      expected: "operation array",
      received: describeReceived(value.ops)
    });
  }

  for (const [index, op] of value.ops.entries()) {
    if (
      isRecord(op) &&
      typeof op.op === "string" &&
      isCadOperationKind(op.op)
    ) {
      continue;
    }

    throwValidationError({
      code: "INVALID_OPERATION",
      message: `Unsupported or malformed operation at index ${index}.`,
      opIndex: index,
      op:
        isRecord(op) && typeof op.op === "string"
          ? (op.op as CadOp["op"])
          : undefined,
      path: operationPath(index),
      expected: "supported CADOps operation",
      received: describeReceived(op)
    });
  }
}

function getBatchResponseMode(batch: CadBatch): CadBatch["mode"] {
  const value = batch as unknown;

  if (isRecord(value) && value.mode === "commit") {
    return "commit";
  }

  return "dryRun";
}

function isCadOperationKind(value: string): boolean {
  switch (value) {
    case "parameter.create":
    case "parameter.update":
    case "parameter.rename":
    case "parameter.delete":
    case "document.updateUnits":
    case "scene.createBox":
    case "scene.createCylinder":
    case "scene.createSphere":
    case "scene.createCone":
    case "scene.createTorus":
    case "scene.deleteObject":
    case "scene.updateTransform":
    case "scene.updateBoxDimensions":
    case "scene.updateCylinderDimensions":
    case "scene.updateSphereDimensions":
    case "scene.updateConeDimensions":
    case "scene.updateTorusDimensions":
    case "scene.renameObject":
    case "sketch.create":
    case "sketch.createOnFace":
    case "sketch.rename":
    case "sketch.delete":
    case "sketch.addPoint":
    case "sketch.addLine":
    case "sketch.addRectangle":
    case "sketch.addCircle":
    case "sketch.updateEntity":
    case "sketch.deleteEntity":
    case "sketch.dimension.create":
    case "sketch.dimension.update":
    case "sketch.dimension.rename":
    case "sketch.dimension.delete":
    case "sketch.constraint.create":
    case "sketch.constraint.rename":
    case "sketch.constraint.delete":
    case "feature.extrude":
    case "feature.delete":
    case "feature.updateExtrude":
    case "reference.nameGenerated":
    case "reference.deleteName":
      return true;
  }

  return false;
}

function validateQueryRequestEnvelope(
  request: CadQueryRequest
): CadQueryResponse | undefined {
  const value = request as unknown;

  if (!isRecord(value)) {
    return createQueryErrorResponse(value, {
      code: "INVALID_QUERY",
      message: "CADOps query request must be an object."
    });
  }

  if (value.version !== "cadops.v1") {
    return createQueryErrorResponse(value, {
      code: "INVALID_CADOPS_VERSION",
      message: "CADOps query version must be cadops.v1."
    });
  }

  if (!isRecord(value.query)) {
    return createQueryErrorResponse(value, {
      code: "INVALID_QUERY",
      message: "CADOps query must be an object."
    });
  }

  if (typeof value.query.query !== "string") {
    return createQueryErrorResponse(value, {
      code: "INVALID_QUERY",
      message: "CADOps query kind must be a string."
    });
  }

  if (!isCadQueryKind(value.query.query)) {
    return createQueryErrorResponse(value, {
      code: "UNKNOWN_QUERY",
      message: `Unsupported query: ${value.query.query}.`
    });
  }

  if (!isCadQuery(value.query)) {
    return createQueryErrorResponse(value, {
      code: "INVALID_QUERY",
      message: `Malformed query payload for ${value.query.query}.`
    });
  }

  return undefined;
}

function createQueryErrorResponse(
  request: unknown,
  error: CadQueryError
): CadQueryResponse {
  const query =
    isRecord(request) &&
    isRecord(request.query) &&
    typeof request.query.query === "string" &&
    isCadQueryKind(request.query.query)
      ? request.query.query
      : "unknown";
  const cadOpsVersion =
    isRecord(request) && typeof request.version === "string"
      ? request.version
      : "unknown";

  return {
    ok: false,
    query,
    cadOpsVersion,
    error
  } as CadQueryResponse;
}

function isCadQueryKind(value: string): value is CadQueryKind {
  switch (value) {
    case "parameter.list":
    case "parameter.get":
    case "project.summary":
    case "project.features":
    case "project.structure":
    case "project.health":
    case "project.sketches":
    case "object.get":
    case "object.measurements":
    case "project.extents":
    case "sketch.get":
    case "sketch.evaluation":
    case "sketch.dimensions":
    case "sketch.dimension.get":
    case "body.generatedReferences":
    case "body.resolveGeneratedReference":
    case "body.measurements":
    case "body.generatedReferenceMeasurements":
    case "reference.listNamed":
    case "reference.resolveNamed":
    case "transaction.history":
      return true;
  }

  return false;
}

function isCadQuery(value: unknown): boolean {
  if (!isRecord(value) || typeof value.query !== "string") {
    return false;
  }

  switch (value.query) {
    case "parameter.list":
    case "project.summary":
    case "project.features":
    case "project.structure":
    case "project.health":
    case "project.sketches":
    case "project.extents":
    case "reference.listNamed":
    case "transaction.history":
      return Object.keys(value).length === 1;
    case "parameter.get":
    case "object.get":
    case "object.measurements":
    case "sketch.get":
    case "sketch.dimension.get":
      return typeof value.id === "string";
    case "sketch.evaluation":
    case "sketch.dimensions":
      return typeof value.sketchId === "string";
    case "body.generatedReferences":
    case "body.measurements":
      return typeof value.bodyId === "string";
    case "body.resolveGeneratedReference":
    case "body.generatedReferenceMeasurements":
      return (
        typeof value.bodyId === "string" && typeof value.stableId === "string"
      );
    case "reference.resolveNamed":
      return typeof value.name === "string";
    default:
      return false;
  }
}

function addParameter(
  parameters: Map<ParameterId, CadParameter>,
  parameter: CadParameter,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  if (parameter.id.length === 0) {
    throwValidationError({
      code: "INVALID_PARAMETER",
      message: "Parameter id must be a non-empty string.",
      opIndex,
      parameterId: parameter.id,
      path: operationPath(opIndex, "id"),
      expected: "non-empty parameter id",
      received: parameter.id
    });
  }

  if (parameters.has(parameter.id)) {
    throwValidationError({
      code: "PARAMETER_ALREADY_EXISTS",
      message: `Parameter already exists: ${parameter.id}`,
      opIndex,
      parameterId: parameter.id,
      path: operationPath(opIndex, "id"),
      expected: "unique parameter id",
      received: parameter.id
    });
  }

  parameters.set(parameter.id, parameter);
  pushParameterCreated(diff, parameterRef(parameter));
}

function getParameterOrThrow(
  parameters: ReadonlyMap<ParameterId, CadParameter>,
  id: ParameterId,
  opIndex: number
): CadParameter {
  const parameter = parameters.get(id);

  if (!parameter) {
    throwValidationError({
      code: "PARAMETER_NOT_FOUND",
      message: `Parameter does not exist: ${id}`,
      opIndex,
      parameterId: id,
      path: operationPath(opIndex, "id"),
      expected: "existing parameter id",
      received: id
    });
  }

  return parameter;
}

function normalizeParameterName(
  value: string,
  opIndex: number,
  id?: ParameterId
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throwValidationError({
      code: "INVALID_PARAMETER_NAME",
      message: "Parameter name must be non-empty.",
      opIndex,
      parameterId: id,
      path: operationPath(opIndex, "name"),
      expected: "non-empty parameter name",
      received: describeReceived(value)
    });
  }

  return value.trim();
}

function normalizeOptionalDescription(value: string, opIndex: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throwValidationError({
      code: "INVALID_PARAMETER",
      message: "Parameter description must be non-empty when provided.",
      opIndex,
      path: operationPath(opIndex, "description"),
      expected: "non-empty description",
      received: describeReceived(value)
    });
  }

  return value.trim();
}

function normalizeParameterUpdateDescription(
  value: string,
  opIndex: number
): string | undefined {
  if (typeof value !== "string") {
    throwValidationError({
      code: "INVALID_PARAMETER",
      message: "Parameter description must be a string when provided.",
      opIndex,
      path: operationPath(opIndex, "description"),
      expected: "string description",
      received: describeReceived(value)
    });
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function validateFiniteParameterValue(
  value: number,
  opIndex: number,
  field: string
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throwValidationError({
      code: "INVALID_PARAMETER",
      message: "Parameter value must be a finite number.",
      opIndex,
      path: operationPath(opIndex, field),
      expected: "finite number",
      received: describeReceived(value)
    });
  }

  return cleanMeasurementNumber(value);
}

function assertParameterUpdateHasChanges(
  op: Extract<CadOp, { readonly op: "parameter.update" }>,
  opIndex: number
): void {
  if (op.value !== undefined || op.description !== undefined) {
    return;
  }

  throwValidationError({
    code: "INVALID_PARAMETER",
    message: "parameter.update must include value or description.",
    opIndex,
    parameterId: op.id,
    path: operationPath(opIndex),
    expected: "value or description",
    received: "no editable fields"
  });
}

function assertParameterNotInUse(
  dimensions: ReadonlyMap<SketchDimensionId, SketchDimension>,
  parameterId: ParameterId,
  opIndex: number
): void {
  const dependent = [...dimensions.values()].find(
    (dimension) =>
      dimension.valueSource.type === "parameter" &&
      dimension.valueSource.parameterId === parameterId
  );

  if (!dependent) {
    return;
  }

  throwValidationError({
    code: "PARAMETER_IN_USE",
    message: `Parameter is used by sketch dimension ${dependent.id}.`,
    opIndex,
    parameterId,
    sketchDimensionId: dependent.id,
    path: operationPath(opIndex, "id"),
    expected: "unused parameter",
    received: parameterId
  });
}

function addSketchDimension(
  dimensions: Map<SketchDimensionId, SketchDimension>,
  dimension: SketchDimension,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  if (dimension.id.length === 0) {
    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION",
      message: "Sketch dimension id must be a non-empty string.",
      opIndex,
      sketchDimensionId: dimension.id,
      path: operationPath(opIndex, "id"),
      expected: "non-empty sketch dimension id",
      received: dimension.id
    });
  }

  if (dimensions.has(dimension.id)) {
    throwValidationError({
      code: "SKETCH_DIMENSION_ALREADY_EXISTS",
      message: `Sketch dimension already exists: ${dimension.id}`,
      opIndex,
      sketchDimensionId: dimension.id,
      path: operationPath(opIndex, "id"),
      expected: "unique sketch dimension id",
      received: dimension.id
    });
  }

  assertSketchDimensionTargetAvailable(dimensions, dimension, opIndex);
  dimensions.set(dimension.id, dimension);
  pushSketchDimensionCreated(diff, sketchDimensionRef(dimension));
}

function assertSketchDimensionTargetAvailable(
  dimensions: ReadonlyMap<SketchDimensionId, SketchDimension>,
  dimension: SketchDimension,
  opIndex: number
): void {
  const conflicting = [...dimensions.values()].find(
    (existing) =>
      existing.id !== dimension.id &&
      getSketchDimensionTargetKey(existing) ===
        getSketchDimensionTargetKey(dimension)
  );

  if (!conflicting) {
    return;
  }

  throwValidationError({
    code: "INVALID_SKETCH_DIMENSION",
    message: `Sketch dimension target is already driven by ${conflicting.id}.`,
    opIndex,
    sketchId: dimension.sketchId,
    sketchEntityId: dimension.entityId,
    sketchDimensionId: dimension.id,
    path: operationPath(opIndex, "target"),
    expected: "undriven sketch dimension target",
    received: conflicting.id
  });
}

function getSketchDimensionTargetKey(
  dimension: Pick<SketchDimension, "sketchId" | "entityId" | "target">
): string {
  return [
    dimension.sketchId,
    dimension.entityId,
    dimension.target.entityKind,
    dimension.target.role
  ].join("\0");
}

function getSketchDimensionOrThrow(
  dimensions: ReadonlyMap<SketchDimensionId, SketchDimension>,
  id: SketchDimensionId,
  opIndex: number
): SketchDimension {
  const dimension = dimensions.get(id);

  if (!dimension) {
    throwValidationError({
      code: "SKETCH_DIMENSION_NOT_FOUND",
      message: `Sketch dimension does not exist: ${id}`,
      opIndex,
      sketchDimensionId: id,
      path: operationPath(opIndex, "id"),
      expected: "existing sketch dimension id",
      received: id
    });
  }

  return dimension;
}

function normalizeSketchDimensionName(
  value: string,
  opIndex: number,
  id?: SketchDimensionId
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION_NAME",
      message: "Sketch dimension name must be non-empty.",
      opIndex,
      sketchDimensionId: id,
      path: operationPath(opIndex, "name"),
      expected: "non-empty sketch dimension name",
      received: describeReceived(value)
    });
  }

  return value.trim();
}

function createSketchDimensionValueSource(
  op: Extract<
    CadOp,
    {
      readonly op: "sketch.dimension.create" | "sketch.dimension.update";
    }
  >,
  opIndex: number
): SketchDimensionValueSource {
  const hasLiteral = op.value !== undefined;
  const hasParameter = op.parameterId !== undefined;

  if (hasLiteral === hasParameter) {
    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION",
      message:
        "Sketch dimension value source must include exactly one of value or parameterId.",
      opIndex,
      sketchDimensionId: "id" in op ? op.id : undefined,
      path: operationPath(opIndex),
      expected: "value or parameterId",
      received: hasLiteral && hasParameter ? "both" : "neither"
    });
  }

  if (hasParameter) {
    return {
      type: "parameter",
      parameterId: op.parameterId
    };
  }

  return {
    type: "literal",
    value: validatePositiveDimensionValue(op.value, opIndex, "value")
  };
}

function validatePositiveDimensionValue(
  value: unknown,
  opIndex: number,
  field: string
): number {
  if (typeof value !== "number" || !isPositiveFiniteNumber(value)) {
    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION",
      message: "Sketch dimension value must be a positive finite number.",
      opIndex,
      path: operationPath(opIndex, field),
      expected: "positive finite number",
      received: describeReceived(value)
    });
  }

  return cleanMeasurementNumber(value);
}

function validateSketchDimensionTarget(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "sketch.dimension.create" }>,
  opIndex: number
): SketchDimensionTarget {
  const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
  const entity = sketch.entities.get(op.entityId);

  if (!entity) {
    throwSketchEntityNotFound(op.sketchId, op.entityId, opIndex);
  }

  if (!isSupportedSketchDimensionTarget(op.target, entity)) {
    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION",
      message: "Sketch dimension target is not supported for this entity.",
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: op.entityId,
      path: operationPath(opIndex, "target"),
      expected: `supported target for ${entity.kind}`,
      received: describeReceived(op.target)
    });
  }

  return op.target;
}

function applySketchDimensionToEntity(
  state: MutableDocumentState,
  dimension: SketchDimension,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  const value = resolveSketchDimensionValueOrThrow(state, dimension, opIndex);
  const sketch = getSketchOrThrow(state.sketches, dimension.sketchId, opIndex);
  const existing = sketch.entities.get(dimension.entityId);

  if (!existing) {
    throwSketchEntityNotFound(dimension.sketchId, dimension.entityId, opIndex);
  }

  const result = applySketchDimensionValue(
    existing,
    dimension,
    value,
    createSketchSolverApplyContext(state, sketch)
  );

  if (!result.ok) {
    throwSketchSolverApplyIssue(result.issue, opIndex);
  }

  const entity = result.entity;
  assertFixedConstraintsRemainSatisfied(
    state.sketchConstraints,
    dimension.sketchId,
    existing,
    entity,
    opIndex
  );
  updateSketchEntityAndDependents(state, sketch, entity, diff, opIndex);
}

function reevaluateParameterDimensions(
  state: MutableDocumentState,
  parameterId: ParameterId,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  for (const dimension of state.sketchDimensions.values()) {
    if (
      dimension.valueSource.type === "parameter" &&
      dimension.valueSource.parameterId === parameterId
    ) {
      applySketchDimensionToEntity(state, dimension, diff, opIndex);
    }
  }
}

function resolveSketchDimensionValueOrThrow(
  state: MutableDocumentState,
  dimension: SketchDimension,
  opIndex: number
): number {
  if (dimension.valueSource.type === "literal") {
    return validatePositiveDimensionValue(
      dimension.valueSource.value,
      opIndex,
      "value"
    );
  }

  const parameter = getParameterOrThrow(
    state.parameters,
    dimension.valueSource.parameterId,
    opIndex
  );
  return validatePositiveDimensionValue(parameter.value, opIndex, "value");
}

function assertSketchDimensionTargetsStillValid(
  dimensions: ReadonlyMap<SketchDimensionId, SketchDimension>,
  sketchId: SketchId,
  entity: SketchEntity,
  opIndex: number
): void {
  for (const dimension of dimensions.values()) {
    if (dimension.sketchId !== sketchId || dimension.entityId !== entity.id) {
      continue;
    }

    if (isSupportedSketchDimensionTarget(dimension.target, entity)) {
      continue;
    }

    throwValidationError({
      code: "INVALID_SKETCH_DIMENSION",
      message:
        "Sketch entity update would leave an existing dimension with an unsupported target.",
      opIndex,
      sketchId,
      sketchEntityId: entity.id,
      sketchDimensionId: dimension.id,
      path: operationPath(opIndex, "entity.kind"),
      expected: `entity compatible with dimension ${dimension.id}`,
      received: entity.kind
    });
  }
}

function syncDimensionsForSketchEntityUpdate(
  state: MutableDocumentState,
  sketchId: SketchId,
  before: SketchEntity,
  after: SketchEntity,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  for (const dimension of state.sketchDimensions.values()) {
    if (dimension.sketchId !== sketchId || dimension.entityId !== after.id) {
      continue;
    }

    const nextValueResult = getSketchDimensionTargetValue(after, dimension);
    const previousValueResult = getSketchDimensionTargetValue(
      before,
      dimension
    );

    if (!nextValueResult.ok) {
      throwSketchSolverApplyIssue(nextValueResult.issue, opIndex);
    }

    if (!previousValueResult.ok) {
      throwSketchSolverApplyIssue(previousValueResult.issue, opIndex);
    }

    const nextValue = nextValueResult.value;
    const previousValue = previousValueResult.value;

    if (nextValue === previousValue) {
      continue;
    }

    if (dimension.valueSource.type === "parameter") {
      const parameter = getParameterOrThrow(
        state.parameters,
        dimension.valueSource.parameterId,
        opIndex
      );

      if (cleanMeasurementNumber(parameter.value) === nextValue) {
        continue;
      }

      throwValidationError({
        code: "INVALID_SKETCH_DIMENSION",
        message:
          "Sketch entity update conflicts with a parameter-driven dimension.",
        opIndex,
        parameterId: parameter.id,
        sketchId,
        sketchEntityId: after.id,
        sketchDimensionId: dimension.id,
        path: operationPath(opIndex, "entity"),
        expected: `dimension value ${parameter.value}`,
        received: String(nextValue)
      });
    }

    const updated: SketchDimension = {
      ...dimension,
      valueSource: {
        type: "literal",
        value: nextValue
      }
    };
    state.sketchDimensions.set(updated.id, updated);
    pushSketchDimensionModified(diff, sketchDimensionRef(updated));
  }
}

function throwSketchSolverApplyIssue(
  issue: SketchSolverApplyIssue,
  opIndex: number
): never {
  throwValidationError({
    code: issue.code,
    message: issue.message,
    opIndex,
    sketchId: issue.sketchId,
    sketchEntityId: issue.sketchEntityId,
    sketchDimensionId: issue.sketchDimensionId,
    sketchConstraintId: issue.sketchConstraintId,
    path: operationPath(opIndex, issue.pathField),
    expected: issue.expected,
    received: issue.received
  });
}

function addSketchConstraint(
  constraints: Map<SketchConstraintId, SketchConstraint>,
  constraint: SketchConstraint,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  if (constraint.id.length === 0) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Sketch constraint id must be a non-empty string.",
      opIndex,
      sketchConstraintId: constraint.id,
      path: operationPath(opIndex, "id"),
      expected: "non-empty sketch constraint id",
      received: constraint.id
    });
  }

  if (constraints.has(constraint.id)) {
    throwValidationError({
      code: "SKETCH_CONSTRAINT_ALREADY_EXISTS",
      message: `Sketch constraint already exists: ${constraint.id}`,
      opIndex,
      sketchConstraintId: constraint.id,
      path: operationPath(opIndex, "id"),
      expected: "unique sketch constraint id",
      received: constraint.id
    });
  }

  assertSketchConstraintAvailable(constraints, constraint, opIndex);
  constraints.set(constraint.id, constraint);
  pushSketchConstraintCreated(diff, sketchConstraintRef(constraint));
}

function assertSketchConstraintAvailable(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  constraint: SketchConstraint,
  opIndex: number
): void {
  const existing = [...constraints.values()].find((candidate) => {
    if (
      candidate.id === constraint.id ||
      candidate.sketchId !== constraint.sketchId
    ) {
      return false;
    }

    if (
      isOrientationConstraint(candidate) &&
      isOrientationConstraint(constraint)
    ) {
      return candidate.entityId === constraint.entityId;
    }

    if (candidate.kind === "fixed" && constraint.kind === "fixed") {
      return sketchPointTargetsEqual(candidate.target, constraint.target);
    }

    if (candidate.kind === "coincident" && constraint.kind === "coincident") {
      return (
        sketchPointTargetPairKey(
          candidate.primaryTarget,
          candidate.secondaryTarget
        ) ===
        sketchPointTargetPairKey(
          constraint.primaryTarget,
          constraint.secondaryTarget
        )
      );
    }

    if (candidate.kind === "midpoint" && constraint.kind === "midpoint") {
      return (
        candidate.lineEntityId === constraint.lineEntityId &&
        sketchPointTargetsEqual(candidate.target, constraint.target)
      );
    }

    return false;
  });

  if (!existing) {
    return;
  }

  const isDuplicate =
    existing.kind === constraint.kind &&
    (constraint.kind === "coincident"
      ? existing.kind === "coincident" &&
        sketchPointTargetPairKey(
          existing.primaryTarget,
          existing.secondaryTarget
        ) ===
          sketchPointTargetPairKey(
            constraint.primaryTarget,
            constraint.secondaryTarget
          )
      : constraint.kind === "fixed"
        ? existing.kind === "fixed" &&
          sketchPointTargetsEqual(existing.target, constraint.target)
        : constraint.kind === "midpoint"
          ? existing.kind === "midpoint" &&
            existing.lineEntityId === constraint.lineEntityId &&
            sketchPointTargetsEqual(existing.target, constraint.target)
          : true);

  throwValidationError({
    code: isDuplicate
      ? "INVALID_SKETCH_CONSTRAINT"
      : "CONFLICTING_SKETCH_CONSTRAINT",
    message: isDuplicate
      ? constraint.kind === "fixed"
        ? `Sketch point target already has a fixed constraint: ${existing.id}.`
        : constraint.kind === "coincident"
          ? `Sketch point targets already have a coincident constraint: ${existing.id}.`
          : constraint.kind === "midpoint"
            ? `Line and point target already have a midpoint constraint: ${existing.id}.`
            : `Line already has a ${constraint.kind} constraint: ${existing.id}.`
      : `Line already has a conflicting ${existing.kind} constraint: ${existing.id}.`,
    opIndex,
    sketchId: constraint.sketchId,
    sketchEntityId: constraint.entityId,
    sketchConstraintId: constraint.id,
    path: operationPath(
      opIndex,
      constraint.kind === "fixed"
        ? "target"
        : constraint.kind === "coincident"
          ? "secondaryTarget"
          : constraint.kind === "midpoint"
            ? "target"
            : "kind"
    ),
    expected:
      constraint.kind === "fixed"
        ? "unfixed sketch point target"
        : constraint.kind === "coincident"
          ? "unique coincident point pair"
          : constraint.kind === "midpoint"
            ? "unique midpoint line/target pair"
            : "undriven line orientation",
    received: existing.kind
  });
}

function getSketchConstraintOrThrow(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  const constraint = constraints.get(id);

  if (!constraint) {
    throwValidationError({
      code: "SKETCH_CONSTRAINT_NOT_FOUND",
      message: `Sketch constraint does not exist: ${id}`,
      opIndex,
      sketchConstraintId: id,
      path: operationPath(opIndex, "id"),
      expected: "existing sketch constraint id",
      received: id
    });
  }

  return constraint;
}

function normalizeSketchConstraintName(
  value: string,
  opIndex: number,
  id?: SketchConstraintId
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT_NAME",
      message: "Sketch constraint name must be non-empty.",
      opIndex,
      sketchConstraintId: id,
      path: operationPath(opIndex, "name"),
      expected: "non-empty sketch constraint name",
      received: describeReceived(value)
    });
  }

  return value.trim();
}

function createSketchConstraintFromOp(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "sketch.constraint.create" }>,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  if (op.kind === "fixed") {
    return createFixedSketchConstraintFromOp(state, op, id, opIndex);
  }

  if (op.kind === "coincident") {
    return createCoincidentSketchConstraintFromOp(state, op, id, opIndex);
  }

  if (op.kind === "midpoint") {
    return createMidpointSketchConstraintFromOp(state, op, id, opIndex);
  }

  return createOrientationSketchConstraintFromOp(state, op, id, opIndex);
}

function createOrientationSketchConstraintFromOp(
  state: MutableDocumentState,
  op: Extract<
    CadOp,
    {
      readonly op: "sketch.constraint.create";
      readonly kind: "horizontal" | "vertical";
    }
  >,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
  const entity = sketch.entities.get(op.entityId);

  if (!entity) {
    throwSketchEntityNotFound(op.sketchId, op.entityId, opIndex);
  }

  if (entity.kind !== "line") {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Sketch orientation constraints can only target line entities.",
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: op.entityId,
      path: operationPath(opIndex, "entityId"),
      expected: "line entity",
      received: entity.kind
    });
  }

  if (getLineLength(entity) <= 0) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message:
        "Line orientation constraint cannot update a zero-length line because the orientation is ambiguous.",
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: op.entityId,
      path: operationPath(opIndex, "entityId"),
      expected: "line with a non-zero direction",
      received: "zero-length line"
    });
  }

  return {
    id,
    name: normalizeSketchConstraintName(op.name, opIndex, op.id),
    sketchId: op.sketchId,
    entityId: op.entityId,
    kind: op.kind
  };
}

function createFixedSketchConstraintFromOp(
  state: MutableDocumentState,
  op: Extract<
    CadOp,
    { readonly op: "sketch.constraint.create"; readonly kind: "fixed" }
  >,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
  const target = validateSketchPointTarget(op.target, opIndex);
  const entity = sketch.entities.get(target.entityId);

  if (!entity) {
    throwSketchEntityNotFound(op.sketchId, target.entityId, opIndex);
  }

  assertSketchPointTargetSupported(entity, target, opIndex, op.sketchId);

  return {
    id,
    name: normalizeSketchConstraintName(op.name, opIndex, op.id),
    sketchId: op.sketchId,
    entityId: target.entityId,
    kind: "fixed",
    target,
    coordinate:
      op.coordinate !== undefined
        ? validateVec2(op.coordinate, opIndex, "coordinate")
        : getSketchPointTargetCoordinate(entity, target)
  };
}

function createCoincidentSketchConstraintFromOp(
  state: MutableDocumentState,
  op: Extract<
    CadOp,
    { readonly op: "sketch.constraint.create"; readonly kind: "coincident" }
  >,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
  const primaryTarget = validateSketchPointTarget(
    op.primaryTarget,
    opIndex,
    "primaryTarget"
  );
  const secondaryTarget = validateSketchPointTarget(
    op.secondaryTarget,
    opIndex,
    "secondaryTarget"
  );

  if (sketchPointTargetsEqual(primaryTarget, secondaryTarget)) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Coincident sketch constraint targets must be distinct.",
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: primaryTarget.entityId,
      path: operationPath(opIndex, "secondaryTarget"),
      expected: "distinct sketch point targets",
      received: "same target"
    });
  }

  const primaryEntity = sketch.entities.get(primaryTarget.entityId);
  const secondaryEntity = sketch.entities.get(secondaryTarget.entityId);

  if (!primaryEntity) {
    throwSketchEntityNotFound(op.sketchId, primaryTarget.entityId, opIndex);
  }

  if (!secondaryEntity) {
    throwSketchEntityNotFound(op.sketchId, secondaryTarget.entityId, opIndex);
  }

  assertSketchPointTargetSupported(
    primaryEntity,
    primaryTarget,
    opIndex,
    op.sketchId,
    "primaryTarget"
  );
  assertSketchPointTargetSupported(
    secondaryEntity,
    secondaryTarget,
    opIndex,
    op.sketchId,
    "secondaryTarget"
  );

  assertCoincidentFixedTargetsCompatible(
    state.sketchConstraints,
    op.sketchId,
    primaryTarget,
    secondaryTarget,
    opIndex
  );

  return {
    id,
    name: normalizeSketchConstraintName(op.name, opIndex, op.id),
    sketchId: op.sketchId,
    entityId: primaryTarget.entityId,
    kind: "coincident",
    primaryTarget,
    secondaryTarget
  };
}

function createMidpointSketchConstraintFromOp(
  state: MutableDocumentState,
  op: Extract<
    CadOp,
    { readonly op: "sketch.constraint.create"; readonly kind: "midpoint" }
  >,
  id: SketchConstraintId,
  opIndex: number
): SketchConstraint {
  const sketch = getSketchOrThrow(state.sketches, op.sketchId, opIndex);
  const lineEntity = sketch.entities.get(op.lineEntityId);
  const target = validateSketchPointTarget(op.target, opIndex);

  if (!lineEntity) {
    throwSketchEntityNotFound(op.sketchId, op.lineEntityId, opIndex);
  }

  if (lineEntity.kind !== "line") {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Midpoint sketch constraint line target must be a line entity.",
      opIndex,
      sketchId: op.sketchId,
      sketchEntityId: op.lineEntityId,
      path: operationPath(opIndex, "lineEntityId"),
      expected: "line entity",
      received: lineEntity.kind
    });
  }

  const targetEntity = sketch.entities.get(target.entityId);

  if (!targetEntity) {
    throwSketchEntityNotFound(op.sketchId, target.entityId, opIndex);
  }

  assertMidpointSketchPointTargetSupported(
    targetEntity,
    target,
    opIndex,
    op.sketchId
  );

  assertMidpointFixedTargetCompatible(
    state.sketchConstraints,
    op.sketchId,
    lineEntity,
    target,
    opIndex
  );

  return {
    id,
    name: normalizeSketchConstraintName(op.name, opIndex, op.id),
    sketchId: op.sketchId,
    entityId: op.lineEntityId,
    kind: "midpoint",
    lineEntityId: op.lineEntityId,
    target
  };
}

function assertSketchConstraintTargetsStillValid(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  entity: SketchEntity,
  opIndex: number
): void {
  for (const constraint of constraints.values()) {
    const constraintTouchesEntity =
      constraint.entityId === entity.id ||
      (constraint.kind === "coincident" &&
        (constraint.primaryTarget.entityId === entity.id ||
          constraint.secondaryTarget.entityId === entity.id)) ||
      (constraint.kind === "midpoint" &&
        (constraint.lineEntityId === entity.id ||
          constraint.target.entityId === entity.id));

    if (constraint.sketchId !== sketchId || !constraintTouchesEntity) {
      continue;
    }

    if (isOrientationConstraint(constraint) && entity.kind === "line") {
      continue;
    }

    if (
      constraint.kind === "fixed" &&
      isSketchPointTargetSupported(entity, constraint.target)
    ) {
      continue;
    }

    if (
      constraint.kind === "coincident" &&
      ((constraint.primaryTarget.entityId === entity.id &&
        isSketchPointTargetSupported(entity, constraint.primaryTarget)) ||
        (constraint.secondaryTarget.entityId === entity.id &&
          isSketchPointTargetSupported(entity, constraint.secondaryTarget)))
    ) {
      continue;
    }

    if (
      constraint.kind === "midpoint" &&
      ((constraint.lineEntityId === entity.id && entity.kind === "line") ||
        (constraint.target.entityId === entity.id &&
          isMidpointSketchPointTargetSupported(entity, constraint.target)))
    ) {
      continue;
    }

    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message:
        "Sketch entity update would leave an existing constraint with an unsupported target.",
      opIndex,
      sketchId,
      sketchEntityId: entity.id,
      sketchConstraintId: constraint.id,
      path: operationPath(opIndex, "entity.kind"),
      expected: `entity compatible with constraint ${constraint.id}`,
      received: entity.kind
    });
  }
}

function assertFixedConstraintsRemainSatisfied(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  before: SketchEntity,
  after: SketchEntity,
  opIndex: number
): void {
  for (const constraint of constraints.values()) {
    if (
      constraint.kind !== "fixed" ||
      constraint.sketchId !== sketchId ||
      constraint.entityId !== after.id
    ) {
      continue;
    }

    const beforeCoordinate = getSketchPointTargetCoordinate(
      before,
      constraint.target
    );
    const afterCoordinate = getSketchPointTargetCoordinate(
      after,
      constraint.target
    );

    if (
      vec2Equal(beforeCoordinate, constraint.coordinate) &&
      !vec2Equal(afterCoordinate, constraint.coordinate)
    ) {
      throwValidationError({
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Sketch dimension update would violate an existing fixed point constraint.",
        opIndex,
        sketchId,
        sketchEntityId: after.id,
        sketchConstraintId: constraint.id,
        path: operationPath(opIndex, "value"),
        expected: `fixed coordinate ${formatVec2(constraint.coordinate)}`,
        received: formatVec2(afterCoordinate)
      });
    }
  }
}

function validateSketchPointTarget(
  value: unknown,
  opIndex: number,
  field = "target"
): SketchPointTarget {
  if (!isRecord(value)) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Sketch point constraint target must be an object.",
      opIndex,
      path: operationPath(opIndex, field),
      expected: "sketch point target",
      received: describeReceived(value)
    });
  }

  if (typeof value.entityId !== "string" || value.entityId.length === 0) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Sketch point constraint target entityId must be non-empty.",
      opIndex,
      path: operationPath(opIndex, `${field}.entityId`),
      expected: "non-empty sketch entity id",
      received: describeReceived(value.entityId)
    });
  }

  if (!isSketchPointTargetRole(value.role)) {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Sketch point constraint target role is unsupported.",
      opIndex,
      sketchEntityId: value.entityId,
      path: operationPath(opIndex, `${field}.role`),
      expected: "position, start, end, or center",
      received: describeReceived(value.role)
    });
  }

  return {
    entityId: value.entityId,
    role: value.role
  };
}

function assertSketchPointTargetSupported(
  entity: SketchEntity,
  target: SketchPointTarget,
  opIndex: number,
  sketchId: SketchId,
  field = "target"
): void {
  if (isSketchPointTargetSupported(entity, target)) {
    return;
  }

  throwValidationError({
    code: "INVALID_SKETCH_CONSTRAINT",
    message:
      "Fixed sketch constraint target role is not supported for this entity.",
    opIndex,
    sketchId,
    sketchEntityId: entity.id,
    path: operationPath(opIndex, `${field}.role`),
    expected: `point target for ${entity.kind}`,
    received: target.role
  });
}

function assertMidpointSketchPointTargetSupported(
  entity: SketchEntity,
  target: SketchPointTarget,
  opIndex: number,
  sketchId: SketchId
): void {
  if (isMidpointSketchPointTargetSupported(entity, target)) {
    return;
  }

  throwValidationError({
    code: "INVALID_SKETCH_CONSTRAINT",
    message:
      "Midpoint sketch constraint target role is not supported for this entity.",
    opIndex,
    sketchId,
    sketchEntityId: entity.id,
    path: operationPath(opIndex, "target.role"),
    expected: `point, rectangle center, or circle center target for ${entity.kind}`,
    received: target.role
  });
}

function isSketchPointTargetSupported(
  entity: SketchEntity,
  target: SketchPointTarget
): boolean {
  if (target.entityId !== entity.id) {
    return false;
  }

  return (
    (entity.kind === "point" && target.role === "position") ||
    (entity.kind === "line" &&
      (target.role === "start" || target.role === "end")) ||
    ((entity.kind === "rectangle" || entity.kind === "circle") &&
      target.role === "center")
  );
}

function isMidpointSketchPointTargetSupported(
  entity: SketchEntity,
  target: SketchPointTarget
): boolean {
  return (
    target.entityId === entity.id &&
    ((entity.kind === "point" && target.role === "position") ||
      ((entity.kind === "rectangle" || entity.kind === "circle") &&
        target.role === "center"))
  );
}

function getSketchPointTargetCoordinate(
  entity: SketchEntity,
  target: SketchPointTarget
): Vec2 {
  if (entity.kind === "point" && target.role === "position") {
    return [
      cleanMeasurementNumber(entity.point[0]),
      cleanMeasurementNumber(entity.point[1])
    ];
  }

  if (entity.kind === "line" && target.role === "start") {
    return [
      cleanMeasurementNumber(entity.start[0]),
      cleanMeasurementNumber(entity.start[1])
    ];
  }

  if (entity.kind === "line" && target.role === "end") {
    return [
      cleanMeasurementNumber(entity.end[0]),
      cleanMeasurementNumber(entity.end[1])
    ];
  }

  if (
    (entity.kind === "rectangle" || entity.kind === "circle") &&
    target.role === "center"
  ) {
    return [
      cleanMeasurementNumber(entity.center[0]),
      cleanMeasurementNumber(entity.center[1])
    ];
  }

  return [NaN, NaN];
}

function setSketchPointTargetCoordinate(
  entity: SketchEntity,
  target: SketchPointTarget,
  coordinate: Vec2
): SketchEntity {
  const cleanCoordinate: Vec2 = [
    cleanMeasurementNumber(coordinate[0]),
    cleanMeasurementNumber(coordinate[1])
  ];

  if (entity.kind === "point" && target.role === "position") {
    return { ...entity, point: cleanCoordinate };
  }

  if (entity.kind === "line" && target.role === "start") {
    return { ...entity, start: cleanCoordinate };
  }

  if (entity.kind === "line" && target.role === "end") {
    return { ...entity, end: cleanCoordinate };
  }

  if (entity.kind === "rectangle" && target.role === "center") {
    return { ...entity, center: cleanCoordinate };
  }

  if (entity.kind === "circle" && target.role === "center") {
    return { ...entity, center: cleanCoordinate };
  }

  return entity;
}

function getLineMidpoint(
  entity: Extract<SketchEntity, { readonly kind: "line" }>
): Vec2 {
  return [
    cleanMeasurementNumber((entity.start[0] + entity.end[0]) / 2),
    cleanMeasurementNumber((entity.start[1] + entity.end[1]) / 2)
  ];
}

function resolveCoincidentConstraintApplication(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketch: Sketch,
  constraint: Extract<SketchConstraint, { readonly kind: "coincident" }>,
  opIndex: number
):
  | { readonly target: SketchPointTarget; readonly coordinate: Vec2 }
  | undefined {
  const primaryEntity = sketch.entities.get(constraint.primaryTarget.entityId);
  const secondaryEntity = sketch.entities.get(
    constraint.secondaryTarget.entityId
  );

  if (!primaryEntity) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.primaryTarget.entityId,
      opIndex
    );
  }

  if (!secondaryEntity) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.secondaryTarget.entityId,
      opIndex
    );
  }

  assertSketchPointTargetSupported(
    primaryEntity,
    constraint.primaryTarget,
    opIndex,
    constraint.sketchId,
    "primaryTarget"
  );
  assertSketchPointTargetSupported(
    secondaryEntity,
    constraint.secondaryTarget,
    opIndex,
    constraint.sketchId,
    "secondaryTarget"
  );

  const primaryFixed = findFixedConstraintCoordinate(
    constraints,
    constraint.sketchId,
    constraint.primaryTarget
  );
  const secondaryFixed = findFixedConstraintCoordinate(
    constraints,
    constraint.sketchId,
    constraint.secondaryTarget
  );

  if (primaryFixed && secondaryFixed) {
    if (!vec2Equal(primaryFixed.coordinate, secondaryFixed.coordinate)) {
      throwValidationError({
        code: "INVALID_SKETCH_CONSTRAINT",
        message:
          "Coincident sketch constraint cannot satisfy two different fixed coordinates.",
        opIndex,
        sketchId: constraint.sketchId,
        sketchEntityId: constraint.entityId,
        sketchConstraintId: constraint.id,
        path: operationPath(opIndex, "secondaryTarget"),
        expected: formatVec2(primaryFixed.coordinate),
        received: formatVec2(secondaryFixed.coordinate)
      });
    }

    return undefined;
  }

  if (primaryFixed) {
    return {
      target: constraint.secondaryTarget,
      coordinate: primaryFixed.coordinate
    };
  }

  if (secondaryFixed) {
    return {
      target: constraint.primaryTarget,
      coordinate: secondaryFixed.coordinate
    };
  }

  return {
    target: constraint.secondaryTarget,
    coordinate: getSketchPointTargetCoordinate(
      primaryEntity,
      constraint.primaryTarget
    )
  };
}

function assertCoincidentFixedTargetsCompatible(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  primaryTarget: SketchPointTarget,
  secondaryTarget: SketchPointTarget,
  opIndex: number
): void {
  const primaryFixed = findFixedConstraintCoordinate(
    constraints,
    sketchId,
    primaryTarget
  );
  const secondaryFixed = findFixedConstraintCoordinate(
    constraints,
    sketchId,
    secondaryTarget
  );

  if (!primaryFixed || !secondaryFixed) {
    return;
  }

  if (vec2Equal(primaryFixed.coordinate, secondaryFixed.coordinate)) {
    return;
  }

  throwValidationError({
    code: "INVALID_SKETCH_CONSTRAINT",
    message:
      "Coincident sketch constraint cannot target points fixed to different coordinates.",
    opIndex,
    sketchId,
    sketchEntityId: primaryTarget.entityId,
    path: operationPath(opIndex, "secondaryTarget"),
    expected: formatVec2(primaryFixed.coordinate),
    received: formatVec2(secondaryFixed.coordinate)
  });
}

function assertMidpointFixedTargetCompatible(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  lineEntity: Extract<SketchEntity, { readonly kind: "line" }>,
  target: SketchPointTarget,
  opIndex: number
): void {
  const fixedTargets = findFixedConstraintCoordinatesForTarget(
    constraints,
    sketchId,
    target
  );

  const midpoint = getLineMidpoint(lineEntity);
  const fixedTarget = fixedTargets.find(
    (candidate) => !vec2Equal(candidate.coordinate, midpoint)
  );

  if (!fixedTarget) {
    return;
  }

  throwValidationError({
    code: "INVALID_SKETCH_CONSTRAINT",
    message:
      "Midpoint sketch constraint cannot target a point fixed away from the line midpoint.",
    opIndex,
    sketchId,
    sketchEntityId: target.entityId,
    sketchConstraintId: fixedTarget.id,
    path: operationPath(opIndex, "target"),
    expected: formatVec2(midpoint),
    received: formatVec2(fixedTarget.coordinate)
  });
}

function findFixedConstraintCoordinatesForTarget(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  target: SketchPointTarget
): readonly { readonly id: SketchConstraintId; readonly coordinate: Vec2 }[] {
  const coordinates: {
    readonly id: SketchConstraintId;
    readonly coordinate: Vec2;
  }[] = [];
  const directFixed = findFixedConstraintCoordinate(
    constraints,
    sketchId,
    target
  );

  if (directFixed) {
    coordinates.push(directFixed);
  }

  for (const constraint of constraints.values()) {
    if (constraint.kind !== "coincident" || constraint.sketchId !== sketchId) {
      continue;
    }

    const otherTarget = sketchPointTargetsEqual(
      constraint.primaryTarget,
      target
    )
      ? constraint.secondaryTarget
      : sketchPointTargetsEqual(constraint.secondaryTarget, target)
        ? constraint.primaryTarget
        : undefined;

    if (!otherTarget) {
      continue;
    }

    const fixedOtherTarget = findFixedConstraintCoordinate(
      constraints,
      sketchId,
      otherTarget
    );

    if (fixedOtherTarget) {
      coordinates.push(fixedOtherTarget);
    }
  }

  return coordinates;
}

function findFixedConstraintCoordinate(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  sketchId: SketchId,
  target: SketchPointTarget
): { readonly id: SketchConstraintId; readonly coordinate: Vec2 } | undefined {
  for (const constraint of constraints.values()) {
    if (
      constraint.kind === "fixed" &&
      constraint.sketchId === sketchId &&
      sketchPointTargetsEqual(constraint.target, target)
    ) {
      return {
        id: constraint.id,
        coordinate: [constraint.coordinate[0], constraint.coordinate[1]]
      };
    }
  }

  return undefined;
}

function sketchPointTargetsEqual(
  left: SketchPointTarget,
  right: SketchPointTarget
): boolean {
  return left.entityId === right.entityId && left.role === right.role;
}

function sketchPointTargetPairKey(
  left: SketchPointTarget,
  right: SketchPointTarget
): string {
  return [sketchPointTargetKey(left), sketchPointTargetKey(right)]
    .sort()
    .join("\0");
}

function sketchPointTargetKey(target: SketchPointTarget): string {
  return `${target.entityId}\0${target.role}`;
}

function isOrientationConstraint(
  constraint: SketchConstraint
): constraint is Extract<
  SketchConstraint,
  { readonly kind: "horizontal" | "vertical" }
> {
  return constraint.kind === "horizontal" || constraint.kind === "vertical";
}

function isSketchPointTargetRole(
  value: unknown
): value is SketchPointTarget["role"] {
  return (
    value === "position" ||
    value === "start" ||
    value === "end" ||
    value === "center"
  );
}

function formatVec2(value: Vec2): string {
  return `[${value[0]}, ${value[1]}]`;
}

function applySketchConstraintToEntity(
  state: MutableDocumentState,
  constraint: SketchConstraint,
  diff: MutableSemanticDiff,
  opIndex: number
): void {
  const propagation = createSketchConstraintPropagationContext(constraint.id);

  if (constraint.kind === "coincident") {
    applyCoincidentSketchConstraintToEntities(
      state,
      constraint,
      diff,
      opIndex,
      propagation
    );
    return;
  }

  if (constraint.kind === "midpoint") {
    applyMidpointSketchConstraintToEntity(
      state,
      constraint,
      diff,
      opIndex,
      propagation
    );
    return;
  }

  const sketch = getSketchOrThrow(state.sketches, constraint.sketchId, opIndex);
  const existing = sketch.entities.get(constraint.entityId);

  if (!existing) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.entityId,
      opIndex
    );
  }

  const result = applySketchConstraintValue(
    existing,
    constraint,
    createSketchSolverApplyContext(state, sketch)
  );

  if (!result.ok) {
    throwSketchSolverApplyIssue(result.issue, opIndex);
  }

  updateSketchEntityAndDependents(
    state,
    sketch,
    result.entity,
    diff,
    opIndex,
    propagation
  );
}

function applySketchConstraintsToEntity(
  state: MutableDocumentState,
  sketchId: SketchId,
  entity: SketchEntity,
  opIndex: number
): SketchEntity {
  let constrained = entity;
  const sketch = getSketchOrThrow(state.sketches, sketchId, opIndex);

  for (const constraint of state.sketchConstraints.values()) {
    if (constraint.sketchId !== sketchId || constraint.entityId !== entity.id) {
      continue;
    }

    if (constraint.kind === "coincident") {
      continue;
    }

    const result = applySketchConstraintValue(
      constrained,
      constraint,
      createSketchSolverApplyContext(state, {
        ...sketch,
        entities: new Map(sketch.entities).set(entity.id, constrained)
      })
    );

    if (!result.ok) {
      throwSketchSolverApplyIssue(result.issue, opIndex);
    }

    constrained = result.entity;
  }

  return constrained;
}

function applyCoincidentSketchConstraintToEntities(
  state: MutableDocumentState,
  constraint: Extract<SketchConstraint, { readonly kind: "coincident" }>,
  diff: MutableSemanticDiff,
  opIndex: number,
  propagation: SketchConstraintPropagationContext
): void {
  const sketch = getSketchOrThrow(state.sketches, constraint.sketchId, opIndex);
  const resolution = resolveCoincidentConstraintApplication(
    state.sketchConstraints,
    sketch,
    constraint,
    opIndex
  );

  if (!resolution) {
    return;
  }

  const existing = sketch.entities.get(resolution.target.entityId);

  if (!existing) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      resolution.target.entityId,
      opIndex
    );
  }

  const constrained =
    existing.kind === "line"
      ? applySketchLineEntityEvaluation(state, sketch, existing, opIndex)
      : setSketchPointTargetCoordinate(
          existing,
          resolution.target,
          resolution.coordinate
        );

  updateSketchEntityAndDependents(
    state,
    sketch,
    constrained,
    diff,
    opIndex,
    propagation
  );
}

function applyMidpointSketchConstraintToEntity(
  state: MutableDocumentState,
  constraint: Extract<SketchConstraint, { readonly kind: "midpoint" }>,
  diff: MutableSemanticDiff,
  opIndex: number,
  propagation: SketchConstraintPropagationContext
): void {
  const sketch = getSketchOrThrow(state.sketches, constraint.sketchId, opIndex);
  const lineEntity = sketch.entities.get(constraint.lineEntityId);
  const targetEntity = sketch.entities.get(constraint.target.entityId);

  if (!lineEntity) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.lineEntityId,
      opIndex
    );
  }

  if (!targetEntity) {
    throwSketchEntityNotFound(
      constraint.sketchId,
      constraint.target.entityId,
      opIndex
    );
  }

  if (lineEntity.kind !== "line") {
    throwValidationError({
      code: "INVALID_SKETCH_CONSTRAINT",
      message: "Midpoint sketch constraint line target must be a line entity.",
      opIndex,
      sketchId: constraint.sketchId,
      sketchEntityId: constraint.lineEntityId,
      sketchConstraintId: constraint.id,
      path: operationPath(opIndex, "lineEntityId"),
      expected: "line entity",
      received: lineEntity.kind
    });
  }

  assertMidpointSketchPointTargetSupported(
    targetEntity,
    constraint.target,
    opIndex,
    constraint.sketchId
  );
  assertMidpointFixedTargetCompatible(
    state.sketchConstraints,
    constraint.sketchId,
    lineEntity,
    constraint.target,
    opIndex
  );

  const constrained = setSketchPointTargetCoordinate(
    targetEntity,
    constraint.target,
    getLineMidpoint(lineEntity)
  );

  updateSketchEntityAndDependents(
    state,
    sketch,
    constrained,
    diff,
    opIndex,
    propagation
  );
}

function applySketchLineEntityEvaluation(
  state: MutableDocumentState,
  sketch: Sketch,
  entity: Extract<SketchEntity, { readonly kind: "line" }>,
  opIndex: number
): SketchEntity {
  const localSketch: Sketch = {
    ...sketch,
    entities: new Map(sketch.entities).set(entity.id, entity)
  };
  const dimension = [...state.sketchDimensions.values()].find(
    (candidate) =>
      candidate.sketchId === sketch.id &&
      candidate.entityId === entity.id &&
      candidate.target.entityKind === "line" &&
      candidate.target.role === "length"
  );

  if (dimension) {
    const value = resolveSketchDimensionValueOrThrow(state, dimension, opIndex);
    const result = applySketchDimensionValue(
      entity,
      dimension,
      value,
      createSketchSolverApplyContext(state, localSketch)
    );

    if (!result.ok) {
      throwSketchSolverApplyIssue(result.issue, opIndex);
    }

    return result.entity;
  }

  const context = createSketchSolverApplyContext(state, localSketch);
  const constraint = [...state.sketchConstraints.values()].find(
    (candidate) =>
      candidate.sketchId === sketch.id &&
      (candidate.entityId === entity.id ||
        (candidate.kind === "coincident" &&
          (candidate.primaryTarget.entityId === entity.id ||
            candidate.secondaryTarget.entityId === entity.id)))
  );

  if (!constraint) {
    return applySketchConstraintsToEntity(state, sketch.id, entity, opIndex);
  }

  const result = applySketchConstraintValue(entity, constraint, context);

  if (!result.ok) {
    throwSketchSolverApplyIssue(result.issue, opIndex);
  }

  return result.entity;
}

function createSketchSolverDocumentFromState(
  state: MutableDocumentState
): SketchSolverDocument {
  return {
    sketches: state.sketches,
    parameters: state.parameters,
    sketchDimensions: state.sketchDimensions,
    sketchConstraints: state.sketchConstraints
  };
}

function createSketchSolverApplyContext(
  state: MutableDocumentState,
  sketch: Sketch
): {
  readonly document: SketchSolverDocument;
  readonly sketchId: SketchId;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
} {
  return {
    document: createSketchSolverDocumentFromState(state),
    sketchId: sketch.id,
    entities: sketch.entities
  };
}

function updateSketchEntityAndDependents(
  state: MutableDocumentState,
  sketch: Sketch,
  entity: SketchEntity,
  diff: MutableSemanticDiff,
  opIndex: number,
  propagation: SketchConstraintPropagationContext = createSketchConstraintPropagationContext()
): void {
  const dependentFeatures = findFeaturesBySketchEntity(
    state.features,
    sketch.id,
    entity.id
  );
  const profileKind =
    dependentFeatures.length > 0
      ? assertExtrudableProfile(entity, opIndex, sketch.id, entity.id)
      : undefined;
  const updatedFeatures =
    dependentFeatures.length > 0 && profileKind
      ? dependentFeatures.map((feature) => ({
          ...feature,
          profileKind
        }))
      : [];
  const nextFeatures = new Map(state.features);
  const updatedBodyIds = new Set<BodyId>();
  const updatedFeatureIds = new Set<FeatureId>();

  for (const feature of updatedFeatures) {
    nextFeatures.set(feature.id, feature);
    updatedBodyIds.add(feature.bodyId);
    updatedFeatureIds.add(feature.id);
  }

  for (const feature of updatedFeatures) {
    assertSupportedExtrudeOperation(
      { ...state, features: nextFeatures },
      feature.operationMode,
      feature.profileKind,
      feature.targetBodyId,
      opIndex,
      feature.id
    );
  }

  const downstreamFeatures: Feature[] = [];

  for (const feature of nextFeatures.values()) {
    if (
      feature.operationMode === "newBody" ||
      !feature.targetBodyId ||
      !updatedBodyIds.has(feature.targetBodyId) ||
      updatedFeatureIds.has(feature.id)
    ) {
      continue;
    }

    assertSupportedExtrudeOperation(
      { ...state, features: nextFeatures },
      feature.operationMode,
      feature.profileKind,
      feature.targetBodyId,
      opIndex,
      feature.id
    );
    downstreamFeatures.push(feature);
  }

  const entities = new Map(sketch.entities);
  entities.set(entity.id, entity);
  state.sketches.set(sketch.id, { ...sketch, entities });
  pushSketchEntityModified(diff, sketchEntityRef(sketch.id, entity));

  for (const updated of [...updatedFeatures, ...downstreamFeatures]) {
    state.features.set(updated.id, updated);
    pushFeatureModified(diff, featureRef(updated));
    pushBodyModified(diff, bodyRef(updated));
  }

  applyDependentSketchConstraints(
    state,
    sketch.id,
    entity.id,
    diff,
    opIndex,
    propagation
  );
}

interface SketchConstraintPropagationContext {
  readonly visitedConstraintIds: Set<SketchConstraintId>;
}

function createSketchConstraintPropagationContext(
  initialConstraintId?: SketchConstraintId
): SketchConstraintPropagationContext {
  const visitedConstraintIds = new Set<SketchConstraintId>();

  if (initialConstraintId) {
    visitedConstraintIds.add(initialConstraintId);
  }

  return { visitedConstraintIds };
}

function applyDependentSketchConstraints(
  state: MutableDocumentState,
  sketchId: SketchId,
  entityId: SketchEntityId,
  diff: MutableSemanticDiff,
  opIndex: number,
  propagation: SketchConstraintPropagationContext
): void {
  for (const constraint of state.sketchConstraints.values()) {
    if (
      constraint.sketchId !== sketchId ||
      propagation.visitedConstraintIds.has(constraint.id)
    ) {
      continue;
    }

    if (
      constraint.kind === "midpoint" &&
      constraint.lineEntityId === entityId
    ) {
      propagation.visitedConstraintIds.add(constraint.id);
      applyMidpointSketchConstraintToEntity(
        state,
        constraint,
        diff,
        opIndex,
        propagation
      );
      continue;
    }

    if (
      constraint.kind === "coincident" &&
      (constraint.primaryTarget.entityId === entityId ||
        constraint.secondaryTarget.entityId === entityId)
    ) {
      propagation.visitedConstraintIds.add(constraint.id);
      applyCoincidentSketchConstraintToEntities(
        state,
        constraint,
        diff,
        opIndex,
        propagation
      );
    }
  }
}

function addObject(
  objects: Map<ObjectId, SceneObject>,
  object: SceneObject,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  if (objects.has(object.id)) {
    throwValidationError({
      code: "OBJECT_ALREADY_EXISTS",
      message: `Object already exists: ${object.id}`,
      opIndex,
      objectId: object.id,
      path: operationPath(opIndex, "id"),
      expected: "unique object id",
      received: object.id
    });
  }

  objects.set(object.id, object);
  diff.created.push(objectRef(object));
}

function getObjectOrThrow(
  objects: ReadonlyMap<ObjectId, SceneObject>,
  id: ObjectId,
  opIndex?: number
): SceneObject {
  const object = objects.get(id);

  if (!object) {
    throwValidationError({
      code: "OBJECT_NOT_FOUND",
      message: `Object does not exist: ${id}`,
      opIndex,
      objectId: id,
      path: operationPath(opIndex, "id"),
      expected: "existing object id",
      received: id
    });
  }

  return object;
}

function assertObjectKind<TKind extends SceneObject["kind"]>(
  object: SceneObject,
  expectedKind: TKind,
  opIndex?: number
): asserts object is Extract<SceneObject, { readonly kind: TKind }> {
  if (object.kind === expectedKind) {
    return;
  }

  throwValidationError({
    code: "OBJECT_KIND_MISMATCH",
    message: `Object ${object.id} is a ${object.kind}, not a ${expectedKind}.`,
    opIndex,
    objectId: object.id,
    path: operationPath(opIndex, "id"),
    expected: expectedKind,
    received: object.kind
  });
}

function addSketch(
  sketches: Map<SketchId, Sketch>,
  sketch: Sketch,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  if (sketches.has(sketch.id)) {
    throwValidationError({
      code: "SKETCH_ALREADY_EXISTS",
      message: `Sketch already exists: ${sketch.id}`,
      opIndex,
      sketchId: sketch.id,
      path: operationPath(opIndex, "id"),
      expected: "unique sketch id",
      received: sketch.id
    });
  }

  sketches.set(sketch.id, sketch);
  pushSketchCreated(diff, sketchRef(sketch));
}

function getSketchOrThrow(
  sketches: ReadonlyMap<SketchId, Sketch>,
  id: SketchId,
  opIndex?: number
): Sketch {
  const sketch = sketches.get(id);

  if (!sketch) {
    throwValidationError({
      code: "SKETCH_NOT_FOUND",
      message: `Sketch does not exist: ${id}`,
      opIndex,
      sketchId: id,
      path: operationPath(opIndex, "sketchId"),
      expected: "existing sketch id",
      received: id
    });
  }

  return sketch;
}

function addSketchEntity(
  sketches: Map<SketchId, Sketch>,
  sketch: Sketch,
  entity: SketchEntity,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  if (sketch.entities.has(entity.id)) {
    throwValidationError({
      code: "SKETCH_ENTITY_ALREADY_EXISTS",
      message: `Sketch entity already exists: ${entity.id}`,
      opIndex,
      sketchId: sketch.id,
      sketchEntityId: entity.id,
      path: operationPath(opIndex, "id"),
      expected: "unique sketch entity id",
      received: entity.id
    });
  }

  const entities = new Map(sketch.entities);
  entities.set(entity.id, entity);
  sketches.set(sketch.id, { ...sketch, entities });
  pushSketchEntityCreated(diff, sketchEntityRef(sketch.id, entity));
}

function throwSketchEntityNotFound(
  sketchId: SketchId,
  entityId: SketchEntityId,
  opIndex?: number
): never {
  throwValidationError({
    code: "SKETCH_ENTITY_NOT_FOUND",
    message: `Sketch entity does not exist: ${entityId}`,
    opIndex,
    sketchId,
    sketchEntityId: entityId,
    path: operationPath(opIndex, "entityId"),
    expected: "existing sketch entity id",
    received: entityId
  });
}

function addFeature(
  state: MutableDocumentState,
  feature: Feature,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  if (hasFeatureId(state, feature.id)) {
    throwValidationError({
      code: "FEATURE_ALREADY_EXISTS",
      message: `Feature already exists: ${feature.id}`,
      opIndex,
      featureId: feature.id,
      path: operationPath(opIndex, "id"),
      expected: "unique feature id",
      received: feature.id
    });
  }

  if (hasBodyId(state, feature.bodyId)) {
    throwValidationError({
      code: "BODY_ALREADY_EXISTS",
      message: `Body already exists: ${feature.bodyId}`,
      opIndex,
      featureId: feature.id,
      bodyId: feature.bodyId,
      path: operationPath(opIndex, "bodyId"),
      expected: "unique body id",
      received: feature.bodyId
    });
  }

  state.features.set(feature.id, feature);
  pushFeatureCreated(diff, featureRef(feature));
  pushBodyCreated(diff, bodyRef(feature));
}

function deleteFeature(
  state: MutableDocumentState,
  id: FeatureId,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  const featureId = validateFeatureId(id, opIndex);
  const feature = state.features.get(featureId);

  if (!feature) {
    if (isPrimitiveFeatureId(state, featureId)) {
      throwValidationError({
        code: "FEATURE_NOT_DELETABLE",
        message: `Primitive-derived feature cannot be deleted through feature.delete: ${featureId}`,
        opIndex,
        featureId,
        path: operationPath(opIndex, "id"),
        expected: "authored feature id",
        received: featureId
      });
    }

    throwValidationError({
      code: "FEATURE_NOT_FOUND",
      message: `Feature does not exist: ${featureId}`,
      opIndex,
      featureId,
      path: operationPath(opIndex, "id"),
      expected: "existing authored feature id",
      received: featureId
    });
  }

  const consumingFeature = findConsumingBooleanFeatureByTargetBodyId(
    state.features,
    feature.bodyId
  );

  if (consumingFeature) {
    throwValidationError({
      code: "FEATURE_NOT_DELETABLE",
      message: `Feature ${featureId} cannot be deleted because its body is targeted by boolean feature ${consumingFeature.id}.`,
      opIndex,
      featureId,
      bodyId: feature.bodyId,
      path: operationPath(opIndex, "id"),
      expected: "feature body not targeted by a boolean feature",
      received: consumingFeature.id
    });
  }

  state.features.delete(featureId);
  pushFeatureDeleted(diff, featureRef(feature));
  pushBodyDeleted(diff, bodyRef(feature));
}

function updateExtrudeFeature(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "feature.updateExtrude" }>,
  diff: MutableSemanticDiff,
  opIndex?: number
): void {
  const featureId = validateFeatureId(op.id, opIndex);
  const feature = state.features.get(featureId);

  if (!feature) {
    if (isPrimitiveFeatureId(state, featureId)) {
      throwValidationError({
        code: "FEATURE_NOT_EDITABLE",
        message: `Primitive-derived feature cannot be edited through feature.updateExtrude: ${featureId}`,
        opIndex,
        featureId,
        path: operationPath(opIndex, "id"),
        expected: "authored extrude feature id",
        received: featureId
      });
    }

    throwValidationError({
      code: "FEATURE_NOT_FOUND",
      message: `Feature does not exist: ${featureId}`,
      opIndex,
      featureId,
      path: operationPath(opIndex, "id"),
      expected: "existing authored extrude feature id",
      received: featureId
    });
  }

  if (op.depth === undefined && op.side === undefined) {
    throwValidationError({
      code: "INVALID_FEATURE",
      message: "feature.updateExtrude requires depth or side.",
      opIndex,
      featureId,
      path: operationPath(opIndex),
      expected: "depth or side",
      received: "no editable fields"
    });
  }

  const updated: ExtrudeFeature = {
    ...feature,
    depth:
      op.depth === undefined
        ? feature.depth
        : validateExtrudeDepth(op.depth, opIndex),
    side:
      op.side === undefined
        ? feature.side
        : validateExtrudeSide(op.side, opIndex)
  };

  state.features.set(featureId, updated);
  pushFeatureModified(diff, featureRef(updated));
  pushBodyModified(diff, bodyRef(updated));
}

function validateFeatureId(id: FeatureId, opIndex?: number): FeatureId {
  if (typeof id === "string" && id.trim().length > 0) {
    return id;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: "Feature id must be a non-empty string.",
    opIndex,
    featureId: id,
    path: operationPath(opIndex, "id"),
    expected: "non-empty feature id",
    received: describeReceived(id)
  });
}

function hasFeatureId(state: MutableDocumentState, id: FeatureId): boolean {
  if (state.features.has(id)) {
    return true;
  }

  return isPrimitiveFeatureId(state, id);
}

function isPrimitiveFeatureId(
  state: MutableDocumentState,
  id: FeatureId
): boolean {
  for (const objectId of state.objects.keys()) {
    if (createPrimitiveFeatureId(objectId) === id) {
      return true;
    }
  }

  return false;
}

function hasBodyId(state: MutableDocumentState, id: BodyId): boolean {
  for (const feature of state.features.values()) {
    if (feature.bodyId === id) {
      return true;
    }
  }

  for (const objectId of state.objects.keys()) {
    if (createPrimitiveBodyId(objectId) === id) {
      return true;
    }
  }

  return false;
}

function findFeatureByBodyId(
  features: ReadonlyMap<FeatureId, Feature>,
  bodyId: BodyId
): Feature | undefined {
  return [...features.values()].find((feature) => feature.bodyId === bodyId);
}

function findConsumingBooleanFeatureByTargetBodyId(
  features: ReadonlyMap<FeatureId, Feature>,
  targetBodyId: BodyId
): Feature | undefined {
  return [...features.values()].find(
    (feature) =>
      isConsumingExtrudeOperationMode(feature.operationMode) &&
      feature.targetBodyId === targetBodyId
  );
}

function isConsumingExtrudeOperationMode(
  operationMode: FeatureExtrudeOperationMode
): operationMode is "add" | "cut" {
  return operationMode === "add" || operationMode === "cut";
}

function isSupportedCutTargetProfileKind(
  profileKind: FeatureExtrudeProfileKind
): boolean {
  return profileKind === "rectangle" || profileKind === "circle";
}

function isSupportedAddTargetProfileKind(
  profileKind: FeatureExtrudeProfileKind
): boolean {
  return profileKind === "rectangle";
}

function isPrimitiveBodyId(state: MutableDocumentState, id: BodyId): boolean {
  for (const objectId of state.objects.keys()) {
    if (createPrimitiveBodyId(objectId) === id) {
      return true;
    }
  }

  return false;
}

function assertSketchNotInUse(
  features: ReadonlyMap<FeatureId, Feature>,
  sketchId: SketchId,
  opIndex?: number
): void {
  const feature = [...features.values()].find(
    (candidate) => candidate.sketchId === sketchId
  );

  if (!feature) {
    return;
  }

  throwValidationError({
    code: "SKETCH_IN_USE",
    message: `Sketch ${sketchId} is used by feature ${feature.id}.`,
    opIndex,
    sketchId,
    featureId: feature.id,
    path: operationPath(opIndex, "id"),
    expected: "sketch with no dependent features",
    received: sketchId
  });
}

function assertSketchEntityNotInUse(
  features: ReadonlyMap<FeatureId, Feature>,
  sketchId: SketchId,
  entityId: SketchEntityId,
  opIndex?: number
): void {
  const feature = findFeaturesBySketchEntity(features, sketchId, entityId)[0];

  if (!feature) {
    return;
  }

  throwValidationError({
    code: "SKETCH_ENTITY_IN_USE",
    message: `Sketch entity ${entityId} is used by feature ${feature.id}.`,
    opIndex,
    sketchId,
    sketchEntityId: entityId,
    featureId: feature.id,
    path: operationPath(opIndex, "entityId"),
    expected: "sketch entity with no dependent features",
    received: entityId
  });
}

function findFeaturesBySketchEntity(
  features: ReadonlyMap<FeatureId, Feature>,
  sketchId: SketchId,
  entityId: SketchEntityId
): readonly ExtrudeFeature[] {
  return [...features.values()].filter(
    (feature): feature is ExtrudeFeature =>
      feature.kind === "extrude" &&
      feature.sketchId === sketchId &&
      feature.entityId === entityId
  );
}

function assertExtrudableProfile(
  entity: SketchEntity,
  opIndex: number | undefined,
  sketchId: SketchId,
  entityId: SketchEntityId
): FeatureExtrudeProfileKind {
  if (entity.kind === "rectangle" || entity.kind === "circle") {
    return entity.kind;
  }

  throwValidationError({
    code: "UNSUPPORTED_SKETCH_PROFILE",
    message:
      "feature.extrude currently supports rectangle and circle entities only.",
    opIndex,
    sketchId,
    sketchEntityId: entityId,
    path: operationPath(opIndex, "entityId"),
    expected: "rectangle or circle sketch entity",
    received: entity.kind
  });
}

function validateExtrudeDepth(value: number, opIndex?: number): number {
  if (isPositiveFiniteNumber(value)) {
    return value;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: "Extrude depth must be a positive finite number.",
    opIndex,
    path: operationPath(opIndex, "depth"),
    expected: "positive finite number",
    received: describeReceived(value)
  });
}

function validateExtrudeSide(
  value: FeatureExtrudeSide | undefined,
  opIndex?: number
): FeatureExtrudeSide {
  if (value === undefined || value === "positive") {
    return "positive";
  }

  if (value === "negative" || value === "symmetric") {
    return value;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: `Unsupported extrude side: ${String(value)}.`,
    opIndex,
    path: operationPath(opIndex, "side"),
    expected: "positive, negative, or symmetric",
    received: describeReceived(value)
  });
}

function parseExtrudeOperationMode(
  value: FeatureExtrudeOperationMode | undefined,
  opIndex?: number
): FeatureExtrudeOperationMode {
  if (value === undefined || value === "newBody") {
    return "newBody";
  }

  if (value === "add" || value === "cut") {
    return value;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: `Unsupported extrude operation mode: ${String(value)}.`,
    opIndex,
    path: operationPath(opIndex, "operationMode"),
    expected: "newBody, add, or cut",
    received: describeReceived(value)
  });
}

function validateExtrudeTargetBodyId(
  state: MutableDocumentState,
  operationMode: FeatureExtrudeOperationMode,
  targetBodyId: BodyId | undefined,
  opIndex?: number
): BodyId | undefined {
  if (operationMode === "newBody") {
    if (targetBodyId === undefined) {
      return undefined;
    }

    throwValidationError({
      code: "INVALID_FEATURE",
      message: "newBody extrudes must not include targetBodyId.",
      opIndex,
      bodyId: targetBodyId,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "omitted targetBodyId for newBody",
      received: describeReceived(targetBodyId)
    });
  }

  if (typeof targetBodyId !== "string" || targetBodyId.trim().length === 0) {
    throwValidationError({
      code: "TARGET_BODY_REQUIRED",
      message: `Extrude operation mode ${operationMode} requires targetBodyId.`,
      opIndex,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "existing authored target body id",
      received: describeReceived(targetBodyId)
    });
  }

  if (findFeatureByBodyId(state.features, targetBodyId)) {
    return targetBodyId;
  }

  if (isPrimitiveBodyId(state, targetBodyId)) {
    throwValidationError({
      code: "TARGET_BODY_NOT_SUPPORTED",
      message: `Primitive-derived body cannot be targeted by feature.extrude ${operationMode}: ${targetBodyId}`,
      opIndex,
      bodyId: targetBodyId,
      path: operationPath(opIndex, "targetBodyId"),
      expected: "authored sketch-extrude target body id",
      received: targetBodyId
    });
  }

  throwValidationError({
    code: "BODY_NOT_FOUND",
    message: `Target body does not exist: ${targetBodyId}`,
    opIndex,
    bodyId: targetBodyId,
    path: operationPath(opIndex, "targetBodyId"),
    expected: "existing authored target body id",
    received: targetBodyId
  });
}

function assertSupportedExtrudeOperation(
  state: MutableDocumentState,
  operationMode: FeatureExtrudeOperationMode,
  profileKind: FeatureExtrudeProfileKind,
  targetBodyId: BodyId | undefined,
  opIndex?: number,
  ignoreConsumingFeatureId?: FeatureId
): void {
  if (operationMode === "newBody") {
    return;
  }

  const targetFeature =
    targetBodyId === undefined
      ? undefined
      : findFeatureByBodyId(state.features, targetBodyId);
  const consumingFeature = targetBodyId
    ? findConsumingBooleanFeatureByTargetBodyId(state.features, targetBodyId)
    : undefined;
  const hasBlockingConsumingFeature =
    consumingFeature !== undefined &&
    consumingFeature.id !== ignoreConsumingFeatureId;

  if (
    operationMode === "cut" &&
    targetBodyId &&
    targetFeature &&
    profileKind === "rectangle" &&
    isSupportedCutTargetProfileKind(targetFeature.profileKind) &&
    targetFeature.operationMode === "newBody" &&
    !hasBlockingConsumingFeature
  ) {
    return;
  }

  if (
    operationMode === "add" &&
    targetBodyId &&
    targetFeature &&
    profileKind === "rectangle" &&
    isSupportedAddTargetProfileKind(targetFeature.profileKind) &&
    targetFeature.operationMode === "newBody" &&
    !hasBlockingConsumingFeature
  ) {
    return;
  }

  const expected =
    operationMode === "add"
      ? "add with rectangle source and active rectangle newBody target"
      : "cut with rectangle source and active rectangle/circle newBody target";
  const message =
    operationMode === "add"
      ? "Add extrudes currently support rectangle tools fusing with one active rectangle newBody target body."
      : "Cut extrudes currently support rectangle tools cutting one active rectangle or circle newBody target body.";

  throwValidationError({
    code: "UNSUPPORTED_FEATURE_OPERATION",
    message,
    opIndex,
    bodyId: targetBodyId,
    path: operationPath(opIndex, "operationMode"),
    expected,
    received: describeReceived({
      operationMode,
      profileKind,
      targetBodyId,
      targetProfileKind: targetFeature?.profileKind,
      targetOperationMode: targetFeature?.operationMode,
      targetConsumedByFeatureId: hasBlockingConsumingFeature
        ? consumingFeature?.id
        : undefined
    })
  });
}

function validateBoxDimensions(
  dimensions: BoxDimensions,
  opIndex?: number,
  objectId?: ObjectId
): void {
  if (
    isPositiveFiniteNumber(dimensions.width) &&
    isPositiveFiniteNumber(dimensions.height) &&
    isPositiveFiniteNumber(dimensions.depth)
  ) {
    return;
  }

  throwValidationError({
    code: "INVALID_DIMENSIONS",
    message: "Box dimensions must be positive finite numbers.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "dimensions"),
    expected: "positive finite width, height, and depth",
    received: describeReceived(dimensions)
  });
}

function validateCylinderDimensions(
  dimensions: CylinderDimensions,
  opIndex?: number,
  objectId?: ObjectId
): void {
  if (
    isPositiveFiniteNumber(dimensions.radius) &&
    isPositiveFiniteNumber(dimensions.height)
  ) {
    return;
  }

  throwValidationError({
    code: "INVALID_DIMENSIONS",
    message: "Cylinder dimensions must be positive finite numbers.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "dimensions"),
    expected: "positive finite radius and height",
    received: describeReceived(dimensions)
  });
}

function validateSphereDimensions(
  dimensions: SphereDimensions,
  opIndex?: number,
  objectId?: ObjectId
): void {
  if (isPositiveFiniteNumber(dimensions.radius)) {
    return;
  }

  throwValidationError({
    code: "INVALID_DIMENSIONS",
    message: "Sphere dimensions must be positive finite numbers.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "dimensions"),
    expected: "positive finite radius",
    received: describeReceived(dimensions)
  });
}

function validateConeDimensions(
  dimensions: ConeDimensions,
  opIndex?: number,
  objectId?: ObjectId
): void {
  if (
    isPositiveFiniteNumber(dimensions.radius) &&
    isPositiveFiniteNumber(dimensions.height)
  ) {
    return;
  }

  throwValidationError({
    code: "INVALID_DIMENSIONS",
    message: "Cone dimensions must be positive finite numbers.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "dimensions"),
    expected: "positive finite radius and height",
    received: describeReceived(dimensions)
  });
}

function validateTorusDimensions(
  dimensions: TorusDimensions,
  opIndex?: number,
  objectId?: ObjectId
): void {
  if (
    isPositiveFiniteNumber(dimensions.majorRadius) &&
    isPositiveFiniteNumber(dimensions.minorRadius) &&
    dimensions.minorRadius < dimensions.majorRadius
  ) {
    return;
  }

  throwValidationError({
    code: "INVALID_DIMENSIONS",
    message:
      "Torus dimensions must be positive finite numbers with minorRadius smaller than majorRadius.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "dimensions"),
    expected: "positive finite majorRadius and smaller positive minorRadius",
    received: describeReceived(dimensions)
  });
}

function validateDocumentUnits(units: DocumentUnits, opIndex?: number): void {
  if (isDocumentUnits(units)) {
    return;
  }

  throwValidationError({
    code: "INVALID_UNITS",
    message: `Unsupported document units: ${String(units)}.`,
    opIndex,
    path: operationPath(opIndex, "units"),
    expected: "mm, cm, m, or in",
    received: describeReceived(units)
  });
}

function validateDocumentUnitUpdateMode(
  mode: DocumentUnitUpdateMode | undefined,
  opIndex?: number
): DocumentUnitUpdateMode {
  if (mode === undefined || mode === "metadataOnly") {
    return "metadataOnly";
  }

  if (mode === "preservePhysicalSize") {
    return mode;
  }

  throwValidationError({
    code: "INVALID_UNIT_UPDATE_MODE",
    message: `Unsupported document unit update mode: ${String(mode)}.`,
    opIndex,
    path: operationPath(opIndex, "mode"),
    expected: "metadataOnly or preservePhysicalSize",
    received: describeReceived(mode)
  });
}

function normalizeOptionalObjectName(
  name: string | undefined,
  opIndex?: number,
  objectId?: ObjectId
): string | undefined {
  return name === undefined
    ? undefined
    : normalizeObjectName(name, opIndex, objectId);
}

function normalizeObjectName(
  name: string,
  opIndex?: number,
  objectId?: ObjectId
): string {
  const normalized = name.trim();

  if (normalized.length > 0) {
    return normalized;
  }

  throwValidationError({
    code: "INVALID_OBJECT_NAME",
    message: "Object name must be non-empty.",
    opIndex,
    objectId,
    path: operationPath(opIndex, "name"),
    expected: "non-empty string",
    received: describeReceived(name)
  });
}

function normalizeSketchName(
  name: string,
  opIndex?: number,
  sketchId?: SketchId
): string {
  const normalized = name.trim();

  if (normalized.length > 0) {
    return normalized;
  }

  throwValidationError({
    code: "INVALID_SKETCH_NAME",
    message: "Sketch name must be non-empty.",
    opIndex,
    sketchId,
    path: operationPath(opIndex, "name"),
    expected: "non-empty string",
    received: describeReceived(name)
  });
}

function normalizeOptionalFeatureName(
  name: string | undefined,
  opIndex?: number,
  featureId?: FeatureId
): string | undefined {
  return name === undefined
    ? undefined
    : normalizeFeatureName(name, opIndex, featureId);
}

function normalizeFeatureName(
  name: string,
  opIndex?: number,
  featureId?: FeatureId
): string {
  const normalized = name.trim();

  if (normalized.length > 0) {
    return normalized;
  }

  throwValidationError({
    code: "INVALID_FEATURE",
    message: "Feature name must be non-empty.",
    opIndex,
    featureId,
    path: operationPath(opIndex, "name"),
    expected: "non-empty string",
    received: describeReceived(name)
  });
}

function normalizeNamedReferenceName(
  name: string,
  opIndex?: number
): NamedReferenceName {
  const normalized = name.trim();

  if (normalized.length > 0) {
    return normalized;
  }

  throwValidationError({
    code: "INVALID_REFERENCE_NAME",
    message: "Named reference name must be non-empty.",
    opIndex,
    path: operationPath(opIndex, "name"),
    expected: "non-empty string",
    received: describeReceived(name)
  });
}

function validateSketchAttachmentFace(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "sketch.createOnFace" }>,
  opIndex?: number
): CadGeneratedFaceReference {
  const target = resolveSketchAttachmentFaceTarget(state, op, opIndex);
  const result = validateGeneratedReference({
    document: state,
    ownerPartId: DEFAULT_PART_ID,
    bodyId: target.bodyId,
    stableId: target.stableId,
    bodyExists: (bodyId) => documentBodyExists(state, bodyId),
    expectedKind: "face",
    requiredOperation: "feature.attachSketchPlane"
  });

  if (!result.ok) {
    throwGeneratedReferenceValidationError(
      result.error,
      opIndex,
      target.path,
      target.referenceName
    );
  }

  return result.reference as CadGeneratedFaceReference;
}

function resolveSketchAttachmentFaceTarget(
  state: MutableDocumentState,
  op: Extract<CadOp, { readonly op: "sketch.createOnFace" }>,
  opIndex?: number
): {
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly path: "faceStableId" | "referenceName";
  readonly referenceName?: NamedReferenceName;
} {
  if (op.referenceName !== undefined) {
    const name = normalizeNamedReferenceName(op.referenceName, opIndex);

    if (op.bodyId !== undefined || op.faceStableId !== undefined) {
      throwValidationError({
        code: "INVALID_REFERENCE_NAME",
        message:
          "sketch.createOnFace must use either referenceName or bodyId with faceStableId.",
        opIndex,
        referenceName: name,
        path: operationPath(opIndex, "referenceName"),
        expected: "referenceName without bodyId or faceStableId",
        received: "mixed generated reference inputs"
      });
    }

    const reference = state.namedReferences.get(name);

    if (!reference) {
      throwValidationError({
        code: "NAMED_REFERENCE_NOT_FOUND",
        message: `Named reference does not exist: ${name}`,
        opIndex,
        referenceName: name,
        path: operationPath(opIndex, "referenceName"),
        expected: "existing named reference",
        received: name
      });
    }

    return {
      bodyId: reference.bodyId,
      stableId: reference.stableId,
      path: "referenceName",
      referenceName: name
    };
  }

  if (op.bodyId === undefined || op.faceStableId === undefined) {
    throwValidationError({
      code: "GENERATED_REFERENCE_NOT_FOUND",
      message:
        "sketch.createOnFace requires bodyId with faceStableId, or referenceName.",
      opIndex,
      bodyId: op.bodyId,
      stableId: op.faceStableId,
      path: operationPath(
        opIndex,
        op.bodyId === undefined ? "bodyId" : "faceStableId"
      ),
      expected: "bodyId and faceStableId, or referenceName",
      received: describeReceived({
        bodyId: op.bodyId,
        faceStableId: op.faceStableId,
        referenceName: op.referenceName
      })
    });
  }

  return {
    bodyId: op.bodyId,
    stableId: op.faceStableId,
    path: "faceStableId"
  };
}

function documentBodyExists(
  state: MutableDocumentState,
  bodyId: BodyId
): boolean {
  return createProjectStructure(state, []).bodies.some(
    (body) => body.id === bodyId
  );
}

function createNamedReferenceEntry(
  document: CadDocument,
  reference: NamedGeneratedReferenceSnapshot,
  transactions: readonly Transaction[]
): NamedGeneratedReferenceEntry {
  const result = validateGeneratedReference({
    document,
    ownerPartId: DEFAULT_PART_ID,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    bodyExists: (bodyId) =>
      createProjectStructure(document, transactions).bodies.some(
        (body) => body.id === bodyId
      )
  });

  if (!result.ok) {
    return {
      ...cloneNamedReferenceSnapshot(reference),
      status: "stale",
      error: createQueryErrorFromGeneratedReferenceError(
        result.error,
        reference.name
      )
    };
  }

  return {
    ...cloneNamedReferenceSnapshot(reference),
    status: "resolved",
    reference: result.reference
  };
}

function createQueryErrorFromGeneratedReferenceError(
  error: GeneratedReferenceValidationError,
  referenceName?: NamedReferenceName
): CadQueryError {
  return {
    code:
      error.code === "GENERATED_REFERENCE_KIND_MISMATCH" ||
      error.code === "GENERATED_REFERENCE_OPERATION_NOT_ELIGIBLE"
        ? "GENERATED_REFERENCE_NOT_FOUND"
        : error.code,
    message: error.message,
    bodyId: error.bodyId,
    stableId: error.stableId,
    ...(referenceName ? { referenceName } : {})
  };
}

function throwGeneratedReferenceValidationError(
  error: GeneratedReferenceValidationError,
  opIndex?: number,
  stableIdPath: "faceStableId" | "stableId" | "referenceName" = "faceStableId",
  referenceName?: NamedReferenceName
): never {
  throwValidationError({
    code: error.code,
    message: error.message,
    opIndex,
    bodyId: error.bodyId,
    stableId: error.stableId,
    ...(referenceName ? { referenceName } : {}),
    path: operationPath(
      opIndex,
      error.code === "BODY_NOT_FOUND" ||
        error.code === "UNSUPPORTED_BODY_REFERENCES"
        ? stableIdPath === "referenceName"
          ? "referenceName"
          : "bodyId"
        : stableIdPath
    ),
    expected: describeGeneratedReferenceValidationExpected(error),
    received: describeGeneratedReferenceValidationReceived(error)
  });
}

function describeGeneratedReferenceValidationExpected(
  error: GeneratedReferenceValidationError
): string {
  if (error.code === "BODY_NOT_FOUND") {
    return "existing body id";
  }

  if (error.code === "UNSUPPORTED_BODY_REFERENCES") {
    return "authored sketch-extrude body";
  }

  if (error.code === "GENERATED_REFERENCE_NOT_FOUND") {
    return "existing generated reference stable id";
  }

  if (error.code === "GENERATED_REFERENCE_KIND_MISMATCH") {
    return error.expectedKind ?? "expected generated reference kind";
  }

  return error.requiredOperation ?? "eligible generated reference operation";
}

function describeGeneratedReferenceValidationReceived(
  error: GeneratedReferenceValidationError
): string | undefined {
  if (error.actualKind) {
    return error.actualKind;
  }

  return error.stableId;
}

function createSketchPlaneFromFaceReference(
  face: CadGeneratedFaceReference,
  opIndex?: number
): SketchPlane {
  const normal = face.geometricSignature.normal;

  if (!normal) {
    throwValidationError({
      code: "INVALID_SKETCH_PLANE",
      message: `Generated face is not planar: ${face.stableId}`,
      opIndex,
      bodyId: face.bodyId,
      stableId: face.stableId,
      path: operationPath(opIndex, "faceStableId"),
      expected: "planar generated face reference",
      received: face.stableId
    });
  }

  const [x, y, z] = normal.map((component) => Math.abs(component));

  if (z === 1 && x === 0 && y === 0) {
    return "XY";
  }

  if (y === 1 && x === 0 && z === 0) {
    return "XZ";
  }

  if (x === 1 && y === 0 && z === 0) {
    return "YZ";
  }

  throwValidationError({
    code: "INVALID_SKETCH_PLANE",
    message: `Generated face normal cannot be mapped to an MVP sketch plane: ${face.stableId}`,
    opIndex,
    bodyId: face.bodyId,
    stableId: face.stableId,
    path: operationPath(opIndex, "faceStableId"),
    expected: "axis-aligned planar generated face reference",
    received: JSON.stringify(normal)
  });
}

function createSketchFaceAttachment(
  face: CadGeneratedFaceReference
): SketchAttachmentSnapshot {
  return {
    kind: "generatedFace",
    bodyId: face.bodyId,
    faceStableId: face.stableId,
    sourceFeatureId: face.sourceFeatureId,
    sourceSketchId: face.sourceSketchId,
    sourceSketchEntityId: face.sourceSketchEntityId,
    faceRole: face.role
  };
}

function validateSketchPlane(
  plane: SketchPlane,
  opIndex?: number
): SketchPlane {
  if (isSketchPlane(plane)) {
    return plane;
  }

  throwValidationError({
    code: "INVALID_SKETCH_PLANE",
    message: `Unsupported sketch plane: ${String(plane)}.`,
    opIndex,
    path: operationPath(opIndex, "plane"),
    expected: "XY, XZ, or YZ",
    received: describeReceived(plane)
  });
}

function validateVec2(
  value: Vec2,
  opIndex: number | undefined,
  field: string
): Vec2 {
  if (isVec2(value)) {
    return [value[0], value[1]];
  }

  throwValidationError({
    code: "INVALID_SKETCH_ENTITY",
    message: "Sketch coordinates must contain two finite numbers.",
    opIndex,
    path: operationPath(opIndex, field),
    expected: "two finite numbers",
    received: describeReceived(value)
  });
}

function validatePositiveSketchMeasurement(
  value: number,
  opIndex: number | undefined,
  field: string
): number {
  if (isPositiveFiniteNumber(value)) {
    return value;
  }

  throwValidationError({
    code: "INVALID_SKETCH_ENTITY",
    message: "Sketch measurements must be positive finite numbers.",
    opIndex,
    path: operationPath(opIndex, field),
    expected: "positive finite number",
    received: describeReceived(value)
  });
}

function normalizeSketchEntity(
  entity: SketchEntitySnapshot,
  opIndex?: number
): SketchEntity {
  if (typeof entity.id !== "string" || entity.id.length === 0) {
    throwValidationError({
      code: "INVALID_SKETCH_ENTITY",
      message: "Sketch entity id must be a non-empty string.",
      opIndex,
      path: operationPath(opIndex, "entity.id"),
      expected: "non-empty string",
      received: describeReceived(entity.id)
    });
  }

  switch (entity.kind) {
    case "point":
      return {
        id: entity.id,
        kind: entity.kind,
        point: validateVec2(entity.point, opIndex, "entity.point")
      };
    case "line":
      return {
        id: entity.id,
        kind: entity.kind,
        start: validateVec2(entity.start, opIndex, "entity.start"),
        end: validateVec2(entity.end, opIndex, "entity.end")
      };
    case "rectangle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: validateVec2(entity.center, opIndex, "entity.center"),
        width: validatePositiveSketchMeasurement(
          entity.width,
          opIndex,
          "entity.width"
        ),
        height: validatePositiveSketchMeasurement(
          entity.height,
          opIndex,
          "entity.height"
        )
      };
    case "circle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: validateVec2(entity.center, opIndex, "entity.center"),
        radius: validatePositiveSketchMeasurement(
          entity.radius,
          opIndex,
          "entity.radius"
        )
      };
  }
}

function isPositiveFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function mergeTransform(
  transform: Partial<Transform> | undefined,
  base: Transform = createDefaultTransform()
): Transform {
  return {
    translation: transform?.translation ?? base.translation,
    rotation: transform?.rotation ?? base.rotation,
    scale: transform?.scale ?? base.scale
  };
}

function cloneTransform(transform: Transform): Transform {
  return {
    translation: [...transform.translation],
    rotation: [...transform.rotation],
    scale: [...transform.scale]
  };
}

function objectRef(object: SceneObject): CadObjectRef {
  return {
    id: object.id,
    kind: object.kind
  };
}

function sketchRef(sketch: Sketch): CadSketchRef {
  return {
    id: sketch.id
  };
}

function sketchEntityRef(
  sketchId: SketchId,
  entity: SketchEntity
): CadSketchEntityRef {
  return {
    sketchId,
    id: entity.id,
    kind: entity.kind
  };
}

function featureRef(feature: Feature): CadFeatureRef {
  return {
    id: feature.id,
    kind: "extrude",
    bodyId: feature.bodyId,
    sketchId: feature.sketchId,
    entityId: feature.entityId,
    profileKind: feature.profileKind,
    depth: feature.depth,
    side: feature.side,
    operationMode: feature.operationMode,
    ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {})
  };
}

function bodyRef(feature: Feature): CadBodyRef {
  return {
    id: feature.bodyId,
    kind: "solid",
    featureId: feature.id
  };
}

function namedReferenceRef(
  reference: NamedGeneratedReferenceSnapshot
): CadNamedReferenceRef {
  return {
    name: reference.name,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    kind: reference.kind
  };
}

function parameterRef(parameter: CadParameter): CadParameterRef {
  return {
    id: parameter.id,
    name: parameter.name
  };
}

function sketchDimensionRef(dimension: SketchDimension): CadSketchDimensionRef {
  return {
    id: dimension.id,
    name: dimension.name,
    sketchId: dimension.sketchId,
    entityId: dimension.entityId,
    target: dimension.target,
    ...(dimension.valueSource.type === "parameter"
      ? { parameterId: dimension.valueSource.parameterId }
      : {})
  };
}

function sketchConstraintRef(
  constraint: SketchConstraint
): CadSketchConstraintRef {
  return {
    id: constraint.id,
    name: constraint.name,
    sketchId: constraint.sketchId,
    entityId: constraint.entityId,
    kind: constraint.kind,
    ...(constraint.kind === "fixed"
      ? { target: { ...constraint.target } }
      : {}),
    ...(constraint.kind === "coincident"
      ? {
          primaryTarget: { ...constraint.primaryTarget },
          secondaryTarget: { ...constraint.secondaryTarget }
        }
      : {}),
    ...(constraint.kind === "midpoint"
      ? {
          lineEntityId: constraint.lineEntityId,
          target: { ...constraint.target }
        }
      : {})
  };
}

function pushSketchCreated(diff: MutableSemanticDiff, ref: CadSketchRef): void {
  ensureSketchDiff(diff).created.push(ref);
}

function pushSketchModified(
  diff: MutableSemanticDiff,
  ref: CadSketchRef
): void {
  ensureSketchDiff(diff).modified.push(ref);
}

function pushSketchDeleted(diff: MutableSemanticDiff, ref: CadSketchRef): void {
  ensureSketchDiff(diff).deleted.push(ref);
}

function pushSketchEntityCreated(
  diff: MutableSemanticDiff,
  ref: CadSketchEntityRef
): void {
  ensureSketchDiff(diff).entitiesCreated.push(ref);
}

function pushSketchEntityModified(
  diff: MutableSemanticDiff,
  ref: CadSketchEntityRef
): void {
  ensureSketchDiff(diff).entitiesModified.push(ref);
}

function pushSketchEntityDeleted(
  diff: MutableSemanticDiff,
  ref: CadSketchEntityRef
): void {
  ensureSketchDiff(diff).entitiesDeleted.push(ref);
}

function ensureSketchDiff(
  diff: MutableSemanticDiff
): MutableSketchSemanticDiff {
  diff.sketches ??= {
    created: [],
    modified: [],
    deleted: [],
    entitiesCreated: [],
    entitiesModified: [],
    entitiesDeleted: []
  };

  return diff.sketches;
}

function pushFeatureCreated(
  diff: MutableSemanticDiff,
  ref: CadFeatureRef
): void {
  ensureFeatureDiff(diff).created.push(ref);
}

function pushFeatureModified(
  diff: MutableSemanticDiff,
  ref: CadFeatureRef
): void {
  ensureFeatureDiff(diff).modified.push(ref);
}

function pushFeatureDeleted(
  diff: MutableSemanticDiff,
  ref: CadFeatureRef
): void {
  ensureFeatureDiff(diff).deleted.push(ref);
}

function pushBodyCreated(diff: MutableSemanticDiff, ref: CadBodyRef): void {
  ensureFeatureDiff(diff).bodiesCreated.push(ref);
}

function pushBodyModified(diff: MutableSemanticDiff, ref: CadBodyRef): void {
  ensureFeatureDiff(diff).bodiesModified.push(ref);
}

function pushBodyDeleted(diff: MutableSemanticDiff, ref: CadBodyRef): void {
  ensureFeatureDiff(diff).bodiesDeleted.push(ref);
}

function ensureFeatureDiff(
  diff: MutableSemanticDiff
): MutableFeatureSemanticDiff {
  diff.features ??= {
    created: [],
    modified: [],
    deleted: [],
    bodiesCreated: [],
    bodiesModified: [],
    bodiesDeleted: []
  };

  return diff.features;
}

function pushNamedReferenceCreated(
  diff: MutableSemanticDiff,
  reference: NamedGeneratedReferenceSnapshot
): void {
  ensureReferenceDiff(diff).namedCreated.push(namedReferenceRef(reference));
}

function pushNamedReferenceDeleted(
  diff: MutableSemanticDiff,
  reference: NamedGeneratedReferenceSnapshot
): void {
  ensureReferenceDiff(diff).namedDeleted.push(namedReferenceRef(reference));
}

function ensureReferenceDiff(
  diff: MutableSemanticDiff
): MutableReferenceSemanticDiff {
  diff.references ??= {
    namedCreated: [],
    namedDeleted: []
  };

  return diff.references;
}

function pushParameterCreated(
  diff: MutableSemanticDiff,
  ref: CadParameterRef
): void {
  ensureParameterDiff(diff).created.push(ref);
}

function pushParameterModified(
  diff: MutableSemanticDiff,
  ref: CadParameterRef
): void {
  ensureParameterDiff(diff).modified.push(ref);
}

function pushParameterDeleted(
  diff: MutableSemanticDiff,
  ref: CadParameterRef
): void {
  ensureParameterDiff(diff).deleted.push(ref);
}

function ensureParameterDiff(
  diff: MutableSemanticDiff
): MutableParameterSemanticDiff {
  diff.parameters ??= {
    created: [],
    modified: [],
    deleted: []
  };

  return diff.parameters;
}

function pushSketchDimensionCreated(
  diff: MutableSemanticDiff,
  ref: CadSketchDimensionRef
): void {
  ensureSketchDimensionDiff(diff).created.push(ref);
}

function pushSketchDimensionModified(
  diff: MutableSemanticDiff,
  ref: CadSketchDimensionRef
): void {
  ensureSketchDimensionDiff(diff).modified.push(ref);
}

function pushSketchDimensionDeleted(
  diff: MutableSemanticDiff,
  ref: CadSketchDimensionRef
): void {
  ensureSketchDimensionDiff(diff).deleted.push(ref);
}

function ensureSketchDimensionDiff(
  diff: MutableSemanticDiff
): MutableSketchDimensionSemanticDiff {
  diff.sketchDimensions ??= {
    created: [],
    modified: [],
    deleted: []
  };

  return diff.sketchDimensions;
}

function pushSketchConstraintCreated(
  diff: MutableSemanticDiff,
  ref: CadSketchConstraintRef
): void {
  ensureSketchConstraintDiff(diff).created.push(ref);
}

function pushSketchConstraintModified(
  diff: MutableSemanticDiff,
  ref: CadSketchConstraintRef
): void {
  ensureSketchConstraintDiff(diff).modified.push(ref);
}

function pushSketchConstraintDeleted(
  diff: MutableSemanticDiff,
  ref: CadSketchConstraintRef
): void {
  ensureSketchConstraintDiff(diff).deleted.push(ref);
}

function ensureSketchConstraintDiff(
  diff: MutableSemanticDiff
): MutableSketchConstraintSemanticDiff {
  diff.sketchConstraints ??= {
    created: [],
    modified: [],
    deleted: []
  };

  return diff.sketchConstraints;
}

function getUnitConversionScaleFactor(
  from: DocumentUnits,
  to: DocumentUnits
): number {
  return cleanMeasurementNumber(
    getMillimetersPerUnit(from) / getMillimetersPerUnit(to)
  );
}

function getMillimetersPerUnit(units: DocumentUnits): number {
  switch (units) {
    case "mm":
      return 1;
    case "cm":
      return 10;
    case "m":
      return 1000;
    case "in":
      return 25.4;
  }
}

function scaleDocumentLengthValues(
  state: MutableDocumentState,
  scaleFactor: number,
  diff: MutableSemanticDiff
): void {
  for (const object of state.objects.values()) {
    const scaled = scaleSceneObjectLengthValues(object, scaleFactor);
    state.objects.set(object.id, scaled);
    diff.modified.push(objectRef(scaled));
  }

  for (const sketch of state.sketches.values()) {
    const scaled = scaleSketchLengthValues(sketch, scaleFactor);
    state.sketches.set(sketch.id, scaled);
    pushSketchModified(diff, sketchRef(scaled));

    for (const entity of scaled.entities.values()) {
      pushSketchEntityModified(diff, sketchEntityRef(scaled.id, entity));
    }
  }

  for (const parameter of state.parameters.values()) {
    const scaled: CadParameter = {
      ...parameter,
      value: scaleLength(parameter.value, scaleFactor)
    };
    state.parameters.set(parameter.id, scaled);
    pushParameterModified(diff, parameterRef(scaled));
  }

  for (const dimension of state.sketchDimensions.values()) {
    if (dimension.valueSource.type !== "literal") {
      continue;
    }

    const scaled: SketchDimension = {
      ...dimension,
      valueSource: {
        type: "literal",
        value: scaleLength(dimension.valueSource.value, scaleFactor)
      }
    };
    state.sketchDimensions.set(dimension.id, scaled);
    pushSketchDimensionModified(diff, sketchDimensionRef(scaled));
  }

  for (const feature of state.features.values()) {
    const scaled: ExtrudeFeature = {
      ...feature,
      depth: scaleLength(feature.depth, scaleFactor)
    };
    state.features.set(feature.id, scaled);
    pushFeatureModified(diff, featureRef(scaled));
    pushBodyModified(diff, bodyRef(scaled));
  }
}

function scaleSceneObjectLengthValues(
  object: SceneObject,
  scaleFactor: number
): SceneObject {
  const transform = scaleTransformTranslation(object.transform, scaleFactor);

  if (object.kind === "box") {
    return {
      ...object,
      dimensions: {
        width: scaleLength(object.dimensions.width, scaleFactor),
        height: scaleLength(object.dimensions.height, scaleFactor),
        depth: scaleLength(object.dimensions.depth, scaleFactor)
      },
      transform
    };
  }

  if (object.kind === "cylinder" || object.kind === "cone") {
    return {
      ...object,
      dimensions: {
        radius: scaleLength(object.dimensions.radius, scaleFactor),
        height: scaleLength(object.dimensions.height, scaleFactor)
      },
      transform
    };
  }

  if (object.kind === "sphere") {
    return {
      ...object,
      dimensions: {
        radius: scaleLength(object.dimensions.radius, scaleFactor)
      },
      transform
    };
  }

  return {
    ...object,
    dimensions: {
      majorRadius: scaleLength(object.dimensions.majorRadius, scaleFactor),
      minorRadius: scaleLength(object.dimensions.minorRadius, scaleFactor)
    },
    transform
  };
}

function scaleTransformTranslation(
  transform: Transform,
  scaleFactor: number
): Transform {
  return {
    ...transform,
    translation: scaleVec3(transform.translation, scaleFactor)
  };
}

function scaleVec3(vector: Vec3, scaleFactor: number): Vec3 {
  return [
    scaleLength(vector[0], scaleFactor),
    scaleLength(vector[1], scaleFactor),
    scaleLength(vector[2], scaleFactor)
  ];
}

function scaleSketchLengthValues(sketch: Sketch, scaleFactor: number): Sketch {
  return {
    ...sketch,
    entities: new Map(
      [...sketch.entities.entries()].map(([id, entity]) => [
        id,
        scaleSketchEntityLengthValues(entity, scaleFactor)
      ])
    )
  };
}

function scaleSketchEntityLengthValues(
  entity: SketchEntity,
  scaleFactor: number
): SketchEntity {
  switch (entity.kind) {
    case "point":
      return {
        ...entity,
        point: scaleVec2(entity.point, scaleFactor)
      };
    case "line":
      return {
        ...entity,
        start: scaleVec2(entity.start, scaleFactor),
        end: scaleVec2(entity.end, scaleFactor)
      };
    case "rectangle":
      return {
        ...entity,
        center: scaleVec2(entity.center, scaleFactor),
        width: scaleLength(entity.width, scaleFactor),
        height: scaleLength(entity.height, scaleFactor)
      };
    case "circle":
      return {
        ...entity,
        center: scaleVec2(entity.center, scaleFactor),
        radius: scaleLength(entity.radius, scaleFactor)
      };
  }
}

function scaleVec2(vector: Vec2, scaleFactor: number): Vec2 {
  return [
    scaleLength(vector[0], scaleFactor),
    scaleLength(vector[1], scaleFactor)
  ];
}

function scaleLength(value: number, scaleFactor: number): number {
  return cleanMeasurementNumber(value * scaleFactor);
}

function cloneDocument(document: CadDocument): CadDocument {
  return createCadDocumentFromSnapshot(createCadDocumentSnapshot(document));
}

export function createCadDocumentSnapshot(
  document: CadDocument,
  nextObjectNumber = inferNextObjectNumber(document),
  nextSketchNumber = inferNextSketchNumber(document),
  nextSketchEntityNumber = inferNextSketchEntityNumber(document),
  nextParameterNumber = inferNextParameterNumber(document),
  nextSketchDimensionNumber = inferNextSketchDimensionNumber(document),
  nextSketchConstraintNumber = inferNextSketchConstraintNumber(document),
  nextFeatureNumber = inferNextFeatureNumber(document),
  nextBodyNumber = inferNextBodyNumber(document)
): CadDocumentSnapshot {
  return {
    units: document.units,
    objects: [...document.objects.values()].map(createCadObjectSnapshot),
    sketches: [...document.sketches.values()].map(createSketchSnapshot),
    parameters: [...document.parameters.values()].map(cloneParameterSnapshot),
    sketchDimensions: [...document.sketchDimensions.values()].map(
      cloneSketchDimensionSnapshot
    ),
    sketchConstraints: [...document.sketchConstraints.values()].map(
      cloneSketchConstraintSnapshot
    ),
    features: [...document.features.values()].map(createFeatureSnapshot),
    namedReferences: [...document.namedReferences.values()].map(
      cloneNamedReferenceSnapshot
    ),
    nextObjectNumber,
    nextSketchNumber,
    nextSketchEntityNumber,
    nextParameterNumber,
    nextSketchDimensionNumber,
    nextSketchConstraintNumber,
    nextFeatureNumber,
    nextBodyNumber
  };
}

export function createCadDocumentFromSnapshot(
  snapshot: CadDocumentSnapshot
): CadDocument {
  return createCadDocument(
    snapshot.objects.map(
      (object) => [object.id, createCadObjectSnapshot(object)] as const
    ),
    snapshot.units,
    snapshot.sketches.map(
      (sketch) => [sketch.id, createSketchFromSnapshot(sketch)] as const
    ),
    snapshot.parameters.map(
      (parameter) => [parameter.id, cloneParameterSnapshot(parameter)] as const
    ),
    snapshot.sketchDimensions.map(
      (dimension) =>
        [dimension.id, cloneSketchDimensionSnapshot(dimension)] as const
    ),
    snapshot.sketchConstraints.map(
      (constraint) =>
        [constraint.id, cloneSketchConstraintSnapshot(constraint)] as const
    ),
    snapshot.features.map(
      (feature) => [feature.id, createFeatureFromSnapshot(feature)] as const
    ),
    snapshot.namedReferences.map(
      (reference) =>
        [reference.name, cloneNamedReferenceSnapshot(reference)] as const
    )
  );
}

function createCadObjectSnapshot(object: SceneObject): CadObjectSnapshot {
  switch (object.kind) {
    case "box":
      return {
        id: object.id,
        kind: object.kind,
        name: object.name,
        dimensions: { ...object.dimensions },
        transform: cloneTransform(object.transform)
      };
    case "cylinder":
      return {
        id: object.id,
        kind: object.kind,
        name: object.name,
        dimensions: { ...object.dimensions },
        transform: cloneTransform(object.transform)
      };
    case "sphere":
      return {
        id: object.id,
        kind: object.kind,
        name: object.name,
        dimensions: { ...object.dimensions },
        transform: cloneTransform(object.transform)
      };
    case "cone":
      return {
        id: object.id,
        kind: object.kind,
        name: object.name,
        dimensions: { ...object.dimensions },
        transform: cloneTransform(object.transform)
      };
    case "torus":
      return {
        id: object.id,
        kind: object.kind,
        name: object.name,
        dimensions: { ...object.dimensions },
        transform: cloneTransform(object.transform)
      };
  }
}

function createSketchSnapshot(sketch: Sketch): SketchSnapshot {
  return {
    id: sketch.id,
    name: sketch.name,
    plane: sketch.plane,
    attachment: sketch.attachment
      ? cloneSketchAttachment(sketch.attachment)
      : undefined,
    entities: [...sketch.entities.values()].map(cloneSketchEntity)
  };
}

function createSketchFromSnapshot(snapshot: SketchSnapshot): Sketch {
  return {
    id: snapshot.id,
    name: snapshot.name,
    plane: snapshot.plane,
    attachment: snapshot.attachment
      ? cloneSketchAttachment(snapshot.attachment)
      : undefined,
    entities: new Map(
      snapshot.entities.map((entity) => [entity.id, cloneSketchEntity(entity)])
    )
  };
}

function cloneParameterSnapshot(parameter: CadParameterSnapshot): CadParameter {
  return {
    id: parameter.id,
    name: parameter.name,
    value: parameter.value,
    ...(parameter.description !== undefined
      ? { description: parameter.description }
      : {})
  };
}

function cloneSketchDimensionSnapshot(
  dimension: SketchDimensionSnapshot
): SketchDimension {
  return {
    id: dimension.id,
    name: dimension.name,
    sketchId: dimension.sketchId,
    entityId: dimension.entityId,
    target: { ...dimension.target },
    valueSource: cloneSketchDimensionValueSource(dimension.valueSource)
  };
}

function cloneSketchConstraintSnapshot(
  constraint: SketchConstraintSnapshot
): SketchConstraint {
  if (constraint.kind === "fixed") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "fixed",
      target: { ...constraint.target },
      coordinate: [constraint.coordinate[0], constraint.coordinate[1]]
    };
  }

  if (constraint.kind === "coincident") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "coincident",
      primaryTarget: { ...constraint.primaryTarget },
      secondaryTarget: { ...constraint.secondaryTarget }
    };
  }

  if (constraint.kind === "midpoint") {
    return {
      id: constraint.id,
      name: constraint.name,
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      kind: "midpoint",
      lineEntityId: constraint.lineEntityId,
      target: { ...constraint.target }
    };
  }

  return {
    id: constraint.id,
    name: constraint.name,
    sketchId: constraint.sketchId,
    entityId: constraint.entityId,
    kind: constraint.kind
  };
}

function cloneSketchDimensionValueSource(
  valueSource: SketchDimensionValueSource
): SketchDimensionValueSource {
  return valueSource.type === "literal"
    ? { type: "literal", value: valueSource.value }
    : { type: "parameter", parameterId: valueSource.parameterId };
}

function cloneSketchAttachment(
  attachment: SketchAttachmentSnapshot
): SketchAttachmentSnapshot {
  return {
    ...attachment
  };
}

function createFeatureSnapshot(feature: Feature): ExtrudeFeatureSnapshot {
  return {
    id: feature.id,
    kind: "extrude",
    name: feature.name,
    sketchId: feature.sketchId,
    entityId: feature.entityId,
    profileKind: feature.profileKind,
    depth: feature.depth,
    side: feature.side,
    operationMode: feature.operationMode,
    ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {}),
    bodyId: feature.bodyId
  };
}

function createFeatureFromSnapshot(
  snapshot: ExtrudeFeatureSnapshot
): ExtrudeFeature {
  return {
    id: snapshot.id,
    kind: "extrude",
    name: snapshot.name,
    sketchId: snapshot.sketchId,
    entityId: snapshot.entityId,
    profileKind: snapshot.profileKind,
    depth: snapshot.depth,
    side: snapshot.side ?? "positive",
    operationMode: snapshot.operationMode ?? "newBody",
    targetBodyId: snapshot.targetBodyId,
    bodyId: snapshot.bodyId
  };
}

function cloneNamedReferenceSnapshot(
  reference: NamedGeneratedReferenceSnapshot
): NamedGeneratedReferenceSnapshot {
  return {
    name: reference.name,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    kind: reference.kind
  };
}

function cloneSketchEntity(entity: SketchEntitySnapshot): SketchEntity {
  switch (entity.kind) {
    case "point":
      return {
        id: entity.id,
        kind: entity.kind,
        point: [...entity.point]
      };
    case "line":
      return {
        id: entity.id,
        kind: entity.kind,
        start: [...entity.start],
        end: [...entity.end]
      };
    case "rectangle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: [...entity.center],
        width: entity.width,
        height: entity.height
      };
    case "circle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: [...entity.center],
        radius: entity.radius
      };
  }
}

interface CadProjectStructureSnapshot {
  readonly parts: readonly CadPartSnapshot[];
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly objectSources: readonly CadObjectModelSource[];
}

function createProjectStructure(
  document: CadDocument,
  transactions: readonly Transaction[]
): CadProjectStructureSnapshot {
  const sourceByObjectId = createPrimitiveFeatureSourceMap(transactions);
  const objects = [...document.objects.values()];
  const sketches = [...document.sketches.values()];
  const primitiveFeatures = objects.map((object) =>
    createPrimitiveFeatureSummary(
      object,
      sourceByObjectId.get(object.id) ?? {
        type: "sceneObject"
      }
    )
  );
  const extrudeFeatures = [...document.features.values()].map(
    createExtrudeFeatureSummary
  );
  const consumedBodyIds = createConsumedBodyMap(document.features);
  const features: readonly CadFeatureSummary[] = [
    ...primitiveFeatures,
    ...extrudeFeatures
  ];
  const bodies = [
    ...objects.map(createPrimitiveBodySnapshot),
    ...[...document.features.values()].map((feature) =>
      createExtrudeBodySnapshot(feature, consumedBodyIds.get(feature.bodyId))
    )
  ];
  const objectSources = objects.map(createObjectModelSource);
  const part: CadPartSnapshot = {
    id: DEFAULT_PART_ID,
    kind: "part",
    name: DEFAULT_PART_NAME,
    source: {
      type: "defaultScenePart"
    },
    objectIds: objects.map((object) => object.id),
    featureIds: features.map((feature) => feature.id),
    bodyIds: bodies.map((body) => body.id),
    sketchIds: sketches.map((sketch) => sketch.id)
  };

  return {
    parts: [part],
    features,
    bodies,
    objectSources
  };
}

function createPrimitiveFeatureSummary(
  object: SceneObject,
  source: CadPrimitiveFeatureSource
): CadPrimitiveFeatureSummary {
  return {
    id: createPrimitiveFeatureId(object.id),
    kind: "primitive",
    partId: DEFAULT_PART_ID,
    primitive: object.kind,
    objectId: object.id,
    bodyId: createPrimitiveBodyId(object.id),
    name: object.name,
    dimensions: { ...object.dimensions },
    transform: cloneTransform(object.transform),
    source
  };
}

function createPrimitiveFeatureId(objectId: ObjectId): string {
  return `feature:${objectId}`;
}

function createPrimitiveBodyId(objectId: ObjectId): BodyId {
  return `body:${objectId}`;
}

function createPrimitiveBodySnapshot(object: SceneObject): CadBodySnapshot {
  const featureId = createPrimitiveFeatureId(object.id);

  return {
    id: createPrimitiveBodyId(object.id),
    kind: "solid",
    partId: DEFAULT_PART_ID,
    featureId,
    objectId: object.id,
    primitive: object.kind,
    name: object.name,
    source: {
      type: "primitiveFeature",
      featureId,
      objectId: object.id
    }
  };
}

function createExtrudeFeatureSummary(feature: Feature): CadFeatureSummary {
  return {
    id: feature.id,
    kind: "extrude",
    partId: DEFAULT_PART_ID,
    bodyId: feature.bodyId,
    name: feature.name,
    sketchId: feature.sketchId,
    entityId: feature.entityId,
    profileKind: feature.profileKind,
    depth: feature.depth,
    side: feature.side,
    operationMode: feature.operationMode,
    ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {}),
    source: {
      type: "sketchEntity",
      sketchId: feature.sketchId,
      entityId: feature.entityId
    }
  };
}

function createExtrudeBodySnapshot(
  feature: Feature,
  consumedByFeatureId?: FeatureId
): CadBodySnapshot {
  return {
    id: feature.bodyId,
    kind: "solid",
    partId: DEFAULT_PART_ID,
    featureId: feature.id,
    ...(consumedByFeatureId ? { consumedByFeatureId } : {}),
    name: feature.name,
    source: {
      type: "sketchExtrudeFeature",
      featureId: feature.id,
      sketchId: feature.sketchId,
      entityId: feature.entityId,
      profileKind: feature.profileKind
    }
  };
}

function createConsumedBodyMap(
  features: ReadonlyMap<FeatureId, Feature>
): ReadonlyMap<BodyId, FeatureId> {
  const consumed = new Map<BodyId, FeatureId>();

  for (const feature of features.values()) {
    if (
      isConsumingExtrudeOperationMode(feature.operationMode) &&
      feature.targetBodyId
    ) {
      consumed.set(feature.targetBodyId, feature.id);
    }
  }

  return consumed;
}

function createObjectModelSource(object: SceneObject): CadObjectModelSource {
  return {
    objectId: object.id,
    partId: DEFAULT_PART_ID,
    featureId: createPrimitiveFeatureId(object.id),
    bodyId: createPrimitiveBodyId(object.id)
  };
}

function createPrimitiveFeatureSourceMap(
  transactions: readonly Transaction[]
): ReadonlyMap<ObjectId, CadPrimitiveFeatureSource> {
  const sourceByObjectId = new Map<ObjectId, CadPrimitiveFeatureSource>();

  for (const transaction of sortTransactions(transactions)) {
    for (const op of materializeGeneratedObjectIds(transaction)) {
      if (
        op.op === "scene.createBox" ||
        op.op === "scene.createCylinder" ||
        op.op === "scene.createSphere" ||
        op.op === "scene.createCone" ||
        op.op === "scene.createTorus"
      ) {
        if (op.id) {
          sourceByObjectId.set(op.id, {
            type: "sceneObject",
            createdByTransactionId: transaction.id,
            createOp: op.op
          });
        }
        continue;
      }

      if (op.op === "scene.deleteObject") {
        sourceByObjectId.delete(op.id);
      }
    }
  }

  return sourceByObjectId;
}

function createObjectMeasurements(
  object: SceneObject,
  units: DocumentUnits
): ObjectMeasurementsSnapshot {
  const localBounds = createLocalBounds(object);
  const worldBounds = createBounds(
    createMeasurementPoints(object).map((point) =>
      transformPoint(point, object.transform)
    )
  );

  return {
    id: object.id,
    kind: object.kind,
    name: object.name,
    units,
    dimensions: { ...object.dimensions },
    transform: cloneTransform(object.transform),
    localBounds,
    worldBounds,
    approximateVolume: calculateApproximateVolume(object)
  };
}

function createLocalBounds(object: SceneObject): CadAxisAlignedBounds {
  return createBounds(createMeasurementPoints(object));
}

function createMeasurementPoints(object: SceneObject): readonly Vec3[] {
  if (object.kind === "box") {
    const { depth, height, width } = object.dimensions;
    return createBoxBoundsPoints(width / 2, height / 2, depth / 2);
  }

  if (object.kind === "sphere") {
    return createSphereBoundsPoints(object.dimensions.radius);
  }

  if (object.kind === "torus") {
    const outerRadius =
      object.dimensions.majorRadius + object.dimensions.minorRadius;
    return createBoxBoundsPoints(
      outerRadius,
      outerRadius,
      object.dimensions.minorRadius
    );
  }

  const { height, radius } = object.dimensions;
  const halfHeight = height / 2;

  return [
    [-radius, -radius, -halfHeight],
    [radius, -radius, -halfHeight],
    [radius, radius, -halfHeight],
    [-radius, radius, -halfHeight],
    [-radius, -radius, halfHeight],
    [radius, -radius, halfHeight],
    [radius, radius, halfHeight],
    [-radius, radius, halfHeight]
  ];
}

function createSphereBoundsPoints(radius: number): readonly Vec3[] {
  return [
    [-radius, -radius, -radius],
    [radius, -radius, -radius],
    [radius, radius, -radius],
    [-radius, radius, -radius],
    [-radius, -radius, radius],
    [radius, -radius, radius],
    [radius, radius, radius],
    [-radius, radius, radius]
  ];
}

function createBoxBoundsPoints(
  halfX: number,
  halfY: number,
  halfZ: number
): readonly Vec3[] {
  return [
    [-halfX, -halfY, -halfZ],
    [halfX, -halfY, -halfZ],
    [halfX, halfY, -halfZ],
    [-halfX, halfY, -halfZ],
    [-halfX, -halfY, halfZ],
    [halfX, -halfY, halfZ],
    [halfX, halfY, halfZ],
    [-halfX, halfY, halfZ]
  ];
}

function calculateApproximateVolume(object: SceneObject): number {
  const scaleFactor = Math.abs(
    object.transform.scale[0] *
      object.transform.scale[1] *
      object.transform.scale[2]
  );

  if (object.kind === "box") {
    const { depth, height, width } = object.dimensions;
    return width * height * depth * scaleFactor;
  }

  if (object.kind === "sphere") {
    const { radius } = object.dimensions;
    return (4 / 3) * Math.PI * radius * radius * radius * scaleFactor;
  }

  if (object.kind === "cone") {
    const { height, radius } = object.dimensions;
    return (Math.PI * radius * radius * height * scaleFactor) / 3;
  }

  if (object.kind === "torus") {
    const { majorRadius, minorRadius } = object.dimensions;
    return (
      2 *
      Math.PI *
      Math.PI *
      majorRadius *
      minorRadius *
      minorRadius *
      scaleFactor
    );
  }

  const { height, radius } = object.dimensions;
  return Math.PI * radius * radius * height * scaleFactor;
}

function mergeBounds(
  boundsList: readonly CadAxisAlignedBounds[]
): CadAxisAlignedBounds {
  return createBounds(boundsList.flatMap((bounds) => [bounds.min, bounds.max]));
}

function createBodyExtents(
  document: CadDocument,
  units: DocumentUnits,
  transactions: readonly Transaction[]
): {
  readonly bodies: readonly BodyExtentSnapshot[];
  readonly warnings: readonly ProjectExtentsWarning[];
} {
  const structure = createProjectStructure(document, transactions);
  const bodies: BodyExtentSnapshot[] = [];
  const warnings: ProjectExtentsWarning[] = [];

  for (const body of structure.bodies) {
    if (body.source.type !== "sketchExtrudeFeature") {
      continue;
    }

    if (body.consumedByFeatureId) {
      continue;
    }

    const measurements = createBodyMeasurements(
      document,
      body.id,
      units,
      body.partId
    );

    if (!measurements) {
      warnings.push({
        code: "BODY_EXTENTS_UNAVAILABLE",
        message: `Body extents are unavailable because the authored body source or attached sketch reference could not be resolved: ${body.id}`,
        bodyId: body.id,
        featureId: body.featureId
      });
      continue;
    }

    bodies.push({
      bodyId: measurements.bodyId,
      sourceFeatureId: measurements.sourceFeatureId,
      sourceSketchId: measurements.sourceSketchId,
      sourceSketchEntityId: measurements.sourceSketchEntityId,
      profileKind: measurements.profileKind,
      worldBounds: measurements.localBounds,
      volume: measurements.volume
    });
  }

  return { bodies, warnings };
}

function sumApproximateVolumes(
  measurements: readonly ObjectMeasurementsSnapshot[]
): number {
  return measurements.reduce(
    (total, measurement) => total + measurement.approximateVolume,
    0
  );
}

function sumBodyExtentVolumes(extents: readonly BodyExtentSnapshot[]): number {
  return extents.reduce((total, extent) => total + extent.volume, 0);
}

function createBounds(points: readonly Vec3[]): CadAxisAlignedBounds {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const zs = points.map((point) => point[2]);
  const min: Vec3 = [
    cleanMeasurementNumber(Math.min(...xs)),
    cleanMeasurementNumber(Math.min(...ys)),
    cleanMeasurementNumber(Math.min(...zs))
  ];
  const max: Vec3 = [
    cleanMeasurementNumber(Math.max(...xs)),
    cleanMeasurementNumber(Math.max(...ys)),
    cleanMeasurementNumber(Math.max(...zs))
  ];
  const size: Vec3 = [
    cleanMeasurementNumber(max[0] - min[0]),
    cleanMeasurementNumber(max[1] - min[1]),
    cleanMeasurementNumber(max[2] - min[2])
  ];
  const center: Vec3 = [
    cleanMeasurementNumber((min[0] + max[0]) / 2),
    cleanMeasurementNumber((min[1] + max[1]) / 2),
    cleanMeasurementNumber((min[2] + max[2]) / 2)
  ];

  return { min, max, size, center };
}

function cleanMeasurementNumber(value: number): number {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function transformPoint(point: Vec3, transform: Transform): Vec3 {
  const scaled: Vec3 = [
    point[0] * transform.scale[0],
    point[1] * transform.scale[1],
    point[2] * transform.scale[2]
  ];

  return addVec3(
    rotateEuler(scaled, transform.rotation),
    transform.translation
  );
}

function rotateEuler(point: Vec3, rotation: Vec3): Vec3 {
  const [rx, ry, rz] = rotation;
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);

  const y1 = point[1] * cosX - point[2] * sinX;
  const z1 = point[1] * sinX + point[2] * cosX;
  const x2 = point[0] * cosY + z1 * sinY;
  const z2 = -point[0] * sinY + z1 * cosY;
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;

  return [x3, y3, z2];
}

function addVec3(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function runOperations(
  ops: readonly CadOp[],
  document: CadDocument,
  initialObjectNumber: number,
  initialSketchNumber: number,
  initialSketchEntityNumber: number,
  initialParameterNumber: number,
  initialSketchDimensionNumber: number,
  initialSketchConstraintNumber: number,
  initialFeatureNumber: number,
  initialBodyNumber: number
): OperationRunResult {
  if (ops.length === 0) {
    throwValidationError({
      code: "EMPTY_BATCH",
      message: "Cannot execute an empty batch.",
      path: "$.ops",
      expected: "at least one operation",
      received: "[]"
    });
  }

  const state: MutableDocumentState = {
    objects: new Map(document.objects),
    sketches: new Map(document.sketches),
    parameters: new Map(document.parameters),
    sketchDimensions: new Map(document.sketchDimensions),
    sketchConstraints: new Map(document.sketchConstraints),
    features: new Map(document.features),
    namedReferences: new Map(document.namedReferences),
    units: document.units
  };
  let nextObjectNumber = initialObjectNumber;
  let nextSketchNumber = initialSketchNumber;
  let nextSketchEntityNumber = initialSketchEntityNumber;
  let nextParameterNumber = initialParameterNumber;
  let nextSketchDimensionNumber = initialSketchDimensionNumber;
  let nextSketchConstraintNumber = initialSketchConstraintNumber;
  let nextFeatureNumber = initialFeatureNumber;
  let nextBodyNumber = initialBodyNumber;
  const diff: MutableSemanticDiff = {
    created: [],
    modified: [],
    deleted: []
  };

  for (const [opIndex, op] of ops.entries()) {
    try {
      applyOperation(
        op,
        state,
        diff,
        () => {
          const result = createObjectId(state.objects, nextObjectNumber);
          nextObjectNumber = result.nextObjectNumber;
          return result.id;
        },
        () => {
          const result = createSketchId(state.sketches, nextSketchNumber);
          nextSketchNumber = result.nextSketchNumber;
          return result.id;
        },
        () => {
          const result = createSketchEntityId(
            state.sketches,
            nextSketchEntityNumber
          );
          nextSketchEntityNumber = result.nextSketchEntityNumber;
          return result.id;
        },
        () => {
          const result = createParameterId(
            state.parameters,
            nextParameterNumber
          );
          nextParameterNumber = result.nextParameterNumber;
          return result.id;
        },
        () => {
          const result = createSketchDimensionId(
            state.sketchDimensions,
            nextSketchDimensionNumber
          );
          nextSketchDimensionNumber = result.nextSketchDimensionNumber;
          return result.id;
        },
        () => {
          const result = createSketchConstraintId(
            state.sketchConstraints,
            nextSketchConstraintNumber
          );
          nextSketchConstraintNumber = result.nextSketchConstraintNumber;
          return result.id;
        },
        () => {
          const result = createFeatureId(state, nextFeatureNumber);
          nextFeatureNumber = result.nextFeatureNumber;
          return result.id;
        },
        () => {
          const result = createBodyId(state, nextBodyNumber);
          nextBodyNumber = result.nextBodyNumber;
          return result.id;
        },
        opIndex
      );
    } catch (error) {
      if (error instanceof BatchValidationFailure) {
        throwValidationError({
          ...error.validationError,
          opIndex: error.validationError.opIndex ?? opIndex,
          op: error.validationError.op ?? op.op,
          path: error.validationError.path ?? operationPath(opIndex)
        });
      }

      throw error;
    }
  }

  const resultDocument = createCadDocument(
    state.objects,
    state.units,
    state.sketches,
    state.parameters,
    state.sketchDimensions,
    state.sketchConstraints,
    state.features,
    state.namedReferences
  );

  return {
    document: resultDocument,
    diff,
    nextObjectNumber: Math.max(
      nextObjectNumber,
      inferNextObjectNumber(resultDocument)
    ),
    nextSketchNumber: Math.max(
      nextSketchNumber,
      inferNextSketchNumber(resultDocument)
    ),
    nextSketchEntityNumber: Math.max(
      nextSketchEntityNumber,
      inferNextSketchEntityNumber(resultDocument)
    ),
    nextParameterNumber: Math.max(
      nextParameterNumber,
      inferNextParameterNumber(resultDocument)
    ),
    nextSketchDimensionNumber: Math.max(
      nextSketchDimensionNumber,
      inferNextSketchDimensionNumber(resultDocument)
    ),
    nextSketchConstraintNumber: Math.max(
      nextSketchConstraintNumber,
      inferNextSketchConstraintNumber(resultDocument)
    ),
    nextFeatureNumber: Math.max(
      nextFeatureNumber,
      inferNextFeatureNumber(resultDocument)
    ),
    nextBodyNumber: Math.max(
      nextBodyNumber,
      inferNextBodyNumber(resultDocument)
    )
  };
}

function createObjectId(
  objects: ReadonlyMap<ObjectId, SceneObject>,
  initialObjectNumber: number
): { id: ObjectId; nextObjectNumber: number } {
  let nextObjectNumber = initialObjectNumber;
  let id = `obj_${nextObjectNumber}`;

  while (objects.has(id)) {
    nextObjectNumber += 1;
    id = `obj_${nextObjectNumber}`;
  }

  return {
    id,
    nextObjectNumber: nextObjectNumber + 1
  };
}

function createSketchId(
  sketches: ReadonlyMap<SketchId, Sketch>,
  initialSketchNumber: number
): { id: SketchId; nextSketchNumber: number } {
  let nextSketchNumber = initialSketchNumber;
  let id = `sketch_${nextSketchNumber}`;

  while (sketches.has(id)) {
    nextSketchNumber += 1;
    id = `sketch_${nextSketchNumber}`;
  }

  return {
    id,
    nextSketchNumber: nextSketchNumber + 1
  };
}

function createSketchEntityId(
  sketches: ReadonlyMap<SketchId, Sketch>,
  initialSketchEntityNumber: number
): { id: SketchEntityId; nextSketchEntityNumber: number } {
  let nextSketchEntityNumber = initialSketchEntityNumber;
  let id = `skent_${nextSketchEntityNumber}`;

  while (hasSketchEntityId(sketches, id)) {
    nextSketchEntityNumber += 1;
    id = `skent_${nextSketchEntityNumber}`;
  }

  return {
    id,
    nextSketchEntityNumber: nextSketchEntityNumber + 1
  };
}

function hasSketchEntityId(
  sketches: ReadonlyMap<SketchId, Sketch>,
  id: SketchEntityId
): boolean {
  for (const sketch of sketches.values()) {
    if (sketch.entities.has(id)) {
      return true;
    }
  }

  return false;
}

function createParameterId(
  parameters: ReadonlyMap<ParameterId, CadParameter>,
  initialParameterNumber: number
): { id: ParameterId; nextParameterNumber: number } {
  let nextParameterNumber = initialParameterNumber;
  let id = `param_${nextParameterNumber}`;

  while (parameters.has(id)) {
    nextParameterNumber += 1;
    id = `param_${nextParameterNumber}`;
  }

  return {
    id,
    nextParameterNumber: nextParameterNumber + 1
  };
}

function createSketchDimensionId(
  dimensions: ReadonlyMap<SketchDimensionId, SketchDimension>,
  initialSketchDimensionNumber: number
): { id: SketchDimensionId; nextSketchDimensionNumber: number } {
  let nextSketchDimensionNumber = initialSketchDimensionNumber;
  let id = `skdim_${nextSketchDimensionNumber}`;

  while (dimensions.has(id)) {
    nextSketchDimensionNumber += 1;
    id = `skdim_${nextSketchDimensionNumber}`;
  }

  return {
    id,
    nextSketchDimensionNumber: nextSketchDimensionNumber + 1
  };
}

function createSketchConstraintId(
  constraints: ReadonlyMap<SketchConstraintId, SketchConstraint>,
  initialSketchConstraintNumber: number
): { id: SketchConstraintId; nextSketchConstraintNumber: number } {
  let nextSketchConstraintNumber = initialSketchConstraintNumber;
  let id = `skcon_${nextSketchConstraintNumber}`;

  while (constraints.has(id)) {
    nextSketchConstraintNumber += 1;
    id = `skcon_${nextSketchConstraintNumber}`;
  }

  return {
    id,
    nextSketchConstraintNumber: nextSketchConstraintNumber + 1
  };
}

function createFeatureId(
  state: MutableDocumentState,
  initialFeatureNumber: number
): { id: FeatureId; nextFeatureNumber: number } {
  let nextFeatureNumber = initialFeatureNumber;
  let id = `feat_${nextFeatureNumber}`;

  while (hasFeatureId(state, id)) {
    nextFeatureNumber += 1;
    id = `feat_${nextFeatureNumber}`;
  }

  return {
    id,
    nextFeatureNumber: nextFeatureNumber + 1
  };
}

function createBodyId(
  state: MutableDocumentState,
  initialBodyNumber: number
): { id: BodyId; nextBodyNumber: number } {
  let nextBodyNumber = initialBodyNumber;
  let id = `body_${nextBodyNumber}`;

  while (hasBodyId(state, id)) {
    nextBodyNumber += 1;
    id = `body_${nextBodyNumber}`;
  }

  return {
    id,
    nextBodyNumber: nextBodyNumber + 1
  };
}

function toDiffIds(diff: SemanticDiff): {
  createdIds: readonly ObjectId[];
  modifiedIds: readonly ObjectId[];
  deletedIds: readonly ObjectId[];
  createdSketchIds?: readonly SketchId[];
  modifiedSketchIds?: readonly SketchId[];
  deletedSketchIds?: readonly SketchId[];
  createdSketchEntityIds?: readonly SketchEntityId[];
  modifiedSketchEntityIds?: readonly SketchEntityId[];
  deletedSketchEntityIds?: readonly SketchEntityId[];
  createdParameterIds?: readonly ParameterId[];
  modifiedParameterIds?: readonly ParameterId[];
  deletedParameterIds?: readonly ParameterId[];
  createdSketchDimensionIds?: readonly SketchDimensionId[];
  modifiedSketchDimensionIds?: readonly SketchDimensionId[];
  deletedSketchDimensionIds?: readonly SketchDimensionId[];
  createdSketchConstraintIds?: readonly SketchConstraintId[];
  modifiedSketchConstraintIds?: readonly SketchConstraintId[];
  deletedSketchConstraintIds?: readonly SketchConstraintId[];
  createdFeatureIds?: readonly FeatureId[];
  modifiedFeatureIds?: readonly FeatureId[];
  deletedFeatureIds?: readonly FeatureId[];
  createdBodyIds?: readonly BodyId[];
  modifiedBodyIds?: readonly BodyId[];
  deletedBodyIds?: readonly BodyId[];
} {
  return {
    createdIds: uniqueObjectIds(diff.created),
    modifiedIds: uniqueObjectIds(diff.modified),
    deletedIds: uniqueObjectIds(diff.deleted),
    ...toSketchDiffIds(diff.sketches),
    ...toParameterDiffIds(diff.parameters),
    ...toSketchDimensionDiffIds(diff.sketchDimensions),
    ...toSketchConstraintDiffIds(diff.sketchConstraints),
    ...toFeatureDiffIds(diff.features)
  };
}

function uniqueObjectIds(
  objects: readonly CadObjectRef[]
): readonly ObjectId[] {
  return [...new Set(objects.map((object) => object.id))];
}

function toSketchDiffIds(sketches: SketchSemanticDiff | undefined): {
  createdSketchIds?: readonly SketchId[];
  modifiedSketchIds?: readonly SketchId[];
  deletedSketchIds?: readonly SketchId[];
  createdSketchEntityIds?: readonly SketchEntityId[];
  modifiedSketchEntityIds?: readonly SketchEntityId[];
  deletedSketchEntityIds?: readonly SketchEntityId[];
} {
  if (!sketches) {
    return {};
  }

  return {
    ...nonEmptyIdList(
      "createdSketchIds",
      uniqueSketchIds(sketches.created ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedSketchIds",
      uniqueSketchIds(sketches.modified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedSketchIds",
      uniqueSketchIds(sketches.deleted ?? [])
    ),
    ...nonEmptyIdList(
      "createdSketchEntityIds",
      uniqueSketchEntityIds(sketches.entitiesCreated ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedSketchEntityIds",
      uniqueSketchEntityIds(sketches.entitiesModified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedSketchEntityIds",
      uniqueSketchEntityIds(sketches.entitiesDeleted ?? [])
    )
  };
}

function toFeatureDiffIds(features: FeatureSemanticDiff | undefined): {
  createdFeatureIds?: readonly FeatureId[];
  modifiedFeatureIds?: readonly FeatureId[];
  deletedFeatureIds?: readonly FeatureId[];
  createdBodyIds?: readonly BodyId[];
  modifiedBodyIds?: readonly BodyId[];
  deletedBodyIds?: readonly BodyId[];
} {
  if (!features) {
    return {};
  }

  return {
    ...nonEmptyIdList(
      "createdFeatureIds",
      uniqueFeatureIds(features.created ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedFeatureIds",
      uniqueFeatureIds(features.modified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedFeatureIds",
      uniqueFeatureIds(features.deleted ?? [])
    ),
    ...nonEmptyIdList(
      "createdBodyIds",
      uniqueBodyIds(features.bodiesCreated ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedBodyIds",
      uniqueBodyIds(features.bodiesModified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedBodyIds",
      uniqueBodyIds(features.bodiesDeleted ?? [])
    )
  };
}

function toParameterDiffIds(parameters: ParameterSemanticDiff | undefined): {
  createdParameterIds?: readonly ParameterId[];
  modifiedParameterIds?: readonly ParameterId[];
  deletedParameterIds?: readonly ParameterId[];
} {
  if (!parameters) {
    return {};
  }

  return {
    ...nonEmptyIdList(
      "createdParameterIds",
      uniqueParameterIds(parameters.created ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedParameterIds",
      uniqueParameterIds(parameters.modified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedParameterIds",
      uniqueParameterIds(parameters.deleted ?? [])
    )
  };
}

function toSketchDimensionDiffIds(
  dimensions: SketchDimensionSemanticDiff | undefined
): {
  createdSketchDimensionIds?: readonly SketchDimensionId[];
  modifiedSketchDimensionIds?: readonly SketchDimensionId[];
  deletedSketchDimensionIds?: readonly SketchDimensionId[];
} {
  if (!dimensions) {
    return {};
  }

  return {
    ...nonEmptyIdList(
      "createdSketchDimensionIds",
      uniqueSketchDimensionIds(dimensions.created ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedSketchDimensionIds",
      uniqueSketchDimensionIds(dimensions.modified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedSketchDimensionIds",
      uniqueSketchDimensionIds(dimensions.deleted ?? [])
    )
  };
}

function uniqueSketchIds(
  sketches: readonly CadSketchRef[]
): readonly SketchId[] {
  return [...new Set(sketches.map((sketch) => sketch.id))];
}

function uniqueSketchEntityIds(
  entities: readonly CadSketchEntityRef[]
): readonly SketchEntityId[] {
  return [...new Set(entities.map((entity) => entity.id))];
}

function uniqueFeatureIds(
  features: readonly CadFeatureRef[]
): readonly FeatureId[] {
  return [...new Set(features.map((feature) => feature.id))];
}

function uniqueBodyIds(bodies: readonly CadBodyRef[]): readonly BodyId[] {
  return [...new Set(bodies.map((body) => body.id))];
}

function uniqueParameterIds(
  parameters: readonly CadParameterRef[]
): readonly ParameterId[] {
  return [...new Set(parameters.map((parameter) => parameter.id))];
}

function uniqueSketchDimensionIds(
  dimensions: readonly CadSketchDimensionRef[]
): readonly SketchDimensionId[] {
  return [...new Set(dimensions.map((dimension) => dimension.id))];
}

function toSketchConstraintDiffIds(
  constraints: SketchConstraintSemanticDiff | undefined
): {
  createdSketchConstraintIds?: readonly SketchConstraintId[];
  modifiedSketchConstraintIds?: readonly SketchConstraintId[];
  deletedSketchConstraintIds?: readonly SketchConstraintId[];
} {
  if (!constraints) {
    return {};
  }

  return {
    ...nonEmptyIdList(
      "createdSketchConstraintIds",
      uniqueSketchConstraintIds(constraints.created ?? [])
    ),
    ...nonEmptyIdList(
      "modifiedSketchConstraintIds",
      uniqueSketchConstraintIds(constraints.modified ?? [])
    ),
    ...nonEmptyIdList(
      "deletedSketchConstraintIds",
      uniqueSketchConstraintIds(constraints.deleted ?? [])
    )
  };
}

function uniqueSketchConstraintIds(
  constraints: readonly CadSketchConstraintRef[]
): readonly SketchConstraintId[] {
  return [...new Set(constraints.map((constraint) => constraint.id))];
}

function nonEmptyIdList<TKey extends string, TValue extends string>(
  key: TKey,
  values: readonly TValue[]
): { readonly [K in TKey]?: readonly TValue[] } {
  if (values.length === 0) {
    return {};
  }

  return { [key]: values } as { readonly [K in TKey]: readonly TValue[] };
}

function normalizeActorMetadata(actor: unknown): CadActorMetadata | undefined {
  if (actor === undefined) {
    return undefined;
  }

  if (!isRecord(actor)) {
    throwValidationError({
      code: "INVALID_ACTOR",
      message: "Transaction actor metadata must be an object.",
      path: "$.actor",
      expected: "actor metadata object",
      received: describeReceived(actor)
    });
  }

  if (!isCadActorType(actor.type)) {
    throwValidationError({
      code: "INVALID_ACTOR",
      message:
        "Transaction actor type must be human, agent, script, or system.",
      path: "$.actor.type",
      expected: "human, agent, script, or system",
      received: describeReceived(actor.type)
    });
  }

  const normalized: CadActorMetadata = { type: actor.type };

  if (actor.id !== undefined) {
    if (typeof actor.id !== "string" || actor.id.trim().length === 0) {
      throwValidationError({
        code: "INVALID_ACTOR",
        message:
          "Transaction actor id must be a non-empty string when provided.",
        path: "$.actor.id",
        expected: "non-empty string",
        received: describeReceived(actor.id)
      });
    }

    Object.assign(normalized, { id: actor.id.trim() });
  }

  if (actor.name !== undefined) {
    if (typeof actor.name !== "string" || actor.name.trim().length === 0) {
      throwValidationError({
        code: "INVALID_ACTOR",
        message:
          "Transaction actor name must be a non-empty string when provided.",
        path: "$.actor.name",
        expected: "non-empty string",
        received: describeReceived(actor.name)
      });
    }

    Object.assign(normalized, { name: actor.name.trim() });
  }

  return normalized;
}

function normalizeAuditMetadata(
  audit: unknown,
  expectedIntent: CadBatch["mode"],
  expectedOperationCount: number
): CadTransactionAuditMetadata | undefined {
  if (audit === undefined) {
    return undefined;
  }

  if (!isRecord(audit)) {
    throwValidationError({
      code: "INVALID_AUDIT",
      message: "Transaction audit metadata must be an object.",
      path: "$.audit",
      expected: "audit metadata object",
      received: describeReceived(audit)
    });
  }

  if (audit.intent !== expectedIntent) {
    throwValidationError({
      code: "INVALID_AUDIT",
      message: `Transaction audit intent must match batch mode: ${expectedIntent}.`,
      path: "$.audit.intent",
      expected: expectedIntent,
      received: describeReceived(audit.intent)
    });
  }

  if (audit.operationCount !== expectedOperationCount) {
    throwValidationError({
      code: "INVALID_AUDIT",
      message: `Transaction audit operationCount must match batch operation count: ${expectedOperationCount}.`,
      path: "$.audit.operationCount",
      expected: String(expectedOperationCount),
      received: describeReceived(audit.operationCount)
    });
  }

  const normalized: CadTransactionAuditMetadata = {
    intent: expectedIntent,
    operationCount: expectedOperationCount,
    ...normalizeOptionalAuditString(audit.source, "source"),
    ...normalizeOptionalAuditString(audit.requestId, "requestId"),
    ...normalizeOptionalAuditString(audit.toolName, "toolName")
  };

  return normalized;
}

function normalizeOptionalAuditString(
  value: unknown,
  field: "source" | "requestId" | "toolName"
): Partial<CadTransactionAuditMetadata> {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throwValidationError({
      code: "INVALID_AUDIT",
      message: `Transaction audit ${field} must be a non-empty string when present.`,
      path: `$.audit.${field}`,
      expected: "non-empty string",
      received: describeReceived(value)
    });
  }

  return { [field]: value.trim() };
}

function operationPath(opIndex?: number, field?: string): string | undefined {
  if (opIndex === undefined) {
    return field ? `$.${field}` : undefined;
  }

  return field ? `$.ops[${opIndex}].${field}` : `$.ops[${opIndex}]`;
}

function describeReceived(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    value === undefined ||
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function throwValidationError(error: CadBatchValidationError): never {
  throw new BatchValidationFailure(error);
}

class BatchValidationFailure extends Error {
  constructor(readonly validationError: CadBatchValidationError) {
    super(validationError.message);
  }
}

function inferNextObjectNumber(document: CadDocument): number {
  let maxObjectNumber = 0;

  for (const id of document.objects.keys()) {
    maxObjectNumber = Math.max(maxObjectNumber, parseObjectNumber(id));
  }

  return maxObjectNumber + 1;
}

function inferNextSketchNumber(document: CadDocument): number {
  let maxSketchNumber = 0;

  for (const id of document.sketches.keys()) {
    maxSketchNumber = Math.max(maxSketchNumber, parseSketchNumber(id));
  }

  return maxSketchNumber + 1;
}

function inferNextSketchEntityNumber(document: CadDocument): number {
  let maxSketchEntityNumber = 0;

  for (const sketch of document.sketches.values()) {
    for (const id of sketch.entities.keys()) {
      maxSketchEntityNumber = Math.max(
        maxSketchEntityNumber,
        parseSketchEntityNumber(id)
      );
    }
  }

  return maxSketchEntityNumber + 1;
}

function inferNextParameterNumber(document: CadDocument): number {
  let maxParameterNumber = 0;

  for (const id of document.parameters.keys()) {
    maxParameterNumber = Math.max(maxParameterNumber, parseParameterNumber(id));
  }

  return maxParameterNumber + 1;
}

function inferNextSketchDimensionNumber(document: CadDocument): number {
  let maxSketchDimensionNumber = 0;

  for (const id of document.sketchDimensions.keys()) {
    maxSketchDimensionNumber = Math.max(
      maxSketchDimensionNumber,
      parseSketchDimensionNumber(id)
    );
  }

  return maxSketchDimensionNumber + 1;
}

function inferNextSketchConstraintNumber(document: CadDocument): number {
  let maxSketchConstraintNumber = 0;

  for (const id of document.sketchConstraints.keys()) {
    maxSketchConstraintNumber = Math.max(
      maxSketchConstraintNumber,
      parseSketchConstraintNumber(id)
    );
  }

  return maxSketchConstraintNumber + 1;
}

function inferNextFeatureNumber(document: CadDocument): number {
  let maxFeatureNumber = 0;

  for (const id of document.features.keys()) {
    maxFeatureNumber = Math.max(maxFeatureNumber, parseFeatureNumber(id));
  }

  return maxFeatureNumber + 1;
}

function inferNextBodyNumber(document: CadDocument): number {
  let maxBodyNumber = 0;

  for (const feature of document.features.values()) {
    maxBodyNumber = Math.max(maxBodyNumber, parseBodyNumber(feature.bodyId));
  }

  return maxBodyNumber + 1;
}

function parseObjectNumber(id: ObjectId): number {
  const match = /^obj_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseSketchNumber(id: SketchId): number {
  const match = /^sketch_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseSketchEntityNumber(id: SketchEntityId): number {
  const match = /^skent_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseParameterNumber(id: ParameterId): number {
  const match = /^param_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseSketchDimensionNumber(id: SketchDimensionId): number {
  const match = /^skdim_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseSketchConstraintNumber(id: SketchConstraintId): number {
  const match = /^skcon_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseFeatureNumber(id: FeatureId): number {
  const match = /^feat_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function parseBodyNumber(id: BodyId): number {
  const match = /^body_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createProjectState(project: CadProject): {
  readonly document: CadDocument;
  readonly history: TransactionEntry[];
  readonly redoStack: TransactionEntry[];
} {
  assertValidCadProject(project);
  const normalizedProject = normalizeCadProject(project);

  let historyState: {
    readonly document: CadDocument;
    readonly entries: TransactionEntry[];
  };
  let redoEntriesInApplyOrder: {
    readonly document: CadDocument;
    readonly entries: TransactionEntry[];
  };

  try {
    historyState = createTransactionEntries(normalizedProject.history);
  } catch (error) {
    throwProjectTransactionHistoryError("$.history", error);
  }

  if (
    normalizedProject.history.length > 0 ||
    normalizedProject.redoStack.length > 0
  ) {
    assertProjectDocumentMatchesReplay(
      normalizedProject,
      historyState.document
    );
  }

  try {
    redoEntriesInApplyOrder = createTransactionEntries(
      [...normalizedProject.redoStack].reverse(),
      historyState.document,
      normalizedProject.document.nextObjectNumber,
      normalizedProject.document.nextSketchNumber,
      normalizedProject.document.nextSketchEntityNumber,
      normalizedProject.document.nextParameterNumber,
      normalizedProject.document.nextSketchDimensionNumber,
      normalizedProject.document.nextSketchConstraintNumber,
      normalizedProject.document.nextFeatureNumber,
      normalizedProject.document.nextBodyNumber
    );
  } catch (error) {
    throwProjectTransactionHistoryError("$.redoStack", error);
  }

  return {
    document: createCadDocumentFromSnapshot(normalizedProject.document),
    history: historyState.entries,
    redoStack: [...redoEntriesInApplyOrder.entries].reverse()
  };
}

function createTransactionEntries(
  transactions: readonly Transaction[],
  initialDocument: CadDocument = createCadDocument(),
  initialObjectNumber = inferNextObjectNumber(initialDocument),
  initialSketchNumber = inferNextSketchNumber(initialDocument),
  initialSketchEntityNumber = inferNextSketchEntityNumber(initialDocument),
  initialParameterNumber = inferNextParameterNumber(initialDocument),
  initialSketchDimensionNumber = inferNextSketchDimensionNumber(
    initialDocument
  ),
  initialSketchConstraintNumber = inferNextSketchConstraintNumber(
    initialDocument
  ),
  initialFeatureNumber = inferNextFeatureNumber(initialDocument),
  initialBodyNumber = inferNextBodyNumber(initialDocument)
): {
  readonly document: CadDocument;
  readonly entries: TransactionEntry[];
} {
  let document = cloneDocument(initialDocument);
  let nextObjectNumber = initialObjectNumber;
  let nextSketchNumber = initialSketchNumber;
  let nextSketchEntityNumber = initialSketchEntityNumber;
  let nextParameterNumber = initialParameterNumber;
  let nextSketchDimensionNumber = initialSketchDimensionNumber;
  let nextSketchConstraintNumber = initialSketchConstraintNumber;
  let nextFeatureNumber = initialFeatureNumber;
  let nextBodyNumber = initialBodyNumber;
  const entries: TransactionEntry[] = [];

  for (const transaction of transactions) {
    const before = cloneDocument(document);
    const run = runOperations(
      materializeGeneratedObjectIds(transaction),
      document,
      nextObjectNumber,
      nextSketchNumber,
      nextSketchEntityNumber,
      nextParameterNumber,
      nextSketchDimensionNumber,
      nextSketchConstraintNumber,
      nextFeatureNumber,
      nextBodyNumber
    );
    document = run.document;
    nextObjectNumber = run.nextObjectNumber;
    nextSketchNumber = run.nextSketchNumber;
    nextSketchEntityNumber = run.nextSketchEntityNumber;
    nextParameterNumber = run.nextParameterNumber;
    nextSketchDimensionNumber = run.nextSketchDimensionNumber;
    nextSketchConstraintNumber = run.nextSketchConstraintNumber;
    nextFeatureNumber = run.nextFeatureNumber;
    nextBodyNumber = run.nextBodyNumber;

    if (!stableJsonEqual(transaction.diff, run.diff)) {
      throw new Error(
        `Saved transaction diff does not match replayed operations for ${transaction.id}.`
      );
    }

    entries.push({
      transaction: { ...transaction },
      before,
      after: cloneDocument(document)
    });
  }

  return {
    document,
    entries
  };
}

function assertProjectDocumentMatchesReplay(
  project: CadProject,
  replayedDocument: CadDocument
): void {
  const projectDocument = createCadDocumentFromSnapshot(project.document);

  if (cadDocumentsEqual(projectDocument, replayedDocument)) {
    return;
  }

  throw new CadProjectImportError([
    {
      code: "INVALID_TRANSACTION_HISTORY",
      path: "$.history",
      message:
        "Project document does not match replayed committed transaction history."
    }
  ]);
}

function cadDocumentsEqual(left: CadDocument, right: CadDocument): boolean {
  if (
    left.units !== right.units ||
    left.objects.size !== right.objects.size ||
    left.sketches.size !== right.sketches.size ||
    left.parameters.size !== right.parameters.size ||
    left.sketchDimensions.size !== right.sketchDimensions.size ||
    left.sketchConstraints.size !== right.sketchConstraints.size ||
    left.features.size !== right.features.size ||
    left.namedReferences.size !== right.namedReferences.size
  ) {
    return false;
  }

  for (const [id, leftObject] of left.objects) {
    const rightObject = right.objects.get(id);

    if (!rightObject || !sceneObjectsEqual(leftObject, rightObject)) {
      return false;
    }
  }

  for (const [id, leftSketch] of left.sketches) {
    const rightSketch = right.sketches.get(id);

    if (!rightSketch || !sketchesEqual(leftSketch, rightSketch)) {
      return false;
    }
  }

  for (const [id, leftParameter] of left.parameters) {
    const rightParameter = right.parameters.get(id);

    if (!rightParameter || !parametersEqual(leftParameter, rightParameter)) {
      return false;
    }
  }

  for (const [id, leftDimension] of left.sketchDimensions) {
    const rightDimension = right.sketchDimensions.get(id);

    if (
      !rightDimension ||
      !sketchDimensionsEqual(leftDimension, rightDimension)
    ) {
      return false;
    }
  }

  for (const [id, leftConstraint] of left.sketchConstraints) {
    const rightConstraint = right.sketchConstraints.get(id);

    if (
      !rightConstraint ||
      !sketchConstraintsEqual(leftConstraint, rightConstraint)
    ) {
      return false;
    }
  }

  for (const [id, leftFeature] of left.features) {
    const rightFeature = right.features.get(id);

    if (!rightFeature || !featuresEqual(leftFeature, rightFeature)) {
      return false;
    }
  }

  for (const [name, leftReference] of left.namedReferences) {
    const rightReference = right.namedReferences.get(name);

    if (
      !rightReference ||
      !namedReferencesEqual(leftReference, rightReference)
    ) {
      return false;
    }
  }

  return true;
}

function namedReferencesEqual(
  left: NamedGeneratedReferenceSnapshot,
  right: NamedGeneratedReferenceSnapshot
): boolean {
  return (
    left.name === right.name &&
    left.bodyId === right.bodyId &&
    left.stableId === right.stableId &&
    left.kind === right.kind
  );
}

function sceneObjectsEqual(left: SceneObject, right: SceneObject): boolean {
  if (
    left.id !== right.id ||
    left.kind !== right.kind ||
    left.name !== right.name ||
    !transformsEqual(left.transform, right.transform)
  ) {
    return false;
  }

  if (left.kind === "box" && right.kind === "box") {
    return (
      left.dimensions.width === right.dimensions.width &&
      left.dimensions.height === right.dimensions.height &&
      left.dimensions.depth === right.dimensions.depth
    );
  }

  if (left.kind === "cylinder" && right.kind === "cylinder") {
    return (
      left.dimensions.radius === right.dimensions.radius &&
      left.dimensions.height === right.dimensions.height
    );
  }

  if (left.kind === "sphere" && right.kind === "sphere") {
    return left.dimensions.radius === right.dimensions.radius;
  }

  if (left.kind === "cone" && right.kind === "cone") {
    return (
      left.dimensions.radius === right.dimensions.radius &&
      left.dimensions.height === right.dimensions.height
    );
  }

  if (left.kind === "torus" && right.kind === "torus") {
    return (
      left.dimensions.majorRadius === right.dimensions.majorRadius &&
      left.dimensions.minorRadius === right.dimensions.minorRadius
    );
  }

  return false;
}

function transformsEqual(left: Transform, right: Transform): boolean {
  return (
    vec3Equal(left.translation, right.translation) &&
    vec3Equal(left.rotation, right.rotation) &&
    vec3Equal(left.scale, right.scale)
  );
}

function vec3Equal(left: Vec3, right: Vec3): boolean {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

function sketchesEqual(left: Sketch, right: Sketch): boolean {
  if (
    left.id !== right.id ||
    left.name !== right.name ||
    left.plane !== right.plane ||
    !sketchAttachmentsEqual(left.attachment, right.attachment) ||
    left.entities.size !== right.entities.size
  ) {
    return false;
  }

  for (const [id, leftEntity] of left.entities) {
    const rightEntity = right.entities.get(id);

    if (!rightEntity || !sketchEntitiesEqual(leftEntity, rightEntity)) {
      return false;
    }
  }

  return true;
}

function sketchAttachmentsEqual(
  left: SketchAttachmentSnapshot | undefined,
  right: SketchAttachmentSnapshot | undefined
): boolean {
  return stableJsonEqual(left, right);
}

function sketchEntitiesEqual(left: SketchEntity, right: SketchEntity): boolean {
  if (left.id !== right.id || left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "point" && right.kind === "point") {
    return vec2Equal(left.point, right.point);
  }

  if (left.kind === "line" && right.kind === "line") {
    return vec2Equal(left.start, right.start) && vec2Equal(left.end, right.end);
  }

  if (left.kind === "rectangle" && right.kind === "rectangle") {
    return (
      vec2Equal(left.center, right.center) &&
      left.width === right.width &&
      left.height === right.height
    );
  }

  if (left.kind === "circle" && right.kind === "circle") {
    return vec2Equal(left.center, right.center) && left.radius === right.radius;
  }

  return false;
}

function parametersEqual(left: CadParameter, right: CadParameter): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.value === right.value &&
    left.description === right.description
  );
}

function sketchDimensionsEqual(
  left: SketchDimension,
  right: SketchDimension
): boolean {
  return stableJsonEqual(left, right);
}

function sketchConstraintsEqual(
  left: SketchConstraint,
  right: SketchConstraint
): boolean {
  return stableJsonEqual(left, right);
}

function vec2Equal(left: Vec2, right: Vec2): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function featuresEqual(left: Feature, right: Feature): boolean {
  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.name === right.name &&
    left.sketchId === right.sketchId &&
    left.entityId === right.entityId &&
    left.profileKind === right.profileKind &&
    left.depth === right.depth &&
    left.side === right.side &&
    left.operationMode === right.operationMode &&
    left.targetBodyId === right.targetBodyId &&
    left.bodyId === right.bodyId
  );
}

function parseCadProject(value: unknown): CadProject {
  assertValidCadProject(value);
  return normalizeCadProject(value);
}

function assertValidCadProject(value: unknown): asserts value is CadProject {
  const issues = validateCadProject(value);

  if (issues.length > 0) {
    throw new CadProjectImportError(issues);
  }
}

function normalizeCadProject(value: CadProject): CadProject {
  if (value.schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION) {
    return {
      ...value,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: value.document.sketchConstraints.map(
          cloneSketchConstraintSnapshot
        ),
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        )
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: value.document.sketchConstraints.map(
          cloneSketchConstraintSnapshot
        ),
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        )
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: value.document.sketchConstraints.map(
          cloneSketchConstraintSnapshot
        ),
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        )
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: value.document.sketchConstraints.map(
          cloneSketchConstraintSnapshot
        ),
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        )
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: value.document.parameters.map(cloneParameterSnapshot),
        sketchDimensions: value.document.sketchDimensions.map(
          cloneSketchDimensionSnapshot
        ),
        sketchConstraints: [],
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        ),
        nextSketchConstraintNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V5) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        ),
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V6) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: value.document.namedReferences.map(
          cloneNamedReferenceSnapshot
        ),
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V4) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: [],
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V3) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: value.document.features.map(normalizeFeatureSnapshot),
        namedReferences: [],
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  if (value.schemaVersion === CAD_PROJECT_FORMAT_VERSION_V2) {
    return {
      ...value,
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      document: {
        ...value.document,
        parameters: [],
        sketchDimensions: [],
        sketchConstraints: [],
        features: [],
        namedReferences: [],
        nextParameterNumber: 1,
        nextSketchDimensionNumber: 1,
        nextSketchConstraintNumber: 1,
        nextFeatureNumber: 1,
        nextBodyNumber: 1
      },
      history: value.history.map(normalizeTransactionSnapshot),
      redoStack: value.redoStack.map(normalizeTransactionSnapshot)
    };
  }

  return {
    ...value,
    schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
    document: {
      ...value.document,
      sketches: [],
      parameters: [],
      sketchDimensions: [],
      sketchConstraints: [],
      features: [],
      namedReferences: [],
      nextSketchNumber: 1,
      nextSketchEntityNumber: 1,
      nextParameterNumber: 1,
      nextSketchDimensionNumber: 1,
      nextSketchConstraintNumber: 1,
      nextFeatureNumber: 1,
      nextBodyNumber: 1
    },
    history: value.history.map(normalizeTransactionSnapshot),
    redoStack: value.redoStack.map(normalizeTransactionSnapshot)
  };
}

function normalizeFeatureSnapshot(
  feature: ExtrudeFeatureSnapshot
): ExtrudeFeatureSnapshot {
  return {
    ...feature,
    side: feature.side ?? "positive",
    operationMode: feature.operationMode ?? "newBody"
  };
}

function normalizeTransactionSnapshot(transaction: Transaction): Transaction {
  return {
    ...transaction,
    ops: transaction.ops.map(normalizeCadOpSnapshot),
    diff: normalizeSemanticDiffSnapshot(transaction.diff)
  };
}

function normalizeCadOpSnapshot(op: CadOp): CadOp {
  if (op.op !== "feature.extrude") {
    return op;
  }

  return {
    ...op,
    side: op.side ?? "positive",
    operationMode: op.operationMode ?? "newBody"
  };
}

function normalizeSemanticDiffSnapshot(diff: SemanticDiff): SemanticDiff {
  if (!diff.features) {
    return diff;
  }

  return {
    ...diff,
    features: {
      ...diff.features,
      ...(diff.features.created
        ? {
            created: diff.features.created.map(normalizeFeatureRefSnapshot)
          }
        : {}),
      ...(diff.features.modified
        ? {
            modified: diff.features.modified.map(normalizeFeatureRefSnapshot)
          }
        : {}),
      ...(diff.features.deleted
        ? {
            deleted: diff.features.deleted.map(normalizeFeatureRefSnapshot)
          }
        : {})
    }
  };
}

function normalizeFeatureRefSnapshot(ref: CadFeatureRef): CadFeatureRef {
  return {
    ...ref,
    side: ref.side ?? "positive",
    operationMode: ref.operationMode ?? "newBody"
  };
}

function stableJsonEqual(left: unknown, right: unknown): boolean {
  return stableJsonStringify(left) === stableJsonStringify(right);
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortPlainJson(value));
}

function sortPlainJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortPlainJson);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortPlainJson(value[key])])
  );
}

function validateCadProject(value: unknown): readonly CadProjectImportIssue[] {
  const issues: CadProjectImportIssue[] = [];

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_PROJECT",
      "$",
      "Project root must be an object."
    );
    return issues;
  }

  if (typeof value.schemaVersion !== "string") {
    addProjectIssue(
      issues,
      "INVALID_PROJECT",
      "$.schemaVersion",
      "Project schemaVersion must be a string."
    );
  } else if (
    value.schemaVersion !== CURRENT_CAD_PROJECT_FORMAT_VERSION &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V7 &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V6 &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V5 &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V4 &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V3 &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V2 &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V10 &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V9 &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V8 &&
    value.schemaVersion !== CAD_PROJECT_FORMAT_VERSION_V1
  ) {
    addProjectIssue(
      issues,
      "UNSUPPORTED_PROJECT_VERSION",
      "$.schemaVersion",
      `Unsupported project schemaVersion: ${value.schemaVersion}.`
    );
  }

  validateCadDocumentSnapshot(
    value.document,
    "$.document",
    issues,
    value.schemaVersion
  );

  const seenTransactionIds = new Set<TransactionId>();
  validateTransactionArray(
    value.history,
    "$.history",
    issues,
    "committed",
    seenTransactionIds
  );
  validateTransactionArray(
    value.redoStack,
    "$.redoStack",
    issues,
    "undone",
    seenTransactionIds
  );

  return issues;
}

function validateCadDocumentSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  schemaVersion: unknown
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      path,
      "Project document must be an object."
    );
    return;
  }

  if (!isDocumentUnits(value.units)) {
    addProjectIssue(
      issues,
      "INVALID_UNITS",
      `${path}.units`,
      "Document units must be one of: mm, cm, m, in."
    );
  }

  let maxGeneratedObjectNumber = 0;
  let maxGeneratedSketchNumber = 0;
  let maxGeneratedSketchEntityNumber = 0;
  let maxGeneratedParameterNumber = 0;
  let maxGeneratedSketchDimensionNumber = 0;
  let maxGeneratedSketchConstraintNumber = 0;
  let maxGeneratedFeatureNumber = 0;
  let maxGeneratedBodyNumber = 0;
  const primitiveFeatureIds = new Set<string>();
  const primitiveBodyIds = new Set<string>();

  if (!Array.isArray(value.objects)) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      `${path}.objects`,
      "Document objects must be an array."
    );
  } else {
    const seenObjectIds = new Set<string>();

    for (const [index, object] of value.objects.entries()) {
      validateSceneObject(
        object,
        `${path}.objects[${index}]`,
        issues,
        seenObjectIds
      );

      if (isRecord(object) && typeof object.id === "string") {
        maxGeneratedObjectNumber = Math.max(
          maxGeneratedObjectNumber,
          parseObjectNumber(object.id)
        );
        primitiveFeatureIds.add(createPrimitiveFeatureId(object.id));
        primitiveBodyIds.add(createPrimitiveBodyId(object.id));
      }
    }
  }

  const nextObjectNumber = value.nextObjectNumber;
  const hasValidNextObjectNumber =
    typeof nextObjectNumber === "number" &&
    Number.isInteger(nextObjectNumber) &&
    nextObjectNumber > 0;

  if (!hasValidNextObjectNumber) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      `${path}.nextObjectNumber`,
      "Document nextObjectNumber must be a positive integer."
    );
  } else if (nextObjectNumber <= maxGeneratedObjectNumber) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      `${path}.nextObjectNumber`,
      "Document nextObjectNumber must be greater than existing generated object ids."
    );
  }

  const requiresSketches =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V2 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V3 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V4 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V5 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V6 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const requiresFeatures =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V3 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V4 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V5 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V6 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const allowsSketchAttachments =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V4 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V5 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V6 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const requiresNamedReferences =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V5 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V6 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const requiresParameters =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const requiresSketchConstraints =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const allowsFixedSketchConstraints =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const allowsCoincidentSketchConstraints =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const allowsMidpointSketchConstraints =
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const isKnownProjectVersion =
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V1 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V2 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V3 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V4 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V5 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V6 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V7 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V8 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V9 ||
    schemaVersion === CAD_PROJECT_FORMAT_VERSION_V10 ||
    schemaVersion === CURRENT_CAD_PROJECT_FORMAT_VERSION;
  const seenSketchIds = new Set<string>();
  const extrudeFeatureByBodyId = new Map<BodyId, ExtrudeFeatureSnapshot>();
  const authoredFeatureByBodyId = new Map<
    BodyId,
    ExtrudeFeatureSnapshot & { readonly path: string }
  >();
  const sketchEntityRefs = new Map<SketchEntityId, SketchEntityImportRef>();
  const sketchAttachments: {
    readonly path: string;
    readonly attachment: SketchAttachmentSnapshot;
  }[] = [];

  if (schemaVersion === CAD_PROJECT_FORMAT_VERSION_V1) {
    if ("sketches" in value) {
      addProjectIssue(
        issues,
        "INVALID_DOCUMENT",
        `${path}.sketches`,
        "V1 project documents must not include sketch source data."
      );
    }

    if ("features" in value) {
      addProjectIssue(
        issues,
        "INVALID_DOCUMENT",
        `${path}.features`,
        "V1 project documents must not include authored feature source data."
      );
    }
  }

  if (schemaVersion === CAD_PROJECT_FORMAT_VERSION_V2 && "features" in value) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      `${path}.features`,
      "V2 project documents must not include authored feature source data."
    );
  }

  if (
    isKnownProjectVersion &&
    !requiresNamedReferences &&
    "namedReferences" in value
  ) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      `${path}.namedReferences`,
      "Project documents before V5 must not include named generated references."
    );
  }

  if (isKnownProjectVersion && !requiresParameters) {
    if ("parameters" in value) {
      addProjectIssue(
        issues,
        "INVALID_DOCUMENT",
        `${path}.parameters`,
        "Project documents before V7 must not include parameter source data."
      );
    }

    if ("sketchDimensions" in value) {
      addProjectIssue(
        issues,
        "INVALID_DOCUMENT",
        `${path}.sketchDimensions`,
        "Project documents before V7 must not include sketch dimension source data."
      );
    }
  }

  if (isKnownProjectVersion && !requiresSketchConstraints) {
    if ("sketchConstraints" in value) {
      addProjectIssue(
        issues,
        "INVALID_DOCUMENT",
        `${path}.sketchConstraints`,
        "Project documents before V8 must not include sketch constraint source data."
      );
    }
  }

  if (requiresSketches) {
    if (!Array.isArray(value.sketches)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.sketches`,
        "Document sketches must be an array."
      );
    } else {
      const seenSketchEntityIds = new Set<string>();

      for (const [index, sketch] of value.sketches.entries()) {
        const generatedNumbers = validateSketchSnapshot(
          sketch,
          `${path}.sketches[${index}]`,
          issues,
          seenSketchIds,
          seenSketchEntityIds,
          allowsSketchAttachments,
          sketchAttachments
        );
        maxGeneratedSketchNumber = Math.max(
          maxGeneratedSketchNumber,
          generatedNumbers.maxGeneratedSketchNumber
        );
        maxGeneratedSketchEntityNumber = Math.max(
          maxGeneratedSketchEntityNumber,
          generatedNumbers.maxGeneratedSketchEntityNumber
        );
        collectSketchEntityRefs(sketch, sketchEntityRefs);
      }
    }

    validateNextGeneratedNumber(
      value.nextSketchNumber,
      `${path}.nextSketchNumber`,
      "Document nextSketchNumber",
      "generated sketch ids",
      maxGeneratedSketchNumber,
      issues
    );
    validateNextGeneratedNumber(
      value.nextSketchEntityNumber,
      `${path}.nextSketchEntityNumber`,
      "Document nextSketchEntityNumber",
      "generated sketch entity ids",
      maxGeneratedSketchEntityNumber,
      issues
    );
  }

  const seenParameterIds = new Set<string>();
  const parameterValues = new Map<ParameterId, number>();

  if (requiresParameters) {
    if (!Array.isArray(value.parameters)) {
      addProjectIssue(
        issues,
        "INVALID_PARAMETER",
        `${path}.parameters`,
        "Document parameters must be an array."
      );
    } else {
      for (const [index, parameter] of value.parameters.entries()) {
        maxGeneratedParameterNumber = Math.max(
          maxGeneratedParameterNumber,
          validateParameterSnapshot(
            parameter,
            `${path}.parameters[${index}]`,
            issues,
            seenParameterIds
          )
        );

        if (
          isRecord(parameter) &&
          typeof parameter.id === "string" &&
          typeof parameter.value === "number" &&
          Number.isFinite(parameter.value)
        ) {
          parameterValues.set(parameter.id, parameter.value);
        }
      }
    }

    if (!Array.isArray(value.sketchDimensions)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.sketchDimensions`,
        "Document sketchDimensions must be an array."
      );
    } else {
      const seenSketchDimensionIds = new Set<string>();
      const seenSketchDimensionTargets = new Set<string>();
      for (const [index, dimension] of value.sketchDimensions.entries()) {
        maxGeneratedSketchDimensionNumber = Math.max(
          maxGeneratedSketchDimensionNumber,
          validateSketchDimensionSnapshot(
            dimension,
            `${path}.sketchDimensions[${index}]`,
            issues,
            seenSketchDimensionIds,
            seenSketchDimensionTargets,
            seenSketchIds,
            sketchEntityRefs,
            seenParameterIds,
            parameterValues
          )
        );
      }
    }

    validateNextGeneratedNumber(
      value.nextParameterNumber,
      `${path}.nextParameterNumber`,
      "Document nextParameterNumber",
      "generated parameter ids",
      maxGeneratedParameterNumber,
      issues
    );
    validateNextGeneratedNumber(
      value.nextSketchDimensionNumber,
      `${path}.nextSketchDimensionNumber`,
      "Document nextSketchDimensionNumber",
      "generated sketch dimension ids",
      maxGeneratedSketchDimensionNumber,
      issues
    );
  }

  if (requiresSketchConstraints) {
    if (!Array.isArray(value.sketchConstraints)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.sketchConstraints`,
        "Document sketchConstraints must be an array."
      );
    } else {
      const seenSketchConstraintIds = new Set<string>();
      const seenSketchConstraintTargets = new Map<
        string,
        SketchConstraintKind
      >();
      const seenFixedSketchConstraintCoordinates = new Map<string, Vec2>();
      const seenCoincidentConstraintTargets: {
        readonly path: string;
        readonly sketchId: SketchId;
        readonly primaryTarget: SketchPointTarget;
        readonly secondaryTarget: SketchPointTarget;
      }[] = [];
      for (const [index, constraint] of value.sketchConstraints.entries()) {
        maxGeneratedSketchConstraintNumber = Math.max(
          maxGeneratedSketchConstraintNumber,
          validateSketchConstraintSnapshot(
            constraint,
            `${path}.sketchConstraints[${index}]`,
            issues,
            seenSketchConstraintIds,
            seenSketchConstraintTargets,
            seenFixedSketchConstraintCoordinates,
            seenCoincidentConstraintTargets,
            seenSketchIds,
            sketchEntityRefs,
            allowsFixedSketchConstraints,
            allowsCoincidentSketchConstraints,
            allowsMidpointSketchConstraints
          )
        );
      }
    }

    validateNextGeneratedNumber(
      value.nextSketchConstraintNumber,
      `${path}.nextSketchConstraintNumber`,
      "Document nextSketchConstraintNumber",
      "generated sketch constraint ids",
      maxGeneratedSketchConstraintNumber,
      issues
    );
  }

  if (requiresFeatures) {
    if (!Array.isArray(value.features)) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.features`,
        "Document features must be an array."
      );
    } else {
      const seenFeatureIds = new Set<string>(primitiveFeatureIds);
      const seenBodyIds = new Set<string>(primitiveBodyIds);
      for (const [index, feature] of value.features.entries()) {
        const generatedNumbers = validateFeatureSnapshot(
          feature,
          `${path}.features[${index}]`,
          issues,
          seenFeatureIds,
          seenBodyIds,
          seenSketchIds,
          sketchEntityRefs
        );
        maxGeneratedFeatureNumber = Math.max(
          maxGeneratedFeatureNumber,
          generatedNumbers.maxGeneratedFeatureNumber
        );
        maxGeneratedBodyNumber = Math.max(
          maxGeneratedBodyNumber,
          generatedNumbers.maxGeneratedBodyNumber
        );
        collectValidExtrudeFeatureByBodyId(feature, extrudeFeatureByBodyId);
        collectValidAuthoredFeatureByBodyId(
          feature,
          `${path}.features[${index}]`,
          authoredFeatureByBodyId
        );
      }

      validateFeatureTargetBodyReferences(authoredFeatureByBodyId, issues);
      validateSketchAttachments(
        sketchAttachments,
        extrudeFeatureByBodyId,
        issues
      );
    }

    validateNextGeneratedNumber(
      value.nextFeatureNumber,
      `${path}.nextFeatureNumber`,
      "Document nextFeatureNumber",
      "generated feature ids",
      maxGeneratedFeatureNumber,
      issues
    );
    validateNextGeneratedNumber(
      value.nextBodyNumber,
      `${path}.nextBodyNumber`,
      "Document nextBodyNumber",
      "generated body ids",
      maxGeneratedBodyNumber,
      issues
    );
  }

  if (requiresNamedReferences) {
    if (!Array.isArray(value.namedReferences)) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${path}.namedReferences`,
        "Document namedReferences must be an array."
      );
    } else {
      validateNamedReferenceSnapshots(
        value.namedReferences,
        `${path}.namedReferences`,
        issues
      );
    }
  }
}

function validateSceneObject(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenObjectIds: Set<string>
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_OBJECT",
      path,
      "Scene object must be an object."
    );
    return;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_OBJECT",
      `${path}.id`,
      "Scene object id must be a non-empty string."
    );
  } else if (seenObjectIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_OBJECT",
      `${path}.id`,
      `Duplicate scene object id: ${value.id}.`
    );
  } else {
    seenObjectIds.add(value.id);
  }

  validateOptionalObjectName(value.name, `${path}.name`, issues);

  if (value.kind === "box") {
    validateBoxDimensionsShape(value.dimensions, `${path}.dimensions`, issues);
  } else if (value.kind === "cylinder") {
    validateCylinderDimensionsShape(
      value.dimensions,
      `${path}.dimensions`,
      issues
    );
  } else if (value.kind === "sphere") {
    validateSphereDimensionsShape(
      value.dimensions,
      `${path}.dimensions`,
      issues
    );
  } else if (value.kind === "cone") {
    validateConeDimensionsShape(value.dimensions, `${path}.dimensions`, issues);
  } else if (value.kind === "torus") {
    validateTorusDimensionsShape(
      value.dimensions,
      `${path}.dimensions`,
      issues
    );
  } else {
    addProjectIssue(
      issues,
      "INVALID_OBJECT",
      `${path}.kind`,
      "Scene object kind must be box, cylinder, sphere, cone, or torus."
    );
  }

  validateTransformShape(value.transform, `${path}.transform`, issues);
}

function validateSketchSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenSketchIds: Set<string>,
  seenSketchEntityIds: Set<string>,
  allowsAttachment: boolean,
  attachments: {
    readonly path: string;
    readonly attachment: SketchAttachmentSnapshot;
  }[]
): {
  readonly maxGeneratedSketchNumber: number;
  readonly maxGeneratedSketchEntityNumber: number;
} {
  let maxGeneratedSketchNumber = 0;
  let maxGeneratedSketchEntityNumber = 0;

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      path,
      "Sketch must be an object."
    );
    return { maxGeneratedSketchNumber, maxGeneratedSketchEntityNumber };
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      `${path}.id`,
      "Sketch id must be a non-empty string."
    );
  } else if (seenSketchIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      `${path}.id`,
      `Duplicate sketch id: ${value.id}.`
    );
  } else {
    seenSketchIds.add(value.id);
    maxGeneratedSketchNumber = Math.max(
      maxGeneratedSketchNumber,
      parseSketchNumber(value.id)
    );
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_NAME",
      `${path}.name`,
      "Sketch name must be a non-empty string."
    );
  }

  if (!isSketchPlane(value.plane)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      `${path}.plane`,
      "Sketch plane must be XY, XZ, or YZ."
    );
  }

  if (value.attachment !== undefined) {
    if (!allowsAttachment) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.attachment`,
        "Sketch attachments require web-cad.project.v4."
      );
    } else if (
      validateSketchAttachmentSnapshot(
        value.attachment,
        `${path}.attachment`,
        issues
      )
    ) {
      attachments.push({
        path: `${path}.attachment`,
        attachment: value.attachment
      });
    }
  }

  if (!Array.isArray(value.entities)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      `${path}.entities`,
      "Sketch entities must be an array."
    );
  } else {
    for (const [index, entity] of value.entities.entries()) {
      maxGeneratedSketchEntityNumber = Math.max(
        maxGeneratedSketchEntityNumber,
        validateSketchEntitySnapshot(
          entity,
          `${path}.entities[${index}]`,
          issues,
          seenSketchEntityIds
        )
      );
    }
  }

  return { maxGeneratedSketchNumber, maxGeneratedSketchEntityNumber };
}

function validateSketchAttachmentSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): value is SketchAttachmentSnapshot {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      path,
      "Sketch attachment must be an object."
    );
    return false;
  }

  let valid = true;

  if (value.kind !== "generatedFace") {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      `${path}.kind`,
      "Sketch attachment kind must be generatedFace."
    );
    valid = false;
  }

  for (const field of [
    "bodyId",
    "faceStableId",
    "sourceFeatureId",
    "sourceSketchId",
    "sourceSketchEntityId"
  ] as const) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.${field}`,
        `Sketch attachment ${field} must be a non-empty string.`
      );
      valid = false;
    }
  }

  if (
    !isGeneratedExtrudeFaceRole(value.faceRole) ||
    value.faceRole === "side:circular"
  ) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH",
      `${path}.faceRole`,
      "Sketch attachment faceRole must be a generated planar face role."
    );
    valid = false;
  }

  return valid;
}

function validateParameterSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenParameterIds: Set<string>
): number {
  let maxGeneratedParameterNumber = 0;

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      path,
      "Parameter must be an object."
    );
    return maxGeneratedParameterNumber;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      `${path}.id`,
      "Parameter id must be a non-empty string."
    );
  } else if (seenParameterIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      `${path}.id`,
      `Duplicate parameter id: ${value.id}.`
    );
  } else {
    seenParameterIds.add(value.id);
    maxGeneratedParameterNumber = parseParameterNumber(value.id);
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      `${path}.name`,
      "Parameter name must be a non-empty string."
    );
  }

  if (typeof value.value !== "number" || !Number.isFinite(value.value)) {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      `${path}.value`,
      "Parameter value must be a finite number."
    );
  }

  if (
    value.description !== undefined &&
    (typeof value.description !== "string" || value.description.trim() === "")
  ) {
    addProjectIssue(
      issues,
      "INVALID_PARAMETER",
      `${path}.description`,
      "Parameter description must be a non-empty string when present."
    );
  }

  return maxGeneratedParameterNumber;
}

function validateSketchDimensionSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenSketchDimensionIds: Set<string>,
  seenSketchDimensionTargets: Set<string>,
  seenSketchIds: ReadonlySet<string>,
  sketchEntityRefs: ReadonlyMap<SketchEntityId, SketchEntityImportRef>,
  seenParameterIds: ReadonlySet<string>,
  parameterValues: ReadonlyMap<ParameterId, number>
): number {
  let maxGeneratedSketchDimensionNumber = 0;
  let entityRef: SketchEntityImportRef | undefined;
  let targetIsValid = false;

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      path,
      "Sketch dimension must be an object."
    );
    return maxGeneratedSketchDimensionNumber;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.id`,
      "Sketch dimension id must be a non-empty string."
    );
  } else if (seenSketchDimensionIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.id`,
      `Duplicate sketch dimension id: ${value.id}.`
    );
  } else {
    seenSketchDimensionIds.add(value.id);
    maxGeneratedSketchDimensionNumber = parseSketchDimensionNumber(value.id);
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.name`,
      "Sketch dimension name must be a non-empty string."
    );
  }

  if (typeof value.sketchId !== "string" || value.sketchId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.sketchId`,
      "Sketch dimension sketchId must be a non-empty string."
    );
  } else if (!seenSketchIds.has(value.sketchId)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.sketchId`,
      "Sketch dimension sketchId must reference an existing sketch."
    );
  }

  if (typeof value.entityId !== "string" || value.entityId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      `${path}.entityId`,
      "Sketch dimension entityId must be a non-empty string."
    );
  } else {
    entityRef = sketchEntityRefs.get(value.entityId);

    if (!entityRef) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.entityId`,
        "Sketch dimension entityId must reference an existing sketch entity."
      );
    } else {
      if (entityRef.sketchId !== value.sketchId) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_DIMENSION",
          `${path}.entityId`,
          "Sketch dimension entityId must belong to the referenced sketch."
        );
      }

      targetIsValid = validateSketchDimensionTargetShape(
        value.target,
        `${path}.target`,
        entityRef.kind,
        issues
      );
    }
  }

  const effectiveValue = validateSketchDimensionValueSourceSnapshot(
    value.valueSource,
    `${path}.valueSource`,
    seenParameterIds,
    parameterValues,
    issues
  );

  if (
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    targetIsValid &&
    entityRef &&
    isSketchDimensionTarget(value.target)
  ) {
    const targetKey = getSketchDimensionTargetKey({
      sketchId: value.sketchId,
      entityId: value.entityId,
      target: value.target
    });

    if (seenSketchDimensionTargets.has(targetKey)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.target`,
        "Sketch dimension target is already driven by another dimension."
      );
    } else {
      seenSketchDimensionTargets.add(targetKey);
    }

    if (effectiveValue !== undefined) {
      const entityValue = getImportedSketchDimensionTargetValue(
        entityRef.entity,
        value.target
      );

      if (
        entityValue !== undefined &&
        cleanMeasurementNumber(entityValue) !==
          cleanMeasurementNumber(effectiveValue)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_DIMENSION",
          `${path}.valueSource`,
          "Sketch dimension effective value must match the saved target entity value."
        );
      }
    }
  }

  return maxGeneratedSketchDimensionNumber;
}

function validateSketchDimensionTargetShape(
  value: unknown,
  path: string,
  entityKind: SketchEntityKind,
  issues: CadProjectImportIssue[]
): boolean {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      path,
      "Sketch dimension target must be an object."
    );
    return false;
  }

  const valid =
    (entityKind === "rectangle" &&
      value.entityKind === "rectangle" &&
      (value.role === "width" || value.role === "height")) ||
    (entityKind === "circle" &&
      value.entityKind === "circle" &&
      value.role === "radius") ||
    (entityKind === "line" &&
      value.entityKind === "line" &&
      value.role === "length");

  if (!valid) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      path,
      "Sketch dimension target must match a supported rectangle width/height, circle radius, or line length role."
    );
  }

  return valid;
}

function validateSketchPointTargetSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): SketchPointTarget | undefined {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      path,
      "Fixed sketch constraint target must be an object."
    );
    return undefined;
  }

  if (typeof value.entityId !== "string" || value.entityId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.entityId`,
      "Fixed sketch constraint target entityId must be a non-empty string."
    );
  }

  if (!isSketchPointTargetRole(value.role)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.role`,
      "Fixed sketch constraint target role must be position, start, end, or center."
    );
  }

  return typeof value.entityId === "string" &&
    isSketchPointTargetRole(value.role)
    ? {
        entityId: value.entityId,
        role: value.role
      }
    : undefined;
}

function isSketchPointTargetSupportedForImport(
  entityKind: SketchEntityKind,
  target: SketchPointTarget
): boolean {
  return (
    (entityKind === "point" && target.role === "position") ||
    (entityKind === "line" &&
      (target.role === "start" || target.role === "end")) ||
    ((entityKind === "rectangle" || entityKind === "circle") &&
      target.role === "center")
  );
}

function isMidpointSketchPointTargetSupportedForImport(
  entityKind: SketchEntityKind,
  target: SketchPointTarget
): boolean {
  return (
    (entityKind === "point" && target.role === "position") ||
    ((entityKind === "rectangle" || entityKind === "circle") &&
      target.role === "center")
  );
}

function getImportSketchPointTargetCoordinate(
  entity: Record<string, unknown>,
  target: SketchPointTarget
): Vec2 | undefined {
  if (target.role === "position" && isVec2(entity.point)) {
    return entity.point;
  }

  if (target.role === "start" && isVec2(entity.start)) {
    return entity.start;
  }

  if (target.role === "end" && isVec2(entity.end)) {
    return entity.end;
  }

  if (target.role === "center" && isVec2(entity.center)) {
    return entity.center;
  }

  return undefined;
}

function validateSketchConstraintSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenSketchConstraintIds: Set<string>,
  seenSketchConstraintTargets: Map<string, SketchConstraintKind>,
  seenFixedSketchConstraintCoordinates: Map<string, Vec2>,
  seenCoincidentConstraintTargets: {
    readonly path: string;
    readonly sketchId: SketchId;
    readonly primaryTarget: SketchPointTarget;
    readonly secondaryTarget: SketchPointTarget;
  }[],
  seenSketchIds: ReadonlySet<string>,
  sketchEntityRefs: ReadonlyMap<SketchEntityId, SketchEntityImportRef>,
  allowsFixedConstraints: boolean,
  allowsCoincidentConstraints: boolean,
  allowsMidpointConstraints: boolean
): number {
  let maxGeneratedSketchConstraintNumber = 0;
  let entityRef: SketchEntityImportRef | undefined;
  let entityId: string | undefined;
  let target: SketchPointTarget | undefined;
  let primaryTarget: SketchPointTarget | undefined;
  let secondaryTarget: SketchPointTarget | undefined;
  let lineEntityRef: SketchEntityImportRef | undefined;
  let lineEntityId: string | undefined;

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      path,
      "Sketch constraint must be an object."
    );
    return maxGeneratedSketchConstraintNumber;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.id`,
      "Sketch constraint id must be a non-empty string."
    );
  } else if (seenSketchConstraintIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.id`,
      `Duplicate sketch constraint id: ${value.id}.`
    );
  } else {
    seenSketchConstraintIds.add(value.id);
    maxGeneratedSketchConstraintNumber = parseSketchConstraintNumber(value.id);
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.name`,
      "Sketch constraint name must be a non-empty string."
    );
  }

  if (typeof value.sketchId !== "string" || value.sketchId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.sketchId`,
      "Sketch constraint sketchId must be a non-empty string."
    );
  } else if (!seenSketchIds.has(value.sketchId)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.sketchId`,
      "Sketch constraint sketchId must reference an existing sketch."
    );
  }

  if (!isSketchConstraintKind(value.kind)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.kind`,
      "Sketch constraint kind must be horizontal, vertical, fixed, coincident, or midpoint."
    );
  }

  if (value.kind === "fixed") {
    if (!allowsFixedConstraints) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.kind`,
        "Project documents before V9 must not include fixed sketch constraints."
      );
    }

    target = validateSketchPointTargetSnapshot(
      value.target,
      `${path}.target`,
      issues
    );
    entityId = target?.entityId;

    if (
      typeof value.entityId === "string" &&
      target &&
      value.entityId !== target.entityId
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.entityId`,
        "Fixed sketch constraint entityId must match target.entityId."
      );
    }

    if (!isVec2(value.coordinate)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.coordinate`,
        "Fixed sketch constraint coordinate must be a finite Vec2."
      );
    }
  } else if (value.kind === "coincident") {
    if (!allowsCoincidentConstraints) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.kind`,
        "Project documents before V10 must not include coincident sketch constraints."
      );
    }

    primaryTarget = validateSketchPointTargetSnapshot(
      value.primaryTarget,
      `${path}.primaryTarget`,
      issues
    );
    secondaryTarget = validateSketchPointTargetSnapshot(
      value.secondaryTarget,
      `${path}.secondaryTarget`,
      issues
    );
    entityId = primaryTarget?.entityId;

    if (
      typeof value.entityId === "string" &&
      primaryTarget &&
      value.entityId !== primaryTarget.entityId
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.entityId`,
        "Coincident sketch constraint entityId must match primaryTarget.entityId."
      );
    }

    if (
      primaryTarget &&
      secondaryTarget &&
      sketchPointTargetsEqual(primaryTarget, secondaryTarget)
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.secondaryTarget`,
        "Coincident sketch constraint targets must be distinct."
      );
    }
  } else if (value.kind === "midpoint") {
    if (!allowsMidpointConstraints) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.kind`,
        "Project documents before V11 must not include midpoint sketch constraints."
      );
    }

    if (
      typeof value.lineEntityId !== "string" ||
      value.lineEntityId.length === 0
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.lineEntityId`,
        "Midpoint sketch constraint lineEntityId must be a non-empty string."
      );
    } else {
      lineEntityId = value.lineEntityId;
    }

    target = validateSketchPointTargetSnapshot(
      value.target,
      `${path}.target`,
      issues
    );
    entityId = lineEntityId;

    if (
      typeof value.entityId === "string" &&
      lineEntityId &&
      value.entityId !== lineEntityId
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.entityId`,
        "Midpoint sketch constraint entityId must match lineEntityId."
      );
    }
  } else if (typeof value.entityId === "string" && value.entityId.length > 0) {
    entityId = value.entityId;
  } else {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_CONSTRAINT",
      `${path}.entityId`,
      "Sketch constraint entityId must be a non-empty string."
    );
  }

  if (typeof entityId === "string") {
    entityRef = sketchEntityRefs.get(entityId);

    if (!entityRef) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        value.kind === "fixed"
          ? `${path}.target.entityId`
          : value.kind === "coincident"
            ? `${path}.primaryTarget.entityId`
            : value.kind === "midpoint"
              ? `${path}.lineEntityId`
              : `${path}.entityId`,
        "Sketch constraint entityId must reference an existing sketch entity."
      );
    } else {
      if (entityRef.sketchId !== value.sketchId) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          value.kind === "fixed"
            ? `${path}.target.entityId`
            : value.kind === "coincident"
              ? `${path}.primaryTarget.entityId`
              : value.kind === "midpoint"
                ? `${path}.lineEntityId`
                : `${path}.entityId`,
          "Sketch constraint entityId must belong to the referenced sketch."
        );
      }

      if (
        (value.kind === "horizontal" || value.kind === "vertical") &&
        entityRef.kind !== "line"
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.entityId`,
          "Sketch orientation constraint entityId must reference a line sketch entity."
        );
      }

      if (value.kind === "midpoint" && entityRef.kind !== "line") {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.lineEntityId`,
          "Midpoint sketch constraint lineEntityId must reference a line sketch entity."
        );
      }

      if (
        value.kind === "fixed" &&
        target &&
        !isSketchPointTargetSupportedForImport(entityRef.kind, target)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.target.role`,
          "Fixed sketch constraint target role is not supported for this entity."
        );
      }

      if (
        value.kind === "coincident" &&
        primaryTarget &&
        !isSketchPointTargetSupportedForImport(entityRef.kind, primaryTarget)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.primaryTarget.role`,
          "Coincident sketch constraint primary target role is not supported for this entity."
        );
      }
    }
  }

  if (value.kind === "midpoint" && target) {
    const targetEntityRef = sketchEntityRefs.get(target.entityId);
    lineEntityRef = lineEntityId
      ? sketchEntityRefs.get(lineEntityId)
      : undefined;

    if (!targetEntityRef) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.target.entityId`,
        "Midpoint sketch constraint target entityId must reference an existing sketch entity."
      );
    } else {
      if (targetEntityRef.sketchId !== value.sketchId) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.target.entityId`,
          "Midpoint sketch constraint target must belong to the referenced sketch."
        );
      }

      if (
        !isMidpointSketchPointTargetSupportedForImport(
          targetEntityRef.kind,
          target
        )
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.target.role`,
          "Midpoint sketch constraint target role is not supported for this entity."
        );
      }

      if (
        lineEntityId &&
        target.entityId === lineEntityId &&
        (target.role === "start" || target.role === "end")
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.target`,
          "Midpoint sketch constraint target cannot be one of the same line endpoints."
        );
      }
    }
  }

  if (value.kind === "coincident" && secondaryTarget) {
    const secondaryEntityRef = sketchEntityRefs.get(secondaryTarget.entityId);

    if (!secondaryEntityRef) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.secondaryTarget.entityId`,
        "Coincident sketch constraint secondary target entityId must reference an existing sketch entity."
      );
    } else {
      if (secondaryEntityRef.sketchId !== value.sketchId) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryTarget.entityId`,
          "Coincident sketch constraint secondary target must belong to the referenced sketch."
        );
      }

      if (
        !isSketchPointTargetSupportedForImport(
          secondaryEntityRef.kind,
          secondaryTarget
        )
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.secondaryTarget.role`,
          "Coincident sketch constraint secondary target role is not supported for this entity."
        );
      }
    }
  }

  if (
    typeof value.sketchId === "string" &&
    typeof entityId === "string" &&
    isSketchConstraintKind(value.kind) &&
    (value.kind === "horizontal" || value.kind === "vertical") &&
    entityRef?.kind === "line"
  ) {
    const targetKey = `${value.sketchId}\0orientation\0${entityId}`;
    const existing = seenSketchConstraintTargets.get(targetKey);

    if (existing) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.kind`,
        existing === value.kind
          ? "Line already has a duplicate orientation constraint."
          : "Line already has a conflicting orientation constraint."
      );
    } else {
      seenSketchConstraintTargets.set(targetKey, value.kind);
    }

    if (
      isRecord(entityRef.entity) &&
      isVec2(entityRef.entity.start) &&
      isVec2(entityRef.entity.end) &&
      getLineLength({
        id: entityId,
        kind: "line",
        start: entityRef.entity.start,
        end: entityRef.entity.end
      }) <= 0
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.entityId`,
        "Line orientation constraint cannot target a zero-length line."
      );
    }

    if (
      isRecord(entityRef.entity) &&
      isVec2(entityRef.entity.start) &&
      isVec2(entityRef.entity.end)
    ) {
      const entity: Extract<SketchEntity, { readonly kind: "line" }> = {
        id: entityId,
        kind: "line",
        start: entityRef.entity.start,
        end: entityRef.entity.end
      };

      if (
        getLineLength(entity) > 0 &&
        !sketchConstraintMatchesLine(value.kind, entity)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.kind`,
          `Saved line entity does not satisfy its ${value.kind} orientation constraint.`
        );
      }
    }
  }

  if (
    typeof value.sketchId === "string" &&
    value.kind === "fixed" &&
    target &&
    entityRef
  ) {
    const targetKey = `${value.sketchId}\0fixed\0${target.entityId}\0${target.role}`;
    const existing = seenSketchConstraintTargets.get(targetKey);

    if (existing) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.target`,
        "Sketch point target already has a duplicate fixed constraint."
      );
    } else {
      seenSketchConstraintTargets.set(targetKey, value.kind);
    }

    if (isVec2(value.coordinate)) {
      seenFixedSketchConstraintCoordinates.set(targetKey, [
        value.coordinate[0],
        value.coordinate[1]
      ]);

      for (const coincident of seenCoincidentConstraintTargets) {
        if (coincident.sketchId !== value.sketchId) {
          continue;
        }

        const targetKeyForCoincident = `${value.sketchId}\0fixed\0${target.entityId}\0${target.role}`;

        if (
          targetKeyForCoincident !==
            targetKeyForImportPointTarget(
              coincident.primaryTarget,
              value.sketchId
            ) &&
          targetKeyForCoincident !==
            targetKeyForImportPointTarget(
              coincident.secondaryTarget,
              value.sketchId
            )
        ) {
          continue;
        }

        const otherTarget = sketchPointTargetsEqual(
          target,
          coincident.primaryTarget
        )
          ? coincident.secondaryTarget
          : coincident.primaryTarget;
        const otherFixedCoordinate = seenFixedSketchConstraintCoordinates.get(
          targetKeyForImportPointTarget(otherTarget, value.sketchId)
        );

        if (
          otherFixedCoordinate &&
          !vec2Equal(otherFixedCoordinate, value.coordinate)
        ) {
          addProjectIssue(
            issues,
            "INVALID_SKETCH_CONSTRAINT",
            `${coincident.path}.secondaryTarget`,
            "Coincident sketch constraint cannot target points fixed to different coordinates."
          );
        }
      }
    }

    if (
      isRecord(entityRef.entity) &&
      isVec2(value.coordinate) &&
      isSketchPointTargetSupportedForImport(entityRef.kind, target)
    ) {
      const currentCoordinate = getImportSketchPointTargetCoordinate(
        entityRef.entity,
        target
      );

      if (
        currentCoordinate &&
        !vec2Equal(currentCoordinate, value.coordinate)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.coordinate`,
          "Saved sketch entity does not satisfy its fixed point constraint."
        );
      }
    }
  }

  if (
    typeof value.sketchId === "string" &&
    value.kind === "coincident" &&
    primaryTarget &&
    secondaryTarget
  ) {
    const pairKey = `${value.sketchId}\0coincident\0${sketchPointTargetPairKey(
      primaryTarget,
      secondaryTarget
    )}`;
    const existing = seenSketchConstraintTargets.get(pairKey);

    if (existing) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.secondaryTarget`,
        "Sketch point targets already have a duplicate coincident constraint."
      );
    } else {
      seenSketchConstraintTargets.set(pairKey, value.kind);
    }

    seenCoincidentConstraintTargets.push({
      path,
      sketchId: value.sketchId,
      primaryTarget,
      secondaryTarget
    });

    const primaryFixedCoordinate = seenFixedSketchConstraintCoordinates.get(
      targetKeyForImportPointTarget(primaryTarget, value.sketchId)
    );
    const secondaryFixedCoordinate = seenFixedSketchConstraintCoordinates.get(
      targetKeyForImportPointTarget(secondaryTarget, value.sketchId)
    );

    if (
      primaryFixedCoordinate &&
      secondaryFixedCoordinate &&
      !vec2Equal(primaryFixedCoordinate, secondaryFixedCoordinate)
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.secondaryTarget`,
        "Coincident sketch constraint cannot target points fixed to different coordinates."
      );
    }
  }

  if (
    typeof value.sketchId === "string" &&
    value.kind === "midpoint" &&
    lineEntityId &&
    target
  ) {
    const targetKey = `${value.sketchId}\0midpoint\0${lineEntityId}\0${target.entityId}\0${target.role}`;
    const existing = seenSketchConstraintTargets.get(targetKey);

    if (existing) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_CONSTRAINT",
        `${path}.target`,
        "Line and point target already have a duplicate midpoint constraint."
      );
    } else {
      seenSketchConstraintTargets.set(targetKey, value.kind);
    }

    if (
      lineEntityRef &&
      isRecord(lineEntityRef.entity) &&
      isVec2(lineEntityRef.entity.start) &&
      isVec2(lineEntityRef.entity.end)
    ) {
      const midpoint: Vec2 = [
        cleanMeasurementNumber(
          (lineEntityRef.entity.start[0] + lineEntityRef.entity.end[0]) / 2
        ),
        cleanMeasurementNumber(
          (lineEntityRef.entity.start[1] + lineEntityRef.entity.end[1]) / 2
        )
      ];
      const targetFixedCoordinate = seenFixedSketchConstraintCoordinates.get(
        targetKeyForImportPointTarget(target, value.sketchId)
      );

      if (
        targetFixedCoordinate &&
        !vec2Equal(targetFixedCoordinate, midpoint)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_CONSTRAINT",
          `${path}.target`,
          "Midpoint sketch constraint cannot target a point fixed away from the line midpoint."
        );
      }
    }
  }

  return maxGeneratedSketchConstraintNumber;
}

function targetKeyForImportPointTarget(
  target: SketchPointTarget,
  sketchId: SketchId
): string {
  return `${sketchId}\0fixed\0${target.entityId}\0${target.role}`;
}

function validateSketchDimensionValueSourceSnapshot(
  value: unknown,
  path: string,
  seenParameterIds: ReadonlySet<string>,
  parameterValues: ReadonlyMap<ParameterId, number>,
  issues: CadProjectImportIssue[]
): number | undefined {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_DIMENSION",
      path,
      "Sketch dimension valueSource must be an object."
    );
    return undefined;
  }

  if (value.type === "literal") {
    if (
      typeof value.value !== "number" ||
      !isPositiveFiniteNumber(value.value)
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.value`,
        "Sketch dimension value must be a positive finite number."
      );
      return undefined;
    }
    return cleanMeasurementNumber(value.value);
  }

  if (value.type === "parameter") {
    if (
      typeof value.parameterId !== "string" ||
      value.parameterId.length === 0
    ) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.parameterId`,
        "Sketch dimension parameterId must be a non-empty string."
      );
      return undefined;
    } else if (!seenParameterIds.has(value.parameterId)) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH_DIMENSION",
        `${path}.parameterId`,
        "Sketch dimension parameterId must reference an existing parameter."
      );
      return undefined;
    } else {
      const parameterValue = parameterValues.get(value.parameterId);

      if (
        typeof parameterValue !== "number" ||
        !isPositiveFiniteNumber(parameterValue)
      ) {
        addProjectIssue(
          issues,
          "INVALID_SKETCH_DIMENSION",
          `${path}.parameterId`,
          "Sketch dimension parameter value must be positive and finite."
        );
        return undefined;
      }
      return cleanMeasurementNumber(parameterValue);
    }
  }

  addProjectIssue(
    issues,
    "INVALID_SKETCH_DIMENSION",
    `${path}.type`,
    "Sketch dimension valueSource type must be literal or parameter."
  );
  return undefined;
}

function getImportedSketchDimensionTargetValue(
  entity: unknown,
  target: SketchDimensionTarget
): number | undefined {
  if (!isRecord(entity)) {
    return undefined;
  }

  if (target.entityKind === "rectangle") {
    const value = entity[target.role];
    return typeof value === "number" ? value : undefined;
  }

  if (target.entityKind === "circle") {
    return typeof entity.radius === "number" ? entity.radius : undefined;
  }

  if (isRecord(entity) && isVec2(entity.start) && isVec2(entity.end)) {
    return cleanMeasurementNumber(
      Math.hypot(
        entity.end[0] - entity.start[0],
        entity.end[1] - entity.start[1]
      )
    );
  }

  return undefined;
}

function collectValidExtrudeFeatureByBodyId(
  value: unknown,
  featuresByBodyId: Map<BodyId, ExtrudeFeatureSnapshot>
): void {
  if (
    isRecord(value) &&
    value.kind === "extrude" &&
    typeof value.id === "string" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    (value.profileKind === "rectangle" || value.profileKind === "circle") &&
    typeof value.depth === "number" &&
    isPositiveFiniteNumber(value.depth) &&
    (value.side === undefined || isExtrudeSide(value.side)) &&
    (value.operationMode === undefined || value.operationMode === "newBody") &&
    value.targetBodyId === undefined &&
    typeof value.bodyId === "string"
  ) {
    featuresByBodyId.set(value.bodyId, {
      id: value.id,
      kind: "extrude",
      name: typeof value.name === "string" ? value.name : undefined,
      sketchId: value.sketchId,
      entityId: value.entityId,
      profileKind: value.profileKind,
      depth: value.depth,
      side: value.side ?? "positive",
      operationMode: value.operationMode ?? "newBody",
      bodyId: value.bodyId
    });
  }
}

function collectValidAuthoredFeatureByBodyId(
  value: unknown,
  path: string,
  featuresByBodyId: Map<
    BodyId,
    ExtrudeFeatureSnapshot & { readonly path: string }
  >
): void {
  if (
    isRecord(value) &&
    value.kind === "extrude" &&
    typeof value.id === "string" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    (value.profileKind === "rectangle" || value.profileKind === "circle") &&
    typeof value.depth === "number" &&
    isPositiveFiniteNumber(value.depth) &&
    (value.side === undefined || isExtrudeSide(value.side)) &&
    (value.operationMode === undefined ||
      isExtrudeOperationMode(value.operationMode)) &&
    (value.targetBodyId === undefined ||
      typeof value.targetBodyId === "string") &&
    typeof value.bodyId === "string"
  ) {
    featuresByBodyId.set(value.bodyId, {
      id: value.id,
      kind: "extrude",
      name: typeof value.name === "string" ? value.name : undefined,
      sketchId: value.sketchId,
      entityId: value.entityId,
      profileKind: value.profileKind,
      depth: value.depth,
      side: value.side ?? "positive",
      operationMode: value.operationMode ?? "newBody",
      targetBodyId: value.targetBodyId,
      bodyId: value.bodyId,
      path
    });
  }
}

function validateFeatureTargetBodyReferences(
  featuresByBodyId: ReadonlyMap<
    BodyId,
    ExtrudeFeatureSnapshot & { readonly path: string }
  >,
  issues: CadProjectImportIssue[]
): void {
  for (const feature of featuresByBodyId.values()) {
    const operationMode = feature.operationMode ?? "newBody";

    if (!isConsumingExtrudeOperationMode(operationMode)) {
      continue;
    }

    const targetBodyId = feature.targetBodyId;

    if (!targetBodyId) {
      continue;
    }

    const target = featuresByBodyId.get(targetBodyId);

    if (!target) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.targetBodyId`,
        `${formatExtrudeOperationModeForIssue(operationMode)} extrude targetBodyId must reference an existing authored extrude body.`
      );
      continue;
    }

    const consumedBy = [...featuresByBodyId.values()].find(
      (candidate) =>
        candidate.id !== feature.id &&
        isConsumingExtrudeOperationMode(candidate.operationMode ?? "newBody") &&
        candidate.targetBodyId === targetBodyId
    );

    if (consumedBy) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.targetBodyId`,
        `${formatExtrudeOperationModeForIssue(operationMode)} extrude targetBodyId must reference an active authored body that is not already consumed by another boolean feature.`
      );
      continue;
    }

    if (!isSupportedBooleanExtrudeCombination(feature, target)) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${feature.path}.operationMode`,
        getUnsupportedBooleanExtrudeMessage(operationMode)
      );
    }
  }
}

function isSupportedBooleanExtrudeCombination(
  feature: ExtrudeFeatureSnapshot,
  target: ExtrudeFeatureSnapshot
): boolean {
  if (
    feature.profileKind !== "rectangle" ||
    target.operationMode !== "newBody"
  ) {
    return false;
  }

  const operationMode = feature.operationMode ?? "newBody";

  if (operationMode === "add") {
    return isSupportedAddTargetProfileKind(target.profileKind);
  }

  if (operationMode === "cut") {
    return isSupportedCutTargetProfileKind(target.profileKind);
  }

  return false;
}

function getUnsupportedBooleanExtrudeMessage(
  operationMode: FeatureExtrudeOperationMode
): string {
  if (operationMode === "add") {
    return "Add extrudes currently support rectangle tools fusing with one active rectangle newBody target body.";
  }

  return "Cut extrudes currently support rectangle tools cutting one active rectangle or circle newBody target body.";
}

function formatExtrudeOperationModeForIssue(
  operationMode: FeatureExtrudeOperationMode
): string {
  return operationMode === "add" ? "Add" : "Cut";
}

function validateSketchAttachments(
  attachments: readonly {
    readonly path: string;
    readonly attachment: SketchAttachmentSnapshot;
  }[],
  featuresByBodyId: ReadonlyMap<BodyId, ExtrudeFeatureSnapshot>,
  issues: CadProjectImportIssue[]
): void {
  for (const { path, attachment } of attachments) {
    const feature = featuresByBodyId.get(attachment.bodyId);
    const expectedStableId = `generated:face:${attachment.bodyId}:${attachment.faceRole}`;

    if (attachment.faceStableId !== expectedStableId) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.faceStableId`,
        "Sketch attachment faceStableId must match the referenced generated face role."
      );
    }

    if (!feature) {
      continue;
    }

    if (attachment.sourceFeatureId !== feature.id) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.sourceFeatureId`,
        "Sketch attachment sourceFeatureId must match the referenced body feature."
      );
    }

    if (attachment.sourceSketchId !== feature.sketchId) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.sourceSketchId`,
        "Sketch attachment sourceSketchId must match the referenced body feature."
      );
    }

    if (attachment.sourceSketchEntityId !== feature.entityId) {
      addProjectIssue(
        issues,
        "INVALID_SKETCH",
        `${path}.sourceSketchEntityId`,
        "Sketch attachment sourceSketchEntityId must match the referenced body feature."
      );
    }
  }
}

function validateSketchEntitySnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenSketchEntityIds: Set<string>
): number {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      path,
      "Sketch entity must be an object."
    );
    return 0;
  }

  let maxGeneratedSketchEntityNumber = 0;

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      `${path}.id`,
      "Sketch entity id must be a non-empty string."
    );
  } else if (seenSketchEntityIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      `${path}.id`,
      `Duplicate sketch entity id: ${value.id}.`
    );
  } else {
    seenSketchEntityIds.add(value.id);
    maxGeneratedSketchEntityNumber = parseSketchEntityNumber(value.id);
  }

  if (value.kind === "point") {
    validateVec2Field(value.point, `${path}.point`, issues);
  } else if (value.kind === "line") {
    validateVec2Field(value.start, `${path}.start`, issues);
    validateVec2Field(value.end, `${path}.end`, issues);
  } else if (value.kind === "rectangle") {
    validateVec2Field(value.center, `${path}.center`, issues);
    validatePositiveFiniteField(
      value.width,
      `${path}.width`,
      "Rectangle width",
      issues
    );
    validatePositiveFiniteField(
      value.height,
      `${path}.height`,
      "Rectangle height",
      issues
    );
  } else if (value.kind === "circle") {
    validateVec2Field(value.center, `${path}.center`, issues);
    validatePositiveFiniteField(
      value.radius,
      `${path}.radius`,
      "Circle radius",
      issues
    );
  } else {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      `${path}.kind`,
      "Sketch entity kind must be point, line, rectangle, or circle."
    );
  }

  return maxGeneratedSketchEntityNumber;
}

function collectSketchEntityRefs(
  value: unknown,
  output: Map<SketchEntityId, SketchEntityImportRef>
): void {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !Array.isArray(value.entities)
  ) {
    return;
  }

  for (const entity of value.entities) {
    if (
      isRecord(entity) &&
      typeof entity.id === "string" &&
      isSketchEntityKind(entity.kind)
    ) {
      output.set(entity.id, {
        sketchId: value.id,
        kind: entity.kind,
        entity
      });
    }
  }
}

function validateNamedReferenceSnapshots(
  values: readonly unknown[],
  path: string,
  issues: CadProjectImportIssue[]
): void {
  const seenNames = new Set<NamedReferenceName>();

  for (const [index, value] of values.entries()) {
    const referencePath = `${path}[${index}]`;

    if (!isRecord(value)) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        referencePath,
        "Named reference must be an object."
      );
      continue;
    }

    const rawName = typeof value.name === "string" ? value.name : undefined;
    const name = rawName?.trim();
    const bodyId = typeof value.bodyId === "string" ? value.bodyId : undefined;
    const stableId =
      typeof value.stableId === "string" ? value.stableId : undefined;
    const kind = isGeneratedEntityKind(value.kind) ? value.kind : undefined;

    if (!name) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.name`,
        "Named reference name must be a non-empty string."
      );
    } else if (rawName !== name) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.name`,
        "Named reference name must not include leading or trailing whitespace."
      );
    } else if (seenNames.has(name)) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.name`,
        `Duplicate named reference: ${name}.`
      );
    } else {
      seenNames.add(name);
    }

    if (!bodyId) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.bodyId`,
        "Named reference bodyId must be a non-empty string."
      );
    }

    if (!stableId) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.stableId`,
        "Named reference stableId must be a non-empty string."
      );
    }

    if (!kind) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.kind`,
        "Named reference kind must be body, face, edge, or vertex."
      );
    }

    if (!bodyId || !stableId || !kind) {
      continue;
    }

    if (!isGeneratedStableIdShapeForKind(bodyId, stableId, kind)) {
      addProjectIssue(
        issues,
        "INVALID_NAMED_REFERENCE",
        `${referencePath}.stableId`,
        "Named reference stableId must match the stored generated reference kind and bodyId."
      );
    }
  }
}

function validateFeatureSnapshot(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  seenFeatureIds: Set<string>,
  seenBodyIds: Set<string>,
  seenSketchIds: ReadonlySet<string>,
  sketchEntityRefs: ReadonlyMap<
    SketchEntityId,
    { readonly sketchId: SketchId; readonly kind: SketchEntityKind }
  >
): {
  readonly maxGeneratedFeatureNumber: number;
  readonly maxGeneratedBodyNumber: number;
} {
  let maxGeneratedFeatureNumber = 0;
  let maxGeneratedBodyNumber = 0;

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      path,
      "Feature must be an object."
    );
    return { maxGeneratedFeatureNumber, maxGeneratedBodyNumber };
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.id`,
      "Feature id must be a non-empty string."
    );
  } else if (seenFeatureIds.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.id`,
      `Duplicate feature id: ${value.id}.`
    );
  } else {
    seenFeatureIds.add(value.id);
    maxGeneratedFeatureNumber = parseFeatureNumber(value.id);
  }

  if (value.kind !== "extrude") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.kind`,
      "Feature kind must be extrude."
    );
  }

  validateOptionalFeatureName(value.name, `${path}.name`, issues);

  if (typeof value.sketchId !== "string" || value.sketchId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.sketchId`,
      "Extrude feature sketchId must be a non-empty string."
    );
  } else if (!seenSketchIds.has(value.sketchId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.sketchId`,
      "Extrude feature sketchId must reference an existing sketch."
    );
  }

  if (typeof value.entityId !== "string" || value.entityId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.entityId`,
      "Extrude feature entityId must be a non-empty string."
    );
  } else if (!sketchEntityRefs.has(value.entityId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.entityId`,
      "Extrude feature entityId must reference an existing sketch entity."
    );
  } else {
    const referencedEntity = sketchEntityRefs.get(value.entityId);

    if (referencedEntity && referencedEntity.sketchId !== value.sketchId) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.entityId`,
        "Extrude feature entityId must belong to the referenced sketch."
      );
    }

    if (
      referencedEntity &&
      referencedEntity.kind !== "rectangle" &&
      referencedEntity.kind !== "circle"
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.entityId`,
        "Extrude feature entityId must reference a rectangle or circle sketch entity."
      );
    }
  }

  if (value.profileKind !== "rectangle" && value.profileKind !== "circle") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.profileKind`,
      "Extrude feature profileKind must be rectangle or circle."
    );
  } else if (
    typeof value.entityId === "string" &&
    sketchEntityRefs.has(value.entityId) &&
    sketchEntityRefs.get(value.entityId)?.kind !== value.profileKind
  ) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.profileKind`,
      "Extrude feature profileKind must match the referenced sketch entity kind."
    );
  }

  validatePositiveFiniteField(
    value.depth,
    `${path}.depth`,
    "Extrude depth",
    issues
  );

  if (value.side !== undefined && !isExtrudeSide(value.side)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.side`,
      "Extrude feature side must be positive, negative, or symmetric."
    );
  }

  if (
    value.operationMode !== undefined &&
    !isExtrudeOperationMode(value.operationMode)
  ) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.operationMode`,
      "Extrude feature operationMode must be newBody, add, or cut."
    );
  }

  if (value.targetBodyId !== undefined) {
    if (typeof value.targetBodyId !== "string" || value.targetBodyId === "") {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.targetBodyId`,
        "Extrude feature targetBodyId must be a non-empty string when present."
      );
    }

    if (
      value.operationMode === undefined ||
      value.operationMode === "newBody"
    ) {
      addProjectIssue(
        issues,
        "INVALID_FEATURE",
        `${path}.targetBodyId`,
        "newBody extrude features must not include targetBodyId."
      );
    }
  } else if (value.operationMode === "add" || value.operationMode === "cut") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.targetBodyId`,
      `Extrude operationMode ${value.operationMode} requires targetBodyId.`
    );
  }

  if (typeof value.bodyId !== "string" || value.bodyId.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.bodyId`,
      "Extrude feature bodyId must be a non-empty string."
    );
  } else if (seenBodyIds.has(value.bodyId)) {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      `${path}.bodyId`,
      `Duplicate body id: ${value.bodyId}.`
    );
  } else {
    seenBodyIds.add(value.bodyId);
    maxGeneratedBodyNumber = parseBodyNumber(value.bodyId);
  }

  return { maxGeneratedFeatureNumber, maxGeneratedBodyNumber };
}

function validateOptionalFeatureName(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || value.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_FEATURE",
      path,
      "Feature name must be a non-empty string when present."
    );
  }
}

function validateOptionalObjectName(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || value.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_OBJECT_NAME",
      path,
      "Object name must be a non-empty string when present."
    );
  }
}

function validateBoxDimensionsShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      "Box dimensions must be an object."
    );
    return;
  }

  validatePositiveFiniteField(
    value.width,
    `${path}.width`,
    "Box width",
    issues
  );
  validatePositiveFiniteField(
    value.height,
    `${path}.height`,
    "Box height",
    issues
  );
  validatePositiveFiniteField(
    value.depth,
    `${path}.depth`,
    "Box depth",
    issues
  );
}

function validateCylinderDimensionsShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      "Cylinder dimensions must be an object."
    );
    return;
  }

  validatePositiveFiniteField(
    value.radius,
    `${path}.radius`,
    "Cylinder radius",
    issues
  );
  validatePositiveFiniteField(
    value.height,
    `${path}.height`,
    "Cylinder height",
    issues
  );
}

function validateSphereDimensionsShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      "Sphere dimensions must be an object."
    );
    return;
  }

  validatePositiveFiniteField(
    value.radius,
    `${path}.radius`,
    "Sphere radius",
    issues
  );
}

function validateConeDimensionsShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      "Cone dimensions must be an object."
    );
    return;
  }

  validatePositiveFiniteField(
    value.radius,
    `${path}.radius`,
    "Cone radius",
    issues
  );
  validatePositiveFiniteField(
    value.height,
    `${path}.height`,
    "Cone height",
    issues
  );
}

function validateTorusDimensionsShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      "Torus dimensions must be an object."
    );
    return;
  }

  validatePositiveFiniteField(
    value.majorRadius,
    `${path}.majorRadius`,
    "Torus majorRadius",
    issues
  );
  validatePositiveFiniteField(
    value.minorRadius,
    `${path}.minorRadius`,
    "Torus minorRadius",
    issues
  );

  if (
    typeof value.majorRadius === "number" &&
    typeof value.minorRadius === "number" &&
    isPositiveFiniteNumber(value.majorRadius) &&
    isPositiveFiniteNumber(value.minorRadius) &&
    value.minorRadius >= value.majorRadius
  ) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      `${path}.minorRadius`,
      "Torus minorRadius must be smaller than majorRadius."
    );
  }
}

function validateTransformShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSFORM",
      path,
      "Transform must be an object."
    );
    return;
  }

  validateVec3Field(value.translation, `${path}.translation`, issues);
  validateVec3Field(value.rotation, `${path}.rotation`, issues);
  validateVec3Field(value.scale, `${path}.scale`, issues);
}

function validateVec3Field(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isVec3(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSFORM",
      path,
      "Transform vector must contain three finite numbers."
    );
  }
}

function validateVec2Field(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (!isVec2(value)) {
    addProjectIssue(
      issues,
      "INVALID_SKETCH_ENTITY",
      path,
      "Sketch coordinate vector must contain two finite numbers."
    );
  }
}

function validateNextGeneratedNumber(
  value: unknown,
  path: string,
  label: string,
  generatedIdLabel: string,
  maxGeneratedNumber: number,
  issues: CadProjectImportIssue[]
): void {
  const isValid =
    typeof value === "number" && Number.isInteger(value) && value > 0;

  if (!isValid) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      path,
      `${label} must be a positive integer.`
    );
  } else if (value <= maxGeneratedNumber) {
    addProjectIssue(
      issues,
      "INVALID_DOCUMENT",
      path,
      `${label} must be greater than existing ${generatedIdLabel}.`
    );
  }
}

function validatePositiveFiniteField(
  value: unknown,
  path: string,
  label: string,
  issues: CadProjectImportIssue[]
): void {
  if (typeof value !== "number" || !isPositiveFiniteNumber(value)) {
    addProjectIssue(
      issues,
      "INVALID_DIMENSIONS",
      path,
      `${label} must be a positive finite number.`
    );
  }
}

function validateTransactionArray(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  expectedStatus?: CadTransactionStatus,
  seenTransactionIds?: Set<TransactionId>
): void {
  if (!Array.isArray(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      "Transaction history must be an array."
    );
    return;
  }

  for (const [index, transaction] of value.entries()) {
    validateTransactionShape(
      transaction,
      `${path}[${index}]`,
      issues,
      expectedStatus,
      seenTransactionIds
    );
  }
}

function validateTransactionShape(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[],
  expectedStatus?: CadTransactionStatus,
  seenTransactionIds?: Set<TransactionId>
): void {
  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      "Transaction must be an object."
    );
    return;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.id`,
      "Transaction id must be a non-empty string."
    );
  } else if (seenTransactionIds?.has(value.id)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.id`,
      `Duplicate transaction id: ${value.id}.`
    );
  } else {
    seenTransactionIds?.add(value.id);
  }

  if (!Array.isArray(value.ops)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.ops`,
      "Transaction ops must be an array."
    );
  } else {
    for (const [index, op] of value.ops.entries()) {
      if (!isCadOp(op)) {
        addProjectIssue(
          issues,
          "INVALID_TRANSACTION",
          `${path}.ops[${index}]`,
          "Transaction operation must be a valid CADOps command."
        );
      }
    }
  }

  if (value.status !== "committed" && value.status !== "undone") {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.status`,
      "Transaction status must be committed or undone."
    );
  } else if (expectedStatus !== undefined && value.status !== expectedStatus) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.status`,
      `Transactions in ${path.startsWith("$.redoStack") ? "redoStack" : "history"} must have ${expectedStatus} status.`
    );
  }

  validateOptionalTransactionActor(value.actor, `${path}.actor`, issues);
  validateOptionalTransactionAudit(
    value.audit,
    `${path}.audit`,
    Array.isArray(value.ops) ? value.ops.length : undefined,
    issues
  );

  if (!isSemanticDiff(value.diff)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.diff`,
      "Transaction diff must be a valid semantic diff."
    );
  }
}

function validateOptionalTransactionAudit(
  value: unknown,
  path: string,
  expectedOperationCount: number | undefined,
  issues: CadProjectImportIssue[]
): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      "Transaction audit metadata must be an object when present."
    );
    return;
  }

  if (value.intent !== "commit") {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.intent`,
      "Saved transaction audit intent must be commit."
    );
  }

  if (
    typeof value.operationCount !== "number" ||
    !Number.isInteger(value.operationCount) ||
    value.operationCount < 0
  ) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.operationCount`,
      "Transaction audit operationCount must be a non-negative integer."
    );
  } else if (
    expectedOperationCount !== undefined &&
    value.operationCount !== expectedOperationCount
  ) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.operationCount`,
      "Transaction audit operationCount must match transaction ops length."
    );
  }

  validateOptionalAuditStringField(value.source, `${path}.source`, issues);
  validateOptionalAuditStringField(
    value.requestId,
    `${path}.requestId`,
    issues
  );
  validateOptionalAuditStringField(value.toolName, `${path}.toolName`, issues);
}

function validateOptionalAuditStringField(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || value.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      "Transaction audit metadata fields must be non-empty strings when present."
    );
  }
}

function validateOptionalTransactionActor(
  value: unknown,
  path: string,
  issues: CadProjectImportIssue[]
): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      "Transaction actor must be an object when present."
    );
    return;
  }

  if (!isCadActorType(value.type)) {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      `${path}.type`,
      "Transaction actor type must be human, agent, script, or system."
    );
  }

  if (value.id !== undefined) {
    validateNonEmptyStringField(value.id, `${path}.id`, "actor id", issues);
  }

  if (value.name !== undefined) {
    validateNonEmptyStringField(
      value.name,
      `${path}.name`,
      "actor name",
      issues
    );
  }
}

function validateNonEmptyStringField(
  value: unknown,
  path: string,
  label: string,
  issues: CadProjectImportIssue[]
): void {
  if (typeof value !== "string" || value.trim() === "") {
    addProjectIssue(
      issues,
      "INVALID_TRANSACTION",
      path,
      `Transaction ${label} must be a non-empty string when present.`
    );
  }
}

function throwProjectTransactionHistoryError(
  path: string,
  error: unknown
): never {
  const message =
    error instanceof Error
      ? error.message
      : "Project transaction history could not be replayed.";

  throw new CadProjectImportError([
    {
      code: "INVALID_TRANSACTION_HISTORY",
      path,
      message: `Project transaction history could not be replayed: ${message}`
    }
  ]);
}

function addProjectIssue(
  issues: CadProjectImportIssue[],
  code: CadProjectImportErrorCode,
  path: string,
  message: string
): void {
  issues.push({ code, path, message });
}

function formatCadProjectImportIssues(
  issues: readonly CadProjectImportIssue[]
): string {
  const firstIssue = issues[0];

  if (!firstIssue) {
    return "Invalid Partbench project JSON.";
  }

  const suffix =
    issues.length > 1 ? `; ${issues.length - 1} more issue(s).` : ".";

  return `Invalid Partbench project JSON: ${firstIssue.message} (${firstIssue.path})${suffix}`;
}

function materializeGeneratedObjectIds(
  transaction: Transaction
): readonly CadOp[] {
  let createdObjectIndex = 0;
  let createdSketchIndex = 0;
  let createdSketchEntityIndex = 0;
  let createdParameterIndex = 0;
  let createdSketchDimensionIndex = 0;
  let createdSketchConstraintIndex = 0;
  let createdFeatureIndex = 0;

  return transaction.ops.map((op) => {
    if (isSceneCreateOp(op)) {
      if (op.id) {
        return op;
      }

      const createdRef = transaction.diff.created[createdObjectIndex];
      createdObjectIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (op.op === "sketch.create" || op.op === "sketch.createOnFace") {
      if (op.id) {
        return op;
      }

      const createdRef =
        transaction.diff.sketches?.created?.[createdSketchIndex];
      createdSketchIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (isSketchAddEntityOp(op)) {
      if (op.id) {
        return op;
      }

      const createdRef =
        transaction.diff.sketches?.entitiesCreated?.[createdSketchEntityIndex];
      createdSketchEntityIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (op.op === "parameter.create") {
      if (op.id) {
        return op;
      }

      const createdRef =
        transaction.diff.parameters?.created?.[createdParameterIndex];
      createdParameterIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (op.op === "sketch.dimension.create") {
      if (op.id) {
        return op;
      }

      const createdRef =
        transaction.diff.sketchDimensions?.created?.[
          createdSketchDimensionIndex
        ];
      createdSketchDimensionIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (op.op === "sketch.constraint.create") {
      if (op.id) {
        return op;
      }

      const createdRef =
        transaction.diff.sketchConstraints?.created?.[
          createdSketchConstraintIndex
        ];
      createdSketchConstraintIndex += 1;

      return createdRef ? { ...op, id: createdRef.id } : op;
    }

    if (op.op === "feature.extrude") {
      const createdRef =
        transaction.diff.features?.created?.[createdFeatureIndex];
      createdFeatureIndex += 1;

      return {
        ...op,
        id: op.id ?? createdRef?.id,
        bodyId: op.bodyId ?? createdRef?.bodyId
      };
    }

    return op;
  });
}

function isSceneCreateOp(op: CadOp): op is Extract<
  CadOp,
  {
    readonly op:
      | "scene.createBox"
      | "scene.createCylinder"
      | "scene.createSphere"
      | "scene.createCone"
      | "scene.createTorus";
  }
> {
  return (
    op.op === "scene.createBox" ||
    op.op === "scene.createCylinder" ||
    op.op === "scene.createSphere" ||
    op.op === "scene.createCone" ||
    op.op === "scene.createTorus"
  );
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

function isCadOp(value: unknown): value is CadOp {
  if (!isRecord(value)) {
    return false;
  }

  if (value.op === "parameter.create") {
    return (
      isOptionalString(value.id) &&
      typeof value.name === "string" &&
      typeof value.value === "number" &&
      Number.isFinite(value.value) &&
      (value.description === undefined || typeof value.description === "string")
    );
  }

  if (value.op === "parameter.update") {
    return (
      typeof value.id === "string" &&
      (value.value === undefined ||
        (typeof value.value === "number" && Number.isFinite(value.value))) &&
      (value.description === undefined ||
        typeof value.description === "string") &&
      (value.value !== undefined || value.description !== undefined)
    );
  }

  if (value.op === "parameter.rename") {
    return typeof value.id === "string" && typeof value.name === "string";
  }

  if (value.op === "parameter.delete") {
    return typeof value.id === "string";
  }

  if (value.op === "scene.createBox") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.name) &&
      isBoxDimensions(value.dimensions) &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.createCylinder") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.name) &&
      isCylinderDimensions(value.dimensions) &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.createSphere") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.name) &&
      isSphereDimensions(value.dimensions) &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.createCone") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.name) &&
      isConeDimensions(value.dimensions) &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.createTorus") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.name) &&
      isTorusDimensions(value.dimensions) &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.deleteObject") {
    return typeof value.id === "string";
  }

  if (value.op === "scene.updateTransform") {
    return (
      typeof value.id === "string" &&
      value.transform !== undefined &&
      isOptionalTransform(value.transform)
    );
  }

  if (value.op === "scene.updateBoxDimensions") {
    return typeof value.id === "string" && isBoxDimensions(value.dimensions);
  }

  if (value.op === "scene.updateCylinderDimensions") {
    return (
      typeof value.id === "string" && isCylinderDimensions(value.dimensions)
    );
  }

  if (value.op === "scene.updateSphereDimensions") {
    return typeof value.id === "string" && isSphereDimensions(value.dimensions);
  }

  if (value.op === "scene.updateConeDimensions") {
    return typeof value.id === "string" && isConeDimensions(value.dimensions);
  }

  if (value.op === "scene.updateTorusDimensions") {
    return typeof value.id === "string" && isTorusDimensions(value.dimensions);
  }

  if (value.op === "scene.renameObject") {
    return typeof value.id === "string" && typeof value.name === "string";
  }

  if (value.op === "document.updateUnits") {
    return (
      isDocumentUnits(value.units) &&
      (value.mode === undefined || isDocumentUnitUpdateMode(value.mode))
    );
  }

  if (value.op === "sketch.create") {
    return (
      isOptionalString(value.id) &&
      typeof value.name === "string" &&
      isSketchPlane(value.plane)
    );
  }

  if (value.op === "sketch.createOnFace") {
    const hasGeneratedReference =
      typeof value.bodyId === "string" &&
      typeof value.faceStableId === "string" &&
      value.referenceName === undefined;
    const hasNamedReference =
      typeof value.referenceName === "string" &&
      value.bodyId === undefined &&
      value.faceStableId === undefined;

    return (
      isOptionalString(value.id) &&
      typeof value.name === "string" &&
      (hasGeneratedReference || hasNamedReference)
    );
  }

  if (value.op === "sketch.rename") {
    return typeof value.id === "string" && typeof value.name === "string";
  }

  if (value.op === "sketch.delete") {
    return typeof value.id === "string";
  }

  if (value.op === "sketch.addPoint") {
    return (
      typeof value.sketchId === "string" &&
      isOptionalString(value.id) &&
      isVec2(value.point)
    );
  }

  if (value.op === "sketch.addLine") {
    return (
      typeof value.sketchId === "string" &&
      isOptionalString(value.id) &&
      isVec2(value.start) &&
      isVec2(value.end)
    );
  }

  if (value.op === "sketch.addRectangle") {
    return (
      typeof value.sketchId === "string" &&
      isOptionalString(value.id) &&
      isVec2(value.center) &&
      typeof value.width === "number" &&
      isPositiveFiniteNumber(value.width) &&
      typeof value.height === "number" &&
      isPositiveFiniteNumber(value.height)
    );
  }

  if (value.op === "sketch.addCircle") {
    return (
      typeof value.sketchId === "string" &&
      isOptionalString(value.id) &&
      isVec2(value.center) &&
      typeof value.radius === "number" &&
      isPositiveFiniteNumber(value.radius)
    );
  }

  if (value.op === "sketch.updateEntity") {
    return typeof value.sketchId === "string" && isSketchEntity(value.entity);
  }

  if (value.op === "sketch.deleteEntity") {
    return (
      typeof value.sketchId === "string" && typeof value.entityId === "string"
    );
  }

  if (value.op === "sketch.dimension.create") {
    return (
      isOptionalString(value.id) &&
      typeof value.name === "string" &&
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      isSketchDimensionTarget(value.target) &&
      isSketchDimensionValueInput(value)
    );
  }

  if (value.op === "sketch.dimension.update") {
    return typeof value.id === "string" && isSketchDimensionValueInput(value);
  }

  if (value.op === "sketch.dimension.rename") {
    return typeof value.id === "string" && typeof value.name === "string";
  }

  if (value.op === "sketch.dimension.delete") {
    return typeof value.id === "string";
  }

  if (value.op === "sketch.constraint.create") {
    if (
      !isOptionalString(value.id) ||
      typeof value.name !== "string" ||
      typeof value.sketchId !== "string" ||
      !isSketchConstraintKind(value.kind)
    ) {
      return false;
    }

    if (value.kind === "fixed") {
      return (
        isSketchPointTarget(value.target) &&
        (value.coordinate === undefined || isVec2(value.coordinate))
      );
    }

    if (value.kind === "coincident") {
      return (
        isSketchPointTarget(value.primaryTarget) &&
        isSketchPointTarget(value.secondaryTarget)
      );
    }

    if (value.kind === "midpoint") {
      return (
        typeof value.lineEntityId === "string" &&
        isSketchPointTarget(value.target)
      );
    }

    return typeof value.entityId === "string";
  }

  if (value.op === "sketch.constraint.rename") {
    return typeof value.id === "string" && typeof value.name === "string";
  }

  if (value.op === "sketch.constraint.delete") {
    return typeof value.id === "string";
  }

  if (value.op === "feature.extrude") {
    return (
      isOptionalString(value.id) &&
      isOptionalString(value.bodyId) &&
      isOptionalString(value.targetBodyId) &&
      isOptionalString(value.name) &&
      typeof value.sketchId === "string" &&
      typeof value.entityId === "string" &&
      typeof value.depth === "number" &&
      isPositiveFiniteNumber(value.depth) &&
      (value.side === undefined || isExtrudeSide(value.side)) &&
      (value.operationMode === undefined ||
        isExtrudeOperationMode(value.operationMode))
    );
  }

  if (value.op === "feature.delete") {
    return typeof value.id === "string";
  }

  if (value.op === "feature.updateExtrude") {
    return (
      typeof value.id === "string" &&
      (value.depth === undefined ||
        (typeof value.depth === "number" &&
          isPositiveFiniteNumber(value.depth))) &&
      (value.side === undefined || isExtrudeSide(value.side)) &&
      (value.depth !== undefined || value.side !== undefined)
    );
  }

  if (value.op === "reference.nameGenerated") {
    return (
      typeof value.name === "string" &&
      typeof value.bodyId === "string" &&
      typeof value.stableId === "string"
    );
  }

  if (value.op === "reference.deleteName") {
    return typeof value.name === "string";
  }

  return false;
}

function isSemanticDiff(value: unknown): value is SemanticDiff {
  return (
    isRecord(value) &&
    Array.isArray(value.created) &&
    value.created.every(isCadObjectRef) &&
    Array.isArray(value.modified) &&
    value.modified.every(isCadObjectRef) &&
    Array.isArray(value.deleted) &&
    value.deleted.every(isCadObjectRef) &&
    (value.document === undefined || isDocumentSemanticDiff(value.document)) &&
    (value.sketches === undefined || isSketchSemanticDiff(value.sketches)) &&
    (value.features === undefined || isFeatureSemanticDiff(value.features)) &&
    (value.references === undefined ||
      isReferenceSemanticDiff(value.references)) &&
    (value.parameters === undefined ||
      isParameterSemanticDiff(value.parameters)) &&
    (value.sketchDimensions === undefined ||
      isSketchDimensionSemanticDiff(value.sketchDimensions)) &&
    (value.sketchConstraints === undefined ||
      isSketchConstraintSemanticDiff(value.sketchConstraints))
  );
}

function isDocumentSemanticDiff(value: unknown): value is DocumentSemanticDiff {
  return (
    isRecord(value) &&
    (value.units === undefined ||
      (isRecord(value.units) &&
        isDocumentUnits(value.units.before) &&
        isDocumentUnits(value.units.after) &&
        (value.units.mode === undefined ||
          isDocumentUnitUpdateMode(value.units.mode)) &&
        (value.units.scaleFactor === undefined ||
          (typeof value.units.scaleFactor === "number" &&
            Number.isFinite(value.units.scaleFactor) &&
            value.units.scaleFactor > 0))))
  );
}

function isSketchSemanticDiff(value: unknown): value is SketchSemanticDiff {
  return (
    isRecord(value) &&
    (value.created === undefined ||
      (Array.isArray(value.created) && value.created.every(isCadSketchRef))) &&
    (value.modified === undefined ||
      (Array.isArray(value.modified) &&
        value.modified.every(isCadSketchRef))) &&
    (value.deleted === undefined ||
      (Array.isArray(value.deleted) && value.deleted.every(isCadSketchRef))) &&
    (value.entitiesCreated === undefined ||
      (Array.isArray(value.entitiesCreated) &&
        value.entitiesCreated.every(isCadSketchEntityRef))) &&
    (value.entitiesModified === undefined ||
      (Array.isArray(value.entitiesModified) &&
        value.entitiesModified.every(isCadSketchEntityRef))) &&
    (value.entitiesDeleted === undefined ||
      (Array.isArray(value.entitiesDeleted) &&
        value.entitiesDeleted.every(isCadSketchEntityRef)))
  );
}

function isFeatureSemanticDiff(value: unknown): value is FeatureSemanticDiff {
  return (
    isRecord(value) &&
    (value.created === undefined ||
      (Array.isArray(value.created) && value.created.every(isCadFeatureRef))) &&
    (value.modified === undefined ||
      (Array.isArray(value.modified) &&
        value.modified.every(isCadFeatureRef))) &&
    (value.deleted === undefined ||
      (Array.isArray(value.deleted) && value.deleted.every(isCadFeatureRef))) &&
    (value.bodiesCreated === undefined ||
      (Array.isArray(value.bodiesCreated) &&
        value.bodiesCreated.every(isCadBodyRef))) &&
    (value.bodiesModified === undefined ||
      (Array.isArray(value.bodiesModified) &&
        value.bodiesModified.every(isCadBodyRef))) &&
    (value.bodiesDeleted === undefined ||
      (Array.isArray(value.bodiesDeleted) &&
        value.bodiesDeleted.every(isCadBodyRef)))
  );
}

function isReferenceSemanticDiff(
  value: unknown
): value is ReferenceSemanticDiff {
  return (
    isRecord(value) &&
    (value.namedCreated === undefined ||
      (Array.isArray(value.namedCreated) &&
        value.namedCreated.every(isCadNamedReferenceRef))) &&
    (value.namedDeleted === undefined ||
      (Array.isArray(value.namedDeleted) &&
        value.namedDeleted.every(isCadNamedReferenceRef)))
  );
}

function isParameterSemanticDiff(
  value: unknown
): value is ParameterSemanticDiff {
  return (
    isRecord(value) &&
    (value.created === undefined ||
      (Array.isArray(value.created) &&
        value.created.every(isCadParameterRef))) &&
    (value.modified === undefined ||
      (Array.isArray(value.modified) &&
        value.modified.every(isCadParameterRef))) &&
    (value.deleted === undefined ||
      (Array.isArray(value.deleted) && value.deleted.every(isCadParameterRef)))
  );
}

function isSketchDimensionSemanticDiff(
  value: unknown
): value is SketchDimensionSemanticDiff {
  return (
    isRecord(value) &&
    (value.created === undefined ||
      (Array.isArray(value.created) &&
        value.created.every(isCadSketchDimensionRef))) &&
    (value.modified === undefined ||
      (Array.isArray(value.modified) &&
        value.modified.every(isCadSketchDimensionRef))) &&
    (value.deleted === undefined ||
      (Array.isArray(value.deleted) &&
        value.deleted.every(isCadSketchDimensionRef)))
  );
}

function isSketchConstraintSemanticDiff(
  value: unknown
): value is SketchConstraintSemanticDiff {
  return (
    isRecord(value) &&
    (value.created === undefined ||
      (Array.isArray(value.created) &&
        value.created.every(isCadSketchConstraintRef))) &&
    (value.modified === undefined ||
      (Array.isArray(value.modified) &&
        value.modified.every(isCadSketchConstraintRef))) &&
    (value.deleted === undefined ||
      (Array.isArray(value.deleted) &&
        value.deleted.every(isCadSketchConstraintRef)))
  );
}

function isCadObjectRef(value: unknown): value is CadObjectRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.kind === "box" ||
      value.kind === "cylinder" ||
      value.kind === "sphere" ||
      value.kind === "cone" ||
      value.kind === "torus")
  );
}

function isCadSketchRef(value: unknown): value is CadSketchRef {
  return isRecord(value) && typeof value.id === "string";
}

function isCadSketchEntityRef(value: unknown): value is CadSketchEntityRef {
  return (
    isRecord(value) &&
    typeof value.sketchId === "string" &&
    typeof value.id === "string" &&
    isSketchEntityKind(value.kind)
  );
}

function isCadFeatureRef(value: unknown): value is CadFeatureRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.kind === "extrude" &&
    typeof value.bodyId === "string" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    (value.profileKind === "rectangle" || value.profileKind === "circle") &&
    (value.targetBodyId === undefined ||
      typeof value.targetBodyId === "string") &&
    (value.operationMode === undefined ||
      isExtrudeOperationMode(value.operationMode))
  );
}

function isCadBodyRef(value: unknown): value is CadBodyRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.kind === "solid" &&
    typeof value.featureId === "string"
  );
}

function isCadNamedReferenceRef(value: unknown): value is CadNamedReferenceRef {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.bodyId === "string" &&
    typeof value.stableId === "string" &&
    isGeneratedEntityKind(value.kind)
  );
}

function isCadParameterRef(value: unknown): value is CadParameterRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string"
  );
}

function isCadSketchDimensionRef(
  value: unknown
): value is CadSketchDimensionRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    isSketchDimensionTarget(value.target) &&
    (value.parameterId === undefined || typeof value.parameterId === "string")
  );
}

function isCadSketchConstraintRef(
  value: unknown
): value is CadSketchConstraintRef {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.sketchId === "string" &&
    typeof value.entityId === "string" &&
    isSketchConstraintKind(value.kind)
  );
}

function isBoxDimensions(value: unknown): value is BoxDimensions {
  return (
    isRecord(value) &&
    typeof value.width === "number" &&
    isPositiveFiniteNumber(value.width) &&
    typeof value.height === "number" &&
    isPositiveFiniteNumber(value.height) &&
    typeof value.depth === "number" &&
    isPositiveFiniteNumber(value.depth)
  );
}

function isCylinderDimensions(value: unknown): value is CylinderDimensions {
  return (
    isRecord(value) &&
    typeof value.radius === "number" &&
    isPositiveFiniteNumber(value.radius) &&
    typeof value.height === "number" &&
    isPositiveFiniteNumber(value.height)
  );
}

function isSphereDimensions(value: unknown): value is SphereDimensions {
  return (
    isRecord(value) &&
    typeof value.radius === "number" &&
    isPositiveFiniteNumber(value.radius)
  );
}

function isConeDimensions(value: unknown): value is ConeDimensions {
  return (
    isRecord(value) &&
    typeof value.radius === "number" &&
    isPositiveFiniteNumber(value.radius) &&
    typeof value.height === "number" &&
    isPositiveFiniteNumber(value.height)
  );
}

function isTorusDimensions(value: unknown): value is TorusDimensions {
  return (
    isRecord(value) &&
    typeof value.majorRadius === "number" &&
    isPositiveFiniteNumber(value.majorRadius) &&
    typeof value.minorRadius === "number" &&
    isPositiveFiniteNumber(value.minorRadius) &&
    value.minorRadius < value.majorRadius
  );
}

function isOptionalTransform(value: unknown): value is Partial<Transform> {
  if (value === undefined) {
    return true;
  }

  return (
    isRecord(value) &&
    (value.translation === undefined || isVec3(value.translation)) &&
    (value.rotation === undefined || isVec3(value.rotation)) &&
    (value.scale === undefined || isVec3(value.scale))
  );
}

function isVec3(value: unknown): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isVec2(value: unknown): value is Vec2 {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isSketchEntity(value: unknown): value is SketchEntitySnapshot {
  if (!isRecord(value) || typeof value.id !== "string") {
    return false;
  }

  if (value.kind === "point") {
    return isVec2(value.point);
  }

  if (value.kind === "line") {
    return isVec2(value.start) && isVec2(value.end);
  }

  if (value.kind === "rectangle") {
    return (
      isVec2(value.center) &&
      typeof value.width === "number" &&
      isPositiveFiniteNumber(value.width) &&
      typeof value.height === "number" &&
      isPositiveFiniteNumber(value.height)
    );
  }

  if (value.kind === "circle") {
    return (
      isVec2(value.center) &&
      typeof value.radius === "number" &&
      isPositiveFiniteNumber(value.radius)
    );
  }

  return false;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isDocumentUnits(value: unknown): value is DocumentUnits {
  return value === "mm" || value === "cm" || value === "m" || value === "in";
}

function isDocumentUnitUpdateMode(
  value: unknown
): value is DocumentUnitUpdateMode {
  return value === "metadataOnly" || value === "preservePhysicalSize";
}

function isSketchPlane(value: unknown): value is SketchPlane {
  return value === "XY" || value === "XZ" || value === "YZ";
}

function isSketchEntityKind(value: unknown): value is SketchEntityKind {
  return (
    value === "point" ||
    value === "line" ||
    value === "rectangle" ||
    value === "circle"
  );
}

function isSketchDimensionTarget(
  value: unknown
): value is SketchDimensionTarget {
  return (
    isRecord(value) &&
    ((value.entityKind === "rectangle" &&
      (value.role === "width" || value.role === "height")) ||
      (value.entityKind === "circle" && value.role === "radius") ||
      (value.entityKind === "line" && value.role === "length"))
  );
}

function isSketchConstraintKind(value: unknown): value is SketchConstraintKind {
  return (
    value === "horizontal" ||
    value === "vertical" ||
    value === "fixed" ||
    value === "coincident" ||
    value === "midpoint"
  );
}

function isSketchPointTarget(value: unknown): value is SketchPointTarget {
  return (
    isRecord(value) &&
    typeof value.entityId === "string" &&
    isSketchPointTargetRole(value.role)
  );
}

function isSketchDimensionValueInput(value: Record<string, unknown>): boolean {
  const hasLiteral = value.value !== undefined;
  const hasParameter = value.parameterId !== undefined;

  if (hasLiteral === hasParameter) {
    return false;
  }

  return hasLiteral
    ? typeof value.value === "number" && isPositiveFiniteNumber(value.value)
    : typeof value.parameterId === "string";
}

function isExtrudeSide(value: unknown): value is FeatureExtrudeSide {
  return value === "positive" || value === "negative" || value === "symmetric";
}

function isExtrudeOperationMode(
  value: unknown
): value is FeatureExtrudeOperationMode {
  return value === "newBody" || value === "add" || value === "cut";
}

function isGeneratedExtrudeFaceRole(
  value: unknown
): value is SketchAttachmentSnapshot["faceRole"] {
  return (
    value === "startCap" ||
    value === "endCap" ||
    value === "side:uMin" ||
    value === "side:uMax" ||
    value === "side:vMin" ||
    value === "side:vMax" ||
    value === "side:circular"
  );
}

function isGeneratedEntityKind(
  value: unknown
): value is CadGeneratedEntityKind {
  return (
    value === "body" ||
    value === "face" ||
    value === "edge" ||
    value === "vertex"
  );
}

function isGeneratedStableIdShapeForKind(
  bodyId: BodyId,
  stableId: string,
  kind: CadGeneratedEntityKind
): boolean {
  if (kind === "body") {
    return stableId === `generated:body:${bodyId}`;
  }

  const prefix = `generated:${kind}:${bodyId}:`;
  return stableId.startsWith(prefix) && stableId.length > prefix.length;
}

function isCadActorType(value: unknown): value is CadActorMetadata["type"] {
  return (
    value === "human" ||
    value === "agent" ||
    value === "script" ||
    value === "system"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function inferNextTransactionNumber(
  transactions: readonly Transaction[]
): number {
  let maxTransactionNumber = 0;

  for (const transaction of transactions) {
    maxTransactionNumber = Math.max(
      maxTransactionNumber,
      parseTransactionNumber(transaction.id)
    );
  }

  return maxTransactionNumber + 1;
}
