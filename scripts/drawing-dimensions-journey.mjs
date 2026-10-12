import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";

// Extends the shared real-browser interchange journey; all writes use UI controls.
export async function exerciseDrawingDimensions(view, h) {
  const {
    evaluate,
    getState,
    delay,
    clickVisibleControl: click,
    typeField: type,
    selectCollectorOption: select,
    saveProjectFile: save,
    openProjectFile: open,
    waitForHook,
    writeUseScreenshot: screenshot
  } = h;
  const initial = (await getState(view)).drawing.entities;
  const settle = async (predicate) => {
    for (let i = 0; i < 200; i++) {
      const state = await getState(view);
      if (state.commandError) throw new Error(state.commandError);
      if (!state.commandPending && predicate(state.drawing))
        return state.drawing;
      await delay(40);
    }
    throw new Error("Dimension drawing did not settle");
  };
  const control = async (selector) => click(view, selector);
  const field = async (label, value) =>
    type(view, `[aria-label="${label}"]`, value);
  const choose = async (tool) => control(`[data-drawing-tool="${tool}"]`);
  const pick = async (id) => control(`[data-drawing-select="${id}"]`);
  const measurement = async (id, value) => {
    let result;
    const deadline = performance.now() + 10_000;
    do {
      result = await evaluate(
        view,
        `(() => {const g=document.querySelector('[data-drawing-dimension="${id}"]'); return g && {value:Number(g.dataset.dimensionValue),text:g.textContent};})()`
      );
      if (result && Math.abs(result.value - value) < 1e-9) break;
      await delay(40);
    } while (performance.now() < deadline);
    assert.ok(result, `Dimension ${id} is visible`);
    assert.ok(
      Math.abs(result.value - value) < 1e-9,
      `Visible dimension ${result.value} equals ${value}`
    );
    assert.ok(result.text.includes("mm"), "Visible dimension includes units");
  };
  await choose("line");
  await type(view, "[data-drawing-coordinate]", "-50,-25");
  await view.press("Enter");
  await type(view, "[data-drawing-coordinate]", "-10,5");
  await view.press("Enter");
  const line = (
    await settle((d) => d.entities.length === initial.length + 1)
  ).entities.at(-1);
  const dimensions = [];
  for (const [kind, value, x, y] of [
    ["aligned", 50, -30, 20],
    ["horizontal", 40, -30, -40],
    ["vertical", 30, 5, -10]
  ]) {
    await pick(line.id);
    await choose("dimension");
    await select(view, {
      selector: 'select[aria-label="Dimension type"]',
      option: kind
    });
    await field("Dimension label X", String(x));
    await field("Dimension label Y", String(y));
    await control("[data-dimension-apply]");
    const dimension = (
      await settle(
        (d) => d.entities.length === initial.length + dimensions.length + 2
      )
    ).entities.at(-1);
    assert.equal(dimension.dimensionType, kind);
    assert.equal(dimension.first.entityId, line.id);
    assert.equal(dimension.second.entityId, line.id);
    dimensions.push(dimension);
    await measurement(dimension.id, value);
  }
  // Placement uses native canvas click and Apply, then survives source edits.
  await pick(dimensions[0].id);
  await control("[data-dimension-place]");
  const position = await evaluate(
    view,
    "(() => {const p=new DOMPoint(-25,-25).matrixTransform(document.querySelector('svg[aria-label=\"2D drawing canvas\"]').getScreenCTM());return {x:p.x,y:p.y};})()"
  );
  await view.click(position.x, position.y);
  await control("[data-dimension-apply]");
  const placed = await settle(
    (d) => d.entities.find((e) => e.id === dimensions[0].id).placement[1] === 25
  );
  dimensions[0] = placed.entities.find((e) => e.id === dimensions[0].id);
  await pick(line.id);
  await type(view, '[data-drawing-field="endX"]', "-20");
  await type(view, '[data-drawing-field="endY"]', "15");
  await control("[data-drawing-apply]");
  await settle((d) => d.entities.find((e) => e.id === line.id).end[0] === -20);
  for (const [i, value] of [50, 30, 40].entries())
    await measurement(dimensions[i].id, value);
  assert.deepEqual(
    (await getState(view)).drawing.entities.filter(
      (e) => e.kind === "dimension"
    ),
    dimensions,
    "Geometry edits preserve dimension refs and placement"
  );
  await control('button[aria-label="Undo"]');
  await settle((d) => d.entities.find((e) => e.id === line.id).end[0] === -10);
  await measurement(dimensions[1].id, 40);
  await control('button[aria-label="Redo"]');
  await settle((d) => d.entities.find((e) => e.id === line.id).end[0] === -20);
  await measurement(dimensions[1].id, 30);
  // The rendered label is a selectable part of the dimension, not only a list row.
  const labelCenter = await evaluate(
    view,
    `(() => {const r=document.querySelector('[data-drawing-dimension="${dimensions[1].id}"] text').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`
  );
  await view.click(labelCenter.x, labelCenter.y);
  assert.equal(
    await evaluate(view, '!!document.querySelector("[data-dimension-apply]")'),
    true
  );
  await select(view, {
    selector: 'select[aria-label="Dimension type"]',
    option: "vertical"
  });
  await control("[data-dimension-apply]");
  await settle(
    (d) =>
      d.entities.find((e) => e.id === dimensions[1].id).dimensionType ===
      "vertical"
  );
  await measurement(dimensions[1].id, 40);
  await select(view, {
    selector: 'select[aria-label="Dimension type"]',
    option: "horizontal"
  });
  await control("[data-dimension-apply]");
  await settle(
    (d) =>
      d.entities.find((e) => e.id === dimensions[1].id).dimensionType ===
      "horizontal"
  );
  await measurement(dimensions[1].id, 30);
  const beforeInvalid = (await getState(view)).drawing;
  await field("Dimension label X", "");
  assert.equal(
    await evaluate(
      view,
      'document.querySelector("[data-dimension-apply]").disabled'
    ),
    true,
    "Empty label position is blocked"
  );
  assert.deepEqual(
    (await getState(view)).drawing,
    beforeInvalid,
    "Rejected input preserves history/source"
  );
  await screenshot(view, "drawing-dimensions-invalid");
  await field("Dimension label X", "-30");
  const nativeFile = ".metrics/editable-interchange/dimensions.wcad";
  const beforeSave = (await getState(view)).drawing;
  await save(view, nativeFile);
  await view.navigate(await evaluate(view, "location.href"));
  await waitForHook(view);
  await open(view, nativeFile);
  await control('[data-ribbon-roving-id="mode-drawing"]');
  const reopened = await settle(
    (d) => d.entities.length === beforeSave.entities.length
  );
  assert.deepEqual(
    reopened,
    beforeSave,
    "Native round trip preserves references, placement and history"
  );
  for (const [i, value] of [50, 30, 40].entries())
    await measurement(dimensions[i].id, value);
  await select(view, {
    selector: 'select[aria-label="Drawing units"]',
    option: "cm"
  });
  const cm = await settle((d) => d.units === "cm");
  assert.deepEqual(
    cm.entities.find((e) => e.id === dimensions[0].id).placement,
    dimensions[0].placement.map((n) => n / 10)
  );
  await control('button[aria-label="Undo"]');
  await settle((d) => d.units === "mm");
  await pick(dimensions[2].id);
  await control("[data-drawing-delete]");
  await settle((d) => d.entities.length === beforeSave.entities.length - 1);
  await control('button[aria-label="Undo"]');
  await settle((d) => d.entities.length === beforeSave.entities.length);
  await measurement(dimensions[2].id, 40);
  await screenshot(view, "drawing-dimensions-reopened");
  // Clean up the added fixture through ordinary delete controls.
  for (const dimension of dimensions) {
    await pick(dimension.id);
    await control("[data-drawing-delete]");
    await settle((d) => !d.entities.some((e) => e.id === dimension.id));
  }
  await pick(line.id);
  await control("[data-drawing-delete]");
  assert.deepEqual(
    (await settle((d) => d.entities.length === initial.length)).entities,
    initial
  );
  console.log(
    "Associative dimensions: aligned/horizontal/vertical, canvas placement, edits, rejection, history, units, native reopen and delete passed"
  );
}

export async function exerciseMcpDrawingDimensions(client, batch) {
  assert.ok(
    JSON.stringify(
      await client.tool("cad.operation_schema", {
        operation: "drawing.entity.create"
      })
    ).includes("dimensionType"),
    "Dimension variant is discoverable through public schema"
  );
  const dimensions = ["aligned", "horizontal", "vertical"].map(
    (dimensionType) => ({
      id: `dimension_mcp_${dimensionType}`,
      kind: "dimension",
      dimensionType,
      first: { entityId: "drawing_mcp_line", point: "start" },
      second: { entityId: "drawing_mcp_line", point: "end" },
      placement: [15, 25]
    })
  );
  const create = dimensions.map((entity) => ({
    op: "drawing.entity.create",
    entity
  }));
  const original = (await client.tool("cad.session_info")).result
    .sourceIdentity;
  const dry = await client.tool("cad.batch", batch(create, "dryRun"));
  assert.deepEqual(dry.semanticDiff.drawing.created, dimensions);
  assert.deepEqual(
    (await client.tool("cad.session_info")).result.sourceIdentity,
    original
  );
  await client.tool("cad.batch", batch(create));
  const identity = (await client.tool("cad.session_info")).result
    .sourceIdentity;
  for (const ops of [
    [{ op: "drawing.entity.delete", id: "drawing_mcp_line" }],
    [
      {
        op: "drawing.entity.update",
        entity: { ...dimensions[0], placement: [1, 2] }
      },
      {
        op: "drawing.entity.create",
        entity: {
          ...dimensions[0],
          id: "invalid_dimension",
          first: { entityId: "missing", point: "start" }
        }
      }
    ]
  ]) {
    await client.tool("cad.batch", batch(ops), { expectError: true });
    assert.deepEqual(
      (await client.tool("cad.session_info")).result.sourceIdentity,
      identity
    );
  }
  await client.tool(
    "cad.batch",
    batch([
      {
        op: "drawing.entity.update",
        entity: {
          id: "drawing_mcp_line",
          kind: "line",
          start: [0, 0],
          end: [60, 80]
        }
      }
    ])
  );
  const edited = await client.tool("cad.project_structure");
  assert.deepEqual(
    edited.drawingMeasurements.map((d) => d.value),
    [100, 60, 80]
  );
  assert.deepEqual(
    edited.drawingEntities.filter((e) => e.kind === "dimension"),
    dimensions
  );
  dimensions[0] = { ...dimensions[0], placement: [25, 35] };
  await client.tool(
    "cad.batch",
    batch([
      { op: "drawing.entity.update", entity: dimensions[0] },
      {
        op: "drawing.entity.update",
        entity: {
          id: "drawing_mcp_line",
          kind: "line",
          start: [0, 0],
          end: [30, 10]
        }
      }
    ])
  );
  return dimensions;
}
