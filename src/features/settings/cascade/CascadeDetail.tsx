import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuTriangleAlert } from "react-icons/lu"
import { DRAFT_EDGE_LABEL, DRAFT_KIND_LABEL, optionNode, registryRef, type CascadeDraft, type DraftEdgeKind, type DraftNode } from "../../../core/model"

/**
 * El node triat, només per llegir: el tipus, quan surt, la possible incoherència, com és a l'app (fitxer, per defecte,
 * notes) i les fletxes que hi arriben o en surten (un clic hi va).
 */
export function CascadeNodeInfo({ draft, node, focus }: { draft: CascadeDraft; node?: DraftNode; focus: (id: string) => void }) {
  if (!node) return <Text fontSize="sm" color="fg.muted">Clica un node del dibuix per veure'n el detall.</Text>
  const label = (id: string) => draft.nodes.find((n) => n.id === id)?.label || id
  const rows = appRows(node)
  const ends = (kind: DraftEdgeKind, end: "source" | "target") =>
    draft.edges.filter((e) => e.kind === kind && e[end === "source" ? "target" : "source"] === node.id).map((e) => e[end])
  const links = [
    { title: "A dins de", ids: ends("contains", "source") },
    { title: "Apareix amb", ids: ends("reveals", "source") },
    { title: "Desapareix amb", ids: ends("hides", "source") },
    { title: DRAFT_EDGE_LABEL.reveals, ids: ends("reveals", "target") },
    { title: DRAFT_EDGE_LABEL.hides, ids: ends("hides", "target") },
  ].filter((l) => l.ids.length)
  return (
    <Stack gap={3} fontSize="sm">
      <HStack gap={2}>
        <Text fontWeight="semibold" flex={1} minW={0}>
          {node.label || "(sense nom)"}
        </Text>
        <Badge variant="subtle">{DRAFT_KIND_LABEL[node.kind]}</Badge>
      </HStack>
      <Info label="Surt quan">{node.when ?? "Sempre que surt el de sobre"}</Info>
      {node.issue && (
        <Info label={<HStack gap={1} color="orange.fg"><LuTriangleAlert /> Revisar</HStack>}>{node.issue}</Info>
      )}
      {rows.map(([k, v]) => (
        <Info key={k} label={k}>
          {v}
        </Info>
      ))}
      {links.map((l) => (
        <Info key={l.title} label={l.title}>
          <HStack gap={1} wrap="wrap" mt={0.5}>
            {l.ids.map((id) => (
              <Button key={id} size="2xs" variant="subtle" onClick={() => focus(id)}>
                {label(id)}
              </Button>
            ))}
          </HStack>
        </Info>
      ))}
    </Stack>
  )
}

function Info({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Box fontSize="xs">
      <Text as="div" color="fg.muted">
        {label}
      </Text>
      {children}
    </Box>
  )
}

/** Com és a l'app (del registre): el fitxer de la UI, el per defecte i les notes. */
function appRows(node: DraftNode): [string, ReactNode][] {
  const ref = registryRef(node.id)
  const opt = optionNode(ref.optionId)
  const choice = ref.value !== undefined ? opt?.choices?.find((c) => c.value === ref.value) : undefined
  const rows: [string, ReactNode][] = []
  if (opt && ref.value === undefined) {
    if (opt.code) rows.push(["Fitxer", <code key="c">src/{opt.code}</code>])
    const def = opt.defaultText ?? (opt.default === undefined ? undefined : String(opt.default))
    if (def) rows.push(["Per defecte", def])
    if (opt.why) rows.push(["Amagar-la", opt.why])
    if (opt.note) rows.push(["Nota de l'app", opt.note])
  }
  if (choice?.note) rows.push(["Nota de l'app", choice.note])
  return rows
}
