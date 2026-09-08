import assert from "node:assert/strict";
import console from "node:console";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HeadlessMcpClient } from "../../../scripts/agent-runtime/mcp-client.mjs";
const cases = [];
await mkdir(resolve(".metrics/gearbox-trial/observer"), { recursive: true });
for (const kind of ["wire", "rectangle"]) {
  const client = new HeadlessMcpClient({
    executable: resolve("packages/mcp-stdio-server/dist/stdio.js"),
    workspace: resolve(".metrics/gearbox-trial/observer")
  });
  const requests = [];
  const tool = async (name, args, options) => {
    const response = await client.tool(name, args, options);
    requests.push({ name, arguments: args, response });
    return response;
  };
  try {
    await client.initialize();
    const points = [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10]
    ];
    const outline =
      kind === "wire"
        ? points.map((p, i) => ({
            op: "sketch.addLine",
            sketchId: "outline",
            id: `edge_${i}`,
            start: p,
            end: points[(i + 1) % 4]
          }))
        : [
            {
              op: "sketch.addRectangle",
              sketchId: "outline",
              id: "rectangle",
              center: [0, 0],
              width: 20,
              height: 20
            }
          ];
    const body =
      kind === "wire"
        ? {
            profile: {
              kind: "wire",
              sketchId: "outline",
              segments: points.map((_, i) => ({
                entityId: `edge_${i}`,
                orientation: "forward"
              }))
            }
          }
        : { sketchId: "outline", entityId: "rectangle" };
    const create = {
      allowCommit: true,
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          { op: "sketch.create", id: "outline", name: "Square", plane: "XY" },
          ...outline,
          {
            op: "feature.extrude",
            id: "blank",
            bodyId: "blank_body",
            depth: 10,
            ...body
          },
          { op: "sketch.create", id: "bore", name: "Bore", plane: "XY" },
          {
            op: "sketch.addCircle",
            sketchId: "bore",
            id: "circle",
            center: [0, 0],
            radius: 3
          }
        ]
      }
    };
    await tool("cad.batch", create);
    const initial = await tool("cad.session_info", {});
    const cut = await tool(
      "cad.batch",
      {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "feature.extrude",
              id: "bored",
              bodyId: "bored_body",
              sketchId: "bore",
              entityId: "circle",
              depth: 10,
              operationMode: "cut",
              targetBodyId: "blank_body"
            }
          ]
        }
      },
      { expectError: kind === "wire" }
    );
    const final = await tool("cad.session_info", {});
    if (kind === "wire")
      assert.deepEqual(
        final.result.sourceIdentity,
        initial.result.sourceIdentity
      );
    else {
      const mass = await tool("cad.body_mass_properties", {
        bodyId: "bored_body"
      });
      assert.ok(
        Math.abs(mass.massProperties.volume - (400 - 9 * Math.PI) * 10) < 1e-6
      );
    }
    cases.push({ kind, cut, requests });
  } finally {
    await client.close();
  }
}
await writeFile(
  ".metrics/gearbox-trial/observer/cut-repro.json",
  JSON.stringify({ cases }, null, 2) + "\n"
);
console.log(
  "Wire square bore cut rejected atomically; equivalent rectangle bore cut succeeded with expected exact volume."
);
