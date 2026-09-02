import { describe, expect, it } from "vitest";
import { isUiSmokeEnabled } from "./uiSmokeHook";

describe("uiSmokeHook", () => {
  it("enables only the smoke query flag", () => {
    expect(isUiSmokeEnabled("")).toBe(false);
    expect(isUiSmokeEnabled("?foo=1")).toBe(false);
    expect(isUiSmokeEnabled("?ui-smoke=1")).toBe(true);
    expect(isUiSmokeEnabled("ui-smoke=true")).toBe(true);
    expect(isUiSmokeEnabled("?ui-smoke=0")).toBe(false);
  });
});
