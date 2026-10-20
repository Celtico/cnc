import { Button, HStack, Stack, Switch, Text } from "@chakra-ui/react"
import { DEFAULT_GRILLE, UI_PATHS, applianceCarcassText, moduleType, carcassBounds, zoneBounds, type FloorSupport, backChoices, hasBottom, moduleApplianceCarcass, visibleModule, boardChoices, hardwareSummary, jointApplies, materialByName, moduleRows, moduleSlotItem, type Base, type Carcass, type Module, type ModuleRows, type Top } from "../../core/model"
import { NumRow } from "../../components/NumRow"
import { FoldItem } from "../../components/Fold"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { IconChoice } from "../../components/IconChoice"
import { useState } from "react"
import { ProfileEditor } from "./ProfileEditor"
import { PRESETS, matchPreset } from "./profilePresets"
import { LuCircle, LuColumns2, LuGlobe, LuPencilRuler, LuRectangleHorizontal, LuSquircle } from "react-icons/lu"
import { LuDrill, LuGrid3X3, LuInspectionPanel, LuLayers2, LuPanelBottom, LuPanelTop, LuSquareDashed, LuSquare, LuSquareDashedBottom, LuSquareSquare, LuSquareStack, LuTriangleRight, LuWind } from "react-icons/lu"
import { useSettings } from "../settings/SettingsContext"
import { MaterialSelect } from "../settings/MaterialSelect"
import { HardwarePick } from "./HardwarePick"
import { HangerFields } from "./BaseFields"
import { ModuleSupportFields } from "./ModuleSupportFields"
import { GrillePatternFields } from "./GrillePatternFields"
import { ApplianceFields } from "./zone/ApplianceSection"

type CarcassSection = "dims" | "structure"

const BACK_LABEL: Record<Carcass["back"], string> = { groove: "En ranura", screwed: "Cargolat", inset: "Encastat", none: "Sense fons" }
const TOP_LABEL: Record<Top["kind"], string> = { full: "Sencera", ventSlot: "Ranura d'aire", grille: "Reixeta", none: "Sense tapa" }

/**
 * Formulari de la carcassa del mòdul seleccionat, per seccions (l'inspector en fa una secció plegable per a cadascuna):
 * mides i la **Caixa**, en cascada: base, fons (amb la Ranura o la Retirada del fons), tapa, laterals, parets, cantonades
 * i, al final, el que és de tots els fronts del mòdul: l'Estil, les folgances i la Retirada dels prestatges (per
 * decisió de l'usuari, 2026-10-08: «l'Estil també a la Caixa»; abans eren a «Acabats»). Només el que la construcció
 * llegeix (`moduleRows`, `core/model/usedHardware.ts`). Els passacables són a `CableHolesForm`.
 */
export function CarcassForm({ module, onChange, section, rows = moduleRows(module), support, onOpenSupport }: { module: Module; onChange: (m: Module) => void; section: CarcassSection; rows?: ModuleRows; /** El suport dels mòduls de terra (Moble › Cuina). */ support?: FloorSupport; /** Obre l'opció global: Moble › Cuina. */ onOpenSupport?: () => void }) {
  const c = module.carcass
  const { gaps } = useSettings().settings
  const set = (patch: Partial<Carcass>) => onChange({ ...module, carcass: { ...c, ...patch } })
  // La caixa tal com es construeix (`visibleModule`): el `open` d'abans com a «Sense base» i les parts que fixa
  // l'electrodomèstic que és el mòdul (`moduleApplianceCarcass`). Es mostra aquesta; s'escriu a la de l'usuari.
  const vm = visibleModule(module)
  const vc = vm.carcass
  const fixed = moduleApplianceCarcass(module)
  const rule = fixed?.rule
  const ruleHelp = fixed ? applianceCarcassText(fixed.appliance, fixed.rule) : undefined
  // Subgrups de la Caixa (per decisió de l'usuari, 2026-10-16): Base · Fons · Tapa · Laterals · Fronts, cada un amb les
  // seves opcions; la insígnia diu el que hi ha.
  // Sense `support` (un moble normal, no una cuina), el suport és el del mòdul.
  const supportKind = support ? support.kind : vc.base.kind === "plinth" ? "plinth" : vc.base.kind === "legs" ? "legs" : "floor"
  const baseBadge = c.base.kind === "wall" ? "Penjat" : supportKind === "plinth" ? "Sòcol" : supportKind === "legs" ? "Potes" : hasBottom(vc) ? (support ? "Sencera" : "Directe a terra") : "Sense base"
  const sidesBadge = vc.sides.left && vc.sides.right ? "Els dos" : vc.sides.left ? "Esquerre" : vc.sides.right ? "Dret" : "Cap"

  if (section === "dims")
    return (
      <Stack gap={4}>
        <NumRow optionId="module.dims.width" label="Amplada" value={c.width} min={100} max={3000} step={10} onChange={(width) => set({ width })} />
        <NumRow optionId="module.dims.height" label="Alçada" value={c.height} min={100} max={2800} step={10} onChange={(height) => set({ height })} />
        <NumRow optionId="module.dims.depth" label="Fondària" value={c.depth} min={100} max={1200} step={10} onChange={(depth) => set({ depth })} />
      </Stack>
    )
  if (section === "structure")
    return (
      <Stack gap={4}>
        {/* Electrodomèstic (el Tipus del mòdul, per decisió de l'usuari, 2026-10-15: «a dins la Caixa les opcions de
            l'electrodomèstic»): el que fixa l'aparell en una sola nota (no a cada fila) i, a sota, les opcions del front de
            moble. Només surten les parts de la caixa que l'aparell deixa triar (`applianceCarcass`). */}
        {ruleHelp && (
          <Text fontSize="sm" color="fg.muted">
            {ruleHelp}
          </Text>
        )}
        {moduleType(module) === "appliance" && module.root.appliance && !module.root.split && (
          <ApplianceFields
            module
            root={module.root}
            zone={module.root}
            bounds={zoneBounds(vm, module.root.id) ?? carcassBounds(module.carcass)}
            hardware={module.hardware}
            noHandles={module.fronts.handles === "none"}
            supportHeight={support && support.kind !== "floor" ? support.height : undefined}
            onChange={(root) => onChange({ ...module, root })}
          />
        )}
        {!(rule?.support === false && rule?.bottom !== undefined) && (
            <FoldItem optionId="module.carcass.baseGroup" id="mod-carcass-base" title="Base" icon={LuPanelBottom} size="sm" badge={baseBadge}>
              <Stack gap={4}>
                {/* Suport: el penjat, aquí (els penjadors); els de terra d'una cuina, el del moble (Moble › Cuina, per decisió de
                    l'usuari, 2026-10-15: «és un sòcol per a tots els mòduls i no un per a cada un»); els d'un moble normal, el del
                    mòdul (2026-10-20: «les opcions d'abans»). La Base (la peça de baix), a sota: «la base que es pugui treure». */}
                {c.base.kind === "wall" ? (
                  <>
                    <FixedRow optionId="module.carcass.support" label="Suport" text={`Penjat a la paret, a ${c.base.height} mm del terra`} help="Es canvia a Posició." />
                    {/* Els penjadors van un a cada lateral: sense laterals no n'hi ha (`usedHardwareSlots`), no surten. */}
                    {vc.sides.left || vc.sides.right ? <HangerFields module={module} base={c.base} onChange={(base) => set({ base })} /> : <FixedRow optionId="module.carcass.hanger" label="Penjadors" text="Cap (sense laterals)" help="Els penjadors van als laterals. Es penja a mà (un travesser o un fons gruixut cargolat a la paret)." />}
                  </>
                ) : rule?.support === false ? null : !support ? (
                  <ModuleSupportFields carcass={c} base={vc.base} onChange={(carcass) => onChange({ ...module, carcass })} />
                ) : (
                  // Una opció global (la de tots els mòduls de terra) no es repeteix al mòdul (per decisió de l'usuari,
                  // 2026-10-16: «no repetir les opcions ni posar un missatge, sinó un botó que digui modificar opció global»): què
                  // hi ha i un botó que porta al Moble › Cuina.
                  <FormRow optionId="module.carcass.support" label="Suport">
                    <Stack gap={2} pt="7px" align="flex-start">
                      <Text fontSize="sm" color="fg.muted">
                        {supportText(support, vc.base)}
                      </Text>
                      {onOpenSupport && (
                        <Button size="xs" variant="outline" colorPalette="wood" onClick={onOpenSupport}>
                          <LuGlobe /> Modificar opció global
                        </Button>
                      )}
                    </Stack>
                  </FormRow>
                )}
                {/* La Base, sota el Suport (en depèn): amb potes hi és sempre (s'hi cargolen). */}
                {/* Al moble normal, «Sense base» és una de les opcions de la Base (com abans de les cuines). */}
                {rule?.bottom !== undefined || !support ? null : vc.base.kind === "legs" ? null : (
                  <FormRow optionId="module.carcass.bottom" label="Base" help={support && support.kind !== "floor" ? "Sense base, el mòdul no pot anar sobre potes: va directe a terra." : vc.base.kind === "plinth" ? "Sense base, el mòdul queda obert per sota fins al sòcol." : undefined}>
                    <IconChoice
                      hideLabel
                      label="Base"
                      value={hasBottom(c) ? "full" : "none"}
                      options={[
                        { value: "full", label: "Sencera", icon: LuPanelBottom, hint: "La peça de baix de la caixa" },
                        { value: "none", label: "Sense base", icon: LuSquareDashedBottom, hint: "Sense base: obert per sota" },
                      ]}
                      onChange={(v) => {
                        if (v === "none") return set({ noBottom: true })
                        const { noBottom: _n, ...rest } = c
                        onChange({ ...module, carcass: { ...rest, base: rest.base.kind === "open" ? { kind: "none" } : rest.base } })
                      }}
                    />
                  </FormRow>
                )}

                {/* Llum a sota del moble: només amb la base a l'aire (penjat o amb potes) i si hi ha base (va a la seva cara de sota). */}
                {(vc.base.kind === "wall" || (vc.base.kind === "legs" && supportKind !== "plinth" && !vc.base.plinth)) && hasBottom(vc) && (
                  <>
                    <FormRow optionId="module.carcass.underLight" label="Llum a sota" help={vc.base.kind === "wall" ? "A la cara de sota de la base: il·lumina el taulell (com les cuines). Un joc de llum fa el forat o el rebaix de la làmpada i el del cable a la base." : "A la cara de sota de la base, entre les potes: il·lumina el terra. Amb sòcol no n'hi ha (quedaria amagada). Un joc de llum fa el forat o el rebaix de la làmpada i el del cable a la base."}>
                      <Switch.Root size="sm" pt="6px" checked={!!c.underLight} onCheckedChange={(e) => {
                        if (e.checked) return set({ underLight: {} })
                        const { underLight: _u, ...rest } = c
                        onChange({ ...module, carcass: rest })
                      }}>
                        <Switch.HiddenInput />
                        <Switch.Control />
                        <Switch.Label fontSize="sm">Sota la base</Switch.Label>
                      </Switch.Root>
                    </FormRow>
                    {c.underLight && <HardwarePick optionId="module.carcass.underLightHardware" slot="led" label="Llum" current={c.underLight.hardware ?? moduleSlotItem(module.hardware, "led")} inherited={moduleSlotItem(module.hardware, "led")} onPick={(h) => set({ underLight: h ? { hardware: h } : {} })} />}
                  </>
                )}
              </Stack>
            </FoldItem>
        )}
        {rule?.back === undefined && (
            <FoldItem optionId="module.carcass.backGroup" id="mod-carcass-back" title="Fons" icon={LuLayers2} size="sm" badge={BACK_LABEL[vc.back]}>
              <Stack gap={4}>
                {rule?.back !== undefined ? null : <FormRow optionId="module.carcass.back" label="Fons">
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
                </FormRow>}
                {/* Just sota el Fons: la ranura (en ranura) o la retirada (encastat); sense, no surten (res amagat compta). */}
                {rows.back === "groove" && <NumRow optionId="module.carcass.backSetback" label="Ranura del fons" value={c.backSetback} min={0} max={60} step={1} onChange={(backSetback) => set({ backSetback })} help="Distància al cantell posterior" />}
                {rows.back === "groove" && (
                  <>
                    <NumRow optionId="module.carcass.grooveClearance" label="Folgança de la ranura" value={c.grooveClearance ?? 0} min={0} max={2} step={0.1} onChange={(grooveClearance) => set({ grooveClearance })} help={`La ranura fa ${String(Math.round((c.backThickness + (c.grooveClearance ?? 0)) * 10) / 10).replace(".", ",")} mm d'ample: el gruix del fons + la folgança (cap al davant). ${prefHint(c.grooveClearance ?? 0, gaps.grooveClearance)}`} />
                    <PrefReset optionId="module.carcass.grooveClearance" value={c.grooveClearance ?? 0} pref={gaps.grooveClearance} onReset={() => set({ grooveClearance: gaps.grooveClearance })} />
                  </>
                )}
                {rows.back === "inset" && <NumRow optionId="module.carcass.backInsetSetback" label="Retirada del fons" value={c.backInsetSetback ?? 0} min={0} max={60} step={1} onChange={(backInsetSetback) => set({ backInsetSetback })} help="Distància del fons encastat al cantell posterior (0 = enrasat)" />}
              </Stack>
            </FoldItem>
        )}
        {rule?.top === undefined && (
            <FoldItem optionId="module.carcass.topGroup" id="mod-carcass-top" title="Tapa" icon={LuPanelTop} size="sm" badge={TOP_LABEL[vc.top.kind]}>
              <Stack gap={4}>
                {rule?.top !== undefined ? null : <FormRow optionId="module.carcass.top" label="Tapa">
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
                </FormRow>}
                {vc.top.kind === "ventSlot" && c.top.kind === "ventSlot" && <NumRow optionId="module.carcass.ventGap" label="Ranura d'aire" value={c.top.gap} min={20} max={200} step={5} onChange={(gap) => set({ top: { kind: "ventSlot", gap } })} />}
                {/* La reixeta de la tapa: el mateix patró que el front reixeta (va fixa a la caixa: sense muntatge). */}
                {vc.top.kind === "grille" && c.top.kind === "grille" && <GrillePatternFields pattern={c.top.pattern} onChange={(pattern) => set({ top: { kind: "grille", pattern } })} ids={{ pattern: "module.carcass.grille.pattern", holes: "module.carcass.grille.holes", slots: "module.carcass.grille.slots", margin: "module.carcass.grille.margin" }} />}

                {/* Tauler de taula: tapa per sobre dels laterals, amb voladís i forma. */}
                {vc.top.kind === "full" && c.top.kind === "full" && <TableTopFields module={module} onChange={onChange} />}
                {/* Sòcol de dalt (per petició de l'usuari, 2026-10-20): el tauler dret sobre la tapa fins al sostre. */}
                {vc.top.kind !== "none" && !vc.tableTop && (
                  <>
                    <FormRow optionId="module.carcass.topFiller" label="Sòcol de dalt">
                      <Switch.Root size="sm" pt="6px" checked={!!c.topFiller} onCheckedChange={(e) => set({ topFiller: e.checked ? { height: 60, setback: 0 } : undefined })}>
                        <Switch.HiddenInput />
                        <Switch.Control />
                        <Switch.Label fontSize="sm">Fins al sostre</Switch.Label>
                      </Switch.Root>
                    </FormRow>
                    {c.topFiller && (
                      <>
                        <NumRow optionId="module.carcass.topFillerHeight" label="Alçada" value={c.topFiller.height} min={10} max={600} step={5} help={`Dret sobre la tapa: el moble fa ${c.height + c.topFiller.height} mm d'alt. Posa-hi el buit fins al sostre.`} onChange={(height) => Number.isFinite(height) && height >= 10 && set({ topFiller: { ...c.topFiller!, height } })} />
                        <NumRow optionId="module.carcass.topFillerSetback" label="Retirada" value={c.topFiller.setback} min={0} max={200} step={1} help="Del davant de la caixa al davant del sòcol (0: a ras de la caixa, darrere les portes)." onChange={(setback) => Number.isFinite(setback) && setback >= 0 && set({ topFiller: { ...c.topFiller!, setback } })} />
                      </>
                    )}
                  </>
                )}
              </Stack>
            </FoldItem>
        )}
        <FoldItem optionId="module.carcass.sidesGroup" id="mod-carcass-sides" title="Laterals" icon={LuColumns2} size="sm" badge={sidesBadge}>
          <Stack gap={4}>
            {/* Laterals abans de Parets i Cantonades: totes dues en depenen (opcions en cascada: cada una només mira les de més amunt). */}
            {/* No dins d'un Field.Root: el Field dona el mateix id als dos interruptors i els dos
                rètols activaven el mateix (no es podia treure el lateral dret). */}
            {rule?.sides ? <FixedRow optionId="module.carcass.sides" label="Laterals" text="Els dos" /> : <FormRow optionId="module.carcass.sides" label={rule?.niche ? "Laterals de remat" : "Laterals"} help={rule?.niche ? "Una peça sola a l'extrem de la cuina (sense parets buides): l'aparell va entre els mòduls del costat." : undefined}>
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
            </FormRow>}

            {/* Parets buides: caixa de dues pells que fa el moble com si fos de fusta gruixuda (al nínxol d'un aparell, no). */}
            {!rule?.niche && <FormRow optionId="module.carcass.hollow" label="Parets">
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
            </FormRow>}
            {c.hollow && !rule?.niche && (
              <NumRow
                optionId="module.carcass.hollowThickness"
                label="Gruix aparent"
                value={c.hollow.thickness}
                min={2 * c.thickness + 6}
                max={300}
                step={5}
                onChange={(thickness) => set({ hollow: { thickness } })}
                help={`Laterals, base i tapa: pell de fora i de dins de ${c.thickness} mm, llistons a dins i una tira al davant. L'interior va igual.`}
              />
            )}

            {/* Cantonades: com s'uneix la tapa amb els laterals. */}
            {/* Sense laterals, o sense tapa ni base a baix dels laterals (amb sòcol la base queda
                entre els laterals), no hi ha cantonades a unir a inglet. */}
            {/* La mateixa condició que fa servir la construcció (`jointApplies`): si el control no surt, `joint` no compta. */}
            {c.hollow && !rule?.niche && (vc.sides.left || vc.sides.right) ? (
              // Amb parets buides les cantonades són sempre a inglet (com un bloc massís).
              <FormRow optionId="module.carcass.joint" label="Cantonades" help="Amb parets buides, sempre a inglet: pells de fora a 45° i tires del davant en marc.">
                <Text fontSize="sm" pt="7px">
                  A inglet
                </Text>
              </FormRow>
            ) : !jointApplies(vc) ? null : (
              <FormRow optionId="module.carcass.joint" label="Cantonades">
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

            {/* L'espiga de les unions de la caixa: una opció dels laterals, no de tot el mòdul (per decisió de l'usuari,
                2026-10-20: «unió és una opció dels laterals, no del conjunt»). Només si la caixa en fa (`moduleRows().dowel`). */}
            {rows.dowel && <DowelRow module={module} onChange={onChange} />}
          </Stack>
        </FoldItem>
        {/* La retirada dels prestatges de tot el mòdul (els compartiments la poden canviar a Front › Prestatges). L'estil i
            les folgances dels fronts són al Front de cada compartiment (`ModuleFrontsFold`, per decisió de l'usuari,
            2026-10-20). */}
        {rows.shelfSetback && <>
          <NumRow optionId="module.carcass.shelfSetback" label="Retirada dels prestatges" value={c.shelfSetback} min={0} max={100} step={1} onChange={(shelfSetback) => set({ shelfSetback })} help={`Del davant de la caixa al cantell dels prestatges de tot el mòdul (amb fronts encastats, almenys un gruix). ${prefHint(c.shelfSetback, gaps.shelfSetback)}`} />
          <PrefReset optionId="module.carcass.shelfSetback" value={c.shelfSetback} pref={gaps.shelfSetback} onReset={() => set({ shelfSetback: gaps.shelfSetback })} />
        </>}
      </Stack>
    )
  return null
}

/**
 * **Fronts del mòdul** (per decisió de l'usuari, 2026-10-20: «les opcions de front que estan a caixa, a dins de les opcions
 * de front»; abans Caixa › Fronts): l'estil i les folgances de tots els fronts del mòdul, una subsecció plegada dins del
 * Front de cada compartiment o zona dividida que en porta. Canviar-les des de qualsevol Front les canvia a tot el mòdul.
 * Només si es llegeixen (`moduleRows`): sense cap front que es fa, ni estil ni folgances.
 */
export function ModuleFrontsFold({ module, onChange, rows = moduleRows(module) }: { module: Module; onChange: (m: Module) => void; rows?: ModuleRows }) {
  const { gaps } = useSettings().settings
  const setFronts = (patch: Partial<Module["fronts"]>) => onChange({ ...module, fronts: { ...module.fronts, ...patch } })
  const style = rows.style && !moduleApplianceCarcass(module)?.rule.niche
  if (!style && !rows.outerGap && !rows.betweenGap) return null
  return (
    <FoldItem optionId="module.carcass.frontsGroup" id="zone-module-fronts" title="Fronts del mòdul" icon={LuSquareStack} size="sm" badge={module.fronts.style === "inset" ? "Encastats" : "Recobrents"}>
      <Stack gap={4}>
        <Text fontSize="xs" color="fg.muted">Per a tots els fronts del mòdul.</Text>
        {style && (
          <FormRow optionId="module.carcass.frontStyle" label="Estil dels fronts">
            <IconChoice
              hideLabel
              label="Estil dels fronts"
              value={module.fronts.style ?? "overlay"}
              options={[
                { value: "overlay", label: "Recobrents", icon: LuSquareStack, hint: "Recobrents: per davant de la caixa, tapant els cantells" },
                { value: "inset", label: "Encastats", icon: LuSquareSquare, hint: "Encastats: dins de la llum, a nivell amb el davant de la caixa" },
              ]}
              onChange={(v) => setFronts({ style: v === "overlay" ? undefined : v })}
            />
          </FormRow>
        )}
        {rows.outerGap && <>
          <NumRow optionId="module.carcass.outerGap" label="Folgança front–cos" value={module.fronts.outerGap} min={0} max={10} step={0.5} onChange={(outerGap) => setFronts({ outerGap })} help={prefHint(module.fronts.outerGap, gaps.outerGap)} />
          <PrefReset optionId="module.carcass.outerGap" value={module.fronts.outerGap} pref={gaps.outerGap} onReset={() => setFronts({ outerGap: gaps.outerGap })} />
        </>}
        {rows.betweenGap && <>
          <NumRow optionId="module.carcass.betweenGap" label="Folgança entre fronts" value={module.fronts.betweenGap} min={0} max={10} step={0.5} onChange={(betweenGap) => setFronts({ betweenGap })} help={prefHint(module.fronts.betweenGap, gaps.betweenGap)} />
          <PrefReset optionId="module.carcass.betweenGap" value={module.fronts.betweenGap} pref={gaps.betweenGap} onReset={() => setFronts({ betweenGap: gaps.betweenGap })} />
        </>}
      </Stack>
    </FoldItem>
  )
}

/**
 * Materials del cos, dels fronts i del fons. Es fa servir per a un mòdul (Mòdul › Materials; «Fronts» només amb algun
 * front que es fa, `moduleRows`) i també per al moble sencer (aplica el canvi a tots els mòduls).
 */
/** Valor del desplegable del fons per a «Com el cos» (mateix material i gruix). */
const SAME = "__com-el-cos__"

/** Ids de les files dels materials a les opcions en cascada: al mòdul i al moble (Materials de tot el moble). */
const MATERIAL_IDS = {
  module: { body: "module.materials.body", thickness: "module.materials.thickness", fronts: "module.materials.fronts", back: "module.materials.back", backThickness: "module.materials.backThickness", drawerBottom: "module.materials.drawerBottom" },
  moble: { body: "moble.materials.body", thickness: "moble.materials.thickness", fronts: "moble.materials.fronts", back: "moble.materials.back", backThickness: "moble.materials.backThickness", drawerBottom: "moble.materials.drawerBottom" },
} as const

export function MaterialsForm({ scope, carcass: c, onPatch, mixed, hasBack = c.back !== "none", hasDrawers = false, hasFronts = true, moble }: { /** Mòdul › Materials o Materials de tot el moble (els ids de les opcions en cascada). */ scope: "module" | "moble"; carcass: Carcass; /** Al mòdul: la caixa del moble (Materials de tot el moble), per a «Com el moble». */ moble?: Pick<Carcass, "material" | "thickness">; onPatch: (patch: Partial<Carcass>) => void; mixed?: boolean; /** Sense fons: no surten les opcions del fons. */ hasBack?: boolean; /** Amb calaixos: la fila «Fons del calaix». */ hasDrawers?: boolean; /** La fila «Fronts» (al mòdul, només amb algun front que es fa). */ hasFronts?: boolean }) {
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
  const asMoble = !!moble && c.material === moble.material && c.thickness === moble.thickness
  // Mateix material però un altre gruix: al nesting van a taulers diferents.
  const backApart = c.backMaterial === c.material && c.backThickness !== c.thickness
  // Només els de CNC (`boardChoices`/`backChoices`); un moble fet amb un altre continua igual (avís al selector).
  const boards = boardChoices(settings.materials)
  const setThickness = (thickness: number) => onPatch(sameBack ? { thickness, backThickness: thickness } : { thickness })
  const ids = MATERIAL_IDS[scope]
  return (
    <Stack gap={3}>
      {mixed && (
        <Text fontSize="xs" color="fg.muted">
          Els mòduls tenen materials diferents; es mostren els del primer. El que triïs s'aplica a tots.
        </Text>
      )}
      <FormRow optionId={ids.body} label="Cos" maxW="280px">
        {/* Al mòdul, «Com el moble» (per decisió de l'usuari, 2026-10-16): el cos i el gruix dels Materials de tot el moble. */}
        <MaterialSelect
          label="Cos"
          hideLabel
          materials={boards}
          value={asMoble ? "" : c.material}
          {...(moble ? { emptyLabel: `Com el moble (${moble.material}, ${moble.thickness} mm)` } : {})}
          onChange={(v) => (v || !moble ? pickMaterial("material", "thickness")(v) : onPatch(sameBack ? { material: moble.material, thickness: moble.thickness, backMaterial: moble.material, backThickness: moble.thickness } : { material: moble.material, thickness: moble.thickness }))}
        />
      </FormRow>
      {mat ? (
        <FormRow optionId={ids.thickness} label="Gruix">
          <ChoiceChips label="Gruix" options={thicknessOptions(mat.thicknesses, c.thickness)} value={String(c.thickness)} onChange={(v) => setThickness(Number(v))} />
        </FormRow>
      ) : (
        <NumRow optionId={ids.thickness} label="Gruix" value={c.thickness} min={8} max={40} step={1} onChange={setThickness} />
      )}
      {hasFronts && (
        <FormRow optionId={ids.fronts} label="Fronts" help="Portes, calaixos, abatibles, reixetes i fronts fixos. Mateix gruix que el cos." maxW="280px">
          <MaterialSelect label="Fronts" hideLabel materials={boards} value={c.frontMaterial ?? ""} emptyLabel="Com el cos" onChange={(v) => onPatch({ frontMaterial: v || undefined })} />
        </FormRow>
      )}
      {hasBack && <>
        <FormRow optionId={ids.back} label="Fons" maxW="280px">
          <MaterialSelect label="Fons" hideLabel materials={backChoices(settings.materials)} value={sameBack ? "" : c.backMaterial} emptyLabel="Com el cos" onChange={(v) => pickMaterial("backMaterial", "backThickness")(v || SAME)} />
        </FormRow>
        {backMat ? (
          <FormRow optionId={ids.backThickness} label="Gruix del fons">
            <ChoiceChips label="Gruix del fons" options={thicknessOptions(backMat.thicknesses, c.backThickness)} value={String(c.backThickness)} onChange={(v) => onPatch({ backThickness: Number(v) })} />
          </FormRow>
        ) : (
          <NumRow optionId={ids.backThickness} label="Gruix del fons" value={c.backThickness} min={3} max={40} step={1} onChange={(backThickness) => onPatch({ backThickness })} />
        )}
      </>}
      {/* Fons del calaix: el seu material (el gruix el demana la guia o el joc). Buit = com fins ara, del fons del mòdul o del cos. */}
      {hasDrawers && (
        <FormRow optionId={ids.drawerBottom} label="Fons del calaix" help="Tauler dels fons dels calaixos. El gruix el demana la guia (Gruix del fons del calaix) o el joc (16). Sense triar-ne cap, surt del fons del mòdul (amb el gruix adaptat) o del cos." maxW="280px">
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
/** Una part de la caixa que no es tria aquí (penjat, potes, l'electrodomèstic): el que és, i el perquè a l'ajuda. */
/** El suport d'un mòdul de terra en una línia: el del moble (o directe a terra, si no té base). */
function supportText(s: FloorSupport | undefined, base: Base): string {
  if (base.kind === "legs") {
    const leg = base.hardware ? `«${base.hardware.name}»` : "genèriques"
    return s?.kind === "plinth" ? `Sòcol del tram, sobre potes ${leg} de ${base.height} mm` : `Potes vistes ${leg} de ${base.height} mm`
  }
  if (s && s.kind !== "floor") return "Directe a terra (sense base, no pot anar sobre potes)"
  return "Directe a terra"
}

function FixedRow({ label, text, help, optionId }: { label: string; text: string; help?: string; optionId: string }) {
  return (
    <FormRow label={label} help={help} optionId={optionId}>
      <Text fontSize="sm" color="fg.muted" pt="7px">
        {text}
      </Text>
    </FormRow>
  )
}

function PrefReset({ value, pref, onReset }: { value: number; pref: number; onReset: () => void; /** L'id a les opcions en cascada (el test). */ optionId: string }) {
  if (value === pref) return null
  return (
    <HStack justify="flex-end" mt={-2}>
      <Button size="2xs" variant="ghost" colorPalette="wood" onClick={onReset}>
        Com a Preferències ({String(pref).replace(".", ",")} mm)
      </Button>
    </HStack>
  )
}

/**
 * Interior › Divisió › «Peces de dins» (`Carcass.innerClearance`): només a l'arrel i si és dividida
 * (`moduleHasInnerPieces`). Sense valor (mòduls d'abans): 0.
 */
export function InnerClearanceRow({ module, onChange }: { module: Module; onChange: (m: Module) => void }) {
  const c = module.carcass
  const { gaps } = useSettings().settings
  const value = c.innerClearance ?? 0
  const set = (innerClearance: number) => onChange({ ...module, carcass: { ...c, innerClearance } })
  return <>
    <NumRow optionId="zone.split.innerClearance" label="Peces de dins" value={value} min={0} max={3} step={0.5} onChange={set} help={`Tots els divisors i prestatges fixos del mòdul dividit, de qualsevol nivell: tant menys de llarg, la meitat a cada cap. La caixa no es toca. ${prefHint(value, gaps.innerClearance)}`} />
    <PrefReset optionId="zone.split.innerClearance" value={value} pref={gaps.innerClearance} onReset={() => set(gaps.innerClearance)} />
  </>
}

/**
 * Caixa › Laterals › **Espiga** de les unions de la caixa (`module.hardware.dowel`), només si la caixa en fa
 * (`moduleRows().dowel`: `carcassDowels`). Abans era una secció «Unió» del mòdul (2026-10-08); per decisió de l'usuari
 * (2026-10-20) és una opció dels laterals.
 */
function DowelRow({ module, onChange }: { module: Module; onChange: (m: Module) => void }) {
  const item = moduleSlotItem(module.hardware, "dowel")
  return <HardwarePick optionId="module.carcass.dowel" slot="dowel" current={item} help={`${hardwareSummary(item)}. Les unions de la caixa (${UI_PATHS.hardwarePrefs}).`} onPick={(next) => next && onChange({ ...module, hardware: { ...module.hardware, dowel: next } })} />
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
      <FormRow optionId="module.carcass.tableTop" label="Tauler de taula">
        <Switch.Root size="sm" pt="6px" checked={!!tt} onCheckedChange={(e) => set(e.checked ? { overhang: 30 } : undefined)}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">Per sobre dels laterals</Switch.Label>
        </Switch.Root>
      </FormRow>
      {tt && (
        <>
          <NumRow optionId="module.carcass.tableTopOverhang" label="Voladís" value={tt.overhang} min={0} max={1000} step={10} onChange={(overhang) => set({ ...tt, overhang })} help={`A tot el voltant. Tauler de ${L} × ${D} mm. Les cantonades a inglet no s'hi apliquen.`} />
          <FormRow optionId="module.carcass.tableTopShape" label="Forma">
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
            axes={["Amplada", "Fondària"]}
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

