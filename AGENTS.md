# HoYo Deck agent instructions

HoYo Deck is a TypeScript monorepo for a Stream Deck plugin, its property inspector, and an Astro website. Run commands from the repository root unless stated otherwise.

## Working in this repository

- Read the relevant package scripts, configuration, and nearby implementation before editing. Follow any more specific `AGENTS.md` in the directory being changed.
- Check `git status` first. Preserve unrelated edits and staged files; stage and commit only the work for the current task.
- Keep changes scoped to the request. Reuse existing components and services before adding abstractions or dependencies.
- Treat manifests, configuration, and source as evidence of current behavior. If this file disagrees with them, investigate and report the mismatch rather than copying a stale example.
- Never put HoYoLAB cookies, tokens, account data, or `.env` values in logs, fixtures, commits, or responses. Use synthetic credentials in tests.
- Commit each completed feature or fix unless the user says otherwise. Use a lowercase type prefix and a short, lowercase imperative description, such as `feat: add marketplace link`, `fix: prevent login races`, or `chore: update dependencies`. Use `feat` for new behavior, `fix` for bug fixes, `refactor` for restructuring, `docs` for documentation, and `chore` for maintenance and tooling. Push, publish, and deploy only when requested.

## Setup and commands

Use Node.js 24.11+ and Vite+ (`vp`). Vite+ delegates package management to pnpm; keep the root `pnpm-lock.yaml` as the workspace lockfile. Read `package.json` for the pinned package manager and current dependency versions.

| Task                                          | Command                                             |
| --------------------------------------------- | --------------------------------------------------- |
| Reproducible dependency install               | `vp install --frozen-lockfile`                      |
| Watch plugin and property inspector           | `vp run dev`                                        |
| Type-check all four packages                  | `vp run typecheck`                                  |
| Lint workspace source                         | `vp run lint`                                       |
| Build plugin, property inspector, and website | `vp run build`                                      |
| Run tests after building the plugin           | `vp run test`                                       |
| Run one unit test file                        | `vp test --run plugin/tests/auth-validator.test.ts` |
| Check formatting of changed files             | `vp fmt --check <paths>`                            |
| Format changed files                          | `vp fmt <paths>`                                    |
| Build only the website                        | `vp run website#build`                              |

`vp run dev` watches builds; it does not start the website dev server. For website development, run `vp run dev` from `website/`. Linking the plugin to the local Stream Deck installation uses `vp run link` from `plugin/`.

## Where changes belong

| Location                                       | Responsibility                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/shared/src/`                         | Shared types, Zod schemas, cookie utilities, and game constants                               |
| `plugin/src/actions/`                          | React action definitions; shared game actions in `common/`, Genshin-specific actions in `gi/` |
| `plugin/src/components/`                       | Reusable key and dial visuals                                                                 |
| `plugin/src/api/`                              | HoYoLAB and code-server clients, API response types                                           |
| `plugin/src/services/`                         | Polling, game controllers, authentication, and native login                                   |
| `plugin/src/contexts/` and `plugin/src/hooks/` | Action data providers and hooks                                                               |
| `property-inspector/src/`                      | Browser-based React settings UI and Stream Deck messaging                                     |
| `website/src/`                                 | Astro website                                                                                 |
| `plugin/tests/`                                | Unit tests and built-plugin startup tests                                                     |

`server/` is a separate Git submodule, outside the pnpm workspace. Do not change its contents or recorded commit as a side effect of plugin work. Read its own guidance when a task explicitly targets the server.

## Shared contracts and TypeScript

- Import shared contracts through `@hoyodeck/shared/types`, `@hoyodeck/shared/cookies`, and `@hoyodeck/shared/games`. The shared package exports TypeScript source directly and has no build step.
- Reuse the canonical schemas, including `HoyoAuthSchema`, instead of duplicating validation in consumers. Keep Stream Deck SDK types and rendering code in the plugin, and browser UI code in the property inspector.
- Use strict types and `import type` for type-only imports. Avoid `any`; validate external data with existing Zod schemas or narrow `unknown` with type guards.
- Follow nearby naming and export conventions. Keep code organized by feature or game; use `gi`, `hsr`, and `zzz` for game IDs.
- Keep functions focused, use early returns, and document public contracts and non-obvious behavior. Let the formatter and linter enforce mechanical style.
- Preserve existing error-handling conventions and fallback displays. Use `Promise.allSettled` for independent operations that should tolerate partial failure, and handle the rejected results.

## Stream Deck architecture

- Actions use React through `@fcannizzaro/streamdeck-react`. Follow an existing action and its registration in `plugin/src/plugin.ts`; do not introduce a parallel `SingletonAction` class hierarchy.
- Reuse the data controller, game controllers, contexts, and query client for fetching and caching. Avoid adding per-action polling that duplicates these services.
- Preserve action UUIDs and persisted settings compatibility unless the task explicitly changes them. Update shared settings schemas and the property inspector together when their contract changes.
- Startup in `plugin/src/plugin.ts` enables `streamDeck.settings.useLegacySettingsBehavior` and initializes the data controller before registering auth and login listeners. Settings reads must still trigger startup validation and stale login cleanup. Verify startup tests when changing this sequence or upgrading the SDK.
- The property inspector bundles into a single HTML file. Preserve its messaging contract with the plugin and its single-file build configuration.
- Plugin manifest configuration lives in `plugin/vite.config.ts`, with action metadata in action definitions. Change those sources instead of hand-editing the generated manifest.
- Builds write plugin code and inspector UI under `plugin/com.fcannizzaro.hoyodeck.sdPlugin/`, and website output under `website/dist/`. Do not hand-edit generated output or include incidental build changes in a source commit.

For Stream Deck component, hook, or build API changes, read the repository's [streamdeck-react skill](.agents/skills/streamdeck-react/SKILL.md) and only the references relevant to the task.

## Plugin rendering and styling

These rules apply to plugin action JSX. The property inspector and website render in a browser; plugin actions render to images with Takumi.

- Use Tailwind `className` utilities for static styles. Use `cn()` from `@fcannizzaro/streamdeck-react` for conditional classes; do not use the deprecated `tw()` alias.
- Use `plugin/src/theme.css` as the source of truth for tokens. Prefer `bg-surface`, `rounded-badge`, and canonical spacing classes over repeated arbitrary values.
- Takumi has no root font size. The theme uses pixels, with `--spacing: 4px`: `w-30` is 120px and `gap-2.5` is 10px. Keep font sizes in pixels as well.
- Reserve inline `style` for runtime-computed values. Arbitrary utilities are acceptable for one-off sizes or hardware-specific dimensions that do not belong in the shared theme.
- Prefer flex layouts for alignment. Use absolute positioning for intentional overlap, not manual centering calculations.
- Preserve the `theme.css?inline` import and `createPlugin({ stylesheets: [...] })` wiring so Takumi receives the compiled theme.

## Verification before completion

- For code changes, run the relevant tests and `vp run typecheck`. Run `vp run lint` for source changes and check formatting only on touched files.
- Run `vp run build` for changes affecting bundling, dependencies, rendering, or package integration. Build the plugin before the full test suite: `plugin/tests/startup.test.mjs` launches the compiled `bin/plugin.mjs` against a local mock Stream Deck connection.
- Add a regression test for a bug when practical. Test observable behavior and meaningful edge cases; do not add tests that merely repeat implementation details.
- For visible UI changes, inspect the affected sizes and states using available rendering or runtime tools. State explicitly when hardware or runtime verification was unavailable.
- For documentation-only changes, check paths, commands, formatting, and the diff. A full application build is unnecessary unless executable behavior also changed.
- Review the final diff for unrelated edits, secrets, debug code, and generated files. Report what changed, which checks actually ran, and any failures or unverified behavior.

## Maintaining these instructions

Keep this file focused on durable repository rules and mistakes an agent could plausibly make here. Link to source or task-specific documentation instead of copying tutorials, API references, or design-token tables. Add scoped instructions when a package needs substantial guidance of its own. Update or remove instructions when the workflow changes; do not accumulate obsolete rules.
