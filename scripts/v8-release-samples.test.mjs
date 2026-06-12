import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  formatV8ReleaseSampleSmokeSummary,
  runV8ReleaseSampleSmoke,
  V8_RELEASE_BOUNDARY_LEAK_PATTERN
} from "./v8-release-samples.mjs";

describe("V8 release package/export smoke runner", () => {
  it("verifies WCAD round-trips, JSON compatibility, corruption diagnostics, and exact STEP coverage", async () => {
    const result = await runV8ReleaseSampleSmoke(cadCore);

    expect(result).toMatchObject({
      ok: true,
      sampleCount: 6,
      passedCount: 6,
      failedCount: 0,
      packageChecks: {
        wcadRoundTripCount: 6,
        jsonToWcadRoundTripCount: 6,
        sourceSeparationCheckCount: 6,
        corruptionStatus: "pass",
        corruptionIssueCodes: ["WCAD_INVALID_PACKAGE", "WCAD_MISSING_MANIFEST"]
      },
      exactStepChecks: {
        supportedSampleCount: 2,
        unsupportedSampleCount: 4,
        exportableBodyCount: 2,
        unsupportedPrimitiveStatus: "pass",
        unsupportedIssueCodes: [
          "EXPORT_BODY_SOURCE_UNRESOLVED",
          "EXPORT_EXACT_BODY_UNSUPPORTED",
          "EXPORT_PRIMITIVE_SOURCE_UNAVAILABLE"
        ]
      },
      corruptionChecks: {
        status: "pass"
      },
      unsupportedExactStep: {
        status: "pass"
      }
    });
    expect(result.samples.map((sample) => sample.id)).toEqual([
      "v7-rectangle-extrude-reference",
      "v7-circle-extrude-export",
      "v7-consumed-body-diagnostics",
      "v7-revolve-source-diagnostics",
      "v7-hole-source-diagnostics",
      "v7-edge-finish-source-diagnostics"
    ]);
    expect(result.samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "v7-rectangle-extrude-reference",
          status: "pass",
          wcad: expect.objectContaining({
            ok: true,
            packageVersion: "partbench.wcad.v1",
            documentSchemaVersion: "web-cad.project.v16",
            sourceIdentityAlgorithm: "partbench-source-v1",
            packageRoundTripOk: true,
            jsonToWcadCompatible: true,
            diagnosticCount: 0
          }),
          exactStep: expect.objectContaining({
            status: "supported",
            available: true,
            writerStatus: "available",
            sourceSupportedBodyCount: 1,
            exportableBodyCount: 1,
            diagnosticCodes: ["EXPORT_BODY_SOURCE_SUPPORTED"]
          })
        }),
        expect.objectContaining({
          id: "v7-hole-source-diagnostics",
          status: "pass",
          exactStep: expect.objectContaining({
            status: "deferred",
            available: false,
            writerStatus: "available",
            sourceSupportedBodyCount: 0,
            exportableBodyCount: 0,
            diagnosticCodes: expect.arrayContaining([
              "EXPORT_EXACT_BODY_UNSUPPORTED",
              "EXPORT_BODY_CONSUMED",
              "EXPORT_RESULT_BODY_DEFERRED"
            ])
          })
        })
      ])
    );
    expect(JSON.stringify(result)).not.toMatch(
      V8_RELEASE_BOUNDARY_LEAK_PATTERN
    );
    expect(JSON.stringify(result)).not.toContain("web-cad.project.v17");

    expect(formatV8ReleaseSampleSmokeSummary(result)).toBe(
      [
        "V8 release package/export smoke passed",
        "samples: 6 passed, 0 failed, 6 total",
        "wcad: 6 package round-trips, 6 JSON-to-WCAD round-trips, corruption pass",
        "step: 2 supported samples, 4 unsupported/deferred samples, primitive unsupported pass",
        "- pass v7-rectangle-extrude-reference | wcad partbench.wcad.v1/web-cad.project.v16 | json->wcad ok | step supported:1 exportable | exports step:supported:available, glb:deferred:unavailable",
        "- pass v7-circle-extrude-export | wcad partbench.wcad.v1/web-cad.project.v16 | json->wcad ok | step supported:1 exportable | exports step:supported:available, glb:deferred:unavailable",
        "- pass v7-consumed-body-diagnostics | wcad partbench.wcad.v1/web-cad.project.v16 | json->wcad ok | step deferred:0 exportable | exports step:deferred:unavailable, glb:deferred:unavailable",
        "- pass v7-revolve-source-diagnostics | wcad partbench.wcad.v1/web-cad.project.v16 | json->wcad ok | step deferred:0 exportable | exports step:deferred:unavailable, glb:deferred:unavailable",
        "- pass v7-hole-source-diagnostics | wcad partbench.wcad.v1/web-cad.project.v16 | json->wcad ok | step deferred:0 exportable | exports step:deferred:unavailable, glb:deferred:unavailable",
        "- pass v7-edge-finish-source-diagnostics | wcad partbench.wcad.v1/web-cad.project.v16 | json->wcad ok | step deferred:0 exportable | exports step:deferred:unavailable, glb:deferred:unavailable"
      ].join("\n")
    );
  });

  it("reports WCAD package expectation failures in the V8 result", async () => {
    const [fixture] = cadCore.listV7ReleaseSampleFixtures();
    const result = await runV8ReleaseSampleSmoke(cadCore, {
      fixtures: [
        {
          ...fixture,
          expectedExportReadiness: {
            ...fixture.expectedExportReadiness,
            formats: fixture.expectedExportReadiness.formats.map((format) =>
              format.format === "step"
                ? { ...format, sourceSupportedBodyCount: 99 }
                : format
            )
          }
        }
      ]
    });

    expect(result).toMatchObject({
      ok: false,
      sampleCount: 1,
      passedCount: 0,
      failedCount: 1
    });
    expect(result.samples[0].failures).toEqual(
      expect.arrayContaining([
        "project.exportReadiness.formats.step.sourceSupportedBodyCount: expected 99, got 1",
        "project.exportExact.sourceSupportedBodyCount: expected 99, got 1"
      ])
    );
    expect(formatV8ReleaseSampleSmokeSummary(result)).toContain(
      "V8 release package/export smoke failed"
    );
  });
});
