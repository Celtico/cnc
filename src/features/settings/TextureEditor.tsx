import { Box, Button, CloseButton, Dialog, Flex, HStack, Input, Portal, SegmentGroup, Stack, Text } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { LuDices, LuRotateCcw } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { WOOD_PRESETS, type Finish, type MaterialPref, type WoodGen } from "../../core/model"
import { woodGenOf } from "../../components/viewer/textures"
import { isEditable, previewStyle } from "./materialPreview"
import { WOOD_EXTRA_PRESETS } from "./woodPresets"

type Editable = Exclude<Finish, { kind: "image" }>

/**
 * Editor de textures procedurals (com els nodes de textura de Blender o Cinema 4D, però amb
 * controls): una mostra gran a escala real i els paràmetres del generador. Fusta (colors, veta,
 * ondulació, franges, catedrals, porus, gra, mida), teixit (fils, irregularitat), rajola (junta,
 * variació, trencajunts) i pedra o marbre (vetes). «Nova variació» canvia la llavor: el mateix
 * dibuix amb una altra disposició. Els canvis s'apliquen en acceptar.
 */
export function TextureEditor({ m, open, onClose, onApply }: { m: MaterialPref; open: boolean; onClose: () => void; onApply: (f: Finish) => void }) {
  const [f, setF] = useState<Editable | null>(null)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    if (open && isEditable(m.finish)) setF(structuredClone(m.finish))
  }, [open, m.finish])
  if (!f) return null
  const preview: MaterialPref = { ...m, finish: f }
  // Mostra de 1200 mm d'ample (× zoom): es veu com es repeteix.
  const W = 560
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size={{ base: "full", md: "xl" }} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          {/* La mida «full» del mòbil posa l'alçada a 100dvh i la «xl» no la treu: a l'ordinador, l'alçada del contingut. */}
          <Dialog.Content pt={{ base: "env(safe-area-inset-top, 0px)", md: 0 }} h={{ base: "100dvh", md: "auto" }} minH={{ md: "auto" }}>
            <Dialog.Header>
              <Dialog.Title>Editar la textura · {m.name}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Flex gap={5} direction={{ base: "column", md: "row" }}>
                <Stack gap={2} flexShrink={0} w={{ base: "full", md: `${W}px` }}>
                  <Box w="full" aspectRatio={W / 380} rounded="md" borderWidth="1px" style={previewStyle(preview, W / (2 * zoom))} backgroundRepeat="repeat" />
                  <HStack gap={2}>
                    <Text fontSize="xs" color="fg.muted" flexShrink={0}>
                      Mostra de {Math.round(1200 * zoom)} mm
                    </Text>
                    <input type="range" min={0.25} max={4} step={0.25} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Mida de la mostra" style={{ flex: 1, accentColor: "var(--chakra-colors-wood-solid)" }} />
                  </HStack>
                </Stack>
                <Stack gap={3} flex={1} minW={0}>
                  <Controls f={f} setF={setF} />
                </Stack>
              </Flex>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
              <Button
                colorPalette="wood"
                onClick={() => {
                  onApply(f)
                  onClose()
                }}
              >
                Aplicar
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild top={{ base: "calc(env(safe-area-inset-top, 0px) + 8px)", md: 2 }}>
              <CloseButton size="sm" aria-label="Tancar" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}



const newSeed = () => 1 + Math.floor(Math.random() * 99999)

function Controls({ f, setF }: { f: Editable; setF: (f: Editable) => void }) {
  if (f.kind === "wood") {
    const g = woodGenOf(f.species, f.gen)
    const set = (patch: Partial<WoodGen>) => setF({ ...f, gen: { ...g, ...patch } })
    return (
      <>
        <FormRow label="Punt de partida">
          <HStack gap={1.5} wrap="wrap">
            {(["oak", "walnut", "ash"] as const).map((sp) => (
              <Button key={sp} size="xs" variant="outline" onClick={() => setF({ kind: "wood", species: sp, gen: { ...WOOD_PRESETS[sp] } })}>
                {sp === "oak" ? "Roure" : sp === "walnut" ? "Noguera" : "Freixe"}
              </Button>
            ))}
            {WOOD_EXTRA_PRESETS.map((p) => (
              <Button key={p.name} size="xs" variant="outline" onClick={() => setF({ ...f, gen: { ...p.gen } })}>
                {p.name}
              </Button>
            ))}
          </HStack>
        </FormRow>
        <ColorField label="Color de fons" value={g.base} onChange={(base) => set({ base })} />
        <ColorField label="Color de la veta" value={g.dark} onChange={(dark) => set({ dark })} />
        <Slider label="Densitat de la veta" value={g.lines} min={2} max={80} step={1} onChange={(lines) => set({ lines })} />
        <Slider label="Ondulació" value={g.wobble} min={0} max={0.25} step={0.01} fmt={(v) => `${Math.round(v * 400)} %`} onChange={(wobble) => set({ wobble })} />
        <Slider label="Contrast de les fibres" value={g.contrast} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(contrast) => set({ contrast })} />
        <Slider label="Franges de to" value={g.bands} min={0} max={60} step={1} onChange={(bands) => set({ bands })} />
        <Slider label="Vetes de catedral" value={g.figure} min={0} max={8} step={1} onChange={(figure) => set({ figure })} />
        <Slider label="Porus" value={g.pores} min={0} max={5000} step={100} onChange={(pores) => set({ pores })} />
        <Slider label="Gra fi" value={g.grain} min={0} max={30} step={1} onChange={(grain) => set({ grain })} />
        <Slider label="Mida de la repetició" value={g.tileMm} min={200} max={4000} step={50} fmt={(v) => `${v} mm`} onChange={(tileMm) => set({ tileMm })} />
        <Actions onSeed={() => set({ seed: newSeed() })} onReset={() => setF({ kind: "wood", species: f.species, gen: { ...WOOD_PRESETS[f.species] } })} />
      </>
    )
  }
  if (f.kind === "fabric")
    return (
      <>
        <ColorField label="Color" value={f.color} onChange={(color) => setF({ ...f, color })} />
        <Slider label="Fils per repetició" value={f.threads ?? 96} min={8} max={240} step={4} onChange={(threads) => setF({ ...f, threads })} />
        <Slider label="Irregularitat dels fils" value={f.slub ?? 0} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(slub) => setF({ ...f, slub })} />
        <Slider label="Mida de la repetició" value={f.tileMm ?? 200} min={20} max={2000} step={10} fmt={(v) => `${v} mm`} onChange={(tileMm) => setF({ ...f, tileMm })} />
        <Actions onReset={() => setF({ kind: "fabric", color: f.color })} />
      </>
    )
  if (f.kind === "tiles")
    return (
      <>
        <ColorField label="Color de la peça" value={f.color} onChange={(color) => setF({ ...f, color })} />
        <ColorField label="Color de la junta" value={f.grout} onChange={(grout) => setF({ ...f, grout })} />
        <Slider label="Mida de la peça" value={f.size} min={20} max={1500} step={10} fmt={(v) => `${v} mm`} onChange={(size) => setF({ ...f, size })} />
        <Slider label="Gruix de la junta" value={f.joint ?? 3} min={0} max={30} step={0.5} fmt={(v) => `${v} mm`} onChange={(joint) => setF({ ...f, joint })} />
        <Slider label="Variació de to" value={f.variation ?? 0.05} min={0} max={0.4} step={0.01} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(variation) => setF({ ...f, variation })} />
        <FormRow label="Col·locació">
          <SegmentGroup.Root size="sm" value={f.layout ?? "grid"} onValueChange={(e) => (e.value === "grid" || e.value === "brick") && setF({ ...f, layout: e.value })}>
            <SegmentGroup.Indicator />
            <SegmentGroup.Items items={[{ value: "grid", label: "Quadrícula" }, { value: "brick", label: "Trencajunts" }]} />
          </SegmentGroup.Root>
        </FormRow>
        <Actions onReset={() => setF({ kind: "tiles", color: f.color, grout: f.grout, size: f.size })} />
      </>
    )
  if (f.kind === "stone") {
    const style = f.style ?? "marble"
    return (
      <>
        <FormRow label="Tipus">
          <ChoiceChips label="Tipus" value={style} options={[{ id: "marble", label: "Marbre" }, { id: "granite", label: "Granit" }, { id: "travertine", label: "Travertí" }, { id: "concrete", label: "Formigó" }]} onChange={(v) => v && setF({ ...f, style: v })} />
        </FormRow>
        <ColorField label="Color de la pedra" value={f.color} onChange={(color) => setF({ ...f, color })} />
        <ColorField label={style === "granite" ? "Color del gra" : "Color de les vetes"} value={f.vein} onChange={(vein) => setF({ ...f, vein })} />
        <Slider label={style === "granite" ? "Quantitat de gra de color" : style === "marble" ? "Vetes" : "Contrast"} value={f.veins} min={0} max={1} step={0.05} fmt={pct} onChange={(veins) => setF({ ...f, veins })} />
        <Slider label={style === "granite" ? "Punts foscos" : "Porus i gra"} value={f.grain ?? 0.3} min={0} max={1} step={0.05} fmt={pct} onChange={(grain) => setF({ ...f, grain })} />
        <Slider label="Polit (mat → brillant)" value={f.polish ?? 0.6} min={0} max={1} step={0.05} fmt={pct} onChange={(polish) => setF({ ...f, polish })} />
        <Slider label="Mida de la repetició" value={f.size} min={100} max={4000} step={50} fmt={(v) => `${v} mm`} onChange={(size) => setF({ ...f, size })} />
        <Actions onSeed={() => setF({ ...f, seed: newSeed() })} onReset={() => setF({ ...f, veins: 0.5, size: 1200, seed: 7, grain: 0.3, polish: 0.6 })} />
      </>
    )
  }
  if (f.kind === "metal") {
    const surface = f.surface ?? "polished"
    return (
      <>
        <ColorField label="Color del metall" value={f.color} onChange={(color) => setF({ ...f, color })} />
        <FormRow label="Acabat">
          <ChoiceChips label="Acabat" value={surface} options={[{ id: "polished", label: "Polit" }, { id: "brushed", label: "Raspallat" }, { id: "hammered", label: "Martellejat" }]} onChange={(v) => v && setF({ ...f, surface: v })} />
        </FormRow>
        <Slider label="Rugositat (mirall → mat)" value={f.roughness ?? 0.35} min={0} max={1} step={0.05} fmt={pct} onChange={(roughness) => setF({ ...f, roughness })} />
        {surface !== "polished" && <Slider label={surface === "brushed" ? "Intensitat del raspallat" : "Intensitat dels cops"} value={f.strength ?? 0.5} min={0} max={1} step={0.05} fmt={pct} onChange={(strength) => setF({ ...f, strength })} />}
        <FormRow label="Colors habituals">
          <HStack gap={1.5} wrap="wrap">
            {METALS.map((mt) => (
              <Button key={mt.name} size="xs" variant="outline" onClick={() => setF({ ...f, color: mt.color })}>
                <Box w="12px" h="12px" rounded="full" bg={mt.color} borderWidth="1px" /> {mt.name}
              </Button>
            ))}
          </HStack>
        </FormRow>
        <Actions onReset={() => setF({ kind: "metal", color: f.color })} />
      </>
    )
  }
  if (f.kind === "glass")
    return (
      <>
        <ColorField label="Color del vidre" value={f.color} onChange={(color) => setF({ ...f, color })} />
        <Slider label="Opacitat" value={f.opacity ?? 0.35} min={0.05} max={0.95} step={0.05} fmt={pct} onChange={(opacity) => setF({ ...f, opacity })} />
        <Slider label="Glaçat (transparent → mat)" value={f.frost ?? 0} min={0} max={1} step={0.05} fmt={pct} onChange={(frost) => setF({ ...f, frost })} />
        <Actions onReset={() => setF({ kind: "glass", color: f.color })} />
      </>
    )
  // Color llis o lacat.
  return (
    <>
      <ColorField label="Color" value={f.color} onChange={(color) => setF({ ...f, color })} />
      <Slider label="Brillant (mat → mirall)" value={1 - (f.roughness ?? (f.kind === "lacquer" ? 0.35 : 0.8))} min={0} max={1} step={0.05} fmt={pct} onChange={(g) => setF({ ...f, roughness: Math.round((1 - g) * 100) / 100 })} />
      <Actions onReset={() => setF({ kind: f.kind, color: f.color })} />
    </>
  )
}

const pct = (v: number) => `${Math.round(v * 100)} %`
const METALS = [
  { name: "Inox", color: "#c3c7cb" },
  { name: "Alumini", color: "#d4d6d8" },
  { name: "Ferro negre", color: "#3b3b3d" },
  { name: "Llautó", color: "#b8954a" },
  { name: "Coure", color: "#b87350" },
  { name: "Bronze", color: "#8c6a3f" },
  { name: "Or", color: "#d4af37" },
  { name: "Crom", color: "#e8eaec" },
]

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <FormRow label={label}>
      <HStack gap={2} minH="32px">
        <Input size="sm" type="color" value={value} onChange={(e) => onChange(e.target.value)} p={0.5} w="44px" aria-label={label} />
        <Text fontSize="xs" fontFamily="mono" color="fg.muted">
          {value}
        </Text>
      </HStack>
    </FormRow>
  )
}

/**
 * Control lliscant que aplica el valor en deixar-lo anar (generar una textura costa uns
 * mil·lisegons: no es fa a cada píxel d'arrossegament); el número s'actualitza en viu.
 */
function Slider({ label, value, min, max, step, fmt = (v) => String(v), onChange }: { label: string; value: number; min: number; max: number; step: number; fmt?: (v: number) => string; onChange: (v: number) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => v !== value && onChange(v)
  return (
    // Fila: etiqueta a l'esquerra; el lliscador i el valor a la dreta.
    <FormRow label={label}>
      <HStack gap={3} minH="32px">
        <input type="range" min={min} max={max} step={step} value={v} aria-label={label} onChange={(e) => setV(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} style={{ flex: 1, minWidth: 0, accentColor: "var(--chakra-colors-wood-solid)" }} />
        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums" flexShrink={0} minW="4.5em" textAlign="right">
          {fmt(v)}
        </Text>
      </HStack>
    </FormRow>
  )
}

function Actions({ onSeed, onReset }: { onSeed?: () => void; onReset: () => void }) {
  return (
    <HStack gap={2} pt={1}>
      {onSeed && (
        <Button size="xs" variant="outline" onClick={onSeed}>
          <LuDices /> Nova variació
        </Button>
      )}
      <Button size="xs" variant="ghost" onClick={onReset}>
        <LuRotateCcw /> Valors inicials
      </Button>
    </HStack>
  )
}
