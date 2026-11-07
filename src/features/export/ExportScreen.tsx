import { Button, HStack, Switch, Text, VStack } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { usePersistentFlag } from "../../lib/usePersistentFlag"
import { LuBoxes, LuCuboid, LuDownload, LuFileDown, LuFileJson, LuLayoutGrid, LuScissors, LuSettings2, LuTag } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { FormRow } from "../../components/FormRow"
import { toaster } from "../../components/ui/toaster"
import { dxfLayers } from "../../core/export/dxf"
import { materialIssues } from "../../core/build/materialIssues"
import { finishRgb, resolveFinish } from "../../components/viewer/textures"
import { machineWithRules } from "../../core/model"
import { slugify } from "../../lib/download"
import { ESTIMATED_WARNING, estimatedApplied } from "../photo/appliedState"
import { useSettings } from "../settings/SettingsContext"
import { useComposition, useCompositionBuild, useCompositionRead, useNesting, useProject } from "../useProject"
import { UnreadableAlert } from "../../components/UnreadableAlert"
import { CamDialog } from "./CamDialog"
import { ExportAlerts } from "./ExportAlerts"
import { ExportCard } from "./ExportCard"
import { exportActions } from "./exportActions"
import { MaestroCard } from "./MaestroCard"
import { useMaestroPrograms } from "./useMaestroPrograms"
import { useStepWarnings } from "./useStepWarnings"

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
  const xcs = useMaestroPrograms(machine, panels, project?.name, project?.nesting, build)
  // Materials que no lliguen amb Preferències: al taller sortirien amb un nom o un gruix que no hi ha.
  const matIssues = useMemo(() => (comp && build ? materialIssues(build, comp, settings.materials) : []), [comp, build, settings.materials])
  const stepWarnings = useStepWarnings(comp, build, panels, stepExtras)

  if (!project) return null
  // Composició il·legible: res a exportar (seria la caixa per defecte).
  if (unreadable) return <UnreadableAlert />
  const base = slugify(project.name)
  const { doStep, doTopsolidCsv, doDxf, doXcs, doLabels, doCsv, doJson, doGlb, doUsdz } = exportActions({
    project,
    base,
    comp,
    build,
    panels,
    nesting,
    settings,
    labels,
    dxf3d,
    stepExtras,
    stepColor,
    layerCount: layers.length,
    xcs,
    machine,
    warnEstimated,
    setBusy,
    setBusyAr,
  })

  return (
    <VStack align="stretch" gap={4}>
      <ExportAlerts estimated={estimated} nesting={nesting} matIssues={matIssues} stepWarnings={stepWarnings} />

      {/* Per destinació: cada grup, una acció principal. */}
      <MaestroCard base={base} machine={machine} xcs={xcs} onXcs={doXcs} onCam={() => setCam(true)} />

      {/* Vista CAM: els programes del zip dibuixats, per revisar-los abans d'enviar-los a la màquina. */}
      <CamDialog open={cam} onOpenChange={setCam} xcs={xcs} machine={machine} />

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
        icon={<LuTag />}
        title="Etiquetes de peça (PDF)"
        description={`Una etiqueta per peça, en l'ordre del nesting: la ref del taller (és el que identifica la peça, no la mida), el nom, les mides, el material, el mòdul, el tauler, els cantells en un esquema i la veta. Mida de Preferències › Etiqueta de peça (${settings.label.w} × ${settings.label.h} mm), una per pàgina per a la impressora d'etiquetes.`}
        files={`${base}-etiquetes.pdf`}
        action={
          <Button variant="outline" onClick={doLabels} disabled={!panels.length}>
            <LuTag /> Descarregar etiquetes
          </Button>
        }
      />

      <ExportCard
        icon={<LuFileDown />}
        title="Llista de tall (CSV)"
        description="Peces agrupades amb mides, quantitat, material, veta i cantells i, a sota, els ferratges per metres (regleta, sòcol d'alumini) amb els trossos. Per a una fusteria que talla a mida o per a un full de càlcul."
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

      <FoldItem id="advanced" title="Avançat" icon={LuSettings2}>
          <HStack justify="space-between" gap={3} wrap="wrap">
            <Text fontSize="sm" color="fg.muted" flex={1} minW="240px">
              JSON del taller (UnifiedData): el que el taller obtindria en llegir el STEP i el CSV ({nesting?.boards.length ?? 0} taulers). Només
              per depurar la integració.
            </Text>
            <Button size="sm" variant="ghost" onClick={doJson}>
              <LuFileJson /> Descarregar JSON
            </Button>
          </HStack>
      </FoldItem>
    </VStack>
  )
}
