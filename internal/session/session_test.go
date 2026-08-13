package session

import (
	"bytes"
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
