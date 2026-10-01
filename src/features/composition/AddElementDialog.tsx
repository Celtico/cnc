import { Button, Dialog, HStack, Input, Portal, Stack, Text } from "@chakra-ui/react"
import { useState } from "react"
import { ChoiceChips } from "../../components/FormRow"
import { IconChoice } from "../../components/IconChoice"
import { canBeGhost, visibleReferences, type Composition, type PartOrient, type RefPreset } from "../../core/model"
import { useSettings } from "../settings/SettingsContext"
import { ADD_KINDS, defaultElementName, type AddKind } from "./addElements"
import { ORIENTS } from "./partOrient"

const KIND_KEY = "mobles:add-kind"

/**
 * Un sol «+ Afegir» per a l'arbre (com les capes de Figma): es tria què (Mòdul · Peça · Objecte; es recorda l'últim),
 * el nom (un per defecte, seleccionat: Retorn l'accepta) i, a la peça, l'orientació. Mòdul = una caixa bàsica; objecte =
 * una caixa de 600 × 600 × 100 o un dels de Preferències (agafa el nom escrit o, amb el de per defecte, el seu).
 */
export function AddElementDialog({
  open,
  comp,
  onlyParts,
  onClose,
  onAddModule,
  onAddPart,
  onAddRef,
}: {
  open: boolean
  comp: Composition
  /** Tipus de moble sense mòduls (Flat-pack, objecte): no s'hi poden afegir mòduls. */
  onlyParts: boolean
  onClose: () => void
  onAddModule: (name: string) => void
  onAddPart: (orient: PartOrient, name: string) => void
  onAddRef: (name: string, preset?: RefPreset) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="sm" lazyMount unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <AddForm comp={comp} onlyParts={onlyParts} onClose={onClose} onAddModule={onAddModule} onAddPart={onAddPart} onAddRef={onAddRef} />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

function AddForm({ comp, onlyParts, onClose, onAddModule, onAddPart, onAddRef }: Omit<Parameters<typeof AddElementDialog>[0], "open">) {
  const { settings } = useSettings()
  const kinds = ADD_KINDS.filter((k) => !(onlyParts && k.id === "module"))
  const [kind, setKind] = useState<AddKind>(() => {
    let saved: string | null = null
    try {
      saved = sessionStorage.getItem(KIND_KEY)
    } catch {
      /* sense sessionStorage */
    }
    return kinds.find((k) => k.id === saved)?.id ?? kinds[0]!.id
  })
  const [name, setName] = useState(() => defaultElementName(comp, kind))
  const [edited, setEdited] = useState(false)
  const [orient, setOrient] = useState<PartOrient>("front")
  const presets = visibleReferences(settings).filter(canBeGhost)
  const pickKind = (k: AddKind) => {
    setKind(k)
    try {
      sessionStorage.setItem(KIND_KEY, k)
    } catch {
      /* sense sessionStorage */
    }
    // Si el nom era el de per defecte, passa a ser el del tipus nou.
    if (!edited) setName(defaultElementName(comp, k))
  }
  const finalName = name.trim()
  const submit = (preset?: RefPreset) => {
    if (!finalName) return
    onClose()
    if (kind === "module") onAddModule(finalName)
    else if (kind === "part") onAddPart(orient, finalName)
    else onAddRef(preset && !edited ? preset.name : finalName, preset)
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Dialog.Header>
        <Dialog.Title>Afegir</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        <Stack gap={4}>
          <ChoiceChips label="Què" options={kinds.map((k) => ({ id: k.id, label: k.label }))} value={kind} onChange={pickKind} />
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setEdited(true)
            }}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Nom"
            autoFocus
          />
          <Text fontSize="xs" color="fg.muted">
            {kind === "module"
              ? "Una caixa bàsica: les mides, els compartiments i els fronts es canvien després."
              : kind === "part"
                ? "Un tauler solt (prestatge, travesser, pota…) o de ferro, pedra o vidre. Tria com va posat:"
                : `Una caixa de 600 × 600 × 100 que no es fabrica (obstacle o forat).${presets.length ? " O un dels teus:" : ""}`}
          </Text>
          {kind === "part" && <IconChoice label="Orientació" value={orient} options={ORIENTS} onChange={setOrient} />}
          {kind === "ref" && presets.length > 0 && (
            <HStack gap={1.5} wrap="wrap">
              {presets.map((r) => (
                <Button key={r.id} size="xs" variant="outline" title={`${r.w} × ${r.h} × ${r.d}`} disabled={!finalName} onClick={() => submit(r)}>
                  {r.name}
                </Button>
              ))}
            </HStack>
          )}
        </Stack>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel·lar
        </Button>
        <Button type="submit" colorPalette="wood" disabled={!finalName}>
          Afegir
        </Button>
      </Dialog.Footer>
    </form>
  )
}
