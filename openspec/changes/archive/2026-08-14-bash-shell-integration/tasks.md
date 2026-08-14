## 1. Bash integration scripts

- [x] 1.1 Add `paths.BashInjectDir` / inject rcfile path next to the existing zsh inject paths
- [x] 1.2 Embed `integration.bash` that emits OSC 7 / 133 / 9973, no-ops without `WEBTABINAL_SESSION_ID`, guards double load, and works on bash 3.2
- [x] 1.3 Embed bash inject `bashrc` that sources login files in bash login order (`/etc/profile`, then the first of `~/.bash_profile` / `~/.bash_login` / `~/.profile`) and then `WEBTABINAL_INTEGRATION_PATH`
- [x] 1.4 Chain existing `PROMPT_COMMAND` (string or array) and DEBUG trap; ignore DEBUG while the prompt hook runs; run saved prompt hooks inside the function so later failures still emit CWD

## 2. Injection and session spawn

- [x] 2.1 Add `ApplyBashInjection` that writes bash files, sets `WEBTABINAL_INJECTION` / `WEBTABINAL_INTEGRATION_PATH`, and no-ops when basename is not `bash`
- [x] 2.2 Extend `integration.Write()` so daemon startup also writes the bash files
- [x] 2.3 In `session.Create`, spawn bash as `--rcfile <inject-bashrc> -i` (long option first, required by bash 3.2) and call `ApplyBashInjection`; leave zsh on `-il` + ZDOTDIR

## 3. Tests

- [x] 3.1 Unit-test `ApplyBashInjection` (env, written files, skip non-bash) without changing zsh inject tests
- [x] 3.2 Add a bash equivalent of `TestCWDUpdatesOnCdWithoutZshrcSnippet` (empty HOME, no bashrc snippet, `cd` updates CWD)
- [x] 3.3 Add a bash equivalent of `TestCommandUpdatesOnRunWithoutZshrcSnippet`

## 4. Settings copy and docs

- [x] 4.1 Update the General shell-field hint to say zsh and bash update sidebar CWD/command, and that the value applies to new tabs
- [x] 4.2 Extend the frontend settings test that covers the General hint (or add one) so the new wording is asserted
- [x] 4.3 Update README シェル連携 so bash is covered and no `~/.bashrc` one-liner is required

## 5. Verify

- [x] 5.1 Run the new/updated Go integration and session tests plus the settings frontend test
- [x] 5.2 Manually confirm: set `/opt/homebrew/bin/bash` or `/bin/bash`, new tab, `cd` updates the left menu, command string updates, zsh tab still updates, no `◌` on the bash tab
