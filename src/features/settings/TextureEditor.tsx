import { Box, Button, Flex, HStack, Input, Slider, Stack, Text } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { LuDices, LuRotateCcw } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { FloatingWindow } from "../../components/FloatingWindow"
import { WOOD_PRESETS, type Finish, type MaterialPref, type WoodGen } from "../../core/model"
import { woodGenOf } from "../../components/viewer/textures"
import { isEditable, previewStyle } from "./materialPreview"
import { WOOD_EXTRA_PRESETS } from "./woodPresets"
import { useDraft } from "../../lib/useDraft"

type Editable = Exclude<Finish, { kind: "image" }>

/**
 * Editor de textures procedurals (com els nodes de textura de Blender o Cinema 4D, però amb
 * controls): una mostra gran a escala real i els paràmetres del generador. Fusta (colors, veta,
 * ondulació, franges, catedrals, porus, gra, mida), teixit (fils, irregularitat), rajola (junta,
 * variació, trencajunts) i pedra o marbre (vetes). «Nova variació» canvia la llavor: el mateix
 * dibuix amb una altra disposició. Els canvis s'apliquen en acceptar. Una finestra (`FloatingWindow`), damunt de la de
 * l'editor del material.
 */
export function TextureEditor({ m, open, onClose, onApply }: { m: MaterialPref; open: boolean; onClose: () => void; onApply: (f: Finish) => void }) {
  const [f, setF] = useState<Editable | null>(null)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    if (open && isEditable(m.finish)) setF(structuredClone(m.finish))
  }, [open, m.finish])
  // La finestra es queda muntada (tancada) mentre el material sigui editable. Abans del primer `setF`, l'acabat del material.
  const cur = f ?? (isEditable(m.finish) ? m.finish : null)
  if (!cur) return null
  const preview: MaterialPref = { ...m, finish: cur }
  // Mostra de 1200 mm d'ample (× zoom): es veu com es repeteix.
  const W = 560
  return (
    <FloatingWindow
      id="texture-editor"
      open={open}
      onClose={onClose}
      title={`Editar la textura · ${m.name}`}
      width={1040}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel·lar
          </Button>
          <Button
            colorPalette="wood"
            onClick={() => {
              onApply(cur)
              onClose()
            }}
          >
            Aplicar
          </Button>
        </>
      }
    >
      <Flex gap={5} direction={{ base: "column", md: "row" }}>
        <Stack gap={2} flexShrink={0} w={{ base: "full", md: `${W}px` }} maxW="full">
          <Box w="full" aspectRatio={W / 380} rounded="md" borderWidth="1px" style={previewStyle(preview, W / (2 * zoom))} backgroundRepeat="repeat" />
          <HStack gap={2}>
            <Text fontSize="xs" color="fg.muted" flexShrink={0}>
              Mostra de {Math.round(1200 * zoom)} mm
            </Text>
            <Slider.Root size="sm" flex={1} aria-label={["Mida de la mostra"]} min={0.25} max={4} step={0.25} value={[zoom]} onValueChange={(e) => setZoom(e.value[0]!)}>
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumbs />
              </Slider.Control>
            </Slider.Root>
          </HStack>
        </Stack>
        <Stack gap={3} flex={1} minW={0}>
          <Controls f={cur} setF={setF} />
        </Stack>
      </Flex>
    </FloatingWindow>
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
        <SliderRow label="Densitat de la veta" value={g.lines} min={2} max={80} step={1} onChange={(lines) => set({ lines })} />
        <SliderRow label="Ondulació" value={g.wobble} min={0} max={0.25} step={0.01} fmt={(v) => `${Math.round(v * 400)} %`} onChange={(wobble) => set({ wobble })} />
        <SliderRow label="Contrast de les fibres" value={g.contrast} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(contrast) => set({ contrast })} />
        <SliderRow label="Franges de to" value={g.bands} min={0} max={60} step={1} onChange={(bands) => set({ bands })} />
        <SliderRow label="Vetes de catedral" value={g.figure} min={0} max={8} step={1} onChange={(figure) => set({ figure })} />
        <SliderRow label="Porus" value={g.pores} min={0} max={5000} step={100} onChange={(pores) => set({ pores })} />
        <SliderRow label="Gra fi" value={g.grain} min={0} max={30} step={1} onChange={(grain) => set({ grain })} />
        <SliderRow label="Mida de la repetició" value={g.tileMm} min={200} max={4000} step={50} fmt={(v) => `${v} mm`} onChange={(tileMm) => set({ tileMm })} />
        <Actions onSeed={() => set({ seed: newSeed() })} onReset={() => setF({ kind: "wood", species: f.species, gen: { ...WOOD_PRESETS[f.species] } })} />
      </>
    )
  }
  if (f.kind === "fabric")
    return (
      <>
        <ColorField label="Color" value={f.color} onChange={(color) => setF({ ...f, color })} />
        <SliderRow label="Fils per repetició" value={f.threads ?? 96} min={8} max={240} step={4} onChange={(threads) => setF({ ...f, threads })} />
        <SliderRow label="Irregularitat dels fils" value={f.slub ?? 0} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(slub) => setF({ ...f, slub })} />
        <SliderRow label="Mida de la repetició" value={f.tileMm ?? 200} min={20} max={2000} step={10} fmt={(v) => `${v} mm`} onChange={(tileMm) => setF({ ...f, tileMm })} />
        <Actions onReset={() => setF({ kind: "fabric", color: f.color })} />
      </>
    )
  if (f.kind === "tiles")
    return (
      <>
        <ColorField label="Color de la peça" value={f.color} onChange={(color) => setF({ ...f, color })} />
        <ColorField label="Color de la junta" value={f.grout} onChange={(grout) => setF({ ...f, grout })} />
        <SliderRow label="Mida de la peça" value={f.size} min={20} max={1500} step={10} fmt={(v) => `${v} mm`} onChange={(size) => setF({ ...f, size })} />
        <SliderRow label="Gruix de la junta" value={f.joint ?? 3} min={0} max={30} step={0.5} fmt={(v) => `${v} mm`} onChange={(joint) => setF({ ...f, joint })} />
        <SliderRow label="Variació de to" value={f.variation ?? 0.05} min={0} max={0.4} step={0.01} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(variation) => setF({ ...f, variation })} />
        <FormRow label="Col·locació">
          <ChoiceChips label="Col·locació" value={f.layout ?? "grid"} options={[{ id: "grid", label: "Quadrícula" }, { id: "brick", label: "Trencajunts" }]} onChange={(layout) => setF({ ...f, layout })} />
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
        <SliderRow label={style === "granite" ? "Quantitat de gra de color" : style === "marble" ? "Vetes" : "Contrast"} value={f.veins} min={0} max={1} step={0.05} fmt={pct} onChange={(veins) => setF({ ...f, veins })} />
        <SliderRow label={style === "granite" ? "Punts foscos" : "Porus i gra"} value={f.grain ?? 0.3} min={0} max={1} step={0.05} fmt={pct} onChange={(grain) => setF({ ...f, grain })} />
        <SliderRow label="Polit (mat → brillant)" value={f.polish ?? 0.6} min={0} max={1} step={0.05} fmt={pct} onChange={(polish) => setF({ ...f, polish })} />
        <SliderRow label="Mida de la repetició" value={f.size} min={100} max={4000} step={50} fmt={(v) => `${v} mm`} onChange={(size) => setF({ ...f, size })} />
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
        <SliderRow label="Rugositat (mirall → mat)" value={f.roughness ?? 0.35} min={0} max={1} step={0.05} fmt={pct} onChange={(roughness) => setF({ ...f, roughness })} />
        {surface !== "polished" && <SliderRow label={surface === "brushed" ? "Intensitat del raspallat" : "Intensitat dels cops"} value={f.strength ?? 0.5} min={0} max={1} step={0.05} fmt={pct} onChange={(strength) => setF({ ...f, strength })} />}
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
        <SliderRow label="Opacitat" value={f.opacity ?? 0.35} min={0.05} max={0.95} step={0.05} fmt={pct} onChange={(opacity) => setF({ ...f, opacity })} />
        <SliderRow label="Glaçat (transparent → mat)" value={f.frost ?? 0} min={0} max={1} step={0.05} fmt={pct} onChange={(frost) => setF({ ...f, frost })} />
        <Actions onReset={() => setF({ kind: "glass", color: f.color })} />
      </>
    )
  // Color llis o lacat.
  return (
    <>
      <ColorField label="Color" value={f.color} onChange={(color) => setF({ ...f, color })} />
      <SliderRow label="Brillant (mat → mirall)" value={1 - (f.roughness ?? (f.kind === "lacquer" ? 0.35 : 0.8))} min={0} max={1} step={0.05} fmt={pct} onChange={(g) => setF({ ...f, roughness: Math.round((1 - g) * 100) / 100 })} />
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
        <Input size="sm" type="color" value={value} onChange={(e) => onChange(e.target.value)} p="5px" w="48px" aria-label={label} />
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
function SliderRow({ label, value, min, max, step, fmt = (v) => String(v), onChange }: { label: string; value: number; min: number; max: number; step: number; fmt?: (v: number) => string; onChange: (v: number) => void }) {
  const [v, setV] = useDraft(value)
  return (
    // Fila: etiqueta a l'esquerra; el lliscador i el valor a la dreta.
    <FormRow label={label}>
      <HStack gap={3} minH="32px">
        <Slider.Root size="sm" flex={1} minW={0} aria-label={[label]} min={min} max={max} step={step} value={[v]} onValueChange={(e) => setV(e.value[0]!)} onValueChangeEnd={(e) => e.value[0] !== value && onChange(e.value[0]!)}>
          <Slider.Control>
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumbs />
          </Slider.Control>
        </Slider.Root>
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
