import { describe, expect, it } from "vitest";
import { reconcileNumericInputOnBlur } from "./NumericInput";

describe("NumericInput", () => {
  it("reconciles valid focused text to the latest external value on blur", () => {
    const input = { value: "12" };
    reconcileNumericInputOnBlur(input, -3);
    expect(input.value).toBe("-3");
  });
});
