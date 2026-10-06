import { Alert, Badge, Box, HStack, IconButton, Input, Menu, SimpleGrid, Stack, Switch, Text } from "@chakra-ui/react"
import { useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { LuCopy, LuStar, LuTrash2 } from "react-icons/lu"
import { EditorDialog } from "../../components/EditorDialog"
import { FoldGroup, FoldItem } from "../../components/Fold"
import { FormRow, FormSection } from "../../components/FormRow"
import { NumberField, NumRow } from "../../components/NumRow"
import { PanelDrawing } from "../../components/PanelDrawing"
import { SearchBar } from "../../components/SearchBar"
import { useSessionList } from "../../components/sessionState"
import { featureCrop, hardwarePreview } from "../../core/build/hardwarePreview"
import {
  HARDWARE_CATEGORIES,
  HARDWARE_PARAMS,
  HARDWARE_SLOTS,
  copyHardwareItem,
  hardwareSummary,
  newId,
  slotForEngine,
  type HardwareDefaults,
  type HardwareEngine,
  type HardwareItem,
  type MachiningOp,
  type StepRule,
} from "../../core/model"
import { GalleryCard } from "../projects/GalleryCard"
import { GALLERY_COLS, fold } from "../projects/galleryGrid"
import { HARDWARE_ICONS } from "./hardwareIcons"
import { ThicknessChips } from "./MaterialBits"
import { PaneHeadContext } from "./paneHead"

/** Categories obertes (es recorden durant la sessió). */
const OPEN_KEY = "mobles:md-open:hardware"

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
}: {
  items: HardwareItem[]
  defaults: HardwareDefaults
  onChange: (items: HardwareItem[]) => void
  onDefaults: (d: HardwareDefaults) => void
  onDelete: (item: HardwareItem) => void
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
  const q = fold(query.trim())
  const groups = HARDWARE_CATEGORIES.map((c) => ({ ...c, items: items.filter((x) => x.category === c.id && (!q || fold(`${x.name} ${x.maker ?? ""} ${x.ref ?? ""}`).includes(q))) })).filter((g) => g.items.length)
  const defaultOf = (x: HardwareItem) => HARDWARE_SLOTS.find((s) => defaults[s.slot] === x.id)
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
            isDefault={defaults[slotForEngine(it.engine).slot] === it.id}
            onDefault={() => onDefaults({ ...defaults, [slotForEngine(it.engine).slot]: it.id })}
            onChange={(next) => onChange(items.map((x, k) => (k === i ? next : x)))}
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

/**
 * Dibuix del patró de mecanitzats (a l'esquerra de l'editor, a la columna gran a l'ordinador): una o dues peces d'exemple
 * amb els forats que hi fa el motor, vistes des de la cara A (els de cantell, discontinus; els passants, buits).
 */
function HardwareStage({ item }: { item: HardwareItem }) {
  const preview = useMemo(() => hardwarePreview(item), [item])
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
            <SimpleGrid key={p.id} columns={{ base: 1, md: crop ? 2 : 1 }} gap={3} bg="bg" rounded="lg" borderWidth="1px" p={{ base: 3, md: 4 }} alignItems="center">
              <PanelDrawing panel={p} />
              {crop && (
                <Stack gap={1}>
                  <Box rounded="md" borderWidth="1px" borderColor="border.muted" overflow="hidden">
                    <PanelDrawing panel={p} crop={crop} caption={false} dims />
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
        </Text>
      </Stack>
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
  isDefault,
  onDefault,
  onChange,
  onDuplicate,
  onDelete,
  autoFocusName,
}: {
  item: HardwareItem
  dirty: RefObject<boolean>
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
  const slot = slotForEngine(item.engine)
  const set = (patch: Partial<HardwareItem>) => onChange({ ...item, ...patch })
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
          <FormRow label="Tipus" help={`Fa de «${slot.label}»: ${slot.uses}. La regla de cada contingut decideix on va i quants se'n posen.`}>
            <Text fontSize="sm" pt="6px">
              {slot.label}
            </Text>
          </FormRow>
          <FormRow label="Fabricant">
            <Input size="sm" maxW="280px" value={item.maker ?? ""} onChange={(e) => setText("maker", e.target.value)} placeholder="Opcional" />
          </FormRow>
          <FormRow label="Referència">
            <Input size="sm" maxW="280px" value={item.ref ?? ""} onChange={(e) => setText("ref", e.target.value)} placeholder="Opcional" />
          </FormRow>
          <FormRow label="Per defecte" help={isDefault ? `És el que fan servir els mòduls nous (${slot.uses}). Per canviar-lo, fes per defecte un altre del mateix tipus.` : `Els mòduls nous faran servir aquest (${slot.uses}). Els mobles fets no canvien.`}>
            <Switch.Root size="sm" pt="6px" checked={isDefault} disabled={isDefault} onCheckedChange={(e) => e.checked && onDefault()}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Per defecte als mòduls nous</Switch.Label>
            </Switch.Root>
          </FormRow>
        </FormSection>

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
      </Box>
    </Box>
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

