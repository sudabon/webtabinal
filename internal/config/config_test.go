package config

import (
	"os"
	"path/filepath"
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	store, err := LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func TestPatchRejectsInvalidConfig(t *testing.T) {
	store := newTestStore(t)
	nonExecutable := filepath.Join(t.TempDir(), "shell")
	if err := os.WriteFile(nonExecutable, []byte("#!/bin/sh\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name  string
		patch map[string]any
	}{
		{name: "relative shell", patch: map[string]any{"shell": "bin/zsh"}},
		{name: "missing shell", patch: map[string]any{"shell": filepath.Join(t.TempDir(), "missing")}},
		{name: "non-executable shell", patch: map[string]any{"shell": nonExecutable}},
		{name: "port zero", patch: map[string]any{"port": 0}},
		{name: "port too large", patch: map[string]any{"port": 65536}},
		{name: "ring buffer", patch: map[string]any{"ring_buffer_bytes": 0}},
		{name: "scrollback", patch: map[string]any{"scrollback_lines": 0}},
		{name: "font size", patch: map[string]any{"font_size": 0}},
		{name: "sidebar width", patch: map[string]any{"sidebar_width": 0}},
		{name: "notification duration", patch: map[string]any{"notification": map[string]any{"min_duration_ms": -1}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := store.Patch(tt.patch); err == nil {
				t.Fatal("Patch returned nil error")
			}
		})
	}
}

func TestPatchPreservesUnspecifiedNestedNotificationFields(t *testing.T) {
	store := newTestStore(t)
	if _, err := store.Patch(map[string]any{
		"notification": map[string]any{
			"enabled":         true,
			"always":          true,
			"min_duration_ms": 5000,
			"sound":           true,
		},
	}); err != nil {
		t.Fatal(err)
	}

	got, err := store.Patch(map[string]any{
		"notification": map[string]any{"enabled": false},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Notification.Enabled {
		t.Fatal("notification.enabled = true, want false")
	}
	if !got.Notification.Always || got.Notification.MinDurationMs != 5000 || !got.Notification.Sound {
		t.Fatalf("unspecified notification fields changed: %#v", got.Notification)
	}
}

func TestPatchIgnoresAuthTokenRegardlessOfValueType(t *testing.T) {
	store := newTestStore(t)
	token := store.AuthToken()

	got, err := store.Patch(map[string]any{
		"auth_token": 123,
		"font_size":  15,
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.FontSize != 15 {
		t.Fatalf("font_size = %d, want 15", got.FontSize)
	}
	if store.AuthToken() != token {
		t.Fatal("auth_token changed")
	}
}
