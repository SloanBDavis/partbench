import { useEffect, useRef } from "react";
import {
  registerEscapeEditorContributor,
  type EscapeEditorState
} from "../actions/escapeStackModel";

/** Register a clean/dirty editor cancel handler with the global Escape stack. */
export function useEscapeEditorContributor(input: {
  readonly id: string;
  readonly suspended?: boolean;
  readonly state: EscapeEditorState;
  readonly onCancelClean: () => void;
  readonly onRequestDirtyGuard: () => void;
}): void {
  const latest = useRef(input);

  useEffect(() => {
    latest.current = input;
  }, [input]);

  useEffect(() => {
    return registerEscapeEditorContributor({
      id: input.id,
      suspended: () => latest.current.suspended ?? false,
      getState: () => latest.current.state,
      cancelClean: () => latest.current.onCancelClean(),
      requestDirtyGuard: () => latest.current.onRequestDirtyGuard()
    });
  }, [input.id]);
}
