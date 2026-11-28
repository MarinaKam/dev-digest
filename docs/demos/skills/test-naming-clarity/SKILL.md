---
name: test-naming-clarity
description: >
  Flag test names that do not state the behaviour under test and the expected
  outcome. A good test name reads as a sentence: the unit, the condition, and
  the result, for example "applyDiscount clamps percent above 100 to 100".
  Flag names that only repeat a function name ("test applyDiscount"), names
  that say "works" or "should work", names that describe the implementation
  instead of the behaviour, and names that do not match what the test asserts.
  Do not flag names that are clear in their file's context, and do not flag
  the style of a suite that already follows another consistent convention.
  Suggest a replacement name for each flagged test.
license: MIT
---

# Test naming clarity

Read each new or changed test name in the diff together with the assertions in
its body. The name is the first thing a reviewer reads when a test fails, so it
must say what behaviour is checked and what outcome is expected.

## Flag
- A name that only repeats the function under test, with no condition or
  outcome (`test applyDiscount`, `it('works')`) — **WARNING**.
- A name that states a vague result (`should work`, `handles input`,
  `is correct`) — **WARNING**.
- A name that describes the implementation (`calls repo.save twice`) when the
  test asserts observable behaviour — **SUGGESTION**.
- A name whose claim does not match the assertions (the name says "rejects
  negative prices", the test only checks the happy path) — **WARNING**.
- Two tests in the diff with the same name in the same suite — **WARNING**.

## Do not flag
- Names that already state the unit, the condition and the expected result.
- Short names in a suite where every sibling test follows the same pattern and
  the file's context makes the behaviour obvious.
- Naming of helper functions and fixtures that are not tests.

## What to suggest
Give a replacement name in the form "<unit> <condition> <expected outcome>",
and quote the assertion it matches. Keep the suggestion to one line per test.
