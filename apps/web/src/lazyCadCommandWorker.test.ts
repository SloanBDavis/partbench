import type { CadWorkerRequest, CadWorkerResponse } from "@web-cad/cad-core";
import { describe, expect, it, vi } from "vitest";
import {
  LazyCadCommandWorker,
  type DisposableCadCommandWorker
} from "./lazyCadCommandWorker";

const request = { id: "request_1" } as unknown as CadWorkerRequest;

describe("LazyCadCommandWorker", () => {
  it("does not create a browser worker for an empty shell", () => {
    const createWorker = vi.fn<() => DisposableCadCommandWorker>();

    const worker = new LazyCadCommandWorker(createWorker);

    expect(createWorker).not.toHaveBeenCalled();
    worker.dispose();
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("creates one worker on first execution and reuses it", async () => {
    const response = {
      id: request.id,
      response: { ok: true }
    } as unknown as CadWorkerResponse;
    const execute = vi.fn(async () => response);
    const dispose = vi.fn();
    const createWorker = vi.fn(() => ({ execute, dispose }));
    const worker = new LazyCadCommandWorker(createWorker);

    await expect(worker.execute(request)).resolves.toBe(response);
    await expect(worker.execute(request)).resolves.toBe(response);

    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("disposes idempotently and rejects later work", async () => {
    const dispose = vi.fn();
    const createWorker = vi.fn(() => ({
      execute: async () =>
        ({
          id: request.id,
          response: { ok: true }
        }) as unknown as CadWorkerResponse,
      dispose
    }));
    const worker = new LazyCadCommandWorker(createWorker);

    await worker.execute(request);
    worker.dispose();
    worker.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
    await expect(worker.execute(request)).rejects.toThrow(
      "CAD command worker is disposed."
    );
  });
});
