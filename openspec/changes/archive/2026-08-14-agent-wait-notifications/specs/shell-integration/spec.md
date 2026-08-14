## ADDED Requirements

### Requirement: Parse OSC 9 and OSC 99 for notifications

The daemon SHALL parse PTY output for OSC 9 (iTerm2 Growl; payload after `9;`) and OSC 99 (Kitty desktop notification; `p=title` / `p=body` when present, otherwise the payload after the last `;`). Empty title and body SHALL produce no event. These sequences SHALL still be forwarded to the client terminal stream. Parsing them SHALL NOT change session CWD, command, or idle/running state.

#### Scenario: OSC 9 yields a notify event

- **WHEN** the PTY emits `ESC ] 9 ; Codex needs approval BEL`
- **THEN** the parser produces a notify event whose body is `Codex needs approval` and the session remains `running` if it was running

#### Scenario: OSC 99 uses title and body params

- **WHEN** the PTY emits an OSC 99 sequence with `p=title` `Claude Code` and `p=body` `Permission required`
- **THEN** the parser produces a notify event with title `Claude Code` and body `Permission required`

#### Scenario: Empty OSC 9 is ignored

- **WHEN** the PTY emits `ESC ] 9 ; BEL`
- **THEN** no notify event is produced
