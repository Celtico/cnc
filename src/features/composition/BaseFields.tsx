import { moduleSlotItem, type Base, type HardwareItem, type Module } from "../../core/model"
import { HardwarePick } from "./HardwarePick"

type WallBase = Extract<Base, { kind: "wall" }>
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
        optionId="module.carcass.hanger"
        slot="hanger"
        label="Penjadors"
        current={base.hanger === "none" ? undefined : base.hanger}
        inherited={hanger}
        none={{ label: "Cap", help: "Sense penjadors: el mòdul es penja a mà (un travesser o un fons gruixut cargolat a la paret).", selected: base.hanger === "none", onPick: () => choose("hanger", "none") }}
        onPick={(h) => choose("hanger", h)}
      />
      {base.hanger !== "none" && (
        <HardwarePick
          optionId="module.carcass.wallRail"
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
