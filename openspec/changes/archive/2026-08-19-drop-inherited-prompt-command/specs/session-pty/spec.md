## ADDED Requirements

### Requirement: Session environment excludes inherited shell-integration hooks

A session's environment SHALL NOT carry a `PROMPT_COMMAND` inherited from the daemon's own environment. The daemon MAY be started from a terminal emulator whose shell integration exports `PROMPT_COMMAND`, and that hook's defining function is never available inside a WebTabinal session. Every other inherited environment variable SHALL be passed through unchanged.

A `PROMPT_COMMAND` that the user's own shell startup files set SHALL be unaffected, because it is established after the session shell starts. The WebTabinal shell integration SHALL continue to preserve and invoke such a value.

#### Scenario: Inherited hook is dropped

- **WHEN** the daemon is started from a terminal that exports `PROMPT_COMMAND` naming its own integration function, and a session is created
- **THEN** the session shell does not receive that `PROMPT_COMMAND` and no `command not found` error is printed at the prompt

#### Scenario: Unrelated environment is preserved

- **WHEN** the daemon's environment contains variables other than `PROMPT_COMMAND`
- **THEN** the session shell receives them unchanged

#### Scenario: User's own prompt command still runs

- **WHEN** the user's shell startup files set `PROMPT_COMMAND` to their own function
- **THEN** the WebTabinal shell integration preserves it and invokes it on each prompt
