import { LuAlignJustify, LuColumns3, LuGrip } from "react-icons/lu"
import { FormRow } from "../../components/FormRow"
import { IconChoice } from "../../components/IconChoice"
import { NumRow } from "../../components/NumRow"
import type { GrillePattern } from "../../core/model"

/** Els ids de les files a les opcions en cascada (els passa qui el fa servir: el front reixeta o la tapa). */
interface GrillePatternIds {
  pattern: string
  holes: string
  slots: string
  margin: string
}

/**
 * El patró d'una reixeta (un sol component per al front reixeta i la tapa amb reixeta, per decisió de l'usuari,
 * 2026-10-16): Patró (ranures verticals, horitzontals o forats al tresbolillo), Ranura i Separació o Diàmetre i Pas, i
 * Marge.
 */
export function GrillePatternFields({ pattern: p, onChange, ids }: { pattern: GrillePattern; onChange: (p: GrillePattern) => void; ids: GrillePatternIds }) {
  const setP = (patch: Partial<GrillePattern>) => onChange({ ...p, ...patch })
  return (
    <>
      <FormRow optionId={ids.pattern} label="Patró">
        <IconChoice
          hideLabel
          label="Patró"
          value={p.kind}
          options={[
            { value: "slotsV", label: "Ranures verticals", icon: LuColumns3 },
            { value: "slotsH", label: "Ranures horitzontals", icon: LuAlignJustify },
            { value: "holes", label: "Forats al tresbolillo", icon: LuGrip },
          ]}
          onChange={(kind) => setP({ kind })}
        />
      </FormRow>
      {p.kind === "holes" ? (
        <>
          <NumRow optionId={ids.holes} label="Diàmetre forat" value={p.holeDiameter} min={3} max={60} step={1} onChange={(holeDiameter) => setP({ holeDiameter })} />
          <NumRow optionId={ids.holes} label="Pas" value={p.holePitch} min={4} max={120} step={1} onChange={(holePitch) => setP({ holePitch })} />
        </>
      ) : (
        <>
          <NumRow optionId={ids.slots} label="Ranura" value={p.slotWidth} min={3} max={60} step={1} onChange={(slotWidth) => setP({ slotWidth })} />
          <NumRow optionId={ids.slots} label="Separació" value={p.slotGap} min={3} max={100} step={1} onChange={(slotGap) => setP({ slotGap })} />
        </>
      )}
      <NumRow optionId={ids.margin} label="Marge" value={p.margin} min={10} max={200} step={5} onChange={(margin) => setP({ margin })} />
    </>
  )
}
