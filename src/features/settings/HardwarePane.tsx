import { Alert, Badge, Box, Button, HStack, IconButton, Input, Menu, SimpleGrid, Spinner, Stack, Switch, Text } from "@chakra-ui/react"
import { Suspense, lazy, useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { LuCheck, LuCopy, LuPlus, LuStar, LuTrash2, LuUndo2 } from "react-icons/lu"
import { EditorDialog } from "../../components/EditorDialog"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { ChoiceChips, FormRow, FormSection } from "../../components/FormRow"
import { ImportDropZone } from "../../components/ImportDropZone"
import type { PickedFile } from "../../components/pickedFiles"
import { toaster } from "../../components/ui/toaster"
import { confirmProblem, cupRel, pairPlate, relV, restoreProposal, setConfirmed } from "../../core/import/importItem"
import type { HettichArticle } from "../../core/import/hettich"
import { viewBounds, type HardwareView } from "../../core/import/views"
import { assetViews, getHardwareAsset } from "../../db/hardwareAssets"
import { useLiveQuery } from "../../db/useLiveQuery"
import { HardwareImportDialog } from "./HardwareImportDialog"
import { importArticles, sourceFromPicked, type ImportSource } from "./hardwareImport"
import { NumberField, NumRow } from "../../components/NumRow"
import { PanelDrawing } from "../../components/PanelDrawing"
import { SearchBar } from "../../components/SearchBar"
import { useSessionList } from "../../components/sessionState"
import { featureCrop, hardwarePreview } from "../../core/build/hardwarePreview"
import {
  DEFAULT_HARDWARE_KIT,
  HARDWARE_CATEGORIES,
  HARDWARE_PARAMS,
  HARDWARE_SLOTS,
  HINGE_PLATE_PARAMS,
  copyHardwareItem,
  evalExpr,
  hardwareSummary,
  isPendingImport,
  newId,
  slotForEngine,
  type HardwareDefaults,
  type HardwareEngine,
  type HardwareItem,
  type HardwareTarget,
  type MachiningOp,
  type Panel,
  type StepRule,
} from "../../core/model"
import { GalleryCard } from "../projects/GalleryCard"
import { GALLERY_COLS, fold } from "../projects/galleryGrid"
import { HARDWARE_ICONS } from "./hardwareIcons"
import { ThicknessChips } from "./MaterialBits"
import { PaneHeadContext } from "./paneHead"

/** Categories obertes (es recorden durant la sessió). */
const OPEN_KEY = "mobles:md-open:hardware"

/** El 3D d'un ferratge importat (three i el GLB, quan s'obre l'editor). */
const HardwareModelPreview = lazy(() => import("./HardwareModelPreview"))

/** El lloc del moble que fa servir un tipus de ferratge (les plaques importades no en tenen: van amb la frontissa). */
const slotOfEngine = (e: HardwareEngine) => HARDWARE_SLOTS.find((s) => s.engine === e)

/**
 * Preferències › Ferratges (millores v1 F2): la biblioteca com a graella de targetes per categoria (el mateix acordió que
 * Materials i les galeries) i, en tocar-ne una, l'editor a pantalla completa (`EditorDialog`): a l'esquerra el dibuix del
 * patró de mecanitzats sobre una peça d'exemple (`PanelDrawing`, el mateix plànol que Peces, fet amb el motor de
 * fabricació, `hardwarePreview`) i a la dreta els paràmetres. «Afegir» parteix d'un tipus (el per defecte d'aquell lloc).
 */
export function HardwareList({
  items,
  defaults,
  onChange,
  onDefaults,
  onDelete,
  onConfirmed,
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
}) {
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
    const base = items.find((x) => x.id === defaults[slot.slot]) ?? items.find((x) => x.engine === engine)
    if (!base) return
    const item = copyHardwareItem(base, newId("hw"), uniqueName(`${slot.label} nova`))
    onChange([item, ...items])
    open(item)
    setJustAdded(item.id)
  }
  // Importar del fabricant: els fitxers triats → la llista d'articles (diàleg) → els items, sense confirmar.
  const [importSrc, setImportSrc] = useState<ImportSource | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const onPicked = async (picked: PickedFile[]) => {
    setImportBusy(true)
    try {
      const src = await sourceFromPicked(picked)
      if (!src.articles.length)
        toaster.create({ title: "No s'hi ha trobat cap ferratge", description: "Cal una descàrrega de Hettich CAD: el ZIP, la carpeta o els fitxers .stp i _2D_…_view.dxf amb el número d'article.", type: "warning", duration: 8000 })
      else setImportSrc(src)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut llegir", description: e instanceof Error ? e.message : String(e), type: "error", duration: 8000 })
    } finally {
      setImportBusy(false)
    }
  }
  const doImport = async (selected: HettichArticle[]) => {
    if (!importSrc) return
    setImportBusy(true)
    try {
      const base = items.find((x) => x.id === defaults.hinge && x.engine === "cup") ?? DEFAULT_HARDWARE_KIT.hinge
      const r = await importArticles(importSrc, selected, base, (done, total) => setProgress({ done, total }))
      const taken = new Set(items.map((x) => fold(x.name.trim())))
      const fresh = r.items.map((x) => {
        let name = x.name
        for (let n = 2; taken.has(fold(name)); n++) name = `${x.name} ${n}`
        taken.add(fold(name))
        return { ...x, name }
      })
      if (fresh.length) {
        onChange([...fresh, ...items])
        setOpen([...new Set([...openState, ...fresh.map((x) => x.category)])])
      }
      const plate = fresh.find((x) => x.engine === "plate")
      toaster.create({
        title: fresh.length ? `${fresh.length} ${fresh.length === 1 ? "ferratge importat" : "ferratges importats"}, sense confirmar` : "No s'ha importat res",
        description: [
          fresh.length ? "Revisa'n els forats i confirma'ls: fins aleshores no fan cap forat." : "",
          r.paired && plate ? `${r.paired} ${r.paired === 1 ? "frontissa aparellada" : "frontisses aparellades"} amb «${plate.name}».` : "",
          ...r.problems,
        ].filter(Boolean).join(" "),
        type: r.problems.length ? "warning" : "success",
        duration: 12000,
      })
      setImportSrc(null)
      const first = fresh.find((x) => x.engine === "cup") ?? fresh[0]
      if (first) {
        setSel(first.id)
        setEditorOpen(true)
      }
    } catch (e) {
      toaster.create({ title: "No s'ha pogut importar", description: e instanceof Error ? e.message : String(e), type: "error", duration: 8000 })
    } finally {
      setImportBusy(false)
      setProgress(null)
    }
  }

  const q = fold(query.trim())
  const groups = HARDWARE_CATEGORIES.map((c) => ({ ...c, items: items.filter((x) => x.category === c.id && (!q || fold(`${x.name} ${x.maker ?? ""} ${x.ref ?? ""}`).includes(q))) })).filter((g) => g.items.length)
  const defaultOf = (x: HardwareItem) => HARDWARE_SLOTS.find((s) => defaults[s.slot] === x.id && s.engine === x.engine)
  const close = () => {
    setEditorOpen(false)
    setJustAdded(null)
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
      <ImportDropZone title="Importar del fabricant" accept=".zip,.stp,.step,.dxf" busy={importBusy && !importSrc} onPicked={onPicked} testId="hardware-import">
        Descàrregues de <strong>Hettich CAD</strong> (hettich.com › Descàrregues CAD): els ZIP tal com es baixen (STEP i DWG/DXF), una
        carpeta o fitxers <Text as="span" fontFamily="mono">.stp</Text> i <Text as="span" fontFamily="mono">_2D_…_view.dxf</Text>. Frontisses i plaques de
        muntatge: els forats surten del STEP i s'han de confirmar abans que arribin al taller.
      </ImportDropZone>
      <HardwareImportDialog
        articles={importSrc?.articles ?? null}
        fileCount={importSrc?.fileCount ?? 0}
        busy={importBusy}
        progress={progress}
        onCancel={() => setImportSrc(null)}
        onImport={(sel) => void doImport(sel)}
      />
      {groups.length ? (
        <FoldGroup variant="gallery" value={openState} onValueChange={setOpen} forceOpen={q ? groups.map((g) => g.id) : null}>
          {groups.map((g) => (
            <FoldItem key={g.id} id={g.id} icon={HARDWARE_ICONS[g.id]} title={g.label} count={g.items.length} description={g.hint}>
              <SimpleGrid columns={GALLERY_COLS} gap={3} p="var(--gallery-px, 0)">
                {g.items.map((x) => {
                  const def = defaultOf(x)
                  return (
                    <GalleryCard
                      key={x.id}
                      thumb={<HardwareThumb item={x} />}
                      title={x.name}
                      kicker={[x.maker, x.ref].filter(Boolean).join(" · ") || undefined}
                      description={hardwareSummary(x)}
                      tags={
                        def ? (
                          <Badge size="xs" variant="subtle" colorPalette="wood" title={`Per defecte a: ${def.uses}`}>
                            <LuStar /> Per defecte
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
                })}
              </SimpleGrid>
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
        {it && <HardwareStage item={it} />}
        {it && (
          <HardwareCard
            key={it.id}
            item={it}
            dirty={dirty}
            plates={items.filter((x) => x.engine === "plate")}
            isDefault={(() => {
              const sl = slotOfEngine(it.engine)
              return !!sl && defaults[sl.slot] === it.id
            })()}
            onDefault={() => {
              const sl = slotOfEngine(it.engine)
              if (sl) onDefaults({ ...defaults, [sl.slot]: it.id })
            }}
            onChange={(next) => {
              const list = items.map((x, k) => (k === i ? next : x))
              onChange(list)
              if (it.imported && next.imported && it.imported.confirmed !== next.imported.confirmed) onConfirmed?.(it, next, list)
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

/** Miniatura de la targeta: el patró de mecanitzats de la primera peça d'exemple (sense text). */
function HardwareThumb({ item }: { item: HardwareItem }) {
  // El detall dels forats de la primera peça d'exemple (a la peça sencera, els forats petits no es veurien).
  const { panel, crop } = useMemo(() => {
    const p = hardwarePreview(item).panels[0]
    return { panel: p, crop: p ? featureCrop(p) : undefined }
  }, [item])
  return (
    <Box w="full" aspectRatio="3 / 2" rounded="md" borderWidth="1px" borderColor="border.emphasized" bg="bg.subtle" display="flex" alignItems="center" justifyContent="center" overflow="hidden">
      {panel ? (
        <Box w="full" maxH="full">
          <PanelDrawing panel={panel} crop={crop} caption={false} />
        </Box>
      ) : (
        <Text fontSize="xs" color="fg.muted">
          Sense dibuix
        </Text>
      )}
    </Box>
  )
}

/** Vista frontal registrada (al marc del ferratge) d'un model desat, o `null`. */
function frontView(views: HardwareView[]): HardwareView | null {
  return views.find((v) => v.name === "front" && v.registered) ?? null
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
 * Dibuix del patró de mecanitzats (a l'esquerra de l'editor, a la columna gran a l'ordinador): una o dues peces d'exemple
 * amb els forats que hi fa el motor, vistes des de la cara A (els de cantell, discontinus; els passants, buits). D'un
 * importat, a sota dels forats la vista frontal del fitxer (si s'ha pogut registrar sobre els forats proposats), les
 * vistes 2D tal com venen i el 3D.
 */
function HardwareStage({ item }: { item: HardwareItem }) {
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
      <Stack gap={5} maxW="760px" mx="auto">
        {preview.error && (
          <Alert.Root status="warning" size="sm">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>No es pot fer servir</Alert.Title>
              <Alert.Description>{preview.error} Els mobles faran servir el d'inici de l'app.</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
        {preview.panels.map((p) => {
          // Al costat, el detall dels forats (amb el cantell): a la peça sencera, una espiga Ø8 és un punt.
          const crop = featureCrop(p)
          return (
            <SimpleGrid key={p.id} columns={{ base: 1, md: crop ? 2 : 1 }} gap={3} bg="bg" rounded="lg" borderWidth="1px" p={{ base: 3, md: 4 }} alignItems="center" data-testid={`hardware-sample-${p.id}`}>
              <PanelDrawing panel={p} underlay={under[p.id]} />
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
        <Text fontSize="xs" color="fg.muted" textAlign="center">
          Patró de mecanitzats sobre una peça d'exemple, vist des de la cara A: forats de cara plens, de cantell discontinus i passants buits. Al moble, la regla de cada contingut els col·loca (les cassoletes, a la filera System 32).
          {item.imported && " En gris, la vista frontal del fitxer del fabricant, encaixada sobre els forats proposats."}
        </Text>
        {item.imported && ownId && (
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            <Stack gap={1} bg="bg" rounded="lg" borderWidth="1px" p={2} minH="260px">
              <Text fontSize="sm" fontWeight="medium" px={1}>
                3D
              </Text>
              <Box flex={1} minH="220px" rounded="md" overflow="hidden" data-testid="hardware-3d">
                {own === undefined ? null : own?.glb ? (
                  <Suspense fallback={<Spinner size="sm" color="wood.solid" m={3} />}>
                    <HardwareModelPreview asset={ownId} edge={item.engine === "plate" ? (item.params.setback ?? 37) : (item.params.cupOffset ?? 22.5)} plate={item.engine === "plate"} />
                  </Suspense>
                ) : (
                  <Text fontSize="xs" color="fg.muted" p={2}>
                    Sense model 3D (OpenCascade no l'ha pogut fer).
                  </Text>
                )}
              </Box>
            </Stack>
            {ownViews.map((v) => (
              <ViewDrawing key={v.name} view={v} />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Box>
  )
}

const VIEW_LABEL: Record<HardwareView["name"], string> = { front: "Vista frontal", side: "Vista lateral", top: "Vista de dalt" }

/** Una vista 2D del fitxer (línies i punts de connexió), tal com ve o encaixada al marc del ferratge. */
function ViewDrawing({ view }: { view: HardwareView }) {
  const b = viewBounds(view.lines)
  if (!b) return null
  const pad = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.06 + 1
  const vb = { x: b.x0 - pad, y: -b.y1 - pad, w: b.x1 - b.x0 + 2 * pad, h: b.y1 - b.y0 + 2 * pad }
  const stroke = Math.max(vb.w, vb.h) / 350
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
      <Box asChild color="fg" w="full" style={{ aspectRatio: `${vb.w} / ${vb.h}` }} maxH="260px">
        <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
          <g transform="scale(1 -1)" fill="none" stroke="currentColor" strokeWidth={stroke}>
            {view.lines.map((l, i) => (
              <polyline key={i} points={l.map((v, k) => (k % 2 ? `${v} ` : `${v},`)).join("")} />
            ))}
            {!view.registered &&
              view.points.map(([x, y], i) => (
                <g key={`p${i}`} stroke="var(--chakra-colors-wood-solid)" strokeWidth={stroke * 1.5}>
                  <line x1={x - pad / 3} y1={y} x2={x + pad / 3} y2={y} />
                  <line x1={x} y1={y - pad / 3} x2={x} y2={y + pad / 3} />
                </g>
              ))}
          </g>
        </svg>
      </Box>
    </Stack>
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
  isDefault,
  onDefault,
  onChange,
  onDuplicate,
  onDelete,
  autoFocusName,
}: {
  item: HardwareItem
  dirty: RefObject<boolean>
  /** Les plaques de la biblioteca (per aparellar-ne una a una frontissa importada). */
  plates: HardwareItem[]
  isDefault: boolean
  onDefault: () => void
  onChange: (next: HardwareItem) => void
  onDuplicate: () => void
  onDelete: () => void
  autoFocusName?: boolean
}) {
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
  const set = (patch: Partial<HardwareItem>) => onChange({ ...item, ...patch })
  // Canviar els forats d'un importat el torna a deixar sense confirmar (cal tornar-lo a revisar).
  const setTargets = (targets: HardwareTarget[]) => onChange(item.imported ? { ...item, targets, imported: { ...item.imported, confirmed: false } } : { ...item, targets })
  const problem = confirmProblem(item)
  const setParam = (key: string, v: number) => Number.isFinite(v) && set({ params: { ...item.params, [key]: v } })
  const setText = (key: "maker" | "ref", v: string) => {
    const { [key]: _old, ...rest } = item
    onChange(v.trim() ? { ...rest, [key]: v } : rest)
  }
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

        <FormSection title="General">
          <FormRow
            label="Tipus"
            help={slot ? `Fa de «${slot.label}»: ${slot.uses}. La regla de cada contingut decideix on va i quants se'n posen.` : "Placa de muntatge: no va sola; la frontissa importada que s'hi aparella en copia els forats (al lateral, a l'alçada de cada cassoleta)."}
          >
            <Text fontSize="sm" pt="6px">
              {slot?.label ?? "Placa de muntatge"}
            </Text>
          </FormRow>
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
        </FormSection>

        {item.imported && (
          <FormSection title="Importat del fabricant">
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
            <FormRow label="" help="Els forats tornen a ser els que es van llegir del fitxer (sense confirmar).">
              <Button size="xs" variant="ghost" onClick={() => onChange(restoreProposal(item))}>
                <LuUndo2 /> Tornar a la proposta
              </Button>
            </FormRow>
          </FormSection>
        )}

        {item.imported && item.engine === "cup" && (
          <FormSection title="Placa de muntatge">
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
          </FormSection>
        )}

        <FormSection title="Mides">
          {HARDWARE_PARAMS[item.engine].map((p) => (
            <NumRow key={p.key} label={p.label} help={p.help} value={item.params[p.key] ?? 0} min={p.min} max={p.max} step={p.step} onChange={(v) => setParam(p.key, v)} />
          ))}
          {item.lengths && (
            <FormRow label="Llargades" help="Les guies que es poden comprar: el calaix agafa la més llarga que hi cap.">
              <ThicknessChips value={item.lengths} onChange={(lengths) => set({ lengths })} label={false} what="llargada" range={[100, 1500]} />
            </FormRow>
          )}
        </FormSection>

        {item.count && (
          <FormSection title="Quantitat per alçada">
            <StepRows rule={item.count} kind="count" onChange={(count) => set({ count })} />
          </FormSection>
        )}
        {item.pitch && (
          <FormSection title="Distància entre forats">
            <StepRows rule={item.pitch} kind="pitch" onChange={(pitch) => set({ pitch })} />
          </FormSection>
        )}

        {item.imported ? (
          <FormSection title="Mecanitzats">
            {item.targets.map((t) => (
              <OpsEditor key={t.key} item={item} target={t} onChange={(next) => setTargets(item.targets.map((x) => (x.key === t.key ? next : x)))} />
            ))}
          </FormSection>
        ) : (
        <FormSection title="Mecanitzats">
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
          <Text fontSize="xs" color="fg.muted" px={{ base: 4, sm: 6 }} pb={2}>
            En coordenades de la peça (u al llarg del cantell de referència, v cap a dins), amb els noms de les mides de dalt. Editar-los i afegir-ne és per a més endavant (ferratges manuals).
          </Text>
        </FormSection>
        )}
      </Box>
    </Box>
  )
}

const TAG_LABEL: Record<string, string> = { hinge: "Cassoleta", "hinge-screw": "Cargol", "hinge-dowel": "Espiga", plate: "Placa" }
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
  const add = () => onChange({ ...target, ops: [...target.ops, { kind: "drill", face: "A", u: 0, v: door ? cupRel(10) : 0, d: 5, depth: 10, tag: door ? "hinge-screw" : "plate" }] })
  return (
    <FormRow label={target.label} help={fromPlate ? "De la placa aparellada: per canviar-los, edita la placa i torna-la a triar." : door ? "Al llarg del cantell i cap a dins des del centre de la cassoleta (mm)." : "Al llarg (amunt) i cap al darrere des de la referència de la placa (mm)."}>
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
                <NumberField label={door ? "Cap a dins" : "Al darrere"} ariaLabel={`${name}: ${door ? "cap a dins" : "al darrere"}`} value={v} min={-300} max={300} step={0.5} onChange={(x) => setOp(k, { v: x })} />
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

/** Graons d'una regla (`StepRule`): frontisses per alçada de porta, o distància dels forats del tirador per espai. */
function StepRows({ rule, kind, onChange }: { rule: StepRule; kind: "count" | "pitch"; onChange: (r: StepRule) => void }) {
  const setStep = (i: number, patch: Partial<StepRule["steps"][number]>) => onChange({ ...rule, steps: rule.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) })
  if (kind === "count")
    return (
      <>
        {rule.steps.map((s, i) => (
          <NumRow key={i} label={`${s.n} frontisses`} help={i === 0 ? "Fins a aquesta alçada de porta." : undefined} value={s.upTo} min={i > 0 ? rule.steps[i - 1]!.upTo + 1 : 100} max={i < rule.steps.length - 1 ? rule.steps[i + 1]!.upTo - 1 : 4000} step={10} onChange={(upTo) => Number.isFinite(upTo) && setStep(i, { upTo })} />
        ))}
        <FormRow label="Més altes" help="Frontisses de les portes més altes que l'últim graó.">
          <Box w="120px">
            <NumberField label="" ariaLabel="Frontisses de les portes més altes" suffix="u" value={rule.else} min={1} max={12} step={1} onChange={(v) => Number.isFinite(v) && v >= 1 && onChange({ ...rule, else: Math.round(v) })} />
          </Box>
        </FormRow>
      </>
    )
  return (
    <>
      {rule.steps.map((s, i) => (
        <NumRow key={i} label={`Menys de ${s.upTo}`} help={i === 0 ? "Distància entre els dos forats si el front fa menys d'aquesta mida." : undefined} value={s.n} min={16} max={1000} step={1} onChange={(n) => Number.isFinite(n) && setStep(i, { n })} />
      ))}
      <NumRow label="Si hi cap" help="La distància quan hi ha prou lloc." value={rule.else} min={16} max={1000} step={1} onChange={(v) => Number.isFinite(v) && onChange({ ...rule, else: v })} />
    </>
  )
}

