package config

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"sync"

	"github.com/sudabon/webtabinal/internal/paths"
)

type NotificationConfig struct {
	Enabled       bool `json:"enabled"`
	Always        bool `json:"always"`
	MinDurationMs int  `json:"min_duration_ms"`
	Sound         bool `json:"sound"`
}

type Config struct {
	Port                int                `json:"port"`
	Shell               string             `json:"shell"`
	ScrollbackLines     int                `json:"scrollback_lines"`
	RingBufferBytes     int                `json:"ring_buffer_bytes"`
	FontFamily          string             `json:"font_family"`
	FontSize            int                `json:"font_size"`
	SidebarWidth        int                `json:"sidebar_width"`
	Notification        NotificationConfig `json:"notification"`
	ConfirmCloseRunning bool               `json:"confirm_close_running"`
	CopyOnSelect        bool               `json:"copy_on_select"`
	QuitWhenNoTabs      bool               `json:"quit_when_no_tabs"`
	CloseTabOnCleanExit bool               `json:"close_tab_on_clean_exit"`
	AuthToken           string             `json:"auth_token"`
}

func Defaults() Config {
	return Config{
		Port:            8642,
		Shell:           "/bin/zsh",
		ScrollbackLines: 10000,
		RingBufferBytes: 5 * 1024 * 1024,
		FontFamily:      "Menlo, Monaco, 'Courier New', monospace",
		FontSize:        14,
		SidebarWidth:    240,
		Notification: NotificationConfig{
			Enabled:       true,
			Always:        false,
			MinDurationMs: 0,
			Sound:         false,
		},
		ConfirmCloseRunning: true,
		CopyOnSelect:        false,
		QuitWhenNoTabs:      true,
		CloseTabOnCleanExit: false,
	}
}

type Store struct {
	mu   sync.RWMutex
	cfg  Config
	path string
}

func LoadOrCreate() (*Store, error) {
	path, err := paths.ConfigPath()
	if err != nil {
		return nil, err
	}
	support, err := paths.SupportDir()
	if err != nil {
		return nil, err
	}
	if err := paths.EnsureDir(support); err != nil {
		return nil, err
	}

	s := &Store{path: path, cfg: Defaults()}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		token, err := randomToken()
		if err != nil {
			return nil, err
		}
		s.cfg.AuthToken = token
		if err := s.saveLocked(); err != nil {
			return nil, err
		}
		return s, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(data, &s.cfg); err != nil {
		return nil, err
	}
	if s.cfg.AuthToken == "" {
		token, err := randomToken()
		if err != nil {
			return nil, err
		}
		s.cfg.AuthToken = token
		if err := s.saveLocked(); err != nil {
			return nil, err
		}
	}
	s.applyDefaults()
	return s, nil
}

func (s *Store) applyDefaults() {
	d := Defaults()
	if s.cfg.Port == 0 {
		s.cfg.Port = d.Port
	}
	if s.cfg.Shell == "" {
		s.cfg.Shell = d.Shell
	}
	if s.cfg.ScrollbackLines == 0 {
		s.cfg.ScrollbackLines = d.ScrollbackLines
	}
	if s.cfg.RingBufferBytes == 0 {
		s.cfg.RingBufferBytes = d.RingBufferBytes
	}
	if s.cfg.FontFamily == "" {
		s.cfg.FontFamily = d.FontFamily
	}
	if s.cfg.FontSize == 0 {
		s.cfg.FontSize = d.FontSize
	}
	if s.cfg.SidebarWidth == 0 {
		s.cfg.SidebarWidth = d.SidebarWidth
	}
}

func (s *Store) Get() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cfg
}

func (s *Store) Public() Config {
	c := s.Get()
	c.AuthToken = ""
	return c
}

func (s *Store) AuthToken() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cfg.AuthToken
}

func (s *Store) Patch(patch map[string]any) (Config, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	raw, err := json.Marshal(s.cfg)
	if err != nil {
		return Config{}, err
	}
	var merged map[string]any
	if err := json.Unmarshal(raw, &merged); err != nil {
		return Config{}, err
	}
	for k, v := range patch {
		if k == "auth_token" {
			continue
		}
		merged[k] = v
	}
	updated, err := json.Marshal(merged)
	if err != nil {
		return Config{}, err
	}
	var next Config
	if err := json.Unmarshal(updated, &next); err != nil {
		return Config{}, err
	}
	next.AuthToken = s.cfg.AuthToken
	s.cfg = next
	s.applyDefaults()
	if err := s.saveLocked(); err != nil {
		return Config{}, err
	}
	out := s.cfg
	out.AuthToken = ""
	return out, nil
}

func (s *Store) saveLocked() error {
	data, err := json.MarshalIndent(s.cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, append(data, '\n'), 0o600)
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
