import { Alert, Badge, Box, Button, HStack, IconButton, Input, Menu, SegmentGroup, SimpleGrid, Slider, Spinner, Stack, Switch, Text } from "@chakra-ui/react"
import { Suspense, lazy, useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { LuBoxes, LuCheck, LuCircleDot, LuCopy, LuFileDown, LuFileText, LuInfo, LuListOrdered, LuMap, LuMoveDiagonal, LuPlus, LuRotate3D, LuRuler, LuSquareDot, LuStar, LuTrash2, LuUndo2, LuUpload } from "react-icons/lu"
import { downloadBlob } from "../download"
import { EditorDialog } from "../../components/EditorDialog"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { toaster } from "../../components/ui/toaster"
import { confirmProblem, cupRel, pairPlate, relV, restoreProposal, setConfirmed, setHandleDistance, setHardwareParam, syncPairedPlates } from "../../core/import/importItem"
import { applyImportUpdate, dismissImportUpdate } from "../../core/import/merge"
import { viewBounds, type HardwareView } from "../../core/import/views"
import { assetDocs, assetViews, getHardwareAsset } from "../../db/hardwareAssets"
import { useLiveQuery } from "../../db/useLiveQuery"
import { reframeImported } from "./hardwareReframe"
import { NumberField, NumRow } from "../../components/NumRow"
import { PanelDrawing } from "../../components/PanelDrawing"
import { StepRuleRows } from "../../components/StepRuleRows"
import { HardwareThumb } from "./HardwareThumb"
import { hardwareMatches, seriesGroups, useMountBase } from "./hardwareGroups"
import { dimFont, fmtMm, layoutDims, viewCircles } from "../../components/dims"
import { DimLayer } from "../../components/DimLine"
import { SearchBar } from "../../components/SearchBar"
import { useSessionList } from "../../components/sessionState"
import { featureCrop, hardwarePreview } from "../../core/build/hardwarePreview"
import { hardwareMount, mountPlan, type HardwareMount } from "../../core/build/hardwareMount"
import { movingGroups } from "../../components/viewer/opening"
import {
  DEFAULT_MODULE_HARDWARE,
  appItemOfEngine,
  HARDWARE_CATEGORIES,
  HARDWARE_PARAMS,
  HARDWARE_ROLES,
  HARDWARE_SLOTS,
  HINGE_PLATE_PARAMS,
  copyHardwareItem,
  evalExpr,
  hardwareSummary,
  isPendingImport,
  newId,
  slotAccepts,
  slotForEngine,
  type HardwareDefaults,
  type HardwareEngine,
  type HardwareItem,
  type HardwareTarget,
  type MachiningOp,
  type MaterialPref,
  type Module,
  type Panel,
  type Settings,
  type StepRule,
} from "../../core/model"
import { GalleryCard } from "../projects/GalleryCard"
import { GALLERY_COLS, fold } from "../projects/galleryGrid"
import { HARDWARE_ICONS } from "./hardwareIcons"
import { HardwareMountPlan } from "./HardwareMountPlan"
import { KitSections } from "./KitSections"
import { useSessionString } from "./useSessionString"
import { ThicknessChips } from "./MaterialBits"
import { PaneHeadContext } from "./paneHead"

const NO_MATERIALS: MaterialPref[] = []

/** Categories obertes (es recorden durant la sessió). */
const OPEN_KEY = "mobles:md-open:hardware"
/** Sèries obertes dins de les categories («hinge/sensys»…), durant la sessió. */
const SERIES_KEY = "mobles:md-open:hardware-series"

/** El ferratge muntat en 3D (three, les peces i el GLB, quan s'obre l'editor). */
const HardwareMount3D = lazy(() => import("./HardwareMount3D"))
/** Pestanya del muntatge (3D · Pla), recordada durant la sessió. */
const MOUNT_VIEW_KEY = "mobles:hardware-mount-view"

/** El lloc del moble que fa servir un tipus de ferratge (les plaques importades no en tenen: van amb la frontissa). */
/** El lloc d'un motor; un joc de calaix (`drawerKit`) pot ser el per defecte de «Guia de calaix» (`slotAccepts`). */
const slotOfEngine = (e: HardwareEngine) => HARDWARE_SLOTS.find((s) => slotAccepts(s.slot, { engine: e }))

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
  useEffect(() => {
    // Eliminat (o restaurat): l'editor es tanca.
    if (sel !== null && i < 0) {
      setSel(null)
      setEditorOpen(false)
    }
  }, [sel, i])
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

/** La vista registrada al marc del ferratge (la que mira la cara de la peça; a les frontisses, la frontal), o `null`. */
function frontView(views: HardwareView[]): HardwareView | null {
  return views.find((v) => v.name === "front" && v.registered) ?? views.find((v) => v.registered) ?? null
}

/** La vista (marc u, v del ferratge) posada a cada punt d'ancoratge de la peça: u al llarg de x, v al llarg de y. */
function placeView(view: HardwareView | null, anchors: [number, number][]): number[][] | undefined {
  if (!view || !anchors.length) return undefined
  return anchors.flatMap(([ax, ay]) => view.lines.map((l) => l.map((c, k) => (k % 2 ? c + ay : c + ax))))
}

/** Dibuix de fons de cada peça d'exemple d'un ferratge importat (la vista frontal a cada cassoleta o placa). */
function underlays(item: HardwareItem, panels: Panel[], own: HardwareView[], plate: HardwareView[]): Record<string, number[][] | undefined> {
  const out: Record<string, number[][] | undefined> = {}
  const door = panels.find((p) => p.id === "door")
  const cups: [number, number][] = door ? door.holes.filter((h) => h.tag === "hinge").map((h) => [h.x, h.y]) : []
  if (door) out.door = placeView(frontView(own), cups)
  const side = panels.find((p) => p.id === "side")
  if (side) {
    const anchors: [number, number][] =
      item.engine === "plate" ? [[360 + (item.params.offset ?? 0), item.params.setback ?? 37]] : cups.map(([x]) => [x + (item.params.plateOffset ?? 0), item.params.plateSetback ?? 37])
    out.side = placeView(frontView(item.engine === "plate" ? own : plate), anchors)
  }
  return out
}

/**
 * L'escenari de l'editor (a l'esquerra, a la columna gran a l'ordinador): a dalt, **com va muntat** (`MountPreview`: el
 * ferratge sobre un mòdul petit fet pel motor, en 3D o en pla); a sota, el patró de mecanitzats sobre una peça d'exemple
 * (els de cantell, discontinus; els passants, buits) i, d'un importat, la vista frontal del fitxer de fons (si s'ha pogut
 * registrar sobre els forats proposats) i les vistes 2D tal com venen.
 */
function HardwareStage({ item, base, materials }: { item: HardwareItem; base?: Module; materials: MaterialPref[] }) {
  const preview = useMemo(() => hardwarePreview(item), [item])
  const ownId = item.imported?.asset
  const plateId = item.plate?.asset
  const own = useLiveQuery(() => (ownId ? getHardwareAsset(ownId) : undefined), [ownId])
  const plate = useLiveQuery(() => (plateId ? getHardwareAsset(plateId) : undefined), [plateId])
  const ownViews = useMemo(() => assetViews(own), [own])
  const plateViews = useMemo(() => assetViews(plate), [plate])
  const under = useMemo(() => (item.imported ? underlays(item, preview.panels, ownViews, plateViews) : {}), [item, preview, ownViews, plateViews])
  return (
    <Box flex={{ lg: 1 }} flexShrink={0} minW={0} minH={0} bg="bg.subtle" overflowY={{ lg: "auto" }} p={{ base: 3, sm: 4, lg: 6 }}>
      {/* A tota l'amplada de la columna (per decisió de l'usuari): el 3D, el pla i les vistes aprofiten la pantalla. */}
      <Stack gap={5} w="full">
        {preview.error && (
          <Alert.Root status="warning" size="sm">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>No es pot fer servir</Alert.Title>
              <Alert.Description>{preview.error} Els mobles faran servir el d'inici de l'app.</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
        {!preview.error && <MountPreview item={item} base={base} materials={materials} noModel={!!item.imported && own !== undefined && !own?.glb} />}
        {preview.panels.map((p) => {
          // Al costat, el detall dels forats (amb el cantell): a la peça sencera, una espiga Ø8 és un punt.
          const crop = featureCrop(p)
          return (
            <SimpleGrid key={p.id} columns={{ base: 1, md: crop ? 2 : 1 }} gap={3} bg="bg" rounded="lg" borderWidth="1px" p={{ base: 3, md: 4 }} alignItems="center" data-testid={`hardware-sample-${p.id}`}>
              <PanelDrawing panel={p} dims="full" underlay={under[p.id]} />
              {crop && (
                <Stack gap={1}>
                  <Box rounded="md" borderWidth="1px" borderColor="border.muted" overflow="hidden">
                    <PanelDrawing panel={p} crop={crop} caption={false} dims underlay={under[p.id]} />
                  </Box>
                  <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Detall ({Math.round(crop.w)} × {Math.round(crop.h)} mm)
                  </Text>
                </Stack>
              )}
            </SimpleGrid>
          )
        })}
        {preview.panels.length > 0 && (
        <Text fontSize="xs" color="fg.muted" textAlign="center">
          Patró de mecanitzats sobre una peça d'exemple, vist des de la cara A: forats de cara plens, de cantell discontinus i passants buits. Al moble, la regla de cada contingut els col·loca (les cassoletes, a la filera System 32).
          {item.imported && " En gris, la vista del fitxer del fabricant que mira la cara de la peça, encaixada sobre els forats proposats (si hi encaixa)."}
        </Text>
        )}
        {item.imported && ownViews.length > 0 && (
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            {ownViews.map((v) => (
              <ViewDrawing key={v.name} view={v} />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Box>
  )
}

/** Es pot obrir (porta, abatible, calaix) al 3D del muntatge. */
const opensIn = (m: HardwareMount) => movingGroups(m.panels).length > 0

/**
 * Com va muntat (`hardwareMount`): el ferratge sobre un mòdul petit fet pel motor de sempre (porta i lateral de les
 * frontisses i les plaques; el lateral i la caixa de les guies…), amb el gruix i els jocs de les preferències. Dues
 * vistes, com «3D · Alçat» de l'editor: **3D** (un sol `Canvas`, a demanda, `HardwareMount3D`) amb la porta tancada o
 * oberta (lliscador «Obertura»), i **Pla** (`HardwareMountPlan`: vista de dalt tallada a l'alçada de la cassoleta, amb
 * les cotes). D'un importat sense confirmar, els forats proposats en taronja i l'avís.
 */
function MountPreview({ item, base, materials, noModel }: { item: HardwareItem; base?: Module; materials: MaterialPref[]; noModel: boolean }) {
  const [tab, setTab] = useSessionString(MOUNT_VIEW_KEY)
  const view = tab === "plan" ? "plan" : "3d"
  const [open, setOpen] = useState(0)
  const mount = useMemo(() => hardwareMount(item, base), [item, base])
  const plan = useMemo(() => mountPlan(mount), [mount])
  if (mount.error || (!mount.panels.length && !mount.model)) return null
  if (mount.model) return <ModelPreview mount={mount} materials={materials} noModel={noModel} generated={item.machining?.length ?? 0} />
  const cutY = plan ? Math.round(plan.sectionY * 10) / 10 : null
  return (
    <Stack gap={3} bg="bg" rounded="lg" borderWidth="1px" p={{ base: 3, md: 4 }} data-testid="hardware-mount">
      <HStack justify="space-between" gap={3} wrap="wrap">
        <Stack gap={0} minW={0}>
          <Text fontSize="sm" fontWeight="semibold">
            Com va muntat
          </Text>
          <Text fontSize="xs" color="fg.muted">
            Mòdul d'exemple de {mount.size.width} × {mount.size.height} × {mount.size.depth} amb tauler de {mount.panels[0]!.thickness} mm
          </Text>
        </Stack>
        <SegmentGroup.Root size="sm" value={view} onValueChange={(e) => e.value && setTab(e.value)}>
          <SegmentGroup.Indicator />
          {(
            [
              ["3d", "3D", LuRotate3D, "El ferratge muntat en 3D"],
              ["plan", "Pla", LuMap, "Pla del muntatge: vista de dalt amb les cotes"],
            ] as const
          ).map(([v, label, Icon, aria]) => (
            <SegmentGroup.Item key={v} value={v} aria-label={aria}>
              <SegmentGroup.ItemText>
                <HStack gap={1.5}>
                  <Icon /> {label}
                </HStack>
              </SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          ))}
        </SegmentGroup.Root>
      </HStack>
      {mount.pending && (
        <Alert.Root status="warning" size="sm" data-testid="hardware-mount-pending">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              Sense confirmar: <strong>en taronja, els forats proposats</strong>. Fins que el confirmis, el moble no els fa{mount.hinge ? " (ni a la porta ni al lateral)" : ""}.
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
      {view === "3d" ? (
        <Stack gap={2}>
          <Box h={{ base: "300px", md: "420px", lg: "min(560px, 55dvh)" }} rounded="md" overflow="hidden" bg="bg.subtle" data-testid="hardware-mount-3d">
            <Suspense fallback={<Spinner size="sm" color="wood.solid" m={3} />}>
              <HardwareMount3D mount={mount} materials={materials} open={open} />
            </Suspense>
          </Box>
          {opensIn(mount) && (
            <FormRow label="Obertura" help="Obre la porta (o l'abatible, o el calaix) per veure'n la cara de dins.">
              <Slider.Root size="sm" w="full" maxW="280px" pt="10px" aria-label={["Obertura"]} min={0} max={1} step={0.05} value={[open]} onValueChange={(e) => setOpen(e.value[0] ?? 0)}>
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumbs />
                </Slider.Control>
              </Slider.Root>
            </FormRow>
          )}
          <Text fontSize="xs" color="fg.muted">
            Arrossega per girar-lo; amb dos dits o la roda, més a prop. Les peces, els forats{mount.hinge ? ", la frontissa i la placa" : ""} surten del mateix càlcul que el moble.
            {noModel && " Sense el model 3D del fitxer: es veu la caixa que ocupa."}
          </Text>
        </Stack>
      ) : plan ? (
        <Stack gap={2}>
          <Box w="full" maxW="1100px" mx="auto">
            <HardwareMountPlan plan={plan} />
          </Box>
          <Text fontSize="xs" color="fg.muted">
            Vista de dalt tallada a {String(cutY).replace(".", ",")} mm d'alçada{mount.hinge ? " (al centre de la cassoleta de baix)" : ""}; el davant del moble, a baix. Forats tallats buits; els de sobre o sota, discontinus{mount.pending ? "; els proposats, en taronja" : ""}. {mount.hinge ? "Cotes: joc i recobriment de la porta, del cantell de la porta al centre de la cassoleta i a la seva vora (C), fondària, i la filera del lateral des del davant. " : ""}Mides en mm.
          </Text>
        </Stack>
      ) : null}
      {mount.warnings.map((w, i) => (
        <Text key={i} fontSize="xs" color="orange.fg">
          {w}
        </Text>
      ))}
    </Stack>
  )
}

/** Un ferratge «només 3D»: el model sol (sense mòdul ni forats), en 3D, amb les mides de la caixa. */
function ModelPreview({ mount, materials, noModel, generated }: { mount: HardwareMount; materials: MaterialPref[]; noModel: boolean; generated: number }) {
  const n = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")
  if (!mount.model?.bbox && !mount.model?.asset)
    return null
  if (!mount.model?.bbox)
    return (
      <Stack gap={1} bg="bg" rounded="lg" borderWidth="1px" p={{ base: 3, md: 4 }} data-testid="hardware-mount">
        <Text fontSize="sm" fontWeight="semibold">
          Només 2D
        </Text>
        <Text fontSize="sm" color="fg.muted">
          Només s'han importat les vistes del DXF (a sota) i els punts de connexió: falta el STEP, d'on surten el 3D i, a les frontisses, plaques, tiradors i
          potes, els forats proposats. (La importació del fabricant ja no es fa des de l'app: els ferratges nous es fan a partir del catàleg.)
        </Text>
      </Stack>
    )
  return (
    <Stack gap={3} bg="bg" rounded="lg" borderWidth="1px" p={{ base: 3, md: 4 }} data-testid="hardware-mount">
      <Stack gap={0}>
        <Text fontSize="sm" fontWeight="semibold">
          {generated ? "Model 3D" : "Només 3D"}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {mount.model?.bbox ? `Caixa de ${n(mount.size.width)} × ${n(mount.size.height)} × ${n(mount.size.depth)} mm · ` : ""}{generated ? `cap regla del moble: els seus ${generated} mecanitzats es fan als mobles on ja està col·locat a mà.` : "sense cap forat: no hi ha cap regla del moble per a aquest ferratge."}
        </Text>
      </Stack>
      <Box h={{ base: "300px", md: "420px", lg: "min(560px, 55dvh)" }} rounded="md" overflow="hidden" bg="bg.subtle" data-testid="hardware-mount-3d">
        <Suspense fallback={<Spinner size="sm" color="wood.solid" m={3} />}>
          <HardwareMount3D mount={mount} materials={materials} open={0} />
        </Suspense>
      </Box>
      <Text fontSize="xs" color="fg.muted">
        Arrossega per girar-lo; amb dos dits o la roda, més a prop.{noModel && " Sense el model 3D del fitxer: es veu la caixa que ocupa."}
      </Text>
    </Stack>
  )
}

const VIEW_LABEL: Record<HardwareView["name"], string> = { front: "Vista frontal", side: "Vista lateral", top: "Vista de dalt" }

/**
 * Una vista 2D del fitxer (línies i punts de connexió), tal com ve o encaixada al marc del ferratge, **acotada** (per
 * decisió de l'usuari, «a les vistes les mides de tot»): la mida total, els cercles (forats) amb el Ø i les cotes
 * encadenades des dels cantells, entre forats i, si la vista és al marc dels forats, des del punt de referència.
 */
function ViewDrawing({ view }: { view: HardwareView }) {
  const layout = useMemo(() => {
    const b = viewBounds(view.lines)
    if (!b) return null
    const box = { x0: b.x0, y0: -b.y1, x1: b.x1, y1: -b.y0 }
    const fs = dimFont(box)
    const feats = viewCircles(view.lines).map((c) => ({ x: c.x, y: -c.y, hx: c.r, hy: c.r, label: `Ø${fmtMm(Math.round(c.r * 20) / 10)}` }))
    return { fs, l: layoutDims(box, feats, fs, { ...(view.registered ? { ref: [0, 0] as [number, number] } : {}), title: VIEW_LABEL[view.name] }) }
  }, [view])
  if (!layout) return null
  const vb = layout.l.extent
  const stroke = Math.max(vb.w, vb.h) / 500
  const mark = layout.fs * 0.5
  return (
    <Stack gap={1} bg="bg" rounded="lg" borderWidth="1px" p={2} data-testid={`hardware-view-${view.name}`}>
      <Text fontSize="sm" fontWeight="medium" px={1}>
        {VIEW_LABEL[view.name]}
        {view.registered && (
          <Text as="span" color="fg.muted" fontWeight="normal">
            {" "}
            · al marc dels forats
          </Text>
        )}
      </Text>
      <Box asChild color="fg" w="full" style={{ aspectRatio: `${vb.w} / ${vb.h}` }} maxH="340px">
        <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
          <g transform="scale(1 -1)" fill="none" stroke="currentColor" strokeWidth={stroke}>
            {view.lines.map((l, i) => (
              <polyline key={i} points={l.map((v, k) => (k % 2 ? `${v} ` : `${v},`)).join("")} />
            ))}
            {!view.registered &&
              view.points.map(([x, y], i) => (
                <g key={`p${i}`} stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 1.5}>
                  <line x1={x - mark} y1={y} x2={x + mark} y2={y} />
                  <line x1={x} y1={y - mark} x2={x} y2={y + mark} />
                </g>
              ))}
            {view.registered && (
              <g stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 1.5}>
                <line x1={-mark} y1={0} x2={mark} y2={0} />
                <line x1={0} y1={-mark} x2={0} y2={mark} />
              </g>
            )}
          </g>
          <DimLayer layout={layout.l} stroke={stroke} fs={layout.fs} />
        </svg>
      </Box>
    </Stack>
  )
}

/** Els tipus que no tenen lloc al joc del mòdul: què són i on es fan servir. */
const ENGINE_HELP: Partial<Record<HardwareEngine, { label: string; help: string }>> = {
  plate: { label: "Placa de muntatge", help: "Placa de muntatge: no va sola; la frontissa importada que s'hi aparella en copia els forats (al lateral, a l'alçada de cada cassoleta)." },
  leg: { label: "Pota", help: "Es tria a la base «Potes» del mòdul (Caixa › Base › Pota): els forats de la placa van a la cara de sota de la base, a cada pota (a «Als cantells» de les vores de fora)." },
  model: { label: "Només 3D", help: "Sense cap regla de mecanitzat: el model i el volum, mai cap forat. No es pot triar a cap lloc del moble; en pots baixar el model (GLB) per posar-lo en un objecte (Models 3D › Triar fitxers)." },
  drawerKit: { label: "Joc de calaix de doble paret", help: "Es tria al calaix en lloc de la guia (Front › Guia): el joc decideix la llargada nominal per la fondària, els números d'article, el fons i el darrere de fusta (sense laterals de fusta) i les prebroques dels cargols. Les dades del joc són les del catàleg (només lectura; duplica'l per canviar-les)." },
}

const PLACED_HELP =
  "Sense regla del moble: els seus mecanitzats (d'abans, escrits a mà, d'un DXF del taller o d'un programa Xilog del fabricant) es fan on ja està col·locat (Editor › mòdul o peça lliure › «Ferratges»), un cop confirmat. El model 3D és per veure'l."

const ONLY_2D_HELP = "Només s'han importat les vistes DXF (i els punts de connexió): cap forat. Quan importis el STEP del mateix article, s'hi afegirà el 3D i, si és una frontissa, placa, tirador o pota, els forats proposats (per revisar i confirmar)."

/** Resum d'una regla per graons per a la insígnia («2–5», «64–128 mm»). */
function stepBadge(rule: StepRule, unit: string): string {
  const all = [...rule.steps.map((x) => x.n), rule.else]
  const lo = Math.min(...all), hi = Math.max(...all)
  return `${lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`}${unit}`
}

/** «Plànols i documents»: el GLB per baixar i els plànols del fabricant (només si l'asset en porta). */
function DocsSection({ asset, name }: { asset: string; name: string }) {
  const a = useLiveQuery(() => getHardwareAsset(asset), [asset])
  const docs = assetDocs(a)
  if (!a?.glb && !docs.length) return null
  const badge = [a?.glb ? "GLB" : "", docs.length ? `${docs.length} ${docs.length === 1 ? "plànol" : "plànols"}` : ""].filter(Boolean).join(" · ")
  return (
    <FoldItem id="hw-docs" icon={LuFileText} title="Plànols i documents" badge={badge}>
      <GlbRow asset={asset} name={name} />
      <DocsRow asset={asset} />
    </FoldItem>
  )
}

/** «Model 3D»: baixar el GLB que es va fer en importar (per posar-lo en un objecte com a model 3D). */
function GlbRow({ asset, name }: { asset: string; name: string }) {
  const a = useLiveQuery(() => getHardwareAsset(asset), [asset])
  if (!a?.glb) return null
  const glb = a.glb
  return (
    <FormRow label="Model 3D" help="El model del fitxer en GLB (metres, al marc del ferratge). Per veure'l en un objecte: Models 3D › Triar fitxers.">
      <Box pt="2px">
        <Button size="xs" variant="outline" onClick={() => downloadBlob(glb, `${name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "ferratge"}.glb`)} data-testid="hardware-glb">
          <LuBoxes /> Baixar el model 3D (.glb)
        </Button>
      </Box>
    </FormRow>
  )
}

/** «Plànols de muntatge»: els DXF i PDF del fabricant adjuntats en importar (`dxf_einbau`, exemples d'aplicació), per baixar-los. */
function DocsRow({ asset }: { asset: string }) {
  const a = useLiveQuery(() => getHardwareAsset(asset), [asset])
  const docs = assetDocs(a)
  if (!docs.length) return null
  return (
    <FormRow label="Plànols" help="Plànols de muntatge i exemples d'aplicació del fabricant que nomenen aquest article (tal com venen, per consultar-los).">
      <Stack gap={1} pt="2px" data-testid="hardware-docs">
        {docs.map((d) => (
          <Box key={d.name}>
            <Button size="xs" variant="ghost" onClick={() => downloadBlob(d.blob, d.name)} title={d.name} maxW="full" justifyContent="flex-start">
              <LuFileDown /> <Text as="span" truncate>{d.name}</Text>
            </Button>
          </Box>
        ))}
      </Stack>
    </FormRow>
  )
}

/** Un mecanitzat en text amb els números de l'item (per comparar la proposta d'ara amb la nova). */
function opLine(op: MachiningOp, vars: Record<string, number>): string {
  const v = (e: number | string) => {
    try {
      return fmt(Math.round(evalExpr(e, vars) * 100) / 100)
    } catch {
      return fmt(e)
    }
  }
  if (op.kind === "edgeDrill") return `Ø${v(op.d)} × ${v(op.depth)} al cantell`
  if (op.kind === "through") return `Ø${v(op.d)} passant a ${v(op.u)} / ${v(op.v)}`
  return `Ø${v(op.d)} × ${v(op.depth)} a ${v(op.u)} / ${v(op.v)}`
}

/**
 * «Hi ha una proposta nova: revisar»: s'ha tornat a importar l'article i els fitxers donen uns altres forats, però l'item
 * està confirmat (o se n'han editat els forats) i no s'ha tocat. Compara la d'ara amb la nova; aplicar-la el deixa sense
 * confirmar (cal revisar-lo i tornar-lo a confirmar); descartar-la no canvia res.
 */
function UpdateNotice({ item, onChange }: { item: HardwareItem; onChange: (next: HardwareItem) => void }) {
  const u = item.imported!.update!
  const varsNow = { ...item.params, cupOffset: 0, pitch: item.pitch?.else ?? 0 }
  const { pitch, ...rest } = u.params
  const varsNew = { ...item.params, ...rest, cupOffset: 0, pitch: pitch ?? item.pitch?.else ?? 0 }
  const now = item.targets.filter((t) => u.targets.some((x) => x.key === t.key))
  const col = (title: string, targets: HardwareTarget[], vars: Record<string, number>, gen?: number) => (
    <Stack gap={0.5} minW={0}>
      <Text fontSize="xs" fontWeight="semibold">
        {title}
      </Text>
      {item.engine === "barHandle" && (
        <Text fontSize="xs" fontFamily="mono">
          {vars.pitch ? `${fmt(vars.pitch)} mm entre centres` : "pom (1 forat)"}
        </Text>
      )}
      {targets.flatMap((t) => t.ops.map((op, k) => (
        <Text key={`${t.key}${k}`} fontSize="xs" fontFamily="mono" wordBreak="break-word">
          {opLine(op, vars)}
        </Text>
      )))}
      {u.machining && (
        <Text fontSize="xs" fontFamily="mono">
          {gen ?? 0} {gen === 1 ? "mecanitzat col·locat a mà" : "mecanitzats col·locats a mà"}
        </Text>
      )}
    </Stack>
  )
  return (
    <Box py={2}>
      <Alert.Root status="warning" size="sm" data-testid="hardware-update">
        <Alert.Indicator />
        <Alert.Content gap={2}>
          <Alert.Title>Hi ha una proposta nova: revisar</Alert.Title>
          <Alert.Description>
            <Stack gap={2}>
              <Text fontSize="sm">
                S'ha tornat a importar i els fitxers donen uns altres forats. {item.imported!.confirmed ? "Com que està confirmat" : "Com que n'has editat els forats"}, no s'ha tocat res: el moble continua fent els d'ara. Si aplices la nova, queda sense confirmar (cap forat als mobles) fins que la revisis i la confirmis.
              </Text>
              <SimpleGrid columns={2} gap={3}>
                {col("Ara", now, varsNow, item.machining?.length ?? 0)}
                {col("Nova", u.targets, varsNew, u.machining?.length)}
              </SimpleGrid>
              {u.notes.length > 0 && (
                <Text fontSize="xs" color="fg.muted">
                  {u.notes.join(" ")}
                </Text>
              )}
              <HStack gap={2} wrap="wrap">
                <Button size="xs" colorPalette="wood" onClick={() => onChange(applyImportUpdate(item))} data-testid="hardware-update-apply">
                  Aplicar la nova (sense confirmar)
                </Button>
                <Button size="xs" variant="outline" onClick={() => onChange(dismissImportUpdate(item))}>
                  Descartar-la
                </Button>
              </HStack>
            </Stack>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    </Box>
  )
}

const fmt = (e: number | string) => (typeof e === "number" ? String(e).replace(".", ",") : e)
/** Un mecanitzat en una línia: «Ø cupDiameter × cupDepth, cara A (u 0 · v cupOffset)». */
function opText(op: MachiningOp): string {
  if (op.kind === "edgeDrill") return `Forat de cantell Ø ${fmt(op.d)} × ${fmt(op.depth)} (al llarg ${fmt(op.along)})`
  if (op.kind === "through") return `Forat passant Ø ${fmt(op.d)} (u ${fmt(op.u)} · v ${fmt(op.v)})`
  return `Forat Ø ${fmt(op.d)} × ${fmt(op.depth)}, cara ${op.face} (u ${fmt(op.u)} · v ${fmt(op.v)})`
}

function HardwareCard({
  item,
  dirty,
  plates,
  library,
  isDefault,
  onDefault,
  onChange,
  onRetarget,
  onDuplicate,
  onDelete,
  autoFocusName,
}: {
  item: HardwareItem
  dirty: RefObject<boolean>
  /** Les plaques de la biblioteca (per aparellar-ne una a una frontissa importada). */
  plates: HardwareItem[]
  /** Tota la biblioteca (una frontissa no es confirma amb la placa sense confirmar). */
  library: HardwareItem[]
  isDefault: boolean
  onDefault: () => void
  onChange: (next: HardwareItem) => void
  /** Canviar «què és» un importat (el lloc, `engine`): refà el model al seu marc i deixa l'item sense confirmar. */
  onRetarget?: (engine: HardwareEngine) => Promise<void>
  onDuplicate: () => void
  onDelete: () => void
  autoFocusName?: boolean
}) {
  const [retargeting, setRetargeting] = useState(false)
  // El nom es canvia en acabar (sortir del camp o Retorn), com als materials; buit, es queda l'antic. Esc el desfà.
  const [nameText, setNameText] = useState(item.name)
  useEffect(() => setNameText(item.name), [item.name])
  const cancelName = useRef(false)
  useEffect(() => {
    dirty.current = nameText !== item.name
  })
  const commitName = () => {
    if (cancelName.current) {
      cancelName.current = false
      setNameText(item.name)
      return
    }
    const next = nameText.trim().replace(/\s+/g, " ")
    if (!next || next === item.name) {
      setNameText(item.name)
      return
    }
    onChange({ ...item, name: next })
  }
  const slot = slotOfEngine(item.engine)
  // Importat només amb les vistes DXF (sense STEP): ni 3D ni caixa encara.
  const only2d = item.engine === "model" && !!item.imported && !item.imported.bbox && !item.imported.damaged
  const set = (patch: Partial<HardwareItem>) => onChange({ ...item, ...patch })
  // Canviar els forats d'un importat el torna a deixar sense confirmar (cal tornar-lo a revisar).
  const setTargets = (targets: HardwareTarget[]) => onChange(item.imported ? { ...item, targets, imported: { ...item.imported, confirmed: false } } : { ...item, targets })
  const problem = confirmProblem(item, library)
  // Canviar el Ø o la fondària de la cassoleta o on va la placa d'un importat el torna a deixar sense confirmar.
  const setParam = (key: string, v: number) => Number.isFinite(v) && onChange(setHardwareParam(item, key, v))
  const setText = (key: "maker" | "ref", v: string) => {
    const { [key]: _old, ...rest } = item
    onChange(v.trim() ? { ...rest, [key]: v } : rest)
  }
  // Resums de les insígnies de les seccions (tancades es llegeix què hi ha a dins).
  const typeLabel = slot?.label ?? (item.engine === "model" && item.machining?.length ? "Es col·loca a mà" : only2d ? "Només 2D" : (ENGINE_HELP[item.engine]?.label ?? item.engine))
  const importState: { label: string; palette: string } =
    item.engine === "model" && !item.machining?.length ? { label: only2d ? "Només 2D" : "Només 3D", palette: "gray" }
    : item.imported?.confirmed ? { label: "Confirmat", palette: "green" }
    : { label: "Sense confirmar", palette: "orange" }
  const dimsBadge = HARDWARE_PARAMS[item.engine].slice(0, 2).map((p) => `${p.label.replace(/ \(.*\)$/, "")} ${fmt(item.params[p.key] ?? 0)}`).join(" · ") || (item.lengths ? `${item.lengths.length} llargades` : undefined)
  const nOps = item.targets.reduce((a, t) => a + t.ops.length, 0)
  const opsBadge = nOps ? `${nOps} ${nOps === 1 ? "forat" : "forats"}` : undefined
  return (
    <Box w={{ base: "full", lg: "min(560px, 48%)" }} flexShrink={0} overflowY={{ lg: "auto" }} borderStartWidth={{ lg: "1px" }} css={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}>
      <Box maxW={{ base: "760px", lg: "none" }} mx="auto" pb={{ base: 8, lg: 6 }}>
        <HStack gap={2} px={{ base: 4, sm: 6 }} pt={4} pb={4} align="flex-start">
          <Stack gap={0.5} flex={1} minW={0}>
            <Input
              variant="flushed"
              size="md"
              fontSize="lg"
              fontWeight="semibold"
              value={nameText}
              onChange={(e) => setNameText(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
                else if (e.key === "Escape") {
                  cancelName.current = true
                  setNameText(item.name)
                  e.currentTarget.blur()
                }
              }}
              autoFocus={autoFocusName}
              onFocus={(e) => autoFocusName && e.currentTarget.select()}
              aria-label="Nom del ferratge"
              data-hardware-name=""
              borderColor="transparent"
              _hover={{ borderColor: "border" }}
              _focus={{ borderColor: "wood.solid" }}
            />
            <Text fontSize="xs" color="fg.muted" truncate>
              {hardwareSummary(item)}
            </Text>
          </Stack>
          <HStack gap={0} flexShrink={0} pt={1.5}>
            <IconButton aria-label="Duplicar ferratge" title="Duplicar" size="sm" variant="ghost" onClick={onDuplicate}>
              <LuCopy />
            </IconButton>
            <IconButton aria-label="Eliminar ferratge" title="Eliminar" size="sm" variant="ghost" colorPalette="red" onClick={onDelete}>
              <LuTrash2 />
            </IconButton>
          </HStack>
        </HStack>

        {/* Seccions plegables (l'acordió de l'app, com l'editor de materials): independents i recordades durant la sessió. */}
        <Box className="form-section" borderTopWidth="1px" data-testid="hardware-sections">
        <FoldItem id="hw-general" icon={LuInfo} title="General" badge={typeLabel} defaultOpen>
          {item.imported && onRetarget && !item.imported.damaged ? (
            <FormRow
              label="Què és"
              help={`${HARDWARE_ROLES.find((r) => r.engine === item.engine)?.help ?? ""} Canviar-ho posa el ferratge al lloc triat amb els números per defecte d'aquell tipus (per omplir i confirmar) i orienta el model 3D segons el que s'hi troba (la cassoleta, la cara de muntatge i els forats): comprova-ho a «Com va muntat».`}
            >
              <Stack gap={1} pt="2px">
                <ChoiceChips
                  label="Què és"
                  value={item.engine}
                  options={HARDWARE_ROLES.map((r) => ({ id: r.engine, label: r.label }))}
                  onChange={(engine) => {
                    if (engine === item.engine || retargeting) return
                    setRetargeting(true)
                    void onRetarget(engine).finally(() => setRetargeting(false))
                  }}
                />
                {retargeting && (
                  <HStack gap={2} fontSize="xs" color="fg.muted">
                    <Spinner size="xs" /> Orientant el model 3D…
                  </HStack>
                )}
              </Stack>
            </FormRow>
          ) : (
          <FormRow
            label="Tipus"
            help={
              slot ? `Fa de «${slot.label}»: ${slot.uses}. La regla de cada contingut decideix on va i quants se'n posen.`
              : item.engine === "model" && item.machining?.length ? PLACED_HELP
              : only2d ? ONLY_2D_HELP
              : ENGINE_HELP[item.engine]?.help
            }
          >
            <Text fontSize="sm" pt="6px">
              {typeLabel}
            </Text>
          </FormRow>
          )}
          <FormRow label="Fabricant">
            <Input size="sm" maxW="280px" value={item.maker ?? ""} onChange={(e) => setText("maker", e.target.value)} placeholder="Opcional" />
          </FormRow>
          <FormRow label="Referència">
            <Input size="sm" maxW="280px" value={item.ref ?? ""} onChange={(e) => setText("ref", e.target.value)} placeholder="Opcional" />
          </FormRow>
          {slot && (
            <FormRow label="Per defecte" help={isDefault ? `És el que fan servir els mòduls nous (${slot.uses}). Per canviar-lo, fes per defecte un altre del mateix tipus.` : `Els mòduls nous faran servir aquest (${slot.uses}). Els mobles fets no canvien.`}>
              <Switch.Root size="sm" pt="6px" checked={isDefault} disabled={isDefault} onCheckedChange={(e) => e.checked && onDefault()}>
                <Switch.HiddenInput />
                <Switch.Control />
                <Switch.Label fontSize="sm">Per defecte als mòduls nous</Switch.Label>
              </Switch.Root>
            </FormRow>
          )}
        </FoldItem>

        {item.kit && <KitSections item={item} kit={item.kit} />}
        {item.imported?.update && <UpdateNotice item={item} onChange={onChange} />}
        {item.imported && (
          <FoldItem id="hw-imported" icon={LuUpload} title="Importat del fabricant" badge={importState.label} badgePalette={importState.palette} defaultOpen>
            {item.engine === "model" && !item.machining?.length ? (
              <FormRow label="Estat" help={only2d ? ONLY_2D_HELP : "No hi ha cap regla de mecanitzat per a aquest ferratge (o no s'hi ha trobat el patró de forats): el model i el volum, mai cap forat. No cal confirmar-lo."}>
                <HStack gap={2} pt="2px">
                  <Badge size="sm" variant="subtle" colorPalette="gray" data-testid="hardware-import-state">
                    {only2d ? "Només 2D" : "Només 3D"}
                  </Badge>
                </HStack>
              </FormRow>
            ) : (
            <FormRow
              label="Estat"
              help={
                item.imported.confirmed
                  ? "Confirmat: fa els forats als mobles (i als fitxers del taller). Si en canvies els forats, cal tornar-lo a confirmar."
                  : (problem ?? "Revisa els forats proposats (dibuix i 3D) i confirma'l. Fins aleshores es pot triar, però no fa cap forat i el moble avisa.")
              }
            >
              <HStack gap={2} pt="2px" wrap="wrap">
                <Badge size="sm" variant="subtle" colorPalette={item.imported.confirmed ? "green" : "orange"} data-testid="hardware-import-state">
                  {item.imported.confirmed ? "Confirmat" : "Sense confirmar"}
                </Badge>
                {item.imported.confirmed ? (
                  <Button size="xs" variant="outline" onClick={() => onChange(setConfirmed(item, false))}>
                    Treure la confirmació
                  </Button>
                ) : (
                  <Button size="xs" colorPalette="wood" disabled={!!problem} onClick={() => onChange(setConfirmed(item, true))} data-testid="hardware-confirm">
                    <LuCheck /> Confirmar
                  </Button>
                )}
              </HStack>
            </FormRow>
            )}
            <FormRow label="Article">
              <Text fontSize="sm" pt="6px">
                {item.imported.maker} {item.imported.article}
              </Text>
            </FormRow>
            {item.imported.folders.length > 0 && (
              <FormRow label="Carpeta">
                <Text fontSize="sm" pt="6px" wordBreak="break-word">
                  {item.imported.folders.join(" › ")}
                </Text>
              </FormRow>
            )}
            <FormRow label="Fitxers">
              <Text fontSize="sm" pt="6px" wordBreak="break-word" fontFamily="mono">
                {item.imported.files.join(" · ")}
              </Text>
            </FormRow>
            {item.imported.notes?.length ? (
              <FormRow label="Proposta">
                <Stack gap={1} pt="6px">
                  {item.imported.notes.map((n, k) => (
                    <Text key={k} fontSize="sm">
                      {n}
                    </Text>
                  ))}
                </Stack>
              </FormRow>
            ) : null}
            {item.engine !== "model" && (
              <FormRow label="" help="Els forats tornen a ser els que es van llegir del fitxer (sense confirmar).">
                <Button size="xs" variant="ghost" onClick={() => onChange(restoreProposal(item))}>
                  <LuUndo2 /> Tornar a la proposta
                </Button>
              </FormRow>
            )}
          </FoldItem>
        )}
        {item.imported?.asset && <DocsSection asset={item.imported.asset} name={item.name} />}

        {item.imported && item.engine === "cup" && (
          <FoldItem id="hw-plate" icon={LuSquareDot} title="Placa de muntatge" badge={item.plate ? (plates.find((x) => x.id === item.plate!.id)?.name ?? "Del moble") : "Cap"}>
            <FormRow label="Placa" help="La placa del lateral: els seus forats van a la cara de dins del lateral de les frontisses, a la filera de davant i a l'alçada de cada cassoleta. Sense, cap forat al lateral (la filera System 32 la sosté).">
              <ChoiceChips
                label="Placa"
                value={item.plate?.id ?? "none"}
                options={[{ id: "none", label: "Cap" }, ...plates.map((x) => ({ id: x.id, label: `${x.name}${isPendingImport(x) ? " (sense confirmar)" : ""}` }))]}
                onChange={(id) => onChange(pairPlate(item, id === "none" ? null : (plates.find((x) => x.id === id) ?? null)))}
              />
            </FormRow>
            {item.plate &&
              HINGE_PLATE_PARAMS.map((p) => (
                <NumRow key={p.key} label={p.label} help={p.help} value={item.params[p.key] ?? 0} min={p.min} max={p.max} step={p.step} onChange={(v) => setParam(p.key, v)} />
              ))}
          </FoldItem>
        )}

        {(HARDWARE_PARAMS[item.engine].length > 0 || item.lengths) && (
        <FoldItem id="hw-dims" icon={LuMoveDiagonal} title="Mides" badge={dimsBadge}>
          {HARDWARE_PARAMS[item.engine].map((p) => (
            <NumRow key={p.key} label={p.label} help={p.help} value={item.params[p.key] ?? 0} min={p.min} max={p.max} step={p.step} onChange={(v) => setParam(p.key, v)} />
          ))}
          {item.lengths && (
            <FormRow label="Llargades" help="Les guies que es poden comprar: el calaix agafa la més llarga que hi cap.">
              <ThicknessChips value={item.lengths} onChange={(lengths) => set({ lengths })} label={false} what="llargada" range={[100, 1500]} />
            </FormRow>
          )}
        </FoldItem>
        )}

        {item.count && (
          <FoldItem id="hw-count" icon={LuListOrdered} title="Quantitat per alçada" badge={stepBadge(item.count, "")}>
            <StepRuleRows rule={item.count} kind="count" onChange={(count) => set({ count })} />
          </FoldItem>
        )}
        {item.pitch && item.imported && item.engine === "barHandle" ? (
          <FoldItem id="hw-pitch" icon={LuRuler} title="Distància entre forats" badge={`${fmt(item.pitch.else)} mm`}>
            {(item.targets.find((t) => t.key === "front")?.ops.length ?? 0) >= 2 ? (
              <NumRow
                label="Entre centres"
                help="La del fitxer del fabricant (a la de catàleg més propera si hi era a menys de 0,5 mm). És la mateixa a totes les portes, calaixos i abatibles que triïn aquest tirador. Canviar-la el deixa sense confirmar."
                value={item.pitch.else}
                min={16}
                max={2000}
                step={1}
                onChange={(v) => Number.isFinite(v) && onChange(setHandleDistance(item, v))}
              />
            ) : (
              <Text fontSize="sm" color="fg.muted" pb={2}>
                Pom: un sol forat, al mateix lloc que el centre del tirador de l'app.
              </Text>
            )}
          </FoldItem>
        ) : item.pitch ? (
          <FoldItem id="hw-pitch" icon={LuRuler} title="Distància entre forats" badge={stepBadge(item.pitch, " mm")}>
            <StepRuleRows rule={item.pitch} kind="pitch" onChange={(pitch) => set({ pitch })} />
          </FoldItem>
        ) : null}

        {item.engine === "model" ? null : item.imported && item.engine !== "barHandle" ? (
          <FoldItem id="hw-ops" icon={LuCircleDot} title="Mecanitzats" badge={opsBadge}>
            {item.targets.map((t) => (
              <OpsEditor key={t.key} item={item} target={t} onChange={(next) => setTargets(item.targets.map((x) => (x.key === t.key ? next : x)))} />
            ))}
          </FoldItem>
        ) : (
        <FoldItem id="hw-ops" icon={LuCircleDot} title="Mecanitzats" badge={opsBadge}>
          {item.targets.map((t) => (
            <FormRow key={t.key} label={t.label}>
              <Stack gap={0.5} pt="6px">
                {t.ops.map((op, k) => (
                  <Text key={k} fontSize="sm" fontFamily="mono">
                    {opText(op)}
                    {op.tag ? <Text as="span" color="fg.muted"> · {op.tag}</Text> : null}
                  </Text>
                ))}
              </Stack>
            </FormRow>
          ))}
          <Text fontSize="xs" color="fg.muted" pb={2}>
            {item.imported
              ? "Forats passants al front, al voltant del centre del tirador (pitch = la distància entre forats, diameter = el Ø de Mides)."
              : item.kit ? "La prebroca de cada cargol (Ø i fondària de la regla del taller, Preferències › Regles de mecanitzat › «Prebroca dels cargols»); on van, ho diu el joc («Mecanitzats del joc»)."
              : "En coordenades de la peça (u al llarg del cantell de referència, v cap a dins), amb els noms de les mides de dalt. Editar-los i afegir-ne és per a més endavant (ferratges manuals)."}
          </Text>
        </FoldItem>
        )}
        </Box>
      </Box>
    </Box>
  )
}

const TAG_LABEL: Record<string, string> = { hinge: "Cassoleta", "hinge-screw": "Cargol", "hinge-dowel": "Espiga", plate: "Placa", leg: "Cargol", handle: "Forat" }
const num = (e: number | string, vars: Record<string, number>) => {
  try {
    return evalExpr(e, vars)
  } catch {
    return NaN
  }
}

/**
 * Forats d'un ferratge importat, editables: al llarg (u) i cap a dins (v; a la porta, des del centre de la cassoleta),
 * Ø i fondària. La cassoleta (el primer de la porta) pren el Ø i la fondària de «Mides»; els del lateral d'una frontissa
 * són de la placa (es canvien a la placa i tornant-la a triar).
 */
function OpsEditor({ item, target, onChange }: { item: HardwareItem; target: HardwareTarget; onChange: (t: HardwareTarget) => void }) {
  const fromPlate = item.engine === "cup" && target.key === "side"
  const door = item.engine === "cup" && target.key === "door"
  const leg = item.engine === "leg"
  const vars = item.params
  const setOp = (k: number, patch: { u?: number; v?: number; d?: number; depth?: number }) =>
    onChange({
      ...target,
      ops: target.ops.map((op, i) => {
        if (i !== k || op.kind === "edgeDrill") return op
        const next = { ...op }
        if (patch.u !== undefined && Number.isFinite(patch.u)) next.u = patch.u
        if (patch.v !== undefined && Number.isFinite(patch.v)) next.v = door ? cupRel(patch.v) : patch.v
        if (patch.d !== undefined && patch.d > 0) next.d = patch.d
        if (patch.depth !== undefined && patch.depth > 0 && next.kind === "drill") next.depth = patch.depth
        return next
      }),
    })
  const add = () => onChange({ ...target, ops: [...target.ops, { kind: "drill", face: "A", u: 0, v: door ? cupRel(10) : 0, d: leg ? 3 : 5, depth: leg ? 12 : 10, tag: door ? "hinge-screw" : leg ? "leg" : "plate" }] })
  return (
    <FormRow
      label={target.label}
      help={
        fromPlate ? "De la placa aparellada: per canviar-los, edita la placa i torna-la a triar."
        : door ? "Al llarg del cantell i cap a dins des del centre de la cassoleta (mm)."
        : leg ? "Al voltant de l'eix de la pota, a la cara de sota de la base: al llarg (d'esquerra a dreta del moble) i cap al davant (mm)."
        : "Al llarg (amunt) i cap al darrere des de la referència de la placa (mm)."
      }
    >
      <Stack gap={2} pt="2px" data-testid={`hardware-ops-${target.key}`}>
        {target.ops.map((op, k) => {
          if (op.kind === "edgeDrill") return null
          const cup = door && k === 0
          const ro = fromPlate || cup
          const v = door ? relV(op) : num(op.v, vars)
          const depth = op.kind === "drill" ? num(op.depth, vars) : NaN
          const name = `${TAG_LABEL[op.tag ?? ""] ?? op.tag ?? "Forat"}${cup ? "" : ` ${k + (door ? 0 : 1)}`}`
          if (ro)
            return (
              <Text key={k} fontSize="sm">
                <Text as="span" fontWeight="medium">
                  {name}
                </Text>
                <Text as="span" fontFamily="mono" color="fg.muted">
                  {" "}
                  Ø{fmt(num(op.d, vars))} × {fmt(depth)} a {fmt(num(op.u, vars))} / {fmt(v)}
                </Text>
                {cup && (
                  <Text as="span" color="fg.muted">
                    {" "}
                    (Ø i fondària a Mides)
                  </Text>
                )}
              </Text>
            )
          return (
            <Box key={k} borderWidth="1px" borderColor="border.muted" rounded="md" p={2}>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" fontWeight="medium">
                  {name}
                </Text>
                <IconButton aria-label={`Treure ${name}`} title="Treure el forat" size="2xs" variant="ghost" colorPalette="red" onClick={() => onChange({ ...target, ops: target.ops.filter((_, i) => i !== k) })}>
                  <LuTrash2 />
                </IconButton>
              </HStack>
              <SimpleGrid columns={2} gap={2}>
                <NumberField label="Al llarg" ariaLabel={`${name}: al llarg`} value={num(op.u, vars)} min={-300} max={300} step={0.5} onChange={(x) => setOp(k, { u: x })} />
                <NumberField label={door ? "Cap a dins" : leg ? "Cap al davant" : "Al darrere"} ariaLabel={`${name}: ${door ? "cap a dins" : leg ? "cap al davant" : "al darrere"}`} value={v} min={-300} max={300} step={0.5} onChange={(x) => setOp(k, { v: x })} />
                <NumberField label="Ø" ariaLabel={`${name}: diàmetre`} value={num(op.d, vars)} min={1} max={60} step={0.5} onChange={(x) => setOp(k, { d: x })} />
                <NumberField label="Fondària" ariaLabel={`${name}: fondària`} value={depth} min={0.5} max={40} step={0.5} onChange={(x) => setOp(k, { depth: x })} />
              </SimpleGrid>
            </Box>
          )
        })}
        {!fromPlate && (
          <Box>
            <Button size="xs" variant="ghost" onClick={add}>
              <LuPlus /> Afegir forat
            </Button>
          </Box>
        )}
      </Stack>
    </FormRow>
  )
}

