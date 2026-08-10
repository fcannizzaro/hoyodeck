default:
    @just --list

build:
    pnpm build

dev:
    pnpm dev

typecheck:
    pnpm typecheck

link:
    pnpm --dir plugin run link
