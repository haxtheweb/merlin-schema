# AGENTS.md

This repository documents the **schema / contract** for **Merlin** — the command-palette and voice-assistant system in the HAX ecosystem, implemented by the `<super-daemon>` web component.

## What lives here

- `README.md` — the authoritative conceptual and reference documentation (read this first).
- `merlin-option.schema.json` — formal JSON Schema for a Merlin **Option** (a static/searchable command).
- `merlin-program.schema.json` — formal JSON Schema for a Merlin **Program** (a dynamic, search-driven command).
- `example-option.json` — an annotated real-world Option.
- `example-program.json` — an annotated real-world Program.

## Where the runtime implementation lives

This repo is documentation only. The actual code that consumes this schema lives in the webcomponents monorepo:

- `haxtheweb/webcomponents` → `elements/super-daemon/`
  - `super-daemon.js` — the singleton element (`globalThis.SuperDaemonManager`), `defineOption()`, `runProgram()`, event listeners.
  - `lib/super-daemon-ui.js`, `lib/super-daemon-row.js`, `lib/super-daemon-search.js` — the UI that renders Option/Program results.
- `haxtheweb/webcomponents` → `elements/haxcms-elements/lib/core/utils/*Program.js` — real Program factory modules (`EditTagsProgram.js`, `ExportSiteProgram.js`, `EditTitleProgram.js`, etc.).
- `haxtheweb/webcomponents` → `elements/haxcms-elements/lib/core/haxcms-site-editor-ui.js` (`firstUpdated()`) — the largest single registration site for Options and Programs.
- `haxtheweb/webcomponents` → `elements/haxcms-elements/lib/core/haxcms-cheat-codes.js` — lightweight static Option examples (Easter eggs).

## Working on this repo

When updating this documentation, verify field names and behavior against the runtime source above before publishing. The schema is implicit in the code, so this repo must stay in sync with it.
