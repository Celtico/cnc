import { ChoiceChips, FormRow } from "../../components/FormRow"
import { NumRow } from "../../components/NumRow"
import { moduleSlotItem, type Base, type HardwareItem, type Module } from "../../core/model"
import { HardwarePick } from "./HardwarePick"

type LegsBase = Extract<Base, { kind: "legs" }>
type WallBase = Extract<Base, { kind: "wall" }>
type Plinth = NonNullable<LegsBase["plinth"]>

/** Els costats del sòcol, com una tria (el davant hi és sempre). */
type PlinthSidesChoice = "front" | "left" | "right" | "sides" | "all"
const SIDES_OPTIONS: { id: PlinthSidesChoice; label: string }[] = [
  { id: "front", label: "Davant" },
  { id: "left", label: "+ esquerre" },
  { id: "right", label: "+ dret" },
  { id: "sides", label: "+ laterals" },
  { id: "all", label: "Tot el voltant" },
]
const sidesOf = (p: Plinth): PlinthSidesChoice => (p.back ? "all" : p.left && p.right ? "sides" : p.left ? "left" : p.right ? "right" : "front")
const SIDES: Record<PlinthSidesChoice, Pick<Plinth, "back" | "left" | "right">> = {
  front: {},
  left: { left: true },
  right: { right: true },
  sides: { left: true, right: true },
  all: { back: true, left: true, right: true },
}

/**
 * Les opcions del **sòcol** de la base «Potes» (sota «Retirada del sòcol», en cascada): de què és (fusta, el tauler del cos,
 * o un sòcol d'alumini de la biblioteca: ferratge per metres), quins costats (per decisió de l'usuari, 2026-10-15: les
 * illes, «sòcol als laterals») i, amb més d'un costat, la retirada dels costats i, a la fusta, les cantonades.
 */
export function PlinthFields({ base, onChange }: { base: LegsBase; onChange: (b: Base) => void }) {
  const p = base.plinth
  if (!p) return null
  const set = (patch: Partial<Plinth>) => onChange({ ...base, plinth: { ...p, ...patch } })
  const choice = sidesOf(p)
  const pick = (item: HardwareItem | undefined) => {
    const { hardware: _h, ...rest } = p
    onChange({ ...base, plinth: item ? { ...rest, hardware: item } : rest })
  }
  return (
    <>
      <HardwarePick engine="plinthProfile" label="Tipus de sòcol" current={p.hardware} emptyLabel="Fusta (el tauler del cos)" help={p.hardware ? undefined : "Fusta: un tauler del gruix i material del cos (peça de CNC). Un sòcol d'alumini (Preferències › Ferratges › Potes i sòcols) es talla a mida i es clipa a les potes: surt a Peces › «Ferratges per metres»."} onPick={pick} />
      <FormRow label="Costats" help="On va el sòcol: sempre al davant i, a les illes o als extrems vistos, també als laterals i al darrere.">
        <ChoiceChips
          label="Costats del sòcol"
          options={SIDES_OPTIONS}
          value={choice}
          onChange={(c) => {
            const { back: _b, left: _l, right: _r, ...rest } = p
            onChange({ ...base, plinth: { ...rest, ...SIDES[c] } })
          }}
        />
      </FormRow>
      {choice !== "front" && (
        <>
          <NumRow label="Retirada dels costats" help="De la cara del lateral (o del darrere) del mòdul a la cara de fora del sòcol." value={p.sideSetback ?? p.setback} min={0} max={200} step={1} onChange={(v) => v >= 0 && v <= 200 && set({ sideSetback: v })} />
          {!p.hardware && (
            <FormRow label="Cantonades" help="A tope: el davant (i el darrere) passen per davant dels laterals, amb cantell a l'extrem. A inglet: tots de fora a fora, tallats a 45°.">
              <ChoiceChips label="Cantonades del sòcol" options={[{ id: "butt", label: "A tope" }, { id: "mitre", label: "A inglet" }]} value={p.corners ?? "butt"} onChange={(corners) => set({ corners })} />
            </FormRow>
          )}
        </>
      )}
    </>
  )
}

/**
 * Els **penjadors** del mòdul penjat (v45; per decisió de l'usuari, 2026-10-15: penjador regulable i regleta): el penjador
 * (un a cada lateral; «Com el mòdul», un altre de la biblioteca o «Cap») i, si n'hi ha, la regleta de paret on s'enganxen
 * (igual; «Cap»: penjadors amb plaques soltes).
 */
export function HangerFields({ module, base, onChange }: { module: Module; base: WallBase; onChange: (b: Base) => void }) {
  const hanger = moduleSlotItem(module.hardware, "hanger")
  const rail = moduleSlotItem(module.hardware, "wallRail")
  const choose = (key: "hanger" | "rail", v: HardwareItem | "none" | undefined) => {
    const { [key]: _x, ...rest } = base
    onChange(v ? { ...rest, [key]: v } : rest)
  }
  return (
    <>
      <HardwarePick
        slot="hanger"
        label="Penjadors"
        current={base.hanger === "none" ? undefined : base.hanger}
        inherited={hanger}
        none={{ label: "Cap", help: "Sense penjadors: el mòdul es penja a mà (un travesser o un fons gruixut cargolat a la paret).", selected: base.hanger === "none", onPick: () => choose("hanger", "none") }}
        onPick={(h) => choose("hanger", h)}
      />
      {base.hanger !== "none" && (
        <HardwarePick
          slot="wallRail"
          label="Regleta"
          current={base.rail === "none" ? undefined : base.rail}
          inherited={rail}
          none={{ label: "Cap", help: "Sense regleta: els penjadors s'enganxen a plaques soltes a la paret (a mà).", selected: base.rail === "none", onPick: () => choose("rail", "none") }}
          onPick={(h) => choose("rail", h)}
        />
      )}
    </>
  )
}
