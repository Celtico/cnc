import { Stack } from "@chakra-ui/react"
import { LuArrowDown, LuArrowDownToLine, LuMoveDiagonal2, LuMoveHorizontal, LuArrowLeft, LuArrowRight, LuArrowUp, LuBrickWall, LuFrame, LuPalette, LuPanelTop } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { FormRow } from "../../components/FormRow"
import { IconChoice } from "../../components/IconChoice"
import { NumRow } from "../../components/NumRow"
import type { ModuleBuild } from "../../core/build/buildModule"
import { splitChildSizes } from "../../core/build/layout"
import { carcassBounds, coveringZone, freeX, hasDrawers, moduleHasInnerPieces, moduleRot, moduleRows, moduleSlotItem, mountOf, rowOf, setModuleAppliance, setModuleKind, setModuleMount, system32RowPlace, visibleModule, zoneBounds, type Composition, type FloorSupport, type Module, type Settings, type Zone } from "../../core/model"
import { CarcassForm, InnerClearanceRow, MaterialsForm, ModuleFrontsFold } from "../composition/CarcassForm"
import { AxisLabel } from "../../components/AxisLabel"
import { System32Pick } from "../composition/HardwarePick"
import { ZonePanel } from "../composition/ZonePanel"
import { zoneLabel } from "../composition/zoneLabel"
import { MaterialSelect } from "../settings/MaterialSelect"
import type { SetComp } from "./useEditorDoc"

/** On va el mòdul (Posició): arrambat, penjat o lliure al terra, l'alçada del penjat, les separacions, girat i X. */
export function ModulePositionFields({ comp, module, moduleX, updateModule }: { comp: Composition; module: Module; moduleX: number | undefined; updateModule: (m: Module) => void }) {
  // Posició dins de la seva fila (a terra o penjats) i el mòdul anterior de la fila.
  const rowMates = comp.modules.filter((m) => rowOf(m) === rowOf(module) && !freeX(m))
  const rowIndex = rowMates.indexOf(module)
  const rowPrev = rowIndex > 0 ? rowMates[rowIndex - 1] : undefined
  return (
    <>
      {/* Dues files, com les cuines: a terra (baixos) i penjats (alts); el penjat es tria al Tipus. Dins de cada fila,
          l'ordre és el de l'arbre (d'esquerra a dreta) i cada mòdul va al costat de l'anterior de la seva fila. A terra:
          arrambat a la paret (a la fila) o lliure al terra (X pròpia). */}
      <FormRow
        optionId="module.position.mount"
        label="Fila"
        help={
          mountOf(module) === "hung"
            ? "Al 3D, arrossega la maneta del mòdul: es mou per la paret, de costat i amunt/avall (Maj: tot el moble)."
            : mountOf(module) === "floor"
              ? "Al 3D, arrossega la maneta del mòdul: es mou pel terra, de costat i endavant/enrere (Maj: tot el moble)."
              : "Al 3D, arrossega la maneta del mòdul: llisca de costat tocant la paret (Maj: tot el moble)."
        }
      >
        <IconChoice
          label="Fila"
          hideLabel
          value={mountOf(module)}
          options={[
            { value: "wall", label: "Arrambat a la paret", icon: LuBrickWall, hint: "Arrambat a la paret: a terra; es mou de costat" },
            { value: "hung", label: "Penjat", icon: LuPanelTop, hint: "Penjat a la paret: es mou de costat i amunt/avall" },
            { value: "floor", label: "Lliure al terra", icon: LuArrowDownToLine, hint: "Lliure al terra: es mou pel terra, també separat de la paret (una illa)" },
          ]}
          // Al terra: surt de la fila i es queda on és (X pròpia). El mateix camí que l'assistent (`setModuleMount`).
          onChange={(v) => updateModule(setModuleMount(module, v, Math.round(moduleX ?? 0)))}
        />
      </FormRow>
      {module.carcass.base.kind === "wall" && (
        <NumRow
          optionId="module.position.height"
          label="Alçada del terra"
          value={module.carcass.base.height}
          min={0}
          max={2800}
          step={10}
          onChange={(height) => updateModule({ ...module, carcass: { ...module.carcass, base: { kind: "wall", height } } })}
          help="Fins a la part de baix del mòdul."
        />
      )}
      {/* Lliure al terra: on és a la planta, com la Posició de les peces i els objectes (per decisió de l'usuari,
          2026-10-16: «si és lliure, han de sortir X i Y»): De costat (X) i Fondària (Z, de la paret al darrere). */}
      {freeX(module) ? (
        <>
        <NumRow
          optionId="module.position.x"
          label={<AxisLabel icon={LuMoveHorizontal} name="De costat" axis="X" hint="Des de l'inici del moble" />}
          ariaLabel="De costat (X)"
          value={module.x!}
          min={-20000}
          max={20000}
          step={10}
          onChange={(x) => Number.isFinite(x) && updateModule({ ...module, x })}
          help="Fora de la fila: no empeny els altres (una illa, un moble solt)."
        />
        <NumRow
          optionId="module.position.wallGap"
          label={<AxisLabel icon={LuMoveDiagonal2} name="Fondària" axis="Z" hint="De la paret al darrere del mòdul" />}
          ariaLabel="Fondària (Z)"
          value={module.wallGap ?? 0}
          min={0}
          max={10000}
          step={10}
          onChange={(wallGap) => Number.isFinite(wallGap) && updateModule({ ...module, wallGap })}
        />
        </>
      ) : (
      <NumRow
          optionId="module.position.gap"
          label={rowIndex > 0 ? "Separació amb l'anterior" : "Separació des de l'inici"}
          value={module.gapBefore}
          min={0}
          max={5000}
          step={10}
          onChange={(g) => updateModule({ ...module, gapBefore: g })}
          help={rowIndex > 0 ? `Des de «${rowPrev!.name}», a l'esquerra en la mateixa fila.` : "És el primer de la fila: la distància des de l'esquerra del moble."}
        />
      )}
      {/* Al terra d'abans sense X pròpia (segueix la fila): la separació de la paret. */}
      {mountOf(module) === "floor" && !freeX(module) && (
        <NumRow optionId="module.position.wallGap" label="Separació de la paret" value={module.wallGap ?? 0} min={0} max={10000} step={10} onChange={(wallGap) => Number.isFinite(wallGap) && updateModule({ ...module, wallGap })} help="Del darrere del mòdul a la paret." />
      )}
      {/* Cap on miren els fronts, a les tres posicions (per decisió de l'usuari, 2026-10-20; abans només lliure al terra):
          enrere, una illa amb dos mòduls d'esquena (només lliure al terra: arrambat o penjat mirarien a la paret); a un
          costat, l'extrem d'una illa (2026-10-16) o, a la fila, un mòdul amb el lateral a la paret. Tota la resta (obertura,
          sòcol, petjada) surt d'aquesta direcció. */}
      <FormRow
        optionId="module.position.turned"
        label="Fronts"
        help={moduleRot(module) === 180 ? "Els fronts miren enrere: posa'l d'esquena amb un altre mòdul per fer una illa amb calaixos pels dos costats." : !moduleRot(module) ? undefined : freeX(module) ? "Girat 90°: per a l'extrem d'una illa. Gira al voltant del seu centre; mou-lo amb la maneta fins que toqui l'illa." : "Girat 90°: a la fila ocupa la seva fondària i un lateral toca la paret."}
      >
        <IconChoice
          hideLabel
          label="Fronts"
          value={String(moduleRot(module)) as "0" | "90" | "180" | "270"}
          options={[
            { value: "0", label: "Endavant", icon: LuArrowDown, hint: "Els fronts miren endavant (com sempre)" },
            { value: "270", label: "A l'esquerra", icon: LuArrowLeft, hint: "Girat 90°: els fronts miren a l'esquerra" },
            { value: "90", label: "A la dreta", icon: LuArrowRight, hint: "Girat 90°: els fronts miren a la dreta" },
            ...(mountOf(module) === "floor" ? [{ value: "180" as const, label: "Enrere", icon: LuArrowUp, hint: "Girat 180°: els fronts miren enrere (illa amb dos mòduls d'esquena)" }] : []),
          ]}
          onChange={(v) => {
            const { turned: _t, rot: _r, ...rest } = module
            const rot = Number(v) as 0 | 90 | 180 | 270
            updateModule(rot ? { ...rest, rot } : rest)
          }}
        />
      </FormRow>
    </>
  )
}

/**
 * Les seccions del mòdul que la construcció llegeix (`moduleRows`): Electrodomèstic (sense dividir), Caixa i Materials.
 * Les portes d'una zona dividida són al seu Front (per decisió de l'usuari, 2026-10-20).
 * Per decisió de l'usuari (2026-10-08) no hi ha secció «Acabats»: cada fila és a la secció del que toca, un sol
 * lloc per decisió i només el que la construcció llegeix (`moduleRows`): el fons, l'estil, les folgances i
 * la retirada a la Caixa; el material dels fronts a Materials; l'espiga a Caixa › Laterals. Els ferratges per defecte del
 * mòdul no surten: cada compartiment tria el seu (o «Com el mòdul»).
 */
export function ModuleSections({ module, updateModule, support, onSupport, moble }: { module: Module; updateModule: (m: Module) => void; moduleBuild?: ModuleBuild | undefined; /** El cos del moble (el més repetit dels mòduls): «Com el moble» a Materials. */ moble?: { material: string; thickness: number }; /** El suport dels mòduls de terra (Moble › Cuina): la Caixa el diu. */ support?: FloorSupport; /** Canvia el suport de tots els mòduls de terra (Moble › Cuina). */ onSupport?: (patch: Partial<FloorSupport>) => void }) {
  const rows = moduleRows(module)
  return (
    <>
      <FoldItem optionId="module.carcass" id="mod-structure" title="Caixa" icon={LuFrame}>
        <CarcassForm module={module} onChange={updateModule} section="structure" rows={rows} support={support} onSupport={onSupport} />
      </FoldItem>
      <FoldItem optionId="module.materials" id="mod-materials" title="Materials" icon={LuPalette}>
        <MaterialsForm scope="module" carcass={module.carcass} {...(moble ? { moble } : {})} hasDrawers={hasDrawers(visibleModule(module).root)} hasFronts={rows.frontMaterial} onPatch={(patch) => updateModule({ ...module, carcass: { ...module.carcass, ...patch } })} />
      </FoldItem>
    </>
  )
}

/** Les propietats d'un compartiment (`ZonePanel`) amb el que en sap la construcció. */
export function ZoneSection({ module, zone, moduleBuild, moduleX, updateModule, selectZone }: { module: Module; zone: Zone; moduleBuild: ModuleBuild | undefined; moduleX: number | undefined; updateModule: (m: Module) => void; selectZone: (id: string) => void }) {
  return (
    <ZonePanel
      root={module.root}
      zone={zone}
      bounds={zoneBounds(module, zone.id) ?? carcassBounds(module.carcass)}
      {...(() => {
        // Com es construeix: un front que no es fa (compartiment sense un costat, `zoneSupport.ts`) no tapa res.
        const cover = coveringZone(visibleModule(module).root, zone.id)
        return cover ? { coveredBy: zoneLabel(cover, { root: cover.id === module.root.id }), coveredByFixed: cover.front?.kind === "panel", ...(cover.front ? { coverFront: cover.front } : {}) } : {}
      })()}
      bodyThickness={module.carcass.thickness}
      shelfSetback={module.carcass.shelfSetback}
      hardware={module.hardware}
      noHandles={module.fronts.handles === "none"}
      openRatio={moduleBuild?.openRatios[zone.id]}
      drawerHeights={moduleBuild?.drawerHeights[zone.id]}
      kits={moduleBuild?.hardwareKits.filter((k) => k.zoneId === zone.id)}
      onChange={(root) => {
        // L'aparell de l'Interior sense dividir (tot el mòdul) es tria al Contingut com a qualsevol zona (regla 1); triar-lo
        // o treure'l adapta el mòdul (penjat o a terra, l'amplada del nínxol: `setModuleAppliance`), com una drecera.
        const now = root.split ? undefined : root.appliance?.hardware
        if (now === (module.root.split ? undefined : module.root.appliance?.hardware)) return updateModule({ ...module, root })
        const { appliance: _a, ...bare } = root
        const here = Math.round(moduleX ?? 0)
        updateModule(now ? setModuleAppliance({ ...module, root: bare }, now, here) : setModuleKind({ ...module, root }, "moble", here))
      }}
      onSelect={selectZone}
      childSizes={moduleBuild ? splitChildSizes(moduleBuild.layout, zone) : undefined}
      moduleFronts={<ModuleFrontsFold module={module} onChange={updateModule} />}
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
        <FormRow key={k} optionId={k === "floor" ? "moble.scene.floor" : "moble.scene.wall"} label={k === "floor" ? "Terra" : "Paret"} help={k === "wall" ? "Es veuen en mode Presentació i a la miniatura de la targeta." : undefined} maxW="280px">
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
