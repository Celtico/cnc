import { SimpleGrid, Stack, Text } from "@chakra-ui/react"
import type { IconType } from "react-icons"
import { LuBlocks } from "react-icons/lu"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { useMemo } from "react"
import { withDefaultMaterials, type ComboCategory, type Template } from "../../core/model"
import { useSettings } from "../settings/SettingsContext"
import { useGalleryCols } from "./galleryGrid"
import { TemplateCard } from "./TemplateCard"

/**
 * Secció «Models constructius» de la pàgina Mobles (després de les Col·leccions; per decisió de l'usuari, 2026-10-21):
 * per a cada parella de regles del model, totes les combinacions (unes 25) sobre el mateix moble de mostra, per treure'n
 * idees. Un acordió per categoria; les miniatures es fan en obrir-lo (`TemplateCard`).
 */
export function CombosSection({
  value,
  categories,
  open,
  onOpenChange,
  searching,
  onCreate,
  title = "Models constructius",
  icon = LuBlocks,
  keepMaterials = false,
  description = "Totes les combinacions de dues regles del model sobre el mateix moble, per veure què fa cada opció i treure'n idees. Tria'n un per obrir-lo com a moble nou.",
}: {
  value: string
  categories: ComboCategory[]
  open: string[]
  onOpenChange: (v: string[]) => void
  searching: boolean
  onCreate: (t: Template) => void
  /** La mateixa secció serveix per a les mostres de proves («Proves»): el títol, la icona i l'explicació. */
  title?: string
  icon?: IconType
  description?: string
  /** Amb els materials de cada plantilla (els models del Nou moble), no els de Preferències. */
  keepMaterials?: boolean
}) {
  const cols = useGalleryCols()
  // Amb el tauler i el fons de Preferències (`withDefaultMaterials`): l'id de la miniatura els porta, perquè canviï amb ells.
  const { settings } = useSettings()
  const d = settings.defaults
  const key = `${d.material}|${d.thickness}|${d.backMaterial}|${d.backThickness}`
  const shown = useMemo(
    () =>
      categories
        .filter((c) => c.items.length > 0)
        .map((c) => ({
          ...c,
          items: c.items.map((t): Template => ({ ...t, id: `${t.id}@${key}`, make: keepMaterials ? t.make : () => withDefaultMaterials(settings, t.make()) })),
          ...(c.kickers ? { kickers: Object.fromEntries(Object.entries(c.kickers).map(([k, v]) => [`${k}@${key}`, v])) } : {}),
        })),
    [categories, settings, key, keepMaterials],
  )
  return (
    <FoldItem id={value} icon={icon} title={title} count={shown.reduce((n, c) => n + c.items.length, 0)}>
      <Stack gap={3}>
        <Text fontSize="xs" color="fg.muted" px="var(--gallery-px, 0)" pt={3}>
          {description}
        </Text>
        <FoldGroup variant="nested" value={open} onValueChange={onOpenChange} forceOpen={searching ? shown.map((c) => c.id) : null}>
          {shown.map((c) => (
            <FoldItem key={c.id} id={c.id} title={c.name} count={c.items.length}>
              <Stack gap={3}>
                <Text fontSize="xs" color="fg.muted" px="var(--gallery-px, 0)">
                  {c.description}
                </Text>
                <SimpleGrid columns={cols} gap={3}>
                  {c.items.map((t) => {
                    const own = c.kickers?.[t.id]
                    if (own) return <TemplateCard key={t.id} t={t} kicker={own} onPick={onCreate} />
                    const [a, b] = t.name.split(" · ")
                    return b ? <TemplateCard key={t.id} t={t} kicker={a} title={b} onPick={onCreate} /> : <TemplateCard key={t.id} t={t} onPick={onCreate} />
                  })}
                </SimpleGrid>
              </Stack>
            </FoldItem>
          ))}
        </FoldGroup>
      </Stack>
    </FoldItem>
  )
}
