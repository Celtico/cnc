import { Button, HStack } from "@chakra-ui/react"
import { useMemo } from "react"
import { LuEraser, LuMousePointer2, LuPenTool, LuSpline, LuX } from "react-icons/lu"
import { sampleProfile, type bounds, type PNode } from "../../../core/model"
import { segGroup, segItem } from "../../../components/segmented"
import { UndoRedo } from "../../../components/UndoRedo"
import { PRESETS } from "../profilePresets"
import type { ProfileShape } from "./useProfileShape"
import { roundTo } from "../../../lib/format"
import { IconAction } from "../../../components/IconAction"

/** Eines (Moure, Ploma, Corbar, Esborrar), desfer/refer i les formes de partida. `b`: la mida de la forma d'ara. */
export function ProfileToolbar({ shape, b }: { shape: ProfileShape; b: ReturnType<typeof bounds> }) {
  const { history, nodes, setNodes, setSel, tool, setTool, drawing, startPen, cancelPen, finishPen, undo, redo } = shape
  return (
    <HStack gap={2} wrap="wrap" justify="space-between">
      {/* Eines, com al mode d'edició de vectors de Figma (el control segmentat comú, com les eines de la Foto). */}
      <HStack gap={2} wrap="wrap">
        <HStack {...segGroup}>
          {(
            [
              ["edit", "Moure", LuMousePointer2, "Arrossega nodes i manegadors"],
              ["pen", "Ploma", LuPenTool, "Dibuixa una forma nova node a node"],
              ["bend", "Corbar", LuSpline, "Arrossega un costat per corbar-lo; clic a un node el fa suau o cantonada"],
              ["erase", "Esborrar", LuEraser, "Clic a un node per eliminar-lo"],
            ] as const
          ).map(([id, label, Icon, title]) => (
            <Button
              key={id}
              {...segItem(tool === id || (id === "pen" && drawing))}
              title={title}
              aria-pressed={tool === id}
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
              {id === "pen" && drawing ? <LuX /> : <Icon />} {id === "pen" && drawing ? "Cancel·lar" : label}
            </Button>
          ))}
        </HStack>
        <UndoRedo size="xs" canUndo={history.canUndo || (drawing && nodes.length === 0)} canRedo={history.canRedo} undo={undo} redo={redo} />
      </HStack>
      <HStack gap={1} wrap="wrap">
        {PRESETS.map((p) => (
          <IconAction
            key={p.id}
            size="xs"
            variant="ghost"
            label={`Començar amb: ${p.label}`}
            disabled={drawing}
            onClick={() => {
              setNodes(p.make(Math.max(50, roundTo(b.x1 - b.x0, 1)), Math.max(50, roundTo(b.y1 - b.y0, 1))))
              setSel(null)
            }}
          >
            <PresetIcon make={p.make} />
          </IconAction>
        ))}
      </HStack>
    </HStack>
  )
}

/** Icona d'una forma de partida: la mateixa forma, petita (així sempre coincideix). */
function PresetIcon({ make }: { make: (w: number, h: number) => PNode[] }) {
  const d = useMemo(() => {
    const pts = sampleProfile(make(100, 100), 8)
    return pts.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${100 - y}`).join(" ") + " Z"
  }, [make])
  return (
    <svg viewBox="-10 -10 120 120" width="16" height="16" aria-hidden style={{ flexShrink: 0 }}>
      <path d={d} fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth={10} strokeLinejoin="round" />
    </svg>
  )
}
