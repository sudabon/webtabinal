# session-restore Specification

## Purpose
Persists the coding-agent sessions a user had open so a daemon stop (reboot, logout, manual stop, or crash) does not lose that work, and brings those tabs back with the agent resumed on the next daemon start.

## Requirements

### Requirement: Restore snapshot records sessions with a detected agent

The daemon SHALL maintain a persisted restore snapshot listing every session whose detected agent identity is a restorable agent. Each entry SHALL record tab order, the session's live CWD, the session memo, the agent ID, and the time the entry was last observed. Sessions with no detected agent SHALL NOT appear in the snapshot. The snapshot SHALL be updated while the daemon runs, not only at shutdown, so an abrupt termination still leaves the most recently observed set on disk. Updates SHALL be written to a temporary file and moved into place so a reader never observes a partially written snapshot, and the file SHALL be owner-readable and owner-writable only. Snapshot writing SHALL NOT block PTY reads or writes.

#### Scenario: Agent session is recorded

- **WHEN** a session's detected agent is `claude` and its live CWD is `/Users/me/proj`
- **THEN** the snapshot contains an entry for that session with agent `claude`, CWD `/Users/me/proj`, its memo, and its tab order

#### Scenario: Plain shell session is not recorded

- **WHEN** a session has no detected agent
- **THEN** the snapshot contains no entry for that session

#### Scenario: Entry disappears when the agent exits

- **WHEN** a recorded session's agent exits and the session returns to a plain shell
- **THEN** the next snapshot update no longer contains an entry for that session

#### Scenario: Abrupt termination keeps the last observed snapshot

- **WHEN** the daemon is killed without running its shutdown path while an agent session exists
- **THEN** the snapshot written during operation remains on disk and describes that session

#### Scenario: Snapshot replacement is atomic

- **WHEN** the snapshot is updated
- **THEN** the previous file is replaced in a single move and a concurrent reader sees either the old or the new complete snapshot, never a truncated one

### Requirement: Daemon start restores snapshot sessions

When agent session restore is enabled, the daemon SHALL, at start and before accepting client attachments to restored sessions, recreate one session per eligible snapshot entry in the recorded order, using the recorded CWD and memo. Restore SHALL run only when the daemon has no existing sessions. A missing, unreadable, or unparsable snapshot SHALL NOT prevent the daemon from starting: the daemon SHALL log the condition and continue with no sessions. When restore is disabled, the daemon SHALL NOT create any session from the snapshot and SHALL NOT delete the snapshot.

#### Scenario: Tabs come back in order

- **WHEN** the daemon starts with a snapshot holding three eligible entries
- **THEN** three sessions exist in the recorded order, each at its recorded CWD and carrying its recorded memo

#### Scenario: Restore disabled creates nothing

- **WHEN** restore is disabled and the daemon starts with a non-empty snapshot
- **THEN** no session is created from the snapshot and the snapshot file is left in place

#### Scenario: Unreadable snapshot does not block startup

- **WHEN** the snapshot file is corrupt or cannot be parsed at start
- **THEN** the daemon logs the failure, creates no restored session, and continues serving normally

### Requirement: Resume command is resolved per agent

The daemon SHALL resolve a resume command from the entry's agent ID using a built-in table with `claude` → `claude --continue`, `codex` → `codex resume --last`, and `cursor-agent` → `cursor-agent resume`. Configuration SHALL override the command for an agent ID, and an explicitly configured empty command SHALL disable restore for that agent. An agent ID with neither a built-in nor a configured command SHALL be skipped. A resolved command SHALL be rejected when it is empty after trimming, contains a carriage return or line feed, or exceeds 512 characters; a rejected command SHALL be logged and its entry skipped.

#### Scenario: Built-in command is used

- **WHEN** an eligible entry has agent `codex` and no configured override
- **THEN** the restored session runs `codex resume --last`

#### Scenario: Configured command overrides the built-in

- **WHEN** configuration maps `claude` to `claude --resume` and an eligible entry has agent `claude`
- **THEN** the restored session runs `claude --resume`

#### Scenario: Empty configured command disables that agent

- **WHEN** configuration maps `cursor-agent` to an empty string and an entry has agent `cursor-agent`
- **THEN** no session is created for that entry

#### Scenario: Unmapped agent is skipped

- **WHEN** an entry has an agent ID with no built-in and no configured command, such as `generic`
- **THEN** no session is created for that entry

#### Scenario: Multi-line command is rejected

- **WHEN** a configured command contains a line feed
- **THEN** the daemon logs the rejection and creates no session for entries using that agent

### Requirement: Resume command runs after the shell is ready

A restored session SHALL NOT receive its resume command until its shell reports a prompt, and SHALL send the command after a bounded fallback wait of at most 2000 ms when no prompt signal arrives. The command SHALL be sent to the session as if typed, followed by a newline so it executes.

#### Scenario: Command waits for the prompt

- **WHEN** a restored session's shell emits its first prompt signal
- **THEN** the resume command and a newline are written to that session

#### Scenario: Shell without integration still resumes

- **WHEN** a restored session emits no prompt signal within the fallback wait
- **THEN** the resume command and a newline are written once the fallback wait elapses

#### Scenario: Command is not sent twice

- **WHEN** a restored session emits a prompt signal after its resume command was already sent
- **THEN** no further resume command is written to that session

### Requirement: Same agent and directory resumes only once

When more than one eligible entry shares the same agent ID and CWD, the daemon SHALL execute the resume command only for the first such entry in recorded order. Each remaining entry SHALL still be restored as a session at that CWD with its memo, and its resume command SHALL be written to the session without a trailing newline so the user decides whether to run it.

#### Scenario: Second tab in the same directory is staged

- **WHEN** two eligible entries both have agent `claude` and CWD `/Users/me/proj`
- **THEN** the first restored session executes `claude --continue` and the second has that command placed on its input line without executing it

### Requirement: Restore eligibility is bounded

An entry SHALL be skipped when its recorded CWD does not exist as a directory. When the configured maximum age is greater than zero, an entry last observed longer ago than that maximum SHALL be skipped. At most the configured maximum number of entries SHALL be restored, taking them in recorded order. Every skipped entry SHALL be logged with the reason.

#### Scenario: Deleted project directory is skipped

- **WHEN** an eligible-looking entry records a CWD that no longer exists
- **THEN** no session is created for it and the skip is logged

#### Scenario: Stale entry is skipped

- **WHEN** the maximum age is 72 hours and an entry was last observed 100 hours ago
- **THEN** no session is created for it

#### Scenario: Entry count is capped

- **WHEN** the maximum session count is 8 and the snapshot holds 12 eligible entries
- **THEN** the first 8 entries in recorded order are restored and the remaining entries are skipped and logged

### Requirement: Restoring does not repeat on the next start

After a restore pass, the snapshot SHALL reflect the daemon's live sessions, so a subsequent start restores the sessions that were still running agents rather than replaying the previous snapshot. An entry whose resume command failed to leave a detected agent running SHALL NOT be restored again on the next start.

#### Scenario: Two restarts do not multiply tabs

- **WHEN** the daemon restores two agent sessions, both keep their agent running, and the daemon is restarted again
- **THEN** exactly two sessions are restored, not four

#### Scenario: Failed resume drops out

- **WHEN** a restored session's resume command exits immediately and no agent is detected in it
- **THEN** the next snapshot update drops that entry and the following daemon start does not restore it
