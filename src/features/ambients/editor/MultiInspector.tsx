import { Box, Button, Editable, HStack, IconButton, Stack, Text } from "@chakra-ui/react"
import { useState } from "react"
import {
  LuAlignCenterHorizontal,
  LuAlignCenterVertical,
  LuAlignEndHorizontal,
  LuAlignEndVertical,
  LuAlignHorizontalDistributeCenter,
  LuAlignHorizontalSpaceAround,
  LuAlignStartHorizontal,
  LuAlignStartVertical,
  LuAlignVerticalDistributeCenter,
  LuAlignVerticalSpaceAround,
  LuCopy,
  LuGroup,
  LuListChecks,
  LuMove,
  LuMoveDiagonal2,
  LuMoveHorizontal,
  LuRotateCcw,
  LuRotateCw,
  LuTrash2,
} from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { FoldItem } from "../../../components/Fold"
import { NumRow } from "../../../components/NumRow"
import { AxisLabel } from "../../../components/AxisLabel"
import { Tooltip } from "../../../components/ui/tooltip"
import type { AmbientItem, Wall } from "../../../core/model"

/**
 * Selecció múltiple (Maj + clic, com a l'editor): moure i girar tots junts, alinear i repartir al plànol, el grup de tots,
 * la llista (tocar-ne un el tria sol), duplicar i eliminar.
 */
export function MultiInspector({
  name,
  onRename,
  items,
  walls = [],
  wallNames = new Map(),
  names,
  groups,
  onMove,
  onRotate,
  onAlign,
  onDistribute,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
  onPick,
}: {
  /** Un grup: el nom (es canvia clicant-lo). Sense, una selecció múltiple («N elements»). */
  name?: string
  onRename?: (n: string) => void
  items: AmbientItem[]
  /** Les parets triades (o del grup): es mouen, s'agrupen i s'eliminen amb els elements. */
  walls?: Wall[]
  wallNames?: Map<string, string>
  names: Map<string, string>
  groups: string[]
  onMove: (dx: number, dy: number) => void
  onRotate: (deg: number) => void
  onAlign: (axis: "x" | "y", mode: "min" | "mid" | "max") => void
  onDistribute: (axis: "x" | "y", gap?: number) => void
  onGroup: (g?: string) => void
  onUngroup: () => void
  onDuplicate: () => void
  onDelete: () => void
  onPick: (id: string) => void
}) {
  const [gap, setGap] = useState(0)
  // El centre de tots (els elements pel seu centre, les parets pels extrems).
  const xs = [...items.map((i) => i.x), ...walls.flatMap((w) => [w.a[0], w.b[0]])], ys = [...items.map((i) => i.y), ...walls.flatMap((w) => [w.a[1], w.b[1]])]
  const cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2)
  const cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2)
  const all = [...items.map((i) => i.group), ...walls.map((w) => w.group)]
  const group = all.every((g) => g === all[0]) ? (all[0] ?? "") : undefined
  return (
    <Stack gap={0}>
      <HStack gap={2} pb={2}>
        <Box color="wood.fg">
          <LuGroup />
        </Box>
        {name !== undefined && onRename ? (
          <Editable.Root key={name} defaultValue={name} onValueCommit={(e) => e.value.trim() && e.value.trim() !== name && onRename(e.value.trim())} fontWeight="semibold" flex={1} minW={0} aria-label="Nom del grup">
            <Editable.Preview truncate title="Clica per canviar el nom" />
            <Editable.Input />
          </Editable.Root>
        ) : (
          <Text fontWeight="semibold" flex={1} minW={0} truncate>
            {items.length + walls.length} {walls.length && !items.length ? "parets" : "elements"}
          </Text>
        )}
      </HStack>
      <FoldItem id="amb-multi-place" title="Posició" icon={LuMove}>
        <NumRow label={<AxisLabel icon={LuMoveHorizontal} name="De costat" axis="X" hint="El centre de tots, d'esquerra a dreta del plànol" />} ariaLabel="De costat (X)" help="El centre de tots." value={cx} step={10} onChange={(x) => Number.isFinite(x) && onMove(x - cx, 0)} />
        <NumRow label={<AxisLabel icon={LuMoveDiagonal2} name="Fondària" axis="Z" hint="El centre de tots, de dalt a baix del plànol" />} ariaLabel="Fondària (Z)" help="El centre de tots." value={cy} step={10} onChange={(y) => Number.isFinite(y) && onMove(0, y - cy)} />
        <HStack gap={2}>
          <Button size="xs" variant="outline" onClick={() => onRotate(-90)}>
            <LuRotateCcw /> −90°
          </Button>
          <Button size="xs" variant="outline" onClick={() => onRotate(90)}>
            <LuRotateCw /> +90° (R)
          </Button>
        </HStack>
        <Text fontSize="xs" color="fg.muted">
          Es mouen tots junts: arrossegant-los al plànol, amb les fletxes del 3D o del teclat, o aquí. Maj + clic n'afegeix o en treu.
        </Text>
      </FoldItem>
      <FoldItem id="amb-multi-align" title="Alineació" icon={LuAlignCenterVertical}>
        <NumRow label="Espai entre ells" value={gap} min={-5000} max={20000} step={5} help="Per al darrer botó de cada fila: el primer es queda i els altres es posen a aquest espai de l'anterior (0 = tocant-se)." onChange={(n) => Number.isFinite(n) && setGap(n)} />
        {([
          { axis: "x", label: "De costat (X)", opts: [["min", "A l'esquerra", LuAlignStartVertical], ["mid", "Al centre", LuAlignCenterVertical], ["max", "A la dreta", LuAlignEndVertical]] },
          { axis: "y", label: "Fondària (Z)", opts: [["min", "A dalt del plànol", LuAlignStartHorizontal], ["mid", "Al mig", LuAlignCenterHorizontal], ["max", "A baix del plànol", LuAlignEndHorizontal]] },
        ] as const).map(({ axis, label, opts }) => (
          <FormRow key={axis} label={label}>
            <HStack gap={1}>
              {opts.map(([mode, name, Icon]) => (
                <Tooltip key={mode} content={name}>
                  <IconButton aria-label={`${label}: ${name}`} size="xs" variant="outline" onClick={() => onAlign(axis, mode)}>
                    <Icon />
                  </IconButton>
                </Tooltip>
              ))}
              {items.length > 2 && (
                <Tooltip content="Repartir (el mateix espai entre ells)">
                  <IconButton aria-label={`${label}: repartir`} size="xs" variant="outline" onClick={() => onDistribute(axis)}>
                    {axis === "y" ? <LuAlignVerticalDistributeCenter /> : <LuAlignHorizontalDistributeCenter />}
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip content={`Repartir amb ${gap} mm entre ells`}>
                <IconButton aria-label={`${label}: repartir amb ${gap} mm`} size="xs" variant="outline" onClick={() => onDistribute(axis, gap)}>
                  {axis === "y" ? <LuAlignVerticalSpaceAround /> : <LuAlignHorizontalSpaceAround />}
                </IconButton>
              </Tooltip>
            </HStack>
          </FormRow>
        ))}
        <Text fontSize="xs" color="fg.muted">
          Respecte de la caixa de tots els triats al plànol. «Repartir», amb tres o més: el primer i l'últim es queden i els del mig es posen amb el mateix espai entre ells.
        </Text>
      </FoldItem>
      <FoldItem id="amb-multi-group" title="Grup" icon={LuGroup} badge={group === undefined ? "Diversos" : group || "Sense grup"} badgePalette={group ? "wood" : "gray"}>
        <FormRow label="Grup" help={group === undefined ? "Diversos: el grup que triïs va a tots." : "El grup de tots els triats."}>
          <ChoiceChips
            label="Grup"
            options={[{ id: "", label: "Sense grup" }, ...groups.map((g) => ({ id: g, label: g })), { id: "__new__", label: "+ Grup nou" }]}
            value={group ?? "__diversos__"}
            onChange={(v) => (v === "__new__" ? onGroup() : v ? onGroup(v) : onUngroup())}
          />
        </FormRow>
      </FoldItem>
      {/* La llista i les accions dels triats, com a l'editor (Triats › Duplicar · Eliminar). */}
      <FoldItem id="amb-multi-items" title="Triats" icon={LuListChecks} badge={items.length + walls.length}>
        <Stack gap={1}>
          {items.map((i) => (
            <Button key={i.id} size="xs" variant="ghost" justifyContent="flex-start" onClick={() => onPick(i.id)}>
              {names.get(i.id)}
            </Button>
          ))}
          {walls.map((w) => (
            <Text key={w.id} fontSize="xs" color="fg.muted" px={2}>
              {wallNames.get(w.id) ?? "Paret"}
            </Text>
          ))}
        </Stack>
        <HStack gap={2}>
          <Button size="xs" variant="outline" onClick={onDuplicate}>
            <LuCopy /> Duplicar
          </Button>
          <Button size="xs" variant="outline" colorPalette="red" onClick={onDelete}>
            <LuTrash2 /> Eliminar
          </Button>
        </HStack>
      </FoldItem>
    </Stack>
  )
}
