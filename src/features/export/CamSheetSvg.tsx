import { Fragment, type PointerEvent } from "react"
import { DimLine } from "../../components/DimLine"
import { approachSegment, type CamOp, type CamRow, type Pt } from "../../core/export/xcsPreview"
import { colorFor, svgPath, token, type CamSheetView } from "./camDrawing"
import type { CamInspection, CamTarget } from "./camInspect"

export type Zoom = "1" | "2" | "4"

/**
 * El dibuix d'un programa: tauler, peces, recorreguts de les eines, forats, sentits, rampes, refs i ordre. Passar el
 * ratolí per una peça o una operació (o tocar-la) la ressalta amb les seves cotes (`insp`, de `camInspect`).
 */
export function CamSheetSvg({
  view,
  file,
  cw,
  zoom,
  band,
  order,
  selRow,
  target,
  insp,
  onHover,
  onPick,
}: {
  view: CamSheetView
  file: string
  cw: number
  zoom: Zoom
  band: boolean
  order: boolean
  selRow: CamRow | null
  target: CamTarget | null
  insp: CamInspection | null
  onHover: (t: CamTarget | null) => void
  onPick: (t: CamTarget | null) => void
}) {
  const { preview: p } = view
  const L = p.workpiece?.L ?? 1000
  const W = p.workpiece?.W ?? 1000
  const pad = Math.max(L, W) * 0.015
  const vw = L + 2 * pad
  const vh = W + 2 * pad
  const svgW = cw * Number(zoom)
  const scale = svgW / vw
  /** Píxels de pantalla → mm del dibuix. */
  const px = (n: number) => n / scale
  const Y = (y: number) => W - y
  const top = p.ops.filter((o) => o.plane === "Top")
  const selected = new Set(selRow?.ops.map((o) => o.n) ?? [])
  if (target?.kind === "op") selected.add(target.n)
  const activePart = target?.kind === "part" ? p.parts.find((q) => q.ref === target.ref) : undefined
  /** Zona per inspeccionar: el ratolí la mostra en passar-hi; tocar-la (o clicar) la deixa fixada. */
  const hit = (t: CamTarget) => ({
    onPointerEnter: (e: PointerEvent) => e.pointerType !== "touch" && onHover(t),
    onPointerLeave: (e: PointerEvent) => e.pointerType !== "touch" && onHover(null),
    onClick: () => onPick(t),
    style: { cursor: "pointer" },
  })
  const fontPx = 10

  const drillR = (o: CamOp) => Math.max((o.diameter ?? 0) / 2, px(2.5))
  const ramp = (o: CamOp) => {
    const d = view.draws.get(o.n)
    const w = view.widths.get(o.n)
    if (!o.approach || !d || !w) return null
    return approachSegment(d.centre, o.approach.k * (w / 2))
  }
  const arrow = (a: Pt, b: Pt, color: string, key: string) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const ux = (b[0] - a[0]) / l
    const uy = (b[1] - a[1]) / l
    const s = px(7)
    const q = px(4)
    const base: Pt = [b[0] - ux * s, b[1] - uy * s]
    const pts: Pt[] = [b, [base[0] - uy * q, base[1] + ux * q], [base[0] + uy * q, base[1] - ux * q]]
    return (
      <g key={key}>
        <line x1={a[0]} y1={Y(a[1])} x2={b[0]} y2={Y(b[1])} stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d={svgPath(pts, true, W)} fill={color} />
      </g>
    )
  }
  /** Sentit d'un contorn o tall: una punta al mig del primer tram prou llarg de la geometria. */
  const direction = (o: CamOp, color: string) => {
    const d = view.draws.get(o.n)
    if (o.kind !== "contour" || !d?.closed || d.outline.length < 2) return null
    for (let i = 0; i < d.outline.length; i++) {
      const a = d.outline[i]!
      const b = d.outline[(i + 1) % d.outline.length]!
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (l < px(12)) continue
      const ux = (b[0] - a[0]) / l
      const uy = (b[1] - a[1]) / l
      const tip: Pt = [(a[0] + b[0]) / 2 + ux * px(4), (a[1] + b[1]) / 2 + uy * px(4)]
      const s = px(8)
      const q = px(4)
      const base: Pt = [tip[0] - ux * s, tip[1] - uy * s]
      const pts: Pt[] = [tip, [base[0] - uy * q, base[1] + ux * q], [base[0] + uy * q, base[1] - ux * q]]
      return <path key={`s${o.n}`} d={svgPath(pts, true, W)} fill={color} />
    }
    return null
  }
  const anchor = (o: CamOp): Pt | null => {
    if (o.kind === "drill") return [o.x ?? 0, o.y ?? 0]
    const d = view.draws.get(o.n)
    return d?.centre[0] ?? d?.outline[0] ?? null
  }
  /** Números d'ordre al començament de cada fila; els que cauen al mateix lloc (passades), junts: «289·302·318». */
  const orderMarks = (rows: typeof view.rows) => {
    const marks: { at: Pt; label: string }[] = []
    for (const r of rows) {
      const o = r.ops[0]!
      const a = o.plane === "Top" ? anchor(o) : null
      if (!a) continue
      const same = marks.find((m) => Math.hypot(m.at[0] - a[0], m.at[1] - a[1]) < px(6))
      if (same) same.label += `·${r.from}`
      else marks.push({ at: a, label: String(r.from) })
    }
    return marks
  }

  return (
    <svg width={svgW} height={(svgW * vh) / vw} viewBox={`${-pad} ${-pad} ${vw} ${vh}`} style={{ display: "block" }} role="img" aria-label={`Programa ${file}`}>
      {/* Tauler i marge que no s'aprofita. */}
      <rect x={0} y={0} width={L} height={W} onClick={() => onPick(null)} fill={token("bg.panel")} stroke={token("fg.muted")} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {p.edgeTrim ? <rect x={p.edgeTrim} y={p.edgeTrim} width={L - 2 * p.edgeTrim} height={W - 2 * p.edgeTrim} fill="none" stroke={token("fg.subtle")} strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
      {/* Peces (les petites, en groc). */}
      {p.parts.map((q) => {
        const out = view.outlines.get(q.ref)
        const small = view.small.has(q.ref)
        const fill = small ? token("yellow.subtle") : token("wood.subtle")
        // Les petites, amb la vora groga discontínua (es distingeix també en mode fosc).
        const stroke = small ? token("yellow.solid") : token("wood.fg")
        const line = { stroke, strokeOpacity: small ? 0.9 : 0.4, strokeWidth: small ? 1.5 : 1, strokeDasharray: small ? "5 3" : undefined, vectorEffect: "non-scaling-stroke" as const }
        return out ? <path key={q.ref} d={svgPath(out, true, W)} fill={fill} {...line} /> : <rect key={q.ref} x={q.x} y={Y(q.y + q.h)} width={q.w} height={q.h} fill={fill} {...line} />
      })}
      {/* Franja que treu l'eina (Ø) al llarg del centre de l'eina. */}
      {band &&
        top.map((o) => {
          const d = view.draws.get(o.n)
          if (!d) return null
          const c = colorFor(view, o)
          return (
            <Fragment key={`b${o.n}`}>
              {d.fill && <path d={svgPath(d.outline, true, W)} fill={c} fillOpacity={0.22} />}
              {d.width && d.centre.length > 1 ? (
                <path d={svgPath(d.centre, d.closed, W)} fill="none" stroke={c} strokeOpacity={0.28} strokeWidth={d.width} strokeLinejoin="round" strokeLinecap="round" />
              ) : null}
            </Fragment>
          )
        })}
      {/* Geometria del fitxer i centre de l'eina (discontinu). */}
      {top.map((o) => {
        const d = view.draws.get(o.n)
        if (!d) return null
        const c = colorFor(view, o)
        const on = selected.has(o.n)
        return (
          <Fragment key={`g${o.n}`}>
            <path d={svgPath(d.outline, d.closed, W)} fill="none" stroke={on ? token("fg") : c} strokeWidth={on ? 2.5 : 1.25} vectorEffect="non-scaling-stroke" />
            {d.centre !== d.outline && d.centre.length > 1 && <path d={svgPath(d.centre, d.closed, W)} fill="none" stroke={c} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          </Fragment>
        )
      })}
      {/* Forats. */}
      {top.map((o) =>
        o.kind === "drill" ? (
          <circle key={`d${o.n}`} cx={o.x} cy={Y(o.y ?? 0)} r={drillR(o)} fill={colorFor(view, o)} stroke={selected.has(o.n) ? token("fg") : "none"} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        ) : null,
      )}
      {/* Sentit de cada contorn i tall (horari / antihorari: el tipus de fresat). */}
      {top.map((o) => direction(o, colorFor(view, o)))}
      {/* Entrades en rampa. */}
      {top.map((o) => {
        const r = ramp(o)
        return r ? arrow(r[0], r[1], colorFor(view, o), `r${o.n}`) : null
      })}
      {/* Refs de les peces (només si hi caben). */}
      {p.parts.map((q) => {
        const fs = px(fontPx)
        const tw = q.ref.length * fs * 0.62
        if (q.w < tw + px(6) || q.h < fs * 1.6) return null
        return (
          <text key={`t${q.ref}`} x={q.cx ?? q.x + q.w / 2} y={Y(q.cy ?? q.y + q.h / 2)} textAnchor="middle" dominantBaseline="central" fill={token("fg")} stroke={token("bg.panel")} strokeWidth={px(3)} strokeLinejoin="round" style={{ fontFamily: "inherit", fontSize: fs, paintOrder: "stroke" }}>
            {q.ref}
          </text>
        )
      })}
      {/* Peça inspeccionada. */}
      {activePart &&
        (insp?.outline ? (
          <path d={svgPath(insp.outline, true, W)} fill="none" stroke={token("fg")} strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        ) : (
          <rect x={activePart.x} y={Y(activePart.y + activePart.h)} width={activePart.w} height={activePart.h} fill="none" stroke={token("fg")} strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        ))}
      {/* Zones per inspeccionar: les peces a sota, les operacions (amb un gruix mínim per encertar-les) a sobre. */}
      <g fill="transparent" stroke="transparent">
        {p.parts.map((q) => (
          <rect key={`h${q.ref}`} x={q.x} y={Y(q.y + q.h)} width={q.w} height={q.h} pointerEvents="fill" {...hit({ kind: "part", ref: q.ref })} />
        ))}
        {top.map((o) => {
          if (o.kind === "drill") return <circle key={`h${o.n}`} cx={o.x} cy={Y(o.y ?? 0)} r={Math.max(drillR(o), px(6))} pointerEvents="fill" {...hit({ kind: "op", n: o.n })} />
          const d = view.draws.get(o.n)
          if (!d) return null
          const pts = d.centre.length > 1 ? d.centre : d.outline
          return <path key={`h${o.n}`} d={svgPath(pts, d.closed, W)} fill={d.fill ? "transparent" : "none"} strokeWidth={Math.max(d.width ?? 0, px(10))} strokeLinejoin="round" strokeLinecap="round" pointerEvents={d.fill ? "visible" : "stroke"} {...hit({ kind: "op", n: o.n })} />
        })}
      </g>
      {/* Ordre: el número de cada fila de la llista al començament de la seva primera operació. */}
      {(order || selRow) &&
        orderMarks(view.rows.filter((r) => order || r === selRow)).map(({ at: a, label }) => {
          const fs = px(9)
          const rw = Math.max(px(14), label.length * fs * 0.62 + px(6))
          return (
            <g key={`n${label}`} pointerEvents="none">
              <rect x={a[0] - rw / 2} y={Y(a[1]) - px(7)} width={rw} height={px(14)} rx={px(7)} fill={token("fg")} />
              <text x={a[0]} y={Y(a[1])} textAnchor="middle" dominantBaseline="central" fill={token("bg")} style={{ fontFamily: "inherit", fontWeight: 600, fontSize: fs }}>
                {label}
              </text>
            </g>
          )
        })}
      {/* Cotes del que s'inspecciona (gruix i lletra en píxels de pantalla, a qualsevol zoom). */}
      {insp && (
        <g pointerEvents="none">
          {insp.dims.map((d, i) => (
            <DimLine key={i} d={{ a: [d.a[0], Y(d.a[1])], b: [d.b[0], Y(d.b[1])], offset: -px(d.off), label: d.label, title: d.title }} stroke={px(1)} fs={px(11)} />
          ))}
        </g>
      )}
    </svg>
  )
}
