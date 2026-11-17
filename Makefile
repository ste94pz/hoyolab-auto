SHELL := /bin/bash

# Retained for existing installations; override deliberately when migrating.
COMPOSE_PROJECT_NAME ?= hoyolab-auto
COMPOSE_FILE ?= docker-compose.yml
COMPOSE = docker compose -p $(COMPOSE_PROJECT_NAME) -f $(COMPOSE_FILE)

.PHONY: build up down restart logs exec update help

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up -d --build --pull never

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart instance

logs:
	$(COMPOSE) logs -f instance

exec:
	$(COMPOSE) exec instance sh

update:
	$(COMPOSE) build --pull
	$(COMPOSE) up -d --no-build --pull never

help:
	@echo "HoYoUtils: make build|up|down|restart|logs|exec|update"
	@echo "up builds locally; update refreshes the base image and rebuilds before recreating."
	@echo "down preserves bind-mounted config, data and logs. exec opens an Alpine sh shell."
