import { Box, Menu, Text } from "@chakra-ui/react"
import { useRef } from "react"
import { LuBox, LuCopy, LuGroup, LuImage, LuPlus, LuScan, LuShapes, LuTrash2, LuUngroup } from "react-icons/lu"
import { boxCage, importedMesh, parseStl, groupMulti, groupNames, insertRefCopy, newGroupName, ungroupMulti, type RefObject } from "../../../core/model"
import { GroupRow } from "./GroupRow"
import { UngroupDropZone } from "./UngroupDropZone"
import { TreeRow, TreeRowMenu, TreeSection } from "../../../components/TreeRow"
import { useSettings } from "../../settings/SettingsContext"
import { cutterOver, refFor, refFromPreset } from "../addElements"
import { readReliefImage } from "../reliefImage"
import { toaster } from "../../../components/ui/toaster"
import type { TreeCtx } from "./treeCtx"

/**
 * «Objectes de referència»: el títol amb el + i les files. `isObject`: als objectes no se n'afegeixen ni dupliquen (només
 * es poden triar i eliminar els d'abans). `onAddBlank`: demanar el nom d'un objecte en blanc.
 */
export function RefSection({ tree, isObject, onAddBlank }: { tree: TreeCtx; isObject: boolean; onAddBlank: () => void }) {
  const { comp, selection, onSelect, onChange, dnd, flagsOf, inMultiSel, openGroups, openGroup } = tree
  const { settings } = useSettings()
  const refPresets = settings.references.filter((r) => !r.hidden)
  const removeRef = (id: string) => {
    onChange({ ...comp, references: comp.references.filter((r) => r.id !== id) })
    if (selection.kind === "ref" && selection.id === id) onSelect({ kind: "moble" })
  }

  const imageInput = useRef<HTMLInputElement>(null)
  const modelInput = useRef<HTMLInputElement>(null)
  const add = (r: RefObject) => {
    onChange({ ...comp, references: [...comp.references, r] })
    onSelect({ kind: "ref", id: r.id })
  }

  return (
    <>
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          if (!f) return
          readReliefImage(f)
            .then((image) => {
              const r = cutterOver(comp, selection.kind === "part" ? selection.id : undefined, { name: "Relleu", shape: "image", image }, 5, 5)
              add({ ...r, d: Math.round((r.w * image.h) / image.w) })
            })
            .catch(() => toaster.create({ type: "error", title: "No s'ha pogut llegir la imatge" }))
        }}
      />
      {/* Un model 3D (.stl) com a forma lliure: per tallar-lo en llistons o fresar-lo (`meshImport.ts`). */}
      <input
        ref={modelInput}
        type="file"
        accept=".stl,model/stl"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          if (!f) return
          f.arrayBuffer()
            .then((buf) => {
              const m = importedMesh(parseStl(buf))
              const used = new Set(comp.references.map((r) => r.name))
              const base = f.name.replace(/\.stl$/i, "") || "Model 3D"
              let name = base
              for (let n = 2; used.has(name); n++) name = `${base} ${n}`
              add(refFor({ name, shape: "mesh", mesh: m.mesh, w: m.w, h: m.h, d: m.d }))
              toaster.create({
                type: "info",
                title: `«${name}»: ${Math.round(m.w)} × ${Math.round(m.h)} × ${Math.round(m.d)} mm`,
                description: `${m.relief ? "S'ha fet com a relleu (el que es veu des del davant), amb el darrere pla. " : ""}${m.rough ? "Tenia massa triangles i s'ha simplificat: si els llistons surten malament, exporta'l amb menys de 20.000. " : ""}Si la mida no és la bona, canvia-la a l'inspector. Per fer-ne llistons: «Llistons», a l'inspector.`,
              })
            })
            .catch((err: unknown) => toaster.create({ type: "error", title: "No s'ha pogut llegir el model", description: err instanceof Error ? err.message : undefined }))
        }}
      />
      {/* + d'objectes: els de Preferències › Objectes de referència (per decisió de l'usuari) o un en blanc. */}
      <TreeSection
        addLabel="Afegir objecte de referència"
        hideAdd={isObject}
        menu={
          <>
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>Per fresar una peça</Menu.ItemGroupLabel>
              <Menu.Item value="mesh" onClick={() => add(cutterOver(comp, selection.kind === "part" ? selection.id : undefined, { name: "Forma lliure", shape: "mesh", mesh: boxCage() }, 20, 60))}>
                <LuShapes /> Forma lliure
              </Menu.Item>
              <Menu.Item value="image" onClick={() => imageInput.current?.click()}>
                <LuImage /> Relleu d'imatge…
              </Menu.Item>
              <Menu.Item value="model" onClick={() => modelInput.current?.click()}>
                <LuBox /> Model 3D (.stl)…
              </Menu.Item>
            </Menu.ItemGroup>
            <Menu.Separator />
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
            <Menu.Item value="blank" onClick={onAddBlank}>
              <LuPlus /> En blanc…
            </Menu.Item>
          </>
        }
      >
        Objectes de referència
      </TreeSection>
      {(() => {
        const seen = new Set<string>()
        const refRow = (r: RefObject, depth: number) => (
          <TreeRow
            key={r.id}
            depth={depth}
            icon={<LuScan />}
            label={r.name}
            hint={`${Math.round(r.w)} × ${Math.round(r.h)}`}
            selected={(selection.kind === "ref" && selection.id === r.id) || inMultiSel("ref", r.id)}
            onClick={() => onSelect({ kind: "ref", id: r.id })}
            dnd={dnd.dnd("ref", r.id)}
            flags={flagsOf("references", r)}
            menu={
              <TreeRowMenu label={`Accions de «${r.name}»`}>
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
                <Menu.Item value="group-new" onClick={() => {
                const name = newGroupName(comp)
                onChange(groupMulti(comp, [{ kind: "ref", id: r.id }], name))
                openGroup(name)
              }}>
                <LuGroup /> Agrupar en un grup nou
              </Menu.Item>
              {groupNames(comp).filter((n) => n !== r.group).map((n) => (
                <Menu.Item key={n} value={`group-${n}`} onClick={() => onChange(groupMulti(comp, [{ kind: "ref", id: r.id }], n))}>
                  <LuGroup /> Posar a «{n}»
                </Menu.Item>
              ))}
              {r.group && (
                <Menu.Item value="ungroup" onClick={() => onChange(ungroupMulti(comp, [{ kind: "ref", id: r.id }]))}>
                  <LuUngroup /> Treure del grup
                </Menu.Item>
              )}
              <Menu.Separator />
              <Menu.Item value="del" color="fg.error" onClick={() => removeRef(r.id)}>
                  <LuTrash2 /> Eliminar
                </Menu.Item>
              </TreeRowMenu>
            }
          />
        )
        // Grups (per decisió de l'usuari, 2026-10-16), com els dels models: plegats, amb la fila del grup.
        return comp.references.map((r) => {
          if (!r.group) return refRow(r, 1)
          if (seen.has(r.group)) return null
          const g = r.group
          seen.add(g)
          const members = comp.references.filter((q) => q.group === g)
          const open = openGroups.has(g)
          return (
            <Box key={`rg:${g}`}>
              <GroupRow tree={tree} g={g} open={open} hint={`${members.length} ${members.length === 1 ? "objecte" : "objectes"}`} />
              {open && members.map((q) => refRow(q, 2))}
              {dnd.drag?.kind === "ref" && dnd.dragGroup === g && (
                <UngroupDropZone {...dnd.ungroupZone(() => ungroupMulti(comp, dnd.drag?.multi ?? [{ kind: "ref", id: dnd.drag!.id }]))}>
                  <LuUngroup /> Deixa'l aquí per treure'l del grup
                </UngroupDropZone>
              )}
            </Box>
          )
        })
      })()}
    </>
  )
}
