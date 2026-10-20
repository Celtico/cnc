import { Switch } from "@chakra-ui/react"
import { LuArrowDownToLine, LuFootprints, LuPanelBottom, LuSquareDashedBottom } from "react-icons/lu"
import { FormRow } from "../../components/FormRow"
import { IconChoice } from "../../components/IconChoice"
import { NumRow } from "../../components/NumRow"
import { hasBottom, type Base, type Carcass, type HardwareItem } from "../../core/model"
import { useSettings } from "../settings/SettingsContext"
import { HardwarePick } from "./HardwarePick"

type LegsBase = Extract<Base, { kind: "legs" }>
type BaseChoice = "none" | "plinth" | "legs" | "open"

/**
 * La **base del mòdul** d'un moble normal, com era abans de les cuines (per decisió de l'usuari, 2026-10-20: «si és moble,
 * la base com estava abans del lio de les cuines»; la cuina té el suport al Moble › Cuina, un per a tots els mòduls de
 * terra): una sola tria, Directe a terra · Sòcol (laterals fins a terra i la base aixecada) · Potes (amb la pota i, si es
 * vol, el sòcol davant de les potes) · Sense base (obert per sota).
 */
export function ModuleSupportFields({ carcass: c, base: vb, onChange }: { carcass: Carcass; /** La base tal com es construeix (`visibleModule`). */ base: Base; onChange: (c: Carcass) => void }) {
  const value: BaseChoice = vb.kind === "legs" || vb.kind === "plinth" ? vb.kind : hasBottom(c) ? "none" : "open"
  const set = (base: Base) => onChange({ ...c, base })
  return (
    <>
      <FormRow optionId="module.carcass.support" label="Base">
        <IconChoice
          hideLabel
          label="Base"
          value={value}
          options={[
            { value: "none", label: "Directe a terra", icon: LuArrowDownToLine, hint: "Directe a terra, sense sòcol ni potes" },
            { value: "plinth", label: "Sòcol", icon: LuPanelBottom, hint: "Sòcol retranquejat a sota" },
            { value: "legs", label: "Potes", icon: LuFootprints, hint: "Potes regulables" },
            { value: "open", label: "Sense base (obert)", icon: LuSquareDashedBottom, hint: "Sense base: obert per sota" },
          ]}
          onChange={(k) => {
            const { noBottom: _n, ...rest } = c
            const base: Base = k === "plinth" ? { kind: "plinth", height: 60, setback: 30 } : k === "legs" ? { kind: "legs", height: 100 } : { kind: "none" }
            // «Sense base» és `noBottom` (la forma d'ara del `open` d'abans).
            onChange(k === "open" ? { ...rest, base, noBottom: true } : { ...rest, base })
          }}
        />
      </FormRow>
      {c.base.kind === "plinth" && (
        <>
          <NumRow optionId="module.carcass.plinthHeight" label="Alçada sòcol" value={c.base.height} min={20} max={300} step={5} onChange={(height) => c.base.kind === "plinth" && set({ ...c.base, height })} />
          <NumRow optionId="module.carcass.plinthSetback" label="Retranqueig" value={c.base.setback} min={0} max={100} step={5} onChange={(setback) => c.base.kind === "plinth" && set({ ...c.base, setback })} />
        </>
      )}
      {c.base.kind === "legs" && <LegsFields base={c.base} thickness={c.thickness} onChange={set} />}
    </>
  )
}

/** Les potes del mòdul: alçada, pota i el sòcol davant de les potes. */
function LegsFields({ base, thickness, onChange }: { base: LegsBase; thickness: number; onChange: (b: Base) => void }) {
  const p = base.plinth
  return (
    <>
      <NumRow optionId="module.carcass.legHeight" label="Alçada potes" value={base.height} min={20} max={400} step={5} onChange={(height) => height >= 20 && height <= 400 && onChange({ ...base, height })} />
      <LegPick base={base} onChange={onChange} />
      <FormRow optionId="module.carcass.legPlinth" label="Sòcol" help="Un tauler davant de les potes, de tota l'amplada, de terra fins a 5 mm sota la base. Es fixa a les potes del davant amb els clips de sòcol (Häfele 637.38.054, per cargolar: a mà).">
        <Switch.Root
          size="sm"
          pt="6px"
          checked={!!p}
          onCheckedChange={(e) => {
            if (!e.checked) {
              const { plinth: _p, ...rest } = base
              return onChange(rest)
            }
            // Per defecte, el peu de la pota del davant (Ø78) just darrere del sòcol amb 5 mm de joc.
            const front = base.hardware?.params.insetFront ?? base.hardware?.params.inset ?? 50
            onChange({ ...base, plinth: { setback: Math.max(0, Math.round(front - 39 - 5 - thickness)) } })
          }}
        >
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">Davant de les potes</Switch.Label>
        </Switch.Root>
      </FormRow>
      {p && <NumRow optionId="module.carcass.legPlinthSetback" label="Retirada del sòcol" help="Del davant del mòdul a la cara de davant del sòcol." value={p.setback} min={0} max={200} step={1} onChange={(setback) => setback >= 0 && setback <= 200 && onChange({ ...base, plinth: { ...p, setback } })} />}
    </>
  )
}

/**
 * La pota de la base «Potes» (`Base.hardware`): les genèriques (només es veuen, cap forat) o una pota de la biblioteca
 * (Preferències › Ferratges, una **còpia**): els forats de la placa a la cara de sota de la base, a cada pota.
 */
function LegPick({ base, onChange }: { base: LegsBase; onChange: (b: Base) => void }) {
  const { settings } = useSettings()
  const legs = settings.hardwareLibrary.filter((x) => x.engine === "leg")
  const cur = base.hardware
  if (!legs.length && !cur) return null
  const pick = (item: HardwareItem | undefined) => {
    if (!item) {
      const { hardware: _h, ...rest } = base
      return onChange(rest)
    }
    onChange({ ...base, hardware: item })
  }
  // Una pota amb distància pròpia al davant (la AXILO 78): es pot canviar per a aquest mòdul (on va el sòcol).
  const front = cur?.engine === "leg" && "insetFront" in cur.params ? cur.params.insetFront : undefined
  return (
    <>
      <HardwarePick optionId="module.carcass.leg" engine="leg" label="Pota" current={cur} emptyLabel="Genèriques" help={cur ? undefined : "Genèriques: només es veuen al 3D (cap forat). Les potes de la biblioteca (Preferències › Ferratges) fan els forats de la placa a la cara de sota de la base."} onPick={pick} />
      {cur && front !== undefined && (
        <NumRow
          optionId="module.carcass.legInset"
          label="Potes al davant"
          help="Del cantell de davant de la base a l'eix de les potes del davant: deixa lloc al sòcol. Només en aquest mòdul (el de tots, a Preferències › Ferratges)."
          value={front}
          min={20}
          max={300}
          step={1}
          onChange={(v) => v >= 20 && v <= 300 && onChange({ ...base, hardware: { ...cur, params: { ...cur.params, insetFront: v } } })}
        />
      )}
    </>
  )
}
