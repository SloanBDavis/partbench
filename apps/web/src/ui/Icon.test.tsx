import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("is decorative by default", () => {
    const markup = renderToStaticMarkup(
      createElement(Icon, { name: "extrude" })
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('focusable="false"');
    expect(markup).not.toContain("<title");
  });

  it("uses a title as its accessible name when semantic", () => {
    const markup = renderToStaticMarkup(
      createElement(Icon, { name: "warning", label: "Warning", size: 20 })
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain("<title");
    expect(markup).toContain(">Warning</title>");
    expect(markup).toContain('width="20"');
    expect(markup).not.toContain('aria-hidden="true"');
  });
});
