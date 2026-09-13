import { URL } from "node:url";
import { writeFile } from "node:fs/promises";
import { buildOps, revisionOps, assemblyOps } from "./model.mjs";
const ids = assemblyOps
  .filter((op) => op.op === "assembly.instance.insert")
  .map((op) => op.id);
const structure = (teeth, angle) => ({
  bodyCount: 9,
  assemblies: [
    {
      id: "gearbox",
      instances: ids.map((id) => ({
        id,
        ...(id === "input_gear" || id === "input_shaft"
          ? {
              transform: {
                translation: [0, 0, id.endsWith("gear") ? 19 : 6],
                rotation: [0, 0, (angle * Math.PI) / 180]
              }
            }
          : id === "output_gear" || id === "output_shaft"
            ? {
                transform: {
                  translation: [
                    (1.5 * (20 + teeth)) / 2,
                    0,
                    id.endsWith("gear") ? 19 : 6
                  ],
                  rotation: [
                    0,
                    0,
                    ((180 / teeth - (angle * 20) / teeth) * Math.PI) / 180
                  ]
                }
              }
            : {})
      }))
    }
  ]
});
const viewport = {
  meshIds: ids.map((id) => `assembly-instance:gearbox:${id}`),
  primitiveCount: 0
};
const edit = (row, text) => [
  {
    click: `.pb-project-table tbody tr:nth-child(${row}) .pb-project-table-actions button:first-child`
  },
  { type: { selector: ".pb-project-parameter-form input[type=number]", text } },
  { click: ".pb-project-parameter-form button[type=submit]" }
];
const project = [
  { click: '[data-ribbon-roving-id="mode-project"]' },
  { click: '[data-action-id="project.parameters"]' }
];
const solid = [
  { click: '[data-ribbon-roving-id="mode-solid"]' },
  { click: 'button[title="Fit all objects"]' }
];
const use = [
  { openWcad: ".metrics/gearbox-workflow/gearbox-2to1.wcad" },
  ...solid,
  { expectViewport: viewport },
  { expectStructure: structure(40, 0) },
  { click: '[data-tree-select="feature:wheel_extrude"]' },
  { wait: '[data-tree-select="feature:wheel_extrude"][aria-selected="true"]' },
  { select: { selector: 'select[aria-label="Model view"]', value: "assembly" } },
  { expectViewport: viewport },
  { screenshot: "gearbox-workflow-initial" },
  ...project,
  ...edit(2, "60"),
  { waitReady: true },
  { expectStructure: structure(60, 0) },
  { click: 'button[aria-label="Undo"]' },
  { waitReady: true },
  { expectStructure: structure(40, 0) },
  { click: 'button[aria-label="Redo"]' },
  { waitReady: true },
  { expectStructure: structure(60, 0) },
  { beginExactStability: true },
  ...edit(1, "90"),
  { expectStructure: structure(60, 90) },
  { click: 'button[aria-label="Undo"]' },
  { expectStructure: structure(60, 0) },
  { click: 'button[aria-label="Redo"]' },
  { expectStructure: structure(60, 90) },
  { expectExactStability: true },
  ...solid,
  { expectViewport: viewport },
  { screenshot: "gearbox-workflow-motion" }
];
const useBreak = [
  { openWcad: ".metrics/gearbox-workflow/gearbox-2to1.wcad" },
  ...project,
  {
    click:
      ".pb-project-table tbody tr:first-child .pb-project-table-actions button:first-child"
  },
  {
    type: {
      selector: ".pb-project-parameter-form input[type=number]",
      text: ""
    }
  },
  { expectDisabled: ".pb-project-parameter-form button[type=submit]" },
  { expectStructure: structure(40, 0) },
  { screenshot: "gearbox-workflow-empty-angle" }
];
const browser = {
  id: "gearbox-native-workflow",
  kind: "cadops",
  seed: [],
  steps: [],
  use,
  useBreak
};
const queries = [
  {
    query: { query: "parameter.get", id: "output_teeth" },
    expect: { ok: true, parameter: { id: "output_teeth", value: 60 } }
  },
  {
    query: { query: "parameter.get", id: "center_distance" },
    expect: { ok: true, parameter: { value: 60 } }
  },
  {
    query: {
      query: "project.structure",
      projection: "poses",
      assemblyIds: ["gearbox"],
      instanceIds: ["output_gear"],
      limit: 1
    },
    expect: {
      ok: true,
      projection: "poses",
      totalInstanceCount: 1,
      instancePoses: [{ id: "output_gear", definition: { bodyId: "wheel" } }]
    }
  }
];
const scenario = {
  id: "gearbox-parametric-revision",
  kind: "cadops",
  seed: buildOps,
  steps: [
    {
      id: "single-parameter-ratio-revision",
      ops: revisionOps,
      expect: { ops: ["parameter.update"] },
      queries
    },
    {
      id: "drive-input",
      ops: [{ op: "parameter.update", id: "input_angle", value: 90 }],
      queries: [
        {
          query: { query: "parameter.get", id: "output_angle" },
          expect: { ok: true, parameter: { value: -27 } }
        }
      ]
    },
    {
      id: "invalid-tooth-count",
      ops: [{ op: "parameter.update", id: "output_teeth", value: 20.5 }],
      expect: { error: { code: "INVALID_FEATURE" } }
    },
    { id: "native-source-roundtrip", persistRoundTrip: true, queries }
  ],
  use: use.slice(1),
  useBreak: useBreak.slice(1)
};
await writeFile(
  new URL("./browser-use.json", import.meta.url),
  JSON.stringify(browser, null, 2) + "\n"
);
await writeFile(
  new URL("../../scenarios/gearbox-parametric-revision.json", import.meta.url),
  JSON.stringify(scenario, null, 2) + "\n"
);
