import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react"
import { LuBox, LuCamera, LuLampFloor, LuMove, LuMoveDiagonal, LuPalette, LuPuzzle, LuWrench } from "react-icons/lu"
import { FoldGroup, FoldItem } from "../../components/Fold"
import type { CompositionBuild } from "../../core/build/buildComposition"
import type { ModuleBuild } from "../../core/build/buildModule"
import { activeIslands } from "../../core/build/islands"
import { groupItems, groupMulti, hasDrawers, mountOf, moveMultiBy, newGroupName, partJoinery, partsOnlyKind, removeGroup, removeMulti, visibleModule, type Composition, type compositionKind, type Module, type MultiItem, type Settings, type Zone } from "../../core/model"
import type { Project } from "../../db/db"
import { CarcassForm, MaterialsForm } from "../composition/CarcassForm"
import { HardwarePlacements, PlacementInspector, type PlacementActions } from "../composition/HardwarePlacements"
import { ModelInspector } from "../composition/ModelInspector"
import { MultiInspector, PartInspector, PartJoineryForm } from "../composition/PartInspector"
import { scopePlacements } from "../composition/placements"
import { RefInspector } from "../composition/RefInspector"
import type { Selection } from "../composition/StructureTree"
import type { CompositionEdits } from "./editorCommands"
import { InspectorAlerts } from "./InspectorAlerts"
import { InspectorHeader } from "./InspectorHeader"
import { ModulePositionFields, ModuleSections, SceneFinishFields, ZoneSection } from "./InspectorSections"
import type { SetComp } from "./useEditorDoc"
import { clipOf, pasteClip } from "./pasteClip"
import type { SceneData } from "./useSceneData"

/**
 * Inspector: propietats del que hi ha seleccionat.
 * A la pestanya Foto, l'inspector mostra el calibratge quan no hi ha res seleccionat (el
 * moble sencer); si es tria un mòdul, un compartiment o un objecte, en mostra les propietats.
 */
export function EditorInspector({
  inspectorOpen,
  setInspectorOpen,
  comp,
  setComp,
  kind,
  name,
  project,
  settings,
  build,
  scene,
  selection,
  select,
  selectZone,
  module,
  moduleIndex,
  moduleBuild,
  zone,
  photoTab,
  setPhotoControls,
  edits,
  hardwareActions,
}: {
  inspectorOpen: string[]
  setInspectorOpen: (v: string[]) => void
  comp: Composition
  setComp: SetComp
  kind: ReturnType<typeof compositionKind>
  name: string
  project: Project
  settings: Settings
  build: CompositionBuild | undefined
  scene: Pick<SceneData, "panels" | "size" | "empty" | "warnings" | "collisions">
  selection: Selection
  select: (s: Selection) => void
  selectZone: (id: string) => void
  module: Module | undefined
  moduleIndex: number
  moduleBuild: ModuleBuild | undefined
  zone: Zone | undefined
  photoTab: boolean
  setPhotoControls: (el: HTMLDivElement | null) => void
  edits: CompositionEdits
  hardwareActions: PlacementActions
}) {
  const { panels, size, empty, warnings, collisions } = scene
  const { updateModule, moveGroup } = edits
  const photoInspector = photoTab && selection.kind === "moble"
  const totalHoles = panels.reduce((n, p) => n + p.holes.length, 0)
  // El mòdul triat és el de darrere d'una illa (es col·loca sol): la Posició ho diu i no en mostra els camps.
  const islandBack = module ? activeIslands(comp).find((i) => i.back === module.id) : undefined
  // «Duplicar» d'un grup o de la selecció múltiple: el mateix camí que ⌘D.
  const duplicateSelection = () => {
    const clip = clipOf(comp, selection, zone)
    if (clip) pasteClip({ comp, setComp, select, selection, module, updateModule }, clip, true)
  }

  // Sense separació entre blocs: les seccions plegables van enganxades (totes amb la
  // mateixa alçada de capçalera); els elements que no són secció porten el seu marge.
  return (
    <Stack gap={0}>
      {/* Una secció oberta alhora (per decisió de l'usuari, 2026-10-13): obrir-ne una tanca l'altra; es recorda a la
          sessió. Les subseccions de dins (`size="sm"`) continuen independents. */}
      <FoldGroup multiple={false} value={inspectorOpen} onValueChange={setInspectorOpen}>
      <InspectorHeader comp={comp} setComp={setComp} selection={selection} select={select} selectZone={selectZone} module={module} zone={zone} moduleBuild={moduleBuild} name={name} photoInspector={photoInspector} edits={edits} hardwareActions={hardwareActions} />

      {photoTab && !photoInspector && (
        <Button size="xs" variant="outline" alignSelf="flex-start" mb={2} onClick={() => select({ kind: "moble" })}>
          <LuCamera /> {project.photo ? "Tornar a la foto del lloc" : "Opcions de la foto"}
        </Button>
      )}
      {photoInspector ? (
        <Box ref={setPhotoControls} />
      ) : selection.kind === "moble" ? (
        <Stack gap={0}>
          <FoldItem id="moble-summary" title="Resum" icon={LuBox}>
            <Text fontSize="sm" color="fg.muted">
              {empty ? (partsOnlyKind(kind) ? "Buit: afegeix-hi peces amb el + de «Peces lliures»." : "Buit: comença amb el + de «Mòduls» (o de «Peces lliures»).") : `${comp.modules.length} ${comp.modules.length === 1 ? "mòdul" : "mòduls"} · ${size.width} × ${size.height} × ${size.depth} mm`}
            </Text>
            <HStack gap={2} wrap="wrap">
              <Badge variant="subtle">{panels.length} peces</Badge>
              <Badge variant="subtle">{totalHoles} forats</Badge>
              {comp.references.length > 0 && <Badge variant="subtle">{comp.references.length} objectes de referència</Badge>}
              {(comp.models?.length ?? 0) > 0 && <Badge variant="subtle">{comp.models!.length === 1 ? "1 model 3D" : `${comp.models!.length} models 3D`}</Badge>}
            </HStack>
            <Text fontSize="xs" color="fg.muted" display={empty ? "none" : undefined}>
              Selecciona un mòdul, un compartiment o un objecte a l'estructura (o clica'l al 3D) per editar-lo.
            </Text>
          </FoldItem>
          {/* Sense «Tipus» (es tria en crear el moble). Els documents només de peces ho diuen aquí. */}
          {kind === "objecte" ? (
            <Text fontSize="xs" color="fg.muted" px={1} py={2}>
              Objecte per als ambients: fes-lo amb peces lliures (forma amb l'editor de perfils, «Talla» per als forats i buidats) i materials de simulació. Només es veu: no va al nesting ni als fitxers del taller.
            </Text>
          ) : kind === "lliure" ? (
            <Text fontSize="xs" color="fg.muted" px={1} py={2}>
              Moble només de peces lliures (sense mòduls). Les que tenen «Encaixos» activat fan l'encaix sol on es toquen o s'encreuen: pestanyes, mitja fusta, dits o espigues. Les de ferro, pedra o vidre no van al nesting.
            </Text>
          ) : null}
          {/* Sense «Taulell i sòcol» (per decisió de l'usuari, 2026-10-13: «que no aparegui»). Treure ≠ esborrar: les peces
              corregudes que ja hi són (`comp.runs`) es conserven i es fabriquen igual. */}
          {/* Sense «Illes» (per decisió de l'usuari, 2026-10-13: «treu l'opció illa, això és més fàcil amb peces lliures»).
              Treure ≠ esborrar: les illes que ja hi són es conserven i es fabriquen igual. */}
          {(comp.parts ?? []).some((p) => partJoinery(comp, p)) && (
            <FoldItem id="moble-joinery" title="Encaixos" icon={LuPuzzle} badge={build?.joints.length || undefined}>
              <PartJoineryForm comp={comp} onChange={setComp} />
            </FoldItem>
          )}
          {/* Com els Acabats dels ambients: terra i paret de l'escena on es presenta (per defecte, les de Preferències). */}
          <FoldItem id="moble-scene" title="Acabats de l'escena" icon={LuLampFloor} badge={comp.scene?.floor || comp.scene?.wall ? "Propis" : undefined}>
            <SceneFinishFields comp={comp} setComp={setComp} materials={settings.materials} />
          </FoldItem>
          {!partsOnlyKind(kind) && comp.modules[0] && <FoldItem id="moble-materials" title="Materials de tot el moble" icon={LuPalette}>
            <MaterialsForm
              carcass={comp.modules[0].carcass}
              hasBack={comp.modules.some((m) => m.carcass.back !== "none")}
              hasDrawers={comp.modules.some((m) => hasDrawers(visibleModule(m).root))}
              mixed={comp.modules.some((m) => {
                const a = m.carcass
                const b = comp.modules[0]!.carcass
                return a.material !== b.material || (a.frontMaterial ?? "") !== (b.frontMaterial ?? "") || a.backMaterial !== b.backMaterial || a.thickness !== b.thickness || a.backThickness !== b.backThickness
              })}
              onPatch={(patch) => setComp((c) => ({ ...c, modules: c.modules.map((m) => ({ ...m, carcass: { ...m.carcass, ...patch } })) }))}
            />
          </FoldItem>}
        </Stack>
      ) : selection.kind === "model" ? (
        <ModelInspector comp={comp} id={selection.id} onChange={setComp} />
      ) : selection.kind === "hardware" ? (
        <PlacementInspector comp={comp} id={selection.id} panels={panels} library={settings.hardwareLibrary} warnings={warnings} onChange={setComp} />
      ) : selection.kind === "ref" ? (
        <RefInspector comp={comp} id={selection.id} onChange={setComp} />
      ) : selection.kind === "multi" ? (
        <MultiInspector
          comp={comp}
          items={selection.items}
          onChange={setComp}
          onSelect={(x) => select({ kind: x.kind, id: x.id })}
          onMove={(dx, dy, dz) => setComp((c) => moveMultiBy(c, selection.items, dx, dy, dz))}
          onGroup={() => {
            const g = newGroupName(comp)
            setComp(groupMulti(comp, selection.items, g))
            select({ kind: "group", id: g })
          }}
          onDuplicate={duplicateSelection}
          onRemove={() => {
            setComp(removeMulti(comp, selection.items))
            select({ kind: "moble" })
          }}
        />
      ) : selection.kind === "group" ? (
        // Un grup té les mateixes propietats que una selecció múltiple (per decisió de l'usuari): els seus elements.
        (() => {
          const items: MultiItem[] = groupItems(comp, selection.id)
          return (
            <MultiInspector
              comp={comp}
              items={items}
              onChange={setComp}
              onSelect={(x) => select({ kind: x.kind, id: x.id })}
              onMove={(dx, dy, dz) => moveGroup(selection.id, dx, dy, dz)}
              onGroup={() => {
                const g = newGroupName(comp)
                setComp(groupMulti(comp, items, g))
                select({ kind: "group", id: g })
              }}
              onDuplicate={duplicateSelection}
              onRemove={() => {
                setComp(removeGroup(comp, selection.id))
                select({ kind: "moble" })
              }}
            />
          )
        })()
      ) : selection.kind === "part" ? (
        <Stack gap={0}>
          <PartInspector comp={comp} id={selection.id} joints={build?.joints ?? []} onChange={setComp} />
          {/* Ferratges col·locats a mà que ja porta la peça (ja no se n'afegeixen: treure ≠ esborrar). */}
          {(!partsOnlyKind(kind) || kind === "lliure") && scopePlacements(comp, { kind: "part", partId: selection.id }).length > 0 ? (
            <FoldItem id="part-hardware" title="Ferratges" icon={LuWrench} badge={scopePlacements(comp, { kind: "part", partId: selection.id }).length || undefined}>
              <HardwarePlacements comp={comp} scope={{ kind: "part", partId: selection.id }} panels={panels} warnings={warnings} actions={hardwareActions} />
            </FoldItem>
          ) : null}
        </Stack>
      ) : selection.kind === "zone" && zone && module ? (
        <Stack gap={3}>
          <ZoneSection module={module} zone={zone} moduleBuild={moduleBuild} updateModule={updateModule} selectZone={selectZone} />
        </Stack>
      ) : module ? (
        // Seccions plegables independents (com Figma o Fusion): es poden tenir diverses
        // obertes i cada una recorda el seu estat.
        // Ordre (per decisió de l'usuari, 2026-10-13): Posició · Mides · Electrodomèstic (sense dividir, 2026-10-15: decideix
        // la caixa) · Caixa · Portes (dividit) · Unió · Materials.
        <Stack gap={0}>
            {islandBack ? (
              // El de darrere d'una illa es col·loca sol (girat i enganxat al de davant): la seva posició no compta.
              <FoldItem id="mod-position" title="Posició" icon={LuMove} badge="Illa · darrere">
                <Text fontSize="sm" color="fg.muted">
                  És el mòdul de darrere de l'illa amb «{comp.modules.find((m) => m.id === islandBack.front)?.name}»: es gira 180° i es col·loca sol, enganxat al seu darrere. Es canvia al moble, a «Illes».
                </Text>
              </FoldItem>
            ) : (
            <FoldItem id="mod-position" title="Posició" icon={LuMove} badge={module.carcass.base.kind === "wall" ? `Penjat a ${module.carcass.base.height}` : mountOf(module) === "floor" ? `Lliure al terra · ${module.wallGap ?? 0} de la paret` : "Arrambat a la paret"}>
              <ModulePositionFields comp={comp} module={module} moduleX={build?.modules[moduleIndex]?.x} updateModule={updateModule} />
            </FoldItem>
            )}
          <FoldItem id="mod-dims" title="Mides" icon={LuMoveDiagonal} badge={`${module.carcass.width} × ${module.carcass.height}`}>
            <CarcassForm module={module} onChange={updateModule} section="dims" />
          </FoldItem>
          <ModuleSections module={module} updateModule={updateModule} />
          {/* «Ferratges» (col·locats a mà i els de les regles) no surt a l'inspector del mòdul (per decisió de l'usuari,
              2026-10-08): els col·locats es conserven, es fabriquen i es veuen al 3D (on es trien i s'editen). */}
        </Stack>
      ) : null}

        <InspectorAlerts comp={comp} selection={selection} select={select} module={module} warnings={warnings} collisions={collisions} photo={project.photo} />
      </FoldGroup>
    </Stack>
  )
}
