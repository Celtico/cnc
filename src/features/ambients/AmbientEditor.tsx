import { Badge, Box, Button, CloseButton, Dialog, Drawer, Editable, Field, Flex, HStack, IconButton, Menu, NativeSelect, Portal, SegmentGroup, SimpleGrid, Slider, Stack, Switch, Text } from "@chakra-ui/react"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  LuArrowLeft,
  LuBox,
  LuBrickWall,
  LuCopy,
  LuExternalLink,
  LuImageUp,
  LuMap,
  LuMousePointer2,
  LuPencilRuler,
  LuPenTool,
  LuPlus,
  LuRedo2,
  LuRotate3D,
  LuRotateCcw,
  LuRotateCw,
  LuSofa,
  LuTrash2,
  LuUndo2,
  LuVideo,
} from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { Tooltip } from "../../components/ui/tooltip"
import {
  BLOCK_PRESETS,
  BlockShapeSchema,
  CompositionSchema,
  compositionKind,
  materialCategory,
  newId,
  parseAmbient,
  resizeComposition,
  wallLength,
  type Ambient,
  type AmbientItem,
  type BlockItem,
  type MaterialPref,
  type PlanPt,
  type Wall,
} from "../../core/model"
import { compositionOf, updateProjectComposition } from "../../db/compositionStore"
import { createProject, db, renameAmbient, updateAmbient, type Project } from "../../db/db"
import { uniqueName } from "../../core/file/mobleFile"
import { NewMobleGallery } from "../projects/NewMobleGallery"
import { ProjectCard } from "../projects/ProjectCard"
import { GALLERY_COLS } from "../projects/galleryGrid"
import { useAmbientMembership } from "./useAmbientMembership"
import { useLiveQuery } from "../../db/useLiveQuery"
import { NumberField } from "../editor/ParamsForm"
import { useSettings } from "../settings/SettingsContext"
import { formatLength, useUnit } from "../units"
import { useProjects } from "../useProject"
import { Ambient3D } from "./Ambient3D"
import { itemName, useItemGeometries, type ItemGeometry } from "./ambientData"
import { PlanCanvas } from "./PlanCanvas"
import { ambientBox, type Selection, type Tool } from "./planGeom"

const TOOLS: { id: Tool; label: string; key: string; icon: typeof LuPenTool }[] = [
  { id: "select", label: "Seleccionar i moure", key: "V", icon: LuMousePointer2 },
  { id: "wall", label: "Paret (ploma)", key: "P", icon: LuPenTool },
  { id: "room", label: "Habitació (rectangle)", key: "H", icon: LuBrickWall },
]

const SHAPE_LABEL: Record<BlockItem["shape"], string> = { box: "Caixa", sofa: "Sofà", bed: "Llit", table: "Taula" }

/**
 * Editor d'un ambient: el plànol (parets, plànol de fons, mobles i blocs) i la vista 3D. Els
 * mobles són els de la llista (enllaç): aquí només se'n toquen les mides generals i la posició.
 * Desfer/refer, i dreceres com a Figma: V · P · H, Supr, fletxes (Maj ×10), R (girar 90°),
 * Ctrl/⌘ D (duplicar), Ctrl/⌘ Z / Maj Z.
 */
export function AmbientEditor({ ambientId, onBack, onOpenProject }: { ambientId: number; onBack: () => void; onOpenProject: (id: number) => void }) {
  const row = useLiveQuery(() => db.ambients.get(ambientId), [ambientId])
  // Es llegeix un cop en obrir (després, la font de veritat és l'estat local, que es desa sol).
  if (!row) return null
  return <EditorInner key={ambientId} ambientId={ambientId} name={row.name} initial={parseAmbient(row.data)} onBack={onBack} onOpenProject={onOpenProject} />
}

function EditorInner({ ambientId, name, initial, onBack, onOpenProject }: { ambientId: number; name: string; initial: Ambient; onBack: () => void; onOpenProject: (id: number) => void }) {
  const { settings } = useSettings()
  const unit = useUnit()
  const projects = useProjects()
  const [amb, setAmbState] = useState<Ambient>(initial)
  const [sel, setSel] = useState<Selection>(null)
  const [tool, setTool] = useState<Tool>("select")
  const [tab, setTab] = useState<"plan" | "3d">("plan")
  const [fit, setFit] = useState(0)
  const [calib, setCalib] = useState<{ a: PlanPt; b: PlanPt } | null>(null)
  const [wallDefaults, setWallDefaults] = useState({ thickness: 100, height: 2600 })
  const [picker, setPicker] = useState(false)
  const membership = useAmbientMembership()
  const past = useRef<Ambient[]>([])
  const future = useRef<Ambient[]>([])
  const committed = useRef<Ambient>(initial)
  const [hist, setHist] = useState({ undo: 0, redo: 0 })
  const syncHist = () => setHist({ undo: past.current.length, redo: future.current.length })

  // Desar (esperant una mica mentre s'arrossega).
  useEffect(() => {
    const t = setTimeout(() => void updateAmbient(ambientId, { data: amb }), 350)
    return () => clearTimeout(t)
  }, [amb, ambientId])

  const change = useCallback((next: Ambient, commit: boolean) => {
    setAmbState(next)
    if (commit) {
      past.current = [...past.current.slice(-99), committed.current]
      future.current = []
      committed.current = next
      syncHist()
    }
  }, [])
  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(committed.current)
    committed.current = prev
    setAmbState(prev)
    syncHist()
  }, [])
  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(committed.current)
    committed.current = next
    setAmbState(next)
    syncHist()
  }, [])

  const geos = useItemGeometries(amb.items, projects)
  const names = useMemo(() => new Map(amb.items.map((it) => [it.id, itemName(it, projects)])), [amb.items, projects])
  const item = sel?.kind === "item" ? amb.items.find((i) => i.id === sel.id) : undefined
  const wall = sel?.kind === "wall" ? amb.walls.find((w) => w.id === sel.id) : undefined

  const center = (): PlanPt => {
    const b = ambientBox({ ...amb, items: [] }, geos)
    return b ? [Math.round((b.x0 + b.x1) / 2), Math.round((b.y0 + b.y1) / 2)] : [2000, 1500]
  }
  const addItem = (it: AmbientItem) => {
    change({ ...amb, items: [...amb.items, it] }, true)
    setSel({ kind: "item", id: it.id })
    setTool("select")
  }
  const addMoble = (p: Project) => {
    const [x, y] = center()
    addItem({ id: newId("i"), kind: "moble", projectId: p.id, x, y, rot: 0 })
  }
  const addBlock = (preset: (typeof BLOCK_PRESETS)[number]) => {
    const [x, y] = center()
    const { id: _id, ...rest } = preset
    addItem({ id: newId("i"), kind: "block", ...rest, x, y, rot: 0 })
  }
  const patchItem = (id: string, patch: Partial<AmbientItem>, commit = true) => change({ ...amb, items: amb.items.map((it) => (it.id === id ? ({ ...it, ...patch } as AmbientItem) : it)) }, commit)
  const patchWall = (id: string, patch: Partial<Wall>) => change({ ...amb, walls: amb.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)) }, true)
  const remove = () => {
    if (!sel) return
    if (sel.kind === "item") change({ ...amb, items: amb.items.filter((i) => i.id !== sel.id) }, true)
    else change({ ...amb, walls: amb.walls.filter((w) => w.id !== sel.id) }, true)
    setSel(null)
  }
  const duplicate = () => {
    if (!item) return
    const copy = { ...item, id: newId("i"), x: item.x + 200, y: item.y + 200 }
    addItem(copy)
  }

  // Dreceres de teclat.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable], [role=dialog]")) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault()
        duplicate()
        return
      }
      if (mod) return
      const k = e.key.toLowerCase()
      if (k === "v") setTool("select")
      else if (k === "p") setTool("wall")
      else if (k === "h") setTool("room")
      else if (k === "escape") {
        setTool("select")
        setSel(null)
      } else if ((k === "delete" || k === "backspace") && sel) {
        e.preventDefault()
        remove()
      } else if (k === "r" && item) patchItem(item.id, { rot: (item.rot + (e.shiftKey ? 270 : 90)) % 360 })
      else if (k.startsWith("arrow") && item) {
        e.preventDefault()
        const st = e.shiftKey ? 100 : 10
        const dx = k === "arrowleft" ? -st : k === "arrowright" ? st : 0
        const dy = k === "arrowup" ? -st : k === "arrowdown" ? st : 0
        patchItem(item.id, { x: item.x + dx, y: item.y + dy })
      }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  })

  const importPlan = async () => {
    const img = await pickPlanImage()
    if (!img) return
    const mmPerPx = 10
    change({ ...amb, plan: { src: img.src, pxW: img.w, pxH: img.h, mmPerPx, x: 0, y: 0, opacity: 0.6, locked: true } }, true)
    setFit((n) => n + 1)
    setTab("plan")
    setTool("calibrate")
    toaster.create({ title: "Plànol importat", description: "Ara marca dos punts d'una mida coneguda (una paret, una porta) per posar-lo a escala.", type: "info", duration: 8000 })
  }

  const applyCalibration = (real: number) => {
    if (!calib || !amb.plan) return
    const cur = Math.hypot(calib.b[0] - calib.a[0], calib.b[1] - calib.a[1])
    if (cur < 1 || !(real > 0)) return
    const p = amb.plan
    const k = real / cur
    const mmPerPx = p.mmPerPx * k
    // El primer punt es queda on era.
    const ax = (calib.a[0] - p.x) / p.mmPerPx, ay = (calib.a[1] - p.y) / p.mmPerPx
    change({ ...amb, plan: { ...p, mmPerPx, x: Math.round(calib.a[0] - ax * mmPerPx), y: Math.round(calib.a[1] - ay * mmPerPx) } }, true)
    setCalib(null)
    setTool("select")
    setFit((n) => n + 1)
  }

  const simMaterials = settings.materials
  const toolDone = useCallback(() => setTool("select"), [])

  return (
    <Flex direction="column" flex={1} minH={0} gap={2}>
      {/* Capçalera: «Ambients › nom», desfer/refer i pestanyes Plànol · 3D. */}
      <HStack gap={2} flexShrink={0} minW={0}>
        <IconButton aria-label="Tornar als ambients" size="sm" variant="ghost" onClick={onBack}>
          <LuArrowLeft />
        </IconButton>
        <Text color="fg.muted" display={{ base: "none", md: "block" }} cursor="pointer" onClick={onBack}>
          Ambients ›
        </Text>
        <Editable.Root defaultValue={name} onValueCommit={(e) => void renameAmbient(ambientId, e.value)} fontWeight="semibold" minW={0} flex={1} maxW="360px" aria-label="Nom de l'ambient">
          <Editable.Preview truncate title="Clica per canviar el nom" />
          <Editable.Input />
        </Editable.Root>
        <HStack gap={0} ms="auto">
          <Tooltip content="Desfer (Ctrl/⌘ Z)">
            <IconButton aria-label="Desfer" size="sm" variant="ghost" disabled={!hist.undo} onClick={undo}>
              <LuUndo2 />
            </IconButton>
          </Tooltip>
          <Tooltip content="Refer (Maj Ctrl/⌘ Z)">
            <IconButton aria-label="Refer" size="sm" variant="ghost" disabled={!hist.redo} onClick={redo}>
              <LuRedo2 />
            </IconButton>
          </Tooltip>
        </HStack>
        <SegmentGroup.Root size="sm" value={tab} onValueChange={(e) => e.value && setTab(e.value as "plan" | "3d")}>
          <SegmentGroup.Indicator />
          <SegmentGroup.Item value="plan" aria-label="Plànol">
            <SegmentGroup.ItemText>
              <HStack gap={1.5}>
                <LuMap />
                <Box as="span" display={{ base: "none", sm: "inline" }}>
                  Plànol
                </Box>
              </HStack>
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
          <SegmentGroup.Item value="3d" aria-label="3D">
            <SegmentGroup.ItemText>
              <HStack gap={1.5}>
                <LuRotate3D />
                <Box as="span" display={{ base: "none", sm: "inline" }}>
                  3D
                </Box>
              </HStack>
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        </SegmentGroup.Root>
      </HStack>

      <Flex direction={{ base: "column", md: "row" }} flex={1} minH={0} gap={3}>
        {/* Esquerra: eines, afegir i llista d'elements. */}
        <Stack w={{ base: "full", md: "240px" }} flexShrink={0} gap={3} overflowY={{ md: "auto" }} order={{ base: 1, md: 0 }}>
          <HStack gap={1} wrap="wrap">
            {TOOLS.map((t) => (
              <Tooltip key={t.id} content={`${t.label} (${t.key})`}>
                <IconButton aria-label={t.label} size="sm" variant={tool === t.id ? "solid" : "outline"} colorPalette={tool === t.id ? "wood" : undefined} onClick={() => (setTab("plan"), setTool(t.id))}>
                  <t.icon />
                </IconButton>
              </Tooltip>
            ))}
            <Tooltip content="Encabir el plànol">
              <IconButton aria-label="Encabir el plànol" size="sm" variant="outline" onClick={() => setFit((n) => n + 1)}>
                <LuVideo />
              </IconButton>
            </Tooltip>
          </HStack>
          <HStack gap={2}>
            <Button size="sm" colorPalette="wood" flex={1} onClick={() => setPicker(true)}>
              <LuBox /> Moble
            </Button>
            <Menu.Root positioning={{ placement: "bottom-start" }}>
              <Menu.Trigger asChild>
                <Button size="sm" variant="outline" flex={1}>
                  <LuSofa /> Bloc
                </Button>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content maxH="60vh" overflowY="auto">
                    {BLOCK_PRESETS.map((b) => (
                      <Menu.Item key={b.id} value={b.id} onClick={() => addBlock(b)}>
                        {b.name}
                        <Text as="span" ms="auto" ps={3} fontSize="xs" color="fg.muted">
                          {b.w} × {b.d}
                        </Text>
                      </Menu.Item>
                    ))}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </HStack>

          <Stack gap={0.5}>
            <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
              Elements
            </Text>
            {amb.items.length === 0 && (
              <Text fontSize="sm" color="fg.muted">
                Dibuixa les parets (P o H) i afegeix-hi mobles i blocs.
              </Text>
            )}
            {amb.items.map((it) => {
              const g = geos.get(it.id)
              const active = sel?.kind === "item" && sel.id === it.id
              return (
                <HStack
                  key={it.id}
                  as="button"
                  gap={2}
                  px={2}
                  py={1.5}
                  rounded="md"
                  textAlign="left"
                  bg={active ? "wood.subtle" : undefined}
                  _hover={{ bg: active ? "wood.subtle" : "bg.muted" }}
                  onClick={() => (setSel({ kind: "item", id: it.id }), setTool("select"))}
                >
                  <Box color={it.kind === "moble" ? "wood.fg" : "fg.muted"}>{it.kind === "moble" ? <LuBox /> : <LuSofa />}</Box>
                  <Text fontSize="sm" truncate flex={1}>
                    {names.get(it.id)}
                  </Text>
                  {g && (
                    <Text fontSize="xs" color="fg.muted" flexShrink={0}>
                      {Math.round(g.w)} × {Math.round(g.d)}
                    </Text>
                  )}
                </HStack>
              )
            })}
            {amb.walls.length > 0 && (
              <Text fontSize="xs" color="fg.muted" mt={2}>
                {amb.walls.length} {amb.walls.length === 1 ? "paret" : "parets"} · {formatLength(Math.round(amb.walls.reduce((n, w) => n + wallLength(w), 0)), unit)}
              </Text>
            )}
          </Stack>
        </Stack>

        {/* Centre: plànol o 3D. */}
        <Box flex={1} minW={0} minH={{ base: "56vh", md: 0 }} h={{ base: "56vh", md: "auto" }} position="relative" order={{ base: 0, md: 1 }}>
          {tab === "plan" ? (
            <PlanCanvas
              ambient={amb}
              geos={geos}
              names={names}
              selection={sel}
              onSelect={setSel}
              tool={tool}
              onToolDone={toolDone}
              onChange={change}
              wallDefaults={wallDefaults}
              onCalibrate={(a, b) => setCalib({ a, b })}
              fitSignal={fit}
            />
          ) : (
            <Box position="absolute" inset={0} rounded="md" overflow="hidden" borderWidth="1px">
              <Ambient3D ambient={amb} geos={geos} materials={settings.materials} />
            </Box>
          )}
          {tab === "plan" && tool !== "select" && (
            <Badge position="absolute" top={3} left="50%" transform="translateX(-50%)" colorPalette="wood" size="md" pointerEvents="none">
              {tool === "wall" ? "Paret: clica punt a punt · clica el primer per tancar · Retorn o Esc per acabar" : tool === "room" ? "Habitació: arrossega un rectangle" : "Calibrar: clica dos punts d'una mida coneguda"}
            </Badge>
          )}
        </Box>

        {/* Dreta: propietats de la selecció (o de l'ambient). */}
        <Stack w={{ base: "full", md: "320px" }} flexShrink={0} gap={4} overflowY={{ md: "auto" }} order={{ base: 2, md: 2 }} pb={2}>
          {item ? (
            <ItemInspector
              key={item.id}
              item={item}
              geo={geos.get(item.id) ?? null}
              name={names.get(item.id) ?? ""}
              project={item.kind === "moble" ? projects?.find((p) => p.id === item.projectId) : undefined}
              materials={simMaterials}
              onPatch={(p) => patchItem(item.id, p)}
              onOpen={() => item.kind === "moble" && onOpenProject(item.projectId)}
              onDuplicate={duplicate}
              onDelete={remove}
            />
          ) : wall ? (
            <WallInspector key={wall.id} wall={wall} onPatch={(p) => patchWall(wall.id, p)} onDelete={remove} />
          ) : (
            <AmbientInspector
              amb={amb}
              materials={simMaterials}
              wallDefaults={wallDefaults}
              onWallDefaults={setWallDefaults}
              onChange={(a) => change(a, true)}
              onImportPlan={() => void importPlan()}
              onCalibrate={() => (setTab("plan"), setTool("calibrate"))}
            />
          )}
        </Stack>
      </Flex>

      {/* Afegir un moble: la mateixa pàgina de Mobles (historial i plantilles) a pantalla completa. */}
      <Drawer.Root open={picker} onOpenChange={(e) => setPicker(e.open)} size="full" placement="bottom">
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>Afegir un moble a «{name}»</Drawer.Title>
                <Drawer.CloseTrigger asChild>
                  <CloseButton size="sm" aria-label="Tancar" />
                </Drawer.CloseTrigger>
              </Drawer.Header>
              <Drawer.Body>
                {picker && (
                  <NewMobleGallery
                    storageKey="mobles:ambient-picker"
                    onCreate={(c, n) =>
                      void (async () => {
                        const existing = (await db.projects.toArray()).map((p) => p.name)
                        const id = await createProject(uniqueName(n, existing), undefined, { composition: c })
                        const p = await db.projects.get(id)
                        if (p) addMoble(p)
                        setPicker(false)
                        toaster.create({ title: `«${p?.name ?? n}» afegit`, description: "S'ha creat a Mobles i s'ha col·locat a l'ambient.", type: "success" })
                      })()
                    }
                    history={(kind, matches) => {
                      const shown = (projects ?? []).filter((p) => (kind === "all" || compositionKind(compositionOf(p)) === kind) && matches(p.name))
                      return {
                        count: shown.length,
                        node: shown.length ? (
                          <SimpleGrid columns={GALLERY_COLS} gap={3}>
                            {shown.map((p) => (
                              <ProjectCard key={p.id} project={p} ambients={membership.get(p.id)} currentAmbient={ambientId} onAdd={() => (addMoble(p), setPicker(false))} />
                            ))}
                          </SimpleGrid>
                        ) : (
                          <Text fontSize="sm" color="fg.muted">
                            {projects?.length ? "Cap moble no coincideix amb el tipus o la cerca." : "Encara no tens cap moble: comença en blanc o des d'una plantilla."}
                          </Text>
                        ),
                      }
                    }}
                  />
                )}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      <CalibrateDialog open={calib !== null} measured={calib ? Math.hypot(calib.b[0] - calib.a[0], calib.b[1] - calib.a[1]) : 0} onClose={() => (setCalib(null), setTool("select"))} onApply={applyCalibration} />
    </Flex>
  )
}

// --- Inspectors ------------------------------------------------------------------------------

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
      {children}
    </Text>
  )
}

function MaterialPick({ label, value, materials, onChange, onlySim }: { label: string; value: string; materials: MaterialPref[]; onChange: (v: string) => void; onlySim?: boolean }) {
  const list = onlySim ? materials.filter((m) => materialCategory(m) === "sim") : materials
  const known = list.some((m) => m.name === value)
  return (
    <Field.Root>
      <Field.Label fontSize="sm">{label}</Field.Label>
      <NativeSelect.Root size="sm">
        <NativeSelect.Field value={value} onChange={(e) => onChange(e.target.value)}>
          {!known && <option value={value}>{value}</option>}
          {(["sim", "board", "hard", "back"] as const).map((c) => {
            const ms = list.filter((m) => materialCategory(m) === c)
            return ms.length ? (
              <optgroup key={c} label={{ sim: "Simulació", board: "Taulers", hard: "Metall, pedra i vidre", back: "Fons" }[c]}>
                {ms.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ) : null
          })}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field.Root>
  )
}

function Placement({ item, onPatch }: { item: AmbientItem; onPatch: (p: Partial<AmbientItem>) => void }) {
  return (
    <Stack gap={2}>
      <SectionTitle>Posició</SectionTitle>
      <SimpleGrid columns={2} gap={2}>
        <NumberField label="X (centre)" value={item.x} step={10} onChange={(x) => Number.isFinite(x) && onPatch({ x })} />
        <NumberField label="Y (centre)" value={item.y} step={10} onChange={(y) => Number.isFinite(y) && onPatch({ y })} />
        <NumberField label="Gir" suffix="°" value={item.rot} step={15} onChange={(rot) => Number.isFinite(rot) && onPatch({ rot: ((rot % 360) + 360) % 360 })} />
        <NumberField label="Del terra" value={item.elevation ?? 0} min={0} step={10} onChange={(elevation) => Number.isFinite(elevation) && onPatch({ elevation: elevation || undefined })} />
      </SimpleGrid>
      <HStack gap={2}>
        <Button size="xs" variant="outline" onClick={() => onPatch({ rot: (item.rot + 270) % 360 })}>
          <LuRotateCcw /> −90°
        </Button>
        <Button size="xs" variant="outline" onClick={() => onPatch({ rot: (item.rot + 90) % 360 })}>
          <LuRotateCw /> +90° (R)
        </Button>
      </HStack>
    </Stack>
  )
}

function ItemInspector({
  item,
  geo,
  name,
  project,
  materials,
  onPatch,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  item: AmbientItem
  geo: ItemGeometry | null
  name: string
  project?: Project
  materials: MaterialPref[]
  onPatch: (p: Partial<AmbientItem>) => void
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <Stack gap={4}>
      <HStack gap={2}>
        <Box color={item.kind === "moble" ? "wood.fg" : "fg.muted"}>{item.kind === "moble" ? <LuBox /> : <LuSofa />}</Box>
        {item.kind === "block" ? (
          <Editable.Root value={item.name} onValueChange={(e) => onPatch({ name: e.value })} fontWeight="semibold" flex={1} minW={0} aria-label="Nom del bloc">
            <Editable.Preview truncate />
            <Editable.Input />
          </Editable.Root>
        ) : (
          <Text fontWeight="semibold" truncate flex={1}>
            {name}
          </Text>
        )}
        <Tooltip content="Duplicar (Ctrl/⌘ D)">
          <IconButton aria-label="Duplicar" size="xs" variant="ghost" onClick={onDuplicate}>
            <LuCopy />
          </IconButton>
        </Tooltip>
        <Tooltip content="Treure de l'ambient (Supr)">
          <IconButton aria-label="Treure de l'ambient" size="xs" variant="ghost" colorPalette="red" onClick={onDelete}>
            <LuTrash2 />
          </IconButton>
        </Tooltip>
      </HStack>

      {item.kind === "moble" ? (
        project && geo ? (
          <>
            <MobleDims project={project} geo={geo} />
            <Button size="sm" variant="outline" onClick={onOpen}>
              <LuExternalLink /> Obrir a l'editor
            </Button>
          </>
        ) : (
          <Text fontSize="sm" color="fg.error">
            Aquest moble s'ha esborrat de la llista.
          </Text>
        )
      ) : (
        <Stack gap={2}>
          <SectionTitle>Bloc</SectionTitle>
          <Field.Root>
            <Field.Label fontSize="sm">Forma</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field value={item.shape} onChange={(e) => onPatch({ shape: e.target.value as BlockItem["shape"] })}>
                {BlockShapeSchema.options.map((s) => (
                  <option key={s} value={s}>
                    {SHAPE_LABEL[s]}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          <SimpleGrid columns={3} gap={2}>
            <NumberField label="Ample" value={item.w} min={10} step={10} onChange={(w) => w >= 10 && onPatch({ w })} />
            <NumberField label="Alt" value={item.h} min={5} step={10} onChange={(h) => h >= 5 && onPatch({ h })} />
            <NumberField label="Fons" value={item.d} min={10} step={10} onChange={(d) => d >= 10 && onPatch({ d })} />
          </SimpleGrid>
          <MaterialPick label="Material" value={item.material} materials={materials} onChange={(material) => onPatch({ material })} />
          {(item.shape === "bed" || item.shape === "sofa") && (
            <MaterialPick label={item.shape === "bed" ? "Matalàs" : "Coixins"} value={item.material2 ?? item.material} materials={materials} onChange={(material2) => onPatch({ material2 })} onlySim />
          )}
          <Text fontSize="xs" color="fg.muted">
            Els blocs només es veuen: no es fabriquen ni surten a les peces.
          </Text>
        </Stack>
      )}
      <Placement item={item} onPatch={onPatch} />
    </Stack>
  )
}

/**
 * Mides generals d'un moble: s'escriuen i s'apliquen amb «Aplicar» (o Retorn); el moble de la
 * llista canvia (l'enllaç és el mateix moble), amb la distribució escalada.
 */
function MobleDims({ project, geo }: { project: Project; geo: ItemGeometry }) {
  const cur = { w: Math.round(geo.w), h: Math.round(geo.h), d: Math.round(geo.d) }
  const [draft, setDraft] = useState(cur)
  const key = `${cur.w}|${cur.h}|${cur.d}`
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setDraft(cur)
  }
  const dirty = draft.w !== cur.w || draft.h !== cur.h || draft.d !== cur.d
  const apply = async () => {
    if (!dirty || !(draft.w >= 100 && draft.h >= 100 && draft.d >= 100)) return
    const next = resizeComposition(compositionOf(project), cur, draft)
    const ok = CompositionSchema.safeParse(next)
    if (!ok.success) {
      toaster.create({ title: "No s'ha pogut canviar la mida", description: "Amb aquestes mides alguna part del moble queda fora de límits. Prova-ho a l'editor.", type: "error" })
      return
    }
    await updateProjectComposition(project.id, next)
  }
  return (
    <Stack gap={2} onKeyDown={(e) => e.key === "Enter" && void apply()}>
      <SectionTitle>Mides generals</SectionTitle>
      <SimpleGrid columns={3} gap={2}>
        <NumberField label="Ample" value={draft.w} min={100} step={10} onChange={(w) => setDraft({ ...draft, w })} />
        <NumberField label="Alt" value={draft.h} min={100} step={10} onChange={(h) => setDraft({ ...draft, h })} />
        <NumberField label="Fons" value={draft.d} min={100} step={10} onChange={(d) => setDraft({ ...draft, d })} />
      </SimpleGrid>
      {dirty && (
        <HStack gap={2}>
          <Button size="xs" colorPalette="wood" onClick={() => void apply()}>
            Aplicar les mides
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setDraft(cur)}>
            Desfer
          </Button>
        </HStack>
      )}
      <Text fontSize="xs" color="fg.muted">
        És el mateix moble de la llista: canviar-ne les mides el canvia a tot arreu. L'interior (compartiments, portes, calaixos) es toca a l'editor.
      </Text>
    </Stack>
  )
}

function WallInspector({ wall, onPatch, onDelete }: { wall: Wall; onPatch: (p: Partial<Wall>) => void; onDelete: () => void }) {
  const L = Math.round(wallLength(wall))
  return (
    <Stack gap={3}>
      <HStack>
        <Box color="fg.muted">
          <LuBrickWall />
        </Box>
        <Text fontWeight="semibold" flex={1}>
          Paret
        </Text>
        <IconButton aria-label="Eliminar la paret" size="xs" variant="ghost" colorPalette="red" onClick={onDelete}>
          <LuTrash2 />
        </IconButton>
      </HStack>
      <SimpleGrid columns={3} gap={2}>
        <NumberField
          label="Llarg"
          value={L}
          min={50}
          step={10}
          onChange={(len) => {
            if (!(len >= 50) || L < 1) return
            // S'allarga cap al final (b), en la mateixa direcció.
            const k = len / L
            onPatch({ b: [Math.round(wall.a[0] + (wall.b[0] - wall.a[0]) * k), Math.round(wall.a[1] + (wall.b[1] - wall.a[1]) * k)] })
          }}
        />
        <NumberField label="Gruix" value={wall.thickness} min={20} max={1000} step={10} onChange={(thickness) => thickness >= 20 && onPatch({ thickness })} />
        <NumberField label="Alt" value={wall.height} min={200} max={10000} step={10} onChange={(height) => height >= 200 && onPatch({ height })} />
      </SimpleGrid>
      <Text fontSize="xs" color="fg.muted">
        Arrossega-la per moure-la (les parets enganxades la segueixen) o arrossega'n els extrems. Maj: sense angles · Alt: sense imant.
      </Text>
    </Stack>
  )
}

function AmbientInspector({
  amb,
  materials,
  wallDefaults,
  onWallDefaults,
  onChange,
  onImportPlan,
  onCalibrate,
}: {
  amb: Ambient
  materials: MaterialPref[]
  wallDefaults: { thickness: number; height: number }
  onWallDefaults: (v: { thickness: number; height: number }) => void
  onChange: (a: Ambient) => void
  onImportPlan: () => void
  onCalibrate: () => void
}) {
  const plan = amb.plan
  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <SectionTitle>Parets noves</SectionTitle>
        <SimpleGrid columns={2} gap={2}>
          <NumberField label="Gruix" value={wallDefaults.thickness} min={20} max={1000} step={10} onChange={(thickness) => thickness >= 20 && onWallDefaults({ ...wallDefaults, thickness })} />
          <NumberField label="Alçada" value={wallDefaults.height} min={200} max={10000} step={10} onChange={(height) => height >= 200 && onWallDefaults({ ...wallDefaults, height })} />
        </SimpleGrid>
      </Stack>

      <Stack gap={2}>
        <SectionTitle>Acabats</SectionTitle>
        <MaterialPick label="Terra" value={amb.floorMaterial ?? "Parquet de roure"} materials={materials} onChange={(floorMaterial) => onChange({ ...amb, floorMaterial })} onlySim />
        <MaterialPick label="Parets" value={amb.wallMaterial ?? "Pintura blanca"} materials={materials} onChange={(wallMaterial) => onChange({ ...amb, wallMaterial })} onlySim />
      </Stack>

      <Stack gap={2}>
        <SectionTitle>Plànol de fons</SectionTitle>
        {plan ? (
          <>
            <HStack gap={3}>
              <Box w="72px" h="52px" rounded="sm" borderWidth="1px" bgImage={`url(${plan.src})`} bgSize="cover" backgroundPosition="center" flexShrink={0} />
              <Text fontSize="xs" color="fg.muted">
                {Math.round((plan.pxW * plan.mmPerPx) / 10) / 100} × {Math.round((plan.pxH * plan.mmPerPx) / 10) / 100} m
              </Text>
            </HStack>
            <HStack gap={2} wrap="wrap">
              <Button size="xs" variant="outline" onClick={onCalibrate}>
                <LuPencilRuler /> Calibrar
              </Button>
              <Button size="xs" variant="outline" onClick={onImportPlan}>
                <LuImageUp /> Canviar
              </Button>
              <Button size="xs" variant="ghost" colorPalette="red" onClick={() => onChange({ ...amb, plan: undefined })}>
                <LuTrash2 /> Treure'l
              </Button>
            </HStack>
            <Field.Root>
              <Field.Label fontSize="sm">Opacitat</Field.Label>
              <Slider.Root size="sm" w="full" min={0.1} max={1} step={0.05} value={[plan.opacity]} onValueChange={(e) => onChange({ ...amb, plan: { ...plan, opacity: e.value[0]! } })}>
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumbs />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <Switch.Root size="sm" checked={plan.locked !== false} onCheckedChange={(e) => onChange({ ...amb, plan: { ...plan, locked: e.checked } })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label>Bloquejat (desbloquejat, s'arrossega)</Switch.Label>
            </Switch.Root>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" alignSelf="flex-start" onClick={onImportPlan}>
              <LuImageUp /> Posar un plànol (imatge)
            </Button>
            <Text fontSize="xs" color="fg.muted">
              Una foto o captura del plànol de la casa. Després marques dos punts d'una mida coneguda i queda a escala; a sobre hi dibuixes les parets.
            </Text>
          </>
        )}
      </Stack>
      <Text fontSize="xs" color="fg.muted">
        <LuPlus style={{ display: "inline" }} /> Afegeix mobles i blocs des de l'esquerra. Selecciona'ls per moure'ls, girar-los (R) o canviar-ne les mides.
      </Text>
    </Stack>
  )
}

function CalibrateDialog({ open, measured, onClose, onApply }: { open: boolean; measured: number; onClose: () => void; onApply: (real: number) => void }) {
  const [real, setReal] = useState(1000)
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="xs">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Mida real</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                <Text fontSize="sm" color="fg.muted">
                  Ara fa {Math.round(measured)} mm al plànol. Quant fa de debò?
                </Text>
                <NumberField label="Distància real" value={real} min={10} step={10} onChange={setReal} />
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
              <Button colorPalette="wood" onClick={() => onApply(real)}>
                Posar a escala
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

/** Tria una imatge de plànol i la redueix (2400 px de costat llarg, JPEG). */
function pickPlanImage(): Promise<{ src: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const k = Math.min(1, 2400 / Math.max(img.width, img.height))
        const c = document.createElement("canvas")
        c.width = Math.round(img.width * k)
        c.height = Math.round(img.height * k)
        const g = c.getContext("2d")!
        g.fillStyle = "#ffffff"
        g.fillRect(0, 0, c.width, c.height)
        g.drawImage(img, 0, 0, c.width, c.height)
        URL.revokeObjectURL(url)
        resolve({ src: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.src = url
    }
    input.click()
  })
}
