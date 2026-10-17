import type { PlanPt } from "../../../core/model"
import { formatLength, useUnit } from "../../../lib/units"
import type { Tool } from "../planGeom"
import { C } from "./planStyle"

/** Previsualització de les eines: la ploma (punts, tram i nansa), el rectangle de l'habitació i els punts de calibrar. */
export function PlanToolOverlays({
  tool,
  chain,
  cursor,
  penOut,
  penStraight,
  room,
  calib,
  wallThickness,
  s,
}: {
  tool: Tool
  chain: PlanPt[]
  cursor: PlanPt | null
  penOut: PlanPt | null
  penStraight: boolean
  room: { a: PlanPt; b: PlanPt } | null
  calib: PlanPt[]
  wallThickness: number
  s: number
}) {
  const unit = useUnit()
  const px = (n: number) => n / s
  return (
    <>
      {/* Ploma: punts posats i tram de previsualització amb la mida. */}
      {tool === "wall" && chain.length > 0 && (
        <g style={{ pointerEvents: "none" }}>
          {/* El tram que es dibuixa ara (els d'abans ja són parets): corb amb la nansa del darrer punt, recte amb Maj. */}
          {cursor && (() => {
            const last = chain.at(-1)!
            const h = penStraight ? null : penOut
            const d = h ? `M ${last[0]} ${last[1]} C ${last[0] + h[0]} ${last[1] + h[1]} ${cursor[0]} ${cursor[1]} ${cursor[0]} ${cursor[1]}` : `M ${last[0]} ${last[1]} L ${cursor[0]} ${cursor[1]}`
            return <path d={d} fill="none" stroke={C.accent} strokeWidth={wallThickness} strokeOpacity={0.35} />
          })()}
          {/* La nansa del darrer punt (clic i arrossegar, com Figma): la línia i els dos rombes. */}
          {penOut && !penStraight && (() => {
            const last = chain.at(-1)!
            const ends: PlanPt[] = [[last[0] - penOut[0], last[1] - penOut[1]], [last[0] + penOut[0], last[1] + penOut[1]]]
            const r = px(4)
            return (
              <g>
                <line x1={ends[0]![0]} y1={ends[0]![1]} x2={ends[1]![0]} y2={ends[1]![1]} stroke={C.accent} strokeWidth={px(1)} />
                {ends.map((q, i) => (
                  <rect key={i} x={q[0] - r} y={q[1] - r} width={2 * r} height={2 * r} transform={`rotate(45 ${q[0]} ${q[1]})`} fill={C.item} stroke={C.accent} strokeWidth={px(1.5)} />
                ))}
              </g>
            )
          })()}
          {chain.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={px(4)} fill={i === 0 ? C.accent : C.item} stroke={C.accent} strokeWidth={px(1.5)} />
          ))}
          {cursor && (
            <text x={cursor[0] + px(10)} y={cursor[1] - px(10)} style={{ fontSize: px(12) }} fill={C.accentFg} fontWeight={600}>
              {formatLength(Math.round(Math.hypot(cursor[0] - chain.at(-1)![0], cursor[1] - chain.at(-1)![1])), unit)}
            </text>
          )}
        </g>
      )}
      {tool === "wall" && chain.length === 0 && cursor && <circle cx={cursor[0]} cy={cursor[1]} r={px(4)} fill={C.accent} style={{ pointerEvents: "none" }} />}

      {room && (
        <g style={{ pointerEvents: "none" }}>
          <rect x={Math.min(room.a[0], room.b[0])} y={Math.min(room.a[1], room.b[1])} width={Math.abs(room.b[0] - room.a[0])} height={Math.abs(room.b[1] - room.a[1])} fill={C.accent} fillOpacity={0.08} stroke={C.accent} strokeWidth={wallThickness} strokeOpacity={0.4} />
          <text x={(room.a[0] + room.b[0]) / 2} y={(room.a[1] + room.b[1]) / 2} textAnchor="middle" style={{ fontSize: px(13) }} fill={C.accentFg} fontWeight={600}>
            {formatLength(Math.abs(room.b[0] - room.a[0]), unit)} × {formatLength(Math.abs(room.b[1] - room.a[1]), unit)}
          </text>
        </g>
      )}

      {tool === "calibrate" && (
        <g style={{ pointerEvents: "none" }}>
          {calib[0] && cursor && <line x1={calib[0][0]} y1={calib[0][1]} x2={cursor[0]} y2={cursor[1]} stroke={C.accent} strokeWidth={px(2)} strokeDasharray={`${px(6)} ${px(4)}`} />}
          {calib.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={px(5)} fill={C.accent} />
          ))}
        </g>
      )}
    </>
  )
}
