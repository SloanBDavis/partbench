import { describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CadEngine,
  createCadDocument,
  flattenAssemblyOccurrences,
  resolveAssemblyOccurrence,
  assemblyTransformToMatrix
} from "@web-cad/cad-core";
import type { CadOp, DocumentUnits, Vec3 } from "@web-cad/cad-protocol";
import { createCadSession, type CadSession } from "./index";

const batch = (ops: readonly CadOp[]) => ({
  version: "cadops.v1" as const,
  mode: "commit" as const,
  ops
});
const identity = {
  translation: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1]
} as const;
async function writeFixture(name: string, bytes: Uint8Array | string) {
  const directory = process.env.PARTBENCH_INTERCHANGE_ARTIFACT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, name), bytes);
}
function sessionIn(units: DocumentUnits) {
  return createCadSession({
    project: new CadEngine(createCadDocument([], units)).exportProject()
  });
}
async function mass(session: CadSession, bodyId: string) {
  const response = await session.query({
    requestId: "mass",
    adapterVersion: "web-cad.agent-adapter.v1",
    query: {
      version: "cadops.v1",
      query: { query: "body.massProperties", bodyId }
    }
  });
  if (
    !response.ok ||
    response.query !== "body.massProperties" ||
    !response.massProperties
  )
    throw new Error(JSON.stringify(response));
  return response.massProperties;
}
async function placedGeometry(session: CadSession) {
  const scale = { mm: 1, cm: 10, m: 1000, in: 25.4 }[
    session.getSessionInfo().units
  ];
  const evidence = await session.getCurrentExactEvidence();
  const metadata = new Map(
    evidence.derivedExactMetadata.map((entry) => [entry.bodyId, entry.metadata])
  );
  return flattenAssemblyOccurrences(
    session.engine.createSnapshot().assemblies ?? []
  )
    .map((occurrence) => {
      const exact = metadata.get(occurrence.bodyId);
      if (!exact?.bounds || exact.volume === undefined)
        throw new Error(`Missing exact body metadata: ${occurrence.bodyId}`);
      const matrix = assemblyTransformToMatrix(occurrence.transform);
      const corners: Vec3[] = [];
      for (const x of [exact.bounds.min[0], exact.bounds.max[0]])
        for (const y of [exact.bounds.min[1], exact.bounds.max[1]])
          for (const z of [exact.bounds.min[2], exact.bounds.max[2]])
            corners.push([
              (matrix[0] * x + matrix[1] * y + matrix[2] * z + matrix[3]) *
                scale,
              (matrix[4] * x + matrix[5] * y + matrix[6] * z + matrix[7]) *
                scale,
              (matrix[8] * x + matrix[9] * y + matrix[10] * z + matrix[11]) *
                scale
            ]);
      return {
        name: occurrence.name,
        color: occurrence.color,
        volume: exact.volume * scale ** 3,
        solidCount: exact.topologyCounts?.solidCount,
        min: [0, 1, 2].map((axis) => Math.min(...corners.map((p) => p[axis]!))),
        max: [0, 1, 2].map((axis) => Math.max(...corners.map((p) => p[axis]!)))
      };
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.min[0]! - b.min[0]! ||
        a.min[1]! - b.min[1]!
    );
}
function sameGeometry(
  actual: Awaited<ReturnType<typeof placedGeometry>>,
  expected: Awaited<ReturnType<typeof placedGeometry>>
) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((item, index) => {
    const source = expected[index]!;
    expect(item.name).toBe(source.name);
    expect(item.solidCount).toBe(source.solidCount);
    expect(item.volume).toBeCloseTo(source.volume, 5);
    item.min.forEach((value, axis) =>
      expect(value).toBeCloseTo(source.min[axis]!, 5)
    );
    item.max.forEach((value, axis) =>
      expect(value).toBeCloseTo(source.max[axis]!, 5)
    );
    expect(item.color?.length).toBe(source.color?.length);
    item.color?.forEach((value, channel) =>
      expect(value).toBeCloseTo(source.color![channel]!, 5)
    );
  });
}
const authored: readonly CadOp[] = [
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

describe("editable interchange through the shared session", () => {
  it("round-trips repeated nested/multi-solid geometry, isolates one occurrence, edits it, and reopens in different units", async () => {
    const source = createCadSession(),
      imported = createCadSession(),
      native = createCadSession(),
      inches = sessionIn("in");
    try {
      const created = await source.executeBatch(batch(authored));
      expect(created, JSON.stringify(created)).toMatchObject({
        ok: true
      });
      expect(
        (await placedGeometry(source)).map((part) => part.solidCount)
      ).toEqual([1, 1, 2, 2]);
      const warmBuilds = source.getSessionInfo().geometry.artifactBuilds;
      await mass(source, "pin_body");
      await mass(source, "pads_body");
      expect(source.getSessionInfo().geometry.artifactBuilds).toBe(warmBuilds);
      expect(
        await source.executeBatch(
          batch([{ op: "feature.updateExtrude", id: "pin_extrude", depth: 8 }])
        )
      ).toMatchObject({ ok: true });
      expect(source.getSessionInfo().geometry.artifactBuilds).toBe(
        warmBuilds + 1
      );
      const beforeExport = await placedGeometry(source);
      expect(beforeExport.map((item) => item.color)).toEqual([
        [0.8, 0.2, 0.1],
        [0.8, 0.2, 0.1],
        [0.2, 0.8, 0.3],
        [0.2, 0.8, 0.3]
      ]);
      expect(
        beforeExport
          .filter((item) => item.name === "Pin")
          .every((item) => Math.abs(item.volume - Math.PI * 9 * 8) < 1e-6)
      ).toBe(true);
      const step = await source.exportStep({ assemblyIds: ["fixture"] });
      await writeFixture("authored-nested.step", step.bytes);
      await writeFixture("authored-nested.wcad", await source.exportWcad());
      const empty = imported.engine.exportProject();
      await expect(
        imported.importFile({
          format: "step",
          fileName: "broken.step",
          bytes: new TextEncoder().encode("not STEP")
        })
      ).rejects.toThrow();
      expect(imported.engine.exportProject()).toEqual(empty);
      const preview = await imported.importFile({
        format: "step",
        fileName: "fixture.step",
        bytes: step.bytes,
        mode: "dryRun"
      });
      expect(preview.createdBodyIds).toHaveLength(2);
      expect(imported.engine.exportProject()).toEqual(empty);
      const committed = await imported.importFile({
        format: "step",
        fileName: "fixture.step",
        bytes: step.bytes
      });
      expect(committed.createdBodyIds).toHaveLength(2);
      sameGeometry(await placedGeometry(imported), beforeExport);
      const importedNames = imported.engine
        .createSnapshot()
        .assemblies?.map((assembly) => assembly.name)
        .sort();
      expect(importedNames).toEqual(["Fixture", "Module"]);
      await writeFixture("imported-nested.wcad", await imported.exportWcad());
      await writeFixture(
        "nested-fixture.json",
        JSON.stringify(
          {
            authoredRoot: "fixture",
            dimensions:
              "Pin radius3 depth8; twin pads 4x6x2, centers +/-5; module poses [20,0,0] Rz90 and [-20,10,5] Rx90 (mm).",
            importedAssemblies: imported.engine.createSnapshot().assemblies,
            occurrences: flattenAssemblyOccurrences(
              imported.engine.createSnapshot().assemblies ?? []
            ),
            geometry: beforeExport
          },
          null,
          2
        )
      );
      const leaf = flattenAssemblyOccurrences(
        imported.engine.createSnapshot().assemblies ?? []
      ).find((occurrence) => occurrence.name === "Pin")!;
      const sharedBodyId = leaf.bodyId;
      const originalVolume = (await mass(imported, sharedBodyId)).volume;
      const independent = await imported.makeOccurrenceIndependent({
        rootAssemblyId: leaf.rootAssemblyId,
        instancePath: leaf.path
      });
      expect(independent.bodyId).not.toBe(sharedBodyId);
      const copied = flattenAssemblyOccurrences(
        imported.engine.createSnapshot().assemblies ?? []
      );
      expect(
        copied.filter((item) => item.bodyId === independent.bodyId)
      ).toHaveLength(1);
      expect(
        copied.filter((item) => item.bodyId === sharedBodyId)
      ).toHaveLength(1);
      sameGeometry(await placedGeometry(imported), beforeExport);
      const owner = resolveAssemblyOccurrence(
        imported.engine.createSnapshot().assemblies ?? [],
        independent.rootAssemblyId,
        independent.instancePath
      )!;
      const cut = await imported.executeBatch(
        batch([
          {
            op: "sketch.create",
            id: "bore_profile",
            name: "Editable bore",
            plane: "XY"
          },
          {
            op: "sketch.addCircle",
            sketchId: "bore_profile",
            id: "bore_circle",
            center: [0, 0],
            radius: 1
          },
          {
            op: "feature.extrude",
            id: "bore_cut",
            name: "Bored pin",
            bodyId: "bored_pin",
            sketchId: "bore_profile",
            entityId: "bore_circle",
            depth: 8,
            operationMode: "cut",
            targetBodyId: independent.bodyId
          }
        ])
      );
      expect(cut, JSON.stringify(cut)).toMatchObject({ ok: true });
      expect((await mass(imported, "bored_pin")).volume).toBeCloseTo(
        originalVolume - Math.PI * 8,
        6
      );
      expect((await mass(imported, sharedBodyId)).volume).toBeCloseTo(
        originalVolume,
        6
      );
      const beforeMove = imported.getSessionInfo().geometry.artifactBuilds;
      expect(
        await imported.executeBatch(
          batch([
            {
              op: "assembly.instance.updateTransform",
              assemblyId: owner.assembly.id,
              instanceId: owner.instance.id,
              transform: { translation: [2, 0, 0] }
            }
          ])
        )
      ).toMatchObject({ ok: true });
      await mass(imported, "bored_pin");
      expect(imported.getSessionInfo().geometry.artifactBuilds).toBe(
        beforeMove
      );
      const saved = await imported.exportWcad();
      await native.openWcad(saved);
      // Native canonical encoding normalizes signed zero and object-key order.
      expect(JSON.parse(JSON.stringify(native.engine.exportProject()))).toEqual(
        JSON.parse(JSON.stringify(imported.engine.exportProject()))
      );
      expect(
        await native.executeBatch(
          batch([{ op: "feature.updateExtrude", id: "bore_cut", depth: 4 }])
        )
      ).toMatchObject({ ok: true });
      expect((await mass(native, "bored_pin")).volume).toBeCloseTo(
        originalVolume - Math.PI * 4,
        6
      );
      native.engine.undo();
      expect((await mass(native, "bored_pin")).volume).toBeCloseTo(
        originalVolume - Math.PI * 8,
        6
      );
      native.engine.redo();
      expect((await mass(native, "bored_pin")).volume).toBeCloseTo(
        originalVolume - Math.PI * 4,
        6
      );
      const edited = await placedGeometry(native);
      await writeFixture("edited-nested.wcad", await native.exportWcad());
      await writeFixture(
        "edited-fixture.json",
        JSON.stringify(
          {
            boredBodyId: "bored_pin",
            boreFeatureId: "bore_cut",
            boreRadius: 1,
            boreDepth: 4,
            occurrences: flattenAssemblyOccurrences(
              native.engine.createSnapshot().assemblies ?? []
            ),
            geometry: edited
          },
          null,
          2
        )
      );
      const nextStep = await native.exportStep();
      await writeFixture("edited-nested.step", nextStep.bytes);
      await inches.importFile({
        format: "step",
        fileName: "roundtrip.step",
        bytes: nextStep.bytes
      });
      sameGeometry(await placedGeometry(inches), edited);
      expect(
        inches.engine
          .createSnapshot()
          .assemblies?.map((assembly) => assembly.name)
          .sort()
      ).toEqual(
        native.engine
          .createSnapshot()
          .assemblies?.map((assembly) => assembly.name)
          .sort()
      );
      expect(
        new Set(
          flattenAssemblyOccurrences(
            inches.engine.createSnapshot().assemblies ?? []
          ).map((item) => item.bodyId)
        ).size
      ).toBe(3);
      const secondPin = flattenAssemblyOccurrences(
        inches.engine.createSnapshot().assemblies ?? []
      ).find((item) => item.name === "Pin")!;
      const nextCopy = await inches.makeOccurrenceIndependent({
        rootAssemblyId: secondPin.rootAssemblyId,
        instancePath: secondPin.path
      });
      expect((await mass(inches, nextCopy.bodyId)).units).toBe("in");
      expect(inches.engine.getTransactions().length).toBeGreaterThan(1);
    } finally {
      await Promise.all([
        source.dispose(),
        imported.dispose(),
        native.dispose(),
        inches.dispose()
      ]);
    }
  }, 30_000);
});
