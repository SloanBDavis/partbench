import {
  GeometryKernelWorker,
  createBoxTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  type GeometryWorkerRequest
} from "@web-cad/geometry-worker";
import { describe, expect, it } from "vitest";
import {
  BrowserGeometryWorker,
  BrowserGeometryWorkerError,
  type GeometryWorkerMessage,
  type GeometryWorkerTransport
} from "./browserGeometryWorker";

interface WorkerMessageEvent<T> {
  readonly data: T;
}

interface WorkerErrorEvent {
  readonly error?: unknown;
  readonly message?: string;
}

type MessageListener = (
  event: WorkerMessageEvent<GeometryWorkerMessage>
) => void;
type ErrorListener = (event: WorkerErrorEvent) => void;

class FakeGeometryWorkerTransport implements GeometryWorkerTransport {
  readonly requests: GeometryWorkerRequest[] = [];
  readonly #handler: (
    request: GeometryWorkerRequest
  ) => Promise<GeometryWorkerMessage>;
  readonly #messageListeners = new Set<MessageListener>();
  readonly #errorListeners = new Set<ErrorListener>();

  constructor(
    handler: (request: GeometryWorkerRequest) => Promise<GeometryWorkerMessage>
  ) {
    this.#handler = handler;
  }

  postMessage(message: GeometryWorkerRequest): void {
    this.requests.push(message);

    queueMicrotask(() => {
      void this.#postResponse(message);
    });
  }

  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error", listener: ErrorListener): void;
  addEventListener(
    type: "message" | "error",
    listener: MessageListener | ErrorListener
  ): void {
    if (type === "message") {
      this.#messageListeners.add(listener as MessageListener);
      return;
    }

    this.#errorListeners.add(listener as ErrorListener);
  }

  removeEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "error", listener: ErrorListener): void;
  removeEventListener(
    type: "message" | "error",
    listener: MessageListener | ErrorListener
  ): void {
    if (type === "message") {
      this.#messageListeners.delete(listener as MessageListener);
      return;
    }

    this.#errorListeners.delete(listener as ErrorListener);
  }

  terminate(): void {
    this.#messageListeners.clear();
    this.#errorListeners.clear();
  }

  async #postResponse(request: GeometryWorkerRequest): Promise<void> {
    try {
      const response = await this.#handler(request);

      for (const listener of this.#messageListeners) {
        listener({ data: response });
      }
    } catch (error) {
      for (const listener of this.#errorListeners) {
        listener({ error });
      }
    }
  }
}

describe("BrowserGeometryWorker", () => {
  it("sends geometry requests through a worker-like transport asynchronously", async () => {
    const positions = new Float32Array([0, 0, 0]);
    const indices = new Uint32Array();
    const transport = new FakeGeometryWorkerTransport(async (request) => ({
      id: request.id,
      version: request.version,
      kind: request.kind,
      payloadId: request.payload.id,
      response: {
        ok: true,
        id: request.payload.id,
        op: request.payload.op,
        mesh: {
          primitive: "box",
          positions,
          indices,
          vertexCount: 1,
          triangleCount: 0,
          faceCount: 0
        },
        warnings: []
      },
      transferables: [positions.buffer, indices.buffer]
    }));
    const worker = new BrowserGeometryWorker(transport);
    const request = createBoxTessellationWorkerRequest({
      id: "browser_geometry_req_1",
      width: 1,
      height: 1,
      depth: 1
    });
    const responsePromise = worker.execute(request);
    let isSettled = false;
    void responsePromise.then(() => {
      isSettled = true;
    });

    expect(transport.requests).toEqual([request]);
    expect(isSettled).toBe(false);

    const response = await responsePromise;

    expect(response.id).toBe("browser_geometry_req_1");
    expect(response.response.ok).toBe(true);
    expect(response.transferables).toEqual([positions.buffer, indices.buffer]);
    expect(isSettled).toBe(true);
  });

  it("can run one box tessellation through the browser transport wrapper", async () => {
    const kernelWorker = new GeometryKernelWorker();
    const transport = new FakeGeometryWorkerTransport((request) =>
      kernelWorker.execute(request)
    );
    const worker = new BrowserGeometryWorker(transport);

    const response = await worker.execute(
      createBoxTessellationWorkerRequest({
        id: "browser_geometry_req_box",
        payloadId: "browser_geometry_payload_box",
        width: 10,
        height: 20,
        depth: 30
      })
    );

    expect(response).toMatchObject({
      id: "browser_geometry_req_box",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "browser_geometry_payload_box",
      response: {
        ok: true,
        id: "browser_geometry_payload_box",
        op: "geometry.tessellateBox"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("box");
    expect(response.response.mesh.vertexCount).toBe(24);
    expect(response.response.mesh.triangleCount).toBe(12);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("can run one cylinder tessellation through the browser transport wrapper", async () => {
    const kernelWorker = new GeometryKernelWorker();
    const transport = new FakeGeometryWorkerTransport((request) =>
      kernelWorker.execute(request)
    );
    const worker = new BrowserGeometryWorker(transport);

    const response = await worker.execute(
      createCylinderTessellationWorkerRequest({
        id: "browser_geometry_req_cylinder",
        payloadId: "browser_geometry_payload_cylinder",
        radius: 10,
        height: 30
      })
    );

    expect(response).toMatchObject({
      id: "browser_geometry_req_cylinder",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "browser_geometry_payload_cylinder",
      response: {
        ok: true,
        id: "browser_geometry_payload_cylinder",
        op: "geometry.tessellateCylinder"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("cylinder");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("rejects pending requests when the worker transport reports an error", async () => {
    const transport = new FakeGeometryWorkerTransport(async () => {
      throw new Error("geometry worker transport failed");
    });
    const worker = new BrowserGeometryWorker(transport);

    try {
      await worker.execute(
        createBoxTessellationWorkerRequest({
          id: "browser_geometry_req_failure",
          width: 1,
          height: 1,
          depth: 1
        })
      );
      throw new Error("Expected the geometry worker request to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserGeometryWorkerError);
      expect((error as BrowserGeometryWorkerError).diagnostics).toMatchObject({
        ok: false,
        stage: "transport",
        workerStarted: false,
        wasmLoadStatus: "notRequested",
        error: {
          code: "WORKER_TRANSPORT_FAILED",
          message: "geometry worker transport failed"
        }
      });
    }
  });

  it("rejects structured worker message errors with diagnostics", async () => {
    const transport = new FakeGeometryWorkerTransport(async (request) => ({
      id: request.id,
      error:
        "Unsupported geometry kernel operation: geometry.tessellateSphere.",
      diagnostics: {
        ok: false,
        stage: "requestValidation",
        workerStarted: true,
        wasmLoadStatus: "notRequested",
        error: {
          code: "UNSUPPORTED_PRIMITIVE",
          message:
            "Unsupported geometry kernel operation: geometry.tessellateSphere."
        }
      }
    }));
    const worker = new BrowserGeometryWorker(transport);

    try {
      await worker.execute(
        createBoxTessellationWorkerRequest({
          id: "browser_geometry_req_unsupported",
          width: 1,
          height: 1,
          depth: 1
        })
      );
      throw new Error("Expected the geometry worker request to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserGeometryWorkerError);
      expect((error as BrowserGeometryWorkerError).diagnostics).toMatchObject({
        ok: false,
        stage: "requestValidation",
        workerStarted: true,
        wasmLoadStatus: "notRequested",
        error: {
          code: "UNSUPPORTED_PRIMITIVE"
        }
      });
    }
  });
});
