import { NO_EDGES, type Cutout, type Panel, type Pt, type Vec3, type ZoneBack, UI_PATHS, ccw, frontOptionsUse, polygonArea, zoneBackRegions } from "../../model"
import { X, Y, Z, dowelJoint, neg, placement, r, threeAlong, toLocal } from "../geometry"
import { MIN_OPEN_RATIO, grilleCutouts, type Rect } from "../grille"
import { HollowWallsBuilder } from "./hollowWalls"
import { edges, near, shapeOutline } from "./helpers"
import { outerSpans } from "./outerSpans"
import { fmtNum, roundTo } from "../../../lib/format"
import { layoutZones, type ZoneRect } from "../layout"
import { pc } from "../polygonClip"
import { fitGroovedBack, groovedHoles, groovedZoneBack, pieceHas, screwedZoneRect } from "./backGrooves"

/** Una zona amb un fons que no és el del mòdul (`zoneBackRegions`): el seu rectangle i les zones de dins. */
export interface BackZone {
  zoneId: string
  rect: ZoneRect
  back: ZoneBack
  ids: Set<string>
}

/** La carcassa: laterals, base, tapa, fons, sòcol (base «Sòcol»; el de les potes, `MountingBuilder`) i parets buides. */
export class CarcassBuilder extends HollowWallsBuilder {
  // --- Carcassa ---------------------------------------------------------------------

  buildCarcass(): void {
    const { m, d } = this
    const c = m.carcass
    if (c.sides.left) this.buildSide(true)
    if (c.sides.right) this.buildSide(false)
    if (d.hasBase) this.buildHorizontal("bottom")
    if (d.hasTop) this.buildHorizontal("top")
    if (c.back !== "none") this.buildBack()
    if (c.base.kind === "plinth") this.buildPlinth()
    if (d.hollow)
      this.warnings.push({ code: "hollow", message: `Parets buides de ${d.hollow} mm: cada paret són dues pells, llistons a dins i una tira al davant, encolats abans de muntar el moble.` })
    else if (c.hollow)
      this.warnings.push({ code: "hollow", message: `Parets buides de ${c.hollow.thickness} mm: amb tauler de ${d.t} cal un gruix d'almenys ${2 * d.t + 6} mm. Es fan massisses.` })
    // Fronts encastats: van dins de la llum, a nivell amb el davant de la caixa.
    if (d.inset) {
      this.warnings.push({ code: "inset", message: "Fronts encastats: van dins de la llum amb el joc a tot el voltant; calen frontisses per a porta encastada." })
      // Només si algun prestatge es retira de debò (sense prestatges, o tots a ras en compartiments oberts, no compta).
      if (c.shelfSetback < d.t && frontOptionsUse(m).shelfSetback)
        this.warnings.push({ code: "inset", message: `Els prestatges van retirats ${c.shelfSetback} mm i el front encastat entra ${d.t} mm: retira'ls almenys ${d.t} mm (${UI_PATHS.box} › Retirada dels prestatges).` })
    }
    // Fons en ranura massa gruixut: la ranura deixaria el lateral sense material.
    if (c.back === "groove" && d.tb > d.t - 6) {
      this.warnings.push({
        code: "back-groove",
        message: `Fons de ${d.tb} mm en ranura en un cos de ${d.t} mm: la ranura buidaria el lateral. Amb un fons gruixut, posa'l cargolat.`,
      })
    }
  }

  protected buildSide(isLeft: boolean): void {
    if (this.d.hollow) return this.buildHollowSide(isLeft)
    // Un tros per cada tram que les zones no treuen (`outerSpans`).
    const id = isLeft ? "side-left" : "side-right"
    outerSpans(this.m, this.d.interior, this.d.t, isLeft ? "left" : "right").forEach((span, k) => this.buildSideSpan(isLeft, span, k ? `${id}-${k + 1}` : id))
  }

  protected buildSideSpan(isLeft: boolean, span: [number, number], id: string): void {
    const { m, d } = this
    const c = m.carcass
    const { t, sideDepth } = d
    // El tram arriba a baix / a dalt de la llum (fins al cap del lateral) o s'acaba a dins (el cantell es veu).
    const atB = near(span[0], d.interior.y0)
    const atT = near(span[1], d.interior.y1)
    const y0 = atB ? 0 : span[0]
    const y1 = atT ? d.sideH : span[1]
    const H = y1 - y0
    const mitreTop = d.mitreTop && atT
    const mitreBottom = d.mitreBottom && atB
    const grooves: Panel["grooves"] = []
    if (c.back === "groove") {
      const g = c.grooveDepth
      // Dins de la peça: amb tauler de taula el lateral s'acaba a sota de la tapa (la ranura hi surt).
      const gy0 = Math.max(y0, d.hasBase ? d.interior.y0 - g : d.interior.y0) - y0
      const gy1 = Math.min(y1, this.backGrooveTop()) - y0
      // Ample = gruix del fons + el joc (`grooveClearance`): el cantell de darrere es queda a `backSetback`, el joc va cap
      // al davant.
      const gw = this.backGrooveWidth()
      grooves.push({
        x: r(gy0),
        y: isLeft ? r(c.backSetback) : r(sideDepth - c.backSetback - gw),
        w: r(gy1 - gy0),
        h: gw,
        depth: g,
        face: "A",
        tag: "back",
      })
    }
    // Fronts de calaix a inglet: el lateral arriba fins a la cara dels fronts.
    const ext = d.mitreFronts ? t : 0
    const pl = isLeft
      ? placement([0, y0, d.sideZ0], Y, Z, X, neg(X))
      : placement([d.W, y0, d.D + ext], Y, neg(Z), neg(X), X)
    if (ext && !isLeft) for (const g of grooves) g.y = r(g.y + ext)
    const panel = this.add({
      ...this.basePanel(
        id,
        isLeft ? "lat e" : "lat d",
        isLeft ? "Lateral esquerre" : "Lateral dret",
        "side",
        H,
        sideDepth + ext,
        t,
        c.material,
        "x",
        edges(...(ext ? [] : [isLeft ? ("top" as const) : ("bottom" as const)]), ...(mitreTop ? [] : (["right"] as const)), ...(atB ? [] : (["left"] as const)), ...this.rearEdge(isLeft ? "bottom" : "top")),
        pl,
      ),
      grooves,
      // Local x = alçada: «right» és el cap de dalt (tapa) i «left» el de baix (base); el cantell
      // de davant és «top» a l'esquerre i «bottom» al dret.
      ...(mitreTop || mitreBottom || ext
        ? { mitres: [...(mitreTop ? (["right"] as const) : []), ...(mitreBottom ? (["left"] as const) : []), ...(ext ? [isLeft ? ("top" as const) : ("bottom" as const)] : [])] }
        : {}),
    })
    this.verticals.push({
      panel,
      xL: isLeft ? 0 : d.W - t,
      xR: isLeft ? t : d.W,
      yB: y0,
      yT: y1,
      zRear: d.sideZ0,
      zFront: d.D,
      outer: true,
    })
  }

  protected buildHorizontal(which: "bottom" | "top"): void {
    if (this.d.hollow && (which === "bottom" || (this.m.carcass.top.kind === "full" && !this.d.tableTop))) return this.buildHollowHorizontal(which)
    // Un tros per cada tram que les zones no treuen (`outerSpans`); el tauler de taula, sencer.
    const spans: [number, number][] = which === "top" && this.d.tableTop ? [[this.d.interior.x0, this.d.interior.x1]] : outerSpans(this.m, this.d.interior, this.d.t, which)
    spans.forEach((span, k) => this.buildHorizontalSpan(which, span, k ? `${which}-${k + 1}` : which))
  }

  protected buildHorizontalSpan(which: "bottom" | "top", span: [number, number], id: string): void {
    const { m, d } = this
    const c = m.carcass
    const { t, interior } = d
    const isBottom = which === "bottom"
    // El tram arriba a un extrem de la llum / s'acaba a dins (una zona en treu el tram del costat: el cantell es veu).
    const atL = near(span[0], interior.x0)
    const atR = near(span[1], interior.x1)
    // Tapa a inglet: arriba fins a fora de cada lateral (x = 0 / W), amb el cantell a 45°.
    // ... si el lateral hi arriba (una zona de l'extrem no en treu el tram).
    const sideAt = (side: "left" | "right") => c.sides[side] && outerSpans(m, interior, t, side).some(([a, b]) => near(isBottom ? a : b, isBottom ? interior.y0 : interior.y1))
    const mitreL = (isBottom ? d.mitreBottom : d.mitreTop) && atL && sideAt("left")
    const mitreR = (isBottom ? d.mitreBottom : d.mitreTop) && atR && sideAt("right")
    // Tauler de taula: per sobre dels laterals, amb voladís a tot el voltant.
    const ov = !isBottom && d.tableTop ? d.tableTop.overhang : 0
    const onTop = !isBottom && !!d.tableTop
    const px0 = onTop ? -ov : mitreL ? 0 : span[0]
    const length = onTop ? d.W + 2 * ov : (mitreR ? d.W : span[1]) - px0
    const cut = [...(atL ? [] : (["left"] as const)), ...(atR ? [] : (["right"] as const))]
    // Fronts de calaix a inglet: la tapa i la base també arriben a la cara dels fronts.
    const ext = d.mitreFronts && (isBottom ? d.mitreBottom : d.mitreTop) ? t : 0
    let width = d.sideDepth + ext + (onTop ? 2 * ov : 0)
    let zRear = d.sideZ0 - (onTop ? ov : 0)
    let cutouts: Cutout[] | undefined
    if (!isBottom && c.top.kind === "ventSlot") {
      width = d.sideDepth - c.top.gap
      zRear = d.sideZ0 + c.top.gap
    }
    const grooves: Panel["grooves"] = []
    if (c.back === "groove" && !(c.top.kind === "ventSlot" && !isBottom)) {
      // Si la peça passa per sobre d'un lateral (inglet, tauler de taula), el fons hi entra
      // també la fondària de la ranura del lateral: la ranura s'allarga g per aquell costat.
      const g = c.grooveDepth
      const gx0 = Math.max(px0, interior.x0) - (c.sides.left && px0 < interior.x0 - 0.01 ? g : 0)
      const gx1 = Math.min(px0 + length, interior.x1) + (c.sides.right && px0 + length > interior.x1 + 0.01 ? g : 0)
      const gw = this.backGrooveWidth()
      grooves.push({
        x: r(gx0 - px0),
        y: isBottom ? r(d.sideDepth + ext - c.backSetback - gw) : r(c.backSetback + ov),
        w: r(gx1 - gx0),
        h: gw,
        depth: c.grooveDepth,
        face: "A",
        tag: "back",
      })
    }
    const yBottom = isBottom ? d.baseY : d.H - t
    const pl = isBottom
      ? placement([px0, yBottom, d.D + ext], X, neg(Z), Y, neg(Y))
      : placement([px0, d.H, zRear], X, Z, neg(Y), Y)
    const panel = this.add({
      ...this.basePanel(
        id,
        isBottom ? "baix" : "dalt",
        isBottom ? "Base" : "Sostre",
        which,
        length,
        width,
        t,
        c.material,
        "x",
        onTop ? edges("top", "bottom", "left", "right") : edges(...(ext ? [] : [isBottom ? ("bottom" as const) : ("top" as const)]), ...this.rearEdge(isBottom ? "top" : "bottom"), ...cut),
        pl,
      ),
      grooves,
      ...(onTop && d.tableTop!.shape ? { outline: shapeOutline(d.tableTop!.shape, length, width) } : {}),
      // El cantell de davant: «bottom» a la base (y local cap enrere), «top» a la tapa.
      ...(mitreL || mitreR || ext
        ? { mitres: [...(mitreL ? (["left"] as const) : []), ...(mitreR ? (["right"] as const) : []), ...(ext ? [isBottom ? ("bottom" as const) : ("top" as const)] : [])] }
        : {}),
    })
    if (!isBottom && c.top.kind === "grille") {
      // Fons encastat: la franja on el fons toca la tapa (amb les espigues) queda sense ranures, com la trapa o els imants.
      const exclude: Rect[] = []
      if (c.back === "inset") {
        const pad = this.hw.dowel.diameter / 2 + 1
        exclude.push({ x: 0, y: (c.backInsetSetback ?? 0) - zRear - pad, w: panel.length, h: d.tb + 2 * pad })
      }
      const g = grilleCutouts(panel.length, panel.width, c.top.pattern, exclude)
      cutouts = g.cutouts
      this.openRatios.top = g.openRatio
      if (g.openRatio < MIN_OPEN_RATIO) {
        this.warnings.push({ code: "grille-open-ratio", message: `La reixeta de la tapa només té un ${Math.round(g.openRatio * 100)} % d'àrea oberta (mínim recomanat 40 %).`, panelId: panel.id })
      }
    }
    if (cutouts?.length) panel.cutouts = cutouts
    this.horizontals.push({ panel, yBottom, yTop: yBottom + t, xL: span[0], xR: span[1], outer: true, zRear, zFront: zRear + width })

    // Espigues amb els laterals (la base/tapa hi topa; el lateral continua). A inglet no:
    // s'encola amb lamel·les o Clamex, que es fan a mà o amb una eina a 45°.
    const yMid = yBottom + t / 2
    if (onTop)
      this.warnings.push({ code: "table", message: "Tauler de taula per sobre dels laterals: es fixa per sota amb cargols o ferratges d'unió (no porta espigues).", panelId: panel.id })
    if (mitreL || mitreR)
      this.warnings.push({ code: "mitre", message: `${isBottom ? "Base" : "Tapa"} a inglet: tall a 45° als cantells de la ${isBottom ? "base" : "tapa"} i dels laterals; encolar amb lamel·les o Clamex (no porta espigues).`, panelId: panel.id })
    for (const v of this.verticals) {
      if (!v.outer || mitreL || mitreR || onTop) continue
      const xFace = near(v.xR, interior.x0) ? v.xR : v.xL
      if (!(atL && near(xFace, interior.x0)) && !(atR && near(xFace, interior.x1))) continue
      if (yMid < v.yB || yMid > v.yT) continue
      // Sobre la fondària real de la peça (la tapa amb ranura d'aire és més curta).
      const zs = threeAlong(zRear, d.D, this.hw.dowel.endOffset)
      dowelJoint(panel, v.panel, zs.map((z): Vec3 => [xFace, yMid, z]), this.hw.dowel, this.hw.dowel.tag)
    }
  }

  protected buildBack(): void {
    const { m, d } = this
    const c = m.carcass
    const { interior } = d
    if (c.back === "inset") return this.buildInsetBack()
    if (c.back === "screwed") {
      // Cargolat per darrere, els seus quatre cantells es veuen de costat i de dalt. Si és
      // del mateix tauler que el cos (no un DM de fons), es cantegen com la resta.
      const visible = c.backMaterial === c.material
      // Amb tauler de taula, s'acaba a sota de la tapa (que passa per sobre).
      this.addBack(
        this.basePanel("back", "trassera", "Fons", "back", d.W, d.sideH, d.tb, c.backMaterial, "none", visible ? edges("top", "bottom", "left", "right") : { ...NO_EDGES }, placement([0, 0, 0], X, Y, Z, neg(Z))),
      )
      return
    }
    const g = c.grooveDepth
    const cl = c.backClearance
    const xL = c.sides.left ? interior.x0 - g + cl / 2 : interior.x0
    const xR = c.sides.right ? interior.x1 + g - cl / 2 : interior.x1
    const yB = d.hasBase ? interior.y0 - g + cl / 2 : interior.y0
    // Fins on arriba la ranura: dins de la de la tapa o, si la tapa no en porta (ranura d'aire), a sota.
    const top = this.backGrooveTop()
    const yT = top > interior.y1 ? top - cl / 2 : interior.y1
    this.addBack(
      this.basePanel("back", "trassera", "Fons", "back", xR - xL, yT - yB, d.tb, c.backMaterial, "none", { ...NO_EDGES }, placement([xL, yB, c.backSetback], X, Y, Z, neg(Z))),
    )
  }

  /**
   * Fons encastat: ocupa la llum interior (entre laterals, base i tapa; on falta una peça, fins a
   * fora del mòdul), a `backInsetSetback` del cantell posterior. S'uneix com un prestatge fix:
   * espigues al cantell del fons i forats de cara a laterals, base i tapa (tres per costat, a
   * `endOffset` dels extrems). Amb un fons de menys de 15 mm no hi caben espigues: avís.
   */
  protected buildInsetBack(): void {
    const { m, d } = this
    const c = m.carcass
    const { interior } = d
    const z0 = c.backInsetSetback ?? 0
    // Tapa amb ranura d'aire: aire entre la cara de davant del fons i el darrere de la tapa (el cantell de dalt del fons s'hi veu).
    const slot = d.hasTop && c.top.kind === "ventSlot" ? d.sideZ0 + c.top.gap - (z0 + d.tb) : null
    // Del mateix tauler que el cos: es veu per darrere; veta vertical i cantell on no toca res (o on la ranura el deixa veure).
    const visible = c.backMaterial === c.material
    const eb = visible
      ? edges(
          ...(c.sides.left ? [] : (["left"] as const)),
          ...(c.sides.right ? [] : (["right"] as const)),
          ...(d.hasBase ? [] : (["bottom"] as const)),
          ...(!d.hasTop || (slot !== null && slot > 0) ? (["top"] as const) : []),
        )
      : { ...NO_EDGES }
    const pieces = this.addBack(
      this.basePanel("back", "trassera", "Fons", "back", interior.x1 - interior.x0, interior.y1 - interior.y0, d.tb, c.backMaterial, visible ? "y" : "none", eb, placement([interior.x0, interior.y0, z0], X, Y, Z, neg(Z))),
    )
    // Tot el fons és d'altres zones (sense fons o amb el seu): res a unir.
    const back = pieces[0]
    if (!back) return
    if (slot !== null && slot < 10) {
      this.warnings.push({
        code: "back-inset",
        message:
          slot <= 0
            ? `Ranura d'aire de la tapa: amb el fons encastat (retirada ${fmtNum(z0, 1)} + gruix ${fmtNum(d.tb, 1)} mm) la ranura queda tapada. Fes-la més ampla (més de ${fmtNum(z0 + d.tb + 10, 1)} mm) o retira menys el fons.`
            : `Ranura d'aire de la tapa: entre el fons encastat i la tapa només queden ${fmtNum(slot, 1)} mm (calen 10 mm o més). Fes la ranura més ampla o retira menys el fons.`,
        panelId: back.id,
      })
    }
    // Fondària que queda davant del fons: hi han de cabre les dues fileres System 32 (`rows`: la de darrere no es fa si
    // arribaria a la de davant).
    const s32 = this.hw.system32
    const need = 2 * s32.edgeOffset + s32.diameter
    if (d.D - d.backInnerZ < need) {
      this.warnings.push({
        code: "back-inset",
        message: `Fons encastat: davant del fons només queden ${fmtNum(d.D - d.backInnerZ, 1)} mm de fondària (calen ${fmtNum(need, 1)} mm per a les dues fileres System 32 a ${fmtNum(s32.edgeOffset, 1)} mm dels cantells). Retira menys el fons o fes el mòdul més fondo; si les fileres es trobarien, la de darrere no es fa.`,
        panelId: back.id,
      })
    }
    if (d.tb < 15) {
      this.warnings.push({ code: "back-inset", message: `Fons encastat de ${d.tb} mm: massa prim per a espigues al cantell (calen 15 mm o més). Fixa'l amb cargols des dels laterals, la base i la tapa, o posa'l en ranura.`, panelId: back.id })
      return
    }
    const dw = this.hw.dowel
    const zMid = z0 + d.tb / 2
    const rad = dw.diameter / 2
    // Només els punts que cauen dins de la peça que continua (la tapa amb ranura d'aire no arriba al fons).
    // Cada espiga, a la peça del fons on cau (el fons d'una zona sense fons s'ha tallat, `addBack`).
    const join = (through: Panel, pts: Vec3[]) => {
      const inThrough = pts.filter((w) => {
        const l = toLocal(through, w)
        return l[0] >= rad && l[0] <= through.length - rad && l[1] >= rad && l[1] <= through.width - rad
      })
      for (const piece of pieces) dowelJoint(piece, through, inThrough.filter((w) => pieceHas(piece, w, rad)), dw, dw.tag)
    }
    for (const v of this.verticals) {
      if (!v.outer) continue
      const xFace = near(v.xR, interior.x0) ? v.xR : near(v.xL, interior.x1) ? v.xL : null
      if (xFace === null) continue
      join(v.panel, threeAlong(interior.y0, interior.y1, dw.endOffset).map((y): Vec3 => [xFace, y, zMid]))
    }
    for (const h of this.horizontals) {
      if (!h.outer) continue
      // El tauler de taula es fixa per sota amb cargols (no porta espigues).
      if (d.tableTop && h.panel.id === "top") continue
      const yFace = d.hasBase && near(h.yTop, interior.y0) ? h.yTop : d.hasTop && near(h.yBottom, interior.y1) ? h.yBottom : null
      if (yFace === null) continue
      join(h.panel, threeAlong(interior.x0, interior.x1, dw.endOffset).map((x): Vec3 => [x, yFace, zMid]))
    }
  }

  /**
   * Zones amb un fons que no és el del mòdul (`zoneBackRegions`): la seva llum i les zones de dins (els divisors i les
   * fulles d'una zona amb el seu fons encastat van fins a aquest fons, `zoneDepth`).
   */
  protected backZones(): BackZone[] {
    if (this.backZonesCache) return this.backZonesCache
    const { m, d } = this
    const regions = zoneBackRegions(m)
    const layout = regions.length ? layoutZones(m.root, d.interior, d.t) : null
    const ids = (z: { id: string; split?: { children: { id: string; split?: unknown }[] } }, out = new Set<string>()): Set<string> => {
      out.add(z.id)
      z.split?.children.forEach((ch) => ids(ch as typeof z, out))
      return out
    }
    this.backZonesCache = regions.flatMap(({ zone, back }) => {
      const rect = layout?.rects.get(zone.id)
      return rect && rect.x1 - rect.x0 > 1 && rect.y1 - rect.y0 > 1 ? [{ zoneId: zone.id, rect, back, ids: ids(zone) }] : []
    })
    this.backDividers = layout?.dividers.map((v) => ({ dir: v.dir, at: v.at, to: v.at + v.thickness })) ?? []
    return this.backZonesCache
  }
  private backZonesCache?: BackZone[]
  private backDividers: { dir: "v" | "h"; at: number; to: number }[] = []

  /**
   * El que es talla del fons del mòdul (coordenades del mòdul): la llum de cada zona amb un altre fons. Fins a fora de
   * la peça on la zona toca la llum del mòdul (no hi queda cap tira dins de la ranura), i també el divisor entre dues
   * d'aquestes zones (no hi queda una tira de fons al mig).
   */
  protected backHoles(): ZoneRect[] {
    const { interior } = this.d
    const zs = this.backZones()
    const FAR = 1e5
    const holes = zs.map(({ rect: q }) => ({
      x0: near(q.x0, interior.x0) ? -FAR : q.x0,
      x1: near(q.x1, interior.x1) ? FAR : q.x1,
      y0: near(q.y0, interior.y0) ? -FAR : q.y0,
      y1: near(q.y1, interior.y1) ? FAR : q.y1,
    }))
    const divs = this.backDividers
    const bridges: ZoneRect[] = []
    zs.forEach(({ rect: a }, i) =>
      zs.forEach(({ rect: b }, j) => {
        const ha = holes[i]!, hb = holes[j]!
        // A a l'esquerra de B (o a sota), amb un divisor just entre totes dues.
        const y0 = Math.max(ha.y0, hb.y0), y1 = Math.min(ha.y1, hb.y1)
        if (y1 - y0 > 0.5 && divs.some((v) => v.dir === "v" && near(v.at, a.x1) && near(v.to, b.x0))) bridges.push({ x0: a.x1, x1: b.x0, y0, y1 })
        const x0 = Math.max(ha.x0, hb.x0), x1 = Math.min(ha.x1, hb.x1)
        if (x1 - x0 > 0.5 && divs.some((v) => v.dir === "h" && near(v.at, a.y1) && near(v.to, b.y0))) bridges.push({ x0, x1, y0: a.y1, y1: b.y0 })
      }),
    )
    return [...this.groovedHoles(holes), ...bridges]
  }

  /** Fons en ranura: el forat arriba fins a la ranura del divisor o prestatge fix que el tanca (`groovedHoles`). */
  private groovedHoles(holes: ZoneRect[]): ZoneRect[] {
    const { m } = this
    return m.carcass.back === "groove" ? groovedHoles(holes, this.backDividers, m.carcass) : holes
  }

  /** Ranures només on hi ha fons, i el fons sempre en ranura; les peces del voltant d'un fons cargolat, fins al darrere. */
  protected fitGroovedBack(): void {
    const { m, d } = this
    const grooved = m.carcass.back === "groove"
    const holes = this.backHoles()
    const pick = this.backZones().flatMap((z, i) => (grooved || z.back.kind === "screwed" ? [{ z, e: holes[i]! }] : []))
    if (!pick.length) return
    fitGroovedBack({ panels: this.panels, verticals: this.verticals, horizontals: this.horizontals, zones: pick.map((p) => p.z), expanded: pick.map((p) => p.e), holes, grooved, carcass: m.carcass, sideZ0: d.sideZ0, grooveWidth: this.backGrooveWidth() })
  }

  /**
   * Afegeix el fons del mòdul menys el de les zones amb un altre fons (`backHoles`): una peça per cada tros que queda,
   * rectangular o amb el contorn (i els forats de dins) que li toca. Torna les peces (cap, si no en queda res).
   */
  protected addBack(panel: Panel): Panel[] {
    const holes = this.backHoles()
    this.backKinds[panel.id] = this.m.carcass.back
    if (!holes.length) return [this.add(panel)]
    const [ox, oy, oz] = panel.placement.origin
    const L = panel.length
    const W = panel.width
    const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    const res = pc.difference([box(0, 0, L, W)], ...holes.map((h) => [box(h.x0 - ox, h.y0 - oy, h.x1 - ox, h.y1 - oy)]))
    const ringOf = (q: Pt[]): Pt[] => {
      const out = q.map(([x, y]) => [roundTo(x, 2), roundTo(y, 2)] as Pt)
      const last = out[out.length - 1]!
      if (out.length > 1 && last[0] === out[0]![0] && last[1] === out[0]![1]) out.pop()
      return ccw(out)
    }
    // Les engrunes (menys d'1 mm d'ample) no són peces; ni el quadradet on es creuen dos divisors entre quatre zones sense
    // fons (les lletres, les formes): sol, no aguanta res.
    const knot = Math.max(this.d.t, ...this.backDividers.map((v) => v.to - v.at)) + 1
    const polys = res.map((poly) => poly.map((q) => ringOf(q as Pt[]))).filter((poly) => {
      const xs = poly[0]!.map((q) => q[0]), ys = poly[0]!.map((q) => q[1])
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
      return w > 1 && h > 1 && polygonArea(poly[0]!) > 1 && !(w <= knot && h <= knot)
    }).sort((a, b) => polygonArea(b[0]!) - polygonArea(a[0]!))
    return polys.map(([outer, ...inner], i) => {
      const x0 = Math.min(...outer!.map((q) => q[0])), y0 = Math.min(...outer!.map((q) => q[1]))
      const x1 = Math.max(...outer!.map((q) => q[0])), y1 = Math.max(...outer!.map((q) => q[1]))
      const local = (q: Pt[]): Pt[] => q.map(([x, y]) => [roundTo(x - x0, 2), roundTo(y - y0, 2)] as Pt)
      const isRect = outer!.length === 4
      const cutouts: Cutout[] = inner.map((q) => ({ kind: "polygon", points: local(q) }))
      return this.add({
        ...panel,
        id: i ? `${panel.id}-${i + 1}` : panel.id,
        label: polys.length > 1 ? `${panel.label} ${i + 1}` : panel.label,
        length: r(x1 - x0),
        width: r(y1 - y0),
        holes: [],
        grooves: [],
        placement: { ...panel.placement, origin: [r(ox + x0), r(oy + y0), oz] },
        ...(isRect ? {} : { outline: local(outer!) }),
        ...(cutouts.length ? { cutouts } : {}),
      })
    })
  }

  /**
   * Z de darrere del fons d'una zona que el porta per dins. Encastat: la seva retirada, però mai darrere del pla del fons
   * del mòdul (els divisors del voltant hi arriben i s'hi uneix) ni fora de la caixa. En ranura: a la retirada del fons
   * en ranura (Mòdul › Fons), des del darrere de la caixa.
   */
  protected zoneBackZ0(b: BackZone): number {
    const { m, d } = this
    if (b.back.kind === "groove") return d.sideZ0 + m.carcass.backSetback
    return Math.max(b.back.setback, m.carcass.back === "none" ? d.sideZ0 : d.backInnerZ)
  }

  /** El tauler del fons d'una zona: el del fons del mòdul (en ranura, o encastat en un mòdul encastat); si no, el del cos. */
  protected zoneBackBoard(b?: BackZone): { tb: number; material: string } {
    const c = this.m.carcass
    return c.back === "inset" || b?.back.kind === "groove" ? { tb: this.d.tb, material: c.backMaterial } : { tb: this.d.t, material: c.material }
  }

  /** La zona amb el seu fons per dins (encastat o en ranura) on és la zona `zoneId` (també una de dins), si n'hi ha. */
  protected insetZoneOf(zoneId: string): BackZone | undefined {
    return this.backZones().find((b) => (b.back.kind === "inset" || b.back.kind === "groove") && b.ids.has(zoneId))
  }

  /**
   * Fa `fn` amb la fondària de la zona `zoneId`: dins d'una zona amb el seu fons encastat, les peces de dins (divisors,
   * prestatges, calaixos, fileres) van fins a aquest fons i no fins al del mòdul.
   */
  protected withZoneDepth<T>(zoneId: string, fn: () => T): T {
    const b = this.insetZoneOf(zoneId)
    if (!b) return fn()
    const keep = this.d
    const backInnerZ = this.zoneBackZ0(b) + this.zoneBackBoard(b).tb
    this.d = { ...keep, backInnerZ, availDepth: keep.D - backInnerZ }
    this.zoneRearZ = backInnerZ
    try {
      return fn()
    } finally {
      this.d = keep
      this.zoneRearZ = null
    }
  }
  /** Dins d'una zona amb el seu fons encastat (`withZoneDepth`), la cara de davant d'aquest fons; si no, null. */
  protected zoneRearZ: number | null = null

  /**
   * El fons encastat de cada zona que el porta (`Zone.back`): la llum de la zona, a la seva retirada, unit amb espigues als
   * laterals, divisors, base, tapa o prestatges fixos que la tanquen (com el fons encastat del mòdul).
   */
  protected buildZoneBacks(): void {
    let n = 0
    for (const b of this.backZones()) {
      if (b.back.kind === "screwed") this.buildScrewedZoneBack(b, ++n)
      if (b.back.kind === "groove") this.buildGroovedZoneBack(b, ++n)
      if (b.back.kind !== "inset") continue
      const { rect } = b
      const z0 = this.zoneBackZ0(b)
      const { tb, material } = this.zoneBackBoard()
      n++
      const visible = material === this.m.carcass.material
      const back = this.add(
        this.basePanel(`zone-back-${n}`, "trassera", "Fons de la zona", "back", rect.x1 - rect.x0, rect.y1 - rect.y0, tb, material, visible ? "y" : "none", { ...NO_EDGES }, placement([rect.x0, rect.y0, z0], X, Y, Z, neg(Z))),
      )
      this.backKinds[back.id] = "inset"
      if (z0 > b.back.setback + 0.5)
        this.warnings.push({ code: "back-inset", info: true, message: `Fons de la zona encastat a ${fmtNum(z0, 1)} mm del darrere (no pot anar més enrere que el fons del mòdul): la retirada de ${fmtNum(b.back.setback, 1)} mm no compta.`, zoneId: b.zoneId, panelId: back.id })
      if (tb < 15) {
        this.warnings.push({ code: "back-inset", message: `Fons de la zona encastat de ${fmtNum(tb, 1)} mm: massa prim per a espigues al cantell (calen 15 mm o més). Fixa'l amb cargols o fes el fons del mòdul més gruixut.`, zoneId: b.zoneId, panelId: back.id })
        continue
      }
      // L'espiga, a demanda (res amagat compta: sense fons de zona, no es llegeix ni avisa).
      const dw = this.hw.dowel
      const rad = dw.diameter / 2
      const zMid = z0 + tb / 2
      const span = (a: number, c: number) => (c - a >= 2 * dw.endOffset + dw.diameter ? threeAlong(a, c, dw.endOffset) : [])
      let joined = 0
      for (const v of this.verticals) {
        if (zMid < v.zRear + rad || zMid > v.zFront - rad) continue
        const xFace = near(v.xR, rect.x0) ? v.xR : near(v.xL, rect.x1) ? v.xL : null
        if (xFace === null) continue
        const ys = span(Math.max(rect.y0, v.yB + (v.endGap ?? 0)), Math.min(rect.y1, v.yT - (v.endGap ?? 0)))
        joined += dowelJoint(back, v.panel, ys.map((y): Vec3 => [xFace, y, zMid]), dw, dw.tag)
      }
      for (const h of this.horizontals) {
        if (zMid < h.zRear + rad || zMid > h.zFront - rad) continue
        const yFace = near(h.yTop, rect.y0) ? h.yTop : near(h.yBottom, rect.y1) ? h.yBottom : null
        if (yFace === null) continue
        const xs = span(Math.max(rect.x0, h.xL + (h.endGap ?? 0)), Math.min(rect.x1, h.xR - (h.endGap ?? 0)))
        joined += dowelJoint(back, h.panel, xs.map((x): Vec3 => [x, yFace, zMid]), dw, dw.tag)
      }
      if (!joined) this.warnings.push({ code: "back-inset", message: "Fons de la zona encastat sense cap peça al voltant on unir-lo amb espigues: fixa'l amb cargols o llistons.", zoneId: b.zoneId, panelId: back.id })
    }
  }

  /** El fons cargolat d'una zona (`screwedZoneRect`): per darrere de les peces que la tanquen; si en sobresurt, ho diu. */
  protected buildScrewedZoneBack(b: BackZone, n: number): void {
    const { m, d } = this
    const c = m.carcass
    const q = screwedZoneRect(b, this.backZones(), this.backDividers, d.interior, { x0: 0, x1: d.W, y0: 0, y1: d.sideH })
    const z0 = d.sideZ0 - d.tb
    const visible = c.backMaterial === c.material
    const back = this.add(this.basePanel(`zone-back-${n}`, "trassera", "Fons de la zona", "back", q.x1 - q.x0, q.y1 - q.y0, d.tb, c.backMaterial, visible ? "y" : "none", visible ? edges("top", "bottom", "left", "right") : { ...NO_EDGES }, placement([q.x0, q.y0, z0], X, Y, Z, neg(Z))))
    this.backKinds[back.id] = "screwed"
    if (z0 < -0.5) this.warnings.push({ code: "back-inset", info: true, message: `Fons de la zona cargolat: va per darrere de la caixa i en sobresurt ${fmtNum(-z0, 1)} mm.`, zoneId: b.zoneId, panelId: back.id })
  }

  /** El fons en ranura d'una zona (`groovedZoneBack`): a les ranures de les peces que la tanquen. */
  protected buildGroovedZoneBack(b: BackZone, n: number): void {
    const { m, d } = this
    const c = m.carcass
    const z0 = this.zoneBackZ0(b)
    const q = groovedZoneBack({ zone: b, verticals: this.verticals, horizontals: this.horizontals, carcass: c, sideZ0: d.sideZ0, z0, grooveWidth: this.backGrooveWidth() })
    this.backKinds[this.add(this.basePanel(`zone-back-${n}`, "trassera", "Fons de la zona", "back", q.x1 - q.x0, q.y1 - q.y0, d.tb, c.backMaterial, "none", { ...NO_EDGES }, placement([q.x0, q.y0, z0], X, Y, Z, neg(Z)))).id] = "groove"
  }


  protected buildPlinth(): void {
    const { m, d } = this
    const c = m.carcass
    if (c.base.kind !== "plinth") return
    const { interior, t } = d
    const z0 = d.D - c.base.setback - t
    this.add(
      this.basePanel("plinth", "socol", "Sòcol", "plinth", interior.x1 - interior.x0, c.base.height, t, c.material, "x", edges("top", "bottom"), placement([interior.x0, 0, z0], X, Y, Z, Z)),
    )
  }
}
