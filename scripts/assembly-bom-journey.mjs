import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const browserBomEvidence = new WeakMap();

export async function exerciseAssemblyBomBrowser(
  view,
  phase,
  {
    evaluate,
    clickVisibleControl,
    typeField,
    selectOption,
    getState,
    waitForReady,
    writeUseScreenshot
  }
) {
  await clickVisibleControl(view, '[data-ribbon-roving-id="mode-solid"]');
  await clickVisibleControl(view, '[data-action-id="assembly.bom"]');
  const rows = () =>
    evaluate(
      view,
      `Array.from(document.querySelectorAll('tr[data-bom-definition]')).map(row=>({key:row.dataset.bomDefinition,item:Number(row.dataset.bomItem),quantity:Number(row.dataset.bomQuantity),total:Number(row.dataset.bomTotal),text:row.textContent}))`
    );
  const waitForRows = async (predicate, message) => {
    const deadline = Date.now() + 5_000;
    let current;
    do {
      current = await rows();
      if (predicate(current)) return current;
      await delay(25);
    } while (Date.now() < deadline);
    assert.fail(`${message}: ${JSON.stringify(current)}`);
  };
  const hierarchical = await waitForRows(
    (current) => current.length > 0,
    "BOM rows become visible"
  );
  assert.ok(
    hierarchical.some((row) => row.key.startsWith("assembly:")),
    "Nested assemblies appear in hierarchical BOM"
  );
  await selectOption(view, 'select[aria-label="BOM view"]', "flattened");
  const flat = await waitForRows(
    (current) =>
      current.length === (phase === "initial" ? 2 : 3) &&
      current.every((row) => row.key.startsWith("body:")),
    "Flattened BOM becomes visible"
  );
  assert.equal(
    flat.reduce((sum, row) => sum + row.quantity, 0),
    4,
    "Nested quantities count four part occurrences, not solid count"
  );
  assert.ok(flat.every((row) => row.key.startsWith("body:")));
  if (phase === "initial") {
    assert.equal(flat.length, 2);
    assert.deepEqual(
      flat.map((row) => row.quantity),
      [2, 2]
    );
    const first = flat[0];
    browserBomEvidence.set(view, { itemNumber: first.item });
    await clickVisibleControl(
      view,
      `tr[data-bom-definition=${JSON.stringify(first.key)}] button`
    );
    assert.equal(
      await evaluate(
        view,
        "document.querySelector('[data-bom-save]').disabled"
      ),
      true,
      "Unchanged metadata is blocked"
    );
    await typeField(view, 'input[aria-label="BOM part number"]', "PB-100");
    await typeField(
      view,
      'input[aria-label="BOM description"]',
      'Bracket, "precision"'
    );
    await typeField(view, 'input[aria-label="BOM material"]', "Aluminium 6061");
    await clickVisibleControl(view, "[data-bom-save]");
    await waitForReady(view);
    const saved = await waitForRows(
      (current) =>
        current.find((row) => row.key === first.key)?.text.includes("PB-100"),
      "Saved part metadata becomes visible"
    );
    assert.ok(
      saved.find((row) => row.key === first.key).text.includes("PB-100")
    );
    await writeUseScreenshot(view, "assembly-bom");
    await clickVisibleControl(
      view,
      'button[aria-label="Close bill of materials"]'
    );
    await clickVisibleControl(view, 'button[aria-label="Undo"]');
    await waitForReady(view);
    assert.ok(
      !((await getState(view)).structureQuery.bomCatalog?.entries ?? []).some(
        (entry) => entry.partNumber === "PB-100"
      )
    );
    await clickVisibleControl(view, 'button[aria-label="Redo"]');
    await waitForReady(view);
    await clickVisibleControl(view, '[data-action-id="assembly.bom"]');
    await selectOption(view, 'select[aria-label="BOM view"]', "flattened");
  } else {
    assert.equal(
      flat.length,
      3,
      "Independent occurrence becomes a separate BOM item"
    );
    assert.deepEqual(flat.map((row) => row.quantity).sort(), [1, 1, 2]);
    const catalog = (await getState(view)).structureQuery.bomCatalog;
    const metadata = catalog.entries.find(
      (entry) => entry.partNumber === "PB-100"
    );
    assert.ok(
      metadata,
      "Part metadata survives assembly edits and native reopen"
    );
    assert.equal(
      metadata.itemNumber,
      browserBomEvidence.get(view)?.itemNumber,
      "Original item number survives independent occurrence edits and native reopen"
    );
    const match = flat.find((row) => row.item === metadata.itemNumber);
    assert.ok(match);
    assert.ok(match.text.includes('Bracket, "precision"'));
  }
  // Supply a save picker, exercise the real export button, then inspect actual CSV.
  await evaluate(
    view,
    `(() => { window.__pbBomSavePicker=window.showSaveFilePicker;window.__pbBomCsv=undefined;window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async text=>{window.__pbBomCsv=text},close:async()=>{}})}); return true; })()`
  );
  try {
    await clickVisibleControl(view, "[data-bom-export]");
    const csv = await evaluate(view, "window.__pbBomCsv");
    assert.ok(csv.startsWith('"Item","Level","Parent item"'));
    assert.ok(csv.includes('"PB-100"'));
    assert.ok(csv.includes('"Bracket, ""precision"""'));
    assert.equal(csv.trim().split("\r\n").length, phase === "initial" ? 3 : 4);
  } finally {
    await evaluate(
      view,
      "(() => { window.showSaveFilePicker=window.__pbBomSavePicker;delete window.__pbBomSavePicker;delete window.__pbBomCsv; return true; })()"
    );
  }
  await clickVisibleControl(
    view,
    'button[aria-label="Close bill of materials"]'
  );
  console.log("Assembly BOM browser", phase, "passed");
}

export async function exerciseAssemblyBomMcp(client, fixture, batch) {
  const bodyId = fixture.bodyIds[0];
  const create = [
    { op: "assembly.create", id: "bom_child", name: "BOM subassembly" },
    {
      op: "assembly.instance.insert",
      assemblyId: "bom_child",
      id: "bom_part_a",
      definition: { kind: "body", bodyId }
    },
    {
      op: "assembly.instance.insert",
      assemblyId: "bom_child",
      id: "bom_part_b",
      definition: { kind: "body", bodyId }
    },
    { op: "assembly.create", id: "bom_root", name: "BOM root" },
    {
      op: "assembly.instance.insert",
      assemblyId: "bom_root",
      id: "bom_left",
      definition: { kind: "assembly", assemblyId: "bom_child" }
    },
    {
      op: "assembly.instance.insert",
      assemblyId: "bom_root",
      id: "bom_right",
      definition: { kind: "assembly", assemblyId: "bom_child" }
    }
  ];
  await client.tool("cad.batch", batch(create));
  const bom = async (mode = "flattened") =>
    (
      await client.tool("cad.project_structure", {
        projection: "bom",
        assemblyIds: ["bom_root"],
        bomMode: mode
      })
    ).billOfMaterials;
  const before = await bom();
  assert.equal(before.rows.length, 1);
  assert.equal(before.rows[0].quantity, 4);
  const hierarchical = await bom("hierarchical");
  assert.deepEqual(
    hierarchical.rows.map((row) => [row.quantity, row.totalQuantity]),
    [
      [2, 2],
      [2, 4]
    ]
  );
  const definition = { kind: "body", bodyId };
  const op = {
    op: "assembly.bom.updateItem",
    definition,
    metadata: {
      partNumber: "MCP-42",
      description: 'Part, "machined"',
      material: "Steel"
    }
  };
  await client.tool("cad.operation_schema", { operation: op.op });
  const dry = await client.tool("cad.batch", batch([op], "dryRun"));
  assert.equal(dry.semanticDiff.bom.modified[0].partNumber, "MCP-42");
  assert.equal((await bom()).rows[0].partNumber, "");
  await client.tool("cad.batch", batch([op]));
  const state = (await client.tool("cad.session_info")).result.sourceIdentity;
  await client.tool(
    "cad.batch",
    batch([
      op,
      { ...op, definition: { kind: "body", bodyId: "missing_bom_body" } }
    ]),
    { expectError: true }
  );
  assert.deepEqual(
    (await client.tool("cad.session_info")).result.sourceIdentity,
    state,
    "Rejected metadata batch is atomic"
  );
  await client.tool(
    "cad.batch",
    batch([{ ...op, metadata: { ...op.metadata, material: "x".repeat(501) } }]),
    { expectError: true }
  );
  await client.tool(
    "cad.batch",
    batch([
      {
        op: "assembly.instance.delete",
        assemblyId: "bom_root",
        instanceId: "bom_right"
      }
    ])
  );
  const after = await bom();
  assert.equal(after.rows[0].quantity, 2);
  assert.equal(after.rows[0].itemNumber, before.rows[0].itemNumber);
  assert.equal(after.rows[0].partNumber, "MCP-42");
  await client.tool(
    "cad.batch",
    batch([
      {
        op: "assembly.instance.insert",
        assemblyId: "bom_root",
        id: "bom_right_new",
        definition: { kind: "assembly", assemblyId: "bom_child" }
      }
    ])
  );
  await client.tool(
    "cad.project_structure",
    { projection: "bom", assemblyIds: ["missing"] },
    { expectError: true }
  );
  return { itemNumber: before.rows[0].itemNumber, bodyId };
}

export async function assertAssemblyBomReopened(client, expected) {
  const result = await client.tool("cad.project_structure", {
    projection: "bom",
    assemblyIds: ["bom_root"],
    bomMode: "flattened"
  });
  assert.equal(result.billOfMaterials.rows.length, 1);
  const row = result.billOfMaterials.rows[0];
  assert.equal(row.itemNumber, expected.itemNumber);
  assert.equal(row.quantity, 4);
  assert.equal(row.partNumber, "MCP-42");
  assert.equal(row.material, "Steel");
}
