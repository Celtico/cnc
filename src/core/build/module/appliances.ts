import {
  DEFAULT_APPLIANCE_PLINTH,
  NO_EDGES,
  applianceFronts,
  doorLikeFront,
  fillsNiche,
  furnitureHinges,
  inRange,
  rangeText,
  standsOnFloor,
  takesFront,
  type Appliance,
  type FrontRange,
  type HardwareItem,
  type Panel,
  type Range,
  type Vec3,
  type Zone,
  type ZoneAppliance,
} from "../../model"
import { X, Y, Z, placement, r, toLocal } from "../geometry"
import { applyHardware, resolveOps } from "../hardware"
import type { ZoneRect } from "../layout"
import { DrawersBuilder } from "./drawers"
import { num } from "./helpers"
import type { HorizontalRef, VerticalRef } from "./types"

/**
 * Densitat per estimar el pes del front de moble i comparar-lo amb el que admet l'aparell (kg/m³): la d'un aglomerat o
 * un DM. **Hipòtesi** (el material de Preferències no en porta): l'avís diu que és una estimació.
 */
const FRONT_DENSITY = 700
/** Gruix del taulell que es suposa per dibuixar la placa quan el taulell no és del mòdul (només per veure-la). */
const WORKTOP_GUESS = 30
/** Marge als costats del retall de ventilació de dalt (mm). */
const VENT_MARGIN = 30

/**
 * **Electrodomèstics** (v46, `Zone.appliance`; `docs/funcional/fabricacio.md` › Electrodomèstics): el compartiment fa de
 * nínxol (o, la placa i la campana, de moble on van). Es comprova el nínxol amb les dades del catàleg (avís `appliance`),
 * es dibuixa l'aparell (rol `hardware`, amb la foto a la cara vista), surt a la comanda amb la marca i la referència, i
 * el **front de moble** es fa i es munta com diu el fabricant: cargolat a la porta de l'aparell (porta fixa, porta sobre
 * porta, rentaplats de porta lliscant: prebroques al darrere, hipòtesi), amb frontisses de moble i la guia lliscant
 * (frigorífic de porta lliscant) o amb les frontisses de l'aparell (rentadora: les cassoletes del catàleg). El que cal
 * mecanitzar al moble (la sortida d'aire dels frigorífics, el retall de la placa i del grup filtrant) es fa a la peça de
 * sobre o de sota si n'hi ha; si no, un avís diu què cal fer i on.
 */
export abstract class AppliancesBuilder extends DrawersBuilder {
  protected applianceCount = 0
  // De la capa de les zones (`Builder`): les peces del voltant d'un compartiment, el lloc del front i la filera System 32.
  protected abstract findBelow(rect: ZoneRect): HorizontalRef | undefined
  protected abstract findAbove(rect: ZoneRect): HorizontalRef | undefined
  protected abstract frontTerritory(rect: ZoneRect, left?: VerticalRef, right?: VerticalRef): ZoneRect
  protected abstract rows(v: VerticalRef, rect: ZoneRect, side: "left" | "right"): number[]

  protected buildAppliance(zone: Zone, za: ZoneAppliance, rect: ZoneRect, left?: VerticalRef, right?: VerticalRef): void {
    const item = za.hardware
    const a = item.appliance
    if (!a) return
    this.applianceCount += 1
    const n = this.applianceCount
    const name = `«${item.maker ? `${item.maker} ${item.ref ?? ""}`.trim() : item.name}»`
    const src = `${a.source.doc}, p. ${a.source.page}`
    const warn = (message: string) => this.warnings.push({ code: "appliance", message, zoneId: zone.id })
    const below = this.findBelow(rect)
    const above = this.findAbove(rect)
    this.order(item, 1, "electrodomèstic: no es fabrica")

    if (fillsNiche(a)) this.checkNiche(a, rect, name, src, warn)
    else if (a.kind === "hood") this.checkCabinet(a, rect, name, src, warn)
    const front = takesFront(a) && za.front !== false
    this.drawAppliance(item, a, rect, n, front, above)
    if (front) this.buildApplianceFront(zone, za, a, rect, n, name, src, warn, below, above, left, right)

    // Ventilació i retalls del moble: el que el catàleg dona.
    const vent = a.ventilation
    if (vent?.outletCm2 && fillsNiche(a)) this.ventOutlet(vent.outletCm2, rect, above, name, src, warn)
    if (vent?.inletCm2) warn(`${name}: entrada d'aire de ${num(vent.inletCm2)} cm² com a mínim pel sòcol (una reixeta al sòcol o el sòcol retirat). No es fa sola: pregunta oberta al taller (${src}).`)
    if (a.cutout) this.applianceCutout(a, rect, a.cutout.at === "top" ? above : below, name, src, warn)
    if (a.kind === "hob" && zone.front?.kind === "drawers") warn(`${name}: amb calaixos a sota, cal deixar com a mínim 65 mm entre el taulell i el calaix i 20 mm de ventilació al darrere (Bosch p. 144).`)
  }

  /** El nínxol (la llum del compartiment) amb les mides del catàleg: ample, alt (en columna o penjat, el que toca) i fons. */
  protected checkNiche(a: Appliance, rect: ZoneRect, name: string, src: string, warn: (m: string) => void): void {
    const w = r(rect.x1 - rect.x0)
    const h = r(rect.y1 - rect.y0)
    const d = r(this.rearDepth(rect))
    const wall = this.m.carcass.base.kind === "wall" && !!a.wallNiche
    const tall = this.d.H >= 1200
    const niche = a.niche
    const hRange = wall ? a.wallNiche!.h : tall && a.tallNicheH ? a.tallNicheH : niche?.h
    const dRange = wall ? a.wallNiche!.d : niche?.d
    if (!niche && !hRange) {
      warn(`${name}: el fabricant no publica el nínxol (${src}). Comprova'l amb el manual d'instal·lació de l'aparell (el compartiment fa ${num(w)} × ${num(h)} × ${num(d)} mm).`)
      return
    }
    const bad: string[] = []
    if (!inRange(w, niche?.w)) bad.push(`${num(w)} mm d'ample (en demana ${rangeText(niche?.w)})`)
    if (!inRange(h, hRange)) bad.push(`${num(h)} mm d'alt (en demana ${rangeText(hRange)}${wall ? " al moble penjat" : tall && a.tallNicheH ? " en columna" : ""})`)
    if (!inRange(d, dRange)) bad.push(`${num(d)} mm de fons (en demana ${rangeText(dRange)})`)
    if (bad.length) warn(`${name}: l'aparell no hi cap com diu el fabricant: el nínxol fa ${bad.join(", ")} (${src}).`)
  }

  /** La campana telescòpica va en un moble penjat de les mides del catàleg (ample i fons del mòdul, alçada interior). */
  protected checkCabinet(a: Appliance, rect: ZoneRect, name: string, src: string, warn: (m: string) => void): void {
    const c = a.cabinet
    if (!c) return
    const bad: string[] = []
    if (!inRange(this.d.W, c.w)) bad.push(`${num(this.d.W)} mm d'ample (en demana ${rangeText(c.w)})`)
    if (!inRange(this.d.D, c.d)) bad.push(`${num(this.d.D)} mm de fons (en demana ${rangeText(c.d)})`)
    if (!inRange(rect.y1 - rect.y0, c.h)) bad.push(`${num(rect.y1 - rect.y0)} mm d'alçada interior (en demana ${rangeText(c.h)})`)
    if (bad.length) warn(`${name}: el moble no és com el demana el fabricant: fa ${bad.join(", ")} (${src}).`)
  }

  /** Fondària útil del compartiment: del fons (o la columna de la casa) al davant de la caixa. */
  protected rearDepth(rect: ZoneRect): number {
    return this.d.D - this.rearAt(rect.x0, rect.x1)
  }

  /**
   * L'aparell, per veure'l (rol `hardware`: no es fabrica ni va al nesting): una caixa de la seva mida centrada a
   * l'ample del compartiment, a sota de tot (la placa, al taulell; la campana, a sota del moble), amb la foto a la cara
   * que es veu. Amb front de moble queda darrere del front (al davant de la caixa); sense, la cara vista enrasada amb els
   * fronts del mòdul.
   */
  protected drawAppliance(item: HardwareItem, a: Appliance, rect: ZoneRect, n: number, front: boolean, above?: HorizontalRef): void {
    const { d } = this
    const { w, h, d: depth } = a.size
    const x0 = (rect.x0 + rect.x1) / 2 - w / 2
    const zFront = a.kind === "hob" ? d.D - Math.max(50, (d.D - depth) / 2) : front || a.kind === "hood" ? d.D : d.frontZ
    // La placa: el vidre 5 mm per sobre del taulell (la peça de sobre o, sense, dalt del mòdul) i el cos a sota.
    const y0 = a.kind === "hob" ? (above ? above.yTop : d.H + WORKTOP_GUESS) + 5 - h : rect.y0
    const p: Panel = {
      id: `appliance-${n}`,
      name: "electrodomèstic",
      label: item.name,
      role: "hardware",
      length: r(w),
      width: r(h),
      thickness: r(depth),
      material: item.material ?? "Acer inox",
      grain: "none",
      edges: { ...NO_EDGES },
      holes: [],
      grooves: [],
      placement: placement([r(x0), r(y0), r(zFront - depth)], X, Y, Z, Z),
      ...(a.image ? { photo: { src: a.image, face: a.kind === "hob" ? ("top" as const) : ("front" as const) } } : {}),
    }
    this.extras.push(p)
  }

  /**
   * El front (o els dos fronts d'un combi) de moble de l'aparell: un front normal (el material dels fronts del mòdul, el
   * tirador del front), de la mida que dona el compartiment (com tots els fronts: `frontTerritory`), amb el sòcol a sota
   * als aparells de terra, i muntat com diu el fabricant.
   */
  protected buildApplianceFront(zone: Zone, za: ZoneAppliance, a: Appliance, rect: ZoneRect, n: number, name: string, src: string, warn: (m: string) => void, below?: HorizontalRef, above?: HorizontalRef, left?: VerticalRef, right?: VerticalRef): void {
    const ter = this.frontTerritory(rect, left, right)
    const floor = standsOnFloor(a) && !below
    const plinth = za.plinth ?? DEFAULT_APPLIANCE_PLINTH
    const y0 = floor ? r(rect.y0 + plinth) : ter.y0
    if (floor && a.plinth && !inRange(plinth, a.plinth)) warn(`${name}: sòcol de ${num(plinth)} mm i el fabricant el demana de ${rangeText(a.plinth)} (${src}).`)
    if (floor) warn(`${name}: el sòcol de davant de l'aparell (${num(plinth)} mm, sota el front) no el fa el mòdul: és el dels mòduls del costat, tallat a mida.`)
    const W = r(ter.x1 - ter.x0)
    const T = r(ter.y1 - y0)
    if (T < 100 || W < 100) {
      warn(`${name}: no hi ha lloc per al front de moble (${num(W)} × ${num(T)} mm).`)
      return
    }
    // Gruix de la base on seu l'aparell (A) i de la peça de sobre (S): les alçades del catàleg dels frigorífics en depenen.
    const A = below ? below.yTop - below.yBottom : 0
    const S = above ? above.yTop - above.yBottom : 0
    const range = (fr: FrontRange | undefined): Range | undefined => fr && { ...(fr.min !== undefined ? { min: fr.min + (fr.plusBase ? A : 0) + (fr.plusTop ? S : 0) } : {}), ...(fr.max !== undefined ? { max: fr.max + (fr.plusBase ? A : 0) + (fr.plusTop ? S : 0) } : {}) }
    // Els fronts de baix a dalt: [y, alçada, nom, rang del catàleg].
    const fronts: { y: number; h: number; key: string; label: string; range?: Range }[] = []
    const f = a.front
    if (applianceFronts(a) === 2) {
      const lo = range(f!.lower)!
      const up = range(f!.upper)!
      const J = f!.joint ?? this.m.fronts.betweenGap
      // El de baix com més curt millor dins del seu rang, perquè el de dalt hi entri (el que sobra).
      const L = r(Math.min(lo.max ?? Infinity, Math.max(lo.min ?? 0, T - J - (up.max ?? Infinity))))
      fronts.push({ y: y0, h: L, key: "lower", label: "Front de baix", range: lo }, { y: r(y0 + L + J), h: r(T - L - J), key: "upper", label: "Front de dalt", range: up })
    } else fronts.push({ y: y0, h: T, key: "", label: "Front", range: range(f?.h) })
    const kindLabel = { dishwasher: "del rentaplats", fridge: "del frigorífic", washer: "de la rentadora" }[a.kind as "dishwasher" | "fridge" | "washer"] ?? "de l'electrodomèstic"
    const hinge = za.hinge ?? "left"
    const doorLike = doorLikeFront(a)
    const handleHw = this.frontHandle(za.handle, zone.id)
    const thick = this.d.t
    if (a.front?.thickness && !inRange(thick, a.front.thickness)) warn(`${name}: front de ${num(thick)} mm de gruix i el fabricant el demana de ${rangeText(a.front.thickness)} (${src}).`)
    let kg = 0
    for (const fr of fronts) {
      const label = `${fr.label} ${kindLabel}`
      const id = doorLike ? `appliance-${n}${fr.key ? `-${fr.key}` : ""}-door-${hinge}` : `appliance-${n}${fr.key ? `-${fr.key}` : ""}-flap`
      const p = this.frontPanel(id, doorLike ? "porta electrodomèstic" : "front electrodomèstic", label, doorLike ? "door" : "flap", ter.x0, fr.y, W, fr.h)
      if (fr.range && !inRange(fr.h, fr.range)) warn(`${name}: ${label.toLowerCase()} fa ${num(fr.h)} mm d'alt i el fabricant l'admet de ${rangeText(fr.range)} (${src}). Canvia l'alçada del mòdul o el sòcol.`)
      kg = Math.max(kg, (fr.h * W * thick * FRONT_DENSITY) / 1e9)
      this.mountApplianceFront(p, za, a, rect, fr.y, n, name, src, warn, hinge, left, right)
      // Tirador: com una porta (vertical, a mitja alçada, al costat que obre) o com un abatible (horitzontal, a dalt).
      if (handleHw.push) this.handle(p, fr.h / 2, 0, "x", handleHw, zone.id)
      else if (doorLike) this.handle(p, fr.h / 2, hinge === "left" ? W - handleHw.spec.inset : handleHw.spec.inset, "x", handleHw, zone.id)
      else this.handle(p, fr.h - Math.min(handleHw.spec.inset, fr.h / 2), W / 2, "y", handleHw, zone.id)
    }
    const wk = a.front?.weightKg
    if (wk && !inRange(kg, wk)) warn(`${name}: el front pesa uns ${num(kg)} kg (estimat amb un tauler de ${FRONT_DENSITY} kg/m³) i el fabricant l'admet de ${rangeText(wk, "kg")} (${src}).`)
  }

  /**
   * Com es munta el front a l'aparell (per decisió de l'usuari, 2026-10-15: «com diu el fabricant»): les prebroques de la
   * fixació a la porta de l'aparell, les frontisses de moble i la guia lliscant, o les cassoletes de les frontisses de
   * l'aparell (rentadora). Coordenades del front: x = alçada des de baix, y = ample des de l'esquerra; cara A = darrere.
   */
  protected mountApplianceFront(p: Panel, za: ZoneAppliance, a: Appliance, rect: ZoneRect, frontY: number, n: number, name: string, src: string, warn: (m: string) => void, hinge: "left" | "right", left?: VerticalRef, right?: VerticalRef): void {
    const item = za.hardware
    const P = item.params
    const L = p.length
    const W = p.width
    const first = p.id === `appliance-${n}-door-${hinge}` || p.id === `appliance-${n}-flap` || p.id.includes("-lower-")
    const op = (() => {
      try {
        return resolveOps(item, "front")[0]
      } catch {
        return undefined
      }
    })()
    const pilot = (x: number, y: number) => {
      if (!op || op.kind !== "drill" || x < op.d || x > L - op.d || y < op.d || y > W - op.d) return false
      p.holes.push({ x: r(x), y: r(y), diameter: op.d, depth: Math.min(op.depth, p.thickness - 1), face: "A", tag: op.tag ?? "appliance" })
      return true
    }
    if (a.door === "hinges") {
      // Rentadora: les cassoletes del catàleg, des del cantell de dalt de l'aparell (que seu a baix del compartiment).
      const top = rect.y0 + a.size.h
      const ys = [top - (P.firstHinge ?? 202), top - (P.firstHinge ?? 202) - (P.hingePitch ?? 338.6)]
      let made = 0
      for (const y of ys) {
        const x = r(y - frontY)
        if (x < 30 || x > L - 30) continue
        p.holes.push(...applyHardware(item, "front", {}, { at: { x, y: 0 }, ...(hinge === "left" ? {} : { mirrorY: W }) }).holes)
        made += 1
      }
      if (made < ys.length) warn(`${name}: només hi caben ${made} de ${ys.length} cassoletes de les frontisses de l'aparell al front (${src}).`)
      if (first) warn(`${name}: el front penja de les frontisses de l'aparell (les cassoletes del catàleg: Ø${num(P.cupDiameter ?? 35)} × ${num(P.cupDepth ?? 12)} a ${num(P.cupOffset ?? 21)} mm del cantell, la primera a ${num(P.firstHinge ?? 202)} mm de dalt de l'aparell). El catàleg no dona el nínxol ni l'alçada del front: comprova-ho amb el manual (${src}).`)
      return
    }
    if (furnitureHinges(a)) {
      // Frigorífic de porta lliscant: frontisses de moble (les del mòdul) al lateral o divisor del costat, amb la seva filera.
      const side = hinge === "left" ? left : right
      if (!side) {
        if (first) warn(`${name}: el front penja de frontisses de moble i al costat ${hinge === "left" ? "esquerre" : "dret"} no hi ha cap lateral ni divisor: no es fan les cassoletes.`)
      } else {
        const rows = this.rows(side, rect, hinge)
        this.addCups(p, L, hinge, W, rows, frontY, undefined, this.kit.hinge, side)
      }
      // La guia lliscant (hipòtesi): centrada, al cantell que obre.
      const gy = hinge === "left" ? W - (P.guideEdge ?? 40) : (P.guideEdge ?? 40)
      const pitch = P.guidePitch ?? 32
      for (const k of [-1, 0, 1]) pilot(L / 2 + k * pitch, gy)
      if (first) warn(`${name}: el front penja de frontisses de moble i s'uneix a la porta de l'aparell amb una guia lliscant. La quantitat de frontisses i la posició de la guia no surten al catàleg: les prebroques de la guia són una hipòtesi (centrada, a ${num(P.guideEdge ?? 40)} mm del cantell que obre); comprova-les amb la plantilla de l'aparell (${src}).`)
      return
    }
    // Porta fixa, porta sobre porta i rentaplats de porta lliscant: el front es cargola a la porta de l'aparell (sense
    // frontisses de moble). La plantilla ve amb l'aparell: 4 prebroques d'hipòtesi per front.
    const cy = (rect.x0 + rect.x1) / 2 - (p.placement.origin[0])
    const half = Math.max(10, a.size.w / 2 - (P.fixInset ?? 50))
    let made = 0
    for (const x of [L - (P.fixTop ?? 40), P.fixBottom ?? 60]) for (const y of [cy - half, cy + half]) if (pilot(x, y)) made += 1
    if (first)
      warn(`${name}: el front es cargola a la porta de l'aparell${a.door === "sliding" ? " (porta lliscant: el front llisca respecte d'ella en obrir)" : ""}, sense frontisses de moble. La plantilla dels cargols ve amb l'aparell i el catàleg no la dona: les ${made} prebroques del darrere del front són una hipòtesi (a ${num(P.fixInset ?? 50)} mm dels costats de l'aparell, a ${num(P.fixTop ?? 40)} mm de dalt i a ${num(P.fixBottom ?? 60)} mm de baix). Comprova-les amb la plantilla abans de mecanitzar (${src}).`)
  }

  /**
   * Sortida d'aire dels frigorífics (el catàleg: ≥ 200 cm² per dalt al darrere): un retall a la peça de sobre del
   * compartiment, de lateral a lateral (menys `VENT_MARGIN`), arran del fons, prou fondo per a l'àrea. Sense peça a sobre,
   * l'aire ja surt (res a fer).
   */
  protected ventOutlet(cm2: number, rect: ZoneRect, above: HorizontalRef | undefined, name: string, src: string, warn: (m: string) => void): void {
    if (!above) return
    const w = rect.x1 - rect.x0 - 2 * VENT_MARGIN
    const depth = Math.ceil((cm2 * 100) / Math.max(1, w))
    // A 5 mm del cantell de darrere de la peça (un retall que hi toqués seria una osca).
    const z0 = Math.max(above.zRear, this.d.backInnerZ) + 5
    const ok = this.cutRect(above.panel, [rect.x0 + VENT_MARGIN, above.yBottom, z0], [rect.x1 - VENT_MARGIN, above.yBottom, z0 + depth], "vent")
    if (ok) warn(`${name}: sortida d'aire de ${num(cm2)} cm² com a mínim per dalt al darrere: retall de ${num(w)} × ${num(depth)} mm a la peça de sobre («${above.panel.label}»), arran del fons (${src}).`)
    else warn(`${name}: cal una sortida d'aire de ${num(cm2)} cm² per dalt al darrere i el retall no cap a la peça de sobre («${above.panel.label}»): fes-la a mà (${src}).`)
  }

  /**
   * El retall de la placa (al taulell: la peça de sobre) o del grup filtrant (a la base del moble penjat: la de sota),
   * centrat a l'ample del compartiment i a `fromFront` del cantell de davant. Sense la peça, l'avís diu la mida.
   */
  protected applianceCutout(a: Appliance, rect: ZoneRect, host: HorizontalRef | undefined, name: string, src: string, warn: (m: string) => void): void {
    const c = a.cutout!
    const w = c.w.min ?? c.w.max!
    const dd = c.d.min ?? c.d.max!
    const where = c.at === "top" ? "al taulell" : "a la base del moble"
    const size = `${rangeText(c.w)} × ${rangeText(c.d)}`
    if (!host) {
      warn(`${name}: retall ${where} de ${size}, a ${num(c.fromFront ?? 0)} mm o més del cantell de davant. ${c.at === "top" ? "El taulell" : "La base"} no és del mòdul: fes-lo a la peça on vagi (${src}).`)
      return
    }
    const t = host.yTop - host.yBottom
    if (c.board && !inRange(t, c.board)) warn(`${name}: «${host.panel.label}» de ${num(t)} mm de gruix i el fabricant demana ${rangeText(c.board)} (${src}).`)
    const cx = (rect.x0 + rect.x1) / 2
    const zFront = host.zFront - (c.fromFront ?? 0)
    const y = c.at === "top" ? host.yTop : host.yBottom
    if (c.at === "top" && zFront - dd - host.zRear < 40) warn(`${name}: el retall queda a menys de 40 mm del darrere ${where} (el fabricant en demana 40).`)
    if (this.cutRect(host.panel, [cx - w / 2, y, zFront - dd], [cx + w / 2, y, zFront], "appliance")) warn(`${name}: retall de ${num(w)} × ${num(dd)} mm${c.w.max !== c.w.min || c.d.max !== c.d.min ? ` (el fabricant: ${size})` : ""} ${where}, a ${num(c.fromFront ?? 0)} mm del cantell de davant (${src}).`)
    else warn(`${name}: el retall de ${size} no cap ${where} («${host.panel.label}»): fes-lo a mà (${src}).`)
  }

  /** Un retall rectangular passant entre dos punts del mòdul (al pla de la peça); fora de la peça, no es fa. */
  protected cutRect(p: Panel, a: Vec3, b: Vec3, tag: string): boolean {
    const la = toLocal(p, a)
    const lb = toLocal(p, b)
    const x0 = Math.min(la[0], lb[0]), x1 = Math.max(la[0], lb[0])
    const y0 = Math.min(la[1], lb[1]), y1 = Math.max(la[1], lb[1])
    if (x0 < 1 || y0 < 1 || x1 > p.length - 1 || y1 > p.width - 1 || x1 - x0 < 1 || y1 - y0 < 1) return false
    ;(p.cutouts ??= []).push({ kind: "rect", x: r(x0), y: r(y0), w: r(x1 - x0), h: r(y1 - y0), tag })
    return true
  }
}
