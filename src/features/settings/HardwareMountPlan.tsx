import { Box } from "@chakra-ui/react"
import { useId } from "react"
import type { MountPlan, PlanDim, PlanRect } from "../../core/build/hardwareMount"

const ROLE_NAME: Partial<Record<PlanRect["role"], string>> = { door: "Porta", side: "Lateral", flap: "Abatible", grille: "Reixeta", drawerFront: "Front", drawerSide: "Lateral calaix", bottom: "Base", top: "Tapa", shelf: "Prestatge" }
const fmt = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",")

/**
 * El pla del muntatge d'un ferratge (Preferències › Ferratges, «Pla»): vista de dalt amb el tall a l'alçada del forat
 * principal (`mountPlan`, del motor): les peces en secció amb el gruix, els forats (els que el tall travessa, buits; els
 * de sobre i sota, discontinus; els proposats d'un importat sense confirmar, en taronja), el ferratge (el volum del model
 * importat o un de simplificat, discontinu) i les cotes. El davant del moble queda a baix. `compact`: sense cotes ni
 * noms (miniatura de la targeta).
 */
export function HardwareMountPlan({ plan, compact = false }: { plan: MountPlan; compact?: boolean }) {
  const { view } = plan
  const s = Math.max(view.w, view.h)
  const stroke = s / 420
  const fs = s / 30
  const busy = obstacles(plan)
  const hatch = `mount-hatch-${useId().replace(/:/g, "")}`
  return (
    <Box asChild color="fg" w="full" h={compact ? "full" : undefined} style={compact ? undefined : { aspectRatio: `${view.w} / ${view.h}` }} data-testid="hardware-mount-plan">
      <svg viewBox={`${view.x} ${view.z} ${view.w} ${view.h}`} role="img" aria-label={`Pla del muntatge, tall a ${fmt(plan.sectionY)} mm d'alçada`}>
        <defs>
          <pattern id={hatch} width={s / 60} height={s / 60} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={s / 60} stroke="var(--chakra-colors-wood-emphasized)" strokeWidth={stroke * 0.8} />
          </pattern>
        </defs>
        {plan.rects.map((r) => (
          <g key={r.id}>
            <rect x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} fill="var(--chakra-colors-wood-subtle)" stroke="none" />
            <rect x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} fill={`url(#${hatch})`} stroke="currentColor" strokeWidth={stroke * 1.6} />
          </g>
        ))}
        {plan.fittings.map((b, i) => (
          <rect
            key={`f${i}`}
            x={b.x0}
            y={b.z0}
            width={b.x1 - b.x0}
            height={b.z1 - b.z0}
            rx={stroke * 3}
            fill="var(--chakra-colors-gray-solid)"
            fillOpacity={0.12}
            stroke="var(--chakra-colors-fg-muted)"
            strokeWidth={stroke}
            strokeDasharray={b.dashed ? `${stroke * 5} ${stroke * 3}` : undefined}
          />
        ))}
        {plan.holes.map((h, i) => {
          const color = h.proposed ? "var(--chakra-colors-orange-solid)" : "currentColor"
          const fill = h.cut ? (h.proposed ? "var(--chakra-colors-orange-subtle)" : "var(--chakra-colors-bg)") : "none"
          const dash = h.cut ? undefined : `${stroke * 3} ${stroke * 2.5}`
          const sw = h.cut ? stroke * 1.2 : stroke * 0.9
          return h.poly ? (
            <polygon key={`h${i}`} points={h.poly.map(([x, z]) => `${x},${z}`).join(" ")} fill={fill} stroke={color} strokeWidth={sw} strokeDasharray={dash} data-proposed={h.proposed || undefined} />
          ) : h.circle ? (
            <circle key={`h${i}`} cx={h.circle.cx} cy={h.circle.cz} r={h.circle.r} fill={fill} stroke={color} strokeWidth={sw} strokeDasharray={dash} data-proposed={h.proposed || undefined} />
          ) : null
        })}
        {!compact && plan.rects.map((r) => <RectLabel key={`l${r.id}`} r={r} fs={fs} view={view} busy={busy} />)}
        {!compact && plan.dims.map((d, i) => <Dim key={`d${i}`} d={d} stroke={stroke} fs={fs} />)}
      </svg>
    </Box>
  )
}

type Box4 = [number, number, number, number]

/** Caixes ocupades (forats i ferratge): el nom de la peça no hi va a sobre. */
function obstacles(plan: MountPlan): Box4[] {
  const out: Box4[] = plan.fittings.map((b) => [b.x0, b.z0, b.x1, b.z1])
  for (const h of plan.holes) {
    if (h.poly) out.push([Math.min(...h.poly.map((q) => q[0])), Math.min(...h.poly.map((q) => q[1])), Math.max(...h.poly.map((q) => q[0])), Math.max(...h.poly.map((q) => q[1]))])
    else if (h.circle) out.push([h.circle.cx - h.circle.r, h.circle.cz - h.circle.r, h.circle.cx + h.circle.r, h.circle.cz + h.circle.r])
  }
  return out
}
const hits = (a: Box4, list: Box4[]) => list.some((b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1])

/** Nom i gruix de la peça dins del seu rectangle, on es vegi i no tapi cap forat (si no hi cap, res). */
function RectLabel({ r, fs, view, busy }: { r: PlanRect; fs: number; view: MountPlan["view"]; busy: Box4[] }) {
  const name = `${ROLE_NAME[r.role] ?? r.label} · ${fmt(r.thickness)}`
  const w = name.length * fs * 0.5
  const h = fs * 0.9
  // La part de la peça que es veu.
  const x0 = Math.max(r.x0, view.x)
  const x1 = Math.min(r.x1, view.x + view.w)
  const z0 = Math.max(r.z0, view.z)
  const z1 = Math.min(r.z1, view.z + view.h)
  const style = { fontSize: fs * 0.85 }
  if (r.along === "z") {
    if (z1 - z0 < h) return null
    const cz = (z0 + z1) / 2
    // De la dreta cap a l'esquerra.
    for (let end = x1 - fs * 0.5; end - w >= x0 + fs * 0.3; end -= fs * 0.5)
      if (!hits([end - w, cz - h / 2, end, cz + h / 2], busy))
        return (
          <text x={end} y={cz} style={style} textAnchor="end" dominantBaseline="central" fill="var(--chakra-colors-fg)" fontFamily="inherit">
            {name}
          </text>
        )
    return null
  }
  if (x1 - x0 < h) return null
  const cx = (x0 + x1) / 2
  // De dalt cap avall (girat 90°).
  for (let top = z0 + fs * 0.5; top + w <= z1 - fs * 0.3; top += fs * 0.5)
    if (!hits([cx - h / 2, top, cx + h / 2, top + w], busy)) {
      const cz = top + w / 2
      return (
        <text x={cx} y={cz} style={style} textAnchor="middle" dominantBaseline="central" fill="var(--chakra-colors-fg)" fontFamily="inherit" transform={`rotate(-90 ${cx} ${cz})`}>
          {name}
        </text>
      )
    }
  return null
}

/** Una cota: línies de referència, línia de cota amb les marques i el valor (al mig, o fora si no hi cap). */
function Dim({ d, stroke, fs }: { d: PlanDim; stroke: number; fs: number }) {
  const vx = d.b[0] - d.a[0]
  const vz = d.b[1] - d.a[1]
  const len = Math.hypot(vx, vz)
  if (len < 0.05) return null
  const ux = vx / len
  const uz = vz / len
  const px = -uz
  const pz = ux
  const o = d.offset
  const sg = Math.sign(o) || 1
  const A: [number, number] = [d.a[0] + px * o, d.a[1] + pz * o]
  const B: [number, number] = [d.b[0] + px * o, d.b[1] + pz * o]
  const gap = sg * stroke * 4
  const over = sg * stroke * 8
  const tick = fs * 0.32
  const ticks = [A, B].map(([x, z], k) => <line key={k} x1={x - (ux + px) * tick} y1={z - (uz + pz) * tick} x2={x + (ux + px) * tick} y2={z + (uz + pz) * tick} strokeWidth={stroke * 1.4} />)
  const tw = d.label.length * fs * 0.56
  const horizontal = Math.abs(ux) >= Math.abs(uz)
  const fits = len > tw + fs * 0.6
  let tx: number
  let tz: number
  let anchor: "middle" | "start" | "end" = "middle"
  if (horizontal) {
    tx = fits ? (A[0] + B[0]) / 2 : Math.max(A[0], B[0]) + fs * 0.4
    tz = A[1] + (fits ? (sg > 0 ? fs * 0.95 : -fs * 0.4) : fs * 0.35)
    if (!fits) anchor = "start"
  } else {
    // Al costat de fora de la línia (el text no es gira).
    tz = (A[1] + B[1]) / 2 + fs * 0.35
    tx = A[0] + px * sg * fs * 0.35
    anchor = px * sg > 0 ? "start" : "end"
  }
  return (
    <g stroke="var(--chakra-colors-wood-fg)" fill="none">
      <title>{`${d.title}: ${d.label.replace(/^C /, "")} mm`}</title>
      <line x1={d.a[0] + px * gap} y1={d.a[1] + pz * gap} x2={d.a[0] + px * (o + over)} y2={d.a[1] + pz * (o + over)} strokeWidth={stroke * 0.7} />
      <line x1={d.b[0] + px * gap} y1={d.b[1] + pz * gap} x2={d.b[0] + px * (o + over)} y2={d.b[1] + pz * (o + over)} strokeWidth={stroke * 0.7} />
      <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} strokeWidth={stroke} />
      {ticks}
      <text x={tx} y={tz} style={{ fontSize: fs }} textAnchor={anchor} fill="var(--chakra-colors-wood-fg)" stroke="var(--chakra-colors-bg)" strokeWidth={stroke * 3} paintOrder="stroke" fontFamily="inherit" fontWeight="600">
        {d.label}
      </text>
    </g>
  )
}
