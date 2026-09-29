import { Button, Field, HStack, IconButton, Menu, NativeSelect, Portal, SegmentGroup, SimpleGrid, Stack, Switch, Text } from "@chakra-ui/react"
import { LuArrowUp, LuCopy, LuEllipsis, LuColumns2, LuRows2, LuPlus, LuRows3, LuRuler, LuSquareSplitHorizontal, LuSquareSplitVertical, LuTrash2, LuUngroup } from "react-icons/lu"
import { PanelSection } from "../../components/PanelSection"
import {
  DEFAULT_GRILLE,
  addChild,
  duplicateZone,
  parentOf,
  removeZone,
  setChildSize,
  setFront,
  setShelves,
  splitZone,
  unsplitZone,
  type Front,
  type Zone,
} from "../../core/model"
import { NumberField } from "../editor/ParamsForm"
import { FRONT_ICONS } from "./zoneIcon"

const FRONT_LABELS: Record<Front["kind"] | "none", string> = {
  none: "Obert",
  door: "Porta",
  drawers: "Calaixos",
  flap: "Abatible",
  grille: "Reixeta",
  panel: "Front fix",
}

function defaultFront(kind: Front["kind"]): Front {
  switch (kind) {
    case "door":
      return { kind, mode: "single", hinge: "left" }
    case "drawers":
      return { kind, n: 3, heights: ["auto", "auto", "auto"] }
    case "flap":
      return { kind, dir: "down" }
    case "grille":
      return { kind, pattern: DEFAULT_GRILLE, mount: "removable", hinge: "left" }
    case "panel":
      return { kind }
  }
}

/**
 * Accions de la zona seleccionada (van a la capçalera de l'inspector, com a icones):
 * pujar al pare, duplicar (al costat o a sobre) i eliminar.
 */
export function ZoneActions({ root, zone, onChange, onSelect }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; onSelect: (id: string) => void }) {
  const parent = parentOf(root, zone.id)
  const duplicate = (dir: "v" | "h") => {
    const r = duplicateZone(root, zone.id, dir)
    onChange(r.root)
    if (r.copyId) onSelect(r.copyId)
  }
  // Un sol botó ⋯ amb totes les accions: la capçalera queda neta.
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton size="xs" variant="ghost" aria-label="Accions del compartiment">
          <LuEllipsis />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {parent && (
              <Menu.Item value="parent" onClick={() => onSelect(parent.id)}>
                <LuArrowUp /> Seleccionar el pare
              </Menu.Item>
            )}
            <Menu.Item value="v" onClick={() => duplicate("v")}>
              <LuCopy /> Duplicar al costat
            </Menu.Item>
            <Menu.Item value="h" onClick={() => duplicate("h")}>
              <LuCopy /> Duplicar a sobre
            </Menu.Item>
            {parent && (
              <>
                <Menu.Separator />
                <Menu.Item value="del" color="fg.error" onClick={() => onChange(removeZone(root, zone.id))}>
                  <LuTrash2 /> Eliminar
                </Menu.Item>
              </>
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

/** Panell d'edició de la zona seleccionada: dividir, contingut, mida, eliminar. */
export function ZonePanel({
  root,
  zone,
  openRatio,
  onChange,
}: {
  root: Zone
  zone: Zone
  /** % d'àrea oberta si la zona té reixeta. */
  openRatio?: number
  onChange: (root: Zone) => void
}) {
  const parent = parentOf(root, zone.id)
  const index = parent?.split ? parent.split.children.findIndex((c) => c.id === zone.id) : -1
  const size = parent?.split ? (parent.split.sizes[index] ?? "auto") : undefined

  const sizeField = parent?.split && size !== undefined && (
    <PanelSection id="zone-size" title={parent.split.dir === "v" ? "Amplada" : "Alçada"} icon={LuRuler} badge={size === "auto" ? "Auto" : `${size} mm`}>
      <Switch.Root size="sm" checked={size === "auto"} onCheckedChange={(e) => onChange(setChildSize(root, parent.id, index, e.checked ? "auto" : 400))}>
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label>Automàtica</Switch.Label>
      </Switch.Root>
      {size !== "auto" && <NumberField label="" value={size} min={50} max={3000} step={10} onChange={(v) => onChange(setChildSize(root, parent.id, index, v))} />}
      <Text textStyle="xs" color="fg.muted">
        {parent.split.dir === "v" ? "Amplada" : "Alçada"} de la llum. Les automàtiques es reparteixen el que queda.
      </Text>
    </PanelSection>
  )

  return (
    <Stack gap={0}>

      {zone.split ? (
        <>
          <PanelSection id="zone-split" title={`Divisió ${zone.split.dir === "v" ? "vertical" : "horitzontal"}`} badge={`${zone.split.children.length} zones`} icon={zone.split.dir === "v" ? LuColumns2 : LuRows2}>
            <Text fontSize="sm" color="fg.muted">
              Toca una zona a l'estructura o al dibuix per editar-la.
            </Text>
            <HStack wrap="wrap">
              <Button size="sm" variant="outline" onClick={() => onChange(addChild(root, zone.id))}>
                <LuPlus /> Afegir zona
              </Button>
              <Button size="sm" variant="outline" onClick={() => onChange(unsplitZone(root, zone.id))}>
                <LuUngroup /> Treure la divisió
              </Button>
            </HStack>
          </PanelSection>
          {sizeField}
        </>
      ) : (
        <>
          <PanelSection id="zone-front" title="Front" badge={FRONT_LABELS[zone.front?.kind ?? "none"]} icon={FRONT_ICONS[zone.front?.kind ?? "none"]}>
            <Field.Root>
              <Field.Label>Tipus</Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={zone.front?.kind ?? "none"}
                  onChange={(e) => {
                    const k = e.target.value as Front["kind"] | "none"
                    onChange(setFront(root, zone.id, k === "none" ? null : defaultFront(k)))
                  }}
                >
                  {(Object.keys(FRONT_LABELS) as (Front["kind"] | "none")[]).map((k) => (
                    <option key={k} value={k}>
                      {FRONT_LABELS[k]}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            {zone.front && <FrontFields front={zone.front} openRatio={openRatio} onChange={(f) => onChange(setFront(root, zone.id, f))} />}
          </PanelSection>

          {zone.front?.kind !== "drawers" && (
            <PanelSection id="zone-shelves" title="Prestatges" badge={zone.shelves?.n || undefined} icon={LuRows3}>
              <NumberField
                label="Quantitat"
                suffix="u"
                value={zone.shelves?.n ?? 0}
                min={0}
                max={20}
                step={1}
                onChange={(n) => onChange(setShelves(root, zone.id, n > 0 || zone.shelves ? { n: Math.max(0, n), adjustable: zone.shelves?.adjustable ?? true } : null))}
              />
              <Switch.Root size="sm" checked={zone.shelves?.adjustable ?? true} onCheckedChange={(e) => onChange(setShelves(root, zone.id, { n: zone.shelves?.n ?? 0, adjustable: e.checked }))}>
                <Switch.HiddenInput />
                <Switch.Control />
                <Switch.Label>Regulables</Switch.Label>
              </Switch.Root>
              {(zone.shelves?.adjustable ?? true) && (
                <Text textStyle="xs" color="fg.muted">
                  Forats System 32 als laterals per moure'ls.
                </Text>
              )}
            </PanelSection>
          )}

          {sizeField}

          <PanelSection id="zone-divide" title="Dividir" icon={LuSquareSplitHorizontal} defaultOpen={false}>
            <Text textStyle="xs" color="fg.muted">
              Parteix aquest compartiment en dos. El contingut es queda al primer.
            </Text>
            <HStack wrap="wrap">
              <Button size="sm" variant="outline" onClick={() => onChange(splitZone(root, zone.id, "v", 2))}>
                <LuSquareSplitHorizontal /> En vertical
              </Button>
              <Button size="sm" variant="outline" onClick={() => onChange(splitZone(root, zone.id, "h", 2))}>
                <LuSquareSplitVertical /> En horitzontal
              </Button>
            </HStack>
          </PanelSection>
        </>
      )}
    </Stack>
  )
}

function FrontFields({ front, openRatio, onChange }: { front: Front; openRatio?: number; onChange: (f: Front) => void }) {
  switch (front.kind) {
    case "door":
      // Un camp per fila: dos grups de botons no hi caben de costat a l'inspector.
      return (
        <Stack gap={3}>
          <Field.Root>
            <Field.Label>Portes</Field.Label>
            <SegmentGroup.Root size="sm" w="full" value={front.mode} onValueChange={(e) => onChange({ ...front, mode: e.value as "single" | "double" })}>
              <SegmentGroup.Indicator />
              <SegItem value="single" label="Una" />
              <SegItem value="double" label="Dues" />
            </SegmentGroup.Root>
          </Field.Root>
          {front.mode === "single" && (
            <Field.Root>
              <Field.Label>Frontisses</Field.Label>
              <SegmentGroup.Root size="sm" w="full" value={front.hinge} onValueChange={(e) => onChange({ ...front, hinge: e.value as "left" | "right" })}>
                <SegmentGroup.Indicator />
                <SegItem value="left" label="Esquerra" />
                <SegItem value="right" label="Dreta" />
              </SegmentGroup.Root>
            </Field.Root>
          )}
        </Stack>
      )
    case "drawers":
      return (
        <Stack gap={3}>
          <NumberField label="Calaixos" suffix="u" value={front.n} min={1} max={10} step={1} onChange={(n) => onChange({ ...front, n: Math.max(1, Math.min(10, Math.round(n))), heights: Array.from({ length: n }, (_, i) => front.heights[i] ?? "auto") })} />
          <Text fontSize="xs" color="fg.muted">
            Alçades de front: auto (iguals). Caixa amb guia genèrica de la llargada més gran que hi cap.
          </Text>
        </Stack>
      )
    case "flap":
      return (
        <Field.Root>
          <Field.Label>Obre cap a</Field.Label>
          <SegmentGroup.Root size="sm" w="full" value={front.dir} onValueChange={(e) => onChange({ ...front, dir: e.value as "down" | "up" })}>
            <SegmentGroup.Indicator />
            <SegItem value="down" label="Avall" />
            <SegItem value="up" label="Amunt" />
          </SegmentGroup.Root>
        </Field.Root>
      )
    case "grille": {
      const p = front.pattern
      const setP = (patch: Partial<typeof p>) => onChange({ ...front, pattern: { ...p, ...patch } })
      return (
        <Stack gap={3}>
          {/* Una fila per camp: el panell és estret i les opcions són llargues. */}
          <Field.Root>
            <Field.Label>Patró</Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field value={p.kind} onChange={(e) => setP({ kind: e.target.value as typeof p.kind })}>
                <option value="slotsV">Ranures verticals</option>
                <option value="slotsH">Ranures horitzontals</option>
                <option value="holes">Forats al tresbolillo</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          <Field.Root>
            <Field.Label>Muntatge</Field.Label>
            <SegmentGroup.Root size="sm" w="full" value={front.mount} onValueChange={(e) => onChange({ ...front, mount: e.value as "removable" | "hinged" })}>
              <SegmentGroup.Indicator />
              <SegItem value="removable" label="Imants" />
              <SegItem value="hinged" label="Frontisses" />
            </SegmentGroup.Root>
          </Field.Root>

          <SimpleGrid columns={3} gap={3}>
            {p.kind === "holes" ? (
              <>
                <NumberField label="Ø forat" value={p.holeDiameter} min={3} max={60} step={1} onChange={(holeDiameter) => setP({ holeDiameter })} />
                <NumberField label="Pas" value={p.holePitch} min={4} max={120} step={1} onChange={(holePitch) => setP({ holePitch })} />
              </>
            ) : (
              <>
                <NumberField label="Ranura" value={p.slotWidth} min={3} max={60} step={1} onChange={(slotWidth) => setP({ slotWidth })} />
                <NumberField label="Separació" value={p.slotGap} min={3} max={100} step={1} onChange={(slotGap) => setP({ slotGap })} />
              </>
            )}
            <NumberField label="Marge" value={p.margin} min={10} max={200} step={5} onChange={(margin) => setP({ margin })} />
          </SimpleGrid>
          {openRatio !== undefined && (
            <Text fontSize="sm" color={openRatio < 0.4 ? "fg.error" : "fg.muted"}>
              Àrea oberta: {Math.round(openRatio * 100)} % {openRatio < 0.4 ? "(per sota del 40 % recomanat)" : ""}
            </Text>
          )}
          <Switch.Root
            size="sm"
            checked={!!front.hatch}
            onCheckedChange={(e) => onChange({ ...front, hatch: e.checked ? { x: 100, y: 100, w: 150, h: 150 } : undefined })}
          >
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>Trapa petita (clau del radiador)</Switch.Label>
          </Switch.Root>
          {front.hatch && (
            <SimpleGrid columns={2} gap={3}>
              <NumberField label="X" value={front.hatch.x} min={0} max={3000} step={10} onChange={(x) => onChange({ ...front, hatch: { ...front.hatch!, x } })} />
              <NumberField label="Y" value={front.hatch.y} min={0} max={3000} step={10} onChange={(y) => onChange({ ...front, hatch: { ...front.hatch!, y } })} />
              <NumberField label="Ample" value={front.hatch.w} min={50} max={600} step={10} onChange={(w) => onChange({ ...front, hatch: { ...front.hatch!, w } })} />
              <NumberField label="Alt" value={front.hatch.h} min={50} max={600} step={10} onChange={(h) => onChange({ ...front, hatch: { ...front.hatch!, h } })} />
            </SimpleGrid>
          )}
        </Stack>
      )
    }
    case "panel":
      return null
  }
}

function SegItem({ value, label }: { value: string; label: string }) {
  return (
    <SegmentGroup.Item value={value} flex={1} justifyContent="center">
      <SegmentGroup.ItemText>{label}</SegmentGroup.ItemText>
      <SegmentGroup.ItemHiddenInput />
    </SegmentGroup.Item>
  )
}
