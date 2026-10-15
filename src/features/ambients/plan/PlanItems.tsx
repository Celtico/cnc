import type { PointerEvent as RPointerEvent } from "react"
import { footprintBox, type Ambient, type AmbientItem } from "../../../core/model"
import { isEmptyGeometry, type ItemGeometry } from "../ambientData"
import type { Selection, Tool } from "../planGeom"
import { C } from "./planStyle"

/** Elements (mobles i blocs) del plànol i la caixa del grup seleccionat. */
export function PlanItems({
  ambient,
  geos,
  names,
  selection,
  selectedIds,
  tool,
  s,
  showDetail,
  showLabels,
  onStartItem,
}: {
  ambient: Ambient
  geos: Map<string, ItemGeometry | null>
  names: Map<string, string>
  selection: Selection
  selectedIds: string[]
  tool: Tool
  /** Escala de la vista (px per mm). */
  s: number
  showDetail: boolean
  showLabels: boolean
  onStartItem: (e: RPointerEvent, it: AmbientItem) => void
}) {
  const px = (n: number) => n / s
  return (
    <>
      {/* Elements (mobles i blocs) sota les parets, en vista de dalt. */}
      {ambient.items.map((it) => {
        const g = geos.get(it.id)
        const sel = selectedIds.includes(it.id)
        // Sense geometria (esborrat) o buit (moble nou sense mòduls): requadre discontinu de 600 × 600.
        const ghost = !g || isEmptyGeometry(g)
        const w = ghost ? 600 : g.w, d = ghost ? 600 : g.d
        return (
          <g key={it.id} transform={`translate(${it.x} ${it.y}) rotate(${it.rot})`} style={{ cursor: tool === "select" ? "move" : undefined }} onPointerDown={(e) => onStartItem(e, it)}>
            <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={C.item} fillOpacity={0.92} stroke={sel ? C.accent : C.wall} strokeWidth={px(sel ? 2 : 1)} strokeDasharray={ghost ? `${px(4)} ${px(3)}` : undefined} />
            {g && showDetail && s > 0.04 &&
              g.rects.map((r, i) => <rect key={i} x={r.x0} y={r.z0} width={Math.max(0.1, r.x1 - r.x0)} height={Math.max(0.1, r.z1 - r.z0)} fill="none" stroke={C.line} strokeWidth={px(0.6)} />)}
            {/* El davant: línia gruixuda. */}
            <line x1={-w / 2} y1={d / 2} x2={w / 2} y2={d / 2} stroke={sel ? C.accent : C.wall} strokeWidth={px(3)} />
            {/* El nom (i la mida) només si hi cap a la pantalla: si no, tapaven els veïns i el plànol. */}
            {showLabels && labelFits(names.get(it.id) ?? "", w, d, it.rot, s, 12, 18) && <g transform={`rotate(${-it.rot})`} style={{ pointerEvents: "none" }}>
              <text textAnchor="middle" style={{ fontSize: px(12) }} fill={C.wall} fontWeight={600} y={px(-2)}>
                {names.get(it.id)}
              </text>
              {!ghost && labelFits(`${Math.round(w)} × ${Math.round(d)}`, w, d, it.rot, s, 10.5, 34) && (
                <text textAnchor="middle" style={{ fontSize: px(10.5) }} fill={C.muted} y={px(12)}>
                  {Math.round(w)} × {Math.round(d)}
                </text>
              )}
            </g>}
          </g>
        )
      })}

      {/* Caixa del grup seleccionat (discontínua), com a l'editor. */}
      {(selection?.kind === "group" || selection?.kind === "multi") &&
        (() => {
          const bs = ambient.items.filter((i) => selectedIds.includes(i.id)).flatMap((i) => {
            const g = geos.get(i.id)
            return g ? [isEmptyGeometry(g) ? footprintBox(i.x, i.y, 600, 600, i.rot) : footprintBox(i.x, i.y, g.w, g.d, i.rot)] : []
          })
          if (!bs.length) return null
          const x0 = Math.min(...bs.map((b) => b.x0)), y0 = Math.min(...bs.map((b) => b.y0)), x1 = Math.max(...bs.map((b) => b.x1)), y1 = Math.max(...bs.map((b) => b.y1))
          return <rect x={x0 - px(6)} y={y0 - px(6)} width={x1 - x0 + px(12)} height={y1 - y0 + px(12)} fill="none" stroke={C.accent} strokeWidth={px(1.5)} strokeDasharray={`${px(6)} ${px(4)}`} style={{ pointerEvents: "none" }} />
        })()}
    </>
  )
}

/**
 * El text (horitzontal a la pantalla, de `fontPx`) cap dins de la petjada de l'element (w × d mm, girat `rot` graus) a
 * l'escala `s` (px per mm), amb `minH` px d'alçada com a mínim. L'amplada del text s'estima (≈ 0,55 em per lletra).
 */
function labelFits(text: string, w: number, d: number, rot: number, s: number, fontPx: number, minH: number): boolean {
  const a = (rot * Math.PI) / 180
  const c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a))
  const bw = (w * c + d * sn) * s, bh = (w * sn + d * c) * s
  return bh >= minH && text.length * fontPx * 0.55 <= bw * 1.1
}
