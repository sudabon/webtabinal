package session

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"testing"

	"github.com/sudabon/webtabinal/internal/config"
)

func testManager(t *testing.T) *Manager {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	configDir := filepath.Join(home, "Library", "Application Support", "WebTabinal")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatal(err)
	}
	configPath := filepath.Join(configDir, "config.json")
	if err := os.WriteFile(configPath, []byte(`{"shell":"/bin/sh","auth_token":"test"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := config.LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	return NewManager(store, log.New(io.Discard, "", 0))
}

func TestDuplicateDoesNotCopyMemo(t *testing.T) {
	m := testManager(t)
	defer m.Close()
	s, err := m.Create(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetMemo("CI watch"); err != nil {
		t.Fatal(err)
	}
	dup, err := m.Duplicate(s.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got := dup.Info().Memo; got != "" {
		t.Fatalf("duplicate memo = %q, want empty", got)
	}
	if got := s.Info().Memo; got != "CI watch" {
		t.Fatalf("source memo = %q, want CI watch", got)
	}
}

func TestRestartCopiesMemo(t *testing.T) {
	m := testManager(t)
	defer m.Close()
	s, err := m.Create(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetMemo("CI watch"); err != nil {
		t.Fatal(err)
	}
	s.mu.Lock()
	s.State = StateExited
	s.mu.Unlock()

	ns, err := m.Restart(s.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got := ns.Info().Memo; got != "CI watch" {
		t.Fatalf("restarted memo = %q, want CI watch", got)
	}
	if _, ok := m.Get(s.ID); ok {
		t.Fatal("old session should be removed after restart")
	}
}
