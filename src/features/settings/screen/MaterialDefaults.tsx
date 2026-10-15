import { Stack, Text } from "@chakra-ui/react"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { backChoices, boardChoices, type MaterialPref, type Settings } from "../../../core/model"
import { MaterialSelect } from "../MaterialSelect"

/** A l'editor d'un tauler o d'un fons, sota el formulari: quin tauler i quin fons tenen els mòduls nous. */
export function MaterialDefaults({ materials, defaults, onChange }: { materials: MaterialPref[]; defaults: Settings["defaults"]; onChange: (defaults: Settings["defaults"]) => void }) {
  return (
    <>
      <FormRow label="Tauler">
        <DefaultPick label="Tauler" materials={boardChoices(materials)} all={materials} material={defaults.material} thickness={defaults.thickness} onChange={(material, thickness) => onChange({ ...defaults, material, thickness })} />
      </FormRow>
      <FormRow label="Fons">
        <DefaultPick label="Fons" materials={backChoices(materials)} all={materials} material={defaults.backMaterial} thickness={defaults.backThickness} onChange={(backMaterial, backThickness) => onChange({ ...defaults, backMaterial, backThickness })} />
      </FormRow>
    </>
  )
}

/** Material i gruix per defecte en una fila: el gruix es tria d'entre els del material. */
function DefaultPick({ label, materials, all, material, thickness, onChange }: { label: string; materials: MaterialPref[]; all: MaterialPref[]; material: string; thickness: number; onChange: (material: string, thickness: number) => void }) {
  const known = all.find((m) => m.name === material)
  const list = known?.thicknesses ?? []
  // Un gruix que no és dels del material no s'afegeix com a pastilla: una nota a sota.
  return (
    // Les pastilles del gruix van a sota (no hi caben al costat del material).
    <Stack gap={2} maxW="400px">
      <MaterialSelect
        hideLabel
        label={label}
        materials={materials}
        value={material}
        onChange={(name) => {
          // En canviar de material, el gruix passa al més proper dels seus.
          const t = all.find((m) => m.name === name)?.thicknesses ?? []
          onChange(name, t.includes(thickness) || !t.length ? thickness : t.reduce((a, b) => (Math.abs(b - thickness) < Math.abs(a - thickness) ? b : a)))
        }}
      />
      {list.length > 0 && <ChoiceChips label={`Gruix ${label.toLowerCase()}`} options={list.map((t) => ({ id: String(t), label: `${t} mm` }))} value={String(thickness)} onChange={(v) => onChange(material, Number(v))} />}
      {!known ? (
        <Text fontSize="xs" color="fg.muted">
          El material «{material}» no és a Preferències: tria'n un altre.
        </Text>
      ) : (
        !list.includes(thickness) && (
          <Text fontSize="xs" color="fg.muted">
            El gruix {thickness} mm no és dels gruixos de «{material}»: tria'n un.
          </Text>
        )
      )}
    </Stack>
  )
}
