# Control experiment: Test Quality Reviewer, happy-path PR

Demo PR against `server/`. It adds one pure helper and a Vitest file that tests
only one happy-path input. The Test Quality Reviewer with its linked skills
(`uncovered-branch-detector`, `edge-case-coverage`, `mock-overuse-gate`,
`flaky-test-patterns`) should flag the untested branches and edge cases below.
The branch `demo/test-quality-happy-path` holds these two files on top of `main`
(the `skills` module does not exist there, so the helper sits in `pulls/`).

## File 1: `server/src/modules/pulls/discount.ts` (new)

```ts
/**
 * Applies a percentage discount to a price.
 * Percent above 100 is clamped to 100, so the result is never negative.
 * Throws for a negative price.
 */
export function applyDiscount(price: number, percent: number): number {
  if (price < 0) {
    throw new RangeError('price must not be negative');
  }
  const clamped = percent > 100 ? 100 : percent;
  return price - (price * clamped) / 100;
}
```

## File 2: `server/test/demo-discount.test.ts` (new)

```ts
import { describe, it, expect } from 'vitest';
import { applyDiscount } from '../src/modules/pulls/discount.js';

describe('applyDiscount', () => {
  it('applies a 10 percent discount to a positive price', () => {
    expect(applyDiscount(200, 10)).toBe(180);
  });
});
```

## Untested by this PR (expected reviewer findings)

- **Branch `percent > 100` (`discount.ts`, the ternary)**: no test reaches it.
  `uncovered-branch-detector` should flag it as WARNING. Input needed:
  `applyDiscount(200, 150)`, expected `0`.
- **Branch `price < 0` (`discount.ts`, the `throw`)**: no test reaches it. It is an
  error path, so `uncovered-branch-detector` should flag it as CRITICAL. Input
  needed: `applyDiscount(-1, 10)`, expected a `RangeError`.
- **Boundary `percent = 100`**: not tested. `edge-case-coverage` should flag the
  limit as WARNING. Input: `applyDiscount(50, 100)`, expected `0`.
- **Boundary `percent = 0` and `price = 0`**: not tested. `edge-case-coverage`
  should flag as WARNING. Inputs: `applyDiscount(0, 10)` expected `0`;
  `applyDiscount(80, 0)` expected `80`.
- **Negative `percent`**: the code neither clamps nor rejects it, so
  `applyDiscount(100, -10)` returns `110`. No test covers it. `edge-case-coverage`
  should flag the missing validation as WARNING. This is a finding about the
  behaviour itself, not only the test.
- **Mocks and timing**: the test mocks nothing and uses no clock or randomness,
  so `mock-overuse-gate` and `flaky-test-patterns` should report nothing. A
  reviewer that flags this test on either rule is over-reporting, which is the
  control result to check for.

## What a correct run looks like

- Findings: at least the uncovered throw branch (CRITICAL) and the uncovered
  clamp branch (WARNING). The verdict is `request_changes` because of the CRITICAL.
- No finding about the happy-path assertion itself, and no mock or flakiness
  finding.
