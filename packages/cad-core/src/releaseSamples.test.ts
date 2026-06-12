import { describe, expect, it } from "vitest";
import type {
  BodyGeneratedReferencesQueryResponse,
  ProjectExportReadinessQueryResponse,
  ProjectHealthQueryResponse,
  ProjectSummaryQueryResponse,
  ReferenceListNamedQueryResponse,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import {
  CURRENT_CAD_PROJECT_FORMAT_VERSION,
  CadEngine,
  createV7ReleaseSampleBatch,
  exportCadProjectJson,
  importCadProjectJson,
  listV7ReleaseSampleFixtures,
  parseCadProjectJson,
  type V7ReleaseSampleFixture
} from "./index";

describe("V7 release sample fixtures", () => {
  it("defines deterministic typed source fixtures without raw derived IDs", () => {
    const fixtures = listV7ReleaseSampleFixtures();

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "v7-rectangle-extrude-reference",
      "v7-circle-extrude-export",
      "v7-consumed-body-diagnostics",
      "v7-revolve-source-diagnostics",
      "v7-hole-source-diagnostics",
      "v7-edge-finish-source-diagnostics"
    ]);

    for (const fixture of fixtures) {
      expect(fixture.units).toBe("mm");
      expect(fixture.ops.length).toBeGreaterThan(0);
      expect(fixture.workflowTags).toContain("selection-reference-candidates");
      expect(
        fixture.expectedExportReadiness.formats.map((format) => format.format)
      ).toEqual(["step", "glb"]);
      expect(createV7ReleaseSampleBatch(fixture.id)).toEqual({
        version: "cadops.v1",
        mode: "commit",
        ops: fixture.ops
      });

      assertNoRawDerivedIds(JSON.stringify(fixture));
    }
  });

  for (const fixture of listV7ReleaseSampleFixtures()) {
    it(`round-trips and verifies ${fixture.id}`, () => {
      const engine = buildSampleEngine(fixture);
      const json = exportCadProjectJson(engine);
      const project = parseCadProjectJson(json);
      const restored = importCadProjectJson(json);

      expect(project.schemaVersion).toBe(CURRENT_CAD_PROJECT_FORMAT_VERSION);
      expect(json).not.toContain("web-cad.project.v17");
      expect(json).not.toContain("project.summary");
      expect(json).not.toContain("project.exportReadiness");
      expect(json).not.toContain("selection.referenceCandidates");
      assertNoRawDerivedIds(json);

      expect(restored.getDocument().units).toBe(fixture.units);

      const health = readProjectHealth(restored);
      expect(health.status).toBe(fixture.expectedHealthStatus);
      expect(health.issueCount).toBe(fixture.expectedHealthIssueCount);

      const summary = readProjectSummary(restored);
      expect(summary.units).toBe(fixture.units);
      expect(summary.objectCount).toBe(0);
      expect(summary.structure).toMatchObject({
        partCount: 1,
        primitiveCompatibilityBodyCount: 0,
        authoredBodyFeatureCount: fixture.expectedSourceCounts.featureCount,
        sketchCount: fixture.expectedSourceCounts.sketchCount,
        sketchEntityCount: fixture.expectedSourceCounts.sketchEntityCount,
        featureCount: fixture.expectedSourceCounts.featureCount,
        bodyCount: fixture.expectedSourceCounts.bodyCount,
        activeBodyCount: fixture.expectedSourceCounts.activeBodyCount,
        consumedBodyCount: fixture.expectedSourceCounts.consumedBodyCount
      });
      expect(summary.health).toEqual({
        status: fixture.expectedHealthStatus,
        issueCount: fixture.expectedHealthIssueCount
      });
      expect(summary.references).toMatchObject(
        fixture.expectedReferenceSummary
      );
      expect(summary.exportReadiness).toMatchObject(
        fixture.expectedExportReadiness
      );

      const namedReferences = readNamedReferences(restored);
      expect(namedReferences.referenceCount).toBe(
        fixture.expectedSourceCounts.namedReferenceCount
      );
      for (const namedReference of fixture.expectedNamedReferences) {
        expect(namedReferences.references).toContainEqual(
          expect.objectContaining({
            name: namedReference.name,
            status: "resolved",
            bodyId: namedReference.bodyId,
            stableId: namedReference.stableId,
            reference: expect.objectContaining({
              kind: namedReference.kind,
              stableId: namedReference.stableId
            })
          })
        );
      }

      for (const expectedReferences of fixture.expectedGeneratedReferences) {
        const references = readGeneratedReferences(
          restored,
          expectedReferences.bodyId
        );

        expect(references.body.stableId).toBe(expectedReferences.bodyStableId);
        expect(references.faces.map((face) => face.stableId)).toEqual(
          expect.arrayContaining([...expectedReferences.faceStableIds])
        );
        expect(references.edges.map((edge) => edge.stableId)).toEqual(
          expect.arrayContaining([...expectedReferences.edgeStableIds])
        );
        expect(references.vertices.map((vertex) => vertex.stableId)).toEqual(
          expect.arrayContaining([...expectedReferences.vertexStableIds])
        );
      }

      for (const selection of fixture.expectedSelectionQueries) {
        const candidates = readSelectionCandidates(restored, selection);

        expect(candidates.status).toBe(selection.expectedStatus);
        expect(candidates.candidateCount).toBe(
          selection.expectedCandidateCount
        );
        expect(
          candidates.candidates.filter((candidate) => candidate.commandable)
            .length
        ).toBe(selection.expectedCommandableCount);
        if (selection.expectedStatus === "resolved") {
          expect(candidates.issueCount).toBe(0);
        } else {
          expect(candidates.issueCount).toBeGreaterThan(0);
        }
      }

      const readiness = readProjectExportReadiness(restored);
      expect(readiness).toMatchObject(fixture.expectedExportReadiness);
      expect(readiness.formats).toEqual(
        expect.arrayContaining(
          fixture.expectedExportReadiness.formats.map((format) =>
            expect.objectContaining(format)
          )
        )
      );
      expect(readiness.formats).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            format: "step",
            status:
              fixture.expectedExportReadiness.formats.find(
                (format) => format.format === "step"
              )?.status ?? "unavailable",
            available:
              fixture.expectedExportReadiness.formats.find(
                (format) => format.format === "step"
              )?.available ?? false
          }),
          expect.objectContaining({
            format: "glb",
            status:
              fixture.expectedExportReadiness.formats.find(
                (format) => format.format === "glb"
              )?.status ?? "unavailable",
            available: false
          })
        ])
      );
    });
  }
});

function buildSampleEngine(fixture: V7ReleaseSampleFixture): CadEngine {
  const engine = new CadEngine();
  const response = engine.executeBatch(createV7ReleaseSampleBatch(fixture.id));

  expect(response).toMatchObject({
    ok: true,
    mode: "commit",
    warnings: []
  });
  expect(engine.getTransactions()).toHaveLength(1);

  return engine;
}

function readProjectHealth(engine: CadEngine): ProjectHealthQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.health" }
  });

  if (!response.ok || response.query !== "project.health") {
    throw new Error("Expected project.health response.");
  }

  return response;
}

function readProjectSummary(engine: CadEngine): ProjectSummaryQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.summary" }
  });

  if (!response.ok || response.query !== "project.summary") {
    throw new Error("Expected project.summary response.");
  }

  return response;
}

function readProjectExportReadiness(
  engine: CadEngine
): ProjectExportReadinessQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.exportReadiness" }
  });

  if (!response.ok || response.query !== "project.exportReadiness") {
    throw new Error("Expected project.exportReadiness response.");
  }

  return response;
}

function readNamedReferences(
  engine: CadEngine
): ReferenceListNamedQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "reference.listNamed" }
  });

  if (!response.ok || response.query !== "reference.listNamed") {
    throw new Error("Expected reference.listNamed response.");
  }

  return response;
}

function readGeneratedReferences(
  engine: CadEngine,
  bodyId: string
): BodyGeneratedReferencesQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.generatedReferences", bodyId }
  });

  if (!response.ok || response.query !== "body.generatedReferences") {
    throw new Error(
      `Expected body.generatedReferences response for ${bodyId}.`
    );
  }

  return response;
}

function readSelectionCandidates(
  engine: CadEngine,
  expectation: V7ReleaseSampleFixture["expectedSelectionQueries"][number]
): SelectionReferenceCandidatesQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "selection.referenceCandidates",
      selection: expectation.selection,
      ...(expectation.requiredOperation
        ? { requiredOperation: expectation.requiredOperation }
        : {})
    }
  });

  if (!response.ok || response.query !== "selection.referenceCandidates") {
    throw new Error("Expected selection.referenceCandidates response.");
  }

  return response;
}

function assertNoRawDerivedIds(text: string): void {
  expect(text).not.toMatch(
    /rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
  );
}
