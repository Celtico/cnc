import { Editable, HStack, IconButton, Stack, Text } from "@chakra-ui/react"
import { createElement, useMemo, type ReactNode } from "react"
import { LuArrowUp, LuBox, LuCamera, LuChevronLeft, LuChevronRight, LuGroup, LuScan, LuSprout, LuWrench } from "react-icons/lu"
import type { ModuleBuild } from "../../core/build/buildModule"
import { renameGroup, walkZones, type Composition, type Module, type Zone } from "../../core/model"
import { Tooltip } from "../../components/ui/tooltip"
import { PlacementButtons, type PlacementActions } from "../composition/HardwarePlacements"
import { ModelActions } from "../composition/ModelInspector"
import { PartActions } from "../composition/PartInspector"
import { ORIENT_ICON } from "../composition/partOrient"
import { placementScope, scopePlacements } from "../composition/placements"
import { RefActions } from "../composition/RefInspector"
import type { Selection } from "../composition/StructureTree"
import { ZoneActions } from "../composition/ZonePanel"
import { zoneIcon } from "../composition/zoneIcons"
import { zoneLabel } from "../composition/zoneLabel"
import type { CompositionEdits } from "./editorCommands"
import type { SetComp } from "./useEditorDoc"

/** Capçalera de l'inspector: on és i què és (dues línies), anterior/següent i ⋯ amb les accions. */
export function InspectorHeader({
  comp,
  setComp,
  selection,
  select,
  selectZone,
  module,
  zone,
  moduleBuild,
  name,
  photoInspector,
  edits,
  hardwareActions,
}: {
  comp: Composition
  setComp: SetComp
  selection: Selection
  select: (s: Selection) => void
  selectZone: (id: string) => void
  module: Module | undefined
  zone: Zone | undefined
  moduleBuild: ModuleBuild | undefined
  name: string
  photoInspector: boolean
  edits: Pick<CompositionEdits, "updateModule" | "renamePart" | "renameModel" | "renameRef">
  hardwareActions: PlacementActions
}) {
  const { updateModule, renamePart, renameModel, renameRef } = edits
  /**
   * Anterior / següent de la mateixa mena que la selecció: compartiments del mòdul en
   * ordre de lectura (de dalt a baix i d'esquerra a dreta), mòduls o objectes.
   */
  const siblings = useMemo((): { prev: Selection | null; next: Selection | null; pos: string } | null => {
    const around = <T,>(list: T[], i: number, to: (t: T) => Selection) =>
      i < 0 || list.length < 2 ? null : { prev: i > 0 ? to(list[i - 1]!) : null, next: i < list.length - 1 ? to(list[i + 1]!) : null, pos: `${i + 1}/${list.length}` }
    if (selection.kind === "module") return around(comp.modules, comp.modules.findIndex((m) => m.id === selection.id), (m) => ({ kind: "module", id: m.id }))
    if (selection.kind === "hardware") {
      // Els col·locats del mateix mòdul (o peça lliure), en l'ordre de la composició.
      const pl = comp.hardwarePlacements?.find((h) => h.id === selection.id)
      const scope = pl && placementScope(pl)
      const list = scope ? scopePlacements(comp, scope) : []
      return around(list, list.findIndex((h) => h.id === selection.id), (h) => ({ kind: "hardware", id: h.id }))
    }
    if (selection.kind === "ref") return around(comp.references, comp.references.findIndex((r) => r.id === selection.id), (r) => ({ kind: "ref", id: r.id }))
    if (selection.kind === "part") return around(comp.parts ?? [], (comp.parts ?? []).findIndex((r) => r.id === selection.id), (r) => ({ kind: "part", id: r.id }))
    if (selection.kind === "model") return around(comp.models ?? [], (comp.models ?? []).findIndex((g) => g.id === selection.id), (g) => ({ kind: "model", id: g.id }))
    if (selection.kind === "zone" && zone && moduleBuild && module) {
      const wantLeaves = !zone.split
      const list: { id: string; cx: number; cy: number }[] = []
      walkZones(module.root, (z) => {
        if (!!z.split === wantLeaves || z.id === module.root.id) return
        const r = moduleBuild.layout.rects.get(z.id)
        if (r) list.push({ id: z.id, cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2 })
      })
      list.sort((a, b) => (Math.abs(a.cy - b.cy) > 1 ? b.cy - a.cy : a.cx - b.cx))
      return around(list, list.findIndex((z) => z.id === zone.id), (z) => ({ kind: "zone", moduleId: module.id, zoneId: z.id }))
    }
    return null
  }, [selection, comp, zone, module, moduleBuild])

  // Títol en dues línies: on és (petit i apagat) i què és (el nom), perquè no es talli.
  const selPart = selection.kind === "part" ? comp.parts?.find((r) => r.id === selection.id) : undefined
  const selHardware = selection.kind === "hardware" ? comp.hardwarePlacements?.find((h) => h.id === selection.id) : undefined
  const selHardwareScope = selHardware ? placementScope(selHardware) : null
  const hardwareOwnerName = selHardwareScope?.kind === "module" ? (comp.modules.find((m) => m.id === selHardwareScope.moduleId)?.name ?? "") : selHardwareScope?.kind === "part" ? (comp.parts?.find((q) => q.id === selHardwareScope.partId)?.name ?? "") : ""
  const inspectorTitle: { icon: ReactNode; text: string; parent?: string; onRename?: (v: string) => void } = photoInspector
    ? { icon: <LuCamera />, text: "Foto del lloc" }
    : selection.kind === "moble"
      ? { icon: <LuBox />, text: name || "Moble" }
      : selection.kind === "multi"
        ? { icon: <LuGroup />, text: `${selection.items.length} elements`, parent: "Selecció" }
      : selection.kind === "group"
        ? { icon: <LuGroup />, text: selection.id, parent: "Grup", onRename: (v) => {
            const old = selection.id
            setComp((c) => renameGroup(c, old, v))
            select({ kind: "group", id: v })
          } }
      : selection.kind === "part" && selPart
        ? { icon: createElement(ORIENT_ICON[selPart.orient]), text: selPart.name, parent: "Peça lliure", onRename: (v) => renamePart(selPart.id, v) }
      : selection.kind === "model"
        ? { icon: <LuSprout />, text: comp.models?.find((g) => g.id === selection.id)?.name ?? "Model", parent: "Model 3D", onRename: (v) => renameModel(selection.id, v) }
      : selection.kind === "ref"
        ? { icon: <LuScan />, text: comp.references.find((r) => r.id === selection.id)?.name ?? "Objecte", parent: "Objecte de referència", onRename: (v) => renameRef(selection.id, v) }
      : selection.kind === "hardware" && selHardware
        ? { icon: <LuWrench />, text: selHardware.item.name, parent: `Ferratge · ${hardwareOwnerName}` }
        : selection.kind === "zone" && zone && module
          ? { icon: createElement(zoneIcon(zone, { root: zone.id === module.root.id })), text: zoneLabel(zone, { root: zone.id === module.root.id }), parent: module.name }
          : module
            ? { icon: <LuBox />, text: module.name, parent: name || "Moble", onRename: (v) => updateModule({ ...module, name: v }) }
            : { icon: <LuBox />, text: name || "Moble" }

  return (
    <HStack gap={2} color="wood.fg" pb={2} mb={2} borderBottomWidth="1px">
      <Stack gap={0} flex={1} minW={0}>
        {inspectorTitle.parent && (
          <Text fontSize="xs" color="fg.muted" truncate data-truncate="">
            {inspectorTitle.parent}
          </Text>
        )}
        {inspectorTitle.onRename ? (
          // El nom es canvia aquí, a la capçalera (clic al nom), com a Figma.
          <Editable.Root
            key={`${selection.kind}:${inspectorTitle.text}`}
            defaultValue={inspectorTitle.text}
            onValueCommit={(e) => {
              const v = e.value.trim()
              if (v && v !== inspectorTitle.text) inspectorTitle.onRename!(v)
            }}
            fontSize="sm"
            fontWeight="semibold"
            color="fg"
            minW={0}
            aria-label="Nom"
          >
            <Editable.Preview title="Clica per canviar el nom" truncate px={1} mx={-1} py={0} minH="auto" _hover={{ bg: "bg.muted" }} />
            <Editable.Input px={1} mx={-1} py={0} h="22px" />
          </Editable.Root>
        ) : (
          <Text fontSize="sm" fontWeight="semibold" color="fg" truncate data-truncate="">
            {inspectorTitle.text}
          </Text>
        )}
      </Stack>
      {!photoInspector && siblings && (
        <HStack gap={0} flexShrink={0} color="fg.muted">
          <Tooltip content={`Anterior (${siblings.pos})`}>
            <IconButton size="xs" variant="ghost" aria-label="Anterior" disabled={!siblings.prev} onClick={() => siblings.prev && select(siblings.prev)}>
              <LuChevronLeft />
            </IconButton>
          </Tooltip>
          <Tooltip content={`Següent (${siblings.pos})`}>
            <IconButton size="xs" variant="ghost" aria-label="Següent" disabled={!siblings.next} onClick={() => siblings.next && select(siblings.next)}>
              <LuChevronRight />
            </IconButton>
          </Tooltip>
        </HStack>
      )}
      {!photoInspector && selection.kind === "zone" && zone && module && (
        <ZoneActions root={module.root} zone={zone} onChange={(root) => updateModule({ ...module, root })} onSelect={selectZone} />
      )}
      {!photoInspector && selection.kind === "part" && (
        <PartActions comp={comp} id={selection.id} onChange={setComp} onRemoved={() => select({ kind: "moble" })} onSelected={(id) => select({ kind: "part", id })} />
      )}
      {!photoInspector && selection.kind === "model" && (
        <ModelActions comp={comp} id={selection.id} onChange={setComp} onRemoved={() => select({ kind: "moble" })} onSelected={(id) => select({ kind: "model", id })} />
      )}
      {!photoInspector && selection.kind === "hardware" && selHardware && (
        <HStack gap={0} flexShrink={0}>
          <Tooltip content={`Pare: ${hardwareOwnerName}`}>
            <IconButton
              size="xs"
              variant="ghost"
              aria-label="Pare"
              onClick={() => select(selHardwareScope?.kind === "module" ? { kind: "module", id: selHardwareScope.moduleId } : selHardwareScope?.kind === "part" ? { kind: "part", id: selHardwareScope.partId } : { kind: "moble" })}
            >
              <LuArrowUp />
            </IconButton>
          </Tooltip>
          <PlacementButtons id={selHardware.id} name={selHardware.item.name} actions={hardwareActions} edit={false} />
        </HStack>
      )}
      {!photoInspector && selection.kind === "ref" && (
        <RefActions comp={comp} id={selection.id} onChange={setComp} onRemoved={() => select({ kind: "moble" })} onSelected={(id) => select({ kind: "ref", id })} />
      )}
    </HStack>
  )
}
