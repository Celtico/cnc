import { Badge, Box, Button, Checkbox, Dialog, HStack, Portal, Stack, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { LuUpload } from "react-icons/lu"
import { ChoiceChips } from "../../components/FormRow"
import { SearchBar } from "../../components/SearchBar"
import type { HettichArticle, ImportKind } from "../../core/import/hettich"
import { FILE_SOURCE, makerOf } from "../../core/import/makers"
import { mergeText, type MergePreview } from "../../core/import/merge"
import { fold } from "../projects/galleryGrid"

/** Quants articles es llisten alhora (un ZIP sencer en porta ~1000: es filtra amb la cerca). */
const MAX_ROWS = 250

/** `xilog`: els que porten un programa Xilog (mecanitzats exactes). */
type Filter = "all" | ImportKind | "xilog"
const hasPgm = (a: HettichArticle) => a.files.some((f) => f.kind === "pgm")

/** Els tipus del filtre, en aquest ordre (només surten els que hi són). */
const KINDS: { id: ImportKind; one: string; many: string; chip: string }[] = [
  { id: "hinge", one: "frontissa", many: "frontisses", chip: "Frontisses" },
  { id: "plate", one: "placa", many: "plaques", chip: "Plaques" },
  { id: "handle", one: "tirador", many: "tiradors", chip: "Tiradors" },
  { id: "leg", one: "pota", many: "potes", chip: "Potes" },
  { id: "model", one: "només 3D", many: "només 3D", chip: "Només 3D" },
  { id: "none", one: "no es pot importar", many: "no es poden importar", chip: "No es poden importar" },
]

/** Les fonts d'un article: «STEP», «DXF», «PGM (Xilog)»… (les vistes 2D i el DXF del taller, «DXF»). */
const sourceLabel = (k: string) => FILE_SOURCE[k as keyof typeof FILE_SOURCE] ?? (k === "other" ? "DXF" : k)
/** Les fonts que es fan servir (en color); la resta (DWG, DXF 3D, SAT, MAX, altres CAM) no es llegeixen. */
const USED = new Set(["STEP", "IGES", "3DS", "DAE", "PGM (Xilog)", "DXF", "PDF", "PDF / plànol"])

/** «585 tiradors, 74 poms i 88 només 3D es poden importar»: els comptes per tipus. */
function importSummary(counts: Partial<Record<ImportKind, number>>, xilog = 0): string {
  const parts = [...(xilog ? [`${xilog} amb mecanitzats exactes (Xilog)`] : []), ...KINDS.filter((k) => k.id !== "none" && counts[k.id]).map((k) => `${counts[k.id]} ${counts[k.id] === 1 ? k.one : k.many}`)]
  const can = parts.length ? `${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} i ${parts.at(-1)}` : parts[0]} es poden importar` : "cap es pot importar"
  return counts.none ? `${can} · ${counts.none} ${counts.none === 1 ? KINDS.at(-1)!.one : KINDS.at(-1)!.many} (sense cap fitxer que es llegeixi)` : can
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
  loose = [],
  busy,
  progress,
  analyse,
  merge,
  onCancel,
  onImport,
}: {
  articles: HettichArticle[] | null
  fileCount: number
  /** Fitxers sense article (no s'importen): es diuen a sota. */
  loose?: string[]
  busy: boolean
  progress: { done: number; total: number } | null
  /** Què farà de debò un article (llegint el STEP): la nota de la fila. */
  analyse?: (a: HettichArticle) => Promise<string>
  /** Si l'article ja és a la biblioteca: què s'hi afegirà (`mergePreview`); `null` = nou. */
  merge?: (a: HettichArticle) => MergePreview | null
  onCancel: () => void
  onImport: (selected: HettichArticle[]) => void
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const list = useMemo(() => articles ?? [], [articles])
  const counts = useMemo(() => {
    const c: Partial<Record<ImportKind, number>> = {}
    // Els que porten un programa Xilog es compten a part (no són «només 3D»: tenen mecanitzats exactes).
    for (const a of list) if (!(a.kind === "model" && hasPgm(a))) c[a.kind] = (c[a.kind] ?? 0) + 1
    return c
  }, [list])
  const merges = useMemo(() => new Map(list.map((a) => [a.article, merge?.(a) ?? null])), [list, merge])
  const existing = [...merges.values()].filter(Boolean).length
  const q = fold(query.trim())
  const shown = useMemo(
    () => list.filter((a) => (filter === "all" || (filter === "xilog" ? hasPgm(a) : a.kind === filter && !(filter === "model" && hasPgm(a)))) && (!q || fold(`${a.article} ${a.label} ${a.group} ${a.folders.join(" ")} ${makerOf(a)}`).includes(q))),
    [list, filter, q],
  )
  const makers = useMemo(() => [...new Set(list.map(makerOf))], [list])
  const xilog = useMemo(() => list.filter(hasPgm).length, [list])
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
  const selectable = visible.filter((a) => a.kind !== "none" || merges.get(a.article))
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
                  {makers.join(" · ") || "Fabricant"} · {list.length} articles en {fileCount} fitxers · {importSummary(counts, xilog)}
                  {existing ? ` · ${existing} ja ${existing === 1 ? "és" : "són"} a la biblioteca (s'hi afegeix el que falti)` : ""}
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
                      { id: "all" as Filter, label: `Tots (${list.length})` },
                      ...(xilog ? [{ id: "xilog" as Filter, label: `Mecanitzats exactes (${xilog})` }] : []),
                      ...KINDS.filter((k) => counts[k.id]).map((k) => ({ id: k.id as Filter, label: `${k.chip} (${counts[k.id]})` })),
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
                    const m = merges.get(a.article) ?? null
                    const disabled = a.kind === "none" && !m
                    return (
                      <Box key={a.article} px={3} py={2} borderTopWidth="1px" borderColor="border.muted" _first={{ borderTopWidth: 0 }} opacity={disabled ? 0.6 : 1} data-testid={`hw-article-${a.article}`}>
                        <Checkbox.Root size="sm" checked={picked.has(a.article)} disabled={disabled || busy} onCheckedChange={(e) => toggle(a.article, !!e.checked)} alignItems="flex-start" w="full">
                          <Checkbox.HiddenInput />
                          <Checkbox.Control mt={0.5} />
                          <Checkbox.Label flex={1} minW={0}>
                            <Stack gap={0.5} minW={0}>
                              <HStack gap={2} minW={0}>
                                {makers.length > 1 || makerOf(a) !== "Hettich" ? (
                                  <Badge size="xs" variant="outline" flexShrink={0} data-testid={`hw-maker-${a.article}`}>
                                    {makerOf(a)}
                                  </Badge>
                                ) : null}
                                <Text as="span" fontFamily="mono" fontSize="sm">
                                  {a.article}
                                </Text>
                                <Text as="span" fontSize="sm" fontWeight="medium" truncate>
                                  {(m?.items[0]?.name ?? a.label).replace(new RegExp(`\\s*(·\\s*)?${a.article}$`), "")}
                                </Text>
                                {!m && (
                                  <Badge size="xs" variant="subtle" colorPalette="green" flexShrink={0} data-testid={`hw-merge-${a.article}`}>
                                    Nou
                                  </Badge>
                                )}
                              </HStack>
                              {m && (
                                <Text fontSize="xs" color={m.adds.length ? "wood.fg" : "fg.muted"} truncate data-testid={`hw-adds-${a.article}`}>
                                  {mergeText(m)}
                                </Text>
                              )}
                              <Text fontSize="xs" color="fg.muted" truncate>
                                {a.group}
                              </Text>
                              <HStack gap={1} wrap="wrap">
                                {[...new Set(a.files.map((f) => sourceLabel(f.kind)))].map((k) => (
                                  <Badge
                                    key={k}
                                    size="xs"
                                    variant={k === "STEP" || k === "PGM (Xilog)" ? "solid" : "subtle"}
                                    colorPalette={k === "STEP" || k === "PGM (Xilog)" ? "wood" : "gray"}
                                    opacity={USED.has(k) ? 1 : 0.6}
                                    title={USED.has(k) ? undefined : "No es llegeix"}
                                    data-testid={`hw-src-${a.article}-${k.split(" ")[0]}`}
                                  >
                                    {k}
                                  </Badge>
                                ))}
                                {/* Ja existeix: el que diu la fila d'abans («s'hi afegeix…»); la nota de què es farà és la d'un de nou. */}
                                {!(m && (a.only2d || a.refsOnly || a.kind === "none")) && (
                                  <Text as="span" fontSize="xs" color={a.kind === "none" ? "fg.error" : /^Només [23]D/.test(notes[a.article] ?? a.plan ?? "") ? "fg.muted" : "fg"} data-testid={`hw-plan-${a.article}`}>
                                    {notes[a.article] ?? a.plan ?? a.reason}
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
                {loose.length > 0 && (
                  <Text fontSize="xs" color="fg.muted" data-testid="hw-loose">
                    {loose.length} {loose.length === 1 ? "fitxer" : "fitxers"} sense article (no s'adjunten a cap ferratge):{" "}
                    {loose.slice(0, 8).map((p) => p.split("/").pop()).join(", ")}
                    {loose.length > 8 ? "…" : ""}
                  </Text>
                )}
                {shown.length > visible.length && (
                  <Text fontSize="xs" color="fg.muted">
                    … i {shown.length - visible.length} més: afina la cerca.
                  </Text>
                )}
                <Text fontSize="xs" color="fg.muted">
                  Dels fitxers STEP en surten els forats proposats i el model 3D; de les vistes DXF, el dibuix. Frontisses, plaques, tiradors i potes entren{" "}
                  <strong>sense confirmar</strong>: no fan cap forat fins que els revisis i els confirmis. El que no té cap regla de mecanitzat (o no s'hi troba el
                  patró de forats) entra com a <strong>només 3D</strong>: el model, mai cap forat; sense STEP, amb les vistes DXF, «només 2D» fins que s'hi afegeixi el STEP. Un
                  article que <strong>ja és a la biblioteca</strong> no es repeteix: s'hi afegeix el que porta de nou (el 3D, les vistes, els plànols de muntatge) i
                  mai es toquen els forats confirmats (si els fitxers en donen uns altres, l'editor ho diu per revisar-ho). Les frontisses s'aparellen amb la placa
                  del lot si n'hi ha una. De <strong>Blum</strong>, el programa <strong>Xilog (*.pgm)</strong> dona els mecanitzats exactes (el Ø, la fondària i la
                  posició des del punt de referència del producte): entren sense confirmar i es col·loquen a mà a la peça.
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
