import {
  NO_EDGES,
  type EdgeBanding,
  type Front,
  type HardwareItem,
  type HardwareKit,
  type Panel,
  type Vec3,
  type Zone,
  innerDrawerHeights,
  innerShimOf,
  type InnerShim,
  isDrawerKit,
  isPushClosing,
  kitOptionsOf,
  GLASS_HANDLE_TOP,
} from "../../model"
import { kitBottomThickness, kitFamily, kitHeight, kitSolidPanels, planKit, type KitPlan } from "../drawerKit"
import { X, Y, Z, addFaceHole, dowelJoint, dowelsAlong, neg, placement, r } from "../geometry"
import { fitSizes, mismatchMessage, type ZoneRect } from "../layout"
import { FrontsBuilder } from "./fronts"
import { edges, frontMaterialOf, drawerBottomMaterial, snapAutoHeights } from "./helpers"
import type { VerticalRef, HandleChoice } from "./types"
import { fmtNum } from "../../../lib/format"

/** On comencen els suplements dels calaixos interiors, des del davant de la caixa (mm): darrere de la placa de la frontissa. */
const SHIM_FROM_FRONT = 60

/** L'amplada mínima que han de deixar els suplements als calaixos interiors (mm). */
const MIN_INNER_DRAWER_W = 150

/** Calaixos: fronts, caixes de fusta i jocs paramètrics. */
export class DrawersBuilder extends FrontsBuilder {
  /** Calaixos interiors en construcció (`buildInnerDrawers`): on és la cara dels seus fronts (Z del mòdul). */
  private inner: { faceZ: number; metalFront: boolean; glass?: boolean } | null = null
  /** Fronts de calaix de vidre (`glass`) per fer-los la finestra quan ja tenen tots els forats (`glassWindows`). */
  private glassFronts: { panel: Panel; x0: number; yTop: number; zFace: number; zoneId: string; w: number; h: number }[] = []
  private innerShims = 0

  /**
   * **Calaixos interiors** (`Zone.innerDrawers`): a baix de tot del compartiment, darrere de la porta. Els calaixos de
   * sempre (caixa de fusta o joc) amb un **front interior baix** (el cos, de l'amplada i l'alçada de la caixa; sense
   * tirador) retirat `setback` del davant de la caixa i, a cada costat amb frontisses, un **suplement** (tira del cos de
   * `shim` mm, de l'alçada dels calaixos, cargolada al lateral) on van els forats de la guia. Torna on acaben (Y), per
   * repartir-hi els prestatges per sobre.
   */
  protected buildInnerDrawers(zone: Zone, inner: NonNullable<Zone["innerDrawers"]>, rect: ZoneRect, left: VerticalRef | undefined, right: VerticalRef | undefined, hinges: ReadonlySet<"left" | "right">): number {
    const { m, d } = this
    const c = m.carcass
    const bg = m.fronts.betweenGap
    const hs = innerDrawerHeights(inner)
    const want = r(hs.reduce((a, b) => a + b, 0) + (inner.n - 1) * bg)
    if (want > rect.y1 - rect.y0 + 0.5)
      this.warnings.push({ code: "layout", message: `Els ${inner.n} calaixos interiors fan ${fmtNum(want, 1)} mm i el compartiment ${fmtNum(rect.y1 - rect.y0, 1)}: l'últim es fa més baix. Posa'n menys o fes-los més baixos.`, zoneId: zone.id })
    const y1 = r(Math.min(rect.y1, rect.y0 + want))
    const faceZ = r(d.D - (inner.setback ?? 25))
    // Suplements al costat de les frontisses: la guia s'hi cargola (el calaix és més estret i no topa amb la frontissa).
    // Comencen a `SHIM_FROM_FRONT` del davant de la caixa: davant hi ha la placa de la frontissa (hipòtesi: placa a 37 mm
    // i cargols a ±16, fins a uns 55 mm del cantell).
    const zRear = this.rearAt(rect.x0, rect.x1)
    const shimFront = r(Math.min(faceZ, d.D - SHIM_FROM_FRONT))
    const shim = (side: "left" | "right", ref: VerticalRef, spec: InnerShim): VerticalRef => {
      this.innerShims += 1
      const S = spec.thickness
      const sideName = side === "left" ? "esquerre" : "dret"
      const depth = r(shimFront - zRear)
      const H = r(y1 - rect.y0)
      const t = c.thickness
      // Fins a dos gruixos del cos, una tira massissa; més gruixut, una caixa (per decisió de l'usuari, 2026-10-20: «el
      // suplement ha de ser un mecanitzat, una caixa, tapat o amb prestatges»): la pell on es cargola la guia (els seus
      // forats), la tapa de dalt i, tapada, el davant o, oberta, prestatges; el lateral del moble fa de fons.
      if (S < 2 * t) {
        const x = side === "left" ? ref.xR : ref.xL - S
        const panel = this.add(
          this.basePanel(`inner-shim-${this.innerShims}-${side}`, "suplement", `Suplement dels calaixos interiors (${sideName})`, "spacer", depth, H, S, c.material, "x", edges("top"), placement([x, rect.y0, zRear], Z, Y, X, side === "left" ? X : neg(X))),
        )
        return { panel, xL: x, xR: r(x + S), yB: rect.y0, yT: y1, zRear, zFront: shimFront, outer: false }
      }
      const id = `inner-shim-${this.innerShims}-${side}`
      const assembly = `Suplement dels calaixos interiors (${sideName}, caixa)`
      const piece = (pid: string, code: string, label: string, L: number, Wd: number, eb: EdgeBanding, pl: Panel["placement"]) =>
        this.add({ ...this.basePanel(pid, code, `${label} del suplement dels calaixos interiors (${sideName})`, "spacer", L, Wd, t, c.material, "x", eb, pl), assembly })
      const skinX = side === "left" ? r(ref.xR + S - t) : r(ref.xL - S)
      // L'espai de dins de la caixa (entre el lateral i la pell).
      const xi0 = side === "left" ? ref.xR : r(skinX + t)
      const inW = r(S - t)
      const skin = piece(id, "suplement", "Pell", depth, H, edges("top"), placement([skinX, rect.y0, zRear], Z, Y, X, side === "left" ? X : neg(X)))
      piece(`${id}-top`, "tapa suplement", "Tapa", inW, depth, edges("bottom"), placement([xi0, r(y1 - t), shimFront], X, neg(Z), Y, Y))
      if (spec.box === "shelves") {
        const n = spec.shelves ?? 1
        const room = y1 - t - rect.y0
        for (let k = 1; k <= n; k++)
          piece(`${id}-shelf-${k}`, "prestatge suplement", `Prestatge ${k}`, inW, depth, edges("bottom"), placement([xi0, r(rect.y0 + (k * room) / (n + 1) - t / 2), shimFront], X, neg(Z), Y, Y))
      } else piece(`${id}-front`, "davant suplement", "Davant", inW, r(H - t), edges("left", "right"), placement([xi0, rect.y0, r(shimFront - t)], X, Y, Z, Z))
      return { panel: skin, xL: skinX, xR: r(skinX + t), yB: rect.y0, yT: y1, zRear, zFront: shimFront, outer: false }
    }
    // Cada costat el seu (per decisió de l'usuari, 2026-10-20); sense triar, el gruix del cos a les frontisses.
    const specL = innerShimOf(inner, "left", hinges.has("left"), c.thickness)
    const specR = innerShimOf(inner, "right", hinges.has("right"), c.thickness)
    const L = specL.thickness > 0 && left ? shim("left", left, specL) : left
    const R = specR.thickness > 0 && right ? shim("right", right, specR) : right
    // Sense suplement al costat de les frontisses, el braç i la placa de la frontissa topen amb els calaixos.
    for (const side of hinges)
      if ((side === "left" ? L === left : R === right) && (side === "left" ? left : right))
        this.warnings.push({ code: "inner-drawers", message: `Calaixos interiors sense suplement al costat de les frontisses (${side === "left" ? "esquerra" : "dreta"}): el braç i la placa de la frontissa hi topen en obrir. Posa-hi el suplement (el gruix del cos).`, zoneId: zone.id })
    if (L !== left || R !== right)
      if (!this.warnings.some((w) => w.code === "inner-drawers" && w.message.includes("es cargola")))
        this.warnings.push({ code: "inner-drawers", info: true, message: `Calaixos interiors: el suplement (${[L !== left ? specL.thickness : 0, R !== right ? specR.thickness : 0].filter((x) => x > 0).map((x) => `${fmtNum(x, 1)} mm`).join(" i ")}) es cargola al lateral pel costat de dins abans de posar-hi la guia; de dos gruixos del cos o més, és una caixa.`, zoneId: zone.id })
    const box: ZoneRect = { ...rect, x0: L !== left ? L!.xR : rect.x0, x1: R !== right ? R!.xL : rect.x1, y1 }
    // El suplement pot ser tan gruixut com vulguis (per decisió de l'usuari, 2026-10-20: «si l'amplada del moble ho
    // permet»): si als calaixos no els queda lloc, s'avisa.
    if (box.x1 - box.x0 < MIN_INNER_DRAWER_W)
      this.warnings.push({ code: "inner-drawers", message: `Els suplements dels calaixos interiors deixen ${fmtNum(Math.max(0, box.x1 - box.x0), 1)} mm per als calaixos (com a mínim ${MIN_INNER_DRAWER_W}): fes-los més prims.`, zoneId: zone.id })
    const front: Extract<Front, { kind: "drawers" }> = {
      kind: "drawers",
      n: inner.n,
      heights: [...hs.slice(0, inner.n - 1), "auto"],
      ...(inner.hardware ? { hardware: inner.hardware } : {}),
      ...(inner.kit ? { kit: inner.kit } : {}),
      ...(inner.drawerSlides ? { drawerSlides: inner.drawerSlides } : {}),
    }
    const own = this.drawerHeights[zone.id]
    this.inner = { faceZ, metalFront: inner.front === "kit", ...(inner.glass ? { glass: true } : {}) }
    try {
      this.buildDrawers(zone, front, box, box, L, R)
    } finally {
      this.inner = null
      // Les alçades «Auto» de l'inspector són les dels calaixos de fora, no les d'aquests.
      if (own) this.drawerHeights[zone.id] = own
      else delete this.drawerHeights[zone.id]
    }
    return y1
  }

  /** El front interior d'un calaix interior: del cos, de l'amplada i l'alçada de la caixa, sense tirador. */
  private addInnerFront(k: number, x0: number, y0: number, w: number, h: number, zoneId: string): Panel {
    const { d } = this
    const panel = this.add(
      this.basePanel(`drawer-${k}-front`, "frontal interior", `Front interior calaix ${k}`, "drawerFront", r(w), r(h), d.t, this.m.carcass.material, "x", edges("bottom", "top", "left", "right"), placement([r(x0), r(y0 + h), this.inner!.faceZ], X, neg(Y), neg(Z), Z)),
    )
    if (this.inner!.glass) this.glassFronts.push({ panel, x0: r(x0), yTop: r(y0 + h), zFace: this.inner!.faceZ, zoneId, w: r(w), h: r(h) })
    return panel
  }

  /**
   * **Fronts de calaix de vidre** (per petició de l'usuari, 2026-10-20: «frontals de vidre», com els calaixos de l'armari
   * de la foto): el front es fa de marc d'una sola peça de fusta, amb la finestra calada i un galze a la cara de darrere
   * (cara A) on s'encola el vidre. Els travessers i els muntants cobreixen tots els forats i ranures que ja té el front
   * (tirador, espigues de la caixa, ranura del fons, suports del joc) amb 15 mm de marge; com a mínim 40 mm (60 a baix).
   */
  protected glassWindows(): void {
    const G = 4
    for (const { panel, x0, yTop, zFace, zoneId, w, h } of this.glassFronts) {
      // Coordenades locals: u sobre el costat llarg. Un front més alt que ample té u en vertical (des de dalt) i v en
      // horitzontal; aquí es treballa en (horitzontal, vertical des de dalt) i es torna a la peça amb `loc`.
      const rot = Math.abs(panel.length - w) > 0.01
      const fr = (u: number, v: number): [number, number] => (rot ? [v, u] : [u, v])
      const loc = (x: number, y: number, ww: number, hh: number) => (rot ? { x: y, y: x, w: hh, h: ww } : { x, y, w: ww, h: hh })
      let side = 40, top = 40, bottom = 60
      // Cada forat eixampla el travesser o el muntant que té més a prop.
      const need = (x: number, y: number) => {
        const near = Math.min(x, w - x, y, h - y)
        if (near === y) top = Math.max(top, y + 15)
        else if (near === h - y) bottom = Math.max(bottom, h - y + 15)
        else side = Math.max(side, near + 15)
      }
      for (const hole of panel.holes) need(...fr(hole.x, hole.y))
      // Una ranura llarga (la del fons) només compta pel seu cantell més a prop del mig en alçada.
      for (const g of panel.grooves) {
        const [, gy] = fr(g.x, g.y)
        const gh = rot ? g.w : g.h
        if (gy + gh / 2 < h / 2) top = Math.max(top, gy + gh + 15)
        else bottom = Math.max(bottom, h - gy + 15)
      }
      const ww = r(w - 2 * side)
      const wh = r(h - top - bottom)
      if (ww < 40 || wh < 40) {
        this.warnings.push({ code: "layout", message: `${panel.label}: és massa petit per a un front de vidre (la finestra faria ${fmtNum(Math.max(0, ww), 1)} × ${fmtNum(Math.max(0, wh), 1)} mm). Es fa de fusta.`, zoneId })
        continue
      }
      ;(panel.cutouts ??= []).push({ kind: "rect", ...loc(r(side), r(top), ww, wh), tag: "glass" })
      panel.grooves.push({ ...loc(r(side - 10), r(top - 10), r(ww + 20), r(wh + 20)), depth: G + 1, face: "A", tag: "glass-rebate" })
      this.extras.push({
        id: `${panel.id}-glass`,
        name: "vidre calaix",
        label: `${panel.label} (vidre)`,
        role: "part",
        length: r(wh + 18),
        width: r(ww + 18),
        thickness: G,
        material: "Vidre",
        grain: "none",
        edges: { ...NO_EDGES },
        holes: [],
        grooves: [],
        placement: placement([r(x0 + side - 9), r(yTop - top - wh - 9), r(zFace - this.d.t + G + 0.5)], Y, X, neg(Z), Z),
      })
    }
    if (this.glassFronts.length)
      this.warnings.push({ code: "layout", info: true, message: `Fronts de calaix de vidre: vidre de ${G} mm encolat al galze de darrere del marc (silicona neutra). El vidre no és de CNC: surt a «Elements sense nesting».` })
    this.glassFronts = []
  }

  /** Alçades i Y de baix de cada front d'una pila de calaixos (l'últim «auto» es queda el que sobra; iguals a mig mm). */
  protected drawerLayout(zone: Zone, front: Extract<Front, { kind: "drawers" }>, ter: ZoneRect): { heights: number[]; ys: number[] } {
    const n = front.n
    const bg = this.m.fronts.betweenGap
    const sizes = front.heights.slice(0, n)
    while (sizes.length < n) sizes.push("auto")
    // Com les zones: l'últim auto es queda el que sobra; sense cap «auto», l'últim s'ajusta (i s'avisa).
    const fit = fitSizes(ter.y1 - ter.y0, sizes, bg)
    const heights = snapAutoHeights(fit.sizes, sizes)
    if (fit.mismatch !== null)
      this.warnings.push({ code: "layout", message: mismatchMessage("Les alçades dels fronts dels calaixos", fit.mismatch, r(ter.y1 - ter.y0), heights.at(-1)!), zoneId: zone.id })
    if (heights.some((h) => h <= 0)) this.warnings.push({ code: "layout", message: `Els ${n} calaixos no hi caben: algun front no té alçada.`, zoneId: zone.id })
    this.drawerHeights[zone.id] = heights
    const ys: number[] = []
    for (let i = 0, yy = ter.y0; i < n; i++) {
      ys.push(yy)
      yy = r(yy + heights[i]! + bg)
    }
    return { heights, ys }
  }

  /** El front d'un calaix (cara A cap a dins, x local = amplada) amb el tirador (centrat o a dalt) i, si toca, els inglets. */
  protected addDrawerFront(k: number, ter: ZoneRect, y: number, fh: number, handleHw: HandleChoice, zone: Zone): Panel {
    const { d } = this
    const c = this.m.carcass
    const fw = r(ter.x1 - ter.x0)
    // A inglet amb els laterals: el costat que arriba a fora del moble, tallat a 45°.
    const mL = d.mitreFronts && ter.x0 <= 0.01 && c.sides.left
    const mR = d.mitreFronts && ter.x1 >= d.W - 0.01 && c.sides.right
    // Primer i últim calaix: també a inglet amb la tapa i la base (y local cap avall: el
    // cantell de dalt és «bottom» i el de baix, «top»).
    const mT = d.mitreFronts && d.mitreTop && y + fh >= d.H - 0.01
    const mB = d.mitreFronts && d.mitreBottom && y <= d.baseY + 0.01
    const frontPanel = this.add({
      ...this.basePanel(`drawer-${k}-front`, "frontal calaix", `Front calaix ${k}`, "drawerFront", fw, fh, d.t, frontMaterialOf(this.m), "x", edges(...(mT ? [] : (["bottom"] as const)), ...(mB ? [] : (["top"] as const)), ...(mL ? [] : (["left"] as const)), ...(mR ? [] : (["right"] as const))), placement([ter.x0, y + fh, d.frontZ], X, neg(Y), neg(Z), Z)),
      ...(mL || mR || mT || mB ? { mitres: [...(mL ? (["left"] as const) : []), ...(mR ? (["right"] as const) : []), ...(mT ? (["bottom"] as const) : []), ...(mB ? (["top"] as const) : [])] } : {}),
    })
    // Tirador centrat (x local = amplada, y local = cap avall).
    // Centrat o a `handleTop` mm del cantell de dalt (y local cap avall), mai per sota del mig.
    const top = zone.front?.kind === "drawers" ? zone.front.handleTop : undefined
    // De vidre: el tirador al travesser de dalt (si no se n'ha triat l'alçada).
    const glass = zone.front?.kind === "drawers" && !!zone.front.glass
    this.handle(frontPanel, fw / 2, top !== undefined ? Math.min(top, fh / 2) : glass ? Math.min(GLASS_HANDLE_TOP, fh / 2) : fh / 2, "x", handleHw, zone.id)
    if (glass) this.glassFronts.push({ panel: frontPanel, x0: r(ter.x0), yTop: r(y + fh), zFace: d.frontZ, zoneId: zone.id, w: fw, h: r(fh) })
    return frontPanel
  }

  protected buildDrawers(
    zone: Zone,
    front: Extract<Front, { kind: "drawers" }>,
    rect: ZoneRect,
    ter: ZoneRect,
    left: VerticalRef | undefined,
    right: VerticalRef | undefined,
  ): void {
    const { m, d } = this
    const c = m.carcass
    // La guia triada al calaix (si no, la del mòdul). Un joc paramètric de calaix de doble paret (DTC MAGIC-PRO), triat
    // al calaix o com a guia del mòdul: cap lateral de fusta; el joc mana.
    const slideHw = this.frontHardware("slide", front.hardware, zone.id)
    if (isDrawerKit(slideHw.item)) {
      // El tancament del joc mana: push-open ⇒ cap tirador (el push el posa el joc).
      const kitPush = isPushClosing(kitOptionsOf(slideHw.item.kit, front.kit).closing)
      this.buildKitDrawers(zone, front, slideHw.item, rect, ter, left, right, this.inner ? null : this.frontHandle(front.handle, zone.id, kitPush))
      return
    }
    // El tirador triat al calaix (si no, el del mòdul).
    const handleHw = this.inner ? null : this.frontHandle(front.handle, zone.id)
    // Llargades, jocs, caixa i forats de la guia.
    const hw = slideHw.spec
    const n = front.n
    const { heights, ys } = this.drawerLayout(zone, front, ter)

    const boxW = r(rect.x1 - rect.x0 - 2 * hw.sideClearance)
    // Amb el front encastat, la caixa del calaix comença un gruix més endins.
    // Una columna pel darrere: la fondària que queda davant del seu fons.
    // Un calaix interior: des de la cara de darrere del seu front interior (retirat).
    const maxLen = d.availDepth - (this.rearAt(rect.x0, rect.x1) - d.backInnerZ) - hw.backClearance - (this.inner ? d.D - this.inner.faceZ + d.t : d.inset ? d.t : 0)
    const slide = [...hw.slideLengths].sort((a, b) => b - a).find((l) => l <= maxLen)
    if (slide === undefined) {
      this.warnings.push({ code: "drawer-no-slide", message: `Cap guia de calaix (${hw.slideLengths.join(", ")}) cap en ${r(maxLen)} mm de fondària útil.`, zoneId: zone.id })
    }
    const boxL = slide ?? r(maxLen)
    const bt = hw.boxThickness
    const tbb = hw.bottomThickness
    const g = c.grooveDepth
    const bottomMat = c.drawerBottomMaterial ? { name: c.drawerBottomMaterial, warn: false } : drawerBottomMaterial(c.backMaterial, c.backThickness, tbb)
    if (n > 0 && bottomMat.warn && !this.warnings.some((w) => w.code === "drawer-bottom"))
      this.warnings.push({ code: "drawer-bottom", message: `Fons del calaix de ${tbb} mm en «${bottomMat.name}» (${c.back === "none" ? `sense fons al mòdul, surt del material del cos, de ${c.thickness} mm` : `surt del fons del mòdul, de ${c.backThickness} mm`}): comprova que aquest material es ven en ${tbb} mm, o tria'n un a Materials › «Fons del calaix».`, zoneId: zone.id })

    // Caixa de cada calaix (relativa a la vora de baix del front): centrada al front (`boxDrop`) però sempre dins de la
    // llum (el front del primer i de l'últim calaix sobresurt per sobre de la tapa o la base i la caixa hi toparia). Els
    // fronts iguals fan servir la mateixa caixa (la més justa del grup): així tenen exactament els mateixos mecanitzats
    // i el taller, que casa les peces per mida, no en barreja dos de diferents.
    const box = heights.map((fh, i) => ({
      lo: Math.max(hw.boxDrop / 2, rect.y0 + 1 - ys[i]!),
      hi: Math.min(fh - hw.boxDrop / 2, rect.y1 - 1 - ys[i]!),
    }))
    // Iguals a mig mil·límetre (com els agrupa el taller i `sameSize`): l'últim «auto» pot fer 0,01 mm més.
    const groupOf = (fh: number) => String(Math.round(fh * 2) / 2)
    const shared = new Map<string, { lo: number; hi: number }>()
    heights.forEach((fh, i) => {
      const k = groupOf(fh)
      const cur = shared.get(k)
      shared.set(k, cur ? { lo: Math.max(cur.lo, box[i]!.lo), hi: Math.min(cur.hi, box[i]!.hi) } : { ...box[i]! })
    })
    // Alçada mínima de la caixa: el fons en ranura i una mica de lateral per sobre (si no, no es fa: només el front).
    const minBox = hw.bottomOffset + tbb + 30
    let lowBox: number | null = null
    let noDowel = false
    // Amplada mínima: el darrere entre laterals ha de poder rebre les espigues de tots dos costats (20 mm cadascuna).
    const minInner = 2 * 20 + 10
    const narrowBox = boxW - 2 * bt < minInner
    if (n > 0 && narrowBox)
      this.warnings.push({ code: "drawer-box", message: `Calaixos massa estrets: entre els laterals de la caixa només queden ${fmtNum(boxW - 2 * bt, 1)} mm (en calen ${fmtNum(minInner, 1)}). No es fa la caixa (només el front).`, zoneId: zone.id })

    for (let i = 0; i < n; i++) {
      this.drawerCount += 1
      const k = this.drawerCount
      const fh = heights[i]!
      const y = ys[i]!
      // El front de sempre (el territori, amb el tirador), també si la caixa no s'hi pot fer; el d'un calaix interior,
      // de la mida de la caixa (més avall).
      const outerFront = handleHw ? this.addDrawerFront(k, ter, y, fh, handleHw, zone) : null
      const sb = shared.get(groupOf(fh))!
      const boxH = r(sb.hi - sb.lo)
      if (boxH < minBox) {
        lowBox = lowBox === null ? boxH : Math.min(lowBox, boxH)
        continue
      }
      if (narrowBox) continue
      const boxY0 = r(y + sb.lo)
      const boxX0 = r(rect.x0 + hw.sideClearance)
      const frontPanel = outerFront ?? this.addInnerFront(k, boxX0, boxY0, boxW, boxH, zone.id)
      const fx0 = handleHw ? ter.x0 : boxX0
      const fTop = handleHw ? y + fh : boxY0 + boxH
      const zFront = (this.inner ? this.inner.faceZ : d.frontZ) - d.t // cara posterior del front
      const zBack = r(zFront - boxL)
      // Laterals de la caixa (cara A cap a dins de la caixa), amb ranura per al fons.
      const sideGroove = { x: 0, y: hw.bottomOffset, w: boxL, h: tbb, depth: g, face: "A" as const, tag: "drawer-bottom" }
      const sideL = this.add({
        ...this.basePanel(`drawer-${k}-side-left`, "lateral calaix", `Lateral calaix ${k}`, "drawerSide", boxL, boxH, bt, c.material, "x", edges("top"), placement([boxX0, boxY0, zBack], Z, Y, X, neg(X))),
        grooves: [sideGroove],
      })
      const sideR = this.add({
        ...this.basePanel(`drawer-${k}-side-right`, "lateral calaix", `Lateral calaix ${k}`, "drawerSide", boxL, boxH, bt, c.material, "x", edges("top"), placement([boxX0 + boxW, boxY0, zFront], neg(Z), Y, neg(X), X)),
        grooves: [{ ...sideGroove }],
      })
      // Darrere: entre laterals, sobre el fons.
      const backY0 = boxY0 + hw.bottomOffset + tbb
      const backH = r(boxH - hw.bottomOffset - tbb)
      const back = this.add(
        this.basePanel(`drawer-${k}-back`, "darrere calaix", `Darrere calaix ${k}`, "drawerBack", boxW - 2 * bt, backH, bt, c.material, "x", edges("top"), placement([boxX0 + bt, backY0, zBack + bt], X, Y, neg(Z), neg(Z))),
      )
      // Fons: en ranura als laterals i al front.
      const bottomW = r(boxW - 2 * bt + 2 * g - 1)
      const bottomL = r(boxL + g - 1)
      this.add(
        this.basePanel(`drawer-${k}-bottom`, "fons calaix", `Fons calaix ${k}`, "drawerBottom", bottomW, bottomL, tbb, bottomMat.name, "none", { ...NO_EDGES }, placement([boxX0 + bt - g + 0.5, boxY0 + hw.bottomOffset, zFront + g - 0.5], X, neg(Z), Y, neg(Y))),
      )
      // Ranura al front per al fons (cara A = darrere del front).
      frontPanel.grooves.push({ x: r(boxX0 + bt - g - fx0), y: r(fTop - (boxY0 + hw.bottomOffset + tbb)), w: r(boxW - 2 * bt + 2 * g), h: tbb, depth: g, face: "A", tag: "drawer-bottom" })
      // Espigues: laterals → front (topen), darrere → laterals (topa). Dues a 30 / 20 mm dels extrems si hi caben; si
      // la caixa és baixa, una al mig (`dowelsAlong`).
      const dowel = { diameter: hw.boxThickness >= 16 ? 8 : 6, faceDepth: 10, edgeDepth: 20 }
      const frontYs = dowelsAlong(boxY0, boxY0 + boxH, 30, dowel.diameter)
      const backYs = dowelsAlong(backY0, boxY0 + boxH, 20, dowel.diameter)
      for (const [xs, sidePanel] of [[boxX0 + bt / 2, sideL], [boxX0 + boxW - bt / 2, sideR]] as [number, Panel][]) {
        const a = dowelJoint(sidePanel, frontPanel, frontYs.map((yy): Vec3 => [r(xs), r(yy), zFront]), dowel)
        const b = dowelJoint(back, sidePanel, backYs.map((yy): Vec3 => [r(xs < boxX0 + bt ? boxX0 + bt : boxX0 + boxW - bt), r(yy), r(zBack + bt / 2)]), dowel)
        if (!a || !b) noDowel = true
      }
      // Forats de guia: al lateral del moble (Ø5 P12) i al lateral de la caixa (Ø4 P10).
      // Des de la cara de darrere del front (encastat: un gruix més endins que el recobrent).
      // Els números i els forats (Ø, fondària) són de la guia (la triada al calaix o la del mòdul).
      const zs = [zFront - hw.frontOffset, zFront - hw.frontOffset - hw.secondOffset].filter((z) => z > zBack)
      const ySlide = r(boxY0 + hw.holeHeight)
      const boxR = hw.box.diameter / 2
      for (const [ref, sidePanel, xBox] of [[left, sideL, boxX0], [right, sideR, boxX0 + boxW]] as [VerticalRef | undefined, Panel, number][]) {
        for (const z of zs) {
          if (ref) addFaceHole(ref.panel, [ref === left ? ref.xR : ref.xL, ySlide, r(z)], hw.side)
          // Si cau a l'alçada de la ranura del fons (per l'altra cara), no pot arribar-hi: es
          // limita la fondària perquè quedi 1 mm de matèria.
          const inGroove = ySlide - boxR < boxY0 + hw.bottomOffset + tbb && ySlide + boxR > boxY0 + hw.bottomOffset
          addFaceHole(sidePanel, [xBox, ySlide, r(z)], { ...hw.box, depth: inGroove ? Math.min(hw.box.depth, r(bt - g - 1)) : hw.box.depth })
        }
      }
    }
    if (lowBox !== null)
      this.warnings.push({
        code: "drawer-box",
        message: `Calaixos massa baixos: la caixa faria ${fmtNum(lowBox, 1)} mm d'alçada i en calen almenys ${fmtNum(minBox, 1)} (fons a ${fmtNum(hw.bottomOffset, 1)} mm + ${fmtNum(tbb, 1)} mm de fons + 30). No es fa la caixa (només el front): fes els fronts més alts o posa'n menys.`,
        zoneId: zone.id,
      })
    if (noDowel)
      this.warnings.push({ code: "drawer-box", message: "Caixa del calaix massa baixa per a les espigues: alguna unió queda sense espiga (cal cargolar-la).", zoneId: zone.id })
  }

  /**
   * Calaixos amb un **joc paramètric de doble paret** (`drawerKit`, `core/build/drawerKit.ts`): el front de sempre i, per
   * cada calaix, el pla del joc (`planKit`: la NL més gran que hi cap darrere del front, components amb el número
   * d'article, fons A i darrere B per fórmula, prebroques). **Cap lateral de fusta.** Peces: el fons (del material del
   * fons dels calaixos, gruix del joc) i el darrere (del tauler del cos); mecanitzats: prebroques Ø2 × 10 dels cargols de
   * la guia als dos laterals del moble (mirall), dels suports de davant al darrere del front i dels de darrere al darrere.
   * Els components van a `extras` com a peces de només veure (rol `hardware`, `drawer-<k>-kit-…`: el visor les mou amb el
   * calaix) i la comanda a `hardwareKits`. **Tot o res** per calaix: sense NL que hi càpiga, sense lateral del moble a un
   * costat o sense lloc en alçada, només el front i avís `hardware`. La vora inferior de la guia va a `baseAboveFront`
   * del cantell de baix del front (hipòtesi del catàleg) i, si cal, puja perquè el joc quedi dins de la llum.
   */
  protected buildKitDrawers(
    zone: Zone,
    front: Extract<Front, { kind: "drawers" }>,
    item: HardwareItem,
    rect: ZoneRect,
    ter: ZoneRect,
    left: VerticalRef | undefined,
    right: VerticalRef | undefined,
    /** `null`: calaixos interiors (front interior, sense tirador). */
    handleHw: HandleChoice | null,
  ): void {
    const { m, d } = this
    const c = m.carcass
    const { heights, ys } = this.drawerLayout(zone, front, ter)
    const LW = r(rect.x1 - rect.x0)
    const zFront = (this.inner ? this.inner.faceZ : d.frontZ) - d.t // cara posterior del front
    // Fondària darrere del front fins al fons del moble (encastat: el front ja és dins de la llum).
    const depth = r(zFront - this.rearAt(rect.x0, rect.x1))
    const TB = kitBottomThickness(item)
    const res = planKit(item, { LW, depth, G: c.thickness, TB, options: front.kit })
    for (const w of res.warnings) this.hardwareWarning(w, zone.id)
    const plan = res.plan
    // El gruix del fons el demana el joc (16, `TB`): no és cap tria del moble ni s'hi suggereix res; només s'avisa si
    // el material del fons no se sap si es ven en aquest gruix.
    const bottomMat = c.drawerBottomMaterial ? { name: c.drawerBottomMaterial, warn: false } : c.thickness === TB ? { name: c.material, warn: false } : drawerBottomMaterial(c.backMaterial, c.backThickness, TB)
    if (plan && front.n > 0 && bottomMat.warn && !this.warnings.some((w) => w.code === "drawer-bottom"))
      this.warnings.push({ code: "drawer-bottom", message: `Fons del calaix de ${TB} mm en «${bottomMat.name}» (el joc «${item.name}» demana un fons del calaix de ${TB} mm; ${c.back === "none" ? `sense fons al mòdul, surt del material del cos, de ${c.thickness} mm` : `surt del fons del mòdul, de ${c.backThickness} mm`}): comprova que aquest material es ven en ${TB} mm, o tria'n un a Materials › «Fons del calaix».`, zoneId: zone.id })
    if (plan && (!left || !right)) this.hardwareWarning(`«${item.name}»: el compartiment no té lateral a ${!left ? "l'esquerra" : "la dreta"} on cargolar la guia. Els calaixos es queden només amb el front.`, zone.id)
    // Vora inferior de la guia de cada calaix: a `baseAboveFront` del cantell de baix del front, dins de la llum (1 mm).
    const slideBase = (i: number, kit: HardwareKit) => r(Math.max(ys[i]! + kit.rules.baseAboveFront, rect.y0 + 1))
    // Fins on pot arribar el joc: l'últim, sota la tapa (1 mm); els altres, fins a la guia del de sobre.
    const kitTop = (i: number, kit: HardwareKit) => (i === front.n - 1 ? rect.y1 - 1 : slideBase(i + 1, kit))
    const fits = (i: number, kit: HardwareKit) => slideBase(i, kit) + kitHeight(kit) <= kitTop(i, kit) + 0.01
    // L'alçada del calaix mana (per decisió de l'usuari): si el joc triat no hi cap, el més alt de la mateixa sèrie que
    // sí que hi cap (MAGIC-PRO K → M → N), amb els mateixos números de l'item (prebroca) i les mateixes opcions.
    // La guia de cada calaix (per decisió de l'usuari, 2026-10-14): el primer, la «Guia de calaix»; cada un dels altres, la
    // seva (`front.drawerSlides[i]`, un joc) o, sense, la del calaix de sota. Triar-ne una canvia aquell i els de sobre.
    const slideOf: HardwareItem[] = []
    for (let i = 0, prev = item; i < front.n; i++) {
      const own = i > 0 ? front.drawerSlides?.[i] : undefined
      if (own && isDrawerKit(own)) prev = own
      slideOf.push(prev)
    }
    // Pla de cada joc (un cop per item) i els de la seva sèrie més baixos.
    const plans = new Map<HardwareItem, { plan: KitPlan | null; lower: { sib: HardwareItem; plan: KitPlan }[] }>()
    const planOf = (it: HardwareItem) => {
      let got = plans.get(it)
      if (!got) {
        const tb = kitBottomThickness(it)
        const own = it === item ? res : planKit(it, { LW, depth, G: c.thickness, TB: tb, options: front.kit })
        if (it !== item) for (const w of own.warnings) this.hardwareWarning(w, zone.id)
        // L'alçada del calaix mana (per decisió de l'usuari): si el joc no hi cap, el més alt de la mateixa sèrie que
        // sí que hi cap (MAGIC-PRO K → M → N), amb els mateixos números de l'item (prebroca) i les mateixes opcions.
        const lower = own.plan ? kitFamily(it).flatMap((sib) => {
          const sp = planKit(sib, { LW, depth, G: c.thickness, TB: kitBottomThickness(sib), options: front.kit }).plan
          return sp ? [{ sib, plan: sp }] : []
        }) : []
        got = { plan: own.plan, lower }
        plans.set(it, got)
      }
      return got
    }
    for (let i = 0; i < front.n; i++) {
      this.drawerCount += 1
      const k = this.drawerCount
      const fh = heights[i]!
      const y = ys[i]!
      // El front de sempre ara; el front interior, quan se sap el joc (fa l'alçada del joc).
      const outerFront = handleHw ? this.addDrawerFront(k, ter, y, fh, handleHw, zone) : null
      const chosen = slideOf[i]!
      const { plan: own, lower } = planOf(chosen)
      if (!own || !left || !right) continue
      const pick = fits(i, own.kit) ? { sib: chosen, plan: own } : lower.find((x) => fits(i, x.plan.kit))
      if (!pick) {
        const least = lower.at(-1)
        this.hardwareWarning(`«${chosen.name}» no cap al calaix ${k} (front de ${fmtNum(fh, 1)} mm)${least ? `, ni tampoc el joc més baix de la sèrie («${least.sib.name}», ${fmtNum(kitHeight(least.plan.kit), 1)} mm d'alçada)` : ""}: només es fa el front. Fes més alt el front, posa menys calaixos o tria una guia més baixa per a aquest calaix.`, zone.id)
        continue
      }
      const kitItemUsed = pick.sib
      const kitPlan = pick.plan
      const kit = kitPlan.kit
      const y0 = slideBase(i, kit)
      // Calaix interior: el front interior entre els laterals del joc (2 mm de joc a cada costat), fins a dalt del joc; amb
      // el front metàl·lic del fabricant, cap peça de fusta al davant (ni els seus forats).
      const frontPanel = outerFront ?? (this.inner?.metalFront ? null : this.addInnerFront(k, rect.x0 + 2, y, LW - 4, y0 - y + kitHeight(kit), zone.id))
      const at = { x0: rect.x0, y0, zFront }
      const pilot = kitPlan.pilot
      // Prebroques dels cargols de la guia als dos laterals del moble (el dret, mirall): z des del cantell de davant del
      // lateral (= la cara de darrere del front, amb els fronts recobrents).
      if (pilot) {
        const spec = { ...pilot, tag: "kit-slide" }
        for (const ref of [left, right])
          for (const h of kitPlan.sidePilots) addFaceHole(ref.panel, [ref === left ? ref.xR : ref.xL, r(y0 + h.y), r(zFront - h.z)], spec)
        // Suports de davant: al darrere del front (cara A), a `x` de cada lateral.
        if (frontPanel) for (const h of kitPlan.frontPilots) for (const x of [rect.x0 + h.x, rect.x1 - h.x]) addFaceHole(frontPanel, [r(x), r(y0 + h.y), zFront], { ...pilot, tag: "kit-front" })
      }
      // Fusta: fons A (sobre la guia del lateral) i darrere B (sobre el fons, al final).
      const bottom = kitPlan.wood.find((w) => w.key === "bottom")
      const back = kitPlan.wood.find((w) => w.key === "back")
      const zSlide = zFront - kit.rules.slideSetback
      if (bottom && bottom.depth !== undefined) {
        const bx0 = r(rect.x0 + (LW - bottom.width) / 2)
        this.add(
          this.basePanel(`drawer-${k}-bottom`, "fons calaix", `Fons calaix ${k}`, "drawerBottom", bottom.width, bottom.depth, kitBottomThickness(kitItemUsed), bottomMat.name, "none", { ...NO_EDGES }, placement([bx0, y0 + kit.geometry.bottomBase, zSlide], X, neg(Z), Y, neg(Y))),
        )
      }
      if (back && back.height !== undefined && bottom && bottom.depth !== undefined) {
        const bx0 = r(rect.x0 + (LW - back.width) / 2)
        const yB = r(y0 + kit.geometry.bottomBase + kitBottomThickness(kitItemUsed))
        const zB = r(zSlide - bottom.depth)
        // Cara A cap al darrere del moble (on van els suports): x local = amplada, y local amunt.
        const backPanel = this.add(this.basePanel(`drawer-${k}-back`, "darrere calaix", `Darrere calaix ${k}`, "drawerBack", back.width, back.height, c.thickness, c.material, "x", edges("top"), placement([bx0, yB, zB + c.thickness], X, Y, neg(Z), neg(Z))))
        if (pilot) for (const h of kitPlan.backPilots) for (const x of [bx0 + h.x, bx0 + back.width - h.x]) addFaceHole(backPanel, [r(x), r(yB + h.y), zB], { ...pilot, tag: "kit-back" })
      }
      this.extras.push(...kitSolidPanels(kitPlan, k, at, LW))
      // El front metàl·lic del fabricant: només es veu (no és de CNC), com els components del joc.
      if (!frontPanel && !outerFront) {
        const fh = r(y0 - y + kitHeight(kit))
        this.extras.push(this.basePanel(`drawer-${k}-kit-innerFront`, "front interior metàl·lic", `Front interior metàl·lic calaix ${k}`, "hardware", r(LW - 4), fh, 2, "Acer fosc", "none", { ...NO_EDGES }, placement([r(rect.x0 + 2), r(y + fh), this.inner!.faceZ], X, neg(Y), neg(Z), Z)))
      }
      const lines = frontPanel ? kitPlan.lines : [...kitPlan.lines, { component: "innerFront", name: "Front interior metàl·lic del fabricant", qty: 1, note: `Per a ${fmtNum(LW, 1)} mm de llum: demanar-lo al distribuïdor (no és al catàleg de l'app).` }]
      this.hardwareKits.push({ zoneId: zone.id, drawer: k, item: kitItemUsed.name, kit: `${kit.maker} ${kit.series} ${kit.heightClass.code}`, nl: kitPlan.nl, options: kitPlan.options, lines, wood: kitPlan.wood, ...(kitPlan.rule ? { rule: kitPlan.rule } : {}), ...(kitPlan.syncRod !== undefined ? { syncRod: kitPlan.syncRod } : {}) })
    }
  }
}
