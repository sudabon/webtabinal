package session

import (
	"bytes"
	"io"
	"log"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/sudabon/webtabinal/internal/osc"
)

func TestApplyEventDoesNotReviveExitedSession(t *testing.T) {
	s := &Session{State: StateExited}

	s.applyEvent(osc.Event{Kind: osc.EventCmdEnd})

	if s.State != StateExited {
		t.Fatalf("state = %q, want %q", s.State, StateExited)
	}
}

func TestApplyEventNotifyDoesNotChangeRunningState(t *testing.T) {
	s := &Session{State: StateRunning, Cwd: "/tmp", Command: "codex"}

	s.applyEvent(osc.Event{Kind: osc.EventNotify, Title: "Codex", Body: "needs approval"})

	if s.State != StateRunning || s.Cwd != "/tmp" || s.Command != "codex" {
		t.Fatalf("session = %+v, want running unchanged", s)
	}
}

func TestReadLoopLogsNonEOFErrors(t *testing.T) {
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer writer.Close()
	if err := reader.Close(); err != nil {
		t.Fatal(err)
	}
	var logs bytes.Buffer
	s := &Session{ID: "session", pty: reader, logger: log.New(&logs, "", 0)}

	s.readLoop()

	if got := logs.String(); !strings.Contains(got, "session session pty read:") {
		t.Fatalf("log = %q, want PTY read error", got)
	}
}

func TestWriteDropsUnsolicitedOSC11Report(t *testing.T) {
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	s := &Session{pty: writer}
	report := []byte("\x1b]11;rgb:ffff/ffff/ffff\x1b\\")
	if err := s.Write(report); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	got, err := io.ReadAll(reader)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("PTY input = %q, want unsolicited OSC 11 report dropped", got)
	}
}

func TestWriteAllowsOSC11ReportAfterQuery(t *testing.T) {
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	s := &Session{pty: writer}
	s.handleEvents(s.parser.Feed([]byte("\x1b]11;?\x07")))
	report := []byte("\x1b]11;rgb:ffff/ffff/ffff\x1b\\")
	if err := s.Write(report); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	got, err := io.ReadAll(reader)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(report) {
		t.Fatalf("PTY input = %q, want allowed OSC 11 report", got)
	}
}

func TestWriteDropsDuplicateOSC11Report(t *testing.T) {
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	s := &Session{pty: writer}
	s.handleEvents(s.parser.Feed([]byte("\x1b]11;?\x07")))
	report := []byte("\x1b]11;rgb:ffff/ffff/ffff\x1b\\")
	if err := s.Write(report); err != nil {
		t.Fatal(err)
	}
	if err := s.Write(report); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	got, err := io.ReadAll(reader)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(report) {
		t.Fatalf("PTY input = %q, want only the first OSC 11 report", got)
	}
}

func TestColorQueryDoesNotEmitOnEvent(t *testing.T) {
	called := false
	s := &Session{onEvent: func(*Session, osc.Event) { called = true }}
	s.handleEvents(s.parser.Feed([]byte("\x1b]11;?\x07")))
	if called {
		t.Fatal("color query should not broadcast session state")
	}
}

func TestCompletedRunDurationIsReported(t *testing.T) {
	tests := []struct {
		name     string
		complete func(*Session)
	}{
		{
			name: "command end",
			complete: func(s *Session) {
				s.applyEvent(osc.Event{Kind: osc.EventCmdEnd})
			},
		},
		{
			name: "prompt",
			complete: func(s *Session) {
				s.applyEvent(osc.Event{Kind: osc.EventPrompt})
			},
		},
		{
			name: "fallback idle",
			complete: func(s *Session) {
				s.SetFallbackState(false, "")
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Session{State: StateRunning, RunStarted: time.Now().Add(-100 * time.Millisecond)}
			tt.complete(s)

			if got := s.Info().RunMs; got < 50 {
				t.Fatalf("RunMs = %d, want completed duration", got)
			}
		})
	}
}
