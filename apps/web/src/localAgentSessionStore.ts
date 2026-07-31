import { useSyncExternalStore } from "react";
import type { CadAgentApprovalMode } from "@web-cad/agent-adapter";
import type {
  LocalAgentSession,
  LocalAgentSessionSnapshot
} from "./localAgentSession";

const disconnected: LocalAgentSessionSnapshot = {
  connected: false,
  approvalMode: "manualApproval",
  approving: false
};
const listeners = new Set<() => void>();
let session: LocalAgentSession | undefined;
let snapshot = disconnected;

export function useLocalAgentSession(): LocalAgentSessionSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function attachLocalAgentSession(
  nextSession: LocalAgentSession
): () => void {
  session = nextSession;
  const unsubscribe = nextSession.subscribe(publish);
  return () => {
    unsubscribe();
    if (session === nextSession) {
      session = undefined;
      publish(disconnected);
    }
  };
}

export function setLocalAgentApprovalMode(mode: CadAgentApprovalMode): void {
  session?.setApprovalMode(mode);
}

export function approveLocalAgentProposal(): void {
  void session?.approve();
}

export function rejectLocalAgentProposal(): void {
  session?.reject();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): LocalAgentSessionSnapshot {
  return snapshot;
}

function publish(nextSnapshot: LocalAgentSessionSnapshot): void {
  snapshot = nextSnapshot;
  for (const listener of listeners) listener();
}
