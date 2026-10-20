import {
  NO_EDGES,
  type Front,
  type HardwareItem,
  type HardwareKit,
  type Panel,
  type Vec3,
  type Zone,
  innerDrawerHeights,
  isDrawerKit,
  isPushClosing,
  kitOptionsOf,
} from "../../model"
import { kitBottomThickness, kitFamily, kitHeight, kitSolidPanels, planKit, type KitPlan } from "../drawerKit"
import { X, Y, Z, addFaceHole, dowelJoint, dowelsAlong, neg, placement, r } from "../geometry"
import { fitSizes, mismatchMessage, type ZoneRect } from "../layout"
import { FrontsBuilder } from "./fronts"
import { edges, frontMaterialOf, drawerBottomMaterial, snapAutoHeights } from "./helpers"
import type { VerticalRef, HandleChoice } from "./types"
import { fmtNum } from "../../../lib/format"

/** El vidre dels calaixos de vidre: gruix i distància de la seva ranura al davant dels laterals (mm). */
const GLASS = 4
const GLASS_AT = 8

/** L'amplada mínima dels calaixos interiors (mm). */
const MIN_INNER_DRAWER_W = 150

/** Calaixos: fronts, caixes de fusta i jocs paramètrics. */
export class DrawersBuilder extends FrontsBuilder {
  /** Algun front de calaix de vidre (l'avís informatiu surt un cop). */
  private glassDrawers = false

  /**
   * **Calaixos darrere d'una porta** (`Zone.innerDrawers`, de `visibleZone`): els mateixos Calaixos que a fora (regla 1 del
   * model únic: tirador, vidre, alçades i Retirada), fets darrere de la porta de més amunt. La guia va al lateral o al
   * divisor del costat (el marge per a les frontisses és una zona estreta oberta, no un suplement). Torna on acaben (Y).
   */
  protected buildInnerDrawers(zone: Zone, inner: NonNullable<Zone["innerDrawers"]>, rect: ZoneRect, left: VerticalRef | undefined, right: VerticalRef | undefined, hinges: ReadonlySet<"left" | "right">): number {
    const { m, d } = this
    const bg = m.fronts.betweenGap
    const hs = innerDrawerHeights(inner)
    const want = r(hs.reduce((a, b) => a + b, 0) + (inner.n - 1) * bg)
    // Els Calaixos d'un compartiment tapat per portes (`sizes`): omplen el compartiment, com els de fora.
    if (!inner.sizes && want > rect.y1 - rect.y0 + 0.5)
      this.warnings.push({ code: "layout", message: `Els ${inner.n} calaixos interiors fan ${fmtNum(want, 1)} mm i el compartiment ${fmtNum(rect.y1 - rect.y0, 1)}: l'últim es fa més baix. Posa'n menys o fes-los més baixos.`, zoneId: zone.id })
    const y1 = inner.sizes ? rect.y1 : r(Math.min(rect.y1, rect.y0 + want))
    // Sense suplements (per decisió de l'usuari, 2026-10-20: «0 casos especials»): el marge per a les frontisses és una
    // zona estreta oberta al costat (una divisió; «Marge a les frontisses»), i la guia va al seu divisor. Si la frontissa
    // toca directament els calaixos, s'avisa.
    for (const side of hinges)
      if ((side === "left" ? left : right)?.outer)
        this.warnings.push({ code: "inner-drawers", message: `Calaixos darrere de la porta tocant el lateral de les frontisses (${side === "left" ? "esquerra" : "dreta"}): el braç i la placa de la frontissa hi topen en obrir. Deixa-hi un marge: «Marge a les frontisses» (una zona estreta oberta al costat).`, option: "zone.front.drawers.margin", zoneId: zone.id })
    const box: ZoneRect = { ...rect, y1 }
    if (box.x1 - box.x0 < MIN_INNER_DRAWER_W)
      this.warnings.push({ code: "inner-drawers", message: `Als calaixos interiors els queden ${fmtNum(Math.max(0, box.x1 - box.x0), 1)} mm (com a mínim ${MIN_INNER_DRAWER_W}): fes el compartiment més ample.`, zoneId: zone.id })
    const front: Extract<Front, { kind: "drawers" }> = inner.drawers ? { ...inner.drawers, heights: inner.sizes ?? inner.drawers.heights } : {
      kind: "drawers",
      n: inner.n,
      heights: inner.sizes ?? [...hs.slice(0, inner.n - 1), "auto"],
      ...(inner.hardware ? { hardware: inner.hardware } : {}),
      ...(inner.kit ? { kit: inner.kit } : {}),
      ...(inner.drawerSlides ? { drawerSlides: inner.drawerSlides } : {}),
    }
    const own = this.drawerHeights[zone.id]
    // Darrere d'una porta: el front ha de quedar darrere de la cara de dins de la porta (no es retira sol, per decisió de
    // l'usuari, 2026-10-20: avís a sota de la Retirada).
    const need = r(d.frontZ - d.D + 2)
    if ((front.setback ?? 0) < need)
      this.warnings.push({ code: "inner-drawers", option: "zone.front.drawers.setback", message: `La porta topa amb els calaixos: posa una Retirada de com a mínim ${fmtNum(need, 1)} mm.`, zoneId: zone.id })
    try {
      this.buildDrawers(zone, front, box, box, left, right)
    } finally {
      // Les alçades «Auto» de l'inspector són les dels calaixos de fora, no les d'aquests (els tapats per portes, sí: són
      // els del Front del compartiment).
      if (!inner.sizes) {
        if (own) this.drawerHeights[zone.id] = own
        else delete this.drawerHeights[zone.id]
      }
    }
    return y1
  }

  /** On és la cara dels fronts d'uns calaixos: la dels altres fronts, menys la Retirada. */
  private drawerFaceZ(front: Extract<Front, { kind: "drawers" }>): number {
    return r(this.d.frontZ - (front.setback ?? 0))
  }

  /**
   * On van els fronts d'uns calaixos: els de sempre (`ter`) o, si la Retirada els fa entrar a la caixa, dins de la llum
   * amb la folgança front–cos a cada costat.
   */
  private drawerTerritory(front: Extract<Front, { kind: "drawers" }>, rect: ZoneRect, ter: ZoneRect): ZoneRect {
    if (this.drawerFaceZ(front) - this.d.t >= this.d.D - 0.01) return ter
    const g = this.m.fronts.outerGap
    return { ...rect, x0: r(rect.x0 + g), x1: r(rect.x1 - g), y0: r(rect.y0 + g), y1: r(rect.y1 - g) }
  }

  /** L'avís informatiu dels fronts de calaix de vidre (un cop per mòdul). */
  protected glassDrawersInfo(): void {
    if (this.glassDrawers)
      this.warnings.push({ code: "layout", info: true, message: "Fronts de calaix de vidre: vidre de 4 mm en ranura als laterals del calaix, damunt del fons (amb un joc de calaix, al lloc del front, amb els adaptadors de vidre del fabricant). Els forats del tirador els fa el vidrier. El vidre no és de CNC: surt a «Elements sense nesting»." })
    this.glassDrawers = false
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

  /**
   * El front d'un calaix (cara A cap a dins, x local = amplada) a la seva Retirada, amb el tirador (centrat o a dalt) i,
   * si toca, els inglets (només a ras: retirat, no arriba als laterals).
   */
  protected addDrawerFront(k: number, ter: ZoneRect, y: number, fh: number, handleHw: HandleChoice, front: Extract<Front, { kind: "drawers" }>, zoneId: string): Panel {
    const { d } = this
    const c = this.m.carcass
    const fw = r(ter.x1 - ter.x0)
    const flush = !front.setback
    // A inglet amb els laterals: el costat que arriba a fora del moble, tallat a 45°.
    const mL = flush && d.mitreFronts && ter.x0 <= 0.01 && c.sides.left
    const mR = flush && d.mitreFronts && ter.x1 >= d.W - 0.01 && c.sides.right
    // Primer i últim calaix: també a inglet amb la tapa i la base (y local cap avall: el
    // cantell de dalt és «bottom» i el de baix, «top»).
    const mT = flush && d.mitreFronts && d.mitreTop && y + fh >= d.H - 0.01
    const mB = flush && d.mitreFronts && d.mitreBottom && y <= d.baseY + 0.01
    const frontPanel = this.add({
      ...this.basePanel(`drawer-${k}-front`, "frontal calaix", `Front calaix ${k}`, "drawerFront", fw, fh, d.t, frontMaterialOf(this.m), "x", edges(...(mT ? [] : (["bottom"] as const)), ...(mB ? [] : (["top"] as const)), ...(mL ? [] : (["left"] as const)), ...(mR ? [] : (["right"] as const))), placement([ter.x0, y + fh, this.drawerFaceZ(front)], X, neg(Y), neg(Z), Z)),
      ...(mL || mR || mT || mB ? { mitres: [...(mL ? (["left"] as const) : []), ...(mR ? (["right"] as const) : []), ...(mT ? (["bottom"] as const) : []), ...(mB ? (["top"] as const) : [])] } : {}),
    })
    this.drawerHandleAt(frontPanel, fw, fh, handleHw, front, zoneId)
    return frontPanel
  }

  /** El tirador d'un front de calaix (de fusta o de vidre): centrat o a `handleTop` mm del cantell de dalt, mai per sota del mig. */
  private drawerHandleAt(p: Panel, w: number, h: number, handleHw: HandleChoice, front: Extract<Front, { kind: "drawers" }>, zoneId: string): void {
    this.handle(p, w / 2, front.handleTop !== undefined ? Math.min(front.handleTop, h / 2) : h / 2, "x", handleHw, zoneId)
  }

  /**
   * **Front de vidre** (per decisió de l'usuari, 2026-10-20, com l'armari de la foto): el vidre és el front, sense marc.
   * Amb la caixa de fusta, en ranura als laterals; amb un joc, al lloc del front de fusta. El tirador hi fa els forats
   * (els fa el vidrier). No és de CNC: va a `extras` (es mou amb el calaix: `drawer-<k>-glass`).
   */
  private addGlassFront(k: number, x0: number, y0: number, w: number, h: number, zFace: number, handleHw: HandleChoice, front: Extract<Front, { kind: "drawers" }>, zoneId: string): void {
    this.glassDrawers = true
    const glass: Panel = {
      id: `drawer-${k}-glass`,
      name: "vidre calaix",
      label: `Front calaix ${k} (vidre)`,
      role: "part",
      length: r(w),
      width: r(h),
      thickness: GLASS,
      material: "Vidre",
      grain: "none",
      edges: { ...NO_EDGES },
      holes: [],
      grooves: [],
      placement: placement([r(x0), r(y0 + h), r(zFace)], X, neg(Y), neg(Z), Z),
    }
    this.extras.push(glass)
    this.drawerHandleAt(glass, w, h, handleHw, front, zoneId)
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
      this.buildKitDrawers(zone, front, slideHw.item, rect, this.drawerTerritory(front, rect, ter), left, right, this.frontHandle(front.handle, zone.id, kitPush))
      return
    }
    // El tirador triat al calaix (si no, el del mòdul).
    const glass = !!front.glass
    const handleHw = this.frontHandle(front.handle, zone.id)
    if (front.kitFront)
      this.warnings.push({ code: "drawer-box", option: "zone.front.drawers.face", message: `El front metàl·lic és d'un joc de calaix i la guia «${slideHw.item.name}» no ho és: es fa ${glass ? "de vidre" : "de fusta"}. Tria un joc a la Guia de calaix.`, zoneId: zone.id })
    // On van els fronts: els de sempre o, retirats dins de la caixa, dins de la llum.
    ter = this.drawerTerritory(front, rect, ter)
    // Llargades, jocs, caixa i forats de la guia.
    const hw = slideHw.spec
    const n = front.n
    const { heights, ys } = this.drawerLayout(zone, front, ter)

    const boxW = r(rect.x1 - rect.x0 - 2 * hw.sideClearance)
    // Amb el front encastat, la caixa del calaix comença un gruix més endins.
    // Una columna pel darrere: la fondària que queda davant del seu fons.
    // Un calaix interior: des de la cara de darrere del seu front interior (retirat).
    const maxLen = d.availDepth - (this.rearAt(rect.x0, rect.x1) - d.backInnerZ) - hw.backClearance - Math.max(0, d.D - this.drawerFaceZ(front) + d.t)
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
      // El front (el territori, amb el tirador), també si la caixa no s'hi pot fer. De vidre, cap front de fusta: el vidre
      // va en ranura als laterals de la caixa (més avall).
      const outerFront = glass ? null : this.addDrawerFront(k, ter, y, fh, handleHw, front, zone.id)
      const sb = shared.get(groupOf(fh))!
      const boxH = r(sb.hi - sb.lo)
      if (boxH < minBox) {
        lowBox = lowBox === null ? boxH : Math.min(lowBox, boxH)
        continue
      }
      if (narrowBox) continue
      const boxY0 = r(y + sb.lo)
      const boxX0 = r(rect.x0 + hw.sideClearance)
      const frontPanel = outerFront
      const fx0 = ter.x0
      const fTop = y + fh
      const zFront = this.drawerFaceZ(front) - d.t // cara posterior del front
      const zBack = r(zFront - boxL)
      // Laterals de la caixa (cara A cap a dins de la caixa), amb ranura per al fons.
      const sideGroove = { x: 0, y: hw.bottomOffset, w: boxL, h: tbb, depth: g, face: "A" as const, tag: "drawer-bottom" }
      // De vidre: la ranura del vidre, vertical, a GLASS_AT mm del davant (x local: el dret comença pel davant).
      const glassGroove = (x: number) => ({ x: r(x), y: 0, w: GLASS + 1, h: boxH, depth: g, face: "A" as const, tag: "glass" })
      const sideL = this.add({
        ...this.basePanel(`drawer-${k}-side-left`, "lateral calaix", `Lateral calaix ${k}`, "drawerSide", boxL, boxH, bt, c.material, "x", edges("top", ...(glass ? (["right"] as const) : [])), placement([boxX0, boxY0, zBack], Z, Y, X, neg(X))),
        grooves: [sideGroove, ...(glass ? [glassGroove(boxL - GLASS_AT - GLASS - 1)] : [])],
      })
      const sideR = this.add({
        ...this.basePanel(`drawer-${k}-side-right`, "lateral calaix", `Lateral calaix ${k}`, "drawerSide", boxL, boxH, bt, c.material, "x", edges("top", ...(glass ? (["left"] as const) : [])), placement([boxX0 + boxW, boxY0, zFront], neg(Z), Y, neg(X), X)),
        grooves: [{ ...sideGroove }, ...(glass ? [glassGroove(GLASS_AT)] : [])],
      })
      // Darrere: entre laterals, sobre el fons.
      const backY0 = boxY0 + hw.bottomOffset + tbb
      const backH = r(boxH - hw.bottomOffset - tbb)
      const back = this.add(
        this.basePanel(`drawer-${k}-back`, "darrere calaix", `Darrere calaix ${k}`, "drawerBack", boxW - 2 * bt, backH, bt, c.material, "x", edges("top"), placement([boxX0 + bt, backY0, zBack + bt], X, Y, neg(Z), neg(Z))),
      )
      // Fons: en ranura als laterals i al front (de vidre: fins al davant dels laterals; el vidre s'hi recolza).
      const bottomW = r(boxW - 2 * bt + 2 * g - 1)
      const bottomL = glass ? r(boxL - 1) : r(boxL + g - 1)
      this.add(
        this.basePanel(`drawer-${k}-bottom`, "fons calaix", `Fons calaix ${k}`, "drawerBottom", bottomW, bottomL, tbb, bottomMat.name, "none", { ...NO_EDGES }, placement([boxX0 + bt - g + 0.5, boxY0 + hw.bottomOffset, glass ? zFront - 0.5 : zFront + g - 0.5], X, neg(Z), Y, neg(Y))),
      )
      // Ranura al front per al fons (cara A = darrere del front).
      if (frontPanel) frontPanel.grooves.push({ x: r(boxX0 + bt - g - fx0), y: r(fTop - (boxY0 + hw.bottomOffset + tbb)), w: r(boxW - 2 * bt + 2 * g), h: tbb, depth: g, face: "A", tag: "drawer-bottom" })
      // El vidre: entre les ranures dels laterals, damunt del fons i fins a dalt dels laterals.
      if (glass) {
        const gy0 = r(boxY0 + hw.bottomOffset + tbb)
        this.addGlassFront(k, boxX0 + bt - g + 0.5, gy0, bottomW, boxY0 + boxH - gy0, zFront - GLASS_AT - 0.5, handleHw, front, zone.id)
      }
      // Espigues: laterals → front (topen), darrere → laterals (topa). Dues a 30 / 20 mm dels extrems si hi caben; si
      // la caixa és baixa, una al mig (`dowelsAlong`).
      const dowel = { diameter: hw.boxThickness >= 16 ? 8 : 6, faceDepth: 10, edgeDepth: 20 }
      const frontYs = dowelsAlong(boxY0, boxY0 + boxH, 30, dowel.diameter)
      const backYs = dowelsAlong(backY0, boxY0 + boxH, 20, dowel.diameter)
      for (const [xs, sidePanel] of [[boxX0 + bt / 2, sideL], [boxX0 + boxW - bt / 2, sideR]] as [number, Panel][]) {
        const a = !frontPanel || dowelJoint(sidePanel, frontPanel, frontYs.map((yy): Vec3 => [r(xs), r(yy), zFront]), dowel)
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
    handleHw: HandleChoice,
  ): void {
    const { m, d } = this
    const c = m.carcass
    const { heights, ys } = this.drawerLayout(zone, front, ter)
    const LW = r(rect.x1 - rect.x0)
    const zFront = this.drawerFaceZ(front) - d.t // cara posterior del front
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
      // De vidre, el vidre al lloc del front de fusta; el front metàl·lic del fabricant, cap peça al davant.
      const metal = !!front.kitFront
      if (!metal && front.glass) this.addGlassFront(k, ter.x0, y, r(ter.x1 - ter.x0), fh, this.drawerFaceZ(front), handleHw, front, zone.id)
      const outerFront = metal || front.glass ? null : this.addDrawerFront(k, ter, y, fh, handleHw, front, zone.id)
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
      const frontPanel = outerFront
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
      if (metal) {
        const fh = r(y0 - y + kitHeight(kit))
        this.extras.push(this.basePanel(`drawer-${k}-kit-innerFront`, "front interior metàl·lic", `Front interior metàl·lic calaix ${k}`, "hardware", r(LW - 4), fh, 2, "Acer fosc", "none", { ...NO_EDGES }, placement([r(rect.x0 + 2), r(y + fh), this.drawerFaceZ(front)], X, neg(Y), neg(Z), Z)))
      }
      const lines = !metal ? kitPlan.lines : [...kitPlan.lines, { component: "innerFront", name: "Front interior metàl·lic del fabricant", qty: 1, note: `Per a ${fmtNum(LW, 1)} mm de llum: demanar-lo al distribuïdor (no és al catàleg de l'app).` }]
      this.hardwareKits.push({ zoneId: zone.id, drawer: k, item: kitItemUsed.name, kit: `${kit.maker} ${kit.series} ${kit.heightClass.code}`, nl: kitPlan.nl, options: kitPlan.options, lines, wood: kitPlan.wood, ...(kitPlan.rule ? { rule: kitPlan.rule } : {}), ...(kitPlan.syncRod !== undefined ? { syncRod: kitPlan.syncRod } : {}) })
    }
  }
}
