import { Box, Field, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuCheck } from "react-icons/lu"
import { PickerButton, PickerDrawer, PickerRow } from "../../components/PickerDrawer"
import { fold } from "../projects/galleryGrid"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { MATERIAL_CATEGORIES, materialCategory, type MaterialPref } from "../../core/model"
import { MaterialThumb } from "./MaterialBits"
import { useSettings } from "./SettingsContext"

/**
 * Tria d'un material, la mateixa a tota l'app: un botó amb la mostra i el nom que obre un calaix (a la dreta a
 * l'ordinador, de baix al mòbil) amb un acordió per categoria; dins, les mostres de la textura (només es pinten les
 * de la categoria oberta) i en tocar-ne una es tria i es tanca. `emptyLabel`: una primera opció sense material
 * («Com el cos», «Com a Preferències»…), que dona `""`.
 */
export function MaterialSelect({ label, materials, value, onChange, emptyLabel, hideLabel }: { label: string; materials: MaterialPref[]; value: string; onChange: (name: string) => void; emptyLabel?: string; hideLabel?: boolean }) {
  const [open, setOpen] = useState(false)
  // La mostra del botó surt de tots els materials (la llista que es passa pot estar filtrada: sense fons, sense els de
  // simulació…); «no és a Preferències» només si de debò no hi és.
  const { settings } = useSettings()
  const current = materials.find((m) => m.name === value) ?? settings.materials.find((m) => m.name === value)
  const known = !!current
  // El valor actual no és dels que es poden triar aquí (un moble fet amb vidre al cos, un material que ja no hi és): es
  // continua veient com a valor actual, amb un avís.
  const offList = !!value && !materials.some((m) => m.name === value)
  const offNote = !known ? "No és a Preferències" : materialCategory(current) === "sim" ? "No es talla a la CNC (simulació)" : "No és per a aquí"
  // Cercador (per decisió de l'usuari): pel nom, sense accents; obre les categories amb resultats.
  const [query, setQuery] = useState("")
  const q = fold(query.trim())
  const cats = MATERIAL_CATEGORIES.map((c) => ({ ...c, list: materials.filter((m) => materialCategory(m) === c.id && (!q || fold(m.name).includes(q))) })).filter((c) => c.list.length)
  const [openCats, setOpenCats] = useState<string[]>([])
  const search = (v: string) => {
    setQuery(v)
    const f = fold(v.trim())
    if (f) setOpenCats(MATERIAL_CATEGORIES.filter((c) => materials.some((m) => materialCategory(m) === c.id && fold(m.name).includes(f))).map((c) => c.id))
  }
  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
  }
  return (
    <Field.Root flex={hideLabel ? 1 : undefined} minW={0}>
      {!hideLabel && <Field.Label fontSize="sm">{label}</Field.Label>}
      {/* Un botó (no un desplegable, per decisió de l'usuari): sense fons (per decisió de l'usuari), tota l'amplada, la mostra i el nom. */}
      <PickerButton
        ariaLabel={`${label}: ${current?.name ?? (value || emptyLabel || "sense material")}`}
        swatch={current ? <MaterialThumb m={current} size={20} /> : <Box w="20px" h="20px" rounded="sm" borderWidth="1px" borderStyle="dashed" flexShrink={0} />}
        text={current?.name ?? (value || emptyLabel || "(sense material)")}
        warn={offList ? offNote : undefined}
        onClick={() => {
          // S'obre per la categoria del material triat (sense, si només n'hi ha una, aquella), sense cerca.
          setQuery("")
          setOpenCats(current ? [materialCategory(current)] : cats.length === 1 ? [cats[0]!.id] : [])
          setOpen(true)
        }}
      />

      <PickerDrawer open={open} onOpenChange={setOpen} title={label} query={query} onQuery={search} placeholder="Cercar un material">
        {q && !cats.length && (
          <Text fontSize="sm" color="fg.muted">
            Cap material es diu així.
          </Text>
        )}
        {emptyLabel !== undefined && !q && (
          <PickerRow on={value === ""} onClick={() => pick("")}>
            <Box w="36px" h="36px" rounded="md" borderWidth="1px" borderStyle="dashed" flexShrink={0} />
            <Text fontSize="sm">{emptyLabel}</Text>
          </PickerRow>
        )}
        {offList && (
          <Text fontSize="xs" color="fg.muted">
            Ara: «{value}» ({offNote.toLowerCase()}). Es manté fins que en triïs un altre.
          </Text>
        )}
        <FoldGroup variant="nested" value={openCats} onValueChange={setOpenCats}>
          {cats.map((c) => (
            <FoldItem key={c.id} id={c.id} title={c.label} count={c.list.length}>
              {/* Mostres de la textura: només les de la categoria oberta (lazyMount). */}
              {/* Mostres quadrades a tota l'amplada de la columna, alineades a dalt; el nom, sempre dues línies
                  d'alt. La triada: vora del color principal al voltant de la mostra i ✓ a la cantonada. */}
              {/* 5 px de marge: la vora de la triada (outline a 2 px) no queda tallada pels costats. */}
              <SimpleGrid columns={3} gap={3} alignItems="start" p="5px">
                {c.list.map((m) => {
                  const on = m.name === value
                  return (
                    <Box key={m.id} asChild rounded="md" textAlign="start" role="group" focusRing="outside">
                      <button type="button" onClick={() => pick(m.name)} aria-pressed={on}>
                        <Stack gap={1.5}>
                          <Box position="relative" rounded="md" outline={on ? "2px solid" : undefined} outlineColor="wood.solid" outlineOffset="2px" _groupHover={on ? undefined : { opacity: 0.85 }}>
                            <MaterialThumb m={m} size={96} fill />
                            {on && (
                              <Box position="absolute" top={1.5} right={1.5} w="22px" h="22px" bg="wood.solid" color="wood.contrast" rounded="full" display="flex" alignItems="center" justifyContent="center" fontSize="xs" shadow="md">
                                <LuCheck />
                              </Box>
                            )}
                          </Box>
                          <Text fontSize="xs" lineClamp={2} minH="2lh" color={on ? "wood.fg" : undefined} fontWeight={on ? "semibold" : undefined}>
                            {m.name}
                          </Text>
                        </Stack>
                      </button>
                    </Box>
                  )
                })}
              </SimpleGrid>
            </FoldItem>
          ))}
        </FoldGroup>
      </PickerDrawer>
    </Field.Root>
  )
}
