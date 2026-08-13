package static

import (
	"strings"
	"testing"
)

func TestIsPlaceholderMatchesEmbeddedIndex(t *testing.T) {
	b, err := distEmbed.ReadFile("dist/index.html")
	if err != nil {
		t.Fatal(err)
	}
	want := strings.Contains(string(b), placeholderMarker)
	if got := IsPlaceholder(); got != want {
		t.Fatalf("IsPlaceholder() = %v, want %v", got, want)
	}
}
