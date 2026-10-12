import { prepareBrowserStepCheckpoint } from "@web-cad/geometry-kernel/browser";

const scope = self as unknown as {
  onmessage: (event: MessageEvent<Uint8Array>) => void;
  postMessage(message: unknown, transfer: Transferable[]): void;
};
scope.onmessage = async (event) => {
  try {
    const checkpoint = await prepareBrowserStepCheckpoint(event.data);
    scope.postMessage({ checkpoint }, [
      checkpoint.brepBytes.buffer as ArrayBuffer
    ]);
  } catch (error) {
    scope.postMessage(
      { error: error instanceof Error ? error.message : String(error) },
      []
    );
  }
};
