package server

import (
	"io"
	"log"
	"testing"
	"time"

	"github.com/sudabon/webtabinal/internal/agentdetect"
	"github.com/sudabon/webtabinal/internal/config"
	"github.com/sudabon/webtabinal/internal/notifyarbiter"
	"github.com/sudabon/webtabinal/internal/osc"
	"github.com/sudabon/webtabinal/internal/session"
)

// agentHub builds a Hub over a live session whose detector has already
// resolved an identity from command, so notification scoping can be exercised
// without driving a real PTY.
type agentHub struct {
	hub   *Hub
	conn  *wsClient
	sess  *session.Session
	store *config.Store
	clock *agentdetect.ManualClock
}

func newAgentHub(t *testing.T, command string) *agentHub {
	t.Helper()
	clock := agentdetect.NewManualClock(time.Unix(1_700_000_000, 0))
	c := &wsClient{send: make(chan []byte, 16), quit: make(chan struct{})}
	store := testConfigStore(t)
	mgr := session.NewManager(store, log.New(io.Discard, "", 0))
	t.Cleanup(mgr.Close)
	eng := agentdetect.New(agentdetect.Options{
		Registry: agentdetect.Load(agentdetect.LoadOptions{DisableLocal: true}),
		Clock:    clock,
	})
	mgr.SetEngine(eng)
	live, err := mgr.Create("")
	if err != nil {
		t.Fatal(err)
	}
	if command != "" {
		eng.OnCommandStart(live.ID, command)
	}
	h := &Hub{
		manager:   mgr,
		cfg:       store,
		clients:   map[*wsClient]struct{}{c: {}},
		arbiter:   notifyarbiter.New(clock),
		lastAgent: map[string]agentdetect.State{},
	}
	drainClient(c)
	return &agentHub{hub: h, conn: c, sess: live, store: store, clock: clock}
}

func (a *agentHub) setNotifyAgents(t *testing.T, ids []any) {
	t.Helper()
	if _, err := a.store.Patch(map[string]any{"state": map[string]any{"notify_agents": ids}}); err != nil {
		t.Fatal(err)
	}
}

// nextNotify drains frames until a notify arrives, returning nil if none does.
func (a *agentHub) nextNotify(t *testing.T) map[string]any {
	t.Helper()
	for len(a.conn.send) > 0 {
		if msg := recvJSON(t, a.conn); msg["t"] == "notify" {
			return msg
		}
	}
	return nil
}

func TestBannerAllowed(t *testing.T) {
	store := testConfigStore(t)
	h := &Hub{cfg: store}

	tests := []struct {
		name         string
		enabled      bool
		notifyAgents []any
		agentID      string
		want         bool
	}{
		{name: "listed agent", enabled: true, notifyAgents: []any{"claude", "codex", "cursor-agent"}, agentID: agentdetect.IDCodex, want: true},
		{name: "unlisted agent", enabled: true, notifyAgents: []any{"claude"}, agentID: agentdetect.IDCodex, want: false},
		{name: "unidentified session", enabled: true, notifyAgents: []any{"claude"}, agentID: "", want: false},
		{name: "generic manifest", enabled: true, notifyAgents: []any{"claude"}, agentID: agentdetect.IDGeneric, want: false},
		{name: "empty list allows identified", enabled: true, notifyAgents: []any{}, agentID: "aider", want: true},
		{name: "empty list still excludes generic", enabled: true, notifyAgents: []any{}, agentID: agentdetect.IDGeneric, want: false},
		{name: "empty list still excludes unidentified", enabled: true, notifyAgents: []any{}, agentID: "", want: false},
		{name: "detection off ignores list", enabled: false, notifyAgents: []any{"claude"}, agentID: "", want: true},
		{name: "detection off allows generic", enabled: false, notifyAgents: []any{"claude"}, agentID: agentdetect.IDGeneric, want: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := store.Patch(map[string]any{"state": map[string]any{
				"enabled":       tt.enabled,
				"notify_agents": tt.notifyAgents,
			}}); err != nil {
				t.Fatal(err)
			}
			if got := h.bannerAllowed(tt.agentID); got != tt.want {
				t.Fatalf("bannerAllowed(%q) = %v, want %v", tt.agentID, got, tt.want)
			}
		})
	}
}

func TestBannerAllowedWithoutConfig(t *testing.T) {
	h := &Hub{}
	if !h.bannerAllowed("") {
		t.Fatal("a hub without config must not suppress banners")
	}
}

func TestOSCNotifyForListedAgentRaisesBanner(t *testing.T) {
	a := newAgentHub(t, "codex")
	a.hub.broadcastNotify(a.sess, osc.Event{Kind: osc.EventNotify, Title: "Codex", Body: "needs approval", OSC: 9})

	msg := a.nextNotify(t)
	if msg == nil {
		t.Fatal("expected a notify frame")
	}
	if _, ok := msg["banner"]; ok {
		t.Fatalf("listed agent should not carry a banner flag: %#v", msg)
	}
}

func TestOSCNotifyForUnidentifiedSessionIsBannerSuppressed(t *testing.T) {
	a := newAgentHub(t, "")
	a.hub.broadcastNotify(a.sess, osc.Event{Kind: osc.EventNotify, Title: "make", Body: "build finished", OSC: 9})

	msg := a.nextNotify(t)
	if msg == nil {
		t.Fatal("expected a notify frame so the tab can still be marked unread")
	}
	if msg["banner"] != false {
		t.Fatalf("unidentified session should be banner-suppressed: %#v", msg)
	}
}

func TestOSCNotifyForUnlistedAgentIsBannerSuppressed(t *testing.T) {
	a := newAgentHub(t, "codex")
	a.setNotifyAgents(t, []any{"claude"})
	a.hub.broadcastNotify(a.sess, osc.Event{Kind: osc.EventNotify, Title: "Codex", Body: "needs approval", OSC: 9})

	msg := a.nextNotify(t)
	if msg == nil {
		t.Fatal("expected a notify frame")
	}
	if msg["banner"] != false {
		t.Fatalf("unlisted agent should be banner-suppressed: %#v", msg)
	}
}

func TestBlockedNotifyForUnlistedAgentIsBannerSuppressed(t *testing.T) {
	a := newAgentHub(t, "codex")
	a.setNotifyAgents(t, []any{"claude"})
	a.hub.lastAgent[a.sess.ID] = agentdetect.StateWorking

	a.hub.onAgentSnapshot(agentdetect.Snapshot{
		SessionID: a.sess.ID,
		AgentID:   agentdetect.IDCodex,
		State:     agentdetect.StateBlocked,
		Since:     a.clock.Now(),
		Signal:    agentdetect.SignalScreen,
	})

	msg := a.nextNotify(t)
	if msg == nil {
		t.Fatal("expected a notify frame")
	}
	if msg["kind"] != "agent_blocked" || msg["banner"] != false {
		t.Fatalf("unlisted blocked agent should be banner-suppressed: %#v", msg)
	}
}

// A suppressed banner must not burn the four-second attention window, or a
// later legitimate event from the same session would be swallowed.
func TestBannerSuppressedEventDoesNotConsumeArbiter(t *testing.T) {
	a := newAgentHub(t, "codex")
	a.setNotifyAgents(t, []any{"claude"})
	a.hub.broadcastNotify(a.sess, osc.Event{Kind: osc.EventNotify, Title: "Codex", Body: "first", OSC: 9})
	if msg := a.nextNotify(t); msg == nil || msg["banner"] != false {
		t.Fatalf("expected a banner-suppressed frame, got %#v", msg)
	}

	a.setNotifyAgents(t, []any{"codex"})
	a.hub.broadcastNotify(a.sess, osc.Event{Kind: osc.EventNotify, Title: "Codex", Body: "second", OSC: 9})
	msg := a.nextNotify(t)
	if msg == nil {
		t.Fatal("expected the later eligible event to notify")
	}
	if _, ok := msg["banner"]; ok {
		t.Fatalf("later eligible event should raise a banner: %#v", msg)
	}
}
