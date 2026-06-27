import { describe, expect, it } from "vitest";
import type {
  BodyGeneratedReferencesQueryResponse,
  CadReferenceHealthTarget,
  CadSelectionReferenceInput,
  CadSelectionReferenceOperation,
  FeatureEditabilityQueryResponse,
  ProjectExportReadinessQueryResponse,
  ProjectHealthQueryResponse,
  ProjectRebuildPlanQueryResponse,
  ProjectStructureQueryResponse,
  ProjectSummaryQueryResponse,
  ProjectTopologyIdentityReadinessQueryResponse,
  ReferenceHealthQueryResponse,
  ReferenceListNamedQueryResponse,
  SelectionReferenceCandidatesQueryResponse,
  TopologyCommandTargetReadinessQueryResponse,
  TopologyMatchSnapshotsQueryResponse
} from "@web-cad/cad-protocol";
import {
  CAD_PROJECT_FORMAT_VERSION_V18,
  CAD_PROJECT_FORMAT_VERSION_V16,
  CURRENT_CAD_PROJECT_FORMAT_VERSION,
  CadEngine,
  createV13ReleaseSampleBatch,
  createV14ReleaseSampleBatch,
  createV7ReleaseSampleBatch,
  createV10ReleaseSampleBatch,
  exportCadProjectJson,
  importCadProjectJson,
  listV13ReleaseSampleFixtures,
  listV14ReleaseSampleFixtures,
  listV7ReleaseSampleFixtures,
  listV10ReleaseSampleFixtures,
  parseCadProjectJson,
  type V13ReleaseSampleFixture,
  type V14ReleaseSampleFixture,
  type V7ReleaseSampleFixture,
  type V10ReleaseSampleFixture
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

describe("V10 release sample fixtures", () => {
  it("defines deterministic typed edit/rebuild fixtures without raw derived IDs", () => {
    const fixtures = listV10ReleaseSampleFixtures();

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "v10-extrude-edit-attached-sketch",
      "v10-c2-feature-lifecycle-edits",
      "v10-named-reference-repair-roundtrip"
    ]);

    for (const fixture of fixtures) {
      expect(fixture.units).toBe("mm");
      expect(fixture.ops.length).toBeGreaterThan(0);
      expect(fixture.workflowTags).toEqual(
        expect.arrayContaining([
          "feature-editability",
          "reference-health",
          "wcad-roundtrip",
          "source-boundary"
        ])
      );
      expect(createV10ReleaseSampleBatch(fixture.id)).toEqual({
        version: "cadops.v1",
        mode: "commit",
        ops: fixture.ops
      });

      assertNoRawDerivedIds(JSON.stringify(fixture));
    }
  });

  for (const fixture of listV10ReleaseSampleFixtures()) {
    it(`round-trips and verifies ${fixture.id}`, () => {
      const engine = buildV10SampleEngine(fixture);
      const json = exportCadProjectJson(engine);
      const project = parseCadProjectJson(json);
      const restored = importCadProjectJson(json);

      expect(project.schemaVersion).toBe(CURRENT_CAD_PROJECT_FORMAT_VERSION);
      expect(json).not.toContain("web-cad.project.v17");
      expect(json).not.toContain("project.rebuildPlan");
      expect(json).not.toContain("feature.editability");
      expect(json).not.toContain("reference.health");
      assertNoRawDerivedIds(json);

      expect(restored.getDocument().units).toBe(fixture.units);

      const rebuildPlan = readProjectRebuildPlan(restored);
      expect(rebuildPlan.status).toBe(fixture.expectedRebuild.initialStatus);
      expect(rebuildPlan.requiresProjectSchemaMigration).toBe(false);

      for (const expectation of fixture.expectedEditability) {
        const editability = readFeatureEditability(
          restored,
          expectation.featureId
        );

        expect(editability.status).toBe(expectation.expectedStatus);
        expect(editability.fields).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              commitOperation: expectation.expectedCommitOperation
            })
          ])
        );
        expect(editability.requiresProjectSchemaMigration).toBe(false);
      }

      for (const expectation of fixture.expectedReferenceHealth) {
        const health = readReferenceHealth(restored, expectation.target);
        const entry = findExpectedReferenceHealthEntry(health, expectation);

        expect(health.status).toBe(expectation.expectedStatus);
        expect(health.target).toEqual(expectation.target);
        expect(health.referenceHealthCount).toBe(health.referenceHealth.length);
        expect(entry).toBeDefined();
        expect(entry).toMatchObject({
          status: expectation.expectedStatus,
          commandable: expectation.expectedCommandable
        });
        if (expectation.expectedCommandable) {
          expect(entry?.commandOperations.length).toBeGreaterThan(0);
        } else {
          expect(entry?.commandOperations.length).toBe(0);
        }
        expect(entry?.consumedByFeatureId).toBe(
          expectation.expectedConsumedByFeatureId
        );
        expect(health.requiresProjectSchemaMigration).toBe(false);
      }
    });
  }
});

describe("V13 release sample fixtures", () => {
  it("defines deterministic typed topology fixtures without raw renderer/browser IDs in public expectations", () => {
    const fixtures = listV13ReleaseSampleFixtures();

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "v13-topology-anchor-repair-command-chain"
    ]);

    for (const fixture of fixtures) {
      expect(fixture.units).toBe("mm");
      expect(fixture.ops.length).toBeGreaterThan(0);
      expect(fixture.workflowTags).toEqual(
        expect.arrayContaining([
          "topology-checkpoint",
          "topology-anchor",
          "topology-anchor-repair",
          "topology-match",
          "reference-health",
          "named-reference-repair",
          "selection-reference-candidates",
          "target-topology-anchor",
          "source-boundary"
        ])
      );
      expect(createV13ReleaseSampleBatch(fixture.id)).toEqual({
        version: "cadops.v1",
        mode: "commit",
        ops: fixture.ops
      });

      assertNoRawDerivedIds(
        JSON.stringify({
          expectedTopology: fixture.expectedTopology,
          topologyMatchPrevious: fixture.topologyMatchPrevious,
          topologyMatchCandidates: fixture.topologyMatchCandidates,
          expectedTopologyMatches: fixture.expectedTopologyMatches
        })
      );
    }
  });

  for (const fixture of listV13ReleaseSampleFixtures()) {
    it(`round-trips and verifies ${fixture.id}`, () => {
      const engine = buildV13SampleEngine(fixture);
      const json = exportCadProjectJson(engine);
      const project = parseCadProjectJson(json);
      const restored = importCadProjectJson(json);

      expect(project.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V18);
      expect(json).toContain("web-cad.project.v18");
      expect(json).toContain("topologyIdentity");
      expect(json).not.toContain("project.topologyIdentityReadiness");
      expect(json).not.toContain("topology.matchSnapshots");
      assertNoRawDerivedIds(json);

      const readiness = readProjectTopologyIdentityReadiness(restored);
      expect(readiness).toMatchObject({
        query: "project.topologyIdentityReadiness",
        currentDocumentSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
        requiresProjectSchemaMigration: false,
        checkpointCount: fixture.expectedTopology.checkpointCount,
        anchorCount: fixture.expectedTopology.anchorCount
      });
      expect(readiness.checkpoints).toHaveLength(
        fixture.expectedTopology.checkpointCount
      );
      const matchCheckpointIds = [
        fixture.topologyMatchPrevious.checkpointId,
        ...fixture.topologyMatchCandidates.map(
          (candidate) => candidate.checkpointId
        )
      ].filter((checkpointId): checkpointId is string => Boolean(checkpointId));
      expect(
        readiness.checkpoints.map((checkpoint) => checkpoint.checkpointId)
      ).toEqual(expect.arrayContaining(matchCheckpointIds));
      expect(readiness.anchors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            anchorId: fixture.expectedTopology.repairedTopologyAnchorId,
            entityKind: "face",
            state: "active"
          }),
          expect.objectContaining({
            anchorId: fixture.expectedTopology.downstreamTargetTopologyAnchorId,
            entityKind: "body",
            state: "active"
          }),
          expect.objectContaining({
            anchorId: fixture.expectedTopology.manualRepairAnchorId,
            entityKind: "face",
            state: "active"
          })
        ])
      );
      assertNoPublicTopologyIds(JSON.stringify(readiness));

      const topologyIdentity = restored.getDocument().topologyIdentity;
      expect(topologyIdentity).toMatchObject({
        repairs: [
          expect.objectContaining({
            repairId: fixture.expectedTopology.manualRepairId,
            anchorId: fixture.expectedTopology.manualRepairAnchorId,
            replacementCheckpointId:
              fixture.expectedTopology.manualRepairReplacementCheckpointId,
            confidence: "high"
          })
        ],
        anchors: expect.arrayContaining([
          expect.objectContaining({
            anchorId: fixture.expectedTopology.manualRepairAnchorId,
            checkpointId:
              fixture.expectedTopology.manualRepairReplacementCheckpointId,
            state: "active"
          })
        ])
      });
      expect(topologyIdentity?.repairs).toHaveLength(
        fixture.expectedTopology.repairCount
      );

      const namedReferences = readNamedReferences(restored);
      expect(namedReferences.references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: fixture.expectedTopology.repairedReferenceName,
            status: "resolved",
            topologyAnchorId: fixture.expectedTopology.repairedTopologyAnchorId,
            stableId: expect.stringContaining(":endCap")
          })
        ])
      );

      const namedSelection = readSelectionCandidatesFor(restored, {
        selection: {
          type: "namedReference",
          name: fixture.expectedTopology.repairedReferenceName
        },
        requiredOperation: "feature.selectReference"
      });
      expect(namedSelection).toMatchObject({
        status: "resolved",
        candidateCount: 1,
        candidates: [
          expect.objectContaining({
            commandable: true,
            target: expect.objectContaining({
              topologyAnchorId:
                fixture.expectedTopology.repairedTopologyAnchorId,
              checkpointId: "v13_checkpoint_repair_body"
            })
          })
        ]
      });
      assertNoPublicTopologyIds(JSON.stringify(namedSelection));

      const repairedHealth = readReferenceHealth(restored, {
        type: "namedReference",
        name: fixture.expectedTopology.repairedReferenceName
      });
      expect(repairedHealth).toMatchObject({
        status: "active",
        referenceHealth: [
          expect.objectContaining({
            status: "active",
            commandable: true,
            topologyAnchorId: fixture.expectedTopology.repairedTopologyAnchorId
          })
        ]
      });
      assertNoPublicTopologyIds(JSON.stringify(repairedHealth));

      const structure = readProjectStructure(restored);
      expect(structure.features).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: fixture.expectedTopology.downstreamFeatureId,
            kind: "extrude",
            operationMode: "cut",
            targetTopologyAnchorId:
              fixture.expectedTopology.downstreamTargetTopologyAnchorId
          })
        ])
      );

      const match = readTopologyMatchSnapshots(
        restored,
        fixture.topologyMatchPrevious,
        fixture.topologyMatchCandidates
      );
      const byPreviousEntity = new Map(
        match.matchResults.map((result) => [
          result.previousCheckpointEntityId,
          result
        ])
      );

      expect(match).toMatchObject({
        query: "topology.matchSnapshots",
        mutatesSource: false,
        resultCount: fixture.expectedTopologyMatches.length
      });
      for (const expectation of fixture.expectedTopologyMatches) {
        expect(
          byPreviousEntity.get(expectation.previousCheckpointEntityId)
        ).toMatchObject({
          state: expectation.expectedState,
          confidence: expectation.expectedConfidence
        });
      }
      assertNoRawDerivedIds(JSON.stringify(match));
    });
  }
});

describe("V14 release sample fixtures", () => {
  it("defines deterministic topology-backed downstream modeling fixtures", () => {
    const fixtures = listV14ReleaseSampleFixtures();

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "v14-result-body-cut-add-hole",
      "v14-circle-side-plane-hole",
      "v14-circle-result-body-add",
      "v14-result-edge-finish",
      "v14-result-edge-topology-anchor-finish"
    ]);

    for (const fixture of fixtures) {
      expect(fixture.units).toBe("mm");
      expect(fixture.ops.length).toBeGreaterThan(0);
      expect(fixture.workflowTags).toEqual(
        expect.arrayContaining(["source-boundary", "wcad-round-trip"])
      );
      expect(fixture.expectedFeatures.length).toBeGreaterThan(0);
      expect(createV14ReleaseSampleBatch(fixture.id)).toEqual({
        version: "cadops.v1",
        mode: "commit",
        ops: fixture.ops
      });

      assertNoRawDerivedIds(
        JSON.stringify({
          expectedTopology: fixture.expectedTopology,
          expectedFeatures: fixture.expectedFeatures,
          expectedReadiness: fixture.expectedReadiness,
          expectedBlockedBatches: fixture.expectedBlockedBatches,
          expectedEditability: fixture.expectedEditability
        })
      );
    }
  });

  for (const fixture of listV14ReleaseSampleFixtures()) {
    it(`round-trips and verifies ${fixture.id}`, () => {
      const engine = buildV14SampleEngine(fixture);
      const json = exportCadProjectJson(engine);
      const project = parseCadProjectJson(json);
      const restored = importCadProjectJson(json);
      const expectedSchemaVersion =
        fixture.expectedTopology.checkpointCount > 0
          ? CAD_PROJECT_FORMAT_VERSION_V18
          : CAD_PROJECT_FORMAT_VERSION_V16;

      expect(project.schemaVersion).toBe(expectedSchemaVersion);
      expect(json).toContain(expectedSchemaVersion);
      expect(json).not.toContain("project.health");
      expect(json).not.toContain("topology.commandTargetReadiness");
      assertNoRawDerivedIds(json);

      const dryRunEngine = new CadEngine();
      const beforeDryRunJson = exportCadProjectJson(dryRunEngine);
      const dryRun = dryRunEngine.executeBatch({
        ...createV14ReleaseSampleBatch(fixture.id),
        mode: "dryRun"
      });
      expect(dryRun.ok).toBe(true);
      expect(exportCadProjectJson(dryRunEngine)).toBe(beforeDryRunJson);

      const topology = readProjectTopologyIdentityReadiness(restored);
      expect(topology).toMatchObject({
        currentDocumentSchemaVersion: expectedSchemaVersion,
        requiresProjectSchemaMigration: false,
        checkpointCount: fixture.expectedTopology.checkpointCount,
        anchorCount: fixture.expectedTopology.anchorCount
      });
      expect(topology.anchors.map((anchor) => anchor.anchorId)).toEqual(
        expect.arrayContaining([...fixture.expectedTopology.anchorIds])
      );
      assertNoPublicTopologyIds(JSON.stringify(topology));

      const structure = readProjectStructure(restored);
      const health = readProjectHealth(restored);

      for (const featureExpectation of fixture.expectedFeatures) {
        expect(structure.features).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: featureExpectation.featureId,
              kind: featureExpectation.kind,
              ...(featureExpectation.bodyId
                ? { bodyId: featureExpectation.bodyId }
                : {}),
              ...(featureExpectation.targetBodyId
                ? { targetBodyId: featureExpectation.targetBodyId }
                : {}),
              ...(featureExpectation.targetTopologyAnchorId
                ? {
                    targetTopologyAnchorId:
                      featureExpectation.targetTopologyAnchorId
                  }
                : {}),
              ...(featureExpectation.topologyAnchorId
                ? { topologyAnchorId: featureExpectation.topologyAnchorId }
                : {}),
              ...(featureExpectation.operationMode
                ? { operationMode: featureExpectation.operationMode }
                : {}),
              ...(featureExpectation.namedReference
                ? { namedReference: featureExpectation.namedReference }
                : {})
            })
          ])
        );
      }
      assertNoRawDerivedIds(JSON.stringify({ structure, health }));

      const readinessEngine = buildV14SampleEngine({
        ...fixture,
        ops: fixture.ops.slice(
          0,
          fixture.readinessOpCount ?? fixture.ops.length
        )
      });
      for (const readinessExpectation of fixture.expectedReadiness) {
        const readiness = readTopologyCommandTargetReadiness(
          readinessEngine,
          readinessExpectation
        );

        expect(readiness).toMatchObject({
          status: readinessExpectation.expectedStatus,
          commandable: readinessExpectation.expectedCommandable,
          supportedOperations: expect.arrayContaining([
            ...readinessExpectation.expectedSupportedOperations
          ])
        });
        assertNoPublicTopologyIds(JSON.stringify(readiness));
      }

      for (const blocked of fixture.expectedBlockedBatches ?? []) {
        const beforeBlockedJson = exportCadProjectJson(restored);
        const blockedResult = restored.executeBatch({
          version: "cadops.v1",
          mode: "dryRun",
          ops: blocked.ops
        });

        expect(blockedResult).toMatchObject({
          ok: false,
          error: {
            code: blocked.expectedCode,
            path: blocked.expectedPath
          }
        });
        expect(exportCadProjectJson(restored)).toBe(beforeBlockedJson);
      }

      for (const editability of fixture.expectedEditability ?? []) {
        expect(readFeatureEditability(restored, editability.featureId)).toEqual(
          expect.objectContaining({ status: editability.expectedStatus })
        );
      }
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

function buildV10SampleEngine(fixture: V10ReleaseSampleFixture): CadEngine {
  const engine = new CadEngine();
  const response = engine.executeBatch(createV10ReleaseSampleBatch(fixture.id));

  expect(response.ok).toBe(true);

  return engine;
}

function buildV13SampleEngine(fixture: V13ReleaseSampleFixture): CadEngine {
  const engine = new CadEngine();
  const response = engine.executeBatch(createV13ReleaseSampleBatch(fixture.id));

  expect(response.ok).toBe(true);

  return engine;
}

function buildV14SampleEngine(fixture: V14ReleaseSampleFixture): CadEngine {
  const engine = new CadEngine();
  const response = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: fixture.ops
  });

  expect(response.ok).toBe(true);

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

function readFeatureEditability(
  engine: CadEngine,
  featureId: string
): FeatureEditabilityQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "feature.editability", featureId }
  });

  if (!response.ok || response.query !== "feature.editability") {
    throw new Error("Expected feature.editability response.");
  }

  return response;
}

function readProjectRebuildPlan(
  engine: CadEngine
): ProjectRebuildPlanQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.rebuildPlan" }
  });

  if (!response.ok || response.query !== "project.rebuildPlan") {
    throw new Error("Expected project.rebuildPlan response.");
  }

  return response;
}

function readProjectStructure(
  engine: CadEngine
): ProjectStructureQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project.structure response.");
  }

  return response;
}

function readProjectTopologyIdentityReadiness(
  engine: CadEngine
): ProjectTopologyIdentityReadinessQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.topologyIdentityReadiness" }
  });

  if (!response.ok || response.query !== "project.topologyIdentityReadiness") {
    throw new Error("Expected project.topologyIdentityReadiness response.");
  }

  return response;
}

function readTopologyCommandTargetReadiness(
  engine: CadEngine,
  expectation: V14ReleaseSampleFixture["expectedReadiness"][number]
): TopologyCommandTargetReadinessQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "topology.commandTargetReadiness",
      target: expectation.target,
      desiredOperation: expectation.operation,
      ...(expectation.snapshot ? { snapshot: expectation.snapshot } : {})
    }
  });

  if (!response.ok || response.query !== "topology.commandTargetReadiness") {
    throw new Error("Expected topology.commandTargetReadiness response.");
  }

  return response;
}

function readReferenceHealth(
  engine: CadEngine,
  target: CadReferenceHealthTarget
): ReferenceHealthQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "reference.health", target }
  });

  if (!response.ok || response.query !== "reference.health") {
    throw new Error("Expected reference.health response.");
  }

  return response;
}

function readTopologyMatchSnapshots(
  engine: CadEngine,
  previous: V13ReleaseSampleFixture["topologyMatchPrevious"],
  candidates: V13ReleaseSampleFixture["topologyMatchCandidates"]
): TopologyMatchSnapshotsQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "topology.matchSnapshots",
      previous,
      candidates
    }
  });

  if (!response.ok || response.query !== "topology.matchSnapshots") {
    throw new Error("Expected topology.matchSnapshots response.");
  }

  return response;
}

function findExpectedReferenceHealthEntry(
  response: ReferenceHealthQueryResponse,
  expectation: V10ReleaseSampleFixture["expectedReferenceHealth"][number]
): ReferenceHealthQueryResponse["referenceHealth"][number] | undefined {
  const target = expectation.target;

  if (target.type === "namedReference") {
    return response.referenceHealth.find(
      (entry) => entry.referenceName === target.name
    );
  }

  if (target.type === "generatedReference") {
    return response.referenceHealth.find(
      (entry) =>
        entry.bodyId === target.bodyId &&
        entry.stableId === target.stableId &&
        (target.expectedKind === undefined ||
          entry.kind === target.expectedKind)
    );
  }

  if (target.type === "body") {
    return response.referenceHealth.find(
      (entry) => entry.bodyId === target.bodyId
    );
  }

  return response.referenceHealth.find(
    (entry) => entry.label === expectation.targetLabel
  );
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

function readSelectionCandidatesFor(
  engine: CadEngine,
  input: {
    readonly selection: CadSelectionReferenceInput;
    readonly requiredOperation?: CadSelectionReferenceOperation;
  }
): SelectionReferenceCandidatesQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "selection.referenceCandidates",
      selection: input.selection,
      ...(input.requiredOperation
        ? { requiredOperation: input.requiredOperation }
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
    /rendererId|renderId|meshId|occtId|occtShape|cacheKey|gpuId|gpuBuffer|opfsPath|fileHandle|localPath|exportArtifactId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
  );
}

function assertNoPublicTopologyIds(text: string): void {
  assertNoRawDerivedIds(text);
  expect(text).not.toMatch(/checkpointEntityId|checkpoint-local/i);
}
