import { CUTOUT_PRESETS, freeX, visibleModule, type Composition, type Module, type Panel, type PlinthRun, type WorktopRun } from "../model"
import type { ModulePlacement } from "../model/composition"
import type { LinearPiece } from "./linearOrders"
import { aluPlinth, woodPlinthPanels } from "./plinth"

export interface RunWarning {
  runId: string
  message: string
}

/**
 * Mòduls que cobreix una peça correguda: de `from` a `to` en l'ordre de la composició,
 * només els de la fila (no els apilats ni els penjats, ni les illes —«Al terra» amb X pròpia— si n'hi ha d'altres).
 * Null si algun dels dos no hi és.
 */
function runModules(comp: Composition, from: string, to: string): { modules: Module[]; indices: number[] } | null {
  let a = comp.modules.findIndex((m) => m.id === from)
  let b = comp.modules.findIndex((m) => m.id === to)
  if (a < 0 || b < 0) return null
  if (a > b) [a, b] = [b, a]
  const all: number[] = []
  for (let i = a; i <= b; i++) if (comp.modules[i]!.carcass.base.kind !== "wall") all.push(i)
  // Les illes en queden fora (si no, el taulell i el sòcol hi arribarien), llevat que la peça sigui només de l'illa.
  const row = all.filter((i) => !freeX(comp.modules[i]!))
  const indices = row.length ? row : all
  if (!indices.length) return null
  return { modules: indices.map((i) => comp.modules[i]!), indices }
}

const r1 = (v: number) => Math.round(v * 10) / 10

/**
 * Cara dels fronts d'un mòdul (des de la paret): recobrents, per davant de la caixa (gruix = el del cos);
 * encastats, a nivell amb el davant de la caixa.
 */
function frontFace(m: Composition["modules"][number]): number {
  // Res amagat compta: sense cap front, l'estil no surt ni compta (`visibleModule`).
  return m.carcass.depth + (visibleModule(m).fronts.style === "inset" ? 0 : m.carcass.thickness)
}

/**
 * Taulell: una peça de punta a punta sobre els baixos. Local: x al llarg, y del cantell de
 * davant cap a la paret, z (gruix) cap amunt. Els forats d'encastar són talls passants.
 */
export function buildWorktop(comp: Composition, run: WorktopRun, places: ModulePlacement[], moduleNumber: number, warnings: RunWarning[]): Panel | null {
  const r = runModules(comp, run.from, run.to)
  if (!r) return null
  const x0 = Math.min(...r.indices.map((i) => places[i]!.x)) - run.overhangLeft
  const x1 = Math.max(...r.indices.map((i) => places[i]!.x + comp.modules[i]!.carcass.width)) + run.overhangRight
  const top = Math.max(...r.indices.map((i) => places[i]!.y + comp.modules[i]!.carcass.height))
  // Fins a la cara dels fronts més el voladís.
  const front = Math.max(...r.modules.map(frontFace)) + run.overhangFront
  const L = r1(x1 - x0)
  const W = r1(front)
  const cutouts: NonNullable<Panel["cutouts"]> = []
  for (const c of run.cutouts) {
    const i = comp.modules.findIndex((m) => m.id === c.module)
    if (i < 0) continue
    const cx = places[i]!.x + comp.modules[i]!.carcass.width / 2 + c.dx - x0
    const y = c.front ?? (W - c.d) / 2
    const cut = { kind: "rect" as const, x: r1(cx - c.w / 2), y: r1(y), w: c.w, h: c.d, tag: c.kind }
    // Si travessa el contorn no és un forat sinó una osca: no es fa.
    if (cut.x < 0 || cut.x + cut.w > L || cut.y < 0 || cut.y + cut.h > W) {
      warnings.push({ runId: run.id, message: `El forat «${CUTOUT_PRESETS[c.kind].label}» surt del taulell (${c.w} × ${c.d} mm en un taulell de ${L} × ${W} mm): no s'ha fet. Mou-lo o fes-lo més petit.` })
      continue
    }
    if (cut.x < 30 || cut.x + cut.w > L - 30 || cut.y < 30 || cut.y + cut.h > W - 30)
      warnings.push({ runId: run.id, message: `El forat «${CUTOUT_PRESETS[c.kind].label}» queda massa a prop del cantell del taulell (mínim 30 mm).` })
    cutouts.push(cut)
  }
  return {
    id: `run:${run.id}`,
    name: "taulell",
    label: "Taulell",
    role: "worktop",
    length: L,
    width: W,
    thickness: run.thickness,
    material: run.material,
    grain: "x",
    edges: { bottom: true, top: false, left: run.overhangLeft > 0, right: run.overhangRight > 0 },
    holes: [],
    grooves: [],
    ...(cutouts.length ? { cutouts } : {}),
    module: moduleNumber,
    placement: { origin: [x0, top, front], xAxis: [1, 0, 0], yAxis: [0, 0, -1], zAxis: [0, 1, 0], explodeDir: [0, 1, 0] },
  }
}

/**
 * Sòcol corregut: una peça davant de les potes, de punta a punta, retranquejada respecte a la cara dels fronts. L'alçada
 * és la de les potes (l'espai entre el terra i els mòduls). Opcions (sense UI, com la resta de peces corregudes): els
 * **retorns** als extrems vistos (`left`, `right`: del davant fins a la paret, a `sideSetback` del lateral), les
 * cantonades (`corners`) i el sòcol d'alumini (`hardware`, ferratge per metres): `plinthPieces`, com el sòcol de la base
 * «Potes». Sense cap opció, la peça de sempre.
 */
export function buildPlinthRun(comp: Composition, run: PlinthRun, places: ModulePlacement[], moduleNumber: number, warnings: RunWarning[]): { panels: Panel[]; extras: Panel[]; linear: LinearPiece[] } {
  const none = { panels: [], extras: [], linear: [] }
  const r = runModules(comp, run.from, run.to)
  if (!r) return none
  const x0 = Math.min(...r.indices.map((i) => places[i]!.x))
  const x1 = Math.max(...r.indices.map((i) => places[i]!.x + comp.modules[i]!.carcass.width))
  const h = Math.min(...r.indices.map((i) => places[i]!.y))
  if (h <= 0) {
    warnings.push({ runId: run.id, message: "El sòcol corregut necessita mòduls amb potes (ara toquen a terra)." })
    return none
  }
  const face = Math.max(...r.modules.map(frontFace)) - run.setback
  const place = (p: Panel): Panel => ({ ...p, id: `run:${run.id}${p.id === "plinth" ? "" : `:${p.id}`}`, label: p.id === "plinth" ? "Sòcol corregut" : `${p.label} corregut`, module: moduleNumber })
  if (!run.left && !run.right && !run.hardware)
    return {
      panels: [
        {
          id: `run:${run.id}`,
          name: "socol",
          label: "Sòcol corregut",
          role: "plinth",
          length: r1(x1 - x0),
          width: r1(h),
          thickness: run.thickness,
          material: run.material,
          grain: "x",
          edges: { bottom: false, top: true, left: false, right: false },
          holes: [],
          grooves: [],
          module: moduleNumber,
          placement: { origin: [x0, 0, face - run.thickness], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1], explodeDir: [0, 0, 1] },
        },
      ],
      extras: [],
      linear: [],
    }
  const ss = run.sideSetback ?? run.setback
  const sides = { front: true, back: false, left: !!run.left, right: !!run.right }
  const frame = { x0: run.left ? x0 + ss : x0, x1: run.right ? x1 - ss : x1, zBack: 0, zFront: face, y0: 0, sides }
  if (run.hardware) {
    try {
      // Un clip a cada pota: les dues del davant de cada mòdul al tram de davant, dues a cada retorn.
      const alu = aluPlinth(frame, run.hardware, `run:${run.id}:`, 0, { front: 2 * r.modules.length })
      return { panels: [], extras: alu.extras.map((p) => ({ ...p, module: moduleNumber })), linear: alu.pieces }
    } catch (err) {
      warnings.push({ runId: run.id, message: `Sòcol corregut: ${err instanceof Error ? err.message : String(err)}. No es fa.` })
      return none
    }
  }
  return { panels: woodPlinthPanels({ ...frame, h: r1(h), t: run.thickness, corners: run.corners ?? "butt" }, run.material).map(place), extras: [], linear: [] }
}
