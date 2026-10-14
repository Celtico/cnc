import { NO_EDGES, type HardwareItem, type Hole, type Panel, type PanelRole } from "../model"
import { r, system32Ys, threeAlong } from "./geometry"
import { planKit } from "./drawerKit"
import { planLights } from "./lightKit"
import { applyHardware, cupSpec, dowelSpec, flapSpec, glassFrameSpec, handleSpec, ledSpec, legSpec, magnetSpec, plateSpec, railSpec, slideSpec, system32Spec, HardwareError } from "./hardware"

/**
 * Peces d'exemple amb el patró de mecanitzats d'un ferratge (Preferències › Ferratges: la targeta i l'editor), fetes amb
 * **el mateix motor** que el moble (`applyHardware` i els números de cada regla), sense el moble al voltant (sense la
 * filera System 32 on s'ajusten les cassoletes, per exemple). Pur: es dibuixa amb `PanelDrawing`.
 */

function sample(id: string, label: string, role: PanelRole, length: number, width: number, thickness = 19): Panel {
  return {
    id,
    name: id,
    label,
    role,
    length,
    width,
    thickness,
    material: "",
    grain: "none",
    edges: { ...NO_EDGES },
    holes: [],
    grooves: [],
    placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1], explodeDir: [0, 0, 1] },
  }
}

const hole = (x: number, y: number, s: { diameter: number; depth: number; tag?: string }, face: Hole["face"] = "A", edge?: Hole["edge"]): Hole => ({
  x: r(x),
  y: r(y),
  diameter: s.diameter,
  depth: s.depth,
  face,
  ...(edge ? { edge } : {}),
  ...(s.tag ? { tag: s.tag } : {}),
})

/** Lateral d'exemple amb els forats d'una placa a cada alçada `xs` (marc de la placa: v cap al darrere, u = v × n). */
function plateSample(xs: number[], s: { setback: number; holes: { u: number; v: number; d: number; depth: number; tag?: string }[] }): Panel {
  const side = sample("side", "Lateral (placa)", "side", 720, 400)
  for (const x of xs) for (const h of s.holes) side.holes.push(hole(x + h.u, s.setback + h.v, { diameter: h.d, depth: h.depth, tag: h.tag ?? "plate" }))
  return side
}

/** Les peces d'exemple (una o dues). Si l'item no es pot fer servir, l'error en català. */
export function hardwarePreview(item: HardwareItem): { panels: Panel[]; error?: string } {
  try {
    return { panels: previewPanels(item) }
  } catch (err) {
    return { panels: [], error: err instanceof HardwareError ? err.message : String(err) }
  }
}

function previewPanels(item: HardwareItem): Panel[] {
  switch (item.engine) {
    case "cup": {
      // Porta de 720 × 400 (x = alçada) amb la frontissa a l'esquerra.
      const s = cupSpec(item)
      const door = sample("door", "Porta d'exemple", "door", 720, 400)
      const n = s.count(door.length)
      const span = door.length - 2 * s.endOffset
      const xs = n === 1 ? [door.length / 2] : Array.from({ length: n }, (_, i) => s.endOffset + (span * i) / (n - 1))
      for (const x of xs) door.holes.push(...applyHardware(item, "door", {}, { at: { x: r(x), y: 0 } }).holes)
      if (!s.plate) return [door]
      // Placa aparellada: el lateral (x = alçada, y = fondària des del davant, cara A cap a dins) a l'alçada de cada cassoleta.
      const side = plateSample(xs.map((x) => x + s.plate!.offset), s.plate)
      return [door, side]
    }
    case "plate": {
      const s = plateSpec(item)
      return [plateSample([360 + s.offset], s)]
    }
    case "system32": {
      // Lateral de 720 × 560 (x = alçada) amb les dues fileres.
      const s = system32Spec(item)
      const side = sample("side", "Lateral d'exemple", "side", 720, 560)
      for (const x of system32Ys(0, side.length, s.edgeOffset, s.pitch)) for (const y of [s.edgeOffset, side.width - s.edgeOffset]) side.holes.push(hole(x, y, s.hole))
      return [side]
    }
    case "dowel": {
      // Base de 560 de fons que topa amb un lateral: forats de cantell a la base i de cara al lateral.
      const s = dowelSpec(item)
      const xs = threeAlong(0, 560, s.endOffset)
      const butt = sample("butt", "Peça que hi topa (cantell)", "bottom", 560, 300)
      const through = sample("through", "Peça que continua (cara)", "side", 560, 200)
      for (const x of xs) {
        butt.holes.push(hole(x, 0, { diameter: s.diameter, depth: s.edgeDepth, tag: s.tag }, "edge", "bottom"))
        through.holes.push(hole(x, 9.5, { diameter: s.diameter, depth: s.faceDepth, tag: s.tag }))
      }
      return [butt, through]
    }
    case "slide": {
      // Lateral del moble (x = fondària des del darrere; el front a la dreta) i lateral de la caixa de la guia més llarga.
      const s = slideSpec(item)
      const len = Math.max(...s.slideLengths)
      const side = sample("side", "Lateral del moble", "side", 560, 200)
      const box = sample("box", `Lateral de la caixa (guia de ${len})`, "drawerSide", len, 150, s.boxThickness)
      for (const [p, spec, front] of [[side, s.side, side.length], [box, s.box, box.length]] as const) {
        for (const x of [front - s.frontOffset, front - s.frontOffset - s.secondOffset]) if (x > spec.diameter) p.holes.push(hole(x, s.holeHeight, spec))
      }
      return [side, box]
    }
    case "flapArm": {
      // Abatible de 400 d'alt (x) × 600 d'ample, que gira pel cantell de baix.
      const s = flapSpec(item)
      const flap = sample("flap", "Abatible d'exemple", "flap", 400, 600)
      for (const y of [s.endOffset, flap.width - s.endOffset]) flap.holes.push(...applyHardware(item, "flap", {}, { at: { x: 0, y } }).holes)
      return [flap]
    }
    case "magnet": {
      // Reixeta desmuntable de 700 × 400: imants a la cara del front i al cantell dels laterals, a `cornerOffset` dels extrems.
      const s = magnetSpec(item)
      const front = sample("front", "Front (cara)", "grille", 700, 400)
      const side = sample("side", "Lateral (cantell de davant)", "side", 700, 300)
      for (const x of [s.cornerOffset, front.length - s.cornerOffset]) {
        for (const y of [9.5, front.width - 9.5]) front.holes.push(hole(x, y, s.front))
        side.holes.push(hole(x, side.width, s.side, "edge", "top"))
      }
      return [front, side]
    }
    case "barHandle": {
      // Un calaix ample i un d'estret: la distància entre forats canvia amb l'espai.
      const s = handleSpec(item)
      return [600, 230].map((w, i) => {
        const p = sample(`front-${i}`, `Front de ${w}`, "drawerFront", w, 180)
        p.cutouts = applyHardware(item, "front", { pitch: s.pitch(w) }, { at: { x: w / 2, y: 90 }, round: true }).cutouts
        return p
      })
    }
    case "leg": {
      // Base de 600 × 450 vista des de sota (x = amplada, y = fondària des del darrere): una placa a cada cantonada.
      const s = legSpec(item)
      const base = sample("base", "Base (cara de sota)", "bottom", 600, 450)
      // Com al moble (`buildLegs`): les del darrere a `insetBack`, les del davant a `insetFront` i, amb `mirror`, les de la
      // dreta en mirall. (Aquí y creix cap al davant, com la v del marc de la pota.)
      for (const x of [s.inset, base.length - s.inset])
        for (const y of [s.insetBack, base.width - s.insetFront])
          for (const h of s.holes) base.holes.push(hole(x + (s.mirror && x > base.length / 2 ? -h.u : h.u), y + h.v, { diameter: h.d, depth: h.depth, tag: h.tag }))
      return [base]
    }
    case "model":
      // Només 3D: cap peça ni forat.
      return []
    case "ledProfile": {
      if (!item.light) {
        ledSpec(item)
        return []
      }
      // Joc de llum: un prestatge de 600 × 350 per la cara de sota, amb els forats de les làmpades i del cable.
      const spec = ledSpec(item)
      const shelf = sample("shelf", "Prestatge (cara de sota)", "shelf", 600, 350)
      const plan = planLights(item.light, spec, { length: shelf.length, depth: shelf.width }, shelf.thickness)
      if (!plan.xs.length) throw new HardwareError(plan.warnings[0] ?? `«${item.name}»: cap làmpada hi cap`)
      const k = item.light
      const y = shelf.width - plan.z
      for (const x of plan.xs) {
        if (plan.bar) {
          const x0 = x - plan.bar.cut / 2
          if (plan.recessed) shelf.grooves.push({ x: r(x0), y: r(y - k.recess.size / 2), w: plan.bar.cut, h: k.recess.size, depth: plan.depth, face: "B", tag: "light" })
          ;(shelf.cutouts ??= []).push({ kind: "circle", x: r(x0 + 20), y: r(y), diameter: k.cableHole, tag: "cable" })
          continue
        }
        if (plan.recessed) {
          if (k.recess.shape === "round") shelf.holes.push(hole(x, y, { diameter: k.recess.size, depth: plan.depth, tag: "light" }, "B"))
          else shelf.grooves.push({ x: r(x - k.recess.size / 2), y: r(y - k.recess.size / 2), w: k.recess.size, h: k.recess.size, depth: plan.depth, face: "B", tag: "light" })
        }
        ;(shelf.cutouts ??= []).push({ kind: "circle", x: r(x), y: r(y), diameter: k.cableHole, tag: "cable" })
      }
      return [shelf]
    }
    case "glassFrame": {
      // Un marc amb frontisses de perfil (Metallamat A): la placa al lateral (x = fondària des del darrere; el davant a la
      // dreta), a `plateSetback` del davant; sense, cap mecanitzat (el marc de l'app).
      const spec = glassFrameSpec(item)
      if (!spec.hinges) return []
      const side = sample("side", "Lateral (placa de la frontissa)", "side", 400, 200)
      const x = side.length - spec.hinges.plate.setback
      for (const h of spec.hinges.plate.holes) side.holes.push(hole(x - h.v, 100 + h.u, { diameter: h.d, depth: h.depth, tag: h.tag ?? "plate" }))
      return [side]
    }
    case "rail":
      // Accessori: sense mecanitzat de moment (suports de la barra: pendents del taller). Es comprova que els números hi
      // siguin; el muntatge («Com va muntat») l'ensenya.
      railSpec(item)
      return []
    case "drawerKit": {
      // Lateral del moble (x = fondària des del darrere; el front a la dreta) amb les prebroques de la guia més llarga que hi cap.
      const side = sample("side", "Lateral del moble", "side", 560, 200)
      const res = planKit(item, { LW: 564, depth: side.length - 10, G: 19, TB: 16 })
      if (!res.plan) throw new HardwareError(res.warnings[0] ?? `«${item.name}»: cap llargada hi cap`)
      const p = res.plan.pilot
      if (!p) return [side]
      const y0 = 40
      for (const h of res.plan.sidePilots) side.holes.push(hole(side.length - h.z, y0 + h.y, { ...p, tag: "kit-slide" }))
      side.label = `Lateral del moble (NL ${res.plan.nl})`
      return [side]
    }
  }
}

/**
 * Tros de la peça amb el detall dels forats (el primer i els que té a menys de 200 mm), amb el cantell si és a prop i la
 * proporció `aspect` (amplada / alçada): per a la miniatura i el «Detall» de l'editor.
 */
export function featureCrop(p: Panel, aspect = 1.5): { x: number; y: number; w: number; h: number } | undefined {
  const feats = [
    ...p.holes.map((h) => ({ x: h.x, y: h.y, r: h.diameter / 2 })),
    ...(p.cutouts ?? []).flatMap((c) => (c.kind === "circle" ? [{ x: c.x, y: c.y, r: c.diameter / 2 }] : [])),
  ]
  const f0 = feats[0]
  if (!f0) return undefined
  const near = feats.filter((f) => Math.hypot(f.x - f0.x, f.y - f0.y) <= 200)
  const maxR = Math.max(...near.map((f) => f.r))
  const pad = Math.max(25, 2 * maxR)
  let x0 = Math.min(...near.map((f) => f.x - f.r)) - pad
  let x1 = Math.max(...near.map((f) => f.x + f.r)) + pad
  let y0 = Math.min(...near.map((f) => f.y - f.r)) - pad
  let y1 = Math.max(...near.map((f) => f.y + f.r)) + pad
  // El cantell, si és a prop: es veu a quina distància hi és el forat.
  const edge = 80
  if (x0 < edge) x0 = -10
  if (y0 < edge) y0 = -10
  if (p.length - x1 < edge) x1 = p.length + 10
  if (p.width - y1 < edge) y1 = p.width + 10
  // Proporció fixa: s'eixampla el costat curt al voltant del centre.
  let w = x1 - x0
  let h = y1 - y0
  if (w / h < aspect) {
    const grow = h * aspect - w
    x0 -= grow / 2
    w = h * aspect
  } else {
    const grow = w / aspect - h
    y0 -= grow / 2
    h = w / aspect
  }
  // Com a mínim 160 mm d'ample: un forat de Ø5 tot sol no s'ha de veure com una paella.
  const minW = 160
  if (w < minW) {
    x0 -= (minW - w) / 2
    y0 -= (minW / aspect - h) / 2
    w = minW
    h = minW / aspect
  }
  return { x: r(x0), y: r(y0), w: r(w), h: r(h) }
}

/** Forats que fa a la peça d'exemple (per a la targeta). */
export function previewHoleCount(item: HardwareItem): number {
  return hardwarePreview(item).panels.reduce((n, p) => n + p.holes.length + (p.cutouts?.length ?? 0), 0)
}

