import { Button, HStack, Menu, Stack, Text } from "@chakra-ui/react"
import { LuArrowUp, LuCopy, LuColumns2, LuRows2, LuPlus, LuSquareSplitHorizontal, LuSquareSplitVertical, LuTrash2, LuUngroup, LuDoorClosed, LuFlipHorizontal2, LuSquareDashed } from "react-icons/lu"
import type { ReactNode } from "react"
import { FoldItem } from "../../components/Fold"
import {
  addChild,
  duplicateZone,
  parentOf,
  removeZone,
  updateZone,
  setFront,
  splitZone,
  switchFront,
  drawersBehindDoors,
  drawersWithoutDoors,
  unsplitZone,
  flipSplit,
  canHoldAccessories,
  canHoldFront,
  canHoldShelves,
  frontLimitsHelp,
  splitDirsFor,
  findZone,
  nicheAppliance,
  type Front,
  type ModuleHardware,
  type Zone,
  type ZoneBounds,
} from "../../core/model"
import type { KitOrder } from "../../core/build/buildModule"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { SplitSizes, SplitThickness } from "./zone/SplitSizes"
import { CoveredFront, ZoneFrontSection } from "./zone/FrontSection"
import { ZoneShelvesSection } from "./zone/ShelvesSection"
import { FrontFields } from "./zone/FrontFields"
import { ActionsMenu } from "../../components/ActionsMenu"

/**
 * Accions de la zona seleccionada (van a la capçalera de l'inspector, com a icones):
 * pujar al pare, duplicar (al costat o a sobre) i eliminar. L'«Interior» (l'arrel) no es duplica ni s'elimina (com amb
 * ⌘D i Suprimir): no hi ha cap acció.
 */
export function ZoneActions({ root, zone, onChange, onSelect }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; onSelect: (id: string) => void }) {
  const parent = parentOf(root, zone.id)
  const duplicate = (dir: "v" | "h") => {
    const r = duplicateZone(root, zone.id, dir)
    onChange(r.root)
    if (r.copyId) onSelect(r.copyId)
  }
  if (!parent) return null
  // Un sol botó ⋯ amb totes les accions: la capçalera queda neta.
  return (
    <ActionsMenu label="Accions del compartiment">
      <Menu.Item value="parent" onClick={() => onSelect(parent.id)}>
        <LuArrowUp /> Seleccionar el pare
      </Menu.Item>
      <Menu.Item value="v" onClick={() => duplicate("v")}>
        <LuCopy /> Duplicar al costat
      </Menu.Item>
      <Menu.Item value="h" onClick={() => duplicate("h")}>
        <LuCopy /> Duplicar a sobre
      </Menu.Item>
      <Menu.Separator />
      <Menu.Item value="del" color="fg.error" onClick={() => onChange(removeZone(root, zone.id))}>
        <LuTrash2 /> Eliminar
      </Menu.Item>
    </ActionsMenu>
  )
}

/**
 * El contingut ocupa el compartiment i no deixa res a fer servir darrere: calaixos o un front fix (per decisió de
 * l'usuari). Prestatges i Accessoris no surten (`visibleZone` no els fa; es conserven i tornen si canvia el contingut).
 */
const fillsZone = (f: Front | undefined): boolean => f?.kind === "drawers" || f?.kind === "panel"

/** Els costats amb frontisses d'una porta (cap per als altres fronts). */
function hingeSidesOf(f: Front | undefined): ("left" | "right")[] {
  if (f?.kind !== "door") return []
  return f.mode === "double" ? ["left", "right"] : [f.hinge]
}

/** Panell d'edició de la zona seleccionada: dividir, contingut, mides de les zones (a la divisió), eliminar. */
export function ZonePanel({
  root,
  zone,
  openRatio,
  drawerHeights,
  onChange,
  hardware,
  noHandles = false,
  kits,
  splitExtra,
  coveredBy,
  coveredByFixed = false,
  coveredByDoor = false,
  coverFront,
  bodyThickness,
  shelfSetback,
  bounds,
  system32,
  onSelect,
  childSizes,
  allDrawerHeights,
  moduleFronts,
}: {
  root: Zone
  zone: Zone
  /**
   * Què aguanta el compartiment (laterals, base, tapa o divisors; `zoneBoundsMap`): opcions en cascada, el que no s'hi
   * pot construir no surt (prestatges i accessoris sense una peça a cada costat, dividir sense on unir el divisor, els
   * fronts que no s'hi poden fixar).
   */
  bounds: ZoneBounds
  /** El front que el tapa és una porta (o un abatible): hi poden anar calaixos interiors. */
  coveredByDoor?: boolean
  /** El front de la zona de més amunt que el tapa (els costats de les frontisses, per als calaixos interiors). */
  coverFront?: Front
  /** El gruix del cos del mòdul (el suplement per defecte dels calaixos interiors). */
  bodyThickness?: number
  /** El retirada dels prestatges del mòdul (Mòdul › Caixa): el que hereten els del compartiment. */
  shelfSetback?: number
  /** % d'àrea oberta si la zona té reixeta. */
  openRatio?: number
  /** Alçades reals dels fronts dels calaixos (mm), de la construcció: les de les «Auto» i el que sobra. */
  drawerHeights?: number[]
  onChange: (root: Zone) => void
  /** Ferratges del mòdul (els fronts en poden triar un altre). */
  hardware: ModuleHardware
  /** El mòdul no porta tiradors (fronts push): el «Tirador» dels fronts no surt. */
  noHandles?: boolean
  /** Calaixos d'aquesta zona fets amb un joc paramètric (del constructor): NL, números i fusta. */
  kits?: KitOrder[]
  /** Més files de la secció «Divisió» (a l'«Interior»: la folgança de les peces de dins del mòdul). */
  splitExtra?: ReactNode
  /** Nom de la zona de més amunt el front de la qual tapa aquest compartiment: el seu Front no es fa (es conserva). */
  coveredBy?: string
  /** El front que el tapa és un front fix (no portes): darrere no hi ha res a fer servir, ni Prestatges ni Accessoris. */
  coveredByFixed?: boolean
  /**
   * La «Filera System 32» del mòdul (`System32Pick`), si aquest compartiment l'ensenya (`system32RowPlace`): als
   * Prestatges (al costat de «Regulables») o al Front (després de la «Frontissa»). Mai a tots dos.
   */
  system32?: { at: "shelves" | "front"; row: ReactNode }
  /** Seleccionar un compartiment (les files de la «Divisió» hi porten). */
  onSelect?: (id: string) => void
  /**
   * Amb una divisió, les mides reals de cada fill (mm de llum), de la mateixa construcció (`splitChildSizes` sobre el
   * `layout` del mòdul): les de les zones «Auto» i el que sobra a l'última.
   */
  childSizes?: number[]
  /** Les alçades reals de cada pila de calaixos del mòdul (`ModuleBuild.drawerHeights`): les dels calaixos interiors en posar portes a una zona dividida. */
  allDrawerHeights?: Record<string, number[]>
  /** «Fronts del mòdul» (`ModuleFrontsFold`: estil i folgances de tots els fronts), dins del Front si en porta. */
  moduleFronts?: ReactNode
}) {
  // Hi ha on fer servir prestatges i accessoris: tapat per portes (com obert), o el seu contingut no l'omple.
  const shelvesBehind = coveredBy ? !coveredByFixed : !fillsZone(zone.front)
  // Darrere d'un front fix (el seu o, a les dades d'abans, el de tota la zona que el tapa si es fes) no es divideix: les
  // peces no es veurien ni es farien servir.
  const behindFixed = coveredBy ? !!coveredByFixed : zone.front?.kind === "panel"
  // Un electrodomèstic que ocupa el compartiment (el nínxol): ni Front, ni Prestatges, ni Dividir (es conserven).
  const niche = !coveredBy && !!nicheAppliance(zone)
  // Les «Opcions de l'interior», dins del Front a sota del «Contingut» (per decisió de l'usuari, 2026-10-20). Tapat: el seu
  // front (es conserva) no es fa i el compartiment és com obert (`visibleZone`). Sense una peça a cada costat (lateral o
  // divisor), cap prestatge: no surt (es conserva i torna amb els laterals). Amb calaixos o un front fix (darrere no hi ha
  // res a fer servir), tampoc; ni tapat per un front fix de tota la zona.
  const behindDoor = coveredBy ? !!coveredByDoor : zone.front?.kind === "door" || zone.front?.kind === "flap"
  const interior = !zone.split && !niche && shelvesBehind && (canHoldShelves(bounds) || canHoldAccessories(bounds))
    ? { node: <ZoneShelvesSection root={root} zone={zone} onChange={onChange} hardware={hardware} bounds={bounds} system32={system32} behindDoor={behindDoor} kits={kits} hingeSides={hingeSidesOf(coveredBy ? coverFront : zone.front)} {...(bodyThickness ? { bodyThickness } : {})} {...(shelfSetback !== undefined ? { moduleSetback: shelfSetback } : {})} />, badge: shelvesBadge(zone, behindDoor) }
    : undefined
  return (
    <Stack gap={0}>

      {zone.split ? (
        <>
          {/* El Front de la zona dividida, a dalt de tot (per decisió de l'usuari, 2026-10-20): les portes que la tapen. */}
          {coveredBy ? <CoveredFront id="zone-front" title="Front" coveredBy={coveredBy} /> : <SplitFrontSection root={root} zone={zone} onChange={onChange} hardware={hardware} noHandles={noHandles} bounds={bounds} afterHinge={system32?.at === "front" ? system32.row : undefined} {...(allDrawerHeights ? { drawerHeights: allDrawerHeights } : {})} moduleFronts={moduleFronts} />}
          <FoldItem optionId="zone.split" id="zone-split" title={`Divisió ${zone.split.dir === "v" ? "vertical" : "horitzontal"}`} badge={`${zone.split.children.length} zones`} icon={zone.split.dir === "v" ? LuColumns2 : LuRows2}>
            <SplitSizes root={root} zone={zone} onChange={onChange} onSelect={onSelect} childSizes={childSizes} />
            <SplitThickness root={root} zone={zone} onChange={onChange} {...(bodyThickness ? { bodyThickness } : {})} />
            <HStack wrap="wrap">
              <Button size="sm" variant="outline" onClick={() => onChange(addChild(root, zone.id))}>
                <LuPlus /> Afegir zona
              </Button>
              <Button size="sm" variant="outline" onClick={() => onChange(unsplitZone(root, zone.id))}>
                <LuUngroup /> Treure la divisió
              </Button>
              {/* Girar-la: només si la de l'altra direcció té on unir el divisor (`splitDirsFor`). */}
              {splitDirsFor(bounds).includes(zone.split.dir === "v" ? "h" : "v") && (
                <Button size="sm" variant="outline" onClick={() => onChange(flipSplit(root, zone.id))}>
                  {zone.split.dir === "v" ? <LuRows2 /> : <LuColumns2 />} Passar a {zone.split.dir === "v" ? "horitzontal" : "vertical"}
                </Button>
              )}
            </HStack>
            {splitExtra}
          </FoldItem>
        </>
      ) : (
        <>
          {/* L'electrodomèstic és un contingut més del Front (per decisió de l'usuari, 2026-10-20): si ocupa el compartiment,
              ni Prestatges ni Dividir. Un sol lloc per decisió: el de l'«Interior» d'un mòdul sense dividir (l'arrel) és a
              Mòdul › Tipus. */}
          {coveredBy ? <CoveredFront id="zone-front" title="Front" coveredBy={coveredBy} interior={interior} /> : <ZoneFrontSection root={root} zone={zone} openRatio={openRatio} drawerHeights={drawerHeights} onChange={onChange} hardware={hardware} noHandles={noHandles} kits={kits} bounds={bounds} afterHinge={system32?.at === "front" ? system32.row : undefined} interior={interior} appliance={zone.id !== root.id} moduleFronts={moduleFronts} />}

          {/* Només les direccions on el divisor té on unir-se (`splitDirsFor`): el vertical, a sota i a sobre; el
              travesser, als dos costats. Sense cap, o darrere d'un front fix, la secció no surt. */}
          {splitDirsFor(bounds).length > 0 && !behindFixed && !niche && (
            <FoldItem optionId="zone.divide" id="zone-divide" title="Dividir" icon={LuSquareSplitHorizontal} defaultOpen={false}>
              <Text textStyle="xs" color="fg.muted">
                Parteix aquest compartiment en dos. El contingut es queda al primer.
                {splitDirsFor(bounds).length < 2 && (splitDirsFor(bounds)[0] === "v" ? " En horitzontal no: el travesser necessita un lateral o un divisor a cada costat." : " En vertical no: el divisor necessita una peça a sota i una a sobre (base, tapa o travesser).")}
              </Text>
              <HStack wrap="wrap">
                {splitDirsFor(bounds).includes("v") && (
                  <Button size="sm" variant="outline" onClick={() => onChange(splitZone(root, zone.id, "v", 2))}>
                    <LuSquareSplitHorizontal /> En vertical
                  </Button>
                )}
                {splitDirsFor(bounds).includes("h") && (
                  <Button size="sm" variant="outline" onClick={() => onChange(splitZone(root, zone.id, "h", 2))}>
                    <LuSquareSplitVertical /> En horitzontal
                  </Button>
                )}
              </HStack>
            </FoldItem>
          )}
        </>
      )}
    </Stack>
  )
}

/**
 * El **Front d'una zona dividida** (per decisió de l'usuari, 2026-10-20: «totes les divisions tinguin les opcions de front, a
 * sobre de la divisió, al primer nivell»; abans Mòdul › Portes, només a l'arrel): portes de dalt a baix de la zona (armari
 * amb penjador i maleter darrere) que tapen tots els seus compartiments. Només Cap · Una · Dues i les opcions de la porta
 * (`FrontFields`). Un altre front d'una zona dividida (el front fix d'abans) no es fa i surt com a «Cap» (es conserva).
 */
export function SplitFrontSection({ root, zone, onChange, hardware, noHandles, bounds, afterHinge, drawerHeights, moduleFronts }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; hardware: ModuleHardware; noHandles: boolean; /** Què aguanta la zona (`canHoldFront`: pels quatre costats). */ bounds: ZoneBounds; /** Després de la «Frontissa» (la filera System 32 del mòdul). */ afterHinge?: ReactNode; /** Les alçades reals de cada pila de calaixos (`ModuleBuild.drawerHeights`): les dels calaixos interiors en posar portes. */ drawerHeights?: Record<string, number[]>; /** «Fronts del mòdul», a sota de les opcions de la porta. */ moduleFronts?: ReactNode }) {
  const door = zone.front?.kind === "door" ? zone.front : undefined
  const value = door?.mode ?? "none"
  const canDoor = canHoldFront(bounds, "door")
  const choose = (mode: "none" | "single" | "double") => {
    // Els calaixos de dins passen a calaixos interiors amb portes i tornen en treure-les (`drawersBehindDoors`, sobre el
    // subarbre d'aquesta zona).
    if (mode === "none") return onChange(updateZone(switchFront(root, zone.id, "none"), zone.id, drawersWithoutDoors))
    const base = updateZone(door ? root : switchFront(root, zone.id, "door"), zone.id, (z) => drawersBehindDoors(z, drawerHeights))
    const f = findZone(base, zone.id)?.front
    if (f?.kind !== "door") return
    // Una porta nova va amb les frontisses a un costat on hi ha on posar-les.
    const hinge = mode === "single" && !bounds[f.hinge] && bounds[f.hinge === "left" ? "right" : "left"] ? (f.hinge === "left" ? "right" : "left") : f.hinge
    onChange(setFront(base, zone.id, { ...f, mode, hinge }))
  }
  return (
    <FoldItem optionId="module.doors" id="zone-front" title="Front" icon={door ? LuDoorClosed : LuSquareDashed} badge={door ? (door.mode === "double" ? "Dues portes" : "Una porta") : "Obert"}>
      <FormRow optionId="module.doors.mode" label="Portes" help={frontLimitsHelp(bounds, ["none", "door"], door ? "door" : "none") ?? "De dalt a baix de la zona: tapen tots els seus compartiments (armari amb penjador i maleter darrere)."}>
        <ChoiceChips
          label="Portes"
          value={value}
          // Dues portes: frontisses als dos costats (cal un lateral o un divisor a cada un). El triat surt sempre.
          options={[
            { id: "none" as const, label: <><LuSquareDashed /> Cap</> },
            ...(canDoor || value === "single" ? [{ id: "single" as const, label: <><LuDoorClosed /> Una</> }] : []),
            ...((canDoor && bounds.left && bounds.right) || value === "double" ? [{ id: "double" as const, label: <><LuFlipHorizontal2 /> Dues</> }] : []),
          ]}
          onChange={choose}
        />
      </FormRow>
      {door && <FrontFields front={door} noMode hardware={hardware} noHandles={noHandles} bounds={bounds} afterHinge={afterHinge} onChange={(f) => onChange(setFront(root, zone.id, f))} />}
      {door && moduleFronts}
    </FoldItem>
  )
}

/** Resum de les «Opcions de l'interior» per a la insígnia del Front: prestatges, accessoris i calaixos interiors que hi ha («3 · Barra · 2 calaixos»). */
function shelvesBadge(zone: Zone, behindDoor: boolean): string | undefined {
  const parts = [...(zone.shelves?.n ? [String(zone.shelves.n)] : []), ...(["rail", "led"] as const).filter((k) => zone[k]).map((k) => (k === "rail" ? "Barra" : "LED")), ...(behindDoor && zone.innerDrawers ? [`${zone.innerDrawers.n} ${zone.innerDrawers.n === 1 ? "calaix" : "calaixos"}`] : [])]
  return parts.length ? parts.join(" · ") : undefined
}
