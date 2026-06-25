import type { CadFeatureSummary } from "@web-cad/cad-core";
import type {
  CadOp,
  CadTopologyIdentityDiagnostic,
  TopologyAnchorCreationPlanQueryResponse
} from "@web-cad/cad-protocol";
import {
  buildCreateSketchOnFaceOp,
  type SketchCreateOnFaceForm
} from "./cadCommands";
import {
  createProjectTopologyAnchorCreationPlanForGeneratedReference,
  type ProjectTopologyAnchorCreationPlanInput,
  type ProjectTopologyAnchorCreationPlanResult
} from "./projectWcadTopologyCheckpoints";

export interface SketchOnFaceCommandPlanInput extends Omit<
  ProjectTopologyAnchorCreationPlanInput,
  "target"
> {
  readonly form: SketchCreateOnFaceForm;
  readonly createAnchorPlan?: (
    input: ProjectTopologyAnchorCreationPlanInput
  ) => Promise<ProjectTopologyAnchorCreationPlanResult>;
}

export type SketchOnFaceCommandPlanResult =
  | {
      readonly ok: true;
      readonly status: "direct" | "ready" | "alreadyExists";
      readonly ops: readonly CadOp[];
      readonly topologyAnchorId?: string;
    }
  | {
      readonly ok: false;
      readonly status: TopologyAnchorCreationPlanQueryResponse["status"];
      readonly message: string;
      readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
      readonly plan?: TopologyAnchorCreationPlanQueryResponse;
    };

export async function createSketchOnFaceCommandPlan({
  form,
  createAnchorPlan = createProjectTopologyAnchorCreationPlanForGeneratedReference,
  ...planInput
}: SketchOnFaceCommandPlanInput): Promise<SketchOnFaceCommandPlanResult> {
  if (!shouldPromoteSketchOnFaceTarget(form, planInput.features)) {
    return {
      ok: true,
      status: "direct",
      ops: [buildCreateSketchOnFaceOp(form)]
    };
  }

  const plan = await createAnchorPlan({
    ...planInput,
    target: {
      bodyId: form.bodyId,
      stableId: form.faceStableId,
      kind: "face"
    }
  });

  if (!plan.ok) {
    return {
      ok: false,
      status: plan.status,
      message: plan.message,
      diagnostics: plan.diagnostics,
      ...(plan.plan ? { plan: plan.plan } : {})
    };
  }

  if (plan.plan.status !== "ready" && plan.plan.status !== "alreadyExists") {
    return {
      ok: false,
      status: plan.plan.status,
      message: "Selected face is not ready for sketch attachment.",
      diagnostics: plan.plan.diagnostics,
      plan: plan.plan
    };
  }

  const topologyAnchorId = plan.plan.anchorId?.trim();

  if (!topologyAnchorId) {
    return {
      ok: false,
      status: plan.plan.status,
      message: "Selected face could not be saved for sketch attachment.",
      diagnostics: plan.plan.diagnostics,
      plan: plan.plan
    };
  }

  const topologyAnchorProof =
    form.topologyAnchorProof ?? plan.topologyAnchorProof;

  if (!topologyAnchorProof) {
    return {
      ok: false,
      status: "unsupported",
      message: "Selected face is not ready for replayable sketch attachment.",
      diagnostics: plan.plan.diagnostics,
      plan: plan.plan
    };
  }

  const sketchOp = buildCreateSketchOnFaceOp({
    ...form,
    topologyAnchorId,
    topologyAnchorProof
  });

  return {
    ok: true,
    status: plan.plan.status,
    topologyAnchorId,
    ops:
      plan.plan.status === "ready" ? [...plan.plan.ops, sketchOp] : [sketchOp]
  };
}

export function shouldPromoteSketchOnFaceTarget(
  form: SketchCreateOnFaceForm,
  features: readonly CadFeatureSummary[]
): boolean {
  const feature = features.find(
    (candidate) => candidate.bodyId === form.bodyId
  );

  if (!feature) {
    return false;
  }

  if (feature.kind === "extrude" || feature.kind === "revolve") {
    return feature.operationMode !== "newBody";
  }

  return (
    feature.kind === "hole" ||
    feature.kind === "chamfer" ||
    feature.kind === "fillet"
  );
}
