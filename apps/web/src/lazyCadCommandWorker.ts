import type {
  CadCommandWorker,
  CadWorkerRequest,
  CadWorkerResponse
} from "@web-cad/cad-core";
import { BrowserCadCommandWorker } from "./browserCadCommandWorker";

export type DisposableCadCommandWorker = CadCommandWorker & {
  dispose(): void;
};

export type CadCommandWorkerFactory = () => DisposableCadCommandWorker;

/**
 * Keeps the command worker out of the empty-shell request graph. The first
 * source mutation creates the real browser worker; unmount/HMR disposal is
 * still explicit and idempotent.
 */
export class LazyCadCommandWorker implements DisposableCadCommandWorker {
  readonly #createWorker: CadCommandWorkerFactory;
  #worker: DisposableCadCommandWorker | undefined;
  #disposed = false;

  constructor(createWorker: CadCommandWorkerFactory = createBrowserWorker) {
    this.#createWorker = createWorker;
  }

  execute(request: CadWorkerRequest): Promise<CadWorkerResponse> {
    if (this.#disposed) {
      return Promise.reject(new Error("CAD command worker is disposed."));
    }

    this.#worker ??= this.#createWorker();
    return this.#worker.execute(request);
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#worker?.dispose();
    this.#worker = undefined;
  }
}

function createBrowserWorker(): DisposableCadCommandWorker {
  return new BrowserCadCommandWorker();
}
