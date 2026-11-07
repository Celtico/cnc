import { Badge, Box, Button, Checkbox, CloseButton, Dialog, HStack, Input, Portal, Stack, Table, Text } from "@chakra-ui/react"
import { useMemo, useRef, useState } from "react"
import { LuFilePlus, LuTrash2 } from "react-icons/lu"
import { budgetPriceFrom, netPrice, parsePriceList, searchPriceLists, supplierFromFile, type ParsedPriceList } from "../../core/pricelist/parse"
import { addPriceList, deletePriceList, updatePriceList, usePriceLists } from "../../db/priceLists"
import { eur } from "../../core/export/budget"
import { pdfText } from "./pdfText"

/** La fila del pressupost que demana preu: la seva unitat i, si és un tauler, els m² del tauler del nesting. */
export interface PriceTarget {
  concept: string
  unit: "m²" | "m" | "u"
  boardArea?: number | null
  onPick: (price: number, note: string) => void
}

interface Import extends ParsedPriceList {
  file: string
  supplier: string
  discount: number
  on: boolean[]
}

/** Les files que es mostren en revisar una tarifa importada (les altres es desen igual si estan marcades). */
const REVIEW_MAX = 400

/**
 * Tarifes de preus dels proveïdors: s'hi afegeix un PDF (se'n llegeixen les files amb preu, es revisen i es desen al
 * navegador), es busca a totes alhora i, si s'ha obert des d'una fila del pressupost (`target`), «Usa» hi posa el preu net.
 */
export function PriceListsDialog({ open, onClose, query, target }: { open: boolean; onClose: () => void; query: string; target: PriceTarget | null }) {
  const lists = usePriceLists()
  const [q, setQ] = useState(query)
  const [shownFor, setShownFor] = useState(query)
  if (query !== shownFor) {
    setShownFor(query)
    setQ(query)
  }
  const [imp, setImp] = useState<Import | null>(null)
  const [msg, setMsg] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => (lists && !imp ? searchPriceLists(lists, q) : []), [lists, q, imp])

  const read = async (f: File) => {
    setMsg("Llegint el PDF…")
    try {
      const { lines, outline } = await pdfText(await f.arrayBuffer(), (n, total) => setMsg(`Llegint el PDF… pàgina ${n} de ${total}`))
      const parsed = parsePriceList(lines, outline)
      const supplier = supplierFromFile(f.name, [...new Set((lists ?? []).map((l) => l.supplier))])
      setImp({ ...parsed, file: f.name, supplier, discount: 0, on: parsed.rows.map(() => true) })
      setMsg(
        !lines.length
          ? "Aquest PDF no té text (és una imatge escanejada) i no el puc llegir."
          : parsed.rows.length
            ? "Revisa les files: desmarca les que no són productes."
            : "No he trobat preus al text d'aquest PDF.",
      )
    } catch {
      setMsg("No s'ha pogut obrir el PDF.")
    }
  }

  const save = async () => {
    if (!imp) return
    const rows = imp.rows.filter((_, i) => imp.on[i])
    try {
      await addPriceList({ rows, chapters: imp.chapters, titles: imp.titles, supplier: imp.supplier, file: imp.file, discount: imp.discount })
      setMsg(`Tarifa de ${imp.supplier} desada: ${rows.length} productes.`)
      setImp(null)
    } catch {
      setMsg("No s'ha pogut desar la tarifa. Torna-ho a provar.")
    }
  }

  const close = () => {
    setImp(null)
    setMsg("")
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && close()} size="xl" scrollBehavior="inside">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Tarifes dels proveïdors</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              <Stack gap={4}>
                {target && !imp && (
                  <Text fontSize="sm" color="fg.muted">
                    Preu per a «{target.concept}»: busca el producte i clica «Usa» (s'hi posa el preu net, amb el descompte del proveïdor).
                  </Text>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ""
                    if (f) void read(f)
                  }}
                />
                {imp ? (
                  <ImportReview imp={imp} setImp={setImp} />
                ) : (
                  <>
                    <HStack gap={2} wrap="wrap">
                      <Button size="sm" colorPalette="wood" onClick={() => fileRef.current?.click()}>
                        <LuFilePlus /> Afegeix una tarifa (PDF)
                      </Button>
                      {msg && (
                        <Text fontSize="sm" color="fg.muted">
                          {msg}
                        </Text>
                      )}
                    </HStack>
                    <ListsTable lists={lists ?? []} />
                    <Input size="sm" type="search" placeholder="Busca a totes les tarifes: referència o paraules (frontissa 110, melamina blanca 19…)" value={q} onChange={(e) => setQ(e.target.value)} />
                    {q.trim() && (
                      <Box overflowX="auto">
                        <Table.Root size="sm" variant="line">
                          <Table.Header>
                            <Table.Row>
                              <Table.ColumnHeader>Proveïdor</Table.ColumnHeader>
                              <Table.ColumnHeader>Referència</Table.ColumnHeader>
                              <Table.ColumnHeader>Producte</Table.ColumnHeader>
                              <Table.ColumnHeader textAlign="end">Tarifa</Table.ColumnHeader>
                              <Table.ColumnHeader textAlign="end">Net</Table.ColumnHeader>
                              {target && <Table.ColumnHeader />}
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {hits.length ? (
                              hits.map(({ list, row }, i) => {
                                const pick = target ? budgetPriceFrom({ list, row }, target) : null
                                return (
                                  <Table.Row key={`${list.id}-${i}`}>
                                    <Table.Cell>{list.supplier}</Table.Cell>
                                    <Table.Cell fontFamily="mono" fontSize="xs">
                                      {row.ref}
                                    </Table.Cell>
                                    <Table.Cell whiteSpace="normal">
                                      {list.titles[row.title] && <Text fontWeight="medium">{list.titles[row.title]}</Text>}
                                      <Text fontSize="xs" color="fg.muted">
                                        {row.desc} · {list.chapters[row.chap]} · pàg. {row.page}
                                      </Text>
                                    </Table.Cell>
                                    <Table.Cell textAlign="end" whiteSpace="nowrap">
                                      {eur(row.price)}
                                      {row.unit && `/${row.unit}`}
                                    </Table.Cell>
                                    <Table.Cell textAlign="end" whiteSpace="nowrap" fontWeight="medium">
                                      {eur(netPrice(row, list))}
                                    </Table.Cell>
                                    {target && pick && (
                                      <Table.Cell textAlign="end">
                                        <Button
                                          size="xs"
                                          variant="outline"
                                          title={pick.note}
                                          onClick={() => {
                                            target.onPick(pick.price, pick.note)
                                            close()
                                          }}
                                        >
                                          Usa {eur(pick.price)}/{target.unit}
                                        </Button>
                                      </Table.Cell>
                                    )}
                                  </Table.Row>
                                )
                              })
                            ) : (
                              <Table.Row>
                                <Table.Cell colSpan={6}>{lists?.length ? "No he trobat res. Prova amb menys paraules o amb la referència." : "Encara no hi ha cap tarifa."}</Table.Cell>
                              </Table.Row>
                            )}
                          </Table.Body>
                        </Table.Root>
                        {hits.length > 1 && (
                          <Text fontSize="xs" color="fg.muted" mt={2}>
                            {hits.length === 200 ? "Els 200 primers resultats" : `${hits.length} resultats`}, del més semblant al menys i, després, del més barat.
                          </Text>
                        )}
                      </Box>
                    )}
                  </>
                )}
              </Stack>
            </Dialog.Body>
            {imp && (
              <Dialog.Footer>
                <Text fontSize="sm" color="fg.muted" flex={1}>
                  {msg}
                </Text>
                <Button variant="outline" onClick={() => setImp(null)}>
                  Cancel·la
                </Button>
                <Button colorPalette="wood" disabled={!imp.on.some(Boolean)} onClick={() => void save()}>
                  Desa la tarifa
                </Button>
              </Dialog.Footer>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

/** Les tarifes desades: proveïdor, fitxer, productes, descompte (es desa en sortir del camp) i esborrar. */
function ListsTable({ lists }: { lists: { id: string; supplier: string; file: string; rows: unknown[]; chapters: string[]; discount: number; createdAt: number }[] }) {
  if (!lists.length)
    return (
      <Text fontSize="sm" color="fg.muted">
        Encara no hi ha cap tarifa. Afegeix el PDF de tarifes d'un proveïdor: se'n llegeixen les referències i els preus, i es desen en aquest navegador.
      </Text>
    )
  return (
    <Stack gap={1}>
      {lists.map((l) => (
        <HStack key={l.id} gap={3} wrap="wrap" fontSize="sm" borderBottomWidth="1px" py={1}>
          <Text fontWeight="semibold">{l.supplier}</Text>
          <Text color="fg.muted" flex={1} minW="120px" truncate>
            {l.file} · {l.rows.length} productes · {l.chapters.length || 1} capítols · {new Date(l.createdAt).toLocaleDateString("ca-ES")}
          </Text>
          <HStack gap={1}>
            <Text color="fg.muted">Dte. %</Text>
            <Input
              size="xs"
              width="60px"
              textAlign="right"
              inputMode="decimal"
              defaultValue={l.discount ? String(l.discount).replace(".", ",") : ""}
              placeholder="0"
              aria-label={`Descompte de ${l.supplier}`}
              onBlur={(e) => {
                const v = Number(e.target.value.replace(",", ".") || 0)
                if (Number.isFinite(v) && v !== l.discount) void updatePriceList(l.id, { discount: Math.min(100, Math.max(0, v)) })
              }}
            />
          </HStack>
          <Button size="xs" variant="ghost" aria-label={`Esborra la tarifa de ${l.supplier}`} onClick={() => void deletePriceList(l.id)}>
            <LuTrash2 />
          </Button>
        </HStack>
      ))}
    </Stack>
  )
}

/** Revisar una tarifa importada: proveïdor, descompte i les files que es desen. */
function ImportReview({ imp, setImp }: { imp: Import; setImp: (i: Import) => void }) {
  const on = imp.on.filter(Boolean).length
  const setAll = (v: boolean) => setImp({ ...imp, on: imp.on.map(() => v) })
  return (
    <Stack gap={3}>
      <HStack gap={3} wrap="wrap" fontSize="sm">
        <HStack gap={2} flex={1} minW="200px">
          <Text color="fg.muted">Proveïdor</Text>
          <Input size="sm" value={imp.supplier} onChange={(e) => setImp({ ...imp, supplier: e.target.value })} />
        </HStack>
        <HStack gap={2}>
          <Text color="fg.muted">Descompte %</Text>
          <Input
            size="sm"
            width="70px"
            inputMode="decimal"
            value={imp.discount ? String(imp.discount) : ""}
            placeholder="0"
            onChange={(e) => setImp({ ...imp, discount: Math.min(100, Math.max(0, Number(e.target.value.replace(",", ".")) || 0)) })}
          />
        </HStack>
      </HStack>
      <HStack gap={2} wrap="wrap">
        <Badge>{imp.file}</Badge>
        <Text fontSize="sm" color="fg.muted">
          {imp.rows.length} files amb preu · {on} triades
        </Text>
        <Button size="xs" variant="ghost" onClick={() => setAll(true)}>
          Totes
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setAll(false)}>
          Cap
        </Button>
      </HStack>
      <Box overflowX="auto">
        <Table.Root size="sm" variant="line">
          <Table.Body>
            {imp.rows.slice(0, REVIEW_MAX).map((r, i) => (
              <Table.Row key={i} opacity={imp.on[i] ? 1 : 0.45}>
                <Table.Cell width="32px">
                  <Checkbox.Root size="sm" checked={imp.on[i]} onCheckedChange={(e) => setImp({ ...imp, on: imp.on.map((v, k) => (k === i ? !!e.checked : v)) })}>
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                  </Checkbox.Root>
                </Table.Cell>
                <Table.Cell fontFamily="mono" fontSize="xs">
                  {r.ref}
                </Table.Cell>
                <Table.Cell whiteSpace="normal">
                  {imp.titles[r.title] && <Text fontWeight="medium">{imp.titles[r.title]}</Text>}
                  <Text fontSize="xs" color="fg.muted">
                    {r.desc} · {imp.chapters[r.chap]} · pàg. {r.page}
                  </Text>
                </Table.Cell>
                <Table.Cell textAlign="end" whiteSpace="nowrap">
                  {eur(r.price)}
                  {r.unit && `/${r.unit}`}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {imp.rows.length > REVIEW_MAX && (
          <Text fontSize="xs" color="fg.muted" mt={2}>
            Se'n mostren les {REVIEW_MAX} primeres; les altres {imp.rows.length - REVIEW_MAX} també es desen.
          </Text>
        )}
      </Box>
    </Stack>
  )
}
