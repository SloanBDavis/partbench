/**
 * Smoke-only live-engine hook. Installed when the workbench is opened with
 * `?ui-smoke=1`. applyOps uses the same commit path as UI Apply
 * (`commandExecutor.executeBatch` via App.commitOps).
 */

import type { CadOp } from "@web-cad/cad-protocol";

export interface UiSmokeApplyError {
  readonly code?: string;
  readonly message: string;
}

export interface UiSmokeApplyResult {
  readonly ok: boolean;
  readonly error?: UiSmokeApplyError;
  readonly createdIds?: readonly string[];
  readonly createdBodyIds?: readonly string[];
  readonly createdFeatureIds?: readonly string[];
}

export interface UiSmokeControlState {
  readonly present: boolean;
  readonly disabled?: boolean;
  readonly text?: string;
}

export interface UiSmokeState {
  readonly ready: true;
  readonly commandPending: boolean;
  readonly commandError?: string;
  readonly commandNotice?: string;
  readonly rebuildState: string;
  readonly alerts: readonly string[];
  readonly applyButton: UiSmokeControlState;
  readonly pickButton: UiSmokeControlState;
  readonly promotionControl: UiSmokeControlState;
  readonly features: readonly Record<string, unknown>[];
  readonly bodies: readonly Record<string, unknown>[];
  readonly structureQuery: Record<string, unknown>;
  readonly exactStatuses: readonly string[];
  readonly exactResults: readonly {
    readonly bodyId: string;
    readonly status: string;
  }[];
  readonly displayStatuses: readonly string[];
  readonly diagnostic: string;
  readonly userAgent: string;
}

export interface UiSmokeHost {
  applyOps(ops: readonly CadOp[]): Promise<UiSmokeApplyResult>;
  reset(): Promise<void>;
  getState(): UiSmokeState;
}

export interface PartbenchUiSmokeApi extends UiSmokeHost {
  readonly ready: true;
}

declare global {
  interface Window {
    __PARTBENCH_UI_SMOKE__?: PartbenchUiSmokeApi;
  }
}

export function isUiSmokeEnabled(
  search: string = typeof window === "undefined" ? "" : window.location.search
): boolean {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  const value = params.get("ui-smoke");
  return value === "1" || value === "true";
}

export function installUiSmokeHook(host: UiSmokeHost): PartbenchUiSmokeApi {
  const api: PartbenchUiSmokeApi = {
    ready: true,
    applyOps: (ops) => host.applyOps(ops),
    reset: () => host.reset(),
    getState: () => host.getState()
  };
  window.__PARTBENCH_UI_SMOKE__ = api;
  return api;
}

export function uninstallUiSmokeHook(): void {
  delete window.__PARTBENCH_UI_SMOKE__;
}

export function readUiSmokeDomSnapshot(): Pick<
  UiSmokeState,
  "alerts" | "applyButton" | "pickButton" | "promotionControl" | "userAgent"
> {
  const text = (element: Element | null): string =>
    (element?.textContent ?? "").replace(/\s+/g, " ").trim();
  const apply = document.querySelector<HTMLButtonElement>(
    '[data-ui-smoke="apply"]'
  );
  const pick = document.querySelector<HTMLButtonElement>(
    '[data-ui-smoke="pick"]'
  );
  const promotion = document.querySelector('[data-ui-smoke="promotion"]');
  const alerts = [...document.querySelectorAll('[role="alert"]')]
    .map((element) => text(element))
    .filter(Boolean);
  return {
    alerts,
    applyButton: {
      present: Boolean(apply),
      disabled: Boolean(apply?.disabled),
      text: text(apply)
    },
    pickButton: {
      present: Boolean(pick),
      disabled: Boolean(pick?.disabled),
      text: text(pick)
    },
    promotionControl: {
      present: Boolean(promotion)
    },
    userAgent: navigator.userAgent
  };
}
