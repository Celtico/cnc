import { roofBox, type Ambient } from "../../../core/model"
import { C } from "./planStyle"

/** La teulada, com als plànols d'arquitecte: el contorn amb el voladís discontinu, el carener i les claraboies. */
export function PlanRoof({ ambient, s }: { ambient: Ambient; s: number }) {
  const px = (n: number) => n / s
  const rb = roofBox(ambient)
  const r = ambient.roof
  if (!rb || !r) return null
  const dash = `${px(8)} ${px(5)}`
  const mx = (rb.x0 + rb.x1) / 2, my = (rb.y0 + rb.y1) / 2
  return (
    <g style={{ pointerEvents: "none" }} fill="none" stroke={C.muted} strokeWidth={px(1)}>
      <rect x={rb.x0} y={rb.y0} width={rb.x1 - rb.x0} height={rb.y1 - rb.y0} strokeDasharray={dash} />
      {r.kind === "gable" && (r.ridge === "x" ? <line x1={rb.x0} y1={my} x2={rb.x1} y2={my} strokeDasharray={dash} /> : <line x1={mx} y1={rb.y0} x2={mx} y2={rb.y1} strokeDasharray={dash} />)}
      {r.kind === "shed" && (r.ridge === "x" ? <line x1={rb.x0} y1={rb.y1} x2={rb.x1} y2={rb.y1} strokeWidth={px(2.5)} /> : <line x1={rb.x1} y1={rb.y0} x2={rb.x1} y2={rb.y1} strokeWidth={px(2.5)} />)}
      {(r.skylights ?? []).map((k, i) => (
        <rect key={i} x={k.x - k.w / 2} y={k.y - k.d / 2} width={k.w} height={k.d} stroke={C.accent} fill={C.accent} fillOpacity={0.12} />
      ))}
    </g>
  )
}
