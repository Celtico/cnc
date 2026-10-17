import { Box, Button, HStack, IconButton, Stack, Switch, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { LuArrowUpFromLine, LuGrid3X3, LuRedo2, LuSlash, LuSquareDashedMousePointer, LuUndo2 } from "react-icons/lu"
import { ChoiceChips } from "../../components/FormRow"
import { FloatingWindow } from "../../components/FloatingWindow"
import { Tooltip } from "../../components/ui/tooltip"
import { boxCage, extrudeFaces, MAX_CAGE_POINTS, mirrorPairs, normalizeCage, refineCage, START_SHAPES, toggleCrease, type MeshCage, type ObjectBox } from "../../core/model"
import { useHistory, useUndoKeys } from "../history/useHistory"
import { MeshEditorCanvas } from "./MeshEditorScene"


/**
 * Editor de la forma lliure d'un objecte (per decisió de l'usuari, 2026-10-17: «un editor de malla com el de SolidWorks»):
 * la caixa de control (punts i línies) i la superfície suau que en surt (Catmull-Clark, `meshShape.ts`). Es toca un punt
 * (amb Maj, se n'hi afegeixen) i es mou amb les fletxes o la bola; «Simetria» mou el punt de l'altra banda en mirall;
 * «Més detall» parteix la caixa (més punts per modelar); «Extrudir» aixeca les cares triades amb costats nous; «Aresta viva»
 * fa recte el cantell entre els punts triats; «Començar amb» tria una forma de partida (coixí, caixa, cilindre, pica…). En aplicar, la caixa de l'objecte s'ajusta a la forma.
 */
export function MeshEditor({ open, box, initial, onClose, onApply }: { open: boolean; box: ObjectBox; initial: MeshCage | undefined; onClose: () => void; onApply: (p: ObjectBox & { mesh: MeshCage }) => void }) {
  const start = initial ?? boxCage()
  const hist = useHistory<MeshCage>(start)
  const cage = hist.value
  const [selected, setSelected] = useState<number[]>([])
  const [sym, setSym] = useState(true)
  const content = useRef<HTMLDivElement>(null)
  // Cada cop que s'obre: la forma de l'objecte d'ara.
  useEffect(() => {
    if (!open) return
    hist.reset(initial ?? boxCage())
    setSelected([])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- només en obrir-se
  }, [open])
  useUndoKeys(hist.undo, hist.redo, { enabled: open, scope: content })
  const mirror = useMemo(() => (sym ? mirrorPairs(cage) : null), [sym, cage])
  // Alguna cara amb tots els punts triats (es pot extrudir).
  const faceSelected = useMemo(() => {
    const s = new Set(selected)
    return cage.f.some((f) => f.every((a) => s.has(a)))
  }, [cage, selected])
  const level = cage.level ?? 3
  const size = { w: box.w, h: box.h, d: box.d }

  return (
    <FloatingWindow
      id="mesh-editor"
      open={open}
      onClose={onClose}
      title="Forma lliure"
      width={1000}
      contentRef={content}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel·lar
          </Button>
          <Button
            colorPalette="wood"
            onClick={() => {
              const n = normalizeCage(cage, box)
              onApply({ ...n.box, mesh: n.cage })
            }}
          >
            Aplicar
          </Button>
        </>
      }
    >
      <Stack gap={3}>
        <HStack gap={2} wrap="wrap">
          <Tooltip content="Desfer">
            <IconButton aria-label="Desfer" size="sm" variant="ghost" disabled={!hist.canUndo} onClick={hist.undo}>
              <LuUndo2 />
            </IconButton>
          </Tooltip>
          <Tooltip content="Refer">
            <IconButton aria-label="Refer" size="sm" variant="ghost" disabled={!hist.canRedo} onClick={hist.redo}>
              <LuRedo2 />
            </IconButton>
          </Tooltip>
          <Tooltip content="Triar tots els punts (per moure tota la forma)">
            <Button size="sm" variant="outline" onClick={() => setSelected(selected.length === cage.v.length ? [] : cage.v.map((_, i) => i))}>
              <LuSquareDashedMousePointer /> Tots
            </Button>
          </Tooltip>
          <Tooltip content="Parteix cada cara de la caixa en quatre: més punts per modelar">
            <Button
              size="sm"
              variant="outline"
              disabled={cage.v.length > MAX_CAGE_POINTS}
              onClick={() => {
                hist.set(refineCage(cage))
                setSelected([])
              }}
            >
              <LuGrid3X3 /> Més detall
            </Button>
          </Tooltip>
          <Tooltip content="Els punts triats s'aixequen amb les cares que tanquen (totes les cares amb els punts triats): costats nous per modelar">
            <Button
              size="sm"
              variant="outline"
              disabled={!faceSelected}
              onClick={() => {
                const r = extrudeFaces(cage, selected, 0.15)
                hist.set(r.cage)
                setSelected(r.ids)
              }}
            >
              <LuArrowUpFromLine /> Extrudir
            </Button>
          </Tooltip>
          <Tooltip content="Les arestes entre els punts triats no s'arrodoneixen (un cantell recte); un altre cop, es tornen suaus">
            <Button size="sm" variant="outline" disabled={selected.length < 2} onClick={() => hist.set(toggleCrease(cage, selected))}>
              <LuSlash /> Aresta viva
            </Button>
          </Tooltip>
          <Switch.Root size="sm" checked={sym} onCheckedChange={(e) => setSym(e.checked)}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Simetria (X)</Switch.Label>
          </Switch.Root>
          <ChoiceChips<string>
            label="Suavitat"
            options={[
              { id: "2", label: "Suau" },
              { id: "3", label: "Molt suau" },
            ]}
            value={String(Math.min(3, Math.max(2, level)))}
            onChange={(v) => hist.set({ ...cage, level: Number(v) })}
          />
        </HStack>
        <HStack gap={2} wrap="wrap">
          <Text fontSize="sm" color="fg.muted">
            Començar amb:
          </Text>
          <ChoiceChips<string>
            label="Forma de partida"
            options={START_SHAPES.map((x) => ({ id: x.id, label: x.label }))}
            value=""
            retap
            onChange={(id) => {
              const sh = START_SHAPES.find((x) => x.id === id)
              if (!sh) return
              hist.set({ ...sh.make(), ...(cage.level ? { level: cage.level } : {}) })
              setSelected([])
            }}
          />
        </HStack>
        <Box h="max(320px, calc(100dvh - 320px))" borderWidth="1px" rounded="md" overflow="hidden" bg="bg.subtle">
          <MeshEditorCanvas
            cage={cage}
            size={size}
            level={Math.min(3, level)}
            selected={selected}
            mirror={mirror}
            onSelect={setSelected}
            onPreview={(c) => hist.set(c, { commit: false })}
            onCommit={(c) => {
              hist.set(c, { commit: false })
              hist.commit()
            }}
          />
        </Box>
        <Text textStyle="xs" color="fg.muted">
          Toca un punt per triar-lo (amb Maj, se n'hi afegeixen) i mou-lo amb les fletxes o la bola. La superfície suau és la que talla: una forma que entra en
          una peça s'hi fresa des de la cara per on entra (el que quedaria sota una part que sobresurt també es buida). {cage.v.length} punts · {cage.f.length} cares.
        </Text>
      </Stack>
    </FloatingWindow>
  )
}
