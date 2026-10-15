# AGENTS.md

This repository documents the **schema / contract** for **Merlin** — the command-palette and voice-assistant system in the HAX ecosystem, implemented by the `<super-daemon>` web component.

## What lives here

- `README.md` — the authoritative conceptual and reference documentation (read this first).
- `merlin-option.schema.json` — formal JSON Schema for a Merlin **Option** (a static/searchable command).
- `merlin-program.schema.json` — formal JSON Schema for a Merlin **Program** (a dynamic, search-driven command).
- `example-option.json` — an annotated real-world Option.
- `example-program.json` — an annotated real-world Program.
- `examples/` — more examples, `invalid/` fixtures and a JS `scan/` fixture.
- `scripts/validate.js` — validator. Use `--scan <file.js>` on any source file that registers Merlin options (statically checks `defineOption()` calls and Program result rows); plain mode validates JSON examples.

## Before you finish

- Read "Rules for tools and agents registering Merlin commands" in README.md.
- Run `node scripts/validate.js --scan <changed .js files>` (or `npx -p @haxtheweb/merlin-schema merlin-validate --scan ...`).
- Changing the schema or README here means `npm test` must pass and an example must cover the change.

## Where the runtime implementation lives

This repo is documentation only. The actual code that consumes this schema lives in the webcomponents monorepo:

- `haxtheweb/webcomponents` → `elements/super-daemon/`
  - `super-daemon.js` — the singleton element (`globalThis.SuperDaemonManager`), `defineOption()`, `runProgram()`, event listeners.
  - `lib/super-daemon-ui.js`, `lib/super-daemon-row.js`, `lib/super-daemon-search.js` — the UI that renders Option/Program results.
- `haxtheweb/webcomponents` → `elements/haxcms-elements/lib/core/utils/*Program.js` — real Program factory modules (`EditTagsProgram.js`, `ExportSiteProgram.js`, `EditTitleProgram.js`, etc.).
- `haxtheweb/webcomponents` → `elements/haxcms-elements/lib/core/haxcms-site-editor-ui.js` (`firstUpdated()`) — the largest single registration site for Options and Programs.
- `haxtheweb/webcomponents` → `elements/haxcms-elements/lib/core/haxcms-cheat-codes.js` — lightweight static Option examples (Easter eggs).
- `haxtheweb/webcomponents` → `elements/utils/lib/keyboardShortcuts.js` — the shared `KeyboardShortcutManager` registry that the Option `shortcut` field resolves through (also used by HAXcms `Ctrl+Shift` bindings and HAXStore markdown triggers).

## Working on this repo

When updating this documentation, verify field names and behavior against the runtime source above before publishing. The schema is implicit in the code, so this repo must stay in sync with it.
