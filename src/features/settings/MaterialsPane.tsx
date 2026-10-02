import { Accordion, Badge, Box, Button, CloseButton, Dialog, HStack, IconButton, Input, InputGroup, Portal, SimpleGrid, Stack, Switch, Text } from "@chakra-ui/react"
import { useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { LuCopy, LuImagePlus, LuLayers2, LuLayers3, LuPaintbrush, LuPlus, LuSearch, LuSprayCan, LuStar, LuTrash2 } from "react-icons/lu"
import { ChoiceChips, FormRow, FormSection } from "../../components/FormRow"
import { NumberField } from "../../components/NumRow"
import { toaster } from "../../components/ui/toaster"
import { MATERIAL_CATEGORIES, materialCategory, materialNameError, newId, restoredFinish, switchFinish, tidyMaterialName, withCategory, type Finish, type MaterialCategory, type MaterialPref } from "../../core/model"
import { GalleryCard } from "../projects/GalleryCard"
import { GALLERY_COLS, fold } from "../projects/galleryGrid"
import type { LibraryItem } from "./libraryItems"
import { MaterialHero, ThicknessChips } from "./MaterialBits"
import { MaterialLibrary } from "./MaterialLibrary"
import { isEditable, previewStyle } from "./materialPreview"
import { PaneHeadContext } from "./paneHead"
import { TextureEditor } from "./TextureEditor"
import { MapThumb, TextureMapRows, TextureSetRow } from "./TextureMapRows"
import { encodeMap, pickFiles } from "./textureImport"

/** Icones de les categories (com els apartats de les pàgines principals). */
const CATEGORY_ICONS: Record<MaterialCategory, ReactNode> = { board: <LuLayers3 />, back: <LuLayers2 />, sim: <LuSprayCan /> }
/** Per a què serveix cada categoria (sota el nom, a l'acordió). */
const CATEGORY_HINTS: Record<MaterialCategory, string> = {
  board: "Materials per al nesting: es tallen a la CNC (cossos, fronts, taulells).",
  back: "Materials per al nesting: taulers prims per als fons.",
  sim: "Materials decoratius per als objectes i els ambients: no es tallen.",
}
/** Categories obertes (es recorden durant la sessió). */
const OPEN_KEY = "mobles:md-open:materials"

const SPECIES: { value: Extract<Finish, { kind: "wood" }>["species"]; label: string }[] = [
  { value: "oak", label: "Roure" },
  { value: "walnut", label: "Noguera" },
  { value: "ash", label: "Freixe" },
]

const FINISH_LABEL: Record<Finish["kind"], string> = { color: "Color llis", lacquer: "Lacat", wood: "Fusta", image: "Foto real", metal: "Metall", glass: "Vidre", fabric: "Teixit", tiles: "Rajola", stone: "Pedra" }

/** Resum d'una línia: acabat, gruixos i cantell. */
function materialSummary(m: MaterialPref): string {
  return `${FINISH_LABEL[m.finish.kind]} · ${m.thicknesses.join(" · ")} mm${m.edge ? ` · ${m.edge}` : ""}`
}

/**
 * Preferències › Materials: una graella de targetes per categoria (Taulers · Fons · Simulació, el mateix acordió que les
 * galeries) i, en tocar-ne una, l'editor a pantalla completa (com la finestra del Render). `footer`: «Per defecte als mòduls
 * nous» (només a l'editor d'un tauler o d'un fons); `defaults`: els noms per defecte (★ a la targeta).
 */
export function MaterialsList({ materials, onChange, onRename, onDelete, footer, defaults }: { materials: MaterialPref[]; onChange: (m: MaterialPref[]) => void; onRename: (from: string, to: string) => void; onDelete: (m: MaterialPref) => void; footer?: ReactNode; defaults: { material: string; backMaterial: string } }) {
  const head = useContext(PaneHeadContext)
  const [sel, setSel] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [justAdded, setJustAdded] = useState<string | null>(null)
  // El nom a mig escriure: Esc només el desfà (no tanca l'editor).
  const dirty = useRef(false)
  const [openState, setOpenState] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(OPEN_KEY) ?? "null") as unknown
      // Abans es desava un objecte { id: obert }.
      if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string")
      if (raw && typeof raw === "object") return Object.entries(raw).filter(([, v]) => v === true).map(([k]) => k)
    } catch {
      /* res desat */
    }
    // La primera vegada, els taulers (el que més es toca).
    return ["board"]
  })
  const setOpen = (ids: string[]) => {
    setOpenState(ids)
    try {
      sessionStorage.setItem(OPEN_KEY, JSON.stringify(ids))
    } catch {
      /* només aquesta vista */
    }
  }
  const update = (i: number, patch: Partial<MaterialPref>) => onChange(materials.map((m, k) => (k === i ? { ...m, ...patch } : m)))
  // Noms únics sense majúscules ni espais (com l'esquema, `materialNameKey`).
  const uniqueName = (base: string) => {
    const taken = (n: string) => materialNameError(materials, "", n) !== null
    if (!taken(base)) return base
    let n = 2
    while (taken(`${base} ${n}`)) n++
    return `${base} ${n}`
  }
  // Obrir un material a l'editor; la seva categoria queda oberta a la graella (en tancar-lo, es veu on és).
  const open = (m: MaterialPref) => {
    const c = materialCategory(m)
    if (!openState.includes(c)) setOpen([...openState, c])
    setSel(m.id)
    setEditorOpen(true)
  }
  const [library, setLibrary] = useState(false)
  const addMaterial = (m: MaterialPref) => {
    onChange([m, ...materials])
    open(m)
    setJustAdded(m.id)
  }
  const blank = () => {
    // A la categoria que es mira (l'única oberta), si no als taulers; amb nom únic i el nom a punt d'escriure.
    const base: MaterialPref = { id: newId("mat"), name: uniqueName("Material nou"), thicknesses: [19], hasGrain: false, finish: { kind: "color", color: "#e5e5e5" }, edge: "" }
    const only = openState.length === 1 ? (openState[0] as MaterialCategory) : null
    addMaterial(only && only !== "board" ? withCategory(base, only) : base)
  }
  const fromLibrary = ({ group: _g, ...item }: LibraryItem) => addMaterial({ ...structuredClone(item), id: newId("mat"), name: uniqueName(item.name) })
  const q = fold(query.trim())
  const i = materials.findIndex((m) => m.id === sel)
  const m = i >= 0 ? materials[i]! : null
  useEffect(() => {
    // Eliminat (o restaurat): l'editor es tanca.
    if (sel !== null && i < 0) {
      setSel(null)
      setEditorOpen(false)
    }
  }, [sel, i])
  const groups = MATERIAL_CATEGORIES.map((c) => ({ ...c, items: materials.filter((x) => materialCategory(x) === c.id && (!q || fold(x.name).includes(q))) })).filter((g) => g.items.length)
  // La cerca obre les categories amb resultats.
  const openIds = q ? groups.map((g) => g.id) : openState
  const shownM = m
  // En tancar, `sel` es queda: mentre es tanca (l'animació de sortida) es veu el mateix material.
  const close = () => {
    setEditorOpen(false)
    setJustAdded(null)
  }
  const defaultOf = (x: MaterialPref) => (x.name === defaults.material ? "Tauler per defecte" : x.name === defaults.backMaterial ? "Fons per defecte" : null)
  return (
    <Stack gap={4} minW={0}>
      {head}
      <HStack gap={2}>
        <InputGroup flex={1} minW={0} maxW={{ md: "420px" }} startElement={<LuSearch />} endElement={query ? <CloseButton size="xs" aria-label="Esborrar la cerca" onClick={() => setQuery("")} /> : undefined}>
          <Input size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cercar…" aria-label="Cercar materials" />
        </InputGroup>
        <Button size="sm" colorPalette="wood" flexShrink={0} onClick={() => setLibrary(true)}>
          <LuPlus /> Afegir
        </Button>
      </HStack>
      {groups.length ? (
        // El mateix acordió que els apartats de les galeries (Historial, Catàleg…): tancat amb vora, icona, nom i
        // comptador; a sota del nom, per a què serveix. Les targetes només es munten en obrir la categoria.
        <Accordion.Root className="gallery-accordion" multiple collapsible lazyMount variant="enclosed" value={openIds} onValueChange={(e) => !q && setOpen(e.value)}>
          {groups.map((g) => (
            <Accordion.Item key={g.id} value={g.id}>
              <Accordion.ItemTrigger cursor="pointer">
                <Stack flex={1} gap={0.5} minW={0} textAlign="left">
                  <HStack gap={2} minW={0}>
                    <Box color="wood.fg" display="inline-flex">
                      {CATEGORY_ICONS[g.id]}
                    </Box>
                    <Text fontWeight="semibold" fontSize="sm" truncate>
                      {g.label}
                    </Text>
                    <Badge size="xs" variant="subtle" colorPalette="gray">
                      {g.items.length}
                    </Badge>
                  </HStack>
                  <Text fontSize="xs" color="fg.muted" fontWeight="normal">
                    {CATEGORY_HINTS[g.id]}
                  </Text>
                </Stack>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  <SimpleGrid columns={GALLERY_COLS} gap={3} p="var(--gallery-px, 0)">
                    {g.items.map((x) => {
                      const def = defaultOf(x)
                      return (
                        <GalleryCard
                          key={x.id}
                          thumb={<MaterialSwatch m={x} />}
                          title={x.name}
                          description={materialSummary(x)}
                          tags={
                            def ? (
                              <Badge size="xs" variant="subtle" colorPalette="wood" title={`${def} als mòduls nous`}>
                                <LuStar /> {def}
                              </Badge>
                            ) : undefined
                          }
                          selected={editorOpen && x.id === sel}
                          onClick={() => open(x)}
                        />
                      )
                    })}
                  </SimpleGrid>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      ) : (
        <Text fontSize="sm" color="fg.muted" px={1}>
          {q ? "Cap resultat." : "Encara no n'hi ha cap."}
        </Text>
      )}
      <MaterialEditorDialog open={editorOpen && m !== null} m={shownM} onClose={close} dirty={dirty} focusName={shownM !== null && justAdded === shownM.id}>
        {shownM && (
          <MaterialCard
            key={shownM.id}
            m={shownM}
            dirty={dirty}
            footer={materialCategory(shownM) === "board" || materialCategory(shownM) === "back" ? footer : undefined}
            onChange={(patch) => i >= 0 && update(i, patch)}
            nameError={(name) => materialNameError(materials, shownM.id, name)}
            onRename={(name) => i >= 0 && onRename(shownM.name, name)}
            autoFocusName={justAdded === shownM.id}
            onDuplicate={() => {
              if (i < 0) return
              const copy = { ...shownM, id: newId("mat"), name: uniqueName(`${shownM.name} (còpia)`) }
              const next = [...materials]
              next.splice(i + 1, 0, copy)
              onChange(next)
              setSel(copy.id)
              setJustAdded(copy.id)
            }}
            onDelete={() => onDelete(shownM)}
            canDelete={materials.length > 1}
          />
        )}
      </MaterialEditorDialog>
      <MaterialLibrary open={library} onClose={() => setLibrary(false)} onPick={fromLibrary} onBlank={blank} materials={materials} onOpenExisting={(id) => {
        const x = materials.find((y) => y.id === id)
        if (x) open(x)
      }} />
    </Stack>
  )
}

/**
 * Mostra de la targeta: el material de debò (textura, foto, color) amb CSS, sense canvas per targeta (les textures
 * procedurals es pinten un cop i es recorden, `previewStyle`). Escala fixa: totes les targetes es veuen a la mateixa.
 */
function MaterialSwatch({ m }: { m: MaterialPref }) {
  return <Box w="full" aspectRatio="3 / 2" rounded="md" borderWidth="1px" borderColor="border.emphasized" style={previewStyle(m, 240)} backgroundRepeat="repeat" />
}

/**
 * Editor d'un material a pantalla completa (com la finestra del Render: 100vw × 100dvh, zona segura als quatre costats i
 * el ✕ a `calc(env(safe-area-inset-top) + 8px)`). Esc i ✕ tornen a la graella; Esc amb el nom a mig escriure només el desfà.
 */
function MaterialEditorDialog({ open, m, onClose, dirty, focusName, children }: { open: boolean; m: MaterialPref | null; onClose: () => void; dirty: RefObject<boolean>; focusName: boolean; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const shown = m
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      size="full"
      placement="center"
      onEscapeKeyDown={(e) => dirty.current && e.preventDefault()}
      // Sense el teclat al mòbil: el focus va al ✕; un material nou, al nom (seleccionat, `autoFocusName`).
      initialFocusEl={() => (focusName ? contentRef.current?.querySelector<HTMLElement>("[data-material-name]") : null) ?? closeRef.current}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content ref={contentRef} w="100vw" maxW="100vw" h="100dvh" maxH="100dvh" rounded="none" display="flex" flexDirection="column" overflow="hidden" pt="env(safe-area-inset-top, 0px)" pb="env(safe-area-inset-bottom, 0px)" ps="env(safe-area-inset-left, 0px)" pe="env(safe-area-inset-right, 0px)">
            {/* A l'altura del ✕ (a 8 px de dalt): el títol queda centrat amb ell. */}
            <Dialog.Header py={0} pe={14} minH="calc(var(--chakra-sizes-9) + 16px)" display="flex" alignItems="center" borderBottomWidth="1px">
              <HStack gap={2} minW={0}>
                <Dialog.Title truncate fontSize="md">
                  {shown?.name}
                </Dialog.Title>
                {shown && (
                  <Text fontSize="sm" color="fg.muted" flexShrink={0}>
                    {MATERIAL_CATEGORIES.find((c) => c.id === materialCategory(shown))?.label}
                  </Text>
                )}
              </HStack>
            </Dialog.Header>
            <Dialog.Body p={0} flex={1} minH={0} display="flex" flexDirection={{ base: "column", lg: "row" }} overflowY={{ base: "auto", lg: "hidden" }}>
              {children}
            </Dialog.Body>
            <Dialog.CloseTrigger asChild top="calc(env(safe-area-inset-top, 0px) + 8px)" insetEnd="calc(env(safe-area-inset-right, 0px) + 8px)">
              <CloseButton ref={closeRef} size="sm" aria-label="Tancar" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

function MaterialCard({ m, dirty, footer, onChange, onRename, nameError, onDuplicate, onDelete, canDelete, autoFocusName }: { m: MaterialPref; dirty: RefObject<boolean>; footer?: ReactNode; onChange: (p: Partial<MaterialPref>) => void; onRename: (name: string) => void; nameError: (name: string) => string | null; onDuplicate: () => void; onDelete: () => void; canDelete: boolean; autoFocusName?: boolean }) {
  const [editing, setEditing] = useState(false)
  // El nom es canvia en acabar (sortir del camp o Retorn), no a cada tecla: llavors els mobles i ambients que el fan
  // servir el segueixen (`renameMaterialEverywhere`). Repetit o buit: l'error a sota i, en acabar, es queda l'antic.
  const [nameText, setNameText] = useState(m.name)
  useEffect(() => setNameText(m.name), [m.name])
  const typedError = nameText === m.name ? null : nameError(nameText)
  // Esc desfà: el `blur` que ve després no ha de desar el text d'abans (el seu `nameText` encara és l'escrit).
  const cancelName = useRef(false)
  const commitName = () => {
    if (cancelName.current) {
      cancelName.current = false
      setNameText(m.name)
      return
    }
    const next = tidyMaterialName(nameText)
    if (next === m.name) {
      setNameText(m.name)
      return
    }
    const err = nameError(next)
    if (err) {
      toaster.create({ title: "El nom no s'ha canviat", description: err, type: "warning" })
      setNameText(m.name)
      return
    }
    onRename(next)
  }
  const finish = m.finish
  // Fotos d'abans (sense proporció): es mesura la imatge un cop.
  const needsAspect = finish.kind === "image" && finish.aspect === undefined ? finish.src : null
  useEffect(() => {
    if (!needsAspect || finish.kind !== "image") return
    const img = new Image()
    img.onload = () => img.width && onChange({ finish: { ...finish, aspect: Math.round((img.height / img.width) * 1000) / 1000 } })
    img.src = needsAspect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAspect])
  const swatch = finish.kind === "wood" || finish.kind === "image" ? undefined : finish.color
  const setKind = (k: Finish["kind"]) => {
    if (k === finish.kind) return
    // Si ja havia tingut aquest acabat (o és una foto de l'app), es recupera tal com era.
    const back = restoredFinish(m, k)
    if (back) {
      onChange(switchFinish(m, back))
      return
    }
    if (k === "image") {
      // Primer cal triar la foto; si es cancel·la, l'acabat no canvia.
      void pickTexture().then((t) => t && onChange(switchFinish(m, { kind: "image", tileMm: 800, ...t })))
      return
    }
    const color = swatch ?? "#e5e5e5"
    onChange(switchFinish(m, 
        k === "wood"
          ? { kind: "wood", species: "oak" }
          : k === "tiles"
            ? { kind: "tiles", color, grout: "#cfcac0", size: 600 }
            : k === "stone"
              ? { kind: "stone", color: swatch ?? "#e8e4dc", vein: "#8f8a82", veins: 0.5, size: 1200, seed: 7 }
              : k === "fabric"
                ? { kind: "fabric", color }
                : { kind: k, color },
    ))
  }
  const category = MATERIAL_CATEGORIES.find((c) => c.id === materialCategory(m))!
  useEffect(() => {
    dirty.current = nameText !== m.name
  })
  return (
    <>
      {/* La mostra a escala real: a l'ordinador, tota la columna de l'esquerra; al mòbil, a dalt (la pàgina es desplaça). */}
      <Box flex={{ lg: 1 }} minW={0} minH={0} h={{ base: "220px", md: "280px", lg: "auto" }} flexShrink={0} bg="bg.subtle">
        <MaterialHero m={m} fill />
      </Box>
      <TextureEditor m={m} open={editing} onClose={() => setEditing(false)} onApply={(f) => onChange({ finish: f })} />

      <Box w={{ base: "full", lg: "min(560px, 48%)" }} flexShrink={0} overflowY={{ lg: "auto" }} borderStartWidth={{ lg: "1px" }} css={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}>
      <Box maxW={{ base: "760px", lg: "none" }} mx="auto" pb={{ base: 8, lg: 6 }}>
      {/* Nom (editable, gran) i accions. */}
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
                setNameText(m.name)
                e.currentTarget.blur()
              }
            }}
            aria-invalid={typedError ? true : undefined}
            autoFocus={autoFocusName}
            onFocus={(e) => autoFocusName && e.currentTarget.select()}
            aria-label="Nom del material"
            data-material-name=""
            borderColor="transparent"
            _hover={{ borderColor: "border" }}
            _focus={{ borderColor: "wood.solid" }}
          />
          {typedError ? (
            <Text fontSize="xs" color="fg.error" role="alert">
              {typedError}
            </Text>
          ) : (
            <Text fontSize="xs" color="fg.muted" truncate>
              {materialSummary(m)}
            </Text>
          )}
        </Stack>
        <HStack gap={0} flexShrink={0} pt={1.5}>
          <IconButton aria-label="Duplicar material" title="Duplicar" size="sm" variant="ghost" onClick={onDuplicate}>
            <LuCopy />
          </IconButton>
          <IconButton aria-label="Eliminar material" title="Eliminar" size="sm" variant="ghost" colorPalette="red" disabled={!canDelete} onClick={onDelete}>
            <LuTrash2 />
          </IconButton>
        </HStack>
      </HStack>

      <FormSection title="Aspecte">
        <FormRow label="Acabat">
          <ChoiceChips<Finish["kind"]>
            label="Acabat"
            options={[
              { id: "color", label: "Color llis" },
              { id: "lacquer", label: "Lacat" },
              { id: "wood", label: "Fusta" },
              { id: "image", label: "Foto (textura)" },
              { id: "metal", label: "Metall" },
              { id: "glass", label: "Vidre" },
              { id: "fabric", label: "Teixit" },
              { id: "tiles", label: "Rajola" },
              { id: "stone", label: "Pedra / marbre" },
            ]}
            value={finish.kind}
            onChange={setKind}
          />
        </FormRow>
        {finish.kind === "image" ? (
          <FormRow label="Foto" help={`${finish.tileMm} × ${Math.round(finish.tileMm * (finish.aspect ?? 1))} mm de tauler per repetició, ${finish.seamless ? "repetida tal qual" : "en mirall"}.`}>
            <HStack gap={3} align="flex-start" wrap="wrap">
              <MapThumb src={finish.src} label="Foto de color" />
              <Stack gap={1} minW={0} flex="1 1 200px">
                <HStack gap={2} wrap="wrap">
                  <HStack gap={1.5} wrap="wrap">
                    <Box w="150px">
                      <NumberField label="" ariaLabel="Amplada de la foto" value={finish.tileMm} min={50} max={5000} step={10} onChange={(v) => v >= 50 && v <= 5000 && onChange({ finish: { ...finish, tileMm: v } })} />
                    </Box>
                    <Text fontSize="sm" color="fg.muted">
                      d'amplada
                    </Text>
                  </HStack>
                  <Button size="sm" variant="outline" onClick={() => void pickTexture().then((t) => t && onChange({ finish: { ...finish, ...t } }))}>
                    <LuImagePlus /> Canviar
                  </Button>
                  <Button size="sm" variant="ghost" colorPalette="red" onClick={() => onChange({ finish: m.hasGrain ? { kind: "wood", species: "oak" } : { kind: "color", color: "#e5e5e5" } })}>
                    <LuTrash2 /> Treure
                  </Button>
                </HStack>
                <Switch.Root size="sm" mt={1} checked={!!finish.seamless} onCheckedChange={(e) => onChange({ finish: { ...finish, seamless: e.checked || undefined } })}>
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label fontSize="sm">Sense costures (repetir sense mirall)</Switch.Label>
                </Switch.Root>
              </Stack>
            </HStack>
          </FormRow>
        ) : finish.kind === "wood" ? (
          <FormRow label="Espècie">
            <ChoiceChips label="Espècie" options={SPECIES.map((s) => ({ id: s.value, label: s.label }))} value={finish.species} onChange={(species) => onChange({ finish: { kind: "wood", species } })} />
          </FormRow>
        ) : (
          <FormRow label="Color">
            {/* Mostra de color compacta amb el codi al costat. */}
            <HStack gap={2} maxW="280px">
              <Input size="sm" type="color" value={finish.color} onChange={(e) => onChange({ finish: { ...finish, color: e.target.value } })} p="5px" w="48px" flexShrink={0} aria-label="Color" />
              <Input size="sm" key={finish.color} defaultValue={finish.color} onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value.trim()) && onChange({ finish: { ...finish, color: e.target.value.trim() } })} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} fontFamily="mono" aria-label="Codi del color" />
            </HStack>
          </FormRow>
        )}
        {finish.kind === "image" && <TextureMapRows finish={finish} onChange={(f) => onChange({ finish: f })} />}
        {finish.kind === "tiles" && (
          <FormRow label="Rajola">
            <HStack gap={3} wrap="wrap">
              <Box w="150px">
                <NumberField label="" ariaLabel="Mida de la rajola" value={finish.size} min={20} max={1500} step={10} onChange={(v) => v >= 20 && v <= 1500 && onChange({ finish: { ...finish, size: v } })} />
              </Box>
              <HStack gap={1.5}>
                <Input size="sm" type="color" value={finish.grout} onChange={(e) => onChange({ finish: { ...finish, grout: e.target.value } })} p="5px" w="48px" aria-label="Color de la junta" />
                <Text fontSize="sm" color="fg.muted">junta</Text>
              </HStack>
            </HStack>
          </FormRow>
        )}
        {isEditable(finish) && (
          <FormRow label="Textura" help="Dissenya-la (veta, nusos, vetes del marbre, trama…) o posa-hi una foto del tauler de debò.">
            <HStack gap={2} wrap="wrap">
              <Button size="sm" variant="outline" colorPalette="wood" onClick={() => setEditing(true)}>
                <LuPaintbrush /> Editar la textura
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void pickTexture().then((t) => t && onChange({ finish: { kind: "image", tileMm: 800, ...t } }))}>
                <LuImagePlus /> Posar una foto
              </Button>
            </HStack>
          </FormRow>
        )}
        <TextureSetRow finish={finish} onChange={(f) => onChange({ finish: f })} />
      </FormSection>

      <FormSection title="Fabricació">
        {/* Els de simulació només es veuen: sense gruixos, cantell ni veta (es conserven per si es canvia de categoria). */}
        {category.id !== "sim" && <>
        <FormRow label="Gruixos" help="Els que es poden triar a les peces d'aquest material.">
          <ThicknessChips value={m.thicknesses} onChange={(thicknesses) => onChange({ thicknesses })} label={false} />
        </FormRow>
        <FormRow label="Cantell">
          <Input size="sm" maxW="280px" value={m.edge} onChange={(e) => onChange({ edge: e.target.value })} placeholder="PVC blanc 1 mm" />
        </FormRow>
        <FormRow label="Veta" help="Té una direcció (fusta, xapa) que cal respectar en tallar.">
          <Switch.Root size="sm" pt={1.5} checked={m.hasGrain} onCheckedChange={(e) => onChange({ hasGrain: e.checked })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Té veta</Switch.Label>
          </Switch.Root>
        </FormRow>
        </>}
        <FormRow label="Categoria" help={category.hint}>
          <ChoiceChips<MaterialCategory>
            label="Categoria"
            options={MATERIAL_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
            value={category.id}
            onChange={(id) => {
              const next = withCategory(m, id)
              // Replaça tot el material: `forBacks` i `cnc` poden desaparèixer.
              onChange({ ...next, forBacks: next.forBacks, cnc: next.cnc, category: next.category })
            }}
          />
        </FormRow>
      </FormSection>
      {footer && <FormSection title="Per defecte als mòduls nous">{footer}</FormSection>}
      </Box>
      </Box>
    </>
  )
}

/**
 * Tria una foto del tauler (galeria o càmera al mòbil) i la redueix a 1024 px en JPEG, perquè
 * càpiga a les preferències sense ocupar massa. També en dona el color mitjà (STEP, mostres).
 */
async function pickTexture(): Promise<{ src: string; aspect: number; color?: string } | null> {
  const [p] = await pickFiles({ accept: "image/*" })
  if (!p) return null
  try {
    return await encodeMap(p.file, "color")
  } catch (e) {
    toaster.create({ title: "No s'ha pogut llegir la foto", description: e instanceof Error ? e.message : String(e), type: "error", duration: 8000 })
    return null
  }
}
