import { Alert, Box, Button, Card, CloseButton, Collapsible, Dialog, HStack, Portal, Stack, Switch, Text, VStack } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { usePersistentFlag } from "../usePersistentFlag"
import { LuBoxes, LuChevronRight, LuCuboid, LuDownload, LuFactory, LuFileDown, LuFileJson, LuLayoutGrid, LuMonitorCog, LuScissors, LuSettings2 } from "react-icons/lu"
import { PanelGroup, PanelSection } from "../../components/PanelSection"
import { FormRow } from "../../components/FormRow"
import { exportGlb } from "../../components/viewer/exportGlb"
import { exportablePanel } from "../../components/viewer/exportablePanel"
import { exportUsdz, openQuickLook } from "../../components/viewer/exportUsdz"
import { toaster } from "../../components/ui/toaster"
import { toCutList } from "../../core/cutlist/toCutList"
import { cutListToCsv } from "../../core/export/csv"
import { dxfLayers, toDxf } from "../../core/export/dxf"
import { toStepCad } from "../../core/export/step"
import { stepCadGroups } from "../../core/export/stepGroups"
import { finishRgb, resolveFinish } from "../../components/viewer/textures"
import { encodeUtf16le, toTopsolidCsv } from "../../core/export/topsolidCsv"
import { toUnifiedData } from "../../core/export/unified"
import { xcsZip } from "../../core/export/maestroXcs"
import { cncNestOptions, toMaestroNestXcs } from "../../core/export/maestroNestXcs"
import { DEFAULT_NEST_OPTIONS, nest } from "../../core/nesting/nest"
import { machineWithRules } from "../../core/model"
import { downloadBlob, downloadText, slugify } from "../download"
import { ESTIMATED_WARNING, estimatedApplied } from "../photo/appliedState"
import { useSettings } from "../settings/SettingsContext"
import { CamPreview } from "./CamPreview"
import { useComposition, useCompositionBuild, useCompositionRead, useNesting, useProject } from "../useProject"
import { UnreadableAlert } from "../../components/UnreadableAlert"

export function ExportScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  const unreadable = !!useCompositionRead(project)?.unreadable
  const comp = useComposition(project)
  const build = useCompositionBuild(comp)
  const panels = useMemo(() => build?.panels ?? [], [build])
  const nesting = useNesting(panels, project?.nesting)
  const { settings } = useSettings()
  const [labels, setLabels] = useState(true)
  // DXF «3D»: gruix de cada peça i profunditat de cada mecanitzat com a Z i extrusió.
  const [dxf3d, setDxf3d] = usePersistentFlag("mobles:dxf-3d", true)
  // STEP amb el ferro, la pedra i el vidre: només per a CAD (al taller donen unions falses).
  const [stepExtras, setStepExtras] = usePersistentFlag("mobles:step-extras", false)
  const estimated = useMemo(() => estimatedApplied(project?.photo), [project?.photo])
  const warnEstimated = () => {
    if (estimated.length) toaster.create({ title: ESTIMATED_WARNING, description: `Mides estimades de la foto: ${estimated.map((a) => a.label).join(", ")}.`, type: "warning", duration: 8000 })
  }
  const [busy, setBusy] = useState(false)
  const [busyAr, setBusyAr] = useState(false)
  const [cam, setCam] = useState(false)
  const layers = useMemo(() => dxfLayers(panels, labels), [panels, labels])
  // Els avisos del STEP es calculen abans de descarregar, per veure'ls de seguida.
  const stepColor = useMemo(() => (p: { material: string }) => finishRgb(resolveFinish(settings.materials, p.material)), [settings.materials])
  // Programes de Maestro (.xcs) amb la màquina per defecte de Preferències › Màquines CNC.
  const machine = machineWithRules(settings)
  // Un programa per tauler del nesting (el Maestro del taller no en fa).
  const xcs = useMemo(() => {
    if (!machine || !panels.length) return null
    const name = project?.name ?? "moble"
    const plan = cncNestOptions(panels, machine, project?.nesting ?? DEFAULT_NEST_OPTIONS)
    const x = toMaestroNestXcs(panels, nest(panels, plan.options), machine, { project: name })
    // `sheetList`: els programes amb el seu text (el mateix que va al zip) per a la Vista CAM.
    return { ...x, sheets: x.sheets.length, sheetList: x.sheets, rows: x.panels, spacingTool: plan.tool }
  }, [machine, panels, project?.name, project?.nesting])
  const stepWarnings = useMemo(() => (comp && build && panels.length ? toStepCad(stepCadGroups(comp, build, { extras: stepExtras }), { name: "check" }).warnings : []), [comp, build, panels, stepExtras])

  if (!project) return null
  // Composició il·legible: res a exportar (seria la caixa per defecte).
  if (unreadable) return <UnreadableAlert />
  const base = slugify(project.name)

  const doStep = () => {
    if (!comp || !build) return
    warnEstimated()
    const step = toStepCad(stepCadGroups(comp, build, { extras: stepExtras }), { name: project.name, color: stepColor })
    downloadBlob(new Blob([step.text], { type: "application/step" }), `${base}.step`)
    toaster.create({
      title: "STEP de TopSolid generat",
      description: `${step.solids} peces en conjunts per mòdul, amb ingletes i colors` + (step.warnings.length ? ` · ${step.warnings.length} avisos` : ""),
      type: step.warnings.length ? "warning" : "success",
    })
  }
  const doTopsolidCsv = () => {
    if (!nesting) return
    warnEstimated()
    const csv = toTopsolidCsv(panels, nesting, { project: project.name, label: settings.label })
    downloadBlob(new Blob([encodeUtf16le(csv.text)], { type: "text/csv" }), `${base}_res.csv`)
    const tight = csv.rows.filter((r) => !r.labelFits).length
    toaster.create({
      title: "CSV de nesting generat",
      description:
        `${csv.rows.length} peces en ${nesting.boards.length + csv.unplaced.length} taulers` +
        (tight ? `. ${tight} peces massa petites per a l'etiqueta (al centre).` : ""),
      type: csv.unplaced.length ? "warning" : "success",
    })
  }
  const doDxf = () => {
    warnEstimated()
    downloadText(toDxf(panels, { labels, threeD: dxf3d }), `${base}.dxf`, "application/dxf")
    toaster.create({ title: "DXF generat", description: `${panels.length} peces, ${layers.length} capes`, type: "success" })
  }
  const doXcs = () => {
    if (!xcs || !machine) return
    warnEstimated()
    const zip = xcsZip(xcs)
    downloadBlob(new Blob([zip as BlobPart], { type: "application/zip" }), `${base}-maestro.zip`)
    toaster.create({
      title: "Programes de Maestro generats",
      description: `${xcs.programs} programes .xcs per tauler per a ${machine.name}` + (xcs.warnings.length ? ` · ${xcs.warnings.length} avisos (al LLEGEIX-ME.txt)` : ""),
      type: xcs.warnings.length ? "warning" : "success",
    })
  }
  const doCsv = () => downloadText(cutListToCsv(toCutList(panels)), `${base}-peces.csv`, "text/csv")
  const doJson = () =>
    downloadText(
      JSON.stringify(toUnifiedData(panels, { name: project.name, nesting }), null, 2),
      `${base}-unified.json`,
      "application/json",
    )
  const doGlb = async () => {
    setBusy(true)
    try {
      downloadBlob(await exportGlb(panels, project.name, { materials: settings.materials, make: exportablePanel }, build?.models), `${base}.glb`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar el GLB", description: String(e), type: "error" })
    } finally {
      setBusy(false)
    }
  }

  const doUsdz = async (open: boolean) => {
    setBusyAr(true)
    try {
      const blob = await exportUsdz(panels, project.name, { materials: settings.materials, make: exportablePanel }, build?.models)
      if (open) openQuickLook(blob, `${base}.usdz`)
      else downloadBlob(blob, `${base}.usdz`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar l'USDZ", description: String(e), type: "error" })
    } finally {
      setBusyAr(false)
    }
  }

  return (
    <VStack align="stretch" gap={4}>
      {estimated.length > 0 && (
        <Alert.Root status="warning" size="sm">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{ESTIMATED_WARNING}</Alert.Title>
            <Alert.Description>El moble es basa en mides estimades de la foto: {estimated.map((a) => a.label).join(", ")}. Mesura-les amb cinta abans de tallar.</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
      {nesting?.unplaced.length ? (
        <Alert.Root status="warning" size="sm">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{nesting.unplaced.length} peces no caben al tauler del nesting: al CSV sortiran en un tauler a mida.</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      ) : null}

      {stepWarnings.length > 0 && (
        <Alert.Root status="warning" size="sm">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              El STEP sortirà amb {stepWarnings.length} {stepWarnings.length === 1 ? "avís" : "avisos"}: {stepWarnings.length === 1 ? "un mecanitzat no es pot" : "hi ha mecanitzats que no es poden"} modelar en 3D
            </Alert.Title>
            <Alert.Description>
              <Stack as="ul" gap={0.5} mt={1} ps={4} listStyleType="disc">
                {stepWarnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </Stack>
              {stepWarnings.length > 5 && <Text mt={1}>… i {stepWarnings.length - 5} més.</Text>}
              <Text mt={1}>El DXF i el CSV sí que els porten; revisa aquestes peces a l'editor (forats massa a prop de la vora o de la ranura del fons).</Text>
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      {/* Per destinació: cada grup, una acció principal. */}
      <ExportCard
        highlight
        icon={<LuFactory />}
        title="Màquina CNC (Maestro)"
        description="L'exportació principal: programes de Xilog Maestro (.xcs) per a la SCM del taller, sense passar per TopSolid. Un programa per tauler del nesting (el Maestro no en fa) amb totes les peces: forats, ranures, talls i contorns com a mecanitzats de debò amb les eines de la màquina (cara A; forats de cantell, cara B i inglets després). BETA: fins que el taller no els validi a Maestro, revisa'ls a la vista CAM del Maestro abans de mecanitzar."
        files={machine ? `${base}-maestro.zip · ${xcs?.programs ?? 0} programes (${xcs?.sheets ?? 0} taulers) per a ${machine.name}` : undefined}
        action={
          <HStack gap={2} wrap="wrap">
            <Button colorPalette="wood" onClick={doXcs} disabled={!xcs || !xcs.programs}>
              <LuFactory /> Programes .xcs
            </Button>
            <Button variant="outline" onClick={() => setCam(true)} disabled={!xcs || !xcs.programs}>
              <LuMonitorCog /> Vista CAM
            </Button>
          </HStack>
        }
      >
        {machine && xcs && (
          <Text fontSize="sm" color="fg.muted">
            Separació entre peces {fmt(xcs.spacing)} mm
            {xcs.spacingTool ? ` (Ø${fmt(xcs.spacingTool.diameter)} + ${fmt(xcs.spacing - xcs.spacingTool.diameter)}, la fresa de contorn més grossa)` : ""}; marge del tauler, martiri i
            regles de mecanitzat a Preferències.
          </Text>
        )}
        {!machine && (
          <Text fontSize="sm" color="fg.muted">
            Cal una màquina: importa-la de Maestro a Preferències › Màquines CNC (la carpeta .machinecontext).
          </Text>
        )}
        {machine && !machine.pgmx && (
          <Text fontSize="sm" color="fg.muted">
            Els noms de les eines són els del context exportat ({machine.maestroVersion || "?"}). Si el Maestro del taller les ha rebatejades,
            importa un projecte seu (.pgmx) a Preferències › Màquines CNC.
          </Text>
        )}
        {xcs && xcs.warnings.length > 0 && (
          <Alert.Root status="warning" size="sm">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>
                {xcs.warnings.length} {xcs.warnings.length === 1 ? "mecanitzat no surt o canvia" : "mecanitzats no surten o canvien"} als programes
              </Alert.Title>
              <Alert.Description>
                <Stack as="ul" gap={0.5} mt={1} ps={4} listStyleType="disc">
                  {xcs.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </Stack>
                {xcs.warnings.length > 5 && <Text mt={1}>… i {xcs.warnings.length - 5} més (tots al LLEGEIX-ME.txt del zip).</Text>}
                {xcs.missingTool > 0 && <Text mt={1}>Si falta una eina, afegeix-la a Preferències › Màquines CNC amb el codi de Maestro.</Text>}
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
        {xcs && xcs.postProcessPanels > 0 && (
          // Inglets, cantells, encolar…: no són avisos, és el que toca després de la CNC (també al LLEGEIX-ME).
          <Collapsible.Root>
            <Collapsible.Trigger asChild>
              <Button variant="ghost" size="sm" px={1} css={{ "&[data-state=open] svg": { transform: "rotate(90deg)" } }}>
                <LuChevronRight /> Després de la CNC ({xcs.postProcessPanels} {xcs.postProcessPanels === 1 ? "peça" : "peces"})
              </Button>
            </Collapsible.Trigger>
            <Collapsible.Content>
              <Stack gap={2} fontSize="sm" mt={1}>
                {xcs.rows.map((r) =>
                  r.postProcesses.length ? (
                    <Box key={r.ref}>
                      <Text fontWeight="medium">
                        {r.ref} · {r.label}
                      </Text>
                      <Text color="fg.muted">{r.route}</Text>
                      <Stack as="ol" gap={0} ps={5} listStyleType="decimal">
                        {r.postProcesses.map((x, k) => (
                          <li key={k}>{x.text}</li>
                        ))}
                      </Stack>
                    </Box>
                  ) : null,
                )}
                <Text color="fg.muted">Cantells amb la numeració de l'app (1 dalt · 2 dreta · 3 baix · 4 esquerra).</Text>
              </Stack>
            </Collapsible.Content>
          </Collapsible.Root>
        )}
      </ExportCard>

      {/* Vista CAM: els programes del zip dibuixats, per revisar-los abans d'enviar-los a la màquina. */}
      <Dialog.Root open={cam} onOpenChange={(e) => setCam(e.open)} size="full" placement="center" lazyMount unmountOnExit>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content w="100vw" maxW="100vw" h="100dvh" maxH="100dvh" rounded="none" display="flex" flexDirection="column" overflow="hidden" pt="env(safe-area-inset-top, 0px)" pb="env(safe-area-inset-bottom, 0px)" ps="env(safe-area-inset-left, 0px)" pe="env(safe-area-inset-right, 0px)">
              <Dialog.Header flexDirection="column" alignItems="start" gap={0.5} pe={14}>
                <Dialog.Title>Vista CAM</Dialog.Title>
                <Text fontSize="sm" color="fg.muted">
                  El que rebrà la màquina: cada programa .xcs del zip, llegit i dibuixat.
                </Text>
              </Dialog.Header>
              <Dialog.Body flex={1} minH={0} overflowY={{ base: "auto", lg: "hidden" }} px={{ base: 4, md: 6 }} pb={6}>
                {xcs && <CamPreview sheets={xcs.sheetList} machine={machine} />}
              </Dialog.Body>
              <Dialog.CloseTrigger asChild top="calc(env(safe-area-inset-top, 0px) + 8px)" insetEnd="calc(env(safe-area-inset-right, 0px) + 8px)">
                <CloseButton size="sm" aria-label="Tancar" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <ExportCard
        icon={<LuCuboid />}
        title="STEP de TopSolid"
        description="El moble en 3D, per obrir-lo a TopSolid i continuar-lo treballant i per al taller: un conjunt per mòdul, cada peça amb el seu nom, material i color, ingletes a 45°, forats, ranures i talls i booleans 3D."
        files={`${base}.step`}
        action={
          <Button variant="outline" onClick={doStep} disabled={!panels.length}>
            <LuDownload /> Descarregar STEP
          </Button>
        }
      >
        <FormRow label="Altres peces">
          <Switch.Root checked={stepExtras} onCheckedChange={(e) => setStepExtras(e.checked)} size="sm" pt="6px">
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Ferro, pedra i vidre (només per a CAD: al taller donarien unions falses)</Switch.Label>
          </Switch.Root>
        </FormRow>
      </ExportCard>

      <ExportCard
        icon={<LuLayoutGrid />}
        title="CSV de TopSolid"
        description="El CSV de nesting com el que treu TopSolid (_res.csv): peces, taulers, etiquetes, cantells i referències. El taller el carrega a la seva pàgina de pujada juntament amb el STEP."
        files={`${base}_res.csv`}
        action={
          <Button variant="outline" onClick={doTopsolidCsv} disabled={!nesting}>
            <LuLayoutGrid /> Descarregar CSV
          </Button>
        }
      />

      <ExportCard
        icon={<LuScissors />}
        title="CNC (DXF)"
        description="Una peça per bloc, contorn a CONTOUR i forats per diàmetre i profunditat."
        files={`${base}.dxf · ${layers.length} capes`}
        action={
          <Button variant="outline" onClick={doDxf} disabled={!panels.length}>
            <LuScissors /> Descarregar DXF
          </Button>
        }
      >
        <FormRow label="Etiquetes">
          <Switch.Root checked={labels} onCheckedChange={(e) => setLabels(e.checked)} size="sm" pt="6px">
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Nom de la peça (capa LABEL)</Switch.Label>
          </Switch.Root>
        </FormRow>
        <FormRow label="3D">
          <Switch.Root checked={dxf3d} onCheckedChange={(e) => setDxf3d(e.checked)} size="sm" pt="6px">
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Gruix de la peça i profunditat de forats i ranures (Z i extrusió)</Switch.Label>
          </Switch.Root>
        </FormRow>
      </ExportCard>

      <ExportCard
        icon={<LuFileDown />}
        title="Llista de tall (CSV)"
        description="Peces agrupades amb mides, quantitat, material, veta i cantells. Per a una fusteria que talla a mida o per a un full de càlcul."
        files={`${base}-peces.csv`}
        action={
          <Button variant="outline" onClick={doCsv} disabled={!panels.length}>
            <LuFileDown /> Descarregar CSV
          </Button>
        }
      />

      <ExportCard
        icon={<LuBoxes />}
        title="Model 3D"
        description="El moble en metres per a altres programes 3D (GLB) o per a l'AR de l'iPhone (USDZ). Per veure'l a casa, fes servir «Veure a casa» del visor 3D."
        files={`${base}.glb · ${base}.usdz`}
        action={
          <HStack gap={2} wrap="wrap">
            <Button variant="outline" onClick={doGlb} loading={busy} disabled={!panels.length}>
              <LuBoxes /> Descarregar GLB
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void doUsdz(false)} loading={busyAr} disabled={!panels.length}>
              USDZ
            </Button>
          </HStack>
        }
      />

      <PanelGroup storageKey="mobles:export-open-section" defaultOpen="">
        <PanelSection id="advanced" title="Avançat" icon={LuSettings2}>
          <HStack justify="space-between" gap={3} wrap="wrap">
            <Text fontSize="sm" color="fg.muted" flex={1} minW="240px">
              JSON del taller (UnifiedData): el que el taller obtindria en llegir el STEP i el CSV ({nesting?.boards.length ?? 0} taulers). Només
              per depurar la integració.
            </Text>
            <Button size="sm" variant="ghost" onClick={doJson}>
              <LuFileJson /> Descarregar JSON
            </Button>
          </HStack>
        </PanelSection>
      </PanelGroup>
    </VStack>
  )
}

/** Mm amb coma decimal (com a la resta de la UI). */
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",")

function ExportCard({
  icon,
  title,
  description,
  files,
  action,
  highlight,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  files?: string
  action: React.ReactNode
  highlight?: boolean
  children?: React.ReactNode
}) {
  return (
    <Card.Root variant="outline" bg={highlight ? "wood.subtle" : undefined}>
      <Card.Body gap={3}>
        <Stack direction={{ base: "column", md: "row" }} gap={4} justify="space-between" align={{ base: "stretch", md: "center" }}>
          <Stack gap={1} flex={1} minW={0}>
            <HStack color="wood.fg" fontSize="lg" gap={2}>
              {icon}
              <Text fontWeight="semibold" fontSize="md" color="fg">
                {title}
              </Text>
            </HStack>
            <Text fontSize="sm" color="fg.muted">
              {description}
            </Text>
            {files && (
              <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
                {files}
              </Text>
            )}
          </Stack>
          <Box flexShrink={0}>{action}</Box>
        </Stack>
        {children}
      </Card.Body>
    </Card.Root>
  )
}
