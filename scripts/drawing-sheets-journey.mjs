import { performance } from "node:perf_hooks";
import { isDeepStrictEqual } from "node:util";

export async function exerciseDrawingSheets(
  view,
  {
    getState,
    evaluate,
    delay,
    typeField,
    selectCollectorOption,
    clickVisibleControl,
    writeUseScreenshot,
    saveProjectFile,
    withDeadline,
    waitForHook,
    openProjectFile
  }
) {
  const expect = (condition, message) => {
    if (!condition) throw new Error("Drawing sheets: " + message);
  };
  const settle = async (predicate) => {
    const deadline = performance.now() + 10000;
    while (performance.now() < deadline) {
      const state = await getState(view);
      if (state.commandError) throw new Error(state.commandError);
      if (!state.commandPending && predicate(state.drawing))
        return state.drawing;
      await delay(30);
    }
    throw new Error("Drawing sheets did not settle");
  };
  const field = async (label, value) =>
    typeField(view, `input[aria-label="${label}"]`, String(value));
  const select = async (label, option) =>
    selectCollectorOption(view, {
      selector: `select[aria-label="${label}"]`,
      option
    });
  const apply = () => clickVisibleControl(view, "[data-sheet-apply]");
  const original = (await getState(view)).drawing;
  await clickVisibleControl(view, "[data-sheet-new]");
  await settle((d) => d.sheets.length === 1);
  await field("Sheet name", "Assembly plan");
  await select("Paper size", "A3");
  await field("Margin left", 15);
  await clickVisibleControl(view, "[data-sheet-add-viewport]");
  await field("Viewport name", "Overview");
  await field("Viewport paper width", 180);
  await field("Viewport paper height", 120);
  await field("Viewport center X", 12.5);
  await field("Viewport center Y", -3.25);
  await field("Viewport model width", 100);
  await field("Viewport model height", 80);
  await apply();
  const plan = await settle((d) => d.sheets[0]?.viewports.length === 1);
  expect(
    plan.sheets[0].paper.width === 297 &&
      plan.sheets[0].paper.height === 420 &&
      plan.sheets[0].orientation === "landscape" &&
      plan.sheets[0].margins.left === 15 &&
      isDeepStrictEqual(plan.sheets[0].viewports[0].model, {
        center: [12.5, -3.25],
        width: 100,
        height: 80
      }),
    "physical paper settings"
  );
  expect(
    (await evaluate(
      view,
      'document.querySelectorAll("[data-sheet-viewport] [data-sheet-entity]").length'
    )) === original.entities.length,
    "viewport must display model geometry"
  );
  await clickVisibleControl(view, "[data-sheet-add-viewport]");
  await field("Viewport name", "Detail");
  await field("Viewport paper x", 220);
  await field("Viewport paper width", 180);
  await field("Viewport paper height", 120);
  await apply();
  await settle((d) => d.sheets[0]?.viewports.length === 2);
  await clickVisibleControl(view, "[data-sheet-new]");
  await settle((d) => d.sheets.length === 2);
  await field("Sheet name", "Detail sheet");
  await select("Sheet orientation", "portrait");
  await field("Paper width", 230);
  await field("Paper height", 310);
  await field("Margin top", 20);
  await clickVisibleControl(view, "[data-sheet-add-viewport]");
  await apply();
  const configured = await settle((d) => d.sheets[1]?.name === "Detail sheet");
  expect(
    configured.sheets[1].orientation === "portrait" &&
      configured.sheets[1].margins.top === 20 &&
      configured.sheets[1].paper.width === 230 &&
      configured.sheets[1].paper.height === 310,
    "second sheet orientation/margins"
  );
  await field("Margin left", 999);
  expect(
    await evaluate(
      view,
      'document.querySelector("[data-sheet-apply]").disabled'
    ),
    "invalid margins must block Apply"
  );
  expect(
    isDeepStrictEqual((await getState(view)).drawing, configured),
    "invalid margin changed source/history"
  );
  await writeUseScreenshot(view, "drawing-sheet-invalid-margin");
  await field("Margin left", 10);
  await field("Sheet name", "Assembly plan");
  expect(
    await evaluate(
      view,
      'document.querySelector("[data-sheet-apply]").disabled'
    ),
    "duplicate sheet name must block Apply"
  );
  await field("Sheet name", "Detail sheet");
  await clickVisibleControl(view, "[data-sheet-delete]");
  await settle((d) => d.sheets.length === 1);
  await clickVisibleControl(view, 'button[aria-label="Undo"]');
  const restored = await settle((d) => d.sheets.length === 2);
  expect(
    isDeepStrictEqual(restored.sheets, configured.sheets),
    "Undo restores sheet and viewport IDs"
  );
  const file = ".metrics/editable-interchange/sheets.wcad";
  await saveProjectFile(view, file);
  await withDeadline(
    view.navigate(await evaluate(view, "location.href")),
    60000,
    "reload sheets"
  );
  await waitForHook(view);
  await openProjectFile(view, file);
  await clickVisibleControl(view, '[data-ribbon-roving-id="mode-drawing"]');
  const reopened = await settle((d) => d.sheets.length === 2);
  expect(
    isDeepStrictEqual(reopened, restored),
    "native reopen changed sheets, windows, geometry or history"
  );
  await clickVisibleControl(view, 'button[aria-label="Redo"]');
  await settle((d) => d.sheets.length === 1);
  await clickVisibleControl(view, 'button[aria-label="Undo"]');
  await settle((d) => d.sheets.length === 2);
  await clickVisibleControl(
    view,
    `[data-sheet-tab="${configured.sheets[0].id}"]`
  );
  expect(
    (await evaluate(
      view,
      'document.querySelectorAll("[data-sheet-viewport]").length'
    )) === 2,
    "reopened named sheet renders both persistent viewports"
  );
  await writeUseScreenshot(view, "drawing-sheet-reopened");
  await clickVisibleControl(view, "[data-sheet-model]");
  const line = original.entities.find((entity) => entity.kind === "line");
  await clickVisibleControl(view, `[data-drawing-select="${line.id}"]`);
  await typeField(view, '[data-drawing-field="endX"]', String(line.end[0] + 5));
  await clickVisibleControl(view, "[data-drawing-apply]");
  await settle(
    (d) =>
      d.entities.find((entity) => entity.id === line.id).end[0] ===
      line.end[0] + 5
  );
  await clickVisibleControl(
    view,
    `[data-sheet-tab="${configured.sheets[0].id}"]`
  );
  expect(
    (await evaluate(
      view,
      `document.querySelector('[data-sheet-entity="${line.id}"] line').getAttribute("x2")`
    )) === String(line.end[0] + 5),
    "sheet viewport must update from live model edits"
  );
  await clickVisibleControl(view, 'button[aria-label="Undo"]');
  await settle(
    (d) =>
      d.entities.find((entity) => entity.id === line.id).end[0] === line.end[0]
  );
  await clickVisibleControl(view, "[data-sheet-model]");
  await select("Drawing units", "cm");
  const converted = await settle((d) => d.units === "cm");
  expect(
    isDeepStrictEqual(converted.sheets[0].paper, configured.sheets[0].paper) &&
      converted.sheets[0].viewports[0].model.width === 10,
    "unit conversion must preserve physical paper and model window"
  );
  await clickVisibleControl(view, 'button[aria-label="Undo"]');
  const back = await settle((d) => d.units === original.units);
  expect(
    isDeepStrictEqual(back.sheets, configured.sheets) &&
      isDeepStrictEqual(back.entities, original.entities),
    "unit Undo restores original source exactly"
  );
  // Annotation is the same source entity in model space and every paper viewport.
  await clickVisibleControl(view, `[data-drawing-select="${line.id}"]`);
  await clickVisibleControl(view, '[data-drawing-tool="dimension"]');
  await select("Dimension type", "aligned");
  await clickVisibleControl(view, "[data-dimension-apply]");
  const annotated = await settle(
    (d) => d.entities.length === original.entities.length + 1
  );
  const dimension = annotated.entities.at(-1);
  await clickVisibleControl(
    view,
    `[data-sheet-tab="${configured.sheets[0].id}"]`
  );
  const labels = await evaluate(
    view,
    `Array.from(document.querySelectorAll('[data-sheet-viewport] [data-drawing-dimension="${dimension.id}"]')).map(g=>({value:Number(g.dataset.dimensionValue),label:g.textContent}))`
  );
  const expectedLength = Math.hypot(
    line.end[0] - line.start[0],
    line.end[1] - line.start[1]
  );
  expect(
    labels.length === 2 &&
      labels.every(
        (label) =>
          Math.abs(label.value - expectedLength) < 1e-9 &&
          label.label.includes(original.units)
      ),
    "all model windows render the live associative dimension"
  );
  await writeUseScreenshot(view, "drawing-sheet-dimension");
  await clickVisibleControl(view, "[data-sheet-model]");
  await select("Layer properties", "0");
  await field("Layer color", "#aa3366");
  await select("Layer linetype", "dashed");
  await field("Layer lineweight", 0.7);
  await field("Layer transparency", 25);
  await clickVisibleControl(view, 'input[aria-label="Layer print"]');
  await clickVisibleControl(view, "[data-layer-apply]");
  await settle(
    (d) => d.layers.find((layer) => layer.id === "0").color === "#aa3366"
  );
  await clickVisibleControl(
    view,
    `[data-sheet-tab="${configured.sheets[0].id}"]`
  );
  const appearance = await evaluate(
    view,
    `(() => {const g=document.querySelector('[data-sheet-entity="${line.id}"]');const text=document.querySelector('[data-sheet-entity="${dimension.id}"] text');return {stroke:g.getAttribute("stroke"),weight:Number(g.getAttribute("stroke-width")),dash:g.getAttribute("stroke-dasharray"),opacity:Number(g.getAttribute("opacity")),fill:getComputedStyle(text).fill};})()`
  );
  expect(
    appearance.stroke === "#aa3366" &&
      Math.abs(appearance.weight - (0.7 * 96) / 25.4) < 1e-10 &&
      appearance.dash === "10 5" &&
      appearance.opacity === 0.75 &&
      appearance.fill === "rgb(170, 51, 102)",
    "sheet geometry and dimension labels must inherit layer appearance"
  );
  await view.cdp("Emulation.setEmulatedMedia", { media: "print" });
  expect(
    await evaluate(
      view,
      'Array.from(document.querySelectorAll("[data-sheet-entity]")).every(g=>getComputedStyle(g).display==="none")'
    ),
    "nonprinting layers must be suppressed on paper output"
  );
  await view.cdp("Emulation.setEmulatedMedia", { media: "" });
  await clickVisibleControl(view, "[data-sheet-model]");
  await clickVisibleControl(view, 'input[aria-label="Layer visible"]');
  await clickVisibleControl(view, "[data-layer-apply]");
  await settle((d) => !d.layers.find((layer) => layer.id === "0").visible);
  await clickVisibleControl(
    view,
    `[data-sheet-tab="${configured.sheets[0].id}"]`
  );
  expect(
    (await evaluate(
      view,
      'document.querySelectorAll("[data-sheet-entity]").length'
    )) === 0,
    "hidden layers must disappear from every sheet viewport"
  );
  await clickVisibleControl(view, 'button[aria-label="Undo"]');
  await settle((d) => d.layers.find((layer) => layer.id === "0").visible);
  await clickVisibleControl(view, 'button[aria-label="Undo"]');
  await settle((d) => isDeepStrictEqual(d.layers, original.layers));
  await clickVisibleControl(view, 'button[aria-label="Undo"]');
  await settle((d) => d.entities.length === original.entities.length);
  await clickVisibleControl(view, "[data-sheet-model]");
  console.log(
    "Drawing sheets: multiple named physical sheets, editable persistent viewports, visibility, invalid margins/name, units, history and native reopen passed"
  );
}
