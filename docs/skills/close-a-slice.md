# Close a slice

1. Typecheck and lint the change.
2. Run the affected consolidated E2E journey: `pnpm test:e2e -- assembly`,
   `interchange`, or `agent`. Extend an existing journey for new behavior.
3. UI changes require actual controls, an observable result, a screenshot, and
   one invalid-input or wrong-pick case. `applyOps` is fixture setup/diagnosis.
4. Run `pnpm verify` before landing and record actual results and limitations.

Only E2E tests. Never add unit/component/isolated integration tests. Do not replay
historical gates. Large engine, robot arm and gearbox journeys are targeted
checks when those workflows change; see [verification.md](../verification.md).

Land on main as Sloan Davis <sloanbdavis@gmail.com>. Never open pull requests.
