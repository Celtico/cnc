import type { DimLayout, DrawDim } from "./dims"

/**
 * Una cota dels plànols (pla del muntatge, dibuix del generador, vistes dels ferratges, col·locació): línies de
 * referència, línia de cota amb les marques i el valor (al mig; si no hi cap, fora o, amb `shift`, una fila més enfora).
 * Text amb `style={{ fontSize }}` (l'atribut `font-size` el tapa el CSS global) i vora del color del fons perquè es
 * llegeixi a sobre de les línies. Coordenades de l'SVG (y cap avall).
 */
export function DimLine({ d, stroke, fs }: { d: DrawDim; stroke: number; fs: number }) {
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
  const shift = d.shift ?? 0
  let tx: number
  let tz: number
  let anchor: "middle" | "start" | "end" = "middle"
  if (horizontal) {
    if (shift) {
      // Una fila més enfora, centrat (els curts d'una cadena no s'encavalquen).
      tx = (A[0] + B[0]) / 2
      tz = A[1] + pz * shift + (sg > 0 ? fs * 0.95 : -fs * 0.4)
    } else {
      tx = fits ? (A[0] + B[0]) / 2 : Math.max(A[0], B[0]) + fs * 0.4
      tz = A[1] + (fits ? (sg > 0 ? fs * 0.95 : -fs * 0.4) : fs * 0.35)
      if (!fits) anchor = "start"
    }
  } else {
    // Al costat de fora de la línia (el text no es gira).
    tz = (A[1] + B[1]) / 2 + fs * 0.35
    tx = A[0] + px * (sg * fs * 0.35 + shift * 2.2)
    anchor = px * sg > 0 ? "start" : "end"
  }
  const lead = shift && horizontal ? <line x1={(A[0] + B[0]) / 2} y1={A[1]} x2={tx} y2={tz + (sg > 0 ? -fs * 0.85 : fs * 0.15)} strokeWidth={stroke * 0.6} strokeDasharray={`${stroke * 2} ${stroke * 2}`} /> : null
  return (
    <g stroke="var(--chakra-colors-wood-fg)" fill="none">
      <title>{`${d.title}: ${d.label.replace(/^C /, "")} mm`}</title>
      <line x1={d.a[0] + px * gap} y1={d.a[1] + pz * gap} x2={d.a[0] + px * (o + over)} y2={d.a[1] + pz * (o + over)} strokeWidth={stroke * 0.7} />
      <line x1={d.b[0] + px * gap} y1={d.b[1] + pz * gap} x2={d.b[0] + px * (o + over)} y2={d.b[1] + pz * (o + over)} strokeWidth={stroke * 0.7} />
      <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} strokeWidth={stroke} />
      {ticks}
      {lead}
      <text x={tx} y={tz} style={{ fontSize: fs }} textAnchor={anchor} fill="var(--chakra-colors-wood-fg)" stroke="var(--chakra-colors-bg)" strokeWidth={stroke * 3} paintOrder="stroke" fontFamily="inherit" fontWeight="600">
        {d.label}
      </text>
    </g>
  )
}

/** Totes les cotes i etiquetes d'un `layoutDims` (dins d'un SVG en coordenades y cap avall). */
export function DimLayer({ layout, stroke, fs }: { layout: DimLayout; stroke: number; fs: number }) {
  const lfs = fs * 0.8
  return (
    <g data-testid="dims">
      {layout.dims.map((d, i) => (
        <DimLine key={i} d={d} stroke={stroke} fs={fs} />
      ))}
      {layout.labels.map((l, i) => (
        <text key={`l${i}`} x={l.x} y={l.y} style={{ fontSize: lfs }} textAnchor={l.anchor} fill="var(--chakra-colors-fg)" stroke="var(--chakra-colors-bg)" strokeWidth={stroke * 2.5} paintOrder="stroke" fontFamily="inherit" fontWeight="500">
          {l.text}
        </text>
      ))}
    </g>
  )
}
