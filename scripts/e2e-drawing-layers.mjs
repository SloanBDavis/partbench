import assert from "node:assert/strict";

// A phase of the public mounting-plate journey: real commands and native files.
export async function exerciseMcpDrawingLayers(client) {
  const batch = (ops, mode = "commit") => ({
    batch: { version: "cadops.v1", mode, ops },
    allowCommit: true
  });
  const layer = {
    id: "layer_mcp",
    name: "Machining",
    color: "#ff8844",
    lineType: "center",
    lineWeight: 0.7,
    transparency: 25,
    locked: false,
    visible: true,
    printable: false
  };
  const entity = {
    id: "layer_probe",
    kind: "line",
    start: [0, 0],
    end: [30, 20],
    layerId: layer.id
  };
  const create = [
    { op: "drawing.layer.create", layer },
    { op: "drawing.entity.create", entity }
  ];
  for (const operation of [
    "drawing.layer.create",
    "drawing.layer.update",
    "drawing.layer.delete"
  ])
    await client.tool("cad.operation_schema", { operation });
  const identity = async () =>
    (await client.tool("cad.session_info")).result.sourceIdentity;
  const before = await identity();
  const dry = await client.tool("cad.batch", batch(create, "dryRun"));
  assert.deepEqual(dry.semanticDiff.drawingLayers.created, [layer]);
  assert.deepEqual(await identity(), before);
  await client.tool("cad.batch", batch(create));
  const locked = {
    ...layer,
    name: "Manufacturing",
    locked: true,
    visible: false
  };
  await client.tool(
    "cad.batch",
    batch([{ op: "drawing.layer.update", layer: locked }])
  );
  const lockedIdentity = await identity();
  for (const ops of [
    [{ op: "drawing.entity.update", entity: { ...entity, end: [99, 99] } }],
    [{ op: "drawing.entity.delete", id: entity.id }],
    [
      {
        op: "drawing.entity.create",
        entity: { ...entity, id: "locked_create" }
      }
    ],
    [{ op: "drawing.layer.delete", id: layer.id }],
    [{ op: "drawing.layer.delete", id: "0" }],
    [
      {
        op: "drawing.entity.create",
        entity: {
          ...entity,
          id: "missing_layer_probe",
          layerId: "missing_layer"
        }
      }
    ],
    [
      { op: "drawing.layer.update", layer: { ...locked, locked: false } },
      {
        op: "drawing.layer.create",
        layer: { ...layer, id: "duplicate", name: locked.name }
      }
    ],
    [{ op: "drawing.layer.update", layer: { ...locked, transparency: 91 } }]
  ]) {
    await client.tool("cad.batch", batch(ops), { expectError: true });
    assert.deepEqual(
      await identity(),
      lockedIdentity,
      "Rejected layer operation must preserve source atomically"
    );
  }
  await client.tool("cad.project_save", {
    path: "drawing-layers.wcad",
    overwrite: true
  });
  await client.tool("cad.project_open", { path: "drawing-layers.wcad" });
  assert.deepEqual(await identity(), lockedIdentity);
  const structure = await client.tool("cad.project_structure");
  assert.deepEqual(
    structure.drawingLayers.find((item) => item.id === layer.id),
    locked
  );
  assert.deepEqual(structure.drawingEntities, [entity]);
  await client.tool(
    "cad.batch",
    batch([
      { op: "drawing.layer.update", layer },
      { op: "drawing.entity.update", entity: { ...entity, layerId: "0" } },
      { op: "drawing.layer.delete", id: layer.id },
      { op: "drawing.entity.delete", id: entity.id }
    ])
  );
  const cleaned = await client.tool("cad.project_structure");
  assert.equal(cleaned.drawingLayers.length, 1);
  assert.deepEqual(cleaned.drawingEntities, []);
  console.log(
    "Drawing layers MCP: schema, dry run, properties, assignment, locks, atomic rejection, native reopen and deletion passed"
  );
}
