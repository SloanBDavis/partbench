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
  type CurrentAgentSelectionInput
} from "./localAgentSession";
import { attachLocalAgentSession } from "./localAgentSessionStore";

export function LocalAgentSessionController({
  engine,
  executor,
  document,
  selection,
  currentExactEvidence,
  publishCommit
}: {
  readonly engine: CadEngine;
  readonly executor: AsyncCadCommandExecutor;
  readonly document: CadDocument;
  readonly selection: CurrentAgentSelectionInput;
  readonly currentExactEvidence: CadOpsAgentCurrentExactEvidence;
  readonly publishCommit: (
    response: CadOpsAgentSuccessResponse
  ) => Promise<void>;
}) {
  const latestRef = useRef({ selection, currentExactEvidence, publishCommit });
  const sessionRef = useRef<LocalAgentSession | null>(null);

  useEffect(() => {
    latestRef.current = { selection, currentExactEvidence, publishCommit };
  }, [currentExactEvidence, publishCommit, selection]);

  useEffect(() => {
    const token = readLocalAgentSessionToken(window.location.hash);
    if (!token) return;
    const session = new LocalAgentSession({
      token,
      engine,
      executor,
      readSelection: () => latestRef.current.selection,
      readCurrentExactEvidence: () => latestRef.current.currentExactEvidence,
      publishCommit: (response) => latestRef.current.publishCommit(response)
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
