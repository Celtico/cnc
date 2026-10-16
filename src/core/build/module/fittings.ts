import {
  type FrontHandle,
  type HardwareItem,
  type Hole,
  type Panel,
  type PanelRole,
  type Vec3,
  type Zone,
  damagedImportMessage,
  isDamagedImport,
} from "../../model"
import { X, Y, Z, faceAt, neg, placement, r, snap, toLocal } from "../geometry"
import { applyHardware, legSpec, slotSpec, type SlotSpec } from "../hardware"
import type { ZoneRect } from "../layout"
import { num, edges, near, frontMaterialOf, addHandle } from "./helpers"
import { LightsBuilder } from "./lights"
import type { VerticalRef, HandleChoice } from "./types"

/** Ferratges col·locats: tiradors, frontisses (cassoletes i plaques) i potes. */
/** Fins on es mou cap a dins una placa de pota que no hi cap just a la seva distància dels cantells (`buildLegs`). */
const LEG_NUDGE = 40

export class FittingsBuilder extends LightsBuilder {
  /**
   * El tirador d'un front: el triat a la porta, el calaix o l'abatible (`front.handle`) o, si no, el del mòdul. Un que no
   * serveix torna al del mòdul; un d'**importat** que no serveix queda inert (cap forat, `inertHandle`), mai el del mòdul.
   */
  /**
   * El tirador d'un front, **una sola font**: «Cap (push)» si el front ho diu (`handle: "none"`), si el front no en diu
   * res i el mòdul és push (`fronts.handles: "none"`, el per defecte) o si el joc del calaix obre per pressió (`kitPush`);
   * si no, el triat al front o el del mòdul.
   * A demanda: amb push ningú llegeix el lloc «tirador» i no es valida (res amagat compta).
   */
  protected frontHandle(item: FrontHandle | undefined, zoneId?: string, kitPush = false): HandleChoice {
    const push = item === "none" || (item === undefined && this.m.fronts.handles === "none") || kitPush
    let cached: { spec: SlotSpec<"handle">; item: HardwareItem } | undefined
    const resolve = () => {
      if (cached) return cached
      if (!item || item === "none") return (cached = this.kit.handle)
      const res = slotSpec("handle", item, (message) => this.hardwareWarning(message, zoneId))
      return (cached = res.failed && !item.imported ? this.kit.handle : res)
    }
    return {
      push,
      /** El push el posa el joc del calaix: cap altre ferratge a demanar. */
      kitPush,
      get spec() { return resolve().spec },
      get item() { return resolve().item },
    }
  }

  /**
   * Tirador del front; amb push (`HandleChoice.push`), cap forat i un avís (una vegada) del ferratge push (llevat que el
   * posi el joc del calaix). Un tirador importat **sense confirmar** (o que no serveix) no fa cap forat: avís `hardware`
   * (el taller no rep res que no s'hagi revisat). Un d'importat i confirmat posa el seu model al 3D (`Panel.fittings`, a
   * la cara de fora).
   */
  protected handle(p: Panel, cx: number, cy: number, along: "x" | "y", hs: HandleChoice, zoneId?: string): void {
    if (!hs.push) {
      const { spec, item } = hs
      if (spec.pending) {
        this.hardwareWarning(spec.unusable ?? `«${item.name}» és un tirador importat i encara no està confirmat: els fronts que el porten no fan els forats del tirador. Revisa'l i confirma'l a Preferències › Ferratges.`, zoneId)
        return
      }
      if (!addHandle(p, cx, cy, along, item, spec)) {
        this.warnings.push({ code: "handle", message: `${p.label} de ${num(p.width)} × ${num(p.length)} mm: massa petit per als forats del tirador (o toparien amb les cassoletes). No es fan: posa-hi un pom o un tirador de cantell.`, panelId: p.id })
        return
      }
      this.order(item, 1)
      const imp = item.imported
      if (imp && (imp.asset || imp.bbox)) {
        // Cara de fora del front (la que mira cap al davant del moble) i el marc del tirador: u al llarg dels forats.
        const face = p.placement.zAxis[2] > 0 ? "A" : "B"
        const v: [number, number] = along === "x" ? [0, face === "A" ? 1 : -1] : [face === "A" ? -1 : 1, 0]
        ;(p.fittings ??= []).push({ kind: "handle", ...(imp.asset ? { asset: imp.asset } : {}), x: r(cx), y: r(cy), face, v, ...(imp.bbox ? { bbox: imp.bbox } : {}) })
      }
      return
    }
    // La guia del joc ja porta el push (push-open): el front no necessita cap Tip-On (ni post-procés ni 3D ni avís).
    if (hs.kitPush) return
    p.push = true
    if (!this.warnings.some((w) => w.code === "push"))
      this.warnings.push({ code: "push", message: "Fronts sense tirador: cada porta, calaix o abatible necessita un ferratge d'obertura per pressió (push, p. ex. Tip-On o Push-to-open); als calaixos, guies amb push; a les portes, frontisses sense molla (sense retenció), perquè el push les pugui obrir." })
  }

  /** Un front (porta, abatible…) de la llum `w` × `h`; `material`: un altre que el dels fronts del mòdul (el front de moble d'un electrodomèstic). */
  protected frontPanel(id: string, name: string, label: string, role: PanelRole, x0: number, y0: number, w: number, h: number, material = frontMaterialOf(this.m)): Panel {
    const { d } = this
    return this.add(
      this.basePanel(id, name, label, role, h, w, d.t, material, "x", edges("left", "right", "bottom", "top"), placement([x0, y0, d.frontZ], Y, X, neg(Z), Z)),
    )
  }

  protected buildFrontPanel(zone: Zone, ter: ZoneRect, role: PanelRole, name: string, label: string): Panel {
    this.frontCount += 1
    const w = ter.x1 - ter.x0
    const h = ter.y1 - ter.y0
    const p = this.frontPanel(`${role}-${this.frontCount}`, name, label, role, ter.x0, ter.y0, w, h)
    void zone
    return p
  }

  /**
   * Cassoletes d'una porta (o reixeta amb frontisses) amb la frontissa `hinge` (la de la porta o la del mòdul): la
   * quantitat per alçada i els números surten de l'item; la regla (repartides, al mig de dos forats de la filera System
   * 32, sense trepitjar-se) és d'aquí. Els forats, del motor (`applyHardware`).
   */
  protected addCups(door: Panel, doorH: number, hingeSide: "left" | "right", doorW: number, rowYs: number[], doorY0: number, zoneId?: string, hinge = this.kit.hinge, side?: VerticalRef): number {
    const h = hinge.spec
    // Importada i sense confirmar: cap forat (ni a la porta ni al lateral) i un avís; el taller no en rep res.
    if (h.pending) {
      this.hardwareWarning(h.unusable ?? `«${hinge.item.name}» és importada i encara no està confirmada: la porta queda sense cassoletes ni forats. Revisa-la i confirma-la a Preferències › Ferratges.`, zoneId)
      return 0
    }
    const half = this.hw.system32.pitch / 2
    // Entre dos forats seguits de la filera (amb trams, no entre l'últim d'un i el primer de l'altre).
    const pitch = this.hw.system32.pitch
    const midpoints = rowYs.filter((y) => rowYs.some((z) => Math.abs(z - y - pitch) < 0.01)).map((y) => r(y + half))
    const count = h.count(doorH)
    const span = doorH - 2 * h.endOffset
    const targets = count === 1 ? [doorH / 2] : Array.from({ length: count }, (_, i) => h.endOffset + (span * i) / (count - 1))
    // Cassoletes sense trepitjar-se: entre centres, almenys el diàmetre i 10 mm, i dins de la porta.
    const dia = h.cupDiameter
    // Tot el patró de la frontissa (cassoleta i cargols o espigues) ha de cabre a la porta amb el marge: al llarg del
    // cantell (de `lo` a `hi`) i a través (la cassoleta, a `cupOffset` del cantell, no ha de sortir per l'altre costat).
    // Amb la frontissa d'inici el patró és només la cassoleta (els números de sempre).
    const pattern = applyHardware(hinge.item, "door", {}, { at: { x: 0, y: 0 } }).holes
    const below = Math.max(dia / 2, ...pattern.map((o) => o.diameter / 2 - o.x))
    const above = Math.max(dia / 2, ...pattern.map((o) => o.x + o.diameter / 2))
    const across = Math.max(h.cupOffset + dia / 2, ...pattern.map((o) => o.y + o.diameter / 2))
    const nearEdge = Math.min(h.cupOffset - dia / 2, ...pattern.map((o) => o.y - o.diameter / 2))
    // Porta massa estreta: la cassoleta (a `cupOffset` del cantell) o un cargol sortiria per l'altre costat.
    const minW = across + h.margin
    if (doorW < minW || nearEdge < 0) {
      this.warnings.push({ code: "hinge", message: `${door.label} de ${num(doorW)} mm d'amplada: no hi cap la cassoleta de la frontissa (calen ${num(minW)} mm). Fes-la més ampla o posa-hi un front fix.`, zoneId, panelId: door.id })
      return 0
    }
    const minGap = dia + h.gap
    const lo = doorY0 + below + h.margin
    const hi = doorY0 + doorH - above - h.margin
    // La placa (si n'hi ha) ha de cabre sencera al lateral a cada alçada; si no, aquella frontissa no es fa.
    if (h.plate && !side) this.warnings.push({ code: "hinge", message: `${door.label}: la placa de «${hinge.item.name}» va al lateral de les frontisses i aquest mòdul no en té (${hingeSide === "left" ? "esquerra" : "dreta"}). Els forats de la placa no es fan: fes-los on vagi muntada.`, zoneId, panelId: door.id })
    const plateWhy = new Set<string>()
    const plateAt = (y: number) => {
      if (!h.plate || !side) return null
      const res = this.plateHoles(side, hingeSide, y, h.plate, hinge.item)
      if ("error" in res) plateWhy.add(res.error)
      return res
    }
    const placed: number[] = []
    for (const target of targets) {
      const pool = (midpoints.length ? midpoints : [r(Math.min(hi, Math.max(lo, target + doorY0)))]).filter((y) => y >= lo && y <= hi && placed.every((p) => Math.abs(p - y) >= minGap) && !(plateAt(y) && "error" in plateAt(y)!))
      if (!pool.length) continue
      const y = snap(target + doorY0, pool)
      placed.push(y)
      // Ancoratge: al cantell de la frontissa (x local = alçada); a la dreta, des de l'altre cantell.
      const at = applyHardware(hinge.item, "door", {}, { at: { x: r(y - doorY0), y: 0 }, ...(hingeSide === "left" ? {} : { mirrorY: doorW }) })
      door.holes.push(...at.holes)
      // Ferratge importat: el model (només per veure'l) a la cassoleta i la placa aparellada al lateral.
      const imp = hinge.item.imported
      if (imp) {
        const cupX = r(y - doorY0)
        const cupY = hingeSide === "left" ? h.cupOffset : r(doorW - h.cupOffset)
        const face = at.holes[0]?.face === "B" ? "B" : "A"
        ;(door.fittings ??= []).push({ ...(imp.asset ? { asset: imp.asset } : {}), x: cupX, y: cupY, face, v: [0, hingeSide === "left" ? 1 : -1], ...(imp.bbox ? { bbox: imp.bbox } : {}) })
      }
      const plate = plateAt(y)
      if (plate && !("error" in plate)) this.addPlate(side!, plate, hinge.item, zoneId)
    }
    if (placed.length < count)
      this.warnings.push({ code: "hinge", message: `${door.label} de ${r(doorH)} mm: només hi caben ${placed.length} de ${count} frontisses sense que les cassoletes es trepitgin${plateWhy.size ? ` ni que la placa surti del lateral o caigui en una unió (${[...plateWhy].join(" ")})` : ""}.`, zoneId, panelId: door.id })
    this.order(hinge.item, placed.length)
    return placed.length
  }

  /**
   * Forats de la placa de muntatge d'una frontissa importada, a la cara de dins del lateral de les frontisses: a la
   * referència de la placa (`setback` darrere de la cara de darrere de la porta —amb fronts recobrents, el cantell de
   * davant del lateral; amb encastats, un gruix de front més endins— i `offset` per sobre del centre de la cassoleta
   * `yCup`). Marc de la placa: v cap al darrere, n cap a dins del moble, u = v × n (el mateix que el model importat).
   * **Tota o res**: si un forat (amb el seu radi) sortiria del lateral o cauria a la unió amb la base, la tapa o un
   * prestatge fix, `error`. Un forat més fondo que el lateral es deixa a gruix − 1 (pell d'1 mm) i ho diu `notes`.
   */
  protected plateHoles(side: VerticalRef, hingeSide: "left" | "right", yCup: number, plate: NonNullable<SlotSpec<"hinge">["plate"]>, item: HardwareItem): { holes: Hole[]; notes: string[]; origin: Vec3; v: Vec3 } | { error: string } {
    const { d } = this
    const xFace = hingeSide === "left" ? side.xR : side.xL
    const n: Vec3 = hingeSide === "left" ? X : neg(X)
    const v: Vec3 = neg(Z)
    const u: Vec3 = [v[1] * n[2] - v[2] * n[1], v[2] * n[0] - v[0] * n[2], v[0] * n[1] - v[1] * n[0]]
    // La referència es mesura des de la cara de darrere de la porta (recobrent: el davant del moble; encastada: un gruix
    // de front més endins). Amb fronts recobrents és el cantell de davant del lateral de sempre (37).
    const o: Vec3 = [xFace, yCup + plate.offset, d.frontZ - d.t - plate.setback]
    const at = (du: number, dv: number): Vec3 => [o[0] + du * u[0] + dv * v[0], o[1] + du * u[1] + dv * v[1], o[2] + du * u[2] + dv * v[2]]
    const p = side.panel
    const holes: Hole[] = []
    const notes: string[] = []
    for (const hole of plate.holes) {
      const w = at(hole.u, hole.v)
      const l = toLocal(p, w)
      const face = faceAt(p, l)
      const rad = hole.d / 2
      if (!face || face === "edge" || l[0] - rad < 0 || l[0] + rad > p.length || l[1] - rad < 0 || l[1] + rad > p.width)
        return { error: `Placa de «${item.name}»: un forat Ø${num(hole.d)} surt del ${p.label.toLowerCase()}.` }
      // Unions de la base, la tapa i els prestatges fixos que topen a aquesta cara: espigues i cantell.
      const joint = this.horizontals.find((hz) => (near(hz.xL, xFace) || near(hz.xR, xFace)) && w[1] + rad > hz.yBottom && w[1] - rad < hz.yTop && w[2] + rad > hz.zRear && w[2] - rad < hz.zFront)
      if (joint) return { error: `Placa de «${item.name}»: un forat cau a la unió amb ${joint.panel.label.toLowerCase()}.` }
      let depth = hole.depth
      if (depth > p.thickness - 1) {
        depth = Math.max(0.5, Math.floor((p.thickness - 1) * 2) / 2)
        notes.push(`Placa de «${item.name}»: un forat de ${num(hole.depth)} mm és massa fondo per al ${p.label.toLowerCase()} de ${num(p.thickness)} mm; es fa de ${num(depth)} mm (1 mm de pell). Comprova que la placa hi aguanta.`)
      }
      holes.push({ x: l[0], y: l[1], diameter: hole.d, depth, face, tag: hole.tag ?? "plate" })
    }
    return { holes, notes, origin: o, v }
  }

  /** Posa els forats de la placa (`plateHoles`) al lateral. Un forat que cau on ja n'hi ha un (la filera System 32) es queda el més gros. */
  protected addPlate(side: VerticalRef, plate: { holes: Hole[]; notes: string[]; origin: Vec3; v: Vec3 }, item: HardwareItem, zoneId?: string): void {
    const p = side.panel
    for (const message of plate.notes) if (!this.warnings.some((w) => w.code === "hinge" && w.message === message)) this.warnings.push({ code: "hinge", message, panelId: p.id, ...(zoneId ? { zoneId } : {}) })
    for (const next of plate.holes) {
      const same = p.holes.findIndex((e) => e.face === next.face && Math.abs(e.x - next.x) < 0.05 && Math.abs(e.y - next.y) < 0.05)
      if (same >= 0) {
        const e = p.holes[same]!
        if (e.diameter > next.diameter || (e.diameter === next.diameter && e.depth >= next.depth)) continue
        p.holes.splice(same, 1)
      }
      p.holes.push(next)
    }
    const pa = item.plate
    if (pa) {
      const { origin: o, v } = plate
      const l = toLocal(p, o)
      const face = faceAt(p, l)
      const lv = [v[0] * p.placement.xAxis[0] + v[1] * p.placement.xAxis[1] + v[2] * p.placement.xAxis[2], v[0] * p.placement.yAxis[0] + v[1] * p.placement.yAxis[1] + v[2] * p.placement.yAxis[2]] as [number, number]
      if (face === "A" || face === "B") (p.fittings ??= []).push({ ...(pa.asset ? { asset: pa.asset } : {}), x: l[0], y: l[1], face, v: lv, ...(pa.bbox ? { bbox: pa.bbox } : {}) })
    }
  }

  /**
   * Potes amb una pota importada triada (`Base.hardware` de la base «Potes»): una a cada cantonada, a `inset` de les vores
   * de fora del mòdul (on les dibuixa el 3D), amb els forats de la placa a la **cara de sota de la base** (u = X del
   * mòdul, v = cap al davant: totes girades igual). **Totes o cap**: si una placa no hi cap sencera (amb 3 mm de marge, sense
   * trepitjar cap forat) no se'n fa cap i avisa; sense confirmar (o malmesa), cap forat i avís `hardware`.
   */
  buildLegs(): void {
    const base = this.m.carcass.base
    if (base.kind !== "legs" || !base.hardware) return
    const item = base.hardware
    let spec: ReturnType<typeof legSpec>
    try {
      spec = legSpec(item)
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      this.hardwareWarning(isDamagedImport(item) ? damagedImportMessage(item) : `Potes: ${why}. Les potes no fan cap forat.`)
      return
    }
    if (spec.pending) {
      this.hardwareWarning(`«${item.name}» és una pota importada i encara no està confirmada: la base no fa els forats de les potes. Revisa-la i confirma-la a Preferències › Ferratges.`)
      return
    }
    const { d } = this
    const legLen = item.imported?.bbox?.max[2]
    if (legLen !== undefined && Math.abs(legLen - base.height) > 1)
      this.hardwareWarning(`«${item.name}» fa ${num(legLen)} mm d'alçada i la base «Potes» en diu ${num(base.height)}: el moble quedarà a una altra alçada (posa-hi ${num(legLen)}).`)
    // La base: la peça de baix amb la cara a Y = 0 (la de fora, si les parets són buides).
    const bottom = this.panels.find((p) => p.role === "bottom" && faceAt(p, toLocal(p, [d.W / 2, d.baseY, d.D / 2])) !== null)
    if (!bottom) {
      this.hardwareWarning(`«${item.name}»: el mòdul no té base on cargolar les potes. No es fan els forats.`)
      return
    }
    const inset = spec.inset
    // Una distància per a cada costat (la que l'item no porta és `inset`): esquerra, dreta, darrere i davant.
    const { insetLeft: left, insetRight: right, insetBack: back, insetFront: front } = spec
    const nominal: [number, number][] = [
      [left, back],
      [d.W - right, back],
      [left, d.D - front],
      [d.W - right, d.D - front],
    ]
    const T = bottom.thickness
    const margin = 3
    let deep = false
    // Els forats d'una pota a (lx, lz), o `null` si la placa no hi cap sencera (fora de la base, massa a prop d'un cantell
    // o trepitjant un altre forat).
    const platesAt = (lx: number, lz: number): Hole[] | null => {
      const out: Hole[] = []
      for (const h of spec.holes) {
        const u = spec.mirror && lx > d.W / 2 ? -h.u : h.u
        const l = toLocal(bottom, [r(lx + u), d.baseY, r(lz + h.v)])
        const face = faceAt(bottom, l)
        const R = h.d / 2
        const fits =
          face !== null &&
          l[0] - R >= margin &&
          l[0] + R <= bottom.length - margin &&
          l[1] - R >= margin &&
          l[1] + R <= bottom.width - margin &&
          bottom.holes.every((e) => e.face === "edge" || e.face !== face || Math.hypot(e.x - l[0], e.y - l[1]) >= e.diameter / 2 + R + 1)
        if (!fits || !face) return null
        out.push({ x: l[0], y: l[1], diameter: h.d, depth: r(Math.min(h.depth, T - 1)), face, tag: h.tag })
        if (Math.min(h.depth, T - 1) < h.depth) deep = true
      }
      return out
    }
    // Per decisió de l'usuari, 2026-10-16 («l'illa no respecta les potes»): una placa que no hi cap just a la seva distància
    // (un fons cargolat de 19 que es menja el darrere de la base, un forat a prop) es mou cap a dins el mínim que cal, fins a
    // `LEG_NUDGE` mm, i es diu; abans no es feia cap pota. Una pota que cau a l'osca d'una columna (la base amb `outline`) no
    // es fa aquí: `relayLegs` les torna a posar a les cantonades del contorn.
    const legs: [number, number][] = []
    const holes: Hole[] = []
    let moved = 0
    for (const [lx, lz] of nominal) {
      if (bottom.outline && faceAt(bottom, toLocal(bottom, [lx, d.baseY, lz])) === null) continue
      const ix = lx < d.W / 2 ? 1 : -1, iz = lz < d.D / 2 ? 1 : -1
      let found: { at: [number, number]; holes: Hole[] } | null = null
      for (let k = 0; k <= LEG_NUDGE && !found; k++)
        for (let a = 0; a <= k && !found; a++)
          for (const [dx, dz] of a === k ? [[k, k]] : [[a, k], [k, a]]) {
            const at: [number, number] = [lx + ix * dx!, lz + iz * dz!]
            const hs = platesAt(at[0], at[1])
            if (hs) {
              found = { at, holes: hs }
              break
            }
          }
      if (!found) {
        this.hardwareWarning(`«${item.name}»: la placa d'alguna pota no hi cap sencera a la base (a ${num(inset)} mm dels cantells, amb ${margin} mm de marge i sense trepitjar altres forats, ni movent-la ${LEG_NUDGE} mm cap a dins). No es fa cap forat de les potes: canvia «Als cantells» de la pota.`)
        return
      }
      if (found.at[0] !== lx || found.at[1] !== lz) moved = Math.max(moved, Math.abs(found.at[0] - lx), Math.abs(found.at[1] - lz))
      legs.push(found.at)
      holes.push(...found.holes)
    }
    if (!legs.length) return
    if (moved) this.hardwareWarning(`«${item.name}»: alguna placa no hi cabia just a la seva distància dels cantells (el fons o un altre forat hi tocava) i s'ha mogut ${num(moved)} mm cap a dins.`)
    bottom.holes.push(...holes)
    this.order(item, legs.length, item.tags?.some((t) => t.startsWith("Tub")) ? "el tub amb el peu es demana a part per l'alçada (notes del ferratge)" : undefined)
    if (deep) this.hardwareWarning(`«${item.name}»: els forats de les potes són més fondos que la base: es fan a ${num(T - 1)} mm (1 mm de pell).`)
    const imp = item.imported
    // Una pota de la biblioteca sense model (la AXILO 78): es dibuixa amb sòlids de l'app (`legSolids`), la placa amb les
    // mides de l'item (`plateU0`…; a la dreta, en mirall) i el tub fins a terra.
    const pp = item.params
    if (!imp && [pp.plateU0, pp.plateU1, pp.plateV, pp.plateH].every((x) => Number.isFinite(x))) {
      const z = bottom.placement
      const lv: [number, number] = [z.xAxis[2], z.yAxis[2]]
      for (const [lx, lz] of legs) {
        const l = toLocal(bottom, [lx, d.baseY, lz])
        const face = faceAt(bottom, l)
        if (face !== "A" && face !== "B") continue
        // El marc del ferratge: u = v × n amb n cap a terra; si u surt cap a −X del mòdul, la placa es gira.
        const n: Vec3 = face === "A" ? [z.zAxis[0], z.zAxis[1], z.zAxis[2]] : [-z.zAxis[0], -z.zAxis[1], -z.zAxis[2]]
        const vw: Vec3 = [lv[0] * z.xAxis[0] + lv[1] * z.yAxis[0], lv[0] * z.xAxis[1] + lv[1] * z.yAxis[1], lv[0] * z.xAxis[2] + lv[1] * z.yAxis[2]]
        const ux = vw[1] * n[2] - vw[2] * n[1]
        const flip = (spec.mirror && lx > d.W / 2 ? -1 : 1) * (ux < 0 ? -1 : 1)
        const [u0, u1] = flip > 0 ? [pp.plateU0!, pp.plateU1!] : [-pp.plateU1!, -pp.plateU0!]
        ;(bottom.fittings ??= []).push({ kind: "leg", x: l[0], y: l[1], face, v: lv, leg: { u0, u1, halfV: pp.plateV!, plateH: pp.plateH!, height: base.height, foot: pp.foot ?? 78 } })
      }
    }
    if (imp && (imp.asset || imp.bbox)) {
      const z = bottom.placement
      const lv: [number, number] = [z.xAxis[2], z.yAxis[2]]
      for (const [lx, lz] of legs) {
        const l = toLocal(bottom, [lx, d.baseY, lz])
        const face = faceAt(bottom, l)
        if (face === "A" || face === "B") (bottom.fittings ??= []).push({ kind: "leg", ...(imp.asset ? { asset: imp.asset } : {}), x: l[0], y: l[1], face, v: lv, ...(imp.bbox ? { bbox: imp.bbox } : {}) })
      }
    }
  }
}
