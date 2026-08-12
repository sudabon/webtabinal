package server

import (
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"sync"

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
	conn   *websocket.Conn
	mu     sync.Mutex
	attach map[string]bool
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
	c := &wsClient{conn: conn, attach: map[string]bool{}}
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()

	// initial sync
	h.send(c, map[string]any{"t": "sessions", "list": h.manager.List()})
	for _, info := range h.manager.List() {
		h.send(c, stateMsg(info))
	}

	defer func() {
		h.mu.Lock()
		delete(h.clients, c)
		h.mu.Unlock()
		_ = conn.Close()
	}()

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
		c.mu.Unlock()
		s, ok := h.manager.Get(msg.SID)
		if !ok {
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
		_ = s.Write(raw)
	case "resize":
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
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		c.mu.Lock()
		ok := c.attach[s.ID]
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
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		h.send(c, payload)
	}
}

func (h *Hub) broadcastSessions() {
	payload := map[string]any{"t": "sessions", "list": h.manager.List()}
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		h.send(c, payload)
	}
}

func (h *Hub) send(c *wsClient, v any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = c.conn.WriteJSON(v)
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
