.PHONY: dev prod down db-migrate db-seed logs db-migrate-prod logs-prod down-prod

dev:
	docker compose -f docker-compose.local.yml up --build

prod:
	docker compose -f docker-compose.prod.yml up -d --build

down:
	docker compose -f docker-compose.local.yml down

down-prod:
	docker compose -f docker-compose.prod.yml down

db-migrate:
	docker compose -f docker-compose.local.yml exec api npx sequelize-cli db:migrate

db-migrate-prod:
	docker compose -f docker-compose.prod.yml exec api npx sequelize-cli db:migrate

db-seed:
	docker compose -f docker-compose.local.yml exec api npx sequelize-cli db:seed:all

logs:
	docker compose -f docker-compose.local.yml logs -f

logs-prod:
	docker compose -f docker-compose.prod.yml logs -f
