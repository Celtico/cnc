import { arcCenter, circumcenter, dist, lastPoint } from "./geometry"
import type { CamOp, CamPath, CamSide, Pt, XcsPreview } from "./types"


type Arg = { s: string } | { v: string }

/**
 * Una polilínia que acaba on comença (≤ 1e-3) és tancada encara que no porti `ClosePolyline`: els contorns fets només
 * d'arcs (taules rodones i ovals) s'escriuen així. Només per a `CreateContour`/`CreateContourPocket`.
 */
function closedLoop(p: CamPath): CamPath {
  if (p.closed || p.kind !== "polyline" || !p.segs.length) return p
  const last = p.segs[p.segs.length - 1]!.to
  return dist(last, p.start) <= 1e-3 ? { ...p, closed: true } : p
}

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

/** El que el lector recorda d'una línia a la següent (pla, geometria activa, eina, estratègies…). */
interface ParseState {
  res: XcsPreview
  plane: string
  active: CamPath | undefined
  building: CamPath | undefined
  toolComment: string
  note: string
  approach: CamOp["approach"]
  strategy: number | undefined
  section: "parts" | "labels" | null
  lastOp: CamOp | undefined
}

/** Llegeix un programa .xcs (MSL) per a la vista CAM. */
export function parseXcsPreview(text: string): XcsPreview {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/)
  const res: XcsPreview = { parts: [], ops: [], unknown: 0, unknownLines: [] }
  const st: ParseState = { res, plane: "Top", active: undefined, building: undefined, toolComment: "", note: "", approach: undefined, strategy: undefined, section: null, lastOp: undefined }

  const unknown = (line: number, t: string) => {
    res.unknown++
    if (res.unknownLines.length < 20) res.unknownLines.push({ line, text: t.slice(0, 200) })
  }

  for (let li = 0; li < lines.length; li++) {
    const lineNo = li + 1
    const t = lines[li]!.trim()
    if (!t) continue
    if (t.startsWith("//")) {
      readComment(st, t.slice(2))
      continue
    }
    st.section = null
    // `MachineParameters mp=GetMachiningParameters();` (C#: una declaració de la capçalera del taller).
    if (/^\w+\s+\w+\s*=\s*\w+\s*\(.*\)\s*;*$/.test(t)) continue
    const call = CALL.exec(t)
    const args = call ? splitArgs(call[2]!) : null
    if (!call || !args) {
      unknown(lineNo, t)
      continue
    }
    const fn = call[1]!
    if (IGNORED.has(fn)) continue
    if (readCall(st, fn, args, lineNo)) continue
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
}

/** Un comentari (`//`): comentaris d'eina, la llista de peces i d'etiquetes, marge, separació i la nota de la peça. */
function readComment(st: ParseState, c: string): void {
  const { res } = st
  const tc = /^\s*(BROCA|FRESA)\s+PLANA\s+(.+?)\s*$/.exec(c)
  if (tc) {
    st.toolComment = tc[2]!
    return
  }
  const pc = /broca (?:vertical|horitzontal) \S+ \(([^)]+)\)/.exec(c)
  if (pc) st.toolComment = pc[1]!
  if (/^\s*Peces \(/.test(c)) st.section = "parts"
  else if (/^\s*Etiquetes/.test(c)) st.section = "labels"
  else if (st.section && /^\s{2,}\S/.test(c)) {
    if (st.section === "parts") {
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
  } else st.section = null
  const trim = /Marge del tauler ([\d.]+) mm/.exec(c)
  if (trim) res.edgeTrim = Number(trim[1])
  const sp = /separacio ([\d.]+) mm/.exec(c)
  if (sp) res.spacing = Number(sp[1])
  if (/^\s*Peca \S+ \(/.test(c)) st.note = c
}

/** Una crida coneguda: desa la geometria, l'estat o l'operació. `false` si no s'entén (es compta com a `unknown`). */
function readCall(st: ParseState, fn: string, args: Arg[], lineNo: number): boolean {
  const { res } = st
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

  switch (fn) {
    case "CreateFinishedWorkpieceBox": {
      if (!ok(N(1), N(2), N(3))) return false
      res.workpiece = { name: S(0) ?? "", L: N(1), W: N(2), T: N(3) }
      return true
    }
    case "SelectWorkplane": {
      st.plane = S(0) ?? st.plane
      return true
    }
    case "CreatePolyline": {
      const p = pt(1)
      if (!p) return false
      st.building = st.active = { name: S(0) ?? "", kind: "polyline", start: p, segs: [], closed: false }
      return true
    }
    case "AddSegmentToPolyline": {
      const p = pt(0)
      if (!p || !st.building || st.building.kind !== "polyline") return false
      st.building.segs.push({ to: p })
      return true
    }
    case "AddArc2PointCenterToPolyline": {
      const p = pt(0)
      const c = pt(2)
      const cw = B(4)
      if (!p || !c || cw === undefined || !st.building || st.building.kind !== "polyline") return false
      st.building.segs.push({ to: p, arc: { c, cw } })
      return true
    }
    case "AddArc2PointRadiusToPolyline": {
      const p = pt(0)
      const r = N(2)
      const cw = B(3)
      const big = B(4)
      if (!p || !ok(r) || cw === undefined || big === undefined || !st.building || st.building.kind !== "polyline") return false
      st.building.segs.push({ to: p, arc: { c: arcCenter(lastPoint(st.building), p, r, cw, big), cw } })
      return true
    }
    case "AddArc3PointsToPolyline": {
      const p2 = pt(0)
      const p3 = pt(2)
      if (!p2 || !p3 || !st.building || st.building.kind !== "polyline") return false
      const p1 = lastPoint(st.building)
      const c = circumcenter(p1, p2, p3)
      if (!c) st.building.segs.push({ to: p3 })
      else {
        const cross = (p2[0] - p1[0]) * (p3[1] - p2[1]) - (p2[1] - p1[1]) * (p3[0] - p2[0])
        st.building.segs.push({ to: p3, arc: { c, cw: cross < 0 } })
      }
      return true
    }
    case "ClosePolyline": {
      if (!st.building || st.building.kind !== "polyline") return false
      if (dist(lastPoint(st.building), st.building.start) > 1e-6) st.building.segs.push({ to: st.building.start })
      st.building.closed = true
      return true
    }
    case "CreateCircleCenterRadius": {
      const c = pt(1)
      const r = N(3)
      const cw = B(4) ?? false
      if (!c || !ok(r) || r <= 0) return false
      const s: Pt = [c[0] + r, c[1]]
      const o: Pt = [c[0] - r, c[1]]
      st.building = undefined
      st.active = { name: S(0) ?? "", kind: "circle", start: s, segs: [{ to: o, arc: { c, cw } }, { to: s, arc: { c, cw } }], closed: true, circle: { c, r } }
      return true
    }
    case "CreateSegment": {
      const a = pt(1)
      const b = pt(3)
      if (!a || !b) return false
      st.building = undefined
      st.active = { name: S(0) ?? "", kind: "segment", start: a, segs: [{ to: b }], closed: false }
      return true
    }
    case "CreateToolpath": {
      const p = pt(1)
      if (!p) return false
      const z = N(3)
      st.building = { name: S(0) ?? "", kind: "toolpath", start: p, segs: [], closed: false, minZ: Number.isFinite(z) ? z : 0 }
      // El recorregut és de l'operació d'abans (programa del taller: `CreateRoughFinish` + `CreateToolpath`).
      if (st.lastOp && !st.lastOp.toolpath) st.lastOp.toolpath = st.building
      return true
    }
    case "AddSegmentToToolpath":
    case "AddArc2PointRadiusToToolpath": {
      const p = pt(0)
      const z = N(2)
      if (!p || !st.building || st.building.kind !== "toolpath") return false
      if (Number.isFinite(z)) st.building.minZ = Math.min(st.building.minZ ?? 0, z)
      if (fn === "AddSegmentToToolpath") st.building.segs.push({ to: p })
      else {
        const r = N(3)
        const cw = B(4)
        const big = B(5)
        if (!ok(r) || cw === undefined) return false
        st.building.segs.push({ to: p, arc: { c: arcCenter(lastPoint(st.building), p, r, cw, !!big), cw } })
      }
      return true
    }
    case "SetApproachStrategy": {
      st.approach = { linear: B(0) ?? true, k: Number.isFinite(N(2)) ? N(2) : 0 }
      return true
    }
    case "ResetApproachStrategy": {
      st.approach = undefined
      return true
    }
    case "CreateBidirectionalMillingStrategy": {
      st.strategy = N(1)
      return true
    }
    case "CreateDrill": {
      const p = pt(1)
      const depth = N(3)
      const d = N(4)
      if (!p || !ok(depth, d)) return false
      const toolArg = S(7) ?? "-1"
      st.lastOp = pushOp(st, { kind: "drill", name: S(0) ?? "", toolArg, depth, desc: S(5) ?? "", x: p[0], y: p[1], diameter: d }, lineNo)
      return true
    }
    case "CreateContour": {
      const depth = N(1)
      if (!ok(depth)) return false
      const side = N(3) === 0 ? "inside" : "outside"
      const om = N(12)
      st.lastOp = pushOp(st, { kind: "contour", name: S(0) ?? "", toolArg: S(6) ?? "-1", depth, desc: S(4) ?? "", side, ...(st.active ? { path: closedLoop(st.active) } : {}), ...(Number.isFinite(om) && om ? { overMaterial: om } : {}) }, lineNo)
      return true
    }
    case "CreateContourPocket": {
      const depth = N(1)
      if (!ok(depth)) return false
      st.lastOp = pushOp(st, { kind: "pocket", name: S(0) ?? "", toolArg: S(4) ?? "-1", depth, desc: S(2) ?? "", side: "inside", ...(st.active ? { path: closedLoop(st.active) } : {}) }, lineNo)
      return true
    }
    case "CreateRoughFinish":
    case "CreateSlot": {
      const depth = N(1)
      if (!ok(depth)) return false
      const corr = N(6)
      const side: CamSide = corr === 1 ? "left" : corr === 2 ? "right" : "center"
      st.lastOp = pushOp(st, { kind: fn === "CreateSlot" ? "slot" : "rough", name: S(0) ?? "", toolArg: S(4) ?? "-1", depth: Math.abs(depth), desc: S(2) ?? "", side, ...(st.active ? { path: st.active } : {}) }, lineNo)
      return true
    }
  }
  return false
}

/** Afegeix una operació amb el pla, l'eina i les estratègies del moment (que no són modals: es buiden). */
function pushOp(st: ParseState, o: Omit<CamOp, "n" | "line" | "plane" | "tool">, line: number): CamOp {
  const { res } = st
  const ref = OP_NAME.exec(o.name)?.[1]
  const passNote = /passada (\d+) de (\d+)/.exec(st.note)
  const small = /peca petita/.test(st.note)
  const pn = /_P(\d+)$/.exec(o.name)
  const op: CamOp = {
    ...o,
    n: res.ops.length + 1,
    line,
    plane: st.plane,
    tool: o.toolArg && o.toolArg !== "-1" ? o.toolArg : st.toolComment || "-1",
    ...(ref ? { ref } : {}),
    ...(o.kind !== "drill" && st.approach ? { approach: st.approach } : {}),
    ...(st.strategy !== undefined && Number.isFinite(st.strategy) ? { maxPass: st.strategy } : {}),
    ...(st.note && small ? { small } : {}),
    ...(passNote && pn && Number(passNote[1]) === Number(pn[1]) ? { pass: { index: Number(passNote[1]), count: Number(passNote[2]) } } : {}),
  }
  // Les estratègies no són modals (manual p58): només per a l'operació següent. El comentari de la peça, també.
  st.strategy = undefined
  if (o.kind !== "drill") st.note = ""
  res.ops.push(op)
  return op
}
