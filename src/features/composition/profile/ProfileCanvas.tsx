import { Box } from "@chakra-ui/react"
import { useMemo, type PointerEvent as ReactPointerEvent } from "react"
import { edgeOf, type Vec2 } from "../../../core/model"
import { edgeMid, gridLinesOf, openPath } from "./profileGeometry"
import type { ProfileShape } from "./useProfileShape"
import type { useProfilePointer } from "./useProfilePointer"

/** Blau dels nodes i manegadors (com a Figma). */
const HANDLE = "#1e88e5"

/**
 * El dibuix del perfil: quadrícula, forma (tancada o el traç de la ploma), costats amb la mida i el cercle del mig,
 * manegadors i nodes. `sample`: la forma mostrejada; `closed`: forma tancada; `bad`: es talla a si mateixa.
 */
export function ProfileCanvas({ shape, pointer, sample, closed, bad, unit, minor }: { shape: ProfileShape; pointer: ReturnType<typeof useProfilePointer>; sample: Vec2[]; closed: boolean; bad: boolean; unit: number; minor: number }) {
  const { nodes, sel, tool, drag, angleLock, cursor, setCursor, drawing, view } = shape
  const { svg, onMove, onUp, onBackgroundDown, onEdgeDown, onHandleDown, onNodeDown, onNodeDoubleClick } = pointer
  const major = minor * 10
  const gridLines = useMemo(() => gridLinesOf(view, minor, major), [view, minor, major])

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
  const stroke = bad ? "#dc2626" : "#6b7280"

  return (
    <Box flex={1} minW={0} display="flex" justifyContent="center" alignItems="flex-start">
    <Box w="full" maxW={{ md: "var(--profile-canvas)" }} borderWidth="1px" rounded="md" bg="bg.subtle" overflow="hidden">
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
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--chakra-colors-border)" strokeWidth={l.major ? unit * 0.25 : unit * 0.1} />
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
                  onPointerDown={(ev) => onEdgeDown(ev, i)}
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
                    <line x1={n.x} y1={-n.y} x2={hx} y2={-hy} stroke={angleLock && drag?.i === i ? "#ef4444" : "#9ca3af"} strokeWidth={unit * 0.2} />
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
                      onPointerDown={(ev) => onHandleDown(ev, i, which)}
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
            onPointerDown: (ev: ReactPointerEvent) => onNodeDown(ev, i),
            onDoubleClick: () => onNodeDoubleClick(i),
          }
          return smooth ? <circle key={`n${i}`} cx={n.x} cy={-n.y} r={s} {...common} /> : <rect key={`n${i}`} x={n.x - s} y={-n.y - s} width={2 * s} height={2 * s} {...common} />
        })}
      </svg>
    </Box>
    </Box>
  )
}
