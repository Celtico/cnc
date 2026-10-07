import {
  KIT_BACKS,
  KIT_CLOSINGS,
  KIT_LEVEL_LABEL,
  NO_EDGES,
  chooseVariant,
  evalKit,
  fmtMm,
  isDrawerKit,
  kitApplies,
  kitItemNumber,
  kitOptionsOf,
  kitVars,
  widthRule,
  type HardwareItem,
  type HardwareKit,
  type KitComponent,
  type KitLevel,
  type KitOptions,
  type KitShape,
  type KitVariant,
  type Panel,
  type Vec3,
} from "../model"
import { r } from "./geometry"

/**
 * **Calaix amb joc paramètric** (`HardwareKit`, `docs/ferratges-jocs.md`): el pla d'un calaix fet amb un joc del
 * fabricant (DTC MAGIC-PRO). Pur i sense el mòdul al voltant: donades la llum (LW), la fondària disponible darrere del
 * front, el gruix del tauler i del fons, i les opcions triades, diu la **llargada nominal** (la més gran que hi cap), els
 * **components** amb el número d'article (per al taller: Peces › «Ferratges dels jocs» i el LLEGEIX-ME), les **peces de
 * fusta** (fons A i darrere B, per fórmula), les **prebroques** (lateral del moble, front, darrere) i les **formes 3D**
 * dels components en coordenades del joc. `buildModule` ho col·loca al moble (`kitDrawer`). **Tot o res**: si cap NL hi
 * cap, el calaix es queda només amb el front i avisa.
 */

export interface KitOrderLine {
  component: string
  name: string
  /** Unitats per calaix (els dos costats comptats). */
  qty: number
  item?: string
  /** Llargada de tall (barres). */
  cutLength?: number
  note?: string
}

export interface KitWoodSize {
  key: "bottom" | "back"
  name: string
  /** Mides com les veu el taller: ample (X) × fondària (Z) o alçada (Y) × gruix. */
  width: number
  depth?: number
  height?: number
  thickness: number
  note?: string
}

/** Forma d'un component ja avaluada (coordenades del joc, costat esquerre). */
export interface KitSolid {
  component: KitComponent
  /** Caixa: cantonada mínima i mides; barra: cilindre al llarg de X. */
  shape: { kind: "box"; min: Vec3; size: Vec3 } | { kind: "rod"; x: number; y: number; z: number; len: number; diameter: number }
}

export interface KitPlan {
  item: HardwareItem
  kit: HardwareKit
  options: KitOptions
  variant: KitVariant
  nl: number
  /** Regla d'amplada (KB) aplicada; `null` si KB passa de la taula (avís). */
  rule: { stabilizer: KitLevel; syncRod: KitLevel } | null
  /** Llargada de tall de la barra de sincronització (si en porta). */
  syncRod?: number
  lines: KitOrderLine[]
  wood: KitWoodSize[]
  solids: KitSolid[]
  /** Prebroques al lateral del moble (z des del cantell de davant del lateral; y des de la vora inferior de la guia). */
  sidePilots: { z: number; y: number }[]
  /** Prebroques al front (x des de la cara interior del lateral del moble, per al costat esquerre; y del joc). */
  frontPilots: { x: number; y: number }[]
  /** Prebroques al darrere de fusta (x des de cada cantell; y des del cantell de baix). */
  backPilots: { x: number; y: number }[]
  pilot: { diameter: number; depth: number } | null
  vars: Record<string, number>
  warnings: string[]
}

export interface KitInput {
  /** Llum interior del compartiment (X). */
  LW: number
  /** Fondària disponible darrere de la cara de darrere del front. */
  depth: number
  /** Gruix del tauler del cos (laterals i darrere del calaix). */
  G: number
  /** Gruix del fons del calaix. */
  TB: number
  options?: Partial<KitOptions>
}

/** El gruix del fons del calaix que demana el joc (el del catàleg, 16): el `bottomThickness` de l'item si en té, si no 16. */
export const kitBottomThickness = (item: HardwareItem): number => item.params.bottomThickness ?? 16

/** El pla d'un calaix amb joc. `null` amb l'avís si el joc no serveix o no hi cap cap llargada. */
export function planKit(item: HardwareItem, input: KitInput): { plan: KitPlan | null; warnings: string[] } {
  const warnings: string[] = []
  if (!isDrawerKit(item)) return { plan: null, warnings: [`«${item.name}» no és un joc de calaix.`] }
  const kit = item.kit
  const options = kitOptionsOf(kit, input.options)
  const variant = chooseVariant(kit, input.depth, options.closing)
  if (!variant) {
    const nls = kit.variants.filter((v) => v.kit[options.closing]).map((v) => v.nl)
    warnings.push(`«${item.name}»: cap llargada (${nls.join(", ")}) hi cap en ${fmtMm(input.depth)} mm de fondària darrere del front (cal NL + ${kit.rules.depthMargin}). El calaix es queda només amb el front.`)
    return { plan: null, warnings }
  }
  const KB = r(input.LW + 2 * (kit.rules.metalBackSideThickness ?? 16))
  const rule = widthRule(kit, KB)
  if (!rule) warnings.push(`«${item.name}»: amplada de moble ${fmtMm(KB)} (LW ${fmtMm(input.LW)} + 2 × 16) fora de la taula del catàleg (fins a ${Math.max(...kit.rules.widths.map((w) => w.upTo))}): sense estabilitzador ni barra; comprova-ho amb el fabricant.`)
  const vars0 = kitVars(kit, { LW: input.LW, NL: variant.nl, KB, G: input.G, TB: input.TB })
  const cut = kit.rules.syncRodCut[options.closing]
  const syncRod = cut !== undefined && rule && rule.syncRod >= 1 ? evalKit(cut, vars0) : undefined
  const vars = { ...vars0, SR: syncRod ?? 0 }
  const pilotD = item.params.pilotDiameter ?? 0
  const pilotP = item.params.pilotDepth ?? 0
  const pilot = pilotD > 0 && pilotP > 0 ? { diameter: pilotD, depth: pilotP } : null

  const lines: KitOrderLine[] = []
  const kitNo = variant.kit[options.closing]
  lines.push({ component: "kit", name: `Joc complet NL ${variant.nl} (${KIT_CLOSINGS.find((c) => c.id === options.closing)!.label})`, qty: 1, ...(kitNo ? { item: kitNo } : {}) })
  const solids: KitSolid[] = []
  for (const c of kit.components) {
    if (!kitApplies(c.when, options, rule)) continue
    const item = kitItemNumber(c.item, variant, options.closing, KB)
    const qty = c.qty * (c.side === "both" ? 2 : 1)
    const level = c.when?.rule && rule ? rule[c.when.rule] : undefined
    const note = [c.note, level !== undefined ? KIT_LEVEL_LABEL[level] : undefined].filter(Boolean).join(" · ")
    const cutLength = c.cutLength !== undefined ? evalKit(c.cutLength, vars) : undefined
    lines.push({ component: c.id, name: c.name, qty, ...(item ? { item } : {}), ...(cutLength !== undefined ? { cutLength } : {}), ...(note ? { note } : {}) })
    for (const s of c.shapes) solids.push({ component: c, shape: solidOf(s, vars) })
  }
  const wood: KitWoodSize[] = []
  for (const w of kit.wood) {
    if (!kitApplies(w.when, options, rule)) continue
    const t = w.thickness === "bottom" ? input.TB : input.G
    wood.push({
      key: w.key,
      name: w.name,
      width: evalKit(w.width, vars),
      ...(w.depth !== undefined ? { depth: evalKit(w.depth, vars) } : {}),
      ...(w.height !== undefined ? { height: evalKit(w.height, vars) } : {}),
      thickness: t,
      ...(w.note ? { note: w.note } : {}),
    })
  }
  if (options.back === "metal" && kit.rules.metalBackSideThickness !== undefined && Math.abs(input.G - kit.rules.metalBackSideThickness) > 0.01)
    warnings.push(`«${item.name}»: el darrere metàl·lic del catàleg és per a laterals de ${kit.rules.metalBackSideThickness} mm i el mòdul és de ${fmtMm(input.G)}: cal un darrere a mida (o laterals de ${kit.rules.metalBackSideThickness}).`)
  if (Math.abs(input.TB - 16) > 0.01) warnings.push(`«${item.name}»: el catàleg suposa un fons de calaix de 16 mm i aquest és de ${fmtMm(input.TB)}: comprova l'alçada del darrere (${fmtMm(kit.heightClass.backHeight)}) amb el fabricant.`)

  const sidePilots: { z: number; y: number }[] = []
  const rows = kit.machining.side.rows
  for (const z of variant.screws.both) for (const y of rows) sidePilots.push({ z, y })
  for (const z of variant.screws.top) sidePilots.push({ z, y: rows[rows.length - 1]! })
  const frontPilots = kit.machining.front.ys.map((y) => ({ x: kit.machining.front.x, y }))
  const backPilots = kit.machining.back && options.back === "wood" ? kit.machining.back.ys.map((y) => ({ x: kit.machining.back!.xFromEdge, y })) : []
  return {
    plan: { item, kit, options, variant, nl: variant.nl, rule, ...(syncRod !== undefined ? { syncRod } : {}), lines, wood, solids, sidePilots, frontPilots, backPilots, pilot, vars, warnings },
    warnings,
  }
}

function solidOf(s: KitShape, vars: Record<string, number>): KitSolid["shape"] {
  const e = (x: number | string) => evalKit(x, vars)
  if (s.kind === "rod") return { kind: "rod", x: e(s.x), y: e(s.y), z: e(s.z), len: e(s.len), diameter: e(s.diameter) }
  return { kind: "box", min: [e(s.x), e(s.y), e(s.z)], size: [e(s.w), e(s.h), e(s.d)] }
}

/** Alçada total del joc des de la vora inferior de la guia fins a dalt del lateral del calaix. */
export const kitHeight = (kit: HardwareKit): number => kit.geometry.sideBase + kit.heightClass.boxSideHeight

/**
 * Les formes dels components com a peces de només veure (`Panel`, rol `hardware`, sense nesting) col·locades al moble:
 * `at` = punt del joc (x de la cara interior del lateral esquerre, y de la vora inferior de la guia, z de la cara de
 * darrere del front, en coordenades del mòdul) i `LW` per fer el mirall del costat dret. Els ids porten `drawer-<k>-`
 * perquè el visor les mogui amb el calaix.
 */
export function kitSolidPanels(plan: KitPlan, k: number, at: { x0: number; y0: number; zFront: number }, LW: number): Panel[] {
  const out: Panel[] = []
  let n = 0
  const material = (c: KitComponent) => c.material ?? "Acer inox"
  for (const { component: c, shape } of plan.solids) {
    const sides: ("left" | "right")[] = c.side === "both" ? ["left", "right"] : c.side === "right" ? ["right"] : ["left"]
    for (const side of sides) {
      n += 1
      const id = `drawer-${k}-kit-${c.id}-${side}-${n}`
      const label = `${c.name}${c.side === "both" ? (side === "left" ? " esq." : " dr.") : ""}`
      if (shape.kind === "rod") {
        const R = shape.diameter / 2
        const b = Math.tan(Math.PI / 8)
        // Secció al pla Z·Y i el llarg (gruix local) cap a +X, des de l'esquerra (com la barra de penjar).
        const x0 = side === "right" ? at.x0 + LW - shape.x - shape.len : at.x0 + shape.x
        out.push({
          id,
          name: "ferratge",
          label,
          role: "hardware",
          length: shape.diameter,
          width: shape.diameter,
          thickness: shape.len,
          material: material(c),
          grain: "none",
          edges: { ...NO_EDGES },
          holes: [],
          grooves: [],
          outline: [
            [2 * R, R, b],
            [R, 2 * R, b],
            [0, R, b],
            [R, 0, b],
          ],
          placement: { origin: [r(x0), r(at.y0 + shape.y - R), r(at.zFront - shape.z - R)], xAxis: [0, 0, -1], yAxis: [0, 1, 0], zAxis: [1, 0, 0], explodeDir: [0, 0, 1] },
        })
        continue
      }
      const [w, h, d] = shape.size
      const [mx, my, mz] = shape.min
      // Caixa: x local = X del mòdul, y local = Y, gruix cap a −Z (cap al fons); el costat dret és el mirall en X.
      const x0 = side === "right" ? at.x0 + LW - mx - w : at.x0 + mx
      out.push({
        id,
        name: "ferratge",
        label,
        role: "hardware",
        length: r(w),
        width: r(h),
        thickness: r(d),
        material: material(c),
        grain: "none",
        edges: { ...NO_EDGES },
        holes: [],
        grooves: [],
        placement: { origin: [r(x0), r(at.y0 + my), r(at.zFront - mz)], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, -1], explodeDir: [0, 0, 1] },
      })
    }
  }
  return out
}

/** Text d'una línia de comanda: «2 × Guia · HT104504H». */
export function kitLineText(l: KitOrderLine): string {
  const parts = [`${l.qty} × ${l.name}`]
  if (l.item) parts.push(l.item)
  if (l.cutLength !== undefined) parts.push(`tallar a ${fmtMm(l.cutLength)} mm`)
  if (l.note) parts.push(l.note)
  return parts.join(" · ")
}

/** Text d'una peça de fusta: «Fons del calaix (A) · 681 × 421 × 16». */
export function kitWoodText(w: KitWoodSize): string {
  const second = w.depth ?? w.height ?? 0
  return `${w.name} · ${fmtMm(w.width)} × ${fmtMm(second)} × ${fmtMm(w.thickness)}`
}

/** L'etiqueta de les opcions: «Tancament suau · darrere de fusta». */
export function kitOptionsText(o: KitOptions): string {
  return `${KIT_CLOSINGS.find((c) => c.id === o.closing)!.label} · ${KIT_BACKS.find((b) => b.id === o.back)!.label.toLowerCase()}`
}
