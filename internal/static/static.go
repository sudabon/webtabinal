package static

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

//go:embed all:dist
var distEmbed embed.FS

func Handler() http.Handler {
	sub, err := fs.Sub(distEmbed, "dist")
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "frontend not embedded", http.StatusServiceUnavailable)
		})
	}
	fileServer := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestPath := strings.TrimPrefix(r.URL.Path, "/")
		if requestPath == "" {
			requestPath = "index.html"
		}
		if _, err := fs.Stat(sub, requestPath); err != nil {
			if path.Ext(requestPath) != "" {
				http.NotFound(w, r)
				return
			}
			// SPA fallback
			r.URL.Path = "/"
			fileServer.ServeHTTP(w, r)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

// DevHandler serves from web/dist on disk when present (optional helper).
func DevHandler(repoRoot string) http.Handler {
	dir := filepath.Join(repoRoot, "web", "dist")
	if st, err := os.Stat(dir); err != nil || !st.IsDir() {
		return nil
	}
	return http.FileServer(http.Dir(dir))
}
