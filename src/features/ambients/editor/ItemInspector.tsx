import { Box, Button, Editable, HStack, IconButton, Stack, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuBox, LuCopy, LuExternalLink, LuMove, LuMoveDiagonal, LuRotateCcw, LuRotateCw, LuSofa, LuTrash2 } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { FoldItem } from "../../../components/Fold"
import { NumRow } from "../../../components/NumRow"
import { toaster } from "../../../components/ui/toaster"
import { Tooltip } from "../../../components/ui/tooltip"
import { BlockShapeSchema, CompositionSchema, resizeComposition, type AmbientItem, type BlockItem, type Composition, type MaterialPref } from "../../../core/model"
import { compositionOf, updateProjectComposition } from "../../../db/compositionStore"
import type { Project } from "../../../db/db"
import { isObject } from "../../objects/isObject"
import { isEmptyGeometry, type ItemGeometry } from "../ambientData"
import { MaterialPick } from "./MaterialPick"

const SHAPE_LABEL: Record<BlockItem["shape"], string> = { box: "Caixa", sofa: "Sofà", bed: "Llit", table: "Taula" }

function Placement({ item, onPatch }: { item: AmbientItem; onPatch: (p: Partial<AmbientItem>) => void }) {
  return (
    <FoldItem id="amb-place" title="Posició" icon={LuMove}>
      <NumRow label="X (centre)" value={item.x} step={10} onChange={(x) => Number.isFinite(x) && onPatch({ x })} />
      <NumRow label="Y (centre)" value={item.y} step={10} onChange={(y) => Number.isFinite(y) && onPatch({ y })} />
      <NumRow label="Gir" suffix="°" value={item.rot} step={15} onChange={(rot) => Number.isFinite(rot) && onPatch({ rot: ((rot % 360) + 360) % 360 })} />
      <NumRow label="Del terra" value={item.elevation ?? 0} min={0} step={10} onChange={(elevation) => Number.isFinite(elevation) && onPatch({ elevation: elevation || undefined })} />
      <HStack gap={2}>
        <Button size="xs" variant="outline" onClick={() => onPatch({ rot: (item.rot + 270) % 360 })}>
          <LuRotateCcw /> −90°
        </Button>
        <Button size="xs" variant="outline" onClick={() => onPatch({ rot: (item.rot + 90) % 360 })}>
          <LuRotateCw /> +90° (R)
        </Button>
      </HStack>
    </FoldItem>
  )
}

export function ItemInspector({
  item,
  geo,
  name,
  project,
  materials,
  onPatch,
  onOpen,
  onDuplicate,
  onDelete,
  onResize,
}: {
  /** Les mides generals d'un moble enllaçat, com un pas del desfer de l'ambient. */
  onResize?: (id: number, before: Composition, next: Composition) => void
  item: AmbientItem
  geo: ItemGeometry | null
  name: string
  project?: Project
  materials: MaterialPref[]
  onPatch: (p: Partial<AmbientItem>) => void
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <Stack gap={0}>
      <HStack gap={2} pb={2}>
        {/* La mateixa icona que a l'arbre: moble o objecte. */}
        <Box color={item.kind === "moble" && !(project && isObject(project)) ? "wood.fg" : "fg.muted"}>{item.kind === "moble" && !(project && isObject(project)) ? <LuBox /> : <LuSofa />}</Box>
        {item.kind === "block" ? (
          <Editable.Root value={item.name} onValueChange={(e) => onPatch({ name: e.value })} fontWeight="semibold" flex={1} minW={0} aria-label="Nom del bloc">
            <Editable.Preview truncate />
            <Editable.Input />
          </Editable.Root>
        ) : (
          <Text fontWeight="semibold" truncate flex={1}>
            {name}
          </Text>
        )}
        <Tooltip content="Duplicar (Ctrl/⌘ D)">
          <IconButton aria-label="Duplicar" size="xs" variant="ghost" onClick={onDuplicate}>
            <LuCopy />
          </IconButton>
        </Tooltip>
        <Tooltip content="Treure de l'ambient (Supr)">
          <IconButton aria-label="Treure de l'ambient" size="xs" variant="ghost" colorPalette="red" onClick={onDelete}>
            <LuTrash2 />
          </IconButton>
        </Tooltip>
      </HStack>

      {item.kind === "moble" ? (
        project && geo ? (
          <>
            {isEmptyGeometry(geo) ? (
              // Un moble nou és buit (sense mòduls ni peces): no hi ha mides per escalar; es fa a l'editor.
              <Text fontSize="sm" color="fg.muted" pt={1}>
                És buit: encara no té mòduls ni peces. Obre'l a l'editor per fer-lo; al plànol surt com un requadre discontinu.
              </Text>
            ) : (
              <MobleDims project={project} geo={geo} onResize={onResize} />
            )}
            <Button size="sm" variant="outline" alignSelf="flex-start" my={3} onClick={onOpen}>
              <LuExternalLink /> Obrir a l'editor
            </Button>
          </>
        ) : (
          <Text fontSize="sm" color="fg.error">
            Aquest moble s'ha esborrat de la llista.
          </Text>
        )
      ) : (
        <FoldItem id="amb-block" title="Bloc" icon={LuSofa}>
          <FormRow label="Forma">
            <ChoiceChips label="Forma" options={BlockShapeSchema.options.map((s) => ({ id: s, label: SHAPE_LABEL[s] }))} value={item.shape} onChange={(shape) => onPatch({ shape })} />
          </FormRow>
          <NumRow label="Ample" value={item.w} min={10} step={10} onChange={(w) => w >= 10 && onPatch({ w })} />
          <NumRow label="Alt" value={item.h} min={5} step={10} onChange={(h) => h >= 5 && onPatch({ h })} />
          <NumRow label="Fondària" value={item.d} min={10} step={10} onChange={(d) => d >= 10 && onPatch({ d })} />
          <MaterialPick label="Material" value={item.material} materials={materials} onChange={(material) => onPatch({ material })} />
          {(item.shape === "bed" || item.shape === "sofa") && (
            <MaterialPick label={item.shape === "bed" ? "Matalàs" : "Coixins"} value={item.material2 ?? item.material} materials={materials} onChange={(material2) => onPatch({ material2 })} onlySim />
          )}
          <Text fontSize="xs" color="fg.muted">
            Els blocs només es veuen: no es fabriquen ni surten a les peces.
          </Text>
        </FoldItem>
      )}
      <Placement item={item} onPatch={onPatch} />
    </Stack>
  )
}

/**
 * Mides generals d'un moble: s'escriuen i s'apliquen amb «Aplicar» (o Retorn); el moble de la
 * llista canvia (l'enllaç és el mateix moble), amb la distribució escalada.
 */
function MobleDims({ project, geo, onResize }: { project: Project; geo: ItemGeometry; onResize?: (id: number, before: Composition, next: Composition) => void }) {
  const cur = { w: Math.round(geo.w), h: Math.round(geo.h), d: Math.round(geo.d) }
  const [draft, setDraft] = useState(cur)
  const key = `${cur.w}|${cur.h}|${cur.d}`
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setDraft(cur)
  }
  const dirty = draft.w !== cur.w || draft.h !== cur.h || draft.d !== cur.d
  const apply = async () => {
    if (!dirty || !(draft.w >= 100 && draft.h >= 100 && draft.d >= 100)) return
    const before = compositionOf(project)
    const next = resizeComposition(before, cur, draft)
    const ok = CompositionSchema.safeParse(next)
    if (!ok.success) {
      toaster.create({ title: "No s'ha pogut canviar la mida", description: "Amb aquestes mides alguna part del moble queda fora de límits. Prova-ho a l'editor.", type: "error" })
      return
    }
    // Un pas del desfer de l'ambient: el desa l'efecte de `linked` (i ⌘Z el torna a la d'abans).
    if (onResize) return onResize(project.id, before, next)
    if (!(await updateProjectComposition(project.id, next))) {
      toaster.create({ title: "No s'ha pogut canviar la mida", description: "Aquest moble no s'ha pogut llegir bé; obre'l a l'editor.", type: "error" })
    }
  }
  return (
    <FoldItem id="amb-dims" title="Mides generals" icon={LuMoveDiagonal} badge={`${cur.w} × ${cur.h} × ${cur.d}`}>
      {/* S'aplica en sortir dels camps (com els altres de l'app), amb Retorn o amb «Aplicar»; mentre s'escriu, no
          (escrivint «1200» s'hauria aplicat 120). */}
      <Stack
        gap={4}
        onKeyDown={(e) => e.key === "Enter" && void apply()}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void apply()
        }}
      >
      <NumRow label="Ample" value={draft.w} min={100} step={10} onChange={(w) => setDraft({ ...draft, w })} />
      <NumRow label="Alt" value={draft.h} min={100} step={10} onChange={(h) => setDraft({ ...draft, h })} />
      <NumRow label="Fondària" value={draft.d} min={100} step={10} onChange={(d) => setDraft({ ...draft, d })} />
      {dirty && (
        <HStack gap={2}>
          <Button size="xs" colorPalette="wood" onClick={() => void apply()}>
            Aplicar les mides
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setDraft(cur)}>
            Desfer
          </Button>
        </HStack>
      )}
      <Text fontSize="xs" color="fg.muted">
        És el mateix moble de la llista: canviar-ne les mides el canvia a tot arreu. L'interior (compartiments, portes, calaixos) es toca a l'editor.
      </Text>
      </Stack>
    </FoldItem>
  )
}
