#!/usr/bin/env bash
# PreToolUse hook of the pr-self-review skill.
#
# Claude Code runs this before every shell command of the agent and passes the tool call
# as JSON on stdin. Exit 0 lets the command run. Exit 2 blocks it; the text on stderr is
# shown to the agent as the reason.
#
# Only a push, a pull request creation and a pull request merge are checked: they need a
# passing self-review recorded for the exact committed change. The decision is in gate.mjs.
exec node "$(dirname "${BASH_SOURCE[0]}")/gate.mjs" hook
