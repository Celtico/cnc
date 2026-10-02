import { toolMslName, type Machine, type MachineTool } from "../model/machine"

/**
 * Vista CAM: lector del text MSL (.xcs) que escriu l'app (`toMaestroNestXcs`, `toMaestroXcs`), el mateix que va al zip,
 * per dibuixar què rebrà la màquina. No és un intèrpret de l'MSL: només les instruccions que fem servir (i les del
 * programa real del taller, `CreateToolpath`…). La resta de línies es compten com a `unknown` i no fan res (mai llança).
 *
 * Coordenades del pla (`Top`: X, Y del tauler o de la peça, origen a baix a l'esquerra), en mm.
 */

export type Pt = [number, number]

/** Tram d'un camí: recta fins a `to` o arc amb centre `c` (horari si `cw`). */
export interface CamSeg {
  to: Pt
  arc?: { c: Pt; cw: boolean }
}

export interface CamPath {
  name: string
  kind: "polyline" | "circle" | "segment" | "toolpath"
  start: Pt
  segs: CamSeg[]
  closed: boolean
  /** Cercles (`CreateCircleCenterRadius`): centre i radi (l'òfset és exacte). */
  circle?: { c: Pt; r: number }
  /** Recorreguts (`CreateToolpath`): la Z més baixa (negativa = dins de la peça). */
  minZ?: number
}

export type CamOpKind = "drill" | "contour" | "pocket" | "rough" | "slot"
/** Costat de l'eina: contorns per dins / per fora, o la correcció d'un fresat (centre, esquerra, dreta). */
export type CamSide = "inside" | "outside" | "center" | "left" | "right"

export interface CamOp {
  /** Ordre al fitxer (1…). */
  n: number
  /** Línia del fitxer (1…). */
  line: number
  kind: CamOpKind
  name: string
  /** Ref de la peça (`A.1.L.1_Forat_3` → `A.1.L.1`), si el nom en porta. */
  ref?: string
  plane: string
  /** Paràmetre `tool` tal com és al fitxer (`"-1"` = la tria el Maestro). */
  toolArg: string
  /** Nom de l'eina: el paràmetre o, amb `"-1"`, el del comentari d'eina anterior (`//BROCA PLANA 006`). */
  tool: string
  depth: number
  desc: string
  /** Forats. */
  x?: number
  y?: number
  diameter?: number
  /** Geometria que consumeix l'operació (la geometria activa, la darrera creada). */
  path?: CamPath
  side?: CamSide
  overMaterial?: number
  /** Passada de les peces petites (`_P1`, «passada 1 de 3»). */
  pass?: { index: number; count: number }
  small?: boolean
  /** Entrada lineal (`SetApproachStrategy(lineal, cota, k)`): k × radi = llargada. */
  approach?: { linear: boolean; k: number }
  /** `CreateBidirectionalMillingStrategy(…, passada, …)`: fondària màxima de cada passada. */
  maxPass?: number
  /** Recorregut explícit del centre de l'eina (`CreateToolpath`, el que fa TopSolid). */
  toolpath?: CamPath
}

export interface CamPart {
  ref: string
  name: string
  label: string
  length: number
  width: number
  /** Cantonada de la petjada al tauler, gir antihorari i mida de la petjada. */
  x: number
  y: number
  angle: number
  w: number
  h: number
  /** Centre de l'etiqueta (si el fitxer el porta). */
  cx?: number
  cy?: number
}

export interface XcsPreview {
  workpiece?: { name: string; L: number; W: number; T: number }
  parts: CamPart[]
  ops: CamOp[]
  /** Marge del tauler (comentari de la capçalera). */
  edgeTrim?: number
  spacing?: number
  /** Línies que no s'entenen (no fan res). */
  unknown: number
  unknownLines: { line: number; text: string }[]
}

type Arg = { s: string } | { v: string }

/** Parteix els arguments d'una crida (cadenes C# amb `\"` i `\\`). `null` si està mal tancada. */
function splitArgs(src: string): Arg[] | null {
  const out: Arg[] = []
  let i = 0
  const n = src.length
  while (i < n) {
    while (i < n && /\s/.test(src[i]!)) i++
    if (i >= n) break
    if (src[i] === '"') {
      let s = ""
      i++
      let closed = false
      while (i < n) {
        const ch = src[i]!
        if (ch === "\\" && i + 1 < n) {
          s += src[i + 1]
          i += 2
          continue
        }
        if (ch === '"') {
          closed = true
          i++
          break
        }
        s += ch
        i++
      }
      if (!closed) return null
      out.push({ s })
      while (i < n && /\s/.test(src[i]!)) i++
      if (i < n && src[i] !== ",") return null
      i++
      continue
    }
    let depth = 0
    let v = ""
    while (i < n && (depth > 0 || src[i] !== ",")) {
      if (src[i] === "(") depth++
      if (src[i] === ")") depth--
      v += src[i]
      i++
    }
    out.push({ v: v.trim() })
    i++
  }
  return out
}

const CALL = /^([A-Za-z_]\w*)\s*\(([\s\S]*)\)\s*;*\s*$/

/** Instruccions que no es dibuixen però són conegudes (capçalera, campanes, retirada…). */
const IGNORED = new Set([
  "SetMachiningParameters",
  "SetPreserveWorkingSequence",
  "SetWorkPieceFallPrevention",
  "CreateRawWorkpiece",
  "SetWorkpieceSetupPosition",
  "CreateMacro",
  "SetPneumaticHoodPosition",
  "ResetAuxiliaryHood",
  "ResetDustpan",
  "SetRetractStrategy",
  "ResetRetractStrategy",
  "SetAttribute",
  "SelectWorkpiece",
])

const OP_NAME = /^(.+?)_(?:Forat|ForatPassant|Ranura|Caixera|Tall|Contorn)_\d+/

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Centre d'un arc per dos punts i radi (manual Table 22): horari / antihorari, més o menys de 180°. */
export function arcCenter(p0: Pt, p1: Pt, r: number, cw: boolean, over180: boolean): Pt {
  const d = dist(p0, p1) / 2
  const m: Pt = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
  if (d < 1e-9) return m
  const h = Math.sqrt(Math.max(0, r * r - d * d))
  const ux = (p1[0] - p0[0]) / (2 * d)
  const uy = (p1[1] - p0[1]) / (2 * d)
  // Antihorari i < 180°: el centre a l'esquerra de la corda.
  const sign = (cw ? -1 : 1) * (over180 ? -1 : 1)
  return [m[0] - sign * h * uy, m[1] + sign * h * ux]
}

function circumcenter(a: Pt, b: Pt, c: Pt): Pt | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
  if (Math.abs(d) < 1e-12) return null
  const a2 = a[0] ** 2 + a[1] ** 2
  const b2 = b[0] ** 2 + b[1] ** 2
  const c2 = c[0] ** 2 + c[1] ** 2
  return [(a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d, (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d]
}

const lastPoint = (p: CamPath): Pt => (p.segs.length ? p.segs[p.segs.length - 1]!.to : p.start)

/** Llegeix un programa .xcs (MSL) per a la vista CAM. */
export function parseXcsPreview(text: string): XcsPreview {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/)
  const res: XcsPreview = { parts: [], ops: [], unknown: 0, unknownLines: [] }
  let plane = "Top"
  let active: CamPath | undefined
  let building: CamPath | undefined
  let toolComment = ""
  let note = ""
  let approach: CamOp["approach"]
  let strategy: number | undefined
  let section: "parts" | "labels" | null = null
  let lastOp: CamOp | undefined

  const unknown = (line: number, t: string) => {
    res.unknown++
    if (res.unknownLines.length < 20) res.unknownLines.push({ line, text: t.slice(0, 200) })
  }

  for (let li = 0; li < lines.length; li++) {
    const lineNo = li + 1
    const t = lines[li]!.trim()
    if (!t) continue
    if (t.startsWith("//")) {
      const c = t.slice(2)
      const tc = /^\s*(BROCA|FRESA)\s+PLANA\s+(.+?)\s*$/.exec(c)
      if (tc) {
        toolComment = tc[2]!
        continue
      }
      const pc = /broca (?:vertical|horitzontal) \S+ \(([^)]+)\)/.exec(c)
      if (pc) toolComment = pc[1]!
      if (/^\s*Peces \(/.test(c)) section = "parts"
      else if (/^\s*Etiquetes/.test(c)) section = "labels"
      else if (section && /^\s{2,}\S/.test(c)) {
        if (section === "parts") {
          const m = /^\s+(\S+) (.+?) \((.+)\) ([\d.]+) x ([\d.]+) a \(([-\d.]+), ([-\d.]+)\) gir (\d+)\s*$/.exec(c)
          if (m) {
            const length = Number(m[4])
            const width = Number(m[5])
            const angle = Number(m[8])
            const turned = angle === 90 || angle === 270
            res.parts.push({ ref: m[1]!, name: m[2]!, label: m[3]!, length, width, x: Number(m[6]), y: Number(m[7]), angle, w: turned ? width : length, h: turned ? length : width })
          }
        } else {
          const m = /^\s+(\S+) \(([-\d.]+), ([-\d.]+)\)\s*$/.exec(c)
          const p = m && res.parts.find((x) => x.ref === m[1])
          if (p) {
            p.cx = Number(m[2])
            p.cy = Number(m[3])
          }
        }
      } else section = null
      const trim = /Marge del tauler ([\d.]+) mm/.exec(c)
      if (trim) res.edgeTrim = Number(trim[1])
      const sp = /separacio ([\d.]+) mm/.exec(c)
      if (sp) res.spacing = Number(sp[1])
      if (/^\s*Peca \S+ \(/.test(c)) note = c
      continue
    }
    section = null
    // `MachineParameters mp=GetMachiningParameters();` (C#: una declaració de la capçalera del taller).
    if (/^\w+\s+\w+\s*=\s*\w+\s*\(.*\)\s*;*$/.test(t)) continue
    const call = CALL.exec(t)
    const args = call ? splitArgs(call[2]!) : null
    if (!call || !args) {
      unknown(lineNo, t)
      continue
    }
    const fn = call[1]!
    const S = (i: number): string | undefined => {
      const a = args[i]
      return a && "s" in a ? a.s : undefined
    }
    const N = (i: number): number => {
      const a = args[i]
      if (!a || !("v" in a) || a.v === "") return NaN
      const v = Number(a.v)
      return Number.isFinite(v) ? v : NaN
    }
    const B = (i: number): boolean | undefined => {
      const a = args[i]
      return a && "v" in a ? (a.v === "true" ? true : a.v === "false" ? false : undefined) : undefined
    }
    const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x))
    const pt = (i: number): Pt | null => (ok(N(i), N(i + 1)) ? [N(i), N(i + 1)] : null)

    if (IGNORED.has(fn)) continue
    switch (fn) {
      case "CreateFinishedWorkpieceBox": {
        if (!ok(N(1), N(2), N(3))) break
        res.workpiece = { name: S(0) ?? "", L: N(1), W: N(2), T: N(3) }
        continue
      }
      case "SelectWorkplane": {
        plane = S(0) ?? plane
        continue
      }
      case "CreatePolyline": {
        const p = pt(1)
        if (!p) break
        building = active = { name: S(0) ?? "", kind: "polyline", start: p, segs: [], closed: false }
        continue
      }
      case "AddSegmentToPolyline": {
        const p = pt(0)
        if (!p || !building || building.kind !== "polyline") break
        building.segs.push({ to: p })
        continue
      }
      case "AddArc2PointCenterToPolyline": {
        const p = pt(0)
        const c = pt(2)
        const cw = B(4)
        if (!p || !c || cw === undefined || !building || building.kind !== "polyline") break
        building.segs.push({ to: p, arc: { c, cw } })
        continue
      }
      case "AddArc2PointRadiusToPolyline": {
        const p = pt(0)
        const r = N(2)
        const cw = B(3)
        const big = B(4)
        if (!p || !ok(r) || cw === undefined || big === undefined || !building || building.kind !== "polyline") break
        building.segs.push({ to: p, arc: { c: arcCenter(lastPoint(building), p, r, cw, big), cw } })
        continue
      }
      case "AddArc3PointsToPolyline": {
        const p2 = pt(0)
        const p3 = pt(2)
        if (!p2 || !p3 || !building || building.kind !== "polyline") break
        const p1 = lastPoint(building)
        const c = circumcenter(p1, p2, p3)
        if (!c) building.segs.push({ to: p3 })
        else {
          const cross = (p2[0] - p1[0]) * (p3[1] - p2[1]) - (p2[1] - p1[1]) * (p3[0] - p2[0])
          building.segs.push({ to: p3, arc: { c, cw: cross < 0 } })
        }
        continue
      }
      case "ClosePolyline": {
        if (!building || building.kind !== "polyline") break
        if (dist(lastPoint(building), building.start) > 1e-6) building.segs.push({ to: building.start })
        building.closed = true
        continue
      }
      case "CreateCircleCenterRadius": {
        const c = pt(1)
        const r = N(3)
        const cw = B(4) ?? false
        if (!c || !ok(r) || r <= 0) break
        const s: Pt = [c[0] + r, c[1]]
        const o: Pt = [c[0] - r, c[1]]
        building = undefined
        active = { name: S(0) ?? "", kind: "circle", start: s, segs: [{ to: o, arc: { c, cw } }, { to: s, arc: { c, cw } }], closed: true, circle: { c, r } }
        continue
      }
      case "CreateSegment": {
        const a = pt(1)
        const b = pt(3)
        if (!a || !b) break
        building = undefined
        active = { name: S(0) ?? "", kind: "segment", start: a, segs: [{ to: b }], closed: false }
        continue
      }
      case "CreateToolpath": {
        const p = pt(1)
        if (!p) break
        const z = N(3)
        building = { name: S(0) ?? "", kind: "toolpath", start: p, segs: [], closed: false, minZ: Number.isFinite(z) ? z : 0 }
        // El recorregut és de l'operació d'abans (programa del taller: `CreateRoughFinish` + `CreateToolpath`).
        if (lastOp && !lastOp.toolpath) lastOp.toolpath = building
        continue
      }
      case "AddSegmentToToolpath":
      case "AddArc2PointRadiusToToolpath": {
        const p = pt(0)
        const z = N(2)
        if (!p || !building || building.kind !== "toolpath") break
        if (Number.isFinite(z)) building.minZ = Math.min(building.minZ ?? 0, z)
        if (fn === "AddSegmentToToolpath") building.segs.push({ to: p })
        else {
          const r = N(3)
          const cw = B(4)
          const big = B(5)
          if (!ok(r) || cw === undefined) break
          building.segs.push({ to: p, arc: { c: arcCenter(lastPoint(building), p, r, cw, !!big), cw } })
        }
        continue
      }
      case "SetApproachStrategy": {
        approach = { linear: B(0) ?? true, k: Number.isFinite(N(2)) ? N(2) : 0 }
        continue
      }
      case "ResetApproachStrategy": {
        approach = undefined
        continue
      }
      case "CreateBidirectionalMillingStrategy": {
        strategy = N(1)
        continue
      }
      case "CreateDrill": {
        const p = pt(1)
        const depth = N(3)
        const d = N(4)
        if (!p || !ok(depth, d)) break
        const toolArg = S(7) ?? "-1"
        lastOp = pushOp({ kind: "drill", name: S(0) ?? "", toolArg, depth, desc: S(5) ?? "", x: p[0], y: p[1], diameter: d }, lineNo)
        continue
      }
      case "CreateContour": {
        const depth = N(1)
        if (!ok(depth)) break
        const side = N(3) === 0 ? "inside" : "outside"
        const om = N(12)
        lastOp = pushOp({ kind: "contour", name: S(0) ?? "", toolArg: S(6) ?? "-1", depth, desc: S(4) ?? "", side, ...(active ? { path: active } : {}), ...(Number.isFinite(om) && om ? { overMaterial: om } : {}) }, lineNo)
        continue
      }
      case "CreateContourPocket": {
        const depth = N(1)
        if (!ok(depth)) break
        lastOp = pushOp({ kind: "pocket", name: S(0) ?? "", toolArg: S(4) ?? "-1", depth, desc: S(2) ?? "", side: "inside", ...(active ? { path: active } : {}) }, lineNo)
        continue
      }
      case "CreateRoughFinish":
      case "CreateSlot": {
        const depth = N(1)
        if (!ok(depth)) break
        const corr = N(6)
        const side: CamSide = corr === 1 ? "left" : corr === 2 ? "right" : "center"
        lastOp = pushOp({ kind: fn === "CreateSlot" ? "slot" : "rough", name: S(0) ?? "", toolArg: S(4) ?? "-1", depth: Math.abs(depth), desc: S(2) ?? "", side, ...(active ? { path: active } : {}) }, lineNo)
        continue
      }
    }
    unknown(lineNo, t)
  }

  // Passades de les peces petites sense comentari: el nombre de `_Pn` del mateix contorn.
  const counts = new Map<string, number>()
  for (const o of res.ops) {
    const m = /^(.*)_P(\d+)$/.exec(o.name)
    if (m) counts.set(m[1]!, Math.max(counts.get(m[1]!) ?? 0, Number(m[2])))
  }
  for (const o of res.ops) {
    const m = /^(.*)_P(\d+)$/.exec(o.name)
    if (m && !o.pass) o.pass = { index: Number(m[2]), count: counts.get(m[1]!)! }
    // Recorregut explícit: la fondària de debò és la Z més baixa (la de l'operació és de farciment).
    if (o.toolpath && (o.toolpath.minZ ?? 0) < 0) o.depth = -o.toolpath.minZ!
  }
  return res

  function pushOp(o: Omit<CamOp, "n" | "line" | "plane" | "tool">, line: number): CamOp {
    const ref = OP_NAME.exec(o.name)?.[1]
    const passNote = /passada (\d+) de (\d+)/.exec(note)
    const small = /peca petita/.test(note)
    const pn = /_P(\d+)$/.exec(o.name)
    const op: CamOp = {
      ...o,
      n: res.ops.length + 1,
      line,
      plane,
      tool: o.toolArg && o.toolArg !== "-1" ? o.toolArg : toolComment || "-1",
      ...(ref ? { ref } : {}),
      ...(o.kind !== "drill" && approach ? { approach } : {}),
      ...(strategy !== undefined && Number.isFinite(strategy) ? { maxPass: strategy } : {}),
      ...(note && small ? { small } : {}),
      ...(passNote && pn && Number(passNote[1]) === Number(pn[1]) ? { pass: { index: Number(passNote[1]), count: Number(passNote[2]) } } : {}),
    }
    // Les estratègies no són modals (manual p58): només per a l'operació següent. El comentari de la peça, també.
    strategy = undefined
    if (o.kind !== "drill") note = ""
    res.ops.push(op)
    return op
  }
}

// ——— Geometria per dibuixar ———

/** Punts d'un camí (els arcs a trams de ≤ 5°). Tancat: sense repetir el primer al final. */
export function flattenPath(p: CamPath, stepDeg = 5): Pt[] {
  const out: Pt[] = [p.start]
  let cur = p.start
  for (const s of p.segs) {
    if (s.arc) {
      const { c, cw } = s.arc
      const r = (dist(cur, c) + dist(s.to, c)) / 2
      const a0 = Math.atan2(cur[1] - c[1], cur[0] - c[0])
      const a1 = Math.atan2(s.to[1] - c[1], s.to[0] - c[0])
      let sweep = cw ? a0 - a1 : a1 - a0
      while (sweep <= 1e-9) sweep += 2 * Math.PI
      if (dist(cur, s.to) < 1e-9) sweep = 2 * Math.PI
      const n = Math.max(2, Math.ceil(sweep / ((stepDeg * Math.PI) / 180)))
      for (let k = 1; k < n; k++) {
        const a = a0 + (cw ? -1 : 1) * (sweep * k) / n
        out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)])
      }
    }
    out.push(s.to)
    cur = s.to
  }
  const clean = out.filter((q, i) => i === 0 || dist(q, out[i - 1]!) > 1e-6)
  if (p.closed && clean.length > 1 && dist(clean[0]!, clean[clean.length - 1]!) < 1e-6) clean.pop()
  return clean
}

/** Àrea amb signe (antihorari > 0). */
export function signedArea(pts: Pt[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

/**
 * Òfset d'una polilínia a `s` mm cap a l'esquerra del sentit de la marxa (negatiu: cap a la dreta). Cantonades que
 * s'obren: arc al voltant del vèrtex (com fa el centre de l'eina); que es tanquen: intersecció de les dues rectes.
 * Aproximat, només per dibuixar: si l'eina no hi cap (una osca més estreta que el Ø), surten llaços.
 */
export function offsetPolyline(ptsIn: Pt[], closed: boolean, s: number): Pt[] {
  const pts = ptsIn.filter((q, i) => i === 0 || dist(q, ptsIn[i - 1]!) > 1e-6)
  if (closed && pts.length > 1 && dist(pts[0]!, pts[pts.length - 1]!) < 1e-6) pts.pop()
  if (Math.abs(s) < 1e-9 || pts.length < 2) return pts.slice()
  const nSeg = closed ? pts.length : pts.length - 1
  const dirs: Pt[] = []
  const norms: Pt[] = []
  for (let i = 0; i < nSeg; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    const l = dist(a, b)
    const d: Pt = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
    dirs.push(d)
    norms.push([-d[1], d[0]])
  }
  const off = (p: Pt, n: Pt): Pt => [p[0] + s * n[0], p[1] + s * n[1]]
  const out: Pt[] = []
  const join = (i: number) => {
    // Vèrtex i entre el tram i − 1 i el tram i.
    const P = pts[i]!
    const k0 = (i - 1 + nSeg) % nSeg
    const d0 = dirs[k0]!
    const d1 = dirs[i]!
    const n0 = norms[k0]!
    const n1 = norms[i]!
    const cross = d0[0] * d1[1] - d0[1] * d1[0]
    const dot = d0[0] * d1[0] + d0[1] * d1[1]
    if (Math.abs(cross) < 1e-9 && dot > 0) {
      out.push(off(P, n1))
      return
    }
    if (cross * s > 0) {
      // Es tanca: intersecció de les dues rectes desplaçades (limitada, per als girs gairebé enrere).
      const A = off(P, n0)
      const t = (((off(P, n1)[0] - A[0]) * d1[1] - (off(P, n1)[1] - A[1]) * d1[0]) / cross)
      const X: Pt = [A[0] + t * d0[0], A[1] + t * d0[1]]
      if (dist(X, P) <= 4 * Math.abs(s)) out.push(X)
      else out.push(A, off(P, n1))
      return
    }
    // S'obre: arc de radi |s| al voltant del vèrtex.
    const a0 = Math.atan2(s * n0[1], s * n0[0])
    let a1 = Math.atan2(s * n1[1], s * n1[0])
    const ccw = cross > 0
    if (ccw) while (a1 < a0) a1 += 2 * Math.PI
    else while (a1 > a0) a1 -= 2 * Math.PI
    const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 18)))
    for (let k = 0; k <= steps; k++) {
      const a = a0 + ((a1 - a0) * k) / steps
      out.push([P[0] + Math.abs(s) * Math.cos(a), P[1] + Math.abs(s) * Math.sin(a)])
    }
  }
  if (closed) {
    for (let i = 0; i < pts.length; i++) join(i)
  } else {
    out.push(off(pts[0]!, norms[0]!))
    for (let i = 1; i < pts.length - 1; i++) join(i)
    out.push(off(pts[pts.length - 1]!, norms[nSeg - 1]!))
  }
  return out
}

/** Eina de la màquina pel nom de l'MSL (el del .pgmx), el codi o el nom, sense majúscules ni espais de més. */
export function findTool(m: Pick<Machine, "tools"> | undefined, name: string): MachineTool | undefined {
  if (!m || !name || name === "-1") return undefined
  const k = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase()
  const want = k(name)
  return m.tools.find((t) => k(toolMslName(t)) === want) ?? m.tools.find((t) => k(t.code) === want) ?? m.tools.find((t) => k(t.name) === want)
}

/** Amplada del tall d'una eina: el gruix del disc o el Ø. */
export const cutWidth = (t: MachineTool | undefined): number | undefined => (t ? (t.kind === "blade" && t.bladeThickness ? t.bladeThickness : t.diameter) || undefined : undefined)

export interface CamDraw {
  /** La geometria del fitxer, en punts. */
  outline: Pt[]
  closed: boolean
  /** Recorregut del centre de l'eina (aproximat): l'òfset de mig Ø cap al costat que toca, o el `CreateToolpath`. */
  centre: Pt[]
  /** Amplada de la franja que treu l'eina (Ø), si se sap. */
  width?: number
  /** Caixera: tota l'àrea es buida. */
  fill: boolean
}

/** Què dibuixar d'una operació de fresa (no forats): la geometria, el centre de l'eina al costat bo i l'amplada. */
export function camDraw(op: CamOp, width: number | undefined): CamDraw | null {
  if (op.kind === "drill") return null
  if (op.toolpath) {
    const tp = flattenPath(op.toolpath)
    return { outline: op.path ? flattenPath(op.path) : tp, closed: !!op.path?.closed, centre: tp, ...(width ? { width } : {}), fill: false }
  }
  if (!op.path) return null
  const outline = flattenPath(op.path)
  const closed = op.path.closed
  const r = (width ?? 0) / 2
  const base = { outline, closed, ...(width ? { width } : {}), fill: op.kind === "pocket" }
  if (!r) return { ...base, centre: outline }
  if (op.path.circle && (op.side === "inside" || op.side === "outside")) {
    const { c, r: R } = op.path.circle
    const rr = op.side === "inside" ? R - r : R + r
    if (rr <= 1e-6) return { ...base, centre: [c] }
    const n = 72
    return { ...base, centre: Array.from({ length: n }, (_, k): Pt => [c[0] + rr * Math.cos((2 * Math.PI * k) / n), c[1] + rr * Math.sin((2 * Math.PI * k) / n)]) }
  }
  let s = 0
  if (op.side === "left") s = r
  else if (op.side === "right") s = -r
  else if ((op.side === "inside" || op.side === "outside") && closed) {
    const ccw = signedArea(outline) > 0
    // Antihorari: l'interior és a l'esquerra.
    s = (op.side === "inside") === ccw ? r : -r
  }
  return { ...base, centre: offsetPolyline(outline, closed, s) }
}

/** Entrada lineal: el tram de `length` mm que acaba al començament del recorregut, en la direcció del primer tram. */
export function approachSegment(centre: Pt[], length: number): [Pt, Pt] | null {
  if (centre.length < 2 || length <= 0) return null
  const a = centre[0]!
  const b = centre.find((q) => dist(q, a) > 1e-6)
  if (!b) return null
  const l = dist(a, b)
  return [[a[0] - ((b[0] - a[0]) / l) * length, a[1] - ((b[1] - a[1]) / l) * length], a]
}

// ——— Llegenda i llista ———

export interface CamToolInfo {
  /** Clau per al color. */
  key: string
  name: string
  kind: "drill" | "router" | "blade"
  diameter?: number
  /** Forats o operacions. */
  count: number
}

/** Clau d'eina d'una operació: forats pel nom i el Ø (una broca automàtica pot ser de diversos Ø). */
export const toolKey = (op: CamOp): string => (op.kind === "drill" ? `D|${op.tool}|${op.diameter}` : `R|${op.tool}`)

/** Llegenda: una fila per eina, en l'ordre en què surten. */
export function camTools(ops: CamOp[], m?: Pick<Machine, "tools">): CamToolInfo[] {
  const out = new Map<string, CamToolInfo>()
  for (const o of ops) {
    const key = toolKey(o)
    const cur = out.get(key)
    if (cur) {
      cur.count++
      continue
    }
    const t = findTool(m, o.tool)
    const diameter = o.kind === "drill" ? o.diameter : cutWidth(t)
    out.set(key, { key, name: o.tool === "-1" ? "automàtica" : o.tool, kind: o.kind === "drill" ? "drill" : o.kind === "slot" || t?.kind === "blade" ? "blade" : "router", ...(diameter ? { diameter } : {}), count: 1 })
  }
  return [...out.values()]
}

export interface CamRow {
  /** Primera i darrera operació (forats seguits de la mateixa eina i fondària, en una fila). */
  from: number
  to: number
  ops: CamOp[]
  tool: string
  key: string
  kind: CamOpKind
  depth: number
  count: number
}

/** Llista compacta: les operacions en ordre, amb els forats seguits iguals (eina, Ø i fondària) junts. */
export function camRows(ops: CamOp[]): CamRow[] {
  const rows: CamRow[] = []
  for (const o of ops) {
    const last = rows[rows.length - 1]
    if (last && o.kind === "drill" && last.kind === "drill" && last.key === toolKey(o) && Math.abs(last.depth - o.depth) < 1e-6 && last.to === o.n - 1) {
      last.to = o.n
      last.count++
      last.ops.push(o)
      continue
    }
    rows.push({ from: o.n, to: o.n, ops: [o], tool: o.tool, key: toolKey(o), kind: o.kind, depth: o.depth, count: 1 })
  }
  return rows
}
