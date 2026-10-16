import { Badge, Box, HStack, SimpleGrid, Stack, Text, Wrap } from "@chakra-ui/react"
import { useMemo, useState, type ReactNode } from "react"
import { LuChevronRight, LuDrill, LuDroplets, LuFactory, LuFlipVertical2, LuHand, LuPaintRoller, LuTriangleRight } from "react-icons/lu"
import { ChoiceChips } from "../../components/FormRow"
import type { NestPanelInfo } from "../../core/export/maestro/nestModel"
import type { ProcessKind } from "../../core/process/processes"

/** Icona i color de cada estació del taller (el nom és el `station` del pas, el mateix del LLEGEIX-ME). */
const STATION_STYLE: Record<ProcessKind, { icon: ReactNode; palette: string }> = {
  secondFace: { icon: <LuFlipVertical2 />, palette: "purple" },
  mitre: { icon: <LuTriangleRight />, palette: "orange" },
  edge: { icon: <LuPaintRoller />, palette: "teal" },
  edgeDrill: { icon: <LuDrill />, palette: "cyan" },
  glue: { icon: <LuDroplets />, palette: "yellow" },
  push: { icon: <LuHand />, palette: "pink" },
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** «A.1.H.3» → «A.1» (el mòdul de la ref del taller). */
const moduleOf = (ref: string) => ref.split(".").slice(0, 2).join(".")

function StationChip({ icon, palette, children, dim }: { icon: ReactNode; palette: string; children: ReactNode; dim?: boolean }) {
  return (
    <Badge size="sm" variant="subtle" colorPalette={palette} rounded="full" px={2} opacity={dim ? 0.45 : 1} gap={1}>
      {icon}
      {children}
    </Badge>
  )
}

/** La ruta de la peça: CNC (tauler N) → estacions, com a pastilles amb icona. */
function Route({ row, focus }: { row: NestPanelInfo; focus: ProcessKind | "all" }) {
  const seen = new Set<string>()
  const stations = row.postProcesses.filter((x) => (seen.has(x.station) ? false : (seen.add(x.station), true)))
  return (
    <Wrap gap={1} align="center">
      <StationChip icon={<LuFactory />} palette={row.tab ? "wood" : "red"} dim={focus !== "all"}>
        {row.tab ? `CNC · tauler ${row.tab}` : "No cap a cap tauler"}
      </StationChip>
      {stations.map((x) => (
        <HStack key={x.station} gap={1}>
          <Box color="fg.subtle" fontSize="xs">
            <LuChevronRight />
          </Box>
          <StationChip {...STATION_STYLE[x.kind]} dim={focus !== "all" && focus !== x.kind}>
            {cap(x.station)}
          </StationChip>
        </HStack>
      ))}
    </Wrap>
  )
}

/** Una peça: ref i nom, la ruta i els passos (només els de l'estació triada, si n'hi ha una). */
function PieceCard({ row, focus }: { row: NestPanelInfo; focus: ProcessKind | "all" }) {
  const steps = row.postProcesses.filter((x) => focus === "all" || x.kind === focus)
  return (
    <Stack gap={2.5} borderWidth="1px" rounded="lg" bg="bg.panel" p={3}>
      <HStack gap={2} align="baseline" minW={0}>
        <Badge variant="outline" colorPalette="gray" fontFamily="mono" size="md" flexShrink={0}>
          {row.ref}
        </Badge>
        <Text fontWeight="semibold" truncate title={row.label}>
          {row.label}
        </Text>
      </HStack>
      <Route row={row} focus={focus} />
      <Stack as="ol" gap={1.5} listStyleType="none" m={0} p={0}>
        {steps.map((x, k) => (
          <HStack as="li" key={k} gap={2} align="start" fontSize="sm">
            <Box as="span" color={`${STATION_STYLE[x.kind].palette}.fg`} fontSize="md" mt="0.15rem" flexShrink={0}>
              {STATION_STYLE[x.kind].icon}
            </Box>
            <Text>
              {focus === "all" && steps.length > 1 && (
                <Box as="span" color="fg.subtle" fontVariantNumeric="tabular-nums" me={1.5}>
                  {k + 1}.
                </Box>
              )}
              {x.text}
            </Text>
          </HStack>
        ))}
      </Stack>
    </Stack>
  )
}

/** «Després de la CNC»: les peces amb passos de després, per mòdul, amb un filtre per estació. */
export function PostCncList({ rows }: { rows: NestPanelInfo[] }) {
  const [focus, setFocus] = useState<ProcessKind | "all">("all")
  const withPost = useMemo(() => rows.filter((r) => r.postProcesses.length), [rows])
  const counts = useMemo(() => {
    const m = new Map<ProcessKind, { station: string; n: number }>()
    for (const r of withPost)
      for (const kind of new Set(r.postProcesses.map((x) => x.kind))) {
        const c = m.get(kind) ?? { station: r.postProcesses.find((x) => x.kind === kind)!.station, n: 0 }
        c.n += 1
        m.set(kind, c)
      }
    return m
  }, [withPost])
  const active = focus !== "all" && counts.has(focus) ? focus : "all"
  const modules = useMemo(() => {
    const m = new Map<string, NestPanelInfo[]>()
    for (const r of withPost) if (active === "all" || r.postProcesses.some((x) => x.kind === active)) m.set(moduleOf(r.ref), [...(m.get(moduleOf(r.ref)) ?? []), r])
    return [...m.entries()]
  }, [withPost, active])

  return (
    <Stack gap={4} mt={1}>
      {counts.size > 1 && (
        <ChoiceChips
          label="Estació"
          value={active}
          onChange={setFocus}
          options={[{ id: "all" as const, label: `Totes · ${withPost.length}` }, ...[...counts.entries()].map(([id, c]) => ({ id, label: `${cap(c.station)} · ${c.n}` }))]}
        />
      )}
      {modules.map(([mod, list]) => (
        <Stack key={mod} gap={2}>
          <HStack gap={2}>
            <Text fontWeight="semibold" fontSize="sm">
              Mòdul {mod.split(".")[1] ?? mod}
            </Text>
            <Badge variant="subtle" colorPalette="wood" size="sm">
              {list.length} {list.length === 1 ? "peça" : "peces"}
            </Badge>
            <Box flex={1} borderTopWidth="1px" borderColor="border.muted" />
          </HStack>
          <SimpleGrid columns={{ base: 1, md: 2, "2xl": 3 }} gap={2}>
            {list.map((r) => (
              <PieceCard key={r.ref} row={r} focus={active} />
            ))}
          </SimpleGrid>
        </Stack>
      ))}
      <Text fontSize="xs" color="fg.muted">
        Cantells amb la numeració de l'app (1 dalt · 2 dreta · 3 baix · 4 esquerra).
      </Text>
    </Stack>
  )
}
