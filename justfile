# TunaOS local task surface for Protota.
set shell := ["bash", "-euo", "pipefail", "-c"]

default:
    @just --list

install:
    npm ci

check: lint unit build

lint:
    npm run lint

unit:
    npm run test:unit

build:
    npm run build

test:
    npm test
