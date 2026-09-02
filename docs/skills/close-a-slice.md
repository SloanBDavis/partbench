# Close a slice

A slice is done when:

1. The named closer is green. Run that command only. Do not rerun V7-V22 gauntlets. No Playwright.
2. The user-goal increment is visible via a `scenarios/` CADOps
   scenario and its semantic diffs.
3. If the slice has UI, smoke:ui must be green on the new scenarios (bun + chrome force). On fail: scenario id, screenshot under .metrics/ui-smoke/, on-screen diagnostic. If you cannot demonstrate it in the running app via smoke:ui, you are not done. See ui-smoke.md.
The V25 named closer keeps in-process scenarios and the vitest pair, and adds smoke:ui on the V25-added scenarios (never zero UI).
Gzip ceilings are not a veto.

Land on main as Sloan Davis <sloanbdavis@gmail.com>. Never open pull
requests.

If the slice closes a release, record the SHA in the user-goal doc.
Do not invent the next release.
