import { describe, expect, it } from "vitest";
import { runCleanupActions } from "./runCleanupActions";

describe("runCleanupActions", () => {
  it("runs every cleanup action and rethrows the first failure", () => {
    const calls: string[] = [];
    const firstFailure = new Error("first cleanup failure");

    expect(() =>
      runCleanupActions([
        () => {
          calls.push("first");
          throw firstFailure;
        },
        () => {
          calls.push("second");
          throw new Error("second cleanup failure");
        },
        () => {
          calls.push("third");
        }
      ])
    ).toThrow(firstFailure);
    expect(calls).toEqual(["first", "second", "third"]);
  });

  it("completes silently when every cleanup action succeeds", () => {
    const calls: string[] = [];

    expect(() =>
      runCleanupActions([() => calls.push("first"), () => calls.push("second")])
    ).not.toThrow();
    expect(calls).toEqual(["first", "second"]);
  });
});
