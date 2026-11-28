# Experiment: API Contract Reviewer without and with skills (L02 homework)

Agent: **API Contract Reviewer**, built in the UI (setup in
`docs/demos/skills/api-contract/agent-prompt.md`), `openrouter` /
`deepseek/deepseek-v4-flash`. The system prompt is generic ("review a pull
request for problems with the API it exposes") and holds no API rules.

Target: demo PR **#14** in the fork, `refactor(settings): rename the auto reviews
setting and trim the settings response`. It renames the request field
`automatic_reviews` to `auto_reviews` in the settings contract and removes
`theme` from the `PUT /settings` response
(`docs/demos/skills-experiment/api-contract-route-change.md`).

Run on 2026-11-28, one run per variant, same PR head, same model.

| | A — no skills | B — 4 skills linked |
|---|---|---|
| Skills in the prompt | none | `breaking-change`, `response-schema`, `semver-discipline`, `deprecation-policy` (imported) |
| Skill tokens (trace) | — | 1,573 |
| Tokens in → out | 2,867 → 694 | 4,606 → 1,170 |
| Cost | $0.000462 | $0.000752 |
| Verdict / score | request_changes / 30 | request_changes / 18 |
| CRITICAL | 2 | 2 |
| WARNING | 0 | 1 |

## Findings

**A — no skills**

| Severity | File:line | Finding |
|---|---|---|
| CRITICAL | `client/src/vendor/shared/contracts/platform.ts:92` | Breaking rename of request field `automatic_reviews` to `auto_reviews` |
| CRITICAL | `server/src/modules/settings/routes.ts:38` | Silent removal of `theme` from `PUT /settings` response |

**B — with skills**

| Severity | File:line | Finding | Skill it follows |
|---|---|---|---|
| CRITICAL | `server/src/vendor/shared/contracts/platform.ts:92` | Breaking change: request field `automatic_reviews` renamed to `auto_reviews` without backward compatibility | `breaking-change` (asks for the compatible alternative) |
| CRITICAL | `server/src/modules/settings/routes.ts:38` | Breaking change: response field `theme` removed from PUT /settings without deprecation | `response-schema`, `deprecation-policy` |
| WARNING | `server/src/modules/settings/routes.ts:35` | No version bump or changelog entry for breaking changes | `semver-discipline` |

## What the skills changed

- **Both variants find the two breaking changes.** This PR's breaks are obvious
  (a renamed field and a removed field), and the model sees them from a generic
  prompt. The task's reference screenshots show a bigger gap (one warning
  against nine criticals) on a PR that moves routes; on #14 the contrast is
  smaller, and this report does not inflate it.
- **New finding with skills:** the missing version bump / changelog, which only
  `semver-discipline` asks for.
- **Better aim:** with skills the rename is cited in the server contract (the
  source of truth) instead of the client copy, and both CRITICAL findings name
  the compatible fix the skills require (keep the old field, deprecate first).
- **Cost of the rules:** +1,573 prompt tokens, +$0.00029 per run.
- **Limits:** one run per variant; run-to-run variance of this model is large
  (seen in L01), so the third finding is evidence, not proof.
