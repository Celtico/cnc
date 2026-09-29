import { Alert, Box, Button, Card, HStack, Stack, Switch, Text, VStack } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { usePersistentFlag } from "../usePersistentFlag"
import { LuBoxes, LuCuboid, LuDownload, LuFileDown, LuFileJson, LuPrinter, LuScissors, LuTag, LuWrench } from "react-icons/lu"
import { labelSheetHtml } from "../../core/process/labels"
import { panelProcesses } from "../../core/process/processes"
import { PanelGroup, PanelSection } from "../../components/PanelSection"
import { exportGlb } from "../../components/viewer/exportGlb"
import { exportUsdz, openQuickLook } from "../../components/viewer/exportUsdz"
import { toaster } from "../../components/ui/toaster"
import { toCutList } from "../../core/cutlist/toCutList"
import { cutListToCsv } from "../../core/export/csv"
import { dxfLayers, toDxf } from "../../core/export/dxf"
import { toStep } from "../../core/export/step"
import { encodeUtf16le, toTopsolidCsv } from "../../core/export/topsolidCsv"
import { toUnifiedData } from "../../core/export/unified"
import { downloadBlob, downloadText, slugify } from "../download"
import { ESTIMATED_WARNING, estimatedApplied } from "../photo/appliedState"
import { useSettings } from "../settings/SettingsContext"
import { useCompositionPanels, useNesting, useProject } from "../useProject"

export function ExportScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  const panels = useCompositionPanels(project)
  const nesting = useNesting(panels, project?.nesting)
  const { settings } = useSettings()
  const [labels, setLabels] = useState(true)
  // DXF «3D»: gruix de cada peça i profunditat de cada mecanitzat com a Z i extrusió.
  const [dxf3d, setDxf3d] = usePersistentFlag("mobles:dxf-3d", true)
  const estimated = useMemo(() => estimatedApplied(project?.photo), [project?.photo])
  const warnEstimated = () => {
    if (estimated.length) toaster.create({ title: ESTIMATED_WARNING, description: `Mides estimades de la foto: ${estimated.map((a) => a.label).join(", ")}.`, type: "warning", duration: 8000 })
  }
  const [busy, setBusy] = useState(false)
  const [busyAr, setBusyAr] = useState(false)
  const layers = useMemo(() => dxfLayers(panels, labels), [panels, labels])
  // Els avisos del STEP es calculen abans de descarregar, per veure'ls de seguida.
  const stepWarnings = useMemo(() => (panels.length ? toStep(panels, { name: "check" }).warnings : []), [panels])

  if (!project) return null
  const base = slugify(project.name)

  const doStep = () => {
    warnEstimated()
    const step = toStep(panels, { name: project.name })
    downloadBlob(new Blob([step.text], { type: "application/step" }), `${base}.step`)
    toaster.create({
      title: "STEP generat",
      description: `${step.solids} sòlids en mm (X amplada, Y fondària, Z amunt)` + (step.warnings.length ? ` · ${step.warnings.length} avisos (vegeu la pàgina)` : ""),
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
  // Etiquetes: la de la peça i, si en té, la del procés (post-procés després del nesting).
  const withProcess = useMemo(() => panels.filter((p) => panelProcesses(p).length).length, [panels])
  const labelHtml = () => labelSheetHtml(panels, nesting ?? null, { project: project?.name ?? "Moble", w: settings.label.w, h: settings.label.h })
  const printLabels = () => {
    const url = URL.createObjectURL(new Blob([labelHtml()], { type: "text/html" }))
    const win = window.open(url, "_blank")
    if (!win) {
      downloadText(labelHtml(), `${base}-etiquetes.html`, "text/html")
      return
    }
    win.addEventListener("load", () => setTimeout(() => win.print(), 300))
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  const doDxf = () => {
    warnEstimated()
    downloadText(toDxf(panels, { labels, threeD: dxf3d }), `${base}.dxf`, "application/dxf")
    toaster.create({ title: "DXF generat", description: `${panels.length} peces, ${layers.length} capes`, type: "success" })
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
      downloadBlob(await exportGlb(panels, project.name), `${base}.glb`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar el GLB", description: String(e), type: "error" })
    } finally {
      setBusy(false)
    }
  }

  const doUsdz = async (open: boolean) => {
    setBusyAr(true)
    try {
      const blob = await exportUsdz(panels, project.name)
      if (open) openQuickLook(blob, `${base}.usdz`)
      else downloadBlob(blob, `${base}.usdz`)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut generar l'USDZ", description: String(e), type: "error" })
    } finally {
      setBusyAr(false)
    }
  }

  /** Els dos fitxers del taller d'un cop (el navegador pot demanar permís per a descàrregues múltiples). */
  const doWorkshop = () => {
    doStep()
    if (nesting) setTimeout(doTopsolidCsv, 400)
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
        icon={<LuCuboid />}
        title="Taller (format TopSolid)"
        description="Els dos fitxers que el taller carrega a la seva pàgina de pujada: STEP amb els sòlids del moble i CSV de nesting amb peces, taulers, etiquetes, cantells i referències."
        files={`${base}.step · ${base}_res.csv`}
        action={
          <HStack gap={2} wrap="wrap">
            <Button colorPalette="wood" onClick={doWorkshop} disabled={!panels.length || !nesting}>
              <LuDownload /> Descarregar per al taller
            </Button>
            <Button size="sm" variant="ghost" onClick={doStep} disabled={!panels.length}>
              Només STEP
            </Button>
            <Button size="sm" variant="ghost" onClick={doTopsolidCsv} disabled={!nesting}>
              Només CSV
            </Button>
          </HStack>
        }
      />

      <ExportCard
        icon={<LuTag />}
        title="Etiquetes"
        description={`Una etiqueta per peça (ref, nom, mides, material i tauler) i, a les ${withProcess} peces que després del nesting passen per un altre procés (inglet, cantell, forats de cantell, encolar), una segona etiqueta amb el procés que els toca.`}
        files={`${base}-etiquetes.html · ${settings.label.w} × ${settings.label.h} mm`}
        action={
          <HStack gap={2} wrap="wrap">
            <Button variant="outline" onClick={printLabels} disabled={!panels.length}>
              <LuPrinter /> Imprimir etiquetes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => downloadText(labelHtml(), `${base}-etiquetes.html`, "text/html")} disabled={!panels.length}>
              Descarregar
            </Button>
          </HStack>
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
        <Switch.Root checked={labels} onCheckedChange={(e) => setLabels(e.checked)} size="sm">
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label>Etiquetes amb el nom de la peça (capa LABEL)</Switch.Label>
        </Switch.Root>
        <Switch.Root checked={dxf3d} onCheckedChange={(e) => setDxf3d(e.checked)} size="sm">
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label>3D: gruix de la peça i profunditat de forats i ranures (Z i extrusió)</Switch.Label>
        </Switch.Root>
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
        <PanelSection id="advanced" title="Avançat" icon={LuWrench}>
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
