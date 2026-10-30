Rules for tools and agents registering Merlin commands
------------------------------------------------------

1.  **Required:** `title`, `value`, `eventName`. `defineOption()` silently ignores options missing any of them.
2.  **Match `value` to `eventName`:** `{target, method, args?}` for `super-daemon-element-method`, `{target}` for `super-daemon-element-click`, `{name, program, ...}` for `super-daemon-run-program`, `{shortcutId}` for `execute-keyboard-shortcut`.
3.  **Use arrays for `context`** (`["CMS"]`). A string context is matched with `String.includes`, so it matches by substring. Program `value.context` is the opposite: one string, because it becomes the active command context.
4.  **Never set `index`**, and don't set `shortcutLabel` on registered options: `defineOption()` builds both. Program result rows skip `defineOption()`, so set `shortcutLabel` there yourself if you want a key hint.
5.  **Pick `inline` or `inlineOnly`, not both.** `hidden` and `inlineOnly` programs need a `machineName`, because that's the only way to launch them.
6.  **No unknown keys.** Custom keys must start with `x-`, and remember every string field (including `x-` ones) goes into the search index.
7.  **Scan before you finish:** `merlin-validate --scan <file>`.

Minimal working sample
----------------------

A static Option (fires one event and closes):

A dynamic Program (launches a search-driven sub-palette):

Validation
----------

Merlin options are JS objects in source files, so the most useful check is the static scan:

`--scan` validates every `*.defineOption({...})` object literal as a registered option and every other object literal with `title` + `eventName` + `value` as a Program result row. Values that are not literals (`this.t.save`, function references, lit templates) are accepted as-is; literal values, keys and `value` shapes are checked. JSON files are validated without `--scan`; add `--rows` for arrays of Program result rows and `--json` for a structured report.