.DEFAULT_GOAL := help

.PHONY: help build serve css css-watch clean install

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install npm dependencies
	npm install

css: ## Build TailwindCSS
	npm run css

css-watch: ## Watch and rebuild TailwindCSS
	npm run css:watch

build: ## Full production build (CSS + Hugo)
	npm run build

serve: ## Run dev server (CSS watch + Hugo server in parallel)
	npm run serve

clean: ## Remove build artifacts
	npm run clean

hugo-new-section: ## Scaffold a new docs section (usage: make hugo-new-section TOOL=toolname)
	mkdir -p content/$(TOOL)
	echo '---\ntitle: "$(TOOL)"\ndescription: ""\nweight: 100\n---\n' > content/$(TOOL)/_index.md
	@echo "Created content/$(TOOL)/_index.md — add it to hugo.toml [[menus.main]] and [[params.tools]]"
