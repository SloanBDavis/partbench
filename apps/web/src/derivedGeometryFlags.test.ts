import { describe, expect, it } from "vitest";
import { resolveDerivedGeometryFlags } from "./derivedGeometryFlags";

describe("derivedGeometryFlags", () => {
  it("enables derived geometry by default for development server builds", () => {
    expect(resolveDerivedGeometryFlags({ command: "serve", env: {} })).toEqual({
      enabled: true,
      source: "development-default"
    });
  });

  it("keeps derived geometry disabled by default for production builds", () => {
    expect(resolveDerivedGeometryFlags({ command: "build", env: {} })).toEqual({
      enabled: false,
      source: "disabled"
    });
  });

  it("supports explicit enablement for production builds", () => {
    expect(
      resolveDerivedGeometryFlags({
        command: "build",
        env: { VITE_ENABLE_DERIVED_GEOMETRY: "true" }
      })
    ).toEqual({
      enabled: true,
      source: "explicit-enable"
    });
  });

  it("supports the legacy OCCT mesh env flag", () => {
    expect(
      resolveDerivedGeometryFlags({
        command: "build",
        env: { VITE_ENABLE_OCCT_MESH_DEV: "true" }
      })
    ).toEqual({
      enabled: true,
      source: "explicit-enable"
    });
  });

  it("allows derived geometry to be disabled for fallback debugging", () => {
    expect(
      resolveDerivedGeometryFlags({
        command: "serve",
        env: { VITE_DISABLE_DERIVED_GEOMETRY: "true" }
      })
    ).toEqual({
      enabled: false,
      source: "explicit-disable"
    });
  });
});
