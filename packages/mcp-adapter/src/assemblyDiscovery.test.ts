import { describe, expect, it } from "vitest";
import { createCadMcpServer } from "./index";

type Schema = {
  properties?: Record<string, Schema>;
  oneOf?: Schema[];
  items?: Schema;
  const?: string;
  description?: string;
  [key: string]: unknown;
};

describe("assembly discovery", () => {
  it("publishes every assembly command and complete mate variants through cad.batch", () => {
    const tools = createCadMcpServer().listTools().tools;
    const batch = tools.find((tool) => tool.name === "cad.batch")
      ?.inputSchema as Schema;
    const variants =
      batch.properties?.batch?.properties?.ops?.items?.oneOf ?? [];
    const assembly = variants.filter((schema) =>
      schema.properties?.op?.const?.startsWith("assembly.")
    );
    expect(
      [
        ...new Set(assembly.map((schema) => schema.properties?.op?.const))
      ].sort()
    ).toEqual([
      "assembly.create",
      "assembly.instance.delete",
      "assembly.instance.insert",
      "assembly.instance.replace",
      "assembly.instance.updateTransform",
      "assembly.mate.create",
      "assembly.mate.delete",
      "assembly.mate.edit"
    ]);
    for (const action of ["create", "edit"]) {
      const mates = assembly.filter(
        (schema) => schema.properties?.op?.const === `assembly.mate.${action}`
      );
      expect(
        mates.map((schema) => schema.properties?.kind?.const).sort()
      ).toEqual(["coincident", "concentric", "distance", "fixed", "revolute"]);
      const revolute = mates.find(
        (schema) => schema.properties?.kind?.const === "revolute"
      );
      expect(revolute?.properties).toMatchObject({
        primary: {
          properties: {
            frame: {
              oneOf: expect.arrayContaining([
                expect.objectContaining({
                  required: ["kind", "origin", "xDirection", "zDirection"]
                }),
                expect.objectContaining({
                  required: ["kind", "sketchId", "entityId"]
                })
              ])
            }
          }
        },
        angleDegrees: { description: expect.stringContaining("degrees") },
        angleParameterId: { type: "string" },
        offsetParameterId: { type: "string" }
      });
      expect(revolute?.oneOf).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ required: ["angleDegrees"] }),
          expect.objectContaining({ required: ["angleParameterId"] })
        ])
      );
      expect(
        mates.find((schema) => schema.properties?.kind?.const === "distance")
          ?.properties?.distanceParameterId
      ).toMatchObject({ type: "string" });
    }
    expect(
      tools.find((tool) => tool.name === "cad.project_structure")?.description
    ).toContain("resolved transforms and mates");
  });

  it("states transform units, rotation order and pose-update preservation in discovery", () => {
    const batch = createCadMcpServer()
      .listTools()
      .tools.find((tool) => tool.name === "cad.batch")?.inputSchema as Schema;
    const variants =
      batch.properties?.batch?.properties?.ops?.items?.oneOf ?? [];
    for (const name of [
      "assembly.instance.insert",
      "assembly.instance.updateTransform"
    ]) {
      const transform = variants.find(
        (schema) => schema.properties?.op?.const === name
      )?.properties?.transform;
      expect(transform?.properties?.rotation?.description).toContain(
        "radians, applied X then Y then Z"
      );
      expect(transform?.properties?.translation?.description).toContain(
        "document length units"
      );
      expect(transform?.properties?.scale?.description).toContain(
        "before rotation"
      );
      expect(transform?.description).toContain("update preserves them");
    }
  });
});
