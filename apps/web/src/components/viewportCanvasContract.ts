import type { ViewportStandardViewId } from "../viewportCamera";

export const VIEWPORT_COMMAND_EVENT = "partbench:viewport-command";

export type ViewportCommand =
  | "fit-all"
  | "fit-selection"
  | ViewportStandardViewId;
