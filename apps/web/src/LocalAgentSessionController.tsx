import type { CadOpsAgentSuccessResponse } from "@web-cad/agent-adapter";
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
  publishCommit
}: {
  readonly engine: CadEngine;
  readonly executor: AsyncCadCommandExecutor;
  readonly document: CadDocument;
  readonly selection: CurrentAgentSelectionInput;
  readonly publishCommit: (
    response: CadOpsAgentSuccessResponse
  ) => Promise<void>;
}) {
  const selectionRef = useRef(selection);
  const sessionRef = useRef<LocalAgentSession | null>(null);
  selectionRef.current = selection;

  useEffect(() => {
    const token = readLocalAgentSessionToken(window.location.hash);
    if (!token) return;
    const session = new LocalAgentSession({
      token,
      engine,
      executor,
      readSelection: () => selectionRef.current,
      publishCommit
    });
    sessionRef.current = session;
    const detach = attachLocalAgentSession(session);
    void session.start();
    return () => {
      detach();
      sessionRef.current = null;
      void session.dispose();
    };
  }, [engine, executor, publishCommit]);

  useEffect(() => {
    sessionRef.current?.refreshSourceIdentity();
  }, [document]);

  return null;
}
