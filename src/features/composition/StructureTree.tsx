import { Box, HStack, Menu, Stack, Text } from "@chakra-ui/react"
import { createElement, useRef, useState } from "react"
import {
  LuArrowLeft,
  LuArrowRight,
  LuBox,
  LuChevronDown,
  LuChevronRight,
  LuCopy,
  LuGroup,
  LuUngroup,
  LuPlus,
  LuScan,
  LuScissors,
  LuSprout,
  LuTrash2,
  LuFileUp,
  LuFolderOpen,
} from "react-icons/lu"
import { zoneIcon } from "./zoneIcons"
import { compositionKind, partsOnlyKind, duplicateGroup, removeModule, newGroupName, groupNames, renameGroup, removeGroup, reorderModel, setModelGroup, groupMulti, ungroupMulti, insertModelCopy, insertPartCopy, insertRefCopy, newModelObject, movePartToGroup, removePartFromGroup, newId, reorderModule, reorderPart, reorderRef, rowOf, withFlag, type Composition, type MultiItem, type ViewFlags, type Module, type Zone } from "../../core/model"
import { NameDialog } from "../../components/NameDialog"
import { toaster } from "../../components/ui/toaster"
import { MODEL_FORMAT_HELP, defaultElementName, freePartFor, refFor, refFromPreset, type AddKind } from "./addElements"
import { useSettings } from "../settings/SettingsContext"
import { ORIENT_ICON } from "./partOrient"
import { zoneLabel } from "./zoneLabel"
import { TreeRow, TreeRowMenu, TreeSection, type TreeRowDnd, type TreeRowFlags } from "../../components/TreeRow"
import { ModelImportDialog, type ModelImportHandle } from "./ModelImportDialog"
import type { ModelChoice } from "./useModelAssets"

type DragKind = "module" | "ref" | "part" | "model"

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
  // Com un acordió: només un mòdul desplegat alhora. En desplegar-ne un es pleguen els
  // altres; en seleccionar un mòdul (o un compartiment seu) es desplega ell sol. La fletxa
  // plega o desplega sense canviar la selecció.
  const [openId, setOpenId] = useState<string | null>(selModuleId)
  const [lastSel, setLastSel] = useState(selModuleId)
  if (selModuleId !== lastSel) {
    setLastSel(selModuleId)
    if (selModuleId) setOpenId(selModuleId)
  }
  const toggle = (id: string) => setOpenId((o) => (o === id ? null : id))

  const addModule = (m: Module) => {
    onChange({ ...comp, modules: [...comp.modules, { ...m, gapBefore: 0 }] })
    onSelect({ kind: "module", id: m.id })
  }
  const duplicate = (i: number) => {
    const src = comp.modules[i]!
    const copy: Module = { ...structuredClone(src), id: newId("m"), name: `${src.name} (còpia)` }
    const modules = [...comp.modules]
    modules.splice(i + 1, 0, copy)
    onChange({ ...comp, modules })
    onSelect({ kind: "module", id: copy.id })
  }
  const remove = (i: number) => {
    // Peces enganxades, taulell i sòcol i forats del taulell que en depenen (`removeModule`). Pot quedar sense cap mòdul.
    const res = removeModule(comp, comp.modules[i]!.id)
    onChange(res.comp)
    for (const n of res.notes) toaster.create({ title: n, type: "info" })
    const next = res.comp.modules[Math.max(0, i - 1)]
    onSelect(next ? { kind: "module", id: next.id } : { kind: "moble" })
  }
  /** Veí de la mateixa fila (a terra / penjats) cap a l'esquerra (-1) o la dreta (1). */
  const neighbourIndex = (i: number, dir: -1 | 1): number => {
    const row = rowOf(comp.modules[i]!)
    for (let j = i + dir; j >= 0 && j < comp.modules.length; j += dir) if (rowOf(comp.modules[j]!) === row) return j
    return -1
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = neighbourIndex(i, dir)
    if (j < 0) return
    const modules = [...comp.modules]
    ;[modules[i], modules[j]] = [modules[j]!, modules[i]!]
    onChange({ ...comp, modules })
  }
  // Arrossegar per ordenar (mòduls dins de la seva fila, i objectes).
  // Arrossegar una fila de la selecció múltiple arrossega tots els triats (`multi`).
  const [drag, setDrag] = useState<{ kind: DragKind; id: string; multi?: MultiItem[] } | null>(null)
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null)
  const inDrag = (kind: DragKind, id: string) => (drag?.multi ? drag.multi.some((x) => x.kind === kind && x.id === id) : drag?.id === id)
  const canDrop = (kind: DragKind, id: string) => {
    if (drag?.multi) return kind !== "module" && !inDrag(kind, id)
    if (!drag || drag.kind !== kind || drag.id === id) return false
    if (kind !== "module") return true
    const a = comp.modules.find((m) => m.id === drag.id)
    const b = comp.modules.find((m) => m.id === id)
    return !!a && !!b && rowOf(a) === rowOf(b)
  }
  // Deixar els triats al costat d'un element: els del seu tipus s'hi posen en ordre i tots n'agafen el grup (com un sol).
  const dropMulti = (items: MultiItem[], kind: DragKind, id: string, after: boolean): Composition => {
    let c = comp
    const same = items.filter((x) => x.kind === kind)
    for (const x of after ? [...same].reverse() : same) c = kind === "part" ? reorderPart(c, x.id, id, after) : kind === "model" ? reorderModel(c, x.id, id, after) : reorderRef(c, x.id, id, after)
    const target = kind === "part" ? parts.find((q) => q.id === id) : kind === "model" ? models.find((q) => q.id === id) : undefined
    const others = items.filter((x) => x.kind !== kind && x.kind !== "ref")
    if (others.length) c = target?.group ? groupMulti(c, others, target.group) : ungroupMulti(c, others)
    return c
  }
  const dnd = (kind: DragKind, id: string): TreeRowDnd => ({
    dragging: inDrag(kind, id),
    indicator: over?.id === id && canDrop(kind, id) ? (over.after ? "after" : "before") : null,
    onStart: () => {
      const multi = selection.kind === "multi" && selection.items.some((x) => x.kind === kind && x.id === id) ? selection.items : undefined
      setDrag({ kind, id, ...(multi ? { multi } : {}) })
    },
    onOver: (after) => {
      if (!canDrop(kind, id)) return false
      if (over?.id !== id || over.after !== after) setOver({ id, after })
      return true
    },
    onDrop: (after) => {
      if (drag?.multi && canDrop(kind, id)) onChange(dropMulti(drag.multi, kind, id, after))
      else if (drag && canDrop(kind, id)) onChange(kind === "module" ? reorderModule(comp, drag.id, id, after) : kind === "part" ? reorderPart(comp, drag.id, id, after) : kind === "model" ? reorderModel(comp, drag.id, id, after) : reorderRef(comp, drag.id, id, after))
      setDrag(null)
      setOver(null)
    },
    onEnd: () => {
      setDrag(null)
      setOver(null)
    },
  })
  // La fila d'un grup: s'hi pot deixar una peça (entra al grup).
  const groupDnd = (g: string): TreeRowDnd => {
    const grouped = (x: MultiItem) => (x.kind === "part" ? parts.find((q) => q.id === x.id)?.group : x.kind === "model" ? models.find((q) => q.id === x.id)?.group : g)
    const ok = () => (drag?.multi ? drag.multi.some((x) => x.kind !== "ref" && grouped(x) !== g) : (drag?.kind === "part" && (comp.parts ?? []).find((q) => q.id === drag.id)?.group !== g) || (drag?.kind === "model" && (comp.models ?? []).find((q) => q.id === drag.id)?.group !== g))
    return {
      noDrag: true,
      dragging: false,
      indicator: over?.id === `g:${g}` && ok() ? "inside" : null,
      onStart: () => {},
      onOver: () => {
        if (!ok()) return false
        if (over?.id !== `g:${g}`) setOver({ id: `g:${g}`, after: false })
        return true
      },
      onDrop: () => {
        if (drag && ok()) {
          onChange(drag.multi ? groupMulti(comp, drag.multi, g) : drag.kind === "model" ? setModelGroup(comp, drag.id, g) : movePartToGroup(comp, drag.id, g))
          setOpenGroups((o) => new Set([...o, g]))
        }
        setDrag(null)
        setOver(null)
      },
      onEnd: () => {
        setDrag(null)
        setOver(null)
      },
    }
  }
  const [adding, setAdding] = useState<AddKind | null>(null)
  // Model 3D nou: un .glb, .gltf, .fbx o un zip de Poly Haven (es passa a .glb i s'optimitza en pujar-lo).
  const modelImport = useRef<ModelImportHandle>(null)
  const [uploading, setUploading] = useState(false)
  const { settings } = useSettings()
  const refPresets = settings.references.filter((r) => !r.hidden)
  const hasWall = comp.modules.some((m) => rowOf(m) === "wall")
  const rows: { row: "floor" | "wall"; label: string }[] = hasWall
    ? [
        { row: "floor", label: "A terra" },
        { row: "wall", label: "Penjats a la paret" },
      ]
    : [{ row: "floor", label: "" }]
  const onlyParts = partsOnlyKind(compositionKind(comp))
  // Objectes de referència només als mobles i models 3D només als objectes (per decisió de l'usuari). Treure ≠ esborrar:
  // si un document ja en té (fets abans), el grup surt sense el + perquè es puguin triar i eliminar.
  const isObject = compositionKind(comp) === "objecte"
  const models = comp.models ?? []
  const showRefs = !isObject || comp.references.length > 0
  const showModels = isObject || models.length > 0
  const parts = comp.parts ?? []
  // Grups de peces: plegats; s'obre sol el de la peça seleccionada.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const selGroup = selection.kind === "part" ? parts.find((q) => q.id === selection.id)?.group : selection.kind === "model" ? models.find((q) => q.id === selection.id)?.group : undefined
  if (selGroup && !openGroups.has(selGroup)) setOpenGroups(new Set([...openGroups, selGroup]))
  const toggleGroup = (g: string) => setOpenGroups((o) => {
    const n = new Set(o)
    if (n.has(g)) n.delete(g)
    else n.add(g)
    return n
  })
  const setPartGroup = (id: string, group: string | undefined) => {
    onChange({ ...comp, parts: parts.map((q) => (q.id === id ? { ...q, group } : q)) })
    if (group) setOpenGroups((o) => new Set([...o, group]))
  }
  const removePart = (id: string) => {
    onChange({ ...comp, parts: parts.filter((r) => r.id !== id) })
    if (selection.kind === "part" && selection.id === id) onSelect({ kind: "moble" })
  }
  const addModel = (asset: ModelChoice, label: string) => {
    const [w, , d] = asset.size
    // El centre de la petjada on surten les peces noves, a terra.
    const g = newModelObject(newId("g"), { ...asset, url: "" }, { x: Math.round(partCenter.x - w / 2), y: 0, z: Math.round(partCenter.z - d / 2) }, label)
    onChange({ ...comp, models: [...(comp.models ?? []), g] })
    onSelect({ kind: "model", id: g.id })
  }
  const removeModel = (id: string) => {
    onChange({ ...comp, models: models.filter((g) => g.id !== id) })
    if (selection.kind === "model" && selection.id === id) onSelect({ kind: "moble" })
  }
  const removeRef = (id: string) => {
    onChange({ ...comp, references: comp.references.filter((r) => r.id !== id) })
    if (selection.kind === "ref" && selection.id === id) onSelect({ kind: "moble" })
  }

  const inMultiSel = (kind: MultiItem["kind"], id: string) => selection.kind === "multi" && selection.items.some((x) => x.kind === kind && x.id === id)
  // L'ull i el cadenat (com Figma): de cada element i, als grups de peces, de tots els seus.
  type Listed = "modules" | "parts" | "references" | "models"
  const flip = (list: Listed, match: (x: { id: string; group?: string }) => boolean, flag: keyof ViewFlags, on: boolean) =>
    onChange({ ...comp, [list]: ((comp[list] ?? []) as ({ id: string; group?: string } & ViewFlags)[]).map((x) => (match(x) ? withFlag(x, flag, on) : x)) })
  const flagsOf = (list: Listed, x: { id: string } & ViewFlags): TreeRowFlags => ({
    hidden: x.hidden,
    locked: x.locked,
    onHide: () => flip(list, (y) => y.id === x.id, "hidden", !x.hidden),
    onLock: () => flip(list, (y) => y.id === x.id, "locked", !x.locked),
  })
  const groupFlags = (g: string): TreeRowFlags => {
    const members = [...parts, ...models].filter((q) => q.group === g)
    const hidden = members.every((q) => q.hidden)
    const locked = members.every((q) => q.locked)
    // Peces i models del grup alhora.
    const both = (flag: keyof ViewFlags, on: boolean) => {
      const set = <T extends { group?: string } & ViewFlags>(x: T): T => (x.group === g ? withFlag(x, flag, on) : x)
      onChange({ ...comp, parts: parts.map(set), ...(comp.models ? { models: comp.models.map(set) } : {}) })
    }
    return { hidden, locked, onHide: () => both("hidden", !hidden), onLock: () => both("locked", !locked) }
  }

  // La fila d'un grup (el mateix grup a Peces lliures i a Models 3D: es mou, es duplica i s'esborra sencer).
  const groupRow = (g: string, open: boolean, hint: string) => (
  <TreeRow
    depth={1}
    icon={open ? <LuChevronDown /> : <LuChevronRight />}
    onToggle={() => toggleGroup(g)}
    toggleLabel={open ? `Plegar «${g}»` : `Desplegar «${g}»`}
    label={g}
    hint={hint}
    dnd={groupDnd(g)}
    flags={groupFlags(g)}
    selected={selection.kind === "group" && selection.id === g}
    onClick={() => onSelect({ kind: "group", id: g })}
    menu={
      <TreeRowMenu label={`Opcions de «${g}»`}>
        <Menu.Item
          value="dup"
          onClick={() => {
            const res = duplicateGroup(comp, g)
            onChange(res.comp)
            onSelect({ kind: "group", id: res.group })
          }}
        >
          <LuCopy /> Duplicar el grup
        </Menu.Item>
        <Menu.Item value="ungroup" onClick={() => onChange(renameGroup(comp, g, undefined))}>
          <LuUngroup /> Desagrupar
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item
          value="del"
          color="fg.error"
          onClick={() => {
            onChange(removeGroup(comp, g))
            onSelect({ kind: "moble" })
          }}
        >
          <LuTrash2 /> Eliminar el grup
        </Menu.Item>
      </TreeRowMenu>
    }
  />
  )

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
      {!onlyParts && rows.map(({ row, label }) => (
        <Box key={row}>
          {label && (
            <Text fontSize="2xs" fontWeight="semibold" color="fg.subtle" textTransform="uppercase" letterSpacing="wider" pl="20px" pt={2} pb={0.5}>
              {label}
            </Text>
          )}
      {comp.modules.map((m, i) => ({ m, i })).filter(({ m }) => rowOf(m) === row).map(({ m, i }, k) => {
        const open = openId === m.id
        return (
          <Box key={m.id}>
            <TreeRow
              depth={1}
              icon={open ? <LuChevronDown /> : <LuChevronRight />}
              onToggle={() => toggle(m.id)}
              toggleLabel={open ? `Plegar «${m.name}»` : `Desplegar «${m.name}»`}
              label={`${k + 1}. ${m.name}`}
              hint={`${Math.round(m.carcass.width)} × ${Math.round(m.carcass.height)}`}
              selected={selection.kind === "module" && selection.id === m.id}
              onClick={() => onSelect({ kind: "module", id: m.id })}
              dnd={dnd("module", m.id)}
              flags={flagsOf("modules", m)}
              menu={
                <TreeRowMenu label={`Opcions de «${m.name}»`}>
                  <Menu.Item value="up" disabled={neighbourIndex(i, -1) < 0} onClick={() => move(i, -1)}>
                    <LuArrowLeft /> Moure a l'esquerra
                  </Menu.Item>
                  <Menu.Item value="down" disabled={neighbourIndex(i, 1) < 0} onClick={() => move(i, 1)}>
                    <LuArrowRight /> Moure a la dreta
                  </Menu.Item>
                  <Menu.Item value="dup" onClick={() => duplicate(i)}>
                    <LuCopy /> Duplicar
                  </Menu.Item>
                  <Menu.Separator />
                  <Menu.Item value="del" color="fg.error" onClick={() => remove(i)}>
                    <LuTrash2 /> Eliminar
                  </Menu.Item>
                </TreeRowMenu>
              }
            />
            {open && <ZoneRows zone={m.root} depth={2} moduleId={m.id} selection={selection} onSelect={onSelect} root />}
          </Box>
        )
      })}
        </Box>
      ))}

      {/* Peces lliures (flat-pack): com els objectes, però són peces de debò amb encaixos. */}
      <TreeSection onAdd={() => setAdding("part")} addLabel="Afegir peça lliure">Peces lliures</TreeSection>
      {(() => {
        const seen = new Set<string>()
        const partRow = (r: (typeof parts)[number], depth: number) => {
          const Icon = r.effect === "cut" ? LuScissors : ORIENT_ICON[r.orient]
          const groups = groupNames(comp).filter((g) => g !== r.group)
          return (
            <TreeRow
              key={r.id}
              depth={depth}
              icon={<Icon />}
              label={r.name.trim() || "Peça"}
              hint={`${Math.round(r.w)} × ${Math.round(r.h)}`}
              selected={(selection.kind === "part" && selection.id === r.id) || inMultiSel("part", r.id)}
              onClick={() => onSelect({ kind: "part", id: r.id })}
              dnd={dnd("part", r.id)}
              flags={flagsOf("parts", r)}
              menu={
                <TreeRowMenu label={`Opcions de «${r.name}»`}>
                  <Menu.Item
                    value="dup"
                    onClick={() => {
                      const res = insertPartCopy(comp, r)
                      onChange(res.comp)
                      onSelect({ kind: "part", id: res.id })
                    }}
                  >
                    <LuCopy /> Duplicar
                  </Menu.Item>
                  <Menu.Separator />
                  <Menu.Item value="group-new" onClick={() => setPartGroup(r.id, newGroupName(comp))}>
                    <LuGroup /> Agrupar en un grup nou
                  </Menu.Item>
                  {groups.map((g) => (
                    <Menu.Item key={g} value={`group-${g}`} onClick={() => setPartGroup(r.id, g)}>
                      <LuGroup /> Posar a «{g}»
                    </Menu.Item>
                  ))}
                  {r.group && (
                    <Menu.Item value="ungroup" onClick={() => setPartGroup(r.id, undefined)}>
                      <LuUngroup /> Treure del grup
                    </Menu.Item>
                  )}
                  <Menu.Separator />
                  <Menu.Item value="del" color="fg.error" onClick={() => removePart(r.id)}>
                    <LuTrash2 /> Eliminar
                  </Menu.Item>
                </TreeRowMenu>
              }
            />
          )
        }
        return parts.map((r) => {
          if (!r.group) return partRow(r, 1)
          if (seen.has(r.group)) return null
          const g = r.group
          seen.add(g)
          const members = parts.filter((q) => q.group === g)
          const open = openGroups.has(g)
          return (
            <Box key={`g:${g}`}>
              {groupRow(g, open, `${members.length} ${members.length === 1 ? "peça" : "peces"}`)}
              {open && members.map((q) => partRow(q, 2))}
            </Box>
          )
        })
      })()}
      {/* Arrossegant una peça d'un grup: zona per treure-la'n (queda solta). */}
      {drag?.kind === "part" && parts.find((q) => q.id === drag.id)?.group && (
        <HStack
          mt={1}
          mx={1}
          px={2}
          py={1.5}
          gap={2}
          rounded="md"
          fontSize="xs"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor={over?.id === "ungroup" ? "wood.solid" : "border.emphasized"}
          bg={over?.id === "ungroup" ? "wood.muted" : undefined}
          color={over?.id === "ungroup" ? "wood.fg" : "fg.muted"}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            if (over?.id !== "ungroup") setOver({ id: "ungroup", after: false })
          }}
          onDragLeave={() => over?.id === "ungroup" && setOver(null)}
          onDrop={(e) => {
            e.preventDefault()
            onChange(drag.multi ? ungroupMulti(comp, drag.multi) : removePartFromGroup(comp, drag.id))
            setDrag(null)
            setOver(null)
          }}
        >
          <LuUngroup /> Deixa-la aquí per treure-la del grup
        </HStack>
      )}

      {/* + d'objectes: els de Preferències › Objectes de referència (per decisió de l'usuari) o un en blanc. */}
      {showRefs && (
      <TreeSection
        addLabel="Afegir objecte de referència"
        hideAdd={isObject}
        menu={
          <>
            {refPresets.length > 0 && (
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel>De Preferències</Menu.ItemGroupLabel>
                {refPresets.map((p) => (
                  <Menu.Item
                    key={p.id}
                    value={`preset-${p.id}`}
                    onClick={() => {
                      const r = refFromPreset(comp, p)
                      onChange({ ...comp, references: [...comp.references, r] })
                      onSelect({ kind: "ref", id: r.id })
                    }}
                  >
                    <LuScan />
                    <Box flex="1" truncate>
                      {p.name}
                    </Box>
                    <Text as="span" fontSize="xs" color="fg.muted">
                      {Math.round(p.w)} × {Math.round(p.h)}
                    </Text>
                  </Menu.Item>
                ))}
              </Menu.ItemGroup>
            )}
            {refPresets.length > 0 && <Menu.Separator />}
            <Menu.Item value="blank" onClick={() => setAdding("ref")}>
              <LuPlus /> En blanc…
            </Menu.Item>
          </>
        }
      >
        Objectes de referència
      </TreeSection>
      )}
      {showRefs && comp.references.map((r) => (
        <TreeRow
          key={r.id}
          depth={1}
          icon={<LuScan />}
          label={r.name}
          hint={`${Math.round(r.w)} × ${Math.round(r.h)}`}
          selected={(selection.kind === "ref" && selection.id === r.id) || inMultiSel("ref", r.id)}
          onClick={() => onSelect({ kind: "ref", id: r.id })}
          dnd={dnd("ref", r.id)}
          flags={flagsOf("references", r)}
          menu={
            <TreeRowMenu label={`Opcions de «${r.name}»`}>
              {!isObject && (
                <Menu.Item
                  value="dup"
                  onClick={() => {
                    const res = insertRefCopy(comp, r)
                    onChange(res.comp)
                    onSelect({ kind: "ref", id: res.id })
                  }}
                >
                  <LuCopy /> Duplicar
                </Menu.Item>
              )}
              <Menu.Item value="del" color="fg.error" onClick={() => removeRef(r.id)}>
                <LuTrash2 /> Eliminar
              </Menu.Item>
            </TreeRowMenu>
          }
        />
      ))}

      {/* Models 3D (plantes, decoració…): només es veuen; es col·loquen com les peces lliures. */}
      {showModels && (
      <TreeSection
        addLabel="Importar un model 3D"
        hideAdd={!isObject}
        busy={uploading}
        menu={
          <>
            {/* Quin fitxer cal (per decisió de l'usuari: format, extensió, mida…), abans de triar-lo. */}
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>Quin fitxer?</Menu.ItemGroupLabel>
              <Stack gap={1.5} px={2} pb={2} fontSize="xs" color="fg.muted" lineHeight="1.4">
                {MODEL_FORMAT_HELP.map(([k, v]) => (
                  <Text key={k}>
                    <Text as="span" fontWeight="semibold" color="fg">
                      {k}:
                    </Text>{" "}
                    {v}
                  </Text>
                ))}
              </Stack>
            </Menu.ItemGroup>
            <Menu.Separator />
            <Menu.Item value="upload" onClick={() => modelImport.current?.pick("files")}>
              <LuFileUp /> Triar fitxers…
            </Menu.Item>
            <Menu.Item value="folder" onClick={() => modelImport.current?.pick("folder")}>
              <LuFolderOpen /> Triar carpeta…
            </Menu.Item>
          </>
        }
      >
        Models 3D
      </TreeSection>
      )}
      {showModels && (() => {
        const seen = new Set<string>()
        const modelRow = (g: (typeof models)[number], depth: number) => (
          <TreeRow
            key={g.id}
            depth={depth}
            icon={<LuSprout />}
            label={g.name.trim() || "Model"}
            hint={`${Math.round(g.w)} × ${Math.round(g.h)}`}
            selected={(selection.kind === "model" && selection.id === g.id) || inMultiSel("model", g.id)}
            onClick={() => onSelect({ kind: "model", id: g.id })}
            flags={flagsOf("models", g)}
            dnd={dnd("model", g.id)}
            menu={
              <TreeRowMenu label={`Opcions de «${g.name}»`}>
                {isObject && (
                  <Menu.Item
                    value="dup"
                    onClick={() => {
                      const res = insertModelCopy(comp, g)
                      onChange(res.comp)
                      onSelect({ kind: "model", id: res.id })
                    }}
                  >
                    <LuCopy /> Duplicar
                  </Menu.Item>
                )}
                <Menu.Separator />
                <Menu.Item value="group-new" onClick={() => {
                  const name = newGroupName(comp)
                  onChange(setModelGroup(comp, g.id, name))
                  setOpenGroups((o) => new Set([...o, name]))
                }}>
                  <LuGroup /> Agrupar en un grup nou
                </Menu.Item>
                {groupNames(comp).filter((n) => n !== g.group).map((n) => (
                  <Menu.Item key={n} value={`group-${n}`} onClick={() => onChange(setModelGroup(comp, g.id, n))}>
                    <LuGroup /> Posar a «{n}»
                  </Menu.Item>
                ))}
                {g.group && (
                  <Menu.Item value="ungroup" onClick={() => onChange(setModelGroup(comp, g.id, undefined))}>
                    <LuUngroup /> Treure del grup
                  </Menu.Item>
                )}
                <Menu.Separator />
                <Menu.Item value="del" color="fg.error" onClick={() => removeModel(g.id)}>
                  <LuTrash2 /> Eliminar
                </Menu.Item>
              </TreeRowMenu>
            }
          />
        )
        return models.map((m) => {
          if (!m.group) return modelRow(m, 1)
          if (seen.has(m.group)) return null
          const g = m.group
          seen.add(g)
          const members = models.filter((q) => q.group === g)
          const open = openGroups.has(g)
          return (
            <Box key={`mg:${g}`}>
              {groupRow(g, open, `${members.length} ${members.length === 1 ? "model" : "models"}`)}
              {open && members.map((q) => modelRow(q, 2))}
            </Box>
          )
        })
      })()}
      {/* Arrossegant un model d'un grup: zona per treure'l (queda solt). */}
      {drag?.kind === "model" && models.find((q) => q.id === drag.id)?.group && (
        <HStack
          mt={1}
          mx={1}
          px={2}
          py={1.5}
          gap={2}
          rounded="md"
          fontSize="xs"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor={over?.id === "ungroup" ? "wood.solid" : "border.emphasized"}
          bg={over?.id === "ungroup" ? "wood.muted" : undefined}
          color={over?.id === "ungroup" ? "wood.fg" : "fg.muted"}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            if (over?.id !== "ungroup") setOver({ id: "ungroup", after: false })
          }}
          onDragLeave={() => over?.id === "ungroup" && setOver(null)}
          onDrop={(e) => {
            e.preventDefault()
            onChange(drag.multi ? ungroupMulti(comp, drag.multi) : setModelGroup(comp, drag.id, undefined))
            setDrag(null)
            setOver(null)
          }}
        >
          <LuUngroup /> Deixa'l aquí per treure'l del grup
        </HStack>
      )}
    </Stack>
  )
}

function ZoneRows({
  zone,
  depth,
  moduleId,
  selection,
  onSelect,
  root,
}: {
  zone: Zone
  depth: number
  moduleId: string
  selection: Selection
  onSelect: (s: Selection) => void
  root?: boolean
}) {
  // L'arrel és l'«Interior» del mòdul (dividida o no): sense dividir, seleccionar-la dona el seu Front; dividida, la
  // Divisió (les portes de tot el mòdul, p. ex. d'un armari amb penjador i maleter, són a Mòdul › Portes; l'etiqueta ho
  // diu: «Interior · 2 portes»). Els compartiments hi pengen a sota.
  const selected = selection.kind === "zone" && selection.zoneId === zone.id
  // Icona segons el contingut (la mateixa que a les propietats).
  const icon = createElement(zoneIcon(zone, { root }))
  return (
    <>
      <TreeRow depth={depth} icon={icon} label={zoneLabel(zone, { root })} selected={selected} onClick={() => onSelect({ kind: "zone", moduleId, zoneId: zone.id })} muted />
      {zone.split?.children.map((c) => (
        <ZoneRows key={c.id} zone={c} depth={depth + 1} moduleId={moduleId} selection={selection} onSelect={onSelect} />
      ))}
    </>
  )
}
