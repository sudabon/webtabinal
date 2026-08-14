.PHONY: build web daemon serve desktop desktop-test clean

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
