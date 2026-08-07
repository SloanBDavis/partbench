import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewportCandidateList } from "./ViewportCandidateList";

describe("ViewportCandidateList", () => {
  it("renders bounded keyboard candidates without private identity", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCandidateList, {
        index: 1,
        rows: ["Face · Bracket · Visible", "Edge · Bracket · Occluded"],
        limited: false,
        choose: () => undefined,
        capped: true
      })
    );

    expect(markup).toContain('aria-keyshortcuts="N"');
    expect(markup).toContain('aria-label="Candidates"');
    expect(markup).toContain('selected=""');
    expect(markup).toContain("Occluded");
    expect(markup).toContain("64 max");
    expect(markup).not.toContain("snapshot-local");
  });

  it("announces the active candidate index/count in a live region", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCandidateList, {
        index: 1,
        rows: [
          "1 of 2 · Face · Bracket · Visible",
          "2 of 2 · Edge · Bracket · Occluded"
        ],
        limited: false,
        capped: false,
        announcement:
          "Edge 2 of 2, Bracket, occluded. Inspect only: no saved edge.",
        choose: () => undefined
      })
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Edge 2 of 2, Bracket, occluded.");
    expect(markup).toContain("Inspect only: no saved edge.");
    expect(markup).not.toContain("1 of 1");
    expect(markup).not.toContain("snapshot-local");
  });

  it("reports resource fallback without a fabricated candidate", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCandidateList, {
        index: 0,
        rows: [],
        limited: true,
        capped: false,
        choose: () => undefined
      })
    );
    expect(markup).toContain("Limit");
    expect(markup).toContain("select body");
    expect(markup).not.toContain("<select");
  });

  it("keeps candidate rows keyboard-operable through the native select", () => {
    const markup = renderToStaticMarkup(
      createElement(ViewportCandidateList, {
        index: 0,
        rows: [
          "1 of 2 · Face · Bracket · Visible",
          "2 of 2 · Edge · Bracket · Visible"
        ],
        limited: false,
        capped: false,
        choose: () => undefined
      })
    );

    expect(markup).toContain("<select");
    expect(markup).toContain('size="2"');
    expect(markup.match(/<option/g)?.length).toBe(2);
    expect(markup).toContain('aria-keyshortcuts="N"');
  });
});
