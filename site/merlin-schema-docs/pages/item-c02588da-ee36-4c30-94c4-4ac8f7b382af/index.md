Voice command layer (optional facet)
------------------------------------

When `voiceSearch` is enabled on the `super-daemon` element, the `hal-9000` speech engine is loaded and Merlin's commands become voice-addressable. Each Option can declare a `voice` phrase pattern; if omitted, the `title` is used. The pattern syntax uses parenthesized segments for optional words, e.g. `"(toggle) dark mode"` matches both "toggle dark mode" and "dark mode".

Voice commands are re-processed (`reprocessVoiceCommands()`) whenever the visible item set changes (e.g. context switch), so only currently-relevant options are voice-addressable. A built-in catch-all (`"*anything"`) routes unrecognized speech into the search input.

This layer is optional — Options and Programs work fully without it. The `voice` field is purely additive.

Shortcut metadata (optional facet)
----------------------------------

An Option (or Program entry row) can declare a `shortcut` field that links it to the shared **KeyboardShortcutManager** registry — the single source of truth for keyboard/insertion shortcuts across the HAX ecosystem. That registry is also used by HAXcms `Ctrl+Shift+[Key]` bindings and the HAXStore markdown-trigger-to-gizmo map, so a Merlin option can reference the same shortcut descriptor those subsystems use.

`shortcut` accepts either a registry id string (e.g. `"cms-save"`) — resolves to a descriptor previously registered via `KeyboardShortcutManagerInstance.register(...)` — or an inline descriptor object with the canonical shape:

When `shortcut` is present, `defineOption()` resolves a human-readable label via `KeyboardShortcutManager.getLabel()` and stores it on `shortcutLabel` (e.g. `"Ctrl⇧S"` for a binding, `"###"` for a markdown trigger). The UI reads `shortcutLabel` to render a keyboard hint in the row. Both `shortcut` and `shortcutLabel` are excluded from the search index so they don't pollute text matching.

Real example (from `haxcms-site-editor-ui.js`):

This layer is optional — the `shortcut` field is purely additive and does not change how an option is invoked; it only surfaces a keyboard-hint label in the UI and (optionally) ties the option to a shared descriptor for cross-subsystem consistency.