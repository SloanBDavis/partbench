import {
  invokeUiAction,
  type ProjectedUiAction,
  type UiActionContext,
  type UiActionInvocationResult
} from "./actionRegistry";

export type CommandSearchNavigationKey =
  | "ArrowDown"
  | "ArrowUp"
  | "Home"
  | "End";

/** Deterministic result navigation shared by keyboard UI and focused tests. */
export function getNextCommandSearchResultIndex(
  currentIndex: number,
  resultCount: number,
  key: CommandSearchNavigationKey
): number {
  if (resultCount <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return resultCount - 1;
  if (currentIndex < 0 || currentIndex >= resultCount) {
    return key === "ArrowUp" ? resultCount - 1 : 0;
  }
  return key === "ArrowDown"
    ? (currentIndex + 1) % resultCount
    : (currentIndex - 1 + resultCount) % resultCount;
}

/** Uses the registry guard so presentation can never bypass pending/readiness. */
export function invokeCommandSearchAction(
  action: ProjectedUiAction,
  context: UiActionContext
): Promise<UiActionInvocationResult> {
  return invokeUiAction(action, context);
}
