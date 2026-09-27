import {
  NO_EDGES,
  type CabinetParams,
  type EdgeBanding,
  type EdgeSide,
  type Groove,
  type Hole,
  type Panel,
  type Placement,
  type Vec3,
} from "../model"

/** Arrodoneix a la centèsima per evitar soroll de coma flotant. */
const r = (v: number): number => Math.round(v * 100) / 100

const X: Vec3 = [1, 0, 0]
const Y: Vec3 = [0, 1, 0]
const Z: Vec3 = [0, 0, 1]
const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]]

function placement(origin: Vec3, xAxis: Vec3, yAxis: Vec3, zAxis: Vec3, explodeDir: Vec3): Placement {
  return { origin: origin.map(r) as Vec3, xAxis, yAxis, zAxis, explodeDir }
}

function edges(...sides: EdgeSide[]): EdgeBanding {
  const e = { ...NO_EDGES }
  for (const s of sides) e[s] = true
  return e
}

/** Mides derivades del mòdul que fan servir totes les peces. */
interface Derived {
  t: number
  tb: number
  W: number
  H: number
  D: number
  innerW: number
  innerH: number
  /** Fondària dels laterals (i de base/sostre). */
  sideDepth: number
  /** Z del cantell posterior dels laterals. */
  sideZ0: number
  /** Z de la cara interior del fons. */
  backInnerZ: number
  /** Fondària útil interior, del front a la cara interior del fons. */
  availDepth: number
  /** Posicions X locals (alçada) de la filera System 32 als laterals. */
  s32Xs: number[]
}

function derive(p: CabinetParams): Derived {
  const t = p.panelThickness
  const tb = p.backThickness
  const { width: W, height: H, depth: D } = p
  const groove = p.backType === "groove"
  const sideDepth = groove ? D : D - tb
  const sideZ0 = D - sideDepth
  const backInnerZ = groove ? p.backSetback + tb : tb

  const s32Xs: number[] = []
  const first = t + p.system32.edgeOffset
  const last = H - t - p.system32.edgeOffset
  for (let x = first; x <= last + 1e-9; x += p.system32.pitch) s32Xs.push(r(x))

  return {
    t,
    tb,
    W,
    H,
    D,
    innerW: W - 2 * t,
    innerH: H - 2 * t,
    sideDepth,
    sideZ0,
    backInnerZ,
    availDepth: D - backInnerZ,
    s32Xs,
  }
}

/** Valor de `candidates` més proper a `target`. */
function snap(target: number, candidates: readonly number[]): number {
  let best = candidates[0] ?? target
  for (const c of candidates) if (Math.abs(c - target) < Math.abs(best - target)) best = c
  return best
}

/** Distàncies (des del front) de les espigues al llarg de la fondària. */
function dowelPositions(depth: number, endOffset: number): number[] {
  return [endOffset, depth / 2, depth - endOffset].map(r)
}

function buildSide(p: CabinetParams, d: Derived, isLeft: boolean): Panel {
  const { t, H, sideDepth } = d
  // Coordenades locals: x = alçada (0 a baix), y = fondària.
  // Lateral esquerre: y = 0 al darrere. Lateral dret (mirall): y = 0 al davant.
  const yFromFront = (dist: number): number => r(isLeft ? sideDepth - dist : dist)
  const frontEdge: EdgeSide = isLeft ? "top" : "bottom"

  const holes: Hole[] = []
  // System 32: dues fileres, a `edgeOffset` del cantell davanter i del posterior.
  for (const dist of [p.system32.edgeOffset, sideDepth - p.system32.edgeOffset]) {
    const y = yFromFront(dist)
    for (const x of d.s32Xs) {
      holes.push({
        x,
        y,
        diameter: p.system32.diameter,
        depth: p.system32.depth,
        face: "A",
        tag: "system32",
      })
    }
  }
  // Espigues cap a la base (x = t/2) i el sostre (x = H − t/2).
  for (const x of [t / 2, H - t / 2]) {
    for (const dist of dowelPositions(sideDepth, p.dowel.endOffset)) {
      holes.push({
        x: r(x),
        y: yFromFront(dist),
        diameter: p.dowel.diameter,
        depth: p.dowel.faceDepth,
        face: "A",
        tag: "dowel",
      })
    }
  }

  const grooves: Groove[] = []
  if (p.backType === "groove") {
    const zFrom = p.backSetback // Z de la ranura des del darrere
    grooves.push({
      x: r(t - p.grooveDepth),
      y: isLeft ? r(zFrom) : r(sideDepth - zFrom - d.tb),
      w: r(H - 2 * (t - p.grooveDepth)),
      h: d.tb,
      depth: p.grooveDepth,
      face: "A",
      tag: "back",
    })
  }

  const pl = isLeft
    ? placement([0, 0, d.sideZ0], Y, Z, X, neg(X))
    : placement([d.W, 0, d.D], Y, neg(Z), neg(X), X)

  return {
    id: isLeft ? "side-left" : "side-right",
    name: isLeft ? "lat e" : "lat d",
    label: isLeft ? "Lateral esquerre" : "Lateral dret",
    role: "side",
    length: H,
    width: sideDepth,
    thickness: t,
    material: p.material,
    grain: "x",
    edges: edges(frontEdge, "right"),
    holes,
    grooves,
    placement: pl,
  }
}

function buildBottomOrTop(p: CabinetParams, d: Derived, which: "bottom" | "top"): Panel {
  const { t, innerW, sideDepth } = d
  const isBottom = which === "bottom"
  // Base: cara A (interior) amunt, y = 0 al davant. Sostre: cara A avall, y = 0 al darrere.
  const yFromFront = (dist: number): number => r(isBottom ? dist : sideDepth - dist)

  const holes: Hole[] = []
  for (const edge of ["left", "right"] as const) {
    for (const dist of dowelPositions(sideDepth, p.dowel.endOffset)) {
      holes.push({
        x: edge === "left" ? 0 : innerW,
        y: yFromFront(dist),
        diameter: p.dowel.diameter,
        depth: p.dowel.edgeDepth,
        face: "edge",
        edge,
        tag: "dowel",
      })
    }
  }

  const grooves: Groove[] = []
  if (p.backType === "groove") {
    grooves.push({
      x: 0,
      y: isBottom ? r(sideDepth - p.backSetback - d.tb) : r(p.backSetback),
      w: innerW,
      h: d.tb,
      depth: p.grooveDepth,
      face: "A",
      tag: "back",
    })
  }

  const pl = isBottom
    ? placement([t, 0, d.D], X, neg(Z), Y, neg(Y))
    : placement([t, d.H, d.sideZ0], X, Z, neg(Y), Y)

  return {
    id: which,
    name: isBottom ? "baix" : "dalt",
    label: isBottom ? "Base" : "Sostre",
    role: which,
    length: innerW,
    width: sideDepth,
    thickness: t,
    material: p.material,
    grain: "x",
    edges: edges(isBottom ? "bottom" : "top"),
    holes,
    grooves,
    placement: pl,
  }
}

function buildBack(p: CabinetParams, d: Derived): Panel {
  const groove = p.backType === "groove"
  const g = p.grooveDepth
  const c = p.backClearance
  const length = groove ? r(d.innerW + 2 * g - c) : d.W
  const width = groove ? r(d.innerH + 2 * g - c) : d.H
  const origin: Vec3 = groove
    ? [d.t - g + c / 2, d.t - g + c / 2, p.backSetback]
    : [0, 0, 0]

  return {
    id: "back",
    name: "trassera",
    label: "Fons",
    role: "back",
    length,
    width,
    thickness: d.tb,
    material: p.backMaterial,
    grain: "none",
    edges: { ...NO_EDGES },
    holes: [],
    grooves: [],
    placement: placement(origin, X, Y, Z, neg(Z)),
  }
}

function buildShelves(p: CabinetParams, d: Derived): Panel[] {
  const n = p.shelves
  if (n === 0) return []
  const { t, innerW, innerH, availDepth } = d
  const length = r(innerW - p.shelfClearance)
  const width = r(availDepth - p.shelfSetback)
  const gap = (innerH - n * t) / (n + 1)

  const shelves: Panel[] = []
  for (let k = 1; k <= n; k++) {
    const targetY = t + k * gap + (k - 1) * t
    const y = snap(targetY, d.s32Xs)
    shelves.push({
      id: `shelf-${k}`,
      name: n === 1 ? "estanter" : `estanter ${k}`,
      label: n === 1 ? "Prestatge" : `Prestatge ${k}`,
      role: "shelf",
      length,
      width,
      thickness: t,
      material: p.material,
      grain: "x",
      edges: edges("bottom"),
      holes: [],
      grooves: [],
      placement: placement(
        [t + p.shelfClearance / 2, y, d.D - p.shelfSetback],
        X,
        neg(Z),
        Y,
        Z,
      ),
    })
  }
  return shelves
}

function hingeCount(height: number): number {
  if (height <= 900) return 2
  if (height <= 1600) return 3
  if (height <= 2100) return 4
  return 5
}

function buildDoors(p: CabinetParams, d: Derived): Panel[] {
  if (p.doors === 0) return []
  const { t, W, H, D } = d
  const g = p.doorGap
  const doorH = r(H - 2 * g)
  const doorW = p.doors === 1 ? r(W - 2 * g) : r((W - 2 * g - p.doorGapBetween) / 2)

  // Punts mitjos entre forats System 32: hi va l'eix de la frontissa perquè la
  // placa (forats a ±16 mm) caigui sobre la filera.
  const half = p.system32.pitch / 2
  const midpoints = d.s32Xs.slice(0, -1).map((x) => r(x + half))
  const count = hingeCount(doorH)
  const span = doorH - 200
  const targets = Array.from({ length: count }, (_, i) => 100 + (span * i) / (count - 1))

  const makeDoor = (
    id: string,
    name: string,
    label: string,
    x0: number,
    hingeSide: "left" | "right",
  ): Panel => {
    const holes: Hole[] = targets.map((target) => ({
      x: r(snap(target + g, midpoints) - g),
      y: hingeSide === "left" ? p.hinge.cupOffset : r(doorW - p.hinge.cupOffset),
      diameter: p.hinge.cupDiameter,
      depth: p.hinge.cupDepth,
      face: "A",
      tag: "hinge",
    }))
    return {
      id,
      name,
      label,
      role: "door",
      length: doorH,
      width: doorW,
      thickness: t,
      material: p.material,
      grain: "x",
      edges: edges("left", "right", "bottom", "top"),
      holes,
      grooves: [],
      // Cara A = cara interior (mira cap al darrere). x local = alçada, y local = +X.
      placement: placement([x0, g, D + t], Y, X, neg(Z), Z),
    }
  }

  if (p.doors === 1) return [makeDoor("door", "porta", "Porta", g, "left")]
  return [
    makeDoor("door-left", "porta e", "Porta esquerra", g, "left"),
    makeDoor("door-right", "porta d", "Porta dreta", g + doorW + p.doorGapBetween, "right"),
  ]
}

/**
 * Convenció u/v del taller: el costat llarg sempre a x. Si la peça s'ha construït
 * amb `width > length`, la gira 90° (rotació pròpia, la cara A continua amunt):
 *   x' = y,  y' = length − x.
 */
export function normalizePanel(p: Panel): Panel {
  if (p.length >= p.width) return p
  const L = p.length
  const rot = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: o.y, y: r(L - o.x) })
  const edgeMap: Record<EdgeSide, EdgeSide> = {
    bottom: "left",
    top: "right",
    left: "top",
    right: "bottom",
  }
  const { origin, xAxis, yAxis, zAxis, explodeDir } = p.placement
  return {
    ...p,
    length: p.width,
    width: L,
    grain: p.grain === "x" ? "y" : p.grain === "y" ? "x" : "none",
    edges: {
      left: p.edges.bottom,
      right: p.edges.top,
      top: p.edges.left,
      bottom: p.edges.right,
    },
    holes: p.holes.map((h) => {
      const m = rot(h)
      return h.edge ? { ...m, edge: edgeMap[h.edge] } : m
    }),
    grooves: p.grooves.map((g) => ({
      ...g,
      x: g.y,
      y: r(L - g.x - g.w),
      w: g.h,
      h: g.w,
    })),
    placement: {
      origin: [
        r(origin[0] + L * xAxis[0]),
        r(origin[1] + L * xAxis[1]),
        r(origin[2] + L * xAxis[2]),
      ],
      xAxis: yAxis,
      yAxis: neg(xAxis),
      zAxis,
      explodeDir,
    },
  }
}

/** Converteix els paràmetres del mòdul en la llista de peces amb mecanitzats i col·locació. */
export function buildCabinet(p: CabinetParams): Panel[] {
  const d = derive(p)
  return [
    buildSide(p, d, true),
    buildSide(p, d, false),
    buildBottomOrTop(p, d, "bottom"),
    buildBottomOrTop(p, d, "top"),
    buildBack(p, d),
    ...buildShelves(p, d),
    ...buildDoors(p, d),
  ].map(normalizePanel)
}
