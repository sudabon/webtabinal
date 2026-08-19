package config

import (
	"os"
	"path/filepath"
	"reflect"
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
		{name: "unknown color scheme", patch: map[string]any{"color_scheme": "solarized"}},
		{name: "empty color scheme", patch: map[string]any{"color_scheme": ""}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := store.Patch(tt.patch); err == nil {
				t.Fatal("Patch returned nil error")
			}
		})
	}
}

func TestCloseTabOnCleanExitDefaultsToTrue(t *testing.T) {
	if got := Defaults().CloseTabOnCleanExit; !got {
		t.Fatal("Defaults().CloseTabOnCleanExit = false, want true")
	}
}

func TestColorSchemeDefaultsToSystem(t *testing.T) {
	if got := Defaults().ColorScheme; got != ColorSchemeSystem {
		t.Fatalf("Defaults().ColorScheme = %q, want %q", got, ColorSchemeSystem)
	}

	home := t.TempDir()
	t.Setenv("HOME", home)
	support := filepath.Join(home, "Library", "Application Support", "WebTabinal")
	if err := os.MkdirAll(support, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(support, "config.json"), []byte(`{"port":8642}`), 0o600); err != nil {
		t.Fatal(err)
	}

	store, err := LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	if got := store.Public().ColorScheme; got != ColorSchemeSystem {
		t.Fatalf("stored config without color_scheme resolved to %q, want %q", got, ColorSchemeSystem)
	}
}

func TestLoadNormalizesInvalidColorScheme(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	support := filepath.Join(home, "Library", "Application Support", "WebTabinal")
	if err := os.MkdirAll(support, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(support, "config.json"), []byte(`{"color_scheme":"solarized"}`), 0o600); err != nil {
		t.Fatal(err)
	}

	store, err := LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	if got := store.Public().ColorScheme; got != ColorSchemeSystem {
		t.Fatalf("invalid stored color_scheme resolved to %q, want %q", got, ColorSchemeSystem)
	}
	if _, err := store.Patch(map[string]any{"sidebar_width": 300}); err != nil {
		t.Fatalf("Patch unrelated field after loading invalid color_scheme: %v", err)
	}
}

func TestPatchColorScheme(t *testing.T) {
	for _, scheme := range []string{ColorSchemeLight, ColorSchemeDark, ColorSchemeSystem} {
		t.Run(scheme, func(t *testing.T) {
			store := newTestStore(t)
			got, err := store.Patch(map[string]any{"color_scheme": scheme})
			if err != nil {
				t.Fatal(err)
			}
			if got.ColorScheme != scheme {
				t.Fatalf("patched color_scheme = %q, want %q", got.ColorScheme, scheme)
			}
			if stored := store.Public().ColorScheme; stored != scheme {
				t.Fatalf("stored color_scheme = %q, want %q", stored, scheme)
			}
		})
	}
}

func TestResolvedThemeUsesExplicitScheme(t *testing.T) {
	if got := (Config{ColorScheme: ColorSchemeLight}).ResolvedTheme(); got != ColorSchemeLight {
		t.Fatalf("light = %q", got)
	}
	if got := (Config{ColorScheme: ColorSchemeDark}).ResolvedTheme(); got != ColorSchemeDark {
		t.Fatalf("dark = %q", got)
	}
}

func TestResolvedThemeSystemUsesAppearance(t *testing.T) {
	t.Cleanup(func() { systemAppearance = macOSAppearance })
	systemAppearance = func() string { return ColorSchemeDark }
	if got := (Config{ColorScheme: ColorSchemeSystem}).ResolvedTheme(); got != ColorSchemeDark {
		t.Fatalf("system = %q, want dark", got)
	}
	systemAppearance = func() string { return ColorSchemeLight }
	if got := (Config{ColorScheme: ColorSchemeSystem}).ResolvedTheme(); got != ColorSchemeLight {
		t.Fatalf("system = %q, want light", got)
	}
}

func TestPatchInvalidColorSchemeKeepsStoredValue(t *testing.T) {
	store := newTestStore(t)
	if _, err := store.Patch(map[string]any{"color_scheme": ColorSchemeLight}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Patch(map[string]any{"color_scheme": "solarized"}); err == nil {
		t.Fatal("Patch returned nil error for invalid color_scheme")
	}
	if got := store.Public().ColorScheme; got != ColorSchemeLight {
		t.Fatalf("color_scheme = %q after rejected patch, want %q", got, ColorSchemeLight)
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

func TestKeyBindingsDefaultsToDisabledChord(t *testing.T) {
	got := Defaults().KeyBindings
	if got.Enabled {
		t.Fatal("Defaults().KeyBindings.Enabled = true, want false")
	}
	if got.Prefix != "ctrl+j" || got.NextTab != "n" || got.PrevTab != "p" {
		t.Fatalf("Defaults().KeyBindings = %+v", got)
	}

	store := newTestStore(t)
	stored := store.Public().KeyBindings
	if stored.Enabled || stored.Prefix != "ctrl+j" || stored.NextTab != "n" || stored.PrevTab != "p" {
		t.Fatalf("first-launch key_bindings = %+v", stored)
	}
}

func TestOlderConfigGainsKeyBindingDefaults(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	support := filepath.Join(home, "Library", "Application Support", "WebTabinal")
	if err := os.MkdirAll(support, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(support, "config.json"), []byte(`{"port":8642,"font_size":16}`), 0o600); err != nil {
		t.Fatal(err)
	}

	store, err := LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	got := store.Public()
	if got.FontSize != 16 {
		t.Fatalf("font_size = %d, want 16", got.FontSize)
	}
	if got.KeyBindings.Enabled {
		t.Fatal("migrated key_bindings.enabled = true, want false")
	}
	if got.KeyBindings.Prefix != "ctrl+j" || got.KeyBindings.NextTab != "n" || got.KeyBindings.PrevTab != "p" {
		t.Fatalf("migrated key_bindings = %+v", got.KeyBindings)
	}
}

func TestPatchRejectsInvalidKeyBindings(t *testing.T) {
	store := newTestStore(t)
	valid := map[string]any{
		"enabled":  true,
		"prefix":   "ctrl+j",
		"next_tab": "n",
		"prev_tab": "p",
	}
	if _, err := store.Patch(map[string]any{"key_bindings": valid}); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name  string
		patch map[string]any
	}{
		{name: "prefix without modifier", patch: map[string]any{"prefix": "j"}},
		{name: "equal next and prev", patch: map[string]any{"next_tab": "n", "prev_tab": "n"}},
		{name: "escape prefix", patch: map[string]any{"prefix": "escape"}},
		{name: "escape next", patch: map[string]any{"next_tab": "escape"}},
		{name: "unparsable prefix", patch: map[string]any{"prefix": "Ctrl+J"}},
		{name: "empty prefix", patch: map[string]any{"prefix": ""}},
		{name: "wrong modifier order", patch: map[string]any{"prefix": "shift+ctrl+j"}},
		{name: "reserved meta+n", patch: map[string]any{"prefix": "meta+n"}},
		{name: "reserved meta+1", patch: map[string]any{"prefix": "meta+1"}},
		{name: "reserved meta+c", patch: map[string]any{"prefix": "meta+c"}},
		{name: "reserved meta+v", patch: map[string]any{"prefix": "meta+v"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := map[string]any{
				"enabled":  true,
				"prefix":   "ctrl+j",
				"next_tab": "n",
				"prev_tab": "p",
			}
			for k, v := range tt.patch {
				body[k] = v
			}
			if _, err := store.Patch(map[string]any{"key_bindings": body}); err == nil {
				t.Fatal("Patch returned nil error")
			}
			got := store.Public().KeyBindings
			if !got.Enabled || got.Prefix != "ctrl+j" || got.NextTab != "n" || got.PrevTab != "p" {
				t.Fatalf("stored key_bindings changed after rejection: %+v", got)
			}
		})
	}
}

func TestPatchKeyBindingsAcceptsValidChord(t *testing.T) {
	store := newTestStore(t)
	got, err := store.Patch(map[string]any{
		"key_bindings": map[string]any{
			"enabled":  true,
			"prefix":   "ctrl+shift+a",
			"next_tab": "j",
			"prev_tab": "k",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !got.KeyBindings.Enabled || got.KeyBindings.Prefix != "ctrl+shift+a" || got.KeyBindings.NextTab != "j" || got.KeyBindings.PrevTab != "k" {
		t.Fatalf("patched key_bindings = %+v", got.KeyBindings)
	}
}

func TestStateConfigDefaults(t *testing.T) {
	got := Defaults().State
	if !got.Enabled || got.DebounceMs != 120 || got.QuiescenceMs != 1500 || got.BottomLines != 15 || !got.NotifyOnBlocked || got.ManifestDir != "" {
		t.Fatalf("Defaults().State = %+v", got)
	}

	store := newTestStore(t)
	stored := store.Public().State
	if !reflect.DeepEqual(stored, got) {
		t.Fatalf("first-launch state = %+v, want %+v", stored, got)
	}
}

func TestNotificationCommandsDefaults(t *testing.T) {
	want := []string{"claude", "codex", "cursor-agent", "agent"}
	if got := Defaults().Notification.Commands; !reflect.DeepEqual(got, want) {
		t.Fatalf("Defaults().Notification.Commands = %v, want %v", got, want)
	}
	if got := newTestStore(t).Public().Notification.Commands; !reflect.DeepEqual(got, want) {
		t.Fatalf("first-launch commands = %v, want %v", got, want)
	}
}

func TestOlderConfigGainsNotificationCommandsDefault(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	support := filepath.Join(home, "Library", "Application Support", "WebTabinal")
	if err := os.MkdirAll(support, 0o755); err != nil {
		t.Fatal(err)
	}
	body := `{"notification":{"enabled":true,"always":true,"min_duration_ms":4000,"sound":true}}`
	if err := os.WriteFile(filepath.Join(support, "config.json"), []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}

	store, err := LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	got := store.Public().Notification
	if want := []string{"claude", "codex", "cursor-agent", "agent"}; !reflect.DeepEqual(got.Commands, want) {
		t.Fatalf("migrated commands = %v, want %v", got.Commands, want)
	}
	if !got.Always || got.MinDurationMs != 4000 || !got.Sound {
		t.Fatalf("other stored notification values changed: %+v", got)
	}
}

func TestExplicitEmptyNotificationCommandsIsPreserved(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	support := filepath.Join(home, "Library", "Application Support", "WebTabinal")
	if err := os.MkdirAll(support, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(support, "config.json"), []byte(`{"notification":{"commands":[]}}`), 0o600); err != nil {
		t.Fatal(err)
	}

	store, err := LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	if got := store.Public().Notification.Commands; len(got) != 0 {
		t.Fatalf("explicit empty commands = %v, want empty", got)
	}
}

func TestPatchNotificationCommands(t *testing.T) {
	store := newTestStore(t)

	got, err := store.Patch(map[string]any{"notification": map[string]any{"commands": []any{" claude ", "make"}}})
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"claude", "make"}; !reflect.DeepEqual(got.Notification.Commands, want) {
		t.Fatalf("commands = %v, want %v", got.Notification.Commands, want)
	}

	got, err = store.Patch(map[string]any{"notification": map[string]any{"commands": []any{}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Notification.Commands) != 0 {
		t.Fatalf("commands = %v, want empty", got.Notification.Commands)
	}
}

func TestPatchRejectsBlankNotificationCommand(t *testing.T) {
	store := newTestStore(t)
	before := store.Public()

	for _, entry := range []string{"", "   "} {
		if _, err := store.Patch(map[string]any{"notification": map[string]any{"commands": []any{"claude", entry}}}); err == nil {
			t.Fatalf("Patch(%q) returned nil error", entry)
		}
		if got := store.Public(); !reflect.DeepEqual(got, before) {
			t.Fatalf("stored config changed after rejection: %+v", got.Notification)
		}
	}
}

// A rejected patch must not write through the stored slice's backing array,
// which encoding/json reuses when the replacement fits in existing capacity.
func TestRejectedCommandsPatchDoesNotAliasStoredSlice(t *testing.T) {
	store := newTestStore(t)
	before := store.Public()

	if _, err := store.Patch(map[string]any{
		"notification": map[string]any{"commands": []any{"", "codex", "cursor-agent", "agent"}},
	}); err == nil {
		t.Fatal("Patch returned nil error")
	}
	if got := store.Public(); !reflect.DeepEqual(got, before) {
		t.Fatalf("stored config changed after rejection: %v, want %v", got.Notification.Commands, before.Notification.Commands)
	}
}

func TestGetDoesNotShareNotificationCommandsBacking(t *testing.T) {
	store := newTestStore(t)
	got := store.Get()
	if len(got.Notification.Commands) == 0 {
		t.Fatal("expected default notification commands")
	}
	got.Notification.Commands[0] = "mutated"
	if store.Get().Notification.Commands[0] == "mutated" {
		t.Fatal("caller mutation leaked into stored config")
	}
}

func TestOlderConfigGainsAgentStateDefaults(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	support := filepath.Join(home, "Library", "Application Support", "WebTabinal")
	if err := os.MkdirAll(support, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(support, "config.json"), []byte(`{"port":8642,"font_size":16,"notification":{"enabled":false,"always":true,"min_duration_ms":4000,"sound":true}}`), 0o600); err != nil {
		t.Fatal(err)
	}

	store, err := LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	got := store.Public()
	if got.FontSize != 16 {
		t.Fatalf("font_size = %d, want 16", got.FontSize)
	}
	if got.Notification.Enabled || !got.Notification.Always || got.Notification.MinDurationMs != 4000 || !got.Notification.Sound {
		t.Fatalf("unrelated notification changed: %+v", got.Notification)
	}
	d := Defaults().State
	if !reflect.DeepEqual(got.State, d) {
		t.Fatalf("migrated state = %+v, want %+v", got.State, d)
	}
}

func TestOlderConfigPreservesExplicitStateFalseAndZero(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	support := filepath.Join(home, "Library", "Application Support", "WebTabinal")
	if err := os.MkdirAll(support, 0o755); err != nil {
		t.Fatal(err)
	}
	body := `{"state":{"enabled":false,"notify_on_blocked":false,"quiescence_ms":0}}`
	if err := os.WriteFile(filepath.Join(support, "config.json"), []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}

	store, err := LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	got := store.Public().State
	if got.Enabled || got.NotifyOnBlocked {
		t.Fatalf("explicit false not preserved: %+v", got)
	}
	if got.QuiescenceMs != 0 {
		t.Fatalf("explicit zero quiescence = %d, want 0", got.QuiescenceMs)
	}
	if got.DebounceMs != 120 || got.BottomLines != 15 {
		t.Fatalf("missing timing defaults not filled: %+v", got)
	}
}

func TestPatchRejectsInvalidState(t *testing.T) {
	store := newTestStore(t)
	before := store.Public()

	tests := []struct {
		name  string
		patch map[string]any
	}{
		{name: "debounce low", patch: map[string]any{"debounce_ms": 19}},
		{name: "debounce high", patch: map[string]any{"debounce_ms": 5001}},
		{name: "quiescence negative", patch: map[string]any{"quiescence_ms": -1}},
		{name: "quiescence high", patch: map[string]any{"quiescence_ms": 60001}},
		{name: "bottom lines low", patch: map[string]any{"bottom_lines": 0}},
		{name: "bottom lines high", patch: map[string]any{"bottom_lines": 201}},
		{name: "relative manifest dir", patch: map[string]any{"manifest_dir": "manifests"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := map[string]any{
				"enabled":           true,
				"debounce_ms":       120,
				"quiescence_ms":     1500,
				"bottom_lines":      15,
				"notify_on_blocked": true,
				"manifest_dir":      "",
			}
			for k, v := range tt.patch {
				body[k] = v
			}
			if _, err := store.Patch(map[string]any{"state": body}); err == nil {
				t.Fatal("Patch returned nil error")
			}
			if got := store.Public(); !reflect.DeepEqual(got, before) {
				t.Fatalf("stored config changed after rejection: %+v", got)
			}
		})
	}
}

func TestPatchStatePreservesUnspecifiedFields(t *testing.T) {
	store := newTestStore(t)
	abs := t.TempDir()
	if _, err := store.Patch(map[string]any{
		"state": map[string]any{
			"enabled":           true,
			"debounce_ms":       200,
			"quiescence_ms":     0,
			"bottom_lines":      20,
			"notify_on_blocked": false,
			"manifest_dir":      abs,
		},
	}); err != nil {
		t.Fatal(err)
	}

	got, err := store.Patch(map[string]any{"state": map[string]any{"enabled": false}})
	if err != nil {
		t.Fatal(err)
	}
	if got.State.Enabled {
		t.Fatal("state.enabled = true, want false")
	}
	if got.State.DebounceMs != 200 || got.State.QuiescenceMs != 0 || got.State.BottomLines != 20 || got.State.NotifyOnBlocked || got.State.ManifestDir != abs {
		t.Fatalf("unspecified state fields changed: %+v", got.State)
	}
}

func TestShiftEnterNewlineDefaultsToTrue(t *testing.T) {
	if got := Defaults().ShiftEnterNewline; !got {
		t.Fatal("Defaults().ShiftEnterNewline = false, want true")
	}
}

func TestShiftEnterNewlineSurvivesConfigWrittenBeforeTheOption(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	support := filepath.Join(home, "Library", "Application Support", "WebTabinal")
	if err := os.MkdirAll(support, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(support, "config.json"), []byte(`{"port":8642}`), 0o600); err != nil {
		t.Fatal(err)
	}

	store, err := LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	if got := store.Public().ShiftEnterNewline; !got {
		t.Fatal("config.json written before the option resolved shift_enter_newline to false, want true")
	}
}

func TestShiftEnterNewlineCanBeTurnedOff(t *testing.T) {
	store := newTestStore(t)

	next, err := store.Patch(map[string]any{"shift_enter_newline": false})
	if err != nil {
		t.Fatal(err)
	}
	if next.ShiftEnterNewline {
		t.Fatal("Patch returned ShiftEnterNewline = true, want false")
	}
	if store.Get().ShiftEnterNewline {
		t.Fatal("store kept ShiftEnterNewline = true after patching it off")
	}
}
