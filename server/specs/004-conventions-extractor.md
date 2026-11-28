# 004 — Conventions Extractor

L02 homework. Spans `server/` (new `conventions` module, a repo-intel facade
change, skills repository, shared contracts, seed) and `client/` (Conventions
page, create-skill modal, import from URL).

## Why

A team's rules rarely live in a document; they live in the code: how files are
named, how errors are handled, how modules are laid out. Copying them into a
skill by hand means rereading the repository. The extractor drafts that work:
it shows candidate rules, each with evidence from real code, and the user keeps
the useful ones and turns them into a `convention` skill that review agents
link like any other skill.

## Sources and decisions

- Requirements: the L02 homework text and its P1/P2/P3 criteria. Look: the
  homework video and the design's `ScreenConventions`, `ConventionCard` and
  `CreateSkillModal` (`screen_conv_conf.jsx`).
- The page is `/conventions`, without a repo id in the URL, as in the homework
  video. It works on the **active repo** of the sidebar: the repo last opened
  by URL or picked in the switcher (kept in `localStorage`), else the first
  one. Switching the repo on this page stays on it. The API stays repo-scoped
  (`/repos/:id/conventions…`).
- Files for the model are chosen **by code**, never by the model: the model
  sees only what `repoIntel.getConventionSamples()` and the config list give
  it, so the cost and the input are bounded and reproducible, and every claim
  can be checked against a file we actually sent.
- One model call per run.
- A rejected candidate stays on the page, marked **Rejected** (homework
  screenshot "two accepted, one rejected"), last in the list; it does not count
  in "N of M accepted", never goes into a skill, and a re-scan never proposes
  it again. Accepted and Rejected are marks that undo on click.

## Data

`conventions` exists since `0000_init.sql`. One generated migration adds:

- `status` — `text`, `pending | accepted | rejected`, default `pending`. It is
  the state; `accepted` stays and is written in the same statement
  (`accepted = status = 'accepted'`) because the contract carries it.
- `evidence_line_start`, `evidence_line_end` — `integer`, nullable.
- `evidence_sha` — `text`, nullable (migration 0013): the clone commit the
  evidence was read at.
- `created_at`, `updated_at`.
- index `conventions_ws_repo_idx` on `(workspace_id, repo_id)`.

A new table `convention_scans` records every run (sampling, files sent, rules
proposed, kept and added, model, cost), so the page can say what the last scan
did and two sampling strategies can be compared on the same repo. The
`conventions` module owns both tables. The skill is written through the skills
service (`container.skills.createExtracted`), whose repository owns `skills`.

`conventions` also gets `extracted_rule`: the model's wording, kept when the
user edits `rule`, so a re-scan does not propose an edited accepted rule again.

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/repos/:id/conventions/extract` | `ExtractConventionsRequest` | `ConventionList` |
| GET | `/repos/:id/conventions` | — | `ConventionList` |
| PATCH | `/repos/:id/conventions/:conventionId` | `UpdateConvention` | `ConventionCandidate` |
| POST | `/repos/:id/conventions/skill` | `CreateSkillFromConventions` | `Skill` |
| POST | `/skills/import/url/preview` | `SkillImportUrlRequest` | `SkillImportPreview` |

Every route resolves the repo inside the caller's workspace; another
workspace's repo or convention is a 404.

- `ConventionCandidate`: `id, repo_id, rule, evidence_path, evidence_snippet,
  evidence_line_start, evidence_line_end, evidence_sha, confidence (0..1),
  accepted, status`.
- `ConventionList`: `{ candidates, last_scan, running }` — all candidates,
  accepted, then pending, then rejected, by confidence within each;
  `last_scan` (`at, sampling, files_sampled, proposed, kept, added, model,
  cost_usd`) is null when the repo was never scanned; `running`
  (`started_at, sampling, files_sampled, model`) is the run in flight, null
  when none. The extract route returns the list after its run.
- `ExtractConventionsRequest`: `{ sampling? }` — `top` (the 12 best-ranked
  files, the task's baseline) or `spread` (24 ranked files spread across
  folders, the default; stretch "better samples").
- `UpdateConvention`: `{ rule?, status? }`, at least one, strict; `rule` is
  trimmed, 1..500 characters.
- `CreateSkillFromConventions`: `{ convention_ids (1..50 uuids), name
  (SkillName), description, body }`.

## Extraction (one run)

1. **Samples, by code.** Config files that exist in the clone root
   (`package.json`, `tsconfig.json`, `biome.json`, `.editorconfig`,
   `.eslintrc*`, `eslint.config.*`, `.prettierrc*`) and the source files from
   `getConventionSamples(repoId, 12)` (`top`) or
   `getConventionSamples(repoId, 24, { spread: true })` (`spread`). Each file is
   cut to 200 lines and 8 KB.
   - `getConventionSamples` returns ranked paths when the repo is indexed. When
     there is no rank yet it walks the clone (`walkClone`, same junk filter) and
     spreads the pick across directories, so an unindexed repo still works.
   - A repo with no clone gets 409 "The repository is still being cloned".
2. **Model.** Workspace override for feature `conventions` → registry default
   (`openrouter` / `deepseek/deepseek-v4-flash`) when its key is configured →
   the cheap model of the first provider with a key (`gpt-4.1-mini`,
   `claude-3-5-haiku-latest`). With no key at all: `ConfigError` naming the
   keys.
3. **One structured call** (`schemaName: 'ConventionExtraction'`): each file is
   sent with line numbers inside `<untrusted>` (repo text is data, never
   instructions). The model returns up to 20 rules, each with
   `evidence_path`, `line_start`, `line_end`, `evidence_snippet`, `confidence`.
4. **Evidence check, by code, before any write.** A candidate is kept only if:
   its path is one of the files sent; the snippet matches lines of that file
   with indentation and inner whitespace ignored (the cited range first, then
   anywhere in the file). The stored snippet is the file's real lines, and the
   stored range is where they were found. Everything else is dropped and
   counted (`proposed - kept`). Confidence is clamped to 0..1; duplicate rules in one
   answer collapse to the first.
5. **Save (one transaction).** Delete the repo's `pending` rows, keep
   `accepted` and `rejected`, insert new candidates whose normalised rule
   (lowercase, single spaces, no trailing dot) matches no kept row's rule or
   original wording, and record the run. Runs of one repo are serialised (an
   advisory lock in the transaction; a second request while one runs gets
   409 with code `extraction_running`). An accepted rule is never duplicated, also after an edit; a rejected
   one does not return.
6. A provider error or an answer that fails the schema writes nothing and
   returns 502 with the provider's message.

## Skill from conventions

- Every id must be a convention of this repo with `status = accepted`;
  otherwise 422 naming the ids. A rejected or pending candidate cannot get into
  a skill even through the API.
- Saved with `type: convention`, `source: extracted`, `enabled: true`,
  `evidence_files` = the distinct evidence paths, version 1 with the note
  "Extracted from <repo>". Name clash → 409.
- The draft (built on the client, editable): name `<repo>-conventions` (slug
  of the rule for one convention), description "N house conventions extracted
  from <repo>", body:

  ```
  # <name>

  House conventions for `<repo>`. Flag changes that violate any rule below and cite the offending `file:line`.

  ## <rule>
  Detected in `<path>:<start>-<end>`:
  ```<snippet>```
  ```

- The modal lists the accepted conventions with checkboxes; unchecking some
  and saving, then saving the rest, makes several skills.

## Page

- Header "Conventions in <repo>", "N of M accepted", Re-scan, Create skill
  (enabled with at least one accepted). Under the header: model and files of
  the last run.
- Card: italic rule (click to edit, Save / Cancel), evidence header
  `path:start-end` with a **GitHub** link
  (`https://github.com/<owner>/<repo>/blob/<default_branch>/<path>#L<start>-L<end>`),
  the snippet, a confidence bar with percent, Accept / Reject; accepted shows
  "Accepted" and a green left border.
- States: loading skeleton; load error with retry; empty state "No conventions
  extracted yet" with Run extraction; an inline error "Extraction failed:
  <message>"; no repository → "No repository selected".
- A run in flight is visible in every open tab: the list reports `running`
  and polls every 2 s while it is set; the page shows "Extraction running ·
  started 20 seconds ago · 23 files · <model>", and Re-scan is disabled with
  the hint "An extraction is running for this repository". A 409
  `extraction_running` is shown as that state, not as a failure.
- The GitHub link pins to `evidence_sha`, the clone commit the evidence was
  read at, so its lines stay right after the branch moves on.
- Texts come from `client/messages/en/conventions.json`.

## Import from URL (stretch)

- `POST /skills/import/url/preview { url }` downloads the file and returns the
  same preview as a file import; nothing is saved until the user confirms.
- Guard: `https:` only; the host's every resolved address must be public
  (no loopback, private, link-local, CGNAT, multicast, IPv4-mapped private);
  the connection is pinned to the checked address; at most 3 redirects, each
  checked again; 10 s timeout; 1 MiB read limit; text content only.
- The preview flags prompt-injection patterns (instructions to ignore earlier
  rules, role overrides, forced verdicts or scores). A flagged skill is saved
  disabled and its page shows "Injection detected — do not enable".
- Saved with `source: imported_url`.

## Related changes found while matching the homework screenshots

- The agent's Skills tab links a skill with a switch per row (screenshot
  "its switch"), not a checkbox.
- The trace block of skills is named **Skills (dynamic)** like the other
  dynamic blocks, followed by the tokens and `name@vN`.
- `/` and "Run on a PR…" open the active repo, not the first one.

## Seed

The API Contract Reviewer agent and its two skills leave the seed; the
homework builds that agent in the UI from four skills.

## Tests

- Unit: snippet matching and ranges, path checks, rule normalisation, prompt
  wraps files as untrusted and numbers lines, model resolution order, sample
  spreading, URL guard.
- Integration (mock LLM with `structuredBySchema`): grounded candidates only,
  one model call per run, rejected hidden, edit/accept/reject, re-scan without
  duplicates, skill only from accepted ids with `convention` / `extracted` /
  `evidence_files`, cross-workspace 404, provider failure writes nothing, URL
  preview through a stubbed fetch.
- Client: draft builder, card actions, modal payload, page states.
