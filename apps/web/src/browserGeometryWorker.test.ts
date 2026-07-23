import {
  createBoxTessellationWorkerRequest,
  createConeTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  createSphereTessellationWorkerRequest,
  createTorusTessellationWorkerRequest,
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
  terminationCount = 0;
  throwOnMessageRemoval = false;
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
      if (this.throwOnMessageRemoval) {
        throw new Error("Injected listener removal failure.");
      }
      return;
    }

    this.#errorListeners.delete(listener as ErrorListener);
  }

  terminate(): void {
    this.terminationCount += 1;
    this.#messageListeners.clear();
    this.#errorListeners.clear();
  }

  emitMessage(message: GeometryWorkerMessage): void {
    for (const listener of this.#messageListeners) {
      listener({ data: message });
    }
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

class ThrowingTerminationTransport extends FakeGeometryWorkerTransport {
  override terminate(): void {
    super.terminate();
    throw new Error("Injected terminate failure.");
  }
}

class PartialSetupFailureTransport implements GeometryWorkerTransport {
  messageListenerRemoved = false;
  terminated = false;

  postMessage(): void {}

  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error", listener: ErrorListener): void;
  addEventListener(type: "message" | "error"): void {
    if (type === "error") {
      throw new Error("Injected listener setup failure.");
    }
  }

  removeEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "error", listener: ErrorListener): void;
  removeEventListener(type: "message" | "error"): void {
    if (type === "message") {
      this.messageListenerRemoved = true;
      throw new Error("Injected listener cleanup failure.");
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}

function createPrimitiveTessellationTransport(): FakeGeometryWorkerTransport {
  return new FakeGeometryWorkerTransport(async (request) =>
    createPrimitiveTessellationMessage(request)
  );
}

function createPrimitiveTessellationMessage(
  request: GeometryWorkerRequest
): GeometryWorkerMessage {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const indices = new Uint32Array([0, 1, 2]);

  return {
    id: request.id,
    version: request.version,
    kind: request.kind,
    payloadId: request.payload.id,
    response: {
      ok: true,
      id: request.payload.id,
      op: request.payload.op,
      mesh: {
        primitive: getPrimitiveForOp(request.payload.op),
        positions,
        indices,
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      },
      warnings: []
    },
    transferables: [positions.buffer, indices.buffer]
  } as GeometryWorkerMessage;
}

function getPrimitiveForOp(op: GeometryWorkerRequest["payload"]["op"]) {
  switch (op) {
    case "geometry.tessellateBox":
      return "box";
    case "geometry.tessellateCylinder":
      return "cylinder";
    case "geometry.tessellateSphere":
      return "sphere";
    case "geometry.tessellateCone":
      return "cone";
    case "geometry.tessellateTorus":
      return "torus";
    default:
      throw new Error(`Unsupported primitive test op: ${op}`);
  }
}

describe("BrowserGeometryWorker", () => {
  it("cleans up partial listener setup when construction fails", () => {
    const transport = new PartialSetupFailureTransport();

    expect(() => new BrowserGeometryWorker(transport)).toThrow(
      "Injected listener setup failure."
    );
    expect(transport.messageListenerRemoved).toBe(true);
    expect(transport.terminated).toBe(true);
  });

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
        op: "geometry.tessellateBox",
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

  it("rejects duplicate pending request ids instead of overwriting handlers", async () => {
    const transport = new FakeGeometryWorkerTransport(
      () => new Promise<GeometryWorkerMessage>(() => undefined)
    );
    const worker = new BrowserGeometryWorker(transport);
    const request = createBoxTessellationWorkerRequest({
      id: "duplicate_request",
      width: 1,
      height: 1,
      depth: 1
    });
    const firstRequest = worker.execute(request);
    void firstRequest.catch(() => undefined);

    await expect(worker.execute(request)).rejects.toMatchObject({
      diagnostics: {
        error: {
          code: "WORKER_TRANSPORT_FAILED",
          message: "Duplicate geometry worker request id: duplicate_request."
        }
      }
    });
    expect(transport.requests).toHaveLength(1);

    worker.dispose();
  });

  it("rejects use after dispose and only terminates once", async () => {
    const transport = createPrimitiveTessellationTransport();
    const worker = new BrowserGeometryWorker(transport);
    const request = createBoxTessellationWorkerRequest({
      id: "disposed_request",
      width: 1,
      height: 1,
      depth: 1
    });

    worker.dispose();
    worker.dispose();

    await expect(worker.execute(request)).rejects.toMatchObject({
      diagnostics: {
        error: {
          code: "WORKER_TRANSPORT_FAILED",
          message: "Geometry worker has already been disposed."
        }
      }
    });
    expect(transport.requests).toHaveLength(0);
    expect(transport.terminationCount).toBe(1);
  });

  it("rejects pending work before transport cleanup can fail", async () => {
    const transport = new ThrowingTerminationTransport(
      () => new Promise<GeometryWorkerMessage>(() => undefined)
    );
    const worker = new BrowserGeometryWorker(transport);
    const pending = worker.execute(
      createBoxTessellationWorkerRequest({
        id: "cleanup_request",
        width: 1,
        height: 1,
        depth: 1
      })
    );

    expect(() => worker.dispose()).toThrow("Injected terminate failure.");
    await expect(pending).rejects.toMatchObject({
      diagnostics: {
        error: {
          code: "WORKER_TRANSPORT_FAILED",
          message: "Geometry worker was disposed before completing a request."
        }
      }
    });
    expect(transport.terminationCount).toBe(1);
  });

  it("attempts transport termination after listener cleanup fails", () => {
    const transport = new FakeGeometryWorkerTransport(
      () => new Promise<GeometryWorkerMessage>(() => undefined)
    );
    const worker = new BrowserGeometryWorker(transport);
    transport.throwOnMessageRemoval = true;

    expect(() => worker.dispose()).toThrow(
      "Injected listener removal failure."
    );
    expect(transport.terminationCount).toBe(1);
  });

  it("reports worker entry once without settling the request", async () => {
    let resolveResponse: ((message: GeometryWorkerMessage) => void) | undefined;
    const transport = new FakeGeometryWorkerTransport(
      () =>
        new Promise<GeometryWorkerMessage>((resolve) => {
          resolveResponse = resolve;
        })
    );
    const worker = new BrowserGeometryWorker(transport);
    const request = createBoxTessellationWorkerRequest({
      id: "tracked_request",
      width: 1,
      height: 1,
      depth: 1
    });
    let startedCount = 0;
    let settled = false;
    const responsePromise = worker.executeTracked(request, {
      onStarted: () => {
        startedCount += 1;
      }
    });
    void responsePromise.then(() => {
      settled = true;
    });

    await Promise.resolve();
    transport.emitMessage([request.id]);
    transport.emitMessage([request.id]);

    expect(startedCount).toBe(1);
    expect(settled).toBe(false);

    resolveResponse?.(createPrimitiveTessellationMessage(request));
    await expect(responsePromise).resolves.toMatchObject({ id: request.id });
    expect(settled).toBe(true);
  });

  it("passes one box tessellation message through the browser transport wrapper", async () => {
    const transport = createPrimitiveTessellationTransport();
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
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("passes one cylinder tessellation message through the browser transport wrapper", async () => {
    const transport = createPrimitiveTessellationTransport();
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

  it("passes one sphere tessellation message through the browser transport wrapper", async () => {
    const transport = createPrimitiveTessellationTransport();
    const worker = new BrowserGeometryWorker(transport);

    const response = await worker.execute(
      createSphereTessellationWorkerRequest({
        id: "browser_geometry_req_sphere",
        payloadId: "browser_geometry_payload_sphere",
        radius: 10
      })
    );

    expect(response).toMatchObject({
      id: "browser_geometry_req_sphere",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "browser_geometry_payload_sphere",
      response: {
        ok: true,
        id: "browser_geometry_payload_sphere",
        op: "geometry.tessellateSphere"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("sphere");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("passes cone and torus tessellation messages through the browser transport wrapper", async () => {
    const transport = createPrimitiveTessellationTransport();
    const worker = new BrowserGeometryWorker(transport);

    const cone = await worker.execute(
      createConeTessellationWorkerRequest({
        id: "browser_geometry_req_cone",
        payloadId: "browser_geometry_payload_cone",
        radius: 2,
        height: 5
      })
    );
    const torus = await worker.execute(
      createTorusTessellationWorkerRequest({
        id: "browser_geometry_req_torus",
        payloadId: "browser_geometry_payload_torus",
        majorRadius: 3,
        minorRadius: 0.5
      })
    );

    expect(cone).toMatchObject({
      payloadId: "browser_geometry_payload_cone",
      response: {
        ok: true,
        op: "geometry.tessellateCone"
      }
    });
    expect(torus).toMatchObject({
      payloadId: "browser_geometry_payload_torus",
      response: {
        ok: true,
        op: "geometry.tessellateTorus"
      }
    });

    if (!cone.response.ok || !torus.response.ok) {
      throw new Error("Expected cone and torus browser requests to succeed.");
    }

    expect(cone.response.mesh.primitive).toBe("cone");
    expect(torus.response.mesh.primitive).toBe("torus");
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
      error: "Unsupported geometry kernel operation: geometry.tessellateSweep.",
      diagnostics: {
        ok: false,
        stage: "requestValidation",
        workerStarted: true,
        wasmLoadStatus: "notRequested",
        error: {
          code: "UNSUPPORTED_PRIMITIVE",
          message:
            "Unsupported geometry kernel operation: geometry.tessellateSweep."
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
