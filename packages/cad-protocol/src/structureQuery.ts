/** Pose pages are bounded independently of the number of edges in part definitions. */
export function isProjectStructureQuery(value: unknown): value is {
  readonly query: "project.structure";
  readonly projection?: "full" | "poses";
  readonly assemblyIds?: readonly string[];
  readonly instanceIds?: readonly string[];
  readonly offset?: number;
  readonly limit?: number;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const query = value as Record<string, unknown>;
  const ids = (item: unknown) =>
    item === undefined ||
    (Array.isArray(item) &&
      item.length <= 1000 &&
      item.every((id) => typeof id === "string" && id.length > 0) &&
      new Set(item).size === item.length);
  return (
    query.query === "project.structure" &&
    Object.keys(query).every((key) =>
      [
        "query",
        "projection",
        "assemblyIds",
        "instanceIds",
        "offset",
        "limit"
      ].includes(key)
    ) &&
    (query.projection === undefined ||
      query.projection === "full" ||
      query.projection === "poses") &&
    ids(query.assemblyIds) &&
    ids(query.instanceIds) &&
    (query.offset === undefined ||
      (Number.isSafeInteger(query.offset) && (query.offset as number) >= 0)) &&
    (query.limit === undefined ||
      (Number.isSafeInteger(query.limit) &&
        (query.limit as number) >= 1 &&
        (query.limit as number) <= 1000)) &&
    (query.projection === "poses" ||
      ["assemblyIds", "instanceIds", "offset", "limit"].every(
        (key) => query[key] === undefined
      ))
  );
}
