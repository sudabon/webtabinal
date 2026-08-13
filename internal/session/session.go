package session

import (
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"
	"github.com/google/uuid"
	"github.com/sudabon/webtabinal/internal/integration"
	"github.com/sudabon/webtabinal/internal/osc"
)

type State string

const (
	StateStarting State = "starting"
	StateIdle     State = "idle"
	StateRunning  State = "running"
	StateExited   State = "exited"
)

type Session struct {
	ID         string
	Order      int
	Cwd        string
	Command    string
	State      State
	ExitCode   *int
	RunStarted time.Time
	LastRunMs  int64
	Ring       *RingBuffer
	Integrated bool
	Cols       uint16
	Rows       uint16

	mu       sync.Mutex
	pty      *os.File
	cmd      *exec.Cmd
	parser   osc.Parser
	onEvent  func(*Session, osc.Event)
	onExit   func(*Session)
	onOutput func(*Session, []byte)
	logger   *log.Logger
	done     chan struct{}
	closed   bool
}

type Info struct {
	ID         string `json:"id"`
	Order      int    `json:"order"`
	Cwd        string `json:"cwd"`
	Command    string `json:"command"`
	State      State  `json:"state"`
	ExitCode   *int   `json:"exit"`
	Integrated bool   `json:"integrated"`
	RunMs      int64  `json:"run_ms,omitempty"`
}

func (s *Session) Info() Info {
	s.mu.Lock()
	defer s.mu.Unlock()
	info := Info{
		ID:         s.ID,
		Order:      s.Order,
		Cwd:        s.Cwd,
		Command:    s.Command,
		State:      s.State,
		ExitCode:   s.ExitCode,
		Integrated: s.Integrated,
		RunMs:      s.LastRunMs,
	}
	if s.State == StateRunning && !s.RunStarted.IsZero() {
		info.RunMs = time.Since(s.RunStarted).Milliseconds()
	}
	return info
}

type CreateOpts struct {
	Shell           string
	Cwd             string
	RingBufferBytes int
	Cols            uint16
	Rows            uint16
	OnEvent         func(*Session, osc.Event)
	OnExit          func(*Session)
	OnOutput        func(*Session, []byte)
	Logger          *log.Logger
}

func Create(opts CreateOpts) (*Session, error) {
	if opts.Shell == "" {
		opts.Shell = "/bin/zsh"
	}
	if opts.Cwd == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		opts.Cwd = home
	}
	if opts.Cols == 0 {
		opts.Cols = 120
	}
	if opts.Rows == 0 {
		opts.Rows = 40
	}

	id := uuid.NewString()
	cmd := exec.Command(opts.Shell, "-il")
	cmd.Dir = opts.Cwd
	env := append(os.Environ(),
		fmt.Sprintf("WEBTABINAL_SESSION_ID=%s", id),
		"TERM=xterm-256color",
	)
	injected, err := integration.ApplyZshInjection(env, opts.Shell)
	if err != nil {
		if opts.Logger != nil {
			opts.Logger.Printf("zsh integration inject: %v", err)
		}
	} else {
		env = injected
	}
	cmd.Env = env

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: opts.Cols, Rows: opts.Rows})
	if err != nil {
		return nil, err
	}

	s := &Session{
		ID:       id,
		Cwd:      opts.Cwd,
		Command:  filepath.Base(opts.Shell),
		State:    StateStarting,
		Ring:     NewRingBuffer(opts.RingBufferBytes),
		Cols:     opts.Cols,
		Rows:     opts.Rows,
		pty:      ptmx,
		cmd:      cmd,
		onEvent:  opts.OnEvent,
		onExit:   opts.OnExit,
		onOutput: opts.OnOutput,
		logger:   opts.Logger,
		done:     make(chan struct{}),
	}

	go s.readLoop()
	go s.waitLoop()
	return s, nil
}

func (s *Session) readLoop() {
	buf := make([]byte, 32*1024)
	for {
		n, err := s.pty.Read(buf)
		if n > 0 {
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			s.Ring.Write(chunk)
			events := s.parser.Feed(chunk)
			for _, ev := range events {
				s.applyEvent(ev)
				if s.onEvent != nil {
					s.onEvent(s, ev)
				}
			}
			if s.onOutput != nil {
				s.onOutput(s, chunk)
			}
		}
		if err != nil {
			if !errors.Is(err, io.EOF) && s.logger != nil {
				s.logger.Printf("session %s pty read: %v", s.ID, err)
			}
			return
		}
	}
}

func (s *Session) waitLoop() {
	err := s.cmd.Wait()
	code := 0
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			code = ee.ExitCode()
		} else {
			code = 1
		}
	}
	s.mu.Lock()
	s.State = StateExited
	s.ExitCode = &code
	s.mu.Unlock()
	close(s.done)
	if s.onExit != nil {
		s.onExit(s)
	}
}

func (s *Session) applyEvent(ev osc.Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.State == StateExited {
		return
	}
	switch ev.Kind {
	case osc.EventCWD:
		s.Cwd = ev.CWD
		s.Integrated = true
		if s.State == StateStarting {
			s.State = StateIdle
		}
	case osc.EventCmdStart:
		if ev.Command != "" {
			s.Command = ev.Command
		}
		s.State = StateRunning
		s.RunStarted = time.Now()
		s.ExitCode = nil
	case osc.EventCmdEnd:
		if s.State == StateRunning && !s.RunStarted.IsZero() {
			s.LastRunMs = time.Since(s.RunStarted).Milliseconds()
		}
		s.State = StateIdle
		s.ExitCode = ev.ExitCode
	case osc.EventPrompt:
		if s.State == StateStarting {
			s.State = StateIdle
		}
		if s.State == StateRunning {
			if !s.RunStarted.IsZero() {
				s.LastRunMs = time.Since(s.RunStarted).Milliseconds()
			}
			s.State = StateIdle
		}
	}
}

func (s *Session) Write(data []byte) error {
	s.mu.Lock()
	ptmx := s.pty
	closed := s.closed
	s.mu.Unlock()
	if closed || ptmx == nil {
		return io.ErrClosedPipe
	}
	_, err := ptmx.Write(data)
	return err
}

func (s *Session) Resize(cols, rows uint16) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Cols, s.Rows = cols, rows
	if s.pty == nil {
		return nil
	}
	return pty.Setsize(s.pty, &pty.Winsize{Cols: cols, Rows: rows})
}

func (s *Session) SetFallbackState(running bool, cmdName string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Integrated || s.State == StateExited || s.State == StateStarting {
		return
	}
	if running {
		if s.State != StateRunning {
			s.RunStarted = time.Now()
		}
		s.State = StateRunning
		if cmdName != "" {
			s.Command = cmdName
		}
	} else {
		if s.State == StateRunning && !s.RunStarted.IsZero() {
			s.LastRunMs = time.Since(s.RunStarted).Milliseconds()
		}
		s.State = StateIdle
	}
}

func (s *Session) Close() error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	cmd := s.cmd
	ptmx := s.pty
	s.mu.Unlock()

	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Signal(syscall.SIGHUP)
		select {
		case <-s.done:
		case <-time.After(3 * time.Second):
			_ = cmd.Process.Kill()
		}
	}
	if ptmx != nil {
		_ = ptmx.Close()
	}
	return nil
}

func (s *Session) PTY() *os.File {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.pty
}

func (s *Session) CmdProcessPID() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cmd == nil || s.cmd.Process == nil {
		return 0
	}
	return s.cmd.Process.Pid
}
