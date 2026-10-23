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

const OP_NAME = /^(.+?)_(?:Forat|ForatPassant|Ranura|Caixera|Tall|Contorn|Desbast|Acabat)_\d+/

/** El que el lector recorda d'una línia a la següent (pla, geometria activa, eina, estratègies…). */
interface ParseState {
  res: XcsPreview
  plane: string
  active: CamPath | undefined
  building: CamPath | undefined
  toolComment: string
  /** L'últim comentari d'eina era d'una fresa esfèrica (`//FRESA ESFERICA <nom>`). */
  ball: boolean
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
  const st: ParseState = { res, plane: "Top", active: undefined, building: undefined, toolComment: "", ball: false, note: "", approach: undefined, strategy: undefined, section: null, lastOp: undefined }

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
  const tc = /^\s*(BROCA|FRESA)\s+(PLANA|ESFERICA)\s+(.+?)\s*$/.exec(c)
  if (tc) {
    st.toolComment = tc[3]!
    st.ball = tc[2] === "ESFERICA"
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

/** Els arguments d'una crida, llegits com a text (`S`), número (`N`, NaN si no ho és), sí/no (`B`) o punt (`pt`). */
interface Args {
  S(i: number): string | undefined
  N(i: number): number
  B(i: number): boolean | undefined
  ok(...xs: number[]): boolean
  pt(i: number): Pt | null
}

function argsOf(args: Arg[]): Args {
  const N = (i: number): number => {
    const a = args[i]
    if (!a || !("v" in a) || a.v === "") return NaN
    const v = Number(a.v)
    return Number.isFinite(v) ? v : NaN
  }
  const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x))
  return {
    S: (i) => {
      const a = args[i]
      return a && "s" in a ? a.s : undefined
    },
    N,
    B: (i) => {
      const a = args[i]
      return a && "v" in a ? (a.v === "true" ? true : a.v === "false" ? false : undefined) : undefined
    },
    ok,
    pt: (i) => (ok(N(i), N(i + 1)) ? [N(i), N(i + 1)] : null),
  }
}

type Call = (st: ParseState, arg: Args, fn: string, lineNo: number) => boolean

/** Un tram (recte o en arc) del recorregut que s'està fent. */
const toolpathStep: Call = (st, arg, fn) => {
  const p = arg.pt(0)
  const z = arg.N(2)
  if (!p || !st.building || st.building.kind !== "toolpath") return false
  if (Number.isFinite(z)) st.building.minZ = Math.min(st.building.minZ ?? 0, z)
  const zz = Number.isFinite(z) ? { z } : {}
  if (fn === "AddSegmentToToolpath") st.building.segs.push({ to: p, ...zz })
  else {
    const r = arg.N(3)
    const cw = arg.B(4)
    const big = arg.B(5)
    if (!arg.ok(r) || cw === undefined) return false
    st.building.segs.push({ to: p, arc: { c: arcCenter(lastPoint(st.building), p, r, cw, !!big), cw }, ...zz })
  }
  return true
}

/** Desbast o ranura pel recorregut actiu. */
const millOp: Call = (st, arg, fn, lineNo) => {
  const depth = arg.N(1)
  if (!arg.ok(depth)) return false
  const corr = arg.N(6)
  const side: CamSide = corr === 1 ? "left" : corr === 2 ? "right" : "center"
  st.lastOp = pushOp(st, { kind: fn === "CreateSlot" ? "slot" : "rough", name: arg.S(0) ?? "", toolArg: arg.S(4) ?? "-1", depth: Math.abs(depth), desc: arg.S(2) ?? "", side, ...(st.active ? { path: st.active } : {}) }, lineNo)
  return true
}

/** Cada crida coneguda: desa la geometria, l'estat o l'operació, o `false` si no s'entén (es compta com a `unknown`). */
const CALLS: Record<string, Call> = {
  CreateFinishedWorkpieceBox: (st, arg) => {
    const { res } = st
    if (!arg.ok(arg.N(1), arg.N(2), arg.N(3))) return false
    res.workpiece = { name: arg.S(0) ?? "", L: arg.N(1), W: arg.N(2), T: arg.N(3) }
    return true
  },
  SelectWorkplane: (st, arg) => {
    st.plane = arg.S(0) ?? st.plane
    return true
  },
  CreatePolyline: (st, arg) => {
    const p = arg.pt(1)
    if (!p) return false
    st.building = st.active = { name: arg.S(0) ?? "", kind: "polyline", start: p, segs: [], closed: false }
    return true
  },
  AddSegmentToPolyline: (st, arg) => {
    const p = arg.pt(0)
    if (!p || !st.building || st.building.kind !== "polyline") return false
    st.building.segs.push({ to: p })
    return true
  },
  AddArc2PointCenterToPolyline: (st, arg) => {
    const p = arg.pt(0)
    const c = arg.pt(2)
    const cw = arg.B(4)
    if (!p || !c || cw === undefined || !st.building || st.building.kind !== "polyline") return false
    st.building.segs.push({ to: p, arc: { c, cw } })
    return true
  },
  AddArc2PointRadiusToPolyline: (st, arg) => {
    const p = arg.pt(0)
    const r = arg.N(2)
    const cw = arg.B(3)
    const big = arg.B(4)
    if (!p || !arg.ok(r) || cw === undefined || big === undefined || !st.building || st.building.kind !== "polyline") return false
    st.building.segs.push({ to: p, arc: { c: arcCenter(lastPoint(st.building), p, r, cw, big), cw } })
    return true
  },
  AddArc3PointsToPolyline: (st, arg) => {
    const p2 = arg.pt(0)
    const p3 = arg.pt(2)
    if (!p2 || !p3 || !st.building || st.building.kind !== "polyline") return false
    const p1 = lastPoint(st.building)
    const c = circumcenter(p1, p2, p3)
    if (!c) st.building.segs.push({ to: p3 })
    else {
      const cross = (p2[0] - p1[0]) * (p3[1] - p2[1]) - (p2[1] - p1[1]) * (p3[0] - p2[0])
      st.building.segs.push({ to: p3, arc: { c, cw: cross < 0 } })
    }
    return true
  },
  ClosePolyline: (st) => {
    if (!st.building || st.building.kind !== "polyline") return false
    if (dist(lastPoint(st.building), st.building.start) > 1e-6) st.building.segs.push({ to: st.building.start })
    st.building.closed = true
    return true
  },
  CreateCircleCenterRadius: (st, arg) => {
    const c = arg.pt(1)
    const r = arg.N(3)
    const cw = arg.B(4) ?? false
    if (!c || !arg.ok(r) || r <= 0) return false
    const s: Pt = [c[0] + r, c[1]]
    const o: Pt = [c[0] - r, c[1]]
    st.building = undefined
    st.active = { name: arg.S(0) ?? "", kind: "circle", start: s, segs: [{ to: o, arc: { c, cw } }, { to: s, arc: { c, cw } }], closed: true, circle: { c, r } }
    return true
  },
  CreateSegment: (st, arg) => {
    const a = arg.pt(1)
    const b = arg.pt(3)
    if (!a || !b) return false
    st.building = undefined
    st.active = { name: arg.S(0) ?? "", kind: "segment", start: a, segs: [{ to: b }], closed: false }
    return true
  },
  CreateToolpath: (st, arg) => {
    const p = arg.pt(1)
    if (!p) return false
    const z = arg.N(3)
    st.building = { name: arg.S(0) ?? "", kind: "toolpath", start: p, segs: [], closed: false, minZ: Number.isFinite(z) ? z : 0, ...(Number.isFinite(z) ? { startZ: z } : {}) }
    // El recorregut és de l'operació d'abans (programa del taller: `CreateRoughFinish` + `CreateToolpath`).
    if (st.lastOp && !st.lastOp.toolpath) st.lastOp.toolpath = st.building
    return true
  },
  AddSegmentToToolpath: toolpathStep,
  AddArc2PointRadiusToToolpath: toolpathStep,
  SetApproachStrategy: (st, arg) => {
    st.approach = { linear: arg.B(0) ?? true, k: Number.isFinite(arg.N(2)) ? arg.N(2) : 0 }
    return true
  },
  ResetApproachStrategy: (st) => {
    st.approach = undefined
    return true
  },
  CreateBidirectionalMillingStrategy: (st, arg) => {
    st.strategy = arg.N(1)
    return true
  },
  CreateDrill: (st, arg, _fn, lineNo) => {
    const p = arg.pt(1)
    const depth = arg.N(3)
    const d = arg.N(4)
    if (!p || !arg.ok(depth, d)) return false
    const toolArg = arg.S(7) ?? "-1"
    st.lastOp = pushOp(st, { kind: "drill", name: arg.S(0) ?? "", toolArg, depth, desc: arg.S(5) ?? "", x: p[0], y: p[1], diameter: d }, lineNo)
    return true
  },
  CreateContour: (st, arg, _fn, lineNo) => {
    const depth = arg.N(1)
    if (!arg.ok(depth)) return false
    const side = arg.N(3) === 0 ? "inside" : "outside"
    const om = arg.N(12)
    st.lastOp = pushOp(st, { kind: "contour", name: arg.S(0) ?? "", toolArg: arg.S(6) ?? "-1", depth, desc: arg.S(4) ?? "", side, ...(st.active ? { path: closedLoop(st.active) } : {}), ...(Number.isFinite(om) && om ? { overMaterial: om } : {}) }, lineNo)
    return true
  },
  CreateContourPocket: (st, arg, _fn, lineNo) => {
    const depth = arg.N(1)
    if (!arg.ok(depth)) return false
    st.lastOp = pushOp(st, { kind: "pocket", name: arg.S(0) ?? "", toolArg: arg.S(4) ?? "-1", depth, desc: arg.S(2) ?? "", side: "inside", ...(st.active ? { path: closedLoop(st.active) } : {}) }, lineNo)
    return true
  },
  CreateRoughFinish: millOp,
  CreateSlot: millOp,
}

/** Una crida: la seva funció (`CALLS`), o `false` si no és coneguda. */
function readCall(st: ParseState, fn: string, args: Arg[], lineNo: number): boolean {
  const call = Object.hasOwn(CALLS, fn) ? CALLS[fn] : undefined
  return call ? call(st, argsOf(args), fn, lineNo) : false
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
    ...(o.kind !== "drill" && st.ball ? { ball: true } : {}),
    ...(o.kind !== "drill" && st.approach ? { approach: st.approach } : {}),
    ...(st.strategy !== undefined && Number.isFinite(st.strategy) ? { maxPass: st.strategy } : {}),
    ...(st.note && small ? { small } : {}),
    ...(passNote && pn && Number(passNote[1]) === Number(pn[1]) ? { pass: { index: Number(passNote[1]), count: Number(passNote[2]) } } : {}),
  }
  // Les estratègies no són modals (manual p58): només per a l'operació següent. El comentari de la peça, també.
  st.strategy = undefined
  if (o.kind !== "drill") {
    st.note = ""
    st.ball = false
  }
  res.ops.push(op)
  return op
}
