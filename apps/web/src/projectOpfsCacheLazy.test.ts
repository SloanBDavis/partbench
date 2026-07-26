import { describe, expect, it } from "vitest";
import {
  clearLazyProjectOpfsCache,
  readLazyProjectOpfsCacheStatus
} from "./projectOpfsCacheLazy";

describe("lazy project OPFS cache", () => {
  it("translates a read module-load rejection into visible error status", async () => {
    const status = await readLazyProjectOpfsCacheStatus({}, {}, async () => {
      throw new Error("chunk unavailable");
    });

    expect(status).toMatchObject({
      state: "error",
      available: false,
      diagnostics: [
        {
          code: "OPFS_HANDLE_FAILED",
          severity: "error",
          detail: "chunk unavailable"
        }
      ],
      lastResult: "OPFS cache status could not be loaded."
    });
  });

  it("translates a clear module-load rejection into visible error status", async () => {
    const status = await clearLazyProjectOpfsCache({}, async () => {
      throw new Error("chunk unavailable");
    });

    expect(status).toMatchObject({
      state: "error",
      available: false,
      diagnostics: [
        {
          code: "OPFS_CLEAR_FAILED",
          severity: "error",
          detail: "chunk unavailable"
        }
      ],
      lastResult: "OPFS cache clear could not be loaded."
    });
  });
});
