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

export class LazyCadCommandWorker implements CadCommandWorker {
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
