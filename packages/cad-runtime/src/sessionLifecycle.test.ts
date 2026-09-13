import { expect, it, vi } from "vitest";
import { AsyncCadCommandExecutor } from "@web-cad/cad-core";
import { createCadSession } from "./index";

it("does not commit an in-flight file import after its session is disposed", async () => {
  let started!: () => void, resume!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const paused = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const original =
    AsyncCadCommandExecutor.prototype.executeBatchAtSourceAuthorityEpoch;
  const originalUnguarded = AsyncCadCommandExecutor.prototype.executeBatch;
  const guarded = vi
    .spyOn(
      AsyncCadCommandExecutor.prototype,
      "executeBatchAtSourceAuthorityEpoch"
    )
    .mockImplementation(async function (
      this: AsyncCadCommandExecutor,
      ...args
    ) {
      started();
      await paused;
      return original.apply(this, args);
    });
  const unguarded = vi
    .spyOn(AsyncCadCommandExecutor.prototype, "executeBatch")
    .mockImplementation(async function (
      this: AsyncCadCommandExecutor,
      ...args
    ) {
      started();
      await paused;
      return originalUnguarded.apply(this, args);
    });
  const session = createCadSession(),
    before = session.engine.exportProject();
  try {
    const importResult = session.importFile({
      format: "svg",
      fileName: "circle.svg",
      bytes: new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm"><circle cx="5" cy="5" r="2"/></svg>'
      )
    });
    await entered;
    session.dispose();
    resume();
    await expect(importResult).rejects.toThrow(/closed/);
    expect(session.engine.exportProject()).toEqual(before);
  } finally {
    resume();
    session.dispose();
    guarded.mockRestore();
    unguarded.mockRestore();
  }
});
