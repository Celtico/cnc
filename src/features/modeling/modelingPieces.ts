/** Les peces d'un moble de Modelatge i els seus mecanitzats, com els llista l'arbre del Taulell (`ModelingTree`, `PieceInspector`). */
import { grooveKey, HAND_TAG, holeKey, isEmptyEdit, type Composition, type Panel, type PieceEdit } from "../../core/model"
import type { TaulellIconName } from "./taulellIcons"

/** El nom d'un forat al taller, pel que fa (com els anomena el Taulell). */
const HOLE_NAMES: Record<string, string> = { hinge: "Cassoleta", plate: "Placa de frontissa", system32: "Línia de forats", dowel: "Clavilla", cabineo: "Cabineo", screw: "Cargol", leg: "Pota" }
const mm = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")

/** Una línia de mecanitzats: els del mòdul iguals van junts (`drop`, es treuen junts); els fets a mà, un a un (`hand`). */
interface MachiningRow {
  key: string
  label: string
  icon: TaulellIconName
  drop?: string
  hand?: { kind: "holes" | "grooves"; i: number }
}

/** Els mecanitzats d'una peça, agrupats com els llista el Taulell: «Perforació Ø8×12 · 6», «Ranura 8×8». */
export function machiningRows(p: Panel): MachiningRow[] {
  const rows = new Map<string, MachiningRow & { n: number }>()
  const add = (key: string, label: string, icon: TaulellIconName, extra: Partial<MachiningRow>) => {
    const r = rows.get(key)
    if (r) r.n++
    else rows.set(key, { key, label, icon, n: 1, ...extra })
  }
  let hh = 0
  let hg = 0
  for (const h of p.holes) {
    const name = (h.tag && HOLE_NAMES[h.tag]) || "Perforació"
    const icon: TaulellIconName = h.tag === "hinge" ? "cup" : h.tag === "system32" ? "line32" : h.tag === "dowel" ? "dowel" : h.tag === "cabineo" ? "cabineo" : h.tag === "screw" ? "screw" : "hole"
    const label = `${name} Ø${mm(h.diameter)}×${mm(h.depth)}`
    if (h.tag === HAND_TAG) add(`hand:h:${hh}`, `${label} · a mà`, icon, { hand: { kind: "holes", i: hh++ } })
    else add(holeKey(h), label, icon, { drop: holeKey(h) })
  }
  for (const g of p.grooves) {
    const label = `Ranura ${mm(Math.min(g.w, g.h))}×${mm(g.depth)}`
    if (g.tag === HAND_TAG) add(`hand:g:${hg}`, `${label} · a mà`, "groove", { hand: { kind: "grooves", i: hg++ } })
    else add(grooveKey(g), label, "groove", { drop: grooveKey(g) })
  }
  for (const k of p.pockets ?? []) add(`p:${k.depth}`, `Buidat ×${mm(k.depth)}`, "rebate", {})
  for (const c of p.cutouts ?? []) add(`c:${c.kind}`, "Retall", "cut", {})
  return [...rows.values()].map(({ n, ...r }) => ({ ...r, label: n > 1 ? `${r.label} · ${n}` : r.label }))
}

/** El retoc sense aquesta línia de mecanitzats (els del mòdul es treuen; els fets a mà s'esborren). */
export function withoutRow(e: PieceEdit | undefined, r: MachiningRow): PieceEdit {
  const cur = e ?? {}
  if (r.hand) return { ...cur, [r.hand.kind]: (cur[r.hand.kind] ?? []).filter((_, i) => i !== r.hand!.i) }
  if (r.drop) return { ...cur, drop: [...new Set([...(cur.drop ?? []), r.drop])] }
  return cur
}

/** L'id de la peça dins del mòdul (la clau dels retocs, `Module.pieceEdits`): el de la composició és «mòdul:peça». */
export function pieceLocalId(moduleId: string, panelId: string): string {
  return panelId.startsWith(`${moduleId}:`) ? panelId.slice(moduleId.length + 1) : panelId
}

/** Desa (o treu, amb `undefined`) el retoc d'una peça d'un mòdul; `e` pot ser una funció del retoc d'ara. */
export function setPieceEdit(setComp: (f: (c: Composition) => Composition) => void, moduleId: string, localId: string, e: PieceEdit | undefined | ((cur: PieceEdit | undefined) => PieceEdit | undefined)) {
  setComp((c) => ({
    ...c,
    modules: c.modules.map((m) => {
      if (m.id !== moduleId) return m
      const next = typeof e === "function" ? e(m.pieceEdits?.[localId]) : e
      const { [localId]: _old, ...rest } = m.pieceEdits ?? {}
      const all = next && !isEmptyEdit(next) ? { ...rest, [localId]: next } : rest
      return { ...m, pieceEdits: Object.keys(all).length ? all : undefined }
    }),
  }))
}

/** Les peces d'un moble a l'arbre (sense els aparells) i el seu número del Taulell: moble.peça («1.01»). */
export function modulePieces(panels: Panel[], index: number): { panel: Panel; code: string }[] {
  return panels.filter((p) => p.module === index + 1 && p.role !== "hardware").map((panel, k) => ({ panel, code: `${index + 1}.${String(k + 1).padStart(2, "0")}` }))
}
