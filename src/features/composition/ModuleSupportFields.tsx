import { Switch } from "@chakra-ui/react"
import { LuArrowDownToLine, LuFootprints, LuPanelBottom } from "react-icons/lu"
import { FormRow } from "../../components/FormRow"
import { IconChoice } from "../../components/IconChoice"
import { NumRow } from "../../components/NumRow"
import { addBottomPlinth, bottomPlinthZone, removeBottomPlinth, setPlinthZone, type Base, type Carcass, type HardwareItem, type Module } from "../../core/model"
import { useSettings } from "../settings/SettingsContext"
import { HardwarePick } from "./HardwarePick"

type LegsBase = Extract<Base, { kind: "legs" }>
type BaseChoice = "none" | "plinth" | "legs"

/**
 * La **base del mòdul** d'un moble normal, com era abans de les cuines (per decisió de l'usuari, 2026-10-20: «si és moble,
 * la base com estava abans del lio de les cuines»; la cuina té el suport al Moble › Cuina, un per a tots els mòduls de
 * terra): el Suport, Directe a terra · Sòcol · Potes (amb la pota i, si es vol, el sòcol davant de les potes). La peça de
 * baix (Base: Sencera o Sense base) és una altra fila, la mateixa que a la cuina (cas 8 del model únic).
 *
 * El **Sòcol** és una drecera (per decisió de l'usuari, 2026-10-20: «0 casos especials»): «Sense base» i una zona a baix
 * de tot amb un front fix retirat (`addBottomPlinth`); l'Alçada i la Retirada són les d'aquesta zona. El sòcol d'abans
 * (`Base.plinth`, una peça pròpia) passa a aquesta drecera en obrir el moble (`withZonePlinths`).
 */
export function ModuleSupportFields({ module, base: vb, onChange }: { module: Module; /** La base tal com es construeix (`visibleModule`). */ base: Base; onChange: (m: Module) => void }) {
  const c = module.carcass
  const zone = bottomPlinthZone(module)
  const value: BaseChoice = zone ? "plinth" : vb.kind === "legs" ? "legs" : "none"
  const setCarcass = (carcass: Carcass) => onChange({ ...module, carcass })
  const set = (base: Base) => setCarcass({ ...c, base })
  return (
    <>
      <FormRow optionId="module.carcass.support" label="Suport">
        <IconChoice
          hideLabel
          label="Suport"
          value={value}
          options={[
            { value: "none", label: "Directe a terra", icon: LuArrowDownToLine, hint: "Directe a terra, sense sòcol ni potes" },
            { value: "plinth", label: "Sòcol", icon: LuPanelBottom, hint: "Sòcol retirat a sota: una zona amb un front fix" },
            { value: "legs", label: "Potes", icon: LuFootprints, hint: "Potes regulables" },
          ]}
          onChange={(k) => {
            if (k === value) return
            // Treure el sòcol fet amb una zona torna l'interior d'abans.
            const from = zone ? removeBottomPlinth(module) : module
            if (k === "plinth") return onChange(addBottomPlinth(from))
            // La peça de baix (Base) es queda com era: és una altra opció.
            const base: Base = k === "legs" ? { kind: "legs", height: 100 } : { kind: "none" }
            onChange({ ...from, carcass: { ...from.carcass, base } })
          }}
        />
      </FormRow>
      {zone && (
        <>
          <NumRow optionId="module.carcass.plinthHeight" label="Alçada sòcol" value={zone.height} min={20} max={300} step={5} suffix="mm" help="La zona de baix de l'Interior (la pots seleccionar a l'arbre)." onChange={(height) => Number.isFinite(height) && height >= 1 && onChange(setPlinthZone(module, "bottom", { height }))} />
          <NumRow optionId="module.carcass.plinthSetback" label="Retirada" value={zone.setback} min={0} max={200} step={1} suffix="mm" help="0: com els altres fronts. Més: dins de la llum i retirat del davant de la caixa (el front fix de la zona)." onChange={(setback) => Number.isFinite(setback) && setback >= 0 && onChange(setPlinthZone(module, "bottom", { setback }))} />
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
