import { Button, Field, HStack, NativeSelect, SimpleGrid, Stack, Switch, Text } from "@chakra-ui/react"
import { DEFAULT_GRILLE, materialByName, type Base, type Carcass, type Module, type Top } from "../../core/model"
import { NumberField } from "../editor/ParamsForm"
import { IconChoice } from "../../components/IconChoice"
import { useState } from "react"
import { PRESETS, ProfileEditor } from "./ProfileEditor"
import { LuCircle, LuPencilRuler, LuRectangleHorizontal } from "react-icons/lu"
import { LuArrowDownToLine, LuDrill, LuGrid3X3, LuLayers2, LuPanelBottom, LuPanelTop, LuSquareDashed, LuSquare, LuSquareDashedBottom, LuSquareSquare, LuSquareStack, LuTable, LuTriangleRight, LuWind } from "react-icons/lu"
import { useSettings } from "../settings/SettingsContext"
import { MaterialSelect } from "../settings/SettingsScreen"

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
        <SimpleGrid columns={3} gap={3}>
          <NumberField label="Amplada" value={c.width} min={100} max={3000} step={10} onChange={(width) => set({ width })} />
          <NumberField label="Alçada" value={c.height} min={100} max={2800} step={10} onChange={(height) => set({ height })} />
          <NumberField label="Fondària" value={c.depth} min={100} max={1200} step={10} onChange={(depth) => set({ depth })} />
        </SimpleGrid>
      </Stack>
    )
  if (section === "structure")
    return (
      <Stack gap={4}>
        {/* «Penjat a la paret» és una posició, no una base: es tria a la secció Posició. */}
        {c.base.kind === "wall" ? (
          <Text fontSize="sm" color="fg.muted">
            Base: cap (penjat a la paret, a {c.base.height} mm del terra). Es canvia a Posició.
          </Text>
        ) : (
          <IconChoice
            label="Base"
            value={c.base.kind as Exclude<Base["kind"], "wall">}
            options={[
              { value: "none", label: "Directe a terra", icon: LuArrowDownToLine, hint: "Directe a terra, sense sòcol ni potes" },
              { value: "plinth", label: "Sòcol", icon: LuPanelBottom, hint: "Sòcol retranquejat a sota" },
              { value: "legs", label: "Potes", icon: LuTable, hint: "Potes regulables" },
              { value: "open", label: "Sense base (obert)", icon: LuSquareDashedBottom, hint: "Sense base: obert per sota" },
            ]}
            onChange={(k) => {
              const base: Base = k === "plinth" ? { kind: "plinth", height: 60, setback: 30 } : k === "legs" ? { kind: "legs", height: 100 } : { kind: k }
              set({ base })
            }}
          />
        )}
        {/* Base a tota l'amplada i les seves mides a sota, en dues columnes: així els camps
            numèrics tenen prou espai i les etiquetes no es tallen. */}
        {c.base.kind === "plinth" && (
          <SimpleGrid columns={2} gap={3}>
            <NumberField label="Alçada sòcol" value={c.base.height} min={20} max={300} step={5} onChange={(height) => set({ base: { kind: "plinth", height, setback: (c.base as { setback: number }).setback } })} />
            <NumberField label="Retranqueig" value={c.base.setback} min={0} max={100} step={5} onChange={(setback) => set({ base: { kind: "plinth", height: (c.base as { height: number }).height, setback } })} />
          </SimpleGrid>
        )}
        {c.base.kind === "legs" && (
          <SimpleGrid columns={2} gap={3}>
            <NumberField label="Alçada potes" value={c.base.height} min={20} max={400} step={5} onChange={(height) => set({ base: { kind: "legs", height } })} />
          </SimpleGrid>
        )}

        <SimpleGrid columns={2} gap={3}>
          <IconChoice
            label="Fons"
            value={c.back}
            options={[
              { value: "groove", label: "En ranura", icon: LuLayers2, hint: "Fons encaixat en una ranura" },
              { value: "screwed", label: "Cargolat darrere", icon: LuDrill, hint: "Fons cargolat per darrere" },
              { value: "none", label: "Sense fons", icon: LuSquareDashed },
            ]}
            onChange={(back) => set({ back })}
          />
          <IconChoice
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
          {c.top.kind === "ventSlot" && <NumberField label="Ranura d'aire" value={c.top.gap} min={20} max={200} step={5} onChange={(gap) => set({ top: { kind: "ventSlot", gap } })} />}
        </SimpleGrid>

        {/* Tauler de taula: tapa per sobre dels laterals, amb voladís i forma. */}
        {c.top.kind === "full" && <TableTopFields module={module} onChange={onChange} />}

        {/* Parets buides: caixa de dues pells que fa el moble com si fos de fusta gruixuda. */}
        <Stack gap={2}>
          <Switch.Root
            size="sm"
            checked={!!c.hollow}
            onCheckedChange={(e) => set({ hollow: e.checked ? { thickness: Math.max(60, 2 * c.thickness + 20) } : undefined })}
          >
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>Parets buides (gruix aparent)</Switch.Label>
          </Switch.Root>
          {c.hollow && (
            <NumberField
              label="Gruix aparent de les parets"
              value={c.hollow.thickness}
              min={2 * c.thickness + 6}
              max={300}
              step={5}
              onChange={(thickness) => set({ hollow: { thickness } })}
              help={`Laterals, base i tapa: pell de fora i de dins de ${c.thickness} mm, llistons a dins i una tira al davant. L'interior va igual.`}
            />
          )}
        </Stack>

        {/* Acabats: com s'uneix la tapa amb els laterals i com van els fronts. */}
        <SimpleGrid columns={2} gap={3}>
          {/* Sense laterals (o sense tapa, si no són parets buides) no hi ha cantonades a unir. */}
          {!(c.sides.left || c.sides.right) || (!c.hollow && c.top.kind === "none") ? null : c.hollow ? (
            // Amb parets buides les cantonades són sempre a inglet (com un bloc massís).
            <Stack gap={1.5}>
              <HStack gap={1.5} fontSize="sm">
                <Text fontWeight="medium">Cantonades</Text>
                <Text color="fg.muted">· A inglet</Text>
              </HStack>
              <Text fontSize="xs" color="fg.muted">
                Amb parets buides, sempre a inglet: pells de fora a 45° i tires del davant en marc.
              </Text>
            </Stack>
          ) : (
            <IconChoice
              label="Cantonades"
              value={c.joint ?? "butt"}
              options={[
                { value: "butt", label: "Normals", icon: LuSquare, hint: "Normals: la tapa entre els laterals, amb espigues" },
                { value: "mitre", label: "A inglet", icon: LuTriangleRight, hint: "A inglet: tapa i laterals tallats a 45°, no es veu cap cantell" },
              ]}
              onChange={(joint) => set({ joint: joint === "butt" ? undefined : joint })}
            />
          )}
          <IconChoice
            label="Fronts"
            value={module.fronts.style ?? "overlay"}
            options={[
              { value: "overlay", label: "Recobrents", icon: LuSquareStack, hint: "Recobrents: per davant de la caixa, tapant els cantells" },
              { value: "inset", label: "Encastats", icon: LuSquareSquare, hint: "Encastats: dins de la llum, a nivell amb el davant de la caixa" },
            ]}
            onChange={(style) => onChange({ ...module, fronts: { ...module.fronts, style: style === "overlay" ? undefined : style } })}
          />
        </SimpleGrid>

        {/* No dins d'un Field.Root: el Field dona el mateix id als dos interruptors i els dos
            rètols activaven el mateix (no es podia treure el lateral dret). */}
        <Stack gap={1.5}>
          <Text fontSize="sm" fontWeight="medium">
            Laterals
          </Text>
          <SimpleGrid columns={2} gap={3} w="full">
            <Switch.Root size="sm" checked={c.sides.left} onCheckedChange={(e) => set({ sides: { ...c.sides, left: e.checked } })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label>Esquerre</Switch.Label>
            </Switch.Root>
            <Switch.Root size="sm" checked={c.sides.right} onCheckedChange={(e) => set({ sides: { ...c.sides, right: e.checked } })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label>Dret</Switch.Label>
            </Switch.Root>
          </SimpleGrid>
        </Stack>
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

export function MaterialsForm({ carcass: c, onPatch, mixed, hasBack = c.back !== "none" }: { carcass: Carcass; onPatch: (patch: Partial<Carcass>) => void; mixed?: boolean; /** Sense fons: no surten les opcions del fons. */ hasBack?: boolean }) {
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
  const boards = settings.materials.filter((m) => !m.forBacks)
  return (
    <Stack gap={3}>
      {mixed && (
        <Text fontSize="xs" color="fg.muted">
          Els mòduls tenen materials diferents; es mostren els del primer. El que triïs s'aplica a tots.
        </Text>
      )}
      <SimpleGrid columns={2} gap={3}>
        <MaterialSelect label="Cos" materials={boards} value={c.material} onChange={pickMaterial("material", "thickness")} />
        <NumberField label="Gruix" value={c.thickness} min={8} max={40} step={1} onChange={(thickness) => onPatch(sameBack ? { thickness, backThickness: thickness } : { thickness })} help={mat ? mat.thicknesses.join(" · ") : undefined} />
      </SimpleGrid>
      <Field.Root>
        <Field.Label fontSize="sm">Fronts (portes, calaixos, abatibles)</Field.Label>
        <NativeSelect.Root size="sm">
          <NativeSelect.Field value={c.frontMaterial ?? ""} onChange={(e) => onPatch({ frontMaterial: e.target.value || undefined })}>
            <option value="">Com el cos</option>
            {boards.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Field.HelperText>Mateix gruix que el cos.</Field.HelperText>
      </Field.Root>
      {hasBack && <SimpleGrid columns={2} gap={3}>
        <Field.Root>
          <Field.Label fontSize="sm">Fons</Field.Label>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field value={sameBack ? SAME : c.backMaterial} onChange={(e) => pickMaterial("backMaterial", "backThickness")(e.target.value)}>
              <option value={SAME}>Com el cos</option>
              {!settings.materials.some((m) => m.name === c.backMaterial) && <option value={c.backMaterial}>{c.backMaterial || "(sense material)"}</option>}
              {settings.materials.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
        <NumberField label="Gruix" value={c.backThickness} min={3} max={40} step={1} onChange={(backThickness) => onPatch({ backThickness })} help={backMat ? backMat.thicknesses.join(" · ") : undefined} />
      </SimpleGrid>}
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

/** Jocs i ferratges del mòdul seleccionat (secció «Fusteria (avançat)»). */
export function JoineryForm({ module, onChange }: { module: Module; onChange: (m: Module) => void }) {
  const c = module.carcass
  const set = (patch: Partial<Carcass>) => onChange({ ...module, carcass: { ...c, ...patch } })
  return (
    <Stack gap={3}>
      <SimpleGrid columns={2} gap={3}>
        <NumberField label="Joc front–cos" value={module.fronts.outerGap} min={0} max={10} step={0.5} onChange={(outerGap) => onChange({ ...module, fronts: { ...module.fronts, outerGap } })} />
        <NumberField label="Joc entre fronts" value={module.fronts.betweenGap} min={0} max={10} step={0.5} onChange={(betweenGap) => onChange({ ...module, fronts: { ...module.fronts, betweenGap } })} />
        <NumberField label="Retranqueig prest." value={c.shelfSetback} min={0} max={100} step={1} onChange={(shelfSetback) => set({ shelfSetback })} />
        {c.back === "groove" && <NumberField label="Ranura del fons" value={c.backSetback} min={0} max={60} step={1} onChange={(backSetback) => set({ backSetback })} help="Distància al cantell posterior" />}
      </SimpleGrid>
      <SimpleGrid columns={3} gap={3}>
        <NumberField label="Cassoleta Ø" value={module.hardware.hinge.cupDiameter} min={20} max={40} step={1} onChange={(cupDiameter) => onChange({ ...module, hardware: { ...module.hardware, hinge: { ...module.hardware.hinge, cupDiameter } } })} />
        <NumberField label="S32 pas" value={module.hardware.system32.pitch} min={16} max={64} step={1} onChange={(pitch) => onChange({ ...module, hardware: { ...module.hardware, system32: { ...module.hardware.system32, pitch } } })} />
        <NumberField label="Espiga Ø" value={module.hardware.dowel.diameter} min={5} max={12} step={1} onChange={(diameter) => onChange({ ...module, hardware: { ...module.hardware, dowel: { ...module.hardware.dowel, diameter } } })} />
      </SimpleGrid>
      <Text fontSize="xs" color="fg.muted">
        Guies de calaix: {module.hardware.drawer.slideLengths.join(" · ")} mm, joc lateral {module.hardware.drawer.sideClearance} mm per costat.
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
      <Switch.Root size="sm" checked={!!tt} onCheckedChange={(e) => set(e.checked ? { overhang: 30 } : undefined)}>
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label>Tauler de taula (per sobre dels laterals)</Switch.Label>
      </Switch.Root>
      {tt && (
        <>
          <NumberField label="Voladís a tot el voltant" value={tt.overhang} min={0} max={1000} step={10} onChange={(overhang) => set({ ...tt, overhang })} help={`Tauler de ${L} × ${D} mm. Les cantonades a inglet no s'hi apliquen.`} />
          <HStack gap={1.5} wrap="wrap">
            <Text fontSize="sm" fontWeight="medium" mr={1}>
              Forma
            </Text>
            <Button size="xs" variant={!tt.shape ? "solid" : "outline"} colorPalette="wood" onClick={() => set({ overhang: tt.overhang })}>
              <LuRectangleHorizontal /> Rectangle
            </Button>
            <Button size="xs" variant="outline" colorPalette="wood" onClick={() => set({ ...tt, shape: preset("round") })}>
              <LuSquare /> Arrodonit
            </Button>
            <Button size="xs" variant="outline" colorPalette="wood" onClick={() => set({ ...tt, shape: preset("ellipse") })}>
              <LuCircle /> Oval
            </Button>
            <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
              <LuPencilRuler /> Editar…
            </Button>
          </HStack>
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
