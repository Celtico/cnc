import { z } from "zod"
import { DEFAULT_JOINERY, type FreePart } from "./freePart"
import { defaultModule, newId, type Composition, type Module, type Zone } from "./composition"
import type { PNode } from "./polygon"
import type { Template } from "./templates"

/**
 * Ambients: el plànol d'una casa (parets dibuixades i, a sota, la imatge d'un plànol escalada)
 * amb mobles col·locats a dins. Els mobles són **els mateixos** de la llista (enllaç per id):
 * a l'ambient només se'n toquen les mides generals i la posició. També hi ha **blocs** (sofà,
 * llit, nevera…): formes senzilles amb material de simulació per veure si tot hi cap.
 *
 * Coordenades del plànol en mm: x cap a la dreta, y cap avall (a la pantalla). Al 3D, X = x,
 * Z = y i Y amunt. Els elements es col·loquen pel **centre** de la seva petjada i giren al
 * voltant del centre (graus, en sentit horari vist des de dalt). Sense girar, el darrere del
 * moble mira cap a y petites (amunt a la pantalla) i el davant cap a y grans.
 */

const mm = z.number().finite()
const Pt = z.tuple([mm, mm])
export type PlanPt = z.infer<typeof Pt>

export const WallSchema = z.object({
  id: z.string(),
  /** Eix de la paret (de a a b); el gruix es reparteix a banda i banda. */
  a: Pt,
  b: Pt,
  thickness: mm.positive(),
  height: mm.positive(),
})
export type Wall = z.infer<typeof WallSchema>

export const BlockShapeSchema = z.enum(["box", "sofa", "bed", "table"])
export type BlockShape = z.infer<typeof BlockShapeSchema>

const Placement = {
  x: mm,
  y: mm,
  rot: mm,
  elevation: mm.min(0).optional(),
  /** Grup (nom): els elements del mateix grup es mouen, giren, dupliquen i esborren junts. */
  group: z.string().optional(),
}

export const AmbientItemSchema = z.discriminatedUnion("kind", [
  /** Un moble de la llista (enllaç): es dibuixa amb les peces de debò. */
  z.object({ id: z.string(), kind: z.literal("moble"), projectId: z.number().int(), ...Placement }),
  /** Bloc senzill (no es fabrica): forma, mides i material de simulació. */
  z.object({
    id: z.string(),
    kind: z.literal("block"),
    name: z.string(),
    shape: BlockShapeSchema,
    w: mm.positive(),
    h: mm.positive(),
    d: mm.positive(),
    material: z.string(),
    /** Segon material (matalàs del llit, coixins del sofà). */
    material2: z.string().optional(),
    ...Placement,
  }),
])
export type AmbientItem = z.infer<typeof AmbientItemSchema>
export type BlockItem = Extract<AmbientItem, { kind: "block" }>
export type MobleItem = Extract<AmbientItem, { kind: "moble" }>

export const PlanImageSchema = z.object({
  src: z.string().startsWith("data:image/"),
  /** Píxels de la imatge (per escalar-la). */
  pxW: z.number().positive(),
  pxH: z.number().positive(),
  /** Escala (mm per píxel), de la calibració de dos punts. */
  mmPerPx: z.number().positive(),
  /** Cantonada de dalt a l'esquerra de la imatge al plànol (mm). */
  x: mm,
  y: mm,
  opacity: z.number().min(0).max(1),
  locked: z.boolean().optional(),
})
export type PlanImage = z.infer<typeof PlanImageSchema>

export const AmbientSchema = z.object({
  walls: z.array(WallSchema),
  items: z.array(AmbientItemSchema),
  plan: PlanImageSchema.optional(),
  /** Materials de simulació del terra i de les parets (nom de preferències). */
  floorMaterial: z.string().optional(),
  wallMaterial: z.string().optional(),
})
export type Ambient = z.infer<typeof AmbientSchema>

export const EMPTY_AMBIENT: Ambient = { walls: [], items: [], floorMaterial: "Parquet de roure", wallMaterial: "Pintura blanca" }

/** Llegeix un ambient desat: el que no sigui vàlid es descarta (mai llança). */
export function parseAmbient(raw: unknown): Ambient {
  const r = AmbientSchema.safeParse(raw)
  if (r.success) return r.data
  const o = (typeof raw === "object" && raw ? raw : {}) as Record<string, unknown>
  const list = <T>(v: unknown, s: z.ZodType<T>): T[] => (Array.isArray(v) ? v.flatMap((x) => { const p = s.safeParse(x); return p.success ? [p.data] : [] }) : [])
  const plan = PlanImageSchema.safeParse(o.plan)
  return {
    ...EMPTY_AMBIENT,
    walls: list(o.walls, WallSchema),
    items: list(o.items, AmbientItemSchema),
    ...(plan.success ? { plan: plan.data } : {}),
    ...(typeof o.floorMaterial === "string" ? { floorMaterial: o.floorMaterial } : {}),
    ...(typeof o.wallMaterial === "string" ? { wallMaterial: o.wallMaterial } : {}),
  }
}

// --- Blocs --------------------------------------------------------------------------------

export interface BlockPreset {
  id: string
  name: string
  shape: BlockShape
  w: number
  h: number
  d: number
  material: string
  material2?: string
}

/** Blocs habituals (mides de catàleg) per veure si hi cap tot. */
export const BLOCK_PRESETS: BlockPreset[] = [
  { id: "sofa-3", name: "Sofà de 3 places", shape: "sofa", w: 2100, h: 850, d: 950, material: "Teixit gris" },
  { id: "sofa-2", name: "Sofà de 2 places", shape: "sofa", w: 1600, h: 850, d: 900, material: "Teixit beix" },
  { id: "armchair", name: "Butaca", shape: "sofa", w: 850, h: 850, d: 850, material: "Vellut verd" },
  { id: "bed-150", name: "Llit de 150", shape: "bed", w: 1600, h: 1000, d: 2100, material: "Teixit gris", material2: "Lli blanc" },
  { id: "bed-90", name: "Llit de 90", shape: "bed", w: 1000, h: 900, d: 2050, material: "Teixit beix", material2: "Lli blanc" },
  { id: "dining", name: "Taula de menjador", shape: "table", w: 1800, h: 750, d: 900, material: "Roure massís / xapat" },
  { id: "desk", name: "Taula d'escriptori", shape: "table", w: 1400, h: 750, d: 700, material: "Melamina blanca" },
  { id: "fridge", name: "Nevera", shape: "box", w: 600, h: 1850, d: 650, material: "Electrodomèstic inox" },
  { id: "washer", name: "Rentadora", shape: "box", w: 600, h: 850, d: 600, material: "Electrodomèstic blanc" },
  { id: "rug", name: "Catifa", shape: "box", w: 2000, h: 10, d: 3000, material: "Catifa beix" },
  { id: "tv", name: "Televisió 55\"", shape: "box", w: 1230, h: 720, d: 60, material: "Ferro negre" },
  { id: "box", name: "Bloc", shape: "box", w: 600, h: 600, d: 600, material: "Microciment gris" },
]

/** Composició (peces lliures sense nesting) que dibuixa un bloc, a la seva petjada (0..w, 0..d). */
export function blockComposition(b: Pick<BlockItem, "shape" | "w" | "h" | "d" | "material" | "material2" | "name">): Composition {
  const p = (q: Omit<FreePart, "id" | "nest" | "joints">): FreePart => ({ id: newId("p"), nest: false, joints: false, ...q })
  const { w, h, d } = b
  const m = b.material
  const m2 = b.material2 ?? b.material
  let parts: FreePart[]
  if (b.shape === "sofa") {
    const arm = Math.min(180, w * 0.12)
    const back = Math.min(220, d * 0.25)
    const seat = Math.min(430, h * 0.5)
    parts = [
      p({ name: "Base", orient: "flat", material: m, w: w - 2 * arm, h: d - back, thickness: seat - 150, x: arm, y: 0, z: back }),
      p({ name: "Seient", orient: "flat", material: m2, w: w - 2 * arm, h: d - back - 20, thickness: 150, x: arm, y: seat - 150, z: back }),
      p({ name: "Respatller", orient: "front", material: m, w, h, thickness: back, x: 0, y: 0, z: 0 }),
      p({ name: "Braç", orient: "side", material: m, w: d - back, h: Math.min(h, seat + 200), thickness: arm, x: 0, y: 0, z: back }),
      p({ name: "Braç", orient: "side", material: m, w: d - back, h: Math.min(h, seat + 200), thickness: arm, x: w - arm, y: 0, z: back }),
    ]
  } else if (b.shape === "bed") {
    const head = 80
    const frame = Math.min(320, h * 0.35)
    parts = [
      p({ name: "Capçal", orient: "front", material: m, w, h, thickness: head, x: 0, y: 0, z: 0 }),
      p({ name: "Bastidor", orient: "flat", material: m, w, h: d - head, thickness: frame, x: 0, y: 0, z: head }),
      p({ name: "Matalàs", orient: "flat", material: m2, w: w - 40, h: d - head - 40, thickness: 220, x: 20, y: frame, z: head + 20 }),
    ]
  } else if (b.shape === "table") {
    const t = 30, leg = 60
    const legs = [
      [40, 40],
      [w - 40 - leg, 40],
      [40, d - 40 - leg],
      [w - 40 - leg, d - 40 - leg],
    ].map(([x, z]) => p({ name: "Pota", orient: "flat", material: m, w: leg, h: leg, thickness: h - t, x: x!, y: 0, z: z! }))
    parts = [p({ name: "Tauler", orient: "flat", material: m, w, h: d, thickness: t, x: 0, y: h - t, z: 0 }), ...legs]
  } else parts = [p({ name: b.name, orient: "flat", material: m, w, h: d, thickness: h, x: 0, y: 0, z: 0 })]
  return { kind: "objecte", modules: [defaultModule(newId("m"), "Mòdul 1")], references: [], parts, joinery: { ...DEFAULT_JOINERY } }
}

// --- Plantilles d'objectes ------------------------------------------------------------------

const obj = (parts: Omit<FreePart, "id" | "nest" | "joints">[]): Composition => ({
  kind: "objecte",
  modules: [defaultModule(newId("m"), "Mòdul 1")],
  references: [],
  parts: parts.map((q) => ({ id: newId("p"), nest: false, joints: false, ...q })),
})

/** El·lipse de w × h (peces rodones). */
function ellipse(w: number, h: number): PNode[] {
  const K = 0.5522847498
  const a = w / 2, b = h / 2
  return [
    { x: w, y: b, in: [0, -K * b], out: [0, K * b], t: "smooth" },
    { x: a, y: h, in: [K * a, 0], out: [-K * a, 0], t: "smooth" },
    { x: 0, y: b, in: [0, K * b], out: [0, -K * b], t: "smooth" },
    { x: a, y: 0, in: [-K * a, 0], out: [K * a, 0], t: "smooth" },
  ]
}

/**
 * Plantilles d'objectes per als ambients: els blocs habituals (sofà, llit, nevera…) i alguns
 * de peces amb forma (cadira, làmpada, planta, mirall, taula rodona). Es fan com els mobles
 * flat-pack (peces lliures, forma, booleanes) però amb materials de simulació i sense fabricar.
 */
export const OBJECT_TEMPLATES: Template[] = [
  ...BLOCK_PRESETS.map((b) => ({ id: `object-${b.id}`, kind: "objecte" as const, name: b.name, description: `${b.w} × ${b.h} × ${b.d} mm · ${b.material}${b.material2 ? ` i ${b.material2}` : ""}.`, make: () => blockComposition(b) })),
  {
    id: "object-chair",
    kind: "objecte",
    name: "Cadira",
    description: "450 × 850 × 500 mm · roure i seient de teixit.",
    make: () =>
      obj([
        ...[
          [20, 20],
          [395, 20],
          [20, 445],
          [395, 445],
        ].map(([x, z]) => ({ name: "Pota", orient: "flat" as const, material: "Roure massís / xapat", w: 35, h: 35, thickness: 430, x: x!, y: 0, z: z! })),
        { name: "Seient", orient: "flat", material: "Teixit beix", w: 450, h: 500, thickness: 40, x: 0, y: 430, z: 0 },
        { name: "Respatller", orient: "front", material: "Roure massís / xapat", w: 450, h: 380, thickness: 25, x: 0, y: 470, z: 0 },
      ]),
  },
  {
    id: "object-floor-lamp",
    kind: "objecte",
    name: "Làmpada de peu",
    description: "Ø 400 × 1750 mm · peu de ferro i pantalla de lli.",
    make: () =>
      obj([
        { name: "Base", orient: "flat", material: "Ferro negre", w: 300, h: 300, thickness: 20, x: 50, y: 0, z: 50, shape: ellipse(300, 300) },
        { name: "Pal", orient: "flat", material: "Ferro negre", w: 20, h: 20, thickness: 1450, x: 190, y: 20, z: 190, shape: ellipse(20, 20) },
        { name: "Pantalla", orient: "flat", material: "Lli blanc", w: 400, h: 400, thickness: 300, x: 0, y: 1450, z: 0, shape: ellipse(400, 400) },
      ]),
  },
  {
    id: "object-plant",
    kind: "objecte",
    name: "Planta en test",
    description: "Ø 600 × 1100 mm · test de terracota.",
    make: () =>
      obj([
        { name: "Test", orient: "flat", material: "Pintura terracota", w: 380, h: 380, thickness: 400, x: 110, y: 0, z: 110, shape: ellipse(380, 380) },
        { name: "Fulles", orient: "flat", material: "Vellut verd", w: 600, h: 600, thickness: 700, x: 0, y: 400, z: 0, shape: ellipse(600, 600) },
      ]),
  },
  {
    id: "object-mirror",
    kind: "objecte",
    name: "Mirall rodó",
    description: "Ø 800 mm · per penjar (posa'l a l'alçada amb «Del terra»).",
    make: () => obj([{ name: "Mirall", orient: "front", material: "Vidre", w: 800, h: 800, thickness: 20, x: 0, y: 0, z: 0, shape: ellipse(800, 800) }]),
  },
  {
    id: "object-round-table",
    kind: "objecte",
    name: "Taula rodona",
    description: "Ø 1100 × 750 mm · tauler de roure sobre peu central.",
    make: () =>
      obj([
        { name: "Tauler", orient: "flat", material: "Roure massís / xapat", w: 1100, h: 1100, thickness: 30, x: 0, y: 720, z: 0, shape: ellipse(1100, 1100) },
        { name: "Peu", orient: "flat", material: "Ferro negre", w: 120, h: 120, thickness: 700, x: 490, y: 20, z: 490, shape: ellipse(120, 120) },
        { name: "Base", orient: "flat", material: "Ferro negre", w: 550, h: 550, thickness: 20, x: 275, y: 0, z: 275, shape: ellipse(550, 550) },
      ]),
  },
]

// --- Geometria del plànol ---------------------------------------------------------------

export const rad = (deg: number) => (deg * Math.PI) / 180

/** Quatre cantonades (plànol) d'un element de petjada w × d centrat a (x, y) i girat `rot`. */
export function footprintCorners(x: number, y: number, w: number, d: number, rot: number): PlanPt[] {
  const c = Math.cos(rad(rot)), s = Math.sin(rad(rot))
  return (
    [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ] as PlanPt[]
  ).map(([u, v]) => [x + u * c - v * s, y + u * s + v * c])
}

/** Caixa alineada (plànol) d'un element girat. */
export function footprintBox(x: number, y: number, w: number, d: number, rot: number): { x0: number; y0: number; x1: number; y1: number } {
  const pts = footprintCorners(x, y, w, d, rot)
  return { x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) }
}

export const wallLength = (w: Wall) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1])

/** Quatre cantonades del rectangle d'una paret (per dibuixar-la i per l'imant). */
export function wallCorners(w: Wall): PlanPt[] {
  const L = wallLength(w) || 1
  const nx = (-(w.b[1] - w.a[1]) / L) * (w.thickness / 2)
  const ny = ((w.b[0] - w.a[0]) / L) * (w.thickness / 2)
  return [
    [w.a[0] + nx, w.a[1] + ny],
    [w.b[0] + nx, w.b[1] + ny],
    [w.b[0] - nx, w.b[1] - ny],
    [w.a[0] - nx, w.a[1] - ny],
  ]
}

/** Quatre parets d'una habitació rectangular (eixos pel mig de les parets). */
export function roomWalls(x0: number, y0: number, x1: number, y1: number, thickness = 100, height = 2600): Wall[] {
  const a: PlanPt[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
  return a.map((p, i) => ({ id: newId("w"), a: p, b: a[(i + 1) % 4]!, thickness, height }))
}

/**
 * Imant d'un element a les cares de les parets (només parets alineades amb els eixos): si una
 * vora de la seva caixa queda a menys de `tol` d'una cara, s'hi arramba. Retorna el centre nou.
 */
export function snapToWalls(x: number, y: number, w: number, d: number, rot: number, walls: Wall[], tol = 120): { x: number; y: number; snapped: boolean } {
  const b = footprintBox(x, y, w, d, rot)
  let dx = Infinity, dy = Infinity
  for (const wl of walls) {
    const horiz = Math.abs(wl.a[1] - wl.b[1]) < 1
    const vert = Math.abs(wl.a[0] - wl.b[0]) < 1
    const t = wl.thickness / 2
    if (horiz) {
      const lo = Math.min(wl.a[0], wl.b[0]) - t, hi = Math.max(wl.a[0], wl.b[0]) + t
      if (b.x1 < lo || b.x0 > hi) continue
      for (const face of [wl.a[1] - t, wl.a[1] + t])
        for (const edge of [b.y0, b.y1]) {
          const k = face - edge
          if (Math.abs(k) < tol && Math.abs(k) < Math.abs(dy)) dy = k
        }
    } else if (vert) {
      const lo = Math.min(wl.a[1], wl.b[1]) - t, hi = Math.max(wl.a[1], wl.b[1]) + t
      if (b.y1 < lo || b.y0 > hi) continue
      for (const face of [wl.a[0] - t, wl.a[0] + t])
        for (const edge of [b.x0, b.x1]) {
          const k = face - edge
          if (Math.abs(k) < tol && Math.abs(k) < Math.abs(dx)) dx = k
        }
    }
  }
  return { x: x + (Number.isFinite(dx) ? dx : 0), y: y + (Number.isFinite(dy) ? dy : 0), snapped: Number.isFinite(dx) || Number.isFinite(dy) }
}

// --- Mides generals d'un moble ------------------------------------------------------------

/**
 * Canvia les mides generals d'un moble (ample, alt, fons) escalant-ne la distribució: amplades
 * i separacions dels mòduls, alçades (també potes, sòcol i alçada dels penjats), fondàries, les
 * mides fixes dels compartiments i calaixos, les peces lliures i els objectes. Els gruixos dels
 * taulers no canvien. `cur` és la mida actual (la caixa de les peces).
 */
export function resizeComposition(comp: Composition, cur: { w: number; h: number; d: number }, next: { w: number; h: number; d: number }): Composition {
  const sx = next.w / cur.w, sy = next.h / cur.h, sz = next.d / cur.d
  const r = (v: number) => Math.round(v)
  const zone = (z: Zone): Zone => {
    const out: Zone = { ...z }
    if (z.split) out.split = { ...z.split, sizes: z.split.sizes.map((s) => (s === "auto" ? s : r(s * (z.split!.dir === "v" ? sx : sy)))), children: z.split.children.map(zone) }
    if (z.front?.kind === "drawers") out.front = { ...z.front, heights: z.front.heights.map((hh) => (hh === "auto" ? hh : r(hh * sy))) }
    return out
  }
  const base = (b: Module["carcass"]["base"]): Module["carcass"]["base"] =>
    b.kind === "legs" ? { ...b, height: r(b.height * sy) } : b.kind === "plinth" ? { ...b, height: r(b.height * sy) } : b.kind === "wall" ? { ...b, height: r(b.height * sy) } : b
  const modules = comp.modules.map((m) => ({
    ...m,
    carcass: { ...m.carcass, width: r(m.carcass.width * sx), height: r(m.carcass.height * sy), depth: r(m.carcass.depth * sz), base: base(m.carcass.base) },
    root: zone(m.root),
    ...(m.gapBefore ? { gapBefore: r(m.gapBefore * sx) } : {}),
    ...(m.x !== undefined ? { x: r(m.x * sx) } : {}),
    ...(m.wallGap !== undefined ? { wallGap: r(m.wallGap * sz) } : {}),
  }))
  const parts = comp.parts?.map((p) => {
    // Mides al seu pla: front x·y, side z·y, flat x·z; el gruix només si és una mida (potes).
    const [su, sv, st] = p.orient === "front" ? [sx, sy, sz] : p.orient === "side" ? [sz, sy, sx] : [sx, sz, sy]
    return { ...p, x: r(p.x * sx), y: r(p.y * sy), z: r(p.z * sz), w: r(p.w * su), h: r(p.h * sv), ...(p.thickness > 60 ? { thickness: r(p.thickness * st) } : {}) }
  })
  const references = comp.references.map((o) => ({ ...o, x: r(o.x * sx), y: r(o.y * sy), z: r(o.z * sz), w: r(o.w * sx), h: r(o.h * sy), d: r(o.d * sz) }))
  const runs = comp.runs?.map((run) => (run.kind === "worktop" ? { ...run, cutouts: run.cutouts.map((c) => ({ ...c, dx: r(c.dx * sx) })) } : run))
  return { ...comp, modules, references, ...(parts ? { parts } : {}), ...(runs ? { runs } : {}) }
}

// --- Grups d'elements (com les peces lliures de l'editor) -----------------------------------

/** Ids dels elements d'un grup. */
export const groupIds = (a: Ambient, group: string) => a.items.filter((i) => i.group === group).map((i) => i.id)

/** Nom de grup nou que no existeixi («Grup 1», «Grup 2»…). */
export function newItemGroupName(a: Ambient): string {
  const used = new Set(a.items.map((i) => i.group).filter(Boolean))
  let n = 1
  while (used.has(`Grup ${n}`)) n++
  return `Grup ${n}`
}

export function setItemGroup(a: Ambient, ids: string[], group: string | undefined): Ambient {
  return { ...a, items: a.items.map((i) => (ids.includes(i.id) ? { ...i, group } : i)) }
}

export function moveItems(a: Ambient, ids: string[], dx: number, dy: number): Ambient {
  return { ...a, items: a.items.map((i) => (ids.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i)) }
}

/** Gira els elements `deg` graus al voltant del centre dels seus centres (el grup gira sencer). */
export function rotateItems(a: Ambient, ids: string[], deg: number): Ambient {
  const sel = a.items.filter((i) => ids.includes(i.id))
  if (!sel.length) return a
  const cx = (Math.min(...sel.map((i) => i.x)) + Math.max(...sel.map((i) => i.x))) / 2
  const cy = (Math.min(...sel.map((i) => i.y)) + Math.max(...sel.map((i) => i.y))) / 2
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg))
  return {
    ...a,
    items: a.items.map((i) => {
      if (!ids.includes(i.id)) return i
      const u = i.x - cx, v = i.y - cy
      return { ...i, x: Math.round(cx + u * c - v * s), y: Math.round(cy + u * s + v * c), rot: (((i.rot + deg) % 360) + 360) % 360 }
    }),
  }
}

/** Duplica els elements (desplaçats); si eren un grup, la còpia és un grup nou. Retorna els ids nous. */
export function duplicateItems(a: Ambient, ids: string[], offset = 300): { ambient: Ambient; ids: string[]; group?: string } {
  const src = a.items.filter((i) => ids.includes(i.id))
  const groups = new Set(src.map((i) => i.group))
  const group = groups.size === 1 && src[0]?.group ? newItemGroupName(a) : undefined
  const copies = src.map((i) => ({ ...i, id: newId("i"), x: i.x + offset, y: i.y + offset, ...(group ? { group } : {}) }))
  return { ambient: { ...a, items: [...a.items, ...copies] }, ids: copies.map((c) => c.id), group }
}

export function removeItems(a: Ambient, ids: string[]): Ambient {
  return { ...a, items: a.items.filter((i) => !ids.includes(i.id)) }
}
