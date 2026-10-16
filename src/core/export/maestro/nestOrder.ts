import { asciiFold } from "../text"
import { STAGES, type Feat } from "./nestModel"
import { num } from "./script"

export const pad2 = (n: number) => String(n).padStart(2, "0")
const slug = (s: string) =>
  asciiFold(s)
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "tauler"

/** Nom del fitxer d'un tauler: `T01_Melamina_blanca_19.xcs`. */
export const sheetFile = (tab: number, material: string, thickness: number): string => `T${pad2(tab)}_${slug(material)}_${num(thickness)}.xcs`

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Veí més proper des de `pos`: retorna l'ordre i la posició final. */
function nearest<T extends Pick<Feat, "start" | "end">>(feats: T[], pos: [number, number]): { out: T[]; pos: [number, number] } {
  const left = [...feats]
  const out: T[] = []
  let p = pos
  while (left.length) {
    let k = 0
    for (let i = 1; i < left.length; i++) if (dist(left[i]!.start, p) < dist(left[k]!.start, p) - 1e-9) k = i
    const f = left.splice(k, 1)[0]!
    out.push(f)
    p = f.end
  }
  return { out, pos: p }
}

/**
 * Ordre dels mecanitzats: forats → ranures → talls → contorns. Dins de cada etapa, per eina (en l'ordre en què
 * surten) i pel veí més proper; els contorns, per mida (classes de ×2 d'àrea: les petites al final o al
 * principi, `smallParts`) i, dins de cada classe, pel veí més proper.
 */
export function orderFeats<F extends Pick<Feat, "stage" | "key" | "start" | "end" | "area" | "pass" | "small">>(feats: F[], smallParts: "last" | "first" = "last"): F[] {
  const out: F[] = []
  let pos: [number, number] = [0, 0]
  for (const stage of STAGES) {
    const of = feats.filter((f) => f.stage === stage)
    const groups = new Map<string, F[]>()
    if (stage === "outer") {
      // Peces petites en passades: primer els desbastos (passada 1 de totes, després la 2…), amb el tauler sencer.
      const isRough = (f: F) => !!f.pass && f.pass.index < f.pass.count
      const rough = of.filter(isRough)
      for (const k of [...new Set(rough.map((f) => f.pass!.index))].sort((a, b) => a - b)) groups.set(`P${k}`, rough.filter((f) => f.pass!.index === k))
      // Les peces petites van marcades (`small`), tinguin passades de desbast o no.
      const finals = of.filter((f) => !isRough(f) && (f.small || !!f.pass))
      const rest = of.filter((f) => !isRough(f) && !f.small && !f.pass)
      const tier = (f: F) => Math.floor(Math.log2(Math.max(1, f.area)))
      const tiers = [...new Set(rest.map(tier))].sort((a, b) => (smallParts === "last" ? b - a : a - b))
      if (smallParts === "first" && finals.length) groups.set("final", finals)
      for (const t of tiers) groups.set(String(t), rest.filter((f) => tier(f) === t))
      if (smallParts === "last" && finals.length) groups.set("final", finals)
    } else {
      for (const f of of) groups.set(f.key, [...(groups.get(f.key) ?? []), f])
    }
    for (const g of groups.values()) {
      const r = nearest(g, pos)
      out.push(...r.out)
      pos = r.pos
    }
  }
  return out
}
