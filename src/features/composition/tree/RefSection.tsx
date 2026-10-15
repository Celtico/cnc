import { Box, Menu, Text } from "@chakra-ui/react"
import { LuCopy, LuPlus, LuScan, LuTrash2 } from "react-icons/lu"
import { insertRefCopy } from "../../../core/model"
import { TreeRow, TreeRowMenu, TreeSection } from "../../../components/TreeRow"
import { useSettings } from "../../settings/SettingsContext"
import { refFromPreset } from "../addElements"
import type { TreeCtx } from "./treeCtx"

/**
 * «Objectes de referència»: el títol amb el + i les files. `isObject`: als objectes no se n'afegeixen ni dupliquen (només
 * es poden triar i eliminar els d'abans). `onAddBlank`: demanar el nom d'un objecte en blanc.
 */
export function RefSection({ tree, isObject, onAddBlank }: { tree: TreeCtx; isObject: boolean; onAddBlank: () => void }) {
  const { comp, selection, onSelect, onChange, dnd, flagsOf, inMultiSel } = tree
  const { settings } = useSettings()
  const refPresets = settings.references.filter((r) => !r.hidden)
  const removeRef = (id: string) => {
    onChange({ ...comp, references: comp.references.filter((r) => r.id !== id) })
    if (selection.kind === "ref" && selection.id === id) onSelect({ kind: "moble" })
  }

  return (
    <>
      {/* + d'objectes: els de Preferències › Objectes de referència (per decisió de l'usuari) o un en blanc. */}
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
            <Menu.Item value="blank" onClick={onAddBlank}>
              <LuPlus /> En blanc…
            </Menu.Item>
          </>
        }
      >
        Objectes de referència
      </TreeSection>
      {comp.references.map((r) => (
        <TreeRow
          key={r.id}
          depth={1}
          icon={<LuScan />}
          label={r.name}
          hint={`${Math.round(r.w)} × ${Math.round(r.h)}`}
          selected={(selection.kind === "ref" && selection.id === r.id) || inMultiSel("ref", r.id)}
          onClick={() => onSelect({ kind: "ref", id: r.id })}
          dnd={dnd.dnd("ref", r.id)}
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
    </>
  )
}
