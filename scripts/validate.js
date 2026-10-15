#!/usr/bin/env node
/**
 * Validate Merlin (super-daemon) options and programs.
 *
 * Usage:
 *   node scripts/validate.js [--json] [--strict] <file.json> [...]
 *   node scripts/validate.js --scan [--json] [--strict] <file.js> [...]
 *
 * JSON mode: each file holds one option/program object or an array of them.
 * --scan:    statically checks JS source. Every `*.defineOption({...})` object
 *            literal is validated as a registered option, and every other object
 *            literal with `title` + `eventName` + `value` (Program result rows)
 *            is validated as a row. Values that are not literals (this.t.save,
 *            function references, template results) are accepted as-is.
 * --rows     JSON mode: treat entries as Program result rows (not passed
 *            through defineOption, so shortcutLabel may be set by hand)
 * --json     machine-readable report
 * --strict   treat warnings as errors
 * Exit code: 0 when everything is valid, 1 otherwise.
 */
const fs = require('fs')
const path = require('path')
const Ajv2020 = require('ajv/dist/2020')

const ROOT = path.join(__dirname, '..')
const EXPR = '\u0000expr'

function buildValidator () {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  const option = JSON.parse(fs.readFileSync(path.join(ROOT, 'merlin-option.schema.json'), 'utf8'))
  const program = JSON.parse(fs.readFileSync(path.join(ROOT, 'merlin-program.schema.json'), 'utf8'))
  ajv.addSchema(option)
  ajv.addSchema(program)
  return ajv.getSchema(option.$id)
}

const valueAt = (root, pointer) => pointer.split('/').slice(1).reduce((v, k) => (v == null ? v : v[k.replace(/~1/g, '/').replace(/~0/g, '~')]), root)

/** Format ajv errors, dropping ones caused by non-literal (unknown) values. */
function formatAjv (errors, data, opaque) {
  const out = []
  const seen = new Set()
  for (const e of errors || []) {
    const v = valueAt(data, e.instancePath)
    if (v === EXPR) continue
    if ((e.keyword === 'required' || e.keyword === 'additionalProperties') && opaque.has(e.instancePath)) continue
    if (['if', 'allOf', 'oneOf', 'anyOf', 'not'].includes(e.keyword) && e.keyword !== 'not') continue
    let msg = e.message
    if (e.keyword === 'not' && e.instancePath === '') msg = 'set either "inline" or "inlineOnly", not both (inlineOnly implies inline)'
    if (e.params && e.params.additionalProperty) msg += ` ("${e.params.additionalProperty}"; prefix custom keys with "x-")`
    if (e.params && e.params.allowedValues) msg += `: ${e.params.allowedValues.join(', ')}`
    const key = `${e.instancePath}|${msg}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ path: e.instancePath || '/', message: msg })
  }
  return out
}

const KNOWN_EVENTS = new Set(['super-daemon-element-method', 'super-daemon-element-click', 'super-daemon-run-program', 'hax-super-daemon-insert-tag', 'execute-keyboard-shortcut', 'disabled', 'super-daemon-noop'])

/** Checks JSON Schema cannot express. `registered` = passed to defineOption(). */
function behaviorChecks (opt, registered) {
  const warnings = []
  if (!opt || typeof opt !== 'object') return warnings
  if (typeof opt.eventName === 'string' && opt.eventName !== EXPR && !KNOWN_EVENTS.has(opt.eventName)) {
    warnings.push({ path: '/eventName', message: `"${opt.eventName}" is not handled by super-daemon or HAX core; make sure something listens for it on globalThis` })
  }
  if (registered && typeof opt.index !== 'undefined') warnings.push({ path: '/index', message: 'index is built by defineOption(); remove it' })
  if (registered && typeof opt.shortcutLabel !== 'undefined') warnings.push({ path: '/shortcutLabel', message: 'shortcutLabel is computed from shortcut by defineOption(); remove it' })
  if (typeof opt.context === 'string' && opt.context !== EXPR && opt.context !== '*') {
    warnings.push({ path: '/context', message: 'string contexts match by substring; prefer an array, e.g. ["' + opt.context + '"]' })
  }
  const v = opt.value
  if (opt.eventName === 'super-daemon-run-program' && v && typeof v === 'object' && (opt.hidden === true || opt.inlineOnly === true) && typeof v.machineName === 'undefined') {
    warnings.push({ path: '/value/machineName', message: 'hidden / inlineOnly programs can only be launched by machineName; add one' })
  }
  if (registered && typeof opt.icon === 'undefined' && typeof opt.image === 'undefined' && typeof opt.textCharacter === 'undefined') {
    warnings.push({ path: '/', message: 'no icon, image or textCharacter; the row renders without a visual' })
  }
  return warnings
}

function validateOne (opt, validate, { registered = true, opaque = new Set(), at = '' } = {}) {
  validate(opt)
  const prefix = (list) => list.map((x) => ({ ...x, path: `${at}${x.path === '/' ? '' : x.path}` || '/' }))
  return {
    errors: prefix(formatAjv(validate.errors, opt, opaque)),
    warnings: prefix(behaviorChecks(opt, registered))
  }
}

// ---------- --scan: static analysis of JS source ----------
function astToValue (node, opaque, pointer) {
  switch (node && node.type) {
    case 'Literal': return node.value
    case 'TemplateLiteral': return node.expressions.length ? EXPR : node.quasis[0].value.cooked
    case 'ArrayExpression': return node.elements.map((el, i) => (el && el.type !== 'SpreadElement' ? astToValue(el, opaque, `${pointer}/${i}`) : EXPR))
    case 'ObjectExpression': {
      const obj = {}
      for (const p of node.properties) {
        if (p.type !== 'Property' || p.computed) { opaque.add(pointer); continue }
        const key = p.key.type === 'Identifier' ? p.key.name : String(p.key.value)
        obj[key] = astToValue(p.value, opaque, `${pointer}/${key}`)
      }
      return obj
    }
    case 'UnaryExpression':
      if (node.operator === '-' && node.argument.type === 'Literal') return -node.argument.value
      if (node.operator === '!' && node.argument.type === 'Literal') return !node.argument.value
      return EXPR
    default: return EXPR
  }
}

const keysOf = (node) => node.properties.filter((p) => p.type === 'Property' && !p.computed).map((p) => (p.key.type === 'Identifier' ? p.key.name : String(p.key.value)))

function scanSource (file, validate) {
  const acorn = require('acorn')
  const walk = require('acorn-walk')
  const src = fs.readFileSync(file, 'utf8')
  let ast
  try {
    ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true })
  } catch (e) {
    return { errors: [{ path: '/', message: `cannot parse: ${e.message}` }], warnings: [], count: 0 }
  }
  const registered = new Set()
  const found = []
  walk.full(ast, (n) => {
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed && n.callee.property.name === 'defineOption' && n.arguments[0] && n.arguments[0].type === 'ObjectExpression') {
      registered.add(n.arguments[0])
      found.push({ node: n.arguments[0], registered: true })
    }
  })
  walk.full(ast, (n) => {
    if (n.type === 'ObjectExpression' && !registered.has(n)) {
      const keys = keysOf(n)
      if (!(keys.includes('title') && keys.includes('eventName') && keys.includes('value'))) return
      // skip Lit `static properties` blocks and similar declaration maps
      const titleNode = n.properties.find((p) => p.type === 'Property' && !p.computed && (p.key.name || p.key.value) === 'title')
      if (titleNode && titleNode.value.type === 'ObjectExpression') return
      found.push({ node: n, registered: false })
    }
  })
  let errors = []
  let warnings = []
  for (const { node, registered: reg } of found) {
    const opaque = new Set()
    const opt = astToValue(node, opaque, '')
    const at = `${path.basename(file)}:${node.loc.start.line}${reg ? ' defineOption' : ' row'}`
    const r = validateOne(opt, validate, { registered: reg, opaque })
    errors = errors.concat(r.errors.map((x) => ({ ...x, path: `${at} ${x.path}` })))
    warnings = warnings.concat(r.warnings.map((x) => ({ ...x, path: `${at} ${x.path}` })))
  }
  return { errors, warnings, count: found.length }
}

function validateJsonDoc (doc, validate, { rows = false } = {}) {
  const list = Array.isArray(doc) ? doc : [doc]
  let errors = []
  let warnings = []
  list.forEach((opt, i) => {
    const r = validateOne(opt, validate, { registered: !rows, at: Array.isArray(doc) ? `/${i}` : '' })
    errors = errors.concat(r.errors)
    warnings = warnings.concat(r.warnings)
  })
  return { errors, warnings, count: list.length }
}

function main (argv) {
  const args = argv.slice(2)
  let asJson = false
  let strict = false
  let scan = false
  let rows = false
  const files = []
  for (const a of args) {
    if (a === '--json') asJson = true
    else if (a === '--strict') strict = true
    else if (a === '--scan') scan = true
    else if (a === '--rows') rows = true
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0])
      return 0
    } else files.push(a)
  }
  if (!files.length) {
    console.error('usage: validate.js [--scan | --rows] [--json] [--strict] <file> [file...]')
    return 2
  }
  const validate = buildValidator()
  const reports = files.map((file) => {
    let r
    if (scan) r = scanSource(file, validate)
    else {
      try {
        r = validateJsonDoc(JSON.parse(fs.readFileSync(file, 'utf8')), validate, { rows })
      } catch (e) {
        r = { errors: [{ path: '/', message: `cannot read JSON: ${e.message}` }], warnings: [], count: 0 }
      }
    }
    return { file, ...r, valid: r.errors.length === 0 && (!strict || r.warnings.length === 0) }
  })
  if (asJson) console.log(JSON.stringify(reports, null, 2))
  else {
    for (const r of reports) {
      if (scan && r.count === 0 && r.errors.length === 0) continue
      console.log(`${r.valid ? 'PASS' : 'FAIL'} ${r.file} (${r.count} option${r.count === 1 ? '' : 's'})`)
      for (const e of r.errors) console.log(`  error   ${e.path}: ${e.message}`)
      for (const w of r.warnings) console.log(`  warning ${w.path}: ${w.message}`)
    }
  }
  return reports.every((r) => r.valid) ? 0 : 1
}

module.exports = { buildValidator, validateOne, validateJsonDoc, scanSource, EXPR }

if (require.main === module) {
  process.exitCode = main(process.argv)
}
