import { Stack, Text } from "@chakra-ui/react"
import { LuArrowDownToLine, LuFootprints, LuPanelBottom } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { IconChoice } from "../../components/IconChoice"
import { NumRow } from "../../components/NumRow"
import { boardChoices, defaultPlinthSetback, floorTrams, materialByName, setSupport, setTramSides, tramSides, type Composition, type FloorSupport, type FloorTram, type HardwareItem, type Module, type TramSides } from "../../core/model"
import { MaterialSelect } from "../settings/MaterialSelect"
import { useSettings } from "../settings/SettingsContext"
import { HardwarePick } from "./HardwarePick"

type Plinth = FloorSupport["plinth"]

/** Els costats del sòcol d'un tram, com una tria (el davant hi és sempre). */
type SidesChoice = "front" | "left" | "right" | "sides" | "all"
const SIDES_OPTIONS: { id: SidesChoice; label: string }[] = [
  { id: "front", label: "Davant" },
  { id: "left", label: "+ esquerre" },
  { id: "right", label: "+ dret" },
  { id: "sides", label: "+ laterals" },
  { id: "all", label: "Tot el voltant" },
]
const sidesOf = (s: TramSides): SidesChoice => (s.back ? "all" : s.left && s.right ? "sides" : s.left ? "left" : s.right ? "right" : "front")
const SIDES: Record<SidesChoice, TramSides> = { front: {}, left: { left: true }, right: { right: true }, sides: { left: true, right: true }, all: { back: true, left: true, right: true } }

/**
 * **Cuina** (Moble; abans «Suport general»; per decisió de l'usuari, 2026-10-20, només a la cuina; per decisió de l'usuari, 2026-10-15: «és un sòcol per a tots els mòduls i no un per a cada
 * un»; «el sòcol no pot anar per cada mòdul, és una peça global»): el suport de tots els mòduls de terra
 * (`Composition.support`, `setSupport`). Directe a terra, Sòcol (sobre potes, una peça per tram) o Potes vistes; l'alçada i
 * la pota; i el sòcol: la retirada, de fusta o d'alumini i, per a cada tram (`floorTrams`: els mòduls de terra que es
 * toquen), on porta sòcol.
 */
export function SupportForm({ comp, setComp }: { comp: Composition; setComp: (f: (c: Composition) => Composition) => void }) {
  const { settings } = useSettings()
  const s = comp.support
  if (!s) return null
  const set = (patch: Partial<FloorSupport>) => setComp((c) => (c.support ? setSupport(c, { ...c.support, ...patch }) : c))
  const setPlinth = (patch: Partial<Plinth>) => set({ plinth: { ...s.plinth, ...patch } })
  const first = comp.modules.find((m) => m.carcass.base.kind !== "wall")
  const trams = floorTrams(comp)
  const anySides = s.kind === "plinth" && trams.some((t) => sidesOf(tramSides(s, t, comp)) !== "front")
  return (
    <Stack gap={4}>
      <SupportBasics support={s} onChange={set} first={first} help="El de tots els mòduls de terra (els penjats no en tenen)." ids={{ kind: "moble.support.kind", height: "moble.support.height", leg: "moble.support.leg", legInset: "moble.support.legInset" }} />
      {s.kind === "plinth" && (
        <>
          <NumRow optionId="moble.support.setback" label="Retirada" help="De la cara dels fronts a la cara de davant del sòcol." value={s.plinth.setback} min={0} max={200} step={1} onChange={(setback) => setback >= 0 && setback <= 200 && setPlinth({ setback })} />
          <HardwarePick
            optionId="moble.support.type"
            engine="plinthProfile"
            label="Sòcol"
            current={s.plinth.hardware}
            emptyLabel="Fusta"
            help={s.plinth.hardware ? undefined : "Fusta: un tauler (una peça de CNC per tram, a trossos si és més llarg que un tauler). Un sòcol d'alumini (Preferències › Ferratges › Potes i sòcols) es talla a mida i es clipa a les potes: surt a Peces › «Ferratges per metres»."}
            onPick={(item) => {
              const { hardware: _h, ...rest } = s.plinth
              set({ plinth: item ? { ...rest, hardware: item } : rest })
            }}
          />
          {!s.plinth.hardware && (
            <FormRow optionId="moble.support.material" label="Material" maxW="280px" help={`El tauler del sòcol${s.plinth.thickness ? ` (${s.plinth.thickness} mm)` : ""}. Sense triar-ne cap, el del cos.`}>
              <MaterialSelect
                label="Material del sòcol"
                hideLabel
                materials={boardChoices(settings.materials)}
                value={s.plinth.material ?? ""}
                emptyLabel="Com el cos"
                onChange={(name) => {
                  const { material: _m, thickness: _t, ...rest } = s.plinth
                  if (!name) return set({ plinth: rest })
                  // El gruix del material més proper al del cos (com a Materials).
                  const t = first?.carcass.thickness ?? 19
                  const ts = materialByName(settings, name)?.thicknesses ?? []
                  const thickness = ts.length && !ts.includes(t) ? ts.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a)) : undefined
                  set({ plinth: { ...rest, material: name, ...(thickness ? { thickness } : {}) } })
                }}
              />
            </FormRow>
          )}
          <Trams comp={comp} support={s} trams={trams} onChange={(t, sides) => set({ trams: setTramSides(s, t, comp, sides).trams })} />
          {anySides && (
            <>
              <NumRow optionId="moble.support.sideSetback" label="Retirada dels costats" help="De la cara del lateral (o del darrere) del tram a la cara de fora del sòcol." value={s.plinth.sideSetback ?? s.plinth.setback} min={0} max={200} step={1} onChange={(v) => v >= 0 && v <= 200 && setPlinth({ sideSetback: v })} />
              {!s.plinth.hardware && (
                <FormRow optionId="moble.support.corners" label="Cantonades" help="A tope: el davant (i el darrere) passen per davant dels laterals, amb cantell a l'extrem. A inglet: tots de fora a fora, tallats a 45°.">
                  <ChoiceChips label="Cantonades del sòcol" options={[{ id: "butt", label: "A tope" }, { id: "mitre", label: "A inglet" }]} value={s.plinth.corners ?? "butt"} onChange={(corners) => setPlinth({ corners })} />
                </FormRow>
              )}
            </>
          )}
        </>
      )}
    </Stack>
  )
}

/** Els ids de les opcions en cascada de {@link SupportBasics} (`moble.support.*`). */
interface SupportIds { kind: string; height: string; leg: string; legInset: string }

/**
 * Suport, alçada i pota: el mateix per a tots els mòduls de terra de la cuina. Surt al Moble › Cuina i, amb les mateixes
 * opcions i el mateix valor, a Mòdul › Base de cada mòdul de terra (cas 15 del model únic).
 */
export function SupportBasics({ support: s, onChange: set, first, help, ids }: { support: FloorSupport; onChange: (patch: Partial<FloorSupport>) => void; first?: Module; help: string; ids: SupportIds }) {
  return (
    <>
      <FormRow optionId={ids.kind} label="Suport" help={help}>
        <IconChoice
          hideLabel
          label="Suport"
          value={s.kind}
          options={[
            { value: "floor", label: "Directe a terra", icon: LuArrowDownToLine, hint: "Directe a terra, sense potes ni sòcol" },
            { value: "plinth", label: "Sòcol", icon: LuPanelBottom, hint: "Sobre potes, amb un sòcol continu al davant de cada tram" },
            { value: "legs", label: "Potes vistes", icon: LuFootprints, hint: "Sobre potes, sense sòcol (com un moble de saló)" },
          ]}
          onChange={(kind) => set(kind === "plinth" && s.kind !== "plinth" ? { kind, plinth: { ...s.plinth, setback: defaultPlinthSetback(s, first) } } : { kind })}
        />
      </FormRow>
      {s.kind !== "floor" && (
        <>
          <NumRow optionId={ids.height} label="Alçada" help="De terra a la base dels mòduls: l'alçada de les potes (i del sòcol)." value={s.height} min={20} max={400} step={5} onChange={(height) => height >= 20 && height <= 400 && set({ height })} />
          <LegPick support={s} onChange={set} ids={ids} />
        </>
      )}
    </>
  )
}

/** On porta sòcol cada tram: sempre al davant i, als extrems vistos o a l'illa, també als costats i al darrere. */
function Trams({ comp, support, trams, onChange }: { comp: Composition; support: FloorSupport; trams: FloorTram[]; onChange: (t: FloorTram, sides: TramSides) => void }) {
  if (!trams.length) return null
  return (
    <FormRow optionId="moble.support.trams" label="Trams" help="Cada tram (els mòduls de terra que es toquen) fa un sol sòcol, de punta a punta. Al davant sempre; als extrems vistos i a les illes, també als costats i al darrere.">
      <Stack gap={3} pt="6px">
        {trams.map((t, k) => {
          const names = t.modules.map((i) => comp.modules[i]!.name)
          return (
            <Stack key={t.id} gap={1}>
              <Text fontSize="sm">
                Tram {k + 1}{t.free ? " (lliure al terra)" : ""}: {names.length > 2 ? `${names[0]} … ${names[names.length - 1]} (${names.length} mòduls)` : names.join(" i ")}
              </Text>
              <ChoiceChips label={`Costats del sòcol del tram ${k + 1}`} options={SIDES_OPTIONS} value={sidesOf(tramSides(support, t, comp))} onChange={(c) => onChange(t, SIDES[c])} />
            </Stack>
          )
        })}
      </Stack>
    </FormRow>
  )
}

/**
 * La pota (`FloorSupport.leg`): les genèriques (només es veuen, cap forat) o una de la biblioteca (Preferències ›
 * Ferratges, una **còpia**): un cop confirmada, els forats de la placa a la cara de sota de la base de cada mòdul. Amb una
 * distància pròpia al davant (la AXILO 78), es pot canviar: deixa lloc al sòcol.
 */
function LegPick({ support, onChange, ids }: { support: FloorSupport; onChange: (patch: Partial<FloorSupport>) => void; ids: SupportIds }) {
  const { settings } = useSettings()
  const cur = support.leg
  if (!settings.hardwareLibrary.some((x) => x.engine === "leg") && !cur) return null
  const pick = (item: HardwareItem | undefined) => {
    if (item) return onChange({ leg: item })
    onChange({ leg: undefined })
  }
  const front = cur?.engine === "leg" && "insetFront" in cur.params ? cur.params.insetFront : undefined
  return (
    <>
      <HardwarePick optionId={ids.leg} engine="leg" label="Pota" current={cur} emptyLabel="Genèriques" help={cur ? undefined : "Genèriques: només es veuen al 3D (cap forat). Les potes importades (Preferències › Ferratges) fan els forats de la placa a la cara de sota de la base."} onPick={pick} />
      {cur && front !== undefined && (
        <NumRow
          optionId={ids.legInset}
          label="Potes al davant"
          help="Del cantell de davant de la base a l'eix de les potes del davant: deixa lloc al sòcol. Només en aquest moble (el de tots, a Preferències › Ferratges)."
          value={Number(front)}
          min={20}
          max={300}
          step={1}
          onChange={(v) => v >= 20 && v <= 300 && onChange({ leg: { ...cur, params: { ...cur.params, insetFront: v } } })}
        />
      )}
    </>
  )
}
