import { Badge, Box, Button, CloseButton, Dialog, HStack, IconButton, Kbd, Portal, SegmentGroup, Stack, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { LuEraser, LuMousePointer2, LuPenTool, LuSpline, LuTrash2 } from "react-icons/lu"
import {
  autoHandles,
  bendEdge,
  bounds,
  edgeOf,
  filletNode,
  moveHandle,
  normalizeNodes,
  polygonArea,
  sampleProfile,
  selfIntersects,
  splitEdge,
  cubicAt,
  arcOf,
  type PNode,
  type Vec2,
} from "../../core/model"
import { NumberField } from "../editor/ParamsForm"

const r1 = (v: number) => Math.round(v * 10) / 10
/** Blau dels nodes i manegadors (com a Figma). */
const HANDLE = "#1e88e5"
/** Constant del cercle amb cúbiques: manegador = k · radi. */
const KAPPA = 0.5522847498

const rect = (w: number, h: number): PNode[] => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]

/** Formes de partida (mm), amb la cantonada mínima a (0, 0). */
const PRESETS: { id: string; label: string; make: (w: number, h: number) => PNode[] }[] = [
  { id: "rect", label: "Rectangle", make: rect },
  {
    id: "round",
    label: "Arrodonit",
    make: (w, h) => {
      let p = rect(w, h)
      const r = Math.round(Math.min(w, h) / 6)
      for (const i of [3, 2, 1, 0]) p = filletNode(p, i, r) ?? p
      return p
    },
  },
  {
    id: "ellipse",
    label: "El·lipse",
    make: (w, h) => {
      const a = w / 2, b = h / 2
      return [
        { x: w, y: b, in: [0, -KAPPA * b], out: [0, KAPPA * b], t: "smooth" },
        { x: a, y: h, in: [KAPPA * a, 0], out: [-KAPPA * a, 0], t: "smooth" },
        { x: 0, y: b, in: [0, KAPPA * b], out: [0, -KAPPA * b], t: "smooth" },
        { x: a, y: 0, in: [-KAPPA * a, 0], out: [KAPPA * a, 0], t: "smooth" },
      ]
    },
  },
  { id: "arch", label: "Arc", make: (w, h) => bendEdge([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h * 0.6 }, { x: 0, y: h * 0.6 }], 2, [w / 2, h]) },
  {
    id: "l",
    label: "L",
    make: (w, h) => {
      const t = Math.round(Math.min(w, h) / 3)
      return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: t }, { x: t, y: t }, { x: t, y: h }, { x: 0, y: h }]
    },
  },
  {
    id: "u",
    label: "U",
    make: (w, h) => {
      const t = Math.round(Math.min(w, h) / 4)
      return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: w - t, y: h }, { x: w - t, y: t }, { x: t, y: t }, { x: t, y: h }, { x: 0, y: h }]
    },
  },
  {
    id: "chamfer",
    label: "Bisell",
    make: (w, h) => {
      const c = Math.round(Math.min(w, h) / 4)
      return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h - c }, { x: w - c, y: h }, { x: 0, y: h }]
    },
  },
]

type Drag =
  | { kind: "node"; i: number; x: number; y: number; moved: boolean }
  | { kind: "handle"; i: number; which: "in" | "out"; moved: boolean }
  | { kind: "edge"; i: number; x: number; y: number; moved: boolean }
  | { kind: "pen"; i: number; x: number; y: number; moved: boolean }

/** Punt mig d'un costat (sobre la corba). */
function edgeMid(nodes: PNode[], i: number): Vec2 {
  const a = nodes[i]!
  const c = nodes[(i + 1) % nodes.length]!
  const e = edgeOf(nodes, i)
  if (e.kind === "cubic") return cubicAt([a.x, a.y], e.p1, e.p2, [c.x, c.y], 0.5)
  if (e.kind === "arc") {
    const f = arcOf([a.x, a.y], [c.x, c.y], e.b)
    const t = f.start + f.sweep / 2
    return [f.cx + f.r * Math.cos(t), f.cy + f.r * Math.sin(t)]
  }
  return [(a.x + c.x) / 2, (a.y + c.y) / 2]
}

/**
 * Editor de perfil 2D amb corbes de Bézier cúbiques compostes (com la ploma d'Illustrator o
 * Figma):
 * - Editar: arrossega nodes i manegadors; doble clic a un node el fa suau o cantonada; el
 *   cercle del mig d'un costat hi afegeix un node (clic) o el corba (arrossegar); Alt en
 *   arrossegar un manegador el trenca (cantonada); Supr, fletxes.
 * - Ploma: clic = node de cantonada, clic i arrossegar = node suau amb manegadors; clicar el
 *   primer node tanca la forma.
 * Imant a la quadrícula (Maj: 1 mm). No deixa aplicar un contorn que es talli a si mateix.
 */
export function ProfileEditor({
  open,
  initial,
  axes,
  onClose,
  onApply,
}: {
  open: boolean
  initial: PNode[]
  /** Noms dels eixos (u, v) per als rètols, p. ex. ["Ample", "Alt"]. */
  axes: [string, string]
  onClose: () => void
  onApply: (p: { points: PNode[]; w: number; h: number }) => void
}) {
  const [nodes, setNodes] = useState<PNode[]>(initial)
  const [sel, setSel] = useState<number | null>(null)
  const [tool, setTool] = useState<"edit" | "pen" | "bend" | "erase">("edit")
  const [radius, setRadius] = useState(20)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [cursor, setCursor] = useState<Vec2 | null>(null)
  const before = useRef<PNode[]>(initial)
  const svg = useRef<SVGSVGElement>(null)
  // Només en obrir-se: el pare pot tornar a renderitzar amb un `initial` nou (mateix contingut).
  const initialRef = useRef(initial)
  initialRef.current = initial
  useEffect(() => {
    if (open) {
      setNodes(initialRef.current)
      setView(viewOf(initialRef.current))
      setSel(null)
      setTool("edit")
    }
  }, [open])

  const drawing = tool === "pen"
  const closed = !drawing && nodes.length >= 3
  // Vista: es congela mentre s'arrossega o es dibuixa perquè el dibuix no salti.
  const [view, setView] = useState(() => viewOf(initial))
  useEffect(() => {
    if (drag === null && !drawing && nodes.length >= 2) setView(viewOf(nodes))
  }, [nodes, drag, drawing])

  const sample = useMemo(() => (nodes.length >= 2 ? sampleProfile(nodes) : nodes.map((n) => [n.x, n.y] as Vec2)), [nodes])
  const bad = closed && selfIntersects(sample)
  const b = bounds(sample.length ? sample : [[0, 0]])
  const area = closed ? polygonArea(sample) : 0
  const unit = view.span / 100
  const minor = view.span > 1500 ? 50 : view.span > 400 ? 10 : 5
  const major = minor * 10

  const toMm = (e: { clientX: number; clientY: number }): Vec2 => {
    const el = svg.current
    if (!el) return [0, 0]
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const q = pt.matrixTransform(el.getScreenCTM()!.inverse())
    return [q.x, -q.y]
  }
  const snap = (v: number, fine: boolean) => (fine ? r1(v) : Math.round(v / minor) * minor)
  const set = (i: number, n: PNode) => setNodes((cur) => cur.map((q, k) => (k === i ? n : q)))

  const remove = (i: number) => {
    if (nodes.length <= 3) return
    setNodes((cur) => cur.filter((_, k) => k !== i))
    setSel(null)
  }
  const toggleSmooth = (i: number) => {
    const n = nodes[i]!
    if (n.in || n.out) set(i, { x: n.x, y: n.y })
    else set(i, autoHandles(nodes, i))
  }
  const setType = (i: number, t: "corner" | "smooth" | "symmetric") => {
    const n = nodes[i]!
    if (!n.in && !n.out && t !== "corner") {
      set(i, { ...autoHandles(nodes, i), t })
      return
    }
    let next: PNode = { ...n, t }
    // En passar a suau o simètric, alinea el manegador d'entrada amb el de sortida.
    if (t !== "corner" && n.out) next = moveHandle(next, "out", n.out)
    set(i, next)
  }
  const startPen = () => {
    before.current = nodes
    setNodes([])
    setSel(null)
    setTool("pen")
  }
  const cancelPen = () => {
    setNodes(before.current)
    setTool("edit")
    setCursor(null)
  }
  const finishPen = () => {
    if (nodes.length >= 3) {
      setTool("edit")
      setCursor(null)
    }
  }

  // Teclat.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return
      if (drawing) {
        if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          cancelPen()
        } else if (e.key === "Enter") finishPen()
        return
      }
      if (sel === null) return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        remove(sel)
        return
      }
      const k = e.shiftKey ? 10 : 1
      const d = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, k], ArrowDown: [0, -k] }[e.key]
      if (!d) return
      e.preventDefault()
      const p = nodes[sel]!
      set(sel, { ...p, x: r1(p.x + d[0]!), y: r1(p.y + d[1]!) })
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  })

  const capture = (e: ReactPointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  const onBackgroundDown = (e: ReactPointerEvent) => {
    if (!drawing) {
      setSel(null)
      return
    }
    // Ploma: nou node (si és a prop del primer, tanca la forma).
    const [x, y] = toMm(e)
    const first = nodes[0]
    if (first && nodes.length >= 3 && Math.hypot(first.x - x, first.y - y) < unit * 2.5) {
      finishPen()
      return
    }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const p: PNode = { x: snap(x, e.shiftKey), y: snap(y, e.shiftKey) }
    setNodes((cur) => [...cur, p])
    setDrag({ kind: "pen", i: nodes.length, x: e.clientX, y: e.clientY, moved: false })
  }
  const onMove = (e: ReactPointerEvent) => {
    const at = toMm(e)
    if (drawing) setCursor(at)
    if (!drag) return
    if (!drag.moved && drag.kind !== "handle" && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3) return
    if (!drag.moved) setDrag({ ...drag, moved: true })
    const [x, y] = at
    if (drag.kind === "node") {
      const n = nodes[drag.i]!
      set(drag.i, { ...n, x: snap(x, e.shiftKey), y: snap(y, e.shiftKey) })
    } else if (drag.kind === "handle") {
      const n = nodes[drag.i]!
      const h: Vec2 = [r1(x - n.x), r1(y - n.y)]
      set(drag.i, moveHandle(e.altKey ? { ...n, t: "corner" } : n, drag.which, h))
    } else if (drag.kind === "edge") {
      setNodes((cur) => bendEdge(cur, drag.i, [x, y]))
    } else {
      // Ploma arrossegant: manegadors simètrics del node nou.
      const n = nodes[drag.i]!
      const h: Vec2 = [r1(x - n.x), r1(y - n.y)]
      set(drag.i, { x: n.x, y: n.y, out: h, in: [-h[0], -h[1]], t: "symmetric" })
    }
  }
  const onUp = () => {
    if (drag?.kind === "edge" && !drag.moved) {
      setNodes((cur) => splitEdge(cur, drag.i))
      setSel(drag.i + 1)
    }
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

  // Nodes amb manegadors visibles: el seleccionat i els seus veïns (com a Illustrator).
  const showHandles = new Set<number>()
  if (sel !== null && nodes.length) {
    const n = nodes.length
    showHandles.add(sel)
    showHandles.add((sel + 1) % n)
    showHandles.add((sel - 1 + n) % n)
  }
  if (drawing && nodes.length) showHandles.add(nodes.length - 1)

  // Tram provisional de la ploma: de l'últim node al cursor.
  const last = nodes[nodes.length - 1]
  const preview = drawing && last && cursor && !drag ? `M ${last.x} ${-last.y} C ${last.x + (last.out?.[0] ?? 0)} ${-(last.y + (last.out?.[1] ?? 0))} ${cursor[0]} ${-cursor[1]} ${cursor[0]} ${-cursor[1]}` : null
  const selNode = sel !== null ? nodes[sel] : undefined
  const selType = selNode ? (selNode.in || selNode.out ? (selNode.t ?? "corner") : "corner") : "corner"
  const canFillet = sel !== null && filletNode(nodes, sel, radius) !== null
  const stroke = bad ? "#dc2626" : "#6b7280"

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="xl" placement="center" closeOnEscape={!drawing} closeOnInteractOutside={false}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="1000px">
            <Dialog.Header>
              <Dialog.Title>Forma de la secció</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                <HStack gap={2} wrap="wrap" justify="space-between">
                  {/* Eines, com al mode d'edició de vectors de Figma. */}
                  <HStack gap={0.5} p={0.5} rounded="md" bg="bg.muted">
                    {(
                      [
                        ["edit", "Moure", LuMousePointer2, "Arrossega nodes i manegadors"],
                        ["pen", "Ploma", LuPenTool, "Dibuixa una forma nova node a node"],
                        ["bend", "Corbar", LuSpline, "Arrossega un costat per corbar-lo; clic a un node el fa suau o cantonada"],
                        ["erase", "Esborrar", LuEraser, "Clic a un node per treure'l"],
                      ] as const
                    ).map(([id, label, Icon, title]) => (
                      <Button
                        key={id}
                        size="xs"
                        title={title}
                        variant={tool === id ? "solid" : "ghost"}
                        colorPalette={tool === id ? "blue" : "gray"}
                        disabled={drawing && id !== "pen" && nodes.length < 3}
                        onClick={() => {
                          if (id === "pen") {
                            if (drawing) cancelPen()
                            else startPen()
                            return
                          }
                          if (drawing) finishPen()
                          setTool(id)
                        }}
                      >
                        <Icon /> {id === "pen" && drawing ? "Cancel·lar" : label}
                      </Button>
                    ))}
                  </HStack>
                  <HStack gap={1} wrap="wrap">
                    {PRESETS.map((p) => (
                      <Button
                        key={p.id}
                        size="xs"
                        variant="ghost"
                        disabled={drawing}
                        onClick={() => {
                          setNodes(p.make(Math.max(50, r1(b.x1 - b.x0)), Math.max(50, r1(b.y1 - b.y0))))
                          setSel(null)
                        }}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </HStack>
                </HStack>
                <Stack direction={{ base: "column", md: "row" }} gap={3} align="stretch">
                  <Box flex={1} minW={0} borderWidth="1px" rounded="md" bg="bg.subtle" overflow="hidden">
                    <svg
                      ref={svg}
                      viewBox={`${view.x0} ${-(view.y0 + view.span)} ${view.span} ${view.span}`}
                      style={{ width: "100%", aspectRatio: "1", display: "block", touchAction: "none", userSelect: "none", cursor: drawing ? "crosshair" : "default" }}
                      onPointerMove={onMove}
                      onPointerUp={onUp}
                      onPointerDown={onBackgroundDown}
                      onPointerLeave={() => setCursor(null)}
                    >
                      {gridLines.map((l, i) => (
                        <line key={i} {...l} stroke="var(--chakra-colors-border)" strokeWidth={l.major ? unit * 0.25 : unit * 0.1} />
                      ))}
                      {closed ? (
                        <polygon points={sample.map(([x, y]) => `${x},${-y}`).join(" ")} fill={bad ? "rgba(220,38,38,0.12)" : "rgba(124,58,237,0.08)"} stroke={stroke} strokeWidth={unit * 0.3} strokeLinejoin="round" />
                      ) : (
                        nodes.length >= 2 && <path d={openPath(nodes)} fill="none" stroke={stroke} strokeWidth={unit * 0.4} />
                      )}
                      {preview && <path d={preview} fill="none" stroke={stroke} strokeWidth={unit * 0.3} strokeDasharray={`${unit} ${unit}`} />}
                      {/* Costats: mida i cercle del mig (clic = node nou, arrossegar = corbar). */}
                      {closed &&
                        nodes.map((a, i) => {
                          const c = nodes[(i + 1) % nodes.length]!
                          const [mx, my] = edgeMid(nodes, i)
                          const e = edgeOf(nodes, i)
                          const chord = Math.hypot(c.x - a.x, c.y - a.y)
                          return (
                            <g key={`e${i}`}>
                              {e.kind === "line" && (
                                <text x={mx} y={-my - unit * 2.4} fontSize={unit * 2.4} textAnchor="middle" fill="var(--chakra-colors-fg-muted)" style={{ pointerEvents: "none" }}>
                                  {Math.round(chord)}
                                </text>
                              )}
                              <g
                                onPointerDown={(ev) => {
                                  capture(ev)
                                  setDrag({ kind: "edge", i, x: ev.clientX, y: ev.clientY, moved: false })
                                }}
                                style={{ cursor: "pointer" }}
                              >
                                <title>Clic: afegir un node · Arrossegar: corbar el costat</title>
                                <circle cx={mx} cy={-my} r={unit * (tool === "bend" ? 1.4 : 0.9)} fill={tool === "bend" ? HANDLE : "#fff"} fillOpacity={tool === "bend" ? 0.25 : 1} stroke={HANDLE} strokeWidth={unit * 0.2} strokeDasharray={tool === "bend" ? undefined : `${unit * 0.4} ${unit * 0.3}`} />
                              </g>
                            </g>
                          )
                        })}
                      {/* Manegadors. */}
                      {nodes.map((n, i) =>
                        showHandles.has(i)
                          ? (["in", "out"] as const).map((which) => {
                              const h = n[which]
                              if (!h) return null
                              const hx = n.x + h[0], hy = n.y + h[1]
                              return (
                                <g key={`h${i}${which}`}>
                                  <line x1={n.x} y1={-n.y} x2={hx} y2={-hy} stroke="#9ca3af" strokeWidth={unit * 0.2} />
                                  {/* Manegador en rombe (com a Figma). */}
                                  <rect
                                    x={hx - unit * 0.9}
                                    y={-hy - unit * 0.9}
                                    width={unit * 1.8}
                                    height={unit * 1.8}
                                    transform={`rotate(45 ${hx} ${-hy})`}
                                    fill="#fff"
                                    stroke={HANDLE}
                                    strokeWidth={unit * 0.3}
                                    style={{ cursor: "grab" }}
                                    onPointerDown={(ev) => {
                                      if (drawing) return
                                      capture(ev)
                                      setSel(i)
                                      setDrag({ kind: "handle", i, which, moved: false })
                                    }}
                                  />
                                </g>
                              )
                            })
                          : null,
                      )}
                      {/* Nodes: quadrat = cantonada, cercle = suau. */}
                      {nodes.map((n, i) => {
                        const smooth = !!(n.in || n.out)
                        const s = unit * (sel === i ? 1.9 : 1.5)
                        const common = {
                          fill: sel === i ? HANDLE : drawing && i === 0 && nodes.length >= 3 ? "#16a34a" : "#fff",
                          stroke: HANDLE,
                          strokeWidth: unit * 0.35,
                          style: { cursor: drawing ? (i === 0 ? "pointer" : "default") : tool === "erase" ? "not-allowed" : tool === "bend" ? "pointer" : "grab" },
                          onPointerDown: (ev: ReactPointerEvent) => {
                            if (drawing) {
                              if (i === 0 && nodes.length >= 3) {
                                ev.stopPropagation()
                                finishPen()
                              }
                              return
                            }
                            if (tool === "erase") {
                              ev.stopPropagation()
                              remove(i)
                              return
                            }
                            if (tool === "bend") {
                              ev.stopPropagation()
                              setSel(i)
                              toggleSmooth(i)
                              return
                            }
                            capture(ev)
                            setSel(i)
                            setDrag({ kind: "node", i, x: ev.clientX, y: ev.clientY, moved: false })
                          },
                          onDoubleClick: () => !drawing && toggleSmooth(i),
                        }
                        return smooth ? <circle key={`n${i}`} cx={n.x} cy={-n.y} r={s} {...common} /> : <rect key={`n${i}`} x={n.x - s} y={-n.y - s} width={2 * s} height={2 * s} {...common} />
                      })}
                    </svg>
                  </Box>
                  <Stack w={{ base: "full", md: "280px" }} gap={2} maxH={{ md: "560px" }} overflowY="auto" flexShrink={0}>
                    <HStack justify="space-between">
                      <Text textStyle="sm" fontWeight="semibold">
                        {drawing ? "Dibuixant" : sel !== null ? `Node ${sel + 1}` : "Forma"}
                      </Text>
                      <Badge size="sm" colorPalette={bad ? "red" : "wood"}>
                        {Math.round(b.x1 - b.x0)} × {Math.round(b.y1 - b.y0)}
                      </Badge>
                    </HStack>
                    {drawing ? (
                      <Text textStyle="xs" color="fg.muted">
                        Clic: node de cantonada. Clic i arrossegar: node suau (defineixes la corba). Clica el primer node (verd) o prem <Kbd>Retorn</Kbd> per tancar la forma; <Kbd>Esc</Kbd> la descarta.
                      </Text>
                    ) : selNode ? (
                      <>
                        <HStack gap={1} align="end">
                          <NumberField label={axes[0]} value={selNode.x} step={1} onChange={(v) => Number.isFinite(v) && set(sel!, { ...selNode, x: v })} />
                          <NumberField label={axes[1]} value={selNode.y} step={1} onChange={(v) => Number.isFinite(v) && set(sel!, { ...selNode, y: v })} />
                          <IconButton aria-label="Treure el node" size="sm" variant="ghost" disabled={nodes.length <= 3} onClick={() => remove(sel!)}>
                            <LuTrash2 />
                          </IconButton>
                        </HStack>
                        <Text textStyle="xs" color="fg.muted">
                          Reflex dels manegadors
                        </Text>
                        <SegmentGroup.Root size="xs" w="full" value={selType} onValueChange={(e) => e.value && setType(sel!, e.value as "corner" | "smooth" | "symmetric")}>
                          <SegmentGroup.Indicator />
                          {(
                            [
                              ["corner", "Sense reflex"],
                              ["smooth", "Angle"],
                              ["symmetric", "Angle i llarg"],
                            ] as const
                          ).map(([v, label]) => (
                            <SegmentGroup.Item key={v} value={v} flex={1}>
                              <SegmentGroup.ItemText>{label}</SegmentGroup.ItemText>
                              <SegmentGroup.ItemHiddenInput />
                            </SegmentGroup.Item>
                          ))}
                        </SegmentGroup.Root>
                        <HStack gap={1} align="end">
                          <NumberField label="Radi de cantonada" value={radius} min={1} max={2000} step={5} onChange={(v) => Number.isFinite(v) && v > 0 && setRadius(v)} />
                          <Button size="sm" variant="outline" disabled={!canFillet} onClick={() => {
                            const next = filletNode(nodes, sel!, radius)
                            if (next) {
                              setNodes(next)
                              setSel(null)
                            }
                          }}>
                            <LuSpline /> Arrodonir
                          </Button>
                        </HStack>
                        {(selNode.in || selNode.out) && (
                          <Button size="xs" variant="ghost" alignSelf="flex-start" onClick={() => set(sel!, { x: selNode.x, y: selNode.y })}>
                            Treure els manegadors (cantonada recta)
                          </Button>
                        )}
                      </>
                    ) : (
                      <Text textStyle="xs" color="fg.muted">
                        Tria un node per moure'l amb precisió, canviar-ne el tipus o arrodonir-lo.
                      </Text>
                    )}
                    <Stack gap={0.5} borderTopWidth="1px" pt={2}>
                      <Text textStyle="xs" color="fg.muted">
                        Com funciona
                      </Text>
                      <Text textStyle="xs" color="fg.muted">
                        · Quadrat = cantonada; cercle = node amb corba. Doble clic (o l'eina Corbar) canvia l'un per l'altre.
                      </Text>
                      <Text textStyle="xs" color="fg.muted">
                        · Els manegadors (taronja) donen la direcció i la força de la corba; amb <Kbd>Alt</Kbd> es trenquen.
                      </Text>
                      <Text textStyle="xs" color="fg.muted">
                        · El punt del mig d'un costat: clic hi afegeix un node; arrossegar-lo corba el costat.
                      </Text>
                      <Text textStyle="xs" color="fg.muted">
                        · Imant de {minor} mm (<Kbd>Maj</Kbd>: lliure). <Kbd>Supr</Kbd> treu el node; fletxes l'afinen.
                      </Text>
                    </Stack>
                  </Stack>
                </Stack>
                <Text textStyle="xs" color={bad ? "fg.error" : "fg.muted"}>
                  {bad ? "El contorn es talla a si mateix: mou algun node o manegador." : closed ? `${nodes.length} nodes · àrea ${(area / 1e6).toFixed(3)} m². Les corbes es tallen com a arcs (error < 0,02 mm).` : " "}
                </Text>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
              <Button colorPalette="wood" disabled={bad || drawing || nodes.length < 3} onClick={() => onApply(normalizeNodes(nodes))}>
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

/** Traç obert (mentre es dibuixa amb la ploma): cada costat com a cúbica o recta, sense tancar. */
function openPath(nodes: PNode[]): string {
  let d = `M ${nodes[0]!.x} ${-nodes[0]!.y}`
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i]!
    const c = nodes[i + 1]!
    const e = edgeOf(nodes, i)
    d += e.kind === "cubic" ? ` C ${e.p1[0]} ${-e.p1[1]} ${e.p2[0]} ${-e.p2[1]} ${c.x} ${-c.y}` : ` L ${c.x} ${-c.y}`
    void a
  }
  return d
}

/** Vista quadrada que conté el perfil (amb les corbes) amb marge. */
function viewOf(nodes: PNode[]): { x0: number; y0: number; span: number } {
  const pts = nodes.length >= 2 ? sampleProfile(nodes) : nodes.map((n) => [n.x, n.y] as Vec2)
  const b = bounds(pts.length ? pts : [[0, 0]])
  const w = b.x1 - b.x0
  const h = b.y1 - b.y0
  const span = Math.max(w, h, 100) * 1.3
  return { x0: b.x0 + w / 2 - span / 2, y0: b.y0 + h / 2 - span / 2, span }
}
