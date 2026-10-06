import { Badge, Box, HStack, Stack, Switch, Text } from "@chakra-ui/react"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { ChoiceChips } from "../../components/FormRow"
import { SectionLabel } from "../../components/SectionLabel"
import { approachSegment, type CamOp, type Pt } from "../../core/export/xcsPreview"
import type { Machine } from "../../core/model"
import { camSheetView, colorFor, fmtMm, opLabel, svgPath, token } from "./camDrawing"

export interface CamSheet {
  file: string
  text: string
}

type Zoom = "1" | "2" | "4"

/**
 * Vista CAM d'Exportar: dibuixa el programa de cada tauler **a partir del text del .xcs** (el mateix que va al zip),
 * perquè el taller vegi què rebrà la màquina sense obrir TopSolid: tauler i marge, peces amb la ref, forats per eina,
 * fresats amb la franja de l'eina (Ø) al costat que toca, entrades en rampa, ordre i llista d'operacions.
 */
export function CamPreview({ sheets, machine }: { sheets: CamSheet[]; machine?: Machine }) {
  const [tab, setTab] = useState(0)
  const [order, setOrder] = useState(false)
  const [band, setBand] = useState(true)
  const [zoom, setZoom] = useState<Zoom>("1")
  const [sel, setSel] = useState<number | null>(null)
  const sheet = sheets[Math.min(tab, sheets.length - 1)]
  const view = useMemo(() => (sheet ? camSheetView(sheet.text, machine) : null), [sheet, machine])
  const wrap = useRef<HTMLDivElement>(null)
  const [cw, setCw] = useState(360)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && e.contentRect.width > 0 && setCw(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!sheet || !view) return <Text color="fg.muted">Cap programa per veure.</Text>
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
  const selRow = sel === null ? null : (view.rows.find((r) => r.from === sel) ?? null)
  const selected = new Set(selRow?.ops.map((o) => o.n) ?? [])
  const fontPx = 10
  const tabLabel = (f: string, i: number) => /^T\d+/.exec(f)?.[0] ?? `${i + 1}`

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
  const opLine = (o: CamOp) => {
    const parts = [o.ref, opLabel(o)].filter(Boolean)
    return parts.join(" · ")
  }

  return (
    <Stack direction={{ base: "column", lg: "row" }} gap={5} align="stretch" minH={0} h={{ lg: "full" }}>
      <Stack gap={3} flex={1} minW={0} minH={0} overflowY={{ lg: "auto" }} pe={{ lg: 1 }}>
        {sheets.length > 1 && (
          <ChoiceChips
            label="Tauler"
            options={sheets.map((s, i) => ({ id: String(i), label: tabLabel(s.file, i) }))}
            value={String(Math.min(tab, sheets.length - 1))}
            onChange={(v) => {
              setTab(Number(v))
              setSel(null)
            }}
          />
        )}
        <Stack gap={0.5}>
          <Text fontSize="sm" fontWeight="medium" truncate>
            {sheet.file}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {p.workpiece ? `${p.workpiece.name} · ${fmtMm(L)} × ${fmtMm(W)} × ${fmtMm(p.workpiece.T)} mm · ` : ""}
            {p.parts.length} {p.parts.length === 1 ? "peça" : "peces"} · {p.ops.length} {p.ops.length === 1 ? "operació" : "operacions"}
            {p.edgeTrim !== undefined ? ` · marge ${fmtMm(p.edgeTrim)} mm` : ""}
          </Text>
        </Stack>
        <HStack gap={4} wrap="wrap" rowGap={2}>
          <Switch.Root size="sm" checked={order} onCheckedChange={(e) => setOrder(e.checked)}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Ordre</Switch.Label>
          </Switch.Root>
          <Switch.Root size="sm" checked={band} onCheckedChange={(e) => setBand(e.checked)}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Amplada de l'eina</Switch.Label>
          </Switch.Root>
          <ChoiceChips<Zoom>
            label="Zoom"
            options={[
              { id: "1", label: "1×" },
              { id: "2", label: "2×" },
              { id: "4", label: "4×" },
            ]}
            value={zoom}
            onChange={setZoom}
          />
        </HStack>
        <Box ref={wrap} w="full" overflow="auto" borderWidth="1px" rounded="md" bg="bg.subtle" maxH={{ base: "70vh", lg: "none" }} flexShrink={0}>
          <svg width={svgW} height={(svgW * vh) / vw} viewBox={`${-pad} ${-pad} ${vw} ${vh}`} style={{ display: "block" }} role="img" aria-label={`Programa ${sheet.file}`}>
            {/* Tauler i marge que no s'aprofita. */}
            <rect x={0} y={0} width={L} height={W} fill={token("bg.panel")} stroke={token("fg.muted")} strokeWidth={1} vectorEffect="non-scaling-stroke" />
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
            {/* Ordre: el número de cada fila de la llista al començament de la seva primera operació. */}
            {(order || selRow) &&
              orderMarks(view.rows.filter((r) => order || r === selRow)).map(({ at: a, label }) => {
                const fs = px(9)
                const rw = Math.max(px(14), label.length * fs * 0.62 + px(6))
                return (
                  <g key={`n${label}`}>
                    <rect x={a[0] - rw / 2} y={Y(a[1]) - px(7)} width={rw} height={px(14)} rx={px(7)} fill={token("fg")} />
                    <text x={a[0]} y={Y(a[1])} textAnchor="middle" dominantBaseline="central" fill={token("bg")} style={{ fontFamily: "inherit", fontWeight: 600, fontSize: fs }}>
                      {label}
                    </text>
                  </g>
                )
              })}
          </svg>
        </Box>
        {/* Llegenda: una eina per color. */}
        <Stack gap={1.5}>
          <SectionLabel>Eines</SectionLabel>
          <HStack gap={3} rowGap={1.5} wrap="wrap" fontSize="xs">
            {view.tools.map((t) => (
              <HStack key={t.key} gap={1.5}>
                <Box w="12px" h="12px" rounded={t.kind === "drill" ? "full" : "sm"} style={{ background: t.color }} flexShrink={0} />
                <Text>
                  {t.kind === "drill" ? "Broca" : t.kind === "blade" ? "Disc" : "Fresa"} {t.name}
                  {t.diameter ? ` · Ø${fmtMm(t.diameter)}` : " · Ø ?"} · {t.count}
                  {t.kind === "drill" ? (t.count === 1 ? " forat" : " forats") : t.count === 1 ? " op." : " op."}
                </Text>
              </HStack>
            ))}
            {view.small.size > 0 && (
              <HStack gap={1.5}>
                <Box w="12px" h="12px" rounded="sm" bg="yellow.subtle" borderWidth="1px" borderColor="yellow.fg" flexShrink={0} />
                <Text>Peça petita (en passades)</Text>
              </HStack>
            )}
          </HStack>
          <Text fontSize="xs" color="fg.muted">
            Línia: la geometria del programa. Discontínua i franja: el centre de l'eina i el que treu (aproximat, només per veure-ho). Fletxa: entrada en rampa. Punta: sentit de cada contorn i tall (Preferències › Regles de mecanitzat › «Sentit dels contorns i talls»).
          </Text>
          {p.unknown > 0 && (
            <Text fontSize="xs" color="fg.warning">
              {p.unknown} {p.unknown === 1 ? "línia no reconeguda" : "línies no reconegudes"} pel visor (no es dibuixen): {p.unknownLines.slice(0, 3).map((u) => `${u.line}`).join(", ")}
              {p.unknownLines.length > 3 ? "…" : ""}
            </Text>
          )}
        </Stack>
      </Stack>

      {/* Llista d'operacions en l'ordre del fitxer: tocar-ne una la marca al dibuix. */}
      <Stack gap={1.5} w={{ base: "full", lg: "420px" }} flexShrink={0} minH={0} overflowY={{ lg: "auto" }}>
        <SectionLabel>Operacions ({p.ops.length})</SectionLabel>
        <Stack gap={0} borderWidth="1px" rounded="md" overflow="hidden">
          {view.rows.map((r) => {
            const o = r.ops[0]!
            const on = sel === r.from
            const extras = [
              o.pass ? `P${o.pass.index}/${o.pass.count}` : "",
              o.approach && view.widths.get(o.n) ? `rampa ${fmtMm(o.approach.k * (view.widths.get(o.n)! / 2))} mm` : o.approach ? "rampa" : "",
              o.maxPass ? `passades de ${fmtMm(o.maxPass)}` : "",
              o.overMaterial ? `sobrant ${fmtMm(o.overMaterial)}` : "",
              o.toolpath ? "recorregut" : "",
              o.plane !== "Top" ? o.plane : "",
            ].filter(Boolean)
            return (
              <HStack
                key={r.from}
                as="button"
                gap={2}
                px={3}
                py={1.5}
                textAlign="start"
                borderBottomWidth="1px"
                _last={{ borderBottomWidth: 0 }}
                bg={on ? "bg.emphasized" : undefined}
                _hover={{ bg: on ? "bg.emphasized" : "bg.muted" }}
                onClick={() => setSel(on ? null : r.from)}
                fontSize="xs"
                align="start"
                aria-pressed={on}
              >
                <Text fontVariantNumeric="tabular-nums" color="fg.muted" minW="44px" flexShrink={0}>
                  {r.from === r.to ? r.from : `${r.from}–${r.to}`}
                </Text>
                <Box w="10px" h="10px" mt="3px" rounded={o.kind === "drill" ? "full" : "sm"} style={{ background: colorFor(view, o) }} flexShrink={0} />
                <Stack gap={0} flex={1} minW={0}>
                  <Text truncate>
                    {r.count > 1 ? opLabel(o, r.count) : opLine(o)} · {fmtMm(r.depth)} mm
                  </Text>
                  <Text color="fg.muted" lineClamp={2}>
                    {o.tool === "-1" ? "eina automàtica" : o.tool}
                    {extras.length ? ` · ${extras.join(" · ")}` : ""}
                  </Text>
                </Stack>
                {o.small && (
                  <Badge size="xs" colorPalette="yellow" flexShrink={0}>
                    petita
                  </Badge>
                )}
              </HStack>
            )
          })}
        </Stack>
      </Stack>
    </Stack>
  )
}
