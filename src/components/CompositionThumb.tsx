import { Box } from "@chakra-ui/react"
import { useMemo } from "react"
import { buildComposition } from "../core/build/buildComposition"
import type { Composition, PanelRole } from "../core/model"
import { useSettings } from "../features/settings/SettingsContext"
import { finishRgb, resolveFinish } from "./viewer/textures"

const FRONT: ReadonlySet<PanelRole> = new Set<PanelRole>(["door", "drawerFront", "flap", "grille", "hatch", "panel"])

/**
 * Miniatura de l'alçat frontal d'una composició (per a la galeria de plantilles i la
 * llista de mobles). Projecta cada peça sobre X/Y i les pinta de darrere a davant.
 */
export function CompositionThumb({ composition, h = "96px" }: { composition: Composition; h?: string }) {
  const { settings } = useSettings()
  const materials = settings.materials
  const shapes = useMemo(() => {
    let panels
    let extras
    try {
      const b = buildComposition(composition)
      panels = b.panels
      // Peces sense nesting (ferro, pedra, objectes): amb el color del seu material.
      extras = b.extras
    } catch {
      return null
    }
    const rects = [...panels, ...extras].map((p) => {
      const { origin, xAxis, yAxis, zAxis } = p.placement
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z1 = -Infinity
      for (const a of [0, p.length])
        for (const b of [0, p.width])
          for (const c of [0, p.thickness]) {
            const x = origin[0] + a * xAxis[0] + b * yAxis[0] + c * zAxis[0]
            const y = origin[1] + a * xAxis[1] + b * yAxis[1] + c * zAxis[1]
            const z = origin[2] + a * xAxis[2] + b * yAxis[2] + c * zAxis[2]
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z1 = Math.max(z1, z)
          }
      const extra = extras.includes(p)
      const [r, g, b] = extra ? finishRgb(resolveFinish(materials, p.material)) : [0, 0, 0]
      return { x0, x1, y0, y1, z1, front: FRONT.has(p.role), fill: extra ? `rgb(${r * 255}, ${g * 255}, ${b * 255})` : undefined }
    })
    if (!rects.length) return null
    const minX = Math.min(...rects.map((r) => r.x0))
    const maxX = Math.max(...rects.map((r) => r.x1))
    const minY = Math.min(...rects.map((r) => r.y0))
    const maxY = Math.max(...rects.map((r) => r.y1))
    rects.sort((a, b) => a.z1 - b.z1)
    return { rects, minX, maxX, minY, maxY }
  }, [composition, materials])

  if (!shapes) return <Box h={h} bg="bg.muted" rounded="md" />
  const pad = Math.max(shapes.maxX - shapes.minX, shapes.maxY - shapes.minY) * 0.06
  const vb = `${shapes.minX - pad} ${-shapes.maxY - pad} ${shapes.maxX - shapes.minX + 2 * pad} ${shapes.maxY - shapes.minY + 2 * pad}`
  return (
    <Box h={h} bg="bg.muted" rounded="md" p={1}>
      <svg viewBox={vb} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden>
        {shapes.rects.map((r, i) => (
          <rect
            key={i}
            x={r.x0}
            y={-r.y1}
            width={Math.max(r.x1 - r.x0, 1)}
            height={Math.max(r.y1 - r.y0, 1)}
            fill={r.fill ?? (r.front ? "var(--chakra-colors-wood-emphasized)" : "var(--chakra-colors-wood-muted)")}
            stroke="var(--chakra-colors-fg-muted)"
            // 1 px de pantalla: amb non-scaling-stroke el gruix ja no depèn de l'escala.
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </Box>
  )
}
