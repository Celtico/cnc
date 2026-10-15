import { Alert, Button } from "@chakra-ui/react"
import { useMemo } from "react"
import { LuDoorOpen, LuTriangleAlert } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import type { CompositionWarning } from "../../core/build/buildComposition"
import type { Composition, Module } from "../../core/model"
import type { Project } from "../../db/db"
import { ESTIMATED_WARNING, estimatedApplied } from "../photo/appliedState"
import type { Selection } from "../composition/StructureTree"
import { NO_WARNINGS, type SceneData } from "./useSceneData"

/** Avisos al peu de l'inspector: mesures estimades de la foto, xocs de l'obertura i avisos de fusteria de la selecció. */
export function InspectorAlerts({
  comp,
  selection,
  select,
  module,
  warnings,
  collisions,
  photo,
}: {
  comp: Composition
  selection: Selection
  select: (s: Selection) => void
  module: Module | undefined
  warnings: CompositionWarning[]
  collisions: SceneData["collisions"]
  photo: Project["photo"]
}) {
  // Mesures de la foto aplicades al moble que encara són estimades.
  const estimated = useMemo(() => estimatedApplied(photo), [photo])
  // Avisos de la selecció: del mòdul (inclosos els xocs d'objectes amb les seves peces),
  // de l'objecte de referència seleccionat, o tots si és el moble.
  const moduleWarnings =
    selection.kind === "module" || selection.kind === "zone"
      ? warnings.filter((w) => !w.moduleId || w.moduleId === module?.id)
      : selection.kind === "ref"
        ? warnings.filter((w) => w.refId === selection.id)
        : selection.kind === "part"
          ? warnings.filter((w) => w.partId === selection.id)
          : selection.kind === "model" || selection.kind === "hardware"
            ? NO_WARNINGS
            : warnings

  return (
    <>
      {estimated.length > 0 && (
        <Alert.Root status="warning" size="sm" mt={3}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{ESTIMATED_WARNING}</Alert.Title>
            <Alert.Description>Basat en la foto: {estimated.map((a) => a.label).join(", ")}. Mesura-ho amb cinta abans de tallar.</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      {collisions.length > 0 && (
        <FoldItem id="collisions" title="Amb l'obertura actual" icon={LuDoorOpen} defaultOpen badge={collisions.length} badgePalette="orange">
          {collisions.map((c) => (
            <Alert.Root key={c.groupId} status="warning" size="sm">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{c.message}</Alert.Description>
              </Alert.Content>
            </Alert.Root>
          ))}
        </FoldItem>
      )}

      {moduleWarnings.length > 0 && (
        <FoldItem id="warnings" title="Avisos de fusteria" icon={LuTriangleAlert} badge={moduleWarnings.length} badgePalette="orange">
          {moduleWarnings.map((w, i) => (
            <Alert.Root key={i} status={w.code === "material-heat" || w.code === "mitre" || w.code === "push" || (w.code === "inset" && w.message.startsWith("Fronts")) ? "info" : "warning"} size="sm">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>
                  {w.moduleId && comp.modules.length > 1 ? `${comp.modules.find((m) => m.id === w.moduleId)?.name ?? ""}: ` : ""}
                  {w.message}
                  {w.refId && selection.kind !== "ref" && (
                    <Button size="xs" variant="plain" ml={2} onClick={() => select({ kind: "ref", id: w.refId! })}>
                      Veure l'objecte
                    </Button>
                  )}
                  {w.zoneId && (
                    <Button
                      size="xs"
                      variant="plain"
                      ml={2}
                      onClick={() => {
                        const moduleId = w.moduleId ?? module?.id
                        if (moduleId) select({ kind: "zone", moduleId, zoneId: w.zoneId! })
                      }}
                    >
                      Anar-hi
                    </Button>
                  )}
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>
          ))}
        </FoldItem>
      )}
    </>
  )
}
