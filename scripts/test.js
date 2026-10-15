#!/usr/bin/env node
/**
 * Self-test: valid examples pass without warnings, invalid fixtures and the
 * JS scan fixture produce the expected findings.
 */
const fs = require('fs')
const path = require('path')
const { buildValidator, validateJsonDoc, scanSource } = require('./validate.js')

const root = path.join(__dirname, '..')
const validate = buildValidator()
let failures = 0

const report = (file, r, expectValid, expectErrors, expectWarnings) => {
  const errText = r.errors.map((e) => `${e.path}: ${e.message}`).join('\n')
  const warnText = r.warnings.map((w) => `${w.path}: ${w.message}`).join('\n')
  const okValid = expectValid ? r.errors.length === 0 && r.warnings.length === 0 : r.errors.length > 0
  const missing = expectErrors.filter((m) => !errText.includes(m))
    .concat(expectWarnings.filter((m) => !warnText.includes(m)).map((m) => `warning: ${m}`))
  if (!okValid || missing.length) {
    failures++
    console.log(`FAIL ${file}\n  errors:\n    ${errText.split('\n').join('\n    ')}\n  warnings:\n    ${warnText.split('\n').join('\n    ')}`)
    for (const m of missing) console.log(`  missing expected: ${m}`)
  } else console.log(`ok   ${file}`)
}
const json = (file, ...rest) => report(file, validateJsonDoc(JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')), validate, { rows: file.includes('rows') }), ...rest)

json('example-option.json', true, [], [])
json('example-program.json', true, [], [])
json('examples/element-click.json', true, [], [])
json('examples/insert-tag.json', true, [], [])
json('examples/inline-only-program.json', true, [], [])
json('examples/program-rows.json', true, [], [])
json('examples/invalid/common-mistakes.json', false, [
  "/0/value: must have required property 'method'",
  '/0/value: must NOT have additional properties ("methd"',
  'set either "inline" or "inlineOnly", not both',
  '/1: must NOT have additional properties ("contexts"',
  '/1/value/context: must be string',
  "/2/shortcut: must have required property 'trigger'",
  "/2/value: must have required property 'shortcutId'"
], [
  '/1/value/machineName: hidden / inlineOnly programs can only be launched by machineName',
  '/2/index: index is built by defineOption()'
])
report('examples/scan/options.js', scanSource(path.join(root, 'examples/scan/options.js'), validate), false, [
  'options.js:21 defineOption /: must NOT have additional properties ("tag"',
  'options.js:21 defineOption /value/context: must be string'
], [])
const scanned = scanSource(path.join(root, 'examples/scan/options.js'), validate)
if (scanned.count !== 3) {
  failures++
  console.log(`FAIL scan found ${scanned.count} options, expected 3 (2 defineOption + 1 row; Lit properties ignored)`)
}
process.exitCode = failures ? 1 : 0
