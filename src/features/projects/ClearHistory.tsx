import { Alert, Button, Dialog, Portal, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuTrash2 } from "react-icons/lu"

/**
 * «Esborrar» de l'Historial (el mateix a Mobles, Objectes i Ambients; el `title` diu «Esborrar l'historial»): botó a la fila d'eines de
 * l'historial (`FolderedGrid toolbar`) i confirmació amb quants se n'esborraran i quants es
 * conserven (els que són en un ambient). Si n'hi ha de **modificats**, avisa que es perdrien els
 * canvis i deixa esborrar només els que no s'han tocat.
 */
export function ClearHistory({
  count,
  kept = 0,
  noun,
  keptNote,
  edited = [],
  onConfirm,
  onConfirmUnedited,
}: {
  count: number
  kept?: number
  noun: [string, string]
  keptNote?: string
  /** Noms dels que s'esborrarien i s'han modificat. */
  edited?: string[]
  onConfirm: () => Promise<void>
  /** Esborrar només els que no s'han modificat. */
  onConfirmUnedited?: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<"all" | "unedited" | null>(null)
  if (!count && !kept) return null
  const n = (k: number) => `${k} ${k === 1 ? noun[0] : noun[1]}`
  const run = async (which: "all" | "unedited", f: () => Promise<void>) => {
    setBusy(which)
    try {
      await f()
    } finally {
      setBusy(null)
      setOpen(false)
    }
  }
  const shown = edited.slice(0, 4).map((x) => `«${x}»`).join(", ") + (edited.length > 4 ? ` i ${edited.length - 4} més` : "")
  return (
    <>
      <Button size="xs" variant="ghost" colorPalette="red" title="Esborrar l'historial" onClick={() => setOpen(true)} disabled={!count}>
        <LuTrash2 /> Esborrar
      </Button>
      <Dialog.Root role="alertdialog" open={open} onOpenChange={(e) => !e.open && setOpen(false)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Esborrar l'historial?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body display="flex" flexDirection="column" gap={3}>
                <Text>
                  S'esborraran {n(count)}. No es pot desfer.
                  {kept > 0 && keptNote ? ` ${keptNote.replace("{n}", n(kept))}` : ""}
                </Text>
                {edited.length > 0 && (
                  <Alert.Root status="warning" size="sm">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>
                        {edited.length === 1 ? "N'has modificat 1" : `N'has modificat ${edited.length}`}: {shown}
                      </Alert.Title>
                      <Alert.Description>Si no els deses en un grup (menú ⋯ › «Moure a un grup…»), perdràs les modificacions.</Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel·lar
                </Button>
                {edited.length > 0 && onConfirmUnedited && edited.length < count && (
                  <Button colorPalette="wood" loading={busy === "unedited"} onClick={() => void run("unedited", onConfirmUnedited)}>
                    Esborrar només els no modificats
                  </Button>
                )}
                <Button colorPalette="red" variant={edited.length ? "outline" : "solid"} loading={busy === "all"} onClick={() => void run("all", onConfirm)}>
                  <LuTrash2 /> {edited.length ? "Esborrar-ho tot" : "Esborrar"}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}
