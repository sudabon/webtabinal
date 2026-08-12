package osc

import (
	"encoding/base64"
	"net/url"
	"strconv"
	"strings"
)

type EventKind int

const (
	EventNone EventKind = iota
	EventCWD
	EventCmdStart
	EventCmdEnd
	EventPrompt
)

type Event struct {
	Kind     EventKind
	CWD      string
	Command  string
	ExitCode *int
}

// Parser scans a byte stream for OSC sequences and returns events.
// It does not strip sequences; callers forward original bytes unchanged.
type Parser struct {
	buf []byte
}

func (p *Parser) Feed(data []byte) []Event {
	p.buf = append(p.buf, data...)
	var events []Event
	for {
		start := indexOSC(p.buf)
		if start < 0 {
			if len(p.buf) > 8192 {
				p.buf = p.buf[len(p.buf)-4096:]
			}
			return events
		}
		if start > 0 {
			p.buf = p.buf[start:]
		}
		end := indexOSCEnd(p.buf)
		if end < 0 {
			return events
		}
		payload := string(p.buf[2:end]) // after ESC ]
		p.buf = p.buf[end+termLen(p.buf[end:]):]
		if ev, ok := parseOSC(payload); ok {
			events = append(events, ev)
		}
	}
}

func indexOSC(b []byte) int {
	for i := 0; i+1 < len(b); i++ {
		if b[i] == 0x1b && b[i+1] == ']' {
			return i
		}
	}
	return -1
}

func indexOSCEnd(b []byte) int {
	for i := 2; i < len(b); i++ {
		if b[i] == 0x07 { // BEL
			return i
		}
		if b[i] == 0x1b && i+1 < len(b) && b[i+1] == '\\' { // ST
			return i
		}
	}
	return -1
}

func termLen(b []byte) int {
	if len(b) == 0 {
		return 0
	}
	if b[0] == 0x07 {
		return 1
	}
	if b[0] == 0x1b {
		return 2
	}
	return 1
}

func parseOSC(payload string) (Event, bool) {
	// OSC 7 ; file://...
	if strings.HasPrefix(payload, "7;") {
		raw := strings.TrimPrefix(payload, "7;")
		cwd := parseFileURL(raw)
		if cwd == "" {
			return Event{}, false
		}
		return Event{Kind: EventCWD, CWD: cwd}, true
	}
	// OSC 133 ; A|B|C|D[;exit]
	if strings.HasPrefix(payload, "133;") {
		rest := strings.TrimPrefix(payload, "133;")
		parts := strings.SplitN(rest, ";", 2)
		switch parts[0] {
		case "A":
			return Event{Kind: EventPrompt}, true
		case "C":
			return Event{Kind: EventCmdStart}, true
		case "D":
			var code *int
			if len(parts) > 1 && parts[1] != "" {
				if v, err := strconv.Atoi(parts[1]); err == nil {
					code = &v
				}
			}
			return Event{Kind: EventCmdEnd, ExitCode: code}, true
		}
		return Event{}, false
	}
	// OSC 9973 ; cmd ; base64
	if strings.HasPrefix(payload, "9973;") {
		rest := strings.TrimPrefix(payload, "9973;")
		parts := strings.SplitN(rest, ";", 2)
		if len(parts) != 2 || parts[0] != "cmd" {
			return Event{}, false
		}
		decoded, err := base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			return Event{}, false
		}
		return Event{Kind: EventCmdStart, Command: string(decoded)}, true
	}
	return Event{}, false
}

func parseFileURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if u.Scheme != "file" {
		// Some shells emit path only
		if strings.HasPrefix(raw, "/") {
			return raw
		}
		return ""
	}
	path, err := url.PathUnescape(u.Path)
	if err != nil {
		return u.Path
	}
	return path
}
