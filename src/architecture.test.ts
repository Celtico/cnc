import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
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
