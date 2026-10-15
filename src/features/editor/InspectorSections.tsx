import { Stack, Switch } from "@chakra-ui/react"
import { LuArrowDownToLine, LuBolt, LuBrickWall, LuFrame, LuPalette, LuPanelTop } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { FormRow } from "../../components/FormRow"
import { IconChoice } from "../../components/IconChoice"
import { NumRow } from "../../components/NumRow"
import type { ModuleBuild } from "../../core/build/buildModule"
import { splitChildSizes } from "../../core/build/layout"
import { carcassBounds, coveringZone, freeX, hasDrawers, moduleHasInnerPieces, moduleRows, moduleSlotItem, mountOf, rowOf, setModuleMount, system32RowPlace, visibleModule, zoneBounds, type Composition, type Module, type Settings, type Zone } from "../../core/model"
import { CarcassForm, InnerClearanceRow, JointForm, MaterialsForm } from "../composition/CarcassForm"
import { System32Pick } from "../composition/HardwarePick"
import { ModuleDoorsSection, ZonePanel } from "../composition/ZonePanel"
import { ApplianceSection } from "../composition/zone/ApplianceSection"
import { zoneLabel } from "../composition/zoneLabel"
import { MaterialSelect } from "../settings/MaterialSelect"
import type { SetComp } from "./useEditorDoc"

/** Els camps de la secció «Posició» d'un mòdul: fila, alçada, separacions, girat i X. */
export function ModulePositionFields({ comp, module, moduleX, updateModule }: { comp: Composition; module: Module; moduleX: number | undefined; updateModule: (m: Module) => void }) {
  // Posició dins de la seva fila (a terra o penjats) i el mòdul anterior de la fila.
  const rowMates = comp.modules.filter((m) => rowOf(m) === rowOf(module) && !freeX(m))
  const rowIndex = rowMates.indexOf(module)
  const rowPrev = rowIndex > 0 ? rowMates[rowIndex - 1] : undefined
  return (
    <>
      {/* Dues files, com les cuines: a terra (baixos) i penjats (alts). Dins de cada
          fila, l'ordre és el de l'arbre (d'esquerra a dreta) i cada mòdul va al costat
          de l'anterior de la seva fila. */}
      <FormRow
        label="Fila"
        help={
          mountOf(module) === "hung"
            ? "Al 3D, arrossega la maneta del mòdul: es mou per la paret, de costat i amunt/avall (Maj: tot el moble)."
            : mountOf(module) === "floor"
              ? "Al 3D, arrossega la maneta del mòdul: es mou pel terra, de costat i endavant/enrere (Maj: tot el moble)."
              : "Al 3D, arrossega la maneta del mòdul: llisca de costat tocant la paret (Maj: tot el moble)."
        }
      >
        {/* Com els altres botons d'opció: només la icona, el nom al tooltip i la triada a sota. */}
        <IconChoice
          label="Fila"
          hideLabel
          value={mountOf(module)}
          options={[
            { value: "wall", label: "Arrambat a la paret", icon: LuBrickWall, hint: "Arrambat a la paret: a terra; es mou de costat" },
            { value: "hung", label: "Penjat", icon: LuPanelTop, hint: "Penjat a la paret: es mou de costat i amunt/avall" },
            { value: "floor", label: "Lliure al terra", icon: LuArrowDownToLine, hint: "Lliure al terra: es mou pel terra, també separat de la paret" },
          ]}
          // Al terra: surt de la fila i es queda on és (X pròpia). El mateix camí que l'assistent (`setModuleMount`).
          onChange={(v) => updateModule(setModuleMount(module, v, Math.round(moduleX ?? 0)))}
        />
      </FormRow>
      {module.carcass.base.kind === "wall" && (
        <NumRow
          label="Alçada del terra"
          value={module.carcass.base.height}
          min={0}
          max={2800}
          step={10}
          onChange={(height) => updateModule({ ...module, carcass: { ...module.carcass, base: { kind: "wall", height } } })}
          help="Fins a la part de baix del mòdul."
        />
      )}
      {mountOf(module) === "floor" && (
        <NumRow
          label="Separació de la paret"
          value={module.wallGap ?? 0}
          min={0}
          max={10000}
          step={10}
          onChange={(wallGap) => updateModule({ ...module, wallGap })}
          help="Del darrere del mòdul a la paret."
        />
      )}
      {/* Girat 180° (una illa amb dos mòduls d'esquena, calaixos pels dos costats): només lliure al terra. */}
      {mountOf(module) === "floor" && (
        <FormRow label="Girat" help={module.turned ? "Els fronts miren enrere: posa'l d'esquena amb un altre mòdul per fer una illa amb calaixos pels dos costats." : undefined}>
          <Switch.Root size="sm" pt="6px" checked={!!module.turned} onCheckedChange={(e) => updateModule(e.checked ? { ...module, turned: true } : (({ turned: _t, ...rest }) => rest)(module))}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">180° (fronts enrere)</Switch.Label>
          </Switch.Root>
        </FormRow>
      )}
      {freeX(module) ? (
        <NumRow
          label="De costat (X)"
          value={module.x!}
          min={-20000}
          max={20000}
          step={10}
          onChange={(x) => Number.isFinite(x) && updateModule({ ...module, x })}
          help="Des de l'inici del moble. Fora de la fila: no empeny els altres (una illa, un moble solt)."
        />
      ) : (
      <NumRow
          label={rowIndex > 0 ? "Separació amb l'anterior" : "Separació des de l'inici"}
          value={module.gapBefore}
          min={0}
          max={5000}
          step={10}
          onChange={(g) => updateModule({ ...module, gapBefore: g })}
          help={rowIndex > 0 ? `Des de «${rowPrev!.name}», a l'esquerra en la mateixa fila.` : "És el primer de la fila: la distància des de l'esquerra del moble."}
        />
      )}
    </>
  )
}

/**
 * Les seccions del mòdul que la construcció llegeix (`moduleRows`): Caixa, Portes de tot el mòdul (dividit) o
 * Electrodomèstic (sense dividir), Unió i Materials.
 * Per decisió de l'usuari (2026-10-08) no hi ha secció «Acabats»: cada fila és a la secció del que toca, un sol
 * lloc per decisió i només el que la construcció llegeix (`moduleRows`): el fons, l'estil, les folgances i el
 * retranqueig a la Caixa; el material dels fronts a Materials; l'espiga a Unió. Els ferratges per defecte del
 * mòdul no surten: cada compartiment tria el seu (o «Com el mòdul»).
 */
export function ModuleSections({ module, updateModule }: { module: Module; updateModule: (m: Module) => void }) {
  const rows = moduleRows(module)
  return (
    <>
      <FoldItem id="mod-structure" title="Caixa" icon={LuFrame} badge={rows.style ? (module.fronts.style === "inset" ? "Encastats" : "Recobrents") : undefined}>
        <CarcassForm module={module} onChange={updateModule} section="structure" rows={rows} />
      </FoldItem>
      {/* Portes de dalt a baix de tot el mòdul (armari), només amb l'Interior dividit: sense dividir, el Front és el
          del compartiment. Després de la Caixa (els laterals diuen on hi caben) i abans dels Materials (Fronts). */}
      {module.root.split && (
        <ModuleDoorsSection
          root={module.root}
          bounds={zoneBounds(module, module.root.id) ?? carcassBounds(module.carcass)}
          hardware={module.hardware}
          noHandles={module.fronts.handles === "none"}
          onChange={(root) => updateModule({ ...module, root })}
          // La filera System 32 del mòdul, després de la «Frontissa» si li toca a aquestes portes (`system32RowPlace`).
          afterHinge={(() => {
            const place = system32RowPlace(module)
            if (place?.at !== "front" || !place.zones.has(module.root.id)) return undefined
            return <System32Pick current={moduleSlotItem(module.hardware, "system32")} what={place.what} onPick={(system32) => updateModule({ ...module, hardware: { ...module.hardware, system32 } })} />
          })()}
        />
      )}
      {/* Electrodomèstic d'un mòdul sense dividir (per decisió de l'usuari, 2026-10-15: «ja és l'electrodomèstic»): el de
          l'arrel (`root.appliance`), al lloc de les Portes (les dues no surten mai juntes): després de la Caixa (laterals i
          base diuen on obre i si hi ha sòcol) i abans dels Materials (el del front de moble). Si l'ocupa, l'arbre no
          ensenya l'«Interior» (`isApplianceModule`); amb la placa o la campana, l'«Interior» conserva el seu contingut. Un
          mòdul dividit el tria a cada compartiment. */}
      {!module.root.split && (
        <ApplianceSection
          module
          root={module.root}
          zone={module.root}
          bounds={zoneBounds(module, module.root.id) ?? carcassBounds(module.carcass)}
          hardware={module.hardware}
          noHandles={module.fronts.handles === "none"}
          onChange={(root) => updateModule({ ...module, root })}
        />
      )}
      {rows.dowel && (
        <FoldItem id="mod-joint" title="Unió" icon={LuBolt}>
          <JointForm module={module} onChange={updateModule} />
        </FoldItem>
      )}
      <FoldItem id="mod-materials" title="Materials" icon={LuPalette}>
        <MaterialsForm carcass={module.carcass} hasDrawers={hasDrawers(visibleModule(module).root)} hasFronts={rows.frontMaterial} onPatch={(patch) => updateModule({ ...module, carcass: { ...module.carcass, ...patch } })} />
      </FoldItem>
    </>
  )
}

/** Les propietats d'un compartiment (`ZonePanel`) amb el que en sap la construcció. */
export function ZoneSection({ module, zone, moduleBuild, updateModule, selectZone }: { module: Module; zone: Zone; moduleBuild: ModuleBuild | undefined; updateModule: (m: Module) => void; selectZone: (id: string) => void }) {
  return (
    <ZonePanel
      root={module.root}
      zone={zone}
      bounds={zoneBounds(module, zone.id) ?? carcassBounds(module.carcass)}
      {...(() => {
        // Com es construeix: un front que no es fa (compartiment sense un costat, `zoneSupport.ts`) no tapa res.
        const cover = coveringZone(visibleModule(module).root, zone.id)
        return cover ? { coveredBy: zoneLabel(cover, { root: cover.id === module.root.id }), coveredByFixed: cover.front?.kind === "panel" } : {}
      })()}
      hardware={module.hardware}
      noHandles={module.fronts.handles === "none"}
      openRatio={moduleBuild?.openRatios[zone.id]}
      drawerHeights={moduleBuild?.drawerHeights[zone.id]}
      kits={moduleBuild?.hardwareKits.filter((k) => k.zoneId === zone.id)}
      onChange={(root) => updateModule({ ...module, root })}
      onSelect={selectZone}
      childSizes={moduleBuild ? splitChildSizes(moduleBuild.layout, zone) : undefined}
      // La filera System 32 del mòdul: als Prestatges o al Front d'aquest compartiment, si li toca (`system32RowPlace`).
      system32={(() => {
        const place = system32RowPlace(module)
        if (!place?.zones.has(zone.id)) return undefined
        return { at: place.at, row: <System32Pick current={moduleSlotItem(module.hardware, "system32")} what={place.what} onPick={(system32) => updateModule({ ...module, hardware: { ...module.hardware, system32 } })} /> }
      })()}
      // A l'«Interior» (l'arrel), a la Divisió: la folgança de les peces de dins, només amb l'arrel dividida (tots els
      // divisors i prestatges fixos; opcions en cascada).
      splitExtra={zone.id === module.root.id && moduleHasInnerPieces(module) ? <InnerClearanceRow module={module} onChange={updateModule} /> : null}
    />
  )
}

/** Terra i paret de l'escena on es presenta el moble (per defecte, les de Preferències). */
export function SceneFinishFields({ comp, setComp, materials }: { comp: Composition; setComp: SetComp; materials: Settings["materials"] }) {
  return (
    <Stack gap={0}>
      {(["floor", "wall"] as const).map((k) => (
        <FormRow key={k} label={k === "floor" ? "Terra" : "Paret"} help={k === "wall" ? "Es veuen en mode Presentació i a la miniatura de la targeta." : undefined} maxW="280px">
          <MaterialSelect
            label={k === "floor" ? "Terra" : "Paret"}
            materials={materials}
            value={comp.scene?.[k] ?? ""}
            emptyLabel="Com a Preferències"
            hideLabel
            onChange={(v) => setComp((c) => {
              const next = { ...c.scene, [k]: v || undefined }
              const { scene: _s, ...rest } = c
              return next.floor || next.wall ? { ...rest, scene: next } : rest
            })}
          />
        </FormRow>
      ))}
    </Stack>
  )
}
