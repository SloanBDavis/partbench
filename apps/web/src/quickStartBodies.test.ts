import { CadEngine } from "@web-cad/cad-core";
import type { ProjectStructureQueryResponse } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import { createQuickStartSourceBodyPlan } from "./quickStartBodies";
import type { PrimitiveCommandForm } from "./cadCommands";

describe("quickStartBodies", () => {
  it("creates feature-backed source body ops for quick Box", () => {
    const engine = new CadEngine();
    const plan = createQuickStartSourceBodyPlan({
      document: engine.getDocument(),
      form: createPrimitiveForm({
        width: 6,
        height: 4,
        depth: 0.5,
        translationX: 2
      }),
      kind: "box"
    });

    expect(plan).toMatchObject({
      bodyId: "body_1",
      entityId: "skent_1",
      featureId: "feat_1",
      sketchId: "sketch_1",
      ops: [
        {
          op: "sketch.create",
          id: "sketch_1",
          name: "Box 1 profile",
          plane: "XY"
        },
        {
          op: "sketch.addRectangle",
          sketchId: "sketch_1",
          id: "skent_1",
          center: [2, 0],
          width: 6,
          height: 4
        },
        {
          op: "feature.extrude",
          id: "feat_1",
          bodyId: "body_1",
          name: "Box 1",
          sketchId: "sketch_1",
          entityId: "skent_1",
          depth: 0.5,
          side: "symmetric",
          operationMode: "newBody"
        }
      ]
    });

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: plan.ops
    });

    expect(response).toMatchObject({
      ok: true,
      createdSketchIds: ["sketch_1"],
      createdSketchEntityIds: ["skent_1"],
      createdFeatureIds: ["feat_1"],
      createdBodyIds: ["body_1"]
    });

    const structure = readStructure(engine);

    expect(structure).toMatchObject({
      ok: true,
      bodies: [
        expect.objectContaining({
          id: "body_1",
          source: expect.objectContaining({ type: "sketchExtrudeFeature" })
        })
      ]
    });
    expect(
      structure.ok
        ? structure.bodies.some(
            (body) => body.source.type === "primitiveFeature"
          )
        : true
    ).toBe(false);
  });

  it("creates feature-backed source body ops for quick Cylinder", () => {
    const engine = new CadEngine();
    engine.apply({
      op: "sketch.create",
      id: "sketch_1",
      name: "Existing sketch",
      plane: "XY"
    });

    const plan = createQuickStartSourceBodyPlan({
      document: engine.getDocument(),
      form: createPrimitiveForm({
        radius: 1.25,
        height: 3,
        translationX: 5,
        translationY: 1
      }),
      kind: "cylinder"
    });

    expect(plan.ops).toMatchObject([
      {
        op: "sketch.create",
        id: "sketch_2",
        name: "Cylinder 1 profile",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_2",
        id: "skent_1",
        center: [5, 1],
        radius: 1.25
      },
      {
        op: "feature.extrude",
        id: "feat_1",
        bodyId: "body_1",
        name: "Cylinder 1",
        sketchId: "sketch_2",
        entityId: "skent_1",
        depth: 3,
        side: "symmetric",
        operationMode: "newBody"
      }
    ]);

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: plan.ops
    });

    expect(response).toMatchObject({
      ok: true,
      createdSketchIds: ["sketch_2"],
      createdSketchEntityIds: ["skent_1"],
      createdFeatureIds: ["feat_1"],
      createdBodyIds: ["body_1"]
    });
  });

  it("keeps repeated quick-body names unique", () => {
    const engine = new CadEngine();
    const first = createQuickStartSourceBodyPlan({
      document: engine.getDocument(),
      form: createPrimitiveForm({}),
      kind: "cylinder"
    });
    engine.applyBatch(first.ops);

    const second = createQuickStartSourceBodyPlan({
      document: engine.getDocument(),
      form: createPrimitiveForm({}),
      kind: "cylinder"
    });

    expect(second.ops).toContainEqual(
      expect.objectContaining({
        op: "sketch.create",
        name: "Cylinder 2 profile"
      })
    );
    expect(second.ops).toContainEqual(
      expect.objectContaining({ op: "feature.extrude", name: "Cylinder 2" })
    );
  });
});

function createPrimitiveForm(
  overrides: Partial<PrimitiveCommandForm>
): PrimitiveCommandForm {
  return {
    id: "",
    width: 1,
    height: 1,
    depth: 1,
    radius: 1,
    majorRadius: 2,
    minorRadius: 0.5,
    translationX: 0,
    translationY: 0,
    translationZ: 0,
    ...overrides
  };
}

function readStructure(engine: CadEngine): ProjectStructureQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project.structure response.");
  }

  return response;
}
