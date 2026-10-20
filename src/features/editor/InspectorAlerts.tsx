import { Alert, Badge, Button, Stack, Text } from "@chakra-ui/react"
import { useMemo } from "react"
import { LuCheck, LuCrosshair, LuDoorOpen, LuTriangleAlert, LuUndo2 } from "react-icons/lu"
import { fixLabel, placeLabel, warningKey } from "./warningTarget"
import { FoldItem } from "../../components/Fold"
import type { CompositionWarning } from "../../core/build/buildComposition"
import type { FixPlaceKey } from "../../core/build/buildModule"
import type { Composition, Module } from "../../core/model"
import type { Project } from "../../db/db"
import { ESTIMATED_WARNING, estimatedApplied } from "../photo/appliedState"
import type { Selection } from "../composition/StructureTree"
import { NO_WARNINGS, type SceneData } from "./useSceneData"

/** Avisos que només informen (no cal arreglar res). */
export const INFO = (w: CompositionWarning) => !!w.info || w.code === "material-heat" || w.code === "mitre" || w.code === "push" || w.code === "shelf-strut" || (w.code === "inset" && w.message.startsWith("Fronts"))

/**
 * Avisos al peu de l'inspector: mesures estimades de la foto, xocs de l'obertura i avisos de fusteria de la selecció.
 * Cada avís porta «Anar-hi» (i on s'arregla, si en té un lloc): el mostra al 3D i obre la secció.
 */
export function InspectorAlerts({
  comp,
  selection,
  module,
  warnings,
  collisions,
  photo,
  onGoto,
  setComp,
}: {
  comp: Composition
  selection: Selection
  module: Module | undefined
  warnings: CompositionWarning[]
  collisions: SceneData["collisions"]
  photo: Project["photo"]
  /** Anar a un avís: el mostra al 3D i obre on s'arregla (`warningTarget`). */
  onGoto?: (w: CompositionWarning, where?: FixPlaceKey) => void
  /** Per acceptar un avís que es resol a mà («Ho faig a mà», `Composition.acceptedWarnings`). */
  setComp?: (f: (c: Composition) => Composition) => void
}) {
  const accepted = useMemo(() => new Set(comp.acceptedWarnings ?? []), [comp.acceptedWarnings])
  const toggleAccept = (w: CompositionWarning) => {
    const k = warningKey(w)
    setComp?.((c) => {
      const cur = c.acceptedWarnings ?? []
      const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]
      return { ...c, acceptedWarnings: next.length ? next : undefined }
    })
  }
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

  // Per mòdul (amb el nom com a títol, si n'hi ha més d'un), primer els que cal arreglar i després els informatius; els
  // repetits (el mateix avís al mateix mòdul) un sol cop amb «× n».
  const groups = useMemo(() => {
    const byKey = new Map<string, { title: string | null; items: { w: CompositionWarning; count: number; info: boolean; accepted: boolean }[] }>()
    const many = comp.modules.length > 1
    for (const w of moduleWarnings) {
      const key = w.moduleId ?? "moble"
      const title = many ? (w.moduleId ? (comp.modules.find((m) => m.id === w.moduleId)?.name ?? "Mòdul") : "Moble") : null
      const g = byKey.get(key) ?? { title, items: [] }
      byKey.set(key, g)
      const same = g.items.find((x) => x.w.code === w.code && x.w.message === w.message)
      if (same) same.count += 1
      else {
        const ok = accepted.has(warningKey(w))
        g.items.push({ w, count: 1, info: ok || INFO(w), accepted: ok })
      }
    }
    const out = [...byKey.entries()].map(([key, g]) => ({ key, ...g, items: [...g.items.filter((x) => !x.info), ...g.items.filter((x) => x.info)] }))
    // Els mòduls amb avisos per arreglar, primer.
    return [...out.filter((g) => g.items.some((x) => !x.info)), ...out.filter((g) => g.items.every((x) => x.info))]
  }, [moduleWarnings, comp.modules, accepted])
  // El número de la secció: només els que cal arreglar (no els informatius ni els acceptats).
  const toFix = groups.reduce((n, g) => n + g.items.filter((x) => !x.info).reduce((a, x) => a + x.count, 0), 0)

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
        <FoldItem id="warnings" title="Avisos de fusteria" icon={LuTriangleAlert} badge={toFix || undefined} badgePalette="orange">
          {groups.map((g) => (
            <Stack key={g.key} gap={2}>
              {g.title && (
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide" pt={1}>
                  {g.title}
                </Text>
              )}
              {g.items.map(({ w, count, info, accepted: ok }, i) => (
                <Alert.Root key={i} status={info ? "info" : "warning"} size="sm">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      {w.message}
                      {count > 1 && (
                        <Badge size="xs" colorPalette="orange" ml={2}>
                          × {count}
                        </Badge>
                      )}
                      {ok && (
                        <Text as="span" display="block" mt={1} fontWeight="semibold">
                          Ho fas a mà.
                        </Text>
                      )}
                      {w.options?.length && !ok ? (
                        <Stack as="ul" gap={1} mt={2} ps={4} listStyleType="disc">
                          <Text as="span" fontWeight="semibold" ms={-4}>Com es pot arreglar:</Text>
                          {w.options.map((o, k) => (
                            <li key={k}>
                              {o.text}
                              {o.where && onGoto && (
                                <Button size="xs" variant="plain" ml={1} colorPalette="wood" onClick={() => onGoto(w, o.where)}>
                                  <LuCrosshair /> {placeLabel(o.where)}
                                </Button>
                              )}
                            </li>
                          ))}
                        </Stack>
                      ) : null}
                      {onGoto && (() => {
                        const fix = fixLabel(w)
                        return (
                          <Button size="xs" variant="plain" ml={2} colorPalette="wood" onClick={() => onGoto(w)} title="Mostra-ho al 3D i obre on s'arregla">
                            <LuCrosshair /> Anar-hi{fix ? ` · ${fix}` : ""}
                          </Button>
                        )
                      })()}
                      {setComp && w.options?.length && !INFO(w) ? (
                        <Button size="xs" variant="plain" ml={2} colorPalette="wood" onClick={() => toggleAccept(w)} title={ok ? "Torna a comptar-lo com a avís" : "Ja ho resoldràs a mà: deixa de comptar com a avís"}>
                          {ok ? <LuUndo2 /> : <LuCheck />} {ok ? "Desfer" : "Ho faig a mà"}
                        </Button>
                      ) : null}
                    </Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              ))}
            </Stack>
          ))}
        </FoldItem>
      )}
    </>
  )
}
