import { NO_EDGES, type HardwareItem, type Hole, type Panel, type PanelRole } from "../model"
import { r, system32Ys, threeAlong } from "./geometry"
import { applyHardware, cupSpec, dowelSpec, flapSpec, handleSpec, magnetSpec, slideSpec, system32Spec, HardwareError } from "./hardware"

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
      return [door]
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

