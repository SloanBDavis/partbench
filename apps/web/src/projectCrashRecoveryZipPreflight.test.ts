import { describe, expect, it } from "vitest";
import { CadEngine, exportCadProjectWcad } from "@web-cad/cad-core";
import { PROJECT_CRASH_RECOVERY_LIMITS } from "./projectCrashRecoveryLimits";
import { preflightRecoveryWcadZip } from "./projectCrashRecoveryZipPreflight";

describe("V22 recovery ZIP preflight", () => {
  it("accepts an ordinary .wcad v2 package before the reader", async () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_recovery_preflight",
        name: "Profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_recovery_preflight",
        id: "rect_recovery_preflight",
        center: [0, 0],
        width: 2,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "feat_recovery_preflight",
        bodyId: "body_recovery_preflight",
        sketchId: "sketch_recovery_preflight",
        entityId: "rect_recovery_preflight",
        depth: 1
      }
    ]);
    const exported = await exportCadProjectWcad(engine);
    const result = preflightRecoveryWcadZip(exported.bytes);
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.byteLength).toBe(exported.bytes.byteLength);
      expect(result.entryCount).toBeGreaterThan(0);
      expect(result.entryCount).toBeLessThanOrEqual(
        PROJECT_CRASH_RECOVERY_LIMITS.zipEntries
      );
    }
  });

  it("rejects packages over 512 MiB without calling a ZIP reader", () => {
    const bytes = { byteLength: 512 * 1024 * 1024 + 1 } as Uint8Array;
    const result = preflightRecoveryWcadZip(bytes);
    expect(result).toMatchObject({
      ok: false,
      code: "RECOVERY_PACKAGE_TOO_LARGE"
    });
  });

  it("rejects a ZIP whose EOCD claims more than 12,300 entries", () => {
    const bytes = new Uint8Array(22);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, 12_301, true);
    view.setUint16(10, 12_301, true);
    expect(preflightRecoveryWcadZip(bytes)).toMatchObject({
      ok: false,
      code: "RECOVERY_ZIP_ENTRY_COUNT"
    });
  });

  it("rejects a central-directory entry over 128 MiB", () => {
    const bytes = new Uint8Array(46 + 22);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint32(20, 128 * 1024 * 1024 + 1, true);
    view.setUint32(24, 128 * 1024 * 1024 + 1, true);
    view.setUint32(46, 0x06054b50, true);
    view.setUint16(46 + 8, 1, true);
    view.setUint16(46 + 10, 1, true);
    view.setUint32(46 + 12, 46, true);
    view.setUint32(46 + 16, 0, true);
    expect(preflightRecoveryWcadZip(bytes)).toMatchObject({
      ok: false,
      code: "RECOVERY_ZIP_ENTRY_TOO_LARGE"
    });
  });

  it("rejects truncated garbage before the ordinary reader", () => {
    expect(preflightRecoveryWcadZip(new Uint8Array([1, 2, 3]))).toMatchObject({
      ok: false,
      code: "RECOVERY_ZIP_INVALID"
    });
  });
});
