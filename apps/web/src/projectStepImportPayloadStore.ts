import type { CadStepImportTransientPayloadRef } from "@web-cad/cad-protocol";

export interface ProjectStepImportPayloadStore {
  putPayload(payloadId: string, bytes: Uint8Array): void;
  readPayload(
    payloadRef: CadStepImportTransientPayloadRef
  ): Uint8Array | undefined;
  deletePayload(payloadId: string): void;
  clear(): void;
}

export function createProjectStepImportPayloadStore(): ProjectStepImportPayloadStore {
  const payloadsById = new Map<string, Uint8Array>();

  return {
    putPayload(payloadId, bytes) {
      payloadsById.set(payloadId, new Uint8Array(bytes));
    },
    readPayload(payloadRef) {
      const bytes = payloadsById.get(payloadRef.payloadId);

      return bytes ? new Uint8Array(bytes) : undefined;
    },
    deletePayload(payloadId) {
      payloadsById.delete(payloadId);
    },
    clear() {
      payloadsById.clear();
    }
  };
}
