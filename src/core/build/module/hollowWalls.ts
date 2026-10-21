import { NO_EDGES, type EdgeBanding, type Panel, type PanelRole } from "../../model"
import { X, Y, Z, neg, placement, r } from "../geometry"
import { BuilderBase } from "./base"
import { edges } from "./helpers"

/**
 * Les parets buides de la caixa (`Carcass.hollow`) i la ranura del fons: la part de la carcassa (`CarcassBuilder`) que
 * no depèn dels trams de les zones (`outerSpans`).
 */
export class HollowWallsBuilder extends BuilderBase {
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
}
