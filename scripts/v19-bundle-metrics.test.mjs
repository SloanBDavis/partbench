import { describe, expect, it } from "vitest";

import { V18_BUNDLE_LIMITS } from "./v18-bundle-metrics.mjs";
import { auditV19Bundle, V19_BUNDLE_LIMITS } from "./v19-bundle-metrics.mjs";

function metricsAtLimits() {
  return {
    criticalJavaScript: {
      gzipBytes: V19_BUNDLE_LIMITS.criticalJavaScriptGzipBytes
    },
    criticalCss: {
      gzipBytes: V19_BUNDLE_LIMITS.criticalCssGzipBytes
    },
    allUiJavaScript: {
      gzipBytes: V19_BUNDLE_LIMITS.allUiJavaScriptGzipBytes
    },
    commandWorker: {
      gzipBytes: V19_BUNDLE_LIMITS.commandWorkerGzipBytes
    },
    geometryWorker: {
      gzipBytes: V19_BUNDLE_LIMITS.geometryWorkerGzipBytes
    },
    occtWasm: {
      gzipBytes: V19_BUNDLE_LIMITS.occtWasmGzipBytes
    }
  };
}

describe("V19 bundle metrics", () => {
  it("preserves V18 UI limits and applies only approved V19 worker headroom", () => {
    expect(V19_BUNDLE_LIMITS).toEqual({
      criticalJavaScriptGzipBytes:
        V18_BUNDLE_LIMITS.criticalJavaScriptGzipBytes,
      criticalCssGzipBytes: V18_BUNDLE_LIMITS.criticalCssGzipBytes,
      allUiJavaScriptGzipBytes: V18_BUNDLE_LIMITS.allUiJavaScriptGzipBytes,
      commandWorkerGzipBytes: 256 * 1024,
      geometryWorkerGzipBytes: 120 * 1024,
      occtWasmGzipBytes: 13_808_536
    });
    expect(auditV19Bundle(metricsAtLimits())).toEqual([]);
  });

  it("fails every artifact that exceeds its approved cap", () => {
    const metrics = metricsAtLimits();
    for (const value of Object.values(metrics)) value.gzipBytes += 1;

    expect(auditV19Bundle(metrics)).toEqual([
      expect.stringContaining("critical JavaScript"),
      expect.stringContaining("critical CSS"),
      expect.stringContaining("all UI JavaScript"),
      expect.stringContaining("command worker"),
      expect.stringContaining("geometry worker"),
      expect.stringContaining("OCCT WASM")
    ]);
  });

  it("does not treat a missing artifact as a zero-byte success", () => {
    const metrics = metricsAtLimits();
    metrics.commandWorker.gzipBytes = 0;
    metrics.geometryWorker.gzipBytes = Number.NaN;
    delete metrics.occtWasm;

    expect(auditV19Bundle(metrics)).toEqual([
      expect.stringContaining("command worker"),
      expect.stringContaining("geometry worker"),
      expect.stringContaining("OCCT WASM")
    ]);
  });
});
