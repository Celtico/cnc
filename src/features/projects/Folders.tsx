import { Accordion, Box, Button, Dialog, HStack, IconButton, Input, Menu, Portal, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { LuCircle, LuCircleCheck, LuEllipsis, LuFolder, LuFolderInput, LuFolderMinus, LuFolderPlus, LuListChecks, LuPencil, LuTrash2, LuX } from "react-icons/lu"
import { NameDialog } from "../../components/NameDialog"
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
  toolbar,
  selection,
  show = "all",
}: {
  /**
   * Què es mostra: tot, només els grups (secció «Projectes») o només els que no en tenen
   * (secció «Historial»). La selecció i «Grup nou» treballen amb el que es veu.
   */
  show?: "all" | "folders" | "loose"
  /** A la dreta de la fila d'eines (p. ex. «Esborrar l'historial»). */
  toolbar?: ReactNode
  /**
   * Seleccionar-ne diversos (botó «Seleccionar»): moure'ls tots a un grup o esborrar-los alhora.
   * `folders`: els grups que ja hi ha; `noun`: [singular, plural].
   */
  selection?: {
    noun: [string, string]
    folders: string[]
    onMove: (keys: (string | number)[], folder: string | undefined) => void
    onDelete?: (keys: (string | number)[]) => Promise<void>
  }
  items: T[]
  folderOf: (t: T) => string | undefined
  keyOf: (t: T) => string | number
  render: (t: T) => ReactNode
  storageKey: string
  searching?: boolean
  onRenameFolder: (from: string, to: string) => void
  onUngroup: (name: string) => void
}) {
  const grouped = groupByFolder(items, folderOf)
  const folders = show === "loose" ? [] : grouped.folders
  const loose = show === "folders" ? [] : grouped.loose
  const visible = [...folders.flatMap(([, l]) => l), ...loose]
  const [open, setOpen] = useSessionList(storageKey)
  const [renaming, setRenaming] = useState<string | null>(null)
  // Mode selecció: cada targeta es marca en tocar-la (no s'obre).
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Set<string | number>>(new Set())
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // «Grup nou»: primer el nom i després es trien les targetes que hi van.
  const [naming, setNaming] = useState(false)
  const [target, setTarget] = useState<string | null>(null)
  const stopPicking = () => (setPicking(false), setPicked(new Set()), setTarget(null))
  const toggle = (k: string | number) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  const n = picked.size
  const noun = selection ? (n === 1 ? selection.noun[0] : selection.noun[1]) : ""
  const cell = (t: T) => {
    const k = keyOf(t)
    if (!picking) return <Box key={k}>{render(t)}</Box>
    const on = picked.has(k)
    return (
      <Box key={k} position="relative">
        {render(t)}
        {/* Capa per sobre de la targeta: marcar-la en lloc d'obrir-la. */}
        <Box
          as="button"
          position="absolute"
          inset={0}
          rounded="lg"
          borderWidth="2px"
          borderColor={on ? "wood.solid" : "transparent"}
          bg={on ? "wood.solid/10" : "transparent"}
          _hover={{ bg: on ? "wood.solid/15" : "bg.muted/40" }}
          onClick={() => toggle(k)}
          aria-pressed={on}
          aria-label={on ? "Treure de la selecció" : "Seleccionar"}
        >
          <Box position="absolute" top={2} left={2} fontSize="xl" color={on ? "wood.solid" : "fg.muted"} bg="bg.panel" rounded="full" display="inline-flex">
            {on ? <LuCircleCheck /> : <LuCircle />}
          </Box>
        </Box>
      </Box>
    )
  }
  return (
    <Stack gap={3}>
      {(toolbar || selection) && (
        // Barra d'eines en una franja suau; dins dels acordions de les galeries, a sang (`.gallery-toolbar`, layout.css).
        <HStack className="gallery-toolbar" justify="flex-start" gap={1} wrap="wrap" bg="bg.muted" rounded="md" px={1} py={1}>
          {picking && selection ? (
            <>
              <Text fontSize="sm" color="fg.muted" mr="auto">
                {target && !n ? `Toca els que van al grup «${target}»` : n ? `${n} ${noun} seleccionat${n === 1 ? "" : "s"}` : "Toca les targetes per seleccionar-les"}
              </Text>
              <Button size="xs" variant="ghost" onClick={() => setPicked(new Set(visible.map(keyOf)))}>
                Tots
              </Button>
              {target ? (
                <Button
                  size="xs"
                  colorPalette="wood"
                  disabled={!n}
                  onClick={() => {
                    selection.onMove([...picked], target)
                    stopPicking()
                  }}
                >
                  <LuFolderInput /> Posar a «{target}»
                </Button>
              ) : (
                <Button size="xs" variant="outline" disabled={!n} onClick={() => setMoving(true)}>
                  <LuFolderInput /> Moure a un grup…
                </Button>
              )}
              {!target && selection.onDelete && (
                <Button size="xs" variant="ghost" colorPalette="red" disabled={!n} onClick={() => setDeleting(true)}>
                  <LuTrash2 /> Esborrar
                </Button>
              )}
              <IconButton size="xs" variant="ghost" aria-label="Acabar la selecció" title="Acabar la selecció" onClick={stopPicking}>
                <LuX />
              </IconButton>
            </>
          ) : (
            <>
              {selection && (
                <Button size="xs" variant="ghost" onClick={() => setNaming(true)}>
                  <LuFolderPlus /> Grup nou
                </Button>
              )}
              {selection && visible.length > 1 && (
                <Button size="xs" variant="ghost" onClick={() => setPicking(true)}>
                  <LuListChecks /> Seleccionar
                </Button>
              )}
              {toolbar}
            </>
          )}
        </HStack>
      )}
      {folders.length > 0 && (
        <Accordion.Root multiple collapsible lazyMount variant="plain" value={searching ? folders.map((f) => f[0]) : open} onValueChange={(e) => !searching && setOpen(e.value)}>
          {folders.map(([name, list]) => (
            <Accordion.Item key={name} value={name}>
              {/* Línia sota cada grup (com les categories del catàleg): el que hi ha a dins no queda penjat. */}
              <HStack gap={1} borderBottomWidth="1px">
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
                    {list.map(cell)}
                  </SimpleGrid>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      )}
      {loose.length > 0 && (
        <SimpleGrid columns={GALLERY_COLS} gap={3}>
          {loose.map(cell)}
        </SimpleGrid>
      )}
      {selection && (
        <>
          <MoveToFolderDialog
            open={moving}
            what={`${n} ${noun}`}
            folders={selection.folders}
            current={(() => {
              // Si tots són del mateix grup, es pot «Treure del grup».
              const fs = new Set(visible.filter((t) => picked.has(keyOf(t))).map(folderOf))
              return fs.size === 1 ? [...fs][0] : undefined
            })()}
            onPick={(f) => {
              selection.onMove([...picked], f)
              stopPicking()
            }}
            onClose={() => setMoving(false)}
          />
          <Dialog.Root role="alertdialog" open={deleting} onOpenChange={(e) => !e.open && setDeleting(false)}>
            <Portal>
              <Dialog.Backdrop />
              <Dialog.Positioner>
                <Dialog.Content>
                  <Dialog.Header>
                    <Dialog.Title>Esborrar {n} {noun}?</Dialog.Title>
                  </Dialog.Header>
                  <Dialog.Body>
                    <Text>No es pot desfer.</Text>
                  </Dialog.Body>
                  <Dialog.Footer>
                    <Button variant="outline" onClick={() => setDeleting(false)}>
                      Cancel·lar
                    </Button>
                    <Button
                      colorPalette="red"
                      onClick={async () => {
                        await selection.onDelete?.([...picked])
                        setDeleting(false)
                        stopPicking()
                      }}
                    >
                      <LuTrash2 /> Esborrar
                    </Button>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog.Positioner>
            </Portal>
          </Dialog.Root>
        </>
      )}
      <NameDialog
        ariaLabel="Nom del grup"
        open={naming}
        title="Grup nou"
        initial=""
        placeholder="P. ex. el nom d'un client o d'un projecte"
        onClose={() => setNaming(false)}
        onSave={(name) => {
          setNaming(false)
          if (!name) return
          setTarget(name)
          setPicking(true)
        }}
      />
      <NameDialog
        ariaLabel="Nom del grup"
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
