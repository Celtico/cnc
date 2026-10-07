import { Button, HStack, Stack, Switch, Text } from "@chakra-ui/react"
import { DEFAULT_GRILLE, HARDWARE_SLOTS, backChoices, boardChoices, jointApplies, materialByName, moduleSlotItem, visibleModule, walkZones, type Base, type Carcass, type HardwareItem, type HardwareSlot, type Module, type Top } from "../../core/model"
import { NumRow } from "../../components/NumRow"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { IconChoice } from "../../components/IconChoice"
import { useState } from "react"
import { ProfileEditor } from "./ProfileEditor"
import { PRESETS, matchPreset } from "./profilePresets"
import { LuCircle, LuPencilRuler, LuRectangleHorizontal, LuSquircle } from "react-icons/lu"
import { LuArrowDownToLine, LuDrill, LuFootprints, LuGrid3X3, LuInspectionPanel, LuLayers2, LuPanelBottom, LuPanelTop, LuSquareDashed, LuSquare, LuSquareDashedBottom, LuSquareSquare, LuSquareStack, LuTriangleRight, LuWind } from "react-icons/lu"
import { useSettings } from "../settings/SettingsContext"
import { MaterialSelect } from "../settings/MaterialSelect"
import { HardwarePick } from "./HardwarePick"

export type CarcassSection = "dims" | "structure"

/**
 * Formulari de la carcassa del mòdul seleccionat, per seccions (l'inspector en fa una
 * secció plegable per a cadascuna): mides i estructura (base, fons, tapa, laterals). Els
 * passacables són a `CableHolesForm`.
 */
export function CarcassForm({ module, onChange, section }: { module: Module; onChange: (m: Module) => void; section: CarcassSection }) {
  const c = module.carcass
  const set = (patch: Partial<Carcass>) => onChange({ ...module, carcass: { ...c, ...patch } })

  if (section === "dims")
    return (
      <Stack gap={4}>
        <NumRow label="Amplada" value={c.width} min={100} max={3000} step={10} onChange={(width) => set({ width })} />
        <NumRow label="Alçada" value={c.height} min={100} max={2800} step={10} onChange={(height) => set({ height })} />
        <NumRow label="Fondària" value={c.depth} min={100} max={1200} step={10} onChange={(depth) => set({ depth })} />
      </Stack>
    )
  if (section === "structure")
    return (
      <Stack gap={4}>
        {/* «Penjat a la paret» és una posició, no una base: es tria a la secció Posició. */}
        {c.base.kind === "wall" ? (
          <FormRow label="Base" help="Es canvia a Posició.">
            <Text fontSize="sm" color="fg.muted" pt="7px">
              Cap (penjat a la paret, a {c.base.height} mm del terra)
            </Text>
          </FormRow>
        ) : (
          <FormRow label="Base">
            <IconChoice
              hideLabel
              label="Base"
              value={c.base.kind as Exclude<Base["kind"], "wall">}
              options={[
                { value: "none", label: "Directe a terra", icon: LuArrowDownToLine, hint: "Directe a terra, sense sòcol ni potes" },
                { value: "plinth", label: "Sòcol", icon: LuPanelBottom, hint: "Sòcol retranquejat a sota" },
                { value: "legs", label: "Potes", icon: LuFootprints, hint: "Potes regulables" },
                { value: "open", label: "Sense base (obert)", icon: LuSquareDashedBottom, hint: "Sense base: obert per sota" },
              ]}
              onChange={(k) => {
                const base: Base = k === "plinth" ? { kind: "plinth", height: 60, setback: 30 } : k === "legs" ? { kind: "legs", height: 100 } : { kind: k }
                set({ base })
              }}
            />
          </FormRow>
        )}
        {/* Base a tota l'amplada i les seves mides a sota, una fila per camp. */}
        {c.base.kind === "plinth" && (
          <>
            <NumRow label="Alçada sòcol" value={c.base.height} min={20} max={300} step={5} onChange={(height) => set({ base: { kind: "plinth", height, setback: (c.base as { setback: number }).setback } })} />
            <NumRow label="Retranqueig" value={c.base.setback} min={0} max={100} step={5} onChange={(setback) => set({ base: { kind: "plinth", height: (c.base as { height: number }).height, setback } })} />
          </>
        )}
        {c.base.kind === "legs" && (
          <>
            <NumRow label="Alçada potes" value={c.base.height} min={20} max={400} step={5} onChange={(height) => set({ base: { ...(c.base as Extract<Base, { kind: "legs" }>), height } })} />
            <LegPick base={c.base} onChange={(base) => set({ base })} />
          </>
        )}

        <FormRow label="Fons">
          <IconChoice
            hideLabel
            label="Fons"
            value={c.back}
            options={[
              { value: "groove", label: "En ranura", icon: LuLayers2, hint: "Fons encaixat en una ranura" },
              { value: "screwed", label: "Cargolat darrere", icon: LuDrill, hint: "Fons cargolat per darrere" },
              { value: "inset", label: "Encastat", icon: LuInspectionPanel, hint: "Fons encastat entre laterals, tapa i base, amb espigues (pot ser del mateix tauler)" },
              { value: "none", label: "Sense fons", icon: LuSquareDashed },
            ]}
            // Encastat amb un fons prim (< 15 mm, sense espigues): comença «Com el cos» (mateix material i gruix), sense l'avís.
            onChange={(back) => set(back === "inset" && c.back !== "inset" && c.backThickness < 15 ? { back, backMaterial: c.material, backThickness: c.thickness } : { back })}
          />
        </FormRow>
        <FormRow label="Tapa">
          <IconChoice
            hideLabel
            label="Tapa"
            value={c.top.kind}
            options={[
              { value: "full", label: "Sencera", icon: LuPanelTop },
              { value: "ventSlot", label: "Ranura d'aire", icon: LuWind, hint: "Amb ranura d'aire al darrere" },
              { value: "grille", label: "Reixeta", icon: LuGrid3X3, hint: "Amb reixeta" },
              { value: "none", label: "Sense tapa", icon: LuSquareDashed },
            ]}
            onChange={(k) => {
              const top: Top = k === "ventSlot" ? { kind: "ventSlot", gap: 60 } : k === "grille" ? { kind: "grille", pattern: DEFAULT_GRILLE } : { kind: k }
              set({ top })
            }}
          />
        </FormRow>
        {c.top.kind === "ventSlot" && <NumRow label="Ranura d'aire" value={c.top.gap} min={20} max={200} step={5} onChange={(gap) => set({ top: { kind: "ventSlot", gap } })} />}

        {/* Tauler de taula: tapa per sobre dels laterals, amb voladís i forma. */}
        {c.top.kind === "full" && <TableTopFields module={module} onChange={onChange} />}

        {/* Parets buides: caixa de dues pells que fa el moble com si fos de fusta gruixuda. */}
        <FormRow label="Parets">
          <Switch.Root
            size="sm"
            pt="6px"
            checked={!!c.hollow}
            onCheckedChange={(e) => set({ hollow: e.checked ? { thickness: Math.max(60, 2 * c.thickness + 20) } : undefined })}
          >
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Buides (gruix aparent)</Switch.Label>
          </Switch.Root>
        </FormRow>
        {c.hollow && (
          <NumRow
            label="Gruix aparent"
            value={c.hollow.thickness}
            min={2 * c.thickness + 6}
            max={300}
            step={5}
            onChange={(thickness) => set({ hollow: { thickness } })}
            help={`Laterals, base i tapa: pell de fora i de dins de ${c.thickness} mm, llistons a dins i una tira al davant. L'interior va igual.`}
          />
        )}

        {/* Acabats: com s'uneix la tapa amb els laterals i com van els fronts. */}
        {/* Sense laterals, o sense tapa ni base a baix dels laterals (amb sòcol la base queda
            entre els laterals), no hi ha cantonades a unir a inglet. */}
        {/* La mateixa condició que fa servir la construcció (`jointApplies`): si el control no surt, `joint` no compta. */}
        {c.hollow && (c.sides.left || c.sides.right) ? (
          // Amb parets buides les cantonades són sempre a inglet (com un bloc massís).
          <FormRow label="Cantonades" help="Amb parets buides, sempre a inglet: pells de fora a 45° i tires del davant en marc.">
            <Text fontSize="sm" pt="7px">
              A inglet
            </Text>
          </FormRow>
        ) : !jointApplies(c) ? null : (
          <FormRow label="Cantonades">
            <IconChoice
              hideLabel
              label="Cantonades"
              value={c.joint ?? "butt"}
              options={[
                { value: "butt", label: "Normals", icon: LuSquare, hint: "Normals: la tapa entre els laterals, amb espigues" },
                { value: "mitre", label: "A inglet", icon: LuTriangleRight, hint: "A inglet: tapa i base (si és a baix de tot, sense sòcol) tallades a 45° amb els laterals, no es veu cap cantell" },
              ]}
              onChange={(joint) => set({ joint: joint === "butt" ? undefined : joint })}
            />
          </FormRow>
        )}
        {/* L'estil dels fronts i el tirador per defecte són dels fronts: a l'«Interior» (`FrontsForm`), no a la caixa. */}

        {/* No dins d'un Field.Root: el Field dona el mateix id als dos interruptors i els dos
            rètols activaven el mateix (no es podia treure el lateral dret). */}
        <FormRow label="Laterals">
          <HStack gap={4} wrap="wrap" pt="6px">
            <Switch.Root size="sm" checked={c.sides.left} onCheckedChange={(e) => set({ sides: { ...c.sides, left: e.checked } })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Esquerre</Switch.Label>
            </Switch.Root>
            <Switch.Root size="sm" checked={c.sides.right} onCheckedChange={(e) => set({ sides: { ...c.sides, right: e.checked } })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Dret</Switch.Label>
            </Switch.Root>
          </HStack>
        </FormRow>
      </Stack>
    )
  return null
}

/**
 * Materials del cos, dels fronts i del fons. Es fa servir per a un mòdul i també per al
 * moble sencer (aplica el canvi a tots els mòduls).
 */
/** Valor del desplegable del fons per a «Com el cos» (mateix material i gruix). */
const SAME = "__com-el-cos__"

export function MaterialsForm({ carcass: c, onPatch, mixed, hasBack = c.back !== "none", hasDrawers = false }: { carcass: Carcass; onPatch: (patch: Partial<Carcass>) => void; mixed?: boolean; /** Sense fons: no surten les opcions del fons. */ hasBack?: boolean; /** Amb calaixos: la fila «Fons del calaix». */ hasDrawers?: boolean }) {
  const { settings } = useSettings()
  const mat = materialByName(settings, c.material)
  const backMat = materialByName(settings, c.backMaterial)
  /** En triar un material, si el gruix actual no és dels seus, s'agafa el més proper. */
  const pickMaterial = (key: "material" | "backMaterial", thicknessKey: "thickness" | "backThickness") => (name: string) => {
    // Fons del mateix material que el cos: també el mateix gruix, perquè comparteixin
    // tauler al nesting (s'agrupa per material i gruix).
    if (key === "backMaterial" && (name === SAME || name === c.material)) {
      onPatch({ backMaterial: c.material, backThickness: c.thickness })
      return
    }
    const m = materialByName(settings, name)
    const current = c[thicknessKey]
    const thickness = m && !m.thicknesses.includes(current) ? m.thicknesses.reduce((a, b) => (Math.abs(b - current) < Math.abs(a - current) ? b : a)) : current
    // Fons «com el cos»: segueix el cos quan aquest canvia.
    onPatch(key === "material" && sameBack ? { material: name, thickness, backMaterial: name, backThickness: thickness } : { [key]: name, [thicknessKey]: thickness })
  }
  const sameBack = c.backMaterial === c.material && c.backThickness === c.thickness
  // Mateix material però un altre gruix: al nesting van a taulers diferents.
  const backApart = c.backMaterial === c.material && c.backThickness !== c.thickness
  // Només els de CNC (`boardChoices`/`backChoices`); un moble fet amb un altre continua igual (avís al selector).
  const boards = boardChoices(settings.materials)
  const setThickness = (thickness: number) => onPatch(sameBack ? { thickness, backThickness: thickness } : { thickness })
  return (
    <Stack gap={3}>
      {mixed && (
        <Text fontSize="xs" color="fg.muted">
          Els mòduls tenen materials diferents; es mostren els del primer. El que triïs s'aplica a tots.
        </Text>
      )}
      <FormRow label="Cos" maxW="280px">
        <MaterialSelect label="Cos" hideLabel materials={boards} value={c.material} onChange={pickMaterial("material", "thickness")} />
      </FormRow>
      {mat ? (
        <FormRow label="Gruix">
          <ChoiceChips label="Gruix" options={thicknessOptions(mat.thicknesses, c.thickness)} value={String(c.thickness)} onChange={(v) => setThickness(Number(v))} />
        </FormRow>
      ) : (
        <NumRow label="Gruix" value={c.thickness} min={8} max={40} step={1} onChange={setThickness} />
      )}
      <FormRow label="Fronts" help="Portes, calaixos i abatibles. Mateix gruix que el cos." maxW="280px">
        <MaterialSelect label="Fronts" hideLabel materials={boards} value={c.frontMaterial ?? ""} emptyLabel="Com el cos" onChange={(v) => onPatch({ frontMaterial: v || undefined })} />
      </FormRow>
      {hasBack && <>
        <FormRow label="Fons" maxW="280px">
          <MaterialSelect label="Fons" hideLabel materials={backChoices(settings.materials)} value={sameBack ? "" : c.backMaterial} emptyLabel="Com el cos" onChange={(v) => pickMaterial("backMaterial", "backThickness")(v || SAME)} />
        </FormRow>
        {backMat ? (
          <FormRow label="Gruix del fons">
            <ChoiceChips label="Gruix del fons" options={thicknessOptions(backMat.thicknesses, c.backThickness)} value={String(c.backThickness)} onChange={(v) => onPatch({ backThickness: Number(v) })} />
          </FormRow>
        ) : (
          <NumRow label="Gruix del fons" value={c.backThickness} min={3} max={40} step={1} onChange={(backThickness) => onPatch({ backThickness })} />
        )}
      </>}
      {/* Fons del calaix: el seu material (el gruix el demana la guia o el joc). Buit = com fins ara, del fons del mòdul o del cos. */}
      {hasDrawers && (
        <FormRow label="Fons del calaix" help="Tauler dels fons dels calaixos. El gruix el demana la guia (Gruix del fons del calaix) o el joc (16). Sense triar-ne cap, surt del fons del mòdul (amb el gruix adaptat) o del cos." maxW="280px">
          <MaterialSelect label="Fons del calaix" hideLabel materials={backChoices(settings.materials)} value={c.drawerBottomMaterial ?? ""} emptyLabel={hasBack ? "Com el fons" : "Com el cos"} onChange={(v) => onPatch({ drawerBottomMaterial: v || undefined })} />
        </FormRow>
      )}
      {hasBack && backApart && (
        <HStack gap={2} fontSize="xs" color="fg.muted" wrap="wrap">
          <Text>
            El fons és de {c.backMaterial} però de {c.backThickness} mm: no comparteix tauler amb el cos ({c.thickness} mm).
          </Text>
          <Button size="2xs" variant="outline" colorPalette="wood" onClick={() => onPatch({ backThickness: c.thickness })}>
            Posar {c.thickness} mm
          </Button>
        </HStack>
      )}
      {mat?.edge && (
        <Text fontSize="xs" color="fg.muted">
          Cantell del cos: {mat.edge}
        </Text>
      )}
    </Stack>
  )
}

/** «Com a Preferències» quan el valor és el de Preferències › Folgances per defecte (com als Acabats de l'escena). */
const prefHint = (value: number, pref: number): string => (value === pref ? "Com a Preferències." : `A Preferències: ${String(pref).replace(".", ",")} mm.`)

/** Botó per tornar al valor de Preferències quan el mòdul en té un altre. */
function PrefReset({ value, pref, onReset }: { value: number; pref: number; onReset: () => void }) {
  if (value === pref) return null
  return (
    <HStack justify="flex-end" mt={-2}>
      <Button size="2xs" variant="ghost" colorPalette="wood" onClick={onReset}>
        Com a Preferències ({String(pref).replace(".", ",")} mm)
      </Button>
    </HStack>
  )
}

/** Llocs de ferratge de la caixa (laterals, unions, fons): surten a la Fusteria del mòdul. La resta són dels fronts. */
const BOX_SLOTS: ReadonlySet<HardwareSlot> = new Set<HardwareSlot>(["dowel", "system32"])

/** Només els ferratges que el mòdul fa servir de debò (forats a les seves peces); sense peces (encara), tots. */
const slotsFor = (usedSlots: ReadonlySet<string> | undefined, box: boolean) => HARDWARE_SLOTS.filter(({ slot }) => BOX_SLOTS.has(slot) === box && (!usedSlots || usedSlots.has(slot)))

/** Ferratges per defecte del mòdul (una còpia de cada un de la biblioteca); els fronts en poden triar un altre. */
function ModuleHardwarePicks({ module, onChange, slots }: { module: Module; onChange: (m: Module) => void; slots: readonly (typeof HARDWARE_SLOTS)[number][] }) {
  return slots.map(({ slot }) => (
    <HardwarePick key={slot} slot={slot} current={moduleSlotItem(module.hardware, slot)} onPick={(item) => item && onChange({ ...module, hardware: { ...module.hardware, [slot]: item } })} />
  ))
}

/** El mòdul té algun front que pot portar tirador (porta que no és de vidre, calaixos, abatible). */
function hasHandleFronts(module: Module): boolean {
  let hit = false
  walkZones(visibleModule(module).root, (z) => {
    const f = z.front
    if (f && ((f.kind === "door" && !f.glass) || f.kind === "drawers" || f.kind === "flap")) hit = true
  })
  return hit
}

/**
 * El **tirador per defecte** del mòdul (Interior › Fronts i calaixos): un de la biblioteca o «Cap (push)»
 * (`fronts.handles: "none"`, auditoria C2: el push és una tria del tirador, no de la caixa). Cada front pot dir-ne un
 * altre al seu Front; un joc de calaix push-open mana sobre tots dos.
 */
function ModuleHandlePick({ module, onChange }: { module: Module; onChange: (m: Module) => void }) {
  const push = module.fronts.handles === "none"
  return (
    <HardwarePick
      slot="handle"
      label="Tirador"
      current={push ? undefined : moduleSlotItem(module.hardware, "handle")}
      none={{
        label: "Cap (push)",
        help: "Per defecte, fronts sense tirador: obertura per pressió (cal el ferratge push a cada front; als calaixos amb joc, el tancament push-open ja ho fa). Cada front pot triar un tirador al seu Front.",
        selected: push,
        onPick: () => onChange({ ...module, fronts: { ...module.fronts, handles: "none" } }),
      }}
      onPick={(item) => item && onChange({ ...module, fronts: { ...module.fronts, handles: undefined }, hardware: { ...module.hardware, handle: item } })}
    />
  )
}

/**
 * Fusteria de la **caixa** del mòdul seleccionat (secció «Fusteria (avançat)»): el fons i els ferratges dels laterals i
 * de les unions (espiga, filera System 32). Els jocs i els ferratges dels fronts són a l'«Interior» (`FrontsForm`).
 */
export function JoineryForm({ module, onChange, usedSlots }: { module: Module; onChange: (m: Module) => void; usedSlots?: ReadonlySet<string> }) {
  const c = module.carcass
  const slots = slotsFor(usedSlots, true)
  const set = (patch: Partial<Carcass>) => onChange({ ...module, carcass: { ...c, ...patch } })
  const hasBackRow = c.back === "groove" || c.back === "inset"
  return (
    <Stack gap={3}>
      {c.back === "groove" && <NumRow label="Ranura del fons" value={c.backSetback} min={0} max={60} step={1} onChange={(backSetback) => set({ backSetback })} help="Distància al cantell posterior" />}
      {c.back === "inset" && <NumRow label="Retirada del fons" value={c.backInsetSetback ?? 0} min={0} max={60} step={1} onChange={(backInsetSetback) => set({ backInsetSetback })} help="Distància del fons encastat al cantell posterior (0 = enrasat)" />}
      <ModuleHardwarePicks module={module} onChange={onChange} slots={slots} />
      <Text fontSize="xs" color="fg.muted">
        {slots.length ? "Ferratges de la caixa que fa servir aquest mòdul (Preferències › Ferratges). Els dels fronts i calaixos són a l'«Interior»." : hasBackRow ? "Aquest mòdul no fa servir cap ferratge a la caixa." : "Aquesta caixa no té res a ajustar."}
      </Text>
    </Stack>
  )
}

/**
 * Fronts i calaixos del mòdul (secció «Fronts i calaixos» de l'«Interior», l'arrel): els jocs dels fronts, el retranqueig
 * dels prestatges i els ferratges per defecte dels fronts (frontissa, guia o joc de calaix, braç, imant, tirador). Edita
 * `module.fronts` i `module.hardware`: cada porta, calaix o abatible en pot triar un altre al seu Front.
 */
export function FrontsForm({ module, onChange, usedSlots }: { module: Module; onChange: (m: Module) => void; usedSlots?: ReadonlySet<string> }) {
  const c = module.carcass
  const { gaps } = useSettings().settings
  // El tirador per defecte té la seva fila (amb «Cap (push)»): surt sempre que hi hagi fronts que en puguin portar.
  const slots = slotsFor(usedSlots, false).filter(({ slot }) => slot !== "handle")
  const handleRow = hasHandleFronts(module)
  return (
    <Stack gap={3}>
      <FormRow label="Estil">
        <IconChoice
          hideLabel
          label="Estil dels fronts"
          value={module.fronts.style ?? "overlay"}
          options={[
            { value: "overlay", label: "Recobrents", icon: LuSquareStack, hint: "Recobrents: per davant de la caixa, tapant els cantells" },
            { value: "inset", label: "Encastats", icon: LuSquareSquare, hint: "Encastats: dins de la llum, a nivell amb el davant de la caixa" },
          ]}
          onChange={(style) => onChange({ ...module, fronts: { ...module.fronts, style: style === "overlay" ? undefined : style } })}
        />
      </FormRow>
      <NumRow label="Folgança front–cos" value={module.fronts.outerGap} min={0} max={10} step={0.5} onChange={(outerGap) => onChange({ ...module, fronts: { ...module.fronts, outerGap } })} help={prefHint(module.fronts.outerGap, gaps.outerGap)} />
      <PrefReset value={module.fronts.outerGap} pref={gaps.outerGap} onReset={() => onChange({ ...module, fronts: { ...module.fronts, outerGap: gaps.outerGap } })} />
      <NumRow label="Folgança entre fronts" value={module.fronts.betweenGap} min={0} max={10} step={0.5} onChange={(betweenGap) => onChange({ ...module, fronts: { ...module.fronts, betweenGap } })} help={prefHint(module.fronts.betweenGap, gaps.betweenGap)} />
      <PrefReset value={module.fronts.betweenGap} pref={gaps.betweenGap} onReset={() => onChange({ ...module, fronts: { ...module.fronts, betweenGap: gaps.betweenGap } })} />
      <NumRow label="Retranqueig dels prestatges" value={c.shelfSetback} min={0} max={100} step={1} onChange={(shelfSetback) => onChange({ ...module, carcass: { ...c, shelfSetback } })} help={`Del davant de la caixa al cantell dels prestatges (amb fronts encastats, almenys un gruix). ${prefHint(c.shelfSetback, gaps.shelfSetback)}`} />
      <PrefReset value={c.shelfSetback} pref={gaps.shelfSetback} onReset={() => onChange({ ...module, carcass: { ...c, shelfSetback: gaps.shelfSetback } })} />
      {handleRow && <ModuleHandlePick module={module} onChange={onChange} />}
      <ModuleHardwarePicks module={module} onChange={onChange} slots={slots} />
      <Text fontSize="xs" color="fg.muted">
        {slots.length || handleRow ? "Per defecte per a tots els fronts del mòdul; cada porta, calaix o abatible en pot triar un altre al seu Front." : "Aquest mòdul no té cap front amb ferratges."}
      </Text>
    </Stack>
  )
}

/** Tauler de taula: per sobre dels laterals (potes), voladís i forma (rectangle, arrodonit, oval o a mida). */
function TableTopFields({ module, onChange }: { module: Module; onChange: (m: Module) => void }) {
  const c = module.carcass
  const [editing, setEditing] = useState(false)
  const tt = c.tableTop
  const set = (tableTop: Carcass["tableTop"]) => onChange({ ...module, carcass: { ...c, tableTop } })
  const ov = tt?.overhang ?? 0
  const L = c.width + 2 * ov
  const D = c.depth + 2 * ov
  const preset = (id: string) => PRESETS.find((p) => p.id === id)!.make(L, D)
  return (
    <Stack gap={2}>
      <FormRow label="Tauler de taula">
        <Switch.Root size="sm" pt="6px" checked={!!tt} onCheckedChange={(e) => set(e.checked ? { overhang: 30 } : undefined)}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">Per sobre dels laterals</Switch.Label>
        </Switch.Root>
      </FormRow>
      {tt && (
        <>
          <NumRow label="Voladís" value={tt.overhang} min={0} max={1000} step={10} onChange={(overhang) => set({ ...tt, overhang })} help={`A tot el voltant. Tauler de ${L} × ${D} mm. Les cantonades a inglet no s'hi apliquen.`} />
          <FormRow label="Forma">
            <HStack gap={1.5} wrap="wrap">
              <ChoiceChips
                label="Forma"
                // Arrodonit i Oval es poden tornar a aplicar (després de canviar la mida, la desada queda estirada).
                retap
                options={[
                  { id: "rect", label: <><LuRectangleHorizontal /> Rectangle</> },
                  { id: "round", label: <><LuSquircle /> Arrodonit</> },
                  { id: "ellipse", label: <><LuCircle /> Oval</> },
                ]}
                // Una forma editada a mà no és cap de les tres (cap marcada).
                value={tt.shape ? (matchPreset(tt.shape) ?? "") : "rect"}
                onChange={(v) => set(v === "rect" ? { overhang: tt.overhang } : { ...tt, shape: preset(v) })}
              />
              <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
                <LuPencilRuler /> Editar…
              </Button>
            </HStack>
          </FormRow>
          <ProfileEditor
            open={editing}
            initial={tt.shape ?? PRESETS[0]!.make(L, D)}
            axes={["Ample", "Fondària"]}
            onClose={() => setEditing(false)}
            onApply={({ points }) => {
              set({ ...tt, shape: points })
              setEditing(false)
            }}
          />
        </>
      )}
    </Stack>
  )
}

/** Gruixos del material com a opcions, amb l'actual si no n'és cap (no es perd en obrir-lo). */
function thicknessOptions(list: number[], current: number): { id: string; label: string }[] {
  return (list.includes(current) ? list : [current, ...list]).map((t) => ({ id: String(t), label: `${t} mm` }))
}

/**
 * La pota de la base «Potes» (`Base.hardware`): les genèriques (només es veuen, cap forat) o una pota importada de la
 * biblioteca (Preferències › Ferratges, una **còpia**): un cop confirmada, els forats de la placa a la cara de sota de la
 * base, a cada pota. El mateix `HardwarePick` que la resta de ferratges del moble (motor `leg`, sense lloc al mòdul).
 */
function LegPick({ base, onChange }: { base: Extract<Base, { kind: "legs" }>; onChange: (b: Base) => void }) {
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
  return <HardwarePick engine="leg" label="Pota" current={cur} emptyLabel="Genèriques" help={cur ? undefined : "Genèriques: només es veuen al 3D (cap forat). Les potes importades (Preferències › Ferratges) fan els forats de la placa a la cara de sota de la base."} onPick={pick} />
}
