**Merlin** is the universal command-palette and voice assistant in the HAX ecosystem. It is implemented by the `<super-daemon>` web component — a global singleton (`globalThis.SuperDaemonManager`) that surfaces a searchable palette of commands and a debounced, multi-step "program" engine. Users open it with `Alt+Shift` (or `Meta+Shift` on macOS). The persona name "Merlin" appears in voice prompts, UI copy, and throughout the codebase.

Merlin is used across **HAXcms** (site operations, admin panels, page editing), the **HAX body** (content authoring), and **app-hax** (the application shell). Any part of the application can register commands into the single shared palette, and those commands are filtered by the active "context" so the user only sees what is relevant.

This site documents the schema/contract for the two data structures that plug into Merlin — the **Option** and the **Program** — so that AI agents and human contributors can register and build Merlin commands without reverse-engineering the source.

Core concepts
-------------

Merlin has two kinds of registrable commands:

*   **Option** — a static, searchable command. It appears in the palette list; selecting it fires a single CustomEvent and (usually) closes the palette. Registered via `SuperDaemonInstance.defineOption(option)`.
*   **Program** — a dynamic, search-driven command. Selecting its entry row launches "program mode": an async function is invoked with the user's search text, and the array of Option-shaped rows it returns _replaces_ the top-level list. The function is re-invoked (debounced ~150ms) on every keystroke, so the results live-update as the user types. A Program is just an Option whose `eventName` is `"super-daemon-run-program"` and whose `value.program` is that async function.

The singleton access pattern
----------------------------

Merlin is a single shared instance. Get a reference to it like this:

Then register commands:

The registration call
---------------------

`defineOption(option)` does light validation (requires `value`, `title`, `eventName`) and then auto-builds a searchable `index` string from the option's other fields. It pushes the option into `allItems`. Options can be registered at any time — most are registered in an element's `firstUpdated()` or on module load.

Where the runtime implementation lives
--------------------------------------

This spec is documentation only. The code that consumes this schema lives in the webcomponents monorepo, primarily `elements/super-daemon/super-daemon.js` (the singleton), the UI in `lib/super-daemon-ui.js`/`lib/super-daemon-row.js`/`lib/super-daemon-search.js`, and real Program factory modules under `elements/haxcms-elements/lib/core/utils/*Program.js`.