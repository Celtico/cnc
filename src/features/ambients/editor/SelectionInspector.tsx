import { Stack } from "@chakra-ui/react"
import { alignItems, distributeItems, newItemGroupName, removeItems, setItemGroup, setWallGroup, type Ambient, type AmbientSummary, type Composition, type MaterialPref } from "../../../core/model"
import type { Project } from "../../../db/db"
import type { ItemGeometry } from "../ambientData"
import { ambientBox } from "../planGeom"
import { AmbientInspector } from "./AmbientInspector"
import { ItemInspector } from "./ItemInspector"
import { MultiInspector } from "./MultiInspector"
import type { AmbientActions } from "./useAmbientActions"
import type { AmbientSelection } from "./useAmbientSelection"
import { WallInspector } from "./WallInspector"

/** Propietats del que hi ha seleccionat: un element, una selecció múltiple, un grup, una paret o l'ambient. */
export function SelectionInspector({
  name,
  amb,
  change,
  selection,
  actions,
  geos,
  names,
  projects,
  materials,
  groups,
  summary,
  wallDefaults,
  onWallDefaults,
  onResize,
  onOpenProject,
  onImportPlan,
  onCalibrate,
}: {
  name: string
  amb: Ambient
  change: (next: Ambient, commit: boolean) => void
  selection: AmbientSelection
  actions: AmbientActions
  geos: Map<string, ItemGeometry | null>
  names: Map<string, string>
  projects: Project[] | undefined
  materials: MaterialPref[]
  groups: string[]
  summary: AmbientSummary
  wallDefaults: { thickness: number; height: number }
  onWallDefaults: (v: { thickness: number; height: number }) => void
  onResize: (id: number, before: Composition, next: Composition) => void
  onOpenProject: (id: number) => void
  onImportPlan: () => void
  onCalibrate: () => void
}) {
  const { sel, setSel, select, groupSel, item, wall, selIds, selWallIds } = selection
  const { patchItem, patchWall, duplicate, remove, nudge, rotate, boxOf } = actions
  return (
    <Stack gap={4} pb={2}>
    {item ? (
        <ItemInspector
          key={item.id}
          item={item}
          geo={geos.get(item.id) ?? null}
          name={names.get(item.id) ?? ""}
          project={item.kind === "moble" ? projects?.find((p) => p.id === item.projectId) : undefined}
          materials={materials}
          onPatch={(p) => patchItem(item.id, p)}
          onOpen={() => item.kind === "moble" && onOpenProject(item.projectId)}
          onDuplicate={duplicate}
          onDelete={remove}
          onResize={onResize}
        />
      ) : sel?.kind === "multi" && selIds.length + selWallIds.length > 1 ? (
        <MultiInspector
          items={amb.items.filter((i) => selIds.includes(i.id))}
          walls={amb.walls.filter((w) => selWallIds.includes(w.id))}
          wallNames={new Map(amb.walls.map((w, i) => [w.id, `Paret ${i + 1}`]))}
          names={names}
          groups={groups}
          onMove={(dx, dy) => nudge(dx, dy)}
          onRotate={rotate}
          onAlign={(axis, mode) => change(alignItems(amb, selIds, boxOf, axis, mode), true)}
          onDistribute={(axis, gap) => change(distributeItems(amb, selIds, boxOf, axis, gap), true)}
          onGroup={(g) => {
            const name = g ?? newItemGroupName(amb)
            change(setWallGroup(setItemGroup(amb, selIds, name), selWallIds, name), true)
            groupSel(name)
          }}
          onUngroup={() => change(setWallGroup(setItemGroup(amb, selIds, undefined), selWallIds, undefined), true)}
          onDuplicate={duplicate}
          onDelete={remove}
          onPick={(id) => select({ kind: "item", id })}
        />
      ) : sel?.kind === "group" && selIds.length + selWallIds.length ? (
        // Un grup té les mateixes propietats que una selecció múltiple (per decisió de l'usuari), amb el nom.
        <MultiInspector
          key={sel.id}
          name={sel.id}
          onRename={(n) => {
            change(setWallGroup(setItemGroup(amb, selIds, n), selWallIds, n), true)
            setSel({ kind: "group", id: n })
          }}
          items={amb.items.filter((i) => selIds.includes(i.id))}
          walls={amb.walls.filter((w) => selWallIds.includes(w.id))}
          wallNames={new Map(amb.walls.map((w, i) => [w.id, `Paret ${i + 1}`]))}
          names={names}
          groups={groups}
          onMove={(dx, dy) => nudge(dx, dy)}
          onRotate={rotate}
          onAlign={(axis, mode) => change(alignItems(amb, selIds, boxOf, axis, mode), true)}
          onDistribute={(axis, gap) => change(distributeItems(amb, selIds, boxOf, axis, gap), true)}
          onGroup={(g) => {
            const name = g ?? newItemGroupName(amb)
            change(setWallGroup(setItemGroup(amb, selIds, name), selWallIds, name), true)
            groupSel(name)
          }}
          onUngroup={() => (change(setWallGroup(setItemGroup(amb, selIds, undefined), selWallIds, undefined), true), setSel(null))}
          onDuplicate={duplicate}
          onDelete={remove}
          onPick={(id) => select({ kind: "item", id })}
        />
      ) : wall ? (
        <WallInspector key={wall.id} wall={wall} label={`Paret ${amb.walls.indexOf(wall) + 1}`}materials={materials} onPatch={(p) => patchWall(wall.id, p)} onDelete={remove} />
      ) : (
        <AmbientInspector
          name={name}
          summary={summary}
          size={(() => {
            const b = ambientBox({ ...amb, items: [], plan: undefined }, geos)
            return b ? { w: b.x1 - b.x0, d: b.y1 - b.y0 } : null
          })()}
          onRemoveMissing={() => change(removeItems(amb, summary.missing), true)}
          amb={amb}
          materials={materials}
          wallDefaults={wallDefaults}
          onWallDefaults={onWallDefaults}
          onChange={(a) => change(a, true)}
          onImportPlan={onImportPlan}
          onCalibrate={onCalibrate}
        />
      )}
    </Stack>
  )
}
