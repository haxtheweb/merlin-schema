A Program is an Option with `eventName: "super-daemon-run-program"` and a `value` object containing the following keys.

<a11y-collapse heading-button="heading-button"><h2 slot="heading">value object fields</h2><div slot="content"><ul><li><strong>name</strong> (string, required) — Human-readable name shown as the program-mode title while the program is active.</li><li><strong>program</strong> (<code>async (input, values) =&gt; Promise&lt;Option[]&gt;</code>, required) — The search function. <code>input</code> is the current search text; <code>values</code> is the bag passed into <code>runProgram()</code>. Each returned item is an Option-shaped row rendered by <code>super-daemon-row</code>. Re-invoked (debounced ~150ms) on every keystroke.</li><li><strong>machineName</strong> (string, optional) — Stable identifier enabling <code>runProgram('like', context, values, 'machineName')</code> to resolve and invoke this program by name without holding a direct function reference.</li><li><strong>context</strong> (string, optional) — Command context to activate when the program launches (e.g. <code>"CMS"</code> or <code>"&gt;"</code>). A single string, not an array: <code>runProgram()</code> assigns it straight to <code>commandContext</code>.</li><li><strong>placeholder</strong> (string, optional) — Placeholder text for the search input while the program is active (e.g. <code>"Enter new title"</code>).</li><li><strong>initialValue</strong> (<code>async (values) =&gt; Promise&lt;string&gt;</code>, optional) — Optional prefill: a non-empty string return pre-fills the search input when the program is launched with no explicit like/search. Currently only honored when the program is launched by <code>machineName</code>; selecting the row from Merlin search passes the function directly and skips it.</li></ul></div></a11y-collapse>

The whole `value` object is also the program's second argument (`values`), so any extra keys you put on `value` reach the program.

The lazy factory pattern
------------------------

Programs are commonly lazy-loaded via dynamic `import()` of a `createXProgram(context)` factory module, so the program code is only fetched when the user actually selects it:

The factory module exports a `createXProgram(context)` function that returns the actual `async (input, values) => [...]` function, closing over `context` (typically the `haxcms-site-editor-ui` instance) so the program can call back into editor methods.

What a program returns
----------------------

The program function returns an array of Option-shaped rows. Each row follows the same Option schema and is rendered by `super-daemon-row`. A common pattern is to return "confirm" rows that use `eventName: "super-daemon-element-method"` to dispatch a save event:

runProgram() — invoking a program programmatically
--------------------------------------------------

Programs can also be launched from code (not just by user search), via `SuperDaemonInstance.runProgram()`:

When `program` is a string, `runProgram` looks up the matching `value.machineName` in `allItems` to resolve the function. The `waveWand(params, target, sound)` helper wraps `runProgram` + `open()` + an optional sound for the common "open Merlin in mini/wand mode near a target" interaction pattern.