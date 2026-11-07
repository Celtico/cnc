import { flatten, type Panel } from "../model"
import { zipStore } from "../file/zip"
import { pieceRefs } from "./refs"

/**
 * Programes per peça per a màquines Homag/Weeke (WoodWOP, `.mpr`) i Holz-Her (NC-HOPS, `.hop`). Un programa per peça amb
 * la cara A amunt (forats de la cara A i passants, forats de cantell, ranures de la cara A i el perfilat del contorn) i, si
 * en té, un altre per a la cara B (la peça girada sobre l'eix X: forats i ranures de la cara B).
 * Marc de la màquina: X pel costat llarg, Y per l'ample, origen a la cantonada de baix a l'esquerra.
 * BETA, com el Maestro: escrit amb la documentació pública dels formats (el mateix que fa el Taulell 3D); els buidats i
 * els talls interiors encara no hi van (surten al LLEGEIX-ME). Cal provar-los a la màquina abans de mecanitzar.
 */

interface WoodwopOptions {
  /** Número d'eina (TNO) del perfilat. */
  profileTool: number
  /** Número d'eina de les ranures. */
  grooveTool: number
  /** Mm que el perfilat i els passants baixen més que el gruix (dins del martir). */
  through: number
}

export const DEFAULT_WOODWOP: WoodwopOptions = { profileTool: 128, grooveTool: 216, through: 0.3 }

type Pt = [number, number]

interface Drill {
  x: number
  y: number
  d: number
  depth: number
  through: boolean
}
interface HDrill {
  x: number
  y: number
  /** Alçada des de la cara de sota de la màquina. */
  z: number
  d: number
  depth: number
  dir: "XP" | "XM" | "YP" | "YM"
}
interface Groove {
  a: Pt
  b: Pt
  w: number
  depth: number
}

/** El que fa un programa: la peça en el marc de la màquina. */
interface PieceProgram {
  L: number
  W: number
  T: number
  drills: Drill[]
  hdrills: HDrill[]
  grooves: Groove[]
  /** Contorn antihorari (només a la cara A). */
  contour: Pt[] | null
}

const n3 = (v: number): string => {
  const s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/\.?0+$/, "")
  return s === "-0" || s === "" ? "0" : s
}

/** Programa de la cara `side` d'una peça. */
function pieceProgram(p: Panel, side: "A" | "B"): PieceProgram {
  const turn = p.width > p.length
  const L = Math.max(p.length, p.width), W = Math.min(p.length, p.width), T = p.thickness
  // Local → màquina: girada 90° si l'ample és el costat llarg; cara B, emmirallada en Y (la peça es gira sobre X).
  const map = (x: number, y: number): Pt => {
    const [u, v] = turn ? [y, p.length - x] : [x, y]
    return side === "B" ? [u, W - v] : [u, v]
  }
  const drills: Drill[] = []
  const hdrills: HDrill[] = []
  for (const h of p.holes) {
    if (h.face === "edge") {
      if (side !== "A") continue
      const [x, y] = map(h.x, h.y)
      // Direcció cap a dins de la peça, des del cantell on és.
      const inward: Record<string, Pt> = { left: [1, 0], right: [-1, 0], bottom: [0, 1], top: [0, -1] }
      const [dx, dy] = inward[h.edge ?? "left"]!
      const [x2, y2] = map(h.x + dx, h.y + dy)
      const du = x2 - x, dv = y2 - y
      const dir = Math.abs(du) > Math.abs(dv) ? (du > 0 ? "XP" : "XM") : dv > 0 ? "YP" : "YM"
      hdrills.push({ x, y, z: T / 2, d: h.diameter, depth: h.depth, dir })
      continue
    }
    const through = h.depth >= T - 0.01
    if (through ? side !== "A" : h.face !== side) continue
    const [x, y] = map(h.x, h.y)
    drills.push({ x, y, d: h.diameter, depth: h.depth, through })
  }
  const grooves: Groove[] = []
  for (const g of p.grooves) {
    if (g.face !== side) continue
    const a = map(g.x, g.y), b = map(g.x + g.w, g.y + g.h)
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1])
    const alongX = x1 - x0 >= y1 - y0
    grooves.push(
      alongX
        ? { a: [x0, (y0 + y1) / 2], b: [x1, (y0 + y1) / 2], w: y1 - y0, depth: g.depth }
        : { a: [(x0 + x1) / 2, y0], b: [(x0 + x1) / 2, y1], w: x1 - x0, depth: g.depth },
    )
  }
  let contour: Pt[] | null = null
  if (side === "A") {
    const local: Pt[] = p.outline ? flatten(p.outline).map(([x, y]) => [x, y]) : [[0, 0], [p.length, 0], [p.length, p.width], [0, p.width]]
    contour = local.map(([x, y]) => map(x, y))
    const area = contour.reduce((a, q, i) => {
      const r = contour![(i + 1) % contour!.length]!
      return a + q[0] * r[1] - r[0] * q[1]
    }, 0)
    if (area < 0) contour.reverse()
  }
  return { L, W, T, drills, hdrills, grooves, contour }
}

/** Té feina per a la cara B (forats cecs o ranures de la cara B). */
function needsFaceB(p: Panel): boolean {
  return p.holes.some((h) => h.face === "B" && h.depth < p.thickness - 0.01) || p.grooves.some((g) => g.face === "B")
}

/** El contorn començant pel mig del costat més llarg i tancat al mateix punt (entrada i sortida en rampa). */
function contourFromLongest(c: Pt[]): Pt[] {
  let li = 0, ll = 0
  c.forEach((q, i) => {
    const r = c[(i + 1) % c.length]!
    const l = Math.hypot(r[0] - q[0], r[1] - q[1])
    if (l > ll) {
      ll = l
      li = i
    }
  })
  const A = c[li]!, B = c[(li + 1) % c.length]!
  const M: Pt = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]
  return [M, ...c.slice(li + 1), ...c.slice(0, li + 1), M]
}

/* ---------- WoodWOP (.mpr) ---------- */

function toMpr(pg: PieceProgram, opt: WoodwopOptions, name: string): string {
  const { L, W, T } = pg
  const out: string[] = []
  const E = (...s: string[]) => out.push(...s)
  E("[H", 'VERSION="4.0 Alpha"', 'HP="1"', 'IN="0"', 'GX="1"', 'BFS="1"', 'GY="0"', 'GXY="0"', 'UP="0"', 'FM="1"', 'FW="200"', 'ZS="20"', 'HS="0"', 'OP="1"', 'MAT="WEEKE"', 'DN="STANDARD"', 'INCH="0"', 'VIEW="NOMIRROR"', 'ANZ="1"', 'BES="0"', 'ENT="0"')
  E(`_BSX=${L.toFixed(6)}`, `_BSY=${W.toFixed(6)}`, `_BSZ=${T.toFixed(6)}`, "_FNX=0.000000", "_FNY=0.000000", "_RNX=0.000000", "_RNY=0.000000", "_RNZ=0.000000", `_RX=${L.toFixed(6)}`, `_RY=${W.toFixed(6)}`, "")
  E("[001", `L="${n3(L)}"`, 'KM="Laenge in X"', `B="${n3(W)}"`, 'KM="Breite in Y"', `D="${n3(T)}"`, 'KM="Dicke in Z"', "")
  const pts = pg.contour ? contourFromLongest(pg.contour) : null
  if (pts) {
    E("]1", "$E0", "KP ", `X=${n3(pts[0]![0])}`, `Y=${n3(pts[0]![1])}`, "Z=0.0", "KO=00", `.X=${pts[0]![0].toFixed(6)}`, `.Y=${pts[0]![1].toFixed(6)}`, ".Z=0.000000", ".KO=0", "")
    pts.slice(1).forEach((q, i) => {
      const pr = pts[i]!
      let wi = Math.atan2(q[1] - pr[1], q[0] - pr[0])
      if (wi < 0) wi += 2 * Math.PI
      E(`$E${i + 1}`, "KL ", `X=${n3(q[0])}`, `Y=${n3(q[1])}`, `.X=${q[0].toFixed(6)}`, `.Y=${q[1].toFixed(6)}`, ".Z=0.000000", `.WI=${wi.toFixed(6)}`, ".WZ=0.000000", "")
    })
  }
  E("<100 \\WerkStck\\", 'LA="L"', 'BR="B"', 'DI="D"', 'FNX="0"', 'FNY="0"', 'AX="0"', 'AY="0"', `KM="${name.replace(/"/g, "'")}"`, "")
  for (const d of pg.drills) {
    E("<102 \\BohrVert\\", `XA="${n3(d.x)}"`, `YA="${n3(d.y)}"`, 'BM="LS"', `TI="${n3(d.through ? T + opt.through : d.depth)}"`, `DU="${n3(d.d)}"`, 'AN="1"', 'MI="0"', 'S_="1"', 'AB="0"', 'WI="0"', 'ZT="0"', 'RM="0"', 'VW="0"', 'HP="0"', 'SP="0"', 'YVE="0"', 'KAT="Bohren vertikal"', 'MNM="Vertikale Bohrung"', 'ORI="1"', "")
  }
  for (const h of pg.hdrills) {
    E("<103 \\BohrHoriz\\", `XA="${n3(h.x)}"`, `YA="${n3(h.y)}"`, `ZA="${n3(h.z)}"`, `DU="${n3(h.d)}"`, `TI="${n3(h.depth)}"`, `BM="${h.dir}"`, 'AN="1"', 'AB="0"', 'WI="0"', 'KAT="Horizontalbohrung"', 'MNM="Horizontalbohrung"', 'ORI="1"', "")
  }
  for (const g of pg.grooves) {
    E("<109 \\Nuten\\", `XA="${n3(g.a[0])}"`, `YA="${n3(g.a[1])}"`, `XE="${n3(g.b[0])}"`, `YE="${n3(g.b[1])}"`, `NB="${n3(g.w)}"`, `TI="${n3(g.depth)}"`, 'RK="NOWRK"', `TNO="${opt.grooveTool}"`, 'TV="0"', 'MV="GL"', 'KAT="Nut"', 'MNM="Nut"', 'ORI="1"', "")
  }
  if (pts) {
    E("<105 \\Konturfraesen\\", 'EA="1:0"', 'MDA="SEN"', 'STUFEN="0"', 'BL="0"', 'OSZI="0"', 'OSZVS="0"', 'ZSTART="0"', 'ANZZST="0"', 'RK="WRKR"', 'EE="1:0"', 'MDE="SEN_AB"', 'EM="1"', 'RI="1"', `TNO="${opt.profileTool}"`, 'SM="0"', 'S_="STANDARD"', 'F_="STANDARD"', 'AB="0"', 'AF="0"', 'VLS="0"', 'VLE="0"', `ZA="${n3(-opt.through)}"`, 'HP="0"', 'SP="0"', 'YVE="0"', 'WW="1,2,3"', 'ASG="2"', 'KG="0"', 'RP="STANDARD"', 'RSEL="0"', 'RWID="0"', 'KAT="Fräsen"', `MNM="Perfilat ${name.replace(/"/g, "'")}"`, 'MX="0"', 'MY="0"', 'MZ="0"', 'MXF="1"', 'MYF="1"', 'MZF="1"', "")
  }
  E("!")
  return out.join("\r\n") + "\r\n"
}

/* ---------- NC-HOPS (.hop) ---------- */

function toHop(pg: PieceProgram, opt: WoodwopOptions, name: string): string {
  const { L, W, T } = pg
  const o: string[] = []
  const E = (...s: string[]) => o.push(...s)
  const nm = name.replace(/'/g, "")
  E(";MAKROTYP=0", ";INSTVERSION=", ";EXEVERSION=", ";BILD=", ";INFO=", ";WZGV=HOLZHER", ";WZGVCONFIG=", ";MASCHINE=HOLZHER", ";NCNAME=", `;KOMMENTAR=${nm}`)
  E(`;DX=${n3(L)}`, `;DY=${n3(W)}`, `;DZ=${n3(T)}`, ";DIALOGDLL=Dialoge.Dll", ";DIALOGPROC=StandardFormAnzeigen", ";DIALOGKIND=0", ";AUTOSCRIPTSTART=1", ";BUTTONBILD=", ";DIMENSION_UNIT=0")
  E("VARS", `   DX := ${n3(L)};*VAR*Llarg`, `   DY := ${n3(W)};*VAR*Ample`, `   DZ := ${n3(T)};*VAR*Gruix`)
  E("START", `Fertigteil (DX,DY,DZ,0,0,0,0,0,'${nm}',0,0,0)`)
  if (pg.drills.length || pg.hdrills.length) {
    E(";$F$Forats", "WZB (501,_VE,_V,_VA,_SD,_ANF,'51')")
    for (const d of pg.drills) E(`Bohrung (${n3(d.x)},${n3(d.y)},${n3(d.d)}mm,${n3(-(d.through ? T + opt.through : d.depth))},${d.d > 10 ? 30 : 10},0,0,0,0,0,0,0)`)
    const ang = { XP: 0, YP: 90, XM: 180, YM: 270 }
    for (const h of pg.hdrills) E(`HorzB (${n3(h.x)},${n3(h.y)},${n3(-(T - h.z))},${n3(h.d)},${n3(h.depth)},0,0,${ang[h.dir]},0,2,0,0)`)
  }
  if (pg.grooves.length) {
    E(";$F$Ranures", `WZF (${opt.grooveTool},_VE,_V,_VA,_SD,_ANF,'1')`)
    for (const g of pg.grooves) {
      E(`SP (${n3(g.a[0])},${n3(g.a[1])},${n3(-g.depth)},0,0,_ANF,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)`, `G01 (${n3(g.b[0])},${n3(g.b[1])},0,0,0,2)`, "EP (0,_ANF,0)")
    }
  }
  if (pg.contour) {
    const pts = contourFromLongest(pg.contour)
    E(";$F$Perfilat", `WZF (${opt.profileTool},_VE,_V,_VA,_SD,_ANF,'1')`)
    E(`SP (${n3(pts[0]![0])},${n3(pts[0]![1])},${n3(-(T + opt.through))},2,0,_ANF,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)`)
    for (const q of pts.slice(1)) E(`G01 (${n3(q[0])},${n3(q[1])},0,0,0,2)`)
    E("EP (0,_ANF,0)")
  }
  E("CALL HH_Park ( VAL PARK:=11,X:=0,Y:=0)")
  return o.join("\r\n") + "\r\n"
}

/* ---------- Exportació ---------- */

interface WoodwopExport {
  files: { name: string; text: string }[]
  programs: number
  faceB: string[]
  warnings: string[]
}

const asciiName = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[·×]/g, "-")
    .replace(/[^A-Za-z0-9 ._-]/g, "")
    .replace(/\s+/g, "_")
    .trim()

/** Tots els programes d'un moble (`format`: WoodWOP o NC-HOPS) i un LLEGEIX-ME.txt. */
export function toWoodwop(panels: Panel[], format: "mpr" | "hop", opts: { project: string; options?: WoodwopOptions }): WoodwopExport {
  const opt = opts.options ?? DEFAULT_WOODWOP
  const refs = pieceRefs(panels)
  const files: { name: string; text: string }[] = []
  const faceB: string[] = []
  const warnings: string[] = []
  const write = format === "mpr" ? toMpr : toHop
  for (const p of panels) {
    if (p.role === "hardware") continue
    const ref = refs.get(p.id) ?? p.id
    const base = asciiName(ref) || "peca"
    files.push({ name: `${base}.${format}`, text: write(pieceProgram(p, "A"), opt, `${ref} ${p.label}`) })
    if (needsFaceB(p)) {
      faceB.push(ref)
      files.push({ name: `${base}Volt.${format}`, text: write(pieceProgram(p, "B"), opt, `${ref} ${p.label} (cara B)`) })
    }
    const missing = [p.pockets?.length && `${p.pockets.length} buidats`, p.cutouts?.length && `${p.cutouts.length} talls interiors`].filter(Boolean)
    if (missing.length) warnings.push(`${ref} (${p.label}): ${missing.join(" i ")} no van al programa; fes-los a mà.`)
  }
  const programs = files.length
  const machine = format === "mpr" ? "WoodWOP (Homag / Weeke)" : "NC-HOPS (Holz-Her)"
  const readme = [
    `${opts.project} · programes ${machine}`,
    "",
    `${programs} programes: un per peça amb la cara A amunt (forats, forats de cantell, ranures i perfilat) i, si cal, «<ref>Volt» per a la cara B (la peça girada sobre l'eix X).`,
    `Eines: perfilat ${opt.profileTool}, ranures ${opt.grooveTool}. Els passants i el perfilat baixen ${n3(opt.through)} mm més que el gruix.`,
    "BETA: revisa'ls al programa de la màquina abans de mecanitzar.",
    ...(warnings.length ? ["", "Avisos:", ...warnings.map((w) => `- ${w}`)] : []),
  ]
  files.push({ name: "LLEGEIX-ME.txt", text: "﻿" + readme.join("\r\n") + "\r\n" })
  return { files, programs, faceB, warnings }
}

/** ZIP dels programes (en Latin-1, com els llegeixen les màquines; el LLEGEIX-ME en UTF-8). */
export function woodwopZip(x: WoodwopExport, when?: Date): Uint8Array {
  const latin1 = (s: string) => Uint8Array.from(s, (c) => (c.charCodeAt(0) < 256 ? c.charCodeAt(0) : 63))
  return zipStore(x.files.map((f) => ({ name: f.name, data: f.name.endsWith(".txt") ? new TextEncoder().encode(f.text) : latin1(f.text) })), when)
}
