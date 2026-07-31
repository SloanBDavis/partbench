/**
 * Lets FeatureEditorShell advertise apply readiness to App without coupling
 * SolidModePanel to the keyboard router. App's `project.apply` reads this bridge.
 */

export interface FeatureApplyBridgeState {
  readonly canApply: boolean;
}

type FeatureApplyHandler = () => void;
type FeatureApplyListener = (state: FeatureApplyBridgeState) => void;

let applyHandler: FeatureApplyHandler | undefined;
let canApply = false;
const listeners = new Set<FeatureApplyListener>();

function publish(): void {
  const state = { canApply };
  for (const listener of listeners) listener(state);
}

export function setFeatureApplyHandler(
  handler: FeatureApplyHandler | undefined,
  nextCanApply: boolean
): void {
  applyHandler = handler;
  canApply = Boolean(handler) && nextCanApply;
  publish();
}

export function getFeatureApplyCanApply(): boolean {
  return canApply;
}

export function tryApplyFeatureDraft(): boolean {
  if (!canApply || !applyHandler) return false;
  applyHandler();
  return true;
}

export function subscribeFeatureApplyBridge(
  listener: FeatureApplyListener
): () => void {
  listeners.add(listener);
  listener({ canApply });
  return () => {
    listeners.delete(listener);
  };
}
