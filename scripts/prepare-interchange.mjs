// Fixture setup only; assertions live in the browser journey.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { register } from "node:module";
import { resolve } from "node:path";

register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);
const { createCadSession } =
  await import("../packages/cad-runtime/src/index.ts");
const output = resolve(import.meta.dirname, "../.metrics/editable-interchange");
const identity = {
  translation: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1]
};
const authored = [
  { op: "sketch.create", id: "pin_profile", name: "Pin profile", plane: "XY" },
  {
    op: "sketch.addCircle",
    sketchId: "pin_profile",
    id: "pin_circle",
    center: [0, 0],
    radius: 3
  },
  {
    op: "feature.extrude",
    id: "pin_extrude",
    name: "Pin definition",
    bodyId: "pin_body",
    sketchId: "pin_profile",
    entityId: "pin_circle",
    depth: 6
  },
  { op: "sketch.create", id: "pads_profile", name: "Twin pads", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "pads_profile",
    id: "pad_a",
    center: [-5, 0],
    width: 4,
    height: 6
  },
  {
    op: "feature.extrude",
    id: "pad_extrude",
    name: "Pad seed",
    bodyId: "pad_seed",
    sketchId: "pads_profile",
    entityId: "pad_a",
    depth: 2
  },
  {
    op: "feature.linearPattern",
    id: "pads_pattern",
    name: "Two-solid definition",
    bodyId: "pads_body",
    seedBodyId: "pad_seed",
    axis: "x",
    spacing: 10,
    instanceCount: 2
  },
  { op: "assembly.create", id: "fixture", name: "Fixture" },
  { op: "assembly.create", id: "module", name: "Module" },
  {
    op: "assembly.instance.insert",
    assemblyId: "module",
    id: "pin",
    name: "Pin",
    definition: { kind: "body", bodyId: "pin_body" },
    transform: identity,
    color: [0.8, 0.2, 0.1]
  },
  {
    op: "assembly.instance.insert",
    assemblyId: "module",
    id: "pads",
    name: "Twin pads",
    definition: { kind: "body", bodyId: "pads_body" },
    transform: { ...identity, translation: [0, 0, -2] },
    color: [0.2, 0.8, 0.3]
  },
  {
    op: "assembly.instance.insert",
    assemblyId: "fixture",
    id: "left",
    name: "Left module",
    definition: { kind: "assembly", assemblyId: "module" },
    transform: {
      ...identity,
      translation: [20, 0, 0],
      rotation: [0, 0, Math.PI / 2]
    }
  },
  {
    op: "assembly.instance.insert",
    assemblyId: "fixture",
    id: "right",
    name: "Right module",
    definition: { kind: "assembly", assemblyId: "module" },
    transform: {
      ...identity,
      translation: [-20, 10, 5],
      rotation: [Math.PI / 2, 0, 0]
    }
  }
];
const session = createCadSession();
try {
  await mkdir(output, { recursive: true });
  const result = await session.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      ...authored,
      { op: "feature.updateExtrude", id: "pin_extrude", depth: 8 }
    ]
  });
  assert.ok(result.ok, JSON.stringify(result));
  const step = await session.exportStep({ assemblyIds: ["fixture"] });
  await writeFile(resolve(output, "authored-nested.step"), step.bytes);
  console.log(`Browser interchange fixture: ${output}/authored-nested.step`);
} finally {
  await session.dispose();
}
