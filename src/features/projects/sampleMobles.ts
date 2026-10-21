import { randomComposition } from "../../core/build/testCorpus"
import { parseMobleData } from "../../core/file/mobleFile"
import { randomShapesCategory, withoutPlinthBacks, type ComboCategory, type Composition, type Module, type Template } from "../../core/model"
import raw from "./sampleMobles.json?raw"

/**
 * **Mostres de proves** (per decisió de l'usuari, 2026-10-21: «posa tots aquests a mostres, i els random també»): els
 * fitxers de proves (regles del model, caixa de la zona, divisions complexes, estructura lliure, arrambada i penjada) i
 * els mobles aleatoris de les proves d'or (`randomComposition`), com a plantilles de la secció «Proves» de Mobles. Una
 * categoria per grup de cada fitxer i una plantilla per mòdul. Es carrega a part (`import()`), en obrir la pàgina.
 * `sampleMobles.json`: els mòduls dels fitxers, amb els ferratges una sola vegada (eren iguals a tots).
 */
interface SampleData {
  hardware: Module["hardware"]
  files: { id: string; name: string; rest: Partial<Composition>; groups: { name: string; modules: Omit<Module, "hardware">[] }[] }[]
}

/** Un mòdul sol, llegit com un fitxer `.moble` (les mateixes migracions i reparacions que en obrir-lo). */
function single(m: Omit<Module, "hardware">, hardware: Module["hardware"], rest: Partial<Composition>): Composition {
  const { anchor: _a, group: _g, ...mod } = m as Module
  // Un mòdul lliure de lluny (les files de proves comencen a 12 m): al començament.
  const placed = mod.x !== undefined ? { ...mod, x: 0 } : mod
  const composition = { kind: "moble", ...rest, modules: [{ ...placed, hardware }], references: [] }
  const r = parseMobleData({ format: "mobles-cnc", version: 1, exportedAt: "2026-10-21T00:00:00.000Z", project: { name: m.name, composition }, references: [] })
  if (!r.ok) throw new Error(r.error)
  // Fets abans del Fons per zona: els sòcols i suplements de zona, sense fons (per decisió de l'usuari, 2026-10-21).
  const c = r.file.project.composition
  return { ...c, modules: c.modules.map(withoutPlinthBacks) }
}

const SHORT: Record<string, string> = {
  "regles-del-model": "Regles del model",
  "proves-caixa-zona": "Caixa de la zona",
  "proves-divisions": "Divisions complexes",
  "proves-estructura-lliures": "Estructura · lliures al terra",
  "proves-estructura-arrambats": "Estructura · arrambats a la paret",
  "proves-estructura-penjats": "Estructura · penjats a la paret",
}

const RANDOM = 50

/** Una categoria per fitxer (per decisió de l'usuari, 2026-10-21: «has fet massa categories, ajunta-les»); el grup, a la targeta. */
export function sampleCategories(): ComboCategory[] {
  const data = JSON.parse(raw) as SampleData
  const files = data.files.map((f): ComboCategory => {
    const kickers: Record<string, string> = {}
    const items = f.groups.flatMap((g, gi) =>
      g.modules.map((m, i): Template => {
        const id = `sample-${f.id}-${gi + 1}-${i + 1}`
        kickers[id] = g.name
        return { id, kind: "moble", name: m.name, description: `${f.name} · ${g.name}`, make: () => single(m, data.hardware, f.rest) }
      }),
    )
    return { id: `sample-${f.id}`, name: SHORT[f.id] ?? f.name, description: `Del fitxer «${f.name}»: un mòdul per targeta, amb el seu grup a dalt.`, items, kickers }
  })
  const random: ComboCategory = {
    id: "sample-random",
    name: "Aleatoris",
    description: "Mobles fets a l'atzar (els de les proves d'or): combinacions que ningú no ha triat, per si en surt una idea.",
    items: Array.from({ length: RANDOM }, (_, i): Template => ({
      id: `sample-random-${i + 1}`,
      kind: "moble",
      name: `Aleatori ${i + 1}`,
      description: `Moble aleatori número ${i + 1} (sempre el mateix).`,
      // Els materials, els de Preferències (també els fronts: per decisió de l'usuari, 2026-10-21, «materials a l'atzar no»).
      make: () => {
        const c = randomComposition(i + 1)
        return { ...c, modules: c.modules.map((m) => ({ ...m, carcass: (({ frontMaterial: _f, ...k }) => k)(m.carcass) })) }
      },
    })),
  }
  return [...files, random, randomShapesCategory()]
}
