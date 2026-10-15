import { Badge, Menu, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useContext, useRef, useState } from "react"
import { LuStar } from "react-icons/lu"
import { EditorDialog } from "../../components/EditorDialog"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { toaster } from "../../components/ui/toaster"
import { syncPairedPlates } from "../../core/model/hardwareEdit"
import { reframeImported } from "./hardwareReframe"
import { HardwareThumb } from "./HardwareThumb"
import { hardwareMatches, seriesGroups, useMountBase } from "./hardwareGroups"
import { SearchBar } from "../../components/SearchBar"
import { useSessionList } from "../../components/sessionState"
import {
  DEFAULT_MODULE_HARDWARE,
  appItemOfEngine,
  HARDWARE_CATEGORIES,
  HARDWARE_SLOTS,
  copyHardwareItem,
  hardwareSummary,
  isPendingImport,
  newId,
  slotAccepts,
  slotForEngine,
  type HardwareDefaults,
  type HardwareEngine,
  type HardwareItem,
  type MaterialPref,
  type Settings,
} from "../../core/model"
import { GalleryCard } from "../projects/GalleryCard"
import { GALLERY_COLS, fold } from "../projects/galleryGrid"
import { HARDWARE_ICONS } from "./hardwareIcons"
import { PaneHeadContext } from "./paneHead"
import { useCloseWhenGone } from "./useCloseWhenGone"
import { slotOfEngine } from "./hardware/engineHelp"
import { HardwareCard } from "./hardware/HardwareCard"
import { HardwareStage } from "./hardware/HardwareStage"

const NO_MATERIALS: MaterialPref[] = []

/** Categories obertes (es recorden durant la sessió). */
const OPEN_KEY = "mobles:md-open:hardware"
/** Sèries obertes dins de les categories («hinge/sensys»…), durant la sessió. */
const SERIES_KEY = "mobles:md-open:hardware-series"

/**
 * Preferències › Ferratges (millores v1 F2): la biblioteca com a graella de targetes per categoria (el mateix acordió que
 * Materials i les galeries) i, en tocar-ne una, l'editor a pantalla completa (`EditorDialog`): a l'esquerra el dibuix del
 * patró de mecanitzats sobre una peça d'exemple (`PanelDrawing`, el mateix plànol que Peces, fet amb el motor de
 * fabricació, `hardwarePreview`) i a la dreta els paràmetres. «Afegir» parteix d'un tipus (el per defecte d'aquell lloc).
 */
export function HardwareList({
  items,
  defaults,
  onChange: onChangeRaw,
  onDefaults,
  onDelete,
  onConfirmed,
  settings,
}: {
  items: HardwareItem[]
  defaults: HardwareDefaults
  onChange: (items: HardwareItem[]) => void
  onDefaults: (d: HardwareDefaults) => void
  onDelete: (item: HardwareItem) => void
  /**
   * Un importat canvia de confirmat (`before` → `after`, la llista nova `items`): els mobles desats que en porten la
   * còpia d'abans hi passen (`replaceHardwareEverywhere`), si no es quedarien sense forats.
   */
  onConfirmed?: (before: HardwareItem, after: HardwareItem, items: HardwareItem[]) => void
  /** Les preferències (en edició): el gruix, els jocs, els materials i la frontissa per defecte del muntatge. */
  settings?: Settings
}) {
  // La placa aparellada és per referència: les frontisses agafen sempre els forats de la placa d'ara (`syncPairedPlates`).
  const onChange = (list: HardwareItem[]) => onChangeRaw(syncPairedPlates(list))
  const head = useContext(PaneHeadContext)
  const [sel, setSel] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const dirty = useRef(false)
  const [openState, setOpen] = useSessionList(OPEN_KEY, ["hinge"])
  const i = items.findIndex((x) => x.id === sel)
  const it = i >= 0 ? items[i]! : null
  useCloseWhenGone(sel, i, setSel, setEditorOpen)
  const open = (x: HardwareItem) => {
    if (!openState.includes(x.category)) setOpen([...openState, x.category])
    setSel(x.id)
    setEditorOpen(true)
  }
  const uniqueName = (base: string) => {
    const taken = (n: string) => items.some((x) => fold(x.name.trim()) === fold(n.trim()))
    if (!taken(base)) return base
    let n = 2
    while (taken(`${base} ${n}`)) n++
    return `${base} ${n}`
  }
  const add = (engine: HardwareEngine) => {
    // Un de nou parteix del per defecte d'aquell lloc (els mateixos mecanitzats i números), amb id i nom nous.
    const slot = slotForEngine(engine)
    // (El per defecte de «Guia de calaix» pot ser un joc: una guia nova parteix sempre d'una guia.)
    const base = items.find((x) => x.id === defaults[slot.slot] && x.engine === engine) ?? appItemOfEngine(items, engine)
    if (!base) return
    const item = copyHardwareItem(base, newId("hw"), uniqueName(`${slot.label} nova`))
    onChange([item, ...items])
    open(item)
    setJustAdded(item.id)
  }
  // Les bases dels importats: la frontissa per defecte (quantitat, extrems, cantell) i el tirador per defecte (marge,
  // cantell i el Ø del forat passant), si no són importats; si no, les d'inici de l'app.
  const importBase = () => ({
    hinge: items.find((x) => x.id === defaults.hinge && x.engine === "cup" && !x.imported) ?? DEFAULT_MODULE_HARDWARE.hinge,
    handle: items.find((x) => x.id === defaults.handle && x.engine === "barHandle" && !x.imported) ?? DEFAULT_MODULE_HARDWARE.handle,
  })
  const q = fold(query.trim())
  const [openSeries, setOpenSeries] = useSessionList(SERIES_KEY, [])
  // Per categoria i, dins, per sèrie (la carpeta del fabricant: Frontisses › Sensys, Tiradors › Classic…).
  const groups = HARDWARE_CATEGORIES.map((c) => {
    const list = items.filter((x) => x.category === c.id && (!q || hardwareMatches(x, q)))
    return { ...c, items: list, ...seriesGroups(c.id, list) }
  }).filter((g) => g.items.length)
  const defaultOf = (x: HardwareItem) => HARDWARE_SLOTS.find((s) => defaults[s.slot] === x.id && slotAccepts(s.slot, x))
  const card = (x: HardwareItem) => {
    const def = defaultOf(x)
    return (
      <GalleryCard
        key={x.id}
        thumb={<HardwareThumb item={x} base={mountBase} materials={materials} />}
        title={x.name}
        kicker={[x.maker, x.ref].filter(Boolean).join(" · ") || undefined}
        description={hardwareSummary(x)}
        tags={
          def ? (
            <Badge size="xs" variant="subtle" colorPalette="wood" title={`Per defecte a: ${def.uses}`}>
              <LuStar /> Per defecte
            </Badge>
          ) : x.imported?.update ? (
            <Badge size="xs" variant="subtle" colorPalette="orange" title="S'ha tornat a importar i els fitxers donen una altra proposta de forats: revisa-la a l'editor">
              Proposta nova
            </Badge>
          ) : x.engine === "model" && !x.machining?.length ? (
            <Badge size="xs" variant="subtle" colorPalette="gray" title={x.imported && !x.imported.bbox ? "Només les vistes DXF: el 3D (i, si en té, els forats) arribarà amb el STEP" : "Importat sense cap regla de mecanitzat: el model, mai cap forat"}>
              {x.imported && !x.imported.bbox ? "Només 2D" : "Només 3D"}
            </Badge>
          ) : isPendingImport(x) ? (
            <Badge size="xs" variant="subtle" colorPalette="orange" title="Importat: no fa cap forat fins que el confirmis">
              Sense confirmar
            </Badge>
          ) : undefined
        }
        selected={editorOpen && x.id === sel}
        onClick={() => open(x)}
      />
    )
  }
  const close = () => {
    setEditorOpen(false)
    setJustAdded(null)
  }
  // El mòdul d'exemple del muntatge: com un de nou (tauler, gruix, jocs i ferratges per defecte de les preferències).
  const mountBase = useMountBase(settings)
  const materials = settings?.materials ?? NO_MATERIALS
  // Canvi de l'item obert: si canvia de confirmat, els mobles desats hi passen.
  const changeItem = (next: HardwareItem) => {
    if (!it) return
    const list = syncPairedPlates(items.map((x, k) => (k === i ? next : x)))
    onChange(list)
    if (it.imported && next.imported && it.imported.confirmed !== next.imported.confirmed) onConfirmed?.(it, next, list)
  }
  return (
    <Stack gap={4} minW={0}>
      {head}
      <SearchBar
        value={query}
        onChange={setQuery}
        ariaLabel="Cercar ferratges"
        add={{
          label: "Afegir",
          menu: HARDWARE_SLOTS.map((s) => {
            const Icon = HARDWARE_ICONS[s.category]
            return (
              <Menu.Item key={s.slot} value={s.slot} onClick={() => add(s.engine)}>
                <Icon /> {s.label}
              </Menu.Item>
            )
          }),
        }}
      />
      {groups.length ? (
        <FoldGroup variant="gallery" value={openState} onValueChange={setOpen} forceOpen={q ? groups.map((g) => g.id) : null}>
          {groups.map((g) => (
            <FoldItem key={g.id} id={g.id} icon={HARDWARE_ICONS[g.id]} title={g.label} count={g.items.length} description={g.hint}>
              {g.loose.length > 0 && (
                <SimpleGrid columns={GALLERY_COLS} gap={3} p="var(--gallery-px, 0)">
                  {g.loose.map(card)}
                </SimpleGrid>
              )}
              {g.series.length > 0 && (
                <FoldGroup variant="nested" value={openSeries} onValueChange={setOpenSeries} forceOpen={q ? g.series.map((s) => s.key) : null}>
                  {g.series.map((s) => (
                    <FoldItem key={s.key} id={s.key} title={s.label} count={s.items.length}>
                      <SimpleGrid columns={GALLERY_COLS} gap={3} data-testid={`hardware-series-${s.key}`}>
                        {s.items.map(card)}
                      </SimpleGrid>
                    </FoldItem>
                  ))}
                </FoldGroup>
              )}
            </FoldItem>
          ))}
        </FoldGroup>
      ) : (
        <Text fontSize="sm" color="fg.muted" px={1}>
          {q ? "Cap resultat." : "Encara no n'hi ha cap."}
        </Text>
      )}
      <EditorDialog
        open={editorOpen && it !== null}
        title={it?.name}
        subtitle={it ? HARDWARE_CATEGORIES.find((c) => c.id === it.category)?.label : undefined}
        onClose={close}
        dirty={dirty}
        focusSelector={it !== null && justAdded === it.id ? "[data-hardware-name]" : null}
      >
        {it && <HardwareStage item={it} base={mountBase} materials={materials} />}
        {it && (
          <HardwareCard
            key={it.id}
            item={it}
            dirty={dirty}
            plates={items.filter((x) => x.engine === "plate")}
            library={items}
            isDefault={(() => {
              const sl = slotOfEngine(it.engine)
              return !!sl && defaults[sl.slot] === it.id
            })()}
            onDefault={() => {
              const sl = slotOfEngine(it.engine)
              if (sl) onDefaults({ ...defaults, [sl.slot]: it.id })
            }}
            onChange={changeItem}
            onRetarget={async (engine) => {
              // Canviar «què és»: el motor nou i el model 3D refet al seu marc (estimat de la malla), sense confirmar.
              const r = await reframeImported(it, engine, items, importBase())
              changeItem(r.item)
              if (r.note) toaster.create({ title: "Model 3D sense orientar", description: r.note, type: "warning", duration: 9000 })
            }}
            autoFocusName={justAdded === it.id}
            onDuplicate={() => {
              const copy = copyHardwareItem(it, newId("hw"), uniqueName(`${it.name} (còpia)`))
              const next = [...items]
              next.splice(i + 1, 0, copy)
              onChange(next)
              setSel(copy.id)
              setJustAdded(copy.id)
            }}
            onDelete={() => onDelete(it)}
          />
        )}
      </EditorDialog>
    </Stack>
  )
}
