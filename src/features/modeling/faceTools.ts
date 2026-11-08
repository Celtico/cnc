import type { FaceHit } from "../../components/viewer/facePick"
import type { CompositionBuild } from "../../core/build/buildComposition"
import { autoLimits, dynBox, SIDE_NAMES, type DynLimit, FIT_NOUN, fitWalls, ORIENT_OF_AXIS, partWithBox, wallBoxes, moduleOrigins3, newId, panelAabb, refitParts, type Composition, type FreePart, type Hole, type Module, type Panel, type Vec3, PART_AXES, partSize, circlePts, fromPlane, partBox, rectPts, toPlane, type Sketch, extrudeSketch } from "../../core/model"
import { pieceLocalId } from "./modelingPieces"
import { cabineoTool, jointTool } from "./faceJoints"
import { measureTool } from "./faceMeasure"
import type { FaceToolId, FaceToolOpts, FaceToolResult } from "./faceToolOptions"
import { addHoles, cutBox, fmtMm, local, moduleOf, r1, uniqueName } from "./pieceSpace"

/** Fa l'eina `tool` amb el clic `hit`. */
export function runFaceTool(tool: FaceToolId, o: FaceToolOpts, comp: Composition, build: CompositionBuild | undefined, hit: FaceHit): FaceToolResult {
  const { panel: p, point: pt, normal: n } = hit
  const panels = build?.panels ?? []
  const host = moduleOf(comp, p)

  if (tool === "cut") {
    if (!o.cutTarget) return { opts: { ...o, cutTarget: p.id }, message: `Peça a retallar: ${p.label}. Ara clica la peça solta que la retalla.` }
    if (!p.id.startsWith("part:")) return { message: "La peça que retalla ha de ser una peça solta (no una d'un moble).", error: true }
    if (p.id === o.cutTarget) return { message: "Clica una altra peça: la que fa el retall.", error: true }
    const id = p.id.slice(5)
    const q = comp.parts?.find((x) => x.id === id)
    if (!q) return { message: "No trobo la peça.", error: true }
    const target = panels.find((x) => x.id === o.cutTarget)
    const only = [...new Set([...(q.effect === "cut" ? (q.cutOnly ?? []) : []), o.cutTarget])]
    return { comp: { ...comp, parts: (comp.parts ?? []).map((x) => (x.id === id ? { ...x, effect: "cut" as const, cutOnly: only } : x)) }, opts: { ...o, cutTarget: undefined }, select: { kind: "part", id }, message: `${q.name} retalla ${target?.label ?? "la peça"}` }
  }
  if (tool === "groove" || tool === "rebate") {
    const l = local(p, pt, n)
    if (l.face === "edge") return { message: "Tria una cara principal, no un cantell.", error: true }
    const m = moduleOf(comp, p)
    if (!m) return { message: "De moment, els mecanitzats a mà van a les peces dels mobles.", error: true }
    let g: { x: number; y: number; w: number; h: number }
    if (tool === "groove") {
      const alongU = (o.grDir === "L") === p.length >= p.width
      const w = o.grW
      const c0 = alongU ? l.v : l.u
      const hi = alongU ? p.width : p.length
      const c = o.grOff > 0 ? (c0 <= hi - c0 ? o.grOff + w / 2 : hi - o.grOff - w / 2) : c0
      g = alongU ? { x: 0, y: r1(c - w / 2), w: p.length, h: w } : { x: r1(c - w / 2), y: 0, w, h: p.width }
    } else {
      const ds = [l.u, p.length - l.u, l.v, p.width - l.v]
      const i = ds.indexOf(Math.min(...ds))
      const w = o.rbW
      g = [
        { x: 0, y: 0, w, h: p.width },
        { x: p.length - w, y: 0, w, h: p.width },
        { x: 0, y: 0, w: p.length, h: w },
        { x: 0, y: p.width - w, w: p.length, h: w },
      ][i]!
    }
    const depth = Math.min(tool === "groove" ? o.grD : o.rbD, p.thickness - 1)
    const ghost = [cutBox(p, l.face, g.x, g.y, g.x + g.w, g.y + g.h, depth)]
    const id = pieceLocalId(m.id, p.id)
    const cur = m.pieceEdits?.[id] ?? {}
    const next = { ...comp, modules: comp.modules.map((x) => (x.id !== m.id ? x : { ...x, pieceEdits: { ...x.pieceEdits, [id]: { ...cur, grooves: [...(cur.grooves ?? []), { ...g, depth, face: l.face as "A" | "B" }] } } })) }
    // A quants mm del cantell més a prop (com l'etiqueta del Taulell abans de clicar).
    const along = g.w >= p.length - 0.01
    const dist = r1(along ? Math.min(g.y, p.width - g.y - g.h) : Math.min(g.x, p.length - g.x - g.w))
    return { comp: next, ghost, message: `${p.label} · cara ${l.face} · ${tool === "groove" ? `ranura ${o.grW}×${depth} a ${fmtMm(dist)} mm del cantell` : `galze ${o.rbW}×${depth}`}` }
  }
  if (tool === "measure" || tool === "laser") return measureTool(tool, o, panels, hit)
  if (tool === "dowel" || tool === "screw") return jointTool(tool, o, comp, panels, hit)
  if (tool === "cabineo") return cabineoTool(o, comp, panels, hit)

  if (tool === "rect" || tool === "poly" || tool === "circle" || tool === "board") {
    const a = [0, 1, 2].reduce((x, k) => (Math.abs(n[k]!) > Math.abs(n[x]!) ? k : x), 0)
    const d = o.draft
    const q = toPlane(d?.a ?? a, pt)
    if (!d) {
      const draft = { a, level: r1(pt[a]!), dir: (n[a]! > 0 ? 1 : -1) as 1 | -1, pts: [q] }
      return { opts: { ...o, draft }, message: "" }
    }
    if (tool === "rect") return finishSketch(comp, o, rectPts(d.pts[0]!, q), true)
    if (tool === "board") return finishBoard(comp, o, rectPts(d.pts[0]!, q))
    if (tool === "circle") return finishSketch(comp, o, circlePts(d.pts[0]!, 2 * Math.hypot(q[0] - d.pts[0]![0], q[1] - d.pts[0]![1])), false)
    const first = d.pts[0]!
    if (d.pts.length >= 3 && Math.hypot(q[0] - first[0], q[1] - first[1]) < 15) return finishSketch(comp, o, d.pts, false)
    return { opts: { ...o, draft: { ...d, pts: [...d.pts, q] } }, message: "" }
  }

  if (tool === "face") {
    const a = [0, 1, 2].reduce((x, k) => (Math.abs(n[k]!) > Math.abs(n[x]!) ? k : x), 0)
    const side: 0 | 1 = n[a]! > 0 ? 1 : 0
    if (Math.abs(n[a]!) < 0.99) return { message: "Clica una cara d'escaire (no una de biaixada).", error: true }
    if (o.faceMode === "mate") {
      const f = o.mateFrom
      if (!f) {
        if (!p.id.startsWith("part:")) return { message: "Clica la cara d'una peça solta (la que es mou).", error: true }
        const id = p.id.slice(5)
        return { opts: { ...o, mateFrom: { part: id, a, s: side } }, select: { kind: "part", id }, message: `${p.label}: ara clica la cara on s'ha d'enganxar.` }
      }
      const q = comp.parts?.find((x) => x.id === f.part)
      if (!q) return { opts: { ...o, mateFrom: undefined }, message: "No trobo la peça.", error: true }
      if (p.id === `part:${q.id}`) return { message: "Clica una cara d'una altra peça.", error: true }
      if (a !== f.a) return { message: "Les dues cares han de ser paral·leles (gira la peça abans amb Girar).", error: true }
      const contact = o.mateMode === "contact"
      if (contact ? f.s === side : f.s !== side) return { message: contact ? "Per tocar-se, les cares s'han de mirar (gira la peça abans)." : "Per alinear-les, les cares han de mirar cap al mateix costat.", error: true }
      const off: Vec3 = (q.module && moduleOrigins3(comp).get(q.module)) || [0, 0, 0]
      const b = partBox(q)
      const own = (f.s ? b.max[a]! : b.min[a]!) + off[a]!
      const tb = panelAabb(p)
      const level = (side ? tb.max[a]! : tb.min[a]!) + (side ? 1 : -1) * o.faceGap
      const moved = movePart(q, a, level - own)
      return { comp: { ...comp, parts: (comp.parts ?? []).map((x) => (x.id === q.id ? moved : x)) }, opts: { ...o, mateFrom: undefined }, select: { kind: "part", id: q.id }, message: `${q.name} enganxada a ${p.label}` }
    }
    if (p.id.startsWith("part:")) {
      const id = p.id.slice(5)
      return { opts: { ...o, facePick: { part: id, a, s: side } }, select: { kind: "part", id }, message: "" }
    }
    // Una cara d'un moble: si és de fora, en canvia la mida (estirar) o el mou (desplaçar), com al Taulell.
    if (!host) return { message: "Clica una cara d'una peça.", error: true }
    const idx = comp.modules.indexOf(host) + 1
    const own = panels.filter((x) => x.module === idx && !x.id.startsWith("part:") && x.role !== "hardware").map(panelAabb)
    // Una cara de dins (l'interior d'un lateral, la base per dalt…) estira la cara de fora del mateix costat del moble.
    const [lo, hi] = [Math.min(...own.map((b) => b.min[a]!)), Math.max(...own.map((b) => b.max[a]!))]
    const s: 0 | 1 = Math.abs(hi - pt[a]!) < Math.abs(pt[a]! - lo) ? 1 : 0
    return { opts: { ...o, facePick: { module: host.id, a, s } }, select: { kind: "module", id: host.id }, message: "" }
  }

  if (tool === "dynpanel" && o.dynMode === "ref") {
    // Cares de referència: cada clic afegeix (o treu, si ja hi és) la cara clicada com a límit del tauler.
    const a = [0, 1, 2].reduce((x, k) => (Math.abs(n[k]!) > Math.abs(n[x]!) ? k : x), 0)
    const L: DynLimit = { panel: p.id, a, s: n[a]! > 0 ? 0 : 1, off: 0 }
    const cur = o.refLimits ?? []
    const had = cur.some((x) => x.panel === L.panel && x.a === L.a && x.s === L.s)
    const refLimits = had ? cur.filter((x) => !(x.panel === L.panel && x.a === L.a && x.s === L.s)) : [...cur.filter((x) => !(x.a === L.a && x.s === L.s)), L]
    return { opts: { ...o, refLimits, refSeed: o.refSeed ?? (pt.map((v, i) => v + n[i]! * 2) as Vec3) }, message: had ? `Cara treta (${refLimits.length}).` : `${SIDE_NAMES[a]![L.s]}: ${p.label} (${refLimits.length} cares).` }
  }
  if (tool === "dynpanel") {
    const fa = [0, 1, 2].reduce((x, k) => (Math.abs(n[k]!) > Math.abs(n[x]!) ? k : x), 0)
    const t = o.dynOrient === "auto" ? fa : o.dynOrient
    const seed = pt.map((v, i) => v + n[i]! * (2 + o.dynOff)) as Vec3
    const limits = autoLimits(wallBoxes(panels), seed, t, (id) => id === p.id)
    if (t === fa) limits.push({ panel: p.id, a: t, s: n[t]! > 0 ? 0 : 1, off: o.dynOff })
    else {
      // De costat o de cara sobre una cara d'un altre eix: la cara clicada és un límit més i el tauler passa pel punt clicat.
      const rest = limits.filter((L) => L.a !== fa)
      limits.length = 0
      limits.push(...rest, { panel: p.id, a: fa, s: n[fa]! > 0 ? 0 : 1, off: o.dynOff })
    }
    const T = o.ownT ? o.T : (host?.carcass.thickness ?? o.T)
    const boxes = new Map(panels.map((q) => [q.id, panelAabb(q)] as const))
    const dyn = t === fa ? { t, limits } : withMid({ t, limits }, (id) => boxes.get(id), T, pt[t]!)
    const b = dynBox(dyn, (id) => boxes.get(id), T)
    if (!b) return { message: "El tauler queda sense mida: clica una cara que tingui peces al costat.", error: true }
    const off: Vec3 = (host && moduleOrigins3(comp).get(host.id)) || [0, 0, 0]
    const base = uniqueName(comp, "Tauler dinàmic")
    const part = partWithBox({ id: newId("p"), name: base, orient: ORIENT_OF_AXIS[t]!, w: 0, h: 0, thickness: T, material: o.mat || (host?.carcass.material ?? p.material), x: 0, y: 0, z: 0, ...(host ? { module: host.id } : {}), dyn }, b, off)
    return { comp: { ...comp, parts: [...(comp.parts ?? []), part] }, select: { kind: "part", id: part.id }, message: `${base}: ${r1(part.w)} × ${r1(part.h)} mm, lligat a ${limits.length} cares` }
  }

  if (tool === "fitblock") {
    const ax = { flat: 1, side: 0, front: 2 }[o.fitOrient]
    const seed = pt.map((v, i) => v + n[i]! * 2) as Vec3
    if (Math.abs(n[ax]!) > 0.5) seed[ax] = pt[ax]! + Math.sign(n[ax]!) * (o.T / 2 + 0.5)
    const off: Vec3 = (host && moduleOrigins3(comp).get(host.id)) || [0, 0, 0]
    const name = uniqueName(comp, FIT_NOUN[o.fitOrient])
    const part: FreePart = {
      id: newId("p"),
      name,
      orient: o.fitOrient,
      w: 10,
      h: 10,
      thickness: o.T,
      material: o.mat || (host?.carcass.material ?? p.material),
      x: seed[0] - 5 - off[0],
      y: seed[1] - 5 - off[1],
      z: seed[2] - 5 - off[2],
      ...(host ? { module: host.id } : {}),
      fit: { gap: o.fitGap },
    }
    const next = { ...comp, parts: [...(comp.parts ?? []), part] }
    const fitted = refitParts(next, panels).find((q) => q.id === part.id)!
    if (fitted.w === 10 && fitted.h === 10) return { message: "Aquí no hi ha cap buit tancat. Clica una cara de dins del buit (un lateral, la base, el fons…).", error: true }
    return { comp: { ...next, parts: next.parts.map((q) => (q.id === part.id ? fitted : q)) }, select: { kind: "part", id: part.id }, message: `${name}: ${r1(fitted.w)} × ${r1(fitted.h)} mm, ajustat al buit` }
  }

  if (tool === "shelf") {
    if (Math.abs(n[1]) > 0.3) return { message: "Clica una cara vertical (la cara interior d'un lateral).", error: true }
    const a = Math.abs(n[0]) >= Math.abs(n[2]) ? 0 : 2
    const b = a === 0 ? 2 : 0
    const s = Math.sign(n[a]!)
    const from = pt[a]! + s * 0.5
    let dist = Infinity
    for (const w of fitWalls(panels.filter((q) => q.id !== p.id && !q.id.startsWith("part:")))) {
      const others = [1, b].every((k) => w.min[k]! < pt[k]! && w.max[k]! > pt[k]!)
      if (!others) continue
      const d = s > 0 ? w.min[a]! - from : from - w.max[a]!
      if (d >= 0 && d < dist) dist = d
    }
    if (!isFinite(dist) || dist > 3000) return { message: "No hi ha cap tauler davant per recolzar el prestatge.", error: true }
    const own = panelAabb(p)
    const z0 = own.min[b]!
    const z1 = own.max[b]! - (b === 2 ? o.setback : 0)
    if (z1 - z0 < 20) return { message: "Fondària insuficient.", error: true }
    const len = dist + 0.5
    const x0 = s > 0 ? pt[a]! : pt[a]! - len
    const y = Math.round(pt[1]!)
    const off: Vec3 = (host && moduleOrigins3(comp).get(host.id)) || [0, 0, 0]
    const min: Vec3 = [0, 0, 0]
    min[a] = x0
    min[b] = z0
    min[1] = y
    const name = uniqueName(comp, "Prestatge")
    const part: FreePart = {
      id: newId("p"),
      name,
      orient: "flat",
      w: r1(a === 0 ? len : z1 - z0),
      h: r1(a === 0 ? z1 - z0 : len),
      thickness: o.T,
      material: o.mat || (host?.carcass.material ?? p.material),
      x: r1(min[0] - off[0]),
      y: r1(min[1] - off[1]),
      z: r1(min[2] - off[2]),
      ...(host ? { module: host.id } : {}),
    }
    return { comp: { ...comp, parts: [...(comp.parts ?? []), part] }, select: { kind: "part", id: part.id }, message: `${name}: ${r1(part.w)} × ${r1(part.h)} mm` }
  }

  const l = local(p, pt, n)
  if (tool === "band") {
    const ds: [keyof Panel["edges"], number][] = [
      ["left", Math.abs(l.u)],
      ["right", Math.abs(p.length - l.u)],
      ["bottom", Math.abs(l.v)],
      ["top", Math.abs(p.width - l.v)],
    ]
    const [edge] = ds.reduce((x, y) => (y[1] < x[1] ? y : x))
    const on = !p.edges[edge]
    const message = `${p.label}: cantell ${on ? "posat" : "tret"}`
    // Una peça solta (tauler, bloc, prestatge afegits): el cantell va a la mateixa peça.
    if (p.id.startsWith("part:")) {
      const pid = p.id.slice(5)
      return { comp: { ...comp, parts: (comp.parts ?? []).map((x) => (x.id !== pid ? x : { ...x, edges: { ...x.edges, [edge]: on } })) }, message }
    }
    if (!host) return { message: "Aquesta peça no admet cantell.", error: true }
    const id = pieceLocalId(host.id, p.id)
    const cur = host.pieceEdits?.[id] ?? {}
    return {
      comp: { ...comp, modules: comp.modules.map((x) => (x.id !== host.id ? x : { ...x, pieceEdits: { ...x.pieceEdits, [id]: { ...cur, edges: { ...cur.edges, [edge]: on } } } })) },
      message,
    }
  }

  if (l.face === "edge") return { message: "Clica la cara de la peça, no el cantell.", error: true }
  const face = l.face
  const holes: Hole[] =
    tool === "hole"
      ? [{ x: r1(l.u), y: r1(l.v), diameter: o.d, depth: Math.min(o.depth, p.thickness - 1), face }]
      : tool === "cup"
        ? [{ x: r1(l.u), y: r1(l.v), diameter: o.cd, depth: Math.min(o.cdepth, p.thickness - 1), face }]
        : Array.from({ length: Math.max(0, Math.floor((p.length - 2 * o.margin) / o.pitch) + 1) }, (_, k) => ({ x: r1(o.margin + k * o.pitch), y: r1(l.v), diameter: o.ld, depth: Math.min(o.ldepth, p.thickness - 1), face }))
  if (!holes.length) return { message: "La peça és massa curta per a la filera.", error: true }
  const next = addHoles(comp, p, holes)
  const ghost = holes.map((h) => cutBox(p, face, h.x - h.diameter / 2, h.y - h.diameter / 2, h.x + h.diameter / 2, h.y + h.diameter / 2, h.depth))
  if (!next) return { message: "De moment, els mecanitzats a mà van a les peces dels mobles.", error: true, ghost }
  const what = tool === "hole" ? `Perforació Ø${o.d}×${o.depth}` : tool === "cup" ? `Cassoleta Ø${o.cd}×${o.cdepth}` : `Línia de ${holes.length} forats Ø${o.ld}`
  return { comp: next, ghost, message: `${p.label} · cara ${face} · ${what}${holes.length === 1 ? ` a ${fmtMm(holes[0]!.x)} × ${fmtMm(holes[0]!.y)} mm` : ""}` }
}

/** La peça amb la mida `size` en l'eix `a`, movent la cara `s` (l'altra es queda). Deixa de ser lligada (bloc o tauler dinàmic). */
export function resizePartFace(p: FreePart, a: number, s: 0 | 1, size: number): FreePart {
  const ax = PART_AXES[p.orient]
  const key = (["x", "y", "z"] as const)[a]!
  const old = partSize(p)[a]!
  const dim = a === ax.n ? { thickness: size } : a === ax.u ? { w: size } : { h: size }
  return { ...p, ...dim, fit: undefined, dyn: undefined, ...(s === 0 ? { [key]: r1(p[key] + old - size) } : {}) }
}

/** La peça lliure desplaçada `d` mm en l'eix `a` (deixa d'estar lligada a cares o a un buit). */
export function movePart(p: FreePart, a: number, d: number): FreePart {
  const key = (["x", "y", "z"] as const)[a]!
  return { ...p, fit: undefined, dyn: undefined, [key]: r1(p[key] + d) }
}

/** La mida del moble en l'eix `a` (amplada, alçada, fondària) i el nom, per a la Cara dinàmica. */
export const MODULE_DIM: [keyof Pick<Module["carcass"], "width" | "height" | "depth">, string][] = [
  ["width", "Amplada del moble"],
  ["height", "Alçada del moble"],
  ["depth", "Fondària del moble"],
]

/** Desa el croquis que s'estava dibuixant amb aquests punts (en queda triat) o diu per què no. */
export function finishSketch(comp: Composition, o: FaceToolOpts, pts: [number, number][], rect: boolean): FaceToolResult {
  const d = o.draft
  if (!d) return { message: "Clica una cara per començar el croquis.", error: true }
  const us = pts.map((q) => q[0])
  const vs = pts.map((q) => q[1])
  if (pts.length < 3 || Math.max(...us) - Math.min(...us) < 1 || Math.max(...vs) - Math.min(...vs) < 1) return { message: "Mida massa petita.", error: true }
  const fmt = (v: number) => String(r1(v)).replace(".", ",")
  const name = rect ? `Rectangle ${fmt(Math.max(...us) - Math.min(...us))}×${fmt(Math.max(...vs) - Math.min(...vs))}` : pts.length === 48 ? `Cercle Ø${fmt(Math.max(...us) - Math.min(...us))}` : `Contorn ${pts.length} punts`
  const sk: Sketch = { id: newId("s"), name, a: d.a, level: d.level, dir: d.dir, pts, ...(rect ? { rect: true } : {}) }
  return { comp: { ...comp, sketches: [...(comp.sketches ?? []), sk] }, opts: { ...o, draft: undefined, selSketch: sk.id }, message: `${name}: fet. L'Extrusió en fa una peça.` }
}

/** Tauler (com al Taulell): el rectangle dibuixat (a terra o sobre una cara) passa a ser una peça solta del gruix triat. */
function boardPart(o: FaceToolOpts, comp: Composition, sk: Sketch): FreePart {
  const n = (comp.parts ?? []).filter((q) => q.name.startsWith("Tauler")).length
  const material = o.mat || comp.parts?.at(-1)?.material || comp.modules[0]?.carcass.material || ""
  return extrudeSketch(sk, o.T, { id: newId("p"), name: n ? `Tauler ${n + 1}` : "Tauler", material })
}
export function finishBoard(comp: Composition, o: FaceToolOpts, pts: [number, number][]): FaceToolResult {
  const d = o.draft
  if (!d) return { message: "Clica a terra o sobre una cara per començar el tauler.", error: true }
  const us = pts.map((q) => q[0])
  const vs = pts.map((q) => q[1])
  if (Math.max(...us) - Math.min(...us) < 1 || Math.max(...vs) - Math.min(...vs) < 1) return { message: "Mida massa petita.", error: true }
  const p = boardPart(o, comp, { id: "", name: "", a: d.a, level: d.level, dir: d.dir, pts })
  return { comp: { ...comp, parts: [...(comp.parts ?? []), p] }, opts: { ...o, draft: undefined }, select: { kind: "part", id: p.id }, message: `${p.name}: ${fmtMm(p.w)} × ${fmtMm(p.h)} × ${fmtMm(p.thickness)} mm` }
}

/** Un tauler dinàmic sense cara en el gruix, centrat a `at` (mm de la composició, en l'eix del gruix). */
function withMid(dyn: NonNullable<FreePart["dyn"]>, boxOf: (id: string) => { min: Vec3; max: Vec3 } | undefined, T: number, at: number): NonNullable<FreePart["dyn"]> {
  const b = dynBox({ ...dyn, mid: 0 }, boxOf, T)
  return b ? { ...dyn, mid: r1(at - (b.min[dyn.t]! + b.max[dyn.t]!) / 2) } : dyn
}

/** Cares de referència → el tauler (com «Crea el tauler» del Taulell): el gruix va on no hi ha cares, o sobre la de recolzament. */
export function createRefPanel(o: FaceToolOpts, comp: Composition, build: CompositionBuild | undefined): FaceToolResult {
  const limits = o.refLimits ?? []
  const panels = build?.panels ?? []
  if (limits.length < 2) return { message: "Clica almenys dues cares que limitin el tauler.", error: true }
  const per = [0, 1, 2].map((a) => limits.filter((L) => L.a === a).length)
  const t = o.dynOrient !== "auto" ? o.dynOrient : per.indexOf(0) >= 0 ? (per[1] === 0 ? 1 : per.indexOf(0)) : per.indexOf(1) >= 0 ? per.indexOf(1) : 1
  const boxes = new Map(panels.map((q) => [q.id, panelAabb(q)] as const))
  const boxOf = (id: string) => boxes.get(id)
  const first = panels.find((q) => q.id === limits[0]!.panel)
  const host = first ? moduleOf(comp, first) : undefined
  const T = o.ownT ? o.T : (host?.carcass.thickness ?? o.T)
  const own = limits.filter((L) => L.a === t)
  const dyn = own.length === 1 || own.length === 0 ? (own.length ? { t, limits } : withMid({ t, limits }, boxOf, T, o.refSeed?.[t] ?? 0)) : { t, limits: limits.filter((L) => !(L.a === t && L.s === 1)) }
  const b = dynBox(dyn, boxOf, T)
  if (!b) return { message: "Amb aquestes cares el tauler queda sense mida.", error: true }
  const off: Vec3 = (host && moduleOrigins3(comp).get(host.id)) || [0, 0, 0]
  const base = uniqueName(comp, "Tauler dinàmic")
  const part = partWithBox({ id: newId("p"), name: base, orient: ORIENT_OF_AXIS[t]!, w: 0, h: 0, thickness: T, material: o.mat || (host?.carcass.material ?? first?.material ?? ""), x: 0, y: 0, z: 0, ...(host ? { module: host.id } : {}), dyn }, b, off)
  return { comp: { ...comp, parts: [...(comp.parts ?? []), part] }, opts: { ...o, refLimits: undefined, refSeed: undefined }, select: { kind: "part", id: part.id }, message: `${base}: ${r1(part.w)} × ${r1(part.h)} mm, lligat a ${dyn.limits.length} cares` }
}

/** La vista prèvia d'una eina amb el ratolí a sobre d'una cara (en verd, com al Taulell): la peça que sortiria o el croquis a mig fer. */
export function previewFaceTool(tool: FaceToolId, o: FaceToolOpts, comp: Composition, build: CompositionBuild | undefined, hit: FaceHit): { box?: { min: Vec3; max: Vec3 }; boxes?: { min: Vec3; max: Vec3 }[]; pts?: Vec3[]; closed?: boolean; label?: string; measure?: boolean } | null {
  // Unions i mecanitzats: abans de clicar, el que es faria i on, amb les mides (com el Taulell).
  if (tool === "dowel" || tool === "screw" || tool === "cabineo" || tool === "groove" || tool === "rebate" || tool === "hole" || tool === "cup" || tool === "line32") {
    const r = runFaceTool(tool, o, comp, build, hit)
    return r.ghost?.length ? { boxes: r.ghost, label: r.message } : null
  }
  if (tool === "laser" || tool === "measure") {
    const r = runFaceTool(tool, { ...o, measureFrom: tool === "measure" ? o.measureFrom : o.laserMode === "axis" ? o.measureFrom : undefined }, comp, build, hit)
    const line = r.opts?.measureLine
    return line && (tool === "laser" ? o.laserMode === "face" || !!o.measureFrom : !!o.measureFrom) ? { pts: line, closed: false, measure: true, label: r.opts?.measureLabel } : null
  }
  if (tool === "dynpanel" || tool === "fitblock" || tool === "shelf") {
    const r = runFaceTool(tool, o, comp, build, hit)
    const q = !r.error && r.comp?.parts?.[r.comp.parts.length - 1]
    if (!q) return null
    const off: Vec3 = (q.module && moduleOrigins3(comp).get(q.module)) || [0, 0, 0]
    const b = partBox(q)
    return { box: { min: b.min.map((v, k) => v + off[k]!) as Vec3, max: b.max.map((v, k) => v + off[k]!) as Vec3 } }
  }
  const d = o.draft
  if (tool === "board" && d) {
    const q = toPlane(d.a, hit.point)
    const b = partBox(boardPart(o, comp, { id: "", name: "", a: d.a, level: d.level, dir: d.dir, pts: rectPts(d.pts[0]!, q) }))
    return { box: b, label: `${fmtMm(Math.abs(q[0] - d.pts[0]![0]))} × ${fmtMm(Math.abs(q[1] - d.pts[0]![1]))} × ${fmtMm(o.T)} mm` }
  }
  if ((tool === "rect" || tool === "circle" || tool === "poly") && d) {
    const q = toPlane(d.a, hit.point)
    const lift = (x: [number, number]) => fromPlane(d.a, d.level + d.dir * 0.5, x)
    if (tool === "rect") return { pts: rectPts(d.pts[0]!, q).map(lift), closed: true }
    if (tool === "circle") return { pts: circlePts(d.pts[0]!, 2 * Math.hypot(q[0] - d.pts[0]![0], q[1] - d.pts[0]![1])).map(lift), closed: true }
    return { pts: [...d.pts, q].map(lift), closed: false }
  }
  return null
}
