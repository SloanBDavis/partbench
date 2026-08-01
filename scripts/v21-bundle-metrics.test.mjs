import { describe, expect, it } from "vitest";

import { V19_BUNDLE_LIMITS } from "./v19-bundle-metrics.mjs";
import { auditV21Bundle, V21_BUNDLE_LIMITS } from "./v21-bundle-metrics.mjs";

function metricsAtLimits() {
  return {
    criticalJavaScript: {
      gzipBytes: V21_BUNDLE_LIMITS.criticalJavaScriptGzipBytes
    },
    criticalCss: { gzipBytes: V21_BUNDLE_LIMITS.criticalCssGzipBytes },
    allUiJavaScript: {
      gzipBytes: V21_BUNDLE_LIMITS.allUiJavaScriptGzipBytes
    },
    commandWorker: { gzipBytes: V21_BUNDLE_LIMITS.commandWorkerGzipBytes },
    geometryWorker: { gzipBytes: V21_BUNDLE_LIMITS.geometryWorkerGzipBytes },
    occtWasm: { gzipBytes: V21_BUNDLE_LIMITS.occtWasmGzipBytes }
  };
}

describe("V21 bundle metrics", () => {
  it("inherits every fixed V19/V20 cap", () => {
    expect(V21_BUNDLE_LIMITS).toBe(V19_BUNDLE_LIMITS);
    expect(auditV21Bundle(metricsAtLimits())).toEqual([]);
  });

  it("rejects any artifact above its inherited cap", () => {
    const metrics = metricsAtLimits();
    for (const value of Object.values(metrics)) value.gzipBytes += 1;
    expect(auditV21Bundle(metrics)).toHaveLength(6);
  });
});
