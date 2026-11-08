import type { ComboCategory, Composition, Settings } from "../../core/model"
import { moduleOfCab, taulellMaterial, type TaulellCab } from "../../core/import/taulell"
import { newId, V54_ITEMS, type Module } from "../../core/model"

/**
 * Els models del **Nou moble** de Modelatge (com els del Taulell, cel 2026-11-07): els valors de fàbrica, les últimes
 * opcions triades i la llista de models desats (nom, família, subfamília). Els fa servir la finestra del Nou moble i el
 * «Catàleg» de l'inici de Modelatge (cel 2026-11-08: els models també al Catàleg, com al Taulell).
 */

const KEY = "cnc-nou-moble-v1"
/** Els valors de fàbrica (els de `CABDEF` del Taulell, «Buc bàsic»). */
export const DEF: Required<Pick<TaulellCab, "W" | "H" | "D" | "pl" | "tj" | "t" | "tb" | "cols" | "shelves" | "ss" | "drawers" | "drawerH" | "dhs" | "dsys" | "doors" | "plinth" | "plinthJoin" | "feet" | "topT" | "railW" | "railV" | "back" | "bset" | "bdep" | "bmat" | "s32">> & { cm: string; dm: string; union: "cabineo" | "screw" | "dowel" } = {
  W: 1000,
  H: 860,
  D: 560,
  pl: 100,
  tj: 1,
  t: 19,
  tb: 19,
  cols: 1,
  shelves: 0,
  ss: 1,
  drawers: 0,
  drawerH: 181,
  dhs: "",
  dsys: "fusta",
  doors: false,
  plinth: false,
  plinthJoin: true,
  feet: "axilo",
  topT: "front",
  railW: 200,
  railV: "none",
  back: "inside",
  bset: 49,
  bdep: 8,
  bmat: "auto",
  s32: true,
  cm: "",
  dm: "",
  // La unió de la caixa: el Nou moble del Taulell la fa amb Cabineo (cel, 2026-11-08: «li entra amb els carabineros»).
  union: "cabineo",
}
export type Cab = typeof DEF

export function load(): Cab {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Cab> | null
    return { ...DEF, ...(raw ?? {}) }
  } catch {
    return DEF
  }
}
export function save(c: Cab) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* sense desar: el formulari funciona igual */
  }
}

/** Els models del Nou moble (com els del Taulell): nom, família, subfamília i les opcions. */
export type Model = { n: string; fam?: string; sub?: string; p: Cab }
const MODELS_KEY = "cnc-nou-moble-models-v1"
/** Els models de fàbrica: el «Buc bàsic» del Taulell. */
export const FACTORY: Model[] = [{ n: "Buc bàsic", p: DEF }]
export function loadModels(): { list: Model[]; cur: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(MODELS_KEY) ?? "null") as { list: Model[]; cur: number } | null
    if (raw?.list?.length) return { list: raw.list.map((m) => ({ ...m, p: { ...DEF, ...m.p } })), cur: Math.min(raw.cur ?? 0, raw.list.length - 1) }
  } catch {
    /* res desat */
  }
  return { list: FACTORY, cur: 0 }
}
export function saveModels(v: { list: Model[]; cur: number }) {
  try {
    localStorage.setItem(MODELS_KEY, JSON.stringify(v))
  } catch {
    /* sense desar */
  }
}


/** El mòdul del cnc d'unes opcions del Nou moble (la mateixa fórmula que obre els `.taulell`, `moduleOfCab`). */
export function cabModule(c: Cab, settings: Settings, name: string, warn: (w: string) => void = () => {}): Module {
  const names = settings.materials.map((m) => m.name)
  const cm = c.cm || settings.defaults.material
  const dm = c.dm || cm
  const mat = (k: string | undefined) => (k && names.includes(k) ? k : taulellMaterial(k, names, settings.defaults.material))
  const m = { ...moduleOfCab({ ...c, id: newId("t"), name, cm, dm }, mat, 0, warn), gapBefore: 0 }
  if (c.union === "dowel") return m
  // La de Preferències › Ferratges › Unions (la primera d'aquest tipus) o, si no n'hi ha, la de fàbrica.
  const item = settings.hardwareLibrary.find((x) => x.engine === c.union) ?? V54_ITEMS.find((x) => x.engine === c.union)
  return item ? { ...m, hardware: { ...m.hardware, dowel: structuredClone(item) } } : m
}

/** Els models desats com a categories del Catàleg: una per família (i els que no en tenen, junts), la subfamília a sobre. */
export function modelCategories(settings: Settings): ComboCategory[] {
  const { list } = loadModels()
  const fams = [...new Set(list.map((m) => m.fam ?? ""))].sort((a, b) => (!a ? 1 : !b ? -1 : a.localeCompare(b, "ca")))
  return fams.map((fam) => {
    const items = list.filter((m) => (m.fam ?? "") === fam)
    return {
      id: `nou-moble:${fam || "-"}`,
      name: fam || (fams.length > 1 ? "Sense família" : "Models"),
      description: "Els teus models del Nou moble. Tria'n un per començar un model nou amb aquest moble.",
      kickers: Object.fromEntries(items.filter((m) => m.sub).map((m) => [`nou-moble:${fam}:${list.indexOf(m)}`, m.sub!])),
      items: items.map((m) => ({
        id: `nou-moble:${fam}:${list.indexOf(m)}`,
        kind: "moble" as const,
        name: m.n,
        description: `${m.p.W} × ${m.p.H} × ${m.p.D} mm`,
        make: (): Composition => ({ kind: "moble", modules: [cabModule(m.p, settings, m.n)], references: [] }),
      })),
    }
  })
}
