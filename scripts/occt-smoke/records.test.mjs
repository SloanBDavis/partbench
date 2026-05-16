import { describe, expect, it } from "vitest";
import {
  parseSmokePageError,
  parseSmokePageResult,
  SmokePageError
} from "./errors.mjs";
import {
  assertSmokeResult,
  createFailureRecord,
  createSuccessRecord,
  formatBytes,
  formatMs
} from "./records.mjs";

const assetMetrics = {
  occtWasmBytes: 50_305_130,
  occtWasmGzipBytes: 13_955_447,
  occtWasmBrotliBytes: 11_193_695,
  occtWasmBrotliQuality: 9,
  occtWasmServedBytes: 11_193_695,
  occtWasmServedEncoding: "br",
  geometryWorkerBytes: 234_793,
  smokeBundleBytes: 235_030
};

describe("occt smoke records", () => {
  it("creates the structured success record without timing thresholds", () => {
    const record = createSuccessRecord({
      assetMetrics,
      appUrl: "http://127.0.0.1:3000/geometry-worker-smoke.html",
      browserExecutable:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      browserVersion: {
        Browser: "Chrome/148.0.7778.97",
        "User-Agent": "HeadlessChrome",
        "Protocol-Version": "1.3"
      },
      gitSha: "abc123",
      nodeVersion: "v23.3.0",
      remoteDebuggingPort: 3001,
      scenarioName: "box-cylinder-sphere",
      timestamp: "2026-05-14T00:00:00.000Z",
      smokeResult: {
        vertexCount: 24,
        triangleCount: 12,
        diagnostics: {
          ok: true,
          stage: "complete",
          workerStarted: true,
          wasmLoadStatus: "loaded"
        },
        timings: {
          occtLoadMs: 999_999,
          tessellationMs: 1,
          geometryKernelMs: 1_000_000,
          workerExecutionMs: 1_000_001,
          roundTripMs: 1_000_002
        },
        meshes: [
          {
            scenario: "box-2x3x4",
            primitive: "box",
            vertexCount: 24,
            triangleCount: 12
          },
          {
            scenario: "cylinder-r1-h4",
            primitive: "cylinder",
            vertexCount: 48,
            triangleCount: 32
          },
          {
            scenario: "sphere-r1",
            primitive: "sphere",
            vertexCount: 64,
            triangleCount: 64
          }
        ]
      }
    });

    expect(record).toMatchObject({
      schemaVersion: 1,
      status: "ok",
      timestamp: "2026-05-14T00:00:00.000Z",
      gitSha: "abc123",
      nodeVersion: "v23.3.0",
      scenario: "box-cylinder-sphere",
      browser: {
        remoteDebuggingPort: 3001,
        name: "Chrome/148.0.7778.97"
      },
      worker: {
        startup: "started",
        wasmLoadStatus: "loaded"
      },
      metrics: {
        ...assetMetrics,
        occtLoadMs: 999_999,
        vertexCount: 24,
        triangleCount: 12,
        meshes: [
          {
            scenario: "box-2x3x4",
            primitive: "box",
            vertexCount: 24,
            triangleCount: 12
          },
          {
            scenario: "cylinder-r1-h4",
            primitive: "cylinder",
            vertexCount: 48,
            triangleCount: 32
          },
          {
            scenario: "sphere-r1",
            primitive: "sphere",
            vertexCount: 64,
            triangleCount: 64
          }
        ]
      }
    });
    expect(() => assertSmokeResult(record)).not.toThrow();
  });

  it("creates structured failure records from smoke page diagnostics", () => {
    const details = {
      code: "WASM_LOAD_FAILED",
      stage: "wasmLoad",
      message: "OCCT WASM failed to load.",
      workerStarted: true,
      wasmLoadStatus: "failed"
    };
    const record = createFailureRecord({
      assetMetrics,
      browserExecutable:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      error: new SmokePageError(details),
      remoteDebuggingPort: 3001,
      scenarioName: "box-2x3x4",
      timestamp: "2026-05-14T00:00:00.000Z"
    });

    expect(record).toMatchObject({
      status: "error",
      worker: {
        startup: "started",
        wasmLoadStatus: "failed"
      },
      metrics: assetMetrics,
      error: details
    });
  });

  it("parses smoke page success and error payloads", () => {
    expect(parseSmokePageResult('{"ok":true}')).toEqual({ ok: true });
    expect(
      parseSmokePageError(
        JSON.stringify({
          ok: false,
          error: {
            code: "WORKER_TRANSPORT_FAILED",
            stage: "transport",
            message: "Worker failed.",
            workerStarted: false,
            wasmLoadStatus: "notRequested"
          }
        })
      )
    ).toEqual({
      code: "WORKER_TRANSPORT_FAILED",
      stage: "transport",
      message: "Worker failed.",
      workerStarted: false,
      wasmLoadStatus: "notRequested"
    });
  });

  it("formats smoke values for console summaries", () => {
    expect(formatMs(7.123)).toBe("7.12 ms");
    expect(formatMs(12.34)).toBe("12.3 ms");
    expect(formatBytes(50_305_130)).toBe("50.31 MB");
  });
});
