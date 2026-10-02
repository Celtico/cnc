import { Badge, Button, IconButton, Menu, Portal, Text } from "@chakra-ui/react"
import { LuCheck, LuCopy, LuEllipsis, LuFolderInput, LuHouse, LuPencil, LuPlus, LuSave, LuTrash2 } from "react-icons/lu"
import { useEffect } from "react"
import { CardDate, GalleryCard } from "./GalleryCard"
import { SnapshotThumb } from "../../components/SnapshotThumb"
import { useSettings } from "../settings/SettingsContext"
import { needsThumb, requestProjectThumb } from "./projectThumbs"
import { compositionHeight, compositionWidth } from "../../core/model"
import { compositionOf } from "../../db/compositionStore"
import { isEdited, safeParams, type Project } from "../../db/db"

/**
 * Targeta d'un moble (historial de la pàgina Mobles i finestra «Afegir un moble» dels ambients):
 * la mateixa mida que les de plantilla. Marca els ambients on és (el de l'ambient obert, destacat).
 * Amb `onAdd` (triar per a un ambient) el botó és «Afegir»; si no, les accions del moble.
 */
export function ProjectCard({
  project,
  onOpen,
  onDuplicate,
  onDelete,
  onSaveFile,
  onMove,
  onAdd,
  ambients = [],
  currentAmbient,
}: {
  project: Project
  onOpen?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onSaveFile?: () => void
  /** Moure a un grup (carpeta) de l'historial. */
  onMove?: () => void
  onAdd?: () => void
  /** Ambients on hi ha aquest moble. */
  ambients?: { id: number; name: string }[]
  /** Ambient obert (triant): si el moble ja hi és, es marca. */
  currentAmbient?: number
}) {
  const p = safeParams(project.params)
  const comp = compositionOf(project)
  const first = comp.modules[0]!.carcass
  const width = Math.round(compositionWidth(comp))
  const height = Math.round(compositionHeight(comp))
  const depth = Math.max(...comp.modules.map((m) => m.carcass.depth))
  const here = currentAmbient !== undefined && ambients.some((a) => a.id === currentAmbient)
  const click = onAdd ?? onOpen
  const { settings } = useSettings()
  // En desmuntar-se, la feina de la cua se salta si cap altra targeta la vol.
  useEffect(() => (needsThumb(project) ? requestProjectThumb(project, settings.materials) : undefined), [project, settings.materials])
  return (
    <GalleryCard
      thumb={<SnapshotThumb src={project.thumb} />}
      title={project.name}
      description={
        <>
          {width} × {height} × {depth} mm ·{" "}
          {comp.modules.length === 1 ? `1 mòdul · ${first.material}` : `${comp.modules.length} mòduls: ${comp.modules.map((m) => m.name).join(", ")}`}
          {!project.composition && ` · ${p.shelves} ${p.shelves === 1 ? "prestatge" : "prestatges"} · ${p.doors} ${p.doors === 1 ? "porta" : "portes"}`}
        </>
      }
      tags={
        (ambients.length > 0 || (!project.folder && isEdited(project))) && (
          <>
            {/* A l'historial, els modificats porten la marca: esborrar-los perdria els canvis. */}
            {!project.folder && isEdited(project) && (
              <Badge size="xs" variant="subtle" colorPalette="orange" title="L'has modificat: guarda'l en un grup si el vols conservar">
                <LuPencil /> Modificat
              </Badge>
            )}
            {/* Cada ambient on és: retallat amb punts suspensius (no desborda la targeta) i, fora de l'ambient obert, un
                enllaç que hi porta. */}
            {ambients.map((a) => {
              const here = a.id === currentAmbient
              return (
                <Badge
                  key={a.id}
                  asChild={!here}
                  size="xs"
                  variant={here ? "solid" : "subtle"}
                  colorPalette="wood"
                  maxW="full"
                  minW={0}
                  title={here ? `És a l'ambient «${a.name}»` : `Obrir l'ambient «${a.name}»`}
                  cursor={here ? undefined : "pointer"}
                  _hover={here ? undefined : { textDecoration: "underline" }}
                >
                  {here ? (
                    <>
                      <LuCheck />
                      <Text as="span" truncate>{a.name}</Text>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.dispatchEvent(new CustomEvent("mobles:open-ambient", { detail: a.id }))
                      }}
                    >
                      <LuHouse />
                      <Text as="span" truncate>{a.name}</Text>
                    </button>
                  )}
                </Badge>
              )
            })}
          </>
        )
      }
      selected={here}
      onClick={click}
      footer={
        <>
          <CardDate at={project.updatedAt} />
        {onAdd ? (
          <Button size="xs" colorPalette="wood" variant={here ? "outline" : "solid"} onClick={onAdd}>
            <LuPlus /> {here ? "Afegir-ne un altre" : "Afegir"}
          </Button>
        ) : (
          (onSaveFile || onDuplicate || onDelete || onMove) && (
            // Les accions del document en un menú ⋯, com a «Les teves plantilles» i als ambients.
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <IconButton aria-label={`Opcions de «${project.name}»`} size="xs" variant="ghost">
                  <LuEllipsis />
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    {onSaveFile && (
                      <Menu.Item value="file" onClick={onSaveFile}>
                        <LuSave /> Desar com a fitxer
                      </Menu.Item>
                    )}
                    {onDuplicate && (
                      <Menu.Item value="dup" onClick={onDuplicate}>
                        <LuCopy /> Duplicar
                      </Menu.Item>
                    )}
                    {onMove && (
                      <Menu.Item value="move" onClick={onMove}>
                        <LuFolderInput /> Moure a un grup…
                      </Menu.Item>
                    )}
                    {onDelete && (
                      <>
                        <Menu.Separator />
                        <Menu.Item value="del" color="fg.error" onClick={onDelete}>
                          <LuTrash2 /> Esborrar
                        </Menu.Item>
                      </>
                    )}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          )
        )}
        </>
      }
    />
  )
}
