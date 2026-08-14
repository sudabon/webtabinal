## ADDED Requirements

### Requirement: Inject bash OSC integration without a user rc snippet

When the configured shell’s basename is `bash`, the daemon SHALL write `integration.bash` and a bash inject rcfile under Application Support, spawn the session so that rcfile is used as bash `--rcfile`, and load OSC integration without requiring a one-liner in the user’s `~/.bashrc` or profile. The integration script SHALL no-op unless `WEBTABINAL_SESSION_ID` is set. Non-bash shells SHALL NOT use this bash inject path.

#### Scenario: Bash integration files are written on start

- **WHEN** the daemon starts
- **THEN** `integration.bash` and the bash inject rcfile exist under Application Support with the current embedded content

#### Scenario: New bash session becomes integrated without a bashrc snippet

- **WHEN** a session is created with shell basename `bash` and the user has no WebTabinal line in `~/.bashrc`
- **THEN** the session becomes integrated (`Integrated=true`) after the first prompt

#### Scenario: cd updates live CWD on bash

- **WHEN** an integrated bash session changes directory with `cd`
- **THEN** the session CWD is updated for sidebar display

#### Scenario: Command line updates on bash

- **WHEN** an integrated bash session runs a simple command
- **THEN** the session command string is set to that command and state becomes `running` until the prompt returns

#### Scenario: Non-WebTabinal bash shells are unaffected

- **WHEN** bash starts without `WEBTABINAL_SESSION_ID`
- **THEN** the integration script performs no OSC emission

#### Scenario: zsh injection is unchanged

- **WHEN** a session is created with shell basename `zsh`
- **THEN** bash `--rcfile` injection is not applied and the existing zsh ZDOTDIR injection still loads OSC integration
