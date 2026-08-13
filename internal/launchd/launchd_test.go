package launchd

import (
	"os"
	"strings"
	"testing"
)

func TestWritePlistUsesDedicatedStdioLog(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	if err := WritePlist("/tmp/webtabinal"); err != nil {
		t.Fatal(err)
	}
	path, err := PlistPath()
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	content := string(data)
	if got := strings.Count(content, "daemon.stdio.log"); got != 2 {
		t.Fatalf("stdio log path count = %d, want 2", got)
	}
}

func TestWritePlistEscapesXMLValues(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	if err := WritePlist("/tmp/webtabinal&<binary>"); err != nil {
		t.Fatal(err)
	}
	path, err := PlistPath()
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "/tmp/webtabinal&amp;&lt;binary&gt;") {
		t.Fatalf("plist contains unescaped binary path: %s", data)
	}
}
