import { Badge, Box, Button, CloseButton, Dialog, HStack, IconButton, Portal, Stack, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { LuSpline, LuTrash2 } from "react-icons/lu"
import {
  arcOf,
  bounds,
  bulgeFromSagitta,
  bulgeOf,
  filletCorner,
  flatten,
  normalizeProfile,
  polygonArea,
  sagittaOf,
  selfIntersects,
  signedArea,
  type BPt,
} from "../../core/model"
import { NumberField } from "../editor/ParamsForm"

const r1 = (v: number) => Math.round(v * 10) / 10

/** Rectangle amb les quatre cantonades arrodonides. */
function rounded(w: number, h: number, r: number): BPt[] {
  let p: BPt[] = [[0, 0], [w, 0], [w, h], [0, h]]
  for (const i of [3, 2, 1, 0]) p = filletCorner(p, i, r) ?? p
  return p
}

/** Formes de partida (mm), amb la cantonada mínima a (0, 0). */
const PRESETS: { id: string; label: string; make: (w: number, h: number) => BPt[] }[] = [
  { id: "rect", label: "Rectangle", make: (w, h) => [[0, 0], [w, 0], [w, h], [0, h]] },
  { id: "round", label: "Arrodonit", make: (w, h) => rounded(w, h, Math.round(Math.min(w, h) / 6)) },
  // Arc a dalt: el costat de dalt va de (w, h) a (0, h) en sentit antihorari.
  { id: "arch", label: "Arc", make: (w, h) => [[0, 0], [w, 0], [w, h * 0.6, bulgeFromSagitta(h * 0.4, w)], [0, h * 0.6]] },
  {
    id: "l",
    label: "L",
    make: (w, h) => {
      const t = Math.round(Math.min(w, h) / 3)
      return [[0, 0], [w, 0], [w, t], [t, t], [t, h], [0, h]]
    },
  },
  {
    id: "t",
    label: "T",
    make: (w, h) => {
      const t = Math.round(Math.min(w, h) / 3)
      const x0 = Math.round((w - t) / 2)
      return [[x0, 0], [x0 + t, 0], [x0 + t, h - t], [w, h - t], [w, h], [0, h], [0, h - t], [x0, h - t]]
    },
  },
  {
    id: "u",
    label: "U",
    make: (w, h) => {
      const t = Math.round(Math.min(w, h) / 4)
      return [[0, 0], [w, 0], [w, h], [w - t, h], [w - t, t], [t, t], [t, h], [0, h]]
    },
  },
  {
    id: "chamfer",
    label: "Bisell",
    make: (w, h) => {
      const c = Math.round(Math.min(w, h) / 4)
      return [[0, 0], [w, 0], [w, h - c], [w - c, h], [0, h]]
    },
  },
  {
    id: "trap",
    label: "Trapezi",
    make: (w, h) => {
      const c = Math.round(w / 5)
      return [[0, 0], [w, 0], [w - c, h], [c, h]]
    },
  },
]

/** Punt mig d'un costat (a l'arc, si és corbat). */
function edgeMid(p: BPt, q: BPt): [number, number] {
  const b = bulgeOf(p)
  if (Math.abs(b) < 1e-9) return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const a = arcOf(p, q, b)
  const t = a.start + a.sweep / 2
  return [a.cx + a.r * Math.cos(t), a.cy + a.r * Math.sin(t)]
}

const withBulge = (p: BPt, b: number): BPt => (Math.abs(b) < 1e-6 ? [p[0], p[1]] : [p[0], p[1], b])

/**
 * Editor de perfil 2D (secció d'un objecte), amb rectes i arcs:
 * - punts arrossegables amb imant a la quadrícula (Maj: 1 mm); fletxes per afinar; Supr;
 * - el cercle del mig de cada costat: clic hi afegeix un punt; arrossegar-lo corba el costat;
 * - «Arrodonir» la cantonada seleccionada amb un radi; «Fletxa» de cada costat a la llista.
 * No deixa aplicar un contorn que es talli a si mateix.
 */
export function ProfileEditor({
  open,
  initial,
  axes,
  onClose,
  onApply,
}: {
  open: boolean
  initial: BPt[]
  /** Noms dels eixos (u, v) per als rètols, p. ex. ["Ample", "Alt"]. */
  axes: [string, string]
  onClose: () => void
  onApply: (p: { points: BPt[]; w: number; h: number }) => void
}) {
  const [pts, setPts] = useState<BPt[]>(initial)
  const [sel, setSel] = useState<number | null>(null)
  const [radius, setRadius] = useState(20)
  // Arrossegament: d'un punt, o del mig d'un costat (per corbar-lo o, si no es mou, afegir-hi un punt).
  const [drag, setDrag] = useState<{ kind: "point" | "edge"; i: number; x: number; y: number; moved: boolean } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (open) {
      setPts(initial)
      setSel(null)
    }
  }, [open, initial])

  // Vista: es congela mentre s'arrossega perquè el dibuix no salti.
  const [view, setView] = useState(() => viewOf(initial))
  useEffect(() => {
    if (drag === null) setView(viewOf(pts))
  }, [pts, drag])

  const flat = useMemo(() => flatten(pts), [pts])
  const bad = selfIntersects(flat)
  const b = bounds(flat)
  const area = polygonArea(flat)
  const unit = view.span / 100
  const minor = view.span > 1500 ? 50 : view.span > 400 ? 10 : 5
  const major = minor * 10
  const orient = signedArea(flat) >= 0 ? 1 : -1

  const toMm = (e: { clientX: number; clientY: number }): [number, number] => {
    const el = svg.current
    if (!el) return [0, 0]
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const q = pt.matrixTransform(el.getScreenCTM()!.inverse())
    return [q.x, -q.y]
  }
  const snap = (v: number, fine: boolean) => (fine ? Math.round(v) : Math.round(v / minor) * minor)

  const setPoint = (i: number, x: number, y: number) => setPts((cur) => cur.map((q, k) => (k === i ? (withBulge([x, y], bulgeOf(q))) : q)))
  const setBulge = (i: number, bulge: number) => setPts((cur) => cur.map((q, k) => (k === i ? withBulge(q, bulge) : q)))
  const remove = (i: number) => {
    if (pts.length <= 3) return
    setPts((cur) => cur.filter((_, k) => k !== i))
    setSel(null)
  }
  /** Afegeix un punt al mig del costat i (si és un arc, el parteix en dos arcs iguals). */
  const insert = (i: number) => {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    const bl = bulgeOf(p)
    const half = Math.abs(bl) < 1e-9 ? 0 : Math.tan(Math.atan(bl) / 2)
    const [mx, my] = edgeMid(p, q)
    setPts((cur) => [...cur.slice(0, i), withBulge(p, half), withBulge([r1(mx), r1(my)], half), ...cur.slice(i + 1)])
    setSel(i + 1)
  }
  const fillet = () => {
    if (sel === null) return
    const next = filletCorner(pts, sel, radius)
    if (next) {
      setPts(next)
      setSel(null)
    }
  }

  // Teclat: Supr treu el punt; fletxes el mouen (1 mm, Maj 10 mm).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (sel === null) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        remove(sel)
        return
      }
      const k = e.shiftKey ? 10 : 1
      const d = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, k], ArrowDown: [0, -k] }[e.key]
      if (!d) return
      e.preventDefault()
      const p = pts[sel]!
      setPoint(sel, r1(p[0] + d[0]!), r1(p[1] + d[1]!))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const start = (kind: "point" | "edge", i: number) => (e: ReactPointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    if (kind === "point") setSel(i)
    setDrag({ kind, i, x: e.clientX, y: e.clientY, moved: false })
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3) return
    if (!drag.moved) setDrag({ ...drag, moved: true })
    const [x, y] = toMm(e)
    if (drag.kind === "point") {
      setPoint(drag.i, snap(x, e.shiftKey), snap(y, e.shiftKey))
      return
    }
    // Corbar el costat: la fletxa és la distància (amb signe) del ratolí a la corda.
    const p = pts[drag.i]!
    const q = pts[(drag.i + 1) % pts.length]!
    const cx = q[0] - p[0]
    const cy = q[1] - p[1]
    const c = Math.hypot(cx, cy)
    if (c < 1e-6) return
    // Bulge positiu = arc antihorari = la panxa a la dreta de P→Q.
    const right = -(cx * (y - p[1]) - cy * (x - p[0])) / c
    const s = e.shiftKey ? Math.round(right) : Math.round(right / minor) * minor
    setBulge(drag.i, Math.max(-1, Math.min(1, bulgeFromSagitta(s, c))))
  }
  const onUp = () => {
    if (drag && drag.kind === "edge" && !drag.moved) insert(drag.i)
    setDrag(null)
  }

  const gridLines = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = []
    const { x0, y0, span } = view
    const s0x = Math.floor(x0 / minor) * minor
    const s0y = Math.floor(y0 / minor) * minor
    for (let x = s0x; x <= x0 + span; x += minor) out.push({ x1: x, y1: -y0, x2: x, y2: -(y0 + span), major: Math.abs(x % major) < 1e-6 })
    for (let y = s0y; y <= y0 + span; y += minor) out.push({ x1: x0, y1: -y, x2: x0 + span, y2: -y, major: Math.abs(y % major) < 1e-6 })
    return out
  }, [view, minor, major])

  const selCanFillet = sel !== null && filletCorner(pts, sel, radius) !== null

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="xl" placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Forma de la secció</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                <HStack gap={1} wrap="wrap">
                  {PRESETS.map((p) => (
                    <Button
                      key={p.id}
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setPts(p.make(Math.max(50, r1(b.x1 - b.x0)), Math.max(50, r1(b.y1 - b.y0))))
                        setSel(null)
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </HStack>
                <Stack direction={{ base: "column", md: "row" }} gap={3} align="stretch">
                  <Box flex={1} minW={0} borderWidth="1px" rounded="md" bg="bg.subtle" overflow="hidden">
                    <svg
                      ref={svg}
                      viewBox={`${view.x0} ${-(view.y0 + view.span)} ${view.span} ${view.span}`}
                      style={{ width: "100%", aspectRatio: "1", display: "block", touchAction: "none", userSelect: "none" }}
                      onPointerMove={onMove}
                      onPointerUp={onUp}
                      onPointerDown={() => setSel(null)}
                    >
                      {gridLines.map((l, i) => (
                        <line key={i} {...l} stroke="var(--chakra-colors-border)" strokeWidth={l.major ? unit * 0.25 : unit * 0.1} />
                      ))}
                      <polygon
                        points={flat.map(([x, y]) => `${x},${-y}`).join(" ")}
                        fill={bad ? "rgba(220,38,38,0.15)" : "rgba(124,58,237,0.15)"}
                        stroke={bad ? "#dc2626" : "#7c3aed"}
                        strokeWidth={unit * 0.4}
                        strokeLinejoin="round"
                      />
                      {pts.map((p, i) => {
                        const q = pts[(i + 1) % pts.length]!
                        const [mx, my] = edgeMid(p, q)
                        const bl = bulgeOf(p)
                        const chord = Math.hypot(q[0] - p[0], q[1] - p[1])
                        const label = Math.abs(bl) < 1e-9 ? `${Math.round(chord)}` : `R${Math.round(arcOf(p, q, bl).r)}`
                        // Rètol a fora del costat.
                        const nx = chord ? ((q[1] - p[1]) / chord) * orient : 0
                        const ny = chord ? (-(q[0] - p[0]) / chord) * orient : 1
                        return (
                          <g key={`e${i}`}>
                            <text x={mx + nx * unit * 4} y={-(my + ny * unit * 4) + unit * 0.9} fontSize={unit * 2.6} textAnchor="middle" fill="var(--chakra-colors-fg-muted)" style={{ pointerEvents: "none" }}>
                              {label}
                            </text>
                            <g onPointerDown={start("edge", i)} style={{ cursor: "pointer" }}>
                              <title>Clic: afegir un punt · Arrossegar: corbar el costat</title>
                              <circle cx={mx} cy={-my} r={unit * 1.5} fill="var(--chakra-colors-bg)" stroke="#7c3aed" strokeWidth={unit * 0.25} />
                              <path d={`M ${mx - unit * 0.7} ${-my} H ${mx + unit * 0.7} M ${mx} ${-my - unit * 0.7} V ${-my + unit * 0.7}`} stroke="#7c3aed" strokeWidth={unit * 0.25} />
                            </g>
                          </g>
                        )
                      })}
                      {pts.map((p, i) => (
                        <circle
                          key={`p${i}`}
                          cx={p[0]}
                          cy={-p[1]}
                          r={unit * (sel === i ? 2 : 1.6)}
                          fill={sel === i ? "#b57a37" : "#7c3aed"}
                          stroke="white"
                          strokeWidth={unit * 0.35}
                          style={{ cursor: "grab" }}
                          onPointerDown={start("point", i)}
                        />
                      ))}
                    </svg>
                  </Box>
                  <Stack w={{ base: "full", md: "300px" }} gap={1} maxH={{ md: "460px" }} overflowY="auto" flexShrink={0}>
                    <HStack justify="space-between">
                      <Text textStyle="sm" fontWeight="semibold">
                        Punts
                      </Text>
                      <Badge size="sm" colorPalette={bad ? "red" : "wood"}>
                        {Math.round(b.x1 - b.x0)} × {Math.round(b.y1 - b.y0)}
                      </Badge>
                    </HStack>
                    <HStack gap={1} align="end">
                      <NumberField label="Radi" value={radius} min={1} max={2000} step={5} onChange={(v) => Number.isFinite(v) && v > 0 && setRadius(v)} />
                      <Button size="sm" variant="outline" disabled={!selCanFillet} onClick={fillet} title={sel === null ? "Tria una cantonada (un punt)" : undefined}>
                        <LuSpline /> Arrodonir
                      </Button>
                    </HStack>
                    {pts.map((p, i) => {
                      const q = pts[(i + 1) % pts.length]!
                      const chord = Math.hypot(q[0] - p[0], q[1] - p[1])
                      return (
                        <HStack key={i} gap={1} align="end" bg={sel === i ? "wood.subtle" : undefined} rounded="sm" px={1} onFocus={() => setSel(i)}>
                          <Text textStyle="xs" color="fg.muted" w="4" pb={2}>
                            {i + 1}
                          </Text>
                          <NumberField label={i === 0 ? axes[0] : ""} value={p[0]} step={1} onChange={(v) => Number.isFinite(v) && setPoint(i, v, p[1])} />
                          <NumberField label={i === 0 ? axes[1] : ""} value={p[1]} step={1} onChange={(v) => Number.isFinite(v) && setPoint(i, p[0], v)} />
                          <NumberField
                            label={i === 0 ? "Fletxa" : ""}
                            value={r1(sagittaOf(bulgeOf(p), chord))}
                            step={1}
                            onChange={(v) => Number.isFinite(v) && setBulge(i, Math.max(-1, Math.min(1, bulgeFromSagitta(v, chord))))}
                          />
                          <IconButton aria-label={`Treure el punt ${i + 1}`} size="xs" variant="ghost" disabled={pts.length <= 3} onClick={() => remove(i)}>
                            <LuTrash2 />
                          </IconButton>
                        </HStack>
                      )
                    })}
                  </Stack>
                </Stack>
                <Text textStyle="xs" color={bad ? "fg.error" : "fg.muted"}>
                  {bad
                    ? "El contorn es talla a si mateix: mou algun punt."
                    : `Arrossega els punts (imant de ${minor} mm; Maj: 1 mm). El cercle del mig d'un costat: clic hi afegeix un punt, arrossegar-lo el corba. «Fletxa» = com de corbat és el costat que surt del punt (0 = recte). Àrea ${(area / 1e6).toFixed(3)} m².`}
                </Text>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
              <Button colorPalette="wood" disabled={bad} onClick={() => onApply(normalizeProfile(pts))}>
                Aplicar
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

/** Vista quadrada que conté el perfil (amb els arcs) amb marge. */
function viewOf(pts: BPt[]): { x0: number; y0: number; span: number } {
  const b = bounds(flatten(pts))
  const w = b.x1 - b.x0
  const h = b.y1 - b.y0
  const span = Math.max(w, h, 100) * 1.3
  return { x0: b.x0 + w / 2 - span / 2, y0: b.y0 + h / 2 - span / 2, span }
}
