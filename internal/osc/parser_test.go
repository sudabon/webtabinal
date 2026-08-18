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

func TestParseCWDDecodesFileURLOnce(t *testing.T) {
	var p osc.Parser
	evs := p.Feed([]byte("\x1b]7;file:///tmp/a%2520b\x1b\\"))

	if len(evs) != 1 {
		t.Fatalf("expected 1 event, got %d", len(evs))
	}
	if evs[0].CWD != "/tmp/a%20b" {
		t.Fatalf("cwd = %q, want %q", evs[0].CWD, "/tmp/a%20b")
	}
}

func TestParseOSC9Notify(t *testing.T) {
	var p osc.Parser
	evs := p.Feed([]byte("\x1b]9;Codex needs approval\x07"))
	if len(evs) != 1 {
		t.Fatalf("expected 1 event, got %d %#v", len(evs), evs)
	}
	if evs[0].Kind != osc.EventNotify || evs[0].Body != "Codex needs approval" || evs[0].Title != "" {
		t.Fatalf("notify: %#v", evs[0])
	}
}

func TestParseOSC9NotifyST(t *testing.T) {
	var p osc.Parser
	evs := p.Feed([]byte("\x1b]9;Codex needs approval\x1b\\"))
	if len(evs) != 1 || evs[0].Kind != osc.EventNotify || evs[0].Body != "Codex needs approval" {
		t.Fatalf("notify ST: %#v", evs)
	}
}

func TestParseOSC9EmptyIgnored(t *testing.T) {
	var p osc.Parser
	evs := p.Feed([]byte("\x1b]9;\x07"))
	if len(evs) != 0 {
		t.Fatalf("expected no events, got %#v", evs)
	}
}

func TestParseOSC99TitleAndBody(t *testing.T) {
	var p osc.Parser
	evs := p.Feed([]byte("\x1b]99;i=1:p=title;Claude Code\x07\x1b]99;i=1:p=body;Permission required\x07"))
	if len(evs) != 2 {
		t.Fatalf("expected 2 events, got %d %#v", len(evs), evs)
	}
	if evs[0].Kind != osc.EventNotify || evs[0].Title != "Claude Code" || evs[0].Body != "" {
		t.Fatalf("title: %#v", evs[0])
	}
	if evs[1].Kind != osc.EventNotify || evs[1].Title != "" || evs[1].Body != "Permission required" {
		t.Fatalf("body: %#v", evs[1])
	}
}

func TestParseOSC99BarePayload(t *testing.T) {
	var p osc.Parser
	evs := p.Feed([]byte("\x1b]99;needs approval\x1b\\"))
	if len(evs) != 1 || evs[0].Kind != osc.EventNotify || evs[0].Body != "needs approval" {
		t.Fatalf("bare payload: %#v", evs)
	}
}

func TestParseOSC777Notify(t *testing.T) {
	var p osc.Parser
	evs := p.Feed([]byte("\x1b]777;notify;Codex;turn complete\x07"))
	if len(evs) != 1 {
		t.Fatalf("expected 1 event, got %#v", evs)
	}
	if evs[0].Kind != osc.EventNotify || evs[0].OSC != 777 || evs[0].Title != "Codex" || evs[0].Body != "turn complete" {
		t.Fatalf("osc777: %#v", evs[0])
	}
}

func TestParseOSC11ColorQuery(t *testing.T) {
	var p osc.Parser
	evs := p.Feed([]byte("\x1b]11;?\x07"))
	if len(evs) != 1 || evs[0].Kind != osc.EventColorQuery {
		t.Fatalf("query: %#v", evs)
	}
	if len(evs[0].ColorIndexes) != 1 || evs[0].ColorIndexes[0] != 11 {
		t.Fatalf("indexes: %#v", evs[0].ColorIndexes)
	}
}

func TestParseOSC10StackedColorQueries(t *testing.T) {
	var p osc.Parser
	evs := p.Feed([]byte("\x1b]10;?;?\x1b\\"))
	if len(evs) != 1 || evs[0].Kind != osc.EventColorQuery {
		t.Fatalf("stacked: %#v", evs)
	}
	if got := evs[0].ColorIndexes; len(got) != 2 || got[0] != 10 || got[1] != 11 {
		t.Fatalf("indexes: %#v", got)
	}
}

func TestFilterColorReportsDropsUnsolicited(t *testing.T) {
	in := []byte("hello\x1b]11;rgb:ffff/ffff/ffff\x1b\\world")
	got := osc.FilterColorReports(in, func(int) bool { return false })
	if string(got) != "helloworld" {
		t.Fatalf("filtered = %q, want helloworld", got)
	}
}

func TestFilterColorReportsKeepsAllowed(t *testing.T) {
	in := []byte("\x1b]11;rgb:ffff/ffff/ffff\x07")
	got := osc.FilterColorReports(in, func(code int) bool { return code == 11 })
	if string(got) != string(in) {
		t.Fatalf("filtered = %q, want report kept", got)
	}
}

func TestFilterColorReportsDropsConcatenatedUnsolicited(t *testing.T) {
	in := []byte("\x1b]11;rgb:ffff/ffff/ffff\x1b\\\x1b]11;rgb:ffff/ffff/ffff\x1b\\")
	got := osc.FilterColorReports(in, func(int) bool { return false })
	if len(got) != 0 {
		t.Fatalf("filtered = %q, want empty", got)
	}
}

func TestFilterColorReportsLeavesPlainInput(t *testing.T) {
	in := []byte("echo hi\r")
	got := osc.FilterColorReports(in, func(int) bool { return false })
	if string(got) != string(in) {
		t.Fatalf("filtered = %q, want unchanged", got)
	}
}

func TestLightPaletteReportsMatchXParseColor(t *testing.T) {
	p := osc.LightPalette()
	got := string(p.Reports([]int{10, 11, 12}))
	want := "\x1b]10;rgb:3333/3333/3333\x07" +
		"\x1b]11;rgb:ffff/ffff/ffff\x07" +
		"\x1b]12;rgb:0000/0000/0000\x07"
	if got != want {
		t.Fatalf("reports = %q, want %q", got, want)
	}
}

func TestDarkPaletteReportsMatchXParseColor(t *testing.T) {
	p := osc.DarkPalette()
	got := string(p.Reports([]int{11}))
	want := "\x1b]11;rgb:1e1e/1e1e/1e1e\x07"
	if got != want {
		t.Fatalf("reports = %q, want %q", got, want)
	}
}

func TestLightPaletteEnvHintsLightTheme(t *testing.T) {
	got := osc.LightPalette().Env()
	want := []string{"TERM_THEME=light", "ANSI_LIGHT=1", "COLORFGBG=0;15"}
	if len(got) != len(want) {
		t.Fatalf("env = %#v, want %#v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("env = %#v, want %#v", got, want)
		}
	}
}

func TestDarkPaletteEnvHintsDarkTheme(t *testing.T) {
	got := osc.DarkPalette().Env()
	want := []string{"TERM_THEME=dark", "COLORFGBG=15;0"}
	if len(got) != len(want) {
		t.Fatalf("env = %#v, want %#v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("env = %#v, want %#v", got, want)
		}
	}
}
