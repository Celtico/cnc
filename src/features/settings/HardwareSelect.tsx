import { Badge, Box, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { PickerButton, PickerDrawer, PickerRow } from "../../components/PickerDrawer"
import { HARDWARE_CATEGORIES, INHERITED_LABEL, OWN_COPY_LABEL, hardwareChoices, hardwareSummary, isDrawerKit, isPendingImport, type HardwareChoice, type HardwareItem } from "../../core/model"
import { GalleryCard } from "../projects/GalleryCard"
import { fold } from "../projects/galleryGrid"
import { HARDWARE_ICONS } from "./hardwareIcons"
import { hardwareMatches, seriesGroups, useMountBase } from "./hardwareGroups"
import { HardwareThumb } from "./HardwareThumb"
import { useSettings } from "./SettingsContext"

/** Columnes de les targetes al calaix (més estret que una pàgina). */
const COLS = { base: 2, md: 2 }

interface HardwareDrawerProps {
  /** Títol del calaix (el del camp: «Frontissa», «Tirador», «Afegir ferratge»). */
  label: string
  /** Els que es poden triar aquí (ja filtrats: del mateix tipus, o que es poden col·locar a aquestes peces). */
  items: readonly HardwareItem[]
  /** La còpia que porta el moble (sense, `emptyLabel` o res triat). */
  current?: HardwareItem
  /** El del mòdul (als fronts i accessoris, «Com el mòdul»): triar-lo treu el propi (`onPick(undefined)`). */
  inherited?: HardwareItem
  /** Una primera opció sense ferratge («Genèriques»), que dona `undefined`. */
  emptyLabel?: string
  /** Una nota a dalt del calaix (què passa en triar-ne un). */
  note?: ReactNode
  /** Una opció més sense cap ferratge («Cap (push)» al tirador): es tria amb el seu `onPick`. */
  none?: HardwareNoneOption
  onPick: (item: HardwareItem | undefined) => void
}

/** Opció «cap ferratge» d'un selector (el push d'un tirador). */
export interface HardwareNoneOption {
  label: string
  help?: string
  selected: boolean
  onPick: () => void
}

/**
 * **Tria d'un ferratge al moble**, la mateixa a tot l'Editor (per decisió de l'usuari, «com la col·locació de materials i
 * objectes als ambients»): frontissa, guia, braç d'abatible i tirador de cada front, l'espiga del mòdul (Mòdul › Unió),
 * la pota de la base i «Afegir ferratge» (col·locats a mà). Un botó (`PickerButton`: la miniatura 3D de la
 * targeta de Preferències › Ferratges i el nom) que obre el calaix comú (`PickerDrawer`) amb el cercador, les categories
 * › sèries i les targetes (`GalleryCard` amb la miniatura 3D). En triar-ne un, se'n desa una **còpia** (`onPick`), com
 * fan els mòduls. Les còpies que no són a la biblioteca tal qual (`hardwareChoices`) surten a part, «Còpia pròpia», i els
 * importats sense confirmar porten la insígnia (es poden triar, però no fan cap forat).
 */
export function HardwareSelect(props: HardwareDrawerProps & { hideLabel?: boolean }) {
  const [open, setOpen] = useState(false)
  const { settings } = useSettings()
  const base = useMountBase(settings)
  const { label, items, current, inherited, emptyLabel, none } = props
  const shown = none?.selected ? undefined : (current ?? inherited)
  // Una còpia que no és a la biblioteca tal qual: «(còpia pròpia)».
  const ownCopy = !!current && hardwareChoices(items, current).options.some((o) => o.own)
  return (
    <Stack gap={0} flex={1} minW={0} align="stretch">
      <PickerButton
        ariaLabel={`${label}: ${none?.selected ? none.label : (shown?.name ?? emptyLabel ?? "cap")}`}
        swatch={
          <Box w="44px" flexShrink={0}>
            {shown ? <HardwareThumb item={shown} base={base} materials={settings.materials} /> : <Box aspectRatio="2 / 1" rounded="md" borderWidth="1px" borderStyle="dashed" />}
          </Box>
        }
        text={none?.selected ? none.label : shown ? `${shown.name}${ownCopy ? ` (${OWN_COPY_LABEL.toLowerCase()})` : ""}${inherited && (!current || current === inherited) ? ` · ${INHERITED_LABEL}` : ""}` : (emptyLabel ?? "(cap)")}
        warn={current && !none?.selected && isPendingImport(current) ? "Sense confirmar: no fa cap forat" : undefined}
        onClick={() => setOpen(true)}
      />
      <HardwareDrawer {...props} open={open} onOpenChange={setOpen} />
    </Stack>
  )
}

/** El calaix del selector de ferratges (també sol, sense botó: «Afegir ferratge»). */
function HardwareDrawer({ open, onOpenChange, label, items, current, inherited, emptyLabel, note, none, onPick }: HardwareDrawerProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { settings } = useSettings()
  const base = useMountBase(settings)
  const [query, setQuery] = useState("")
  const q = fold(query.trim())
  // Sense còpia pròpia (un front amb el del mòdul): la triada és la del mòdul.
  const cur = current ?? inherited
  const choices = cur ? hardwareChoices(items, cur, inherited) : { options: items.map((x): HardwareChoice => ({ key: x.id, item: x, label: x.name, own: false })), value: "none", inheritedKey: undefined }
  const { options, inheritedKey } = choices
  // Amb «cap» triat (push), cap targeta marcada.
  const value = none?.selected ? "__none__" : choices.value
  const lib = options.filter((o) => !o.own)
  const own = options.filter((o) => o.own && (!q || hardwareMatches(o.item, q)))
  const groups = HARDWARE_CATEGORIES.map((c) => {
    const list = lib.filter((o) => o.item.category === c.id && (!q || hardwareMatches(o.item, q))).map((o) => o.item)
    return { ...c, count: list.length, ...seriesGroups(c.id, list) }
  }).filter((g) => g.count)
  const currentCat = options.find((o) => o.key === value && !o.own)?.item.category
  const [openCats, setOpenCats] = useState<string[]>([])
  const [openSeries, setOpenSeries] = useState<string[]>([])
  // En obrir-se: per la categoria del triat (o, si només n'hi ha una, aquella), sense cerca (estat derivat, sense efecte).
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery("")
      setOpenCats(currentCat ? [currentCat] : groups.length === 1 ? [groups[0]!.id] : [])
    }
  }
  const keyOf = (item: HardwareItem) => lib.find((o) => o.item === item)?.key ?? item.id
  const pick = (key: string) => {
    onOpenChange(false)
    if (key === "none" || key === inheritedKey) return onPick(undefined)
    const hit = options.find((o) => o.key === key)
    if (hit) onPick(structuredClone(hit.item))
  }
  const pending = options.some((o) => isPendingImport(o.item))
  const card = (item: HardwareItem, key: string, isOwn = false) => (
    <GalleryCard
      key={key}
      thumb={<HardwareThumb item={item} base={base} materials={settings.materials} />}
      title={item.name}
      kicker={[item.maker, item.ref].filter(Boolean).join(" · ") || undefined}
      description={hardwareSummary(item)}
      tags={
        <>
          {isOwn && (
            <Badge size="xs" variant="subtle" colorPalette="wood" title="La còpia que porta el moble: no és a la biblioteca tal qual (esborrada, d'un altre fitxer o amb un altre contingut). És la que es fabrica.">
              {OWN_COPY_LABEL}
            </Badge>
          )}
          {isPendingImport(item) && (
            <Badge size="xs" variant="subtle" colorPalette="orange" title="Importat: no fa cap forat fins que el confirmis a Preferències › Ferratges">
              Sense confirmar
            </Badge>
          )}
          {item.engine === "model" && !item.machining?.length && (
            <Badge size="xs" variant="subtle" colorPalette="gray" title="Sense mecanitzats: el model, mai cap forat">
              Només 3D
            </Badge>
          )}
        </>
      }
      selected={key === value}
      onClick={() => pick(key)}
    />
  )
  return (
    <PickerDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={label}
      query={query}
      onQuery={setQuery}
      placeholder="Cercar un ferratge"
      size="md"
      testId="hardware-drawer"
    >
      {note && (
        <Text fontSize="sm" color="fg.muted">
          {note}
        </Text>
      )}
      {pending && (
        <Text fontSize="xs" color="orange.fg" data-testid="hardware-drawer-pending">
          Els que diuen «Sense confirmar» són importats que encara no s'han revisat: es poden triar, però no fan cap forat (ni ho fa el taller) fins que els confirmis a Preferències › Ferratges.
        </Text>
      )}
      {none && !q && (
        <PickerRow on={none.selected} onClick={() => { onOpenChange(false); none.onPick() }} testId="hardware-drawer-none">
          <Box w="64px" flexShrink={0} aspectRatio="2 / 1" rounded="md" borderWidth="1px" borderStyle="dashed" />
          <Stack gap={0} align="start" minW={0} flex="1">
            <Text fontSize="sm">{none.label}</Text>
            {none.help && (
              <Text fontSize="xs" color="fg.muted">
                {none.help}
              </Text>
            )}
          </Stack>
        </PickerRow>
      )}
      {(emptyLabel !== undefined || inheritedKey !== undefined) && !q && (
        <PickerRow on={value === "none" || value === inheritedKey} onClick={() => pick(inheritedKey ?? "none")} testId="hardware-drawer-empty">
          <Box w="64px" flexShrink={0}>
            {inherited ? <HardwareThumb item={inherited} base={base} materials={settings.materials} /> : <Box aspectRatio="2 / 1" rounded="md" borderWidth="1px" borderStyle="dashed" />}
          </Box>
          <Stack gap={0} align="start" minW={0} flex="1">
            <Text fontSize="sm">{inherited ? (isDrawerKit(inherited) ? `${INHERITED_LABEL} (joc de calaix)` : INHERITED_LABEL) : emptyLabel}</Text>
            {inherited && (
              <Text fontSize="xs" color="fg.muted">
                {inherited.name}
              </Text>
            )}
          </Stack>
        </PickerRow>
      )}
      {own.length > 0 && (
        <Stack gap={2}>
          <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
            Còpies pròpies
          </Text>
          <SimpleGrid columns={COLS} gap={3} p="5px">
            {own.map((o) => card(o.item, o.key, true))}
          </SimpleGrid>
        </Stack>
      )}
      {q && !groups.length && !own.length && (
        <Text fontSize="sm" color="fg.muted">
          Cap ferratge es diu així.
        </Text>
      )}
      {!q && !options.length && (
        <Text fontSize="sm" color="fg.muted">
          No n'hi ha cap per a aquí a Preferències › Ferratges.
        </Text>
      )}
      <FoldGroup variant="nested" value={openCats} onValueChange={setOpenCats} forceOpen={q ? groups.map((g) => g.id) : null}>
        {groups.map((g) => (
          <FoldItem key={g.id} id={g.id} icon={HARDWARE_ICONS[g.id]} title={g.label} count={g.count}>
            <Stack gap={3}>
              {g.loose.length > 0 && (
                <SimpleGrid columns={COLS} gap={3} p="5px">
                  {g.loose.map((x) => card(x, keyOf(x)))}
                </SimpleGrid>
              )}
              {g.series.length > 0 && (
                <FoldGroup variant="nested" value={openSeries} onValueChange={setOpenSeries} forceOpen={q ? g.series.map((s) => s.key) : null}>
                  {g.series.map((s) => (
                    <FoldItem key={s.key} id={s.key} title={s.label} count={s.items.length}>
                      <SimpleGrid columns={COLS} gap={3} p="5px">
                        {s.items.map((x) => card(x, keyOf(x)))}
                      </SimpleGrid>
                    </FoldItem>
                  ))}
                </FoldGroup>
              )}
            </Stack>
          </FoldItem>
        ))}
      </FoldGroup>
    </PickerDrawer>
  )
}
