import {
  CadOpsAgentAdapter,
  createCadOpsAgentCurrentSelectionResponse,
  executeCadOpsAgentRequestAsync,
  parseCadAgentApprovalMode,
  parseCadAgentExactExportRequest,
  parseCadAgentExactExportProposal,
  parseCadAgentExactExportResult,
  parseCadAgentSessionErrorResponse,
  parseCadOpsAgentCurrentSelectionRequest,
  parseCadOpsAgentQueryRequest,
  parseCadOpsAgentRequest,
  parseCadOpsAgentV8ProjectSurfaceRequest,
  type CadAgentApprovalMode,
  type CadAgentCommitProposal,
  type CadAgentExactExportProposal,
  type CadAgentExactExportRequest,
  type CadAgentExactExportResult,
  type CadAgentSessionErrorResponse,
  type CadCurrentSelection,
  type CadOpsAgentCurrentSelectionResponse,
  type CadOpsAgentCurrentExactEvidence,
  type CadOpsAgentQueryResponse,
  type CadOpsAgentRequest,
  type CadOpsAgentResponse,
  type CadOpsAgentSuccessResponse,
  type CadOpsAgentV8ProjectSurfaceResponse
} from "@web-cad/agent-adapter";
import {
  createCadProjectSourceIdentity,
  exportCadProject,
  type AsyncCadCommandExecutor,
  type CadEngine
} from "@web-cad/cad-core";

const RELAY_PATH = "/__partbench/agent";
const TOKEN_HEADER = "x-partbench-agent-token";

export interface LocalAgentSessionSnapshot {
  readonly connected: boolean;
  readonly approvalMode: CadAgentApprovalMode;
  readonly proposal?: CadAgentCommitProposal | CadAgentExactExportProposal;
  readonly approving: boolean;
  readonly diagnostic?: CadAgentSessionErrorResponse["error"];
}

export type LocalAgentCommitPreflight = (
  request: CadOpsAgentRequest,
  sourceAuthorityEpoch: number
) => Promise<
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string }
  | boolean
  | undefined
>;

export interface LocalAgentSessionOptions {
  readonly token: string;
  readonly engine: CadEngine;
  readonly executor: AsyncCadCommandExecutor;
  readonly readSelection: () => CurrentAgentSelectionInput;
  readonly readCurrentExactEvidence?: () => CadOpsAgentCurrentExactEvidence;
  readonly preflightCommit: LocalAgentCommitPreflight;
  readonly publishCommit: (
    response: CadOpsAgentSuccessResponse
  ) => Promise<void>;
  readonly planExactExport?: (
    request: CadAgentExactExportRequest
  ) =>
    | LocalAgentExactExportPlanOutcome
    | Promise<LocalAgentExactExportPlanOutcome>;
  readonly executeExactExport?: (
    proposal: CadAgentExactExportProposal
  ) => Promise<CadAgentExactExportResult>;
  readonly cancelExactExport?: () => void;
}

type LocalAgentExactExportPlanOutcome =
  | {
      readonly status: "proposal";
      readonly proposal: CadAgentExactExportProposal;
    }
  | { readonly status: "failed"; readonly result: CadAgentExactExportResult };

export interface CurrentAgentSelectionInput {
  readonly namedReferenceName?: string;
  readonly generatedReference?: {
    readonly bodyId: string;
    readonly stableId: string;
    readonly expectedKind?: "body" | "face" | "edge" | "vertex" | "axis";
  };
  readonly sketch?: { readonly sketchId: string; readonly entityId?: string };
  readonly bodyId?: string;
  readonly objectId?: string;
}

type RelayResponse =
  | CadOpsAgentResponse
  | CadOpsAgentQueryResponse
  | CadOpsAgentV8ProjectSurfaceResponse
  | CadOpsAgentCurrentSelectionResponse
  | CadAgentExactExportResult
  | CadAgentSessionErrorResponse;

type RelayRequest = {
  readonly requestId: string;
  readonly method:
    | "execute"
    | "query"
    | "inspectV8ProjectSurface"
    | "getCurrentSelection"
    | "requestExactExport";
  readonly request: unknown;
};

interface PendingCommitProposal {
  readonly kind: "commit";
  readonly request: CadOpsAgentRequest;
  readonly proposal: CadAgentCommitProposal;
  readonly sourceAuthorityEpoch: number;
  resolve(response: CadOpsAgentResponse | CadAgentSessionErrorResponse): void;
}

interface PendingExactExportProposal {
  readonly kind: "exactExport";
  readonly request: CadAgentExactExportRequest;
  readonly proposal: CadAgentExactExportProposal;
  readonly sourceAuthorityEpoch: number;
  resolve(
    response: CadAgentExactExportResult | CadAgentSessionErrorResponse
  ): void;
}

type PendingProposal = PendingCommitProposal | PendingExactExportProposal;

export class LocalAgentSession {
  readonly #adapter: CadOpsAgentAdapter;
  readonly #clientId = crypto.randomUUID();
  readonly #abort = new AbortController();
  readonly #listeners = new Set<
    (snapshot: LocalAgentSessionSnapshot) => void
  >();
  #snapshot: LocalAgentSessionSnapshot = disconnectedAgentSessionSnapshot();
  #pending: PendingProposal | undefined;
  #preparingProposalRequestId: string | undefined;
  #approveAllQueue: Promise<void> = Promise.resolve();
  #sessionGeneration = 0;
  #started = false;
  #disposed = false;

  constructor(readonly options: LocalAgentSessionOptions) {
    this.#adapter = new CadOpsAgentAdapter(
      options.engine,
      options.readCurrentExactEvidence
    );
  }

  getSnapshot(): LocalAgentSessionSnapshot {
    return this.#snapshot;
  }

  subscribe(
    listener: (snapshot: LocalAgentSessionSnapshot) => void
  ): () => void {
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  async start(): Promise<void> {
    if (this.#started || this.#disposed) return;
    this.#started = true;
    window.addEventListener("pagehide", this.#handlePageHide);
    try {
      await this.#post("connect", { clientId: this.#clientId });
      this.#publish({
        ...this.#snapshot,
        connected: true,
        diagnostic: undefined
      });
      void this.#poll();
    } catch (error) {
      this.#disconnect(readSessionError(error));
    }
  }

  setApprovalMode(mode: CadAgentApprovalMode): boolean {
    const validMode = parseCadAgentApprovalMode(mode);
    if (
      this.#pending ||
      this.#preparingProposalRequestId ||
      this.#disposed ||
      (this.#started && !this.#snapshot.connected)
    )
      return false;
    this.#publish({ ...this.#snapshot, approvalMode: validMode });
    return true;
  }

  refreshSourceIdentity(): void {
    const pending = this.#pending;
    if (
      !pending ||
      this.#snapshot.approving ||
      (pending.sourceAuthorityEpoch ===
        this.options.engine.getSourceAuthorityEpoch() &&
        sameSourceIdentity(
          pending.proposal.sourceIdentity,
          this.#sourceIdentity()
        ))
    ) {
      return;
    }
    this.#settlePending(
      sessionError(
        pending.request.requestId,
        "AGENT_PROPOSAL_STALE",
        "The project changed after the agent proposal was previewed."
      )
    );
  }

  invalidateProposal(
    message = "The project was replaced after the agent proposal was previewed."
  ): void {
    if (!this.#pending || this.#snapshot.approving) return;
    this.#settlePending(
      sessionError(
        this.#pending.request.requestId,
        "AGENT_PROPOSAL_STALE",
        message
      )
    );
  }

  async approve(): Promise<void> {
    const pending = this.#pending;
    if (!pending || this.#snapshot.approving) return;
    this.#publish({ ...this.#snapshot, approving: true });

    if (
      pending.sourceAuthorityEpoch !==
        this.options.engine.getSourceAuthorityEpoch() ||
      !sameSourceIdentity(
        pending.proposal.sourceIdentity,
        this.#sourceIdentity()
      )
    ) {
      this.#settlePending(
        sessionError(
          pending.request.requestId,
          "AGENT_PROPOSAL_STALE",
          "The project changed after the agent proposal was previewed."
        )
      );
      return;
    }

    const sessionGeneration = this.#sessionGeneration;
    if (pending.kind === "exactExport") {
      let result: CadAgentExactExportResult;
      try {
        result = this.options.executeExactExport
          ? parseCadAgentExactExportResult(
              await this.options.executeExactExport(pending.proposal)
            )
          : createExactExportTerminalResult(
              pending,
              "failed",
              "EXPORT_EXACT_WRITER_UNAVAILABLE",
              "The browser exact-export executor is unavailable."
            );
      } catch {
        result = createExactExportTerminalResult(
          pending,
          "failed",
          "EXPORT_STEP_TRANSFER_FAILED",
          "The browser exact-export executor failed."
        );
      }
      if (this.#sessionAlive(sessionGeneration) && this.#pending === pending) {
        this.#settlePending(result);
      }
      return;
    }
    const committed = await this.#executeAtSourceAuthorityEpoch(
      pending.request,
      pending.sourceAuthorityEpoch,
      sessionGeneration
    );
    if (!committed) {
      this.#settlePending(
        this.#sessionAlive(sessionGeneration)
          ? sessionError(
              pending.request.requestId,
              "AGENT_PROPOSAL_STALE",
              "The project changed after the agent proposal was previewed."
            )
          : this.#disconnected(pending.request.requestId)
      );
      return;
    }
    try {
      if (committed.ok) await this.options.publishCommit(committed);
    } finally {
      this.#settlePending(committed);
    }
  }

  reject(): void {
    const pending = this.#pending;
    if (!pending || this.#snapshot.approving) return;
    this.#settlePending(
      pending.kind === "exactExport"
        ? createExactExportTerminalResult(pending, "rejected")
        : sessionError(
            pending.request.requestId,
            "AGENT_COMMIT_REJECTED",
            "The user rejected the agent commit proposal."
          )
    );
  }

  cancelExactExport(): void {
    const pending = this.#pending;
    if (!pending || pending.kind !== "exactExport") return;
    if (this.#snapshot.approving) {
      this.options.cancelExactExport?.();
      return;
    }
    this.#settlePending(createExactExportTerminalResult(pending, "cancelled"));
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    window.removeEventListener("pagehide", this.#handlePageHide);
    void fetch(`${RELAY_PATH}/disconnect`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ clientId: this.#clientId }),
      keepalive: true
    }).catch(() => undefined);
    this.#abort.abort();
    this.#disconnect(
      sessionError(
        "session",
        "AGENT_SESSION_DISCONNECTED",
        "The browser session disconnected."
      )
    );
  }

  async execute(
    request: CadOpsAgentRequest
  ): Promise<CadOpsAgentResponse | CadAgentSessionErrorResponse> {
    if (this.#disposed || (this.#started && !this.#snapshot.connected))
      return this.#disconnected(request.requestId);
    if (request.batch.mode === "dryRun")
      return this.#execute(request, "dryRun");
    if (this.#snapshot.approvalMode === "approveAll") {
      const sessionGeneration = this.#sessionGeneration;
      const response = this.#approveAllQueue.then(async () => {
        if (!this.#sessionAlive(sessionGeneration)) {
          return this.#disconnected(request.requestId);
        }
        const response = await this.#executeAtSourceAuthorityEpoch(
          request,
          this.options.engine.getSourceAuthorityEpoch(),
          sessionGeneration
        );
        if (!response) {
          return this.#sessionAlive(sessionGeneration)
            ? sessionError(
                request.requestId,
                "AGENT_PROPOSAL_STALE",
                "The project changed while the agent commit was preflighted."
              )
            : this.#disconnected(request.requestId);
        }
        if (response.ok) await this.options.publishCommit(response);
        return response;
      });
      this.#approveAllQueue = response.then(
        () => undefined,
        () => undefined
      );
      return response;
    }
    if (this.#pending || this.#preparingProposalRequestId) {
      return sessionError(
        request.requestId,
        "AGENT_APPROVAL_BUSY",
        "Another agent commit proposal is waiting for approval."
      );
    }

    const sessionGeneration = this.#sessionGeneration;
    this.#preparingProposalRequestId = request.requestId;
    const sourceAuthorityEpoch = this.options.engine.getSourceAuthorityEpoch();
    const sourceIdentity = this.#sourceIdentity();
    try {
      const preview = await this.#execute(request, "dryRun");
      if (!preview.ok) return preview;
      if (this.#disposed || sessionGeneration !== this.#sessionGeneration) {
        return this.#disconnected(request.requestId);
      }
      if (
        sourceAuthorityEpoch !==
          this.options.engine.getSourceAuthorityEpoch() ||
        !sameSourceIdentity(sourceIdentity, this.#sourceIdentity())
      ) {
        return sessionError(
          request.requestId,
          "AGENT_PROPOSAL_STALE",
          "The project changed while the agent proposal was previewed."
        );
      }
      const proposal: CadAgentCommitProposal = {
        requestId: request.requestId,
        sourceIdentity,
        semanticDiff: preview.semanticDiff,
        warnings: preview.warnings,
        ...(preview.actor ? { actor: preview.actor } : {}),
        ...(preview.audit ? { audit: preview.audit } : {}),
        review: preview.review
      };
      this.#preparingProposalRequestId = undefined;
      return new Promise((resolve) => {
        this.#pending = {
          kind: "commit",
          request,
          proposal,
          sourceAuthorityEpoch,
          resolve
        };
        this.#publish({ ...this.#snapshot, proposal, approving: false });
      });
    } finally {
      if (this.#preparingProposalRequestId === request.requestId) {
        this.#preparingProposalRequestId = undefined;
      }
    }
  }

  async requestExactExport(
    request: unknown
  ): Promise<CadAgentExactExportResult | CadAgentSessionErrorResponse> {
    const validRequest = parseCadAgentExactExportRequest(request);
    if (this.#disposed || (this.#started && !this.#snapshot.connected)) {
      return this.#disconnected(validRequest.requestId);
    }
    const prepare = () =>
      this.options.planExactExport?.(validRequest) ?? {
        status: "failed" as const,
        result: createUnavailableExactExportResult(
          validRequest,
          this.options.engine.getDocument().units
        )
      };

    if (this.#snapshot.approvalMode === "approveAll") {
      const sessionGeneration = this.#sessionGeneration;
      const response = this.#approveAllQueue.then(async () => {
        try {
          if (!this.#sessionAlive(sessionGeneration)) {
            return this.#disconnected(validRequest.requestId);
          }
          const planned = await prepare();
          if (planned.status === "failed") {
            return parseCadAgentExactExportResult(planned.result);
          }
          const proposal = parseCadAgentExactExportProposal(planned.proposal);
          return this.options.executeExactExport
            ? parseCadAgentExactExportResult(
                await this.options.executeExactExport(proposal)
              )
            : createUnavailableExactExportResult(
                validRequest,
                proposal.plan.units
              );
        } catch {
          return createUnavailableExactExportResult(
            validRequest,
            this.options.engine.getDocument().units,
            "EXPORT_STEP_TRANSFER_FAILED",
            "The browser exact-export action failed."
          );
        }
      });
      this.#approveAllQueue = response.then(
        () => undefined,
        () => undefined
      );
      return response;
    }

    if (this.#pending || this.#preparingProposalRequestId) {
      return sessionError(
        validRequest.requestId,
        "AGENT_APPROVAL_BUSY",
        "Another agent commit or export proposal is waiting for approval."
      );
    }
    const sessionGeneration = this.#sessionGeneration;
    const sourceAuthorityEpoch = this.options.engine.getSourceAuthorityEpoch();
    const sourceIdentity = this.#sourceIdentity();
    this.#preparingProposalRequestId = validRequest.requestId;
    try {
      let planned: LocalAgentExactExportPlanOutcome;
      try {
        planned = await prepare();
      } catch {
        return createUnavailableExactExportResult(
          validRequest,
          this.options.engine.getDocument().units,
          "EXPORT_STEP_TRANSFER_FAILED",
          "The browser exact-export planner failed."
        );
      }
      if (planned.status === "failed") {
        return parseCadAgentExactExportResult(planned.result);
      }
      const proposal = parseCadAgentExactExportProposal(planned.proposal);
      if (
        !this.#sessionAlive(sessionGeneration) ||
        sourceAuthorityEpoch !==
          this.options.engine.getSourceAuthorityEpoch() ||
        !sameSourceIdentity(sourceIdentity, this.#sourceIdentity()) ||
        !sameSourceIdentity(sourceIdentity, proposal.sourceIdentity)
      ) {
        return sessionError(
          validRequest.requestId,
          "AGENT_PROPOSAL_STALE",
          "The project changed while the exact export proposal was prepared."
        );
      }
      this.#preparingProposalRequestId = undefined;
      return new Promise((resolve) => {
        this.#pending = {
          kind: "exactExport",
          request: validRequest,
          proposal,
          sourceAuthorityEpoch,
          resolve
        };
        this.#publish({
          ...this.#snapshot,
          proposal,
          approving: false
        });
      });
    } finally {
      if (this.#preparingProposalRequestId === validRequest.requestId) {
        this.#preparingProposalRequestId = undefined;
      }
    }
  }

  async query(request: unknown): Promise<CadOpsAgentQueryResponse> {
    return this.#adapter.query(parseCadOpsAgentQueryRequest(request));
  }

  async inspectV8ProjectSurface(
    request: unknown
  ): Promise<CadOpsAgentV8ProjectSurfaceResponse> {
    return this.#adapter.inspectV8ProjectSurface(
      parseCadOpsAgentV8ProjectSurfaceRequest(request)
    );
  }

  async getCurrentSelection(
    request: unknown
  ): Promise<CadOpsAgentCurrentSelectionResponse> {
    return createCadOpsAgentCurrentSelectionResponse(
      this.options.engine,
      parseCadOpsAgentCurrentSelectionRequest(request),
      createCurrentAgentSelectionForEngine(
        this.options.engine,
        this.options.readSelection()
      )
    );
  }

  async #execute(
    request: CadOpsAgentRequest,
    mode: "dryRun" | "commit"
  ): Promise<CadOpsAgentResponse> {
    return executeCadOpsAgentRequestAsync(
      this.options.engine,
      this.options.executor,
      {
        ...request,
        batch: { ...request.batch, mode },
        permissions: { allowCommit: true }
      }
    );
  }

  async #executeAtSourceAuthorityEpoch(
    request: CadOpsAgentRequest,
    expectedSourceAuthorityEpoch: number,
    sessionGeneration: number
  ): Promise<CadOpsAgentResponse | CadAgentSessionErrorResponse | undefined> {
    if (
      !this.#sessionAlive(sessionGeneration) ||
      this.options.engine.getSourceAuthorityEpoch() !==
        expectedSourceAuthorityEpoch
    ) {
      return undefined;
    }

    let preflight: Awaited<ReturnType<LocalAgentCommitPreflight>>;
    try {
      preflight = await this.options.preflightCommit(
        request,
        expectedSourceAuthorityEpoch
      );
    } catch (error) {
      preflight = {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Exact geometry preflight failed."
      };
    }
    if (
      !this.#sessionAlive(sessionGeneration) ||
      this.options.engine.getSourceAuthorityEpoch() !==
        expectedSourceAuthorityEpoch
    ) {
      return undefined;
    }
    if (preflight !== true && (preflight === false || !preflight?.ok)) {
      return sessionError(
        request.requestId,
        "AGENT_COMMIT_REJECTED",
        typeof preflight === "object" && preflight?.message
          ? preflight.message
          : "Exact geometry preflight rejected the agent commit."
      );
    }

    return executeCadOpsAgentRequestAsync(
      this.options.engine,
      this.options.executor,
      {
        ...request,
        batch: { ...request.batch, mode: "commit" },
        permissions: { allowCommit: true }
      },
      expectedSourceAuthorityEpoch,
      () => this.#sessionAlive(sessionGeneration)
    );
  }

  #sessionAlive(sessionGeneration: number): boolean {
    return !this.#disposed && this.#sessionGeneration === sessionGeneration;
  }

  async #poll(): Promise<void> {
    while (!this.#disposed && this.#snapshot.connected) {
      try {
        const response = await this.#post("poll", { clientId: this.#clientId });
        const request = readRelayRequest(response);
        if (request) void this.#respond(request);
      } catch (error) {
        if (!this.#disposed)
          this.#disconnect(readSessionError(error), { notifyRelay: true });
        return;
      }
    }
  }

  async #respond(relayRequest: RelayRequest): Promise<void> {
    let response: RelayResponse;
    try {
      switch (relayRequest.method) {
        case "execute":
          response = await this.execute(
            parseCadOpsAgentRequest(relayRequest.request)
          );
          break;
        case "query":
          response = await this.query(relayRequest.request);
          break;
        case "inspectV8ProjectSurface":
          response = await this.inspectV8ProjectSurface(relayRequest.request);
          break;
        case "getCurrentSelection":
          response = await this.getCurrentSelection(relayRequest.request);
          break;
        case "requestExactExport":
          response = await this.requestExactExport(relayRequest.request);
          break;
      }
      await this.#post("respond", {
        clientId: this.#clientId,
        requestId: relayRequest.requestId,
        response
      });
    } catch (error) {
      this.#disconnect(readSessionError(error), { notifyRelay: true });
    }
  }

  async #post(endpoint: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${RELAY_PATH}/${endpoint}`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify(body),
      signal: this.#abort.signal
    });
    const result = (await response.json()) as unknown;
    if (!response.ok) throw result;
    return result;
  }

  #headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      [TOKEN_HEADER]: this.options.token
    };
  }

  #sourceIdentity() {
    return createCadProjectSourceIdentity(
      exportCadProject(this.options.engine)
    );
  }

  #settlePending(
    response:
      | CadOpsAgentResponse
      | CadAgentExactExportResult
      | CadAgentSessionErrorResponse
  ) {
    const pending = this.#pending;
    if (!pending) return;
    this.#pending = undefined;
    if (pending.kind === "commit") {
      pending.resolve(response as CadOpsAgentResponse);
    } else {
      pending.resolve(
        response as CadAgentExactExportResult | CadAgentSessionErrorResponse
      );
    }
    this.#publish({
      ...this.#snapshot,
      proposal: undefined,
      approving: false,
      ...("ok" in response &&
      !response.ok &&
      "error" in response &&
      response.error.code.startsWith("AGENT_")
        ? {
            diagnostic: response.error as CadAgentSessionErrorResponse["error"]
          }
        : {})
    });
  }

  #disconnect(
    error: CadAgentSessionErrorResponse,
    options: { readonly notifyRelay?: boolean } = {}
  ): void {
    const wasConnected = this.#snapshot.connected;
    this.#sessionGeneration += 1;
    this.#preparingProposalRequestId = undefined;
    if (this.#pending) {
      if (this.#pending.kind === "exactExport" && this.#snapshot.approving) {
        this.options.cancelExactExport?.();
      }
      this.#settlePending({
        ...error,
        requestId: this.#pending.request.requestId
      });
    }
    this.#publish({
      connected: false,
      approvalMode: "manualApproval",
      approving: false,
      diagnostic: error.error
    });
    if (options.notifyRelay && wasConnected) {
      void fetch(`${RELAY_PATH}/disconnect`, {
        method: "POST",
        headers: this.#headers(),
        body: JSON.stringify({ clientId: this.#clientId }),
        keepalive: true
      }).catch(() => undefined);
    }
  }

  #disconnected(requestId: string): CadAgentSessionErrorResponse {
    return sessionError(
      requestId,
      "AGENT_SESSION_DISCONNECTED",
      "The browser session disconnected."
    );
  }

  #publish(snapshot: LocalAgentSessionSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener(snapshot);
  }

  readonly #handlePageHide = () => {
    void this.dispose();
  };
}

export function readLocalAgentSessionToken(hash: string): string | undefined {
  const match = /^#agentSession=([A-Za-z0-9_-]{43})$/.exec(hash);
  return match?.[1];
}

export function disconnectedAgentSessionSnapshot(): LocalAgentSessionSnapshot {
  return { connected: false, approvalMode: "manualApproval", approving: false };
}

export function createCurrentAgentSelection({
  namedReferenceName,
  generatedReference,
  sketch,
  bodyId,
  objectId
}: CurrentAgentSelectionInput): CadCurrentSelection {
  if (namedReferenceName)
    return { kind: "namedReference", name: namedReferenceName };
  if (generatedReference) {
    return {
      kind: "generatedReference",
      bodyId: generatedReference.bodyId,
      stableId: generatedReference.stableId,
      ...(generatedReference.expectedKind &&
      generatedReference.expectedKind !== "axis"
        ? { expectedKind: generatedReference.expectedKind }
        : {})
    };
  }
  if (sketch?.entityId) {
    return {
      kind: "sketchEntity",
      sketchId: sketch.sketchId,
      entityId: sketch.entityId
    };
  }
  if (sketch) return { kind: "sketch", sketchId: sketch.sketchId };
  if (bodyId) return { kind: "body", bodyId };
  if (objectId) return { kind: "object", objectId };
  return { kind: "none" };
}

export function createCurrentAgentSelectionForEngine(
  engine: CadEngine,
  input: CurrentAgentSelectionInput
): CadCurrentSelection {
  const document = engine.getDocument();
  const sketch = input.sketch
    ? document.sketches.get(input.sketch.sketchId)
    : undefined;
  const structure = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  const bodyIds = new Set(
    structure.ok && structure.query === "project.structure"
      ? structure.bodies.map((body) => body.id)
      : []
  );

  return createCurrentAgentSelection({
    ...(input.namedReferenceName &&
    document.namedReferences.has(input.namedReferenceName)
      ? { namedReferenceName: input.namedReferenceName }
      : {}),
    ...(input.generatedReference && bodyIds.has(input.generatedReference.bodyId)
      ? { generatedReference: input.generatedReference }
      : {}),
    ...(sketch
      ? {
          sketch: {
            sketchId: sketch.id,
            ...(input.sketch?.entityId &&
            sketch.entities.has(input.sketch.entityId)
              ? { entityId: input.sketch.entityId }
              : {})
          }
        }
      : {}),
    ...(input.bodyId && bodyIds.has(input.bodyId)
      ? { bodyId: input.bodyId }
      : {}),
    ...(input.objectId && document.objects.has(input.objectId)
      ? { objectId: input.objectId }
      : {})
  });
}

function readRelayRequest(value: unknown): RelayRequest | null {
  if (!isRecord(value) || value.ok !== true || !("request" in value)) {
    throw new Error("Malformed local agent poll response.");
  }
  if (value.request === null) return null;
  if (
    !isRecord(value.request) ||
    !hasExactKeys(value.request, ["requestId", "method", "request"]) ||
    typeof value.request.requestId !== "string" ||
    ![
      "execute",
      "query",
      "inspectV8ProjectSurface",
      "getCurrentSelection",
      "requestExactExport"
    ].includes(String(value.request.method))
  ) {
    throw new Error("Malformed local agent relay request.");
  }
  return value.request as RelayRequest;
}

function readSessionError(value: unknown): CadAgentSessionErrorResponse {
  try {
    return parseCadAgentSessionErrorResponse(value);
  } catch {
    // Fall through to the bounded disconnect diagnostic.
  }
  return sessionError(
    "session",
    "AGENT_SESSION_DISCONNECTED",
    value instanceof Error
      ? value.message
      : "The local agent session disconnected."
  );
}

function createUnavailableExactExportResult(
  request: CadAgentExactExportRequest,
  units: CadAgentExactExportResult["units"],
  code: CadAgentExactExportResult["diagnostics"][number]["code"] = "EXPORT_EXACT_WRITER_UNAVAILABLE",
  message = "The browser exact-export planner is unavailable."
): CadAgentExactExportResult {
  const selectedBodyIds =
    request.selection.mode === "bodyIds" ? request.selection.bodyIds : [];
  return {
    requestId: request.requestId,
    status: "failed",
    selectedBodyIds,
    selectedBodyCount: selectedBodyIds.length,
    schema: "AP242DIS",
    units,
    diagnostics: [
      {
        code,
        message
      }
    ]
  };
}

function createExactExportTerminalResult(
  pending: PendingExactExportProposal,
  status: Extract<
    CadAgentExactExportResult["status"],
    "rejected" | "cancelled" | "stale" | "failed"
  >,
  code?: CadAgentExactExportResult["diagnostics"][number]["code"],
  message?: string
): CadAgentExactExportResult {
  return {
    requestId: pending.request.requestId,
    status,
    selectedBodyIds: pending.proposal.plan.orderedBodyIds,
    selectedBodyCount: pending.proposal.plan.orderedBodyIds.length,
    schema: "AP242DIS",
    units: pending.proposal.plan.units,
    planIdentity: pending.proposal.plan.planIdentity,
    diagnostics: code && message ? [{ code, message }] : []
  };
}

function sessionError(
  requestId: string,
  code: CadAgentSessionErrorResponse["error"]["code"],
  message: string
): CadAgentSessionErrorResponse {
  return { ok: false, requestId, error: { code, message } };
}

function sameSourceIdentity(
  left: { readonly algorithm: string; readonly sha256: string },
  right: { readonly algorithm: string; readonly sha256: string }
): boolean {
  return left.algorithm === right.algorithm && left.sha256 === right.sha256;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
