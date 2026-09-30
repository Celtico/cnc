import { Badge, Button, Card, IconButton, Menu, Portal, Text, Wrap } from "@chakra-ui/react"
import { LuCheck, LuCopy, LuEllipsis, LuFolderInput, LuHouse, LuPencil, LuPlus, LuSave, LuTrash2 } from "react-icons/lu"
import { CompositionThumb } from "../../components/CompositionThumb"
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
  const date = new Date(project.updatedAt).toLocaleDateString("ca-ES", { day: "numeric", month: "short", year: "numeric" })
  const here = currentAmbient !== undefined && ambients.some((a) => a.id === currentAmbient)
  const click = onAdd ?? onOpen
  return (
    <Card.Root variant="outline" size="sm" _hover={{ borderColor: "wood.solid" }} borderColor={here ? "wood.solid" : undefined}>
      <Card.Body p={3} gap={2} cursor="pointer" onClick={click}>
        <CompositionThumb composition={comp} />
        <Text fontWeight="semibold" fontSize="sm" truncate title={project.name}>
          {project.name}
        </Text>
        <Text fontSize="xs" color="fg.muted" lineClamp={2}>
          {width} × {height} × {depth} mm ·{" "}
          {comp.modules.length === 1 ? `1 mòdul · ${first.material}` : `${comp.modules.length} mòduls: ${comp.modules.map((m) => m.name).join(", ")}`}
          {!project.composition && ` · ${p.shelves} ${p.shelves === 1 ? "prestatge" : "prestatges"} · ${p.doors} ${p.doors === 1 ? "porta" : "portes"}`}
        </Text>
        {(ambients.length > 0 || (!project.folder && isEdited(project))) && (
          <Wrap gap={1}>
            {/* A l'historial, els modificats porten la marca: esborrar-los perdria els canvis. */}
            {!project.folder && isEdited(project) && (
              <Badge size="xs" variant="subtle" colorPalette="orange" title="L'has modificat: guarda'l en un grup si el vols conservar">
                <LuPencil /> Modificat
              </Badge>
            )}
            {ambients.map((a) => (
              <Badge key={a.id} size="xs" variant={a.id === currentAmbient ? "solid" : "subtle"} colorPalette="wood" title={`És a l'ambient «${a.name}»`}>
                {a.id === currentAmbient ? <LuCheck /> : <LuHouse />} {a.name}
              </Badge>
            ))}
          </Wrap>
        )}
      </Card.Body>
      <Card.Footer px={3} pb={3} pt={0} gap={0.5} justifyContent="space-between">
        <Text fontSize="xs" color="fg.subtle" truncate>
          {date}
        </Text>
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
      </Card.Footer>
    </Card.Root>
  )
}
