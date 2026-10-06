import { Badge, Box, Button, Checkbox, Dialog, HStack, Portal, Stack, Text } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { LuUpload } from "react-icons/lu"
import { ChoiceChips } from "../../components/FormRow"
import { SearchBar } from "../../components/SearchBar"
import type { HettichArticle } from "../../core/import/hettich"
import { fold } from "../projects/galleryGrid"

/** Quants articles es llisten alhora (un ZIP sencer en porta ~1000: es filtra amb la cerca). */
const MAX_ROWS = 250

type Filter = "all" | "hinge" | "plate" | "other"

const FILE_LABEL: Record<string, string> = { step: "STEP", front: "frontal", side: "lateral", top: "planta", dxf3d: "DXF 3D", dwg: "DWG", "3ds": "3DS", pdf: "PDF", other: "altres" }

/**
 * Llista dels articles trobats en importar del fabricant (`hardwareImport.ts`): número, què és (categoria i carpeta,
 * traduïdes), quins fitxers en porta i si es pot importar (frontisses i plaques amb el STEP; la resta, el motiu). Cerca
 * (número, nom o carpeta), filtre per tipus i «Importar» els triats.
 */
export function HardwareImportDialog({
  articles,
  fileCount,
  busy,
  progress,
  onCancel,
  onImport,
}: {
  articles: HettichArticle[] | null
  fileCount: number
  busy: boolean
  progress: { done: number; total: number } | null
  onCancel: () => void
  onImport: (selected: HettichArticle[]) => void
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const list = useMemo(() => articles ?? [], [articles])
  const counts = useMemo(() => ({ hinge: list.filter((a) => a.kind === "hinge").length, plate: list.filter((a) => a.kind === "plate").length, other: list.filter((a) => a.kind === "none").length }), [list])
  const q = fold(query.trim())
  const shown = useMemo(
    () =>
      list.filter(
        (a) =>
          (filter === "all" || (filter === "other" ? a.kind === "none" : a.kind === filter)) &&
          (!q || fold(`${a.article} ${a.label} ${a.group} ${a.folders.join(" ")}`).includes(q)),
      ),
    [list, filter, q],
  )
  const visible = shown.slice(0, MAX_ROWS)
  const selectable = visible.filter((a) => a.kind !== "none")
  const toggle = (id: string, on: boolean) =>
    setPicked((s) => {
      const n = new Set(s)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  const chosen = list.filter((a) => picked.has(a.article))
  return (
    <Dialog.Root open={articles !== null} onOpenChange={(e) => !e.open && !busy && onCancel()} size={{ base: "full", md: "xl" }} scrollBehavior="inside" placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content data-testid="hardware-import-dialog">
            <Dialog.Header>
              <Stack gap={0.5}>
                <Dialog.Title>Importar del fabricant</Dialog.Title>
                <Text fontSize="sm" color="fg.muted">
                  Hettich · {list.length} articles en {fileCount} fitxers · {counts.hinge} frontisses i {counts.plate} plaques es poden importar
                </Text>
              </Stack>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                <SearchBar value={query} onChange={setQuery} ariaLabel="Cercar articles" placeholder="Número, nom o carpeta…" />
                <HStack gap={2} wrap="wrap" justify="space-between">
                  <ChoiceChips
                    label="Tipus"
                    value={filter}
                    onChange={setFilter}
                    options={[
                      { id: "all", label: `Tots (${list.length})` },
                      { id: "hinge", label: `Frontisses (${counts.hinge})` },
                      { id: "plate", label: `Plaques (${counts.plate})` },
                      { id: "other", label: `Altres (${counts.other})` },
                    ]}
                  />
                  <HStack gap={1}>
                    <Button size="xs" variant="ghost" disabled={!selectable.length} onClick={() => setPicked((s) => new Set([...s, ...selectable.map((a) => a.article)]))}>
                      Triar els visibles
                    </Button>
                    <Button size="xs" variant="ghost" disabled={!picked.size} onClick={() => setPicked(new Set())}>
                      Cap
                    </Button>
                  </HStack>
                </HStack>
                <Stack gap={0} borderWidth="1px" rounded="l2" overflow="hidden">
                  {visible.map((a) => {
                    const disabled = a.kind === "none"
                    return (
                      <Box key={a.article} px={3} py={2} borderTopWidth="1px" borderColor="border.muted" _first={{ borderTopWidth: 0 }} opacity={disabled ? 0.6 : 1} data-testid={`hw-article-${a.article}`}>
                        <Checkbox.Root size="sm" checked={picked.has(a.article)} disabled={disabled || busy} onCheckedChange={(e) => toggle(a.article, !!e.checked)} alignItems="flex-start" w="full">
                          <Checkbox.HiddenInput />
                          <Checkbox.Control mt={0.5} />
                          <Checkbox.Label flex={1} minW={0}>
                            <Stack gap={0.5} minW={0}>
                              <HStack gap={2} minW={0}>
                                <Text as="span" fontFamily="mono" fontSize="sm">
                                  {a.article}
                                </Text>
                                <Text as="span" fontSize="sm" fontWeight="medium" truncate>
                                  {a.label.replace(new RegExp(`\\s*${a.article}$`), "")}
                                </Text>
                              </HStack>
                              <Text fontSize="xs" color="fg.muted" truncate>
                                {a.group}
                              </Text>
                              <HStack gap={1} wrap="wrap">
                                {[...new Set(a.files.map((f) => f.kind))].map((k) => (
                                  <Badge key={k} size="xs" variant={k === "step" ? "solid" : "subtle"} colorPalette={k === "step" ? "wood" : "gray"}>
                                    {FILE_LABEL[k]}
                                  </Badge>
                                ))}
                                {a.reason && (
                                  <Text as="span" fontSize="xs" color="fg.muted">
                                    {a.reason}
                                  </Text>
                                )}
                              </HStack>
                            </Stack>
                          </Checkbox.Label>
                        </Checkbox.Root>
                      </Box>
                    )
                  })}
                  {!visible.length && (
                    <Text fontSize="sm" color="fg.muted" p={3}>
                      Cap article.
                    </Text>
                  )}
                </Stack>
                {shown.length > visible.length && (
                  <Text fontSize="xs" color="fg.muted">
                    … i {shown.length - visible.length} més: afina la cerca.
                  </Text>
                )}
                <Text fontSize="xs" color="fg.muted">
                  Dels fitxers STEP en surten els forats proposats i el model 3D; de les vistes DXF, el dibuix. Tot entra <strong>sense confirmar</strong>: no fa cap forat
                  fins que el revisis i el confirmis. Les frontisses s'aparellen amb la primera placa que importis alhora.
                </Text>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" disabled={busy} onClick={onCancel}>
                Cancel·lar
              </Button>
              <Button colorPalette="wood" loading={busy} loadingText={progress ? `Important ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…` : "Important…"} disabled={!chosen.length} onClick={() => onImport(chosen)}>
                <LuUpload /> Importar{chosen.length ? ` (${chosen.length})` : ""}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
