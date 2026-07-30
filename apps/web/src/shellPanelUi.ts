export function createShellDefaultName(
  targetLabel: string,
  wallThickness: number
): string {
  return `Shell ${targetLabel} ${formatShellThickness(wallThickness)}`;
}

function formatShellThickness(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
