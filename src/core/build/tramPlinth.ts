import { floorTrams, isApplianceModule, isTurned, moduleFrontFace, tramHeightMismatches, tramSides, type Composition, type ModulePlacement, type Panel } from "../model"
import type { LinearPiece } from "./linearOrders"
import type { VentInlet } from "./module/types"
import { aluPlinth, plinthPieces, woodPlinthPanels, type PlinthFrame } from "./plinth"

/** Marge a cada costat de la reixeta d'entrada d'aire (com la del moble, `appliances.ts`). */
const VENT_MARGIN = 30
const r1 = (v: number) => Math.round(v * 10) / 10
const num = (n: number): string => String(r1(n)).replace(".", ",")

interface TramPlinthBuild {
  panels: Panel[]
  extras: Panel[]
  linear: LinearPiece[]
  warnings: { code: "layout" | "hardware" | "mitre"; message: string; moduleId?: string }[]
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

export function buildTramPlinths(comp: Composition, places: ModulePlacement[], moduleNumber: number, vents: TramVent[] = [], turned: (i: number) => boolean = (i) => isTurned(comp.modules[i]!)): TramPlinthBuild {
  const out: TramPlinthBuild = { panels: [], extras: [], linear: [], warnings: [] }
  const s = comp.support
  if (!s) return out
  const trams = floorTrams(comp, places)
  for (const tram of trams)
    for (const w of tramHeightMismatches(comp, tram, places))
      out.warnings.push({
        code: "layout",
        moduleId: w.module.id,
        message: `«${w.module.name}» arriba a ${num(w.top)} mm del terra i els baixos del costat a ${num(w.expected)} mm: el taulell no quedarà pla. Canvia-li l'alçada a ${num(w.module.carcass.height + w.expected - w.top)} mm.`,
      })
  if (s.kind !== "plinth") return out
  const pl = s.plinth
  const H = s.height
  let mitreNote = false
  for (const tram of trams) {
    const ms = tram.modules.map((i) => comp.modules[i]!)
    const first = ms[0]!
    const x0 = Math.min(...tram.modules.map((i) => places[i]!.x))
    const x1 = Math.max(...tram.modules.map((i) => places[i]!.x + comp.modules[i]!.carcass.width))
    const zBackEdge = Math.min(...tram.modules.map((i) => places[i]!.z ?? 0))
    // La cara dels fronts més endarrerida del tram (mòduls de fondàries diferents: el sòcol, recte, mai per davant de cap
    // front); els electrodomèstics de terra no compten (el seu front de moble s'enrasa amb els del costat).
    const faces = tram.modules.filter((i) => !isApplianceModule(comp.modules[i]!)).map((i) => (places[i]!.z ?? 0) + moduleFrontFace(comp.modules[i]!))
    const zFace = Math.min(...(faces.length ? faces : tram.modules.map((i) => (places[i]!.z ?? 0) + moduleFrontFace(comp.modules[i]!))))
    const sides = tramSides(s, tram, comp)
    const ss = pl.sideSetback ?? pl.setback
    // Els fronts miren enrere (una fila de mòduls girats): el davant del sòcol és el costat de la paret. Una illa (dues
    // files d'esquena, `turned`: el de darrere de cada illa) té fronts als dos costats: el sòcol, retirat dels dos.
    const fwd = tram.modules.filter((i) => !turned(i))
    const bwd = tram.modules.filter((i) => turned(i))
    const back = fwd.length === 0
    const both = fwd.length > 0 && bwd.length > 0
    // La cara dels fronts girats és a la Z petita del mòdul: el sòcol, mai per davant del més endarrerit.
    const bwdFaces = bwd.filter((i) => !isApplianceModule(comp.modules[i]!)).map((i) => places[i]!.z ?? 0)
    const zFaceBwd = Math.max(...(bwdFaces.length ? bwdFaces : bwd.map((i) => places[i]!.z ?? 0)))
    const fwdFaces = fwd.filter((i) => !isApplianceModule(comp.modules[i]!)).map((i) => (places[i]!.z ?? 0) + moduleFrontFace(comp.modules[i]!))
    const zFaceFwd = Math.min(...(fwdFaces.length ? fwdFaces : fwd.map((i) => (places[i]!.z ?? 0) + moduleFrontFace(comp.modules[i]!))))
    const frame = {
      x0: sides.left ? x0 + ss : x0,
      x1: sides.right ? x1 - ss : x1,
      zBack: both ? zFaceBwd + pl.setback : back ? zBackEdge + pl.setback : zBackEdge + ss,
      zFront: both ? zFaceFwd - pl.setback : back ? zFace - ss : zFace - pl.setback,
      y0: 0,
      sides: { front: both || !back ? true : !!sides.back, back: both || back ? true : !!sides.back, left: !!sides.left, right: !!sides.right },
    }
    const prefix = `tram:${tram.id}:`
    if (pl.hardware) {
      try {
        // Un clip a cada pota: les dues del davant de cada mòdul al tram del davant, dues a cada costat i al darrere.
        const alu = aluPlinth(frame, pl.hardware, prefix, moduleNumber, { front: 2 * ms.length, back: 2 * ms.length })
        out.extras.push(...alu.extras.map((p) => ({ ...p, module: moduleNumber })))
        out.linear.push(...alu.pieces)
        if (alu.height > H + 0.5) out.warnings.push({ code: "hardware", message: `«${pl.hardware.name}» fa ${num(alu.height)} mm d'alçada i les potes ${num(H)}: no hi cap. Posa les potes a ${num(alu.height)} mm o més (Moble › Sòcol i potes) o tria un sòcol més baix.` })
        else if (H - alu.height > 20) out.warnings.push({ code: "hardware", message: `«${pl.hardware.name}» fa ${num(alu.height)} mm d'alçada i les potes ${num(H)}: queda un forat de ${num(H - alu.height)} mm sota els mòduls. Baixa les potes o tria un sòcol més alt.` })
      } catch (err) {
        out.warnings.push({ code: "hardware", message: `Sòcol: ${err instanceof Error ? err.message : String(err)}. No es fa.` })
      }
    } else {
      const h = r1(H - 5)
      if (h <= 0) continue
      const t = pl.thickness ?? first.carcass.thickness
      const f: PlinthFrame = { ...frame, h, t, corners: pl.corners ?? "butt" }
      // Les juntes dels trams llargs, on es toquen dos mòduls (a sobre d'unes potes).
      const joints = tram.modules.map((i) => places[i]!.x).filter((x) => x > x0 + 1 && x < x1 - 1)
      const pieces = woodPlinthPanels(f, pl.material?.trim() || first.carcass.material, prefix).flatMap((p) => splitLong(p, joints))
      // L'entrada d'aire dels electrodomèstics del tram: un retall al sòcol de davant, centrat al compartiment.
      for (const v of vents.filter((v) => tram.modules.includes(v.module))) {
        const m = comp.modules[v.module]!
        const at = (x: number) => places[v.module]!.x + (isTurned(m) ? m.carcass.width - x : x)
        const cx = (at(v.x0) + at(v.x1)) / 2
        const w = Math.floor(Math.abs(v.x1 - v.x0) - 2 * VENT_MARGIN)
        const vh = Math.ceil((v.cm2 * 100) / Math.max(1, w))
        const front = pieces.find((p) => p.label.startsWith("Sòcol") && !/darrere|esquerre|dret/.test(p.label) && p.placement.origin[0] - p.length <= cx - w / 2 && p.placement.origin[0] >= cx + w / 2)
        if (front && vh <= front.width - 20) (front.cutouts ??= []).push({ kind: "rect", x: r1(front.placement.origin[0] - (cx + w / 2)), y: r1((front.width - vh) / 2), w, h: vh, tag: "vent" })
        else out.warnings.push({ code: "layout", moduleId: m.id, message: `Cal una entrada d'aire de ${num(v.cm2)} cm² pel sòcol (${num(w)} × ${num(vh)} mm) i no cap al sòcol${front ? ` (${num(front.width)} mm)` : ""}: fes el sòcol més alt o posa-hi una reixeta (${v.src}).` })
      }
      for (const q of pieces) out.panels.push({ ...q, module: moduleNumber })
      if (f.corners === "mitre" && plinthPieces(f).some((p) => p.mitres.length)) mitreNote = true
    }
    legFeet(out, s, pl.setback, ss, both ? { ...sides, back: false } : sides, ms, pl.hardware ? Number(pl.hardware.params.depth ?? first.carcass.thickness) : (pl.thickness ?? first.carcass.thickness))
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
      length: r1(b - a),
      edges: { ...p.edges, left: p.edges.left && keep("left"), right: p.edges.right && keep("right") },
      ...(mitres?.length ? { mitres } : {}),
      placement: { ...p.placement, origin: [r1(o[0] + ax[0] * a), r1(o[1] + ax[1] * a), r1(o[2] + ax[2] * a)] },
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
      out.warnings.push({ code: "hardware", message: `El sòcol ${label} (a ${num(at)} mm ${from}) toca el peu de les potes (a ${num(legAt)} mm, Ø${num(foot * 2)}): retira'l fins a ${num(Math.max(0, legAt - foot - t))} mm com a molt o posa les potes més endins.` })
  }
  check("del davant", front, "insetFront", "del davant de la caixa")
  if (sides.back) check("del darrere", ss, "insetBack", "del darrere")
  if (sides.left) check("esquerre", ss, "insetLeft", "del lateral")
  if (sides.right) check("dret", ss, "insetRight", "del lateral")
}
