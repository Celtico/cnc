import { NO_EDGES, type HardwareItem, type Panel, type Vec3, type Zone, lightSystemOf, walkZones } from "../../model"
import type { KitOrderLine } from "../drawerKit"
import { X, Y, Z, addEdgeHole, addFaceHole, faceAt, neg, placement, r, toLocal, toWorld } from "../geometry"
import type { SlotSpec } from "../hardware"
import type { ZoneRect } from "../layout"
import { discOutline, planLights } from "../lightKit"
import type { LightOrder } from "../lightOrders"
import { MountingBuilder } from "./mounting"
import { num, worldBoxOf } from "./helpers"
import type { Wiring } from "./types"

/** Accessoris de dins i llum: barra de penjar, LED, jocs de llum i el recorregut dels cables. */
export class LightsBuilder extends MountingBuilder {
  /**
   * Barra de penjar: tub d'inox Ø25 de lateral a lateral, a 50 mm del sostre del compartiment
   * i centrat en la fondària útil. No és de CNC: va a `extras` (3D i llista). Els suports es
   * cargolen als laterals.
   */
  protected buildRail(zone: Zone, rect: ZoneRect): void {
    const { d } = this
    // Els números són de l'item (la barra triada al compartiment o la del mòdul; d'inici Ø25 a 50 del sostre).
    const spec = this.frontHardware("rail", zone.rail?.hardware, zone.id).spec
    const R = spec.diameter
    const len = r(rect.x1 - rect.x0 - 2)
    const cy = rect.y1 - spec.drop
    const cz = d.backInnerZ + (d.D - d.backInnerZ) / 2
    if (rect.y1 - rect.y0 < 900) this.warnings.push({ code: "rail", message: "Barra de penjar en un compartiment de menys de 900 mm: la roba llarga no hi cap.", zoneId: zone.id })
    const b = Math.tan(Math.PI / 8)
    this.extras.push({
      id: `rail-${zone.id}`,
      name: "barra",
      label: "Barra de penjar",
      role: "part",
      length: R,
      width: R,
      thickness: len,
      material: "Acer inox",
      grain: "none",
      edges: { ...NO_EDGES },
      holes: [],
      grooves: [],
      outline: [
        [R, R / 2, b],
        [R / 2, R, b],
        [0, R / 2, b],
        [R / 2, 0, b],
      ],
      // Secció al pla Z·Y i el llarg (gruix local) cap a −X, des del lateral dret.
      placement: { origin: [r(rect.x1 - 1), r(cy - R / 2), r(cz - R / 2)], xAxis: [0, 0, 1], yAxis: [0, 1, 0], zAxis: [-1, 0, 0], explodeDir: [0, 0, 1] },
    })
  }

  /**
   * Llum LED: perfil d'alumini de 16 × 8 amb tira LED càlida sota el sostre del compartiment i sota cada prestatge, a
   * 20 mm del davant del prestatge (il·lumina el que hi ha a sota). No és de CNC: va a `extras` (3D, render i llista, amb
   * el llarg per tallar el perfil). Material «Tira LED» (fa llum al render).
   */
  protected buildLed(zone: Zone, rect: ZoneRect, shelfYs: number[]): void {
    const { m, d } = this
    // Els números són de l'item (el perfil triat al compartiment o el del mòdul; d'inici 16 × 8 a 20 del davant).
    const led = this.frontHardware("led", zone.led?.hardware, zone.id)
    const spec = led.spec
    if (spec.light) {
      this.buildLights(zone, rect, shelfYs, led.item, spec)
      return
    }
    const W = spec.width, H = spec.height
    const len = r(rect.x1 - rect.x0 - 20)
    if (len < 50) return
    const zFront = d.D - m.carcass.shelfSetback - spec.setback
    const ys = [rect.y1, ...shelfYs].map((y) => r(y - H))
    ys.forEach((y, i) => {
      this.extras.push({
        id: `led-${zone.id}-${i}`,
        name: "tira LED",
        label: "Tira LED",
        role: "part",
        length: len,
        width: W,
        thickness: H,
        material: "Tira LED",
        grain: "none",
        edges: { ...NO_EDGES },
        holes: [],
        grooves: [],
        placement: placement([r(rect.x0 + 10), y, zFront], X, neg(Z), Y, Z),
      })
    })
  }

  /**
   * La **llum a sota del moble** (`Carcass.underLight`): un joc de llum a la cara de sota de la base (el mateix camí que
   * dins, `buildLights` amb `under`: el forat o el rebaix de la làmpada i el passant del cable a la base) o el perfil LED
   * de l'app, enganxat a sota de la base, a la seva distància del davant. Il·lumina el taulell.
   */
  buildUnderLight(): void {
    const { m, d } = this
    const ul = m.carcass.underLight
    if (!ul) return
    const base = this.panels.find((p) => p.role === "bottom")
    if (!base) {
      this.warnings.push({ code: "light", message: "Llum a sota: el mòdul no té base on posar-la. No es fa." })
      return
    }
    const cs = [0, base.length].flatMap((u) => [0, base.width].flatMap((v) => [0, base.thickness].map((w) => toWorld(base, [u, v, w]))))
    const box = { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]!))), max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]!))) } as { min: Vec3; max: Vec3 }
    const led = this.frontHardware("led", ul.hardware)
    const rect = { x0: box.min[0], x1: box.max[0], y0: box.min[1], y1: box.min[1] } as ZoneRect
    if (led.spec.light) return this.buildLights({ id: "under" }, rect, [], led.item, led.spec, { y: box.min[1] })
    const W = led.spec.width, H = led.spec.height
    const len = r(box.max[0] - box.min[0] - 20)
    if (len < 50) return
    this.extras.push({ id: "led-under", name: "tira LED", label: "Tira LED a sota", role: "part", length: len, width: W, thickness: H, material: "Tira LED", grain: "none", edges: { ...NO_EDGES }, holes: [], grooves: [], placement: placement([r(box.min[0] + 10), r(box.min[1] - H), r(d.D - led.spec.setback)], X, neg(Z), Y, Z) })
  }

  /**
   * **Joc de llum** (`HardwareItem.light`, `lightKit.ts`): a la peça de sobre del compartiment (la tapa, el travesser o
   * el prestatge) i a la cara de sota de cada prestatge, les làmpades del catàleg amb el seu **mecanitzat per encastar**
   * (forat rodó, rebaix quadrat o ranura de la barra, tag `light`) i el **forat passant del cable** (tag `cable`); si la
   * peça és massa prima o no hi cap, la caixa o la versió de sobreposar (només el forat del cable) i avís `light`. El
   * cos de la làmpada es veu (material «Tira LED», fa llum al render) a `extras`. L'**interruptor**, un per mòdul: el
   * sensor de porta amb un forat Ø12 al cantell de davant del lateral esquerre si el mòdul té portes recobrents (o
   * abatibles), si no el de proximitat per cargolar. La comanda (làmpades, alimentador, distribuïdor, interruptor i
   * cables) va a `lightKits` (`lightOrders.ts`).
   */
  protected buildLights(zone: Pick<Zone, "id">, rect: ZoneRect, shelfYs: number[], item: HardwareItem, spec: SlotSpec<"led">, under?: { y: number }): void {
    const { m, d } = this
    const k = spec.light!
    this.lightMaker ??= k.maker
    // A sota del moble (`under`): la cara de sota de la base, des del davant del mòdul.
    const front = under ? d.D : d.D - m.carcass.shelfSetback
    const len = rect.x1 - rect.x0
    const hosts: Panel["role"][] = under ? ["bottom"] : ["top", "fixedShelf", "shelf"]
    const lines: KitOrderLine[] = []
    let lamps = 0, watts = 0, peak = 0
    const warn = (message: string) => {
      if (!this.warnings.some((w) => w.code === "light" && w.message === message && w.zoneId === zone.id)) this.warnings.push({ code: "light", message, zoneId: zone.id })
    }
    for (const [i, y] of (under ? [under.y] : [rect.y1, ...shelfYs]).entries()) {
      const probe: Vec3 = [(rect.x0 + rect.x1) / 2, y, front - 30]
      const host = this.panels.find((p) => hosts.includes(p.role) && faceAt(p, toLocal(p, probe)) !== null)
      const depth = host ? Math.min(host.width, front - (d.D - host.width)) : front
      const plan = planLights(k, spec, { length: len, depth: host ? Math.min(host.width, depth) : depth }, host?.thickness ?? 0)
      for (const w of plan.warnings) warn(w)
      if (!host && plan.xs.length) warn(under ? `${k.series}: el mòdul no té base on posar la llum a sota: no es fa.` : `${k.series}: el compartiment no té res a sobre on posar la llum (sense tapa): no es fa.`)
      if (!host || !plan.xs.length) continue
      const zc = front - plan.z
      const n = plan.xs.length
      lamps += n
      watts += plan.watts
      peak += plan.peakWatts
      lines.push(...plan.lines)
      const yTop = plan.recessed ? y + plan.depth : y
      const bodyH = plan.recessed ? k.body.height : (k.surface?.height ?? k.body.height)
      for (const [j, dx] of plan.xs.entries()) {
        const x = rect.x0 + dx
        if (plan.bar) {
          // Ranura de la barra al llarg del compartiment; el cable surt per l'extrem esquerre.
          const x0 = x - plan.bar.cut / 2, x1 = x + plan.bar.cut / 2
          if (plan.recessed) this.pocket(host, [x0, y, zc - k.recess.size / 2], [x1, y, zc + k.recess.size / 2], plan.depth, "light")
          this.throughHole(host, [x0 + 20, y, zc], k.cableHole, "cable")
          this.lampSpots.push({ x: x0 + 20, y, z: zc, host, x0: rect.x0, d: k.cableHole, label: `Llum ${k.series}` })
          this.extras.push({
            id: `light-${zone.id}-${i}-${j}`,
            name: "barra LED",
            label: `Llum ${k.series}`,
            role: "part",
            length: plan.bar.cut,
            width: k.body.size,
            thickness: bodyH,
            material: "Tira LED",
            grain: "none",
            edges: { ...NO_EDGES },
            holes: [],
            grooves: [],
            placement: placement([r(x0), r(yTop - bodyH), r(zc + k.body.size / 2)], X, neg(Z), Y, Z),
          })
          continue
        }
        if (plan.recessed) {
          if (k.recess.shape === "round") {
            if (!addFaceHole(host, [x, y, zc], { diameter: k.recess.size, depth: plan.depth, tag: "light" })) warn(`${k.series}: el forat de la làmpada cau fora de «${host.label}».`)
          } else this.pocket(host, [x - k.recess.size / 2, y, zc - k.recess.size / 2], [x + k.recess.size / 2, y, zc + k.recess.size / 2], plan.depth, "light")
        }
        this.throughHole(host, [x, y, zc], k.cableHole, "cable")
        this.lampSpots.push({ x, y, z: zc, host, x0: rect.x0, d: k.cableHole, label: `Llum ${k.series}` })
        const sz = k.body.size
        this.extras.push({
          id: `light-${zone.id}-${i}-${j}`,
          name: "llum LED",
          label: `Llum ${k.series}`,
          role: "part",
          length: sz,
          width: sz,
          thickness: bodyH,
          material: "Tira LED",
          grain: "none",
          edges: { ...NO_EDGES },
          holes: [],
          grooves: [],
          ...(k.recess.shape === "square" ? {} : { outline: discOutline(sz) }),
          placement: placement([r(x - sz / 2), r(yTop - bodyH), r(zc + sz / 2)], X, neg(Z), Y, Z),
        })
      }
    }
    if (!lamps) return
    if (!this.lightSwitch) this.lightSwitch = this.lightSwitchFor(rect)
    this.lightKits.push({ zoneId: zone.id, item: item.name, kit: `${k.maker} ${k.series}`, maker: k.maker, lamps, watts: r(watts), peakWatts: r(peak), switch: this.lightSwitch, lines })
  }

  /** L'interruptor del mòdul: sensor de porta al cantell de davant del lateral esquerre si hi ha portes recobrents; si no, de proximitat. */
  protected lightSwitchFor(rect: ZoneRect): LightOrder["switch"] {
    const { m, d } = this
    let doors = false
    walkZones(m.root, (z) => {
      if (z.front?.kind === "door" || z.front?.kind === "flap") doors = true
    })
    const side = this.panels.find((p) => p.id === "side-left")
    const sys = lightSystemOf(this.lightMaker ?? "")
    if (doors && !d.inset && side && sys && addEdgeHole(side, [d.t / 2, (rect.y0 + rect.y1) / 2, d.D], { diameter: sys.doorSwitch.bore, depth: sys.doorSwitch.depth, tag: "light-switch" })) {
      this.switchSpot = { x: d.t / 2, y: (rect.y0 + rect.y1) / 2 }
      return "door"
    }
    return sys ? "touch" : "none"
  }

  /** Rebaix rectangular (caixera) a la cara d'una peça, entre dos punts del moble sobre aquella cara. */
  protected pocket(host: Panel, a: Vec3, b: Vec3, depth: number, tag: string): void {
    const la = toLocal(host, a), lb = toLocal(host, b)
    const face = faceAt(host, la)
    if (!face || face === "edge") return
    const x0 = Math.min(la[0], lb[0]), x1 = Math.max(la[0], lb[0])
    const y0 = Math.min(la[1], lb[1]), y1 = Math.max(la[1], lb[1])
    if (x0 < 0 || y0 < 0 || x1 > host.length || y1 > host.width) return
    host.grooves.push({ x: r(x0), y: r(y0), w: r(x1 - x0), h: r(y1 - y0), depth: r(depth), face, tag })
  }

  /** Forat passant rodó en un punt del moble sobre una cara de la peça. */
  protected throughHole(host: Panel, w: Vec3, diameter: number, tag: string): void {
    const l = toLocal(host, w)
    if (l[0] < diameter / 2 || l[1] < diameter / 2 || l[0] > host.length - diameter / 2 || l[1] > host.width - diameter / 2) return
    ;(host.cutouts ??= []).push({ kind: "circle", x: r(l[0]), y: r(l[1]), diameter, tag })
  }

  /**
   * **El recorregut dels cables dels llums** (per decisió de l'usuari, 2026-10-14: «fes el mecanitzat de tots els cables,
   * i el que no és mecanitzat, un plànol»; «per dins de la fusta, no poden quedar per sobre»). Cap cable per sobre d'una
   * cara que es veu:
   * - **Alimentador** on no es veu: a sobre de la tapa als penjats, a sota de la base amb potes o sòcol; un mòdul a terra
   *   sense aire a sota, a dins sobre la base (avís al plànol).
   * - **De la làmpada al darrere, per dins del tauler**: un forat de cantell des del cantell de darrere fins a la làmpada,
   *   pel mig del gruix (Ø del cable; es fa després de la CNC amb una broca llarga, post-procés «Forats de cantell»). A la
   *   tapa d'un penjat (i a la base d'un de potes) no cal: el cable surt per la cara que no es veu pel forat de la làmpada.
   * - **Vertical per darrere**, a la x de la làmpada i just davant del fons (o de la columna): un passant a cada peça
   *   horitzontal fixa que travessa fins a la cara amagada (la tapa o la base), tapat per la tapa passacables.
   * - Per la cara amagada, fins a l'alimentador, i el cable de xarxa per darrere fins a l'endoll (sense forat).
   */
  buildWiring(): void {
    if (!this.lampSpots.length) return
    const sys = lightSystemOf(this.lightMaker ?? "")
    if (!sys) return
    const { m } = this
    const notes: string[] = []
    const base = this.panels.find((p) => p.role === "bottom")
    const topP = this.panels.find((p) => p.role === "top")
    const back = this.panels.find((p) => p.role === "back")
    const bk = m.carcass.base.kind
    const up = bk === "wall" && !!topP
    const below = (bk === "legs" || bk === "plinth") && !!base
    const inside = !up && !below
    if (inside && !base) return
    const ref = (up ? topP : base)!
    const rb = worldBoxOf(ref)
    const zBack = back ? worldBoxOf(back).max[2] : rb.min[2]
    const zAlong = (xa: number, xb: number) => Math.max(zBack, this.rearAt(Math.min(xa, xb) - 15, Math.max(xa, xb) + 15))
    const kits = this.lightKits
    const peak = kits.reduce((a, k) => a + k.peakWatts, 0)
    const ds = sys.drivers.slice().sort((a, b) => a.watts - b.watts)
    const drv = ds.find((x) => (x.perSlot ?? x.watts) >= peak) ?? ds[ds.length - 1]!
    const [len] = drv.size.split("×").map((v) => Number(v.trim().replace(",", ".")))
    // A sota de la base, al mig de l'amplada (les potes van a les cantonades: ni l'alimentador ni el cable hi passen per sobre).
    const dLen = len ?? 140
    // Fora de les columnes de la casa (l'osca de la base): el primer lloc lliure entre el mig, a l'esquerra i a la dreta.
    // A sota de la base, tampoc on hi ha potes (per decisió de l'usuari: «aquí l'has posat a sota d'una pota»): les de les
    // cantonades i les que es posen al costat de l'osca d'una columna (`legPoints`): 110 mm (la placa, a 50 del cantell, en fa 92).
    const busy: [number, number][] = below
      ? [[rb.min[0], rb.min[0] + 110], [rb.max[0] - 110, rb.max[0]], ...[...this.rearLimits.map((l): [number, number] => [l.x0, l.x1]), ...this.keepOut].map(([a, b]): [number, number] => [a - 110, b + 110])]
      : [...this.rearLimits.map((l): [number, number] => [l.x0, l.x1]), ...this.keepOut].map(([a, b]): [number, number] => [a - 10, b + 10])
    const free = (x: number) => !(this.rearAt(x - 10, x + dLen + 10) > this.d.backInnerZ + 1) && busy.every(([a, b]) => x + dLen <= a || x >= b)
    const mid = (rb.min[0] + rb.max[0]) / 2 - dLen / 2
    // Del mig cap als costats a passos de 20 mm (als penjats i a dins, primer a l'esquerra, com abans).
    const steps = Array.from({ length: Math.ceil((rb.max[0] - rb.min[0]) / 20) }, (_, i) => mid + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 20)
    const cands = below ? steps : [rb.min[0] + 50, ...steps]
    const dx0 = cands.find((x) => x >= rb.min[0] + 20 && x + dLen <= rb.max[0] - 20 && free(x)) ?? (below ? mid : rb.min[0] + 50)
    const dx1 = dx0 + dLen
    // La cara on va l'alimentador (i per on corren els cables fins a ell): la de sobre de la tapa, la de sota de la base o, a dins, la de sobre de la base.
    const hy = up ? rb.max[1] : below ? rb.min[1] : rb.max[1]
    const dy0 = up || inside ? hy : hy - 16
    const zDrv = Math.max(zBack, this.rearAt(dx0, dx1)) + 20
    if (inside) notes.push("El mòdul no té aire a sota ni va penjat: l'alimentador va a dins, sobre la base, i el tros fins a ell va per sobre de la base (tapa'l amb la tapa passacables).")
    // La cambra del darrere (per decisió de l'usuari: «per la trasera del moble»): amb el fons en ranura o encastat i
    // retirat ≥ 8 mm, entre el fons i el cantell de darrere dels laterals hi ha lloc per al cable (Ø4): hi va vertical,
    // sense res a la vista. Sense (fons cargolat o enrasat), per dins, tapat amb la tapa passacables.
    const backRear = back ? worldBoxOf(back).min[2] : 0
    const cavity = !!back && backRear >= 8 && (m.carcass.back === "groove" || m.carcass.back === "inset")
    const zCav = backRear / 2
    const columnAt = (x: number) => this.rearAt(x - 15, x + 15) > this.d.backInnerZ + 1
    const holes: Wiring["holes"] = []
    const seen = new Set<string>()
    const drill = (p: Panel, w: Vec3, d: number, label: string) => {
      const key = `${p.id}:${Math.round(w[0])}:${Math.round(w[2])}`
      if (seen.has(key)) return
      seen.add(key)
      const before = p.cutouts?.length ?? 0
      this.throughHole(p, w, d, "cable-run")
      if ((p.cutouts?.length ?? 0) > before) holes.push({ x: r(w[0]), y: r(w[1]), label })
    }
    // El cable va per dins del tauler (el forat de cantell arriba al forat de la làmpada): el passant del cable cap a la cara
    // de l'altre costat ja no cal (per decisió de l'usuari: es veia des de sobre, «punts de llum per sobre del moble»).
    const dropCableThrough = (l: (typeof this.lampSpots)[number]) => {
      const lc = toLocal(l.host, [l.x, l.y, l.z])
      const k = (l.host.cutouts ?? []).findIndex((c) => c.kind === "circle" && c.tag === "cable" && Math.hypot(c.x - lc[0], c.y - lc[1]) < 1)
      if (k >= 0) l.host.cutouts!.splice(k, 1)
    }
    const runs: Wiring["runs"] = []
    const covers: { x: number; y0: number; y1: number; z: number }[] = []
    const draw: Vec3[][] = []
    let longBores = 0
    for (const l of this.lampSpots) {
      const hb = worldBoxOf(l.host)
      const hidden = (up && l.host === topP) || (below && l.host === base)
      const pts: [number, number][] = [[l.x, l.y]]
      const path: Vec3[] = [[l.x, l.y, l.z]]
      let length = 0
      // Els passants verticals a 25 del fons (dins de les peces, que comencen al fons); el forat de cantell hi arriba.
      const zc = zAlong(l.x, l.x) + 25
      if (hidden) {
        // Surt per la cara amagada pel forat de la làmpada i hi corre fins a l'alimentador.
        path.push([l.x, hy + (up ? 3 : -3), l.z])
      } else if (cavity && !columnAt(l.x) && !inside) {
        // Per dins del tauler fins al darrere i, per la cambra de darrere del fons, fins a la cara amagada.
        const ym = (hb.min[1] + hb.max[1]) / 2
        const depth = r(l.z - hb.min[2])
        // Un tauler massa prim per al forat (menys de 4 mm de pell a cada cara): el cable va per sota, arran de la làmpada.
        if (l.host.thickness >= l.d + 8 && depth > l.d && addEdgeHole(l.host, [l.x, ym, hb.min[2]], { diameter: l.d, depth, tag: "cable-run" })) {
          longBores += 1
          dropCableThrough(l)
        }
        if (hb.min[2] > zCav + 1) drill(back!, [l.x, ym, backRear], l.d, "pas del cable al fons")
        else drill(l.host, [l.x, ym, zCav], l.d, "pas del cable a la cambra")
        const yEnd = hy + (up ? 3 : -3)
        // La tapa o la base per on surt a la cara amagada: un passant a la cambra.
        drill(ref, [l.x, (rb.min[1] + rb.max[1]) / 2, zCav], l.d, "pas del cable a la cambra")
        path.push([l.x, ym, l.z], [l.x, ym, zCav], [l.x, yEnd, zCav])
        pts.push([l.x, yEnd])
        length += Math.abs(l.z - zCav) + Math.abs(ym - yEnd)
      } else {
        // Per dins del tauler: forat de cantell des del darrere fins a la làmpada, pel mig del gruix.
        const ym = (hb.min[1] + hb.max[1]) / 2
        const depth = r(l.z - hb.min[2])
        // Un tauler massa prim per al forat (menys de 4 mm de pell a cada cara): el cable va per sota, arran de la làmpada.
        if (l.host.thickness >= l.d + 8 && depth > l.d && addEdgeHole(l.host, [l.x, ym, hb.min[2]], { diameter: l.d, depth, tag: "cable-run" })) {
          longBores += 1
          dropCableThrough(l)
        }
        path.push([l.x, ym, l.z], [l.x, ym, zc])
        // Vertical per darrere fins a la cara amagada, amb un passant a cada peça fixa que travessa (la tapa o la base també).
        const lo = up ? hb.max[1] : hy, hi = up ? hy : hb.min[1]
        for (const p of this.panels) {
          if (p === l.host) continue
          // Totes les peces horitzontals que travessa (també els prestatges regulables: el cable hi passa pel forat).
          if (!(p.role === "fixedShelf" || p.role === "shelf" || p === topP || p === base)) continue
          const pb = worldBoxOf(p)
          if (l.x > pb.min[0] && l.x < pb.max[0] && zc > pb.min[2] && zc < pb.max[2] && pb.min[1] >= lo - 0.5 && pb.max[1] <= hi + 0.5 && !(inside && p === base)) drill(p, [l.x, (pb.min[1] + pb.max[1]) / 2, zc], l.d, "pas del cable")
        }
        const yEnd = inside ? hy + 8 : hy + (up ? 3 : -3)
        path.push([l.x, yEnd, zc])
        covers.push({ x: l.x, y0: Math.min(ym, yEnd), y1: Math.max(ym, yEnd), z: zc })
        pts.push([l.x, yEnd])
        length += Math.abs(l.z - zc) + Math.abs(ym - yEnd)
      }
      // Per la cara amagada fins a l'alimentador.
      const last = path[path.length - 1]!
      // Davant de les columnes que hi hagi pel camí fins a l'alimentador; a sota de la base, arran del darrere (per darrere de
      // les plaques de les potes, que comencen uns 13 mm endavant).
      // Amb una columna pel mig, per davant de la columna.
      const crossesColumn = this.rearAt(Math.min(last[0], dx0) - 5, Math.max(last[0], dx0) + 5) > this.d.backInnerZ + 1
      const zRun = below && !crossesColumn ? (cavity ? zCav : 6) : Math.max(last[2], zAlong(last[0], dx0) + 25)
      if (Math.abs(zRun - last[2]) > 0.5) path.push([last[0], last[1], zRun])
      path.push([dx0, last[1], zRun], [dx0, last[1], zDrv + 5])
      length += Math.abs(last[0] - dx0) + Math.abs(last[2] - zDrv) + 50
      pts.push([dx0, last[1]])
      draw.push(path)
      runs.push({ from: l.label, points: pts.map(([x, y]) => [r(x), r(y)]), length: Math.round(length) })
      if (length > sys.maxCable) notes.push(`${l.label}: ${Math.round(length)} mm de cable fins a l'alimentador (el catàleg en diu ${sys.maxCable} com a molt): cal un altre alimentador més a prop.`)
    }
    if (cavity && !inside) notes.push(`Els cables baixen per la cambra de darrere del fons (${num(backRear)} mm entre el fons i el darrere del moble): no es veuen.`)
    if (longBores) notes.push(`${longBores === 1 ? "Un forat" : `${longBores} forats`} de cable per dins del tauler (des del cantell de darrere fins a la làmpada, pel mig del gruix): es fan després de la CNC amb una broca llarga.`)
    // Inside: la sortida del cable de xarxa pel fons, darrere de l'alimentador.
    let mains: Wiring["mains"]
    if (inside && back && !(this.rearAt(dx0, dx1) > this.d.backInnerZ + 1)) {
      const mx = (dx0 + dx1) / 2, my = hy + 40
      const lb = toLocal(back, [mx, my, worldBoxOf(back).min[2]])
      if (lb[0] > 25 && lb[1] > 12 && lb[0] < back.length - 25 && lb[1] < back.width - 12) {
        ;(back.cutouts ??= []).push({ kind: "slot", x: r(lb[0] - 20), y: r(lb[1] - 8), w: 40, h: 16, tag: "cable-mains" })
        mains = { x: r(mx), y: r(my) }
      }
    } else if (inside && back) notes.push("Hi ha una columna darrere de l'alimentador: el cable de xarxa no surt pel fons, passa'l per l'osca de la columna fins a l'endoll.")
    else if (!inside) notes.push(`L'alimentador va ${up ? "a sobre de la tapa" : "a sota de la base"}, on no es veu: el cable de xarxa hi arriba per darrere del moble, sense cap forat.`)
    // Al 3D: l'alimentador, cada cable (Ø4) pel seu recorregut i la tapa passacables als trams verticals.
    this.hwBox("wiring-driver", drv.name, "Gris mat", [dx0, dy0, zDrv], [dx1 - dx0, 16, 50])
    const cable = (id: string, a: Vec3, b: Vec3) => {
      if (Math.abs(a[0] - b[0]) > 0.5) this.hwRod(id, "Cable de llum", "Gris mat", a[0], b[0], a[1], a[2], 2, "x")
      else if (Math.abs(a[1] - b[1]) > 0.5) this.hwRod(id, "Cable de llum", "Gris mat", a[0], a[0], Math.min(a[1], b[1]), a[2], 2, "y", Math.max(a[1], b[1]))
      else if (Math.abs(a[2] - b[2]) > 0.5) this.hwRod(id, "Cable de llum", "Gris mat", a[0], a[0], a[1], a[2], 2, "z", a[1], b[2])
    }
    draw.forEach((path, i) => {
      for (let k = 0; k + 1 < path.length; k++) cable(`wiring-${i}-${k}`, path[k]!, path[k + 1]!)
    })
    // A dins (sense aire a sota): el tram per sobre de la base, tapat també amb la tapa passacables, arran del fons.
    if (inside && this.lampSpots.length) {
      const xs = this.lampSpots.map((l) => l.x)
      const x1 = Math.max(...xs)
      if (x1 - dx1 > 40) this.hwBox("wiring-cover-base", sys.cableCover?.name ?? "Tapa passacables", "Blanc seda", [dx1, hy, zAlong(dx1, x1) + 25 - 8], [x1 - dx1 + 10, 16, 16])
    }
    covers.forEach((c, i) => {
      if (c.y1 - c.y0 > 60) this.hwBox(`wiring-cover-${i}`, sys.cableCover?.name ?? "Tapa passacables", "Blanc seda", [c.x - 10, c.y0, c.z - 8], [20, c.y1 - c.y0, 16])
    })
    const sw = this.lightKits[0]?.switch
    this.wiring = {
      driver: { x0: r(dx0), x1: r(dx1), y0: r(dy0), y1: r(dy0 + 16), name: drv.name, article: drv.article, where: up ? "a sobre de la tapa" : below ? "a sota de la base" : "a dins, sobre la base" },
      lamps: this.lampSpots.map((l) => ({ x: r(l.x), y: r(l.y), label: l.label })),
      runs,
      ...(sw === "door" && this.switchSpot ? { switch: { ...this.switchSpot, kind: "door" as const } } : sw === "touch" ? { switch: { x: r(rb.min[0] + 30), y: r(hy + (up ? -60 : 60)), kind: "touch" as const } } : {}),
      ...(mains ? { mains } : {}),
      holes,
      notes,
    }
  }
}
