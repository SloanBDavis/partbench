import { describe, expect, it, vi } from "vitest";
import { createCadSession } from "./index";
import { CadEngine } from "@web-cad/cad-core";
import type { CadOp } from "@web-cad/cad-protocol";

const plate: readonly CadOp[] = [
  { op: "sketch.create", id: "profile", name: "Profile", plane: "XY" },
  {
    op: "sketch.addRectangle",
    sketchId: "profile",
    id: "rectangle",
    center: [0, 0],
    width: 20,
    height: 10
  },
  {
    op: "feature.extrude",
    id: "extrude",
    bodyId: "base",
    sketchId: "profile",
    entityId: "rectangle",
    depth: 4
  },
  {
    op: "feature.fillet",
    id: "round",
    bodyId: "plate",
    targetBodyId: "base",
    edgeStableId: "generated:edge:base:start:uMax",
    radius: 1
  }
];

const batch = (
  ops: readonly CadOp[],
  mode: "commit" | "dryRun" = "commit"
) => ({ version: "cadops.v1" as const, mode, ops });

describe("exact CAD session", () => {
  it("moves a connected wire-profile part without exact rebuilding or history replay, including Undo/Redo", async () => {
    const session = createCadSession();
    const frame = (instanceId: string) => ({
      instanceId,
      frame: {
        kind: "local" as const,
        origin: [0, 0, 0] as const,
        xDirection: [1, 0, 0] as const,
        zDirection: [0, 0, 1] as const
      }
    });
    const edges = [
      [
        [-10, -10],
        [10, -10]
      ],
      [
        [10, -10],
        [10, 10]
      ],
      [
        [10, 10],
        [-10, 10]
      ],
      [
        [-10, 10],
        [-10, -10]
      ]
    ] as const;
    try {
      expect(
        await session.executeBatch(
          batch([
            { op: "parameter.create", id: "angle", name: "angle", value: 0 },
            { op: "sketch.create", id: "wire", name: "Wire", plane: "XY" },
            ...edges.map(
              ([start, end], i): CadOp => ({
                op: "sketch.addLine",
                sketchId: "wire",
                id: `edge${i}`,
                start,
                end
              })
            ),
            {
              op: "feature.extrude",
              id: "wire_extrude",
              bodyId: "wire_body",
              profile: {
                kind: "wire",
                sketchId: "wire",
                segments: edges.map((_, i) => ({
                  entityId: `edge${i}`,
                  orientation: "forward" as const
                }))
              },
              depth: 10
            },
            { op: "assembly.create", id: "gearbox", name: "Gearbox" },
            ...["base", "moving"].map(
              (id): CadOp => ({
                op: "assembly.instance.insert",
                assemblyId: "gearbox",
                id,
                definition: { kind: "body", bodyId: "wire_body" }
              })
            ),
            {
              op: "assembly.mate.create",
              assemblyId: "gearbox",
              id: "fixed",
              kind: "fixed",
              instanceId: "base"
            },
            {
              op: "assembly.mate.create",
              assemblyId: "gearbox",
              id: "rotation",
              kind: "revolute",
              primary: frame("base"),
              secondary: frame("moving"),
              angleParameterId: "angle"
            }
          ])
        )
      ).toMatchObject({ ok: true });
      const original = await session.getCurrentExactEvidence();
      const builds = session.getSessionInfo().geometry.artifactBuilds;
      const historyImport = vi.spyOn(CadEngine, "fromProject");
      try {
        expect(
          await session.executeBatch(
            batch([{ op: "parameter.update", id: "angle", value: 90 }])
          )
        ).toMatchObject({ ok: true });
        const rotation = () =>
          session.engine
            .getDocument()
            .assemblies.get("gearbox")!
            .instances.find(({ id }) => id === "moving")!.transform.rotation[2];
        expect(rotation()).toBeCloseTo(Math.PI / 2);
        for (const action of [
          () => {},
          () => session.engine.undo(),
          () => session.engine.redo()
        ]) {
          action();
          const evidence = await session.getCurrentExactEvidence();
          expect(evidence.currentExactResults).toEqual([
            expect.objectContaining({ bodyId: "wire_body", status: "ready" })
          ]);
          expect(evidence.derivedExactMetadata).toEqual(
            original.derivedExactMetadata
          );
          expect(session.getSessionInfo().geometry.artifactBuilds).toBe(builds);
        }
        expect(rotation()).toBeCloseTo(Math.PI / 2);
        expect(historyImport).not.toHaveBeenCalled();
      } finally {
        historyImport.mockRestore();
      }
      expect(
        await session.executeBatch(
          batch([
            { op: "feature.updateExtrude", id: "wire_extrude", depth: 12 }
          ])
        )
      ).toMatchObject({ ok: true });
      expect(session.getSessionInfo().geometry.artifactBuilds).toBe(builds + 1);
      expect(
        (await session.getCurrentExactEvidence()).derivedExactMetadata
      ).not.toEqual(original.derivedExactMetadata);
    } finally {
      session.dispose();
    }
  }, 30_000);

  it("attributes exact failures to their source edit before unrelated operations", async () => {
    const session = createCadSession();
    try {
      expect(await session.executeBatch(batch(plate))).toMatchObject({
        ok: true
      });
      const before = session.engine.exportProject();
      for (const edit of [
        { op: "feature.updateFillet", id: "round", radius: 100 },
        { op: "feature.updateExtrude", id: "extrude", depth: 0.1 }
      ] as const) {
        for (const mode of ["dryRun", "commit"] as const) {
          const result = await session.executeBatch(
            batch(
              [
                edit,
                {
                  op: "sketch.create",
                  id: "unrelated",
                  name: "Unrelated",
                  plane: "XY"
                }
              ],
              mode
            )
          );
          expect(result).toMatchObject({
            ok: false,
            error: {
              opIndex: 0,
              op: edit.op,
              path: "$.ops[0]",
              bodyId: "plate",
              featureId: "round"
            }
          });
          expect(session.engine.exportProject()).toEqual(before);
        }
      }
    } finally {
      session.dispose();
    }
  }, 30_000);

  it("does not blame an unrelated operation for an already invalid exact body", async () => {
    const engine = new CadEngine();
    expect(engine.executeBatch(batch(plate))).toMatchObject({ ok: true });
    expect(
      engine.executeBatch(
        batch([{ op: "feature.updateFillet", id: "round", radius: 100 }])
      )
    ).toMatchObject({ ok: true });
    const session = createCadSession({ project: engine.exportProject() });
    try {
      const result = await session.executeBatch(
        batch([
          {
            op: "sketch.create",
            id: "unrelated",
            name: "Unrelated",
            plane: "XY"
          }
        ])
      );
      expect(result).toMatchObject({
        ok: false,
        error: { bodyId: "plate", featureId: "round" }
      });
      if (!result.ok) {
        expect(result.error.opIndex).toBeUndefined();
        expect(result.error.path).toBeUndefined();
      }
      expect(session.engine.exportProject()).toEqual(engine.exportProject());
    } finally {
      session.dispose();
    }
  }, 30_000);

  it("builds actual geometry, rejects an impossible edit atomically in both modes, and reopens portable geometry", async () => {
    const session = createCadSession();
    const reopened = createCadSession();
    try {
      expect(session.getSessionInfo().geometry.artifactBuilds).toBe(0);
      expect(await session.executeBatch(batch(plate))).toMatchObject({
        ok: true
      });
      const before = await session.getCurrentExactEvidence();
      expect(before.currentExactResults).toEqual([
        expect.objectContaining({ bodyId: "plate", status: "ready" })
      ]);
      expect(before.derivedExactMetadata[0]).toMatchObject({
        status: "ready",
        metadata: {
          confidence: "kernel-derived",
          topologyCounts: { solidCount: 1 }
        }
      });
      const source = session.engine.exportProject();
      const preview = await session.execute({
        requestId: "audited-preview",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: batch(
          [{ op: "feature.updateExtrude", id: "extrude", depth: 5 }],
          "dryRun"
        ),
        source: { source: "mcp", toolName: "cad.batch" }
      });
      expect(preview).toMatchObject({
        ok: true,
        mode: "dryRun",
        audit: { intent: "dryRun" }
      });
      expect(session.engine.exportProject()).toEqual(source);
      for (const mode of ["dryRun", "commit"] as const) {
        expect(
          await session.executeBatch(
            batch(
              [{ op: "feature.updateFillet", id: "round", radius: 100 }],
              mode
            )
          )
        ).toMatchObject({ ok: false, mode });
        expect(session.engine.exportProject()).toEqual(source);
      }
      const built = session.getSessionInfo().geometry.artifactBuilds;
      await session.getCurrentExactEvidence();
      expect(session.getSessionInfo().geometry.artifactBuilds).toBe(built);
      const saved = await session.exportWcad();
      await reopened.openWcad(saved);
      const opened = await reopened.getCurrentExactEvidence();
      expect(opened.derivedExactMetadata).toEqual(before.derivedExactMetadata);
      expect(reopened.engine.exportProject()).toEqual(source);
      const step = await reopened.exportStep({ bodyIds: ["plate"] });
      expect(step.bodyCount).toBe(1);
      expect(new TextDecoder().decode(step.bytes)).toContain("ISO-10303-21;");
      const revision = await reopened.executeBatch(
        batch([{ op: "feature.updateExtrude", id: "extrude", depth: 6 }])
      );
      expect(revision).toMatchObject({ ok: true });
      expect(
        (await reopened.getCurrentExactEvidence()).derivedExactMetadata
      ).not.toEqual(opened.derivedExactMetadata);
    } finally {
      session.dispose();
      reopened.dispose();
    }
  }, 30_000);

  it("serializes edits and saves, preserves source after corrupt open, and bounds retained artifacts", async () => {
    const session = createCadSession({
      maxArtifactCacheEntries: 1,
      maxArtifactCacheBytes: 100_000
    });
    try {
      const creating = session.executeBatch(batch(plate));
      const saving = session.exportWcad();
      expect(await creating).toMatchObject({ ok: true });
      expect((await saving).byteLength).toBeGreaterThan(0);
      const source = session.engine.exportProject();
      await expect(
        session.openWcad(new Uint8Array([0, 1, 2]))
      ).rejects.toThrow();
      expect(session.engine.exportProject()).toEqual(source);
      const info = session.getSessionInfo();
      expect(info.cache.entryCount).toBeLessThanOrEqual(1);
      expect(info.cache.byteLength).toBeLessThanOrEqual(100_000);
      session.dispose();
      await expect(session.exportWcad()).rejects.toThrow("closed");
    } finally {
      session.dispose();
    }
  }, 30_000);
});
