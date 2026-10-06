import { Box, Button, HStack, IconButton, Menu, Portal, Stack, Text } from "@chakra-ui/react"
import { segGroup, segItem } from "../../components/segmented"
import { useState, type ReactNode } from "react"
import { ProfileEditor } from "./ProfileEditor"
import type { IconType } from "react-icons"
import { IconChoice, type IconOption } from "../../components/IconChoice"
import { LuBox, LuCylinder, LuMoveDiagonal2, LuMoveHorizontal, LuMoveVertical, LuScissors, LuShield, LuSpline, LuArrowDownToLine, LuBrickWall, LuBookmark, LuCopy, LuEllipsis, LuMove, LuMoveDiagonal, LuPencilRuler, LuLink, LuPalette, LuTrash2 } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { toaster } from "../../components/ui/toaster"
import { AXIS_INDEX, SECTION_AXES, anchorRef, insertRefCopy, toNodes, newId, type Composition, type RefObject } from "../../core/model"
import { NumRow } from "../../components/NumRow"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { useSettings } from "../settings/SettingsContext"
import { MaterialSelect } from "../settings/MaterialSelect"

/** Propietats d'un objecte de referència (fantasma): nom, mides i posició. */
export function RefInspector({ comp, id, onChange }: { comp: Composition; id: string; onChange: (c: Composition) => void }) {
  const [editing, setEditing] = useState(false)
  const { settings } = useSettings()
  const o = comp.references.find((r) => r.id === id)
  if (!o) return null
  const update = (patch: Partial<RefObject>) => onChange({ ...comp, references: comp.references.map((r) => (r.id === id ? anchorRef({ ...r, ...patch }) : r)) })
  // Mateix patró que la peça lliure: accions a la capçalera (RefActions) i una secció per apartat (sense «General»).
  const shape = o.shape ?? "box"
  const axis = (o.axis ?? "z") as Axis
  const axisOpt = AXIS_OPTIONS.find((a) => a.value === axis)!
  // La direcció: la del cilindre i el perfil, o la del tall d'una caixa que talla.
  const oriented = shape !== "box" || o.effect === "cut"
  const shapeOpt = SHAPE_OPTIONS.find((s) => s.id === shape)!
  const attached = o.onFloor && o.onWall ? "Terra i paret" : o.onFloor ? "Al terra" : o.onWall ? "A la paret" : "Res"
  return (
    <Stack gap={0}>
      <FoldItem id="ref-effect" title="Efecte" icon={o.effect === "cut" ? LuScissors : LuShield} badge={o.effect === "cut" ? "Talla" : "Obstacle"}>
        <FormRow
          label="Efecte"
          help={
            o.effect === "cut"
              ? "Fa un forat passant a cada peça que travessa (tub, endoll, passacables…). Si el mous, el forat el segueix; surt al nesting, al DXF i al STEP."
              : "Obstacle: no forma part del moble, es veu translúcid per comprovar que tot hi cap i avisa si xoca amb alguna peça."
          }
        >
          <ChoiceChips
            label="Efecte"
            value={o.effect ?? "obstacle"}
            options={[
              { id: "obstacle", label: <><LuShield /> Obstacle</> },
              { id: "cut", label: <><LuScissors /> Talla</> },
            ]}
            onChange={(v) => update({ effect: v === "cut" ? "cut" : undefined })}
          />
        </FormRow>
      </FoldItem>
      <FoldItem id="ref-shape" title="Forma" icon={shapeOpt.icon} badge={shapeOpt.name}>
        <FormRow label="Forma">
          {/* Pastilles que salten de línia: tres opcions amb icona no hi caben en un segmentat. */}
          <Stack gap={2}>
            <ChoiceChips
              label="Forma"
              value={shape}
              options={SHAPE_OPTIONS}
              onChange={(v) => {
                if (v === "cylinder") update(cylinderPatch(o, o.axis ?? "z"))
                else if (v === "profile") {
                  update(profilePatch(o))
                  setEditing(true)
                } else update({ shape: undefined, axis: undefined, profile: undefined })
              }}
            />
            {o.shape === "profile" && (
              <Button size="xs" variant="outline" alignSelf="flex-start" onClick={() => setEditing(true)}>
                <LuPencilRuler /> Editar la forma…
              </Button>
            )}
          </Stack>
        </FormRow>
      </FoldItem>
      {oriented && (
        <FoldItem id="ref-orient" title="Orientació" icon={axisOpt.icon} badge={axisOpt.label}>
          {o.shape === "profile" ? (
            <FormRow label="Direcció">
              <IconChoice label="Direcció" hideLabel value={axis} options={AXIS_OPTIONS} onChange={(a) => update(profileAxisPatch(o, a))} />
            </FormRow>
          ) : o.shape === "cylinder" ? (
            <FormRow label="Direcció">
              <IconChoice label="Direcció" hideLabel value={axis} options={AXIS_OPTIONS} onChange={(a) => update(cylinderPatch(o, a))} />
            </FormRow>
          ) : (
            <FormRow label="Direcció del tall">
              <IconChoice label="Direcció del tall" hideLabel value={axis} options={AXIS_OPTIONS} onChange={(a) => update({ axis: a === "z" ? undefined : a })} />
            </FormRow>
          )}
        </FoldItem>
      )}
      <FoldItem id="ref-size" title="Mides" icon={LuMoveDiagonal}>
        {o.shape === "profile" ? (
          <>
            <NumRow label="Llarg" value={sectionOf(o).length} min={1} max={20000} step={10} onChange={(length) => update(sizePatch(o, { length }))} />
            <FormRow label="Secció">
              <Text fontSize="sm" color="fg.muted" pt={1.5}>
                {Math.round(sectionOf(o).su)} × {Math.round(sectionOf(o).sv)} · {o.profile?.length ?? 0} punts
              </Text>
            </FormRow>
          </>
        ) : o.shape === "cylinder" ? (
          <>
            <NumRow label="Diàmetre (Ø)" value={cylinderDims(o).diameter} min={1} max={20000} step={5} onChange={(diameter) => update(cylinderPatch(o, o.axis ?? "z", { diameter }))} />
            <NumRow label="Llarg" value={cylinderDims(o).length} min={1} max={20000} step={10} onChange={(length) => update(cylinderPatch(o, o.axis ?? "z", { length }))} />
          </>
        ) : (
          <>
            <NumRow label="Ample" value={o.w} min={1} max={20000} step={10} onChange={(w) => update({ w })} />
            <NumRow label="Alt" value={o.h} min={1} max={20000} step={10} onChange={(h) => update({ h })} />
            <NumRow label="Fondària" value={o.d} min={1} max={20000} step={10} onChange={(d) => update({ d })} />
          </>
        )}
      </FoldItem>
      {o.effect !== "cut" && (
        <FoldItem id="ref-material" title="Material" icon={LuPalette} badge={o.material ?? "Fantasma"} badgePalette={o.material ? "wood" : "gray"}>
          <FormRow label="Material" help={o.material ? "Es veu sòlid amb aquest material i surt a la Presentació i al render." : "Sense material, és un fantasma translúcid (només per comprovar que tot hi cap; no surt al render)."} maxW="280px">
            <MaterialSelect label="Material" materials={settings.materials} value={o.material ?? ""} emptyLabel="Cap (fantasma)" hideLabel onChange={(v) => update({ material: v || undefined })} />
          </FormRow>
        </FoldItem>
      )}
      {o.shape === "profile" && o.profile && (
        <ProfileEditor
          open={editing}
          initial={toNodes(o.profile)}
          axes={AXIS_NAMES[o.axis ?? "z"]}
          onClose={() => setEditing(false)}
          onApply={({ points, w, h }) => {
            update({ profile: points, ...sizePatch(o, { su: w, sv: h }) })
            setEditing(false)
          }}
        />
      )}
      <FoldItem id="ref-attach" title="Enganxada" icon={LuLink} badge={attached} badgePalette={o.onFloor || o.onWall ? "wood" : "gray"}>
        {/* Enganxar-lo: interruptors discrets (es poden activar tots dos). */}
        <FormRow label="Enganxat">
          <HStack {...segGroup}>
            <Button {...segItem(!!o.onFloor)} px={2} aria-pressed={!!o.onFloor} title="Sempre a terra (Y = 0): al 3D només es mou pel terra" onClick={() => update({ onFloor: o.onFloor ? undefined : true })}>
              <LuArrowDownToLine /> Al terra
            </Button>
            <Button {...segItem(!!o.onWall)} px={2} aria-pressed={!!o.onWall} title="Sempre tocant la paret (Z = 0): al 3D només es mou per la paret" onClick={() => update({ onWall: o.onWall ? undefined : true })}>
              <LuBrickWall /> A la paret
            </Button>
          </HStack>
        </FormRow>
        <Text fontSize="xs" color="fg.muted">
          {o.onFloor && o.onWall
            ? "Al terra i a la paret: al 3D només es mou de costat."
            : o.onFloor
              ? "Al terra: al 3D es mou lliscant pel terra."
              : o.onWall
                ? "A la paret: al 3D es mou per la paret (amunt, avall i de costat)."
                : "Al 3D, arrossega'l: s'enganxa a les vores dels mòduls i dels altres objectes (Alt: lliure; Maj: pel terra)."}
        </Text>
      </FoldItem>
      <FoldItem id="ref-position" title="Posició" icon={LuMove}>
        {/* Cada direcció amb la seva icona i un nom, no només la lletra de l'eix. */}
        <NumRow label={<AxisLabel icon={LuMoveHorizontal} name="De costat" axis="X" hint="Des de l'esquerra del moble" />} ariaLabel="De costat (X)" value={o.x} min={-30000} max={30000} step={10} onChange={(x) => update({ x })} />
        <NumRow label={<AxisLabel icon={LuMoveVertical} name="Alçada" axis="Y" hint="Des del terra" />} ariaLabel="Alçada (Y)" value={o.y} min={-30000} max={30000} step={10} disabled={!!o.onFloor} onChange={(y) => update({ y })} />
        <NumRow label={<AxisLabel icon={LuMoveDiagonal2} name="Fons" axis="Z" hint="Des de la paret cap endavant" />} ariaLabel="Fons (Z)" value={o.z} min={-30000} max={30000} step={10} disabled={!!o.onWall} onChange={(z) => update({ z })} />
        <Text fontSize="xs" color="fg.muted">
          De costat (X) des de l'esquerra del moble · Alçada (Y) des del terra · Fons (Z) des de la paret cap endavant.
          {o.onFloor || o.onWall ? " El que és enganxat (Enganxada) no es pot canviar aquí." : ""} Fletxes: 1 mm (Maj: 10 mm); Re Pàg / Av Pàg: fondària.
        </Text>
      </FoldItem>
    </Stack>
  )
}

type Axis = "x" | "y" | "z"

/** Direcció (eix) amb icona; el tooltip diu quines peces talla. */
const AXIS_OPTIONS: IconOption<Axis>[] = [
  { value: "z", label: "Cap a la paret", icon: LuMoveDiagonal2, hint: "Cap a la paret (talla fons i portes)" },
  { value: "y", label: "Vertical", icon: LuMoveVertical, hint: "Vertical (talla base, tapa i prestatges)" },
  { value: "x", label: "De costat", icon: LuMoveHorizontal, hint: "De costat (talla laterals i divisions)" },
]

/** Forma de l'objecte: pastilles amb icona i nom (la icona també és la de la secció). */
const SHAPES: { id: "box" | "cylinder" | "profile"; name: string; icon: IconType }[] = [
  { id: "box", name: "Caixa", icon: LuBox },
  { id: "cylinder", name: "Cilindre", icon: LuCylinder },
  { id: "profile", name: "Perfil", icon: LuSpline },
]
const SHAPE_OPTIONS: { id: "box" | "cylinder" | "profile"; name: string; icon: IconType; label: ReactNode }[] = SHAPES.map((s) => ({
  ...s,
  label: (
    <>
      <s.icon /> {s.name}
    </>
  ),
}))

/** Noms dels eixos (u, v) de la secció per a cada direcció (`SECTION_AXES`). */
const AXIS_NAMES: Record<Axis, [string, string]> = { z: ["Ample", "Alt"], y: ["Ample", "Fondària"], x: ["Fondària", "Alt"] }

/** Mida de la secció (u, v) i llarg (direcció) d'un objecte. */
function sectionOf(o: RefObject): { su: number; sv: number; length: number } {
  const axis = o.axis ?? "z"
  const [u, v] = SECTION_AXES[axis]
  const size = [o.w, o.h, o.d]
  return { su: size[u]!, sv: size[v]!, length: size[AXIS_INDEX[axis]]! }
}

/** Canvia la mida de la secció i/o el llarg, mantenint la posició (cantonada mínima). */
function sizePatch(o: RefObject, c: { su?: number; sv?: number; length?: number }): Partial<RefObject> {
  const axis = o.axis ?? "z"
  const [u, v] = SECTION_AXES[axis]
  const size = [o.w, o.h, o.d]
  if (c.su !== undefined) size[u] = c.su
  if (c.sv !== undefined) size[v] = c.sv
  if (c.length !== undefined) size[AXIS_INDEX[axis]] = c.length
  return { w: size[0]!, h: size[1]!, d: size[2]! }
}

/** Passa a perfil: el rectangle de la secció actual. */
function profilePatch(o: RefObject): Partial<RefObject> {
  const { su, sv } = sectionOf(o)
  return { shape: "profile", profile: [{ x: 0, y: 0 }, { x: su, y: 0 }, { x: su, y: sv }, { x: 0, y: sv }] }
}

/** Canvia la direcció d'un perfil: la secció es conserva i el llarg passa al nou eix. */
function profileAxisPatch(o: RefObject, axis: Axis): Partial<RefObject> {
  const { su, sv, length } = sectionOf(o)
  const n: RefObject = { ...o, axis }
  return { axis: axis === "z" ? undefined : axis, ...sizePatch(n, { su, sv, length }) }
}

/** Ø i llarg d'un cilindre a partir de la seva caixa. */
function cylinderDims(o: RefObject): { diameter: number; length: number } {
  const a = o.axis ?? "z"
  if (a === "x") return { diameter: Math.min(o.h, o.d), length: o.w }
  if (a === "y") return { diameter: Math.min(o.w, o.d), length: o.h }
  return { diameter: Math.min(o.w, o.h), length: o.d }
}

/** Caixa d'un cilindre amb eix `axis` (conserva el centre de la secció). */
function cylinderPatch(o: RefObject, axis: Axis, change: { diameter?: number; length?: number } = {}): Partial<RefObject> {
  const cur = o.shape === "cylinder" ? cylinderDims(o) : { diameter: Math.min(o.w, o.h), length: o.d }
  const diameter = change.diameter ?? cur.diameter
  const length = change.length ?? cur.length
  const cx = o.x + o.w / 2
  const cy = o.y + o.h / 2
  const cz = o.z + o.d / 2
  const w = axis === "x" ? length : diameter
  const h = axis === "y" ? length : diameter
  const d = axis === "z" ? length : diameter
  return { shape: "cylinder", axis, w, h, d, x: Math.round(cx - w / 2), y: Math.max(0, Math.round(cy - h / 2)), z: Math.round(cz - d / 2) }
}

/** Accions de l'objecte seleccionat, a la capçalera de l'inspector. */
export function RefActions({ comp, id, onChange, onRemoved, onSelected }: { comp: Composition; id: string; onChange: (c: Composition) => void; onRemoved: () => void; onSelected?: (id: string) => void }) {
  const { settings, save } = useSettings()
  const o = comp.references.find((r) => r.id === id)
  if (!o) return null
  const saveAsPreset = () => {
    void save({ ...settings, references: [{ id: newId("ref"), name: o.name, w: o.w, h: o.h, d: o.d, plane: "wall", wallOffset: Math.max(0, o.z) }, ...settings.references] })
    toaster.create({ title: `«${o.name}» desat a les preferències`, type: "success" })
  }
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton size="xs" variant="ghost" aria-label="Accions de l'objecte">
          <LuEllipsis />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item
              value="dup"
              onClick={() => {
                const res = insertRefCopy(comp, o)
                onChange(res.comp)
                onSelected?.(res.id)
              }}
            >
              <LuCopy /> Duplicar
            </Menu.Item>
            <Menu.Item value="save" onClick={saveAsPreset}>
              <LuBookmark /> Desar a les preferències
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item
              value="del"
              color="fg.error"
              onClick={() => {
                onChange({ ...comp, references: comp.references.filter((r) => r.id !== id) })
                onRemoved()
              }}
            >
              <LuTrash2 /> Eliminar
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

/** Rètol d'una direcció de moviment: icona + nom, i la lletra de l'eix en petit. */
/** Mateixos colors que les fletxes del 3D: vermell de costat, verd amunt, blau endavant. */
const AXIS_TINT: Record<string, string> = { X: "#e5484d", Y: "#30a46c", Z: "#0090ff" }

export function AxisLabel({ icon: Icon, name, axis, hint }: { icon: IconType; name: string; axis: string; hint: string }) {
  return (
    <HStack as="span" gap={1} title={`${name} (${axis}): ${hint}`}>
      <Box as="span" color={AXIS_TINT[axis]} display="inline-flex">
        <Icon />
      </Box>
      <span>{name}</span>
      <Text as="span" color="fg.subtle" fontSize="2xs">
        {axis}
      </Text>
    </HStack>
  )
}
