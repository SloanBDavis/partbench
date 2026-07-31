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

export function invokeCommandSearchAction(
  action: ProjectedUiAction,
  context: UiActionContext
): Promise<UiActionInvocationResult> {
  return invokeUiAction(action, context);
}

/** Announce needs-selection instructions instead of a false "started" success. */
export function getCommandSearchInvocationAnnouncement(
  action: ProjectedUiAction,
  result: UiActionInvocationResult
): string {
  if (result.status === "pending") {
    return `${action.definition.label} is pending.`;
  }
  if (result.status === "unavailable") {
    return result.availability.message;
  }
  if (action.availability.status === "needs-selection") {
    return action.availability.message;
  }
  return `${action.definition.label} started.`;
}
