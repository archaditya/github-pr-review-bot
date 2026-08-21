# Single-command entrypoints for local dev and prod (ADR-008)

.PHONY: dev prod down db-migrate db-seed logs

dev:
	docker compose -f docker-compose.local.yml up --build

prod:
	docker compose -f docker-compose.prod.yml up -d --build

down:
	docker compose -f docker-compose.local.yml down

db-migrate:
	docker compose -f docker-compose.local.yml exec api npx sequelize-cli db:migrate

db-seed:
	docker compose -f docker-compose.local.yml exec api npx sequelize-cli db:seed:all

logs:
	docker compose -f docker-compose.local.yml logs -f
