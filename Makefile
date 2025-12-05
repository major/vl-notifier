.PHONY: build build-firefox build-chrome sign-firefox sign-chrome release dev lint clean help

# Default target
help:
	@echo "VL Touch Notify - Build Targets"
	@echo ""
	@echo "Build:"
	@echo "  make build          Build both Firefox and Chrome extensions"
	@echo "  make build-firefox  Build Firefox extension only"
	@echo "  make build-chrome   Build Chrome extension only"
	@echo ""
	@echo "Sign:"
	@echo "  make sign-firefox   Sign Firefox extension (requires Mozilla API creds)"
	@echo "  make sign-chrome    Sign Chrome extension as .crx (requires private key)"
	@echo ""
	@echo "Development:"
	@echo "  make dev            Start Firefox with hot reload"
	@echo "  make lint           Lint Firefox extension"
	@echo "  make clean          Remove build artifacts"
	@echo ""
	@echo "Release:"
	@echo "  make release VERSION=1.3  Bump version, commit, and tag"
	@echo ""

# Build targets
build:
	./build.sh

build-firefox:
	./build.sh -f

build-chrome:
	./build.sh -c

# Signing targets
sign-firefox:
	./build.sh -s

sign-chrome:
	./build.sh --sign-chrome

# Development
dev:
	npm run start

lint:
	npm run lint

# Cleanup
clean:
	rm -rf web-ext-artifacts/

# Release automation
release:
	@test -n "$(VERSION)" || (echo "❌ Usage: make release VERSION=1.3" && exit 1)
	./bump.sh $(VERSION)
