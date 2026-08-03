import type {
  CadOpsAgentCurrentExactEvidence,
  CadOpsAgentSuccessResponse
} from "@web-cad/agent-adapter";
import type {
  AsyncCadCommandExecutor,
  CadDocument,
  CadEngine
} from "@web-cad/cad-core";
import { useEffect, useRef } from "react";
import {
  LocalAgentSession,
  readLocalAgentSessionToken,
  type CurrentAgentSelectionInput,
  type LocalAgentCommitPreflight,
  type LocalAgentSessionOptions
} from "./localAgentSession";
import { attachLocalAgentSession } from "./localAgentSessionStore";

export function LocalAgentSessionController({
  engine,
  executor,
  document,
  selection,
  currentExactEvidence,
  preflightCommit,
  publishCommit,
  planExactExport,
  executeExactExport,
  cancelExactExport
}: {
  readonly engine: CadEngine;
  readonly executor: AsyncCadCommandExecutor;
  readonly document: CadDocument;
  readonly selection: CurrentAgentSelectionInput;
  readonly currentExactEvidence: CadOpsAgentCurrentExactEvidence;
  readonly preflightCommit: LocalAgentCommitPreflight;
  readonly publishCommit: (
    response: CadOpsAgentSuccessResponse
  ) => Promise<void>;
  readonly planExactExport: NonNullable<
    LocalAgentSessionOptions["planExactExport"]
  >;
  readonly executeExactExport: NonNullable<
    LocalAgentSessionOptions["executeExactExport"]
  >;
  readonly cancelExactExport: () => void;
}) {
  const latestRef = useRef({
    selection,
    currentExactEvidence,
    preflightCommit,
    publishCommit,
    planExactExport,
    executeExactExport,
    cancelExactExport
  });
  const sessionRef = useRef<LocalAgentSession | null>(null);

  useEffect(() => {
    latestRef.current = {
      selection,
      currentExactEvidence,
      preflightCommit,
      publishCommit,
      planExactExport,
      executeExactExport,
      cancelExactExport
    };
  }, [
    cancelExactExport,
    currentExactEvidence,
    executeExactExport,
    planExactExport,
    preflightCommit,
    publishCommit,
    selection
  ]);

  useEffect(() => {
    const token = readLocalAgentSessionToken(window.location.hash);
    if (!token) return;
    const session = new LocalAgentSession({
      token,
      engine,
      executor,
      readSelection: () => latestRef.current.selection,
      readCurrentExactEvidence: () => latestRef.current.currentExactEvidence,
      preflightCommit: (request, sourceAuthorityEpoch) =>
        latestRef.current.preflightCommit(request, sourceAuthorityEpoch),
      publishCommit: (response) => latestRef.current.publishCommit(response),
      planExactExport: (request) => latestRef.current.planExactExport(request),
      executeExactExport: (proposal) =>
        latestRef.current.executeExactExport(proposal),
      cancelExactExport: () => latestRef.current.cancelExactExport()
    });
    sessionRef.current = session;
    const detach = attachLocalAgentSession(session);
    void session.start();
    return () => {
      detach();
      sessionRef.current = null;
      void session.dispose();
    };
  }, [engine, executor]);

  useEffect(() => {
    sessionRef.current?.refreshSourceIdentity();
  }, [document]);

  return null;
}
