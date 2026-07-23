const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:/;

export function isValidWcadPackagePath(path: string): boolean {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\\") ||
    path.includes("\0") ||
    WINDOWS_DRIVE_PREFIX.test(path)
  ) {
    return false;
  }

  return path
    .split("/")
    .every((part) => part !== "" && part !== "." && part !== "..");
}
