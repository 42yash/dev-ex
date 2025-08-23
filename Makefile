.PHONY: help
help: ## Show this help message
	@echo "Dev-Ex Platform - Available Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: setup
setup: ## Initial setup - copy env file and install dependencies
	@echo "Setting up Dev-Ex platform..."
	@cp -n .env.example .env || true
	@echo "✓ Environment file created (edit .env with your API keys)"
	@echo ""
	@echo "Next steps:"
	@echo "1. Edit .env and add your GEMINI_API_KEY"
	@echo "2. Run 'make start' to launch the platform"

.PHONY: start
start: ## Start all services with Docker Compose
	@echo "Starting Dev-Ex platform..."
	docker-compose up -d
	@echo "✓ Platform started!"
	@echo ""
	@echo "Services available at:"
	@echo "- Frontend: http://localhost:3000"
	@echo "- API Gateway: http://localhost:8080"
	@echo "- n8n Workflows: http://localhost:5678 (admin/admin)"
	@echo "- Database UI: http://localhost:8081"

.PHONY: stop
stop: ## Stop all services
	@echo "Stopping Dev-Ex platform..."
	docker-compose stop
	@echo "✓ Platform stopped"

.PHONY: down
down: ## Stop and remove all containers
	@echo "Stopping and removing containers..."
	docker-compose down
	@echo "✓ Containers removed"

.PHONY: restart
restart: ## Restart all services
	@echo "Restarting Dev-Ex platform..."
	docker-compose restart
	@echo "✓ Platform restarted"

.PHONY: logs
logs: ## Show logs from all services
	docker-compose logs -f

.PHONY: logs-frontend
logs-frontend: ## Show frontend logs
	docker-compose logs -f frontend

.PHONY: logs-gateway
logs-gateway: ## Show API gateway logs
	docker-compose logs -f api-gateway

.PHONY: logs-ai
logs-ai: ## Show AI services logs
	docker-compose logs -f ai-services

.PHONY: build
build: ## Build all Docker images
	@echo "Building Docker images..."
	docker-compose build
	@echo "✓ Images built"

.PHONY: rebuild
rebuild: ## Rebuild all Docker images (no cache)
	@echo "Rebuilding Docker images..."
	docker-compose build --no-cache
	@echo "✓ Images rebuilt"

.PHONY: clean
clean: ## Clean up containers, volumes, and images
	@echo "Cleaning up Dev-Ex platform..."
	docker-compose down -v
	docker system prune -f
	@echo "✓ Cleanup complete"

.PHONY: reset
reset: clean ## Complete reset - removes all data
	@echo "Resetting Dev-Ex platform..."
	docker volume rm devex_postgres_data devex_redis_data devex_n8n_data 2>/dev/null || true
	@echo "✓ Platform reset complete"

.PHONY: db-shell
db-shell: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U devex -d devex

.PHONY: db-backup
db-backup: ## Backup database to file
	@echo "Backing up database..."
	@mkdir -p backups
	docker-compose exec -T postgres pg_dump -U devex devex | gzip > backups/devex_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "✓ Database backed up to backups/"

.PHONY: db-restore
db-restore: ## Restore database from latest backup
	@echo "Restoring database from latest backup..."
	@gunzip -c $$(ls -t backups/*.sql.gz | head -1) | docker-compose exec -T postgres psql -U devex -d devex
	@echo "✓ Database restored"

.PHONY: redis-cli
redis-cli: ## Open Redis CLI
	docker-compose exec redis redis-cli

.PHONY: test
test: ## Run all tests
	@echo "Running tests..."
	cd frontend && npm test
	cd backend/gateway && npm test
	cd backend/ai-services && python -m pytest

.PHONY: test-frontend
test-frontend: ## Run frontend tests
	cd frontend && npm test

.PHONY: test-backend
test-backend: ## Run backend tests
	cd backend/gateway && npm test

.PHONY: test-ai
test-ai: ## Run AI services tests
	cd backend/ai-services && python -m pytest

.PHONY: lint
lint: ## Run linters on all code
	@echo "Running linters..."
	cd frontend && npm run lint
	cd backend/gateway && npm run lint
	cd backend/ai-services && flake8 . && mypy .

.PHONY: format
format: ## Format all code
	@echo "Formatting code..."
	cd frontend && npm run format
	cd backend/gateway && npm run format
	cd backend/ai-services && black .

.PHONY: proto-gen
proto-gen: ## Generate code from Protocol Buffers
	@echo "Generating Protocol Buffer code..."
	@mkdir -p frontend/src/generated backend/gateway/src/generated backend/ai-services/src/generated
	# Generate for TypeScript (frontend and gateway)
	protoc --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
		--js_out=import_style=commonjs:./frontend/src/generated \
		--ts_out=./frontend/src/generated \
		--grpc-web_out=import_style=typescript,mode=grpcwebtext:./frontend/src/generated \
		-I ./proto ./proto/*.proto
	# Generate for Python (AI services)
	python -m grpc_tools.protoc \
		-I./proto \
		--python_out=./backend/ai-services/src/generated \
		--grpc_python_out=./backend/ai-services/src/generated \
		./proto/*.proto
	@echo "✓ Protocol Buffer code generated"

.PHONY: dev-frontend
dev-frontend: ## Start frontend in development mode
	cd frontend && npm run dev

.PHONY: dev-gateway
dev-gateway: ## Start gateway in development mode
	cd backend/gateway && npm run dev

.PHONY: dev-ai
dev-ai: ## Start AI services in development mode
	cd backend/ai-services && python main.py

.PHONY: install
install: ## Install all dependencies
	@echo "Installing dependencies..."
	cd frontend && npm ci
	cd backend/gateway && npm ci
	cd backend/ai-services && pip install -r requirements.txt
	@echo "✓ Dependencies installed"

.PHONY: update
update: ## Update all dependencies
	@echo "Updating dependencies..."
	cd frontend && npm update
	cd backend/gateway && npm update
	cd backend/ai-services && pip install --upgrade -r requirements.txt
	@echo "✓ Dependencies updated"

.PHONY: health
health: ## Check health of all services
	@echo "Checking service health..."
	@curl -s http://localhost:8080/health | jq '.' || echo "API Gateway not responding"
	@echo ""
	@docker-compose ps

.PHONY: status
status: ## Show status of all services
	@docker-compose ps
	@echo ""
	@echo "Port Status:"
	@lsof -i :3000 >/dev/null 2>&1 && echo "✓ Frontend (3000)" || echo "✗ Frontend (3000)"
	@lsof -i :8080 >/dev/null 2>&1 && echo "✓ API Gateway (8080)" || echo "✗ API Gateway (8080)"
	@lsof -i :50051 >/dev/null 2>&1 && echo "✓ AI Services (50051)" || echo "✗ AI Services (50051)"
	@lsof -i :5432 >/dev/null 2>&1 && echo "✓ PostgreSQL (5432)" || echo "✗ PostgreSQL (5432)"
	@lsof -i :6379 >/dev/null 2>&1 && echo "✓ Redis (6379)" || echo "✗ Redis (6379)"
	@lsof -i :5678 >/dev/null 2>&1 && echo "✓ n8n (5678)" || echo "✗ n8n (5678)"

.PHONY: monitor
monitor: ## Monitor all services with watch
	watch -n 2 "docker-compose ps && echo '' && docker stats --no-stream"

# Default target
.DEFAULT_GOAL := help