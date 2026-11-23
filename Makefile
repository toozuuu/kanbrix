# RustTrack Makefile
# Usage: make <target>
#
# Targets:
#   dev            - Start all services in development mode
#   build          - Build production Docker images
#   up             - Start production services
#   down           - Stop all services
#   logs           - Tail API logs
#   sqlx-prepare   - Generate SQLx offline query cache (run once, then commit .sqlx/)
#   migrate        - Run database migrations manually
#   seed           - Seed demo data
#   clean          - Remove Docker volumes and build artifacts
#   test-backend   - Run Rust tests inside Docker
#   lint-backend   - Run clippy inside Docker
#   lint-frontend  - Run TypeScript check and lint

.PHONY: dev build up down logs sqlx-prepare migrate seed clean test-backend lint-backend lint-frontend

dev:
	docker compose up

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f api

## Generate SQLx offline cache (.sqlx/ directory).
## Run this whenever you change a sqlx::query!() macro, then commit the result.
sqlx-prepare:
	docker compose -f docker-compose.prepare.yml build sqlx-prepare
	docker compose -f docker-compose.prepare.yml run --rm sqlx-prepare
	docker compose -f docker-compose.prepare.yml down -v

migrate:
	docker compose exec api /bin/sh -c 'sqlx migrate run --source /app/migrations'

seed:
	docker compose exec postgres psql -U postgres -d rusttrack -f /docker-entrypoint-initdb.d/01_seed.sql

clean:
	docker compose down -v --remove-orphans
	docker compose -f docker-compose.prepare.yml down -v --remove-orphans
	rm -rf apps/api/target/

test-backend:
	docker compose run --rm --no-deps api cargo test

lint-backend:
	docker compose run --rm --no-deps api cargo clippy -- -D warnings

lint-frontend:
	cd apps/web && npm run lint
