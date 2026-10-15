import { Alert, Stack, Text } from "@chakra-ui/react"
import type { Nesting } from "../../core/nesting/nest"
import { ESTIMATED_WARNING, type estimatedApplied } from "../photo/appliedState"

/** Avisos de dalt d'Exportar: mides estimades, peces que no caben, materials i STEP. */
export function ExportAlerts({
  estimated,
  nesting,
  matIssues,
  stepWarnings,
}: {
  estimated: ReturnType<typeof estimatedApplied>
  nesting: Nesting | undefined
  matIssues: { message: string }[]
  stepWarnings: string[]
}) {
  return (
    <>
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

      {matIssues.length > 0 && (
        <Alert.Root status="warning" size="sm">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Materials que no lliguen amb Preferències</Alert.Title>
            <Alert.Description>
              <Stack as="ul" gap={0.5} mt={1} ps={4} listStyleType="disc">
                {matIssues.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </Stack>
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

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
    </>
  )
}
