import { Alert, Badge, Box, Button, Editable, Flex, HStack, IconButton, Input, Menu, Portal, SegmentGroup, Stack, Text } from "@chakra-ui/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  LuBookmark,
  LuBox,
  LuCamera,
  LuCircleDot,
  LuDoorOpen,
  LuExpand,
  LuHammer,
  LuLayoutDashboard,
  LuLayoutPanelLeft,
  LuLayoutTemplate,
  LuMaximize2,
  LuMinimize2,
  LuMoveDiagonal,
  LuRedo2,
  LuRotate3D,
  LuSave,
  LuShrink,
  LuTriangleAlert,
  LuUndo2, LuScan } from "react-icons/lu"
import { PanelGroup, PanelSection, usePanelGroup } from "../../components/PanelSection"
import { ResizeHandle } from "../../components/ResizeHandle"
import { toaster } from "../../components/ui/toaster"
import { CabinetViewer, type ViewerModule, type ZoneLight } from "../../components/viewer/CabinetViewer"
import { movingGroups, openingCollisions } from "../../components/viewer/opening"
import { panelBox } from "../../core/build/buildComposition"
import { downloadBlob, slugify } from "../download"
import { ViewBar, ViewerControls, type ViewerState } from "./ViewerControls"
import { BUILTIN_TEMPLATES, applySettingsToModule, compositionWidth, defaultModule, findZone, newId, type Composition, type Module } from "../../core/model"
import { useSettings } from "../settings/SettingsContext"
import { loadUserTemplates, saveUserTemplate, updateProjectComposition } from "../../db/compositionStore"
import { renameProject } from "../../db/db"
import { CarcassForm, JoineryForm } from "../composition/CarcassForm"
import { ElevationEditor } from "../composition/ElevationEditor"
import { ModuleStrip, ReferencesEditor } from "../composition/ModuleStrip"
import { ZonePanel } from "../composition/ZonePanel"
import { SaveFileDialog } from "../file/SaveFileDialog"
import { PhotoScreen } from "../photo/PhotoScreen"
import { ESTIMATED_WARNING, estimatedApplied } from "../photo/appliedState"
import type { Project } from "../../db/db"
import { usePersistentFlag } from "../usePersistentFlag"
import { usePersistentNumber } from "../usePersistentNumber"
import { useComposition, useCompositionBuild, useProject } from "../useProject"

export function EditorScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  const initial = useComposition(project)
  if (!project || !initial) return null
  return <Editor key={project.id} projectId={project.id} name={project.name} initial={initial} project={project} />
}

interface History {
  past: Composition[]
  present: Composition
  future: Composition[]
}

/** Símbol de la tecla de drecera: ⌘ al Mac/iPad, Ctrl a la resta. */
const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl+"

function Editor({ projectId, name, initial, project }: { projectId: number; name: string; initial: Composition; project: Project }) {
  const [saveOpen, setSaveOpen] = useState(false)
  // Composició amb desfer/refer (fins a 50 passos).
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] })
  const comp = history.present
  // Canvis seguits (menys de 500 ms entre ells, p. ex. escriure "1180" o arrossegar)
  // compten com un sol pas de desfer.
  const lastEdit = useRef(0)
  const setComp = (next: Composition | ((c: Composition) => Composition)) =>
    setHistory((h) => {
      const n = typeof next === "function" ? next(h.present) : next
      if (n === h.present) return h
      const now = Date.now()
      const coalesce = now - lastEdit.current < 500 && h.past.length > 0
      lastEdit.current = now
      if (coalesce) return { past: h.past, present: n, future: [] }
      return { past: [...h.past.slice(-49), h.present], present: n, future: [] }
    })
  const undo = () => {
    lastEdit.current = 0
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h))
  }
  const redo = () => {
    lastEdit.current = 0
    setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) } : h))
  }

  // Dreceres: ⌘Z / Ctrl+Z desfer; ⇧⌘Z / Ctrl+Shift+Z / Ctrl+Y refer. Als camps de text
  // lliure (nom del moble, plantilla) es deixa el desfer propi del navegador; als
  // numèrics es desfà el moble.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const k = e.key.toLowerCase()
      if (k !== "z" && k !== "y") return
      const t = e.target as HTMLElement | null
      if (t) {
        const tag = t.tagName
        const numeric = tag === "INPUT" && /decimal|numeric/.test((t as HTMLInputElement).inputMode)
        if (tag === "TEXTAREA" || t.isContentEditable || (tag === "INPUT" && !numeric)) return
      }
      e.preventDefault()
      if (k === "y" || e.shiftKey) redo()
      else undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [selectedModule, setSelectedModule] = useState<string>(initial.modules[0]!.id)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [exploded, setExploded] = useState(false)
  const [showHoles, setShowHoles] = useState(false)
  // Visor: vista, obertura de portes i calaixos, colors.
  const [roleColors, setRoleColors] = usePersistentFlag("mobles:viewer-role-colors")
  const [viewer, setViewerState] = useState<Omit<ViewerState, "materialMode">>({ view: "3d", opening: 0, openOnlySelected: false })
  const viewerState: ViewerState = { ...viewer, materialMode: roleColors ? "role" : "material" }
  const setViewer = (patch: Partial<ViewerState>) => {
    const { materialMode, ...rest } = patch
    if (materialMode) setRoleColors(materialMode === "role")
    if (Object.keys(rest).length) setViewerState((v) => ({ ...v, ...rest }))
  }
  const capture = useRef<(() => Promise<Blob>) | null>(null)
  const registerCapture = useCallback((fn: () => Promise<Blob>) => {
    capture.current = fn
  }, [])
  // Amaga el panell de paràmetres perquè el 3D ocupi tot l'espai.
  const [formHidden, setFormHidden] = usePersistentFlag("mobles:editor-form-hidden")
  const [formWidth, setFormWidth] = usePersistentNumber("mobles:editor-form-width", 380)
  // Pestanya del visor: la composició en 3D o superposada a la foto del lloc.
  const [photoTab, setPhotoTab] = usePersistentFlag("mobles:editor-tab-photo")
  // Contenidor del panell esquerre on la pestanya Foto hi pinta els seus controls.
  const [photoControls, setPhotoControls] = useState<HTMLDivElement | null>(null)
  // En triar la pestanya Foto s'obre la secció "Adaptar mides a la imatge" (i es tanquen les altres).
  const [openPhotoSection, setOpenPhotoSection] = useState(0)
  const showPhotoTab = (on: boolean) => {
    setPhotoTab(on)
    if (on) setOpenPhotoSection((n) => n + 1)
  }
  const [templateName, setTemplateName] = useState("")
  const [userTemplates, setUserTemplates] = useState(loadUserTemplates)
  const { settings } = useSettings()

  const build = useCompositionBuild(comp)
  const panels = build?.panels ?? []

  // Desa amb retard quan la composició canvia. Si se surt de l'Editor (o es tanca
  // l'app) abans del retard, el canvi pendent es desa igualment: si no, Exportar
  // llegiria la versió anterior.
  const pendingSave = useRef<Composition | null>(null)
  useEffect(() => {
    if (comp === initial) return
    pendingSave.current = comp
    const t = setTimeout(() => {
      pendingSave.current = null
      void updateProjectComposition(projectId, comp)
    }, 350)
    return () => clearTimeout(t)
  }, [comp, projectId, initial])
  useEffect(() => {
    const flush = () => {
      const c = pendingSave.current
      if (!c) return
      pendingSave.current = null
      void updateProjectComposition(projectId, c)
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") flush()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", flush)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", flush)
      flush() // en sortir de l'Editor
    }
  }, [projectId])

  const module: Module = comp.modules.find((m) => m.id === selectedModule) ?? comp.modules[0]!
  const moduleIndex = comp.modules.indexOf(module)
  const moduleBuild = build?.modules[moduleIndex]?.build
  const zone = selectedZone ? findZone(module.root, selectedZone) : undefined

  const size = useMemo(() => {
    let h = 0
    let d = 0
    for (const m of comp.modules) {
      const legs = m.carcass.base.kind === "legs" ? m.carcass.base.height : 0
      h = Math.max(h, m.carcass.height + legs)
      d = Math.max(d, m.carcass.depth + m.carcass.thickness)
    }
    for (const g of comp.references) {
      h = Math.max(h, g.y + g.h)
      d = Math.max(d, g.z + g.d)
    }
    return { width: Math.max(compositionWidth(comp), ...comp.references.map((g) => g.x + g.w)), height: h, depth: d }
  }, [comp])

  const viewerModules: ViewerModule[] = useMemo(
    () =>
      (build?.modules ?? []).map((m) => {
        const c = comp.modules[m.index - 1]!.carcass
        return { id: m.id, index: m.index, x: m.x, y: m.y, width: c.width, height: c.height, depth: c.depth + c.thickness }
      }),
    [build, comp],
  )

  const updateModule = (m: Module) => setComp((c) => ({ ...c, modules: c.modules.map((x) => (x.id === m.id ? m : x)) }))

  const selectModule = (id: string) => {
    setSelectedModule(id)
    setSelectedZone(null)
  }

  /** Enganxa un mòdul nou al costat del seleccionat, amb la mateixa alçada i fondària. */
  const addModuleBeside = (side: "left" | "right") => {
    const fresh = applySettingsToModule(settings, defaultModule(newId("m"), `Mòdul ${comp.modules.length + 1}`))
    const m: Module = {
      ...fresh,
      carcass: {
        ...fresh.carcass,
        width: 600,
        height: module.carcass.height,
        depth: module.carcass.depth,
        material: module.carcass.material,
        thickness: module.carcass.thickness,
        base: module.carcass.base,
        back: module.carcass.back,
      },
    }
    const modules = [...comp.modules]
    modules.splice(side === "left" ? moduleIndex : moduleIndex + 1, 0, { ...m, gapBefore: 0 })
    setComp({ ...comp, modules })
    selectModule(m.id)
  }

  const applyTemplate = (make: () => Composition) => {
    const next = make()
    setComp(next)
    selectModule(next.modules[0]!.id)
  }

  const saveTemplate = () => {
    setUserTemplates(saveUserTemplate(templateName || name, comp))
    setTemplateName("")
    toaster.create({ title: "Plantilla desada", type: "success" })
  }

  const warnings = build?.warnings ?? []
  const totalHoles = panels.reduce((n, p) => n + p.holes.length, 0)
  // Mesures de la foto aplicades al moble que encara són estimades.
  const estimated = useMemo(() => estimatedApplied(project.photo), [project.photo])

  /** Aplica una mesura de la foto (mm) a un paràmetre d'un mòdul o d'un objecte de referència. */
  const applyMeasure = (target: string, value: number) => {
    const [kind, id, field] = target.split(":")
    if (kind === "module") {
      setComp((c) => ({
        ...c,
        modules: c.modules.map((m) => (m.id === id && (field === "width" || field === "height" || field === "depth") ? { ...m, carcass: { ...m.carcass, [field]: value } } : m)),
      }))
    } else if (kind === "ref") {
      setComp((c) => ({ ...c, references: c.references.map((r) => (r.id === id && (field === "w" || field === "h" || field === "d") ? { ...r, [field]: value } : r)) }))
    }
  }

  // Obertura: grups mòbils, els del compartiment seleccionat i les col·lisions.
  const groups = useMemo(() => movingGroups(panels), [panels])
  const zoneRect = selectedZone ? moduleBuild?.layout.rects.get(selectedZone) : undefined
  const openOnly = useMemo(() => {
    if (!viewer.openOnlySelected || !zoneRect || !build) return null
    const mod = build.modules[moduleIndex]
    if (!mod) return null
    const x0 = mod.x + zoneRect.x0
    const x1 = mod.x + zoneRect.x1
    const y0 = mod.y + zoneRect.y0
    const y1 = mod.y + zoneRect.y1
    const ids = new Set<string>()
    for (const g of groups) {
      const p = panels.find((x) => x.id === g.panelIds[0])
      if (!p) continue
      const b = panelBox(p)
      if (b.max[0] > x0 + 1 && b.min[0] < x1 - 1 && b.max[1] > y0 + 1 && b.min[1] < y1 - 1) ids.add(g.id)
    }
    return ids
  }, [viewer.openOnlySelected, zoneRect, build, moduleIndex, groups, panels])
  const collisions = useMemo(() => openingCollisions(panels, groups, viewer.opening, comp.references, openOnly ?? undefined), [panels, groups, viewer.opening, comp.references, openOnly])
  const lights = useMemo<ZoneLight[]>(
    () => (build?.modules ?? []).flatMap((m) => m.build.layout.leaves.map((z) => {
      const r = m.build.layout.rects.get(z.id)!
      return { x0: m.x + r.x0, x1: m.x + r.x1, y0: m.y + r.y0, y1: m.y + r.y1 }
    })),
    [build],
  )
  const downloadImage = async () => {
    if (!capture.current) return
    try {
      downloadBlob(await capture.current(), `${slugify(name)}-${viewer.view}.png`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar la imatge", description: String(e), type: "error" })
    }
  }

  return (
    <Flex direction={{ base: "column", md: "row" }} gap={{ base: 0, md: 6 }} h="full" minH={0}>
      {/* Visor: a dalt al mòbil (fix), a la dreta a l'escriptori. */}
      <Box
        order={{ base: 0, md: 1 }}
        flex={{ md: 1 }}
        position="sticky"
        top={{ base: "calc(52px + env(safe-area-inset-top, 0px))", md: 6 }}
        alignSelf={{ base: "stretch", md: "flex-start" }}
        zIndex={1}
        h={
          formHidden
            ? { base: "calc(100dvh - 52px - 76px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))", md: "calc(100dvh - 3rem)" }
            : { base: "42vh", md: "calc(100dvh - 3rem)" }
        }
        transition="height 0.2s"
        rounded={{ md: "xl" }}
        overflow="hidden"
        borderWidth={{ md: "1px" }}
        mx={{ base: -4, md: 0 }}
      >
        {photoTab ? (
          <Box position="absolute" inset={0} overflowY="auto" pt={14} px={3} pb={3}>
            <PhotoScreen projectId={projectId} panels={panels} embedded controlsTarget={photoControls} composition={comp} onApplyMeasure={applyMeasure} />
          </Box>
        ) : (
          <CabinetViewer
            panels={panels}
            size={size}
            exploded={exploded}
            showHoles={showHoles}
            modules={viewerModules}
            selectedModuleId={module.id}
            onSelectModule={selectModule}
            onAddModule={addModuleBeside}
            ghosts={comp.references}
            view={viewer.view}
            opening={viewer.opening}
            openOnly={openOnly}
            materialMode={viewerState.materialMode}
            materials={settings.materials}
            lights={lights}
            onCapture={registerCapture}
          />
        )}
        {!photoTab && (
          <Box position="absolute" bottom={3} left="50%" transform="translateX(-50%)" zIndex={2}>
            <ViewBar view={viewer.view} onChange={(view) => setViewer({ view })} />
          </Box>
        )}
        {/* La recepta del SegmentGroup força position: relative; el posicionem amb un embolcall. */}
        <Box position="absolute" top={3} left="50%" transform="translateX(-50%)" zIndex={2}>
          <SegmentGroup.Root size="sm" bg="bg.panel" value={photoTab ? "photo" : "3d"} onValueChange={(e) => showPhotoTab(e.value === "photo")}>
            <SegmentGroup.Indicator />
            <SegmentGroup.Item value="3d" aria-label="Composició en 3D">
              <SegmentGroup.ItemText>
                <HStack gap={1.5}>
                  <LuBox /> 3D
                </HStack>
              </SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
            <SegmentGroup.Item value="photo" aria-label="Composició sobre la foto">
              <SegmentGroup.ItemText>
                <HStack gap={1.5}>
                  <LuCamera /> Foto
                </HStack>
              </SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          </SegmentGroup.Root>
        </Box>
        <IconButton
          position="absolute"
          top={3}
          left={3}
          aria-label={formHidden ? "Mostrar els paràmetres" : "Ampliar el 3D"}
          aria-expanded={!formHidden}
          size="sm"
          variant="surface"
          colorPalette="wood"
          onClick={() => setFormHidden((v) => !v)}
        >
          {formHidden ? <LuMinimize2 /> : <LuMaximize2 />}
        </IconButton>
        <HStack position="absolute" top={3} right={3} gap={2} display={photoTab ? "none" : "flex"}>
          <IconButton aria-label={showHoles ? "Amagar forats" : "Mostrar forats"} size="sm" variant={showHoles ? "solid" : "surface"} colorPalette="wood" onClick={() => setShowHoles((v) => !v)}>
            <LuCircleDot />
          </IconButton>
          <IconButton aria-label={exploded ? "Vista muntada" : "Vista explosionada"} size="sm" variant={exploded ? "solid" : "surface"} colorPalette="wood" onClick={() => setExploded((v) => !v)}>
            {exploded ? <LuShrink /> : <LuExpand />}
          </IconButton>
        </HStack>
        <HStack position="absolute" bottom={3} right={3} gap={2} display={{ base: "none", md: photoTab ? "none" : "flex" }}>
          {comp.modules.length > 1 && <Badge variant="surface">{comp.modules.length} mòduls · {size.width} mm</Badge>}
          <Badge variant="surface">{panels.length} peces</Badge>
          <Badge variant="surface">{totalHoles} forats</Badge>
        </HStack>
      </Box>

      <Stack display={formHidden ? "none" : "flex"} order={{ base: 1, md: 0 }} w={{ md: `${formWidth}px` }} flexShrink={0} gap={4} pt={{ base: 4, md: 0 }}>
        <HStack justify="space-between" gap={2}>
          <Editable.Root defaultValue={name} onValueCommit={(e) => void renameProject(projectId, e.value)} fontSize="xl" fontWeight="semibold" flex={1}>
            <Editable.Preview />
            <Editable.Input />
          </Editable.Root>
          <HStack gap={1}>
            <IconButton aria-label="Desar com a fitxer" title="Desar com a fitxer (.moble)" size="sm" variant="ghost" onClick={() => setSaveOpen(true)}>
              <LuSave />
            </IconButton>
            <IconButton aria-label="Desfer" title={`Desfer (${MOD}Z)`} size="sm" variant="ghost" disabled={history.past.length === 0} onClick={undo}>
              <LuUndo2 />
            </IconButton>
            <IconButton aria-label="Refer" title={`Refer (⇧${MOD}Z)`} size="sm" variant="ghost" disabled={history.future.length === 0} onClick={redo}>
              <LuRedo2 />
            </IconButton>
          </HStack>
        </HStack>

        {/* El fitxer porta la composició que s'està editant, encara que el desat amb retard no hagi passat. */}
        <SaveFileDialog project={{ ...project, composition: comp }} open={saveOpen} onClose={() => setSaveOpen(false)} />

        <PanelGroup storageKey="mobles:editor-open-section" defaultOpen="compartiments">
          <Stack gap={0}>
            <PanelSection id="composicio" title="Composició" icon={LuLayoutDashboard}>
              <HStack wrap="wrap" gap={2}>
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button size="sm" variant="outline">
                      <LuLayoutTemplate /> Nou des de plantilla
                    </Button>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content>
                        {BUILTIN_TEMPLATES.map((t) => (
                          <Menu.Item key={t.id} value={t.id} onClick={() => applyTemplate(t.make)}>
                            <Stack gap={0}>
                              <Text>{t.name}</Text>
                              <Text fontSize="xs" color="fg.muted">
                                {t.description}
                              </Text>
                            </Stack>
                          </Menu.Item>
                        ))}
                        {userTemplates.length > 0 && <Menu.Separator />}
                        {userTemplates.map((t) => (
                          <Menu.Item key={t.id} value={t.id} onClick={() => applyTemplate(() => structuredClone(t.composition))}>
                            {t.name}
                          </Menu.Item>
                        ))}
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
                <HStack gap={1} flex={1} minW="180px">
                  <Input size="sm" placeholder="Nom de la plantilla" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                  <IconButton aria-label="Desar com a plantilla" title="Desar com a plantilla" size="sm" variant="outline" onClick={saveTemplate}>
                    <LuBookmark />
                  </IconButton>
                </HStack>
              </HStack>
              <ModuleStrip comp={comp} selectedId={module.id} onSelect={selectModule} onChange={setComp} newModule={(id, name) => applySettingsToModule(settings, defaultModule(id, name))} />
            </PanelSection>

            <PanelSection id="referencies" title="Objectes de referència" icon={LuScan}>
              <ReferencesEditor comp={comp} onChange={setComp} />
            </PanelSection>

            <PanelSection id="modul" title={`Mòdul: ${module.name}`} icon={LuMoveDiagonal}>
              <CarcassForm module={module} onChange={updateModule} />
            </PanelSection>

            <PanelSection id="compartiments" title="Compartiments" icon={LuLayoutPanelLeft}>
              {moduleBuild && (
                <Box borderWidth="1px" rounded="lg" p={2} bg="bg.panel">
                  <ElevationEditor
                    module={module}
                    build={moduleBuild}
                    selectedZoneId={selectedZone}
                    onSelectZone={setSelectedZone}
                    references={comp.references}
                    moduleX={build?.modules[moduleIndex]?.x ?? 0}
                  />
                  <Text fontSize="xs" color="fg.muted" textAlign="center">
                    Toca un compartiment per editar-lo. Llums interiors en mm.
                  </Text>
                </Box>
              )}
              {zone ? (
                <ZonePanel root={module.root} zone={zone} openRatio={moduleBuild?.openRatios[zone.id]} onChange={(root) => updateModule({ ...module, root })} onSelect={setSelectedZone} />
              ) : (
                <Text fontSize="sm" color="fg.muted">
                  Toca un compartiment al dibuix per dividir-lo o donar-li contingut.
                </Text>
              )}
            </PanelSection>

            <PanelSection id="fusteria" title="Fusteria" icon={LuHammer}>
              <JoineryForm module={module} onChange={updateModule} />
            </PanelSection>

            <PanelSection id="visor" title="Visor 3D" icon={LuRotate3D}>
              <ViewerControls state={viewerState} onChange={setViewer} hasMoving={groups.length > 0} hasSelectedZone={!!zoneRect} onImage={() => void downloadImage()} />
            </PanelSection>

            <OpenOnSignal id="foto" signal={openPhotoSection} />
            <PanelSection id="foto" title="Adaptar mides a la imatge" icon={LuCamera}>
              {photoTab ? (
                <Box ref={setPhotoControls} />
              ) : (
                <Stack gap={2} align="flex-start">
                  <Text fontSize="sm" color="fg.muted">
                    Superposa la composició a una foto del lloc per ajustar-ne les mides a ull.
                  </Text>
                  <Button size="sm" variant="outline" colorPalette="wood" onClick={() => showPhotoTab(true)}>
                    <LuCamera /> Veure-ho sobre la foto
                  </Button>
                </Stack>
              )}
            </PanelSection>
          </Stack>
        </PanelGroup>

        {estimated.length > 0 && (
          <Alert.Root status="warning" size="sm">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{ESTIMATED_WARNING}</Alert.Title>
              <Alert.Description>Basat en la foto: {estimated.map((a) => a.label).join(", ")}. Mesura-ho amb cinta abans de tallar.</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}

        {collisions.length > 0 && (
          <Stack gap={2}>
            <HStack gap={2} color="fg.muted">
              <LuDoorOpen />
              <Text fontSize="sm" fontWeight="semibold">
                Amb l'obertura actual
              </Text>
            </HStack>
            {collisions.map((c) => (
              <Alert.Root key={c.groupId} status="warning" size="sm">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{c.message}</Alert.Description>
                </Alert.Content>
              </Alert.Root>
            ))}
          </Stack>
        )}

        {warnings.length > 0 && (
          <Stack gap={2}>
            <HStack gap={2} color="fg.muted">
              <LuTriangleAlert />
              <Text fontSize="sm" fontWeight="semibold">
                Avisos de fusteria
              </Text>
            </HStack>
            {warnings.map((w, i) => (
              <Alert.Root key={i} status={w.code === "material-heat" ? "info" : "warning"} size="sm">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>
                    {w.moduleId && comp.modules.length > 1 ? `${comp.modules.find((m) => m.id === w.moduleId)?.name ?? ""}: ` : ""}
                    {w.message}
                    {w.zoneId && (
                      <Button
                        size="xs"
                        variant="plain"
                        ml={2}
                        onClick={() => {
                          if (w.moduleId) setSelectedModule(w.moduleId)
                          setSelectedZone(w.zoneId!)
                        }}
                      >
                        Anar-hi
                      </Button>
                    )}
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            ))}
          </Stack>
        )}
      </Stack>
      {!formHidden && (
        <ResizeHandle width={formWidth} onWidth={setFormWidth} min={300} max={720} defaultWidth={380} panelSide="left" label="Amplada del panell de paràmetres" />
      )}
    </Flex>
  )
}

/** Obre la secció `id` cada cop que canvia `signal` (sense tocar-la en el primer render). */
function OpenOnSignal({ id, signal }: { id: string; signal: number }) {
  const group = usePanelGroup()
  useEffect(() => {
    if (signal > 0) group?.setOpenId(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal])
  return null
}
