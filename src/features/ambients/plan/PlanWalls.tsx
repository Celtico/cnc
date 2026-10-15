import type { PointerEvent as RPointerEvent } from "react"
import { wallCorners, wallLength, wallPoints, type Wall } from "../../../core/model"
import { formatLength, useUnit } from "../../../lib/units"
import type { Tool } from "../planGeom"
import { C } from "./planStyle"

/** Les parets del plànol (rectes o corbes); la triada i les de la selecció, marcades. */
export function PlanWalls({ walls, selWall, selectedWallIds, tool, s, onStartWall }: { walls: Wall[]; selWall: Wall | undefined; selectedWallIds: string[]; tool: Tool; s: number; onStartWall: (e: RPointerEvent, w: Wall) => void }) {
  const px = (n: number) => n / s
  return (
    <>
      {walls.map((w) => {
        const sel = selWall?.id === w.id || selectedWallIds.includes(w.id)
        // Paret corba: la Bézier amb el gruix de la paret.
        if (w.curve)
          return (
            <path
              key={w.id}
              d={`M ${w.a[0]} ${w.a[1]} C ${w.curve.c1[0]} ${w.curve.c1[1]} ${w.curve.c2[0]} ${w.curve.c2[1]} ${w.b[0]} ${w.b[1]}`}
              fill="none"
              stroke={sel ? C.accent : C.wall}
              strokeWidth={w.thickness}
              strokeLinecap="square"
              style={{ cursor: tool === "select" ? "move" : undefined }}
              onPointerDown={(e) => onStartWall(e, w)}
            />
          )
        return (
          <polygon
            key={w.id}
            points={wallCorners(w).map((p) => p.join(",")).join(" ")}
            fill={sel ? C.accent : C.wall}
            stroke={sel ? C.accent : C.wall}
            strokeWidth={px(0.5)}
            style={{ cursor: tool === "select" ? "move" : undefined }}
            onPointerDown={(e) => onStartWall(e, w)}
          />
        )
      })}
    </>
  )
}

/** Finestres, portes i vidrieres de les parets. */
export function PlanOpenings({ walls, selWall, tool, s, onStartOpening }: { walls: Wall[]; selWall: Wall | undefined; tool: Tool; s: number; onStartOpening: (e: RPointerEvent, w: Wall, index: number) => void }) {
  const px = (n: number) => n / s
  return (
    <>
      {/* Finestres, portes i vidrieres: el forat de la paret amb el vidre (o la fulla) al mig. S'arrosseguen al llarg de la paret. */}
      {walls.map((w) => {
        if (!w.openings?.length) return null
        const deg = (Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]) * 180) / Math.PI
        const t = w.thickness
        return (
          <g key={`o-${w.id}`} transform={`translate(${w.a[0]} ${w.a[1]}) rotate(${deg})`}>
            {w.openings.map((o, i) => {
              const u0 = o.at - o.w / 2, u1 = o.at + o.w / 2
              return (
                <g key={i} style={{ cursor: tool === "select" ? "ew-resize" : undefined, pointerEvents: tool === "select" ? "auto" : "none" }} onPointerDown={(e) => onStartOpening(e, w, i)}>
                  <rect x={u0} y={-t / 2} width={u1 - u0} height={t} fill="var(--chakra-colors-bg)" stroke={selWall?.id === w.id ? C.accent : C.wall} strokeWidth={px(1)} />
                  {o.kind === "door" ? (
                    <path d={`M ${u0} ${t / 2} L ${u0} ${t / 2 + (u1 - u0)} A ${u1 - u0} ${u1 - u0} 0 0 0 ${u1} ${t / 2}`} fill="none" stroke={C.muted} strokeWidth={px(1)} />
                  ) : (
                    <line x1={u0} y1={0} x2={u1} y2={0} stroke={C.wall} strokeWidth={px(o.kind === "glazing" ? 3 : 1.5)} />
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
    </>
  )
}

/** Mides de les parets (quan hi caben). */
export function PlanWallDims({ walls, s }: { walls: Wall[]; s: number }) {
  const unit = useUnit()
  const px = (n: number) => n / s
  return (
    <>
      {walls.map((w) => {
        const L = wallLength(w)
        if (L * s < 60) return null
        const mid = w.curve ? wallPoints(w, 2)[1]! : null
        const mx = mid ? mid[0] : (w.a[0] + w.b[0]) / 2, my = mid ? mid[1] : (w.a[1] + w.b[1]) / 2
        let ang = (Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]) * 180) / Math.PI
        if (ang > 90 || ang < -90) ang += 180
        const off = w.thickness / 2 + px(10)
        const nx = -Math.sin((ang * Math.PI) / 180) * off, ny = Math.cos((ang * Math.PI) / 180) * off
        return (
          <text key={`l${w.id}`} x={mx - nx} y={my - ny} transform={`rotate(${ang} ${mx - nx} ${my - ny})`} textAnchor="middle" dominantBaseline="middle" fill={C.muted} style={{ fontSize: px(11), pointerEvents: "none" }}>
            {formatLength(Math.round(L), unit)}
          </text>
        )
      })}
    </>
  )
}
