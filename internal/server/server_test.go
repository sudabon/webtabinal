package server

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sudabon/webtabinal/internal/config"
	"github.com/sudabon/webtabinal/internal/session"
)

func testConfigStore(t *testing.T) *config.Store {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	store, err := config.LoadOrCreate()
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func TestSendDoesNotBlockOnSlowClient(t *testing.T) {
	serverConn := make(chan *websocket.Conn, 1)
	httpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Error(err)
			return
		}
		serverConn <- conn
	}))
	defer httpServer.Close()

	clientConn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(httpServer.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	conn := <-serverConn
	if tcp, ok := conn.UnderlyingConn().(*net.TCPConn); ok {
		if err := tcp.SetWriteBuffer(1024); err != nil {
			t.Fatal(err)
		}
	}
	c := &wsClient{
		conn:   conn,
		attach: map[string]bool{},
		send:   make(chan []byte, 256),
		quit:   make(chan struct{}),
	}
	h := &Hub{}
	returned := make(chan struct{})
	go func() {
		h.send(c, map[string]any{"data": strings.Repeat("x", 4*1024*1024)})
		close(returned)
	}()

	fast := false
	select {
	case <-returned:
		fast = true
	case <-time.After(250 * time.Millisecond):
	}
	_ = clientConn.Close()
	_ = conn.Close()
	if !fast {
		<-returned
		t.Fatal("send blocked on a client that was not reading")
	}
}

func TestBroadcastBuffersOutputDuringReplay(t *testing.T) {
	c := &wsClient{
		attach:       map[string]bool{"session": true},
		replaying:    map[string]bool{"session": true},
		pending:      map[string][][]byte{},
		pendingBytes: map[string]int{},
		send:         make(chan []byte, 1),
		quit:         make(chan struct{}),
	}
	h := &Hub{clients: map[*wsClient]struct{}{c: {}}}
	s := &session.Session{ID: "session"}

	h.broadcastOutput(s, []byte("live"))

	if len(c.send) != 0 {
		t.Fatal("live output was sent before replay completed")
	}
	if got := c.pending["session"]; len(got) != 1 || string(got[0]) != "live" {
		t.Fatalf("pending output = %#v, want one live chunk", got)
	}
}

func TestReplayPendingOutputIsBounded(t *testing.T) {
	c := &wsClient{
		attach:       map[string]bool{"session": true},
		replaying:    map[string]bool{"session": true},
		pending:      map[string][][]byte{},
		pendingBytes: map[string]int{},
		send:         make(chan []byte, 1),
		quit:         make(chan struct{}),
	}
	h := &Hub{clients: map[*wsClient]struct{}{c: {}}}

	h.broadcastOutput(&session.Session{ID: "session"}, make([]byte, 4*1024*1024+1))

	if c.pendingBytes["session"] != -1 || len(c.pending["session"]) != 0 {
		t.Fatal("oversized replay pending output was retained")
	}
}

func TestAttachOverflowNotifiesClient(t *testing.T) {
	c := &wsClient{
		attach:       map[string]bool{"session": true},
		replaying:    map[string]bool{"session": true},
		pending:      map[string][][]byte{},
		pendingBytes: map[string]int{},
		send:         make(chan []byte, 4),
		quit:         make(chan struct{}),
	}
	h := &Hub{clients: map[*wsClient]struct{}{c: {}}}

	h.broadcastOutput(&session.Session{ID: "session"}, make([]byte, 4*1024*1024+1))
	if !h.flushAttachPending(c, "session") {
		t.Fatal("expected overflow during attach flush")
	}

	select {
	case raw := <-c.send:
		if !strings.Contains(string(raw), `"code":"attach_overflow"`) {
			t.Fatalf("message = %s, want attach_overflow error", raw)
		}
	default:
		t.Fatal("expected attach_overflow error message")
	}
	if c.replaying["session"] {
		t.Fatal("replaying should be cleared after overflow")
	}
}

func TestResizeRejectsOutOfRangeDimensions(t *testing.T) {
	store := testConfigStore(t)
	manager := session.NewManager(store, nil)
	defer manager.Close()
	s, err := manager.Create(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := &Hub{manager: manager, logger: log.New(io.Discard, "", 0)}

	h.handleClient(nil, clientMsg{T: "resize", SID: s.ID, Cols: 65536, Rows: 24})

	if s.Cols != 120 || s.Rows != 40 {
		t.Fatalf("size = %dx%d, want 120x40", s.Cols, s.Rows)
	}
}

func TestCreateSessionRejectsMalformedJSON(t *testing.T) {
	store := testConfigStore(t)
	manager := session.NewManager(store, nil)
	defer manager.Close()
	srv := &Server{hub: &Hub{manager: manager}}
	req := httptest.NewRequest(http.MethodPost, "/api/sessions", strings.NewReader(`{"cwd":123}`))
	rec := httptest.NewRecorder()

	srv.handleCreateSession(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestInputWriteFailureIsLogged(t *testing.T) {
	store := testConfigStore(t)
	manager := session.NewManager(store, nil)
	defer manager.Close()
	s, err := manager.Create(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	var logs bytes.Buffer
	h := &Hub{manager: manager, logger: log.New(&logs, "", 0)}

	h.handleClient(nil, clientMsg{
		T:    "input",
		SID:  s.ID,
		Data: base64.StdEncoding.EncodeToString([]byte("x")),
	})

	if got := logs.String(); !strings.Contains(got, "session "+s.ID+" write:") {
		t.Fatalf("log = %q, want session write error", got)
	}
}

func TestRunReturnsErrAlreadyRunningWhenPortAlreadyListening(t *testing.T) {
	store := testConfigStore(t)
	manager := session.NewManager(store, log.New(io.Discard, "", 0))
	defer manager.Close()
	hub := NewHub(manager, store, log.New(io.Discard, "", 0))
	existing := New(store, log.New(io.Discard, "", 0), hub, nil)
	httpSrv := httptest.NewServer(existing.Handler())
	defer httpSrv.Close()

	u, err := url.Parse(httpSrv.URL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(u.Port())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Patch(map[string]any{"port": port}); err != nil {
		t.Fatal(err)
	}

	var logs bytes.Buffer
	srv := New(store, log.New(&logs, "", 0), hub, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err = srv.Run(ctx)
	if !errors.Is(err, ErrAlreadyRunning) {
		t.Fatalf("Run = %v, want ErrAlreadyRunning", err)
	}
	if !strings.Contains(logs.String(), "already listening") {
		t.Fatalf("log = %q, want already listening message", logs.String())
	}
}

func TestLoopbackListening(t *testing.T) {
	store := testConfigStore(t)
	srv := New(store, log.New(io.Discard, "", 0), nil, nil)
	httpSrv := httptest.NewServer(srv.Handler())
	defer httpSrv.Close()

	u, err := url.Parse(httpSrv.URL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(u.Port())
	if err != nil {
		t.Fatal(err)
	}
	if !LoopbackListening(port) {
		t.Fatal("expected WebTabinal server to report true")
	}
	httpSrv.Close()
	deadline := time.Now().Add(2 * time.Second)
	for LoopbackListening(port) {
		if time.Now().After(deadline) {
			t.Fatal("expected closed port to report false")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestLoopbackListeningPlainTCPOnly(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	if LoopbackListening(port) {
		t.Fatal("expected plain TCP listener without WebTabinal HTTP to report false")
	}
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestRunStopsWhenContextIsCanceled(t *testing.T) {
	store := testConfigStore(t)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := listener.Addr().String()
	port := listener.Addr().(*net.TCPAddr).Port
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Patch(map[string]any{"port": port}); err != nil {
		t.Fatal(err)
	}
	srv := New(store, log.New(io.Discard, "", 0), nil, nil)
	runner, ok := any(srv).(interface {
		Run(context.Context) error
	})
	if !ok {
		t.Fatal("Server does not implement Run(context.Context)")
	}
	ctx, cancel := context.WithCancel(context.Background())
	result := make(chan error, 1)
	go func() {
		result <- runner.Run(ctx)
	}()

	deadline := time.Now().Add(2 * time.Second)
	for {
		conn, err := net.DialTimeout("tcp", addr, 50*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			break
		}
		if time.Now().After(deadline) {
			cancel()
			t.Fatalf("server did not listen on %s: %v", addr, err)
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	select {
	case err := <-result:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after cancellation")
	}
}

func TestSecurityUsesPortBoundAtServerCreation(t *testing.T) {
	store := testConfigStore(t)
	srv := New(store, log.New(io.Discard, "", 0), nil, nil)
	if _, err := store.Patch(map[string]any{"port": 9000}); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8642/", nil)
	req.Host = "127.0.0.1:8642"
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestSecurityHeadersAreSet(t *testing.T) {
	store := testConfigStore(t)
	srv := New(store, log.New(io.Discard, "", 0), nil, nil)
	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8642/", nil)
	req.Host = "127.0.0.1:8642"
	rec := httptest.NewRecorder()

	srv.Handler().ServeHTTP(rec, req)

	headers := map[string]string{
		"X-Frame-Options":         "DENY",
		"X-Content-Type-Options":  "nosniff",
		"Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'; style-src 'self' 'unsafe-inline'",
	}
	for name, want := range headers {
		if got := rec.Header().Get(name); got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}
}
