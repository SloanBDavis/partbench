export interface DerivedGeometryFlagInput {
  readonly command: "build" | "serve";
  readonly env: Readonly<Record<string, string | undefined>>;
}

export interface DerivedGeometryFlagState {
  readonly enabled: boolean;
  readonly source:
    | "disabled"
    | "serve-default"
    | "explicit-enable"
    | "explicit-disable";
}

export function resolveDerivedGeometryFlags(
  input: DerivedGeometryFlagInput
): DerivedGeometryFlagState {
  if (
    isTruthy(input.env.VITE_DISABLE_DERIVED_GEOMETRY) ||
    isFalsey(input.env.VITE_ENABLE_DERIVED_GEOMETRY)
  ) {
    return {
      enabled: false,
      source: "explicit-disable"
    };
  }

  if (isTruthy(input.env.VITE_ENABLE_DERIVED_GEOMETRY)) {
    return {
      enabled: true,
      source: "explicit-enable"
    };
  }

  if (input.command === "serve") {
    return {
      enabled: true,
      source: "serve-default"
    };
  }

  return {
    enabled: false,
    source: "disabled"
  };
}

function isTruthy(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function isFalsey(value: string | undefined): boolean {
  return value === "false" || value === "0";
}
