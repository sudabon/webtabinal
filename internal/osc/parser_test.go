package osc_test

import (
	"testing"

	"github.com/sudabon/webtabinal/internal/osc"
)

func TestParseCWDAndCmd(t *testing.T) {
	var p osc.Parser
	in := "\x1b]7;file:///Users/me/proj\x1b\\\x1b]9973;cmd;Z28gdGVzdA==\x1b\\\x1b]133;C\x1b\\\x1b]133;D;0\x1b\\\x1b]133;A\x1b\\"
	evs := p.Feed([]byte(in))
	if len(evs) < 4 {
		t.Fatalf("expected >=4 events, got %d %#v", len(evs), evs)
	}
	if evs[0].Kind != osc.EventCWD || evs[0].CWD != "/Users/me/proj" {
		t.Fatalf("cwd: %#v", evs[0])
	}
	if evs[1].Kind != osc.EventCmdStart || evs[1].Command != "go test" {
		t.Fatalf("cmd: %#v", evs[1])
	}
}
