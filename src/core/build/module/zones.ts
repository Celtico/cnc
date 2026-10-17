import { type CableHole, NO_EDGES, type EdgeBanding, type Front, type Panel, type PanelRole, type Vec3, type Zone } from "../../model"
import { X, Y, Z, addFaceHole, dowelJoint, dowelsAlong, neg, placement, r, snap, system32Ys, threeAlong, toLocal } from "../geometry"
import { layoutZones, type Layout, type ZoneRect } from "../layout"
import { AppliancesBuilder } from "./appliances"
import { num, edges, near } from "./helpers"
import type { VerticalRef, HorizontalRef } from "./types"

/** Zones: divisors, prestatges, fileres, fronts de cada zona i passacables. Última capa del constructor. */
export class Builder extends AppliancesBuilder {
  // --- Zones ------------------------------------------------------------------------

  buildZones(): Layout {
    const { m, d } = this
    const layout = layoutZones(m.root, d.interior, d.t)
    for (const p of layout.problems) this.warnings.push({ code: "layout", message: p })

    // Zones que queden darrere del front d'una zona pare (portes d'armari de dalt a baix).
    const walk = (z: Zone, cover: Front | undefined) => {
      this.zones.set(z.id, z)
      if (cover) {
        this.covered.add(z.id)
        this.coverFront.set(z.id, cover)
      }
      if (z.split) for (const c of z.split.children) walk(c, cover ?? z.front)
    }
    walk(m.root, undefined)

    // 1) Divisors i prestatges fixos de totes les divisions, amb la folgança de les peces de dins: més curts, centrats.
    layout.dividers.forEach((div, i) => {
      const cut = this.insetCut(div.parentId)
      const gap = this.innerGap()
      if (div.dir === "v") this.buildDivider(div.at, div.from, div.to, `divider-${i + 1}`, cut, gap)
      else this.buildFixedShelf(div.at, div.from, div.to, `fixed-${i + 1}`, cut, gap)
    })
    // 2) Unions dels divisors amb el que tenen a sota i a sobre, i dels fixos amb els costats.
    for (const v of this.verticals) if (!v.outer) this.joinDivider(v)
    for (const h of this.horizontals) if (!h.outer) this.joinFixedShelf(h)
    // 3) Fulles: fileres, prestatges regulables i fronts. Les que són darrere del front d'una
    // zona dividida no en fan: el front és el del pare.
    for (const zone of layout.leaves) this.buildLeaf(this.covered.has(zone.id) ? { ...zone, front: undefined } : zone, layout.rects.get(zone.id)!)
    const parents = (z: Zone) => {
      if (!z.split) return
      if (z.front && !this.covered.has(z.id)) this.buildParentFront(z, layout.rects.get(z.id)!)
      z.split.children.forEach(parents)
    }
    parents(m.root)

    // 4) Passacables i extres.
    for (const hole of m.extras.cableHoles) this.cableHole(hole)
    if (d.mitreFronts)
      this.warnings.push({ code: "mitre", message: "Fronts dels calaixos a inglet amb els laterals: els laterals arriben fins a la cara dels fronts i tots dos es tallen a 45°. Cal un joc de 1–2 mm al tall perquè el calaix obri." })
    return layout
  }

  /**
   * Fondària que perd un divisor o un prestatge fix de la zona `parentId` quan un front encastat
   * (el de la zona o el d'una zona pare) el tapa: el front entra un gruix dins de la llum.
   */
  protected insetCut(parentId: string): number {
    const { m, d } = this
    const z = this.zones.get(parentId)
    return d.inset && (!!z?.front || this.covered.has(parentId)) ? d.t + m.fronts.outerGap : 0
  }


  protected buildDivider(x: number, yFrom: number, yTo: number, id: string, cut = 0, gap = 0): void {
    const { m, d } = this
    const t = d.t
    const e = gap / 2
    const panel = this.add(
      this.basePanel(id, "divisor", "Divisor", "divider", yTo - yFrom - gap, d.availDepth - cut, t, m.carcass.material, "x", edges("top", ...this.innerRearEdge("bottom")), placement([x, yFrom + e, d.backInnerZ], Y, Z, X, Z)),
    )
    this.verticals.push({ panel, xL: x, xR: x + t, yB: yFrom, yT: yTo, zRear: d.backInnerZ, zFront: d.D - cut, outer: false, ...(e ? { endGap: e } : {}) })
  }

  protected buildFixedShelf(y: number, xFrom: number, xTo: number, id: string, cut = 0, gap = 0): void {
    const { m, d } = this
    const t = d.t
    const e = gap / 2
    const zFront = d.D - cut
    const panel = this.add(
      this.basePanel(id, "estanter fixe", "Prestatge fix", "fixedShelf", xTo - xFrom - gap, d.availDepth - cut, t, m.carcass.material, "x", edges("bottom", ...this.innerRearEdge("top")), placement([xFrom + e, y, zFront], X, neg(Z), Y, Z)),
    )
    this.horizontals.push({ panel, yBottom: y, yTop: y + t, xL: xFrom, xR: xTo, outer: false, zRear: d.backInnerZ, zFront, ...(e ? { endGap: e } : {}) })
  }

  protected findBelow(rect: ZoneRect): HorizontalRef | undefined {
    return this.horizontals.find((h) => near(h.yTop, rect.y0) && h.xL <= rect.x0 + 0.51 && h.xR >= rect.x1 - 0.51)
  }
  protected findAbove(rect: ZoneRect): HorizontalRef | undefined {
    return this.horizontals.find((h) => near(h.yBottom, rect.y1) && h.xL <= rect.x0 + 0.51 && h.xR >= rect.x1 - 0.51)
  }
  protected findLeft(rect: ZoneRect): VerticalRef | undefined {
    return this.verticals.find((v) => near(v.xR, rect.x0) && v.yB <= rect.y0 + 0.51 && v.yT >= rect.y1 - 0.51)
  }
  protected findRight(rect: ZoneRect): VerticalRef | undefined {
    return this.verticals.find((v) => near(v.xL, rect.x1) && v.yB <= rect.y0 + 0.51 && v.yT >= rect.y1 - 0.51)
  }

  /**
   * Espigues entre un divisor o un prestatge fix i la peça on topa: repartides sobre el tram de fondària que tenen en
   * comú (la tapa amb ranura d'aire comença després de la ranura; un prestatge fix tapat per un front encastat és més
   * curt). Si el tram és massa curt per a tres, dues o una (`dowelsAlong`).
   */
  protected sharedDowelZs(z0: number, z1: number): number[] {
    const dw = this.hw.dowel
    if (z1 - z0 >= 2 * dw.endOffset + dw.diameter) return threeAlong(z0, z1, dw.endOffset)
    return dowelsAlong(z0, z1, Math.min(dw.endOffset, (z1 - z0) / 4), dw.diameter)
  }

  protected joinDivider(v: VerticalRef): void {
    const xMid = (v.xL + v.xR) / 2
    const rect: ZoneRect = { x0: v.xL, x1: v.xR, y0: v.yB, y1: v.yT }
    const below = this.findBelow(rect)
    const above = this.findAbove(rect)
    for (const [h, y, dir] of [[below, v.yB, 1], [above, v.yT, -1]] as const) {
      if (!h) continue
      const zs = this.sharedDowelZs(Math.max(v.zRear, h.zRear), Math.min(v.zFront, h.zFront))
      // Folgança de les peces de dins: el cantell del divisor s'atura abans de la cara (el forat de cara no es mou).
      dowelJoint(v.panel, h.panel, zs.map((z): Vec3 => [xMid, y, z]), this.hw.dowel, this.hw.dowel.tag, v.endGap ? [0, dir * v.endGap, 0] : undefined)
    }
  }

  protected joinFixedShelf(h: HorizontalRef): void {
    const yMid = (h.yBottom + h.yTop) / 2
    const rect: ZoneRect = { x0: h.xL, x1: h.xR, y0: h.yBottom, y1: h.yTop }
    const left = this.findLeft(rect)
    const right = this.findRight(rect)
    for (const [v, x, dir] of [[left, h.xL, 1], [right, h.xR, -1]] as const) {
      if (!v) continue
      const zs = this.sharedDowelZs(Math.max(v.zRear, h.zRear), Math.min(v.zFront, h.zFront))
      dowelJoint(h.panel, v.panel, zs.map((z): Vec3 => [x, yMid, z]), this.hw.dowel, this.hw.dowel.tag, h.endGap ? [dir * h.endGap, 0, 0] : undefined)
    }
  }

  /** Filera System 32 sobre la cara d'un panell vertical, per al tram d'una zona. */
  protected rows(v: VerticalRef, rect: ZoneRect, side: "left" | "right"): number[] {
    const s = this.hw.system32
    const ys = system32Ys(rect.y0, rect.y1, s.edgeOffset, s.pitch)
    const xFace = side === "left" ? v.xR : v.xL
    // Fons encastat retirat: la filera de darrere es mesura des del darrere del fons, però mai dins del fons (gruixos de 30
    // o 40): com a molt a prop, a un Ø de la seva cara de davant.
    const c = this.m.carcass
    const zFront = v.zFront - s.edgeOffset
    const zBack = c.back === "inset" ? Math.max(Math.max(v.zRear, c.backInsetSetback ?? 0) + s.edgeOffset, this.d.backInnerZ + s.diameter) : v.zRear + s.edgeOffset
    // Si la de darrere arribaria a la de davant (mòdul massa poc fondo), només la de davant (la de les frontisses).
    const rear = zBack <= zFront - s.diameter
    for (const y of ys) {
      addFaceHole(v.panel, [xFace, y, zFront], s.hole)
      if (rear) addFaceHole(v.panel, [xFace, y, zBack], s.hole)
    }
    return ys
  }

  protected buildLeaf(zone: Zone, rect: ZoneRect): void {
    const { d } = this
    const left = this.findLeft(rect)
    const right = this.findRight(rect)
    const front = zone.front
    // Una porta de vidre no porta filera (per decisió de l'usuari, 2026-10-14: «res de sistemes, només els forats dels
    // ferratges»): la placa de la frontissa fa els seus forats sola.
    const woodDoor = front?.kind === "door" && !front.glass
    const hingeSide = woodDoor ? front.hinge : front?.kind === "grille" && front.mount === "hinged" ? front.hinge : null

    // Fileres: per prestatges regulables (als dos costats) i per frontisses (al seu costat).
    let ysLeft: number[] = []
    let ysRight: number[] = []
    const wantsLeft = (zone.shelves?.adjustable ?? false) || hingeSide === "left" || (woodDoor && front.mode === "double")
    const wantsRight = (zone.shelves?.adjustable ?? false) || hingeSide === "right" || (woodDoor && front.mode === "double")
    if (wantsLeft) {
      if (left) ysLeft = this.rows(left, rect, "left")
      else this.warnings.push({ code: "no-side", message: `La zona no té panell a l'esquerra per a la filera System 32.`, zoneId: zone.id })
    }
    if (wantsRight) {
      if (right) ysRight = this.rows(right, rect, "right")
      else this.warnings.push({ code: "no-side", message: `La zona no té panell a la dreta per a la filera System 32.`, zoneId: zone.id })
    }
    // Només qui llegeix la filera (portes, reixetes, prestatges regulables) la necessita: als calaixos i als compartiments
    // oberts no es toca el System 32 (res amagat compta: un item dolent al lloc no avisa si no es fa servir).
    const needsRows = (zone.shelves?.adjustable ?? false) || woodDoor || (front?.kind === "grille" && front.mount === "hinged")
    const rowYs = ysLeft.length ? ysLeft : ysRight.length ? ysRight : needsRows ? system32Ys(rect.y0, rect.y1, this.hw.system32.edgeOffset, this.hw.system32.pitch) : []

    // Calaixos interiors (a baix de tot, darrere de la porta): els prestatges es reparteixen per sobre.
    let shelfRect = rect
    if (zone.innerDrawers) {
      const cover = front ?? this.coverFront.get(zone.id)
      const hinges = new Set<"left" | "right">()
      if (cover?.kind === "door") {
        if (cover.mode === "double") hinges.add("left").add("right")
        else hinges.add(cover.hinge)
      }
      const top = this.buildInnerDrawers(zone, zone.innerDrawers, rect, left, right, hinges)
      shelfRect = { ...rect, y0: Math.min(rect.y1, top) }
    }
    // Prestatges.
    const shelfYs = zone.shelves && zone.shelves.n > 0 ? this.buildShelves(zone, shelfRect, rowYs.filter((y) => y >= shelfRect.y0)) : []
    if (zone.rail) this.buildRail(zone, rect)
    if (zone.led) this.buildLed(zone, rect, shelfYs)
    // Electrodomèstic (v46): el nínxol, l'aparell i el seu front de moble (o, la placa i la campana, el retall).
    if (zone.appliance) this.buildAppliance(zone, zone.appliance, rect, left, right)

    // Front.
    if (!front) return
    this.buildFront(zone, front, rect, left, right, rowYs)
    void d
  }

  /**
   * Front d'una zona dividida (p. ex. les portes d'un armari que tapen el penjador i el
   * maleter): cobreix tota la zona; les fulles de dins queden darrere.
   */
  protected buildParentFront(zone: Zone, rect: ZoneRect): void {
    const front = zone.front!
    const left = this.findLeft(rect)
    const right = this.findRight(rect)
    // Com a les fulles: filera System 32 al costat de les frontisses (hi va la placa), però
    // només als trams lliures entre els prestatges fixos que hi toquen (els mateixos trams que
    // les fulles: els forats coincideixen i no en trepitgen cap altre).
    // Les portes de vidre, sense filera (només els forats de la placa, `glassHinges`).
    const woodDoor = front.kind === "door" && !front.glass
    const hingeSide = woodDoor ? front.hinge : front.kind === "grille" && front.mount === "hinged" ? front.hinge : null
    const double = woodDoor && front.mode === "double"
    let ys: number[] = []
    for (const side of ["left", "right"] as const) {
      if (hingeSide !== side && !double) continue
      const ref = side === "left" ? left : right
      if (ref) {
        const xFace = side === "left" ? ref.xR : ref.xL
        const cuts = this.horizontals
          .filter((h) => !h.outer && near(side === "left" ? h.xL : h.xR, xFace) && h.yBottom > rect.y0 - 0.51 && h.yTop < rect.y1 + 0.51)
          .sort((a, b) => a.yBottom - b.yBottom)
        const got: number[] = []
        let y0 = rect.y0
        for (const y1 of [...cuts.map((h) => h.yBottom), rect.y1]) {
          if (y1 - y0 > 0.5) got.push(...this.rows(ref, { ...rect, y0, y1 }, side))
          y0 = cuts.find((h) => h.yBottom === y1)?.yTop ?? y1
        }
        if (!ys.length) ys = got
      } else this.warnings.push({ code: "no-side", message: `La zona no té panell a la ${side === "left" ? "esquerra" : "dreta"} per a la filera System 32.`, zoneId: zone.id })
    }
    const needsRows = woodDoor || (front.kind === "grille" && front.mount === "hinged")
    this.buildFront(zone, front, rect, left, right, ys.length ? ys : needsRows ? system32Ys(rect.y0, rect.y1, this.hw.system32.edgeOffset, this.hw.system32.pitch) : [])
  }

  protected buildFront(zone: Zone, front: Front, rect: ZoneRect, left: VerticalRef | undefined, right: VerticalRef | undefined, rowYs: number[]): void {
    const territory = this.frontTerritory(rect, left, right)
    switch (front.kind) {
      case "door":
        this.buildDoors(zone, front, territory, rowYs, left, right)
        break
      case "drawers":
        this.buildDrawers(zone, front, rect, territory, left, right)
        break
      case "flap":
        this.buildFlap(zone, front, territory, left, right)
        break
      case "grille":
        this.buildGrille(zone, front, rect, territory, left, right, rowYs)
        break
      case "panel":
        this.buildFrontPanel(zone, territory, "panel", "frontal fix", "Front fix")
        break
    }
  }

  /** Posa els prestatges i torna on és la cara de sota de cadascun (per a la llum LED). */
  protected buildShelves(zone: Zone, rect: ZoneRect, rowYs: number[]): number[] {
    const { m, d } = this
    const c = m.carcass
    const n = zone.shelves!.n
    const t = d.t
    // Gruix aparent (prestatges buits): cal lloc per a dues pells i un llistó.
    const want = zone.shelves!.thickness
    const T = want && want >= 2 * t + 6 ? want : t
    const hollow = T > t
    if (want && !hollow) this.warnings.push({ code: "hollow", message: `Prestatges de ${want} mm: amb tauler de ${t} cal un gruix d'almenys ${2 * t + 6} mm. Es fan massissos.`, zoneId: zone.id })
    const width = rect.x1 - rect.x0
    // Prestatges fixos (sense «Regulables») d'un mòdul dividit: també la folgança de les peces de dins.
    const inner = zone.shelves!.adjustable ? 0 : this.innerGap()
    const length = width - c.shelfClearance - inner
    // A ras del davant (a sang): sense retranqueig. Amb fronts encastats no hi cabria la porta.
    // Amb fronts encastats, a ras només es pot si el compartiment és obert (sense front).
    const blocked = d.inset && (!!zone.front || this.covered.has(zone.id))
    const flush = !!zone.shelves!.flush && !blocked
    if (zone.shelves!.flush && blocked) this.warnings.push({ code: "inset", message: "Prestatges a ras del davant amb fronts encastats: toparien amb el front. Es retiren com sempre.", zoneId: zone.id })
    // El del compartiment (si en té) o el del mòdul; i, amb un pistó d'abatible al lateral, prou retirats per no tocar-lo.
    const own = flush ? 0 : (zone.shelves!.setback ?? c.shelfSetback)
    const strut = this.strutClearance(zone)
    const setback = strut !== undefined && own < strut ? strut : own
    if (setback !== own) this.warnings.push({ code: "shelf-strut", message: `Prestatges retirats ${num(setback)} mm del davant (en lloc de ${num(own)}) perquè no toquin el pistó de l'abatible al lateral.`, zoneId: zone.id })
    if (setback !== c.shelfSetback && !flush) this.shelfSetbackOf.set(zone.id, setback)
    // El del mòdul ja ho avisa (`carcass.ts`); el propi, aquí.
    if (zone.shelves!.setback !== undefined && blocked && setback < d.t) this.warnings.push({ code: "inset", message: `Prestatges retirats ${num(setback)} mm i el front encastat entra ${num(d.t)} mm: hi toparien. Retira'ls almenys ${num(d.t)} mm (Opcions de l'interior › Retranqueig).`, zoneId: zone.id })
    const depth = d.availDepth - setback
    const innerH = rect.y1 - rect.y0
    const gap = (innerH - n * T) / (n + 1)
    if (width > 800 && t <= 19 && !hollow) {
      this.warnings.push({ code: "shelf-span", message: `Prestatge de ${num(t)} mm amb una llum de ${num(width)} mm: es vinclarà (màxim recomanat 800).`, zoneId: zone.id })
    }
    const x0 = rect.x0 + (c.shelfClearance + inner) / 2
    const zF = d.D - setback
    // On va cada prestatge. Regulables: a la filera més propera que no trepitgi cap altre prestatge (si no n'hi ha cap
    // de lliure, no es fa). Fixos: si no hi caben amb 10 mm entre ells, només els que hi caben.
    const ys: number[] = []
    if (zone.shelves!.adjustable && rowYs.length) {
      for (let k = 1; k <= n; k++) {
        const target = rect.y0 + k * gap + (k - 1) * T
        const free = rowYs.filter((ry) => ry + T <= rect.y1 + 0.01 && ys.every((u) => Math.abs(u - ry) >= T + 1))
        if (free.length) ys.push(snap(target, free))
      }
      ys.sort((a, b) => a - b)
    } else {
      const fit = Math.max(0, Math.min(n, Math.floor((innerH - 10) / (T + 10))))
      const g = (innerH - fit * T) / (fit + 1)
      for (let k = 1; k <= fit; k++) ys.push(r(rect.y0 + k * g + (k - 1) * T))
    }
    if (ys.length < n)
      this.warnings.push({
        code: "shelves",
        message: `Hi caben ${ys.length} de ${n} prestatges ${zone.shelves!.adjustable ? "regulables (cada un en una filera lliure sense trepitjar-ne cap altre)" : "(amb almenys 10 mm entre ells)"} en ${num(innerH)} mm: se'n fan ${ys.length}.`,
        zoneId: zone.id,
      })
    for (const y of ys) {
      this.shelfCount += 1
      const idx = this.shelfCount
      const nm = this.shelfCount === 1 && n === 1 ? "Prestatge" : `Prestatge ${idx}`
      const code = this.shelfCount === 1 && n === 1 ? "estanter" : `estanter ${idx}`
      if (!hollow) {
        this.add(this.basePanel(`shelf-${idx}`, code, nm, "shelf", length, depth, t, c.material, "x", edges("bottom", ...this.innerRearEdge("top")), placement([x0, y, zF], X, neg(Z), Y, Z)))
        continue
      }
      // Prestatge buit: pell de baix i de dalt, tira al davant i llistons (darrere i extrems).
      const assembly = `${nm} (buit)`
      const piece = (id: string, label: string, role: PanelRole, L: number, Wd: number, eb: EdgeBanding, pl: Panel["placement"]) =>
        this.add({ ...this.basePanel(id, code, label, role, L, Wd, t, c.material, "x", eb, pl), assembly })
      const skinD = depth - t
      piece(`shelf-${idx}`, `${nm} (pell de baix)`, "shelf", length, skinD, { ...NO_EDGES }, placement([x0, y, zF - t], X, neg(Z), Y, Z))
      piece(`shelf-${idx}-top`, `${nm} (pell de dalt)`, "shelf", length, skinD, { ...NO_EDGES }, placement([x0, y + T - t, zF - t], X, neg(Z), Y, Z))
      piece(`shelf-${idx}-facing`, `${nm} (tira del davant)`, "facing", length, T, edges("bottom", "top", "left", "right"), placement([x0, y, zF - t], X, Y, Z, Z))
      const zBack = zF - depth
      piece(`shelf-${idx}-spacer-back`, `${nm} (llistó del darrere)`, "spacer", length, T - 2 * t, { ...NO_EDGES }, placement([x0, y + t, zBack], X, Y, Z, neg(Z)))
      for (const [end, x] of [["left", x0], ["right", x0 + length - t]] as const)
        piece(`shelf-${idx}-spacer-${end}`, `${nm} (llistó ${end === "left" ? "esquerre" : "dret"})`, "spacer", depth - 2 * t, T - 2 * t, { ...NO_EDGES }, placement([x, y + t, zF - t], neg(Z), Y, X, end === "left" ? neg(X) : X))
    }
    return ys
  }

  /**
   * Retranqueig mínim dels prestatges d'un compartiment amb un **pistó de gas** d'abatible (el seu front o el de la zona que
   * el tapa; item amb `strutG`, obre amunt): el pistó va a `sideSetback` del darrere del front (`gasStrut`), Ø15,6, i el
   * prestatge ha de quedar-ne 2 mm per darrere. Sense pistó, `undefined`.
   */
  protected strutClearance(zone: Zone): number | undefined {
    const { d } = this
    const f = zone.front ?? this.coverFront.get(zone.id)
    if (f?.kind !== "flap" || f.dir !== "up") return undefined
    const item = f.hardware ?? this.kit.flap.item
    if (item.params.strutG === undefined) return undefined
    const zB = d.frontZ - d.t - (item.params.sideSetback ?? 37)
    return Math.ceil(d.D - zB + 7.8 + 2)
  }

  /** Rectangle que un front tapa: la llum més el que li toca dels panells del voltant, menys jocs. */
  protected frontTerritory(rect: ZoneRect, left?: VerticalRef, right?: VerticalRef): ZoneRect {
    const { m, d } = this
    const t = d.t
    const og = m.fronts.outerGap
    const bg = m.fronts.betweenGap
    const below = this.findBelow(rect)
    const above = this.findAbove(rect)
    // Encastats: dins de la llum, amb el joc a cada costat.
    if (d.inset) return { x0: r(rect.x0 + og), x1: r(rect.x1 - og), y0: r(rect.y0 + og), y1: r(rect.y1 - og) }
    // Les parets exteriors poden ser més gruixudes que el tauler (parets buides).
    // Fronts de calaix a inglet: de fora a fora als laterals (el tall a 45° fa el joc).
    const ogL = d.mitreFronts ? 0 : og
    const x0 = left ? (left.outer ? rect.x0 - (left.xR - left.xL) + ogL : rect.x0 - t / 2 + bg / 2) : rect.x0 + og
    const x1 = right ? (right.outer ? rect.x1 + (right.xR - right.xL) - ogL : rect.x1 + t / 2 - bg / 2) : rect.x1 - og
    const ogB = d.mitreFronts && d.mitreBottom ? 0 : og
    const ogT = d.mitreFronts && d.mitreTop ? 0 : og
    const y0 = below ? (below.outer ? rect.y0 - (below.yTop - below.yBottom) + ogB : rect.y0 - t / 2 + bg / 2) : rect.y0 + og
    // Tauler de taula amb voladís: sobresurt per davant dels fronts (que hi toparien); el front s'atura a sota, amb el joc.
    const underTable = !!above && above.outer && above.panel.id === "top" && !!d.tableTop && d.tableTop.overhang > 0
    const y1 = above ? (underTable ? rect.y1 - og : above.outer ? rect.y1 + (above.yTop - above.yBottom) - ogT : rect.y1 + t / 2 - bg / 2) : rect.y1 - og
    return { x0: r(x0), x1: r(x1), y0: r(y0), y1: r(y1) }
  }

  protected cableHole(hole: CableHole): void {
    const { d } = this
    const target =
      hole.panel === "left" ? this.panels.find((p) => p.id === "side-left")
      : hole.panel === "right" ? this.panels.find((p) => p.id === "side-right")
      : this.panels.find((p) => p.role === hole.panel)
    const what = { back: "al fons", top: "a la tapa", bottom: "a la base", left: "al lateral esquerre", right: "al lateral dret" }[hole.panel]
    if (!target) {
      this.warnings.push({ code: "cable-hole", message: `El passacables ${what} no té peça on anar (el mòdul no en té).` })
      return
    }
    // Punt del pla de la peça per a (u, v) del passacables, en coordenades del mòdul. Els
    // retalls són passants: la posició en el gruix no importa.
    const at = (u: number, v: number): Vec3 =>
      hole.panel === "back" ? [u, v, r(target.placement.origin[2] + d.tb)]
      : hole.panel === "top" ? [u, d.H - d.t, v]
      : hole.panel === "bottom" ? [u, d.baseY + d.t, v]
      : hole.panel === "left" ? [0, v, u]
      : [d.W, v, u]
    const rect = hole.shape === "rect"
    const hw = (rect ? (hole.w ?? hole.diameter) : hole.diameter) / 2
    const hh = (rect ? (hole.h ?? hole.diameter) : hole.diameter) / 2
    const a = toLocal(target, at(hole.x - hw, hole.y - hh))
    const b = toLocal(target, at(hole.x + hw, hole.y + hh))
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0])
    const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1])
    // Fora de la peça (o tocant-ne la vora): no es fa, i s'avisa.
    if (x0 < 1 || y0 < 1 || x1 > target.length - 1 || y1 > target.width - 1) {
      this.warnings.push({ code: "cable-hole", message: `El passacables ${what} surt de la peça: no s'ha fet. Mou-lo o fes-lo més petit.`, panelId: target.id })
      return
    }
    ;(target.cutouts ??= []).push(
      rect
        ? { kind: "rect", x: r(x0), y: r(y0), w: r(x1 - x0), h: r(y1 - y0), tag: "cable" }
        : { kind: "circle", x: r((x0 + x1) / 2), y: r((y0 + y1) / 2), diameter: hole.diameter, tag: "cable" },
    )
  }
}
