import { Badge, Box, Button, HStack, Stack, Switch, Text } from "@chakra-ui/react"
import type { FocusEvent, KeyboardEvent, MouseEvent } from "react"
import { LuEye, LuEyeOff, LuLock, LuTriangleAlert } from "react-icons/lu"
import { ChoiceChips } from "../../components/FormRow"
import { NumberField } from "../../components/NumRow"
import { Tooltip } from "../../components/ui/tooltip"
import { hiddenBy, optionDefault, optionNode, setOptionPref, userOptionDefault, type OptionNode, type OptionPrefs, type OptionValue } from "../../core/model"
import { OPTION_ICONS } from "./optionIcons"
import { valueText } from "./optionTree"

/** Els controls dins d'un element de l'arbre: el clic i les tecles no han d'arribar a l'arbre (seleccionar, plegar). */
const keep = { onClick: (e: MouseEvent) => e.stopPropagation(), onKeyDown: (e: KeyboardEvent) => e.stopPropagation(), onFocus: (e: FocusEvent) => e.stopPropagation() }

const labelOf = (id: string) => optionNode(id)?.label ?? id

/**
 * Una opció a l'arbre de Preferències › Opcions en cascada: el nom (amb la icona de la secció), quan surt, les tries i el
 * que fan aparèixer o desaparèixer, l'interruptor «Amagar» (si es pot) i el valor per defecte dels elements nous (si es
 * pot triar; si no, el que fa servir), i la possible incoherència de l'auditoria.
 */
export function OptionNodeView({ node, prefs, onChange }: { node: OptionNode; prefs: OptionPrefs; onChange: (prefs: OptionPrefs) => void }) {
  const by = hiddenBy(prefs, node.id)
  const Icon = node.icon ? OPTION_ICONS[node.icon] : undefined
  const isGroup = node.kind === "group"
  const def = optionDefault(prefs, node.id)
  const own = userOptionDefault(prefs, node.id)
  const set = (patch: { hidden?: boolean; default?: OptionValue | null }) => onChange(setOptionPref(prefs, node.id, patch))
  return (
    <Stack gap={1} flex={1} minW={0} py={0.5}>
      <HStack gap={2} wrap="wrap" opacity={by ? 0.55 : 1}>
        {Icon && (
          <Box color="wood.fg" display="inline-flex">
            <Icon />
          </Box>
        )}
        <Text fontSize="sm" fontWeight={isGroup || node.kind === "section" ? "semibold" : "normal"} textDecoration={by === node.id ? "line-through" : undefined}>
          {node.label}
        </Text>
        {by && (
          <Badge size="sm" variant="subtle" colorPalette="gray">
            <LuEyeOff /> {by === node.id ? "Amagada" : `Amagada amb «${labelOf(by)}»`}
          </Badge>
        )}
        {own !== undefined && (
          <Badge size="sm" variant="subtle" colorPalette="wood">
            Per defecte: {valueText(node, own)}
          </Badge>
        )}
        {!isGroup && !node.hideable && (
          <Tooltip content={node.why ?? "No es pot amagar."}>
            <Badge size="sm" variant="outline" colorPalette="gray" {...keep}>
              <LuLock /> Fixa
            </Badge>
          </Tooltip>
        )}
        {node.issue && (
          <Badge size="sm" variant="subtle" colorPalette="orange">
            <LuTriangleAlert /> Possible incoherència
          </Badge>
        )}
      </HStack>
      {node.showIf && (
        <Text fontSize="xs" color="fg.muted">
          Surt quan: {node.showIf}
        </Text>
      )}
      {node.note && (
        <Text fontSize="xs" color="fg.subtle">
          {node.note}
        </Text>
      )}
      {node.choices && <ChoiceList node={node} />}
      {!isGroup && (node.hideable || node.defaultEditable || node.default !== undefined || node.defaultText) && (
        <HStack gap={4} wrap="wrap" rowGap={2} pt={0.5} {...keep}>
          {node.hideable && (
            <Switch.Root size="sm" checked={by === node.id} onCheckedChange={(e) => set({ hidden: e.checked })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="xs">Amagar</Switch.Label>
            </Switch.Root>
          )}
          <DefaultControl node={node} value={def} own={own} onChange={(v) => set({ default: v })} />
        </HStack>
      )}
      {node.hideable && by === node.id && node.why && (
        <Text fontSize="xs" color="fg.subtle">
          {node.why}
        </Text>
      )}
      {node.issue && (
        <Text fontSize="xs" color="orange.fg">
          {node.issue}
        </Text>
      )}
    </Stack>
  )
}

/** Les tries de l'opció, cadascuna amb el que fa aparèixer (ull) o desaparèixer (ull tatxat). */
function ChoiceList({ node }: { node: OptionNode }) {
  return (
    <Stack gap={0.5}>
      {node.choices!.map((c) => {
        // La tria del codi (la que té un mòdul nou si l'usuari no n'ha triat cap altra).
        const initial = c.value === node.default || (c.value === "on" && node.default === true) || (c.value === "off" && node.default === false)
        return (
        <HStack key={c.value} gap={1.5} wrap="wrap" fontSize="xs" rowGap={0.5}>
          <Badge size="sm" variant={initial ? "solid" : "outline"} colorPalette={initial ? "wood" : "gray"} title={initial ? "La inicial" : undefined}>
            {c.label}
          </Badge>
          {c.reveals?.length ? (
            <HStack gap={1} color="fg.muted">
              <LuEye />
              <Text>{c.reveals.map(labelOf).join(" · ")}</Text>
            </HStack>
          ) : null}
          {c.hides?.length ? (
            <HStack gap={1} color="fg.subtle">
              <LuEyeOff />
              <Text>{c.hides.map(labelOf).join(" · ")}</Text>
            </HStack>
          ) : null}
          {c.note && <Text color="fg.subtle">({c.note})</Text>}
        </HStack>
        )
      })}
    </Stack>
  )
}

/** El valor per defecte: el mateix control que l'inspector (pastilles, interruptor o número) o, si no es tria aquí, el text. */
function DefaultControl({ node, value, own, onChange }: { node: OptionNode; value: OptionValue | undefined; own: OptionValue | undefined; onChange: (v: OptionValue | null) => void }) {
  if (!node.defaultEditable) {
    return (
      <Text fontSize="xs" color="fg.muted">
        Per defecte: {valueText(node, node.default)}
      </Text>
    )
  }
  const reset = own !== undefined && (
    <Button size="2xs" variant="ghost" colorPalette="wood" onClick={() => onChange(null)}>
      Inicial ({valueText(node, node.default)})
    </Button>
  )
  return (
    <HStack gap={2} wrap="wrap" minW={0}>
      <Text fontSize="xs" color="fg.muted">
        Per defecte als nous:
      </Text>
      {node.control === "choice" ? (
        <ChoiceChips label={`${node.label}: per defecte`} options={node.choices!.map((c) => ({ id: c.value, label: c.label }))} value={String(value ?? "")} onChange={(v) => onChange(v)} />
      ) : node.control === "switch" ? (
        <Switch.Root size="sm" checked={value === true} onCheckedChange={(e) => onChange(e.checked)}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="xs">{value === true ? "Sí" : "No"}</Switch.Label>
        </Switch.Root>
      ) : (
        <Box w="150px">
          <NumberField label="" ariaLabel={`${node.label}: per defecte`} value={typeof value === "number" ? value : 0} min={node.range?.min} max={node.range?.max} step={node.range?.step} suffix={node.range?.suffix} onChange={(v) => onChange(v)} />
        </Box>
      )}
      {reset}
    </HStack>
  )
}
