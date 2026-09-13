import type { CadStepImportTransientPayloadRef } from "@web-cad/cad-protocol";

export interface ProjectStepImportPayloadStore {
  putPayload(payloadId: string, bytes: Uint8Array): void;
  readPayload(
    payloadRef: CadStepImportTransientPayloadRef
  ): Uint8Array | undefined;
  deletePayload(payloadId: string): void;
  clear(): void;
  prepare<T>(
    payloadId: string,
    key: string,
    prepare: () => Promise<T>
  ): Promise<T>;
}

export function createProjectStepImportPayloadStore(): ProjectStepImportPayloadStore {
  const payloadsById = new Map<string, Uint8Array>();
  const preparedById = new Map<string, Map<string, Promise<unknown>>>();

  return {
    putPayload(payloadId, bytes) {
      payloadsById.set(payloadId, new Uint8Array(bytes));
      preparedById.delete(payloadId);
    },
    readPayload(payloadRef) {
      const bytes = payloadsById.get(payloadRef.payloadId);

      return bytes ? new Uint8Array(bytes) : undefined;
    },
    deletePayload(payloadId) {
      payloadsById.delete(payloadId);
      preparedById.delete(payloadId);
    },
    clear() {
      payloadsById.clear();
      preparedById.clear();
    },
    prepare<T>(
      payloadId: string,
      key: string,
      prepare: () => Promise<T>
    ): Promise<T> {
      if (!payloadsById.has(payloadId))
        return Promise.reject(
          new Error("STEP import payload is no longer available.")
        );
      let entries = preparedById.get(payloadId);
      if (!entries) {
        entries = new Map();
        preparedById.set(payloadId, entries);
      }
      const existing = entries.get(key);
      if (existing) return existing as Promise<T>;
      // Retain one preparation per live file. Document/history asset ownership is
      // separate; deleting the transient payload releases this preparation.
      entries.clear();
      const result = prepare();
      entries.set(key, result);
      void result.catch(() => {
        if (entries!.get(key) === result) entries!.delete(key);
      });
      return result;
    }
  };
}
