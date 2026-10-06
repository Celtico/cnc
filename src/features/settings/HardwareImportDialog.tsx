import { Badge, Box, Button, Checkbox, Dialog, HStack, Portal, Stack, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { LuUpload } from "react-icons/lu"
import { ChoiceChips } from "../../components/FormRow"
import { SearchBar } from "../../components/SearchBar"
import type { HettichArticle, ImportKind } from "../../core/import/hettich"
import { fold } from "../projects/galleryGrid"

/** Quants articles es llisten alhora (un ZIP sencer en porta ~1000: es filtra amb la cerca). */
const MAX_ROWS = 250

type Filter = "all" | ImportKind

/** Els tipus del filtre, en aquest ordre (només surten els que hi són). */
const KINDS: { id: ImportKind; one: string; many: string; chip: string }[] = [
  { id: "hinge", one: "frontissa", many: "frontisses", chip: "Frontisses" },
  { id: "plate", one: "placa", many: "plaques", chip: "Plaques" },
  { id: "handle", one: "tirador", many: "tiradors", chip: "Tiradors" },
  { id: "leg", one: "pota", many: "potes", chip: "Potes" },
  { id: "model", one: "només 3D", many: "només 3D", chip: "Només 3D" },
  { id: "none", one: "no es pot importar", many: "no es poden importar", chip: "No es poden importar" },
]

const FILE_LABEL: Record<string, string> = { step: "STEP", front: "frontal", side: "lateral", top: "planta", dxf3d: "DXF 3D", dwg: "DWG", "3ds": "3DS", pdf: "PDF", other: "altres" }

/** «585 tiradors, 74 poms i 88 només 3D es poden importar»: els comptes per tipus. */
function importSummary(counts: Partial<Record<ImportKind, number>>): string {
  const parts = KINDS.filter((k) => k.id !== "none" && counts[k.id]).map((k) => `${counts[k.id]} ${counts[k.id] === 1 ? k.one : k.many}`)
  const can = parts.length ? `${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} i ${parts.at(-1)}` : parts[0]} es poden importar` : "cap es pot importar"
  return counts.none ? `${can} · ${counts.none} ${counts.none === 1 ? KINDS.at(-1)!.one : KINDS.at(-1)!.many} (sense STEP)` : can
}

/**
 * Llista dels articles trobats en importar del fabricant (`hardwareImport.ts`): número, què és (categoria i carpeta,
 * traduïdes), quins fitxers en porta i **què se'n farà** («Tirador · 128 mm», «Pota · 4 forats a cada pota», «Només 3D:
 * sense forats»; la dels tiradors i les potes es calcula llegint el STEP dels que es veuen, `analyse`). Cerca (número,
 * nom o carpeta), filtre per tipus i «Importar» els triats. Tot es pot importar menys el que no porta STEP.
 */
export function HardwareImportDialog({
  articles,
  fileCount,
  busy,
  progress,
  analyse,
  onCancel,
  onImport,
}: {
  articles: HettichArticle[] | null
  fileCount: number
  busy: boolean
  progress: { done: number; total: number } | null
  /** Què farà de debò un article (llegint el STEP): la nota de la fila. */
  analyse?: (a: HettichArticle) => Promise<string>
  onCancel: () => void
  onImport: (selected: HettichArticle[]) => void
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const list = useMemo(() => articles ?? [], [articles])
  const counts = useMemo(() => {
    const c: Partial<Record<ImportKind, number>> = {}
    for (const a of list) c[a.kind] = (c[a.kind] ?? 0) + 1
    return c
  }, [list])
  const q = fold(query.trim())
  const shown = useMemo(
    () => list.filter((a) => (filter === "all" || a.kind === filter) && (!q || fold(`${a.article} ${a.label} ${a.group} ${a.folders.join(" ")}`).includes(q))),
    [list, filter, q],
  )
  const visible = useMemo(() => shown.slice(0, MAX_ROWS), [shown])
  // Notes calculades (llegint el STEP) dels tiradors i les potes que es veuen, de mica en mica.
  const [notes, setNotes] = useState<Record<string, string>>({})
  const asked = useRef(new Set<string>())
  useEffect(() => {
    if (!analyse) return
    const todo = visible.filter((a) => (a.kind === "handle" || a.kind === "leg") && !asked.current.has(a.article))
    if (!todo.length) return
    let stop = false
    void (async () => {
      let batch: Record<string, string> = {}
      let last = performance.now()
      for (const a of todo) {
        if (stop) break
        asked.current.add(a.article)
        batch[a.article] = await analyse(a)
        if (performance.now() - last > 120) {
          const b = batch
          batch = {}
          last = performance.now()
          setNotes((n) => ({ ...n, ...b }))
          // Deixa respirar la pàgina.
          await new Promise((r) => setTimeout(r, 0))
        }
      }
      if (Object.keys(batch).length) setNotes((n) => ({ ...n, ...batch }))
    })()
    return () => {
      stop = true
    }
  }, [visible, analyse])
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
                  Hettich · {list.length} articles en {fileCount} fitxers · {importSummary(counts)}
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
                    options={[{ id: "all" as Filter, label: `Tots (${list.length})` }, ...KINDS.filter((k) => counts[k.id]).map((k) => ({ id: k.id as Filter, label: `${k.chip} (${counts[k.id]})` }))]}
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
                                <Text as="span" fontSize="xs" color={a.kind === "none" ? "fg.error" : /^Només 3D/.test(notes[a.article] ?? a.plan ?? "") ? "fg.muted" : "fg"} data-testid={`hw-plan-${a.article}`}>
                                  {notes[a.article] ?? a.plan ?? a.reason}
                                </Text>
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
                  Dels fitxers STEP en surten els forats proposats i el model 3D; de les vistes DXF, el dibuix. Frontisses, plaques, tiradors i potes entren{" "}
                  <strong>sense confirmar</strong>: no fan cap forat fins que els revisis i els confirmis. El que no té cap regla de mecanitzat (o no s'hi troba el
                  patró de forats) entra com a <strong>només 3D</strong>: el model, mai cap forat. Les frontisses s'aparellen amb la placa del lot si n'hi ha una.
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
