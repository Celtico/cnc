import { floorTrams, isApplianceModule, moduleFootprint, moduleFrontFace, moduleRot, tramHeightMismatches, tramSides, type Composition, type Facing, type ModulePlacement, type ModuleRot, type Panel } from "../model"
import type { LinearPiece } from "./linearOrders"
import type { BuildWarning, VentInlet } from "./module/types"
import { aluPlinth, plinthPieces, woodPlinthPanels, type PlinthFrame } from "./plinth"
import { fmtNum, roundTo } from "../../lib/format"

/** Marge a cada costat de la reixeta d'entrada d'aire (com la del moble, `appliances.ts`). */
const VENT_MARGIN = 30

interface TramPlinthBuild {
  panels: Panel[]
  extras: Panel[]
  linear: LinearPiece[]
  warnings: { code: "layout" | "hardware" | "mitre"; message: string; moduleId?: string; options?: BuildWarning["options"] }[]
}

/**
 * **El sòcol de cada tram** (per decisió de l'usuari, 2026-10-15: «el sòcol no pot anar per cada mòdul, és una peça
 * global»): amb el suport «Sòcol» (`Composition.support`), una sola peça per costat de cada tram (`floorTrams`: els mòduls
 * de terra que es toquen), de punta a punta, mai una per mòdul. Al davant sempre, a `setback` de la cara dels fronts; als
 * costats que es triïn per al tram (`tramSides`: els extrems vistos, tot el voltant d'una illa), a `sideSetback` de la cara
 * del lateral o del darrere. De fusta (de terra fins a 5 mm sota la base, del material i gruix del cos del primer mòdul o
 * els triats; cantonades a tope o a inglet) o d'alumini (`aluPlinth`: per metres, clips a les potes i cantoneres). També
 * avisa dels mòduls del tram que no arriben a la mateixa alçada (el taulell no quedaria pla). Coordenades de la
 * composició; `moduleNumber`: el «mòdul» de les refs del taller (com les peces corregudes).
 */
/** Una entrada d'aire d'un electrodomèstic: el mòdul (índex) i el compartiment (x del mòdul). */
interface TramVent extends VentInlet {
  module: number
}

export function buildTramPlinths(comp: Composition, places: ModulePlacement[], moduleNumber: number, vents: TramVent[] = [], rotOf: (i: number) => ModuleRot = (i) => moduleRot(comp.modules[i]!)): TramPlinthBuild {
  const out: TramPlinthBuild = { panels: [], extras: [], linear: [], warnings: [] }
  const s = comp.support
  if (!s) return out
  const trams = floorTrams(comp, places)
  for (const tram of trams)
    for (const w of tramHeightMismatches(comp, tram, places))
      out.warnings.push({
        code: "layout",
        moduleId: w.module.id,
        message: `«${w.module.name}» arriba a ${fmtNum(w.top, 1)} mm del terra i els baixos del costat a ${fmtNum(w.expected, 1)} mm: el taulell no quedarà pla. Canvia-li l'alçada a ${fmtNum(w.module.carcass.height + w.expected - w.top, 1)} mm.`,
        options: [{ text: `Posar l'alçada del mòdul a ${fmtNum(w.module.carcass.height + w.expected - w.top, 1)} mm.`, where: "dims" }],
      })
  if (s.kind !== "plinth") return out
  const pl = s.plinth
  const H = s.height
  let mitreNote = false
  for (const tram of trams) {
    const ms = tram.modules.map((i) => comp.modules[i]!)
    const first = ms[0]!
    const sides = tramSides(s, tram, comp)
    const ss = pl.sideSetback ?? pl.setback
    // La petjada de cada mòdul a la planta i cap on miren els fronts (`moduleFootprint`: girats 90°, 180° o 270°, `rotOf`).
    const fps = tram.modules.map((i) => ({ i, ...moduleFootprint(comp.modules[i]!, places[i]!, moduleFrontFace(comp.modules[i]!), rotOf(i)) }))
    const X0 = Math.min(...fps.map((f) => f.x0)), X1 = Math.max(...fps.map((f) => f.x1)), Z0 = Math.min(...fps.map((f) => f.z0))
    // Els que miren cap a un costat; per a la cara, sense els electrodomèstics de terra (el seu front de moble s'enrasa amb
    // els del costat), si n'hi ha d'altres.
    const facing = (d: Facing) => {
      const all = fps.filter((f) => f.facing === d)
      const own = all.filter((f) => !isApplianceModule(comp.modules[f.i]!))
      return own.length ? own : all
    }
    const fz = facing("+z"), bz = facing("-z"), rx = facing("+x"), lx = facing("-x")
    // La cara de davant d'un tram sense fronts endavant (una fila girada): la més endarrerida dels del tram.
    const nonApp = fps.filter((f) => !isApplianceModule(comp.modules[f.i]!))
    const zFaceAll = Math.min(...(nonApp.length ? nonApp : fps).map((f) => f.z1))
    // Cada costat del sòcol: on hi miren fronts, retirat `setback` de la cara més endarrerida i sempre; si no, el
    // costat del tram (retirat `ss` si es tria). Una illa (dues files d'esquena) en té als dos costats; un mòdul girat 90°
    // a l'extrem, al seu costat.
    const frame = {
      x0: lx.length ? Math.max(...lx.map((f) => f.x0)) + pl.setback : sides.left ? X0 + ss : X0,
      x1: rx.length ? Math.min(...rx.map((f) => f.x1)) - pl.setback : sides.right ? X1 - ss : X1,
      zBack: bz.length ? Math.max(...bz.map((f) => f.z0)) + pl.setback : Z0 + ss,
      zFront: fz.length ? Math.min(...fz.map((f) => f.z1)) - pl.setback : zFaceAll - ss,
      y0: 0,
      sides: { front: fz.length > 0 || !bz.length || !!sides.back, back: bz.length > 0 || !!sides.back, left: lx.length > 0 || !!sides.left, right: rx.length > 0 || !!sides.right },
    }
    const x0 = X0, x1 = X1
    const prefix = `tram:${tram.id}:`
    if (pl.hardware) {
      try {
        // Un clip a cada pota: les dues del davant de cada mòdul al tram del davant, dues a cada costat i al darrere.
        const alu = aluPlinth(frame, pl.hardware, prefix, moduleNumber, { front: 2 * ms.length, back: 2 * ms.length })
        out.extras.push(...alu.extras.map((p) => ({ ...p, module: moduleNumber })))
        out.linear.push(...alu.pieces)
        if (alu.height > H + 0.5) out.warnings.push({ code: "hardware", message: `«${pl.hardware.name}» fa ${fmtNum(alu.height, 1)} mm d'alçada i les potes ${fmtNum(H, 1)}: no hi cap. Posa les potes a ${fmtNum(alu.height, 1)} mm o més (Moble › Suport general) o tria un sòcol més baix.` })
        else if (H - alu.height > 20) out.warnings.push({ code: "hardware", message: `«${pl.hardware.name}» fa ${fmtNum(alu.height, 1)} mm d'alçada i les potes ${fmtNum(H, 1)}: queda un forat de ${fmtNum(H - alu.height, 1)} mm sota els mòduls. Baixa les potes o tria un sòcol més alt.` })
      } catch (err) {
        out.warnings.push({ code: "hardware", message: `Sòcol: ${err instanceof Error ? err.message : String(err)}. No es fa.` })
      }
    } else {
      const h = roundTo(H - 5, 1)
      if (h <= 0) continue
      const t = pl.thickness ?? first.carcass.thickness
      const f: PlinthFrame = { ...frame, h, t, corners: pl.corners ?? "butt" }
      // Les juntes dels trams llargs, on es toquen dos mòduls (a sobre d'unes potes).
      const joints = tram.modules.map((i) => places[i]!.x).filter((x) => x > x0 + 1 && x < x1 - 1)
      const pieces = woodPlinthPanels(f, pl.material?.trim() || first.carcass.material, prefix).flatMap((p) => splitLong(p, joints))
      // L'entrada d'aire dels electrodomèstics del tram: un retall al sòcol de davant, centrat al compartiment.
      for (const v of vents.filter((v) => tram.modules.includes(v.module))) {
        const m = comp.modules[v.module]!
        const rot = rotOf(v.module)
        // Un mòdul girat 90° no té el front al sòcol de davant: l'entrada d'aire, a mà.
        if (rot === 90 || rot === 270) continue
        const at = (x: number) => places[v.module]!.x + (rot === 180 ? m.carcass.width - x : x)
        const cx = (at(v.x0) + at(v.x1)) / 2
        const w = Math.floor(Math.abs(v.x1 - v.x0) - 2 * VENT_MARGIN)
        const vh = Math.ceil((v.cm2 * 100) / Math.max(1, w))
        const front = pieces.find((p) => p.label.startsWith("Sòcol") && !/darrere|esquerre|dret/.test(p.label) && p.placement.origin[0] - p.length <= cx - w / 2 && p.placement.origin[0] >= cx + w / 2)
        if (front && vh <= front.width - 20) (front.cutouts ??= []).push({ kind: "rect", x: roundTo(front.placement.origin[0] - (cx + w / 2), 1), y: roundTo((front.width - vh) / 2, 1), w, h: vh, tag: "vent" })
        else out.warnings.push({ code: "layout", moduleId: m.id, message: `Cal una entrada d'aire de ${fmtNum(v.cm2, 1)} cm² pel sòcol (${fmtNum(w, 1)} × ${fmtNum(vh, 1)} mm) i no cap al sòcol${front ? ` (${fmtNum(front.width, 1)} mm)` : ""}: fes el sòcol més alt o posa-hi una reixeta (${v.src}).` })
      }
      for (const q of pieces) out.panels.push({ ...q, module: moduleNumber })
      if (f.corners === "mitre" && plinthPieces(f).some((p) => p.mitres.length)) mitreNote = true
    }
    legFeet(out, s, pl.setback, ss, { back: !bz.length && !!sides.back, left: !lx.length && !!sides.left, right: !rx.length && !!sides.right }, ms, pl.hardware ? Number(pl.hardware.params.depth ?? first.carcass.thickness) : (pl.thickness ?? first.carcass.thickness))
  }
  if (mitreNote) out.warnings.push({ code: "mitre", message: "Sòcol a inglet: tall a 45° als extrems dels trams que fan cantonada; encolar-los (o una escaire per dins)." })
  return out
}

/** El tros de sòcol de fusta més llarg (cap al tauler de 2.440 amb els marges, amb la veta al llarg). */
export const PLINTH_MAX_LENGTH = 2400

/**
 * Un tram de sòcol de fusta més llarg que un tauler (`PLINTH_MAX_LENGTH`) es fa a trossos, amb les juntes on es toquen dos
 * mòduls (`joints`, X de la composició; com més lluny millor sense passar-se) o, si no n'hi ha cap que hi vagi bé, a la
 * mida màxima. Els extrems de fora conserven els talls a inglet i els cantells; les juntes són a tope, sense cantell.
 */
function splitLong(p: Panel, joints: number[]): Panel[] {
  if (p.length <= PLINTH_MAX_LENGTH) return [p]
  const { origin: o, xAxis: ax } = p.placement
  // Posició de cada junta al llarg de la peça (eix X local); només les dels trams de davant i del darrere (al llarg d'X).
  const along = Math.abs(ax[0]) > 0.5 ? joints.map((x) => (x - o[0]) * ax[0]).filter((u) => u > 1 && u < p.length - 1).sort((a, b) => a - b) : []
  const cuts: number[] = []
  let at = 0
  while (p.length - at > PLINTH_MAX_LENGTH) {
    const fits = along.filter((u) => u > at + 1 && u - at <= PLINTH_MAX_LENGTH)
    const next = fits.length ? fits[fits.length - 1]! : at + Math.min(PLINTH_MAX_LENGTH, (p.length - at) / 2)
    cuts.push(next)
    at = next
  }
  const bounds = [0, ...cuts, p.length]
  const n = bounds.length - 1
  return bounds.slice(0, -1).map((a, k) => {
    const b = bounds[k + 1]!
    const keep = (side: string) => (side === "left" ? k === 0 : side === "right" ? k === n - 1 : true)
    const { mitres: all, ...rest } = p
    const mitres = all?.filter(keep)
    return {
      ...rest,
      id: `${p.id}-${k + 1}`,
      label: `${p.label} (${k + 1}/${n})`,
      length: roundTo(b - a, 1),
      edges: { ...p.edges, left: p.edges.left && keep("left"), right: p.edges.right && keep("right") },
      ...(mitres?.length ? { mitres } : {}),
      placement: { ...p.placement, origin: [roundTo(o[0] + ax[0] * a, 1), roundTo(o[1] + ax[1] * a, 1), roundTo(o[2] + ax[2] * a, 1)] },
    }
  })
}

/**
 * El peu de les potes (Ø78 de l'AXILO; les genèriques, Ø48) ha de quedar darrere de cada tram del sòcol. El del davant es
 * mesura des del davant de la caixa (la retirada és des de la cara dels fronts: el gruix d'un front recobrent no compta).
 */
function legFeet(out: TramPlinthBuild, s: NonNullable<Composition["support"]>, setback: number, ss: number, sides: { back?: boolean; left?: boolean; right?: boolean }, ms: Composition["modules"], t: number): void {
  // Les potes genèriques només es veuen (no es mecanitzen): només es comprova la pota triada.
  const leg = s.leg?.engine === "leg" ? s.leg.params : undefined
  if (!leg) return
  const inset = (k: string) => Number(leg[k] ?? leg.inset ?? 50)
  const foot = Number(leg.foot ?? 48) / 2
  const front = Math.min(...ms.map((m) => setback - (moduleFrontFace(m) - m.carcass.depth)))
  const check = (label: string, at: number, insetKey: string, from: string) => {
    const legAt = inset(insetKey)
    if (at + t > legAt - foot + 0.5)
      out.warnings.push({ code: "hardware", message: `El sòcol ${label} (a ${fmtNum(at, 1)} mm ${from}) toca el peu de les potes (a ${fmtNum(legAt, 1)} mm, Ø${fmtNum(foot * 2, 1)}): retira'l fins a ${fmtNum(Math.max(0, legAt - foot - t), 1)} mm com a molt o posa les potes més endins.` })
  }
  check("del davant", front, "insetFront", "del davant de la caixa")
  if (sides.back) check("del darrere", ss, "insetBack", "del darrere")
  if (sides.left) check("esquerre", ss, "insetLeft", "del lateral")
  if (sides.right) check("dret", ss, "insetRight", "del lateral")
}
