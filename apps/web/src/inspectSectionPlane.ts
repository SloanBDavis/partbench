import type { RenderExactPickClipPlane } from "@web-cad/renderer";

export type InspectSectionPlaneKind = "xy" | "xz" | "yz" | "face";

export interface InspectSectionPlaneSession {
  readonly enabled: boolean;
  readonly kind: InspectSectionPlaneKind;
  readonly origin: readonly [number, number, number];
  readonly normal: readonly [number, number, number];
  readonly offset: number;
  readonly flip: boolean;
}

const WORLD_PLANES: Record<
  Exclude<InspectSectionPlaneKind, "face">,
  { readonly origin: readonly [number, number, number]; readonly normal: readonly [number, number, number] }
> = {
  xy: { origin: [0, 0, 0], normal: [0, 0, 1] },
  xz: { origin: [0, 0, 0], normal: [0, 1, 0] },
  yz: { origin: [0, 0, 0], normal: [1, 0, 0] }
};

export const EMPTY_INSPECT_SECTION_PLANE: InspectSectionPlaneSession = {
  enabled: false,
  kind: "xy",
  origin: [0, 0, 0],
  normal: [0, 0, 1],
  offset: 0,
  flip: false
};

export function createInspectWorldSectionPlane(
  kind: Exclude<InspectSectionPlaneKind, "face">,
  offset = 0,
  flip = false
): InspectSectionPlaneSession {
  const plane = WORLD_PLANES[kind];
  return { enabled: true, kind, origin: plane.origin, normal: plane.normal, offset, flip };
}

export function createInspectFaceSectionPlane(
  origin: readonly [number, number, number],
  normal: readonly [number, number, number],
  offset = 0,
  flip = false
): InspectSectionPlaneSession {
  return { enabled: true, kind: "face", origin, normal, offset, flip };
}

export function updateInspectSectionPlane(
  session: InspectSectionPlaneSession,
  patch: Partial<Pick<InspectSectionPlaneSession, "enabled" | "offset" | "flip">>
): InspectSectionPlaneSession {
  return { ...session, ...patch };
}

export function clearInspectSectionPlane(): InspectSectionPlaneSession {
  return EMPTY_INSPECT_SECTION_PLANE;
}

export function inspectSectionClipPlane(
  session: InspectSectionPlaneSession
): RenderExactPickClipPlane | undefined {
  if (!session.enabled) return undefined;
  const raw = session.flip
    ? ([-session.normal[0], -session.normal[1], -session.normal[2]] as const)
    : session.normal;
  const normal = [zero(raw[0]), zero(raw[1]), zero(raw[2])] as const;
  const origin = [
    session.origin[0] + normal[0] * session.offset,
    session.origin[1] + normal[1] * session.offset,
    session.origin[2] + normal[2] * session.offset
  ] as const;
  return { origin, normal };
}

function zero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
