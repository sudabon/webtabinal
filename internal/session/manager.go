package session

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/sudabon/webtabinal/internal/config"
	"github.com/sudabon/webtabinal/internal/osc"
)

type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	order    []string
	cfg      *config.Store
	logger   *log.Logger
	onChange func()
	onOutput func(*Session, []byte)
	onEvent  func(*Session, osc.Event)
	onExit   func(*Session)
	stopFB   chan struct{}
}

func NewManager(cfg *config.Store, logger *log.Logger) *Manager {
	m := &Manager{
		sessions: make(map[string]*Session),
		cfg:      cfg,
		logger:   logger,
		stopFB:   make(chan struct{}),
	}
	go m.fallbackLoop()
	return m
}

func (m *Manager) SetHooks(onChange func(), onOutput func(*Session, []byte), onEvent func(*Session, osc.Event), onExit func(*Session)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onChange = onChange
	m.onOutput = onOutput
	m.onEvent = onEvent
	m.onExit = onExit
}

func (m *Manager) hooks() (func(), func(*Session, []byte), func(*Session, osc.Event), func(*Session)) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.onChange, m.onOutput, m.onEvent, m.onExit
}

func (m *Manager) Close() {
	close(m.stopFB)
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range m.sessions {
		_ = s.Close()
	}
}

func (m *Manager) List() []Info {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Info, 0, len(m.order))
	for _, id := range m.order {
		if s, ok := m.sessions[id]; ok {
			out = append(out, s.Info())
		}
	}
	return out
}

func (m *Manager) Get(id string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[id]
	return s, ok
}

func (m *Manager) Create(cwd string) (*Session, error) {
	cfg := m.cfg.Get()
	if cwd == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		cwd = home
	}
	s, err := Create(CreateOpts{
		Shell:           cfg.Shell,
		Cwd:             cwd,
		RingBufferBytes: cfg.RingBufferBytes,
		Palette:         osc.PaletteFor(cfg.ResolvedTheme()),
		Logger:          m.logger,
		OnEvent: func(sess *Session, ev osc.Event) {
			_, _, onEvent, _ := m.hooks()
			if onEvent != nil {
				onEvent(sess, ev)
			}
		},
		OnExit: func(sess *Session) {
			m.handleExit(sess)
		},
		OnOutput: func(sess *Session, data []byte) {
			_, onOutput, _, _ := m.hooks()
			if onOutput != nil {
				onOutput(sess, data)
			}
		},
	})
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.sessions[s.ID] = s
	m.order = append(m.order, s.ID)
	m.reindexLocked()
	onChange := m.onChange
	m.mu.Unlock()
	if onChange != nil {
		onChange()
	}
	return s, nil
}

func (m *Manager) Duplicate(id string) (*Session, error) {
	s, ok := m.Get(id)
	if !ok {
		return nil, fmt.Errorf("session not found")
	}
	info := s.Info()
	// Memo is intentionally not copied: duplicate is a separate session.
	return m.Create(info.Cwd)
}

func (m *Manager) Restart(id string) (*Session, error) {
	s, ok := m.Get(id)
	if !ok {
		return nil, fmt.Errorf("session not found")
	}
	info := s.Info()
	if info.State != StateExited {
		return nil, fmt.Errorf("session is not exited")
	}
	order := info.Order
	cwd := info.Cwd
	memo := info.Memo
	ns, err := m.Create(cwd)
	if err != nil {
		return nil, err
	}
	// Memo was already validated when stored on the old session.
	_ = ns.SetMemo(memo)
	_ = s.Close()

	m.mu.Lock()
	delete(m.sessions, id)
	for i, oid := range m.order {
		if oid == id {
			m.order = append(m.order[:i], m.order[i+1:]...)
			break
		}
	}
	m.mu.Unlock()

	m.mu.Lock()
	// move new session to old order position
	newOrder := make([]string, 0, len(m.order))
	inserted := false
	for _, oid := range m.order {
		if oid == ns.ID {
			continue
		}
		if !inserted && len(newOrder) == order {
			newOrder = append(newOrder, ns.ID)
			inserted = true
		}
		newOrder = append(newOrder, oid)
	}
	if !inserted {
		newOrder = append(newOrder, ns.ID)
	}
	m.order = newOrder
	m.reindexLocked()
	onChange := m.onChange
	m.mu.Unlock()
	if onChange != nil {
		onChange()
	}
	return ns, nil
}

func (m *Manager) SetMemo(id, memo string) (*Session, error) {
	s, ok := m.Get(id)
	if !ok {
		return nil, fmt.Errorf("session not found")
	}
	if err := s.SetMemo(memo); err != nil {
		return nil, err
	}
	m.mu.RLock()
	onChange := m.onChange
	m.mu.RUnlock()
	if onChange != nil {
		onChange()
	}
	return s, nil
}

func (m *Manager) Delete(id string) error {
	s, ok := m.Get(id)
	if !ok {
		return fmt.Errorf("session not found")
	}
	_ = s.Close()
	m.mu.Lock()
	delete(m.sessions, id)
	for i, oid := range m.order {
		if oid == id {
			m.order = append(m.order[:i], m.order[i+1:]...)
			break
		}
	}
	m.reindexLocked()
	onChange := m.onChange
	m.mu.Unlock()
	if onChange != nil {
		onChange()
	}
	return nil
}

func (m *Manager) Reorder(ids []string) error {
	m.mu.Lock()
	if len(ids) != len(m.order) {
		m.mu.Unlock()
		return fmt.Errorf("id count mismatch")
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if _, ok := m.sessions[id]; !ok {
			m.mu.Unlock()
			return fmt.Errorf("unknown session %s", id)
		}
		if seen[id] {
			m.mu.Unlock()
			return fmt.Errorf("duplicate id")
		}
		seen[id] = true
	}
	m.order = append([]string(nil), ids...)
	m.reindexLocked()
	onChange := m.onChange
	m.mu.Unlock()
	if onChange != nil {
		onChange()
	}
	return nil
}

func (m *Manager) reindexLocked() {
	for i, id := range m.order {
		if s, ok := m.sessions[id]; ok {
			s.mu.Lock()
			s.Order = i
			s.mu.Unlock()
		}
	}
}

func (m *Manager) handleExit(s *Session) {
	cfg := m.cfg.Get()
	info := s.Info()
	if cfg.CloseTabOnCleanExit && info.ExitCode != nil && *info.ExitCode == 0 {
		_ = m.Delete(s.ID)
		return
	}
	onChange, _, _, onExit := m.hooks()
	if onExit != nil {
		onExit(s)
	}
	if onChange != nil {
		onChange()
	}
}

func (m *Manager) fallbackLoop() {
	t := time.NewTicker(time.Second)
	defer t.Stop()
	for {
		select {
		case <-m.stopFB:
			return
		case <-t.C:
			m.pollFallback()
		}
	}
}

func (m *Manager) pollFallback() {
	m.mu.RLock()
	list := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		list = append(list, s)
	}
	m.mu.RUnlock()
	onChange, _, onEvent, _ := m.hooks()

	changed := false
	for _, s := range list {
		info := s.Info()
		if info.Integrated || info.State == StateExited {
			continue
		}
		running, name := foregroundInfo(s)
		before := info.State
		s.SetFallbackState(running, name)
		after := s.Info().State
		if before != after {
			changed = true
			if onEvent != nil {
				onEvent(s, osc.Event{})
			}
		}
	}
	if changed && onChange != nil {
		onChange()
	}
}

func foregroundInfo(s *Session) (bool, string) {
	ptmx := s.PTY()
	if ptmx == nil {
		return false, ""
	}
	rc, err := ptmx.SyscallConn()
	if err != nil {
		return false, ""
	}
	var fg int32
	var errno syscall.Errno
	if err := rc.Control(func(fd uintptr) {
		_, _, errno = syscall.Syscall(syscall.SYS_IOCTL, fd, uintptr(syscall.TIOCGPGRP), uintptr(unsafe.Pointer(&fg)))
	}); err != nil || errno != 0 || fg <= 0 {
		return false, ""
	}
	shellPID := s.CmdProcessPID()
	if shellPID == 0 || int(fg) == shellPID {
		return false, ""
	}
	out, err := exec.Command("ps", "-o", "comm=", "-p", strconv.Itoa(int(fg))).Output()
	if err != nil {
		return true, ""
	}
	return true, strings.TrimSpace(string(out))
}
