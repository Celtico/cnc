import { NO_EDGES, type Carcass, type Cutout, type EdgeBanding, type Panel, type PanelRole, type Vec3, UI_PATHS, frontOptionsUse } from "../../model"
import { X, Y, Z, dowelJoint, neg, placement, r, threeAlong, toLocal } from "../geometry"
import { MIN_OPEN_RATIO, grilleCutouts, type Rect } from "../grille"
import { BuilderBase } from "./base"
import { edges, near, shapeOutline } from "./helpers"
import { fmtNum } from "../../../lib/format"

/** La carcassa: laterals, base, tapa, fons, sòcol (base «Sòcol»; el de les potes, `MountingBuilder`) i parets buides. */
export class CarcassBuilder extends BuilderBase {
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
    if (c.topFiller && d.hasTop && !c.tableTop) this.buildTopFiller(c.topFiller)
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
    const { m, d } = this
    const c = m.carcass
    const { t, sideDepth } = d
    const H = d.sideH
    const grooves: Panel["grooves"] = []
    if (c.back === "groove") {
      const g = c.grooveDepth
      // Dins de la peça: amb tauler de taula el lateral s'acaba a sota de la tapa (la ranura hi surt).
      const gy0 = Math.max(0, d.hasBase ? d.interior.y0 - g : d.interior.y0)
      const gy1 = Math.min(H, this.backGrooveTop())
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
      ? placement([0, 0, d.sideZ0], Y, Z, X, neg(X))
      : placement([d.W, 0, d.D + ext], Y, neg(Z), neg(X), X)
    if (ext && !isLeft) for (const g of grooves) g.y = r(g.y + ext)
    const panel = this.add({
      ...this.basePanel(
        isLeft ? "side-left" : "side-right",
        isLeft ? "lat e" : "lat d",
        isLeft ? "Lateral esquerre" : "Lateral dret",
        "side",
        H,
        sideDepth + ext,
        t,
        c.material,
        "x",
        d.mitreTop
          ? edges(...(ext ? [] : [isLeft ? ("top" as const) : ("bottom" as const)]), ...this.rearEdge(isLeft ? "bottom" : "top"))
          : edges(...(ext ? [] : [isLeft ? ("top" as const) : ("bottom" as const)]), "right", ...this.rearEdge(isLeft ? "bottom" : "top")),
        pl,
      ),
      grooves,
      // Local x = alçada: «right» és el cap de dalt (tapa) i «left» el de baix (base); el cantell
      // de davant és «top» a l'esquerre i «bottom» al dret.
      ...(d.mitreTop || d.mitreBottom || ext
        ? { mitres: [...(d.mitreTop ? (["right"] as const) : []), ...(d.mitreBottom ? (["left"] as const) : []), ...(ext ? [isLeft ? ("top" as const) : ("bottom" as const)] : [])] }
        : {}),
    })
    this.verticals.push({
      panel,
      xL: isLeft ? 0 : d.W - t,
      xR: isLeft ? t : d.W,
      yB: 0,
      yT: H,
      zRear: d.sideZ0,
      zFront: d.D,
      outer: true,
    })
  }

  // --- Parets buides ------------------------------------------------------------------
  // Cada paret: pell de fora i pell de dins (el tauler), llistons entre pells (darrere i
  // extrems) i una tira al davant que tapa els cantells. La pell de dins fa de «paret» per
  // a l'interior (forats de prestatge, guies, frontisses, ranura del fons).

  protected hollowPiece(id: string, name: string, label: string, role: PanelRole, length: number, width: number, eb: EdgeBanding, pl: Panel["placement"], grain: Panel["grain"] = "x"): Panel {
    const c = this.m.carcass
    // Totes les peces d'una paret buida s'encolen juntes abans de muntar el moble.
    const assembly = `${label.replace(/ \(.*\)$/, "")} (paret buida)`
    return this.add({ ...this.basePanel(id, name, label, role, length, width, this.d.t, c.material, grain, eb, pl), assembly })
  }

  /**
   * Cantonades de les parets buides: sempre a inglet on un lateral es troba amb la tapa o la
   * base (com un bloc massís, sense cap cantell). Les pells de fora del sostre i de la base
   * van de fora a fora amb el cantell a 45°, igual que les dels laterals; les tires del davant
   * fan un marc amb els talls a 45° en el seu pla (contorn, es fa al nesting).
   */
  protected hollowCorners(): { top: boolean; bottom: boolean } {
    const { m, d } = this
    return {
      top: !!d.hollow && d.hasTop && m.carcass.top.kind === "full" && !d.tableTop,
      bottom: !!d.hollow && d.hasBase && d.baseY === 0,
    }
  }

  protected buildHollowSide(isLeft: boolean): void {
    const { m, d } = this
    const c = m.carcass
    const { t, W, D, sideZ0, ws } = d
    const H = d.sideH
    const k = isLeft ? "left" : "right"
    const nm = isLeft ? "Lateral esquerre" : "Lateral dret"
    const skinDepth = D - t - sideZ0
    const mc = this.hollowCorners()
    // La pell de dins queda entre les pells de fora de la base i del sostre quan són a inglet.
    const yi0 = mc.bottom ? t : 0
    const yi1 = mc.top ? H - t : H
    const grooves: Panel["grooves"] = []
    if (c.back === "groove") {
      const g = c.grooveDepth
      const gy0 = Math.max(yi0, d.hasBase ? d.interior.y0 - g : d.interior.y0)
      const gy1 = Math.min(yi1, this.backGrooveTop())
      const gw = this.backGrooveWidth()
      grooves.push({ x: r(gy0 - yi0), y: isLeft ? r(c.backSetback) : r(skinDepth - c.backSetback - gw), w: r(gy1 - gy0), h: gw, depth: g, face: "A", tag: "back" })
    }
    // Pells: la de fora a x = 0 / W, la de dins a la cara interior (x = ws / W − ws), cara A cap a dins.
    const outer = isLeft
      ? placement([0, 0, sideZ0], Y, Z, X, neg(X))
      : placement([W, 0, D - t], Y, neg(Z), neg(X), X)
    const inner = isLeft
      ? placement([ws - t, yi0, sideZ0], Y, Z, X, neg(X))
      : placement([W - ws + t, yi0, D - t], Y, neg(Z), neg(X), X)
    const outerMitres = [...(mc.bottom ? (["left"] as const) : []), ...(mc.top ? (["right"] as const) : [])]
    const outerPanel = this.hollowPiece(`side-${k}`, isLeft ? "lat e" : "lat d", `${nm} (pell de fora)`, "side", H, skinDepth, mc.top ? { ...NO_EDGES } : edges("right"), outer)
    if (outerMitres.length) outerPanel.mitres = [...outerMitres]
    const innerPanel = this.add({ ...this.basePanel(`side-${k}-inner`, isLeft ? "lat e int" : "lat d int", `${nm} (pell de dins)`, "side", yi1 - yi0, skinDepth, t, c.material, "x", mc.top ? { ...NO_EDGES } : edges("right"), inner), grooves, assembly: `${nm} (paret buida)` })
    // Tira del davant: tota l'alçada i tot el gruix aparent; a les cantonades, tall a 45° en el seu pla.
    const xMax = isLeft ? ws : W
    const yOut = isLeft ? ws : 0
    const yIn = isLeft ? 0 : ws
    const facing = this.hollowPiece(`side-${k}-facing`, "tira", `${nm} (tira del davant)`, "facing", H, ws, edges(...(mc.top ? [] : (["right"] as const)), isLeft ? "top" : "bottom"), placement([xMax, 0, D - t], Y, neg(X), Z, Z))
    if (mc.top || mc.bottom) facing.outline = [[0, yOut], [H, yOut], [mc.top ? H - d.wt : H, yIn], [mc.bottom ? d.wb : 0, yIn]]
    // Llistons: darrere (entre les pells de fora de base i sostre) i als extrems que no tanca cap pell.
    const xIn = isLeft ? ws - t : W - t
    const gap = ws - 2 * t
    this.hollowPiece(`side-${k}-spacer-back`, "llistó", `${nm} (llistó del darrere)`, "spacer", yi1 - yi0, gap, { ...NO_EDGES }, placement([xIn, yi0, sideZ0], Y, neg(X), Z, neg(Z)))
    const spL = D - t - sideZ0 - t
    for (const [end, y] of [["bottom", t], ["top", H]] as const) {
      if ((end === "top" && mc.top) || (end === "bottom" && mc.bottom)) continue
      this.hollowPiece(`side-${k}-spacer-${end}`, "llistó", `${nm} (llistó ${end === "top" ? "de dalt" : "de baix"})`, "spacer", spL, gap, { ...NO_EDGES }, placement([xIn, y, sideZ0 + t], Z, neg(X), neg(Y), end === "top" ? Y : neg(Y)))
    }
    this.verticals.push({ panel: innerPanel, xL: isLeft ? 0 : W - ws, xR: isLeft ? ws : W, yB: 0, yT: H, zRear: sideZ0, zFront: D, outer: true })
  }

  protected buildHollowHorizontal(which: "bottom" | "top"): void {
    const { m, d } = this
    const c = m.carcass
    const { t, D, sideZ0, interior, ws } = d
    const isBottom = which === "bottom"
    const w = isBottom ? d.wb : d.wt
    const y0 = isBottom ? d.baseY : d.H - w
    const x0 = interior.x0
    const len = interior.x1 - interior.x0
    const skinDepth = D - t - sideZ0
    const nm = isBottom ? "Base" : "Sostre"
    const mc = this.hollowCorners()
    const mitred = isBottom ? mc.bottom : mc.top
    // A inglet: la pell de fora i la tira van de fora a fora (fins a x = 0 / W on hi ha lateral).
    const mL = mitred && c.sides.left
    const mR = mitred && c.sides.right
    const ox0 = mL ? 0 : x0
    const olen = (mR ? d.W : interior.x1) - ox0
    const grooves: Panel["grooves"] = []
    if (c.back === "groove")
      grooves.push({ x: 0, y: isBottom ? r(skinDepth - c.backSetback - this.backGrooveWidth()) : r(c.backSetback), w: r(len), h: this.backGrooveWidth(), depth: c.grooveDepth, face: "A", tag: "back" })
    // Pells: la de fora (a baix a la base, a dalt al sostre) i la de dins, cara A cap a l'interior.
    const outerPl = isBottom ? placement([ox0, y0, D - t], X, neg(Z), Y, neg(Y)) : placement([ox0, d.H, sideZ0], X, Z, neg(Y), Y)
    const innerPl = isBottom ? placement([x0, y0 + w - t, D - t], X, neg(Z), Y, neg(Y)) : placement([x0, d.H - w + t, sideZ0], X, Z, neg(Y), Y)
    const outerPanel = this.hollowPiece(which, isBottom ? "baix" : "dalt", `${nm} (pell de fora)`, which, olen, skinDepth, { ...NO_EDGES }, outerPl)
    if (mL || mR) outerPanel.mitres = [...(mL ? (["left"] as const) : []), ...(mR ? (["right"] as const) : [])]
    const innerPanel = this.add({ ...this.basePanel(`${which}-inner`, isBottom ? "baix int" : "dalt int", `${nm} (pell de dins)`, which, len, skinDepth, t, c.material, "x", { ...NO_EDGES }, innerPl), grooves, assembly: `${nm} (paret buida)` })
    // Tira del davant (el cantell que es veu, de gruix aparent), amb els talls a 45° del marc.
    const facing = this.hollowPiece(`${which}-facing`, "tira", `${nm} (tira del davant)`, "facing", olen, w, edges(isBottom ? "bottom" : "top"), placement([ox0, y0, D - t], X, Y, Z, Z))
    if (mL || mR) {
      const yOut = isBottom ? 0 : w
      const yIn = isBottom ? w : 0
      facing.outline = [[0, yOut], [olen, yOut], [mR ? olen - ws : olen, yIn], [mL ? ws : 0, yIn]]
    }
    // Llistons: darrere i als dos extrems.
    const gap = w - 2 * t
    this.hollowPiece(`${which}-spacer-back`, "llistó", `${nm} (llistó del darrere)`, "spacer", len, gap, { ...NO_EDGES }, placement([x0, y0 + t, sideZ0], X, Y, Z, neg(Z)))
    const spL = D - t - sideZ0 - t
    for (const [end, x] of [["left", x0], ["right", x0 + len - t]] as const)
      this.hollowPiece(`${which}-spacer-${end}`, "llistó", `${nm} (llistó ${end === "left" ? "esquerre" : "dret"})`, "spacer", spL, gap, { ...NO_EDGES }, placement([x, y0 + t, D - t], neg(Z), Y, X, end === "left" ? neg(X) : X))
    this.horizontals.push({ panel: innerPanel, yBottom: y0, yTop: y0 + w, xL: interior.x0, xR: interior.x1, outer: true, zRear: sideZ0, zFront: D - t })
  }

  protected buildHorizontal(which: "bottom" | "top"): void {
    if (this.d.hollow && (which === "bottom" || (this.m.carcass.top.kind === "full" && !this.d.tableTop))) return this.buildHollowHorizontal(which)
    const { m, d } = this
    const c = m.carcass
    const { t, interior } = d
    const isBottom = which === "bottom"
    // Tapa a inglet: arriba fins a fora de cada lateral (x = 0 / W), amb el cantell a 45°.
    const mitreL = (isBottom ? d.mitreBottom : d.mitreTop) && c.sides.left
    const mitreR = (isBottom ? d.mitreBottom : d.mitreTop) && c.sides.right
    // Tauler de taula: per sobre dels laterals, amb voladís a tot el voltant.
    const ov = !isBottom && d.tableTop ? d.tableTop.overhang : 0
    const onTop = !isBottom && !!d.tableTop
    const px0 = onTop ? -ov : mitreL ? 0 : interior.x0
    const length = onTop ? d.W + 2 * ov : (mitreR ? d.W : interior.x1) - px0
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
      const gx0 = interior.x0 - (c.sides.left && px0 < interior.x0 - 0.01 ? g : 0)
      const gx1 = interior.x1 + (c.sides.right && px0 + length > interior.x1 + 0.01 ? g : 0)
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
        which,
        isBottom ? "baix" : "dalt",
        isBottom ? "Base" : "Sostre",
        which,
        length,
        width,
        t,
        c.material,
        "x",
        onTop ? edges("top", "bottom", "left", "right") : edges(...(ext ? [] : [isBottom ? ("bottom" as const) : ("top" as const)]), ...this.rearEdge(isBottom ? "top" : "bottom")),
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
    this.horizontals.push({ panel, yBottom, yTop: yBottom + t, xL: interior.x0, xR: interior.x1, outer: true, zRear, zFront: zRear + width })

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
      if (!near(xFace, interior.x0) && !near(xFace, interior.x1)) continue
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
      this.add(
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
    this.add(
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
    const back = this.add(
      this.basePanel("back", "trassera", "Fons", "back", interior.x1 - interior.x0, interior.y1 - interior.y0, d.tb, c.backMaterial, visible ? "y" : "none", eb, placement([interior.x0, interior.y0, z0], X, Y, Z, neg(Z))),
    )
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
    const join = (through: Panel, pts: Vec3[]) =>
      dowelJoint(back, through, pts.filter((w) => {
        const l = toLocal(through, w)
        return l[0] >= rad && l[0] <= through.length - rad && l[1] >= rad && l[1] <= through.width - rad
      }), dw, dw.tag)
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

  /** Ample de la ranura del fons: el gruix del fons + el joc de Folgances (`Carcass.grooveClearance`; sense, 0). */
  protected backGrooveWidth(): number {
    return this.d.tb + (this.m.carcass.grooveClearance ?? 0)
  }

  /** Y de dalt de la ranura del fons: dins de la tapa (g), si la tapa porta ranura. */
  protected backGrooveTop(): number {
    const { m, d } = this
    const c = m.carcass
    // Tapa amb ranura d'aire: no porta ranura del fons i el fons s'atura a sota (no hi entra).
    if (!d.hasTop || c.top.kind === "ventSlot") return d.interior.y1
    return d.interior.y1 + c.grooveDepth
  }

  /** Sòcol de dalt (`Carcass.topFiller`): dret sobre la tapa, de tota l'amplada, fins al sostre. */
  protected buildTopFiller(f: NonNullable<Carcass["topFiller"]>): void {
    const { m, d } = this
    const t = d.t
    const z0 = d.D - f.setback - t
    this.add(this.basePanel("top-filler", "socol d", "Sòcol de dalt", "plinth", d.W, f.height, t, m.carcass.material, "x", edges("bottom", "left", "right"), placement([0, d.H, z0], X, Y, Z, Z)))
    this.warnings.push({ code: "top-filler", info: true, message: `Sòcol de dalt de ${fmtNum(f.height)} mm: es cargola a la tapa per dins amb escaires; tallar-lo a l'alçada real del sostre a l'obra.` })
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
