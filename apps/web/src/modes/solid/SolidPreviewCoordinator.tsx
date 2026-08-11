import {
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProject,
  type CadFeatureSummary,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import { useEffect, useRef } from "react";

import {
  buildBatch,
  WEB_UI_ACTOR
} from "../../cadCommands";
import type { DerivedGeometryRuntime } from "../../derivedGeometryRuntime";
import type { CurrentExactBodyArtifactEvidence } from "../../currentExactBodyResolver";
import type { ExactFeaturePreviewGeometryResult } from "../../exactFeaturePreviewGeometry";
import {
  type ExactFeaturePreviewContext,
  type ExactFeaturePreviewJobController,
  type ExactFeaturePreviewRequest,
  type ExactFeaturePreviewState
} from "../../exactFeaturePreviewJob";
import { type SolidPreviewPresentationState } from "./SolidModePanel";
import type { SolidSelectedSketchEntityContext } from "./exactFeaturePreviewPlan";
import { type SolidEditorRequest, type SolidEditorSubmission } from "./solidEditorTypes";

type SolidExactFeaturePreviewInput = {
  readonly batch: ReturnType<typeof buildBatch>;
  readonly bodyId?: string;
  readonly operationLabel: string;
  readonly checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[];
  readonly existingArtifacts: readonly CurrentExactBodyArtifactEvidence[];
};

export interface SolidPreviewCoordinatorContext {
  readonly lifecycleKey: string;
  readonly exactContext: ExactFeaturePreviewContext;
  readonly request?: SolidEditorRequest;
  readonly selectedFeature?: CadFeatureSummary;
  readonly selectedSketchEntityContext?: SolidSelectedSketchEntityContext;
  readonly existingArtifacts: readonly CurrentExactBodyArtifactEvidence[];
  readonly checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[];
}

export interface SolidPreviewCoordinatorProps {
  readonly engine: CadEngine;
  readonly context: SolidPreviewCoordinatorContext;
  readonly submission?: SolidEditorSubmission;
  readonly getDerivedGeometryRuntime: () => DerivedGeometryRuntime;
  readonly onPresentationChange: (state: SolidPreviewPresentationState) => void;
  readonly onResultChange: (
    result: ExactFeaturePreviewGeometryResult | undefined
  ) => void;
}

function sourceIdentityKey(
  identity: ReturnType<typeof createCadProjectSourceIdentity>
): string {
  return `${identity.algorithm}:${identity.sha256}`;
}

function formatPreviewError(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "The exact preview could not be built.";
}

function presentPreviewState(
  state: ExactFeaturePreviewState<
    SolidExactFeaturePreviewInput,
    ExactFeaturePreviewGeometryResult
  >
): SolidPreviewPresentationState {
  switch (state.status) {
    case "pending":
      return {
        status: "pending",
        message: "Building an exact preview…"
      };
    case "ready":
      return {
        status: "ready",
        message: "Exact preview ready. Apply to commit this change."
      };
    case "failed":
      return {
        status: "failed",
        message: formatPreviewError(state.error)
      };
    case "idle":
    case "cancelled":
    case "disposed":
      return { status: "idle", message: "" };
  }
}

function sameExactContext(
  left: ExactFeaturePreviewContext,
  right: ExactFeaturePreviewContext
): boolean {
  return (
    left.liveRevision === right.liveRevision &&
    left.sourceIdentity === right.sourceIdentity &&
    left.editorOwnership === right.editorOwnership
  );
}

type ActivePreviewRun = {
  readonly intent: number;
  readonly submission: SolidEditorSubmission;
  readonly context: SolidPreviewCoordinatorContext;
  sequence?: number;
};

export function SolidPreviewCoordinator({
  engine,
  context,
  submission,
  getDerivedGeometryRuntime,
  onPresentationChange,
  onResultChange
}: SolidPreviewCoordinatorProps) {
  const mountedRef = useRef(true);
  const contextRef = useRef(context);
  const submissionRef = useRef(submission);
  const intentRef = useRef(0);
  const previousLifecycleKeyRef = useRef<string | undefined>(undefined);
  const previousSubmissionRef = useRef<SolidEditorSubmission | undefined>(
    undefined
  );
  const activeRunRef = useRef<ActivePreviewRun | undefined>(undefined);
  const controllerRef = useRef<
    ExactFeaturePreviewJobController<
      SolidExactFeaturePreviewInput,
      ExactFeaturePreviewGeometryResult
    >
  >(undefined);
  const controllerLoadRef = useRef<
    Promise<
      ExactFeaturePreviewJobController<
        SolidExactFeaturePreviewInput,
        ExactFeaturePreviewGeometryResult
      >
    >
  >(undefined);

  contextRef.current = context;
  submissionRef.current = submission;

  const isRunCurrent = (run: ActivePreviewRun): boolean => {
    const current = contextRef.current;
    if (
      !mountedRef.current ||
      intentRef.current !== run.intent ||
      submissionRef.current !== run.submission ||
      !current ||
      current.lifecycleKey !== run.context.lifecycleKey ||
      !sameExactContext(current.exactContext, run.context.exactContext)
    ) {
      return false;
    }

    const currentIdentity = createCadProjectSourceIdentity(
      exportCadProject(engine)
    );
    return (
      engine.getSourceAuthorityEpoch() === run.context.exactContext.liveRevision &&
      sourceIdentityKey(currentIdentity) ===
        run.context.exactContext.sourceIdentity
    );
  };

  const isCurrentRequest = (
    exactContext: ExactFeaturePreviewContext,
    request?: ExactFeaturePreviewRequest<SolidExactFeaturePreviewInput>
  ): boolean => {
    const run = activeRunRef.current;
    return Boolean(
      run &&
        sameExactContext(run.context.exactContext, exactContext) &&
        (!run.sequence || !request || request.sequence === run.sequence) &&
        (!request || sameExactContext(request.context, exactContext)) &&
        isRunCurrent(run)
    );
  };

  const clear = () => {
    ++intentRef.current;
    activeRunRef.current = undefined;
    controllerRef.current?.clear();
    if (!mountedRef.current) return;
    onResultChange(undefined);
    onPresentationChange({ status: "idle", message: "" });
  };

  const ensureController = async () => {
    if (controllerRef.current) return controllerRef.current;
    if (!controllerLoadRef.current) {
      controllerLoadRef.current = import("../../exactFeaturePreviewJob").then(
        ({ createExactFeaturePreviewJobController }) => {
          const controller = createExactFeaturePreviewJobController<
            SolidExactFeaturePreviewInput,
            ExactFeaturePreviewGeometryResult
          >({
            worker: async (request, signal, registerAllocatedResult) => {
              const { projectExactFeaturePreviewGeometry } = await import(
                "../../exactFeaturePreviewGeometry"
              );
              const result = await projectExactFeaturePreviewGeometry({
                engine,
                batch: request.input.batch,
                ...(request.input.bodyId
                  ? { bodyId: request.input.bodyId }
                  : {}),
                operationLabel: request.input.operationLabel,
                runtime: getDerivedGeometryRuntime(),
                checkpointPayloads: request.input.checkpointPayloads,
                existingArtifacts: request.input.existingArtifacts,
                expectedSourceAuthorityEpoch:
                  request.context.liveRevision,
                signal,
                requestIdPrefix: `feature-preview-${request.sequence}`,
                isCurrent: () =>
                  isCurrentRequest(request.context, request)
              });
              registerAllocatedResult(result);
              return result;
            },
            isCurrent: (exactContext, request) =>
              isCurrentRequest(exactContext, request),
            // Preview results contain copied mesh/artifact data, not live OCCT handles.
            disposeResult: () => undefined,
            onStateChange: (state) => {
              const run = activeRunRef.current;
              if (
                !run ||
                !isRunCurrent(run) ||
                ("request" in state &&
                  !sameExactContext(state.request.context, run.context.exactContext)) ||
                ("request" in state &&
                  run.sequence !== undefined &&
                  state.request.sequence !== run.sequence)
              ) {
                return;
              }
              onPresentationChange(presentPreviewState(state));
              onResultChange(state.status === "ready" ? state.result : undefined);
            }
          });
          if (!mountedRef.current) {
            controller.dispose();
            return controller;
          }
          controllerRef.current = controller;
          return controller;
        }
      );
    }
    return controllerLoadRef.current!;
  };

  useEffect(() => {
    const lifecycleChanged =
      previousLifecycleKeyRef.current !== context.lifecycleKey;
    const submissionChanged = previousSubmissionRef.current !== submission;
    previousLifecycleKeyRef.current = context.lifecycleKey;
    previousSubmissionRef.current = submission;

    if (lifecycleChanged) clear();
    if (!submission) {
      if (!lifecycleChanged) clear();
      return;
    }
    if (!submissionChanged) {
      return;
    }

    const intent = ++intentRef.current;
    const capturedContext = context;
    const capturedSubmission = submission;
    const run: ActivePreviewRun = {
      intent,
      submission: capturedSubmission,
      context: capturedContext
    };
    activeRunRef.current = run;
    onResultChange(undefined);
    onPresentationChange({
      status: "pending",
      message: "Building an exact preview…"
    });

    const fail = (error: unknown) => {
      if (!isRunCurrent(run)) return;
      onResultChange(undefined);
      onPresentationChange({
        status: "failed",
        message: formatPreviewError(error)
      });
    };

    void (async () => {
      try {
        if (!capturedContext.request || !isRunCurrent(run)) {
          fail(new Error("The active solid editor is no longer available."));
          return;
        }
        const { planExactFeaturePreview } = await import(
          "./exactFeaturePreviewPlan"
        );
        if (!isRunCurrent(run)) return;
        const plan = planExactFeaturePreview({
          request: capturedContext.request,
          submission: capturedSubmission,
          existingFeature: capturedContext.selectedFeature,
          selectedSketchEntityContext:
            capturedContext.selectedSketchEntityContext
        });
        if (plan.status !== "supported") {
          fail(new Error(plan.reason));
          return;
        }

        const controller = await ensureController();
        if (!isRunCurrent(run)) return;
        const batch = buildBatch("commit", plan.ops, WEB_UI_ACTOR);
        const handle = controller.start(
          {
            batch,
            ...(plan.affectedBodyId ?? plan.resultBodyId
              ? { bodyId: plan.affectedBodyId ?? plan.resultBodyId }
              : {}),
            operationLabel: capturedContext.request.title,
            checkpointPayloads: capturedContext.checkpointPayloads,
            existingArtifacts: capturedContext.existingArtifacts
          },
          capturedContext.exactContext
        );
        run.sequence = handle.sequence;
      } catch (error) {
        fail(error);
      }
    })();
  }, [context.lifecycleKey, submission]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ++intentRef.current;
      activeRunRef.current = undefined;
      controllerRef.current?.dispose();
      controllerRef.current = undefined;
    };
  }, []);

  return null;
}
