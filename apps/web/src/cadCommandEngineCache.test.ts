import { CadEngine } from "@web-cad/cad-core/full";
import { describe, expect, it, vi } from "vitest";
import { CadCommandEngineCache } from "./cadCommandEngineCache";

function seed() {
  const engine = new CadEngine();
  engine.apply({
    op: "scene.createBox",
    id: "box",
    dimensions: { width: 1, height: 2, depth: 3 }
  });
  return engine;
}

describe("validated command engine cache", () => {
  it("reuses exact projects through command, undo and redo while isolating mutations", () => {
    const cache = new CadCommandEngineCache();
    const live = seed();
    const original = live.exportProject();
    const worker = cache.load(original);
    const edit = {
      op: "parameter.create",
      id: "angle",
      name: "angle",
      value: 90
    } as const;
    worker.apply(edit);
    cache.remember(worker);
    live.apply(edit);
    const revised = live.exportProject();
    const imported = vi.spyOn(CadEngine, "fromProject");
    try {
      expect(cache.load(revised).exportProject()).toEqual(revised);
      live.undo();
      // Native Undo includes a redo stack. It must validate this new identity
      // once, then exact repeated source/history identities can be reused.
      const undone = live.exportProject();
      cache.load(undone);
      expect(imported).toHaveBeenCalledOnce();
      expect(cache.load(undone).exportProject()).toEqual(undone);
      live.redo();
      expect(cache.load(live.exportProject()).exportProject()).toEqual(revised);
      expect(imported).toHaveBeenCalledOnce();
      const detached = cache.load(revised);
      detached.undo();
      detached.apply({
        op: "parameter.create",
        id: "detached",
        name: "detached",
        value: 1
      });
      expect(cache.load(revised).exportProject()).toEqual(revised);
      expect(live.exportProject()).toEqual(revised);
    } finally {
      imported.mockRestore();
    }
  });

  it("validates changed native fields and evicts old or oversized projects", () => {
    const cache = new CadCommandEngineCache(1);
    const first = seed().exportProject();
    cache.load(first);
    const other = new CadEngine().exportProject();
    cache.load(other);
    const imported = vi.spyOn(CadEngine, "fromProject");
    try {
      cache.load(first);
      expect(imported).toHaveBeenCalledOnce();
      expect(() =>
        cache.load({
          ...first,
          schemaVersion: "invalid"
        } as unknown as typeof first)
      ).toThrow();
      expect(imported).toHaveBeenCalledTimes(2);
      const invalidHistory = {
        ...first,
        history: first.history.map((transaction) => ({
          ...transaction,
          ops: [
            {
              op: "parameter.create" as const,
              id: "wrong",
              name: "wrong",
              value: 1
            }
          ]
        }))
      };
      expect(() => cache.load(invalidHistory)).toThrow();
      expect(imported).toHaveBeenCalledTimes(3);
      expect(cache.load(first).exportProject()).toEqual(first);
      const tiny = new CadCommandEngineCache(2, 1);
      tiny.load(other);
      tiny.load(other);
      expect(imported).toHaveBeenCalledTimes(5);
    } finally {
      imported.mockRestore();
    }
  });
});
