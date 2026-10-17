import { NO_EDGES, type Front, type HardwareItem, type Hole, type Vec3, type Zone } from "../../model"
import { X, Y, Z, addEdgeHole, addFaceHole, faceAt, neg, placement, r, toLocal } from "../geometry"
import { MIN_OPEN_RATIO, grilleCutouts, type Rect } from "../grille"
import { applyHardware, type SlotSpec } from "../hardware"
import type { ZoneRect } from "../layout"
import { FittingsBuilder } from "./fittings"
import { edges, frontMaterialOf } from "./helpers"
import type { VerticalRef, GlassHinge } from "./types"
import { fmtNum } from "../../../lib/format"

/** Fronts: portes (de fusta i de vidre), abatibles i reixetes. */
export class FrontsBuilder extends FittingsBuilder {
  protected buildDoors(zone: Zone, front: Extract<Front, { kind: "door" }>, ter: ZoneRect, rowYs: number[], left?: VerticalRef, right?: VerticalRef): void {
    const { m } = this
    this.doorZones += 1
    const suffix = this.doorZones === 1 ? "" : `-${this.doorZones}`
    const doorH = r(ter.y1 - ter.y0)
    if (doorH > 2200) this.warnings.push({ code: "door-too-tall", message: `Porta de ${fmtNum(doorH, 1)} mm d'alçada (màxim recomanat 2.200).`, zoneId: zone.id })

    // La frontissa triada a la porta (si no, la del mòdul); la de vidre no en porta.
    // (Els llocs es llegeixen a demanda: la porta de vidre no toca ni la frontissa ni el tirador.)
    // (Una de vidre també: la frontissa de perfil en fa la placa al lateral; el tirador s'hi clava, cap forat.)
    const hingeHw = this.frontHardware("hinge", front.hardware, zone.id)
    // El tirador triat a la porta (si no, el del mòdul).
    const handleHw = this.frontHandle(front.handle, zone.id)
    const make = (id: string, name: string, label: string, x0: number, w: number, hinge: "left" | "right") => {
      if (w > 600) this.warnings.push({ code: "door-too-wide", message: `Porta de ${fmtNum(w, 1)} mm d'amplada (màxim recomanat 600).`, zoneId: zone.id })
      if (front.glass) return this.glassDoor(id, label, x0, ter.y0, w, doorH, this.frontHardware("glassFrame", front.frame, zone.id), { hinge: hingeHw, side: hinge, panel: hinge === "left" ? left : right, rowYs, zoneId: zone.id }, handleHw.push ? undefined : handleHw.item)
      const door = this.frontPanel(id, name, label, "door", x0, ter.y0, w, doorH)
      this.addCups(door, doorH, hinge, w, rowYs, ter.y0, zone.id, hingeHw, hinge === "left" ? left : right)
      // Sense tirador (push): cap forat ni cap lectura del lloc «tirador».
      if (handleHw.push) return this.handle(door, doorH / 2, 0, "x", handleHw, zone.id)
      // Tirador al costat contrari de les frontisses, vertical i a mitja alçada. En una porta estreta cauria a la
      // columna de les cassoletes (on va el braç de la frontissa): no es fa.
      const hd = handleHw.spec
      const cupBand = hingeHw.spec.cupOffset + hingeHw.spec.cupDiameter / 2 + hd.diameter / 2 + hd.margin
      if (w - hd.inset < cupBand)
        this.warnings.push({ code: "handle", message: `${door.label} de ${fmtNum(w, 1)} mm d'amplada: el tirador cauria sobre les frontisses (calen ${fmtNum(cupBand + hd.inset, 1)} mm). No es fan els forats: posa-hi un pom o un tirador de cantell.`, zoneId: zone.id, panelId: door.id })
      else this.handle(door, doorH / 2, hinge === "left" ? w - hd.inset : hd.inset, "x", handleHw, zone.id)
    }
    if (front.mode === "single") {
      make(`door${suffix}`, "porta", "Porta", ter.x0, r(ter.x1 - ter.x0), front.hinge)
    } else {
      const w = r((ter.x1 - ter.x0 - m.fronts.betweenGap) / 2)
      make(`door${suffix}-left`, "porta e", "Porta esquerra", ter.x0, w, "left")
      make(`door${suffix}-right`, "porta d", "Porta dreta", r(ter.x0 + w + m.fronts.betweenGap), w, "right")
    }
  }

  /**
   * Porta de vidre (vitrina): marc de perfil d'alumini (el material del marc: negre a l'app, plata als Häfele) i vidre al mig, al lloc de la porta. No és de
   * CNC: tot va a `extras` («Elements sense nesting», amb les mides per demanar-ho). Les frontisses són les del perfil
   * (no porta cassoletes al tauler); els laterals mantenen les fileres.
   */
  protected glassDoor(id: string, label: string, x0: number, y0: number, w: number, h: number, frameHw: { spec: SlotSpec<"glassFrame">; item: HardwareItem }, hinge?: GlassHinge, handle?: HardwareItem): void {
    const { d } = this
    const frame = frameHw.spec
    // Les plaques de les frontisses de perfil (la frontissa triada), només a les portes; es dibuixen (frontissa i placa).
    const hingeYs = hinge ? this.glassHinges(label, y0, h, hinge) : []
    if (hinge) this.order(hinge.hinge.item, hingeYs.length, "per a perfil d'alumini")
    // El tirador (es clava al perfil del costat que obre, a mitja alçada): es veu.
    if (handle && hinge) this.glassPull(`${id}-pull`, label, hinge.side === "left" ? x0 + w - frame.frame / 2 : x0 + frame.frame / 2, y0 + h / 2, "y", handle)
    const F = frame.frame, G = frame.glass, t = d.t
    const z = d.frontZ
    const bar = (sid: string, lbl: string, bx: number, by: number, len: number, wid: number) =>
      this.extras.push({
        id: `${id}-${sid}`,
        name: "perfil vitrina",
        label: `${label} de vidre (${lbl})`,
        role: "part",
        length: r(len),
        width: r(wid),
        thickness: t,
        material: frame.material,
        grain: "none",
        edges: { ...NO_EDGES },
        holes: [],
        grooves: [],
        placement: placement([r(bx), r(by), z], Y, X, neg(Z), Z),
      })
    bar("left", "perfil esquerre", x0, y0, h, F)
    bar("right", "perfil dret", x0 + w - F, y0, h, F)
    // Les frontisses es veuen com són (per decisió de l'usuari: «això s'ha de veure»): la cassoleta de la frontissa triada
    // al darrere del perfil del costat de les frontisses (cara A, que mira enrere), a `cupOffset` del cantell de fora
    // (`edge`: el cantell de les frontisses); el dibuix (cassoleta, braç i placa al lateral) el fa `hardwareSolids`. És
    // d'alumini: no va a la CNC (el perfil és a `extras`).
    if (hinge && hingeYs.length) {
      const bp = this.extras.find((p) => p.id === `${id}-${hinge.side}`)!
      const cs = hinge.hinge.spec
      const v = hinge.side === "left" ? cs.cupOffset : F - cs.cupOffset
      for (const y of hingeYs) bp.holes.push({ x: r(y - y0), y: r(v), diameter: cs.cupDiameter, depth: Math.min(cs.cupDepth, t - 1), face: "A", edge: hinge.side === "left" ? "bottom" : "top", tag: "hinge" })
    }
    bar("bottom", "perfil de baix", x0 + F, y0, F, w - 2 * F)
    bar("top", "perfil de dalt", x0 + F, y0 + h - F, F, w - 2 * F)
    this.extras.push({
      id: `${id}-glass`,
      name: "vidre vitrina",
      label: `${label} de vidre (vidre)`,
      role: "part",
      length: r(h - 2 * F + 10),
      width: r(w - 2 * F + 10),
      thickness: G,
      material: "Vidre",
      grain: "none",
      edges: { ...NO_EDGES },
      holes: [],
      grooves: [],
      // El vidre entra 5 mm a la ranura del perfil per cada costat, centrat en el gruix.
      placement: placement([r(x0 + F - 5), r(y0 + F - 5), r(z - (t - G) / 2)], Y, X, neg(Z), Z),
    })
  }

  /**
   * Frontisses de perfil d'una porta de vidre (la frontissa triada, com a les portes de fusta): el perfil no es mecanitza
   * (la frontissa s'hi clava), però si la frontissa porta **placa** (target `side`, la Metallamat A), es fa al lateral de
   * les frontisses com a les de cassoleta: la quantitat per alçada, a `endOffset` dels extrems i, si hi ha filera System
   * 32, al mig de dos forats seguits. Tota la placa o res d'aquella frontissa (`plateHoles`). Sense placa, res.
   */
  protected glassHinges(label: string, y0: number, h: number, g: GlassHinge): number[] {
    const spec = g.hinge.spec
    const plate = spec.plate
    const count = spec.count(h)
    const span = h - 2 * spec.endOffset
    const targets = count === 1 ? [h / 2] : Array.from({ length: count }, (_, i) => spec.endOffset + (span * i) / (count - 1))
    // Sense placa (una frontissa sense mecanitzat al lateral): es dibuixa a les alçades de la regla, cap forat.
    if (!plate || spec.pending) return targets.map((t) => r(y0 + t))
    const item = g.hinge.item
    if (!g.panel) {
      this.warnings.push({ code: "hinge", message: `${label} de vidre: la placa de «${item.name}» va al lateral de les frontisses i aquest mòdul no en té. Els forats de la placa no es fan: fes-los on vagi muntada.`, zoneId: g.zoneId })
      return targets.map((t) => r(y0 + t))
    }
    const pitch = this.hw.system32.pitch
    const mids = g.rowYs.filter((y) => g.rowYs.some((z) => Math.abs(z - y - pitch) < 0.01)).map((y) => r(y + pitch / 2))
    const placed: number[] = []
    const why = new Set<string>()
    for (const t of targets) {
      const want = y0 + t
      const pool = (mids.length ? mids : [r(want)]).filter((y) => y >= y0 + 40 && y <= y0 + h - 40 && placed.every((p) => Math.abs(p - y) >= 64))
      const sorted = [...pool].sort((a, b) => Math.abs(a - want) - Math.abs(b - want))
      for (const y of sorted) {
        const res = this.plateHoles(g.panel, g.side, y, plate, item)
        if ("error" in res) {
          why.add(res.error)
          continue
        }
        this.addPlate(g.panel, res, item, g.zoneId)
        // Un forat de la placa que cau en un de la filera (el mateix forat) és el de la placa: hi va el seu cargol.
        for (const hl of res.holes) {
          const e = g.panel.panel.holes.find((x) => x.face === hl.face && Math.abs(x.x - hl.x) < 0.05 && Math.abs(x.y - hl.y) < 0.05)
          if (e && e.tag === "system32") e.tag = hl.tag
        }
        placed.push(y)
        break
      }
    }
    if (placed.length < count)
      this.warnings.push({ code: "hinge", message: `${label} de vidre de ${fmtNum(h, 1)} mm: només hi caben ${placed.length} de ${count} plaques de frontissa al lateral${why.size ? ` (${[...why].join(" ")})` : ""}.`, zoneId: g.zoneId })
    return placed
  }

  /** El tirador d'una vitrina (es clava al perfil): la barra del tirador triat (de llarg la distància + 25, o 80), sortint 14. */
  protected glassPull(id: string, label: string, cx: number, cy: number, along: "x" | "y", item: HardwareItem): void {
    const { d } = this
    const pitch = item.pitch ? item.pitch.else : 0
    const L = pitch > 0 ? pitch + 25 : 80
    const [w, hh] = along === "y" ? [16, L] : [L, 16]
    this.order(item, 1)
    // Com els de marc de vitrina (es claven al perfil): la placa prima sobre el perfil i el llavi per agafar-lo.
    this.hwBox(`${id}-base`, `${label}: tirador`, "Acer inox", [cx - w / 2, cy - hh / 2, d.frontZ], [w, hh, 3])
    const lip: Vec3 = along === "y" ? [5, hh, 11] : [w, 5, 11]
    this.hwBox(id, `${label}: tirador`, "Acer inox", [along === "y" ? cx + w / 2 - 5 : cx - w / 2, along === "y" ? cy - hh / 2 : cy - hh / 2, d.frontZ + 3], lip)
  }

  /**
   * Les frontisses d'un abatible de vidre (per decisió de l'usuari, com la vitrina de la cuina de casa: «connectat a la
   * fusta»): la frontissa del mòdul al perfil del cantell de gir (dalt si obre amunt, baix si obre avall), la quantitat
   * per l'amplada a `endOffset` dels extrems, i la placa a la tapa (o a la base) a la cara que mira l'abatible, a
   * `plateSetback` del darrere del front: els forats de la placa al tauler (tota o res per frontissa) i el dibuix
   * (cassoleta, braç i placa) de `hardwareSolids`. Sense la peça al cantell de gir, només el dibuix i un avís.
   */
  protected glassFlapHinges(id: string, x0: number, y0: number, w: number, h: number, F: number, dir: "up" | "down", zoneId: string): void {
    const { d } = this
    const hinge = this.frontHardware("hinge", undefined, zoneId)
    const cs = hinge.spec
    const count = cs.count(w)
    const span = w - 2 * cs.endOffset
    const xs = (count === 1 || span <= 0 ? [w / 2] : Array.from({ length: count }, (_, i) => cs.endOffset + (span * i) / (count - 1))).map((x) => r(x0 + x))
    const bar = this.extras.find((p) => p.id === `${id}-${dir === "up" ? "top" : "bottom"}`)
    if (!bar) return
    if (!cs.pending) this.order(hinge.item, xs.length, "per a perfil d'alumini")
    // El perfil de dalt/baix: u al llarg de Y (F), v al llarg de X des de x0 + F; el cantell de gir és u = F (dalt) o u = 0 (baix).
    for (const x of xs) bar.holes.push({ x: r(dir === "up" ? F - cs.cupOffset : cs.cupOffset), y: r(x - (x0 + F)), diameter: cs.cupDiameter, depth: Math.min(cs.cupDepth, d.t - 1), face: "A", edge: dir === "up" ? "right" : "left", tag: "hinge" })
    if (cs.pending) return
    // La placa de la frontissa; la de l'app (sense placa pròpia) va, com al lateral, a dos forats de la filera System 32
    // (Ø i fondària de la filera, a mig pas per banda, a `edgeOffset` del davant).
    const s32 = this.hw.system32
    const plate = cs.plate ?? { setback: s32.edgeOffset, holes: [-s32.pitch / 2, s32.pitch / 2].map((u) => ({ u, v: 0, d: s32.diameter, depth: s32.depth, tag: "plate" })) }
    const edgeY = dir === "up" ? y0 + h : y0
    const host = this.horizontals.find((hz) => (dir === "up" ? hz.yBottom >= edgeY - d.t - 0.5 && hz.yBottom <= edgeY + 0.5 : hz.yTop <= edgeY + d.t + 0.5 && hz.yTop >= edgeY - 0.5) && xs.every((x) => x > hz.xL && x < hz.xR))
    if (!host) {
      this.warnings.push({ code: "hinge", message: `Abatible de vidre: la placa de «${hinge.item.name}» va a la ${dir === "up" ? "tapa" : "base"} i aquest mòdul no en té al cantell de gir. Els forats de la placa no es fan: fes-los on vagi muntada.`, zoneId })
      return
    }
    const yFace = dir === "up" ? host.yBottom : host.yTop
    const z = d.frontZ - d.t - plate.setback
    for (const x of xs) {
      const holes: Hole[] = []
      let bad = false
      for (const ph of plate.holes) {
        const l = toLocal(host.panel, [x + ph.u, yFace, z - ph.v])
        const face = faceAt(host.panel, l)
        const rad = ph.d / 2
        if (!face || face === "edge" || l[0] - rad < 0 || l[0] + rad > host.panel.length || l[1] - rad < 0 || l[1] + rad > host.panel.width) { bad = true; break }
        holes.push({ x: l[0], y: l[1], diameter: ph.d, depth: Math.min(ph.depth, Math.max(0.5, host.panel.thickness - 1)), face, tag: ph.tag ?? "plate" })
      }
      if (bad) this.warnings.push({ code: "hinge", message: `Abatible de vidre: la placa de «${hinge.item.name}» no cap a la ${host.panel.label.toLowerCase()}; aquella placa no es fa.`, zoneId })
      else host.panel.holes.push(...holes)
    }
  }

  /**
   * Pistó de gas (un item del braç d'abatible amb `strutG`: els Häfele 373.78.90x, p. FF 4.224; per decisió de l'usuari
   * «res de sistemes»: només els forats del ferratge): el bracket d'armari a la cara de dins del lateral, a G per sota del
   * cantell de gir i a `sideSetback` del darrere del front, amb els forats del target `side` (els dos Ø5 a 32, tot o res), i
   * el dibuix: el pistó (Ø15,6, del llarg del joc) amunt des del bracket, a 16 de la cara del lateral, i el bracket. Només
   * per als que obren amunt; si no, avís. Torna `false` si l'item no és un pistó (el braç de sempre).
   */
  protected gasStrut(id: string, side: VerticalRef, which: "left" | "right", pivotY: number, dir: "up" | "down", item: HardwareItem, zoneId: string): boolean {
    const G = item.params.strutG
    if (G === undefined) return false
    if (dir !== "up") {
      if (which === "left") this.warnings.push({ code: "hardware", message: `«${item.name}» és per a portes que obren amunt: en un abatible que obre avall no es fa ni es dibuixa.`, zoneId })
      return true
    }
    const { d } = this
    const xFace = which === "left" ? side.xR : side.xL
    const out = which === "left" ? 1 : -1
    const yB = pivotY - G
    const zB = d.frontZ - d.t - (item.params.sideSetback ?? 37)
    const p = side.panel
    const ops = item.targets.find((t) => t.key === "side")?.ops ?? []
    const holes: Hole[] = []
    for (const op of ops) {
      if (op.kind !== "drill") continue
      const u = typeof op.u === "number" ? op.u : 0
      const dd = item.params.diameter ?? 5
      const l = toLocal(p, [xFace, yB + u, zB])
      const face = faceAt(p, l)
      if (!face || face === "edge" || l[0] - dd / 2 < 0 || l[0] + dd / 2 > p.length || l[1] - dd / 2 < 0 || l[1] + dd / 2 > p.width) {
        this.warnings.push({ code: "hardware", message: `«${item.name}»: el bracket d'armari no cap al ${p.label.toLowerCase()} (a ${fmtNum(G, 1)} mm del cantell de gir); no es fa.`, zoneId })
        return true
      }
      holes.push({ x: l[0], y: l[1], diameter: dd, depth: Math.min(item.params.depth ?? 12, p.thickness - 1), face, tag: "flap" })
    }
    p.holes.push(...holes)
    // La comanda: un joc (2 pistons i els brackets) per abatible, amb el lateral esquerre (o el dret si no n'hi ha).
    const flapKey = id.replace(/-strut-[lr]$/, "")
    if (!this.strutOrdered.has(flapKey)) {
      this.strutOrdered.add(flapKey)
      this.order(item, 1, "joc de 2 pistons, brackets i tapes; tria la força pel pes de la porta (notes del ferratge)")
    }
    // El dibuix, com el del catàleg (FF 4.224): el bracket d'armari (placa de 26 × 14 × 3 amb el pern Ø10), el pistó tancat
    // de pern a pern (`strutLength`): la ròtula de baix, el cos Ø15,6, la tija Ø6 del recorregut i la ròtula de dalt, i el
    // bracket de porta a dalt. A 16 de la cara del lateral, vertical (la porta tancada).
    const len = item.params.strutLength ?? 230
    const stroke = item.params.strutStroke ?? Math.round(len / 3)
    const cx = xFace + out * 16
    const yTop = Math.min(pivotY - 8, yB + len)
    const L = yTop - yB
    const cap = 18
    this.hwBox(`${id}-bracket`, `${item.name}: bracket d'armari`, "Acer inox", [which === "left" ? xFace : xFace - 3, yB - 13, zB - 7], [3, 26, 14])
    this.hwRod(`${id}-pin`, `${item.name}: pern`, "Acer inox", xFace + out * 1.5, xFace + out * 12, yB, zB, 5, "x")
    this.hwRod(`${id}-cap-b`, `${item.name}: ròtula`, "Gris mat", cx, cx, yB - cap / 2, zB, 6.65, "y", yB + cap / 2)
    this.hwRod(`${id}-body`, `${item.name}: pistó`, "Alumini anoditzat plata", cx, cx, yB + cap / 2, zB, 7.8, "y", Math.max(yB + cap, yTop - cap / 2 - Math.min(stroke, L - 2 * cap)))
    this.hwRod(`${id}-rod`, `${item.name}: tija`, "Acer inox", cx, cx, Math.max(yB + cap, yTop - cap / 2 - Math.min(stroke, L - 2 * cap)), zB, 3, "y", yTop - cap / 2)
    this.hwRod(`${id}-cap-t`, `${item.name}: ròtula`, "Gris mat", cx, cx, yTop - cap / 2, zB, 6.65, "y", yTop + cap / 2)
    this.hwBox(`${id}-door-bracket`, `${item.name}: bracket de porta`, "Acer inox", [cx - 7, yTop - 13, d.frontZ - d.t - 3], [14, 26, 3])
    return true
  }

  /** El braç d'un abatible de vidre (es veu): el cos cargolat a la cara de dins del lateral, a dalt. */
  protected glassArm(id: string, side: VerticalRef, which: "left" | "right", y0: number, h: number, dir: "down" | "up"): void {
    const { d } = this
    const zBack = d.frontZ - d.t
    const xFace = which === "left" ? side.xR : side.xL
    const yTop = dir === "up" ? y0 + h - 30 : y0 + 140
    this.hwBox(id, "Braç d'abatible", "Acer inox", [which === "left" ? xFace : xFace - 18, yTop - 110, zBack - 260], [18, 110, 230])
  }

  protected buildFlap(zone: Zone, front: Extract<Front, { kind: "flap" }>, ter: ZoneRect, left?: VerticalRef, right?: VerticalRef): void {
    // Abatible de vidre (vitrina): el marc d'alumini i el vidre, com la porta de vidre; el braç va al perfil.
    if (front.glass) {
      this.frontCount += 1
      const id = `flap-${this.frontCount}`
      const x0 = ter.x0, y0 = ter.y0, w = r(ter.x1 - ter.x0), h = r(ter.y1 - ter.y0)
      this.glassDoor(id, "Abatible", x0, y0, w, h, this.frontHardware("glassFrame", front.frame, zone.id))
      const F = this.frontHardware("glassFrame", front.frame, zone.id).spec.frame
      // Es veu (per decisió de l'usuari: «s'ha de veure tot»): el tirador al perfil del cantell que obre i els braços als laterals.
      const handle = this.frontHandle(front.handle, zone.id)
      if (!handle.push) this.glassPull(`${id}-pull`, "Abatible", x0 + w / 2, front.dir === "down" ? y0 + h - F / 2 : y0 + F / 2, "x", handle.item)
      const arm = this.frontHardware("flap", front.hardware, zone.id)
      for (const ref of [left, right]) {
        if (!ref) continue
        const which = ref === left ? "left" : "right"
        if (!this.gasStrut(`${id}-strut-${which[0]}`, ref, which, front.dir === "up" ? y0 + h : y0, front.dir, arm.item, zone.id))
          this.glassArm(`${id}-arm-${which[0]}`, ref, which, y0, h, front.dir)
      }
      this.glassFlapHinges(id, x0, y0, w, h, F, front.dir, zone.id)
      return
    }
    const flap = this.buildFrontPanel(zone, ter, "flap", "abatible", "Abatible")
    // El braç triat a l'abatible (si no, el del mòdul): dos forats a `offset` del cantell de gir (22,5).
    const arm = this.frontHardware("flap", front.hardware, zone.id)
    const f = arm.spec
    const along = flap.length // alçada
    const across = flap.width
    // Abatibles estrets: si els dos forats no hi caben a `endOffset` (100) dels costats, a un quart i a tres quarts (com a
    // mínim un Ø de matèria entre ells); més estret encara, no se'n fan i s'avisa.
    const fitsAlong = along >= f.offset + f.diameter / 2 + 1
    const ys = !fitsAlong ? [] : across >= 2 * f.endOffset + 2 * f.diameter ? [f.endOffset, r(across - f.endOffset)] : across >= 4 * f.diameter ? [r(across / 4), r((3 * across) / 4)] : []
    if (!ys.length) this.warnings.push({ code: "hinge", message: `Abatible de ${fmtNum(across, 1)} × ${fmtNum(along, 1)} mm: no hi caben els forats de les frontisses.`, zoneId: zone.id, panelId: flap.id })
    for (const y of ys) {
      // Ancoratge al cantell de gir (x local = alçada): avall, el de baix; amunt, el de dalt.
      flap.holes.push(...applyHardware(arm.item, "flap", {}, { at: { x: 0, y }, ...(front.dir === "down" ? {} : { mirrorX: along }) }).holes)
    }
    // Un pistó de gas també es cargola al lateral (bracket d'armari) i es dibuixa.
    for (const ref of [left, right]) if (ref) this.gasStrut(`${flap.id}-strut-${ref === left ? "l" : "r"}`, ref, ref === left ? "left" : "right", front.dir === "up" ? ter.y1 : ter.y0, front.dir, arm.item, zone.id)
    // Tirador al cantell que obre (el contrari del gir), horitzontal i centrat.
    const handleHw = this.frontHandle(front.handle, zone.id)
    // Sense tiradors no es llegeix el lloc (`handle` només marca el push).
    // La distància del front (`handleInset`) o la del tirador; com a molt, el mig de l'abatible.
    const inset = handleHw.push ? 0 : Math.min(front.handleInset ?? handleHw.spec.inset, along / 2)
    this.handle(flap, front.dir === "down" ? along - inset : inset, across / 2, "y", handleHw, zone.id)
  }

  protected buildGrille(
    zone: Zone,
    front: Extract<Front, { kind: "grille" }>,
    rect: ZoneRect,
    ter: ZoneRect,
    left: VerticalRef | undefined,
    right: VerticalRef | undefined,
    rowYs: number[],
  ): void {
    const { m, d } = this
    const grille = this.buildFrontPanel(zone, ter, "grille", "reixeta", "Reixeta")
    const exclude: Rect[] = []
    let hatchLocal: Rect | undefined
    // Trapa: obertura més 20 mm de solapament per costat (on van els imants), darrere del front.
    const lip = 20
    if (front.hatch) {
      // Trapa en coordenades de la zona → locals del front (x local = Y, y local = X).
      const hx = rect.x0 + front.hatch.x
      const hy = rect.y0 + front.hatch.y
      hatchLocal = { x: r(hy - ter.y0), y: r(hx - ter.x0), w: front.hatch.h, h: front.hatch.w }
      // Cap ranura dins del solapament de la trapa (hi van els imants) ni a menys d'un pas.
      const g = lip + front.pattern.slotGap
      exclude.push({ x: hatchLocal.x - g, y: hatchLocal.y - g, w: hatchLocal.w + 2 * g, h: hatchLocal.h + 2 * g })
    }
    // Imants (reixeta desmuntable): cap ranura a sobre ni a tocar dels forats dels imants.
    // Si no, amb un marge petit les ranures els travessen i la peça no es pot fer.
    // L'imant triat a la reixeta (si no, el del mòdul): desmuntable i trapa.
    const magnet = this.frontHardware("magnet", front.hardware, zone.id)
    if (front.mount !== "hinged") {
      const mg = magnet.spec
      const clear = mg.diameter / 2 + Math.max(6, front.pattern.slotGap / 2)
      for (const ref of [left, right]) {
        if (!ref) continue
        const xMid = (ref.xL + ref.xR) / 2
        for (const y of [rect.y0 + mg.cornerOffset, rect.y1 - mg.cornerOffset]) {
          const lx = y - ter.y0
          const ly = xMid - ter.x0
          exclude.push({ x: lx - clear, y: ly - clear, w: 2 * clear, h: 2 * clear })
        }
      }
    }
    const result = grilleCutouts(grille.length, grille.width, front.pattern, exclude)
    grille.cutouts = [...result.cutouts]
    this.openRatios[zone.id] = result.openRatio
    if (result.openRatio < MIN_OPEN_RATIO) {
      this.warnings.push({ code: "grille-open-ratio", message: `La reixeta només té un ${Math.round(result.openRatio * 100)} % d'àrea oberta (mínim recomanat 40 %).`, zoneId: zone.id, panelId: grille.id })
    }
    // Una reixeta pot ser un cobreradiador (o només decorativa: no se sap): un avís per mòdul, i cap si ja és MDF lacat.
    if (!/lacat/i.test(grille.material) && !this.warnings.some((w) => w.code === "material-heat")) {
      this.warnings.push({ code: "material-heat", message: "Reixeta: si va davant d'un radiador, millor MDF lacat o cantells amb cola PUR (la cola EVA es desenganxa amb la calor).", zoneId: zone.id })
    }

    if (hatchLocal) {
      grille.cutouts.push({ kind: "rect", ...hatchLocal, tag: "hatch" })
      const hw = front.hatch!.w + 2 * lip
      const hh = front.hatch!.h + 2 * lip
      const hx0 = rect.x0 + front.hatch!.x - lip
      const hy0 = rect.y0 + front.hatch!.y - lip
      // Darrere del front: a la seva cara de dins (encastat, un gruix més endins).
      const hatch = this.add(
        this.basePanel(`hatch-${this.frontCount}`, "trapa", "Trapa", "hatch", hh, hw, d.t, frontMaterialOf(m), "x", edges("left", "right", "bottom", "top"), placement([hx0, hy0, d.frontZ - d.t], Y, X, neg(Z), Z)),
      )
      const mg = magnet.spec
      for (const [lx, ly] of [[lip / 2, lip / 2], [hh - lip / 2, lip / 2], [lip / 2, hw - lip / 2], [hh - lip / 2, hw - lip / 2]] as [number, number][]) {
        // Imant a la cara B de la trapa (la que toca el front) i contrapart a la cara A del front.
        hatch.holes.push({ x: r(lx), y: r(ly), diameter: mg.front.diameter, depth: mg.front.depth, face: "B", ...(mg.front.tag ? { tag: mg.front.tag } : {}) })
        const w: Vec3 = [hx0 + ly, hy0 + lx, d.frontZ - d.t]
        addFaceHole(grille, w, mg.front)
      }
    }

    if (front.mount === "hinged") {
      this.addCups(grille, grille.length, front.hinge, grille.width, rowYs, ter.y0, zone.id, this.kit.hinge, front.hinge === "left" ? left : right)
      return
    }
    // Desmuntable: imants als cantells frontals dels panells dels costats i contraparts al front.
    const mg = magnet.spec
    for (const [ref, side] of [[left, "left"], [right, "right"]] as [VerticalRef | undefined, "left" | "right"][]) {
      if (!ref) {
        this.warnings.push({ code: "no-side", message: `La reixeta no té panell a la ${side === "left" ? "esquerra" : "dreta"} on posar els imants.`, zoneId: zone.id })
        continue
      }
      const xMid = (ref.xL + ref.xR) / 2
      for (const y of [rect.y0 + mg.cornerOffset, rect.y1 - mg.cornerOffset]) {
        const w: Vec3 = [r(xMid), r(y), ref.zFront]
        addEdgeHole(ref.panel, w, mg.side)
        addFaceHole(grille, w, mg.front)
      }
    }
  }
}
