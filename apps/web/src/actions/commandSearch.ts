import type { ProjectedUiAction } from "./actionRegistry";

export interface UiActionSearchResult extends ProjectedUiAction {
  readonly match: "exact-label" | "label-prefix" | "alias-prefix" | "other";
}

/** Case-insensitive substring and token-prefix search with deterministic order. */
export function searchUiActions(
  actions: readonly ProjectedUiAction[],
  query: string
): readonly UiActionSearchResult[] {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return actions.map((action) => ({ ...action, match: "other" }));
  }

  return actions
    .map((action) => {
      const rank = getMatchRank(action, normalizedQuery);
      return rank === undefined ? undefined : { action, rank };
    })
    .filter(isDefined)
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.action.registryIndex - right.action.registryIndex
    )
    .map(({ action, rank }) => ({
      ...action,
      match:
        rank === 0
          ? "exact-label"
          : rank === 1
            ? "label-prefix"
            : rank === 2
              ? "alias-prefix"
              : "other"
    }));
}

function getMatchRank(
  action: ProjectedUiAction,
  query: string
): number | undefined {
  const label = normalize(action.definition.label);
  const aliases = action.definition.aliases.map(normalize);

  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (aliases.some((alias) => alias.startsWith(query))) return 2;

  const fields = [
    label,
    ...aliases,
    normalize(action.definition.group),
    ...action.definition.modes.map(normalize),
    normalize(action.definition.shortcut ?? "")
  ];
  const queryTokens = tokenize(query);
  const fieldTokens = fields.flatMap(tokenize);

  if (
    fields.some((field) => field.includes(query)) ||
    (queryTokens.length > 0 &&
      queryTokens.every((token) =>
        fieldTokens.some((fieldToken) => fieldToken.startsWith(token))
      ))
  ) {
    return 3;
  }

  return undefined;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function tokenize(value: string): readonly string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
