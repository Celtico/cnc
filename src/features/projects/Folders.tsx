import { Accordion, Box, Button, Dialog, HStack, IconButton, Input, Menu, Portal, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useEffect, useState, type ReactNode } from "react"
import { LuEllipsis, LuFolder, LuFolderMinus, LuFolderPlus, LuPencil } from "react-icons/lu"
import { FoldTitle } from "./FoldTitle"
import { GALLERY_COLS, groupByFolder, useSessionList } from "./galleryGrid"

/**
 * Graella amb grups (carpetes), la mateixa a l'historial de Mobles, Objectes i Ambients i a «Les
 * teves plantilles»: primer els grups (plegables, amb el nombre i el menú ⋯ per canviar-ne el nom o
 * desagrupar) i després els que no en tenen. Amb una cerca activa, els grups amb resultats s'obren.
 */
export function FolderedGrid<T>({
  items,
  folderOf,
  keyOf,
  render,
  storageKey,
  searching,
  onRenameFolder,
  onUngroup,
}: {
  items: T[]
  folderOf: (t: T) => string | undefined
  keyOf: (t: T) => string | number
  render: (t: T) => ReactNode
  storageKey: string
  searching?: boolean
  onRenameFolder: (from: string, to: string) => void
  onUngroup: (name: string) => void
}) {
  const { folders, loose } = groupByFolder(items, folderOf)
  const [open, setOpen] = useSessionList(storageKey)
  const [renaming, setRenaming] = useState<string | null>(null)
  return (
    <Stack gap={3}>
      {folders.length > 0 && (
        <Accordion.Root multiple collapsible lazyMount variant="plain" value={searching ? folders.map((f) => f[0]) : open} onValueChange={(e) => !searching && setOpen(e.value)}>
          {folders.map(([name, list]) => (
            <Accordion.Item key={name} value={name}>
              <HStack gap={1}>
                <Accordion.ItemTrigger cursor="pointer" flex={1}>
                  <FoldTitle icon={<LuFolder />} title={name} count={list.length} />
                  <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Menu.Root positioning={{ placement: "bottom-end" }}>
                  <Menu.Trigger asChild>
                    <IconButton aria-label={`Opcions del grup «${name}»`} size="xs" variant="ghost">
                      <LuEllipsis />
                    </IconButton>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content>
                        <Menu.Item value="rename" onClick={() => setRenaming(name)}>
                          <LuPencil /> Canviar el nom
                        </Menu.Item>
                        <Menu.Item value="ungroup" onClick={() => onUngroup(name)}>
                          <LuFolderMinus /> Desagrupar
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              </HStack>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  <SimpleGrid columns={GALLERY_COLS} gap={3}>
                    {list.map((t) => (
                      <Box key={keyOf(t)}>{render(t)}</Box>
                    ))}
                  </SimpleGrid>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      )}
      {loose.length > 0 && (
        <SimpleGrid columns={GALLERY_COLS} gap={3}>
          {loose.map((t) => (
            <Box key={keyOf(t)}>{render(t)}</Box>
          ))}
        </SimpleGrid>
      )}
      <FolderNameDialog
        open={renaming !== null}
        title="Canviar el nom del grup"
        initial={renaming ?? ""}
        onClose={() => setRenaming(null)}
        onSave={(to) => {
          if (renaming && to && to !== renaming) onRenameFolder(renaming, to)
          setRenaming(null)
        }}
      />
    </Stack>
  )
}

/** Diàleg «Moure a un grup»: un dels grups que ja hi ha, un de nou o treure'l del grup. */
export function MoveToFolderDialog({ open, what, folders, current, onPick, onClose }: { open: boolean; what: string; folders: string[]; current?: string; onPick: (folder: string | undefined) => void; onClose: () => void }) {
  const [name, setName] = useState("")
  const pick = (f: string | undefined) => {
    onPick(f)
    setName("")
    onClose()
  }
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="sm">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Moure «{what}» a un grup</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                {folders.length > 0 && (
                  <Stack gap={1}>
                    {folders.map((f) => (
                      <Button key={f} variant={f === current ? "subtle" : "ghost"} colorPalette={f === current ? "wood" : undefined} justifyContent="flex-start" onClick={() => pick(f)}>
                        <LuFolder /> {f}
                      </Button>
                    ))}
                  </Stack>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (name.trim()) pick(name.trim())
                  }}
                >
                  <HStack>
                    <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Grup nou (p. ex. Casa de la platja)" aria-label="Nom del grup nou" />
                    <Button size="sm" type="submit" colorPalette="wood" disabled={!name.trim()}>
                      <LuFolderPlus /> Crear
                    </Button>
                  </HStack>
                </form>
                {!folders.length && (
                  <Text fontSize="xs" color="fg.muted">
                    Encara no hi ha cap grup: escriu-ne el nom per crear-lo.
                  </Text>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              {current && (
                <Button variant="ghost" mr="auto" onClick={() => pick(undefined)}>
                  <LuFolderMinus /> Treure del grup
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

function FolderNameDialog({ open, title, initial, onClose, onSave }: { open: boolean; title: string; initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [v, setV] = useState(initial)
  useEffect(() => {
    if (open) setV(initial)
  }, [open, initial])
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="sm">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                onSave(v.trim())
              }}
            >
              <Dialog.Header>
                <Dialog.Title>{title}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Input value={v} onChange={(e) => setV(e.target.value)} aria-label="Nom del grup" autoFocus />
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={onClose}>
                  Cancel·lar
                </Button>
                <Button type="submit" colorPalette="wood" disabled={!v.trim()}>
                  Desar
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
