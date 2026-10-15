import { Box } from "@chakra-ui/react"
import type { Ambient, PlanPt } from "../../core/model"
import type { ItemGeometry } from "./ambientData"
import type { Selection, Tool } from "./planGeom"
import { C } from "./plan/planStyle"
import { PlanItems } from "./plan/PlanItems"
import { PlanRoof } from "./plan/PlanRoof"
import { PlanToolOverlays } from "./plan/PlanToolOverlays"
import { PlanWallHandles } from "./plan/PlanWallHandles"
import { PlanOpenings, PlanWallDims, PlanWalls } from "./plan/PlanWalls"
import { PlanZoomBar } from "./plan/PlanZoomBar"
import { usePlanPointer } from "./plan/usePlanPointer"
import { usePlanTools } from "./plan/usePlanTools"
import { usePlanView, usePlanWheel, zoomAt } from "./plan/usePlanView"

interface PlanShow {
  grid: boolean
  dims: boolean
  labels: boolean
  detail: boolean
  snap: boolean
  plan: boolean
}
const PLAN_SHOW_ALL: PlanShow = { grid: true, dims: true, labels: true, detail: true, snap: true, plan: true }

/**
 * Plànol de l'ambient (SVG, vista de dalt): la roda fa zoom al punt del ratolí (com al 3D),
 * pessigar també; arrossegar el fons (o espai + arrossegar) desplaça; Maj + roda, de costat.
 * Botons − / + amb el percentatge a baix a la dreta. Eines:
 * **Seleccionar** (moure elements i parets, arrossegar els extrems de les parets), **Paret**
 * (ploma: clic a clic, angle a 15° i imant als extrems; clicar el primer punt tanca; Retorn,
 * Esc o doble clic acaben), **Habitació** (arrossegar un rectangle: quatre parets) i
 * **Calibrar** (dos punts sobre el plànol de fons). Maj: sense angles; Alt: sense imant.
 */
export function PlanCanvas({
  ambient,
  geos,
  names,
  selection,
  selectedIds,
  onSelect,
  onPickItem,
  onPickWall,
  selectedWallIds = [],
  tool,
  onToolDone,
  onChange,
  wallDefaults,
  onCalibrate,
  fitSignal,
  onFramedChange,
  show = PLAN_SHOW_ALL,
}: {
  /** La vista és la d'«Encabir» (el botó surt marcat) o s'ha mogut. */
  onFramedChange?: (framed: boolean) => void
  /** Opcions de vista: graella, mides de les parets, noms, detall de les peces, imant. */
  show?: PlanShow
  ambient: Ambient
  geos: Map<string, ItemGeometry | null>
  names: Map<string, string>
  selection: Selection
  /** Elements seleccionats (un, o tots els d'un grup). */
  selectedIds: string[]
  onSelect: (s: Selection) => void
  /** Clic a un element: tria què se selecciona (el grup o l'element, com Figma) i torna els ids a moure. */
  onPickItem: (id: string) => string[]
  /** Clic a una paret: tria què se selecciona (la paret, el seu grup o, amb Maj, la selecció múltiple) i torna els ids a moure. */
  onPickWall?: (id: string) => string[]
  /** Parets triades a la selecció múltiple o d'un grup (es marquen com la triada). */
  selectedWallIds?: string[]
  tool: Tool
  onToolDone: () => void
  /** `commit`: afegir un pas de desfer (en deixar anar); si no, és un canvi en viu. */
  onChange: (a: Ambient, commit: boolean) => void
  wallDefaults: { thickness: number; height: number }
  onCalibrate: (a: PlanPt, b: PlanPt) => void
  /** Canvia per tornar a encabir la vista. */
  fitSignal: number
}) {
  const { host, size, view, setView, toWorld } = usePlanView({ ambient, geos, fitSignal, onFramedChange })
  const tools = usePlanTools({ tool, onToolDone })
  const { room, chain, setChain, penOut, penStraight, cursor, setCursor, calib } = tools
  usePlanWheel(host, setView)
  const pointer = usePlanPointer({ ambient, geos, tool, snap: show.snap, wallDefaults, onChange, onSelect, onToolDone, onCalibrate, onPickItem, onPickWall, host, view, setView, toWorld, tools })

  const px = (n: number) => n / view.s
  const selWall = selection?.kind === "wall" ? ambient.walls.find((w) => w.id === selection.id) : undefined
  const cursorStyle = tool === "select" ? (pointer.panning ? "grabbing" : "default") : "crosshair"

  return (
    <Box
      ref={host}
      position="absolute"
      inset={0}
      overflow="hidden"
      bg="bg.subtle"
      rounded="md"
      borderWidth="1px"
      style={{ touchAction: "none", cursor: cursorStyle }}
      onPointerDown={pointer.onDown}
      onPointerMove={pointer.onMove}
      onPointerUp={pointer.onUp}
      onPointerCancel={pointer.onUp}
      onPointerLeave={() => setCursor(null)}
      onDoubleClick={() => {
        if (tool === "wall") {
          setChain([])
          onToolDone()
        }
      }}
    >
      <svg width={size.w} height={size.h} style={{ display: "block", userSelect: "none" }} aria-label="Plànol de l'ambient">
        <defs>
          <pattern id="amb-grid" width={100} height={100} patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke={C.grid} strokeWidth={px(0.5)} />
          </pattern>
          <pattern id="amb-grid-major" width={1000} height={1000} patternUnits="userSpaceOnUse">
            <rect width={1000} height={1000} fill="url(#amb-grid)" />
            <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke={C.gridMajor} strokeWidth={px(1)} />
          </pattern>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
          <rect x={(-view.tx) / view.s} y={(-view.ty) / view.s} width={size.w / view.s} height={size.h / view.s} fill={show.grid && view.s > 0.03 ? "url(#amb-grid-major)" : "none"} />

          {ambient.plan && show.plan && (
            <image
              href={ambient.plan.src}
              x={ambient.plan.x}
              y={ambient.plan.y}
              width={ambient.plan.pxW * ambient.plan.mmPerPx}
              height={ambient.plan.pxH * ambient.plan.mmPerPx}
              opacity={ambient.plan.opacity}
              preserveAspectRatio="none"
              style={{ cursor: tool === "select" && ambient.plan.locked === false ? "move" : undefined, pointerEvents: tool === "select" && ambient.plan.locked === false ? "auto" : "none" }}
              onPointerDown={pointer.startPlan}
            />
          )}

          <PlanItems ambient={ambient} geos={geos} names={names} selection={selection} selectedIds={selectedIds} tool={tool} s={view.s} showDetail={show.detail} showLabels={show.labels} onStartItem={pointer.startItem} />
          <PlanWalls walls={ambient.walls} selWall={selWall} selectedWallIds={selectedWallIds} tool={tool} s={view.s} onStartWall={pointer.startWall} />
          <PlanRoof ambient={ambient} s={view.s} />
          <PlanOpenings walls={ambient.walls} selWall={selWall} tool={tool} s={view.s} onStartOpening={pointer.startOpening} />

          {/* Mides de les parets (quan hi caben). */}
          {show.dims && view.s > 0.035 && <PlanWallDims walls={ambient.walls} s={view.s} />}

          {selWall && <PlanWallHandles selWall={selWall} s={view.s} onStartCtrl={pointer.startCtrl} onStartEnd={pointer.startEnd} />}

          <PlanToolOverlays tool={tool} chain={chain} cursor={cursor} penOut={penOut} penStraight={penStraight} room={room} calib={calib} wallThickness={wallDefaults.thickness} s={view.s} />
        </g>
      </svg>
      <PlanZoomBar s={view.s} onZoom={(k) => setView((v) => zoomAt(v, size.w / 2, size.h / 2, k))} />
    </Box>
  )
}
