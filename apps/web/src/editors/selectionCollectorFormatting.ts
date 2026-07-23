export function formatAcceptedKinds(kinds: readonly string[]): string {
  if (kinds.length === 0) {
    return "an eligible target";
  }
  if (kinds.length === 1) {
    return withIndefiniteArticle(kinds[0] ?? "eligible target");
  }
  const describedKinds = kinds.map(withIndefiniteArticle);
  if (describedKinds.length === 2) {
    return `${describedKinds[0]} or ${describedKinds[1]}`;
  }
  return `${describedKinds.slice(0, -1).join(", ")}, or ${describedKinds.at(-1)}`;
}

function withIndefiniteArticle(kind: string): string {
  return `${/^[aeiou]/i.test(kind) ? "an" : "a"} ${kind}`;
}
