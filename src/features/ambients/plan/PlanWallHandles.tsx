import type { PointerEvent as RPointerEvent } from "react"
import type { Wall } from "../../../core/model"
import { C } from "./planStyle"

/** Nanses de la paret seleccionada: els punts de control (corba) i els extrems, que s'arrosseguen. */
export function PlanWallHandles({ selWall, s, onStartCtrl, onStartEnd }: { selWall: Wall; s: number; onStartCtrl: (e: RPointerEvent, w: Wall, c: "c1" | "c2") => void; onStartEnd: (e: RPointerEvent, w: Wall, end: "a" | "b") => void }) {
  const px = (n: number) => n / s
  return (
    <>
      {/* Punts de control de la paret corba seleccionada (com Figma): la línia fins al seu extrem i el rombe, que s'arrossega. */}
      {selWall.curve &&
        (["c1", "c2"] as const).map((c) => {
          const q = selWall.curve![c]
          const from = c === "c1" ? selWall.a : selWall.b
          const r = px(5)
          return (
            <g key={c}>
              <line x1={from[0]} y1={from[1]} x2={q[0]} y2={q[1]} stroke={C.accent} strokeWidth={px(1)} style={{ pointerEvents: "none" }} />
              <rect x={q[0] - r} y={q[1] - r} width={2 * r} height={2 * r} transform={`rotate(45 ${q[0]} ${q[1]})`} fill={C.item} stroke={C.accent} strokeWidth={px(2)} style={{ cursor: "grab" }} onPointerDown={(e) => onStartCtrl(e, selWall, c)} />
            </g>
          )
        })}
      {/* Extrems de la paret seleccionada: s'arrosseguen. */}
      {(["a", "b"] as const).map((end) => (
        <circle key={end} cx={selWall[end][0]} cy={selWall[end][1]} r={px(6)} fill={C.item} stroke={C.accent} strokeWidth={px(2)} style={{ cursor: "grab" }} onPointerDown={(e) => onStartEnd(e, selWall, end)} />
      ))}
    </>
  )
}
