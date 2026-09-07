import { describe, expect, it } from "vitest";
import {
  CadEngine,
  exportCadProject,
  importCadProject
} from "@web-cad/cad-core";
import { createCadOpsAgentAdapter } from "./index";

describe("agent assembly inspection", () => {
  it("preserves core instance poses and mates in structure queries after reopening", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "outline", name: "Outline", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "outline",
        id: "circle",
        center: [0, 0],
        radius: 4
      },
      {
        op: "feature.extrude",
        id: "extrusion",
        bodyId: "part",
        sketchId: "outline",
        entityId: "circle",
        depth: 2
      },
      { op: "assembly.create", id: "assembly", name: "Assembly" },
      {
        op: "assembly.instance.insert",
        id: "instance",
        assemblyId: "assembly",
        definition: { kind: "body", bodyId: "part" },
        transform: { translation: [5, 6, 7] }
      },
      {
        op: "assembly.mate.create",
        id: "ground",
        assemblyId: "assembly",
        kind: "fixed",
        instanceId: "instance"
      }
    ]);
    const reopened = importCadProject(exportCadProject(engine));
    const query = {
      version: "cadops.v1",
      query: { query: "project.structure" }
    } as const;
    const direct = reopened.executeQuery(query);
    expect(
      direct.ok && direct.query === "project.structure" && direct.assemblies
    ).toMatchObject([
      {
        id: "assembly",
        instances: [{ id: "instance", transform: { translation: [5, 6, 7] } }],
        mates: [{ id: "ground", kind: "fixed" }]
      }
    ]);
    expect(
      createCadOpsAgentAdapter(reopened).query({
        requestId: "inspect",
        adapterVersion: "web-cad.agent-adapter.v1",
        query
      })
    ).toEqual({
      ...direct,
      requestId: "inspect",
      adapterVersion: "web-cad.agent-adapter.v1"
    });
  });
});
