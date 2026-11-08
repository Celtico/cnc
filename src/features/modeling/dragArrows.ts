import type { CompositionBuild } from "../../core/build/buildComposition"
import { dynBox, panelAabb, SIDE_NAMES, type Composition, type DynLimit, type FreePart, type Panel, type Vec3 } from "../../core/model"
import { MODULE_DIM, movePart, resizePartFace, type FaceToolId, type FaceToolOpts } from "./faceTools"

/**
 * Les fletxes d'arrossegar de Modelatge (com les del Taulell, cel 2026-11-08): al **Tauler dinàmic** n'hi ha una a cada
 * costat del tauler triat (vermella: el costat va a una altra cara o s'hi separa) i una al gruix (taronja: el desplaçament);
 * a la **Cara dinàmica**, una a cada cara de la peça triada (o a la cara clicada del moble), per estirar-la o desplaçar-la.
 * En arrossegar, la cara s'imanta a les cares de les altres peces.
 */
export interface DragArrow {
  id: string
  /** On és (mm, coordenades del moble): el mig de la cara. */
  at: Vec3
  /** Cap on apunta (cap a fora de la cara). */
  dir: Vec3
  color: string
}

type Box = { min: Vec3; max: Vec3 }
const r1 = (v: number) => Math.round(v * 10) / 10
const RED = "#d8302a"
const ORANGE = "#f0a030"

const center = (b: Box) => b.min.map((v, k) => (v + b.max[k]!) / 2) as Vec3
const faceAt = (b: Box, a: number, s: 0 | 1): Vec3 => {
  const c = center(b)
  c[a] = s ? b.max[a]! : b.min[a]!
  return c
}
const unit = (a: number, sign: number): Vec3 => [0, 1, 2].map((k) => (k === a ? sign : 0)) as Vec3

/** Les fletxes de l'eina activa: el tauler dinàmic triat, o la peça (o la cara del moble) de la Cara dinàmica. */
export function dragArrows(tool: FaceToolId | null, o: FaceToolOpts, comp: Composition, build: CompositionBuild | undefined, selectedPart: string | null): DragArrow[] {
  if (!build) return []
  const boxOf = (id: string) => {
    const p = build.panels.find((q) => q.id === id)
    return p ? panelAabb(p) : undefined
  }
  if (tool === "dynpanel" && selectedPart) {
    const p = comp.parts?.find((q) => q.id === selectedPart && q.dyn)
    const b = p && boxOf(`part:${p.id}`)
    if (!p?.dyn || !b) return []
    const t = p.dyn.t
    const out: DragArrow[] = []
    for (const a of [0, 1, 2]) {
      if (a === t) continue
      for (const s of [0, 1] as const) out.push({ id: `dyn:${p.id}:${a}:${s}`, at: faceAt(b, a, s), dir: unit(a, s ? 1 : -1), color: RED })
    }
    // El gruix: la fletxa a la cara que no toca la de recolzament (la que es mou si s'hi posa desplaçament).
    const s = p.dyn.limits.find((L) => L.a === t)?.s ?? 0
    out.push({ id: `dynT:${p.id}`, at: faceAt(b, t, s ? 0 : 1), dir: unit(t, s ? -1 : 1), color: ORANGE })
    return out
  }
  if (tool === "face" && o.faceMode !== "mate") {
    const f = o.facePick
    if (f?.module) {
      const idx = comp.modules.findIndex((m) => m.id === f.module) + 1
      const b = idx ? moduleBox(build.panels, idx) : undefined
      if (!b || (o.faceMode === "move" && f.a !== 0)) return []
      return [{ id: `face:m:${f.module}:${f.a}:${f.s}:${o.faceMode}`, at: faceAt(b, f.a, f.s), dir: unit(f.a, f.s ? 1 : -1), color: ORANGE }]
    }
    const id = f?.part ?? selectedPart
    const b = id && comp.parts?.some((q) => q.id === id) ? boxOf(`part:${id}`) : undefined
    if (!b) return []
    return [0, 1, 2].flatMap((a) => ([0, 1] as const).map((s) => ({ id: `face:p:${id}:${a}:${s}:${o.faceMode}`, at: faceAt(b, a, s), dir: unit(a, s ? 1 : -1), color: f && f.a === a && f.s === s ? ORANGE : RED })))
  }
  return []
}

function moduleBox(panels: Panel[], idx: number): Box | undefined {
  const own = panels.filter((x) => x.module === idx && !x.id.startsWith("part:") && x.role !== "hardware").map(panelAabb)
  if (!own.length) return undefined
  return { min: [0, 1, 2].map((a) => Math.min(...own.map((b) => b.min[a]!))) as Vec3, max: [0, 1, 2].map((a) => Math.max(...own.map((b) => b.max[a]!))) as Vec3 }
}

/** El moble estirat (`pull`) o desplaçat (`move`, només de costat) `d` mm cap a fora de la cara `s` de l'eix `a`. */
export function moduleFaceChange(comp: Composition, moduleId: string, a: number, s: 0 | 1, mode: "pull" | "move", d: number): Composition | null {
  const dim = MODULE_DIM[a]![0]
  if (mode === "move" && a !== 0) return null
  return {
    ...comp,
    modules: comp.modules.map((q) => {
      if (q.id !== moduleId) return q
      // Estirar la cara esquerra: el moble creix cap a l'esquerra (la dreta es queda on és, si hi ha espai al davant).
      if (mode === "pull") return { ...q, carcass: { ...q.carcass, [dim]: Math.max(100, q.carcass[dim] + d) }, ...(a === 0 && !s ? { gapBefore: Math.max(0, (q.gapBefore ?? 0) - d) } : {}) }
      return { ...q, gapBefore: Math.max(0, (q.gapBefore ?? 0) + (s ? d : -d)) }
    }),
  }
}

/** Una cara de les altres peces a prop del nivell `X` de l'eix `a` (l'imant). `want`: 0 la cara de dalt d'una peça, 1 la de baix. */
interface Snap {
  level: number
  panel: Panel
  /** La cara de la peça que hi toca: `max` (0) o `min` (1). */
  face: 0 | 1
}
function snapFace(panels: Panel[], skip: (p: Panel) => boolean, a: number, X: number, tol: number, want?: 0 | 1, over?: Box): Snap | null {
  let best: (Snap & { d: number; score: number }) | null = null
  for (const p of panels) {
    if (skip(p) || p.role === "hardware") continue
    const b = panelAabb(p)
    // Si se sap el tauler, una peça que el toca de costat val més que una de lluny.
    const touches = over ? [0, 1, 2].every((k) => k === a || (b.min[k]! < over.max[k]! - 0.5 && b.max[k]! > over.min[k]! + 0.5)) : true
    for (const face of [0, 1] as const) {
      if (want !== undefined && face !== want) continue
      const level = face ? b.min[a]! : b.max[a]!
      const d = Math.abs(level - X)
      if (d > tol) continue
      const score = d - (touches ? tol : 0)
      if (!best || score < best.score) best = { level, panel: p, face, d, score }
    }
  }
  return best && { level: best.level, panel: best.panel, face: best.face }
}

/** El que fa una fletxa arrossegada `d` mm (cap a on apunta): la composició nova i el que es diu al costat del ratolí. */
export interface ArrowResult {
  comp: Composition
  label: string
}

/**
 * Arrossegar la fletxa `id` `d` mm, des de la composició i la construcció d'abans de començar (no de les d'ara: si no, el
 * tauler s'imantaria a si mateix). `tol`: l'imant en mm (els píxels de la pantalla); Alt (`free`) no s'imanta.
 */
export function dragArrow(id: string, d: number, comp: Composition, build: CompositionBuild, tol: number, free = false): ArrowResult | null {
  const [kind, ...rest] = id.split(":")
  const panels = build.panels
  const boxOf = (pid: string) => {
    const p = panels.find((q) => q.id === pid)
    return p ? panelAabb(p) : undefined
  }
  const setPart = (next: FreePart) => ({ ...comp, parts: (comp.parts ?? []).map((q) => (q.id === next.id ? next : q)) })
  const fmt = (v: number) => `${r1(v)} mm`
  const T = free ? 0 : tol

  if (kind === "dyn" || kind === "dynT") {
    const p = comp.parts?.find((q) => q.id === rest[0])
    const b = p && boxOf(`part:${p.id}`)
    if (!p?.dyn || !b) return null
    const dyn = p.dyn
    // Les peces que no poden fer de límit: ella mateixa i les peces lliures de després (s'ajusten després d'aquesta).
    const after = new Set((comp.parts ?? []).slice((comp.parts ?? []).indexOf(p)).map((q) => `part:${q.id}`))
    const skip = (q: Panel) => after.has(q.id)
    const fitted = (limits: DynLimit[], mid = dyn.mid): FreePart => ({ ...p, dyn: { ...dyn, limits, ...(mid !== undefined ? { mid: r1(mid) } : {}) } })
    const sizeOf = (q: FreePart) => {
      const nb = dynBox(q.dyn!, boxOf, q.thickness)
      return nb ? SIDE_NAMES.map((_, k) => (k === dyn.t ? null : r1(nb.max[k]! - nb.min[k]!))).filter((v) => v !== null).join(" × ") : "—"
    }
    if (kind === "dyn") {
      const a = +rest[1]!
      const s = +rest[2]! as 0 | 1
      const opp = s ? b.min[a]! : b.max[a]!
      // El nou nivell del costat, que no passi de l'altre costat (com a mínim 5 mm).
      let X = (s ? b.max[a]! : b.min[a]!) + (s ? d : -d)
      X = s ? Math.max(opp + 5, X) : Math.min(opp - 5, X)
      const want: 0 | 1 = s ? 1 : 0
      const hit = snapFace(panels, skip, a, X, T, want, b)
      const others = dyn.limits.filter((L) => !(L.a === a && L.s === s))
      let L: DynLimit
      let how: string
      if (hit) {
        L = { panel: hit.panel.id, a, s, off: 0 }
        how = `imant: ${hit.panel.label}`
      } else {
        // Sense imant: el mateix límit (o la cara més propera d'aquell costat), amb el desplaçament fins al ratolí.
        const cur = dyn.limits.find((Q) => Q.a === a && Q.s === s)
        const ref = cur ? panels.find((q) => q.id === cur.panel) : snapFace(panels, skip, a, X, Infinity, want, b)?.panel
        if (!ref) return null
        const rb = panelAabb(ref)
        L = { panel: ref.id, a, s, off: r1(s ? rb.min[a]! - X : X - rb.max[a]!) }
        how = `${fmt(L.off)} de ${ref.label}`
      }
      // Al mateix lloc de la llista (la finestra de l'eina els mostra en ordre).
      const k = dyn.limits.findIndex((Q) => Q.a === a && Q.s === s)
      const next = fitted(k >= 0 ? dyn.limits.map((Q, i) => (i === k ? L : Q)) : [...others, L])
      return { comp: setPart(next), label: `${SIDE_NAMES[a]![s]} · ${how} · ${sizeOf(next)}` }
    }
    // El gruix: el desplaçament des de la cara de recolzament (o, sense, del mig).
    const t = dyn.t
    const L = dyn.limits.find((Q) => Q.a === t)
    const s = L?.s ?? 0
    const near = s ? b.max[t]! : b.min[t]!
    let shift = s ? -d : d
    // S'imanta la cara que es mou o la de recolzament.
    const far = (s ? b.min[t]! : b.max[t]!) + shift
    const h1 = snapFace(panels, skip, t, far, T)
    const h2 = snapFace(panels, skip, t, near + shift, T)
    if (h1 && (!h2 || Math.abs(h1.level - far) <= Math.abs(h2.level - near - shift))) shift = h1.level - (s ? b.min[t]! : b.max[t]!)
    else if (h2) shift = h2.level - near
    const next = L ? fitted(dyn.limits.map((Q) => (Q === L ? { ...Q, off: r1(Q.off + (s ? -shift : shift)) } : Q))) : fitted(dyn.limits, (dyn.mid ?? 0) + shift)
    const off = L ? next.dyn!.limits.find((Q) => Q.a === t)!.off : next.dyn!.mid ?? 0
    return { comp: setPart(next), label: `Desplaçament ${fmt(off)}${h1 || h2 ? " · imant" : ""}` }
  }

  if (kind === "face") {
    const [what, fid, as, ss, mode] = rest
    const a = +as!
    const s = +ss! as 0 | 1
    const pull = mode !== "move"
    if (what === "m") {
      const idx = comp.modules.findIndex((m) => m.id === fid) + 1
      const b = idx ? moduleBox(panels, idx) : undefined
      if (!b) return null
      const face0 = s ? b.max[a]! : b.min[a]!
      const X = face0 + (s ? d : -d)
      const hit = snapFace(panels, (q) => q.module === idx, a, X, T)
      const dd = r1(((hit ? hit.level : X) - face0) * (s ? 1 : -1))
      const next = moduleFaceChange(comp, fid!, a, s, pull ? "pull" : "move", dd)
      if (!next) return null
      const m = next.modules[idx - 1]!
      return { comp: next, label: pull ? `${MODULE_DIM[a]![1]} ${fmt(m.carcass[MODULE_DIM[a]![0]])}${hit ? ` · imant: ${hit.panel.label}` : ""}` : `${dd > 0 ? "+" : ""}${fmt(dd)}${hit ? ` · imant: ${hit.panel.label}` : ""}` }
    }
    const p = comp.parts?.find((q) => q.id === fid)
    const b = p && boxOf(`part:${p.id}`)
    if (!p || !b) return null
    const self = (q: Panel) => q.id === `part:${p.id}`
    const face0 = s ? b.max[a]! : b.min[a]!
    const X = face0 + (s ? d : -d)
    if (pull) {
      const hit = snapFace(panels, self, a, X, T)
      const lv = hit ? hit.level : X
      const size = Math.max(1, r1(s ? lv - b.min[a]! : b.max[a]! - lv))
      return { comp: setPart(resizePartFace(p, a, s, size)), label: `${["Llarg", "Alt", "Fons"][a]} ${fmt(size)}${hit ? ` · imant: ${hit.panel.label}` : ""}` }
    }
    // Desplaçar: s'imanta la cara que s'arrossega o l'altra.
    let shift = X - face0
    const oth = (s ? b.min[a]! : b.max[a]!) + shift
    const h1 = snapFace(panels, self, a, X, T)
    const h2 = snapFace(panels, self, a, oth, T)
    if (h1 && (!h2 || Math.abs(h1.level - X) <= Math.abs(h2.level - oth))) shift = h1.level - face0
    else if (h2) shift = h2.level - (s ? b.min[a]! : b.max[a]!)
    const hit = h1 ?? h2
    return { comp: setPart(movePart(p, a, r1(shift))), label: `${shift > 0 ? "+" : ""}${fmt(shift)}${hit ? ` · imant: ${hit.panel.label}` : ""}` }
  }
  return null
}
