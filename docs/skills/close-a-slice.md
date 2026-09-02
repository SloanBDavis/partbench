# Close a slice

A slice is done when:

1. The named closer is green. Run that command only. Do not rerun V7-V25 gauntlets. No Playwright.
2. The user-goal increment is visible via a `scenarios/` CADOps scenario and its semantic diffs. Command truth.
3. If the slice has UI:
   - `smoke:ui` green on the new scenarios (engine `applyOps` in the real app).
   - Use path green: clicks/typed fields for THIS feature, success screenshot, break case. See [use-the-feature.md](./use-the-feature.md). Injecting `applyOps` is not Use.
4. Proof lives in [docs/verification.md](../verification.md).

Gzip ceilings are not a veto. The V25 named closer is completed history; do not reopen V22-V25. Do not invent V26.

Land on main as Sloan Davis <sloanbdavis@gmail.com>. Never open pull requests.

If the slice closes a release, record the SHA in the user-goal doc.
Do not invent the next release.
