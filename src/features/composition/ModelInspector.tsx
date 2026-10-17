import { Button, Menu, Stack, Text } from "@chakra-ui/react"
import { LuCopy, LuMove, LuMoveDiagonal, LuMoveDiagonal2, LuMoveHorizontal, LuMoveVertical, LuPalette, LuSprout, LuTrash2 } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { NumRow } from "../../components/NumRow"
import { FormRow } from "../../components/FormRow"
import { insertModelCopy, type Composition, type ModelObject } from "../../core/model"
import { ModelUploadButton } from "./ModelUpload"
import { useModelAssets } from "./useModelAssets"
import { AxisLabel } from "../../components/AxisLabel"
import { MaterialSelect } from "../settings/MaterialSelect"
import { useSettings } from "../settings/SettingsContext"
import { ActionsMenu } from "../../components/ActionsMenu"

/** Propietats d'un model 3D (`Composition.models`): quin model, mides de la caixa i posició (com una peça lliure). */
export function ModelInspector({ comp, id, onChange }: { comp: Composition; id: string; onChange: (c: Composition) => void }) {
  const { resolve } = useModelAssets()
  const { settings } = useSettings()
  const g = comp.models?.find((m) => m.id === id)
  if (!g) return null
  const update = (patch: Partial<ModelObject>) => onChange({ ...comp, models: (comp.models ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const asset = resolve(g.src)
  const original = !!asset && asset.size[0] === g.w && asset.size[1] === g.h && asset.size[2] === g.d
  return (
    <Stack gap={0}>
      <FoldItem id="model-asset" title="Model" icon={LuSprout} badge={asset?.name}>
        {/* Sense llista de models (per decisió de l'usuari): el nom del que hi ha i, per canviar-lo, un altre .glb teu. */}
        <FormRow label="Model">
          <Text fontSize="sm" pt="6px" truncate title={asset?.name}>
            {asset?.name ?? "—"}
          </Text>
        </FormRow>
        {!asset && (
          <Text fontSize="xs" color="fg.error">
            Aquest model ja no hi és (s'ha esborrat): no es veu res. Puja'l de nou.
          </Text>
        )}
        <FormRow label="Canviar">
          <ModelUploadButton onUploaded={(m) => update({ src: m.id, w: m.size[0], h: m.size[1], d: m.size[2] })} />
        </FormRow>
      </FoldItem>
      {/* Un material de Preferències per a tot el model, en lloc de les textures del fitxer (per decisió de l'usuari). */}
      <FoldItem id="model-material" title="Material" icon={LuPalette} badge={g.material ?? "Com el fitxer"} badgePalette={g.material ? "wood" : "gray"}>
        <FormRow label="Material" help={g.material ? "Tot el model amb aquest material (al 3D, la Presentació, el render, les miniatures i els ambients)." : "Les textures que porta el fitxer del model."} maxW="280px">
          <MaterialSelect label="Material" materials={settings.materials} value={g.material ?? ""} emptyLabel="Com el fitxer" hideLabel onChange={(v) => update({ material: v || undefined })} />
        </FormRow>
      </FoldItem>
      <FoldItem id="model-size" title="Mides" icon={LuMoveDiagonal} badge={`${Math.round(g.w)} × ${Math.round(g.h)}`}>
        <NumRow label="Amplada" value={g.w} min={1} max={20000} step={10} onChange={(w) => w > 0 && update({ w })} />
        <NumRow label="Alçada" value={g.h} min={1} max={20000} step={10} onChange={(h) => h > 0 && update({ h })} />
        <NumRow label="Fondària" value={g.d} min={1} max={20000} step={10} onChange={(d) => d > 0 && update({ d })} />
        {asset && (
          <FormRow label="" help={`Mida real del model: ${asset.size.join(" × ")} mm.`}>
            <Button size="xs" variant="outline" alignSelf="flex-start" disabled={original} onClick={() => update({ w: asset.size[0], h: asset.size[1], d: asset.size[2] })}>
              Mida original
            </Button>
          </FormRow>
        )}
      </FoldItem>
      <FoldItem id="model-position" title="Posició" icon={LuMove}>
        <NumRow label={<AxisLabel icon={LuMoveHorizontal} name="De costat" axis="X" hint="Des de l'esquerra del moble" />} ariaLabel="De costat (X)" value={g.x} min={-30000} max={30000} step={10} onChange={(x) => update({ x })} />
        <NumRow label={<AxisLabel icon={LuMoveVertical} name="Alçada" axis="Y" hint="Des del terra" />} ariaLabel="Alçada (Y)" value={g.y} min={0} max={30000} step={10} onChange={(y) => update({ y })} />
        <NumRow label={<AxisLabel icon={LuMoveDiagonal2} name="Fondària" axis="Z" hint="Des de la paret cap endavant" />} ariaLabel="Fondària (Z)" value={g.z} min={-30000} max={30000} step={10} onChange={(z) => update({ z })} />
        <NumRow label="Gir" suffix="°" value={g.rot ?? 0} min={-360} max={360} step={15} onChange={(rot) => update({ rot })} help="Al voltant del vertical, pel centre." />
        <Text fontSize="xs" color="fg.muted">
          Al 3D es mou amb les fletxes del gizmo. Fletxes del teclat: 1 mm (Maj: 10 mm); Re Pàg / Av Pàg: fondària.
        </Text>
      </FoldItem>
    </Stack>
  )
}

/** Accions del model seleccionat, a la capçalera de l'inspector (com les dels objectes). */
export function ModelActions({ comp, id, onChange, onRemoved, onSelected }: { comp: Composition; id: string; onChange: (c: Composition) => void; onRemoved: () => void; onSelected?: (id: string) => void }) {
  const g = comp.models?.find((m) => m.id === id)
  if (!g) return null
  return (
    <ActionsMenu label="Accions del model">
      <Menu.Item
        value="dup"
        onClick={() => {
          const res = insertModelCopy(comp, g)
          onChange(res.comp)
          onSelected?.(res.id)
        }}
      >
        <LuCopy /> Duplicar
      </Menu.Item>
      <Menu.Separator />
      <Menu.Item
        value="del"
        color="fg.error"
        onClick={() => {
          onChange({ ...comp, models: (comp.models ?? []).filter((m) => m.id !== id) })
          onRemoved()
        }}
      >
        <LuTrash2 /> Eliminar
      </Menu.Item>
    </ActionsMenu>
  )
}
