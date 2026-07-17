import type {
  OrientedSketchSegmentRef,
  SketchPathRef,
  SketchProfileRef
} from "@web-cad/cad-protocol";

export type V21SourceValidationIssueCode =
  | "SCHEMA_V21_SOURCE_INVALID"
  | "COMMAND_INPUT_AMBIGUOUS"
  | "SKETCH_PROFILE_EMPTY"
  | "SKETCH_PROFILE_ENTITY_REPEATED"
  | "SKETCH_PATH_EMPTY"
  | "SKETCH_PATH_ENTITY_REPEATED";

export interface V21SourceValidationIssue {
  readonly code: V21SourceValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export type V21SourceValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly issues: readonly V21SourceValidationIssue[];
    };

function invalid<T>(
  code: V21SourceValidationIssueCode,
  path: string,
  message: string
): V21SourceValidationResult<T> {
  return { ok: false, issues: [{ code, path, message }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validateSegments(
  value: unknown,
  path: string,
  emptyCode: "SKETCH_PROFILE_EMPTY" | "SKETCH_PATH_EMPTY",
  repeatedCode: "SKETCH_PROFILE_ENTITY_REPEATED" | "SKETCH_PATH_ENTITY_REPEATED"
): V21SourceValidationResult<readonly OrientedSketchSegmentRef[]> {
  if (!Array.isArray(value) || value.length < 2) {
    return invalid(
      emptyCode,
      path,
      "An ordered wire or chain must contain at least two segments."
    );
  }
  const seen = new Set<string>();
  const segments: OrientedSketchSegmentRef[] = [];
  for (const [index, segment] of value.entries()) {
    const segmentPath = `${path}[${index}]`;
    if (
      !isRecord(segment) ||
      !isId(segment.entityId) ||
      (segment.orientation !== "forward" && segment.orientation !== "reverse")
    ) {
      return invalid(
        "SCHEMA_V21_SOURCE_INVALID",
        segmentPath,
        "Segment references require a non-empty entityId and explicit orientation."
      );
    }
    if (seen.has(segment.entityId)) {
      return invalid(
        repeatedCode,
        `${segmentPath}.entityId`,
        "An entity may occur only once in an ordered reference."
      );
    }
    seen.add(segment.entityId);
    segments.push({
      entityId: segment.entityId,
      orientation: segment.orientation
    });
  }
  return { ok: true, value: segments };
}

export function validateSketchProfileRefSource(
  value: unknown,
  path = "profile"
): V21SourceValidationResult<SketchProfileRef> {
  if (!isRecord(value) || !isId(value.sketchId)) {
    return invalid(
      "SCHEMA_V21_SOURCE_INVALID",
      `${path}.sketchId`,
      "Profile reference requires a non-empty sketchId."
    );
  }
  if (value.kind === "entity" && isId(value.entityId)) {
    if (hasOwn(value, "segments") || hasOwn(value, "orientation")) {
      return invalid(
        "SCHEMA_V21_SOURCE_INVALID",
        path,
        "Entity profile references cannot contain wire or path fields."
      );
    }
    return {
      ok: true,
      value: {
        kind: "entity",
        sketchId: value.sketchId,
        entityId: value.entityId
      }
    };
  }
  if (value.kind === "wire") {
    if (hasOwn(value, "entityId") || hasOwn(value, "orientation")) {
      return invalid(
        "SCHEMA_V21_SOURCE_INVALID",
        path,
        "Wire profile references cannot contain entity-path fields."
      );
    }
    const segments = validateSegments(
      value.segments,
      `${path}.segments`,
      "SKETCH_PROFILE_EMPTY",
      "SKETCH_PROFILE_ENTITY_REPEATED"
    );
    return segments.ok
      ? {
          ok: true,
          value: {
            kind: "wire",
            sketchId: value.sketchId,
            segments: segments.value
          }
        }
      : segments;
  }
  return invalid(
    "SCHEMA_V21_SOURCE_INVALID",
    `${path}.kind`,
    "Profile reference must be an entity or wire reference."
  );
}

export function validateSketchPathRefSource(
  value: unknown,
  path = "path"
): V21SourceValidationResult<SketchPathRef> {
  if (!isRecord(value) || !isId(value.sketchId)) {
    return invalid(
      "SCHEMA_V21_SOURCE_INVALID",
      `${path}.sketchId`,
      "Path reference requires a non-empty sketchId."
    );
  }
  if (
    value.kind === "entity" &&
    isId(value.entityId) &&
    (value.orientation === "forward" || value.orientation === "reverse")
  ) {
    if (hasOwn(value, "segments")) {
      return invalid(
        "SCHEMA_V21_SOURCE_INVALID",
        path,
        "Entity path references cannot contain chain segments."
      );
    }
    return {
      ok: true,
      value: {
        kind: "entity",
        sketchId: value.sketchId,
        entityId: value.entityId,
        orientation: value.orientation
      }
    };
  }
  if (value.kind === "chain") {
    if (hasOwn(value, "entityId") || hasOwn(value, "orientation")) {
      return invalid(
        "SCHEMA_V21_SOURCE_INVALID",
        path,
        "Chain path references cannot contain entity-path fields."
      );
    }
    const segments = validateSegments(
      value.segments,
      `${path}.segments`,
      "SKETCH_PATH_EMPTY",
      "SKETCH_PATH_ENTITY_REPEATED"
    );
    return segments.ok
      ? {
          ok: true,
          value: {
            kind: "chain",
            sketchId: value.sketchId,
            segments: segments.value
          }
        }
      : segments;
  }
  return invalid(
    "SCHEMA_V21_SOURCE_INVALID",
    `${path}.kind`,
    "Path reference must be an oriented entity or ordered chain reference."
  );
}

/** Rejects mixed normalized/legacy profile source and returns a normalized ref. */
export function validateProfileInputSource(
  value: Record<string, unknown>,
  path = "profile",
  allowAbsent = false
): V21SourceValidationResult<SketchProfileRef | undefined> {
  const hasProfile = hasOwn(value, "profile");
  const hasSketchId = hasOwn(value, "sketchId");
  const hasEntityId = hasOwn(value, "entityId");
  if (
    hasProfile &&
    (hasSketchId || hasEntityId || hasOwn(value, "profileKind"))
  ) {
    return invalid(
      "COMMAND_INPUT_AMBIGUOUS",
      path,
      "Provide either profile or the complete legacy sketchId/entityId pair, never both."
    );
  }
  if (hasProfile) return validateSketchProfileRefSource(value.profile, path);
  if (hasSketchId !== hasEntityId) {
    return invalid(
      "SCHEMA_V21_SOURCE_INVALID",
      path,
      "Legacy profile input requires both sketchId and entityId."
    );
  }
  if (hasSketchId && hasEntityId) {
    if (!isId(value.sketchId) || !isId(value.entityId)) {
      return invalid(
        "SCHEMA_V21_SOURCE_INVALID",
        path,
        "Legacy profile IDs must be non-empty strings."
      );
    }
    return {
      ok: true,
      value: {
        kind: "entity",
        sketchId: value.sketchId,
        entityId: value.entityId
      }
    };
  }
  return allowAbsent
    ? { ok: true, value: undefined }
    : invalid(
        "SCHEMA_V21_SOURCE_INVALID",
        path,
        "A normalized profile or complete legacy profile input is required."
      );
}
