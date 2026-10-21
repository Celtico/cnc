import { Stack, Text } from "@chakra-ui/react"
import { LuGrid3X3, LuPanelBottom, LuPanelLeft, LuPanelRight, LuPanelTop, LuSquareDashed, LuSquareDashedBottom, LuWind } from "react-icons/lu"
import { RxBorderBottom, RxBorderLeft, RxBorderRight, RxBorderSplit, RxBorderTop } from "react-icons/rx"
import { FoldItem } from "../../../components/Fold"
import { FormRow } from "../../../components/FormRow"
import { IconChoice } from "../../../components/IconChoice"
import { NumRow } from "../../../components/NumRow"
import { DEFAULT_GRILLE, moduleBack, parentOf, setOuterWall, updateZone, zoneBacks, type Carcass, type Zone, type ZoneBounds, type ZoneSide } from "../../../core/model"
import { BACK_LABEL, BACK_OPTIONS } from "../backOptions"
import type { Layout } from "../../../core/build/layout"
import { wallRemovers } from "../../../core/build/wallNeighbours"

/**
 * Un costat que és la caixa del mòdul (no un divisor d'una divisió). A l'Interior és la peça del mòdul (per decisió de
 * l'usuari, 2026-10-21: «per què no puc ficar una tapa?»); a una altra zona, el seu tram (per decisió de l'usuari,
 * 2026-10-21: «no pots ficar una tapa que surti de la seva divisió?», `setOuterWall`).
 */
const OUTER: Record<ZoneSide, string> = {
  left: "És el lateral esquerre del mòdul: canviar-lo aquí el canvia a tot el mòdul.",
  right: "És el lateral dret del mòdul: canviar-lo aquí el canvia a tot el mòdul.",
  bottom: "És la base del mòdul: canviar-la aquí la canvia a tot el mòdul.",
  top: "És la tapa del mòdul: canviar-la aquí la canvia a tot el mòdul.",
}
const OUTER_SPAN: Record<ZoneSide, string> = {
  left: "El tram del lateral esquerre del mòdul al costat d'aquesta zona: només aquí.",
  right: "El tram del lateral dret del mòdul al costat d'aquesta zona: només aquí.",
  bottom: "El tram de la base del mòdul sota aquesta zona: només aquí.",
  top: "El tram de la tapa del mòdul sobre aquesta zona: només aquí.",
}

/**
 * La **caixa** de la zona (per decisió de l'usuari, 2026-10-21: «quan dic Caixa, totes les opcions de Caixa, el mateix del
 * mòdul»): Tapa, Laterals, Fons i Base, cadascuna amb el seu acordió al mateix nivell que el Front i abans d'ell (per
 * decisió de l'usuari, 2026-10-21: «pots ficar les opcions a fora com el Front i ordena primer tapa, laterals, fons, base,
 * front»), amb una icona de la peça (les de Radix, per decisió de l'usuari, 2026-10-21: les mateixes al mòdul, a la divisió i a l'obertura). La base, la tapa i els laterals d'una zona són els divisors i els prestatges fixos de les divisions: treure'n
 * un vol dir que aquella peça no hi passa (`Zone.noWalls`; la zona del costat perd la mateixa paret, és la mateixa peça).
 * Els que són la caixa del mòdul, i el que és de tot el moble (suport, ranura d'aire, reixeta), surten apagats i diuen
 * per què (regla 6). El **Fons**: els 4 valors del Fons del mòdul; surt marcat el que fa (el de la zona de més amunt o,
 * a l'Interior, el del mòdul) i, si es canvia, aquesta zona i les de dins fan el triat.
 */
export function ZoneBoxSection({ root, zone, carcass, bounds, layout, onChange, onCarcass }: { root: Zone; zone: Zone; carcass: Carcass; bounds: ZoneBounds; /** Les zones com es construeixen: el que treu la zona del costat (`wallRemovers`). */ layout?: Pick<Layout, "rects" | "dividers">; onChange: (root: Zone) => void; /** Canvia la caixa del mòdul (els costats que en són) i, amb els trams, les zones. */ onCarcass?: (c: Carcass, root?: Zone) => void }) {
  const backs = zoneBacks({ carcass: carcass as Carcass, root })
  const own = backs.get(zone.id) ?? moduleBack(carcass)
  const parent = parentOf(root, zone.id)
  const inherited = (parent && backs.get(parent.id)) || moduleBack(carcass)
  const patch = (fn: (z: Zone) => Zone) => onChange(updateZone(root, zone.id, fn))
  const setBack = (p: Pick<Zone, "back" | "backInsetSetback">) =>
    patch((z) => {
      const { back: _b, backInsetSetback: _s, ...rest } = z
      return { ...rest, ...(p.back !== undefined ? { back: p.back } : {}), ...(p.backInsetSetback !== undefined ? { backInsetSetback: p.backInsetSetback } : {}) }
    })
  const pickBack = (kind: Carcass["back"]) => {
    if (kind === inherited.kind) return setBack({})
    // Encastat: comença amb la retirada que ja fa (la de més amunt si ho és, o la del pla del fons del mòdul).
    setBack(kind === "inset" ? { back: kind, backInsetSetback: inherited.kind === "inset" ? inherited.setback : 0 } : { back: kind })
  }
  // Un costat: hi és (la peça hi passa) si no és a `noWalls`; només es pot treure si és d'una divisió (`bounds.inner`).
  const inner = (s: ZoneSide) => !!bounds.inner?.includes(s)
  // Els costats que són la caixa del mòdul: a l'Interior la peça del mòdul, a les altres zones el seu tram (`bounds` ja
  // diu si hi és: el mòdul la té i ni aquesta zona ni una de més amunt en treu el tram).
  const isRoot = zone.id === root.id
  // Un divisor el pot treure aquesta zona o la de l'altre costat (`wallRemovers`): és la mateixa peça.
  const removers = (s: ZoneSide) => (inner(s) && layout ? wallRemovers(layout, root, zone.id, s) : { ids: [], full: false })
  const has = (s: ZoneSide) => (inner(s) ? !zone.noWalls?.includes(s) && !removers(s).full : bounds[s])
  // La base d'un mòdul amb potes no es treu a trams: s'hi cargolen.
  const editable = (s: ZoneSide) => inner(s) || (!!onCarcass && (isRoot || s !== "bottom" || carcass.base.kind !== "legs"))
  const outerWhy = (s: ZoneSide) => (isRoot ? OUTER[s] : s === "bottom" && carcass.base.kind === "legs" ? "La base d'un mòdul amb potes és sencera: s'hi cargolen." : OUTER_SPAN[s])
  const setOuter = (s: ZoneSide, on: boolean) => {
    if (!onCarcass) return
    const next = setOuterWall({ carcass, root }, zone.id, s, on)
    onCarcass(next.carcass, next.root)
  }
  const OPP: Record<ZoneSide, ZoneSide> = { left: "right", right: "left", bottom: "top", top: "bottom" }
  const withoutWall = (z: Zone, w: ZoneSide, on: boolean): Zone => {
    const rest = (z.noWalls ?? []).filter((x) => x !== w)
    const next = on ? rest : [...rest, w]
    const { noWalls: _w, ...bare } = z
    return next.length ? { ...bare, noWalls: (["left", "right", "bottom", "top"] as const).filter((x) => next.includes(x)) } : bare
  }
  const setWall = (s: ZoneSide, on: boolean) => {
    if (!inner(s)) return setOuter(s, on)
    let next = updateZone(root, zone.id, (z) => withoutWall(z, s, on))
    // Posar-la: també la treuen de la llista les zones de l'altre costat que l'havien tret.
    if (on) for (const id of removers(s).ids) next = updateZone(next, id, (z) => withoutWall(z, OPP[s], true))
    onChange(next)
  }
  const wallChoice = (s: "bottom" | "top") => {
    const Full = s === "bottom" ? LuPanelBottom : LuPanelTop
    const None = s === "bottom" ? LuSquareDashedBottom : LuSquareDashed
    const why = inner(s) ? undefined : outerWhy(s)
    return (
      <FormRow optionId={s === "bottom" ? "zone.box.bottom" : "zone.box.top"} label={s === "bottom" ? "Base" : "Tapa"} help={why ?? (has(s) ? "El prestatge fix de la divisió que la tanca." : "El prestatge fix no hi passa: la zona de l'altre costat guanya l'espai.")}>
        <IconChoice
          hideLabel
          label={s === "bottom" ? "Base" : "Tapa"}
          value={s === "top" && !inner(s) && has(s) ? carcass.top.kind : has(s) ? "full" : "none"}
          options={[
            { value: "full", label: "Sencera", icon: Full, disabled: !editable(s), ...(why ? { hint: `Sencera: ${why}` } : {}) },
            ...(s === "top"
              ? [
                  // La ranura d'aire i la reixeta són de la tapa del mòdul: a la zona de dalt de tot, la canvien.
                  { value: "ventSlot" as const, label: "Ranura d'aire", icon: LuWind, disabled: inner(s) || !onCarcass, hint: inner(s) ? "Ranura d'aire: només a la tapa del mòdul." : `Ranura d'aire: ${OUTER.top}` },
                  { value: "grille" as const, label: "Reixeta", icon: LuGrid3X3, disabled: inner(s) || !onCarcass, hint: inner(s) ? "Reixeta: només a la tapa del mòdul." : `Reixeta: ${OUTER.top}` },
                ]
              : []),
            { value: "none", label: s === "bottom" ? "Sense base" : "Sense tapa", icon: None, disabled: !editable(s), ...(why ? { hint: why } : {}) },
          ]}
          onChange={(v) => {
            if (s === "top" && !inner(s) && onCarcass && (v === "ventSlot" || v === "grille")) return onCarcass({ ...carcass, top: v === "ventSlot" ? { kind: "ventSlot", gap: 60 } : { kind: "grille", pattern: DEFAULT_GRILLE } })
            setWall(s, v === "full")
          }}
        />
      </FormRow>
    )
  }
  return (
    <>
      <FoldItem optionId="zone.box.topGroup" id="zone-box-top" title="Tapa" icon={RxBorderTop} badge={has("top") ? "Sencera" : "Sense tapa"} defaultOpen={false}>
        {wallChoice("top")}
      </FoldItem>
      {/* Un acordió per lateral (per decisió de l'usuari, 2026-10-21: «separa els laterals: Esquerra, Dreta»). */}
      {(["left", "right"] as const).map((s) => (
        <FoldItem key={s} optionId={s === "left" ? "zone.box.leftGroup" : "zone.box.rightGroup"} id={s === "left" ? "zone-box-left" : "zone-box-right"} title={s === "left" ? "Esquerra" : "Dreta"} icon={s === "left" ? RxBorderLeft : RxBorderRight} badge={has(s) ? "Sencer" : "Sense lateral"} defaultOpen={false}>
          <FormRow
            optionId={s === "left" ? "zone.box.left" : "zone.box.right"}
            label="Lateral"
            help={inner(s) ? (has(s) ? "El divisor de la divisió que la tanca." : "El divisor no hi passa: la zona del costat guanya l'espai.") : outerWhy(s)}
          >
            <IconChoice
              hideLabel
              label={s === "left" ? "Lateral esquerre" : "Lateral dret"}
              value={has(s) ? "full" : "none"}
              options={[
                { value: "full", label: "Sencer", icon: s === "left" ? LuPanelLeft : LuPanelRight, disabled: !editable(s) },
                { value: "none", label: "Sense lateral", icon: LuSquareDashed, disabled: !editable(s) },
              ]}
              onChange={(v) => setWall(s, v === "full")}
            />
          </FormRow>
        </FoldItem>
      ))}
      <FoldItem optionId="zone.box.backGroup" id="zone-box-back" title="Fons" icon={RxBorderSplit} badge={BACK_LABEL[own.kind]} defaultOpen={false}>
        <Stack gap={4}>
          <FormRow optionId="zone.box.back" label="Fons" help={zone.back ? undefined : parent ? "El de la zona de més amunt." : "El del mòdul (Mòdul › Fons)."}>
            <IconChoice
              hideLabel
              label="Fons"
              value={own.kind}
              options={BACK_OPTIONS}
              onChange={pickBack}
            />
          </FormRow>
          {own.kind === "inset" && (
            <NumRow
              optionId="zone.box.backSetback"
              label="Retirada del fons"
              value={own.setback}
              min={0}
              max={600}
              step={1}
              onChange={(v) => {
                // Si ja és encastat més amunt, només la retirada (si és la mateixa, res de propi).
                if (inherited.kind === "inset") return setBack(v === inherited.setback ? {} : { backInsetSetback: v })
                setBack({ back: "inset", backInsetSetback: v })
              }}
              help="Distància al cantell posterior de la caixa; no va més enrere que el fons del mòdul. Les peces de dins arriben fins a aquest fons."
            />
          )}
        </Stack>
      </FoldItem>
      <FoldItem optionId="zone.box.bottomGroup" id="zone-box-bottom" title="Base" icon={RxBorderBottom} badge={has("bottom") ? "Sencera" : "Sense base"} defaultOpen={false}>
        <Stack gap={4}>
          <Text textStyle="xs" color="fg.muted">El suport (directe a terra, sòcol, potes o penjat) és de tot el mòdul: Mòdul › Base.</Text>
          {wallChoice("bottom")}
        </Stack>
      </FoldItem>
    </>
  )
}
