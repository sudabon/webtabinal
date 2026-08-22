## ADDED Requirements

### Requirement: Claude Code background execution holds the working state

The `claude` manifest SHALL declare a `working` screen pattern that matches Claude Code's background-execution line. That line has been captured in the form `✻ Churned for 30m 19s · 2 shells still running`. The pattern SHALL require both the status glyph `✻` and the suffix `still running`, and SHALL tolerate variable portions of the line including the verb, elapsed duration, count, and noun (`shells`, `shell`, `local agent`, and similar). The pattern SHALL NOT match a completed-turn summary that has the `✻` glyph and a duration but does not include `still running`.

While the background-execution line is present in the selected screen region, the session's agent state SHALL be `working` even when an idle prompt pattern also matches on the same screen, because the existing state priority evaluates `working` before `idle`.

The pattern SHALL be derived from the captured screen of a named Claude Code version or from a synthetic fixture that embeds that captured line, and that version SHALL be recorded in the manifest's `verified_against` list.

This requirement SHALL apply to the `claude` manifest only. Manifests for other agents SHALL be unchanged.

#### Scenario: Background task keeps the session working

- **WHEN** a Claude Code session renders `✻ Churned for 30m 19s · 2 shells still running` and its input prompt on the same screen
- **THEN** the agent state is `working` and its signal is `screen`

#### Scenario: Background completion returns the session to idle

- **WHEN** a Claude Code session's background-execution line disappears, only the input prompt remains, and the screen has been quiet for the manifest's quiescence window
- **THEN** the agent state becomes `idle`

#### Scenario: Completed-turn summary without still running stays idle

- **WHEN** a Claude Code session renders `✻ Churned for 30m 19s` without `still running`, together with its input prompt
- **THEN** the background-execution pattern does not match and the agent state is `idle`

#### Scenario: Approval prompt outranks background execution

- **WHEN** a Claude Code session renders both its background-execution line and an approval prompt
- **THEN** the agent state is `blocked`

#### Scenario: Background pattern does not match ordinary output

- **WHEN** a Claude Code session at its input prompt has scrollback or command output that does not contain the background-execution line
- **THEN** the background-execution pattern does not match and the state resolves without it

#### Scenario: Other agents are unaffected

- **WHEN** a Codex or cursor-agent session is evaluated
- **THEN** its manifest contains no background-execution pattern and its state resolves exactly as before this change
