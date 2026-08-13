package server

import (
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sudabon/webtabinal/internal/config"
	"github.com/sudabon/webtabinal/internal/osc"
	"github.com/sudabon/webtabinal/internal/session"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // Host/Origin already checked
}

type clientMsg struct {
	T    string `json:"t"`
	SID  string `json:"sid"`
	Data string `json:"data,omitempty"`
	Cols int    `json:"cols,omitempty"`
	Rows int    `json:"rows,omitempty"`
}

type Hub struct {
	manager *session.Manager
	cfg     *config.Store
	logger  *log.Logger

	mu      sync.Mutex
	clients map[*wsClient]struct{}
}

type wsClient struct {
	conn         *websocket.Conn
	mu           sync.Mutex
	attach       map[string]bool
	replaying    map[string]bool
	pending      map[string][][]byte
	pendingBytes map[string]int
	send         chan []byte
	closeOnce    sync.Once
	quit         chan struct{}
}

func NewHub(manager *session.Manager, cfg *config.Store, logger *log.Logger) *Hub {
	h := &Hub{
		manager: manager,
		cfg:     cfg,
		logger:  logger,
		clients: make(map[*wsClient]struct{}),
	}
	manager.SetHooks(
		h.broadcastSessions,
		h.broadcastOutput,
		h.broadcastStateFromEvent,
		h.broadcastStateFromExit,
	)
	return h
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.Printf("ws upgrade: %v", err)
		return
	}
	c := &wsClient{
		conn:         conn,
		attach:       map[string]bool{},
		replaying:    map[string]bool{},
		pending:      map[string][][]byte{},
		pendingBytes: map[string]int{},
		send:         make(chan []byte, 256),
		quit:         make(chan struct{}),
	}
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
	go h.writeClient(c)
	if err := conn.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
		h.logger.Printf("ws read deadline: %v", err)
		h.disconnect(c)
		return
	}
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	// initial sync
	h.send(c, map[string]any{"t": "sessions", "list": h.manager.List()})
	for _, info := range h.manager.List() {
		h.send(c, stateMsg(info))
	}

	defer h.disconnect(c)

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		var msg clientMsg
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}
		h.handleClient(c, msg)
	}
}

func (h *Hub) handleClient(c *wsClient, msg clientMsg) {
	switch msg.T {
	case "attach":
		c.mu.Lock()
		c.attach[msg.SID] = true
		c.replaying[msg.SID] = true
		c.pending[msg.SID] = nil
		c.pendingBytes[msg.SID] = 0
		c.mu.Unlock()
		s, ok := h.manager.Get(msg.SID)
		if !ok {
			c.mu.Lock()
			delete(c.replaying, msg.SID)
			delete(c.pending, msg.SID)
			delete(c.pendingBytes, msg.SID)
			c.mu.Unlock()
			return
		}
		buf := s.Ring.Bytes()
		const chunk = 24 * 1024
		if len(buf) == 0 {
			h.send(c, map[string]any{"t": "replay", "sid": msg.SID, "data": "", "done": true})
		} else {
			for i := 0; i < len(buf); i += chunk {
				end := i + chunk
				if end > len(buf) {
					end = len(buf)
				}
				h.send(c, map[string]any{
					"t":    "replay",
					"sid":  msg.SID,
					"data": base64.StdEncoding.EncodeToString(buf[i:end]),
					"done": end >= len(buf),
				})
			}
		}
		for {
			c.mu.Lock()
			pending := c.pending[msg.SID]
			c.pending[msg.SID] = nil
			c.pendingBytes[msg.SID] = 0
			if len(pending) == 0 {
				c.replaying[msg.SID] = false
				delete(c.pending, msg.SID)
				delete(c.pendingBytes, msg.SID)
				c.mu.Unlock()
				break
			}
			c.mu.Unlock()
			for _, data := range pending {
				h.send(c, map[string]any{
					"t":    "output",
					"sid":  msg.SID,
					"data": base64.StdEncoding.EncodeToString(data),
				})
			}
		}
		h.send(c, stateMsg(s.Info()))
	case "input":
		s, ok := h.manager.Get(msg.SID)
		if !ok {
			return
		}
		raw, err := base64.StdEncoding.DecodeString(msg.Data)
		if err != nil {
			return
		}
		if err := s.Write(raw); err != nil {
			h.logger.Printf("session %s write: %v", msg.SID, err)
		}
	case "resize":
		if msg.Cols <= 0 || msg.Cols > 10000 || msg.Rows <= 0 || msg.Rows > 10000 {
			return
		}
		s, ok := h.manager.Get(msg.SID)
		if !ok {
			return
		}
		_ = s.Resize(uint16(msg.Cols), uint16(msg.Rows))
	}
}

func (h *Hub) broadcastOutput(s *session.Session, data []byte) {
	payload := map[string]any{
		"t":    "output",
		"sid":  s.ID,
		"data": base64.StdEncoding.EncodeToString(data),
	}
	const maxPendingBytes = 4 * 1024 * 1024
	for _, c := range h.clientSnapshot() {
		c.mu.Lock()
		ok := c.attach[s.ID]
		if ok && c.replaying[s.ID] {
			pendingBytes := c.pendingBytes[s.ID]
			if pendingBytes >= 0 && pendingBytes+len(data) <= maxPendingBytes {
				c.pending[s.ID] = append(c.pending[s.ID], data)
				c.pendingBytes[s.ID] = pendingBytes + len(data)
			} else {
				c.pending[s.ID] = nil
				c.pendingBytes[s.ID] = -1
			}
			c.mu.Unlock()
			continue
		}
		c.mu.Unlock()
		if ok {
			h.send(c, payload)
		}
	}
}

func (h *Hub) broadcastStateFromEvent(s *session.Session, _ osc.Event) {
	h.broadcastState(s.Info())
}

func (h *Hub) broadcastStateFromExit(s *session.Session) {
	h.broadcastState(s.Info())
	h.broadcastSessions()
}

func (h *Hub) broadcastState(info session.Info) {
	payload := stateMsg(info)
	for _, c := range h.clientSnapshot() {
		h.send(c, payload)
	}
}

func (h *Hub) broadcastSessions() {
	payload := map[string]any{"t": "sessions", "list": h.manager.List()}
	for _, c := range h.clientSnapshot() {
		h.send(c, payload)
	}
}

func (h *Hub) clientSnapshot() []*wsClient {
	h.mu.Lock()
	defer h.mu.Unlock()
	clients := make([]*wsClient, 0, len(h.clients))
	for c := range h.clients {
		clients = append(clients, c)
	}
	return clients
}

func (h *Hub) send(c *wsClient, v any) {
	b, err := json.Marshal(v)
	if err != nil {
		if h.logger != nil {
			h.logger.Printf("ws marshal: %v", err)
		}
		return
	}
	select {
	case <-c.quit:
		return
	default:
	}
	select {
	case c.send <- b:
	case <-c.quit:
	default:
		h.disconnect(c)
	}
}

func (h *Hub) writeClient(c *wsClient) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case b := <-c.send:
			if err := c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
				h.disconnect(c)
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, b); err != nil {
				h.disconnect(c)
				return
			}
		case <-ticker.C:
			if err := c.conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(10*time.Second)); err != nil {
				h.disconnect(c)
				return
			}
		case <-c.quit:
			return
		}
	}
}

func (h *Hub) disconnect(c *wsClient) {
	c.closeOnce.Do(func() {
		close(c.quit)
		_ = c.conn.Close()
		h.mu.Lock()
		delete(h.clients, c)
		h.mu.Unlock()
	})
}

func stateMsg(info session.Info) map[string]any {
	return map[string]any{
		"t":          "state",
		"sid":        info.ID,
		"cwd":        info.Cwd,
		"cmd":        info.Command,
		"state":      info.State,
		"exit":       info.ExitCode,
		"integrated": info.Integrated,
		"run_ms":     info.RunMs,
	}
}
