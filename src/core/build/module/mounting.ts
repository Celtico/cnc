import type { Hole, Panel, Vec3 } from "../../model"
import { X, Y, Z, addFaceHole, placement, r, toLocal, toWorld } from "../geometry"
import { aluPlinth, plinthPieces, woodPlinthPanels, type PlinthFrame } from "../plinth"
import { CarcassBuilder } from "./carcass"
import { edges, near, num } from "./helpers"

/**
 * Com s'aguanta el mòdul: el **sòcol** de la base «Potes» (davant i, si es tria, darrere i laterals; de fusta o d'alumini)
 * i els **penjadors** del mòdul penjat amb la seva **regleta** de paret (v45).
 */
export class MountingBuilder extends CarcassBuilder {
  /**
   * Sòcol de la base «Potes» (`Base.plinth`): de terra fins a 5 mm sota la base (la de fusta) o de l'alçada del perfil
   * (l'alumini). Només al davant i de fusta, la peça de sempre (`plinth`); amb més costats o d'alumini, `plinthPieces`.
   */
  buildLegPlinth(): void {
    const { m, d } = this
    const c = m.carcass
    if (c.base.kind !== "legs" || !c.base.plinth) return
    const pl = c.base.plinth
    const H = c.base.height
    const h = r(H - 5)
    if (h <= 0) return
    const sides = { front: true, back: !!pl.back, left: !!pl.left, right: !!pl.right }
    const ss = pl.sideSetback ?? pl.setback
    const z0 = d.D - pl.setback - d.t
    if (!sides.back && !sides.left && !sides.right && !pl.hardware) {
      this.add(this.basePanel("plinth", "socol", "Sòcol", "plinth", d.W, h, d.t, c.material, "x", edges("top", "bottom"), placement([0, -H, z0], X, Y, Z, Z)))
    } else {
      const frame = { x0: sides.left ? ss : 0, x1: sides.right ? d.W - ss : d.W, zBack: sides.back ? ss : 0, zFront: d.D - pl.setback, y0: -H, sides }
      if (pl.hardware) {
        let alu: ReturnType<typeof aluPlinth>
        try {
          alu = aluPlinth(frame, pl.hardware)
        } catch (err) {
          this.hardwareWarning(`Sòcol: ${err instanceof Error ? err.message : String(err)}. No es fa.`)
          return
        }
        this.extras.push(...alu.extras)
        this.linear.push(...alu.pieces)
        if (alu.height > H + 0.5) this.hardwareWarning(`«${pl.hardware.name}» fa ${num(alu.height)} mm d'alçada i les potes ${num(H)}: no hi cap. Posa les potes a ${num(alu.height)} mm o més o tria un sòcol més baix.`)
        else if (H - alu.height > 20) this.hardwareWarning(`«${pl.hardware.name}» fa ${num(alu.height)} mm d'alçada i les potes ${num(H)}: queda un forat de ${num(H - alu.height)} mm sota la base. Baixa les potes o tria un sòcol més alt.`)
      } else {
        const frameT: PlinthFrame = { ...frame, h, t: d.t, corners: pl.corners ?? "butt" }
        for (const p of woodPlinthPanels(frameT, c.material)) this.add(p)
        if (frameT.corners === "mitre" && plinthPieces(frameT).some((p) => p.mitres.length))
          this.warnings.push({ code: "mitre", message: "Sòcol a inglet: tall a 45° als extrems dels trams que fan cantonada; encolar-los (o una escaire per dins)." })
      }
    }
    this.checkLegFeet(sides, pl.setback, ss, pl.hardware ? Number(pl.hardware.params.depth ?? d.t) : d.t)
  }

  /** El peu de les potes (Ø78 de l'AXILO; les genèriques, Ø48) ha de quedar darrere de cada tram del sòcol. */
  private checkLegFeet(sides: { back: boolean; left: boolean; right: boolean }, setback: number, ss: number, t: number): void {
    const c = this.m.carcass
    if (c.base.kind !== "legs") return
    const hw = c.base.hardware
    const leg = hw?.engine === "leg" ? hw.params : undefined
    const inset = (k: string) => leg?.[k] ?? leg?.inset ?? 50
    const foot = leg ? (leg.foot ?? 48) / 2 : 24
    const check = (label: string, at: number, insetKey: string, setbackLabel: string) => {
      const legAt = inset(insetKey)
      if (at + t > legAt - foot + 0.5)
        this.warnings.push({ code: "hardware", message: `El sòcol ${label} (a ${num(at)} mm ${setbackLabel}) toca el peu de les potes (a ${num(legAt)} mm, Ø${num(foot * 2)}): retira'l fins a ${num(Math.max(0, legAt - foot - t))} mm com a molt o posa les potes més endins.` })
    }
    check("del davant", setback, "insetFront", "del davant")
    if (sides.back) check("del darrere", ss, "insetBack", "del darrere")
    if (sides.left) check("esquerre", ss, "insetLeft", "del lateral")
    if (sides.right) check("dret", ss, "insetRight", "del lateral")
  }

  /**
   * **Penjadors** del mòdul penjat (`Base.hanger`; per decisió de l'usuari, 2026-10-15: «penjador regulable i regleta»):
   * un a cada lateral, a la cara de dins de la cantonada de dalt i darrere (els forats del target `side`, tot o res per
   * penjador), l'**osca** del fons a les cantonades de dalt perquè hi passi el ganxo i la **regleta** de paret on
   * s'enganxa (`Base.rail`, ferratge per metres: de lateral a lateral, darrere del fons; a la comanda, ajuntada amb la dels
   * penjats del costat). El ganxo i la regleta van entre la paret i el fons: cal que el fons en deixi lloc (`gap`).
   */
  buildHangers(): void {
    const { m, d } = this
    const c = m.carcass
    if (c.base.kind !== "wall" || c.base.hanger === "none") return
    // Els laterals on va un penjador; sense cap (res amagat compta), el penjador no es llegeix ni avisa.
    const at = (["left", "right"] as const).flatMap((side) => {
      const v = c.sides[side] ? this.verticals.find((x) => x.outer && (side === "left" ? near(x.xR, d.interior.x0) : near(x.xL, d.interior.x1))) : undefined
      return v ? [{ side, v }] : []
    })
    if (!at.length) return
    const hanger = this.frontHardware("hanger", c.base.hanger)
    const spec = hanger.spec
    const item = hanger.item
    const placed: ("left" | "right")[] = []
    for (const { side, v } of at) {
      const xFace = side === "left" ? v.xR : v.xL
      const holes: { w: Vec3; hole: { diameter: number; depth: number; tag: string } }[] = spec.holes.map((h) => ({
        w: [xFace, r(d.H - spec.fromTop - h.u), r(d.sideZ0 + spec.fromBack + h.v)],
        hole: { diameter: h.d, depth: Math.min(h.depth, v.panel.thickness - 1), tag: h.tag },
      }))
      // Tot o res: sobre la peça i davant del fons (el cos del penjador va entre el fons i el davant).
      const behind = holes.some((h) => h.w[2] - h.hole.diameter / 2 < d.backInnerZ - 0.5)
      const copy: Panel = { ...v.panel, holes: [...v.panel.holes] }
      if (behind || !holes.every((h) => addFaceHole(copy, h.w, h.hole))) {
        this.hardwareWarning(`«${item.name}»: els forats del penjador ${side === "left" ? "esquerre" : "dret"} no hi caben (a ${num(spec.fromTop)} de dalt i ${num(spec.fromBack)} del darrere${behind ? ", darrere del fons" : ""}). No es fan: revisa el penjador a Preferències › Ferratges o la retirada del fons.`)
        continue
      }
      v.panel.holes = copy.holes
      placed.push(side)
      // El cos (a la cara del lateral, davant del fons) i el ganxo (fins a la regleta, darrere del fons): només es veuen.
      const ys = holes.map((h) => h.w[1])
      const yc = (Math.min(...ys) + Math.max(...ys)) / 2
      const b = spec.body
      const bx = side === "left" ? xFace : xFace - b.width
      const yTop = Math.min(d.interior.y1, yc + b.height / 2)
      this.hwBox(`hanger-${side}`, `${item.name} (${side === "left" ? "esquerre" : "dret"})`, "Acer inox", [bx, yTop - b.height, d.backInnerZ], [b.width, b.height, b.depth])
      // La filera System 32 de darrere que queda sota el cos del penjador no es fa (el penjador la tapa).
      const under = (h: Hole) => {
        const w = toWorld(v.panel, [h.x, h.y, 0])
        return h.tag === "system32" && w[1] > yTop - b.height - h.diameter / 2 && w[1] < yTop + h.diameter / 2 && w[2] < d.backInnerZ + b.depth + h.diameter / 2
      }
      v.panel.holes = v.panel.holes.filter((h) => !under(h))
      const hookY = d.H - spec.railTop
      if (d.backInnerZ > 1) this.hwBox(`hanger-${side}-hook`, `${item.name}: ganxo`, "Acer inox", [side === "left" ? xFace : xFace - b.width / 2, hookY - 25, 0], [b.width / 2, 35, d.backInnerZ])
    }
    if (!placed.length) return
    this.order(item, placed.length, placed.length === 2 ? "un a cada lateral (esquerre i dret)" : undefined)
    this.notchBack(placed, spec.notchWidth, spec.notchHeight)
    // L'espai darrere del fons per a la regleta i el ganxo.
    const room = c.back === "groove" ? c.backSetback : c.back === "inset" ? (c.backInsetSetback ?? 0) : c.back === "screwed" ? 0 : Infinity
    if (room < spec.gap)
      this.warnings.push({
        code: "hanging",
        message: `Penjadors: la regleta i el ganxo van entre la paret i el fons i hi calen ${num(spec.gap)} mm; ${c.back === "screwed" ? "el fons cargolat darrere no en deixa" : `el fons en deixa ${num(room)}`}. Posa el fons en ranura amb la «Ranura del fons» a ${num(spec.gap)} mm o més (o encastat retirat) a ${"Mòdul › Caixa"}.`,
      })
    this.buildWallRail(spec.railTop)
  }

  /** La regleta de paret (`Base.rail`; «Cap» = sense: penjadors amb plaques soltes): de lateral a lateral, contra la paret. */
  private buildWallRail(railTop: number): void {
    const { m, d } = this
    const c = m.carcass
    if (c.base.kind !== "wall" || c.base.rail === "none") return
    const rail = this.frontHardware("wallRail", c.base.rail)
    const s = rail.spec
    const yTop = r(d.H - railTop)
    this.hwBox("wall-rail", rail.item.name, rail.item.material ?? "Acer inox", [0, yTop - s.height, 0], [d.W, s.height, s.depth])
    const it = rail.item
    this.linear.push({
      item: { id: it.id, name: it.name, ...(it.ref ? { ref: it.ref } : {}), ...(it.maker ? { maker: it.maker } : {}), ...(it.linear ? { linear: it.linear } : {}) },
      length: d.W,
      stock: s.stock,
      clipSpacing: s.clipSpacing,
      clipEnd: s.clipEnd,
      corners: 0,
      run: { x0: 0, x1: d.W, y: yTop, z: 0 },
    })
  }

  /**
   * L'osca del fons a les cantonades de dalt dels penjadors (`notchWidth` des de la cara del lateral, `notchHeight` des de
   * dalt del moble): el ganxo hi passa cap a la regleta. Contorn de la peça (`Panel.outline`, com les osques de les
   * columnes); els forats o talls que hi queien es treuen.
   */
  private notchBack(sides: ("left" | "right")[], w: number, hgt: number): void {
    const { d } = this
    if (!(w > 0) || !(hgt > 0)) return
    const back = this.panels.find((p) => p.id === "back")
    if (!back || back.outline) return
    const L = back.length, Wd = back.width
    const yl = toLocal(back, [d.interior.x0 + w, d.H - hgt, back.placement.origin[2]])[1]
    if (yl >= Wd - 0.5) return
    if (yl <= 0.5) {
      this.hardwareWarning("Penjadors: l'osca del fons per al ganxo seria de tota l'alçada del fons. No es fa: revisa l'osca del penjador.")
      return
    }
    const xl = sides.includes("left") ? toLocal(back, [d.interior.x0 + w, d.H - hgt, back.placement.origin[2]])[0] : 0
    const xr = sides.includes("right") ? toLocal(back, [d.interior.x1 - w, d.H - hgt, back.placement.origin[2]])[0] : L
    if (xl <= 0.5 && xr >= L - 0.5) return
    const y = r(yl)
    const pts: [number, number][] = [[0, 0], [L, 0]]
    if (xr < L - 0.5) pts.push([L, y], [r(xr), y], [r(xr), Wd])
    else pts.push([L, Wd])
    if (xl > 0.5) pts.push([r(xl), Wd], [r(xl), y], [0, y])
    else pts.push([0, Wd])
    const inNotch = (x: number, yy: number) => yy > y && (x < xl || x > xr)
    back.outline = pts
    back.holes = back.holes.filter((h: Hole) => !inNotch(h.x, h.y))
    if (back.cutouts) back.cutouts = back.cutouts.filter((cu) => cu.kind === "polygon" || !inNotch(cu.x, cu.y))
  }
}
