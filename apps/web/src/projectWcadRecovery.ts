import {
  createCadProjectSourceIdentity,
  readCadProjectWcad,
  type CadProject,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import {
  CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS,
  type ProjectCheckpointPayloadRecoveryDiagnostic,
  type ProjectCheckpointPayloadRecoveryResult
} from "@web-cad/cad-protocol";
import {
  checkpointPayloadMatchesSource,
  collectRequiredProjectCheckpoints,
  createProjectPortabilityStatus,
  createWcadTopologyCheckpointPayloadInputCache
} from "./projectWcadWorkflow";

export interface ProjectCheckpointPayloadRecoveryInput {
  readonly currentProject: CadProject;
  readonly currentCheckpointPayloads: readonly WcadTopologyCheckpointPayloadInput[];
  readonly wcadBytes: Uint8Array;
  readonly requestedCheckpointIds?: readonly string[];
}

export interface ProjectCheckpointPayloadRecovery {
  readonly result: ProjectCheckpointPayloadRecoveryResult;
  /** App-owned checkpoint payloads after the atomic recovery attempt. */
  readonly checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[];
}

export async function recoverProjectCheckpointPayloadsFromWcad(
  input: ProjectCheckpointPayloadRecoveryInput
): Promise<ProjectCheckpointPayloadRecovery> {
  const required = collectRequiredProjectCheckpoints(input.currentProject);
  const requiredById = new Map(
    required.map((checkpoint) => [checkpoint.checkpointId, checkpoint])
  );
  const requestedCheckpointIds =
    input.requestedCheckpointIds ??
    (createProjectPortabilityStatus(
      input.currentProject,
      input.currentCheckpointPayloads
    ).status === "payload-missing"
      ? required
          .filter(
            (checkpoint) =>
              !input.currentCheckpointPayloads.some(
                (payload) =>
                  payload.checkpointId === checkpoint.checkpointId &&
                  checkpointPayloadMatchesSource(
                    payload,
                    checkpoint,
                    input.currentProject.document.units
                  )
              )
          )
          .map((checkpoint) => checkpoint.checkpointId)
      : []);
  validateRecoveryRequestIds(requestedCheckpointIds);
  const projectSourceIdentity = createCadProjectSourceIdentity(
    input.currentProject
  );
  const reject = (
    diagnostics: readonly ProjectCheckpointPayloadRecoveryDiagnostic[]
  ): ProjectCheckpointPayloadRecovery => ({
    result: {
      status: "rejected",
      projectSourceIdentity,
      requestedCheckpointIds,
      recoveredCheckpointIds: [],
      diagnostics
    },
    checkpointPayloads: input.currentCheckpointPayloads
  });

  const invalidRequested = requestedCheckpointIds.filter(
    (checkpointId) => !requiredById.has(checkpointId)
  );
  if (invalidRequested.length > 0) {
    return reject(
      invalidRequested.map((checkpointId) =>
        createRecoveryDiagnostic(
          checkpointId,
          "The open project does not request this checkpoint payload.",
          "current project checkpoint",
          "missing"
        )
      )
    );
  }

  const read = await readCadProjectWcad(input.wcadBytes);
  if (!read.ok) {
    const issue = read.issues.find(
      (candidate) => candidate.severity === "error"
    );
    return reject(
      requestedCheckpointIds.map((checkpointId) =>
        createRecoveryDiagnostic(
          checkpointId,
          issue
            ? `${issue.code}: ${issue.message}`
            : "The selected .wcad package is invalid.",
          "matching validated checkpoint payload",
          String(issue?.received ?? "invalid package")
        )
      )
    );
  }

  const receivedProjectSourceIdentity = createCadProjectSourceIdentity(
    read.project
  );
  if (
    receivedProjectSourceIdentity.algorithm !==
      projectSourceIdentity.algorithm ||
    receivedProjectSourceIdentity.sha256 !== projectSourceIdentity.sha256
  ) {
    return reject(
      requestedCheckpointIds.map((checkpointId) =>
        createRecoveryDiagnostic(
          checkpointId,
          "The selected .wcad package belongs to different project source.",
          projectSourceIdentity.sha256,
          receivedProjectSourceIdentity.sha256
        )
      )
    );
  }

  const recoveredById = new Map(
    createWcadTopologyCheckpointPayloadInputCache(read.checkpointPayloads).map(
      (payload) => [payload.checkpointId, payload]
    )
  );
  const mismatches = requestedCheckpointIds.flatMap((checkpointId) => {
    const checkpoint = requiredById.get(checkpointId);
    const payload = recoveredById.get(checkpointId);
    return checkpoint &&
      payload &&
      checkpointPayloadMatchesSource(
        payload,
        checkpoint,
        input.currentProject.document.units
      )
      ? []
      : [
          createRecoveryDiagnostic(
            checkpointId,
            "The selected .wcad package has no matching checkpoint payload.",
            checkpoint
              ? `${checkpoint.bodyId}:${checkpoint.sourceFeatureId ?? ""}`
              : "current project checkpoint",
            payload
              ? `${payload.bodyId}:${payload.sourceFeatureId ?? ""}`
              : "missing"
          )
        ];
  });
  if (mismatches.length > 0) {
    return reject(mismatches);
  }

  const nextById = new Map(
    input.currentCheckpointPayloads.map((payload) => [
      payload.checkpointId,
      payload
    ])
  );
  for (const checkpointId of requestedCheckpointIds) {
    nextById.set(
      checkpointId,
      recoveredById.get(checkpointId) as WcadTopologyCheckpointPayloadInput
    );
  }

  return {
    result: {
      status: "recovered",
      projectSourceIdentity,
      requestedCheckpointIds,
      recoveredCheckpointIds: requestedCheckpointIds,
      diagnostics: []
    },
    checkpointPayloads: [...nextById.values()]
  };
}

function validateRecoveryRequestIds(checkpointIds: readonly string[]): void {
  if (
    checkpointIds.length === 0 ||
    checkpointIds.length >
      CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes ||
    new Set(checkpointIds).size !== checkpointIds.length ||
    checkpointIds.some(
      (checkpointId) =>
        typeof checkpointId !== "string" || checkpointId.trim().length === 0
    )
  ) {
    throw new RangeError(
      `Recovery requires 1-${CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxSourceGraphNodes} unique checkpoint IDs.`
    );
  }
}

function createRecoveryDiagnostic(
  checkpointId: string,
  message: string,
  expected?: string,
  received?: string
): ProjectCheckpointPayloadRecoveryDiagnostic {
  return {
    code: "CHECKPOINT_PAYLOAD_RECOVERY_MISMATCH",
    checkpointId,
    message,
    ...(expected ? { expected } : {}),
    ...(received ? { received } : {})
  };
}
