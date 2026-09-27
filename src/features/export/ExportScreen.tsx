import { Button, Card, HStack, Heading, SimpleGrid, Switch, Text, VStack } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { LuBox, LuDownload, LuFileCode, LuFileSpreadsheet, LuFileJson, LuScan } from "react-icons/lu"
import { PanelDrawing } from "../../components/PanelDrawing"
import { exportGlb } from "../../components/viewer/exportGlb"
import { exportUsdz, openQuickLook, supportsQuickLook } from "../../components/viewer/exportUsdz"
import { toaster } from "../../components/ui/toaster"
import { toCutList } from "../../core/cutlist/toCutList"
import { cutListToCsv } from "../../core/export/csv"
import { dxfLayers, toDxf } from "../../core/export/dxf"
import { toUnifiedData } from "../../core/export/unified"
import { downloadBlob, downloadText, slugify } from "../download"
import { useCompositionPanels, useNesting, useProject } from "../useProject"

export function ExportScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  const panels = useCompositionPanels(project)
  const nesting = useNesting(panels, project?.nesting)
  const [labels, setLabels] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyAr, setBusyAr] = useState(false)
  const quickLook = supportsQuickLook()
  const layers = useMemo(() => dxfLayers(panels, labels), [panels, labels])

  if (!project) return null
  const base = slugify(project.name)

  const doDxf = () => {
    downloadText(toDxf(panels, { labels }), `${base}.dxf`, "application/dxf")
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

  return (
    <VStack align="stretch" gap={6}>
      <Heading size="xl">Exportar «{project.name}»</Heading>

      <Card.Root variant="outline" bg="wood.subtle">
        <Card.Body gap={3}>
          <HStack color="wood.fg" fontSize="xl">
            <LuScan />
            <Card.Title fontSize="md">Veure'l al racó amb AR</Card.Title>
          </HStack>
          <Card.Description>
            {quickLook
              ? "Obre el moble a mida real amb AR Quick Look: apunta la càmera al terra on ha d'anar i mou-lo amb el dit."
              : "L'AR Quick Look funciona amb Safari a l'iPhone o l'iPad. Aquí pots descarregar l'USDZ i obrir-lo des de Fitxers."}
          </Card.Description>
        </Card.Body>
        <Card.Footer gap={2} flexWrap="wrap">
          {quickLook && (
            <Button colorPalette="wood" onClick={() => void doUsdz(true)} loading={busyAr}>
              <LuScan /> Veure en AR
            </Button>
          )}
          <Button variant="outline" onClick={() => void doUsdz(false)} loading={busyAr}>
            <LuDownload /> Descarregar USDZ
          </Button>
        </Card.Footer>
      </Card.Root>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <ExportCard
          icon={<LuFileCode />}
          title="DXF per a la CNC"
          description="R12 ASCII. Una peça per bloc, contorn a CONTOUR i forats per diàmetre i profunditat (DRILL_D5_P12, DRILL_D35_P13…)."
          action={
            <Button colorPalette="wood" onClick={doDxf}>
              <LuDownload /> Descarregar DXF
            </Button>
          }
        >
          <Switch.Root checked={labels} onCheckedChange={(e) => setLabels(e.checked)} size="sm">
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>Etiquetes amb el nom (capa LABEL)</Switch.Label>
          </Switch.Root>
          <HStack wrap="wrap" gap={1}>
            {layers.map((l) => (
              <Text key={l} fontSize="xs" fontFamily="mono" px={1.5} py={0.5} bg="bg.muted" rounded="sm">
                {l}
              </Text>
            ))}
          </HStack>
        </ExportCard>

        <ExportCard
          icon={<LuFileSpreadsheet />}
          title="CSV de peces"
          description="Llista agrupada amb mides, quantitat, material, veta i cantells. Separador «;» i decimal amb coma."
          action={
            <Button variant="outline" onClick={doCsv}>
              <LuDownload /> Descarregar CSV
            </Button>
          }
        />

        <ExportCard
          icon={<LuBox />}
          title="GLB (3D)"
          description="Model del moble en metres, per a visors 3D i com a base per a l'AR."
          action={
            <Button variant="outline" onClick={doGlb} loading={busy}>
              <LuDownload /> Descarregar GLB
            </Button>
          }
        />

        <ExportCard
          icon={<LuFileJson />}
          title="JSON del taller (UnifiedData)"
          description={`Contracte de taller-cnc-nest amb peces, sòlids, mecanitzats, unions i el nesting actual (${nesting?.boards.length ?? 0} taulers).`}
          action={
            <Button variant="outline" onClick={doJson}>
              <LuDownload /> Descarregar JSON
            </Button>
          }
        />
      </SimpleGrid>

      <VStack align="stretch" gap={3}>
        <Heading size="md">Plànols de les peces</Heading>
        <Text fontSize="sm" color="fg.muted">
          El que anirà al DXF, vist des de la cara mecanitzada. Cercles plens: forats de cara. Cercles
          discontinus: forats de cantell. Línia gruixuda: cantell folrat.
        </Text>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={4}>
          {panels.map((p) => (
            <Card.Root key={p.id} variant="subtle" size="sm">
              <Card.Body>
                <PanelDrawing panel={p} />
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>
      </VStack>
    </VStack>
  )
}

function ExportCard({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <Card.Root variant="outline">
      <Card.Body gap={3}>
        <HStack color="wood.fg" fontSize="xl">
          {icon}
          <Card.Title fontSize="md">{title}</Card.Title>
        </HStack>
        <Card.Description>{description}</Card.Description>
        {children}
      </Card.Body>
      <Card.Footer>{action}</Card.Footer>
    </Card.Root>
  )
}
