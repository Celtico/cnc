import { Badge, Box, Button, HStack, IconButton, Input, Popover, Portal, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuArrowRight, LuChevronDown, LuPlus, LuRotateCcw, LuTrash2, LuTriangleAlert } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { SectionLabel } from "../../../components/SectionLabel"
import {
  DRAFT_EDGE_LABEL,
  DRAFT_ICONS,
  DRAFT_KIND_LABEL,
  appCascade,
  draftIcon,
  optionNode,
  registryRef,
  type CascadeDraft,
  type DraftDiff,
  type DraftEdge,
  type DraftEdgeKind,
  type DraftNode,
  type DraftNodeChange,
  type DraftNodeKind,
} from "../../../core/model"
import { CASCADE_ICONS } from "./cascadeIcons"

const KINDS = (Object.keys(DRAFT_KIND_LABEL) as DraftNodeKind[]).map((id) => ({ id, label: DRAFT_KIND_LABEL[id] }))
const EDGE_KINDS = (Object.keys(DRAFT_EDGE_LABEL) as DraftEdgeKind[]).map((id) => ({ id, label: DRAFT_EDGE_LABEL[id] }))

export interface DetailActions {
  /** `group`: els canvis seguits del mateix camp són un sol pas de desfer. */
  updateNode: (id: string, patch: Partial<Omit<DraftNode, "id">>, group?: string) => void
  setEdgeKind: (id: string, kind: DraftEdgeKind) => void
  remove: () => void
  addChild: (parent: string) => void
  restoreNode: (id: string) => void
  restoreEdge: (id: string) => void
  /** Triar un node i anar-hi (des de la llista de diferències o d'una fletxa). */
  focus: (id: string) => void
}

/**
 * El panell del costat del dibuix: el node o la fletxa triats per editar-los (nom, tipus, «Surt quan», nota i possible
 * incoherència; com és a l'app) i, sense res triat, les diferències amb l'app i com es fa servir.
 */
export function CascadeDetail({ draft, diff, node, edge, many, actions }: { draft: CascadeDraft; diff: DraftDiff; node?: DraftNode; edge?: DraftEdge; many: number; actions: DetailActions }) {
  if (many > 1)
    return (
      <Stack gap={3} p={4}>
        <Text fontWeight="medium">{many} triats</Text>
        <Button size="sm" variant="outline" colorPalette="red" onClick={actions.remove}>
          <LuTrash2 /> Esborrar-los
        </Button>
      </Stack>
    )
  if (node) return <NodeDetail key={node.id} node={node} diff={diff} actions={actions} />
  if (edge) return <EdgeDetail edge={edge} draft={draft} actions={actions} />
  return <DiffSummary draft={draft} diff={diff} actions={actions} />
}

function NodeDetail({ node, diff, actions }: { node: DraftNode; diff: DraftDiff; actions: DetailActions }) {
  const set = (patch: Partial<Omit<DraftNode, "id">>, field: string) => actions.updateNode(node.id, patch, `${field}:${node.id}`)
  const changed = diff.changed.get(node.id)
  const added = diff.added.has(node.id)
  return (
    <Stack gap={4} p={4}>
      <HStack gap={2} wrap="wrap">
        <Text fontWeight="semibold" flex={1} minW={0} truncate>
          {node.label || "(sense nom)"}
        </Text>
        {added && <Badge colorPalette="green">Nou</Badge>}
        {changed && <Badge colorPalette="purple">Canviat</Badge>}
      </HStack>
      <FormRow label="Nom">
        <Input size="sm" value={node.label} onChange={(e) => set({ label: e.target.value }, "label")} />
      </FormRow>
      <FormRow label="Icona" help="Només per al dibuix: no compta com a diferència.">
        <IconPick node={node} onPick={(icon) => actions.updateNode(node.id, { icon })} />
      </FormRow>
      <FormRow label="Tipus">
        <ChoiceChips label="Tipus" value={node.kind} options={KINDS} onChange={(kind) => actions.updateNode(node.id, { kind })} />
      </FormRow>
      <FormRow label="Surt quan" help="La condició en paraules (buit: sempre que surt el de sobre).">
        <Textarea size="sm" rows={2} autoresize value={node.when ?? ""} onChange={(e) => set({ when: e.target.value }, "when")} />
      </FormRow>
      <FormRow label="Nota" help="Per a tu: no compta com a diferència.">
        <Textarea size="sm" rows={2} autoresize value={node.note ?? ""} onChange={(e) => set({ note: e.target.value }, "note")} />
      </FormRow>
      <FormRow label={<HStack gap={1} color="orange.fg"><LuTriangleAlert /> Revisar</HStack>} help="Possible incoherència (les de l'auditoria vénen de l'app). Buida: resolta.">
        <Textarea size="sm" rows={2} autoresize value={node.issue ?? ""} onChange={(e) => set({ issue: e.target.value }, "issue")} />
      </FormRow>
      <HStack gap={2} wrap="wrap">
        <Button size="sm" variant="outline" onClick={() => actions.addChild(node.id)}>
          <LuPlus /> Afegir a dins
        </Button>
        <Button size="sm" variant="outline" colorPalette="red" onClick={actions.remove}>
          <LuTrash2 /> Esborrar
        </Button>
      </HStack>
      {!added && <AppInfo node={node} changed={changed} onRevert={() => changed && actions.updateNode(node.id, changed.before)} />}
    </Stack>
  )
}

/** Les icones que es poden triar (sense repetir: Moble i Resum, per exemple, fan servir la mateixa). */
const PICKS = DRAFT_ICONS.filter((id, i) => DRAFT_ICONS.findIndex((o) => CASCADE_ICONS[o] === CASCADE_ICONS[id]) === i)

/** La icona del node: un botó amb l'actual que obre la graella de totes. */
function IconPick({ node, onPick }: { node: DraftNode; onPick: (icon: string) => void }) {
  const Current = CASCADE_ICONS[draftIcon(node)]
  return (
    <Popover.Root positioning={{ placement: "bottom-start" }} lazyMount unmountOnExit>
      <Popover.Trigger asChild>
        <Button size="sm" variant="outline" aria-label="Canviar la icona">
          <Current /> <LuChevronDown />
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="auto">
            <Popover.Body p={2}>
              <SimpleGrid columns={8} gap={1}>
                {PICKS.map((id) => {
                  const I = CASCADE_ICONS[id]
                  return (
                    <Popover.CloseTrigger key={id} asChild>
                      <IconButton size="sm" aria-label={id} title={id} variant={I === Current ? "solid" : "ghost"} colorPalette="wood" onClick={() => onPick(id)}>
                        <I />
                      </IconButton>
                    </Popover.CloseTrigger>
                  )
                })}
              </SimpleGrid>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}

/** Com és a l'app ara (del registre): el que ha canviat, el fitxer de la UI i el per defecte. */
function AppInfo({ node, changed, onRevert }: { node: DraftNode; changed?: DraftNodeChange; onRevert: () => void }) {
  const ref = registryRef(node.id)
  const opt = optionNode(ref.optionId)
  const choice = ref.value !== undefined ? opt?.choices?.find((c) => c.value === ref.value) : undefined
  const rows: [string, ReactNode][] = []
  if (changed) {
    if (changed.before.label !== changed.after.label) rows.push(["Nom", changed.before.label])
    if (changed.before.kind !== changed.after.kind) rows.push(["Tipus", DRAFT_KIND_LABEL[changed.before.kind]])
    if (changed.before.when !== changed.after.when) rows.push(["Surt quan", changed.before.when ?? "(sempre)"])
  }
  if (opt && ref.value === undefined) {
    if (opt.code) rows.push(["Fitxer", <code key="c">src/{opt.code}</code>])
    const def = opt.defaultText ?? (opt.default === undefined ? undefined : String(opt.default))
    if (def) rows.push(["Per defecte", def])
    if (opt.why) rows.push(["Amagar-la", opt.why])
    if (opt.note) rows.push(["Nota de l'app", opt.note])
  }
  if (choice?.note) rows.push(["Nota de l'app", choice.note])
  if (!rows.length) return null
  return (
    <Stack gap={2} borderTopWidth="1px" pt={3}>
      <HStack justify="space-between">
        <SectionLabel>A l'app ara</SectionLabel>
        {changed && (
          <Button size="2xs" variant="ghost" colorPalette="wood" onClick={onRevert}>
            <LuRotateCcw /> Com a l'app
          </Button>
        )}
      </HStack>
      {rows.map(([k, v]) => (
        <Box key={k} fontSize="xs">
          <Text as="span" color="fg.muted">
            {k}:{" "}
          </Text>
          {v}
        </Box>
      ))}
    </Stack>
  )
}

function EdgeDetail({ edge, draft, actions }: { edge: DraftEdge; draft: CascadeDraft; actions: DetailActions }) {
  const label = (id: string) => draft.nodes.find((n) => n.id === id)?.label || "(sense nom)"
  return (
    <Stack gap={4} p={4}>
      <Text fontWeight="semibold">Fletxa</Text>
      <HStack gap={2} fontSize="sm" wrap="wrap">
        <Button size="xs" variant="subtle" onClick={() => actions.focus(edge.source)}>
          {label(edge.source)}
        </Button>
        <LuArrowRight />
        <Button size="xs" variant="subtle" onClick={() => actions.focus(edge.target)}>
          {label(edge.target)}
        </Button>
      </HStack>
      <FormRow label="Què fa" help="A dins de: l'arbre (surt quan surt el de sobre). Fa aparèixer / desaparèixer: la tria que ho decideix.">
        <ChoiceChips label="Què fa" value={edge.kind} options={EDGE_KINDS} onChange={(k) => actions.setEdgeKind(edge.id, k)} />
      </FormRow>
      <Button size="sm" variant="outline" colorPalette="red" alignSelf="flex-start" onClick={actions.remove}>
        <LuTrash2 /> Esborrar la fletxa
      </Button>
    </Stack>
  )
}

/** Sense res triat: les diferències amb l'app (amb «Recuperar» el que s'ha tret) i com es fa servir. */
function DiffSummary({ draft, diff, actions }: { draft: CascadeDraft; diff: DraftDiff; actions: DetailActions }) {
  const name = (id: string) => draft.nodes.find((n) => n.id === id)?.label ?? appCascade().nodes.find((n) => n.id === id)?.label ?? id
  const edgeText = (e: DraftEdge) => `${name(e.source)} → ${name(e.target)} (${DRAFT_EDGE_LABEL[e.kind].toLowerCase()})`
  return (
    <Stack gap={4} p={4} fontSize="sm">
      <Stack gap={1.5} color="fg.muted" fontSize="xs">
        <Text>
          És un <b>esborrany</b>: dibuixa com vols la cascada. <b>No canvia res de l'Editor</b>; les diferències amb l'app
          s'exporten per fer-les després al codi.
        </Text>
        <Text>
          Arrossega els nodes per organitzar-los (Maj + arrossegar al buit en tria uns quants). Per canviar un node de pare:
          deixa'l a sobre del nou pare, o uneix de la nansa de sota del pare a la de dalt del node. Una fletxa triada + Supr la
          treu. Doble clic al buit: un node nou; a un node: plegar o desplegar.
        </Text>
      </Stack>
      <SectionLabel>Diferències amb l'app ({diff.count})</SectionLabel>
      {diff.count === 0 && <Text color="fg.muted">Cap: l'esborrany és com l'app ara.</Text>}
      <DiffList title="Nous" color="green" items={draft.nodes.filter((n) => diff.added.has(n.id)).map((n) => ({ key: n.id, text: n.label || "(sense nom)", go: () => actions.focus(n.id) }))} />
      <DiffList title="Canviats" color="purple" items={[...diff.changed].map(([id, c]) => ({ key: id, text: c.before.label === c.after.label ? c.after.label : `${c.before.label} → ${c.after.label}`, go: () => actions.focus(id) }))} />
      <DiffList title="Trets" color="red" items={diff.removed.map((n) => ({ key: n.id, text: n.label, restore: () => actions.restoreNode(n.id) }))} />
      <DiffList title="Fletxes noves" color="green" items={draft.edges.filter((e) => diff.addedEdges.has(e.id)).map((e) => ({ key: e.id, text: edgeText(e), go: () => actions.focus(e.target) }))} />
      <DiffList title="Fletxes tretes" color="red" items={diff.removedEdges.map((e) => ({ key: e.id, text: edgeText(e), restore: () => actions.restoreEdge(e.id) }))} />
    </Stack>
  )
}

function DiffList({ title, color, items }: { title: string; color: string; items: { key: string; text: string; go?: () => void; restore?: () => void }[] }) {
  if (!items.length) return null
  return (
    <Stack gap={1}>
      <HStack gap={2}>
        <Badge colorPalette={color}>{items.length}</Badge>
        <Text fontWeight="medium">{title}</Text>
      </HStack>
      {items.map((it) => (
        <HStack key={it.key} gap={1} pl={2}>
          {it.go ? (
            <Button size="2xs" variant="ghost" justifyContent="flex-start" flex={1} minW={0} onClick={it.go}>
              <Text truncate>{it.text}</Text>
            </Button>
          ) : (
            <Text fontSize="xs" flex={1} minW={0} truncate title={it.text}>
              {it.text}
            </Text>
          )}
          {it.restore && (
            <Button size="2xs" variant="ghost" colorPalette="wood" onClick={it.restore}>
              <LuRotateCcw /> Recuperar
            </Button>
          )}
        </HStack>
      ))}
    </Stack>
  )
}
