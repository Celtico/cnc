import type { Panel, Vec3 } from "../model"
import { normalizePanel } from "./buildCabinet"

/**
 * **Peces unides** (per decisió de l'usuari, 2026-10-21: «si coincideix un moble per l'altre costat, aquestes peces
 * tallades es podrien unir i al nesting que fossin una sola peça»): dos mòduls que es toquen sense cap lateral entre ells
 * (tots dos l'han tret) tenen la base, la tapa i els prestatges en línia, cap per cap. Es fan d'una sola peça: el mateix
 * pla, la mateixa fondària, gruix i material, i que la peça unida càpiga al tauler (`JOIN_MAX_LENGTH`).
 */
const JOINABLE = new Set<Panel["role"]>(["top", "bottom", "fixedShelf", "shelf"])
/** El llarg més gran d'una peça unida: el tauler de 2.800 menys els marges i el tall. */
export const JOIN_MAX_LENGTH = 2750
const E = 0.5

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const same = (a: Vec3, b: Vec3) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6

const plain = (p: Panel) => JOINABLE.has(p.role) && !p.outline && !p.mitres?.length && !p.solidCuts?.length && !p.assembly && p.module !== undefined

/** `b` continua `a` pel seu eix x (o y): l'eix i on comença, o res. */
function follows(a: Panel, b: Panel): "x" | "y" | undefined {
  if (a.module === b.module || a.role !== b.role || a.material !== b.material || Math.abs(a.thickness - b.thickness) > E || a.grain !== b.grain) return undefined
  const pa = a.placement, pb = b.placement
  if (!same(pa.xAxis, pb.xAxis) || !same(pa.yAxis, pb.yAxis) || !same(pa.zAxis, pb.zAxis)) return undefined
  const d: Vec3 = [pb.origin[0] - pa.origin[0], pb.origin[1] - pa.origin[1], pb.origin[2] - pa.origin[2]]
  const u = dot(d, pa.xAxis), v = dot(d, pa.yAxis), w = dot(d, pa.zAxis)
  if (Math.abs(w) > E) return undefined
  if (Math.abs(u - a.length) < E && Math.abs(v) < E && Math.abs(a.width - b.width) < E && a.length + b.length <= JOIN_MAX_LENGTH) return "x"
  if (Math.abs(v - a.width) < E && Math.abs(u) < E && Math.abs(a.length - b.length) < E && a.width + b.width <= JOIN_MAX_LENGTH) return "y"
  return undefined
}

/** `b` posada a continuació d'`a` (pel seu eix): una sola peça amb els forats, ranures i talls de totes dues. */
function join(a: Panel, b: Panel, axis: "x" | "y"): Panel {
  const ox = axis === "x" ? a.length : 0, oy = axis === "y" ? a.width : 0
  const at = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: o.x + ox, y: o.y + oy })
  const pt = <T extends number[]>(q: T): T => [q[0]! + ox, q[1]! + oy, ...q.slice(2)] as T
  // Els forats al cantell de la junta (cap per cap) ja no hi són.
  const [endA, endB] = axis === "x" ? (["right", "left"] as const) : (["top", "bottom"] as const)
  const keepA = a.holes.filter((h) => !(h.face === "edge" && h.edge === endA))
  const keepB = b.holes.filter((h) => !(h.face === "edge" && h.edge === endB)).map(at)
  const cutouts = [...(a.cutouts ?? []), ...(b.cutouts ?? []).map((c) => (c.kind === "polygon" ? { ...c, points: c.points.map(pt) } : at(c)))]
  const pockets = [...(a.pockets ?? []), ...(b.pockets ?? []).map((k) => ({ ...k, points: k.points.map(pt) }))]
  const fittings = [...(a.fittings ?? []), ...(b.fittings ?? []).map(at)]
  const rawSides = [...(a.rawSides ?? []), ...(b.rawSides ?? []).map(([x0, y0, x1, y1]) => [x0 + ox, y0 + oy, x1 + ox, y1 + oy] as [number, number, number, number])]
  const edges = axis === "x"
    ? { left: a.edges.left, right: b.edges.right, top: a.edges.top || b.edges.top, bottom: a.edges.bottom || b.edges.bottom }
    : { bottom: a.edges.bottom, top: b.edges.top, left: a.edges.left || b.edges.left, right: a.edges.right || b.edges.right }
  return {
    ...a,
    length: a.length + (axis === "x" ? b.length : 0),
    width: a.width + (axis === "y" ? b.width : 0),
    edges,
    holes: [...keepA, ...keepB],
    grooves: [...a.grooves, ...b.grooves.map(at)],
    ...(cutouts.length ? { cutouts } : {}),
    ...(pockets.length ? { pockets } : {}),
    ...(fittings.length ? { fittings } : {}),
    ...(rawSides.length ? { rawSides } : {}),
  }
}

/** Uneix les peces en línia de mòduls diferents (també en cadena, tres o més mòduls). Torna les peces i les unions fetes. */
export function joinInLinePanels(panels: Panel[]): { panels: Panel[]; joined: { id: string; modules: number[] }[] } {
  const out = [...panels]
  const modulesOf = new Map<string, number[]>()
  let merged = true
  while (merged) {
    merged = false
    for (let i = 0; i < out.length && !merged; i++) {
      const a = out[i]!
      if (!plain(a)) continue
      for (let j = 0; j < out.length; j++) {
        const b = out[j]!
        if (i === j || !plain(b)) continue
        const axis = follows(a, b)
        if (!axis) continue
        const mods = [...(modulesOf.get(a.id) ?? [a.module!]), ...(modulesOf.get(b.id) ?? [b.module!])]
        modulesOf.set(a.id, mods)
        modulesOf.delete(b.id)
        out[i] = join(a, b, axis)
        out.splice(j, 1)
        merged = true
        break
      }
    }
  }
  const joined = [...modulesOf].map(([id, modules]) => ({ id, modules }))
  const label = new Map(joined.map((j) => [j.id, ` (mòduls ${j.modules.join(" + ")})`]))
  return { panels: out.map((p) => (label.has(p.id) ? normalizePanel({ ...p, label: p.label + label.get(p.id)! }) : p)), joined }
}
