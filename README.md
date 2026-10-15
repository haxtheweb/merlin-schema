# Merlin Schema

> Authoritative documentation for the **Merlin** command-palette / voice-assistant schema used across the HAX ecosystem.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## What is Merlin?

**Merlin** is the universal command-palette and voice assistant in the HAX ecosystem. It is implemented by the [`<super-daemon>`](https://github.com/haxtheweb/webcomponents/tree/master/elements/super-daemon) web component — a global singleton (`globalThis.SuperDaemonManager`) that surfaces a searchable palette of commands and a debounced, multi-step "program" engine. Users open it with `Alt+Shift` (or `Meta+Shift` on macOS). The persona name "Merlin" appears in voice prompts, UI copy, and throughout the codebase.

Merlin is used across **HAXcms** (site operations, admin panels, page editing), the **HAX body** (content authoring), and **app-hax** (the application shell). Any part of the application can register commands into the single shared palette, and those commands are filtered by the active "context" so the user only sees what is relevant.

This repository documents the **schema / contract** for the two data structures that plug into Merlin — the **Option** and the **Program** — so that AI agents and human contributors can register and build Merlin commands without reverse-engineering the source.

## Where the runtime implementation lives

This repo is **documentation only**. The code that consumes this schema lives in the webcomponents monorepo:

- `haxtheweb/webcomponents` → `elements/super-daemon/`
  - `super-daemon.js` — the singleton element, `defineOption()`, `runProgram()`, keyboard/voice event listeners.
  - `lib/super-daemon-ui.js`, `lib/super-daemon-row.js`, `lib/super-daemon-search.js` — the UI that renders Option/Program result rows.
- `haxtheweb/webcomponents` → `elements/haxcms-elements/lib/core/utils/*Program.js` — real Program factory modules (`EditTagsProgram.js`, `ExportSiteProgram.js`, `EditTitleProgram.js`, etc.).
- `haxtheweb/webcomponents` → `elements/haxcms-elements/lib/core/haxcms-site-editor-ui.js` (`firstUpdated()`) — the largest single registration site for Options and Programs.
- `haxtheweb/webcomponents` → `elements/haxcms-elements/lib/core/haxcms-cheat-codes.js` — lightweight static Option examples (Easter eggs).
- `haxtheweb/webcomponents` → `elements/utils/lib/keyboardShortcuts.js` — the shared `KeyboardShortcutManager` registry that the Option `shortcut` field resolves through (also used by HAXcms `Ctrl+Shift` bindings and HAXStore markdown triggers).

## Files in this repo

| File | Purpose |
|------|---------|
| `merlin-option.schema.json` | Formal JSON Schema (draft 2020-12) for an **Option**, including the `value` shape for each known `eventName`. |
| `merlin-program.schema.json` | The **Program** variant (an Option with `eventName: "super-daemon-run-program"`). |
| `scripts/validate.js` | Validator for JSON examples **and** a `--scan` mode that statically checks `defineOption()` calls and Program result rows in JS source. |
| `example-option.json`, `example-program.json` | Annotated real-world examples. |
| `examples/` | More examples (element-click, insert-tag, inline-only program, program rows) plus `invalid/` and a JS `scan/` fixture. |
| `AGENTS.md` | Short pointer for AI agents. |

## Validation

Merlin options are JS objects in source files, so the most useful check is the static scan:

```bash
npx -p @haxtheweb/merlin-schema merlin-validate --scan elements/my-element/my-element.js
```

`--scan` validates every `*.defineOption({...})` object literal as a registered option and every other object literal with `title` + `eventName` + `value` as a Program result row. Values that are not literals (`this.t.save`, function references, lit templates) are accepted as-is; literal values, keys and `value` shapes are checked. JSON files (like the examples) are validated without `--scan`; add `--rows` for arrays of Program result rows and `--json` for a structured report.

From a clone:

```bash
npm install
node scripts/validate.js example-option.json example-program.json
node scripts/validate.js --rows examples/program-rows.json
node scripts/validate.js --scan path/to/file.js
npm test
```

Across the webcomponents monorepo the scan checks 174 options and rows. It reports 3 real problems (array `value.context` in haxcms-site-editor-ui) plus 38 advisory warnings for string contexts.

## Rules for tools and agents registering Merlin commands

1. **Required:** `title`, `value`, `eventName`. `defineOption()` silently ignores options missing any of them.
2. **Match `value` to `eventName`:** `{target, method, args?}` for `super-daemon-element-method`, `{target}` for `super-daemon-element-click`, `{name, program, ...}` for `super-daemon-run-program`, `{shortcutId}` for `execute-keyboard-shortcut`. See the [Event contract](#event-contract).
3. **Use arrays for `context`** (`["CMS"]`). A string context is matched with `String.includes`, so it matches by substring. Program `value.context` is the opposite: one string, because it becomes the active command context.
4. **Never set `index`**, and don't set `shortcutLabel` on registered options: `defineOption()` builds both. Program result rows skip `defineOption()`, so set `shortcutLabel` there yourself if you want a key hint.
5. **Pick `inline` or `inlineOnly`, not both.** `hidden` and `inlineOnly` programs need a `machineName`, because that's the only way to launch them.
6. **No unknown keys.** Custom keys must start with `x-`, and remember every string field (including `x-` ones) goes into the search index.
7. **Scan before you finish:** `merlin-validate --scan <file>`.

---

## Core concepts

Merlin has two kinds of registrable commands:

1. **Option** — a *static, searchable* command. It appears in the palette list; selecting it fires a single CustomEvent and (usually) closes the palette. Registered via `SuperDaemonInstance.defineOption(option)`.

2. **Program** — a *dynamic, search-driven* command. Selecting its entry row launches "program mode": an async function is invoked with the user's search text, and the array of Option-shaped rows it returns *replaces* the top-level list. The function is re-invoked (debounced ~150ms) on every keystroke, so the results live-update as the user types. A Program is just an Option whose `eventName` is `"super-daemon-run-program"` and whose `value.program` is that async function.

### The singleton access pattern

Merlin is a single shared instance. Get a reference to it like this:

```js
import { SuperDaemonInstance } from "@haxtheweb/super-daemon/super-daemon.js";

// or, from anywhere without an import:
const SuperDaemonInstance =
  globalThis.SuperDaemonManager.requestAvailability();
```

Then register commands:

```js
SuperDaemonInstance.defineOption({ ... });
```

### The registration call

`defineOption(option)` does light validation (requires `value`, `title`, `eventName`) and then auto-builds a searchable `index` string from the option's other fields. It pushes the option into `allItems`. Options can be registered at any time — most are registered in an element's `firstUpdated()` or on module load.

---

## Option schema reference

Required fields: `title`, `value`, `eventName`.

| Field | Type | Required | Default | Purpose |
|-------|------|----------|---------|---------|
| `title` | string | yes | — | Primary display label. Used for alphabetical sort and exact-match priority boosting. |
| `value` | object | yes | — | Payload dispatched as the `detail` of the CustomEvent named by `eventName`. Shape varies by `eventName` (see Event contract). |
| `eventName` | string | yes | — | Name of the CustomEvent dispatched when the row is selected. Known values below. |
| `icon` | string | no | — | Icon name (e.g. `"icons:save"`, `"hax:wizard-hat"`) rendered by `simple-icon-lite`. |
| `image` | string | no | — | Image URL rendered in the row as an alternative to `icon`. |
| `textCharacter` | string | no | — | A single character or emoji rendered as an alternative to icon/image (e.g. `"🍌"`). |
| `tags` | string[] | no | `[]` | Searchable keyword tags. Also rendered as `simple-tag` chips in the row. |
| `path` | string | no | `""` | Breadcrumb-style location string (e.g. `"CMS/admin/seo"`). Searchable as a whole phrase *and* split on `/`. |
| `description` | string | no | — | Extra searchable text. Indexed for search but not rendered. |
| `priority` | number | no | `0` | Sort weight. **Lower** numbers sort higher (appear nearer the top). Negative values boost prominence. An exact title match forces `-10000000`. |
| `context` | string \| string[] | no | `"*"` | Visibility scope. `"*"` = available in every context. Other common values: `"CMS"`, `"HAX"`, `"admin"`, `"logged-in"`, `"community"`, `">"` (developer mode), `"/"` (program list), and platform feature names (`"addPage"`, `"uploadMedia"`, `"outlineDesigner"`) that disappear when HAXcms platform settings disable the feature. Prefer an array; a string is matched by substring. |
| `voice` | string | no | falls back to `title` | Voice-command phrase pattern for the `hal-9000` speech layer, e.g. `"(toggle) dark mode"`. Parenthesized segments are optional words. |
| `more` | lit-html TemplateResult | no | — | Extra detail rendered in an expandable `<details>` section of the row. Only a plain string `more` is added to the search index. |
| `inline` | boolean | no | `false` | Also list the option when Merlin is invoked inline (slash in an empty block, `::` token, RTE toolbar button). |
| `inlineOnly` | boolean | no | `false` | List the option **only** when Merlin is invoked inline; never in global browse/search. Implies `inline`, so don't set both. |
| `externalLink` | boolean | no | `false` | Renders an open-in-new-window icon on the row (the option opens an external site). |
| `hidden` | boolean | no | — | When true, the option is registered and invokable by `machineName`/shortcut but excluded from browse/search results. |
| `shortcut` | string \| object | no | — | Keyboard-shortcut metadata linking the option to the shared `KeyboardShortcutManager` registry. Either a registry id string (e.g. `"cms-save"`) or an inline descriptor object (see Shortcut metadata). Resolved to `shortcutLabel`; both excluded from the search index. |
| `index` | string | auto | — | **AUTO-BUILT by `defineOption()` — do not set this yourself.** A space-joined, de-duplicated, lowercased search index derived from `tags`/`path`/`title`/`voice`/`more`/`context` plus the full path phrase. |
| `shortcutLabel` | string | auto | — | **AUTO-BUILT by `defineOption()` from `shortcut` — do not set this on registered options.** Human-readable label from `KeyboardShortcutManager.getLabel()` (e.g. `"Ctrl⇧S"`, `"###"`). Program result rows are not passed through `defineOption()`, so a row that wants a key hint sets it directly. |

---

## Program schema reference

A Program is an Option with `eventName: "super-daemon-run-program"` and a `value` object containing:

| `value` key | Type | Required | Purpose |
|-------------|------|----------|---------|
| `name` | string | yes | Human-readable name shown as the program-mode title while the program is active. |
| `program` | `async (input, values) => Promise<Option[]>` | yes | The search function. `input` is the current search text; `values` is the bag passed into `runProgram()`. Each returned item is an Option-shaped row rendered by `super-daemon-row`. Re-invoked (debounced ~150ms) on every keystroke. |
| `machineName` | string | no | Stable identifier enabling `runProgram('like', context, values, 'machineName')` to resolve and invoke this program by name without holding a direct function reference. |
| `context` | string | no | Command context to activate when the program launches (e.g. `"CMS"` or `">"`). A single string, not an array: `runProgram()` assigns it straight to `commandContext`. |
| `placeholder` | string | no | Placeholder text for the search input while the program is active (e.g. `"Enter new title"`). |
| `initialValue` | `async (values) => Promise<string>` | no | Optional prefill: a non-empty string return pre-fills the search input when the program is launched with no explicit like/search. **Currently only honored when the program is launched by `machineName`** (`runProgram(null, ctx, values, "edit-tags")`); selecting the row from Merlin search passes the function directly and skips it (fix proposed in haxtheweb/webcomponents). |

The **whole `value` object is also the program's second argument** (`values`), so any extra keys you put on `value` reach the program. HAXStore's app-search programs pass `index` and `detail` this way.

### The lazy factory pattern

Programs are commonly lazy-loaded via dynamic `import()` of a `createXProgram(context)` factory module, so the program code is only fetched when the user actually selects it:

```js
SuperDaemonInstance.defineOption({
  title: "Update page tags",
  icon: "icons:label",
  tags: ["CMS", "edit", "tags", "metadata"],
  eventName: "super-daemon-run-program",
  path: "CMS/edit/tags",
  context: ["CMS"],
  voice: "edit tags",
  value: {
    name: "Update page tags",
    machineName: "edit-tags",
    placeholder: "Enter tags separated by commas",
    initialValue: async (values) => {
      const activeItem = toJS(store.activeItem);
      return (activeItem && activeItem.metadata && activeItem.metadata.tags) || "";
    },
    program: async (input, values) => {
      const { createEditTagsProgram } = await import(
        "./utils/EditTagsProgram.js"
      );
      return createEditTagsProgram(this)(input, values);
    },
  },
});
```

The factory module exports a `createXProgram(context)` function that returns the actual `async (input, values) => [...]` function, closing over `context` (typically the `haxcms-site-editor-ui` instance) so the program can call back into editor methods.

### What a program returns

The program function returns an array of Option-shaped rows. Each row follows the same Option schema above and is rendered by `super-daemon-row`. A common pattern is to return "confirm" rows that use `eventName: "super-daemon-element-method"` to dispatch a save event:

```js
return [
  {
    title: `Save tags: ${input}`,
    icon: "icons:check",
    tags: ["confirm", "save"],
    eventName: "super-daemon-element-method",
    path: "CMS/edit/tags/confirm",
    value: {
      target: globalThis,
      method: "dispatchEvent",
      args: [
        new CustomEvent("haxcms-save-node-details", {
          bubbles: true,
          composed: true,
          detail: { id: activeItem.id, operation: "setTags", tags: input },
        }),
      ],
    },
  },
];
```

### `runProgram()` — invoking a program programmatically

Programs can also be launched from code (not just by user search), via `SuperDaemonInstance.runProgram()`:

```js
runProgram(
  like = null,      // pre-fill the search input (string or null)
  context = "/",    // command context to activate
  values = {},      // bag passed as the 2nd arg to the program function
  program = null,   // a direct function reference OR a machineName string
  name = null,      // program-mode title
  search = "",      // initial search text
  placeholder = null,
);
```

When `program` is a string, `runProgram` looks up the matching `value.machineName` in `allItems` to resolve the function. The `waveWand(params, target, sound)` helper wraps `runProgram` + `open()` + an optional sound for the common "open Merlin in mini/wand mode near a target" interaction pattern.

---

## Event contract

When a result row is selected, `super-daemon-row.selected()` always dispatches a `super-daemon-row-selected` event (with `detail` = the row element), then dispatches a `CustomEvent` named `option.eventName` with `detail` set to `option.value`. For any `eventName` **other than** `super-daemon-run-program`, it also dispatches `super-daemon-close` to close the palette. Program selections keep the palette open so the user can continue interacting.

The `super-daemon` singleton listens for these events globally and routes them:

| `eventName` | What the runtime does with `value` | Closes palette? |
|-------------|-------------------------------------|-----------------|
| `super-daemon-element-method` | Calls `value.target[value.method](...value.args)` | yes |
| `super-daemon-element-click` | Dispatches a synthetic `MouseEvent("click")` on `value.target` | yes |
| `super-daemon-run-program` | Hands `value` to `runProgram()` — enters program mode | **no** (stays open) |
| `hax-super-daemon-insert-tag` | HAXStore inserts a block: fills a waiting program target with `properties.src/source/href`, otherwise inserts through the tray (`value`: `{ value: tag, eventName: "insert-tag", demoSchema: true }` or `{ properties, content }`) | yes |
| `execute-keyboard-shortcut` | `haxcms-site-editor-ui` resolves `value.shortcutId` in `KeyboardShortcutManager` and runs it | yes |
| `disabled` | No-op. Used for informational rows like "No active page found" | yes |
| `super-daemon-noop` | No-op instruction row (no listener) | yes |
| anything else | Dispatched as a plain `CustomEvent`; you need your own listener | yes |

Other events the singleton listens for (dispatch these to drive Merlin from code):

| Event | Effect |
|-------|--------|
| `super-daemon-define-option` | `detail` is treated as an Option and registered via `defineOption()`. |
| `super-daemon-run-program` | `detail` (`{ program, context, name, placeholder, values }`) launches a program. |
| `super-daemon-element-method` | `detail` (`{ target, method, args }`) invokes a method on a target. |
| `super-daemon-element-click` | `detail` (`{ target }`) clicks a target. |
| `super-daemon-close` | Closes the palette and resets state. |
| `super-daemon-program-enter` | `detail` (`{ programName, input }`) handles Enter pressed with no filtered results (used by the `create-page` program). |
| `super-daemon-voice-command` | `detail` (`{ command, callback, context }`) registers a voice command. |

---

## Context system

Every Option declares a `context` — a string or array of strings that determines when it is visible. The singleton tracks an active `commandContext` (a single string) and a `context` array (the set of contexts the current page/app state provides). An option appears only when its `context` intersects the active set.

| Context value | Meaning |
|---------------|---------|
| `"*"` | Global — always available (the default when `context` is omitted). |
| `"CMS"` | Available while in the HAXcms site-editor context. |
| `"HAX"` | Available while in the HAX body editor (authoring) context. |
| `"admin"` | Available for admin/site-settings operations. |
| `"logged-in"` | Available only when the user is authenticated. |
| `">"` | Developer mode — a special context entered by typing `>` in the palette. |

The user switches the active `commandContext` by typing a prefix character (`/`, `*`, or `>`) into the search input, or via voice (`"run program"` → `/`, `"developer mode"` → `>`). When `commandContext` is `"*"` (global browse), options are filtered against the page's `context` array; when it is a specific value, only options whose `context` includes that value are shown.

---

## Voice command layer (optional facet)

When `voiceSearch` is enabled on the `super-daemon` element, the `hal-9000` speech engine is loaded and Merlin's commands become voice-addressable. Each Option can declare a `voice` phrase pattern; if omitted, the `title` is used. The pattern syntax uses parenthesized segments for optional words, e.g. `"(toggle) dark mode"` matches both "toggle dark mode" and "dark mode".

Voice commands are re-processed (`reprocessVoiceCommands()`) whenever the visible item set changes (e.g. context switch), so only currently-relevant options are voice-addressable. A built-in catch-all (`"*anything"`) routes unrecognized speech into the search input.

This layer is **optional** — Options and Programs work fully without it. The `voice` field is purely additive.

---

## Shortcut metadata (optional facet)

An Option (or Program entry row) can declare a `shortcut` field that links it to the shared **`KeyboardShortcutManager`** registry — the single source of truth for keyboard/insertion shortcuts across the HAX ecosystem. That registry is also used by HAXcms `Ctrl+Shift+[Key]` bindings and the HAXStore markdown-trigger-to-gizmo map, so a Merlin option can reference the *same* shortcut descriptor those subsystems use.

`shortcut` accepts either:

- a **registry id string** (e.g. `"cms-save"`) — resolves to a descriptor previously registered via `KeyboardShortcutManagerInstance.register(...)`, or
- an **inline descriptor object** with the canonical shape:

```js
{
  id: "cms-save",                          // stable unique id
  type: "binding",                         // 'binding' (modifier+key) | 'markdown' (typed trigger insert)
  key: "S",                                // physical key (binding)
  ctrl: true, shift: true, alt: false, meta: false, // binding modifiers
  trigger: "###",                          // markdown trigger (type: 'markdown')
  tag: "h3",                               // markdown insert target tag
  content: "",                             // markdown insert inner content
  description: "Save page",                // human-readable
  context: "edit",                         // 'edit' | 'view' | 'global'
  allowInInput: false,                     // whether the binding fires while focus is in an input
  callback: Function,                      // optional direct callback (binding)
  condition: Function,                     // optional active-condition (binding)
  eventName: "super-daemon-element-method", // optional event to fire instead of / alongside callback
}
```

When `shortcut` is present, `defineOption()` resolves a human-readable label via `KeyboardShortcutManager.getLabel()` and stores it on `shortcutLabel` (e.g. `"Ctrl⇧S"` for a binding, `"###"` for a markdown trigger). The UI reads `shortcutLabel` to render a keyboard hint in the row. Both `shortcut` and `shortcutLabel` are excluded from the search index so they don't pollute text matching.

Real example (from `haxcms-site-editor-ui.js`):

```js
SuperDaemonInstance.defineOption({
  title: this.t.save,
  icon: "icons:save",
  tags: ["CMS", "save", "page"],
  shortcut: "cms-save", // links to the Ctrl+Shift+S binding
  value: { target: this, method: "_editButtonTap" },
  context: "HAX",
  eventName: "super-daemon-element-method",
  path: "CMS/action/save",
});
```

This layer is **optional** — the `shortcut` field is purely additive and does not change how an option is invoked; it only surfaces a keyboard-hint label in the UI and (optionally) ties the option to a shared descriptor for cross-subsystem consistency.

---

## Minimal working sample

A static Option (fires one event and closes):

```js
import { SuperDaemonInstance } from "@haxtheweb/super-daemon/super-daemon.js";

SuperDaemonInstance.defineOption({
  title: "Save",
  icon: "icons:save",
  tags: ["CMS", "save", "page"],
  shortcut: "cms-save", // links to the Ctrl+Shift+S binding
  context: "HAX",
  eventName: "super-daemon-element-method",
  path: "CMS/action/save",
  value: {
    target: this,
    method: "_editButtonTap",
  },
});
```

A dynamic Program (launches a search-driven sub-palette):

```js
SuperDaemonInstance.defineOption({
  title: "Export this site",
  icon: "icons:file-download",
  tags: ["CMS", "export", "site"],
  eventName: "super-daemon-run-program",
  path: "CMS/export/site",
  context: ["CMS"],
  voice: "export site",
  value: {
    name: "Export this site",
    machineName: "export-site",
    program: async (input, values) => {
      const { createExportSiteProgram } = await import(
        "./utils/ExportSiteProgram.js"
      );
      return createExportSiteProgram(this)(input, values);
    },
  },
});
```

---

## Full annotated sample

The following end-to-end example shows a Program (`Update page tags`) that pre-fills the active page's current tags, offers a save action, and offers a clear action. It is adapted from `EditTagsProgram.js` and the registration in `haxcms-site-editor-ui.js`.

### 1. Registration (in `haxcms-site-editor-ui.js` `firstUpdated()`)

```js
SuperDaemonInstance.defineOption({
  title: "Update page tags",
  icon: "icons:label",
  tags: ["CMS", "edit", "tags", "metadata"],
  eventName: "super-daemon-run-program",
  path: "CMS/edit/tags",
  context: ["CMS"],
  voice: "edit tags",
  value: {
    name: "Update page tags",
    machineName: "edit-tags",
    placeholder: "Enter tags separated by commas",
    // Pre-fill the input with the active page's current tags so the
    // user can edit them in place when launched from Merlin search.
    initialValue: (values) => {
      const activeItem = toJS(store.activeItem);
      return (
        (activeItem && activeItem.metadata && activeItem.metadata.tags) || ""
      );
    },
    program: async (input, values) => {
      const { createEditTagsProgram } = await import(
        "./utils/EditTagsProgram.js"
      );
      const editTagsProgram = createEditTagsProgram(this);
      return editTagsProgram(input, values);
    },
  },
});
```

### 2. Factory module (`EditTagsProgram.js`)

```js
import { store } from "@haxtheweb/haxcms-elements/lib/core/haxcms-site-store.js";
import { toJS } from "mobx";

export const createEditTagsProgram = (context) => {
  return async (input) => {
    const results = [];
    const activeItem = toJS(store.activeItem);

    if (!activeItem || !activeItem.id) {
      return [
        {
          title: "No active page found",
          icon: "icons:warning",
          tags: ["error"],
          value: { disabled: true },
          eventName: "disabled",
          path: "CMS/edit/tags/error",
        },
      ];
    }

    // User typed something — offer to save their input verbatim.
    if (input && input.trim() !== "") {
      results.push({
        title: `Save tags: ${input}`,
        icon: "icons:check",
        tags: ["confirm", "save"],
        value: {
          target: globalThis,
          method: "dispatchEvent",
          args: [
            new CustomEvent("haxcms-save-node-details", {
              bubbles: true,
              composed: true,
              detail: {
                id: activeItem.id,
                operation: "setTags",
                tags: input,
              },
            }),
          ],
        },
        eventName: "super-daemon-element-method",
        path: "CMS/edit/tags/confirm",
      });
      return results;
    }

    // No input but page has tags — offer re-save and clear.
    const currentTags =
      activeItem.metadata && activeItem.metadata.tags
        ? activeItem.metadata.tags
        : "";

    if (currentTags) {
      results.push({
        title: `Save tags: ${currentTags}`,
        icon: "icons:check",
        tags: ["confirm", "save"],
        value: {
          target: globalThis,
          method: "dispatchEvent",
          args: [
            new CustomEvent("haxcms-save-node-details", {
              bubbles: true,
              composed: true,
              detail: {
                id: activeItem.id,
                operation: "setTags",
                tags: currentTags,
              },
            }),
          ],
        },
        eventName: "super-daemon-element-method",
        path: "CMS/edit/tags/confirm",
      });
      results.push({
        title: "Clear all tags",
        icon: "icons:clear",
        tags: ["confirm", "clear"],
        value: {
          target: globalThis,
          method: "dispatchEvent",
          args: [
            new CustomEvent("haxcms-save-node-details", {
              bubbles: true,
              composed: true,
              detail: { id: activeItem.id, operation: "setTags", tags: "" },
            }),
          ],
        },
        eventName: "super-daemon-element-method",
        path: "CMS/edit/tags/clear",
      });
      return results;
    }

    // No input and no tags.
    results.push({
      title: "No tags set",
      icon: "icons:info",
      tags: ["empty"],
      value: { disabled: true },
      eventName: "disabled",
      path: "CMS/edit/tags/empty",
    });
    return results;
  };
};
```

### What happens at runtime

1. The user opens Merlin (`Alt+Shift`) and types `edit tags` (or says "edit tags").
2. The `Update page tags` entry row appears in the filtered list.
3. The user selects it. `super-daemon-row` dispatches `super-daemon-run-program` with `detail.value` — the runtime calls `runProgram()` which enters program mode.
4. Intended: because no explicit `like`/`search` was supplied, `runProgram` calls `value.initialValue(values)` to pre-fill the input with the active page's current tags (e.g. `"physics, lab"`). Today this only happens when the program is launched by `machineName`; launching from the search row skips `initialValue` until the webcomponents fix lands.
5. The `program` function runs with that pre-filled input and returns a `Save tags: physics, lab` row (plus a `Clear all tags` row).
6. The user edits the text. Each keystroke is debounced ~150ms, then `program` re-runs with the new input and the results live-update.
7. The user selects `Save tags: ...`. `super-daemon-row` dispatches `super-daemon-element-method`, the runtime calls `globalThis.dispatchEvent(CustomEvent("haxcms-save-node-details", ...))`, the tags are saved, and the palette closes (because the event was not `super-daemon-run-program`).

---

## License

[Apache-2.0](LICENSE)
