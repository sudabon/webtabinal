.PHONY: build web daemon serve clean

build: web daemon

web:
	cd web && npm run build
	rm -rf internal/static/dist
	cp -R web/dist internal/static/dist

daemon:
	mkdir -p bin
	go build -o bin/webtabinal ./cmd/webtabinal

serve: build
	./bin/webtabinal serve

clean:
	rm -rf bin web/dist internal/static/dist
