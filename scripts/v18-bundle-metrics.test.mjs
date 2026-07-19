import { describe, expect, it } from "vitest";
import {
  auditV18Bundle,
  readCriticalAssetNames,
  V18_BUNDLE_LIMITS
} from "./v18-bundle-metrics.mjs";

describe("V18 bundle metrics", () => {
  it("reads only entry-linked and preloaded assets as critical", () => {
    expect(
      readCriticalAssetNames(`
        <link rel="stylesheet" href="/assets/index-a.css">
        <link rel="modulepreload" href="/assets/vendor-b.js">
        <script type="module" src="/assets/index-c.js"></script>
      `)
    ).toEqual(["index-a.css", "index-c.js", "vendor-b.js"]);
  });

  it("enforces UI limits and immutable worker baselines", () => {
    const baseline = {
      commandWorker: { gzipBytes: 100 },
      geometryWorker: { gzipBytes: 200 },
      occtWasm: { gzipBytes: 300 }
    };
    const metrics = {
      criticalJavaScript: {
        gzipBytes: V18_BUNDLE_LIMITS.criticalJavaScriptGzipBytes + 1
      },
      criticalCss: { gzipBytes: 1 },
      allUiJavaScript: { gzipBytes: 1 },
      commandWorker: { gzipBytes: 101 },
      geometryWorker: { gzipBytes: 200 },
      occtWasm: { gzipBytes: 300 }
    };

    expect(auditV18Bundle(metrics, baseline)).toEqual([
      expect.stringContaining("critical JavaScript"),
      expect.stringContaining("command worker")
    ]);
  });

  it("fails when a baseline worker or WASM artifact is not measured", () => {
    const baseline = {
      commandWorker: { gzipBytes: 100 },
      geometryWorker: { gzipBytes: 200 },
      occtWasm: { gzipBytes: 300 }
    };
    const metrics = {
      criticalJavaScript: { gzipBytes: 1 },
      criticalCss: { gzipBytes: 1 },
      allUiJavaScript: { gzipBytes: 1 },
      commandWorker: { gzipBytes: 100 },
      geometryWorker: { gzipBytes: 0 },
      occtWasm: { gzipBytes: 300 }
    };

    expect(auditV18Bundle(metrics, baseline)).toEqual([
      expect.stringContaining("geometry worker")
    ]);
  });
});
