import { Badge, Box, Button, CloseButton, Dialog, HStack, IconButton, Portal, Stack, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { LuTrash2 } from "react-icons/lu"
import { bounds, normalizeProfile, polygonArea, selfIntersects, signedArea, type Pt } from "../../core/model"
import { NumberField } from "../editor/ParamsForm"

/** Formes de partida (mm), amb la cantonada mínima a (0, 0). */
const PRESETS: { id: string; label: string; make: (w: number, h: number) => Pt[] }[] = [
  { id: "rect", label: "Rectangle", make: (w, h) => [[0, 0], [w, 0], [w, h], [0, h]] },
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

const r1 = (v: number) => Math.round(v * 10) / 10

/**
 * Editor de perfil 2D (secció d'un objecte): punts arrossegables amb imant a la quadrícula
 * (10 mm; Maj: 1 mm), «+» al mig de cada costat per afegir-hi un punt, Supr per treure'n,
 * fletxes per afinar, i la llista de punts amb les coordenades exactes. Les mides dels
 * costats es veuen al dibuix. No deixa aplicar un contorn que es talli a si mateix.
 */
export function ProfileEditor({
  open,
  initial,
  axes,
  onClose,
  onApply,
}: {
  open: boolean
  initial: Pt[]
  /** Noms dels eixos (u, v) per als rètols, p. ex. ["Ample", "Alt"]. */
  axes: [string, string]
  onClose: () => void
  onApply: (p: { points: Pt[]; w: number; h: number }) => void
}) {
  const [pts, setPts] = useState<Pt[]>(initial)
  const [sel, setSel] = useState<number | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
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

  const bad = selfIntersects(pts)
  const b = bounds(pts)
  const area = polygonArea(pts)
  const unit = view.span / 100
  const minor = view.span > 1500 ? 50 : view.span > 400 ? 10 : 5
  const major = minor * 10

  const toMm = (e: { clientX: number; clientY: number }): Pt => {
    const el = svg.current
    if (!el) return [0, 0]
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const q = pt.matrixTransform(el.getScreenCTM()!.inverse())
    return [q.x, -q.y]
  }
  const snap = (v: number, fine: boolean) => (fine ? Math.round(v) : Math.round(v / minor) * minor)

  const move = (i: number, p: Pt) => setPts((cur) => cur.map((q, k) => (k === i ? p : q)))
  const remove = (i: number) => {
    if (pts.length <= 3) return
    setPts((cur) => cur.filter((_, k) => k !== i))
    setSel(null)
  }
  const insert = (i: number) => {
    const a = pts[i]!
    const c = pts[(i + 1) % pts.length]!
    const m: Pt = [r1((a[0] + c[0]) / 2), r1((a[1] + c[1]) / 2)]
    setPts((cur) => [...cur.slice(0, i + 1), m, ...cur.slice(i + 1)])
    setSel(i + 1)
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
      move(sel, [r1(p[0] + d[0]!), r1(p[1] + d[1]!)])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const onDown = (i: number) => (e: ReactPointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setSel(i)
    setDrag(i)
  }
  const onMove = (e: ReactPointerEvent) => {
    if (drag === null) return
    const [x, y] = toMm(e)
    move(drag, [snap(x, e.shiftKey), snap(y, e.shiftKey)])
  }
  const onUp = () => setDrag(null)

  const gridLines = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = []
    const { x0, y0, span } = view
    const s0x = Math.floor(x0 / minor) * minor
    const s0y = Math.floor(y0 / minor) * minor
    for (let x = s0x; x <= x0 + span; x += minor) out.push({ x1: x, y1: -y0, x2: x, y2: -(y0 + span), major: Math.abs(x % major) < 1e-6 })
    for (let y = s0y; y <= y0 + span; y += minor) out.push({ x1: x0, y1: -y, x2: x0 + span, y2: -y, major: Math.abs(y % major) < 1e-6 })
    return out
  }, [view, minor, major])

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
                    <Button key={p.id} size="xs" variant="outline" onClick={() => {
                      setPts(p.make(Math.max(50, r1(b.x1 - b.x0)), Math.max(50, r1(b.y1 - b.y0))))
                      setSel(null)
                    }}>
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
                        points={pts.map(([x, y]) => `${x},${-y}`).join(" ")}
                        fill={bad ? "rgba(220,38,38,0.15)" : "rgba(124,58,237,0.15)"}
                        stroke={bad ? "#dc2626" : "#7c3aed"}
                        strokeWidth={unit * 0.4}
                        strokeLinejoin="round"
                      />
                      {pts.map((a, i) => {
                        const c = pts[(i + 1) % pts.length]!
                        const mx = (a[0] + c[0]) / 2
                        const my = (a[1] + c[1]) / 2
                        const length = Math.hypot(c[0] - a[0], c[1] - a[1])
                        // Rètol de la mida a fora del costat (normal cap a fora si el contorn és antihorari).
                        const sign = signedArea(pts) >= 0 ? 1 : -1
                        const nx = length ? ((c[1] - a[1]) / length) * sign : 0
                        const ny = length ? (-(c[0] - a[0]) / length) * sign : 1
                        return (
                          <g key={`e${i}`}>
                            <text x={mx + nx * unit * 4} y={-(my + ny * unit * 4) + unit * 0.9} fontSize={unit * 2.6} textAnchor="middle" fill="var(--chakra-colors-fg-muted)" style={{ pointerEvents: "none" }}>
                              {Math.round(length)}
                            </text>
                            <g onPointerDown={(e) => { e.stopPropagation(); insert(i) }} style={{ cursor: "copy" }}>
                              <circle cx={mx} cy={-my} r={unit * 1.4} fill="var(--chakra-colors-bg)" stroke="#7c3aed" strokeWidth={unit * 0.25} />
                              <path d={`M ${mx - unit * 0.7} ${-my} H ${mx + unit * 0.7} M ${mx} ${-my - unit * 0.7} V ${-my + unit * 0.7}`} stroke="#7c3aed" strokeWidth={unit * 0.25} />
                            </g>
                          </g>
                        )
                      })}
                      {pts.map(([x, y], i) => (
                        <circle
                          key={`p${i}`}
                          cx={x}
                          cy={-y}
                          r={unit * (sel === i ? 2 : 1.6)}
                          fill={sel === i ? "#b57a37" : "#7c3aed"}
                          stroke="white"
                          strokeWidth={unit * 0.35}
                          style={{ cursor: "grab" }}
                          onPointerDown={onDown(i)}
                        />
                      ))}
                    </svg>
                  </Box>
                  <Stack w={{ base: "full", md: "240px" }} gap={1} maxH={{ md: "440px" }} overflowY="auto" flexShrink={0}>
                    <HStack justify="space-between">
                      <Text textStyle="sm" fontWeight="semibold">
                        Punts
                      </Text>
                      <Badge size="sm" colorPalette={bad ? "red" : "wood"}>
                        {Math.round(b.x1 - b.x0)} × {Math.round(b.y1 - b.y0)}
                      </Badge>
                    </HStack>
                    {pts.map(([x, y], i) => (
                      <HStack key={i} gap={1} align="end" bg={sel === i ? "wood.subtle" : undefined} rounded="sm" px={1} onFocus={() => setSel(i)}>
                        <Text textStyle="xs" color="fg.muted" w="4" pb={2}>
                          {i + 1}
                        </Text>
                        <NumberField label={i === 0 ? axes[0] : ""} value={x} step={1} onChange={(v) => Number.isFinite(v) && move(i, [v, y])} />
                        <NumberField label={i === 0 ? axes[1] : ""} value={y} step={1} onChange={(v) => Number.isFinite(v) && move(i, [x, v])} />
                        <IconButton aria-label={`Treure el punt ${i + 1}`} size="xs" variant="ghost" disabled={pts.length <= 3} onClick={() => remove(i)}>
                          <LuTrash2 />
                        </IconButton>
                      </HStack>
                    ))}
                  </Stack>
                </Stack>
                <Text textStyle="xs" color={bad ? "fg.error" : "fg.muted"}>
                  {bad
                    ? "El contorn es talla a si mateix: mou algun punt."
                    : `Arrossega els punts (imant de ${minor} mm; Maj: 1 mm). «+» al mig d'un costat hi afegeix un punt; Supr el treu; fletxes: 1 mm (Maj 10). Àrea ${(area / 1e6).toFixed(3)} m².`}
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

/** Vista quadrada que conté el perfil amb marge. */
function viewOf(pts: Pt[]): { x0: number; y0: number; span: number } {
  const b = bounds(pts)
  const w = b.x1 - b.x0
  const h = b.y1 - b.y0
  const span = Math.max(w, h, 100) * 1.3
  return { x0: b.x0 + w / 2 - span / 2, y0: b.y0 + h / 2 - span / 2, span }
}
