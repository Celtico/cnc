import { Button, Dialog, Input, Portal, Stack } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"

/**
 * Finestra petita per posar un nom (grup nou, canviar el nom, mòdul nou…), la mateixa a tota l'app. Ve amb un nom per
 * defecte ja seleccionat: Retorn l'accepta i escriure el substitueix. `children`: opcions de sota (p. ex. els mòduls
 * especials de la cuina, que també agafen el nom).
 */
export function NameDialog({
  open,
  title,
  initial,
  placeholder,
  ariaLabel = "Nom",
  submitLabel = "Desar",
  onClose,
  onSave,
  children,
}: {
  open: boolean
  title: string
  initial: string
  placeholder?: string
  ariaLabel?: string
  submitLabel?: string
  onClose: () => void
  onSave: (name: string) => void
  children?: (name: string) => ReactNode
}) {
  return (
    // El formulari es munta en obrir-se (lazyMount + unmountOnExit): així sempre comença amb el nom per defecte.
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="sm" lazyMount unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <NameForm title={title} initial={initial} placeholder={placeholder} ariaLabel={ariaLabel} submitLabel={submitLabel} onClose={onClose} onSave={onSave}>
              {children}
            </NameForm>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

function NameForm({ title, initial, placeholder, ariaLabel, submitLabel, onClose, onSave, children }: { title: string; initial: string; placeholder?: string; ariaLabel: string; submitLabel: string; onClose: () => void; onSave: (name: string) => void; children?: (name: string) => ReactNode }) {
  const [v, setV] = useState(initial)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim()) onSave(v.trim())
      }}
    >
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        <Stack gap={4}>
          <Input value={v} onChange={(e) => setV(e.target.value)} onFocus={(e) => e.currentTarget.select()} aria-label={ariaLabel} placeholder={placeholder} autoFocus />
          {children?.(v.trim())}
        </Stack>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel·lar
        </Button>
        <Button type="submit" colorPalette="wood" disabled={!v.trim()}>
          {submitLabel}
        </Button>
      </Dialog.Footer>
    </form>
  )
}
