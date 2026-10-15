import { useMemo } from "react"
import type { Panel } from "../../core/model"
import type { ProjectedFace } from "../../core/photo/camera"
import type { Pt } from "../../core/photo/homography"
import type { Measure, MeasureValue } from "../../core/photo/measure"
import type { PhotoCalibration } from "../../db/db"
import type { DepthResult } from "./calibration"
import { ROLE_FILL } from "./renderComposite"
import type { CalibrationScene } from "./useCalibrationScene"

/** Moble en mode línies: les cares projectades, en polígons dins de l'SVG de la foto. */
export function CabinetFaces({ faces, panels, selectedModule, opacity, stroke }: { faces: ProjectedFace[]; panels: Panel[]; selectedModule: number | null; opacity: number; stroke: number }) {
  // Mòdul seleccionat a l'Editor: translúcid i amb vora taronja (per veure'n l'interior);
  // la resta, normal. El mateix criteri que al 3D.
  const moduleOf = useMemo(() => new Map(panels.map((p) => [p.id, p.module])), [panels])
  const highlightPanel = (id: string) => selectedModule !== null && moduleOf.get(id) === selectedModule
  const dimmedPanel = highlightPanel
  return faces
    .filter((f) => f.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)))
    .map((f, i) => (
      <polygon
        key={i}
        points={f.pts.map(([x, y]) => `${x},${y}`).join(" ")}
        fill={ROLE_FILL[f.role]}
        fillOpacity={opacity * (0.55 + 0.45 * f.facing) * (dimmedPanel(f.panelId) ? 0.35 : 1)}
        stroke={highlightPanel(f.panelId) ? "#f97316" : "#2f1a10"}
        strokeOpacity={Math.min(1, opacity + 0.2) * (dimmedPanel(f.panelId) ? 0.4 : 1)}
        strokeWidth={highlightPanel(f.panelId) ? stroke * 1.8 : stroke}
        strokeLinejoin="round"
      />
    ))
}

/** Marques de calibratge sobre la foto: referència, terra, mesures, punts i eixos de l'origen. */
export function CalibrationMarks({
  cal,
  scene,
  pending,
  depthResult,
  markerR,
  stroke,
  font,
}: {
  cal: PhotoCalibration
  scene: CalibrationScene
  pending: Pt[]
  depthResult: DepthResult | null
  markerR: number
  stroke: number
  font: number
}) {
  const { refOutline, measures, values, axes } = scene
  return (
    <>
    {refOutline && <polygon points={refOutline.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#22c55e" strokeWidth={stroke * 1.5} strokeDasharray={`${stroke * 8} ${stroke * 6}`} />}
    {/* Línia del terra */}
    {cal.floorLine && (
      <g>
        <line x1={cal.floorLine[0][0]} y1={cal.floorLine[0][1]} x2={cal.floorLine[1][0]} y2={cal.floorLine[1][1]} stroke="#16a34a" strokeWidth={stroke * 2.5} strokeLinecap="round" />
        {cal.floorLine.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={markerR * 0.7} fill="#16a34a" stroke="white" strokeWidth={stroke * 1.5} data-floor={i} style={{ cursor: "grab" }} />
        ))}
      </g>
    )}
    {/* Mesures */}
    {measures.map((m) => (
      <MeasureShape key={m.id} measure={m} value={values.find((v) => v.id === m.id)} stroke={stroke} r={markerR * 0.6} font={font} />
    ))}
    {/* Mesura en curs */}
    {pending.length > 0 && (
      <g>
        {pending.length > 1 && <polyline points={pending.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#f59e0b" strokeWidth={stroke * 2} />}
        {pending.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={markerR * 0.6} fill="#f59e0b" stroke="white" strokeWidth={stroke * 1.5} />
        ))}
      </g>
    )}
    {depthResult && (
      <g>
        <circle cx={depthResult.at[0]} cy={depthResult.at[1]} r={markerR * 0.7} fill="#0ea5e9" stroke="white" strokeWidth={stroke * 1.5} />
        <text x={depthResult.at[0]} y={depthResult.at[1] - markerR} textAnchor="middle" fontSize={font} fill="#0ea5e9" stroke="white" strokeWidth={stroke} paintOrder="stroke" fontWeight="bold" fontFamily="system-ui, sans-serif">
          {depthResult.depth} mm ±{Math.round(depthResult.error * 100)} %
        </text>
      </g>
    )}
    {cal.points.map(([x, y], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r={markerR} fill="#22c55e" fillOpacity={0.85} stroke="white" strokeWidth={stroke * 1.5} data-point={i} style={{ cursor: "grab" }} />
        <text x={x} y={y + markerR * 0.4} textAnchor="middle" fontSize={markerR * 1.2} fill="white" fontWeight="bold" pointerEvents="none" fontFamily="system-ui, sans-serif">
          {i + 1}
        </text>
      </g>
    ))}
    {axes && (
      <g fontFamily="system-ui, sans-serif" fontWeight="bold">
        {(
          [
            ["X", "#ef4444"],
            ["Y", "#22c55e"],
            ["Z", "#3b82f6"],
          ] as const
        ).map(([name, color], i) => {
          const end = axes.ends[i]!
          const dx = end[0] - axes.o[0]
          const dy = end[1] - axes.o[1]
          const len = Math.hypot(dx, dy) || 1
          const ux = dx / len
          const uy = dy / len
          const ah = markerR * 1.2
          const head = `${end[0]},${end[1]} ${end[0] - ux * ah - uy * ah * 0.55},${end[1] - uy * ah + ux * ah * 0.55} ${end[0] - ux * ah + uy * ah * 0.55},${end[1] - uy * ah - ux * ah * 0.55}`
          return (
            <g key={name}>
              <line x1={axes.o[0]} y1={axes.o[1]} x2={end[0]} y2={end[1]} stroke="white" strokeWidth={stroke * 5} strokeLinecap="round" pointerEvents="none" />
              <line x1={axes.o[0]} y1={axes.o[1]} x2={end[0]} y2={end[1]} stroke={color} strokeWidth={stroke * 3} strokeLinecap="round" pointerEvents="none" />
              <line x1={axes.o[0] + ux * markerR} y1={axes.o[1] + uy * markerR} x2={end[0]} y2={end[1]} stroke="transparent" strokeWidth={markerR * 1.6} data-axis={i} style={{ cursor: "grab" }} />
              <polygon points={head} fill={color} stroke="white" strokeWidth={stroke} data-axis={i} style={{ cursor: "grab" }} />
              <text x={end[0] + ux * markerR * 1.5} y={end[1] + uy * markerR * 1.5 + markerR * 0.45} textAnchor="middle" fontSize={markerR * 1.4} fill={color} stroke="white" strokeWidth={stroke} paintOrder="stroke" pointerEvents="none">
                {name}
              </text>
            </g>
          )
        })}
        <circle cx={axes.o[0]} cy={axes.o[1]} r={markerR * 0.8} fill="#f97316" stroke="white" strokeWidth={stroke * 1.5} data-origin-center="" style={{ cursor: "grab" }} />
      </g>
    )}
    </>
  )
}

/** Dibuix d'una mesura: línia o rectangle amb els punts arrossegables i el valor. */
function MeasureShape({ measure: m, value, stroke, r, font }: { measure: Measure; value: MeasureValue | undefined; stroke: number; r: number; font: number }) {
  const color = value?.state === "real" ? "#16a34a" : "#f59e0b"
  const label = value
    ? value.total !== null
      ? `${Math.round(value.total)}${value.total2 != null ? ` × ${Math.round(value.total2)}` : ""}`
      : `${value.relative.toFixed(2)}${value.relative2 !== undefined ? ` × ${value.relative2.toFixed(2)}` : ""}`
    : ""
  const cx = m.points.reduce((s, p) => s + p[0], 0) / m.points.length
  const cy = m.points.reduce((s, p) => s + p[1], 0) / m.points.length
  return (
    <g>
      {m.kind === "distance" ? (
        <line x1={m.points[0]![0]} y1={m.points[0]![1]} x2={m.points[1]![0]} y2={m.points[1]![1]} stroke={color} strokeWidth={stroke * 2} />
      ) : (
        <polygon points={m.points.map(([x, y]) => `${x},${y}`).join(" ")} fill={color} fillOpacity={0.08} stroke={color} strokeWidth={stroke * 2} />
      )}
      {m.points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} stroke="white" strokeWidth={stroke * 1.5} data-measure={m.id} data-index={i} style={{ cursor: "grab" }} />
      ))}
      <text x={cx} y={cy - r} textAnchor="middle" fontSize={font} fill={color} stroke="white" strokeWidth={stroke} paintOrder="stroke" fontWeight="bold" fontFamily="system-ui, sans-serif" pointerEvents="none">
        {m.name}: {label}
      </text>
    </g>
  )
}

/** Lupa: la foto ampliada ×2,5 al voltant del punt, desplaçada cap amunt perquè el dit no la tapi. */
export function Lens({ url, at, W, H, r, stroke }: { url: string; at: Pt; W: number; H: number; r: number; stroke: number }) {
  const zoom = 2.5
  const cx = at[0]
  const cy = Math.max(r, at[1] - r * 1.7)
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id="lens-clip">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <g clipPath="url(#lens-clip)">
        <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill="#000" />
        <image href={url} width={W} height={H} transform={`translate(${cx} ${cy}) scale(${zoom}) translate(${-at[0]} ${-at[1]})`} />
        <line x1={cx - r} x2={cx + r} y1={cy} y2={cy} stroke="#f97316" strokeWidth={stroke} />
        <line x1={cx} x2={cx} y1={cy - r} y2={cy + r} stroke="#f97316" strokeWidth={stroke} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="white" strokeWidth={stroke * 2} />
    </g>
  )
}
