package server

import (
	"testing"
	"time"

	"github.com/sudabon/webtabinal/internal/agentdetect"
	"github.com/sudabon/webtabinal/internal/notifyarbiter"
	"github.com/sudabon/webtabinal/internal/osc"
)

func (a *agentHub) transition(from, to agentdetect.State) {
	a.hub.mu.Lock()
	a.hub.lastAgent[a.sess.ID] = from
	a.hub.mu.Unlock()
	a.hub.onAgentSnapshot(agentdetect.Snapshot{
		SessionID: a.sess.ID,
		AgentID:   agentdetect.IDCodex,
		State:     to,
		Since:     a.clock.Now(),
		Signal:    agentdetect.SignalScreen,
	})
}

func TestWorkingToIdleNotifiesPromptReturn(t *testing.T) {
	a := newAgentHub(t, "codex")
	a.transition(agentdetect.StateWorking, agentdetect.StateIdle)

	msg := a.nextNotify(t)
	if msg == nil {
		t.Fatal("expected a prompt-return notify frame")
	}
	if msg["kind"] != "agent_idle" || msg["source"] != "screen" {
		t.Fatalf("prompt-return frame = %#v", msg)
	}
	if msg["title"] != "Codex" {
		t.Fatalf("title = %v, want the agent display name", msg["title"])
	}
	if msg["body"] == "" || msg["body"] == nil {
		t.Fatalf("body = %v, want a ready-for-input message", msg["body"])
	}
	if _, ok := msg["banner"]; ok {
		t.Fatalf("listed agent should not carry a banner flag: %#v", msg)
	}
	if extra := a.nextNotify(t); extra != nil {
		t.Fatalf("expected exactly one notify, got another: %#v", extra)
	}
}

func TestIdleFromNoneDoesNotNotify(t *testing.T) {
	a := newAgentHub(t, "codex")
	a.transition(agentdetect.StateNone, agentdetect.StateIdle)

	if msg := a.nextNotify(t); msg != nil {
		t.Fatalf("session start should not notify: %#v", msg)
	}
}

func TestIdleFromBlockedDoesNotNotify(t *testing.T) {
	a := newAgentHub(t, "codex")
	a.transition(agentdetect.StateBlocked, agentdetect.StateIdle)

	if msg := a.nextNotify(t); msg != nil {
		t.Fatalf("answering an approval should not notify: %#v", msg)
	}
}

func TestRepeatedIdleDoesNotNotifyAgain(t *testing.T) {
	a := newAgentHub(t, "codex")
	a.transition(agentdetect.StateWorking, agentdetect.StateIdle)
	if msg := a.nextNotify(t); msg == nil {
		t.Fatal("expected the first prompt-return notify")
	}
	a.clock.Advance(notifyarbiter.Window)

	a.hub.onAgentSnapshot(agentdetect.Snapshot{
		SessionID: a.sess.ID,
		AgentID:   agentdetect.IDCodex,
		State:     agentdetect.StateIdle,
		Since:     a.clock.Now(),
		Signal:    agentdetect.SignalScreen,
	})
	if msg := a.nextNotify(t); msg != nil {
		t.Fatalf("repeated idle evidence notified again: %#v", msg)
	}
}

func TestPromptReturnForUnlistedAgentIsBannerSuppressed(t *testing.T) {
	a := newAgentHub(t, "codex")
	a.setNotifyAgents(t, []any{"claude"})
	a.transition(agentdetect.StateWorking, agentdetect.StateIdle)

	msg := a.nextNotify(t)
	if msg == nil {
		t.Fatal("expected a notify frame so the tab can still be marked unread")
	}
	if msg["kind"] != "agent_idle" || msg["banner"] != false {
		t.Fatalf("unlisted prompt return should be banner-suppressed: %#v", msg)
	}
}

func TestPromptReturnDedupesWithOSC(t *testing.T) {
	a := newAgentHub(t, "codex")
	a.hub.broadcastNotify(a.sess, osc.Event{Kind: osc.EventNotify, Title: "Codex", Body: "turn complete", OSC: 9})
	if msg := a.nextNotify(t); msg == nil {
		t.Fatal("expected the OSC notify")
	}

	a.clock.Advance(time.Second)
	a.transition(agentdetect.StateWorking, agentdetect.StateIdle)
	if msg := a.nextNotify(t); msg != nil {
		t.Fatalf("prompt return within the window should be deduped: %#v", msg)
	}

	a.clock.Advance(notifyarbiter.Window)
	a.transition(agentdetect.StateWorking, agentdetect.StateIdle)
	if msg := a.nextNotify(t); msg == nil {
		t.Fatal("a prompt return after the window should notify")
	}
}

func TestPromptReturnSkippedWhenDetectionDisabled(t *testing.T) {
	a := newAgentHub(t, "codex")
	if _, err := a.store.Patch(map[string]any{"state": map[string]any{"enabled": false}}); err != nil {
		t.Fatal(err)
	}
	a.transition(agentdetect.StateWorking, agentdetect.StateIdle)

	if msg := a.nextNotify(t); msg != nil {
		t.Fatalf("disabled detection should not produce prompt-return notifications: %#v", msg)
	}
}
