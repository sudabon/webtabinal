package integration

import (
	_ "embed"
	"os"

	"github.com/sudabon/webtabinal/internal/paths"
)

//go:embed integration.zsh
var script []byte

const Version = "1"

func Write() error {
	dir, err := paths.SupportDir()
	if err != nil {
		return err
	}
	if err := paths.EnsureDir(dir); err != nil {
		return err
	}
	path, err := paths.IntegrationPath()
	if err != nil {
		return err
	}
	return os.WriteFile(path, script, 0o644)
}

func ZshrcSnippet() string {
	return `[[ -n "$WEBTABINAL_SESSION_ID" ]] && source "$HOME/Library/Application Support/WebTabinal/integration.zsh"`
}
