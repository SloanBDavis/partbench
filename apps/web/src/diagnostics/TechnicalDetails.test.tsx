import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TechnicalDetails } from "./TechnicalDetails";

describe("TechnicalDetails", () => {
  it("renders debugging data inside a closed, subordinate disclosure", () => {
    const markup = renderToStaticMarkup(
      createElement(TechnicalDetails, {
        diagnostic: {
          code: "PRIVATE_DIAGNOSTIC_CODE",
          context: { stableId: "generated:face:one" }
        }
      })
    );

    expect(markup).toContain("<details");
    expect(markup).not.toContain("<details open");
    expect(markup).toContain("<summary");
    expect(markup).toContain("Technical Details</summary>");
    expect(markup).toContain("PRIVATE_DIAGNOSTIC_CODE");
    expect(markup).toContain("Copy details");
  });
});
