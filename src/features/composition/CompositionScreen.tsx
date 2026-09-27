import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  Menu,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react"
import { useEffect, useMemo, useState } from "react"
import { LuCircleDot, LuExpand, LuLayoutTemplate, LuSave, LuShrink } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { CabinetViewer } from "../../components/viewer/CabinetViewer"
import { BUILTIN_TEMPLATES, compositionWidth, findZone, moduleOrigins, type Composition, type Module } from "../../core/model"
import { loadUserTemplates, saveUserTemplate, updateProjectComposition } from "../../db/compositionStore"
import { useComposition, useCompositionBuild, useProject } from "../useProject"
import { CarcassForm } from "./CarcassForm"
import { ElevationEditor } from "./ElevationEditor"
import { ModuleStrip } from "./ModuleStrip"
import { ZonePanel } from "./ZonePanel"

/** Editor de compartiments: composició de mòduls, alçat frontal i 3D. */
export function CompositionScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  const initial = useComposition(project)
  if (!project || !initial) return null
  return <CompositionEditor key={project.id} projectId={project.id} initial={initial} />
}

function CompositionEditor({ projectId, initial }: { projectId: number; initial: Composition }) {
  const [comp, setComp] = useState<Composition>(initial)
  const [selectedModule, setSelectedModule] = useState<string>(initial.modules[0]!.id)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [exploded, setExploded] = useState(false)
  const [showHoles, setShowHoles] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [userTemplates, setUserTemplates] = useState(loadUserTemplates)

  const build = useCompositionBuild(comp)

  useEffect(() => {
    if (comp === initial) return
    const t = setTimeout(() => void updateProjectComposition(projectId, comp), 350)
    return () => clearTimeout(t)
  }, [comp, projectId, initial])

  const module = comp.modules.find((m) => m.id === selectedModule) ?? comp.modules[0]!
  const moduleIndex = comp.modules.indexOf(module)
  const moduleBuild = build?.modules[moduleIndex]?.build
  const zone = selectedZone ? findZone(module.root, selectedZone) : undefined
  const xs = moduleOrigins(comp)

  const size = useMemo(() => {
    let h = 0
    let d = 0
    for (const m of comp.modules) {
      const legs = m.carcass.base.kind === "legs" ? m.carcass.base.height : 0
      h = Math.max(h, m.carcass.height + legs)
      d = Math.max(d, m.carcass.depth + m.carcass.thickness)
    }
    return { width: compositionWidth(comp), height: h, depth: d }
  }, [comp])

  const updateModule = (m: Module) => setComp((c) => ({ ...c, modules: c.modules.map((x) => (x.id === m.id ? m : x)) }))

  const applyTemplate = (make: () => Composition) => {
    const next = make()
    setComp(next)
    setSelectedModule(next.modules[0]!.id)
    setSelectedZone(null)
  }

  const saveTemplate = () => {
    const list = saveUserTemplate(templateName || module.name, comp)
    setUserTemplates(list)
    setTemplateName("")
    toaster.create({ title: "Plantilla guardada", type: "success" })
  }

  const warnings = build?.warnings ?? []
  const panelCount = build?.panels.length ?? 0

  return (
    <Flex direction={{ base: "column", lg: "row" }} gap={{ base: 4, lg: 6 }} align="flex-start">
      <Stack flex={1} minW={0} w={{ base: "full", lg: "auto" }} gap={4}>
        <HStack justify="space-between" wrap="wrap" gap={2}>
          <Heading size="lg">Disseny</Heading>
          <HStack gap={2}>
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
            <HStack gap={1}>
              <Input size="sm" w="150px" placeholder="Nom de plantilla" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
              <IconButton aria-label="Guardar com a plantilla" size="sm" variant="outline" onClick={saveTemplate}>
                <LuSave />
              </IconButton>
            </HStack>
          </HStack>
        </HStack>

        <ModuleStrip
          comp={comp}
          selectedId={module.id}
          onSelect={(id) => {
            setSelectedModule(id)
            setSelectedZone(null)
          }}
          onChange={setComp}
        />

        {moduleBuild && (
          <Box borderWidth="1px" rounded="lg" p={2} bg="bg.panel">
            <ElevationEditor
              module={module}
              build={moduleBuild}
              selectedZoneId={selectedZone}
              onSelectZone={setSelectedZone}
              references={comp.references}
              moduleX={xs[moduleIndex] ?? 0}
            />
            <Text fontSize="xs" color="fg.muted" textAlign="center">
              Toca un compartiment per editar-lo. Llums interiors en mm.
            </Text>
          </Box>
        )}

        {zone ? (
          <ZonePanel
            root={module.root}
            zone={zone}
            openRatio={moduleBuild?.openRatios[zone.id]}
            onChange={(root) => updateModule({ ...module, root })}
            onSelect={setSelectedZone}
          />
        ) : (
          <Alert.Root status="info" size="sm">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Toca un compartiment al dibuix per dividir-lo o donar-li contingut</Alert.Title>
            </Alert.Content>
          </Alert.Root>
        )}

        <CarcassForm module={module} onChange={updateModule} />

        {warnings.length > 0 && (
          <Stack gap={2}>
            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
              Avisos
            </Text>
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

      <Box
        w={{ base: "full", lg: "46%" }}
        flexShrink={0}
        position={{ lg: "sticky" }}
        top={{ lg: 6 }}
        h={{ base: "45vh", lg: "calc(100dvh - 3rem)" }}
        rounded="xl"
        overflow="hidden"
        borderWidth="1px"
      >
        {build && <CabinetViewer panels={build.panels} size={size} exploded={exploded} showHoles={showHoles} />}
        <HStack position="absolute" top={3} right={3} gap={2}>
          <IconButton aria-label={showHoles ? "Amagar forats" : "Mostrar forats"} size="sm" variant={showHoles ? "solid" : "surface"} colorPalette="wood" onClick={() => setShowHoles((v) => !v)}>
            <LuCircleDot />
          </IconButton>
          <IconButton aria-label={exploded ? "Vista muntada" : "Vista explosionada"} size="sm" variant={exploded ? "solid" : "surface"} colorPalette="wood" onClick={() => setExploded((v) => !v)}>
            {exploded ? <LuShrink /> : <LuExpand />}
          </IconButton>
        </HStack>
        <HStack position="absolute" bottom={3} left={3} gap={2}>
          <Badge variant="surface">{comp.modules.length} mòduls</Badge>
          <Badge variant="surface">{panelCount} peces</Badge>
          <Badge variant="surface">{size.width} mm</Badge>
        </HStack>
      </Box>
    </Flex>
  )
}
