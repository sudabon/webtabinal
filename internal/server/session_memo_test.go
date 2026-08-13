package server

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sudabon/webtabinal/internal/session"
)

func TestPatchSessionMemoSuccess(t *testing.T) {
	store := testConfigStore(t)
	manager := session.NewManager(store, log.New(io.Discard, "", 0))
	defer manager.Close()
	s, err := manager.Create(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	changed := false
	manager.SetHooks(func() { changed = true }, nil, nil, nil)
	srv := &Server{hub: &Hub{manager: manager}}

	req := httptest.NewRequest(http.MethodPatch, "/api/sessions/"+s.ID, strings.NewReader(`{"memo":" CI watch "}`))
	req.SetPathValue("id", s.ID)
	rec := httptest.NewRecorder()
	srv.handlePatchSession(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	var info session.Info
	if err := json.Unmarshal(rec.Body.Bytes(), &info); err != nil {
		t.Fatal(err)
	}
	if info.Memo != "CI watch" {
		t.Fatalf("memo = %q, want CI watch", info.Memo)
	}
	if !changed {
		t.Fatal("expected sessions broadcast hook to run")
	}
}

func TestPatchSessionMemoRejectsOverLimit(t *testing.T) {
	store := testConfigStore(t)
	manager := session.NewManager(store, log.New(io.Discard, "", 0))
	defer manager.Close()
	s, err := manager.Create(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	_ = s.SetMemo("keep")
	srv := &Server{hub: &Hub{manager: manager}}

	tooLong := `{"memo":"` + strings.Repeat("あ", session.MaxMemoRunes+1) + `"}`
	req := httptest.NewRequest(http.MethodPatch, "/api/sessions/"+s.ID, strings.NewReader(tooLong))
	req.SetPathValue("id", s.ID)
	rec := httptest.NewRecorder()
	srv.handlePatchSession(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if got := s.Info().Memo; got != "keep" {
		t.Fatalf("memo = %q, want keep", got)
	}
}

func TestPatchSessionMemoUnknownID(t *testing.T) {
	store := testConfigStore(t)
	manager := session.NewManager(store, log.New(io.Discard, "", 0))
	defer manager.Close()
	srv := &Server{hub: &Hub{manager: manager}}

	req := httptest.NewRequest(http.MethodPatch, "/api/sessions/missing", strings.NewReader(`{"memo":"x"}`))
	req.SetPathValue("id", "missing")
	rec := httptest.NewRecorder()
	srv.handlePatchSession(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}
