import { Stack } from "@chakra-ui/react"
import { useRef, useState } from "react"
import { LuBox } from "react-icons/lu"
import { compositionKind, partsOnlyKind, newId, newModelObject, type Composition, type MultiItem, type Module } from "../../core/model"
import { NameDialog } from "../../components/NameDialog"
import { defaultElementName, freePartFor, refFor, type AddKind } from "./addElements"
import { useSettings } from "../settings/SettingsContext"
import { TreeRow, TreeSection } from "../../components/TreeRow"
import { ModelImportDialog, type ModelImportHandle } from "./ModelImportDialog"
import type { ModelChoice } from "./useModelAssets"
import { useModuleAccordion, useOpenGroups } from "./tree/useTreeExpansion"
import { useTreeDnd } from "./tree/useTreeDnd"
import { treeFlags, type TreeCtx } from "./tree/treeCtx"
import { ModuleRows } from "./tree/ModuleRows"
import { PartRows } from "./tree/PartRows"
import { RefSection } from "./tree/RefSection"
import { ModelSection } from "./tree/ModelSection"

export type Selection =
  | { kind: "moble" }
  | { kind: "module"; id: string }
  | { kind: "zone"; moduleId: string; zoneId: string }
  | { kind: "ref"; id: string }
  | { kind: "part"; id: string }
  /** Grup de peces lliures (id = nom del grup). */
  | { kind: "group"; id: string }
  /** Model 3D (`.glb`, `Composition.models`). */
  | { kind: "model"; id: string }
  /** Ferratge col·locat a mà (`Composition.hardwarePlacements`, id del col·locat): es tria al 3D (o a «Ferratges» de la peça lliure). */
  | { kind: "hardware"; id: string }
  /** Selecció múltiple (Maj + clic): peces lliures, models 3D i objectes de referència. */
  | { kind: "multi"; items: MultiItem[] }

/**
 * Arbre d'estructura (com l'outliner de Figma o Fusion): el moble, els seus mòduls amb
 * els compartiments, i els objectes de referència. Seleccionar aquí, al 3D o a l'alçat és
 * el mateix.
 */
export function StructureTree({
  name,
  comp,
  selection,
  onSelect,
  onChange,
  newModule,
  partCenter,
}: {
  name: string
  comp: Composition
  selection: Selection
  onSelect: (s: Selection) => void
  onChange: (c: Composition) => void
  newModule: (id: string, name: string) => Module
  /** On apareix una peça lliure nova (mm). */
  partCenter: { x: number; y: number; z: number }
}) {
  const selModuleId = selection.kind === "module" ? selection.id : selection.kind === "zone" ? selection.moduleId : null
  // Com un acordió: un sol mòdul desplegat (`useModuleAccordion`).
  const { openId, toggle } = useModuleAccordion(selModuleId)

  const addModule = (m: Module) => {
    onChange({ ...comp, modules: [...comp.modules, { ...m, gapBefore: 0 }] })
    onSelect({ kind: "module", id: m.id })
  }
  const [adding, setAdding] = useState<AddKind | null>(null)
  // Model 3D nou: un .glb, .gltf, .fbx o un zip de Poly Haven (es passa a .glb i s'optimitza en pujar-lo).
  const modelImport = useRef<ModelImportHandle>(null)
  const [uploading, setUploading] = useState(false)
  const { settings } = useSettings()
  const onlyParts = partsOnlyKind(compositionKind(comp))
  // Objectes de referència només als mobles i models 3D només als objectes (per decisió de l'usuari). Treure ≠ esborrar:
  // si un document ja en té (fets abans), el grup surt sense el + perquè es puguin triar i eliminar.
  const isObject = compositionKind(comp) === "objecte"
  const models = comp.models ?? []
  const showRefs = !isObject || comp.references.length > 0
  const showModels = isObject || models.length > 0
  const parts = comp.parts ?? []
  // Grups de peces: plegats; s'obre sol el de la peça seleccionada.
  const selGroup = selection.kind === "part" ? parts.find((q) => q.id === selection.id)?.group : selection.kind === "model" ? models.find((q) => q.id === selection.id)?.group : undefined
  const { openGroups, toggleGroup, openGroup } = useOpenGroups(selGroup)
  const dnd = useTreeDnd({ comp, selection, onChange, openGroup })
  const addModel = (asset: ModelChoice, label: string) => {
    const [w, , d] = asset.size
    // El centre de la petjada on surten les peces noves, a terra.
    const g = newModelObject(newId("g"), { ...asset, url: "" }, { x: Math.round(partCenter.x - w / 2), y: 0, z: Math.round(partCenter.z - d / 2) }, label)
    onChange({ ...comp, models: [...(comp.models ?? []), g] })
    onSelect({ kind: "model", id: g.id })
  }

  const inMultiSel = (kind: MultiItem["kind"], id: string) => selection.kind === "multi" && selection.items.some((x) => x.kind === kind && x.id === id)
  const { flagsOf, groupFlags } = treeFlags(comp, onChange)
  const tree: TreeCtx = { comp, selection, onSelect, onChange, dnd, flagsOf, groupFlags, inMultiSel, openGroups, toggleGroup, openGroup }

  return (
    <Stack gap={0.5} role="tree" aria-label={compositionKind(comp) === "objecte" ? "Estructura de l'objecte" : "Estructura del moble"} fontSize="sm">
      <TreeRow icon={<LuBox />} label={name || "Moble"} bold selected={selection.kind === "moble"} onClick={() => onSelect({ kind: "moble" })} depth={0} />
      {/* Un + per a cada tipus d'element (per decisió de l'usuari: així es veu que n'hi ha tres): demana el nom (un per
          defecte, seleccionat) i crea l'element, sense més opcions (es configura a l'inspector). */}
      {adding && (
        <NameDialog
          open
          title={adding === "module" ? "Mòdul nou" : adding === "part" ? "Peça lliure nova" : "Objecte de referència nou"}
          ariaLabel="Nom"
          submitLabel="Afegir"
          initial={defaultElementName(comp, adding)}
          onClose={() => setAdding(null)}
          onSave={(n) => {
            const kind = adding
            setAdding(null)
            if (kind === "module") addModule(newModule(newId("m"), n))
            else if (kind === "part") {
              const p = freePartFor(comp, settings, "front", partCenter, n)
              onChange({ ...comp, parts: [...(comp.parts ?? []), p] })
              onSelect({ kind: "part", id: p.id })
            } else {
              const r = refFor({ name: n, w: 600, h: 600, d: 100 })
              onChange({ ...comp, references: [...comp.references, r] })
              onSelect({ kind: "ref", id: r.id })
            }
          }}
        />
      )}
      {/* El + de «Models 3D»: l'explicació del format i els selectors (sense llista de models de l'app, per decisió de
          l'usuari; les plantes de l'app són al catàleg d'Objectes). La finestra diu el progrés i el resultat. */}
      <ModelImportDialog handle={modelImport} onBusy={setUploading} onImported={(m) => addModel(m, m.name)} />
      {!onlyParts && <TreeSection onAdd={() => setAdding("module")} addLabel="Afegir mòdul">Mòduls</TreeSection>}
      {!onlyParts && <ModuleRows tree={tree} openId={openId} toggle={toggle} />}

      {/* Peces lliures (flat-pack): com els objectes, però són peces de debò amb encaixos. */}
      <TreeSection onAdd={() => setAdding("part")} addLabel="Afegir peça lliure">Peces lliures</TreeSection>
      <PartRows tree={tree} />

      {showRefs && <RefSection tree={tree} isObject={isObject} onAddBlank={() => setAdding("ref")} />}

      {/* Models 3D (plantes, decoració…): només es veuen; es col·loquen com les peces lliures. */}
      <ModelSection tree={tree} show={showModels} isObject={isObject} uploading={uploading} onPick={(what) => modelImport.current?.pick(what)} />
    </Stack>
  )
}
