import { describe, expect, it } from "vitest";
import {
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProject
} from "@web-cad/cad-core";
import {
  CadAgentRequestValidationError,
  createCadOpsAgentAdapter,
  parseCadOpsAgentRequest,
  parseCadOpsAgentQueryRequest
} from "./index";

describe("agent workflow command authority", () => {
  it("rejects an invalid nested operation with precise diagnostics and unchanged native identity", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "parameter.create", id: "keep", name: "Keep", value: 5 }
    ]);
    const before = createCadProjectSourceIdentity(exportCadProject(engine));
    const adapter = createCadOpsAgentAdapter(engine);
    let rejected: unknown;
    try {
      adapter.execute(
        parseCadOpsAgentRequest({
          requestId: "bad",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "feature.combine",
                mode: "union",
                targetBodyId: "a",
                toolBodyIds: ["b"]
              }
            ]
          }
        })
      );
    } catch (error) {
      rejected = error;
    }
    expect(rejected).toBeInstanceOf(CadAgentRequestValidationError);
    expect(rejected).toMatchObject({
      diagnostics: expect.arrayContaining([
        {
          path: "$.batch.ops[0].toolBodyId",
          code: "MISSING_FIELD",
          message: "Required field is missing.",
          operation: "feature.combine"
        }
      ])
    });
    expect(createCadProjectSourceIdentity(exportCadProject(engine))).toEqual(
      before
    );
  });

  it("shares pose query validation between core and agent paths and returns isolated snapshots", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "scene.createBox",
        id: "box",
        dimensions: { width: 1, height: 1, depth: 1 }
      },
      { op: "assembly.create", id: "a" },
      {
        op: "assembly.instance.insert",
        assemblyId: "a",
        id: "i",
        definition: { kind: "body", bodyId: "body:box" },
        transform: { translation: [1, 2, 3] }
      }
    ]);
    const query = {
      version: "cadops.v1",
      query: {
        query: "project.structure",
        projection: "poses",
        instanceIds: ["i"]
      }
    } as const;
    const direct = engine.executeQuery(query);
    const agent = createCadOpsAgentAdapter(engine).query(
      parseCadOpsAgentQueryRequest({
        requestId: "q",
        adapterVersion: "web-cad.agent-adapter.v1",
        query
      })
    );
    expect(agent).toMatchObject({ ...direct, requestId: "q" });
    expect(direct).toMatchObject({
      instancePoses: [{ id: "i", transform: { translation: [1, 2, 3] } }]
    });
    if (direct.ok && direct.query === "project.structure") {
      const pose = direct.instancePoses?.[0];
      if (!pose) throw new Error("Missing pose");
      (pose.transform.translation as unknown as number[])[0] = 999;
      expect(engine.executeQuery(query)).toMatchObject({
        instancePoses: [{ transform: { translation: [1, 2, 3] } }]
      });
    }
    for (const invalid of [
      { projection: "poses", limit: 1001 },
      { projection: "poses", offset: -1 },
      { limit: 1 },
      { projection: "poses", instanceIds: ["i", "i"] }
    ]) {
      const query = {
        version: "cadops.v1",
        query: { query: "project.structure", ...invalid }
      };
      expect(engine.executeQuery(query as never).ok).toBe(false);
      expect(() =>
        parseCadOpsAgentQueryRequest({
          requestId: "bad",
          adapterVersion: "web-cad.agent-adapter.v1",
          query
        })
      ).toThrow();
    }
  });
});
