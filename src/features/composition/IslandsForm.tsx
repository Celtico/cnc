import { Button, Stack, Switch, Text } from "@chakra-ui/react"
import { LuPlus, LuTrash2 } from "react-icons/lu"
import { boardChoices, mountOf, newId, setModuleMount, type Composition, type Island, type Module } from "../../core/model"
import { ISLAND_END_THICKNESS } from "../../core/build/islands"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { NumRow } from "../../components/NumRow"
import { MaterialSelect } from "../settings/MaterialSelect"
import { useSettings } from "../settings/SettingsContext"

/**
 * **Illes** del moble (per decisió de l'usuari, 2026-10-13: «fiquem les opcions que diuen els professionals»): dos mòduls
 * d'esquena (el de darrere es gira i es posa sol) i els panells de remat dels costats (`core/build/islands.ts`).
 * «Afegir illa» posa tots dos mòduls «Lliure al terra».
 */
export function IslandsForm({ comp, onChange }: { comp: Composition; onChange: (c: Composition) => void }) {
  const { settings } = useSettings()
  const islands = comp.islands ?? []
  const boards = boardChoices(settings.materials)
  const options = comp.modules.map((m) => ({ id: m.id, label: m.name }))
  const setIsland = (id: string, patch: Partial<Island>) => onChange({ ...comp, islands: islands.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  // Tots dos mòduls lliures al terra (on són ara: la X que tenen a la fila).
  const freeModules = (c: Composition, ids: string[]): Module[] => c.modules.map((m) => (ids.includes(m.id) && mountOf(m) !== "floor" ? setModuleMount(m, "floor", m.x ?? 0) : m))
  const add = () => {
    const used = new Set(islands.flatMap((i) => [i.front, i.back]))
    const free = comp.modules.filter((m) => !used.has(m.id))
    const [f, b] = free.length >= 2 ? free : comp.modules
    if (!f || !b) return
    const isl: Island = { id: newId("isl"), front: f.id, back: b.id, gap: 0, left: true, right: true }
    onChange({ ...comp, modules: freeModules(comp, [f.id, b.id]), islands: [...islands, isl] })
  }
  const pick = (isl: Island, key: "front" | "back", id: string) => {
    if (id === isl[key]) return
    // Triar com a davant el que era el de darrere (o al revés): s'intercanvien.
    const other = key === "front" ? "back" : "front"
    const patch = id === isl[other] ? { [key]: id, [other]: isl[key] } : { [key]: id }
    const next = { ...comp, islands: islands.map((i) => (i.id === isl.id ? { ...i, ...patch } : i)) }
    onChange({ ...next, modules: freeModules(next, [id]) })
  }
  return (
    <Stack gap={4}>
      <Text textStyle="xs" color="fg.muted">
        Com es fan les illes de cuina: dues files de mòduls d'esquena, cargolades i amb els fronts enrasats, i un panell de remat a cada costat que les cobreix totes dues. El de darrere es gira i es col·loca sol.
      </Text>
      {islands.map((isl, k) => (
        <Stack key={isl.id} gap={0}>
          <Text fontSize="sm" fontWeight="medium" pb={1}>
            Illa {k + 1}
          </Text>
          <FormRow label="Davant">
            <ChoiceChips label="Davant" options={options} value={isl.front} onChange={(id) => pick(isl, "front", id)} />
          </FormRow>
          <FormRow label="Darrere" help="Girat 180° i enganxat al darrere del de davant, amb la mateixa X.">
            <ChoiceChips label="Darrere" options={options} value={isl.back} onChange={(id) => pick(isl, "back", id)} />
          </FormRow>
          <NumRow label="Pas de cables" value={isl.gap} min={0} max={200} step={5} onChange={(gap) => Number.isFinite(gap) && setIsland(isl.id, { gap })} help="Separació entre les dues files (per passar-hi cables)." />
          <FormRow label="Remat esquerre">
            <Switch.Root size="sm" pt="6px" checked={isl.left} onCheckedChange={(e) => setIsland(isl.id, { left: e.checked })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Panell de remat</Switch.Label>
            </Switch.Root>
          </FormRow>
          <FormRow label="Remat dret">
            <Switch.Root size="sm" pt="6px" checked={isl.right} onCheckedChange={(e) => setIsland(isl.id, { right: e.checked })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Panell de remat</Switch.Label>
            </Switch.Root>
          </FormRow>
          {(isl.left || isl.right) && (
            <>
              <NumRow label="Gruix del remat" value={isl.thickness ?? ISLAND_END_THICKNESS} min={3} max={60} step={1} onChange={(thickness) => Number.isFinite(thickness) && setIsland(isl.id, { thickness })} />
              <FormRow label="Material del remat">
                <MaterialSelect label="Material del remat" materials={boards} value={isl.material ?? ""} emptyLabel="Com els fronts" hideLabel onChange={(v) => setIsland(isl.id, { material: v || undefined })} />
              </FormRow>
            </>
          )}
          <Button size="sm" variant="outline" alignSelf="flex-start" mt={2} onClick={() => onChange({ ...comp, islands: islands.filter((i) => i.id !== isl.id) })}>
            <LuTrash2 /> Treure l'illa
          </Button>
        </Stack>
      ))}
      <Button size="sm" variant="outline" alignSelf="flex-start" onClick={add}>
        <LuPlus /> Afegir illa
      </Button>
    </Stack>
  )
}
