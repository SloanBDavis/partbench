import { describe, expect, it, vi } from "vitest";
import {
  emitGeometryDiagnosticEvent,
  PARTBENCH_GEOMETRY_DIAGNOSTIC_EVENT
} from "./geometryDiagnosticEvents";

describe("geometry diagnostic events", () => {
  it("emits structured app-local diagnostics without changing CAD state", () => {
    const dispatchEvent = vi.fn((event: Event) => {
      void event;
      return true;
    });

    emitGeometryDiagnosticEvent(
      { phase: "command-committed", timestamp: 42 },
      { dispatchEvent }
    );

    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event).toMatchObject({ type: PARTBENCH_GEOMETRY_DIAGNOSTIC_EVENT });
    expect((event as CustomEvent<unknown>).detail).toEqual({
      phase: "command-committed",
      timestamp: 42
    });
  });

  it("does nothing when no browser-like target is available", () => {
    expect(() =>
      emitGeometryDiagnosticEvent(
        { phase: "command-committed", timestamp: 42 },
        null
      )
    ).not.toThrow();
  });
});
