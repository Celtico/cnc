import { Stack, Switch, Text } from "@chakra-ui/react"
import { LuArrowDownToLine, LuArrowUpToLine, LuDoorClosed, LuDoorOpen, LuFlipHorizontal2, LuMagnet, LuPanelLeft, LuPanelRight, LuSettings2 } from "react-icons/lu"
import type { ReactNode } from "react"
import { FoldItem } from "../../../components/Fold"
import {
  GLASS_HANDLE_TOP,
  KIT_CLOSINGS,
  isDrawerKit,
  perDrawerSlides,
  isPushClosing,
  kitOptionsOf,
  moduleSlotItem,
  type Front,
  type FrontHandle,
  type HardwareItem,
  type ModuleHardware,
  type ZoneBounds,
} from "../../../core/model"
import type { KitOrder } from "../../../core/build/buildModule"
import { handleSpec } from "../../../core/build/hardware"
import { NumRow } from "../../../components/NumRow"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { HardwarePick } from "../HardwarePick"
import { DrawerHeights, DrawerSlides, KitFields } from "./DrawerFields"
import { GrillePatternFields } from "../GrillePatternFields"
import { fmtNum } from "../../../lib/format"

/** El front amb el seu ferratge (una còpia) o, sense, amb el del mòdul (el camp fora). */
function withHardware<F extends Extract<Front, { kind: "door" | "drawers" | "flap" }>>(front: F, item: HardwareItem | undefined): F {
  if (item) return { ...front, hardware: item }
  const { hardware: _h, ...rest } = front
  return rest as F
}

/** El tirador propi d'un front: sense (`undefined`), el del mòdul; «Cap (push)» (`"none"`); o una còpia d'un item. */
function withHandle<F extends Extract<Front, { kind: "door" | "drawers" | "flap" }>>(front: F, item: FrontHandle | undefined): F {
  if (item) return { ...front, handle: item }
  const { handle: _h, ...rest } = front
  return rest as F
}

/**
 * Un calaix amb joc: el tancament del joc i el tirador són **una sola dada**. Triar «Cap (push)» posa el joc a push-open
 * (`pushSoft` si el joc el té i el tancament era suau, si no `push`); triar un tirador el torna a suau.
 */
function kitClosingFor(kit: HardwareItem & { kit: NonNullable<HardwareItem["kit"]> }, current: ReturnType<typeof kitOptionsOf>, push: boolean): ReturnType<typeof kitOptionsOf> {
  const opts = kit.kit.options.closing
  if (push) return isPushClosing(current.closing) ? current : { ...current, closing: opts.includes("pushSoft") ? "pushSoft" : opts.includes("push") ? "push" : current.closing }
  return isPushClosing(current.closing) ? { ...current, closing: opts.includes("soft") ? "soft" : current.closing } : current
}

export function FrontFields({ front, openRatio, drawerHeights, onChange, hardware, noHandles, kits, bounds, afterHinge, noMode = false }: { front: Front; openRatio?: number; drawerHeights?: number[]; onChange: (f: Front) => void; hardware: ModuleHardware; noHandles: boolean; kits?: KitOrder[]; bounds: ZoneBounds; /** La filera System 32 del mòdul (placa de la frontissa), si surt aquí. */ afterHinge?: ReactNode; /** Una o dues portes ja es tria a dalt (Mòdul › Portes): la fila «Portes» no surt. */ noMode?: boolean }) {
  // «Tirador»: el del mòdul («Com el mòdul»), un altre de la biblioteca (un d'importat i confirmat fa els
  // forats a la seva distància) o «Cap (push)». Als calaixos amb joc, el tancament del joc mana (`kitClosingFor`).
  const handlePick = (f: Extract<Front, { kind: "door" | "drawers" | "flap" }>, kit?: HardwareItem & { kit: NonNullable<HardwareItem["kit"]> }) => {
    const handleId = f.kind === "door" ? "zone.front.door.handle" : f.kind === "drawers" ? "zone.front.drawers.handle" : "zone.front.flap.handle"
    const kitOpts = kit && f.kind === "drawers" ? kitOptionsOf(kit.kit, f.kit) : undefined
    const kitPush = !!kitOpts && isPushClosing(kitOpts.closing)
    const push = kitPush || f.handle === "none" || (!f.handle && noHandles)
    const inheritedNone = !f.handle && noHandles && !kitPush
    const setHandle = (h: FrontHandle | undefined) => {
      const next = withHandle(f, h)
      // Amb joc: el tancament segueix la tria (push ⇔ cap tirador) i el front no guarda «none» (el joc ja ho diu).
      if (kit && kitOpts && next.kind === "drawers") onChange({ ...withHandle(next, h === "none" ? undefined : h), kit: kitClosingFor(kit, kitOpts, h === "none") })
      else onChange(next)
    }
    const help = kitPush ? "La guia de calaix ja porta el sistema push (push-open): no cal cap Tip-On, ni tirador ni forats. Per posar-hi un tirador, canvia el Tancament a les Opcions de la guia de calaix." : inheritedNone ? "El mòdul és push: cap forat; tria'n un aquí si aquest front n'ha de portar." : "Obertura per pressió: cap forat. Cal el ferratge push (Tip-On) a aquest front."
    return (
      <HardwarePick
        optionId={handleId}
        slot="handle"
        label="Tirador"
        glass={(f.kind === "door" || f.kind === "flap") && !!f.glass}
        current={f.handle && f.handle !== "none" ? f.handle : push ? undefined : moduleSlotItem(hardware, "handle")}
        inherited={noHandles ? undefined : moduleSlotItem(hardware, "handle")}
        emptyLabel={noHandles ? "Com el mòdul (cap, push)" : undefined}
        none={{ label: "Cap (push)", help, selected: push && !inheritedNone, onPick: () => setHandle("none") }}
        onPick={(h) => setHandle(h)}
      />
    )
  }
  switch (front.kind) {
    case "door":
      // Un camp per fila: dos grups de botons no hi caben de costat a l'inspector.
      return (
        <Stack gap={3}>
          {!noMode && <FormRow optionId="zone.front.door.mode" label="Portes">
            <ChoiceChips
              label="Portes"
              value={front.mode}
              // Dues portes: frontisses als dos costats (cal un lateral o un divisor a cada un).
              options={[
                { id: "single", label: <><LuDoorClosed /> Una</> },
                ...(bounds.left && bounds.right || front.mode === "double" ? [{ id: "double" as const, label: <><LuFlipHorizontal2 /> Dues</> }] : []),
              ]}
              onChange={(mode) => onChange({ ...front, mode })}
            />
          </FormRow>}
          {front.mode === "single" && (
            <FormRow optionId="zone.front.door.hingeSide" label="Frontisses">
              {/* Pastilles: «Esquerra» amb icona no cap en mig control segmentat. */}
              <ChoiceChips
                label="Frontisses"
                value={front.hinge}
                // Només els costats on hi ha un lateral o un divisor per a les plaques (i el triat, si ja no n'hi ha).
                options={[
                  ...(bounds.left || front.hinge === "left" ? [{ id: "left" as const, label: <><LuPanelLeft /> Esquerra</> }] : []),
                  ...(bounds.right || front.hinge === "right" ? [{ id: "right" as const, label: <><LuPanelRight /> Dreta</> }] : []),
                ]}
                onChange={(hinge) => onChange({ ...front, hinge })}
              />
            </FormRow>
          )}
          <FormRow optionId="zone.front.door.glass" label="Vitrina" help={front.glass ? "Marc de perfil d'alumini (el triat a «Marc») i vidre; la frontissa i el tirador es trien a sota. No és de CNC: surt a Peces, a «Elements sense nesting», amb les mides per demanar-ho." : undefined}>
            <Switch.Root size="sm" pt="6px" checked={!!front.glass} onCheckedChange={(e) => onChange({ ...front, glass: e.checked || undefined })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Porta de vidre amb marc</Switch.Label>
            </Switch.Root>
          </FormRow>
          {/* La de vidre porta el marc d'alumini (ferratge `glassFrame`); la frontissa i el tirador es trien igual que a les
              de fusta (per decisió de l'usuari): al perfil no es mecanitza res, la placa de la frontissa sí, al lateral. */}
          {front.glass && <HardwarePick optionId="zone.front.door.frame" slot="glassFrame" label="Marc" current={front.frame ?? moduleSlotItem(hardware, "glassFrame")} inherited={moduleSlotItem(hardware, "glassFrame")} onPick={(h) => onChange(h ? { ...front, frame: h } : (({ frame: _f, ...rest }) => rest)(front))} />}
          <HardwarePick optionId="zone.front.door.hinge" slot="hinge" glass={!!front.glass} current={front.hardware ?? (front.glass ? undefined : hardware.hinge)} inherited={hardware.hinge} help={front.glass ? "A la porta de vidre, les frontisses per a marc d'alumini (Metallamat A, Duomatic): es claven al perfil i només es mecanitzen els forats de la placa al lateral." : undefined} onPick={(h) => onChange(withHardware(front, h))} />
          {!front.glass && afterHinge}
          {handlePick(front)}
        </Stack>
      )
    case "drawers":
      return (
        <Stack gap={3}>
          <NumRow optionId="zone.front.drawers.count" label="Calaixos" help={isDrawerKit(front.hardware ?? hardware.slide) ? "Calaixos del joc de doble paret (sense laterals de fusta), amb la llargada nominal més gran que hi cap." : "Caixa de fusta amb la guia de la llargada més gran que hi cap."} suffix="u" value={front.n} min={1} max={10} step={1} onChange={(n) => {
            if (!Number.isFinite(n)) return
            const k = Math.max(1, Math.min(10, Math.round(n)))
            // L'última sempre és el que sobra («auto»), com a la Divisió.
            onChange({ ...front, n: k, heights: Array.from({ length: k }, (_, i) => (i === k - 1 ? "auto" : (front.heights[i] ?? "auto"))) })
          }} />
          {/* Cada tria amb les seves opcions plegades a sota (per decisió de l'usuari, 2026-10-13: «cada un té les seves
              opcions, no les ajuntis»): Calaixos › alçades, Guia › joc, Tirador › posició. */}
          {front.n > 1 && (
            <FoldItem optionId="zone.front.drawers.heights" id="zone-drawer-heights" title="Alçada dels calaixos" icon={LuSettings2} size="sm" badge={front.heights.slice(0, front.n - 1).some((h) => h !== "auto") ? "Alçades a mida" : "Alçades iguals"}>
              <DrawerHeights front={front} real={drawerHeights} onChange={onChange} />
            </FoldItem>
          )}
          {/* Front de vidre (per petició de l'usuari, 2026-10-20): marc de fusta d'una peça amb el vidre al galze. */}
          <FormRow optionId="zone.front.drawers.glass" label="Vidre" help={front.glass ? "Marc d'una peça de fusta amb la finestra calada i un vidre de 4 mm al galze de darrere. El tirador va al travesser de dalt." : undefined}>
            <Switch.Root size="sm" pt="6px" checked={!!front.glass} onCheckedChange={(e) => onChange(e.checked ? { ...front, glass: true } : (({ glass: _g, ...rest }) => rest)(front))}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Front de vidre</Switch.Label>
            </Switch.Root>
          </FormRow>
          <HardwarePick optionId="zone.front.drawers.slide" slot="slide" label={perDrawerSlides(front, front.hardware ?? hardware.slide) ? "Guia del calaix 1" : undefined} current={front.hardware ?? hardware.slide} inherited={hardware.slide} onPick={(h) => onChange(withHardware(front, h))} />
          {/* Amb un joc de calaix, la guia de cada un dels altres calaixos (els de sobre segueixen el de sota). */}
          {perDrawerSlides(front, front.hardware ?? hardware.slide) && <DrawerSlides front={front} kits={kits} onChange={onChange} />}
          {/* Un joc de calaix, triat aquí o com a guia del mòdul: les opcions del joc. */}
          {(() => {
            const slide = front.hardware ?? hardware.slide
            const kit = isDrawerKit(slide) ? slide : undefined
            // On va el tirador: només si n'hi ha (push: cap forat, no surt).
            const hasHandle = !((kit && isPushClosing(kitOptionsOf(kit.kit, front.kit).closing)) || front.handle === "none" || (!front.handle && noHandles))
            return (
              <>
                {kit && (
                  <FoldItem optionId="zone.front.drawers.kit" id="zone-kit" title="Opcions de la guia de calaix" icon={LuSettings2} size="sm" badge={KIT_CLOSINGS.find((x) => x.id === kitOptionsOf(kit.kit, front.kit).closing)?.short}>
                    <KitFields front={front} kit={kit} kits={kits} onChange={onChange} />
                  </FoldItem>
                )}
                {handlePick(front, kit)}
                {hasHandle && (
                  <FoldItem optionId="zone.front.drawers.handleOptions" id="zone-handle" title="Opcions del tirador" icon={LuSettings2} size="sm" badge={front.handleTop !== undefined || front.glass ? `A dalt · ${front.handleTop ?? GLASS_HANDLE_TOP} mm` : "Centrat"}>
                    <FormRow optionId="zone.front.drawers.handlePosition" label="Posició del tirador">
                      <ChoiceChips
                        label="Posició del tirador"
                        value={front.handleTop !== undefined || front.glass ? "top" : "center"}
                        // Amb vidre, el tirador va al travesser de dalt (el mig és la finestra): «Centrat» no surt.
                        options={[
                          ...(front.glass ? [] : [{ id: "center" as const, label: "Centrat" }]),
                          { id: "top" as const, label: "A dalt" },
                        ]}
                        onChange={(v) => onChange(v === "top" ? { ...front, handleTop: 40 } : (({ handleTop: _t, ...rest }) => rest)(front))}
                      />
                    </FormRow>
                    {(front.handleTop !== undefined || front.glass) && (
                      <NumRow optionId="zone.front.drawers.handleTop" label="Des de dalt" value={front.handleTop ?? GLASS_HANDLE_TOP} min={0} max={1000} step={5} onChange={(handleTop) => Number.isFinite(handleTop) && onChange({ ...front, handleTop })} help={front.glass ? "Del cantell de dalt del front a l'eix del tirador, al travesser de dalt del marc." : "Del cantell de dalt del front a l'eix del tirador. Com a molt, el mig del front."} />
                    )}
                  </FoldItem>
                )}
              </>
            )
          })()}
        </Stack>
      )
    case "flap":
      return (
        <Stack gap={3}>
          <FormRow optionId="zone.front.flap.dir" label="Obre cap a">
            <ChoiceChips
              label="Obre cap a"
              value={front.dir}
              options={[
                { id: "down", label: <><LuArrowDownToLine /> Avall</> },
                { id: "up", label: <><LuArrowUpToLine /> Amunt</> },
              ]}
              onChange={(dir) => onChange({ ...front, dir })}
            />
          </FormRow>
          <FormRow optionId="zone.front.flap.glass" label="Vitrina" help={front.glass ? "Marc de perfil d'alumini i vidre, com la porta de vidre; el braç i el tirador es trien a sota. No és de CNC: surt a Peces, a «Elements sense nesting»." : undefined}>
            <Switch.Root size="sm" pt="6px" checked={!!front.glass} onCheckedChange={(e) => onChange({ ...front, glass: e.checked || undefined })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Abatible de vidre amb marc</Switch.Label>
            </Switch.Root>
          </FormRow>
          {front.glass && <HardwarePick optionId="zone.front.flap.frame" slot="glassFrame" label="Marc" current={front.frame ?? moduleSlotItem(hardware, "glassFrame")} inherited={moduleSlotItem(hardware, "glassFrame")} onPick={(h) => onChange(h ? { ...front, frame: h } : (({ frame: _f, ...rest }) => rest)(front))} />}
          <HardwarePick optionId="zone.front.flap.arm" slot="flap" current={front.hardware ?? hardware.flap} inherited={hardware.flap} help={front.glass ? "A l'abatible de vidre, el braç es fixa al perfil amb l'adaptador (Häfele 563.25.960): cap forat al tauler." : undefined} onPick={(h) => onChange(withHardware(front, h))} />
          {handlePick(front)}
          {/* Només la distància al cantell que obre (el tirador va centrat de costat a costat). Push: no surt. */}
          {!front.glass && !(front.handle === "none" || (!front.handle && noHandles)) && (() => {
            const item = typeof front.handle === "object" ? front.handle : moduleSlotItem(hardware, "handle")
            const own = (() => {
              try {
                return handleSpec(item).inset
              } catch {
                return undefined
              }
            })()
            const value = front.handleInset ?? own ?? 0
            return (
              <FoldItem optionId="zone.front.flap.handleOptions" id="zone-flap-handle" title="Opcions del tirador" icon={LuSettings2} size="sm" badge={`${fmtNum(value)} mm del cantell`}>
                <NumRow
                  optionId="zone.front.flap.handleInset"
                  label="Des del cantell"
                  value={value}
                  min={0}
                  max={1000}
                  step={5}
                  onChange={(v) => Number.isFinite(v) && onChange(v === own ? (({ handleInset: _i, ...rest }) => rest)(front) : { ...front, handleInset: v })}
                  help={`Del cantell que obre a l'eix del tirador. ${own !== undefined ? `La del tirador: ${fmtNum(own)} mm.` : ""} Com a molt, el mig de l'abatible.`}
                />
              </FoldItem>
            )
          })()}
        </Stack>
      )
    case "grille": {
      const p = front.pattern
      return (
        <Stack gap={3}>
          {/* Una fila per camp: el panell és estret i les opcions són llargues. */}
          <FormRow optionId="zone.front.grille.mount" label="Muntatge">
            {/* Pastilles: «Frontisses» amb icona no cap en mig control segmentat. */}
            <ChoiceChips
              label="Muntatge"
              value={front.mount}
              // Amb frontisses, a un lateral o a un divisor (i la triada, si ja no n'hi ha).
              options={[
                { id: "removable", label: <><LuMagnet /> Imants</> },
                ...(bounds.left || bounds.right || front.mount === "hinged" ? [{ id: "hinged" as const, label: <><LuDoorOpen /> Frontisses</> }] : []),
              ]}
              onChange={(mount) => onChange(mount === "hinged" && !bounds[front.hinge] ? { ...front, mount, hinge: front.hinge === "left" ? "right" : "left" } : { ...front, mount })}
            />
          </FormRow>
          {/* Amb frontisses (les del mòdul): el costat, com a la porta (només on hi ha un lateral o un divisor), i la
              filera de la placa. */}
          {front.mount === "hinged" && (
            <FormRow optionId="zone.front.grille.hingeSide" label="Frontisses" help="La frontissa és la del mòdul (Preferències › Ferratges).">
              <ChoiceChips
                label="Frontisses"
                value={front.hinge}
                options={[
                  ...(bounds.left || front.hinge === "left" ? [{ id: "left" as const, label: <><LuPanelLeft /> Esquerra</> }] : []),
                  ...(bounds.right || front.hinge === "right" ? [{ id: "right" as const, label: <><LuPanelRight /> Dreta</> }] : []),
                ]}
                onChange={(hinge) => onChange({ ...front, hinge })}
              />
            </FormRow>
          )}
          {front.mount !== "removable" && afterHinge}
          <GrillePatternFields pattern={p} onChange={(pattern) => onChange({ ...front, pattern })} ids={{ pattern: "zone.front.grille.pattern", holes: "zone.front.grille.holes", slots: "zone.front.grille.slots", margin: "zone.front.grille.margin" }} />
          {openRatio !== undefined && (
            <Text fontSize="sm" color={openRatio < 0.4 ? "fg.error" : "fg.muted"}>
              Àrea oberta: {Math.round(openRatio * 100)} % {openRatio < 0.4 ? "(per sota del 40 % recomanat)" : ""}
            </Text>
          )}
          <FormRow optionId="zone.front.grille.hatch" label="Trapa">
            <Switch.Root
              size="sm"
              pt="6px"
              checked={!!front.hatch}
              onCheckedChange={(e) => onChange({ ...front, hatch: e.checked ? { x: 100, y: 100, w: 150, h: 150 } : undefined })}
            >
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Trapa petita (clau del radiador)</Switch.Label>
            </Switch.Root>
          </FormRow>
          {front.hatch && (
            <>
              <NumRow optionId="zone.front.grille.hatchSize" label="Trapa X" value={front.hatch.x} min={0} max={3000} step={10} onChange={(x) => onChange({ ...front, hatch: { ...front.hatch!, x } })} />
              <NumRow optionId="zone.front.grille.hatchSize" label="Trapa Y" value={front.hatch.y} min={0} max={3000} step={10} onChange={(y) => onChange({ ...front, hatch: { ...front.hatch!, y } })} />
              <NumRow optionId="zone.front.grille.hatchSize" label="Amplada" value={front.hatch.w} min={50} max={600} step={10} onChange={(w) => onChange({ ...front, hatch: { ...front.hatch!, w } })} />
              <NumRow optionId="zone.front.grille.hatchSize" label="Alçada" value={front.hatch.h} min={50} max={600} step={10} onChange={(h) => onChange({ ...front, hatch: { ...front.hatch!, h } })} />
            </>
          )}
          {/* Després de Muntatge i Trapa (en depèn: opcions en cascada). */}
          {/* L'imant (reixeta desmuntable i trapa): el del mòdul o un altre de la biblioteca. */}
          {(front.mount === "removable" || front.hatch) && <HardwarePick optionId="zone.front.grille.magnet" slot="magnet" current={front.hardware ?? hardware.magnet} inherited={hardware.magnet} onPick={(h) => onChange(h ? { ...front, hardware: h } : (({ hardware: _h, ...rest }) => rest)(front))} />}
        </Stack>
      )
    }
    case "panel":
      // La retirada (per decisió de l'usuari, 2026-10-20): el sòcol d'un moble és una zona amb un front fix retirat.
      return (
        <Stack gap={3}>
          <NumRow optionId="zone.front.panel.setback" label="Retirada" value={front.setback ?? 0} min={0} max={300} step={1} suffix="mm" onChange={(v) => Number.isFinite(v) && v >= 0 && onChange(v ? { ...front, setback: v } : { kind: "panel" })} help="0: com els altres fronts. Més: dins de la llum, amb la folgança a cada costat, i retirat del davant de la caixa (un sòcol)." />
        </Stack>
      )
  }
}
