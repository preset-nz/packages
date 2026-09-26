#!/usr/bin/env node
/**
 * Schema drift check, part of `just check`. schema/v0.1.json is hand-kept and
 * published at https://facets.preset.nz/schema/v0.1.json. Within 0.1 it may
 * only grow, so it must match src/types.ts exactly: looser can't be tightened
 * later, stricter rejects what tsc accepts.
 *
 * 1. Names: the BuiltinFieldKind union, the BuiltinFieldDef union's kinds, the
 *    kinds registerBuiltinRenderers() registers, and the schema's built-ins.
 * 2. Props: per kind and per helper type, property names and which are
 *    required. Function-typed props are code-only and skipped.
 * 3. Fixtures: the playground's starters and some hand-made cases must pass;
 *    a set of known mistakes must fail.
 *
 * Runs on Node's type stripping: `node scripts/check-schema.ts`.
 */
import { readFileSync } from "node:fs"
import ts from "typescript"
import Ajv from "ajv"
import { STARTERS } from "../playground/src/defaults.ts"

const root = new URL("../", import.meta.url)
const read = (p: string) => readFileSync(new URL(p, root), "utf8")
const schema = JSON.parse(read("schema/v0.1.json"))
const defs = schema.definitions as Record<string, any>

// Deliberate differences between the JSON and the types. Keep this short.
const ALLOWED_EXTRA: Record<string, string[]> = {
  "#root": ["$schema"], // so a file can point at this schema and still validate
}

const failures: string[] = []
const fail = (msg: string) => failures.push(msg)

// ---- 1. Read the types --------------------------------------------------------

const src = ts.createSourceFile("types.ts", read("src/types.ts"), ts.ScriptTarget.Latest, true)

interface Shape {
  props: Map<string, { optional: boolean; code: boolean }>
  kind?: string
  extendsBase: boolean
}
const shapes = new Map<string, Shape>()
const unions = new Map<string, string[]>()

const unwrap = (t: ts.TypeNode): ts.TypeNode => (ts.isParenthesizedTypeNode(t) ? unwrap(t.type) : t)

src.forEachChild((node) => {
  if (ts.isInterfaceDeclaration(node)) {
    const extendsBase = !!node.heritageClauses?.some((h) =>
      h.types.some((t) => t.expression.getText(src) === "BaseField"),
    )
    const shape: Shape = { props: new Map(), extendsBase }
    for (const m of node.members) {
      if (!ts.isPropertySignature(m) || !m.type) continue
      const name = m.name.getText(src).replace(/^"|"$/g, "")
      const type = unwrap(m.type)
      shape.props.set(name, { optional: !!m.questionToken, code: ts.isFunctionTypeNode(type) })
      if (name === "kind" && ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) {
        shape.kind = type.literal.text
      }
    }
    shapes.set(node.name.text, shape)
  }
  if (ts.isTypeAliasDeclaration(node) && ts.isUnionTypeNode(node.type)) {
    unions.set(
      node.name.text,
      node.type.types.map((t) =>
        ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal) ? t.literal.text : t.getText(src),
      ),
    )
  }
})

/** Property names of an interface, with BaseField's merged in when it extends it. */
function propsOf(name: string) {
  const shape = shapes.get(name)
  if (!shape) throw new Error(`no interface ${name} in src/types.ts`)
  const props = new Map(shape.extendsBase ? shapes.get("BaseField")!.props : [])
  for (const [k, v] of shape.props) props.set(k, v)
  return props
}

// ---- 2. Compare names ---------------------------------------------------------

const unionKinds = unions.get("BuiltinFieldKind") ?? []
const defKinds = (unions.get("BuiltinFieldDef") ?? []).map((n) => {
  const kind = shapes.get(n)?.kind
  if (!kind) fail(`BuiltinFieldDef member ${n} has no literal kind`)
  return kind ?? n
})
const renderers = [
  ...read("src/field-renderers.tsx").matchAll(/registerFieldRenderer\(\s*"([^"]+)"/g),
].map((m) => m[1])
const schemaKinds = (defs.field.allOf as any[])
  .map((b) => b.if.properties.kind.const)
  .filter((k): k is string => typeof k === "string")

const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join()
const sets: Array<[string, string[]]> = [
  ["BuiltinFieldDef kinds", defKinds],
  ["registerBuiltinRenderers()", renderers],
  ["schema built-ins", schemaKinds],
]
for (const [name, kinds] of sets) {
  if (!same(unionKinds, kinds)) {
    fail(`kinds differ: BuiltinFieldKind [${unionKinds.join(", ")}] vs ${name} [${kinds.join(", ")}]`)
  }
}

// ---- 3. Compare props ---------------------------------------------------------

function compare(label: string, typeName: string, def: any) {
  const props = propsOf(typeName)
  const code = [...props].filter(([, v]) => v.code).map(([k]) => k)
  const data = [...props].filter(([, v]) => !v.code)
  const want = data.map(([k]) => k)
  const have = Object.keys(def.properties ?? {}).filter((k) => !(ALLOWED_EXTRA[label] ?? []).includes(k))
  const missing = want.filter((k) => !have.includes(k))
  const extra = have.filter((k) => !want.includes(k))
  if (missing.length) fail(`${label}: in ${typeName}, not in the schema: ${missing.join(", ")}`)
  if (extra.length) fail(`${label}: in the schema, not in ${typeName}: ${extra.join(", ")}`)
  const req = data.filter(([, v]) => !v.optional).map(([k]) => k)
  if (!same(req, def.required ?? [])) {
    fail(`${label}: required differs: ${typeName} [${req.join(", ")}] vs schema [${(def.required ?? []).join(", ")}]`)
  }
  return code
}

const codeOnly: string[] = []
for (const typeName of unions.get("BuiltinFieldDef") ?? []) {
  const kind = shapes.get(typeName)?.kind
  if (!kind || !defs[kind]) continue
  codeOnly.push(...compare(kind, typeName, defs[kind]).map((p) => `${kind}.${p}`))
}
compare("custom", "BaseField", defs.custom)
compare("group", "PropertyGroupDef", defs.group)
compare("disabledWhen", "DisabledWhen", defs.disabledWhen)
compare("selectOption", "SelectOption", defs.selectOption)
compare("vectorComponent", "VectorComponentDef", defs.vectorComponent)
compare("#root", "PropertySchema", schema)

// ---- 4. Fixtures --------------------------------------------------------------

const validate = new Ajv({ strict: true, allErrors: true }).compile(schema)
const wrap = (field: unknown) => ({ version: 1, groups: [{ id: "g", rows: [field] }] })

const valid: Array<[string, unknown]> = [
  ...STARTERS.map((s): [string, unknown] => [`starter "${s.id}"`, s.schema]),
  ["a $schema key", { $schema: schema.$id, version: 1, groups: [] }],
  ["a custom kind with extra props", wrap({ kind: "palette-strip", id: "p", path: "p", colours: ["#000"] })],
  ["promote on a field and a separator", { version: 1, groups: [{ id: "g", rows: [{ kind: "slider", id: "a", path: "a", promote: "collapsed" }, { kind: "separator", id: "s", promote: "card" }] }] }],
  ["a paired row", { version: 1, groups: [{ id: "g", rows: [[{ kind: "text", id: "a", path: "a" }, { kind: "checkbox", id: "b", path: "b" }]] }] }],
]
const invalid: Array<[string, unknown]> = [
  ["a misspelled prop on text", wrap({ kind: "text", id: "t", path: "t", placehodler: "x" })],
  ["number without path", wrap({ kind: "number", id: "n" })],
  ["separator with a path", wrap({ kind: "separator", id: "s", path: "s" })],
  ["label without its text", wrap({ kind: "label", id: "l" })],
  ["vector without components", wrap({ kind: "vector", id: "v", path: "v" })],
  ["an unknown disabledWhen operator", wrap({ kind: "text", id: "t", path: "t", disabledWhen: { path: "x", equal: 1 } })],
  ["an unknown promote level", wrap({ kind: "text", id: "t", path: "t", promote: "toolbar" })],
  ["a custom kind without path", wrap({ kind: "palette-strip", id: "p" })],
  ["a field without kind", wrap({ id: "x", path: "x" })],
  ["a group without rows", { version: 1, groups: [{ id: "g" }] }],
  ["an unknown top-level key", { version: 1, groups: [], title: "x" }],
]
for (const [name, doc] of valid) {
  if (!validate(doc)) fail(`should pass, fails: ${name}: ${validate.errors?.[0]?.instancePath} ${validate.errors?.[0]?.message}`)
}
for (const [name, doc] of invalid) {
  if (validate(doc)) fail(`should fail, passes: ${name}`)
}

// ---- Report -------------------------------------------------------------------

if (failures.length) {
  console.error("Schema drift check failed:")
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log(
  `schema check: ${unionKinds.length} kinds agree across types, renderers and schema; ` +
    `${valid.length} fixtures pass, ${invalid.length} fail as they should` +
    (codeOnly.length ? `; code-only, not in JSON: ${codeOnly.join(", ")}` : ""),
)
