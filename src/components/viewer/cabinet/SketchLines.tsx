import { Html, Line } from "@react-three/drei"
import { Fragment, type CSSProperties } from "react"
import type { SketchLine } from "../facePick"
import type { Vec3 } from "../../../core/model"
import { S } from "./constants"

const COLOR: Record<SketchLine["tone"], string> = { sketch: "#1971c2", selected: "#e8590c", draft: "#2f9e44" }
const at = (p: Vec3): [number, number, number] => [p[0] * S, p[1] * S, p[2] * S]
const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
/** L'etiqueta amb què es farà (fons clar, lletra de màquina, com el Taulell). */
const TAG: CSSProperties = { whiteSpace: "nowrap", font: "12px ui-monospace, monospace", padding: "3px 8px", borderRadius: 4, background: "rgba(245,245,240,0.92)", color: "#1a222b" }
/** La mida al mig d'una cota (la pastilla taronja del làser del Taulell). */
const PILL: CSSProperties = { whiteSpace: "nowrap", font: "600 13px ui-monospace, monospace", padding: "3px 9px", borderRadius: 4, background: "#e8590c", color: "#fff" }

function Label({ p, style, children }: { p: Vec3; style: CSSProperties; children: string }) {
  return (
    <Html position={at(p)} center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
      <div style={style}>{children}</div>
    </Html>
  )
}

/** Un punt de mida fixa a la pantalla (els «puntets» dels caps de la mida del Taulell). */
function Dot({ p, color }: { p: Vec3; color: string }) {
  return (
    <Html position={at(p)} center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
      <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, border: "1.5px solid #fff", boxShadow: "0 0 2px rgba(0,0,0,0.4)" }} />
    </Html>
  )
}

/**
 * Els croquis de Modelatge (com les línies de l'Esbós del Taulell), per sobre de les peces; els punts sols, una boleta.
 * Les mides (làser, mesurar): un punt a cada cap, la distància al mig i, si en té, l'etiqueta de què es mesura al final.
 */
export function SketchLines({ lines }: { lines: SketchLine[] }) {
  return (
    <>
      {lines.map((l, i) => {
        if (l.box) {
          const c = mid(l.box.min, l.box.max)
          return (
            <Fragment key={i}>
              <mesh position={at(c)} renderOrder={19} raycast={() => null}>
                <boxGeometry args={[(l.box.max[0] - l.box.min[0]) * S, (l.box.max[1] - l.box.min[1]) * S, (l.box.max[2] - l.box.min[2]) * S]} />
                <meshBasicMaterial color={COLOR.draft} transparent opacity={0.45} depthWrite={false} />
              </mesh>
              {l.label && <Label p={c} style={{ ...TAG, transform: "translateY(-28px)" }}>{l.label}</Label>}
            </Fragment>
          )
        }
        if (l.pts.length < 2) return l.pts.map((p, k) => <Dot key={`${i}-${k}`} p={p} color={COLOR[l.tone]} />)
        const [a, b] = [l.pts[0]!, l.pts[l.pts.length - 1]!]
        const mm = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
        return (
          <Fragment key={i}>
            <Line points={(l.closed ? [...l.pts, l.pts[0]!] : l.pts).map(at)} color={COLOR[l.tone]} lineWidth={l.measure ? 2 : l.tone === "sketch" ? 2 : 3} depthTest={false} renderOrder={20} />
            {l.measure && (
              <>
                <Dot p={a} color={COLOR[l.tone]} />
                <Dot p={b} color={COLOR[l.tone]} />
                <Label p={mid(a, b)} style={PILL}>{`${String(Math.round(mm * 10) / 10).replace(".", ",")} mm`}</Label>
                {l.label && <Label p={b} style={{ ...TAG, transform: "translate(50%, 16px)" }}>{l.label}</Label>}
              </>
            )}
          </Fragment>
        )
      })}
    </>
  )
}
