import { Box, Button, Checkbox, CloseButton, Dialog, Field, HStack, Input, NativeSelect, Portal, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import { useMemo, useState, type ReactNode } from "react"
import { NumRow } from "../../components/NumRow"
import { moduleOfCab, taulellMaterial, type TaulellCab } from "../../core/import/taulell"
import { boardChoices, newId, type Module, type Settings } from "../../core/model"
import { MaterialSelect } from "../settings/MaterialSelect"
import { toaster } from "../../components/ui/toaster"

/**
 * **Nou moble** de Modelatge (el formulari del Taulell, cel 2026-11-07): les mateixes opcions i els mateixos noms, amb els
 * nostres components. El moble es fa amb la mateixa fórmula que obre els `.taulell` (`moduleOfCab`), així surt un mòdul
 * normal del cnc. Recorda les últimes opcions: el següent moble nou surt igual que l'últim.
 */

const KEY = "cnc-nou-moble-v1"
/** Els valors de fàbrica (els de `CABDEF` del Taulell, «Buc bàsic»). */
const DEF: Required<Pick<TaulellCab, "W" | "H" | "D" | "pl" | "tj" | "t" | "tb" | "cols" | "shelves" | "ss" | "drawers" | "drawerH" | "dhs" | "dsys" | "doors" | "plinth" | "plinthJoin" | "feet" | "topT" | "railW" | "railV" | "back" | "bset" | "bdep" | "bmat" | "s32">> & { cm: string; dm: string } = {
  W: 1000,
  H: 860,
  D: 560,
  pl: 100,
  tj: 1,
  t: 19,
  tb: 19,
  cols: 1,
  shelves: 0,
  ss: 1,
  drawers: 0,
  drawerH: 181,
  dhs: "",
  dsys: "fusta",
  doors: false,
  plinth: false,
  plinthJoin: true,
  feet: "axilo",
  topT: "front",
  railW: 200,
  railV: "none",
  back: "inside",
  bset: 49,
  bdep: 8,
  bmat: "auto",
  s32: true,
  cm: "",
  dm: "",
}
type Cab = typeof DEF

function load(): Cab {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Cab> | null
    return { ...DEF, ...(raw ?? {}) }
  } catch {
    return DEF
  }
}
function save(c: Cab) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* sense desar: el formulari funciona igual */
  }
}

/** Els models del Nou moble (com els del Taulell): nom, família, subfamília i les opcions. */
type Model = { n: string; fam?: string; sub?: string; p: Cab }
const MODELS_KEY = "cnc-nou-moble-models-v1"
/** Els models de fàbrica: el «Buc bàsic» del Taulell. */
const FACTORY: Model[] = [{ n: "Buc bàsic", p: DEF }]
function loadModels(): { list: Model[]; cur: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(MODELS_KEY) ?? "null") as { list: Model[]; cur: number } | null
    if (raw?.list?.length) return { list: raw.list.map((m) => ({ ...m, p: { ...DEF, ...m.p } })), cur: Math.min(raw.cur ?? 0, raw.list.length - 1) }
  } catch {
    /* res desat */
  }
  return { list: FACTORY, cur: 0 }
}
function saveModels(v: { list: Model[]; cur: number }) {
  try {
    localStorage.setItem(MODELS_KEY, JSON.stringify(v))
  } catch {
    /* sense desar */
  }
}

/** Les potes AXILO 78 del Taulell (`axiloFor`): l'alçada nominal, el que regula i la referència, per al sòcol triat. */
const AXILO: [number, number, number, string][] = [
  [60, 53, 80, "637.76.351"],
  [80, 70, 100, "637.76.352"],
  [100, 90, 120, "637.76.353"],
  [125, 115, 145, "637.76.354"],
  [150, 140, 170, "637.76.355"],
]
const axiloFor = (pl: number) => {
  const ok = AXILO.filter((m) => m[0] <= pl)
  const m = ok.length ? ok[ok.length - 1]! : AXILO[0]!
  return pl >= m[1] && pl <= m[2] ? m : null
}

export function NouMobleDialog({ open, onClose, onCreate, settings, count }: { open: boolean; onClose: () => void; onCreate: (m: Module, warnings: string[]) => void; settings: Settings; count: number }) {
  const [c, setC] = useState<Cab>(load)
  const set = (p: Partial<Cab>) => setC((x) => ({ ...x, ...p }))
  const [models, setModelsState] = useState(loadModels)
  const setModels = (v: { list: Model[]; cur: number }) => (setModelsState(v), saveModels(v))
  const [fam, setFam] = useState("")
  const [newName, setNewName] = useState("")
  const [ask, setAsk] = useState<null | "del" | "reset" | "ren">(null)
  const [ren, setRen] = useState({ n: "", fam: "", sub: "" })
  const cur = models.list[models.cur] ?? models.list[0]!
  const fams = [...new Set(models.list.map((m) => m.fam ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "ca"))
  const shown = models.list.map((m, i) => [m, i] as const).filter(([m]) => !fam || (fam === "__" ? !m.fam : m.fam === fam))
  const pick = (i: number) => (setModels({ ...models, cur: i }), setC(models.list[i]!.p), setAsk(null))
  const names = useMemo(() => settings.materials.map((m) => m.name), [settings.materials])
  const boards = useMemo(() => boardChoices(settings.materials), [settings.materials])
  const cm = c.cm || settings.defaults.material
  const dm = c.dm || cm
  const mat = (k: string | undefined) => (k && names.includes(k) ? k : taulellMaterial(k, names, settings.defaults.material))
  const create = () => {
    save(c)
    const warnings: string[] = []
    const m = moduleOfCab({ ...c, id: newId("t"), name: `Moble ${count + 1}`, cm, dm }, mat, 0, (w) => warnings.push(w))
    onCreate({ ...m, gapBefore: 0 }, warnings)
  }
  const num = (k: keyof Cab, label: string, min: number, max: number, suffix = "mm") => <NumRow key={k} label={label} suffix={suffix} value={c[k] as number} min={min} max={max} step={1} onChange={(v) => set({ [k]: v } as Partial<Cab>)} />
  const sel = (k: keyof Cab, label: string, items: [string, string][], full = false) => (
    <Field.Root key={k} gridColumn={full ? "1 / -1" : undefined} gap={1}>
      <Field.Label fontSize="sm" fontWeight="normal">
        {label}
      </Field.Label>
      <NativeSelect.Root size="sm" maxW={full ? "320px" : "240px"}>
        <NativeSelect.Field value={String(c[k])} onChange={(e) => set({ [k]: typeof DEF[k] === "boolean" ? e.target.value === "true" : e.target.value } as Partial<Cab>)}>
          {items.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field.Root>
  )
  const yesNo: [string, string][] = [
    ["true", "Sí"],
    ["false", "No"],
  ]
  const leg = axiloFor(c.pl)
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="xl" scrollBehavior="inside">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Nou moble</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              <Stack gap={2} mb={4}>
                {fams.length > 0 && (
                  <HStack gap={1} flexWrap="wrap">
                    {[["", "Tots"], ...fams.map((f) => [f, f]), ...(models.list.some((m) => !m.fam) ? [["__", "Sense família"]] : [])].map(([v, l]) => (
                      <Button key={v} size="2xs" rounded="full" variant={fam === v ? "subtle" : "outline"} colorPalette={fam === v ? "wood" : undefined} onClick={() => setFam(v!)}>
                        {l}
                      </Button>
                    ))}
                  </HStack>
                )}
                <HStack gap={1} flexWrap="wrap">
                  {shown.map(([m, i]) => (
                    <Button key={i} size="xs" variant={i === models.cur ? "subtle" : "outline"} colorPalette={i === models.cur ? "wood" : undefined} onClick={() => pick(i)}>
                      {m.n}
                      {!fam && m.fam ? (
                        <Text as="span" color="fg.muted" fontWeight="normal">
                          · {m.fam}
                          {m.sub ? ` / ${m.sub}` : ""}
                        </Text>
                      ) : null}
                    </Button>
                  ))}
                </HStack>
                {ask === "del" || ask === "reset" ? (
                  <HStack gap={2} fontSize="sm">
                    <Text>{ask === "del" ? `Esborro el model «${cur.n}»?` : "Torno als models de fàbrica? Es perden els canvis i els models nous."}</Text>
                    <Button
                      size="xs"
                      colorPalette="red"
                      onClick={() => {
                        if (ask === "del") {
                          const list = models.list.filter((_, k) => k !== models.cur)
                          setModels({ list, cur: Math.max(0, models.cur - 1) })
                          setC(list[Math.max(0, models.cur - 1)]!.p)
                        } else {
                          setModels({ list: FACTORY, cur: 0 })
                          setC(FACTORY[0]!.p)
                        }
                        setAsk(null)
                      }}
                    >
                      {ask === "del" ? "Sí, esborra" : "Sí, restaura"}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setAsk(null)}>
                      No
                    </Button>
                  </HStack>
                ) : ask === "ren" ? (
                  <HStack gap={1.5} flexWrap="wrap">
                    <Input size="xs" maxW="180px" value={ren.n} placeholder="Nom" aria-label="Nom del model" onChange={(e) => setRen({ ...ren, n: e.target.value })} />
                    <Input size="xs" maxW="150px" value={ren.fam} placeholder="Família (p. ex. Cuina)" aria-label="Família" list="nm-fams" onChange={(e) => setRen({ ...ren, fam: e.target.value })} />
                    <Input size="xs" maxW="150px" value={ren.sub} placeholder="Subfamília (p. ex. Baixos)" aria-label="Subfamília" onChange={(e) => setRen({ ...ren, sub: e.target.value })} />
                    <datalist id="nm-fams">
                      {fams.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                    <Button
                      size="xs"
                      colorPalette="wood"
                      onClick={() => {
                        const m: Model = { n: ren.n.trim() || cur.n, fam: ren.fam.trim() || undefined, sub: ren.fam.trim() ? ren.sub.trim() || undefined : undefined, p: c }
                        setModels({ ...models, list: models.list.map((x, k) => (k === models.cur ? m : x)) })
                        setAsk(null)
                      }}
                    >
                      Desa
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      title="Fa un model nou amb aquest nom, família i les mides d'ara; l'original no es toca"
                      onClick={() => {
                        const m: Model = { n: ren.n.trim() || "Model nou", fam: ren.fam.trim() || undefined, sub: ren.fam.trim() ? ren.sub.trim() || undefined : undefined, p: c }
                        setModels({ list: [...models.list, m], cur: models.list.length })
                        setAsk(null)
                      }}
                    >
                      Desa com a nou
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setAsk(null)}>
                      Cancel·la
                    </Button>
                  </HStack>
                ) : (
                  <HStack gap={1.5} flexWrap="wrap">
                    <Button size="xs" variant="outline" onClick={() => (setModels({ ...models, list: models.list.map((x, k) => (k === models.cur ? { ...x, p: c } : x)) }), toaster.create({ title: `Model «${cur.n}» desat`, type: "success", duration: 2000 }))}>
                      Desa els canvis a «{cur.n}»
                    </Button>
                    <Input size="xs" maxW="170px" value={newName} placeholder="Nom del model nou" aria-label="Nom del model nou" onChange={(e) => setNewName(e.target.value)} />
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        const n = newName.trim()
                        if (!n) return toaster.create({ title: "Escriu el nom del model nou.", duration: 2000 })
                        setModels({ list: [...models.list, { n, fam: fam && fam !== "__" ? fam : cur.fam, sub: fam && fam !== "__" ? undefined : cur.sub, p: c }], cur: models.list.length })
                        setNewName("")
                        toaster.create({ title: `Model «${n}» afegit`, type: "success", duration: 2000 })
                      }}
                    >
                      Desa com a model nou
                    </Button>
                    <Button size="xs" variant="outline" title="Nom, família i subfamília del model" onClick={() => (setRen({ n: cur.n, fam: cur.fam ?? "", sub: cur.sub ?? "" }), setAsk("ren"))}>
                      Nom i família
                    </Button>
                    <Button size="xs" variant="outline" disabled={models.list.length < 2} onClick={() => setAsk("del")}>
                      Esborra
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => setAsk("reset")}>
                      Models de fàbrica
                    </Button>
                  </HStack>
                )}
              </Stack>
              <HStack align="start" gap={6}>
                <Stack flex={1} gap={3}>
                  <SimpleGrid columns={2} columnGap={6} rowGap={2.5}>
                    {num("W", "Amplada", 200, 3000)}
                    {num("H", "Alçada", 200, 2700)}
                    {num("D", "Fondària", 150, 1000)}
                    {num("pl", "Sòcol", 0, 300)}
                    {num("tj", "Trencajunt", 0, 20)}
                    {num("t", "Gruix", 10, 40)}
                    {num("tb", "Gruix fons", 3, 19)}
                    {num("cols", "Columnes", 1, 6, "")}
                    {num("shelves", "Prestatges", 0, 10, "")}
                    {num("ss", "Reculat prestatges", 0, 100)}
                    {num("drawers", "Calaixos", 0, 8, "")}
                    {sel("dsys", "Tipus de calaix", [
                      ["fusta", "Caixa de fusta"],
                      ["dtc", "DTC Magic-Star Ultra (lateral metàl·lic)"],
                    ])}
                    {num("drawerH", "Alçada calaix", 80, 500)}
                  </SimpleGrid>
                  <Field.Root>
                    <Field.Label fontSize="sm" fontWeight="normal">
                      Composició dels calaixos (de baix a dalt)
                    </Field.Label>
                    <Input size="sm" fontFamily="mono" value={c.dhs} placeholder="Iguals · p. ex. 50%, *, 140" onChange={(e) => set({ dhs: e.target.value })} />
                    <Field.HelperText>50% = meitat del moble · 140 = frontal de 140 mm · * = el que quedi</Field.HelperText>
                  </Field.Root>
                  <SimpleGrid columns={2} columnGap={6} rowGap={2.5}>
                    {sel("doors", "Portes", yesNo)}
                    {sel("plinth", "Tauler de sòcol", yesNo)}
                    {sel("plinthJoin", "Sòcol unit amb el costat", yesNo)}
                    {sel("feet", "Potes", [
                      ["none", "Sense potes (laterals a terra)"],
                      ["axilo", "Häfele AXILO 78"],
                    ], true)}
                  </SimpleGrid>
                  {c.feet === "axilo" && (
                    <Note>{leg ? `Sòcol ${c.pl} mm: pota de ${leg[0]} (regula ${leg[1]}–${leg[2]}) · ${leg[3]}` : `Cap pota AXILO 78 arriba a ${c.pl} mm de sòcol (de 53 a 170).`}</Note>
                  )}
                  <SimpleGrid columns={2} columnGap={6} rowGap={2.5}>
                    {sel("topT", "Sostre", [
                      ["full", "Sencer"],
                      ["rails", "Travessers (aigüera, placa)"],
                      ["front", "Només travesser de davant"],
                      ["none", "Sense sostre"],
                    ], true)}
                    {(c.topT === "rails" || c.topT === "front") && num("railW", "Ample travessers", 40, 300)}
                    {(c.topT === "rails" || c.topT === "front") &&
                      sel("railV", "Travessers", [
                        ["none", "Horitzontals"],
                        ["front", "Davant vertical"],
                        ["both", "Tots dos verticals"],
                      ])}
                    {sel("back", "Unió del fons", [
                      ["over", "Clavat al darrere"],
                      ["inside", "Per dins (entre laterals)"],
                      ["groove", "En ranura"],
                      ["rebate", "En galze"],
                      ["none", "Sense fons"],
                    ], true)}
                    {(c.back === "groove" || c.back === "inside") && num("bset", "Retirada del fons", 0, 150)}
                    {(c.back === "groove" || c.back === "rebate") && num("bdep", c.back === "rebate" ? "Ample galze" : "Fondària ranura", 3, 16)}
                    <MaterialSelect label="Material cos" materials={boards} value={cm} onChange={(v) => set({ cm: v })} />
                    {sel("bmat", "Material fons", [
                      ["auto", "Igual que el cos (si fa 8 mm o més)"],
                      ["cos", "Igual que el cos"],
                      ["hdf", "HDF blanc"],
                    ])}
                    <MaterialSelect label="Frontals" materials={boards} value={dm} onChange={(v) => set({ dm: v })} />
                  </SimpleGrid>
                  <Checkbox.Root size="sm" colorPalette="wood" checked={c.s32} onCheckedChange={(e) => set({ s32: !!e.checked })}>
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>Forats per a prestatges (Ø3 × 9, cada 64; només si hi ha prestatges)</Checkbox.Label>
                  </Checkbox.Root>
                </Stack>
                <Box w="240px" flexShrink={0} position="sticky" top={0}>
                  <Preview c={c} />
                </Box>
              </HStack>
            </Dialog.Body>
            <Dialog.Footer justifyContent="space-between">
              <Text fontSize="sm" color="fg.muted">
                Es col·loca a la dreta dels mobles que ja hi ha. Després el pots editar i moure.
              </Text>
              <HStack gap={2}>
                <Button size="sm" colorPalette="wood" onClick={create}>
                  Crea el moble
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

const Note = ({ children }: { children: ReactNode }) => (
  <Box bg="bg.muted" rounded="md" px={3} py={2} fontSize="sm" color="fg.muted">
    {children}
  </Box>
)

/** L'alçat frontal del moble (com el del Taulell): la caixa, el sòcol o les potes, les columnes, els calaixos i els prestatges. */
function Preview({ c }: { c: Cab }) {
  const W = 220
  const s = W / Math.max(c.W, c.H * 0.9)
  const w = c.W * s
  const h = c.H * s
  const pl = c.pl * s
  const t = Math.max(1.5, c.t * s)
  const body = h - pl
  const cols = Math.max(1, Math.round(c.cols))
  const nd = Math.min(c.drawers, Math.floor((c.H - c.pl) / 60))
  const dh = nd ? (c.doors ? Math.min(body / nd, c.drawerH * s) : body / nd) : 0
  const lines: ReactNode[] = []
  for (let k = 1; k < cols; k++) lines.push(<line key={`c${k}`} x1={(w * k) / cols} x2={(w * k) / cols} y1={0} y2={body} />)
  for (let k = 1; k <= nd; k++) lines.push(<line key={`d${k}`} x1={0} x2={w} y1={body - dh * k} y2={body - dh * k} />)
  const top = body - dh * nd
  for (let k = 1; k <= c.shelves; k++) lines.push(<line key={`s${k}`} x1={t} x2={w - t} y1={(top * k) / (c.shelves + 1)} y2={(top * k) / (c.shelves + 1)} strokeDasharray="3 2" />)
  if (c.doors && top > 20) for (let k = 0; k < cols; k++) lines.push(<line key={`p${k}`} x1={(w * (k + 0.5)) / cols} x2={(w * (k + 0.5)) / cols} y1={2} y2={top - 2} strokeDasharray="1 2" />)
  return (
    <Box bg="bg.muted" rounded="md" p={3} textAlign="center">
      <svg viewBox={`-4 -4 ${w + 8} ${h + 8}`} width="100%" role="img" aria-label="Alçat del moble">
        <g fill="none" stroke="var(--chakra-colors-wood-500, #b98a4e)" strokeWidth={1.2}>
          <rect x={0} y={0} width={w} height={body} />
          {lines}
          {c.feet === "axilo" ? (
            <>
              <rect x={w * 0.06} y={body} width={6} height={pl} />
              <rect x={w * 0.94 - 6} y={body} width={6} height={pl} />
            </>
          ) : pl > 0 ? (
            <rect x={t} y={body} width={w - 2 * t} height={pl} />
          ) : null}
        </g>
      </svg>
      <Text fontSize="xs" fontFamily="mono" color="fg.muted" mt={1}>
        {c.W} × {c.H} × {c.D} mm{nd ? ` · ${nd} calaix${nd > 1 ? "os" : ""}` : ""}
      </Text>
    </Box>
  )
}
