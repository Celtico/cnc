import { takesFront, type Appliance } from "./appliance"
import type { Carcass } from "./moduleSchema"

/**
 * **La caixa que demana l'electrodomèstic** (per decisió de l'usuari, 2026-10-15: «ficar l'opció al mòdul principal, i la
 * base i altres parts de fusta si l'electrodomèstic ho suporta, si no res; les opcions depenen de l'electrodomèstic
 * seleccionat»). Només per al mòdul sense dividir que **és** l'aparell (`isApplianceModule`: l'ocupa sencer); el d'un
 * compartiment d'un mòdul dividit (columna de forn i microones) no toca la caixa. Cada part de fusta és **fixa** (`true`:
 * hi ha de ser; `false`: no hi ha de ser) o **es tria** a la Caixa (sense valor). Amb la pràctica estàndard dels
 * fabricants (`docs/electrodomestic/README.md`):
 * - **De terra amb front de moble** (rentaplats, rentadora, frigorífic sota taulell: `mount` «base» i `takesFront`): el mòdul
 *   és només el **nínxol** entre els mòduls del costat, sota el taulell: ni base, ni tapa, ni fons, ni sòcol ni potes
 *   (l'aparell va sobre les seves potes; el sòcol del front, a l'Electrodomèstic). Els laterals es trien (un lateral de
 *   remat al final d'una cuina); en triar l'aparell, cap (`applianceDefaults`).
 * - **Frigorífic de columna**: la columna sencera (els dos laterals —el de porta lliscant hi penja les frontisses—, base on
 *   seu i tapa: la S i la A de les alçades del front). El fons i el suport es trien.
 * - **Forn i microones**: la caixa on es cargolen (els dos laterals) i la base on seuen. Al moble penjat, el microones vol
 *   la **paret del darrere oberta** (Bosch p60): sense fons. La resta es tria.
 */
export type CarcassPart = "support" | "bottom" | "top" | "back" | "sides"
export type ApplianceCarcass = Partial<Record<CarcassPart, boolean>> & {
  /**
   * El nínxol de terra (rentaplats, rentadora, frigorífic sota taulell): els laterals, si n'hi ha, són de remat (una peça
   * sola, sense parets buides) i el front de moble va per davant, enrasat amb els fronts del costat (recobrent).
   */
  niche?: true
}

/** L'aparell de terra que fa del mòdul el nínxol (rentaplats, rentadora, frigorífic sota taulell). */
export const isFloorNiche = (a: Appliance): boolean => a.mount === "base" && takesFront(a)

/** Les parts de la caixa que l'aparell fixa (vegeu el comentari de dalt); `hung`: el mòdul és penjat (Posició). */
export function applianceCarcass(a: Appliance, hung: boolean): ApplianceCarcass {
  if (a.kind === "hob" || a.kind === "hood") return {}
  if (isFloorNiche(a)) return { support: false, bottom: false, top: false, back: false, niche: true }
  if (a.kind === "fridge") return { sides: true, bottom: true, top: true }
  if (a.kind === "microwave" && hung && a.wallNiche) return { sides: true, bottom: true, back: false }
  return { sides: true, bottom: true }
}

/** El que es posa en triar l'aparell (es pot canviar després): el nínxol de terra, sense laterals. */
export function applianceDefaults(a: Appliance, c: Carcass): Carcass {
  return isFloorNiche(a) ? { ...c, sides: { left: false, right: false } } : c
}

/**
 * La caixa amb les parts que l'aparell fixa (`visibleModule`: res amagat compta, els valors de l'usuari es conserven i
 * tornen si es treu l'aparell). El suport fix és «Directe a terra» (un mòdul penjat, decisió de Posició, es queda penjat).
 */
export function applyApplianceCarcass(c: Carcass, rule: ApplianceCarcass): Carcass {
  const out: Carcass = { ...c }
  if (rule.support === false && c.base.kind !== "wall") out.base = { kind: "none" }
  if (rule.bottom === false) out.noBottom = true
  if (rule.bottom === true) {
    delete out.noBottom
    if (out.base.kind === "open") out.base = { kind: "none" }
  }
  if (rule.top === false) out.top = { kind: "none" }
  if (rule.top === true && c.top.kind === "none") out.top = { kind: "full" }
  if (rule.back === false) out.back = "none"
  if (rule.sides === true) out.sides = { left: true, right: true }
  if (rule.niche) delete out.hollow
  return out
}
