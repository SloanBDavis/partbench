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
});
