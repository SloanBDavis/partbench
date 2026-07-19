import { clampDockWidth, WORKBENCH_LAYOUT } from "../styles/tokens";

export const WORKBENCH_UI_PREFERENCES_KEY =
  "partbench.workbench-ui-preferences";
export const WORKBENCH_UI_PREFERENCES_VERSION = 1 as const;

export interface WorkbenchUiPreferences {
  readonly version: typeof WORKBENCH_UI_PREFERENCES_VERSION;
  readonly leftDockWidth: number;
  readonly rightDockWidth: number;
  readonly leftDockCollapsed: boolean;
  readonly rightDockCollapsed: boolean;
}

export interface UiPreferencesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const DEFAULT_WORKBENCH_UI_PREFERENCES: WorkbenchUiPreferences = {
  version: WORKBENCH_UI_PREFERENCES_VERSION,
  leftDockWidth: WORKBENCH_LAYOUT.leftDock.default,
  rightDockWidth: WORKBENCH_LAYOUT.rightDock.default,
  leftDockCollapsed: false,
  rightDockCollapsed: false
};

/**
 * Parses the app-only preference record. Unknown versions and malformed
 * records reset as a unit so a partial/corrupt record never creates a layout
 * that the user cannot recover from.
 */
export function parseWorkbenchUiPreferences(
  serialized: string | null | undefined
): WorkbenchUiPreferences {
  if (!serialized) {
    return DEFAULT_WORKBENCH_UI_PREFERENCES;
  }

  try {
    const value: unknown = JSON.parse(serialized);
    if (!isPreferenceRecord(value)) {
      return DEFAULT_WORKBENCH_UI_PREFERENCES;
    }

    return {
      version: WORKBENCH_UI_PREFERENCES_VERSION,
      leftDockWidth: clampDockWidth("left", value.leftDockWidth),
      rightDockWidth: clampDockWidth("right", value.rightDockWidth),
      leftDockCollapsed: value.leftDockCollapsed,
      rightDockCollapsed: value.rightDockCollapsed
    };
  } catch {
    return DEFAULT_WORKBENCH_UI_PREFERENCES;
  }
}

/** Serializes an explicit allowlist; source/session fields cannot leak in. */
export function serializeWorkbenchUiPreferences(
  preferences: Pick<
    WorkbenchUiPreferences,
    | "leftDockWidth"
    | "rightDockWidth"
    | "leftDockCollapsed"
    | "rightDockCollapsed"
  >
): string {
  return JSON.stringify({
    version: WORKBENCH_UI_PREFERENCES_VERSION,
    leftDockWidth: clampDockWidth("left", preferences.leftDockWidth),
    rightDockWidth: clampDockWidth("right", preferences.rightDockWidth),
    leftDockCollapsed: preferences.leftDockCollapsed,
    rightDockCollapsed: preferences.rightDockCollapsed
  } satisfies WorkbenchUiPreferences);
}

export function loadWorkbenchUiPreferences(
  storage: UiPreferencesStorage | undefined = getBrowserStorage()
): WorkbenchUiPreferences {
  if (!storage) {
    return DEFAULT_WORKBENCH_UI_PREFERENCES;
  }

  try {
    return parseWorkbenchUiPreferences(
      storage.getItem(WORKBENCH_UI_PREFERENCES_KEY)
    );
  } catch {
    return DEFAULT_WORKBENCH_UI_PREFERENCES;
  }
}

export function saveWorkbenchUiPreferences(
  preferences: Pick<
    WorkbenchUiPreferences,
    | "leftDockWidth"
    | "rightDockWidth"
    | "leftDockCollapsed"
    | "rightDockCollapsed"
  >,
  storage: UiPreferencesStorage | undefined = getBrowserStorage()
): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(
      WORKBENCH_UI_PREFERENCES_KEY,
      serializeWorkbenchUiPreferences(preferences)
    );
    return true;
  } catch {
    return false;
  }
}

export function resetWorkbenchUiPreferences(
  storage: UiPreferencesStorage | undefined = getBrowserStorage()
): void {
  try {
    storage?.removeItem?.(WORKBENCH_UI_PREFERENCES_KEY);
  } catch {
    // Preference storage is best-effort and must not prevent app startup.
  }
}

function isPreferenceRecord(value: unknown): value is {
  readonly version: 1;
  readonly leftDockWidth: number;
  readonly rightDockWidth: number;
  readonly leftDockCollapsed: boolean;
  readonly rightDockCollapsed: boolean;
} {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.version === WORKBENCH_UI_PREFERENCES_VERSION &&
    typeof record.leftDockWidth === "number" &&
    Number.isFinite(record.leftDockWidth) &&
    typeof record.rightDockWidth === "number" &&
    Number.isFinite(record.rightDockWidth) &&
    typeof record.leftDockCollapsed === "boolean" &&
    typeof record.rightDockCollapsed === "boolean"
  );
}

function getBrowserStorage(): UiPreferencesStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
