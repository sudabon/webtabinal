package paths

import (
	"os"
	"path/filepath"
)

const AppName = "WebTabinal"
const CLIName = "webtabinal"

func Home() (string, error) {
	return os.UserHomeDir()
}

func SupportDir() (string, error) {
	home, err := Home()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Library", "Application Support", AppName), nil
}

func LogsDir() (string, error) {
	home, err := Home()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Library", "Logs", AppName), nil
}

func ConfigPath() (string, error) {
	dir, err := SupportDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "config.json"), nil
}

func IntegrationPath() (string, error) {
	dir, err := SupportDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "integration.zsh"), nil
}

func LogPath() (string, error) {
	dir, err := LogsDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "daemon.log"), nil
}

func EnsureDir(path string) error {
	return os.MkdirAll(path, 0o755)
}
