default:
    @just --list

build:
    bun run build

dev:
    bun run dev

typecheck:
    bun run typecheck

link:
    cd plugin && bun run link
