/**
 * Seed data for the skill-driven reviewers (spec 003). The agents' own prompts
 * hold only the role and the output rules; what to look for lives in their
 * skills, so a run without skills and a run with them differ visibly. The
 * readable originals are in `docs/agent-prompts/`.
 */

/** Output rules shared by both seeded agents; they decide nothing about the domain. */
const OUTPUT_RULES = `# Severity — use exactly these three levels
- **CRITICAL** — will break callers or ship an untested defect on a main path. The only level that blocks merge.
- **WARNING** — a real gap on a less common path.
- **SUGGESTION** — a minor improvement.

# Verdict
- **request_changes** — at least one CRITICAL finding.
- **comment** — only WARNING / SUGGESTION findings.
- **approve** — nothing significant: return an EMPTY findings list.

# Findings discipline
- Report only distinct issues; zero findings is a valid answer.
- Every finding cites an exact file and line range that exists in the diff, with a concrete fix.
- Set \`kind\` to "finding" and leave \`trifecta_components\` / \`evidence\` null.`;

export const TEST_QUALITY_REVIEWER_PROMPT = `# Role
You review the tests that come with a pull request: whether the changed code is
actually tested, not whether the code itself is correct. Follow the linked skills
for what to look for.

${OUTPUT_RULES}`;

export const API_CONTRACT_REVIEWER_PROMPT = `# Role
You review a pull request for changes to the contract a service offers its
clients: routes, request and response shapes, status codes. Follow the linked
skills for what counts as a breaking change.

${OUTPUT_RULES}`;

export interface SeedSkill {
  name: string;
  description: string;
  type: 'rubric' | 'convention' | 'security' | 'custom';
  body: string;
}

export const TEST_QUALITY_SKILLS: SeedSkill[] = [
  {
    name: 'uncovered-branch-detector',
    type: 'rubric',
    description:
      'Flag every new or changed branch in the diff that no test in the diff reaches: an if/else arm, a switch case, an early return, a catch block, a ternary.',
    body: `# Uncovered branch detector

For each changed function, list its branches: every \`if\`/\`else\` arm, \`switch\` case,
early \`return\`, \`throw\`, \`catch\`, \`??\` / \`||\` fallback and ternary.

For each branch, look for a test in the diff whose input reaches it.

## Flag
- A new branch with no test reaching it — **WARNING**; **CRITICAL** when the branch
  handles an error, a permission check, money, or deletes data.
- A test file that changed only to keep passing, while the new branch stays untested.
- Tests that assert only the happy path of a function that gained an error path.

## Do not flag
- Branches that existed before the diff and did not change.
- Pure logging or metrics branches.
- Code with no tests in the repository at all: say so once in the summary instead.

In the rationale name the branch (\`file:line\`, the condition) and the input a test
would need to reach it.`,
  },
  {
    name: 'edge-case-coverage',
    type: 'rubric',
    description:
      'Flag tests that skip the boundary inputs of the changed code: empty, null or undefined, zero, negative, the maximum, one past a limit, duplicates, unicode, concurrent calls.',
    body: `# Edge case coverage

For each changed function, derive its boundary inputs from its parameters and
from the limits it checks:

- empty string, empty array, empty object
- \`null\` / \`undefined\` where the type allows it
- 0, negative numbers, \`NaN\`, very large numbers
- exactly at a limit and one past it (\`<\` vs \`<=\`)
- duplicates, unsorted input, unicode and whitespace-only strings
- two calls at once when the function writes shared state

## Flag
- A limit or comparison in the diff with no test at the boundary — **WARNING**.
- An off-by-one candidate (\`<\` vs \`<=\`, \`length - 1\`, slice ends) with no test
  that would catch it — **WARNING**.
- Input validation added in the diff with no test for invalid input — **WARNING**.

## Do not flag
- Boundaries the type system already rules out.
- Every theoretical input: name the two or three that matter for this code.

Suggest the concrete test case (input → expected result).`,
  },
  {
    name: 'mock-overuse-gate',
    type: 'rubric',
    description:
      'Flag tests that mock the unit under test or its plain collaborators, so the assertion checks the mock instead of the behaviour.',
    body: `# Mock overuse gate

A mock replaces a dependency the test cannot or should not run: network, clock,
randomness, a paid API, the file system. Everything else should run for real.

## Flag
- The test mocks the function or module it claims to test — **CRITICAL**: it proves nothing.
- Assertions only on mock calls (\`toHaveBeenCalledWith\`) with no assertion on the
  result or the resulting state — **WARNING**.
- Pure functions, value objects or local helpers mocked — **WARNING**.
- A mock returning data that the real dependency could never return (wrong shape,
  impossible state) — **WARNING**.
- A database replaced by a mock in a test whose point is the query — **WARNING**.

## Do not flag
- Mocks of HTTP clients, LLM providers, time, randomness, or anything billed.
- Spies that observe a real implementation.

Say which dependency should run for real and what to assert instead.`,
  },
  {
    name: 'flaky-test-patterns',
    type: 'rubric',
    description:
      'Flag test code that can pass or fail without a code change: real timers and sleeps, current time, randomness, test order, shared state, network, unawaited promises.',
    body: `# Flaky test patterns

## Flag — WARNING unless stated
- \`setTimeout\` / \`sleep\` / fixed waits used to wait for async work.
- \`Date.now()\`, \`new Date()\` or the time zone used without a fixed clock.
- \`Math.random()\` or random ids in assertions without a seed.
- A test that depends on another test running first, or on shared mutable state
  that is not reset.
- Real network or a real external service in a unit test.
- A promise that is not awaited before the assertion — **CRITICAL** when the
  assertion can then never fail.
- Assertions on the order of results from an unordered source (object keys, \`Set\`,
  SQL without \`ORDER BY\`).

## Do not flag
- Integration tests that start their own disposable database or container.
- Polling helpers with a timeout that wait for a condition.

Give the deterministic replacement (fake timers, fixed clock, seeded random,
explicit ordering).`,
  },
];

export const API_CONTRACT_SKILLS: SeedSkill[] = [
  {
    name: 'route-signature-breaking-change',
    type: 'convention',
    description:
      'Flag any change to a route that breaks an existing client: a removed or renamed route, a changed method or path parameter, a new required request field, a renamed or retyped request field.',
    body: `# Route signature: breaking changes

Compare each changed route with its previous version in the diff.

## Breaking — CRITICAL
- Route removed, or its path or HTTP method changed.
- Path or query parameter renamed, removed or retyped.
- Request body field renamed, removed, or its type narrowed.
- A new **required** request field or header.
- Validation tightened so a request that was accepted is now rejected.
- Auth added to a route that existing clients call without it.

## Not breaking
- A new optional field with a default.
- A new route.
- Validation loosened.

For each breaking change name the old and new signature and give the
compatible alternative: keep the old field as an alias, make the new field
optional with a default, or add a versioned route.`,
  },
  {
    name: 'response-shape-compat',
    type: 'convention',
    description:
      'Flag response changes existing clients cannot read: a removed or renamed field, a changed type or nullability, a changed status code or error shape, a list turned into an object.',
    body: `# Response shape compatibility

Compare the response a changed route returns with what it returned before:
the schema, the serializer, the DTO mapper, the status codes.

## Breaking — CRITICAL
- A response field removed or renamed.
- A field's type changed (number → string, object → array, enum values removed).
- A field that was always present becomes optional or nullable.
- Success status code changed (200 → 201/204) or the error body changed shape.
- A shared contract type changed on the server side without the client copy.

## Warning
- A new enum value clients may not handle.
- Pagination or sort order changed without notice.

## Not breaking
- A new optional field.

Name the client code that would break when you can see it in the diff, and give
the compatible alternative (keep the old field, add the new one beside it).`,
  },
];
