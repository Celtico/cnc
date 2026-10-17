import { Alert, Button, HStack, Stack, Text } from "@chakra-ui/react"
import { LuFactory, LuMonitorCog } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import type { Machine } from "../../core/model"
import { ExportCard } from "./ExportCard"
import { PostCncList } from "./PostCncList"
import type { MaestroPrograms } from "./useMaestroPrograms"
import { fmtNum } from "../../lib/format"

/** Mm amb coma decimal (com a la resta de la UI). */

/** Targeta de la màquina CNC (Maestro): programes .xcs, Vista CAM, avisos i el que toca després de la CNC. */
export function MaestroCard({ base, machine, xcs, onXcs, onCam }: { base: string; machine: Machine | undefined; xcs: MaestroPrograms | null; onXcs: () => void; onCam: () => void }) {
  return (
    <ExportCard
      highlight
      icon={<LuFactory />}
      title="Màquina CNC (Maestro)"
      description="L'exportació principal: programes de Xilog Maestro (.xcs) per a la SCM del taller, sense passar per TopSolid. Un programa per tauler del nesting (el Maestro no en fa) amb totes les peces: forats, ranures, talls i contorns com a mecanitzats de debò amb les eines de la màquina (cara A; forats de cantell, cara B i inglets després). BETA: fins que el taller no els validi a Maestro, revisa'ls a la Vista CAM (aquí) i al Maestro abans de mecanitzar."
      files={machine ? `${base}-maestro.zip · ${xcs?.programs ?? 0} programes (${xcs?.sheets ?? 0} taulers) per a ${machine.name}` : undefined}
      action={
        <HStack gap={2} wrap="wrap">
          <Button colorPalette="wood" onClick={onXcs} disabled={!xcs || !xcs.programs}>
            <LuFactory /> Programes .xcs
          </Button>
          <Button variant="outline" onClick={onCam} disabled={!xcs || !xcs.programs}>
            <LuMonitorCog /> Vista CAM
          </Button>
        </HStack>
      }
    >
      {machine && xcs && (
        <Text fontSize="sm" color="fg.muted">
          Separació entre peces {fmtNum(xcs.spacing)} mm
          {xcs.spacingTool ? ` (Ø${fmtNum(xcs.spacingTool.diameter)} + ${fmtNum(xcs.spacing - xcs.spacingTool.diameter)}, la fresa de contorn més grossa)` : ""}; marge del tauler, martiri i
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
        <FoldItem id="export-after-cnc" variant="nested" title="Després de la CNC" count={xcs.postProcessPanels}>
          <PostCncList rows={xcs.rows} />
        </FoldItem>
      )}
    </ExportCard>
  )
}
