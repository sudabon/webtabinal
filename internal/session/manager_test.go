package session

import (
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"

	"github.com/sudabon/webtabinal/internal/config"
	"github.com/sudabon/webtabinal/internal/osc"
)

func TestHooksAreSynchronized(t *testing.T) {
	s := &Session{ID: "session", State: StateRunning}
	m := &Manager{sessions: map[string]*Session{s.ID: s}}
	noopChange := func() {}
	noopOutput := func(*Session, []byte) {}
	noopEvent := func(*Session, osc.Event) {}
	noopExit := func(*Session) {}
	m.SetHooks(noopChange, noopOutput, noopEvent, noopExit)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for range 1000 {
			m.SetHooks(noopChange, noopOutput, noopEvent, noopExit)
		}
	}()
	go func() {
		defer wg.Done()
		for range 1000 {
			s.mu.Lock()
			s.State = StateRunning
			s.mu.Unlock()
			m.pollFallback()
		}
	}()
	wg.Wait()
}

func TestCloseSynchronizesWithWait(t *testing.T) {
	cmd := exec.Command("/bin/sh", "-c", "sleep 10")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	s := &Session{cmd: cmd, done: make(chan struct{})}
	waited := make(chan struct{})
	go func() {
		_ = cmd.Wait()
		close(s.done)
		close(waited)
	}()

	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	<-waited
}

func TestRestartKeepsExitedSessionWhenReplacementFails(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	configDir := filepath.Join(home, "Library", "Application Support", "WebTabinal")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatal(err)
	}
	configPath := filepath.Join(configDir, "config.json")
	if err := os.WriteFile(configPath, []byte(`{"shell":"/definitely/missing","auth_token":"test"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := config.LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	old := &Session{ID: "old", Cwd: t.TempDir(), State: StateExited}
	m := &Manager{
		sessions: map[string]*Session{old.ID: old},
		order:    []string{old.ID},
		cfg:      store,
	}

	if _, err := m.Restart(old.ID); err == nil {
		t.Fatal("Restart returned nil error")
	}
	if got, ok := m.Get(old.ID); !ok || got != old {
		t.Fatal("old session was removed after replacement failed")
	}
	old.mu.Lock()
	closed := old.closed
	old.mu.Unlock()
	if closed {
		t.Fatal("old session was closed after replacement failed")
	}
}
