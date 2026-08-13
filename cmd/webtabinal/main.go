package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"

	"github.com/sudabon/webtabinal/internal/config"
	"github.com/sudabon/webtabinal/internal/integration"
	"github.com/sudabon/webtabinal/internal/launchd"
	"github.com/sudabon/webtabinal/internal/logging"
	"github.com/sudabon/webtabinal/internal/paths"
	"github.com/sudabon/webtabinal/internal/server"
	"github.com/sudabon/webtabinal/internal/session"
	"github.com/sudabon/webtabinal/internal/static"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "serve":
		if err := runServe(); err != nil {
			fmt.Fprintf(os.Stderr, "serve error: %v\n", err)
			os.Exit(1)
		}
	case "install":
		bin, err := os.Executable()
		if err != nil {
			fatal(err)
		}
		if resolved, err := filepath.EvalSymlinks(bin); err == nil {
			bin = resolved
		}
		if err := launchd.Install(bin); err != nil {
			fatal(err)
		}
		fmt.Println("installed LaunchAgent", launchd.Label)
	case "uninstall":
		if err := launchd.Uninstall(); err != nil {
			fatal(err)
		}
		fmt.Println("uninstalled LaunchAgent")
	case "status":
		st, err := launchd.Status()
		if err != nil {
			fatal(err)
		}
		fmt.Println(st)
		cfg, err := config.LoadOrCreate()
		if err == nil {
			fmt.Printf("url: http://127.0.0.1:%d\n", cfg.Get().Port)
		}
	case "open":
		cfg, err := config.LoadOrCreate()
		if err != nil {
			fatal(err)
		}
		url := fmt.Sprintf("http://127.0.0.1:%d", cfg.Get().Port)
		var cmd *exec.Cmd
		if runtime.GOOS == "darwin" {
			cmd = exec.Command("open", url)
		} else {
			cmd = exec.Command("xdg-open", url)
		}
		if err := cmd.Start(); err != nil {
			fatal(err)
		}
		fmt.Println(url)
	default:
		usage()
		os.Exit(2)
	}
}

func runServe() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	logger, err := logging.Setup()
	if err != nil {
		return err
	}
	cfg, err := config.LoadOrCreate()
	if err != nil {
		return err
	}
	if err := integration.Write(); err != nil {
		return err
	}
	logger.Printf("integration written; add to .zshrc:\n  %s", integration.ZshrcSnippet())

	mgr := session.NewManager(cfg, logger)
	defer mgr.Close()

	hub := server.NewHub(mgr, cfg, logger)
	srv := server.New(cfg, logger, hub, static.Handler())
	return srv.Run(ctx)
}

func usage() {
	fmt.Fprintf(os.Stderr, "usage: %s <serve|install|uninstall|status|open>\n", paths.CLIName)
}

func fatal(err error) {
	fmt.Fprintf(os.Stderr, "%v\n", err)
	os.Exit(1)
}
