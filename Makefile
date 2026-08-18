.PHONY: build web daemon serve desktop desktop-test clean e2e-state

build: web daemon

web:
	cd web && npm run build
	rm -rf internal/static/dist
	cp -R web/dist internal/static/dist
	touch internal/static/dist/.gitkeep

daemon:
	mkdir -p bin
	go build -o bin/webtabinal ./cmd/webtabinal

serve: build
	./bin/webtabinal serve

desktop: build desktop-test
	bash desktop/scripts/build-app.sh

desktop-test:
	bash desktop/scripts/run-tests.sh

clean:
	rm -rf bin web/dist
	rm -rf internal/static/dist
	mkdir -p internal/static/dist
	touch internal/static/dist/.gitkeep

# Opt-in local agent E2E. Not part of build or CI. Does not download binaries
# or rewrite agent configuration.
e2e-state:
	@if [ -z "$(AGENT)" ]; then echo "usage: make e2e-state AGENT=<claude|codex|cursor-agent>" >&2; exit 2; fi
	bash scripts/e2e-state.sh "$(AGENT)"
