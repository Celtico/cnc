import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

/**
 * Regles d'arquitectura (`docs/convencions.md` §Capes): es comproven a cada `pnpm test` perquè un canvi nou no les trenqui
 * sense adonar-se'n. Només el codi de l'app (no els tests).
 */
const SRC = resolve(__dirname)
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) && !n.endsWith(".d.ts") ? [p] : []
  })
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^"']*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g
/** Cada import d'un fitxer: el mòdul tal com s'escriu i, si és relatiu, el camí dins de `src/`. */
function importsOf(file: string): { spec: string; path?: string }[] {
  const text = readFileSync(file, "utf8")
  return [...text.matchAll(IMPORT)].map((m) => {
    const spec = (m[1] ?? m[2])!
    return spec.startsWith(".") ? { spec, path: relative(SRC, resolve(dirname(file), spec)).replaceAll("\\", "/") } : { spec }
  })
}
const all = files(SRC).map((f) => ({ file: relative(SRC, f).replaceAll("\\", "/"), imports: importsOf(f) }))
const violations = (from: (f: string) => boolean, bad: (i: { spec: string; path?: string }) => boolean) =>
  all.filter((x) => from(x.file)).flatMap((x) => x.imports.filter(bad).map((i) => `${x.file} → ${i.spec}`))

describe("arquitectura", () => {
  it("cap fitxer es diu igual que un altre de la mateixa carpeta canviant només majúscules (al Mac obre el que no toca)", () => {
    const seen = new Map<string, string>()
    const clash: string[] = []
    for (const f of files(SRC)) {
      const key = f.replace(/\.(test\.)?tsx?$/, "").toLowerCase()
      const prev = seen.get(key)
      if (prev && prev !== f.replace(/\.(test\.)?tsx?$/, "")) clash.push(`${relative(SRC, prev)} ↔ ${relative(SRC, f)}`)
      seen.set(key, f.replace(/\.(test\.)?tsx?$/, ""))
    }
    expect(clash).toEqual([])
  })
  it("`core/` és lògica pura: sense React, Chakra, three ni Dexie", () => {
    expect(violations((f) => f.startsWith("core/"), (i) => /^(react|react-dom|@chakra-ui|three|@react-three|dexie)(\/|$)/.test(i.spec))).toEqual([])
  })
  it("`core/` no importa de les pantalles, components, db ni tema", () => {
    expect(violations((f) => f.startsWith("core/"), (i) => !!i.path && /^(features|components|db|theme)\//.test(i.path))).toEqual([])
  })
  it("la importació de fabricant (`core/import`, adormida) no la fa servir cap altre mòdul de `core/`", () => {
    expect(violations((f) => f.startsWith("core/") && !f.startsWith("core/import/"), (i) => !!i.path && /^core\/import(\/|$)/.test(i.path))).toEqual([])
  })
  it("`components/` no importa de `features/` (els components compartits no saben res de les pantalles)", () => {
    // Excepte l'estat global de l'app: les preferències i el projecte obert.
    const GLOBAL = new Set(["features/settings/SettingsContext", "features/useProject"])
    expect(violations((f) => f.startsWith("components/"), (i) => !!i.path && i.path.startsWith("features/") && !GLOBAL.has(i.path))).toEqual([])
  })
  it("`lib/` és d'ús general: no importa de `features/`, `components/` ni `core/`", () => {
    expect(violations((f) => f.startsWith("lib/"), (i) => !!i.path && /^(features|components|core)\//.test(i.path))).toEqual([])
  })
})

/**
 * Mides màximes (`docs/convencions.md` §Mida): un fitxer o una funció que creix més enllà és senyal que hi ha dues coses
 * barrejades. Les dades (catàlegs, plantilles) i el traçador de camins (bucle calent, shader) en queden fora.
 */
const MAX_FILE_LINES = 700
const MAX_FUNCTION_LINES = 350
const SIZE_EXEMPT = new Set([
  "core/model/collections.ts",
  "core/model/ambientTemplates.ts",
  "core/model/storeCatalog.ts",
  "components/viewer/render/gpuTracer.wgsl.ts",
  "components/viewer/render/pathWorker.ts",
])

describe("mida", () => {
  const sized = files(SRC).map((f) => ({ file: relative(SRC, f).replaceAll("\\", "/"), text: readFileSync(f, "utf8") })).filter((x) => !SIZE_EXEMPT.has(x.file))
  it(`cap fitxer passa de ${MAX_FILE_LINES} línies`, () => {
    expect(sized.filter((x) => x.text.split("\n").length > MAX_FILE_LINES).map((x) => `${x.file}: ${x.text.split("\n").length}`)).toEqual([])
  })
  it(`cap funció passa de ${MAX_FUNCTION_LINES} línies`, () => {
    const long: string[] = []
    for (const { file, text } of sized) {
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      const visit = (n: ts.Node) => {
        if ((ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n)) && n.body) {
          const lines = sf.getLineAndCharacterOfPosition(n.end).line - sf.getLineAndCharacterOfPosition(n.getStart()).line
          if (lines > MAX_FUNCTION_LINES) long.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}: ${lines}`)
        }
        ts.forEachChild(n, visit)
      }
      visit(sf)
    }
    expect(long).toEqual([])
  })
})
