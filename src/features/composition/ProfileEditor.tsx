import { Button, CloseButton, Dialog, Portal, Stack, Text } from "@chakra-ui/react"
import { useMemo, useRef, useState } from "react"
import { bounds, normalizeNodes, polygonArea, sampleProfile, selfIntersects, type PNode, type Vec2 } from "../../core/model"
import { useUndoKeys } from "../history/useHistory"
import { useProfileShape } from "./profile/useProfileShape"
import { useProfileKeys } from "./profile/useProfileKeys"
import { useProfilePointer } from "./profile/useProfilePointer"
import { ProfileToolbar } from "./profile/ProfileToolbar"
import { ProfileCanvas } from "./profile/ProfileCanvas"
import { ProfileOptions } from "./profile/ProfileOptions"

/**
 * Editor de perfil 2D amb corbes de Bézier cúbiques compostes (com la ploma d'Illustrator o
 * Figma):
 * - Editar: arrossega nodes i manegadors; doble clic a un node el fa suau o cantonada; el
 *   cercle del mig d'un costat hi afegeix un node (clic) o el corba (arrossegar); Alt en
 *   arrossegar un manegador el trenca (cantonada); Supr, fletxes.
 * - Ploma: clic = node de cantonada, clic i arrossegar = node suau amb manegadors; clicar el
 *   primer node tanca la forma.
 * Imant a la quadrícula (Ctrl/⌘: 0,1 mm). Maj: angles de 45° a la ploma i als manegadors (com a Figma). No deixa aplicar un contorn que es talli a si mateix.
 * Desfer/refer propi (`useHistory`, dreceres només dins del diàleg): cada arrossegada, cada node de la ploma i cada acció
 * és un pas; el moble del darrere no es toca.
 */
export function ProfileEditor({
  open,
  initial,
  axes,
  onClose,
  onApply,
}: {
  open: boolean
  initial: PNode[]
  /** Noms dels eixos (u, v) per als rètols, p. ex. ["Ample", "Alt"]. */
  axes: [string, string]
  onClose: () => void
  onApply: (p: { points: PNode[]; w: number; h: number }) => void
}) {
  const shape = useProfileShape(open, initial)
  const { nodes, drawing, view, undo, redo } = shape
  const [radius, setRadius] = useState(20)
  const content = useRef<HTMLDivElement>(null)

  const closed = !drawing && nodes.length >= 3
  const sample = useMemo(() => (nodes.length >= 2 ? sampleProfile(nodes) : nodes.map((n) => [n.x, n.y] as Vec2)), [nodes])
  const bad = closed && selfIntersects(sample)
  const b = bounds(sample.length ? sample : [[0, 0]])
  const area = closed ? polygonArea(sample) : 0
  const unit = view.span / 100
  const minor = view.span > 1500 ? 50 : view.span > 400 ? 10 : 5

  useUndoKeys(undo, redo, { enabled: open, scope: content })
  useProfileKeys(open, shape)
  const pointer = useProfilePointer(shape, unit, minor)

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size={{ base: "full", md: "xl" }} placement="center" closeOnEscape={!drawing} closeOnInteractOutside={false}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          {/* Al mòbil, a pantalla completa i respectant la zona segura (si no, la capçalera quedava sota l'illa / la barra d'estat). */}
          <Dialog.Content ref={content} maxW={{ md: "1000px" }} css={{ "--profile-canvas": "max(320px, calc(100dvh - 300px))" }} h={{ base: "100dvh", md: "auto" }} minH={{ md: "auto" }} pt={{ base: "env(safe-area-inset-top, 0px)", md: 0 }} pb={{ base: "env(safe-area-inset-bottom, 0px)", md: 0 }}>
            <Dialog.Header>
              <Dialog.Title>Forma de la secció</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body overflowY="auto">
              <Stack gap={3}>
                <ProfileToolbar shape={shape} b={b} />
                <Stack direction={{ base: "column", md: "row" }} gap={3} align="stretch">
                  {/* Dibuix quadrat, com a molt l'alçada que queda a la finestra (el diàleg no es desplaça a l'ordinador). */}
                  <ProfileCanvas shape={shape} pointer={pointer} sample={sample} closed={closed} bad={bad} unit={unit} minor={minor} />
                  {/* Opcions en seccions plegables (l'acordió de l'app, recordades durant la sessió): sense desplaçament. */}
                  <ProfileOptions shape={shape} axes={axes} radius={radius} setRadius={setRadius} minor={minor} />
                </Stack>
                <Text textStyle="xs" color={bad ? "fg.error" : "fg.muted"}>
                  {bad ? "El contorn es talla a si mateix: mou algun node o manegador." : closed ? `${Math.round(b.x1 - b.x0)} × ${Math.round(b.y1 - b.y0)} mm · ${nodes.length} nodes · àrea ${(area / 1e6).toFixed(3)} m². Les corbes es tallen com a arcs (error < 0,02 mm).` : " "}
                </Text>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
              <Button colorPalette="wood" disabled={bad || drawing || nodes.length < 3} onClick={() => onApply(normalizeNodes(nodes))}>
                Aplicar
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild top={{ base: "calc(env(safe-area-inset-top, 0px) + 8px)", md: 2 }}>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
