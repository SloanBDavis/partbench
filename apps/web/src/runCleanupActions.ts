export function runCleanupActions(actions: readonly (() => void)[]): void {
  let cleanupFailed = false;
  let cleanupError: unknown;

  for (const action of actions) {
    try {
      action();
    } catch (error) {
      if (!cleanupFailed) {
        cleanupFailed = true;
        cleanupError = error;
      }
    }
  }

  if (cleanupFailed) throw cleanupError;
}
